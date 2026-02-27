/* ═══════════════════════════════════════════════
   CHORE CUTIES — app.js  🌸
   Kawaii Chore Tracker with Daily/Weekly/Monthly
   ═══════════════════════════════════════════════ */
'use strict';

// ── DEFAULTS ─────────────────────────────────────────────────────────────────
const DEFAULT_STATE = {
  chores: [
    { id:'1', name:'Make Your Bed',       emoji:'🛏️', points:10, schedule:'daily',   notes:'Before school!', order:0 },
    { id:'2', name:'Brush Your Teeth',    emoji:'🪥', points:5,  schedule:'daily',   notes:'',               order:1 },
    { id:'3', name:'Pick Up Toys',        emoji:'🧸', points:10, schedule:'daily',   notes:'',               order:2 },
    { id:'4', name:'Read for 20 Minutes', emoji:'📚', points:15, schedule:'daily',   notes:'',               order:3 },
    { id:'5', name:'Take Out Trash',      emoji:'🗑️', points:20, schedule:'weekly',  notes:'Every Monday',   order:4 },
    { id:'6', name:'Clean Your Room',     emoji:'✨', points:25, schedule:'weekly',  notes:'',               order:5 },
  ],
  completions: {},   // { 'YYYY-MM-DD': { choreId: pointsEarned } }
  totalPoints: 0,
  goal: { name:'Movie Night 🍿', pointsRequired:100 },
  streak: { lastDate:null, count:0 },
  settings: {
    kidName: 'Superstar',
    redeemBehavior: 'subtract',
    messages: [
      'Nice job! 🌟','You crushed it! 💪','Amazing work! 🎉',
      'Way to go! 🚀',"You're a superstar! ⭐",'Fantastic! 🥳',
      'Keep it up! 🔥','Awesome! 🎊','Super kawaii effort! 🌸',
      'You did it!! 💕','So proud of you! ✨',
    ]
  }
};

// ── STATE ─────────────────────────────────────────────────────────────────────
let state = {};
let pendingImport = null;
let currentView = 'daily';
let currentTab  = 'today';
const STORAGE_KEY = 'chore-cuties-v1';

// ── PERSISTENCE ───────────────────────────────────────────────────────────────
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      state = JSON.parse(raw);
      state.settings         = state.settings         || { ...DEFAULT_STATE.settings };
      state.settings.messages= state.settings.messages|| [...DEFAULT_STATE.settings.messages];
      state.settings.redeemBehavior = state.settings.redeemBehavior || 'subtract';
      state.settings.kidName = state.settings.kidName ?? 'Superstar';
      state.streak           = state.streak           || { lastDate:null, count:0 };
    } else {
      state = JSON.parse(JSON.stringify(DEFAULT_STATE));
    }
  } catch { state = JSON.parse(JSON.stringify(DEFAULT_STATE)); }
}
function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

// ── DATE HELPERS ──────────────────────────────────────────────────────────────
function today() { return new Date().toISOString().slice(0,10); }

function mondayOfWeek(dateStr) {
  const d   = new Date(dateStr + 'T00:00:00');
  const day = d.getDay();
  d.setDate(d.getDate() + (day===0 ? -6 : 1 - day));
  return d.toISOString().slice(0,10);
}

function getDaysInMonth(year, month) { return new Date(year, month+1, 0).getDate(); }

function getWeekDates() {
  const mon = new Date(mondayOfWeek(today()) + 'T00:00:00');
  return Array.from({length:7}, (_,i) => {
    const d = new Date(mon);
    d.setDate(d.getDate() + i);
    return d.toISOString().slice(0,10);
  });
}

// ── CHORE COMPLETION STATUS ───────────────────────────────────────────────────
function isChoreCompleted(chore) {
  const t = today();
  if (chore.schedule === 'daily') {
    return !!(state.completions[t]?.[chore.id]);
  }
  if (chore.schedule === 'weekly') {
    const mon = mondayOfWeek(t);
    return Object.entries(state.completions).some(([d,m]) => mondayOfWeek(d)===mon && m[chore.id]);
  }
  // one-time
  return Object.values(state.completions).some(m => m[chore.id]);
}

