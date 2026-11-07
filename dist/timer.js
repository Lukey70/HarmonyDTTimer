export const TARGET = 60_000;
export function daypart(now) {
  const hour = new Date(now).getHours();
  return hour < 5 ? 'Overnight' : hour < 11 ? 'Breakfast' : hour < 15 ? 'Lunch' : 'Dinner';
}
export function dateKey(now) {
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
export function fresh() { return {version:1, nextId:1, order:null, queue:[], window:null, completed:[]}; }
export function transition(state, action, now = Date.now()) {
  const s = structuredClone(state);
  if (action === 'arrive') {
    if (s.order) throw new Error('Finish the current order before adding another car.');
    s.order = {id:s.nextId++, arrivedAt:now};
  } else if (action === 'ordered') {
    if (!s.order) throw new Error('There is no car at Order.');
    s.queue.push({...s.order, orderedAt:now}); s.order = null;
  } else if (action === 'window') {
    if (s.window) throw new Error('The Window is occupied.');
    if (!s.queue.length) throw new Error('Complete an order first.');
    s.window = {...s.queue.shift(), windowAt:now};
  } else if (action === 'leave') {
    if (!s.window) throw new Error('There is no car at the Window.');
    s.completed.push({...s.window, leftAt:now, windowMs:Math.max(0,now-s.window.windowAt), totalMs:Math.max(0,now-s.window.arrivedAt), daypart:daypart(now), date:dateKey(now)});
    s.window=null;
  } else throw new Error('Unknown action.');
  return s;
}
export function stats(state, now) {
  const rows = state.completed.filter(r=>r.date===dateKey(now) && r.daypart===daypart(now));
  return {count:rows.length, average:rows.length ? Math.round(rows.reduce((sum,r)=>sum+r.windowMs,0)/rows.length) : null,
    onTarget:rows.length ? Math.round(100*rows.filter(r=>r.windowMs<=TARGET).length/rows.length) : null};
}
export function duration(ms) {
  const seconds = Math.max(0,Math.floor(ms/1000));
  return `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
}
export function validState(s) {
  const car = c => c && Number.isInteger(c.id) && c.id>0 && Number.isFinite(c.arrivedAt);
  return s?.version===1 && Number.isInteger(s.nextId) && s.nextId>0 &&
    (s.order===null || car(s.order)) && Array.isArray(s.queue) && s.queue.every(c=>car(c)&&Number.isFinite(c.orderedAt)) &&
    (s.window===null || (car(s.window)&&Number.isFinite(s.window.windowAt))) && Array.isArray(s.completed) &&
    s.completed.every(c=>car(c)&&Number.isFinite(c.leftAt)&&Number.isFinite(c.windowMs)&&Number.isFinite(c.totalMs)&&typeof c.date==='string'&&typeof c.daypart==='string');
}
