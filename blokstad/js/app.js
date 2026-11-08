// Hoofdmenu: stadskaart, gebied kiezen, downloaden, beheren en spelen.
import { WIDTH, LENGTH, HEIGHT, districtAt, riverX } from './city.js';
import * as store from './storage.js';

const $ = (s) => document.querySelector(s);
const MAP_SCALE = 5; // meter per pixel op de overzichtskaart

const worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
let reqId = 0;
const pending = new Map();
worker.onmessage = (e) => { const h = pending.get(e.data.id); if (h) h(e.data); };
function ask(msg, handler) { const id = ++reqId; pending.set(id, handler); worker.postMessage({ ...msg, id }); return id; }

const state = { size: 128, sel: null, regions: [], zoom: 1, busy: false };
let game = null;

// ---------- overzichtskaart ----------
const mapCanvas = $('#map'), overlay = $('#map-overlay'), mapWrap = $('#map-wrap');
const MW = Math.floor(WIDTH / MAP_SCALE), MH = Math.floor(LENGTH / MAP_SCALE);
mapCanvas.width = overlay.width = MW;
mapCanvas.height = overlay.height = MH;
const mctx = mapCanvas.getContext('2d'), octx = overlay.getContext('2d');
mctx.fillStyle = '#1b2230'; mctx.fillRect(0, 0, MW, MH);

ask({ type: 'map', scale: MAP_SCALE }, (m) => {
  if (m.type === 'mapRows') {
    mctx.putImageData(new ImageData(m.data, m.w, m.rows), 0, m.y0);
    $('#map-status').textContent = `Kaart tekenen… ${Math.round((m.y0 + m.rows) / MH * 100)}%`;
  } else if (m.type === 'mapDone') {
    $('#map-status').textContent = '';
  }
});

function setZoom(z) {
  state.zoom = z;
  const base = Math.min(mapWrap.clientWidth - 4, 520);
  const w = Math.round(base * z);
  for (const c of [mapCanvas, overlay]) { c.style.width = w + 'px'; c.style.height = Math.round(w * MH / MW) + 'px'; }
  $('#map-stack').style.width = w + 'px';
  $('#zoom-label').textContent = `${z}×`;
}
$('#zoom-in').onclick = () => setZoom(Math.min(4, state.zoom * 2));
$('#zoom-out').onclick = () => setZoom(Math.max(1, state.zoom / 2));
window.addEventListener('resize', () => setZoom(state.zoom));

function drawOverlay() {
  octx.clearRect(0, 0, MW, MH);
  // km-markeringen
  octx.font = 'bold 11px system-ui, sans-serif';
  for (let km = 1; km < LENGTH / 1000; km++) {
    const y = km * 1000 / MAP_SCALE;
    octx.fillStyle = 'rgba(255,255,255,0.35)';
    octx.fillRect(0, y, 14, 1);
    octx.fillStyle = 'rgba(0,0,0,0.55)'; octx.fillRect(16, y - 7, 34, 14);
    octx.fillStyle = '#fff'; octx.fillText(`${km} km`, 18, y + 4);
  }
  for (const r of state.regions) {
    octx.fillStyle = 'rgba(80, 220, 120, 0.35)';
    octx.strokeStyle = 'rgba(80, 220, 120, 0.95)'; octx.lineWidth = 1;
    const x = r.x0 / MAP_SCALE, y = r.z0 / MAP_SCALE, s = r.size / MAP_SCALE;
    octx.fillRect(x, y, s, s); octx.strokeRect(x + 0.5, y + 0.5, s - 1, s - 1);
  }
  if (state.sel) {
    const { x0, z0, size } = state.sel;
    octx.strokeStyle = '#ffd34d'; octx.lineWidth = 2;
    octx.strokeRect(x0 / MAP_SCALE, z0 / MAP_SCALE, size / MAP_SCALE, size / MAP_SCALE);
    octx.strokeStyle = 'rgba(0,0,0,0.7)'; octx.lineWidth = 1;
    octx.strokeRect(x0 / MAP_SCALE - 2, z0 / MAP_SCALE - 2, size / MAP_SCALE + 4, size / MAP_SCALE + 4);
  }
}

overlay.addEventListener('click', (e) => {
  const rect = overlay.getBoundingClientRect();
  const x = (e.clientX - rect.left) / rect.width * WIDTH;
  const z = (e.clientY - rect.top) / rect.height * LENGTH;
  select(x, z);
});
overlay.addEventListener('mousemove', (e) => {
  const rect = overlay.getBoundingClientRect();
  const x = Math.floor((e.clientX - rect.left) / rect.width * WIDTH);
  const z = Math.floor((e.clientY - rect.top) / rect.height * LENGTH);
  const d = districtAt(x, z);
  $('#hover').textContent = `x ${x} · z ${z} — ${d.wijk} (${d.typeName})`;
});
overlay.addEventListener('mouseleave', () => { $('#hover').textContent = ''; });