// ── POINTS ────────────────────────────────────────────────────────────────────
function getTodayPoints() {
  const map = state.completions[today()] || {};
  return Object.entries(map).reduce((s,[id]) => {
    const c = state.chores.find(c=>c.id===id);
    return s + (c ? c.points : 0);
  }, 0);
}

function getMonthPoints(year, month) {
  const prefix = `${year}-${String(month+1).padStart(2,'0')}`;
  return Object.entries(state.completions)
    .filter(([d])=>d.startsWith(prefix))
    .reduce((s,[,m])=>s+Object.keys(m).reduce((ps,id)=>{
      const c=state.chores.find(c=>c.id===id);
      return ps+(c?c.points:0);
    },0),0);
}

function getGoalPct() {
  if (!state.goal?.pointsRequired) return 0;
  return Math.min(100, Math.round((state.totalPoints/state.goal.pointsRequired)*100));
}

// ── STREAK ────────────────────────────────────────────────────────────────────
function updateStreak() {
  const t = today();
  if (!state.completions[t] || !Object.keys(state.completions[t]).length) return;
  if (state.streak.lastDate === t) return;
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate()-1);
  const yStr = yesterday.toISOString().slice(0,10);
  state.streak.count = state.streak.lastDate===yStr ? state.streak.count+1 : 1;
  state.streak.lastDate = t;
}

// ── PRUNE ─────────────────────────────────────────────────────────────────────
function pruneOldCompletions() {
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate()-120);
  const cutStr = cutoff.toISOString().slice(0,10);
  for (const d of Object.keys(state.completions)) { if (d<cutStr) delete state.completions[d]; }
}

// ══════════════════════════════════════════════════════════════════════════════
//  RENDER
// ══════════════════════════════════════════════════════════════════════════════

function renderAll() {
  renderPoints();
  renderGoalBar();
  renderCurrentView();
  renderGoalsTab();
  renderSettings();
  document.getElementById('streak-count').textContent = state.streak.count||0;
}

// ── POINTS & GOAL BAR ─────────────────────────────────────────────────────────
function renderPoints() {
  document.getElementById('pts-today').textContent = getTodayPoints();
  document.getElementById('pts-total').textContent  = state.totalPoints;
}

function renderGoalBar() {
  const pct = getGoalPct();
  ['progress-fill','progress-fill-2'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.style.width = pct+'%'; el.classList.toggle('full', pct>=100); }
  });
  ['progress-label','progress-label-2'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = pct+'%';
  });
  const name = state.goal?.name || 'No goal yet~ (◕‿◕)';
  document.getElementById('goal-text').textContent = name;
  document.getElementById('goal-fraction').textContent =
    state.goal?.pointsRequired ? `${state.totalPoints}/${state.goal.pointsRequired} ⭐` : '';
}

// ── VIEW ROUTER ───────────────────────────────────────────────────────────────
function renderCurrentView() {
  if (currentView === 'daily')   renderDailyView();
  if (currentView === 'weekly')  renderWeeklyView();
  if (currentView === 'monthly') renderMonthlyView();
}

// ── DAILY VIEW ────────────────────────────────────────────────────────────────
function renderDailyView() {
  const sorted = [...state.chores].sort((a,b)=>a.order-b.order);
  const list   = document.getElementById('chore-list-daily');
  const empty  = document.getElementById('empty-daily');
  list.innerHTML = '';
  if (!sorted.length) { empty.classList.remove('hidden'); return; }
  empty.classList.add('hidden');
  sorted.forEach(c => list.appendChild(buildChoreItem(c, true)));

  const done = sorted.filter(c=>isChoreCompleted(c)).length;
  document.getElementById('daily-count').textContent = sorted.length ? `${done}/${sorted.length} done ♡` : '';
}

