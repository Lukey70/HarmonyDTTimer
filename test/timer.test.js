import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fresh,transition,stats,daypart,dateKey,duration,validState,TARGET} from '../dist/timer.js';
const start=new Date(2026,10,7,10,0,0).getTime();
test('single lane FIFO: independent Window timing, exact target and completed statistics',()=>{
  let s=transition(fresh(),'arrive',start);
  s=transition(s,'ordered',start+10000);
  s=transition(s,'arrive',start+11000);
  s=transition(s,'ordered',start+21000);
  s=transition(s,'window',start+30000);
  assert.equal(s.window.id,1);assert.equal(s.queue[0].id,2);
  assert.throws(()=>transition(s,'window',start+40000),/occupied/);
  s=transition(s,'leave',start+90000);
  assert.equal(s.completed[0].windowMs,TARGET);assert.equal(s.completed[0].totalMs,90000);
  assert.deepEqual(stats(s,start+90000),{count:1,average:60000,onTarget:100});
  s=transition(s,'window',start+91000);assert.equal(s.window.id,2);
  s=transition(s,'leave',start+152000);
  assert.deepEqual(stats(s,start+152000),{count:2,average:60500,onTarget:50});
  assert.ok(validState(JSON.parse(JSON.stringify(s))));
});
test('invalid actions are rejected without changing original state',()=>{
  const s=fresh();for(const action of ['ordered','window','leave','bad'])assert.throws(()=>transition(s,action,start));
  const occupied=transition(s,'arrive',start);assert.throws(()=>transition(occupied,'arrive',start));
  assert.deepEqual(s,fresh());assert.equal(occupied.nextId,2);
});
test('daypart and date rollover leave active cars intact and attribute completions to departure',()=>{
  const at=(h,m=0)=>new Date(2026,10,7,h,m).getTime();
  assert.equal(daypart(at(4,59)),'Overnight');assert.equal(daypart(at(5)),'Breakfast');
  assert.equal(daypart(at(11)),'Lunch');assert.equal(daypart(at(15)),'Dinner');
  let s=transition(fresh(),'arrive',at(10,59));s=transition(s,'ordered',at(10,59));s=transition(s,'window',at(10,59));s=transition(s,'leave',at(11));
  assert.equal(stats(s,at(10,59)).count,0);assert.equal(stats(s,at(11)).count,1);
  assert.equal(stats(s,new Date(2026,10,8,11).getTime()).count,0);assert.equal(dateKey(at(5)),'2026-11-07');
});
test('restored active car uses original timestamps; empty stats and time formatting',()=>{
  let s=transition(fresh(),'arrive',start);s=transition(s,'ordered',start+1000);s=transition(s,'window',start+2000);
  const restored=JSON.parse(JSON.stringify(s));s=transition(restored,'leave',start+122000);
  assert.equal(s.completed[0].windowMs,120000);assert.deepEqual(stats(fresh(),start),{count:0,average:null,onTarget:null});
  assert.equal(duration(61000),'1:01');assert.equal(duration(-1000),'0:00');assert.ok(!validState({version:1}));
});
