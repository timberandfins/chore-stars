/* ═══════════════════════════════════════════════
   CHORE STARS — app.js
   Vanilla JS, localStorage-backed
   ═══════════════════════════════════════════════ */

'use strict';

// ── DEFAULT DATA ──────────────────────────────────────────────────────────────

const DEFAULT_STATE = {
  chores: [
    { id: '1', name: 'Make Your Bed',       emoji: '🛏️', points: 10, schedule: 'daily',   notes: 'Before school!', order: 0 },
    { id: '2', name: 'Brush Your Teeth',    emoji: '🪥', points: 5,  schedule: 'daily',   notes: '',               order: 1 },
    { id: '3', name: 'Pick Up Toys',        emoji: '🧸', points: 10, schedule: 'daily',   notes: '',               order: 2 },
    { id: '4', name: 'Read for 20 Minutes', emoji: '📚', points: 15, schedule: 'daily',   notes: '',               order: 3 },
    { id: '5', name: 'Take Out Trash',      emoji: '🗑️', points: 20, schedule: 'weekly',  notes: 'Every Monday',   order: 4 },
  ],
  completions: {},    // { 'YYYY-MM-DD': { choreId: true } }
  totalPoints: 0,
  goal: { name: 'Movie Night 🍿', pointsRequired: 100 },
  streak: { lastDate: null, count: 0 },
  settings: {
    pin: '1234',
    kidName: 'Superstar',
    redeemBehavior: 'subtract',
    messages: [
      'Nice job! 🌟',
      'You crushed it! 💪',
      'Amazing work! 🎉',
      'Way to go! 🚀',
      'You\'re a superstar! ⭐',
      'Fantastic! 🥳',
      'Keep it up! 🔥',
      'Awesome! 🎊',
    ]
  }
};

// ── STATE ─────────────────────────────────────────────────────────────────────

let state = {};
let parentMode = false;

// Pending import data
let pendingImport = null;

// ── PERSISTENCE ───────────────────────────────────────────────────────────────