// ── WEEKLY VIEW ───────────────────────────────────────────────────────────────
function renderWeeklyView() {
  // Week strip
  const strip = document.getElementById('week-strip');
  strip.innerHTML = '';
  const days   = getWeekDates();
  const todayS = today();
  const LABELS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  days.forEach((dateStr, i) => {
    const dayMap  = state.completions[dateStr] || {};
    const hasDone = Object.keys(dayMap).length > 0;
    const isToday = dateStr === todayS;
    const d = new Date(dateStr + 'T00:00:00');
    const cell = document.createElement('div');
    cell.className = 'day-cell' + (isToday?' is-today':'') + (hasDone?' has-done':'');
    const countPts = Object.keys(dayMap).reduce((s,id)=>{
      const c=state.chores.find(c=>c.id===id); return s+(c?c.points:0);},0);
    cell.innerHTML = `
      <span>${LABELS[i]}</span>
      <span class="day-cell-num">${d.getDate()}</span>
      <span class="day-dot">${hasDone ? '✅' : (dateStr<=todayS ? '○' : '')}</span>
      ${hasDone ? `<span style="font-size:.62rem;color:var(--text-soft);font-weight:700">+${countPts}⭐</span>` : ''}
    `;
    strip.appendChild(cell);
  });

  // Weekly chores (weekly + daily for context)
  const weeklyChores = [...state.chores]
    .filter(c => c.schedule === 'weekly' || c.schedule === 'onetime')
    .sort((a,b)=>a.order-b.order);
  const allChores    = [...state.chores].sort((a,b)=>a.order-b.order);

  const list  = document.getElementById('chore-list-weekly');
  const empty = document.getElementById('empty-weekly');
  list.innerHTML = '';

  if (!allChores.length) { empty.classList.remove('hidden'); return; }
  empty.classList.add('hidden');
  allChores.forEach(c => list.appendChild(buildChoreItem(c, true)));

  const done = allChores.filter(c=>isChoreCompleted(c)).length;
  document.getElementById('weekly-count').textContent = `${done}/${allChores.length} done ♡`;
}

// ── MONTHLY VIEW ─────────────────────────────────────────────────────────────
function renderMonthlyView() {
  const now   = new Date();
  const year  = now.getFullYear();
  const month = now.getMonth();
  const todayS= today();
  const daysInMonth  = getDaysInMonth(year, month);
  const firstWeekday = new Date(year, month, 1).getDay(); // 0=Sun
  const startOffset  = firstWeekday === 0 ? 6 : firstWeekday - 1; // Mon-based

  const grid = document.getElementById('month-grid');
  grid.innerHTML = '';

  // Day labels
  ['M','T','W','T','F','S','S'].forEach(lbl => {
    const el = document.createElement('div');
    el.className = 'month-day-label';
    el.textContent = lbl;
    grid.appendChild(el);
  });

  // Empty cells before month starts
  for (let i=0; i<startOffset; i++) {
    const el = document.createElement('div');
    el.className = 'month-day other-month';
    grid.appendChild(el);
  }

  // Month days
  let doneCount = 0;
  let totalDays = 0;
  let streakDays = 0;
  let bestStreak = 0; let cur = 0;

  for (let day=1; day<=daysInMonth; day++) {
    const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const map     = state.completions[dateStr] || {};
    const count   = Object.keys(map).length;
    const hasDone = count > 0;
    const isToday = dateStr === todayS;
    const isPast  = dateStr <= todayS;

    if (isPast) { totalDays++; if (hasDone) { doneCount++; cur++; bestStreak=Math.max(bestStreak,cur); } else cur=0; }

    const el = document.createElement('div');
    el.className = 'month-day'
      + (hasDone ? ' has-done' : '')
      + (isToday ? ' is-today' : '');
    el.textContent = day;
    if (hasDone) el.dataset.count = count;
    grid.appendChild(el);
  }

  // Month stats
  const monthPts = getMonthPoints(year, month);
  const statsEl  = document.getElementById('month-stats');
  statsEl.innerHTML = `
    <div class="stat-bubble">
      <div class="stat-num">${doneCount}</div>
      <div class="stat-label">Days Active</div>
    </div>
    <div class="stat-bubble">
      <div class="stat-num">${monthPts}</div>
      <div class="stat-label">Stars Earned ⭐</div>
    </div>
    <div class="stat-bubble">
      <div class="stat-num">${bestStreak}</div>
      <div class="stat-label">Best Streak 🔥</div>
    </div>
  `;
}

