/* Wheaterflow glass forecast charts. Raw hourly data remain separate from the qualitative rain scale. */
(() => {
  'use strict';
  const num = value => value === null || value === undefined || value === '' || typeof value === 'boolean' ? null : Number.isFinite(Number(value)) ? Number(value) : null;
  const amount = value => { const n = num(value); return n === null || n < 0 ? null : n; };
  const rainLevel = value => { const n = amount(value); return n === null ? null : n < 0.1 ? 0 : n < 1 ? 1 : n < 3 ? 2 : 3; };
  const rainNames = ['Droog','Lichte regen','Matige regen','Zware regen'];
  const esc = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const fmt = (value, digits = 0) => num(value) === null ? '—' : Number(value).toLocaleString('nl-BE', {minimumFractionDigits:digits,maximumFractionDigits:digits});
  const metric = (value, suffix, digits = 0) => num(value) === null ? '—' : `${fmt(value,digits)}${suffix}`;
  const fullTime = time => {
    const match = String(time).match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    return match ? `${match[3]}/${match[2]} · ${match[4]}:${match[5]}` : String(time);
  };
  const hourLabel = time => { const match = String(time).match(/T(\d{2}):(\d{2})/); return match ? `${match[1]}u` : String(time); };
  function rows(hourly, start = 0, daily = {}) {
    return (hourly?.time || []).slice(start, start+24).map((time,n) => {
      const i = start+n;
      const get = key => num(hourly[key]?.[i]);
      const rain = amount(hourly.precipitation?.[i]);
      const pop = get('precipitation_probability');
      const day = daily.time?.indexOf(String(time).slice(0,10)) ?? -1;
      const isDay = get('is_day');
      const night = isDay !== null ? isDay === 0 : day >= 0 && daily.sunrise?.[day] && daily.sunset?.[day] ? time < daily.sunrise[day] || time >= daily.sunset[day] : false;
      return {time, temp:get('temperature_2m'), feels:get('apparent_temperature'), rain, level:rainLevel(rain), pop:pop !== null && pop >= 0 && pop <= 100 ? pop : null, uv:amount(hourly.uv_index?.[i]), wind:amount(hourly.wind_speed_10m?.[i]), gust:amount(hourly.wind_gusts_10m?.[i]), direction:get('wind_direction_10m'), night:Boolean(night)};
    });
  }
  const icons = {
    temp:'<path d="M10 14V5a2 2 0 0 1 4 0v9a4 4 0 1 1-4 0Z"/><path d="M12 9v9"/>',
    rain:'<path d="M6 15a4 4 0 0 1 0-8 6 6 0 0 1 11-1 4.5 4.5 0 0 1 1 9M8 17l-1 3m6-3-1 3m6-3-1 3"/>',
    uv:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
    wind:'<path d="M3 8h12a3 3 0 1 0-3-3M3 12h16a3 3 0 1 1-3 3M3 16h5a3 3 0 1 1-3 3"/>'
  };
  const titles = {temp:'Temperatuur',rain:'Neerslag',uv:'UV-index',wind:'Wind'};
  const legend = {temp:[['Temperatuur','cyan'],['Voelt als','yellow dashed']],rain:[['Kans','cyan'],['Intensiteit','blue bar']],uv:[['UV-index','yellow']],wind:[['Wind','cyan'],['Stoten','orange dashed']]};
  const directionName = value => value === null ? 'Richting onbekend' : ['Noord','NO','Oost','ZO','Zuid','ZW','West','NW'][Math.round(((value%360+360)%360)/45)%8];
  const uvName = n => n === null ? 'Onbekend' : n < 3 ? 'Laag' : n < 6 ? 'Matig' : n < 8 ? 'Hoog' : n < 11 ? 'Zeer hoog' : 'Extreem';
  function values(id,row) {
    if (id === 'temp') return [metric(row.temp,'°'),`Voelt als ${metric(row.feels,'°')}`];
    if (id === 'rain') return [row.level === null ? 'Onbekend' : rainNames[row.level], 'Neerslag per uur'];
    if (id === 'uv') return [fmt(row.uv,1),uvName(row.uv)];
    return [metric(row.wind,' km/u'),`Stoten ${metric(row.gust,' km/u')}`];
  }
  function details(id,row) {
    if (id === 'temp') return [`Temperatuur: ${metric(row.temp,' °C',1)}`,`Voelt als: ${metric(row.feels,' °C',1)}`];
    if (id === 'rain') return [row.level === null ? 'Intensiteit: onbekend' : rainNames[row.level],`Hoeveelheid: ${metric(row.rain,' mm/u',2)}`,`Neerslagkans: ${metric(row.pop,'%',0)}`];
    if (id === 'uv') return [`UV-index: ${fmt(row.uv,1)}`,uvName(row.uv)];
    return [`Wind: ${metric(row.wind,' km/u',1)}`,`Windstoten: ${metric(row.gust,' km/u',1)}`,directionName(row.direction)];
  }
  function markup(hourly,start,daily) {
    const data = rows(hourly,start,daily);
    if (!data.length) return '<div class="card">Geen uurgegevens beschikbaar.</div>';
    const probabilities = data.map(row=>row.pop).filter(n=>n!==null);
    const maxPop = probabilities.length ? Math.max(...probabilities) : null;
    return `<div class="wf-chart-toolbar"><div><b>Grafieken komende 24 uur</b><span>Tik, sleep of wijs aan om de exacte waarden te zien.</span></div><button type="button" id="wfChartReset" class="wf-chart-reset">Terug naar nu</button></div>
      <div class="chart-grid premium-charts wf-weather-charts">${Object.keys(titles).map(id=>{
        const [value,sub] = values(id,data[0]);
        const badge = id==='temp' ? 'Komende 24 uur' : id==='rain' ? `Max. kans ${metric(maxPop,'%')}` : id==='wind' ? directionName(data[0].direction) : 'UV-straling per uur';
        return `<section class="card mini-chart apple-chart-card wf-weather-card" data-chart="${id}" aria-label="${titles[id]}">
          <div class="wf-chart-heading"><h3><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[id]}</svg>${titles[id]}</h3><span class="wf-chart-badge">${esc(badge)}</span></div>
          <div class="wf-chart-metric"><strong data-chart-value>${esc(value)}</strong><span data-chart-sub>${esc(sub)}</span></div>
          <div class="wf-chart-meta"><span data-chart-time>Dit uur</span><div class="wf-chart-legend">${legend[id].map(([label,color])=>`<span><i class="${color}" aria-hidden="true"></i>${label}</span>`).join('')}</div></div>
          <div class="apple-chart-wrap"><canvas id="chart-${id}" tabindex="0" role="slider" aria-label="${titles[id]} per uur. Gebruik de pijltjestoetsen om hetzelfde uur op alle kaarten te kiezen." aria-valuemin="0" aria-valuemax="${data.length-1}" aria-valuenow="0"></canvas><div class="wf-chart-tooltip" hidden></div></div>
          <div class="wf-chart-accessible" data-chart-description></div>
        </section>`;
      }).join('')}</div><div class="wf-chart-accessible" id="wfChartAnnouncement" role="status" aria-live="polite"></div>`;
  }
  let charts = [];
  let cleanup = [];
  let data = [];
  let selected = null;
  function destroy() {
    cleanup.forEach(fn=>fn());cleanup=[];
    charts.forEach(chart=>chart.destroy());charts=[];selected=null;
  }
  function select(index,announce=false) {
    if (!data.length) return;
    const next = Math.max(0,Math.min(data.length-1,Math.round(index)));
    if (!Number.isFinite(next) || next === selected) return;
    selected = next;
    const row = data[selected];
    charts.forEach(chart=>{
      const id = chart.$wfId;
      const card = chart.canvas.closest('.wf-weather-card');
      const [value,sub] = values(id,row);
      card.querySelector('[data-chart-value]').textContent = value;
      card.querySelector('[data-chart-sub]').textContent = sub;
      if (id === 'wind') card.querySelector('.wf-chart-badge').textContent = directionName(row.direction);
      card.querySelector('[data-chart-time]').textContent = fullTime(row.time);
      const text = details(id,row);
      chart.canvas.setAttribute('aria-valuenow',String(selected));
      chart.canvas.setAttribute('aria-valuetext',`${fullTime(row.time)}. ${text.join('. ')}`);
      card.querySelector('[data-chart-description]').textContent = `${fullTime(row.time)}. ${text.join('. ')}`;
      const tooltip = card.querySelector('.wf-chart-tooltip');
      tooltip.replaceChildren(...[fullTime(row.time),...text].map((line,n)=>{const el=document.createElement(n===0?'b':'span');el.textContent=line;return el;}));
      tooltip.hidden=false;
      const x = chart.scales.x.getPixelForValue(selected);
      const width = tooltip.offsetWidth;
      tooltip.style.left = `${Math.max(4,Math.min(chart.width-width-4,x+12))}px`;
      chart.setActiveElements(chart.data.datasets.flatMap((dataset,datasetIndex)=>dataset.data[selected]===null?[]:[{datasetIndex,index:selected}]));
      chart.draw();
    });
    if (announce) {
      const status = document.getElementById('wfChartAnnouncement');
      if (status) status.textContent = `${fullTime(row.time)}. ${Object.keys(titles).map(id=>details(id,row).join('. ')).join('. ')}`;
    }
  }
  const markerPlugin = {
    id:'wfSharedHour',
    beforeDatasetsDraw(chart) {
      const {ctx,chartArea:a,scales:{x}} = chart;if(!a)return;
      ctx.save();ctx.beginPath();ctx.rect(a.left,a.top,a.width,a.height);ctx.clip();
      const half = data.length>1 ? Math.abs(x.getPixelForValue(1)-x.getPixelForValue(0))/2 : a.width/2;
      ctx.fillStyle='rgba(4,20,44,.13)';data.forEach((row,i)=>{if(row.night)ctx.fillRect(x.getPixelForValue(i)-half,a.top,half*2,a.height);});ctx.restore();
    },
    afterDatasetsDraw(chart) {
      if(selected===null)return;
      const {ctx,chartArea:a,scales:{x}}=chart;if(!a)return;
      const px=x.getPixelForValue(selected);ctx.save();ctx.beginPath();ctx.moveTo(px,a.top);ctx.lineTo(px,a.bottom);ctx.strokeStyle='rgba(242,253,255,.88)';ctx.lineWidth=1;ctx.setLineDash([4,4]);ctx.stroke();ctx.restore();
    }
  };
  function dataset(label,values,color,{fill=false,dashed=false,bar=false,axis='y'}={}) {
    return {type:bar?'bar':'line',label,data:values,yAxisID:axis,borderColor:color,backgroundColor:bar?'rgba(78,166,245,.72)':`${color}20`,borderWidth:bar?0:2.6,borderDash:dashed?[7,5]:[],pointRadius:0,pointHoverRadius:4,pointHoverBackgroundColor:color,pointHoverBorderColor:'#fff',pointHoverBorderWidth:1.5,tension:.35,spanGaps:false,fill,barPercentage:.75,categoryPercentage:.8,maxBarThickness:18,borderRadius:3};
  }
  function render(hourly,start,daily) {
    destroy();data=rows(hourly,start,daily);
    if(!document.querySelector('.wf-weather-card')) return;
    if(!window.Chart) {
      document.querySelectorAll('.wf-weather-card .apple-chart-wrap').forEach(wrap=>{wrap.innerHTML='<p class="wf-chart-unavailable">Grafieken kunnen niet worden geladen. Vernieuw de pagina om opnieuw te proberen.</p>';});return;
    }
    const configurations = {
      temp:[dataset('Temperatuur',data.map(r=>r.temp),'#42def3',{fill:true}),dataset('Voelt als',data.map(r=>r.feels),'#ffda58',{dashed:true})],
      rain:[dataset('Kans',data.map(r=>r.pop),'#42def3',{fill:true}),dataset('Intensiteit',data.map(r=>r.level),'#509fec',{bar:true,axis:'intensity'})],
      uv:[dataset('UV-index',data.map(r=>r.uv),'#ffd43b',{fill:true})],
      wind:[dataset('Wind',data.map(r=>r.wind),'#79e3fa',{fill:true}),dataset('Stoten',data.map(r=>r.gust),'#ffa34b',{dashed:true})]
    };
    Object.entries(configurations).forEach(([id,datasets])=>{
      const canvas=document.getElementById(`chart-${id}`);if(!canvas)return;
      const missing = datasets.every(ds=>ds.data.every(v=>v===null));
      const tooltip=canvas.parentElement.querySelector('.wf-chart-tooltip');
      if(missing){const notice=document.createElement('span');notice.className='wf-chart-no-data';notice.textContent='Geen gegevens beschikbaar';canvas.parentElement.append(notice);}
      const axes={
        x:{grid:{color:'rgba(235,247,255,.10)'},border:{color:'rgba(235,247,255,.24)'},ticks:{color:'#d6e7f5',maxTicksLimit:6,maxRotation:0,autoSkip:true,font:{size:11},callback:(_,i)=>i===0?'Nu':hourLabel(data[i]?.time)}},
        y:{beginAtZero:id!=='temp',min:id==='uv'?0:undefined,suggestedMax:id==='uv'?2:undefined,grid:{color:'rgba(235,247,255,.13)'},border:{color:'rgba(235,247,255,.24)'},ticks:{color:'#d6e7f5',maxTicksLimit:5,font:{size:11},callback:value=>id==='temp'?`${value}°`:value<0?'':value}}
      };
      if(id==='rain'){
        const pops=data.map(row=>row.pop).filter(value=>value!==null);
        const ceiling=Math.min(100,Math.max(20,Math.ceil(Math.max(0,...pops)/20)*20));
        axes.y.min=0;axes.y.max=ceiling;axes.y.ticks.stepSize=ceiling/4;axes.y.title={display:true,text:'Kans (%)',color:'#d6e7f5',align:'start',font:{size:10}};
        axes.intensity={position:'right',min:0,max:3,grid:{drawOnChartArea:false},border:{color:'rgba(235,247,255,.24)'},ticks:{stepSize:1,color:'#d6e7f5',font:{size:10},callback:v=>['Droog','Licht','Matig','Zwaar'][v]||''},title:{display:true,text:'Intensiteit',color:'#d6e7f5',font:{size:10}}};
      }
      const chart=new window.Chart(canvas,{data:{labels:data.map(row=>hourLabel(row.time)),datasets},plugins:[markerPlugin],options:{responsive:true,maintainAspectRatio:false,animation:false,events:[],layout:{padding:{top:5,bottom:3}},plugins:{legend:{display:false},tooltip:{enabled:false}},scales:axes}});
      chart.$wfId=id;charts.push(chart);
      canvas.setAttribute('aria-valuetext',`${fullTime(data[0].time)}. ${details(id,data[0]).join('. ')}`);
      const description=canvas.closest('.wf-weather-card').querySelector('[data-chart-description]');
      description.id=`wfChartDescription-${id}`;description.textContent=canvas.getAttribute('aria-valuetext');canvas.setAttribute('aria-describedby',description.id);
      let dragging=false;
      const at=event=>{const rect=canvas.getBoundingClientRect();const px=(event.clientX-rect.left)*chart.width/rect.width;select(chart.scales.x.getValueForPixel(px));};
      const down=event=>{if(event.button!==0)return;dragging=true;canvas.setPointerCapture?.(event.pointerId);at(event);};
      const move=event=>{if(event.pointerType==='mouse'||dragging)at(event);};
      const up=event=>{dragging=false;if(canvas.hasPointerCapture?.(event.pointerId))canvas.releasePointerCapture(event.pointerId);};
      const key=event=>{const current=selected??0;const target=({ArrowLeft:current-1,ArrowRight:current+1,Home:0,End:data.length-1})[event.key];if(target!==undefined){event.preventDefault();select(target,true);}if(event.key==='Escape'){event.preventDefault();reset();}};
      const events={pointerdown:down,pointermove:move,pointerup:up,pointercancel:up,lostpointercapture:()=>{dragging=false;},keydown:key};
      Object.entries(events).forEach(([name,fn])=>canvas.addEventListener(name,fn));
      cleanup.push(()=>Object.entries(events).forEach(([name,fn])=>canvas.removeEventListener(name,fn)));
    });
    const resetButton=document.getElementById('wfChartReset');
    resetButton?.addEventListener('click',reset);cleanup.push(()=>resetButton?.removeEventListener('click',reset));
  }
  function reset() {
    select(0);selected=null;
    charts.forEach(chart=>{chart.canvas.closest('.wf-weather-card').querySelector('.wf-chart-tooltip').hidden=true;chart.canvas.closest('.wf-weather-card').querySelector('[data-chart-time]').textContent='Dit uur';chart.setActiveElements([]);chart.draw();});
  }
  window.WFWeatherCharts={markup,render,destroy,select,reset,rows,rainLevel,details,getSelection:()=>selected};
})();