const STORAGE_KEY = 'chore-stars-v1';

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      state = JSON.parse(raw);
      // Migrate missing fields
      if (!state.settings.messages) state.settings.messages = [...DEFAULT_STATE.settings.messages];
      if (!state.settings.redeemBehavior) state.settings.redeemBehavior = 'subtract';
      if (!state.streak) state.streak = { lastDate: null, count: 0 };
      if (state.settings.kidName === undefined) state.settings.kidName = 'Superstar';
    } else {
      state = JSON.parse(JSON.stringify(DEFAULT_STATE));
    }
  } catch (e) {
    state = JSON.parse(JSON.stringify(DEFAULT_STATE));
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// ── DATE UTILITIES ────────────────────────────────────────────────────────────

function today() {
  const d = new Date();
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

function mondayOfWeek(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay(); // 0=Sun
  const diff = (day === 0) ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

function getCompletionsForDate(dateStr) {
  return state.completions[dateStr] || {};
}

function isChoreCompleted(chore) {
  const t = today();
  if (chore.schedule === 'daily') {
    return !!(state.completions[t] && state.completions[t][chore.id]);
  }
  if (chore.schedule === 'weekly') {
    const mon = mondayOfWeek(t);
    // Find any completion this week
    for (const [date, completions] of Object.entries(state.completions)) {
      if (mondayOfWeek(date) === mon && completions[chore.id]) return true;
    }
    return false;
  }
  if (chore.schedule === 'onetime') {
    for (const completions of Object.values(state.completions)) {
      if (completions[chore.id]) return true;
    }
    return false;
  }
  return false;
}

// ── STREAK LOGIC ──────────────────────────────────────────────────────────────

function updateStreak() {
  const t = today();
  const todayCompletions = state.completions[t] || {};
  const completedToday = Object.keys(todayCompletions).length > 0;

  if (!completedToday) return;

  if (state.streak.lastDate === t) return; // already updated today

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yStr = yesterday.toISOString().slice(0, 10);

  if (state.streak.lastDate === yStr) {
    state.streak.count++;
  } else if (state.streak.lastDate !== t) {
    state.streak.count = 1;
  }
  state.streak.lastDate = t;
}

// ── POINTS ────────────────────────────────────────────────────────────────────

function getTodayPoints() {
  const t = today();
  const completions = state.completions[t] || {};
  let pts = 0;
  for (const [choreId, done] of Object.entries(completions)) {
    if (done) {
      const chore = state.chores.find(c => c.id === choreId);
      if (chore) pts += chore.points;
    }
  }
  return pts;
}

function getGoalProgress() {
  if (!state.goal || !state.goal.pointsRequired) return 0;
  return Math.min(100, Math.round((state.totalPoints / state.goal.pointsRequired) * 100));
}

// ── RENDER: TODAY TAB ─────────────────────────────────────────────────────────

function renderToday() {
  // Points
  const ptsTodayEl = document.getElementById('pts-today');
  const ptsTotalEl = document.getElementById('pts-total');
  ptsTodayEl.textContent = getTodayPoints();
  ptsTotalEl.textContent = state.totalPoints;

  // Goal progress
  const pct = getGoalProgress();
  const fill = document.getElementById('progress-fill');
  fill.style.width = pct + '%';
  fill.classList.toggle('full', pct >= 100);

  if (state.goal && state.goal.name) {
    document.getElementById('goal-text').textContent = state.goal.name;
    document.getElementById('goal-fraction').textContent =
      `${state.totalPoints}/${state.goal.pointsRequired} pts`;
  } else {
    document.getElementById('goal-text').textContent = 'No goal set yet!';
    document.getElementById('goal-fraction').textContent = '';
  }

  // Streak
  document.getElementById('streak-count').textContent = state.streak.count || 0;

  // Chore list
  const list = document.getElementById('chore-list');
  const empty = document.getElementById('empty-chores');
  const sortedChores = [...state.chores].sort((a, b) => a.order - b.order);

  if (sortedChores.length === 0) {
    list.innerHTML = '';
    empty.classList.remove('hidden');
  } else {
    empty.classList.add('hidden');
    list.innerHTML = '';
    sortedChores.forEach(chore => {
      list.appendChild(buildChoreItem(chore));
    });
  }

  // Chore count
  const doneCount = sortedChores.filter(c => isChoreCompleted(c)).length;
  const countEl = document.getElementById('chore-count');
  if (sortedChores.length > 0) {
    countEl.textContent = `${doneCount}/${sortedChores.length} done`;
  } else {
    countEl.textContent = '';
  }
}

function buildChoreItem(chore) {
  const li = document.createElement('li');
  li.className = 'chore-item' + (isChoreCompleted(chore) ? ' done' : '');
  li.dataset.id = chore.id;

  const isDone = isChoreCompleted(chore);

  li.innerHTML = `
    <span class="chore-emoji-lbl" aria-hidden="true">${chore.emoji || '⭐'}</span>
    <div class="chore-info">
      <div class="chore-name">${escHtml(chore.name)}</div>
      <div class="chore-meta">${escHtml(chore.notes || '')} ${chore.schedule === 'daily' ? '• Daily' : chore.schedule === 'weekly' ? '• Weekly' : '• One-time'}</div>
    </div>
    <span class="chore-pts-badge">+${chore.points} ⭐</span>
    <button class="btn-done ${isDone ? 'is-done' : ''}" data-id="${chore.id}" aria-label="${isDone ? 'Undo' : 'Mark done'}">${isDone ? '✅ Undo' : '✔ Done'}</button>
  `;
  return li;
}

// ── RENDER: GOALS TAB ─────────────────────────────────────────────────────────

function renderGoals() {
  const pct = getGoalProgress();
  const fill2 = document.getElementById('progress-fill-2');
  fill2.style.width = pct + '%';
  fill2.classList.toggle('full', pct >= 100);
  document.getElementById('gdc-pct').textContent = pct + '%';

  if (state.goal && state.goal.name) {
    document.getElementById('gdc-name').textContent = state.goal.name;
    document.getElementById('gdc-pts').textContent =
      `${state.totalPoints} / ${state.goal.pointsRequired} points`;
  } else {
    document.getElementById('gdc-name').textContent = 'No goal set';
    document.getElementById('gdc-pts').textContent = '';
  }

  // Redeem behavior radio
  const behavior = state.settings.redeemBehavior || 'subtract';
  document.getElementById('redeem-subtract').checked = behavior === 'subtract';
  document.getElementById('redeem-reset').checked = behavior === 'reset';
}

// ── RENDER: SETTINGS TAB ─────────────────────────────────────────────────────

function renderSettings() {
  // Kid name
  document.getElementById('kid-name-input').value = state.settings.kidName || '';

  // Chore manage list
  const ml = document.getElementById('chore-manage-list');
  ml.innerHTML = '';
  const sorted = [...state.chores].sort((a, b) => a.order - b.order);
  sorted.forEach((chore, idx) => {
    const li = document.createElement('li');
    li.className = 'chore-manage-item';
    li.innerHTML = `
      <span class="chore-emoji-sm">${chore.emoji || '⭐'}</span>
      <span class="chore-nm">${escHtml(chore.name)}</span>
      <span class="chore-pts-sm">${chore.points} pts · ${chore.schedule}</span>
      <div class="manage-btns">
        <button class="btn-chore-up" data-id="${chore.id}" title="Move up" ${idx === 0 ? 'disabled' : ''}>▲</button>
        <button class="btn-chore-down" data-id="${chore.id}" title="Move down" ${idx === sorted.length - 1 ? 'disabled' : ''}>▼</button>
        <button class="btn-chore-edit" data-id="${chore.id}" title="Edit">✏️</button>
        <button class="btn-chore-del" data-id="${chore.id}" title="Delete">🗑️</button>
      </div>
    `;
    ml.appendChild(li);
  });

  // Messages
  const msgList = document.getElementById('messages-list');
  msgList.innerHTML = '';
  (state.settings.messages || []).forEach((msg, idx) => {
    const row = document.createElement('div');
    row.className = 'message-item';
    row.innerHTML = `
      <input type="text" value="${escHtml(msg)}" data-msg-idx="${idx}" class="msg-input" />
      <button class="btn-del-msg" data-msg-idx="${idx}">🗑️</button>
    `;
    msgList.appendChild(row);
  });

  // Parent status
  const statusEl = document.getElementById('parent-status-text');
  statusEl.textContent = parentMode ? '🔓 Unlocked' : '🔒 Locked';
}

function renderAll() {
  renderToday();
  renderGoals();
  renderSettings();
}

// ── NAVIGATION ────────────────────────────────────────────────────────────────

let currentTab = 'today';

function switchTab(tabName) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));
  document.getElementById(`tab-${tabName}`).classList.add('active');
  document.querySelector(`.nav-btn[data-tab="${tabName}"]`).classList.add('active');
  currentTab = tabName;

  if (tabName === 'goals') renderGoals();
  if (tabName === 'settings') renderSettings();
}

