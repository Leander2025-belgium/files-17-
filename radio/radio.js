(() => {
  'use strict';

  const API_BASE = 'https://api.wheaterflow.be';
  const ENDPOINTS = {
    rain: `${API_BASE}/api/rain-eta`,
    current: `${API_BASE}/api/current`,
    brain: `${API_BASE}/api/brain`,
    storm: `${API_BASE}/api/storm`,
    warnings: `${API_BASE}/api/kmi/warnings`
  };

  const $ = id => document.getElementById(id);
  const state = {
    location: { name: 'Oostende', lat: 51.2405, lon: 2.9309 },
    rain: null,
    current: null,
    brain: null,
    storm: null,
    warnings: null,
    radioOn: false,
    timer: null,
    audioContext: null,
    speaking: false,
    lastAlertKey: null,
    nextBulletinAt: null,
    scheduleTicker: null,
    volume: 0.9
  };

  const card = $('radioCard');
  const playButton = $('playButton');

  function setStatus(text, kind = '') {
    $('status').textContent = text;
    $('status').className = `status ${kind}`.trim();
  }

  function isFiniteNumber(v) {
    return Number.isFinite(Number(v));
  }

  function pick(obj, paths, fallback = null) {
    for (const path of paths) {
      let cur = obj;
      let ok = true;
      for (const part of path.split('.')) {
        if (cur == null || !(part in Object(cur))) { ok = false; break; }
        cur = cur[part];
      }
      if (ok && cur !== undefined && cur !== null && cur !== '') return cur;
    }
    return fallback;
  }

  function num(obj, paths) {
    const v = pick(obj, paths, null);
    return isFiniteNumber(v) ? Number(v) : null;
  }

  async function getJSON(url, timeoutMs = 6500) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { cache: 'no-store', signal: controller.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } finally {
      clearTimeout(timeout);
    }
  }

  function withLocation(base) {
    const url = new URL(base);
    url.searchParams.set('lat', String(state.location.lat));
    url.searchParams.set('lon', String(state.location.lon));
    return url;
  }

  function withRainLocation() {
    const url = withLocation(ENDPOINTS.rain);
    url.searchParams.set('name', state.location.name);
    return url;
  }

  async function openMeteoFallback() {
    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.searchParams.set('latitude', state.location.lat);
    url.searchParams.set('longitude', state.location.lon);
    url.searchParams.set('current', 'temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,rain,showers,weather_code,cloud_cover,wind_speed_10m,wind_gusts_10m,wind_direction_10m,surface_pressure');
    url.searchParams.set('minutely_15', 'precipitation,weather_code');
    url.searchParams.set('timezone', 'auto');
    url.searchParams.set('forecast_days', '2');
    return getJSON(url, 7000);
  }

  function makeFallbackRain(body) {
    const times = body?.minutely_15?.time || [];
    const rain = body?.minutely_15?.precipitation || [];
    const codes = body?.minutely_15?.weather_code || [];
    const now = Date.now();
    let start = 0;
    if (times.length) {
      start = times.reduce((best, t, i) => Math.abs(new Date(t).getTime() - now) < Math.abs(new Date(times[best]).getTime() - now) ? i : best, 0);
    }
    const slots = [];
    for (let i = start; i < Math.min(times.length, start + 8); i++) {
      const precipitation = Math.max(0, Number(rain[i]) || 0);
      slots.push({
        time: times[i],
        minutes: Math.max(0, Math.round((new Date(times[i]).getTime() - now) / 60000)),
        precipitation,
        weatherCode: codes[i] ?? null,
        wet: precipitation >= 0.1
      });
    }
    const currentAmount = Math.max(0, Number(body?.current?.precipitation) || 0, Number(body?.current?.rain) || 0, Number(body?.current?.showers) || 0);
    const firstWet = slots.find(s => s.wet);
    const raining = currentAmount >= 0.1 || Boolean(slots[0]?.wet);
    const maxRain = Math.max(currentAmount, 0, ...slots.map(s => s.precipitation));
    const status = raining ? 'raining' : firstWet ? 'rain_soon' : 'dry';
    const startsInMinutes = raining ? 0 : firstWet?.minutes ?? null;
    const intensityLabel = maxRain >= 3 ? 'Zware regen' : maxRain >= 1 ? 'Regen' : maxRain >= 0.1 ? 'Lichte regen' : 'Droog';
    const title = raining ? `${intensityLabel} nu` : firstWet ? `Regen over ±${startsInMinutes} min` : 'Droog';
    const summary = raining ? 'Er wordt nu neerslag gedetecteerd.' : firstWet ? `${intensityLabel}. Verwacht binnen ongeveer ${startsInMinutes} minuten.` : 'De komende twee uur wordt voorlopig geen regen verwacht.';
    return {
      location: { name: state.location.name, latitude: state.location.lat, longitude: state.location.lon, timezone: body?.timezone },
      status, title, summary, startsInMinutes, intensityLabel,
      dryWindowMinutes: firstWet?.minutes ?? 120,
      confidence: 0.72,
      heavyShower: maxRain >= 3,
      thunderPossible: false,
      source: 'Open-Meteo fallback',
      slots,
      generatedAt: new Date().toISOString()
    };
  }

  function normalizeCurrent(raw, fallback) {
    const c = raw || {};
    const f = fallback?.current || {};
    return {
      temperature: num(c, ['temperature','temperature_c','temp','tempC','current.temperature','current.temperature_c']) ?? (isFiniteNumber(f.temperature_2m) ? Number(f.temperature_2m) : null),
      apparent: num(c, ['apparentTemperature','apparent_temperature','apparent','feelsLike','current.apparent_temperature']) ?? (isFiniteNumber(f.apparent_temperature) ? Number(f.apparent_temperature) : null),
      humidity: num(c, ['humidity','humidity_pct','relativeHumidity','current.humidity']) ?? (isFiniteNumber(f.relative_humidity_2m) ? Number(f.relative_humidity_2m) : null),
      wind: num(c, ['windKmh','wind_kmh','wind.speedKmh','wind.speed_kmh','windSpeed','current.wind_kmh']) ?? (isFiniteNumber(f.wind_speed_10m) ? Number(f.wind_speed_10m) : null),
      gust: num(c, ['gustKmh','gust_kmh','wind.gustKmh','wind.gust_kmh','windGust','current.gust_kmh']) ?? (isFiniteNumber(f.wind_gusts_10m) ? Number(f.wind_gusts_10m) : null),
      pressure: num(c, ['pressure','pressure_hpa','surfacePressure','current.pressure_hpa']) ?? (isFiniteNumber(f.surface_pressure) ? Number(f.surface_pressure) : null),
      cloud: num(c, ['cloudCover','cloud_cover','clouds','current.cloud_cover']) ?? (isFiniteNumber(f.cloud_cover) ? Number(f.cloud_cover) : null),
      condition: String(pick(c, ['condition','summary','weather','description','current.condition'], '') || ''),
      source: raw ? String(pick(c, ['source','engine','provider'], 'Wheaterflow Fusion')) : 'Open-Meteo fallback'
    };
  }

  function normalizeBrain(raw) {
    if (!raw || typeof raw !== 'object') return null;
    return {
      version: String(pick(raw, ['version','brain_version'], 'Brain')),
      mode: String(pick(raw, ['mode'], 'shadow')),
      state: String(pick(raw, ['decision.state','state'], 'unknown')),
      headline: String(pick(raw, ['decision.headline','headline'], '') || ''),
      stormScore: num(raw, ['decision.storm_score','storm_score','storm.score']),
      radarHorizon: num(raw, ['decision.radar_horizon_minutes','radar_horizon_minutes','radar.horizon_minutes']),
      sourcesHealthy: num(raw, ['sources.healthy','sources_healthy']),
      sourcesTotal: num(raw, ['sources.total','sources_total'])
    };
  }

  function normalizeStorm(raw) {
    if (!raw || typeof raw !== 'object') return null;
    return {
      score: num(raw, ['score','storm.score','decision.score']),
      level: String(pick(raw, ['level','storm.level'], '') || ''),
      headline: String(pick(raw, ['headline','storm.headline'], '') || ''),
      confidence: num(raw, ['confidence','storm.confidence'])
    };
  }

  function warningList(raw) {
    if (!raw) return [];
    const candidates = Array.isArray(raw) ? raw : pick(raw, ['warnings','items','alerts','data'], []);
    if (!Array.isArray(candidates)) return [];
    return candidates.map(w => ({
      title: String(pick(w, ['title','headline','event','type','name'], 'Weerwaarschuwing')),
      description: String(pick(w, ['description','text','message','summary'], '') || ''),
      color: String(pick(w, ['color','level','code','severity'], '') || '').toLowerCase()
    })).filter(w => w.title || w.description);
  }

  async function loadContext(silent = false) {
    if (!silent) setStatus('Wheaterflow Radio haalt de nieuwste data op…');

    let open = null;
    try { open = await openMeteoFallback(); } catch (_) {}

    const jobs = await Promise.allSettled([
      getJSON(withRainLocation()),
      getJSON(withLocation(ENDPOINTS.current)),
      getJSON(withLocation(ENDPOINTS.brain), 3500),
      getJSON(withLocation(ENDPOINTS.storm), 3500),
      getJSON(ENDPOINTS.warnings, 4500)
    ]);

    state.rain = jobs[0].status === 'fulfilled' ? jobs[0].value : open ? makeFallbackRain(open) : null;
    state.current = normalizeCurrent(jobs[1].status === 'fulfilled' ? jobs[1].value : null, open);
    state.brain = jobs[2].status === 'fulfilled' ? normalizeBrain(jobs[2].value) : null;
    state.storm = jobs[3].status === 'fulfilled' ? normalizeStorm(jobs[3].value) : null;
    state.warnings = warningList(jobs[4].status === 'fulfilled' ? jobs[4].value : null);

    render();
    if (!silent) setStatus('Wheaterflow Radio is klaar.', 'ok');
    return state;
  }

  function formatTime(value) {
    const d = value ? new Date(value) : new Date();
    return d.toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' });
  }

  function symbolFor(data) {
    if (data?.thunderPossible) return 'ϟ';
    if (data?.status === 'raining') return '☂';
    if (data?.status === 'rain_soon') return '◒';
    if (data?.status === 'dry') return '☀︎';
    return '☁︎';
  }

  function renderBars(slots = []) {
    const root = $('rainBars');
    root.innerHTML = '';
    const shown = slots.slice(0, 8);
    if (!shown.length) for (let i = 0; i < 8; i++) shown.push({ precipitation: 0, wet: false });
    const max = Math.max(0.35, ...shown.map(s => Number(s.precipitation) || 0));
    shown.forEach(slot => {
      const el = document.createElement('div');
      el.className = `bar${slot.wet ? ' wet' : ''}`;
      const amount = Number(slot.precipitation) || 0;
      el.style.height = `${Math.max(7, Math.min(54, 7 + (amount / max) * 47))}px`;
      root.appendChild(el);
    });
  }

  function strongestWarning() {
    if (!state.warnings?.length) return null;
    const rank = w => /red|rood|extreme/.test(w.color) ? 4 : /orange|oranje|severe/.test(w.color) ? 3 : /yellow|geel|moderate/.test(w.color) ? 2 : 1;
    return [...state.warnings].sort((a, b) => rank(b) - rank(a))[0];
  }

  function render() {
    const rain = state.rain;
    const current = state.current;
    $('locationName').textContent = rain?.location?.name || state.location.name;
    $('weatherSymbol').textContent = symbolFor(rain);
    $('weatherTitle').textContent = rain?.title || current?.condition || 'Actueel weer';
    $('weatherSummary').textContent = rain?.summary || 'Geen korte-termijn neerslaginformatie beschikbaar.';
    $('confidence').textContent = `Zekerheid ${Math.round((Number(rain?.confidence) || 0) * 100)}%`;
    $('updated').textContent = `Bijgewerkt ${formatTime(rain?.generatedAt)}`;
    renderBars(rain?.slots || []);

    $('temperature').textContent = current?.temperature != null ? `${Math.round(current.temperature * 10) / 10}°` : '—';
    $('apparent').textContent = current?.apparent != null ? `Voelt ${Math.round(current.apparent * 10) / 10}°` : 'Temperatuur';
    $('wind').textContent = current?.wind != null ? `${Math.round(current.wind)} km/u` : '—';
    $('gust').textContent = current?.gust != null ? `Ruk ${Math.round(current.gust)}` : 'Wind';

    const stormScore = state.brain?.stormScore ?? state.storm?.score;
    $('storm').textContent = stormScore != null ? `${Math.round(stormScore)}/100` : '—';
    $('stormSub').textContent = state.brain ? `${state.brain.version} · ${state.brain.state}` : state.storm?.level || 'Storm Engine';

    const brainDot = $('brainDot');
    brainDot.className = `sourceDot ${state.brain ? 'ok' : 'warn'}`;
    $('brainText').textContent = state.brain ? `${state.brain.version} verbonden` : 'Brain nog niet publiek bereikbaar';

    const warning = strongestWarning();
    const alertBox = $('alertBox');
    if (warning) {
      alertBox.className = `alert show ${/red|rood|orange|oranje|extreme|severe/.test(warning.color) ? 'red' : ''}`;
      $('alertTitle').textContent = warning.title;
      $('alertText').textContent = warning.description || 'Actieve officiële weerwaarschuwing.';
    } else {
      alertBox.className = 'alert';
      $('alertTitle').textContent = '';
      $('alertText').textContent = '';
    }

    $('radioSummary').textContent = state.radioOn ? 'Wheaterflow Live is actief. Weerdata wordt automatisch vernieuwd.' : 'Live weer, radar en waarschuwingen samengebracht in één zender.';
  }

  function buildBulletin() {
    const rain = state.rain;
    const c = state.current;
    const b = state.brain;
    const s = state.storm;
    const warning = strongestWarning();
    const name = rain?.location?.name || state.location.name;
    const parts = [`Dit is Wheaterflow Radio. De actuele weerupdate voor ${name}.`];

    if (c?.temperature != null) {
      let line = `Het is ${Math.round(c.temperature * 10) / 10} graden`;
      if (c.apparent != null && Math.abs(c.apparent - c.temperature) >= 1) line += `, en het voelt aan als ${Math.round(c.apparent * 10) / 10} graden`;
      parts.push(`${line}.`);
    }

    if (rain?.status === 'raining') parts.push(`Op dit moment wordt neerslag gedetecteerd. ${rain.intensityLabel || 'Regen'}.`);
    else if (rain?.status === 'rain_soon') parts.push(`Regen wordt verwacht binnen ongeveer ${rain.startsInMinutes ?? 'enkele'} minuten. ${rain.intensityLabel || ''}.`);
    else if (rain?.status === 'dry') parts.push('Volgens de huidige korte-termijn verwachting blijft het voorlopig droog.');

    if (c?.wind != null) {
      let line = `De wind bedraagt ongeveer ${Math.round(c.wind)} kilometer per uur`;
      if (c.gust != null && c.gust > c.wind + 8) line += `, met rukwinden tot ongeveer ${Math.round(c.gust)} kilometer per uur`;
      parts.push(`${line}.`);
    }

    const stormScore = b?.stormScore ?? s?.score;
    if (stormScore != null && stormScore >= 35) {
      const headline = b?.headline || s?.headline || 'Verhoogde onweersactiviteit mogelijk';
      parts.push(`Wheaterflow Storm Engine geeft een score van ${Math.round(stormScore)} op 100. ${headline}.`);
    }

    if (warning) parts.push(`Belangrijk. Er is een officiële weerwaarschuwing actief: ${warning.title}. ${warning.description || ''}`);
    if (rain?.thunderPossible) parts.push('Onweer is mogelijk.');
    if (rain?.heavyShower) parts.push('Er kan een stevige bui voorkomen.');
    if (b?.headline && stormScore < 35) parts.push(`Wheaterflow Brain meldt: ${b.headline}.`);

    const confidence = Math.round((Number(rain?.confidence) || 0) * 100);
    if (confidence > 0) parts.push(`De zekerheid van de korte termijn neerslagverwachting is ${confidence} procent.`);
    parts.push('Je luistert naar Wheaterflow Radio.');
    return parts.join(' ').replace(/\s+/g, ' ').trim();
  }

  async function jingle() {
    try {
      state.audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
      if (state.audioContext.state === 'suspended') await state.audioContext.resume();
      const now = state.audioContext.currentTime;
      [392, 523.25, 659.25, 783.99].forEach((freq, i) => {
        const osc = state.audioContext.createOscillator();
        const gain = state.audioContext.createGain();
        osc.type = i === 3 ? 'triangle' : 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, now + i * 0.11);
        gain.gain.exponentialRampToValueAtTime(0.08, now + i * 0.11 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.11 + 0.18);
        osc.connect(gain).connect(state.audioContext.destination);
        osc.start(now + i * 0.11);
        osc.stop(now + i * 0.11 + 0.20);
      });
      await new Promise(resolve => setTimeout(resolve, 650));
    } catch (_) {}
  }

  function preferredVoice() {
    const voices = speechSynthesis.getVoices();
    return voices.find(v => /^nl-BE$/i.test(v.lang)) || voices.find(v => /^nl/i.test(v.lang)) || null;
  }

  async function speak() {
    if (!('speechSynthesis' in window)) return setStatus('Deze browser ondersteunt geen spraakuitvoer.', 'error');
    speechSynthesis.cancel();
    await jingle();
    const utterance = new SpeechSynthesisUtterance(buildBulletin());
    utterance.lang = 'nl-BE';
    utterance.rate = 0.93;
    utterance.pitch = 1.0;
    utterance.volume = state.volume;
    const voice = preferredVoice();
    if (voice) utterance.voice = voice;
    utterance.onstart = () => {
      state.speaking = true;
      card.classList.add('playing');
      $('radioLabel').textContent = 'NU OP WHEATERFLOW RADIO';
      $('radioTitle').textContent = 'Live weerbulletin';
      $('playerStatus').textContent = 'Nu live · weerbulletin';
    };
    utterance.onend = () => {
      state.speaking = false;
      card.classList.remove('playing');
      if (state.radioOn) {
        $('radioLabel').textContent = 'RADIO STAAT AAN';
        $('radioTitle').textContent = 'Wheaterflow Live';
        $('playerStatus').textContent = 'Live · wacht op volgende update';
      }
    };
    utterance.onerror = () => {
      state.speaking = false;
      card.classList.remove('playing');
      setStatus('Spraak kon niet worden gestart. Tik nogmaals op Start.', 'error');
    };
    speechSynthesis.speak(utterance);
  }

  async function bulletin() {
    try {
      await loadContext(true);
      await speak();
      setStatus('Radio actief · automatische update om de 15 minuten.', 'ok');
    } catch (_) {
      setStatus('Radio kon de nieuwste gegevens niet ophalen.', 'error');
    }
  }

  function updateScheduleUI() {
    const el = $('nextUpdate');
    const bar = $('scheduleProgress');
    if (!state.radioOn || !state.nextBulletinAt) {
      el.textContent = 'Na starten';
      bar.style.width = '0%';
      return;
    }
    const total = 15 * 60 * 1000;
    const left = Math.max(0, state.nextBulletinAt - Date.now());
    const mins = Math.floor(left / 60000);
    const secs = Math.floor((left % 60000) / 1000);
    el.textContent = `${mins}:${String(secs).padStart(2, '0')}`;
    bar.style.width = `${Math.min(100, Math.max(0, (1 - left / total) * 100))}%`;
  }

  function startSchedule() {
    clearInterval(state.timer);
    clearInterval(state.scheduleTicker);
    state.nextBulletinAt = Date.now() + 15 * 60 * 1000;
    updateScheduleUI();
    state.scheduleTicker = setInterval(updateScheduleUI, 1000);
    state.timer = setInterval(async () => {
      if (state.radioOn && document.visibilityState === 'visible') await bulletin();
      state.nextBulletinAt = Date.now() + 15 * 60 * 1000;
      updateScheduleUI();
    }, 15 * 60 * 1000);
  }

  async function startRadio() {
    state.radioOn = true;
    playButton.textContent = '■';
    playButton.setAttribute('aria-label', 'Stop Wheaterflow Radio');
    playButton.classList.add('on');
    $('playerStatus').textContent = 'Start live uitzending…';
    $('radioLabel').textContent = 'RADIO START…';
    await bulletin();
    startSchedule();
  }

  function stopRadio() {
    state.radioOn = false;
    clearInterval(state.timer);
    clearInterval(state.scheduleTicker);
    state.timer = null;
    state.scheduleTicker = null;
    state.nextBulletinAt = null;
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    card.classList.remove('playing');
    playButton.textContent = '▶';
    playButton.setAttribute('aria-label', 'Start Wheaterflow Radio');
    playButton.classList.remove('on');
    $('radioLabel').textContent = 'KLAAR OM TE STARTEN';
    $('radioTitle').textContent = 'Wheaterflow Radio';
    $('radioSummary').textContent = 'Live weer, radar en waarschuwingen samengebracht in één zender.';
    $('playerStatus').textContent = 'Klaar om te starten';
    updateScheduleUI();
    setStatus('Radio is uit.');
  }

  playButton.addEventListener('click', () => state.radioOn ? stopRadio() : startRadio());

  $('volume').addEventListener('input', event => {
    state.volume = Math.max(0, Math.min(1, Number(event.target.value) || 0));
  });

  $('locationButton').addEventListener('click', () => {
    if (!navigator.geolocation) return setStatus('Locatie wordt niet ondersteund.', 'error');
    setStatus('Huidige locatie bepalen…');
    navigator.geolocation.getCurrentPosition(async pos => {
      state.location = { name: 'Mijn locatie', lat: pos.coords.latitude, lon: pos.coords.longitude };
      $('locationName').textContent = 'Mijn locatie';
      await loadContext();
      if (state.radioOn) await speak();
    }, err => setStatus(`Locatie niet beschikbaar: ${err.message}`, 'error'), { enableHighAccuracy: true, timeout: 10000, maximumAge: 120000 });
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && state.radioOn) loadContext(true).catch(() => {});
  });

  if ('speechSynthesis' in window) speechSynthesis.onvoiceschanged = () => preferredVoice();
  loadContext();
})();