// ── BUILD CHORE ITEM ──────────────────────────────────────────────────────────
function buildChoreItem(chore, showDone) {
  const done = isChoreCompleted(chore);
  const li   = document.createElement('li');
  li.className = 'chore-item' + (done ? ' done' : '');
  li.dataset.id = chore.id;
  li.dataset.schedule = chore.schedule;
  li.innerHTML = `
    <span class="chore-emoji-lbl" aria-hidden="true">${chore.emoji||'⭐'}</span>
    <div class="chore-info">
      <div class="chore-name">${esc(chore.name)}</div>
      <div class="chore-meta">${chore.notes ? esc(chore.notes)+' · ':''} ${schedLbl(chore.schedule)}</div>
    </div>
    <span class="chore-pts-badge">+${chore.points}⭐</span>
    <button class="btn-done ${done?'is-done':''}" data-id="${chore.id}">
      ${done ? '✅ Undo' : '✔ Done!'}
    </button>`;
  return li;
}

function schedLbl(s) { return s==='daily'?'🌞 Daily':s==='weekly'?'📅 Weekly':'🌟 One-time'; }

// ── GOALS TAB ─────────────────────────────────────────────────────────────────
function renderGoalsTab() {
  const pct = getGoalPct();
  const f2  = document.getElementById('progress-fill-2');
  if (f2) { f2.style.width=pct+'%'; f2.classList.toggle('full',pct>=100); }
  const l2 = document.getElementById('progress-label-2');
  if (l2) l2.textContent = pct+'%';

  if (state.goal?.name) {
    document.getElementById('gdc-name').textContent = state.goal.name;
    document.getElementById('gdc-pts').textContent  = `${state.totalPoints} / ${state.goal.pointsRequired} stars ⭐`;
  } else {
    document.getElementById('gdc-name').textContent = 'No goal set yet!';
    document.getElementById('gdc-pts').textContent  = '';
  }

  const beh = state.settings.redeemBehavior||'subtract';
  document.getElementById('redeem-subtract').checked = beh==='subtract';
  document.getElementById('redeem-reset').checked    = beh==='reset';
}

// ── SETTINGS ─────────────────────────────────────────────────────────────────
function renderSettings() {
  document.getElementById('kid-name-input').value = state.settings.kidName||'';

  const ml = document.getElementById('chore-manage-list');
  ml.innerHTML = '';
  [...state.chores].sort((a,b)=>a.order-b.order).forEach((chore,idx,arr) => {
    const li = document.createElement('li');
    li.className = 'manage-item';
    li.innerHTML = `
      <span class="m-emoji">${chore.emoji||'⭐'}</span>
      <span class="m-name">${esc(chore.name)}</span>
      <span class="m-pts">${chore.points}⭐ · ${schedLbl(chore.schedule).split(' ')[1]}</span>
      <div class="manage-btns">
        <button class="btn-m-up"   data-id="${chore.id}" ${idx===0?'disabled':''}>▲</button>
        <button class="btn-m-down" data-id="${chore.id}" ${idx===arr.length-1?'disabled':''}>▼</button>
        <button class="btn-m-edit" data-id="${chore.id}">✏️</button>
        <button class="btn-m-del"  data-id="${chore.id}">🗑️</button>
      </div>`;
    ml.appendChild(li);
  });

  const msgList = document.getElementById('messages-list');
  msgList.innerHTML = '';
  (state.settings.messages||[]).forEach((msg,idx) => {
    const row = document.createElement('div');
    row.className = 'msg-row';
    row.innerHTML = `
      <input type="text" value="${esc(msg)}" data-msg-idx="${idx}" class="msg-input" />
      <button class="btn-del-msg" data-msg-idx="${idx}">🗑️</button>`;
    msgList.appendChild(row);
  });
}