// ── CHORE COMPLETION ──────────────────────────────────────────────────────────

function completeChore(choreId) {
  const chore = state.chores.find(c => c.id === choreId);
  if (!chore) return;

  const t = today();
  if (!state.completions[t]) state.completions[t] = {};
  state.completions[t][choreId] = true;
  state.totalPoints += chore.points;

  updateStreak();
  saveState();

  // Flash message
  const messages = state.settings.messages;
  const msg = messages[Math.floor(Math.random() * messages.length)];
  showCompletionMsg(msg);

  renderToday();

  // Pop animation on total
  popElement('pts-total');
  popElement('pts-today');

  // Check goal
  if (state.goal && state.goal.pointsRequired && state.totalPoints >= state.goal.pointsRequired) {
    setTimeout(() => showCelebration(), 600);
  }
}

function undoChore(choreId) {
  const chore = state.chores.find(c => c.id === choreId);
  if (!chore) return;

  // Remove completion from any date
  const t = today();
  if (state.completions[t] && state.completions[t][choreId]) {
    delete state.completions[t][choreId];
    state.totalPoints = Math.max(0, state.totalPoints - chore.points);
  } else if (chore.schedule === 'weekly' || chore.schedule === 'onetime') {
    // Find and remove
    for (const [date, completions] of Object.entries(state.completions)) {
      if (completions[choreId]) {
        delete state.completions[date][choreId];
        state.totalPoints = Math.max(0, state.totalPoints - chore.points);
        break;
      }
    }
  }

  saveState();
  renderToday();
}

function showCompletionMsg(msg) {
  const el = document.getElementById('completion-msg');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(window._msgTimer);
  window._msgTimer = setTimeout(() => el.classList.add('hidden'), 2500);
}

function popElement(id) {
  const el = document.getElementById(id);
  el.classList.remove('pop');
  void el.offsetWidth;
  el.classList.add('pop');
}

// ── CELEBRATION ───────────────────────────────────────────────────────────────

