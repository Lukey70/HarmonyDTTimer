import {fresh,transition,stats,duration,daypart,dateKey,validState,TARGET} from './timer.js';
const $=id=>document.getElementById(id);
const KEY='harmony-dt-timer-v1';
let state=fresh(), previous=null, storageOK=true, corrupt=false;
try {const raw=localStorage.getItem(KEY);if(raw){const saved=JSON.parse(raw);if(!validState(saved))throw new Error('Invalid saved data');state=saved;}}
catch {corrupt=true;storageOK=false;}
let toastTimeout;
function toast(message){$('toast').textContent=message;$('toast').classList.add('show');clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>$('toast').classList.remove('show'),3500);}
function persist(){try{if(corrupt)throw new Error('Saved data needs recovery');localStorage.setItem(KEY,JSON.stringify(state));storageOK=true;}catch{storageOK=false;}$('save-status').textContent=storageOK?'● Saved on this device':corrupt?'Saved data could not be loaded — export before closing':'Not saved — export before closing';}
function car(c,stage,now){
  if(!c)return `<div class="empty-station"><b>＋</b><span>${stage==='window'?'Window ready':'Order ready'}</span></div>`;
  const elapsed=now-(stage==='window'?c.windowAt:c.arrivedAt);
  const level=stage==='window'?(elapsed>TARGET?'overdue':elapsed>=45000?'warning':''):'';
  return `<div class="car-wrap ${level}"><svg aria-label="Car ${c.id}"><use href="#car"/></svg><span class="car-id">#${c.id}</span>${stage!=='queue'?`<span class="timer-bubble" aria-label="${stage==='window'?'Window':'Time since arrival'} timer">${duration(elapsed)}</span>`:''}</div>`;
}
function render(){
  const now=Date.now(), summary=stats(state,now);
  $('clock').textContent=new Date(now).toLocaleTimeString('en-AU',{hour:'2-digit',minute:'2-digit'});
  $('daypart').textContent=daypart(now);
  $('window-car').innerHTML=car(state.window,'window',now);
  $('order-car').innerHTML=car(state.order,'order',now);
  const capacity=Math.max(1,Math.floor(($('queue-cars').clientWidth+15)/(window.innerWidth<=760?61:106)));
  const visible=state.queue.slice(0,Math.max(0,capacity-(state.queue.length>capacity?1:0)));
  $('queue-cars').innerHTML=state.queue.length?visible.map(c=>car(c,'queue',now)).join('')+(state.queue.length>visible.length?`<span class="queue-more">+${state.queue.length-visible.length} waiting</span>`:''):'<span class="queue-empty">WAITING LANE</span>';
  const count=state.queue.length+Number(!!state.window)+Number(!!state.order);
  $('active-count').textContent=`${count} ${count===1?'car':'cars'} in lane`;
  $('count').textContent=summary.count;
  $('average').textContent=summary.average===null?'—':duration(summary.average);
  $('average-status').textContent=summary.average===null?'Waiting for the first car':summary.average<=TARGET?'Within the 1:00 target':'Above the 1:00 target';
  $('average').style.color=summary.average>TARGET?'#b34e37':'';
  $('on-target').textContent=summary.onTarget===null?'—':summary.onTarget+'%';
  $('performance-fill').style.width=(summary.onTarget??0)+'%';
  document.querySelector('[data-action="arrive"]').disabled=!!state.order;
  document.querySelector('[data-action="ordered"]').disabled=!state.order;
  document.querySelector('[data-action="window"]').disabled=!!state.window||!state.queue.length;
  document.querySelector('[data-action="leave"]').disabled=!state.window;
  $('undo').disabled=!previous;
  $('export').disabled=!state.completed.some(r=>r.date===dateKey(now));
  if(!$('history').hidden)renderHistory();
}
function renderHistory(){
  const rows=state.completed.filter(r=>r.date===dateKey(Date.now())).slice().reverse();
  $('history-rows').innerHTML=rows.length?rows.map(r=>`<tr><td>#${r.id}</td><td>${new Date(r.leftAt).toLocaleTimeString('en-AU')}</td><td>${r.daypart}</td><td>${duration(r.windowMs)}</td><td>${duration(r.totalMs)}</td><td class="${r.windowMs<=TARGET?'result-good':'result-late'}">${r.windowMs<=TARGET?'On target':'Over target'}</td></tr>`).join(''):'<tr><td colspan="6">No cars completed today. Start with “Car arrives”.</td></tr>';
}
const messages={arrive:'Car added to Order',ordered:'Order complete · Car joined the queue',window:'Car at Window · Timer started',leave:'Car completed · Result recorded'};
function act(action){try{const next=transition(state,action);previous=state;state=next;persist();render();toast(messages[action]+(!storageOK?' · Not saved':''));}catch(e){toast(e.message);}}
document.querySelectorAll('[data-action]').forEach(b=>b.addEventListener('click',()=>act(b.dataset.action)));
$('undo').onclick=()=>{if(!previous)return;state=previous;previous=null;persist();render();toast('Last action undone');};
$('history-toggle').onclick=()=>{$('history').hidden=!$('history').hidden;$('history-toggle').setAttribute('aria-expanded',String(!$('history').hidden));$('history-toggle').textContent=$('history').hidden?'View activity':'Hide activity';renderHistory();};
$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{toast('Full screen is unavailable in this browser.');}};
$('export').onclick=()=>{
  const rows=state.completed.filter(r=>r.date===dateKey(Date.now()));
  const csv=[['Car','Arrival','Window arrival','Departure','Daypart','Window seconds','Total seconds','On target'],...rows.map(r=>[r.id,new Date(r.arrivedAt).toISOString(),new Date(r.windowAt).toISOString(),new Date(r.leftAt).toISOString(),r.daypart,(r.windowMs/1000).toFixed(1),(r.totalMs/1000).toFixed(1),r.windowMs<=TARGET?'Yes':'No'])].map(row=>row.join(',')).join('\r\n');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));const a=document.createElement('a');a.href=url;a.download=`Harmony-${dateKey(Date.now())}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Today’s results exported');
};
document.addEventListener('keydown',e=>{if(e.repeat||e.ctrlKey||e.metaKey||e.altKey||/INPUT|TEXTAREA|SELECT|BUTTON/.test(e.target.tagName)||e.target.isContentEditable)return;const action={a:'arrive',o:'ordered',w:'window',l:'leave'}[e.key.toLowerCase()];if(action){e.preventDefault();act(action);}});
window.addEventListener('resize',render);
window.addEventListener('storage',e=>{if(e.key===KEY){try{const incoming=JSON.parse(e.newValue);if(validState(incoming)){state=incoming;previous=null;render();toast('Lane updated from another tab');}}catch{toast('Could not load changes from another tab');}}});
render();
$('save-status').textContent=storageOK?'● Saved on this device':corrupt?'Saved data could not be loaded — export before closing':'Not saved — export before closing';
setInterval(render,250);