// ══════════════════════════════════════════════════════════════════════════════
//  ACTIONS
// ══════════════════════════════════════════════════════════════════════════════

function completeChore(id) {
  const chore = state.chores.find(c=>c.id===id);
  if (!chore || isChoreCompleted(chore)) return;
  const t = today();
  if (!state.completions[t]) state.completions[t]={};
  state.completions[t][id] = true;
  state.totalPoints += chore.points;
  updateStreak();
  saveState();

  // Flash effect
  const li = document.querySelector(`.chore-item[data-id="${id}"]`);
  if (li) { const fl=document.createElement('div'); fl.className='done-flash'; li.appendChild(fl); setTimeout(()=>fl.remove(),600); }

  // Message
  const msgs = state.settings.messages;
  showFlash(msgs[Math.floor(Math.random()*msgs.length)]);
  renderAll();
  popEl('pts-total'); popEl('pts-today');

  if (state.goal?.pointsRequired && state.totalPoints >= state.goal.pointsRequired) {
    setTimeout(showCelebration, 700);
  }
}

function undoChore(id) {
  const chore = state.chores.find(c=>c.id===id);
  if (!chore) return;
  const t = today();
  let removed = false;
  if (state.completions[t]?.[id]) { delete state.completions[t][id]; removed=true; }
  else for (const map of Object.values(state.completions)) { if (map[id]) { delete map[id]; removed=true; break; } }
  if (removed) state.totalPoints = Math.max(0, state.totalPoints-chore.points);
  saveState(); renderAll();
}

function showFlash(msg) {
  const el = document.getElementById('completion-msg');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(window._msgTimer);
  window._msgTimer = setTimeout(()=>el.classList.add('hidden'), 2600);
}

function popEl(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('pop');
  void el.offsetWidth;
  el.classList.add('pop');
}

// ── CELEBRATION / REDEEM ──────────────────────────────────────────────────────
function showCelebration() {
  document.getElementById('cel-goal-name').textContent = state.goal.name;
  document.getElementById('cel-pts').textContent = `You earned ${state.totalPoints} stars! ⭐`;
  document.getElementById('celebration').classList.remove('hidden');
  startConfetti();
}
function hideCelebration() {
  document.getElementById('celebration').classList.add('hidden');
  stopConfetti();
}
function redeemGoal() {
  hideCelebration();
  if ((state.settings.redeemBehavior||'subtract')==='subtract')
    state.totalPoints = Math.max(0, state.totalPoints - state.goal.pointsRequired);
  else
    state.totalPoints = 0;
  saveState(); renderAll(); showCoupon();
}

// ── CONFETTI ──────────────────────────────────────────────────────────────────
let confettiRunning=false, confettiAF=null;
const CONFETTI_COLORS=['#FFB7D5','#C9B8FF','#B8F0DC','#B8E4FF','#FFF1A8','#FFD4A8','#FF8FB5'];

