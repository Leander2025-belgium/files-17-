/* Presentation-only controls. Existing map, providers and radar handlers remain authoritative. */
(() => {
  'use strict';
  const toggle = document.getElementById('radarLayersToggle');
  const extras = document.getElementById('radarExtraLayers');
  const closeLayers = () => { extras.hidden = true; toggle.setAttribute('aria-expanded', 'false'); };
  toggle.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', String(open)); extras.hidden = !open;
  });
  extras.addEventListener('click', event => { if (event.target.closest('button')) closeLayers(); });
  document.addEventListener('click', event => { if (!event.target.closest('.radar-top')) closeLayers(); });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !extras.hidden) { closeLayers(); toggle.focus(); }
  });
  const slider = document.getElementById('radarFrameSlider');
  const axis = document.getElementById('radarDesignAxis');
  const caption = document.getElementById('radarDesignCaption');
  window.wfUpdateRadarTimeline = () => {
    const frames = state.radar.frames || [];
    const max = Math.max(1, frames.length - 1);
    const observed = frames.map((frame, index) => ({frame, index})).filter(item => !item.frame.isNowcast);
    const nowIndex = frames.findIndex(frame => frame.isNow);
    const anchor = nowIndex >= 0 ? nowIndex : (observed.at(-1)?.index ?? 0);
    const hasFuture = frames.some(frame => frame.isNowcast);
    slider.style.setProperty('--radar-observed', `${hasFuture ? anchor / max * 100 : 100}%`);
    slider.style.setProperty('--radar-progress', `${Math.max(0, Math.min(max, state.radar.index)) / max * 100}%`);
    slider.disabled = frames.length < 2;
    slider.setAttribute('aria-valuetext', document.getElementById('timeLabel').textContent);
    const ticks = [];
    if (frames.length > 1) {
      const anchorTime = frames[anchor].time;
      const candidates = [0, anchor];
      if (hasFuture) {
        const hour = frames.findIndex(frame => frame.time >= anchorTime + 3600);
        if (hour >= 0) candidates.push(hour);
      }
      candidates.push(frames.length - 1);
      [...new Set(candidates)].sort((a,b) => a-b).forEach(index => {
        const minutes = Math.round((frames[index].time - anchorTime) / 60);
        const label = index === anchor ? 'Nu' : `${minutes > 0 ? '+' : '−'}${Math.abs(minutes) % 60 === 0 ? `${Math.abs(minutes) / 60}u` : `${Math.abs(minutes)}m`}`;
        const left = index / max * 100;
        if (ticks.length && left - ticks.at(-1).left < 14 && index !== frames.length - 1) return;
        ticks.push({label,left});
      });
    }
    const key = JSON.stringify(ticks);
    if (axis.dataset.ticks !== key) {
      axis.replaceChildren(...ticks.map(tick => {
        const span = document.createElement('span'); span.textContent = tick.label; span.style.left = `${tick.left}%`; return span;
      })); axis.dataset.ticks = key;
    }
    const text = !frames.length ? 'Radargegevens laden…' : hasFuture ? 'Na Nu: verwachting' : 'Gemeten radarbeelden';
    if (caption.textContent !== text) caption.textContent = text;
  };
  window.wfUpdateRadarTimeline();
})();