function select(x, z, scroll = false) {
  const s = state.size;
  const x0 = Math.max(0, Math.min(WIDTH - s, Math.round(x - s / 2)));
  const z0 = Math.max(0, Math.min(LENGTH - s, Math.round(z - s / 2)));
  state.sel = { x0, z0, size: s };
  drawOverlay();
  const d = districtAt(x0 + s / 2, z0 + s / 2);
  $('#sel-info').innerHTML = `<b>${d.wijk}</b> · ${d.typeName}<br><span class="muted">x ${x0}–${x0 + s} m · z ${z0}–${z0 + s} m · ${s}×${s} m</span>`;
  $('#sel-name').value = `${d.wijk} (${d.typeName})`;
  $('#btn-download').disabled = state.busy;
  $('#selection').hidden = false;
  const pv = $('#preview'), pctx = pv.getContext('2d');
  pv.width = pv.height = s;
  pctx.fillStyle = '#222'; pctx.fillRect(0, 0, s, s);
  ask({ type: 'preview', x0, z0, size: s }, (m) => {
    if (state.sel && state.sel.x0 === x0 && state.sel.z0 === z0 && state.sel.size === s) pctx.putImageData(new ImageData(m.data, m.size, m.size), 0, 0);
  });
  if (scroll) {
    const rect = overlay.getBoundingClientRect();
    const y = (z0 + s / 2) / LENGTH * rect.height;
    const xx = (x0 + s / 2) / WIDTH * rect.width;
    mapWrap.scrollTo({ top: y - mapWrap.clientHeight / 2, left: xx - mapWrap.clientWidth / 2, behavior: 'smooth' });
  }
}

document.querySelectorAll('[data-size]').forEach(b => b.addEventListener('click', () => {
  state.size = +b.dataset.size;
  document.querySelectorAll('[data-size]').forEach(o => o.classList.toggle('on', o === b));
  if (state.sel) select(state.sel.x0 + state.sel.size / 2, state.sel.z0 + state.sel.size / 2);
}));

// snelkoppelingen
const JUMPS = [
  ['Centrum', 1050, 12500], ['Rivier & brug', null, 12250], ['Stadspark', 500, 13850],
  ['Zuidcentrum', 1100, 5200], ['Noordcentrum', 1100, 19800], ['Stadswijk', 1125, 4125],
  ['Woonwijk', 375, 1125], ['Industrie', 1125, 1125],
  ['Haven Noord', 900, 420], ['Haven Zuid', 900, 24580],
];
const jumps = $('#jumps');
for (const [label, x, z] of JUMPS) {
  const b = document.createElement('button');
  b.className = 'chip'; b.textContent = label;
  b.onclick = () => select(x ?? riverX(z), z, true);
  jumps.appendChild(b);
}
$('#goto').addEventListener('submit', (e) => {
  e.preventDefault();
  const x = +$('#goto-x').value, z = +$('#goto-z').value;
  if (Number.isFinite(x) && Number.isFinite(z)) select(x, z, true);
});

// ---------- downloaden ----------
$('#btn-download').addEventListener('click', () => {
  if (!state.sel || state.busy) return;
  const sel = { ...state.sel };
  const name = $('#sel-name').value.trim() || 'Mijn stuk stad';
  state.busy = true;
  $('#btn-download').disabled = true;
  const bar = $('#dl-bar'), wrap = $('#dl-progress');
  wrap.hidden = false; bar.style.width = '0%';
  $('#dl-text').textContent = 'Downloaden…';
  ask({ type: 'region', x0: sel.x0, z0: sel.z0, size: sel.size }, async (m) => {
    if (m.type === 'progress') {
      bar.style.width = Math.round(m.p * 90) + '%';
      $('#dl-text').textContent = `Downloaden… ${Math.round(m.p * 100)}%`;
    } else if (m.type === 'region') {
      $('#dl-text').textContent = 'Opslaan op dit toestel…';
      bar.style.width = '95%';
      const d = districtAt(sel.x0 + sel.size / 2, sel.z0 + sel.size / 2);
      const meta = {
        id: 'r' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36),
        name, x0: sel.x0, z0: sel.z0, size: sel.size, H: HEIGHT, created: Date.now(), wijk: d.wijk, type: d.typeName,
      };
      try {
        await store.saveRegion(meta, m.vox);
        bar.style.width = '100%';
        $('#dl-text').textContent = 'Klaar! Je vindt het hieronder bij “Mijn stukken”.';
      } catch (err) {
        $('#dl-text').textContent = 'Opslaan mislukt: ' + err.message;
      }
      state.busy = false;
      $('#btn-download').disabled = false;
      refreshList();
      setTimeout(() => { wrap.hidden = true; }, 2500);
    }
  });
});