function showCelebration() {
  document.getElementById('cel-goal-name').textContent = state.goal.name;
  document.getElementById('cel-pts').textContent =
    `You earned ${state.totalPoints} points!`;
  document.getElementById('celebration').classList.remove('hidden');
  startConfetti();
}

function hideCelebration() {
  document.getElementById('celebration').classList.add('hidden');
  stopConfetti();
}

// Confetti
let confettiRunning = false;
let confettiAnim = null;
const COLORS = ['#FF6B35','#FFD23F','#4CAF50','#4A90D9','#9C27B0','#FF4081','#00BCD4'];

function startConfetti() {
  const canvas = document.getElementById('confetti-canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  confettiRunning = true;

  const particles = Array.from({length: 120}, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height - canvas.height,
    w: 8 + Math.random() * 10,
    h: 5 + Math.random() * 6,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    angle: Math.random() * Math.PI * 2,
    spin: (Math.random() - .5) * .2,
    vy: 2 + Math.random() * 4,
    vx: (Math.random() - .5) * 3,
  }));

  function draw() {
    if (!confettiRunning) { ctx.clearRect(0,0,canvas.width,canvas.height); return; }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w/2, -p.h/2, p.w, p.h);
      ctx.restore();
      p.y += p.vy;
      p.x += p.vx;
      p.angle += p.spin;
      if (p.y > canvas.height + 20) {
        p.y = -20;
        p.x = Math.random() * canvas.width;
      }
    });
    confettiAnim = requestAnimationFrame(draw);
  }
  draw();
}

function stopConfetti() {
  confettiRunning = false;
  if (confettiAnim) cancelAnimationFrame(confettiAnim);
  const canvas = document.getElementById('confetti-canvas');
  canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
}

// ── REDEEM ────────────────────────────────────────────────────────────────────

function redeemGoal() {
  hideCelebration();
  const behavior = state.settings.redeemBehavior || 'subtract';
  if (behavior === 'subtract') {
    state.totalPoints = Math.max(0, state.totalPoints - state.goal.pointsRequired);
  } else {
    state.totalPoints = 0;
  }
  saveState();
  renderAll();
  showCoupon();
}

// ── COUPON ────────────────────────────────────────────────────────────────────

function showCoupon() {
  document.getElementById('coupon-kid-name').textContent =
    '⭐ ' + (state.settings.kidName || 'Superstar') + ' ⭐';
  document.getElementById('coupon-reward-name').textContent =
    state.goal ? state.goal.name : 'Your Reward';
  document.getElementById('coupon-date').textContent =
    new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  document.getElementById('coupon-view').classList.remove('hidden');
}

function hideCoupon() {
  document.getElementById('coupon-view').classList.add('hidden');
}

// ── PIN MODAL ─────────────────────────────────────────────────────────────────

let pinBuffer = '';
let pinCallback = null;

function openPinModal(cb) {
  pinBuffer = '';
  pinCallback = cb;
  updatePinDots();
  document.getElementById('pin-error').classList.add('hidden');
  document.getElementById('pin-modal').classList.remove('hidden');
}

function closePinModal() {
  document.getElementById('pin-modal').classList.add('hidden');
  pinBuffer = '';
  pinCallback = null;
}

function updatePinDots() {
  document.querySelectorAll('#pin-dots span').forEach((dot, i) => {
    dot.classList.toggle('filled', i < pinBuffer.length);
  });
}

function handlePinKey(val) {
  if (pinBuffer.length >= 4) return;
  pinBuffer += val;
  updatePinDots();
  if (pinBuffer.length === 4) {
    checkPin();
  }
}

function handlePinClear() {
  pinBuffer = pinBuffer.slice(0, -1);
  updatePinDots();
}

function checkPin() {
  const correct = state.settings.pin || '1234';
  if (pinBuffer === correct) {
    closePinModal();
    if (pinCallback) { pinCallback(); pinCallback = null; }
  } else {
    pinBuffer = '';
    updatePinDots();
    const err = document.getElementById('pin-error');
    err.classList.remove('hidden');
    setTimeout(() => err.classList.add('hidden'), 2000);
    // Shake
    const modal = document.querySelector('.modal-box');
    modal.style.animation = 'none';
    void modal.offsetWidth;
    modal.style.animation = 'shake .4s ease';
  }
}