function startConfetti() {
  const canvas=document.getElementById('confetti-canvas');
  const ctx=canvas.getContext('2d');
  canvas.width=window.innerWidth; canvas.height=window.innerHeight;
  confettiRunning=true;
  const particles=Array.from({length:130},()=>({
    x:Math.random()*canvas.width, y:Math.random()*canvas.height-canvas.height,
    w:7+Math.random()*9, h:4+Math.random()*6,
    color:CONFETTI_COLORS[Math.floor(Math.random()*CONFETTI_COLORS.length)],
    angle:Math.random()*Math.PI*2, spin:(Math.random()-.5)*.18,
    vy:1.5+Math.random()*3.5, vx:(Math.random()-.5)*2.5,
  }));
  function draw() {
    if (!confettiRunning){ctx.clearRect(0,0,canvas.width,canvas.height);return;}
    ctx.clearRect(0,0,canvas.width,canvas.height);
    particles.forEach(p=>{
      ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.angle);
      ctx.fillStyle=p.color; ctx.fillRect(-p.w/2,-p.h/2,p.w,p.h);
      ctx.restore();
      p.y+=p.vy; p.x+=p.vx; p.angle+=p.spin;
      if(p.y>canvas.height+20){p.y=-20; p.x=Math.random()*canvas.width;}
    });
    confettiAF=requestAnimationFrame(draw);
  }
  draw();
}
function stopConfetti() {
  confettiRunning=false;
  if(confettiAF)cancelAnimationFrame(confettiAF);
}

// ── COUPON ────────────────────────────────────────────────────────────────────
function showCoupon() {
  document.getElementById('coupon-kid-name').textContent = `🌸 ${state.settings.kidName||'Superstar'} 🌸`;
  document.getElementById('coupon-reward-name').textContent = state.goal?.name||'Your Reward';
  document.getElementById('coupon-date').textContent =
    new Date().toLocaleDateString(undefined,{year:'numeric',month:'long',day:'numeric'});
  document.getElementById('coupon-view').classList.remove('hidden');
}

// ── CHORE MODAL ───────────────────────────────────────────────────────────────
function openChoreModal(id=null) {
  document.getElementById('chore-modal-title').textContent = id ? 'Edit a Chore~' : 'Add a Chore~';
  document.getElementById('chore-id').value = id||'';
  if (id) {
    const c = state.chores.find(c=>c.id===id);
    if (c) {
      document.getElementById('chore-emoji').value    = c.emoji||'';
      document.getElementById('chore-name').value     = c.name;
      document.getElementById('chore-points').value   = c.points;
      document.getElementById('chore-schedule').value = c.schedule;
      document.getElementById('chore-notes').value    = c.notes||'';
    }
  } else {
    document.getElementById('chore-emoji').value    = '';
    document.getElementById('chore-name').value     = '';
    document.getElementById('chore-points').value   = 10;
    document.getElementById('chore-schedule').value = 'daily';
    document.getElementById('chore-notes').value    = '';
  }
  document.getElementById('chore-modal').classList.remove('hidden');
  setTimeout(()=>document.getElementById('chore-name').focus(),150);
}

function saveChore() {
  const id   = document.getElementById('chore-id').value;
  const name = document.getElementById('chore-name').value.trim();
  if (!name) { alert('Please enter a chore name~ (◕‿◕)'); return; }
  const data = {
    name,
    emoji:    document.getElementById('chore-emoji').value.trim()||'⭐',
    points:   Math.max(1, parseInt(document.getElementById('chore-points').value)||10),
    schedule: document.getElementById('chore-schedule').value,
    notes:    document.getElementById('chore-notes').value.trim(),
  };
  if (id) {
    const idx=state.chores.findIndex(c=>c.id===id);
    if (idx!==-1) Object.assign(state.chores[idx], data);
  } else {
    const maxOrd=state.chores.reduce((m,c)=>Math.max(m,c.order),-1);
    state.chores.push({id:Date.now().toString(), order:maxOrd+1, ...data});
  }
  saveState();
  document.getElementById('chore-modal').classList.add('hidden');
  renderAll();
}

function deleteChore(id) {
  if (!confirm('Delete this chore? (◡︵◡)')) return;
  state.chores = state.chores.filter(c=>c.id!==id);
  for (const map of Object.values(state.completions)) delete map[id];
  saveState(); renderAll();
}

