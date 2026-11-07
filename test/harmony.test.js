import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DriveThruSimulator,computeScoreboard,TARGETS,POSITION_META} from '../dist/simulation.mjs';
test('one lane, six spaces and a 60-second Window target',()=>{
  assert.deepEqual(Object.keys(POSITION_META),['entry','order','gap3','gap2','gap1','window']);
  assert.deepEqual(TARGETS,{order:30,window:60,total:90});
  const sim=new DriveThruSimulator();assert.equal(sim.addCar(2).ok,false);assert.equal(sim.activeCars.length,0);
  assert.equal(sim.addCar().ok,true);assert.equal(sim.addCar().ok,false);sim.tick();assert.equal(sim.carAt('order').id,1);
});
test('Brighton automatic movement with manual Order and Window releases',()=>{
  const sim=new DriveThruSimulator();sim.addCar();sim.tick();sim.tick(3);assert.equal(sim.carAt('order').id,1);
  sim.releaseStation('order');sim.tick();assert.equal(sim.carAt('gap3').id,1);
  sim.tick();assert.equal(sim.carAt('gap2').id,1);sim.tick();assert.equal(sim.carAt('gap1').id,1);
  sim.tick();assert.equal(sim.carAt('window').id,1);sim.tick(59);
  assert.equal(sim.completedCars.length,0);sim.releaseStation('window');sim.tick();
  const car=sim.completedCars[0];assert.equal(car.timings.window,60);assert.equal(car.timings.order,4);assert.equal(car.timings.total,63);
  assert.equal(computeScoreboard(sim.completedCars).window.pct,100);
});
test('full queue is blocked without collisions; departures stay FIFO',()=>{
  const sim=new DriveThruSimulator();
  for(let i=0;i<6;i++){assert.equal(sim.addCar().ok,true);sim.tick();sim.releaseStation('order');sim.tick(5);}
  assert.equal(sim.activeCars.length,6);assert.equal(sim.addCar().ok,false);
  assert.equal(new Set(sim.activeCars.map(c=>c.position)).size,6);
  for(let id=1;id<=6;id++){assert.equal(sim.carAt('window').id,id);sim.releaseStation('window');sim.tick(6);sim.releaseStation('order');sim.tick(5);}
  assert.deepEqual(sim.completedCars.map(c=>c.id),[6,5,4,3,2,1]);assert.equal(sim.activeCars.length,0);
});
test('only completed cars affect averages; exact target succeeds and 61 seconds fails',()=>{
  const rows=[{timings:{order:10,window:60,total:63}},{timings:{order:20,window:61,total:65}}];
  assert.deepEqual(computeScoreboard(rows).window,{avg:60.5,pct:50});
  assert.deepEqual(computeScoreboard([]).window,{avg:0,pct:0});
  const sim=new DriveThruSimulator();sim.addCar();sim.tick(100);assert.deepEqual(computeScoreboard(sim.completedCars).total,{avg:0,pct:0});
});
test('restored state, warning events, idempotent release and reset',()=>{
  let sim=new DriveThruSimulator();sim.addCar();sim.tick();sim.releaseStation('order');sim.tick(4);
  sim=new DriveThruSimulator(JSON.parse(JSON.stringify(sim.serialize())));
  assert.equal(sim.carAt('window').id,1);const events=sim.tick(125);
  assert.equal(events.filter(e=>e.type==='yellow-threshold').length,1);assert.equal(events.filter(e=>e.type==='red-threshold').length,1);
  assert.equal(sim.releaseStation('cash').ok,false);sim.releaseStation('window');assert.equal(sim.releaseStation('window').alreadyRequested,true);
  sim.tick();assert.equal(sim.completedCars.length,1);sim.reset();assert.equal(sim.now,0);assert.equal(sim.completedCars.length,0);
});
test('browser embeds the tested simulator and Brighton assets, with removed station UI absent',()=>{
  const app=readFileSync(new URL('../dist/app.js',import.meta.url),'utf8');
  const model=readFileSync(new URL('../dist/simulation.mjs',import.meta.url),'utf8').replaceAll('export ','');
  assert.ok(app.includes(model));assert.ok(app.includes('const CAR_IMAGES ='));assert.ok(app.includes('const SOUND_DATA ='));
  const html=readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');
  assert.ok(!/Cash|Present|Order-2|btnAddLane2|btnReleaseOrder2|goalCash/.test(html));
  const match=app.match(/function avgClassForKey\(key, seconds\) \{[\s\S]*?^\}/m);
  const colour=new Function('TARGETS',match[0]+';return avgClassForKey;')(TARGETS);
  for(const [seconds,result] of [[59,'avg-good'],[60,'avg-mid'],[90,'avg-mid'],[91,'avg-bad']])assert.equal(colour('window',seconds),result);
});