// ── PARENT MODE ───────────────────────────────────────────────────────────────

function toggleParentMode() {
  if (parentMode) {
    lockParent();
  } else {
    openPinModal(() => {
      parentMode = true;
      document.body.classList.add('parent-mode');
      document.getElementById('btn-parent-toggle').classList.add('parent-active');
      document.getElementById('btn-parent-toggle').textContent = '🔓';
      renderSettings();
    });
  }
}

function lockParent() {
  parentMode = false;
  document.body.classList.remove('parent-mode');
  document.getElementById('btn-parent-toggle').classList.remove('parent-active');
  document.getElementById('btn-parent-toggle').textContent = '🔒';
  renderSettings();
}

// ── CHORE MODAL ───────────────────────────────────────────────────────────────

function openChoreModal(choreId = null) {
  const modal = document.getElementById('chore-modal');
  document.getElementById('chore-modal-title').textContent = choreId ? 'Edit Chore' : 'Add Chore';
  document.getElementById('chore-id').value = choreId || '';

  if (choreId) {
    const c = state.chores.find(c => c.id === choreId);
    if (c) {
      document.getElementById('chore-emoji').value = c.emoji || '';
      document.getElementById('chore-name').value = c.name;
      document.getElementById('chore-points').value = c.points;
      document.getElementById('chore-schedule').value = c.schedule;
      document.getElementById('chore-notes').value = c.notes || '';
    }
  } else {
    document.getElementById('chore-emoji').value = '';
    document.getElementById('chore-name').value = '';
    document.getElementById('chore-points').value = 10;
    document.getElementById('chore-schedule').value = 'daily';
    document.getElementById('chore-notes').value = '';
  }
  modal.classList.remove('hidden');
}

function closeChoreModal() {
  document.getElementById('chore-modal').classList.add('hidden');
}

function saveChore() {
  const id = document.getElementById('chore-id').value;
  const name = document.getElementById('chore-name').value.trim();
  if (!name) return alert('Please enter a chore name.');

  const data = {
    name,
    emoji: document.getElementById('chore-emoji').value.trim() || '⭐',
    points: Math.max(1, parseInt(document.getElementById('chore-points').value) || 10),
    schedule: document.getElementById('chore-schedule').value,
    notes: document.getElementById('chore-notes').value.trim(),
  };

  if (id) {
    const idx = state.chores.findIndex(c => c.id === id);
    if (idx !== -1) Object.assign(state.chores[idx], data);
  } else {
    const maxOrder = state.chores.reduce((m, c) => Math.max(m, c.order), -1);
    state.chores.push({ id: Date.now().toString(), order: maxOrder + 1, ...data });
  }

  saveState();
  closeChoreModal();
  renderSettings();
  renderToday();
}

function deleteChore(choreId) {
  if (!confirm('Delete this chore?')) return;
  state.chores = state.chores.filter(c => c.id !== choreId);
  // Clean completions
  for (const completions of Object.values(state.completions)) {
    delete completions[choreId];
  }
  saveState();
  renderSettings();
  renderToday();
}

function moveChore(choreId, direction) {
  const sorted = [...state.chores].sort((a, b) => a.order - b.order);
  const idx = sorted.findIndex(c => c.id === choreId);
  const newIdx = idx + direction;
  if (newIdx < 0 || newIdx >= sorted.length) return;

  // Swap order values
  const tmp = sorted[idx].order;
  sorted[idx].order = sorted[newIdx].order;
  sorted[newIdx].order = tmp;

  // Make sure orders are unique
  if (sorted[idx].order === sorted[newIdx].order) {
    sorted.forEach((c, i) => { c.order = i; });
  }

  saveState();
  renderSettings();
  renderToday();
}

// ── GOAL MODAL ────────────────────────────────────────────────────────────────

function openGoalModal() {
  document.getElementById('goal-name').value = state.goal ? state.goal.name : '';
  document.getElementById('goal-points').value = state.goal ? state.goal.pointsRequired : 100;
  document.getElementById('goal-modal').classList.remove('hidden');
}

function closeGoalModal() {
  document.getElementById('goal-modal').classList.add('hidden');
}

function saveGoal() {
  const name = document.getElementById('goal-name').value.trim();
  if (!name) return alert('Please enter a goal name.');
  const pts = parseInt(document.getElementById('goal-points').value) || 100;
  state.goal = { name, pointsRequired: Math.max(1, pts) };
  saveState();
  closeGoalModal();
  renderAll();
}