// ---------- mijn stukken ----------
function fmtBytes(n) { return n > 1e6 ? (n / 1e6).toFixed(1) + ' MB' : Math.round(n / 1e3) + ' kB'; }
async function refreshList() {
  try { state.regions = await store.listRegions(); } catch { state.regions = []; }
  drawOverlay();
  const list = $('#regions');
  list.innerHTML = '';
  if (!state.regions.length) {
    list.innerHTML = '<p class="muted">Nog niets gedownload. Klik op de kaart en download een stuk stad.</p>';
    return;
  }
  for (const r of state.regions) {
    const card = document.createElement('div');
    card.className = 'region';
    const edited = r.edited ? ' · bewerkt' : '';
    card.innerHTML = `
      <div class="r-title"></div>
      <div class="muted small">${r.size}×${r.size} m · x ${r.x0} · z ${r.z0}${r.bytes ? ' · ' + fmtBytes(r.bytes) : ''}${edited}</div>
      <div class="r-actions">
        <button class="btn primary" data-a="play">▶ Spelen</button>
        <button class="btn" data-a="show">Toon</button>
        <button class="btn" data-a="export">Bestand</button>
        <button class="btn danger" data-a="del">✕</button>
      </div>`;
    card.querySelector('.r-title').textContent = r.name;
    card.querySelector('[data-a=play]').onclick = () => play(r.id);
    card.querySelector('[data-a=show]').onclick = () => { state.size = r.size; select(r.x0 + r.size / 2, r.z0 + r.size / 2, true); };
    card.querySelector('[data-a=export]').onclick = () => exportRegion(r);
    card.querySelector('[data-a=del]').onclick = async () => {
      if (!confirm(`“${r.name}” verwijderen? Je bouwwerken gaan verloren.`)) return;
      await store.deleteRegion(r.id); refreshList();
    };
    list.appendChild(card);
  }
}

async function exportRegion(r) {
  const vox = await store.loadRegionData(r.id);
  if (!vox) return alert('Gegevens niet gevonden.');
  const blob = await store.exportFile(await store.getRegionMeta(r.id), vox);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = r.name.replace(/[^\w\- ()]+/g, '_') + '.blokstad';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

$('#import').addEventListener('change', async (e) => {
  const f = e.target.files[0];
  e.target.value = '';
  if (!f) return;
  try {
    const { meta, vox } = await store.importFile(f);
    meta.id = 'r' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);
    meta.name = (meta.name || 'Geïmporteerd') + ' (import)';
    await store.saveRegion(meta, vox);
    refreshList();
  } catch (err) { alert('Importeren mislukt: ' + err.message); }
});

// ---------- spelen ----------
async function play(id) {
  const meta = await store.getRegionMeta(id);
  const vox = await store.loadRegionData(id);
  if (!meta || !vox) return alert('Dit stuk kon niet geladen worden.');
  if (!game) {
    const { Game } = await import('./game.js');
    game = new Game({
      root: $('#game'), canvas: $('#game-canvas'), coords: $('#hud-coords'), place: $('#hud-place'),
      hotbar: $('#hotbar'), blockName: $('#block-name'), loading: $('#loading'), invGrid: $('#inv-grid'),
      overlays: { start: $('#ov-start'), pause: $('#ov-pause'), inv: $('#ov-inv') },
      btnResume: $('#btn-resume'), btnInvClose: $('#btn-inv-close'),
      viewRange: $('#set-view'), viewLabel: $('#set-view-label'), sens: $('#set-sens'),
      touch: {
        move: $('#t-move'), look: $('#t-look'), stick: $('#t-stick'), knob: $('#t-knob'), jump: $('#t-jump'), down: $('#t-down'),
        brk: $('#t-break'), put: $('#t-place'), fly: $('#t-fly'), inv: $('#t-inv'), menu: $('#t-menu'),
      },
      onSave: (full) => saveGame(full),
    });
  }
  window.blokstadGame = game;
  $('#menu').hidden = true;
  $('#game-title').textContent = meta.name;
  game.load(meta, vox);
  game.start();
}

let saving = null;
async function saveGame() {
  if (!game || !game.meta) return;
  if (saving) return saving;
  const meta = { ...game.meta, player: game.playerState() };
  if (game.dirty) meta.edited = true;
  const vox = game.dirty ? game.world.vox : null;
  saving = store.saveRegion(meta, vox).then(() => {
    game.meta = meta;
    if (vox) game.dirty = false;
    flash('Opgeslagen ✓');
  }).catch(err => flash('Opslaan mislukt: ' + err.message)).finally(() => { saving = null; });
  return saving;
}
function flash(t) {
  const el = $('#toast'); el.textContent = t; el.hidden = false;
  clearTimeout(flash.t); flash.t = setTimeout(() => { el.hidden = true; }, 1600);
}

$('#btn-save').addEventListener('click', () => saveGame());
$('#btn-exit').addEventListener('click', async () => {
  await saveGame();
  game.stop();
  $('#menu').hidden = false;
  refreshList();
});
window.addEventListener('beforeunload', () => { if (game && game.running && game.dirty) saveGame(); });

// start
setZoom(1);
refreshList().then(() => select(1050, 12500, true));