function moveChore(id, dir) {
  const sorted=[...state.chores].sort((a,b)=>a.order-b.order);
  const idx=sorted.findIndex(c=>c.id===id);
  const nIdx=idx+dir;
  if (nIdx<0||nIdx>=sorted.length) return;
  [sorted[idx].order, sorted[nIdx].order]=[sorted[nIdx].order, sorted[idx].order];
  sorted.forEach((c,i)=>{ c.order=i; });
  saveState(); renderAll();
}

// ── GOAL MODAL ────────────────────────────────────────────────────────────────
function openGoalModal() {
  document.getElementById('goal-name').value   = state.goal?.name||'';
  document.getElementById('goal-points').value = state.goal?.pointsRequired||100;
  document.getElementById('goal-modal').classList.remove('hidden');
  setTimeout(()=>document.getElementById('goal-name').focus(),150);
}
function saveGoal() {
  const name = document.getElementById('goal-name').value.trim();
  if (!name) { alert('Please enter a goal name~ ♡'); return; }
  state.goal = { name, pointsRequired: Math.max(1, parseInt(document.getElementById('goal-points').value)||100) };
  saveState();
  document.getElementById('goal-modal').classList.add('hidden');
  renderAll();
}

// ── EXPORT / IMPORT ───────────────────────────────────────────────────────────
function exportData() {
  const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});
  const a=Object.assign(document.createElement('a'),{
    href:URL.createObjectURL(blob), download:`chore-cuties-${today()}.json`
  });
  a.click(); URL.revokeObjectURL(a.href);
}
function handleImportFile(e) {
  const file=e.target.files[0]; if(!file)return;
  const r=new FileReader();
  r.onload=ev=>{
    try {
      const data=JSON.parse(ev.target.result);
      if (!Array.isArray(data.chores)) throw new Error();
      pendingImport=data;
      document.getElementById('import-modal').classList.remove('hidden');
    } catch { alert('Invalid backup file~ (◡︵◡)'); }
  };
  r.readAsText(file); e.target.value='';
}
function confirmImport() {
  if (!pendingImport) return;
  state=pendingImport;
  state.settings=state.settings||{...DEFAULT_STATE.settings};
  state.settings.messages=state.settings.messages||[...DEFAULT_STATE.settings.messages];
  pendingImport=null;
  document.getElementById('import-modal').classList.add('hidden');
  saveState(); renderAll();
}

// ── FLUSH MESSAGES ────────────────────────────────────────────────────────────
function flushMessages() {
  state.settings.messages=Array.from(document.querySelectorAll('.msg-input'))
    .map(i=>i.value.trim()).filter(Boolean);
  saveState();
}

