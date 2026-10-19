import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const context={window:{}};
vm.runInNewContext(readFileSync(new URL('../weather-charts.js',import.meta.url),'utf8'),context);
const charts=context.window.WFWeatherCharts;
test('rain categories follow the existing app thresholds, preserving unknown values',()=>{
  for(const value of [null,undefined,'',false,-1,NaN]) assert.equal(charts.rainLevel(value),null);
  for(const [amount,level] of [[0,0],[.09,0],[.1,1],[.99,1],[1,2],[2.99,2],[3,3],[20,3]]) assert.equal(charts.rainLevel(amount),level);
});
test('detail values retain raw hourly millimeters separately from the category and probability',()=>{
  const [row]=charts.rows({time:['2026-10-19T23:00'],precipitation:[.25],precipitation_probability:[18]},0);
  assert.equal(row.rain,.25);assert.equal(row.level,1);assert.equal(row.pop,18);
  const details=charts.details('rain',row).join(' ');
  assert.match(details,/0,25 mm\/u/);assert.match(details,/18%/);assert.match(details,/Lichte regen/);
});
test('zero UV is real data; absent UV and precipitation are not converted to zero',()=>{
  const rows=charts.rows({time:['2026-10-19T23:00','2026-10-20T00:00'],uv_index:[0,null],precipitation:[0,null]},0);
  assert.equal(rows[0].uv,0);assert.equal(rows[0].level,0);assert.equal(rows[1].uv,null);assert.equal(rows[1].rain,null);assert.equal(rows[1].level,null);
  assert.match(charts.details('rain',rows[1]).join(' '),/onbekend/);
});
test('each chart receives the same bounded time window, including after midnight',()=>{
  const hourly={time:['2026-10-19T23:00','2026-10-20T00:00','2026-10-20T01:00'],temperature_2m:[14,13,12]};
  const rows=charts.rows(hourly,1);
  assert.equal(rows.length,2);assert.equal(rows[0].time,'2026-10-20T00:00');assert.equal(rows[0].temp,13);
  assert.equal(charts.rows(hourly,3).length,0);assert.equal(charts.rows({time:Array(30).fill('2026-10-19T15:00')},0).length,24);
});
