/* Wheaterflow — aparte bodemkaart herstel
   Laden NA script.js.
   Laat de bestaande bodem-API/cache intact en vervangt alleen de kaartweergave.
*/
(() => {
  'use strict';

  const css = `
  .soil-card-full{
    display:block !important;
    width:100%;
    overflow:hidden;
  }
  .soil-card-head{
    display:flex;
    align-items:flex-start;
    justify-content:space-between;
    gap:14px;
    margin-bottom:16px;
  }
  .soil-card-subtitle{
    margin-top:4px;
    font-size:13px;
    color:var(--dim);
    line-height:1.35;
  }
  .soil-status-chip{
    flex:0 0 auto;
    display:inline-flex;
    align-items:center;
    justify-content:center;
    min-height:28px;
    padding:6px 10px;
    border-radius:999px;
    font-size:11px;
    font-weight:700;
    letter-spacing:.01em;
    border:1px solid rgba(255,255,255,.14);
    background:rgba(255,255,255,.08);
  }
  .soil-status-chip.live{background:rgba(74,222,128,.12)}
  .soil-status-chip.stale{background:rgba(245,165,36,.14)}
  .soil-status-chip.unavailable{
    background:rgba(255,255,255,.07);
    color:var(--dim);
  }
  .soil-primary-grid{
    display:grid;
    grid-template-columns:repeat(2,minmax(0,1fr));
    gap:12px;
  }
  .soil-primary-metric{
    min-width:0;
    padding:16px;
    border-radius:16px;
    border:1px solid rgba(255,255,255,.12);
    background:rgba(255,255,255,.07);
    backdrop-filter:blur(16px);
    -webkit-backdrop-filter:blur(16px);
  }
  .soil-primary-metric strong{
    display:block;
    margin-top:7px;
    font-size:clamp(26px,7vw,38px);
    line-height:1;
    font-family:'Space Grotesk',sans-serif;
    letter-spacing:-.04em;
  }
  .soil-primary-metric small{
    display:block;
    margin-top:8px;
    color:var(--dim);
    font-size:12px;
  }
  .soil-metric-label{
    display:block;
    font-size:12px;
    color:var(--dim);
    font-weight:600;
  }
  .soil-depth-grid{
    display:grid;
    grid-template-columns:repeat(2,minmax(0,1fr));
    gap:10px;
    margin-top:12px;
  }
  .soil-depth-grid > div{
    padding:12px 14px;
    border-radius:14px;
    background:rgba(255,255,255,.055);
    border:1px solid rgba(255,255,255,.09);
  }
  .soil-depth-grid span{
    display:block;
    color:var(--dim);
    font-size:11px;
    margin-bottom:4px;
  }
  .soil-depth-grid b{
    display:block;
    font-size:13px;
    line-height:1.35;
  }
  .soil-moisture-track{
    height:7px;
    overflow:hidden;
    border-radius:999px;
    margin-top:14px;
    background:rgba(255,255,255,.08);
  }
  .soil-moisture-track span{
    display:block;
    height:100%;
    border-radius:inherit;
    background:linear-gradient(90deg,#c7a069,#7fc274,#67bde6);
    transition:width .35s ease;
  }
  .soil-card-footer{
    display:flex;
    flex-wrap:wrap;
    justify-content:space-between;
    gap:8px 14px;
    margin-top:13px;
    color:var(--dim);
    font-size:11px;
  }
  @media (max-width:520px){
    .soil-primary-metric{padding:14px}
    .soil-card-footer{flex-direction:column}
  }`;

  if (!document.getElementById('wf-soil-card-fix-style')) {
    const style = document.createElement('style');
    style.id = 'wf-soil-card-fix-style';
    style.textContent = css;
    document.head.appendChild(style);
  }

  function soilMoistureLabel(percent){
    const p = validNumber(percent);
    if(p == null) return 'Onbekend';
    if(p < 20) return 'Zeer droog';
    if(p < 35) return 'Droog';
    if(p < 60) return 'Normaal';
    if(p < 80) return 'Vochtig';
    return 'Zeer vochtig';
  }

  function soilTemperatureLabel(temp){
    const t = validNumber(temp);
    if(t == null) return 'Onbekend';
    if(t < 0) return 'Bevroren';
    if(t < 5) return 'Zeer koud';
    if(t < 10) return 'Koud';
    if(t < 18) return 'Koel';
    if(t < 25) return 'Gematigd';
    return 'Warm';
  }

  window.soilSection = function soilSection(){
    const soil = state.soil || soilFromForecast();
    const temperature = validNumber(soil?.temperature);
    const moisture = soilMoisturePercent(soil?.moisture);

    const updatedRaw = soil?.updatedAt ? new Date(soil.updatedAt) : null;
    const updated = updatedRaw && Number.isFinite(updatedRaw.getTime())
      ? updatedRaw.toLocaleTimeString(wfLocale(), {hour:'2-digit', minute:'2-digit'})
      : '—';

    const source = validText(soil?.source) || 'Wheaterflow';
    const stale = Boolean(soil?.stale);

    if(temperature == null && moisture == null){
      return `
        <div class="card soil-card soil-card-full">
          <div class="soil-card-head">
            <div>
              <div class="card-title">${icon('thermo',true,18)} Bodem</div>
              <div class="soil-card-subtitle">Bodemtemperatuur en bodemvocht</div>
            </div>
            <span class="soil-status-chip unavailable">Geen data</span>
          </div>
          ${wheaterflowStatus(
            'empty',
            'Bodemtemperatuur en bodemvocht zijn tijdelijk niet beschikbaar'
          )}
          <div class="soil-depth-grid">
            <div><span>Temperatuurlaag</span><b>Oppervlak · 0 cm</b></div>
            <div><span>Vochtlaag</span><b>Bovenste bodemlaag · 0–1 cm</b></div>
          </div>
        </div>
      `;
    }

    const tempLabel = soilTemperatureLabel(temperature);
    const moistureLabel = soilMoistureLabel(moisture);

    return `
      <div class="card soil-card soil-card-full">
        <div class="soil-card-head">
          <div>
            <div class="card-title">${icon('thermo',true,18)} Bodem</div>
            <div class="soil-card-subtitle">Actuele toestand van de bovenste bodemlaag</div>
          </div>
          <span class="soil-status-chip ${stale ? 'stale' : 'live'}">
            ${stale ? 'Oudere meting' : 'Actueel'}
          </span>
        </div>

        <div class="soil-primary-grid">
          <div class="soil-primary-metric">
            <span class="soil-metric-label">Bodemtemperatuur</span>
            <strong>${temperature == null ? '—' : `${temperature.toFixed(1).replace('.', ',')} °C`}</strong>
            <small>${temperature == null ? 'Geen meting' : tempLabel}</small>
          </div>

          <div class="soil-primary-metric">
            <span class="soil-metric-label">Bodemvocht</span>
            <strong>${moisture == null ? '—' : `${Math.round(moisture)}%`}</strong>
            <small>${moisture == null ? 'Geen meting' : moistureLabel}</small>
          </div>
        </div>

        <div class="soil-depth-grid">
          <div>
            <span>Temperatuurlaag</span>
            <b>Oppervlak · 0 cm</b>
          </div>
          <div>
            <span>Vochtlaag</span>
            <b>Bovenste bodemlaag · 0–1 cm</b>
          </div>
        </div>

        <div class="soil-moisture-track" aria-label="Bodemvocht ${moisture == null ? 'onbekend' : `${Math.round(moisture)} procent`}">
          <span style="width:${moisture == null ? 0 : Math.round(moisture)}%"></span>
        </div>

        <div class="soil-card-footer">
          <span>Bron: ${esc(source)}</span>
          <span>Bijgewerkt: ${esc(updated)}</span>
        </div>
      </div>
    `;
  };

  // Wanneer Meer weerdata al open stond tijdens een hot reload:
  try {
    const content = document.getElementById('moreWeatherContent');
    if(content && state?.moreWeatherTab === 'skycoast'){
      content.innerHTML = renderMoreWeatherSections('skycoast');
    }
  } catch (_) {}

  console.info('[Wheaterflow] aparte bodemkaart hersteld');
})();