// ── UTILITY ───────────────────────────────────────────────────────────────────
function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// ══════════════════════════════════════════════════════════════════════════════
//  EVENTS
// ══════════════════════════════════════════════════════════════════════════════
function initEvents() {

  // ── Bottom nav
  document.querySelectorAll('.knav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.knav-btn').forEach(b=>b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(t=>t.classList.add('hidden'));
      btn.classList.add('active');
      document.getElementById(`tab-${btn.dataset.tab}`).classList.remove('hidden');
      currentTab = btn.dataset.tab;
      if (currentTab==='goals')    renderGoalsTab();
      if (currentTab==='settings') renderSettings();
    });
  });

  // ── View switcher
  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.view-btn').forEach(b=>b.classList.remove('active'));
      document.querySelectorAll('.chore-view').forEach(v=>v.classList.add('hidden'));
      btn.classList.add('active');
      currentView = btn.dataset.view;
      document.getElementById(`view-${currentView}`).classList.remove('hidden');
      renderCurrentView();
    });
  });

  // ── Chore done/undo (delegate to all lists)
  ['chore-list-daily','chore-list-weekly'].forEach(listId => {
    document.getElementById(listId).addEventListener('click', e => {
      const btn = e.target.closest('.btn-done');
      if (!btn) return;
      btn.classList.contains('is-done') ? undoChore(btn.dataset.id) : completeChore(btn.dataset.id);
    });
  });

  // ── Celebration
  document.getElementById('btn-redeem').addEventListener('click', redeemGoal);
  document.getElementById('btn-cel-close').addEventListener('click', hideCelebration);

  // ── Coupon
  document.getElementById('btn-close-coupon').addEventListener('click',()=>
    document.getElementById('coupon-view').classList.add('hidden'));

  // ── Goal
  document.getElementById('btn-edit-goal').addEventListener('click', openGoalModal);
  document.getElementById('btn-save-goal').addEventListener('click', saveGoal);
  document.getElementById('btn-cancel-goal').addEventListener('click',()=>
    document.getElementById('goal-modal').classList.add('hidden'));

  // ── Redeem behavior
  document.querySelectorAll('input[name="redeem"]').forEach(r =>
    r.addEventListener('change',()=>{ state.settings.redeemBehavior=r.value; saveState(); }));

  // ── Reset points
  document.getElementById('btn-reset-points').addEventListener('click',()=>{
    if (!confirm('Reset ALL stars to zero? (◡︵◡)')) return;
    state.totalPoints=0; saveState(); renderAll();
  });

  // ── Chore modal
  document.getElementById('btn-add-chore').addEventListener('click',()=>openChoreModal());
  document.getElementById('btn-save-chore').addEventListener('click', saveChore);
  document.getElementById('btn-cancel-chore').addEventListener('click',()=>
    document.getElementById('chore-modal').classList.add('hidden'));

  // ── Manage list
  document.getElementById('chore-manage-list').addEventListener('click', e => {
    const up   = e.target.closest('.btn-m-up');
    const down = e.target.closest('.btn-m-down');
    const edit = e.target.closest('.btn-m-edit');
    const del  = e.target.closest('.btn-m-del');
    if (up)   moveChore(up.dataset.id, -1);
    if (down) moveChore(down.dataset.id, 1);
    if (edit) openChoreModal(edit.dataset.id);
    if (del)  deleteChore(del.dataset.id);
  });

  // ── Messages
  document.getElementById('btn-add-msg').addEventListener('click',()=>{
    state.settings.messages.push('You did it!! 🌸');
    saveState(); renderSettings();
  });
  document.getElementById('messages-list').addEventListener('click', e => {
    const btn=e.target.closest('.btn-del-msg');
    if (btn) { flushMessages(); state.settings.messages.splice(parseInt(btn.dataset.msgIdx),1); saveState(); renderSettings(); }
  });
  document.getElementById('messages-list').addEventListener('change', e => {
    if (e.target.classList.contains('msg-input')) flushMessages();
  });

  // ── Kid name
  document.getElementById('kid-name-input').addEventListener('change',()=>{
    state.settings.kidName=document.getElementById('kid-name-input').value.trim()||'Superstar';
    saveState();
  });

  // ── Export / Import
  document.getElementById('btn-export').addEventListener('click', exportData);
  document.getElementById('import-file-input').addEventListener('change', handleImportFile);
  document.getElementById('btn-confirm-import').addEventListener('click', confirmImport);
  document.getElementById('btn-cancel-import').addEventListener('click',()=>{
    pendingImport=null;
    document.getElementById('import-modal').classList.add('hidden');
  });

  // ── Overlay backdrop close
  ['chore-modal','goal-modal','import-modal'].forEach(id => {
    document.getElementById(id).addEventListener('click', e => {
      if (e.target.id===id) document.getElementById(id).classList.add('hidden');
    });
  });

  // ── Re-render on app resume
  document.addEventListener('visibilitychange',()=>{
    if (!document.hidden) { pruneOldCompletions(); renderAll(); }
  });
}

// ── INIT ──────────────────────────────────────────────────────────────────────
function init() {
  loadState();
  pruneOldCompletions();
  initEvents();
  renderAll();
}

document.addEventListener('DOMContentLoaded', init);

if ('serviceWorker' in navigator) {
  window.addEventListener('load',()=>navigator.serviceWorker.register('./service-worker.js').catch(()=>{}));
}