// ── EXPORT / IMPORT ───────────────────────────────────────────────────────────

function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `chore-stars-backup-${today()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function handleImportFile(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const data = JSON.parse(ev.target.result);
      // Basic validation
      if (!data.chores || !Array.isArray(data.chores)) throw new Error('Invalid format');
      pendingImport = data;
      document.getElementById('import-modal').classList.remove('hidden');
    } catch {
      alert('Invalid file. Please select a valid Chore Stars backup.');
    }
  };
  reader.readAsText(file);
  e.target.value = ''; // reset so same file can be re-selected
}

function confirmImport() {
  if (!pendingImport) return;
  state = pendingImport;
  // Ensure settings exist
  if (!state.settings) state.settings = { ...DEFAULT_STATE.settings };
  if (!state.settings.messages) state.settings.messages = [...DEFAULT_STATE.settings.messages];
  pendingImport = null;
  document.getElementById('import-modal').classList.add('hidden');
  saveState();
  renderAll();
}

// ── SETTINGS SAVE HELPERS ─────────────────────────────────────────────────────

function saveKidName() {
  state.settings.kidName = document.getElementById('kid-name-input').value.trim() || 'Superstar';
  saveState();
}

function saveMessages() {
  const inputs = document.querySelectorAll('.msg-input');
  state.settings.messages = Array.from(inputs).map(i => i.value.trim()).filter(Boolean);
  saveState();
}

function savePin() {
  const val = document.getElementById('new-pin-input').value.trim();
  if (!/^\d{4}$/.test(val)) return alert('PIN must be exactly 4 digits.');
  state.settings.pin = val;
  saveState();
  document.getElementById('new-pin-input').value = '';
  alert('PIN updated!');
}

function addMessage() {
  state.settings.messages.push('Great job! 🎉');
  saveState();
  renderSettings();
}

function deleteMessage(idx) {
  state.settings.messages.splice(idx, 1);
  saveState();
  renderSettings();
}

// ── HELPER ────────────────────────────────────────────────────────────────────

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function requireParent(fn) {
  if (parentMode) { fn(); return; }
  openPinModal(() => {
    parentMode = true;
    document.body.classList.add('parent-mode');
    document.getElementById('btn-parent-toggle').classList.add('parent-active');
    document.getElementById('btn-parent-toggle').textContent = '🔓';
    renderSettings();
    fn();
  });
}

// ── ADD CSS SHAKE ANIMATION ───────────────────────────────────────────────────

const shakeStyle = document.createElement('style');
shakeStyle.textContent = `
@keyframes shake {
  0%,100%{transform:translateX(0)}
  20%{transform:translateX(-8px)}
  40%{transform:translateX(8px)}
  60%{transform:translateX(-6px)}
  80%{transform:translateX(6px)}
}
`;
document.head.appendChild(shakeStyle);

// ── EVENT LISTENERS ───────────────────────────────────────────────────────────

function initEvents() {
  // Bottom nav
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Parent toggle
  document.getElementById('btn-parent-toggle').addEventListener('click', toggleParentMode);

  // Chore list — done/undo buttons
  document.getElementById('chore-list').addEventListener('click', e => {
    const btn = e.target.closest('.btn-done');
    if (!btn) return;
    const id = btn.dataset.id;
    if (btn.classList.contains('is-done')) {
      if (!parentMode) {
        openPinModal(() => {
          parentMode = true;
          document.body.classList.add('parent-mode');
          document.getElementById('btn-parent-toggle').classList.add('parent-active');
          document.getElementById('btn-parent-toggle').textContent = '🔓';
          undoChore(id);
        });
        return;
      }
      undoChore(id);
    } else {
      completeChore(id);
      // Flash effect
      const li = btn.closest('.chore-item');
      const flash = document.createElement('div');
      flash.className = 'done-flash';
      li.appendChild(flash);
      setTimeout(() => flash.remove(), 500);
    }
  });

  // PIN pad
  document.querySelectorAll('.pin-key').forEach(key => {
    key.addEventListener('click', () => {
      const val = key.dataset.val;
      const action = key.dataset.action;
      if (val !== undefined) handlePinKey(val);
      else if (action === 'clear') handlePinClear();
      else if (action === 'cancel') closePinModal();
    });
  });

  // Celebration
  document.getElementById('btn-redeem').addEventListener('click', redeemGoal);
  document.getElementById('btn-cel-close').addEventListener('click', hideCelebration);

  // Coupon
  document.getElementById('btn-close-coupon').addEventListener('click', hideCoupon);

  // Goal modal
  document.getElementById('btn-edit-goal').addEventListener('click', () => {
    if (parentMode) openGoalModal();
  });
  document.getElementById('btn-save-goal').addEventListener('click', saveGoal);
  document.getElementById('btn-cancel-goal').addEventListener('click', closeGoalModal);

  // Redeem behavior
  document.querySelectorAll('input[name="redeem"]').forEach(radio => {
    radio.addEventListener('change', () => {
      if (!parentMode) return;
      state.settings.redeemBehavior = radio.value;
      saveState();
    });
  });

  // Reset points
  document.getElementById('btn-reset-points').addEventListener('click', () => {
    if (!parentMode) return;
    if (!confirm('Reset ALL points to zero?')) return;
    state.totalPoints = 0;
    saveState();
    renderAll();
  });

  // Chore modal
  document.getElementById('btn-add-chore').addEventListener('click', () => openChoreModal());
  document.getElementById('btn-save-chore').addEventListener('click', saveChore);
  document.getElementById('btn-cancel-chore').addEventListener('click', closeChoreModal);

  // Chore manage list events
  document.getElementById('chore-manage-list').addEventListener('click', e => {
    const upBtn = e.target.closest('.btn-chore-up');
    const downBtn = e.target.closest('.btn-chore-down');
    const editBtn = e.target.closest('.btn-chore-edit');
    const delBtn = e.target.closest('.btn-chore-del');

    if (upBtn) moveChore(upBtn.dataset.id, -1);
    else if (downBtn) moveChore(downBtn.dataset.id, 1);
    else if (editBtn) openChoreModal(editBtn.dataset.id);
    else if (delBtn) deleteChore(delBtn.dataset.id);
  });

  // Messages
  document.getElementById('btn-add-msg').addEventListener('click', addMessage);
  document.getElementById('messages-list').addEventListener('click', e => {
    const btn = e.target.closest('.btn-del-msg');
    if (btn) {
      saveMessages(); // save current edits first
      deleteMessage(parseInt(btn.dataset.msgIdx));
    }
  });
  document.getElementById('messages-list').addEventListener('change', e => {
    if (e.target.classList.contains('msg-input')) saveMessages();
  });

  // PIN save
  document.getElementById('btn-save-pin').addEventListener('click', savePin);

  // Lock parent
  document.getElementById('btn-lock-parent').addEventListener('click', lockParent);

  // Kid name
  document.getElementById('kid-name-input').addEventListener('change', saveKidName);
  document.getElementById('kid-name-input').addEventListener('blur', saveKidName);

  // Export/Import
  document.getElementById('btn-export').addEventListener('click', exportData);
  document.getElementById('import-file-input').addEventListener('change', handleImportFile);
  document.getElementById('btn-confirm-import').addEventListener('click', confirmImport);
  document.getElementById('btn-cancel-import').addEventListener('click', () => {
    pendingImport = null;
    document.getElementById('import-modal').classList.add('hidden');
  });

  // Close modals on backdrop click
  ['pin-modal', 'chore-modal', 'goal-modal', 'import-modal'].forEach(id => {
    document.getElementById(id).addEventListener('click', e => {
      if (e.target === document.getElementById(id)) {
        document.getElementById(id).classList.add('hidden');
      }
    });
  });
}

// ── DAILY RESET CHECK ─────────────────────────────────────────────────────────

function checkDailyReset() {
  // Nothing to do — we check by date on each render.
  // Just prune old completion dates (keep last 90 days) to prevent unbounded growth.
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  for (const date of Object.keys(state.completions)) {
    if (date < cutoffStr) delete state.completions[date];
  }
}

// ── INIT ──────────────────────────────────────────────────────────────────────

function init() {
  loadState();
  checkDailyReset();
  initEvents();
  renderAll();

  // Set up visibility change handler to re-render (handles overnight usage)
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      checkDailyReset();
      renderAll();
    }
  });
}

document.addEventListener('DOMContentLoaded', init);

// ── SERVICE WORKER REGISTRATION ───────────────────────────────────────────────

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').catch(() => {});
  });
}
