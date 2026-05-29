
// ════════════════════════════════════════════════
// PERSISTENCE — tiny localStorage wrapper
// ════════════════════════════════════════════════
const LS = {
  get(k, fb = null) { try { const v = localStorage.getItem(k); return v !== null ? JSON.parse(v) : fb; } catch { return fb; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { } },
};

// ─────────────── DISABLED & STARRED WORDS ───────────────
let disabled = new Set(LS.get('voc_disabled', []));
function saveDisabled() { LS.set('voc_disabled', [...disabled]); }
let starred = new Set(LS.get('voc_starred', []));
function saveStarred() { LS.set('voc_starred', [...starred]); }
let writeStarred = new Set(LS.get('voc_write_starred', []));
function saveWriteStarred() { LS.set('voc_write_starred', [...writeStarred]); }
let knownStatus = LS.get('voc_known_status', {});
function saveKnownStatus() { LS.set('voc_known_status', knownStatus); }

function activeWords(unit, isWrite = false) {
  let pool;
  if (unit === 'starred') {
    pool = WORDS.filter(w => isWrite ? writeStarred.has(w.term) : starred.has(w.term));
  } else if (unit === 'unknown') {
    pool = WORDS.filter(w => knownStatus[w.term] === false);
  } else if (unit === 'known') {
    pool = WORDS.filter(w => knownStatus[w.term] === true);
  } else {
    pool = unit === 'all' ? WORDS : WORDS.filter(w => w.unit === unit);
  }
  return pool.filter(w => !disabled.has(w.term));
}
function updateCounts() {
  document.getElementById('total-count').textContent = WORDS.length;
  document.getElementById('active-count').textContent = WORDS.length - disabled.size;
  const scEl = document.getElementById('starred-count');
  if (scEl) scEl.textContent = starred.size;
}
updateCounts();

// ─────────────── HELPERS ───────────────
function shuffle(arr) { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[a[i], a[j]] = [a[j], a[i]]; } return a; }
function scrollTop() { document.getElementById('main-scroll').scrollTo({ top: 0, behavior: 'smooth' }); }
// Resolve array of WORDS indices back to word objects (handles removed/disabled words gracefully)
function indicesToWords(indices) { return indices.map(i => WORDS[i]).filter(Boolean); }
function wordsToIndices(words) { return words.map(w => WORDS.indexOf(w)).filter(i => i >= 0); }

// ─────────────── NAV — persist active tab ───────────────
const SECTIONS = ['flashcards', 'quiz', 'write', 'match', 'browse'];
function showSection(id, btn) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  btn.classList.add('active');
  LS.set('voc_tab', id);
  scrollTop();
  if (id === 'quiz') restoreOrStartQuiz();
  if (id === 'write') restoreOrStartWrite();
  if (id === 'match') startMatch();
  if (id === 'browse') renderBrowse();
}

// ════════════════════════════════════════════════
// FLASHCARDS  — persist: unit, direction, order, index
// ════════════════════════════════════════════════
let fcCards = [], fcIndex = 0, fcDirection = 'en';

function saveFCState() {
  LS.set('fc', { unit: document.getElementById('fc-unit').value, dir: fcDirection, order: wordsToIndices(fcCards), idx: fcIndex });
}

function resetFlashcards() {
  fcCards = shuffle(activeWords(document.getElementById('fc-unit').value));
  fcIndex = 0;
  saveFCState();
  renderFlashcard();
}

function shuffleCards() {
  fcCards = shuffle(fcCards); fcIndex = 0;
  saveFCState(); renderFlashcard();
}

function resetKnownStatus() {
  if (confirm("Opravdu chceš vynulovat historii odpovědí (Umím/Neumím) u všech slovíček?")) {
    knownStatus = {};
    saveKnownStatus();
    renderFlashcard();
  }
}

function jumpToCard(index) {
  if (!fcCards.length) return;
  fcIndex = Math.max(0, Math.min(index, fcCards.length - 1));
  saveFCState();
  renderFlashcard();
}

function updateSliderBackground(val, max) {
  const slider = document.getElementById('fc-slider');
  if (!slider) return;
  const pct = max > 0 ? (val / max) * 100 : 0;
  slider.style.background = `linear-gradient(to right, var(--accent) ${pct}%, var(--surface2) ${pct}%)`;
}



function setDirection(dir) {
  fcDirection = dir;
  ['en', 'cz', 'def'].forEach(d => document.getElementById('dir-' + d).classList.toggle('active', d === dir));
  document.getElementById('fc-dir-label').textContent = { en: 'EN → CZ', cz: 'CZ → EN', def: 'Definice → EN' }[dir];
  document.getElementById('fc-scene').classList.remove('flipped');
  saveFCState(); renderFlashcard();
}

function renderFlashcard() {
  if (!fcCards.length) {
    document.getElementById('fc-front-text').textContent = 'Žádná aktivní slovíčka';
    document.getElementById('fc-back-def').textContent = '';
    document.getElementById('fc-back-text').textContent = '';
    document.getElementById('fc-unit-badge').style.display = 'none';
    document.querySelectorAll('.flashcard-scene .card-star-btn').forEach(btn => btn.style.display = 'none');
    document.querySelectorAll('.flashcard-scene .card-status-badge').forEach(b => b.style.display = 'none');
    const slider = document.getElementById('fc-slider');
    if (slider) slider.style.display = 'none';
    document.getElementById('card-current').textContent = '0';
    document.getElementById('card-total').textContent = '0';
    return;
  }
  document.getElementById('fc-unit-badge').style.display = 'block';
  document.querySelectorAll('.flashcard-scene .card-star-btn').forEach(btn => btn.style.display = 'flex');
  document.querySelectorAll('.flashcard-scene .card-status-badge').forEach(b => b.style.display = 'block');
  const w = fcCards[fcIndex];
  document.getElementById('fc-scene').classList.remove('flipped');
  document.getElementById('card-current').textContent = fcIndex + 1;
  document.getElementById('card-total').textContent = fcCards.length;
  const slider = document.getElementById('fc-slider');
  if (slider) {
    if (fcCards.length === 0) {
      slider.style.display = 'none';
    } else {
      slider.style.display = 'block';
      slider.max = fcCards.length;
      slider.value = fcIndex + 1;
      updateSliderBackground(fcIndex, Math.max(1, fcCards.length - 1));
    }
  }
  document.getElementById('fc-unit-badge').textContent = w.unit;
  const t = w.term.replace(/\s*\([nvadj]+\)/g, '');
  // Format text: insert line break before each numbered definition (2., 3., 4. ...)
  // but NOT when preceded by a comma (e.g. "1., 2. akcie" means both share a translation)
  function fmtText(str) {
    if (!str) return '';
    const esc = str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    // Only break before a number when NOT preceded by comma (lookbehind (?<!,))
    return esc.replace(/(?<!,) (\d+\.) /g, (m, n) => n === '1.' ? m : '<br>' + n + ' ');
  }
  function setField(id, str) {
    const el = document.getElementById(id);
    el.innerHTML = fmtText(str);
  }
  if (fcDirection === 'en') { document.getElementById('fc-front-text').textContent = t; setField('fc-back-def', w.def); setField('fc-back-text', w.tr); }
  else if (fcDirection === 'cz') { setField('fc-front-text', w.tr); setField('fc-back-def', w.def); document.getElementById('fc-back-text').textContent = t; }
  else { setField('fc-front-text', w.def); setField('fc-back-def', w.tr); document.getElementById('fc-back-text').textContent = t; }

  const isStarred = starred.has(w.term);
  document.querySelectorAll('.flashcard-scene .card-star-btn').forEach(btn => {
    btn.innerHTML = isStarred ? '★' : '☆';
    btn.classList.toggle('active', isStarred);
  });

  // Aktualizace stavových štítků
  const status = knownStatus[w.term];
  const badges = document.querySelectorAll('.flashcard-scene .card-status-badge');
  badges.forEach(b => {
    b.className = 'card-status-badge';
    if (status === true) {
      b.textContent = 'Minule: Umím';
      b.classList.add('known');
    } else if (status === false) {
      b.textContent = 'Minule: Neumím';
      b.classList.add('unknown');
    } else {
      b.textContent = 'Nové';
      b.classList.add('new');
    }
  });
}

function toggleStarredCurrent(event) {
  if (event) event.stopPropagation(); // Zabránit otočení karty
  if (!fcCards.length) return;
  const w = fcCards[fcIndex];
  if (starred.has(w.term)) {
    starred.delete(w.term);
  } else {
    starred.add(w.term);
  }
  saveStarred();
  const isStarred = starred.has(w.term);
  document.querySelectorAll('.flashcard-scene .card-star-btn').forEach(btn => {
    btn.innerHTML = isStarred ? '★' : '☆';
    btn.classList.toggle('active', isStarred);
  });
  updateCounts();

  // If currently filtering by starred and the card is unstarred, remove it immediately
  const filter = document.getElementById('fc-unit').value;
  if (filter === 'starred' && !isStarred) {
    fcCards.splice(fcIndex, 1);
    if (fcCards.length === 0) {
      fcIndex = 0;
    } else {
      fcIndex = fcIndex % fcCards.length;
    }
    saveFCState();
    renderFlashcard();
  }
}

function flipCard() { document.getElementById('fc-scene').classList.toggle('flipped'); }

function nextCard() {
  fcIndex = (fcIndex + 1) % fcCards.length;
  saveFCState(); renderFlashcard(); scrollTop();
}
function prevCard() {
  fcIndex = (fcIndex - 1 + fcCards.length) % fcCards.length;
  saveFCState(); renderFlashcard(); scrollTop();
}

// Restore flashcard state on load
(function restoreFC() {
  const s = LS.get('fc', null);
  if (s) {
    // Restore unit select
    const unitEl = document.getElementById('fc-unit');
    if (s.unit) unitEl.value = s.unit;
    // Restore direction buttons
    if (s.dir) {
      fcDirection = s.dir;
      ['en', 'cz', 'def'].forEach(d => document.getElementById('dir-' + d).classList.toggle('active', d === s.dir));
      document.getElementById('fc-dir-label').textContent = { en: 'EN → CZ', cz: 'CZ → EN', def: 'Definice → EN' }[s.dir];
    }
    // Restore order — filter out any words that no longer exist
    if (s.order && s.order.length) {
      const restored = indicesToWords(s.order);
      // Only use saved order if it still makes sense (same unit filter)
      const fresh = activeWords(unitEl.value);
      // If restored set matches current active pool (ignoring order), use it
      const resTerms = new Set(restored.map(w => w.term));
      const freshTerms = new Set(fresh.map(w => w.term));
      const samePool = [...resTerms].every(t => freshTerms.has(t)) && resTerms.size === freshTerms.size;
      if (samePool && restored.length) {
        fcCards = restored;
        fcIndex = Math.min(s.idx || 0, fcCards.length - 1);
      } else { fcCards = shuffle(fresh); fcIndex = 0; }
    } else { fcCards = shuffle(activeWords(unitEl.value)); fcIndex = 0; }
  } else {
    fcCards = shuffle(activeWords('all')); fcIndex = 0;
  }
  renderFlashcard();
})();

// ════════════════════════════════════════════════
// QUIZ  — persist: unit, type, order, index, score
// ════════════════════════════════════════════════
let quizCards = [], quizIndex = 0, quizScore = 0, quizAnswered = false, sessC = 0, sessT = 0;

function saveQuizState() {
  LS.set('quiz', { unit: document.getElementById('quiz-unit').value, type: document.getElementById('quiz-type').value, order: wordsToIndices(quizCards), idx: quizIndex, score: quizScore, sessC, sessT });
}

function startQuiz() {
  quizCards = shuffle(activeWords(document.getElementById('quiz-unit').value));
  quizIndex = 0; quizScore = 0; quizAnswered = false; sessC = 0; sessT = 0;
  saveQuizState(); updateSess(); renderQuiz(); scrollTop();
}

function restoreOrStartQuiz() {
  const s = LS.get('quiz', null);
  if (s) {
    // Restore selects
    const uEl = document.getElementById('quiz-unit'), tEl = document.getElementById('quiz-type');
    if (s.unit) uEl.value = s.unit;
    if (s.type) tEl.value = s.type;
    const restored = indicesToWords(s.order || []);
    const fresh = activeWords(uEl.value);
    const resTerms = new Set(restored.map(w => w.term));
    const freshTerms = new Set(fresh.map(w => w.term));
    const samePool = [...resTerms].every(t => freshTerms.has(t)) && resTerms.size === freshTerms.size;
    if (samePool && restored.length && (s.idx || 0) < restored.length) {
      quizCards = restored; quizIndex = s.idx || 0; quizScore = s.score || 0;
      sessC = s.sessC || 0; sessT = s.sessT || 0; quizAnswered = false;
    } else {
      quizCards = shuffle(fresh); quizIndex = 0; quizScore = 0; sessC = 0; sessT = 0; quizAnswered = false;
    }
  } else {
    quizCards = shuffle(activeWords('all')); quizIndex = 0; quizScore = 0; quizAnswered = false; sessC = 0; sessT = 0;
  }
  updateSess(); renderQuiz();
}

function renderQuiz() {
  const area = document.getElementById('quiz-area');
  if (!quizCards.length) { area.innerHTML = '<p style="color:var(--text-muted)">Žádná aktivní slovíčka.</p>'; return; }
  if (quizIndex >= quizCards.length) {
    const pct = Math.round(quizScore / quizCards.length * 100);
    area.innerHTML = `<div class="quiz-result"><h2>${pct >= 80 ? '🎉 Výborně!' : pct >= 50 ? '👍 Dobře!' : '💪 Zkus znovu!'}</h2><p style="color:var(--text-muted)">Dosáhl(a) jsi</p><span class="score-big">${quizScore}/${quizCards.length}</span><p style="color:var(--text-muted);margin-bottom:18px">${pct}% správně</p><button class="btn btn-primary" onclick="startQuiz()">Zkusit znovu</button></div>`;
    LS.set('quiz', null); scrollTop(); return;
  }
  const w = quizCards[quizIndex]; const type = document.getElementById('quiz-type').value;
  const pool = activeWords(document.getElementById('quiz-unit').value);
  let q, correct, wrongs;
  if (type === 'en2cz') { q = w.term; correct = w.tr; wrongs = shuffle(pool.filter(x => x.tr !== w.tr)).slice(0, 3).map(x => x.tr); }
  else if (type === 'cz2en') { q = w.tr; correct = w.term; wrongs = shuffle(pool.filter(x => x.term !== w.term)).slice(0, 3).map(x => x.term); }
  else { q = w.def; correct = w.term; wrongs = shuffle(pool.filter(x => x.term !== w.term)).slice(0, 3).map(x => x.term); }
  const opts = shuffle([correct, ...wrongs]);
  area.innerHTML = `<div class="quiz-score">Otázka <strong>${quizIndex + 1}</strong>/${quizCards.length} &nbsp;|&nbsp; ✓ <strong>${quizScore}</strong></div>
<div class="quiz-question"><div class="quiz-label">${type === 'en2cz' ? 'Přeloď do češtiny' : type === 'cz2en' ? 'Přeloď do angličtiny' : 'Který termín odpovídá definici?'}</div><div class="quiz-term">${q}</div></div>
<div class="quiz-options">${opts.map(o => `<button class="quiz-option" onclick="checkQuiz(this,'${encodeURIComponent(o)}','${encodeURIComponent(correct)}')">${o}</button>`).join('')}</div>

<div class="fixed-bottom-bar" id="next-btn-container" style="display:none;">
  <button class="btn btn-primary shadow-btn" id="next-btn" onclick="nextQuiz()" style="font-size:1.15rem; padding:12px 40px;">Další →</button>
</div>`;
}

function checkQuiz(btn, sel, cor) {
  if (quizAnswered) return; quizAnswered = true;
  const s = decodeURIComponent(sel), c = decodeURIComponent(cor);
  document.querySelectorAll('.quiz-option').forEach(o => { o.disabled = true; if (o.textContent === c) o.classList.add('correct'); });
  if (s === c) { btn.classList.add('correct'); quizScore++; sessC++; } else btn.classList.add('wrong');
  sessT++; updateSess();
  saveQuizState();
  document.getElementById('next-btn-container').style.display = 'flex';
}

function nextQuiz() {
  quizIndex++; quizAnswered = false;
  saveQuizState(); renderQuiz(); scrollTop();
}

function updateSess() {
  const bar = document.getElementById('session-score');
  if (sessT > 0) { bar.style.display = 'inline'; document.getElementById('sess-correct').textContent = sessC; document.getElementById('sess-total').textContent = sessT; }
}

// ════════════════════════════════════════════════
// WRITE  — persist: unit, dir, order, index
// ════════════════════════════════════════════════
// WRITE  — persist: unit, dir, order, index, score, wrongs
// ════════════════════════════════════════════════
let writeCards = [], writeIndex = 0, writeDir = 'en';
let writeScore = 0;
let writeWrongs = [];

function saveWriteState() {
  LS.set('write', { 
    unit: document.getElementById('write-unit').value, 
    dir: writeDir, 
    order: wordsToIndices(writeCards), 
    idx: writeIndex,
    score: writeScore,
    wrongs: writeWrongs
  });
}

function startWrite() {
  writeCards = shuffle(activeWords(document.getElementById('write-unit').value, true));
  writeIndex = 0;
  writeScore = 0;
  writeWrongs = [];
  saveWriteState();
  renderWrite();
  scrollTop();
}

function setWriteDir(dir) {
  writeDir = dir;
  document.getElementById('wdir-en').classList.toggle('active', dir === 'en');
  document.getElementById('wdir-cz').classList.toggle('active', dir === 'cz');
  startWrite();
}

function restoreOrStartWrite() {
  const s = LS.get('write', null);
  if (s) {
    const uEl = document.getElementById('write-unit');
    if (s.unit) uEl.value = s.unit;
    if (s.dir) {
      writeDir = s.dir;
      document.getElementById('wdir-en').classList.toggle('active', s.dir === 'en');
      document.getElementById('wdir-cz').classList.toggle('active', s.dir === 'cz');
    }
    const restored = indicesToWords(s.order || []);
    const fresh = activeWords(uEl.value, true);
    const resTerms = new Set(restored.map(w => w.term));
    const freshTerms = new Set(fresh.map(w => w.term));
    const samePool = [...resTerms].every(t => freshTerms.has(t)) && resTerms.size === freshTerms.size;
    if (samePool && restored.length && (s.idx || 0) < restored.length) {
      writeCards = restored; 
      writeIndex = s.idx || 0;
      writeScore = s.score || 0;
      writeWrongs = s.wrongs || [];
    } else { 
      writeCards = shuffle(fresh); 
      writeIndex = 0; 
      writeScore = 0;
      writeWrongs = [];
    }
  } else { 
    writeCards = shuffle(activeWords('all', true)); 
    writeIndex = 0; 
    writeScore = 0;
    writeWrongs = [];
  }
  renderWrite();
}

function renderWrite() {
  const area = document.getElementById('write-area');
  if (!writeCards.length) { area.innerHTML = '<p style="color:var(--text-muted)">Žádná aktivní slovíčka.</p>'; return; }
  
  if (writeIndex >= writeCards.length) {
    const pct = writeCards.length ? Math.round(writeScore / writeCards.length * 100) : 0;
    
    let wrongsHtml = '';
    if (writeWrongs.length > 0) {
      wrongsHtml = `
        <div class="wrongs-container">
          <div class="wrongs-title">Chybná slovíčka (${writeWrongs.length}):</div>
          ${writeWrongs.map(w => {
            const isStar = writeStarred.has(w.term);
            const safeTerm = w.term.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
            return `
              <div class="wrong-item" style="display: flex; justify-content: space-between; align-items: center; gap: 12px;">
                <div style="flex: 1;">
                  <div class="wrong-item-prompt">${w.prompt}</div>
                  <div class="wrong-item-user">Tvůj překlad: <em>${w.userAns ? w.userAns : '[vynecháno]'}</em></div>
                  <div class="wrong-item-correct">Správně: <strong>${w.correct}</strong></div>
                </div>
                <button type="button" class="wrong-star-btn${isStar ? ' active' : ''}" onclick="toggleWriteStarredFromResults('${safeTerm}', this)" title="Označit hvězdičkou (psaní)">${isStar ? '★' : '☆'}</button>
              </div>
            `;
          }).join('')}
        </div>
      `;
    } else {
      wrongsHtml = `<p style="color:var(--success); font-weight:700; margin: 15px 0;">🎉 Bez chyb! Skvělá práce!</p>`;
    }

    area.innerHTML = `<div class="quiz-result">
      <h2>${pct >= 90 ? '🎉 Excelentní!' : pct >= 70 ? '💪 Dobrá práce!' : pct >= 50 ? '👍 Slušné!' : '🧐 Chce to ještě procvičovat!'}</h2>
      <p style="color:var(--text-muted)">Tvůj výsledek v psaní</p>
      <span class="score-big">${writeScore}/${writeCards.length}</span>
      <p style="color:var(--text-muted);margin-bottom:18px">${pct}% správně</p>
      
      ${wrongsHtml}
      
      <div style="display: flex; gap: 12px; justify-content: center; margin-top: 20px;">
        <button class="btn btn-primary" onclick="startWrite()">Zkusit znovu</button>
        ${writeWrongs.length > 0 ? `<button class="btn btn-outline" id="star-wrongs-btn" onclick="starAllWriteWrongs()">⭐️ Označit chyby</button>` : ''}
      </div>
    </div>`;
    
    LS.set('write', null); 
    scrollTop(); 
    return;
  }
  
  const w = writeCards[writeIndex]; const isEn = writeDir === 'en';
  const isStar = writeStarred.has(w.term);
  area.innerHTML = `<div class="write-card" style="position: relative;">
    <button type="button" class="card-star-btn${isStar ? ' active' : ''}" onclick="toggleWriteStarredCurrent(event)" title="Označit hvězdičkou (psaní)">${isStar ? '★' : '☆'}</button>
    <div class="write-question">${isEn ? 'Přeloď do češtiny' : 'Přeloď do angličtiny'} &nbsp;(${writeIndex + 1}/${writeCards.length})</div>
    <div class="write-term">${isEn ? w.term : w.tr}</div>
    <div class="write-hint">${w.def}</div>
    <input class="write-input" id="write-inp" type="text" placeholder="${isEn ? 'Napiš český překlad...' : 'Napiš anglický termín...'}" autocomplete="off" onkeydown="if(event.key==='Enter')checkWrite()">
    <div class="write-feedback" id="write-fb"></div>
  </div>

<div class="fixed-bottom-bar" id="write-controls">
  <button class="btn btn-primary shadow-btn" onclick="checkWrite()">Zkontrolovat</button>
  <button class="btn btn-outline bg-glass" onclick="skipWrite()">Přeskočit</button>
</div>`;
  setTimeout(() => { try { document.getElementById('write-inp').focus(); } catch (e) { } }, 80);
}

function starAllWriteWrongs() {
  if (!writeWrongs || !writeWrongs.length) return;
  writeWrongs.forEach(w => {
    writeStarred.add(w.term);
  });
  saveWriteStarred();
  const btn = document.getElementById('star-wrongs-btn');
  if (btn) {
    btn.innerHTML = '✓ Označeno! ✍️';
    btn.disabled = true;
    btn.classList.add('active');
  }
  document.querySelectorAll('.wrong-star-btn').forEach(b => {
    b.innerHTML = '★';
    b.classList.add('active');
  });
}

function toggleWriteStarredFromResults(term, btn) {
  if (writeStarred.has(term)) {
    writeStarred.delete(term);
  } else {
    writeStarred.add(term);
  }
  saveWriteStarred();
  const isStar = writeStarred.has(term);
  btn.innerHTML = isStar ? '★' : '☆';
  btn.classList.toggle('active', isStar);
}

function toggleWriteStarredCurrent(event) {
  if (event) event.stopPropagation();
  if (!writeCards.length || writeIndex >= writeCards.length) return;
  const w = writeCards[writeIndex];
  if (writeStarred.has(w.term)) {
    writeStarred.delete(w.term);
  } else {
    writeStarred.add(w.term);
  }
  saveWriteStarred();
  const isStar = writeStarred.has(w.term);
  const btn = document.querySelector('.write-card .card-star-btn');
  if (btn) {
    btn.innerHTML = isStar ? '★' : '☆';
    btn.classList.toggle('active', isStar);
  }
  const filter = document.getElementById('write-unit').value;
  if (filter === 'starred' && !isStar) {
    writeCards.splice(writeIndex, 1);
    if (writeCards.length === 0) {
      writeIndex = 0;
    } else {
      writeIndex = writeIndex % writeCards.length;
    }
    saveWriteState();
    renderWrite();
  }
}

function checkWrite() {
  const inp = document.getElementById('write-inp'); const fb = document.getElementById('write-fb');
  if (!inp || inp.dataset.checked) return; inp.dataset.checked = '1';
  const w = writeCards[writeIndex]; const isEn = writeDir === 'en';
  const userAns = inp.value.trim().toLowerCase();
  const correctRaw = isEn ? w.tr : w.term;
  const correct = correctRaw.toLowerCase();

  // Step 1: Split on full-variant separators:
  //   " / " – spaced slash (English multi-term like "CEO / Managing Director")
  //   ";"   – semicolon (separates numbered definitions)
  //   ","   – comma (alternative Czech translations)
  const rawVariants = correct.split(/ \/ |[;,]/).map(v => v.trim()).filter(v => v.length > 0);

  // Step 2: For each raw variant:
  //   a) Strip leading number prefix like "1. " or "2. " (from numbered tr values)
  //   b) Expand unspaced slashes (word-level alternatives in Czech):
  //      "vedoucí skupiny/týmu/štábu" → ["vedoucí skupiny","vedoucí týmu","vedoucí štábu"]
  const variants = [];
  for (let v of rawVariants) {
    const stripped = v.replace(/^\d+\.\s*/, '').trim();
    if (!stripped) continue;
    if (stripped.includes('/')) {
      const words = stripped.split(' ');
      const si = words.findIndex(word => word.includes('/'));
      if (si !== -1) {
        const pre = words.slice(0, si);
        const suf = words.slice(si + 1);
        for (const alt of words[si].split('/')) {
          const expanded = [...pre, alt, ...suf].join(' ').trim();
          if (expanded) variants.push(expanded);
        }
        continue;
      }
    }
    variants.push(stripped);
  }

  const ok = variants.length > 0 && variants.some(v => userAns === v);
  inp.classList.add(ok ? 'correct-input' : 'wrong-input');
  fb.className = 'write-feedback ' + (ok ? 'correct' : 'wrong') + ' show';
  fb.innerHTML = ok ? `✓ Správně! <em>${correctRaw}</em>` : `✗ Správná odpověď: <em>${correctRaw}</em>`;
  
  if (ok) {
    writeScore++;
  } else {
    writeWrongs.push({
      term: w.term,
      tr: w.tr,
      userAns: inp.value.trim(),
      correct: correctRaw,
      prompt: isEn ? w.term : w.tr
    });
  }
  
  setTimeout(() => { writeIndex++; saveWriteState(); renderWrite(); scrollTop(); }, 1600);
}
function skipWrite() {
  if (writeIndex >= writeCards.length) return;
  const w = writeCards[writeIndex];
  const isEn = writeDir === 'en';
  writeWrongs.push({
    term: w.term,
    tr: w.tr,
    userAns: '',
    correct: isEn ? w.tr : w.term,
    prompt: isEn ? w.term : w.tr
  });
  writeIndex++; saveWriteState(); renderWrite(); scrollTop();
}

// ════════════════════════════════════════════════
// MATCHING  — no persistent progress (game resets each time)
// ════════════════════════════════════════════════
let matchPairs = [], matchMatched = 0, matchTotal = 0, matchLeftSel = null, matchRightSel = null;
function startMatch() {
  // OMEZENO NA 6 PÁRŮ ABY SE TO VEŠLO NA MOBIL BEZ SCROLLOVÁNÍ
  const pool = shuffle(activeWords(document.getElementById('match-unit').value)).slice(0, 6);
  matchPairs = pool; matchMatched = 0; matchTotal = pool.length; matchLeftSel = null; matchRightSel = null;
  renderMatch(); scrollTop();
}
function renderMatch() {
  const area = document.getElementById('match-area');
  if (!matchPairs.length) { area.innerHTML = '<p style="color:var(--text-muted)">Žádná aktivní slovíčka.</p>'; return; }
  const left = matchPairs.map((w, i) => ({ id: i, text: w.term.replace(/\s*\([nvadj]+\)/g, '') }));
  const right = shuffle(matchPairs.map((w, i) => ({ id: i, text: w.tr.split(',')[0].trim() })));
  area.innerHTML = `<div class="match-score">Spárováno: <strong>${matchMatched}</strong>/${matchTotal}</div>
<div class="match-grid"><div class="match-col">${left.map(it => `<div class="match-card" id="ml-${it.id}" onclick="selectMatch('left',${it.id})">${it.text}</div>`).join('')}</div>
<div class="match-col">${right.map(it => `<div class="match-card" id="mr-${it.id}" onclick="selectMatch('right',${it.id})">${it.text}</div>`).join('')}</div></div>

<div class="fixed-bottom-bar" id="match-controls" style="display:none; flex-direction:column; align-items:center; gap:8px;">
  <div style="background:var(--success); color:#000; padding:4px 12px; border-radius:20px; font-weight:bold; font-size:0.8rem;">🎉 Všechno správně!</div>
  <button class="btn btn-primary shadow-btn" onclick="startMatch()" style="font-size:1.15rem; padding:12px 40px;">Nová hra 🔄</button>
</div>`;
}
function selectMatch(side, id) {
  const el = document.getElementById(side === 'left' ? `ml-${id}` : `mr-${id}`);
  if (el.classList.contains('matched')) return;
  if (side === 'left') { if (matchLeftSel !== null) document.getElementById(`ml-${matchLeftSel}`)?.classList.remove('selected'); matchLeftSel = id; el.classList.add('selected'); }
  else { if (matchRightSel !== null) document.getElementById(`mr-${matchRightSel}`)?.classList.remove('selected'); matchRightSel = id; el.classList.add('selected'); }
  if (matchLeftSel !== null && matchRightSel !== null) {
    const lEl = document.getElementById(`ml-${matchLeftSel}`), rEl = document.getElementById(`mr-${matchRightSel}`);
    if (matchLeftSel === matchRightSel) {
      lEl.classList.remove('selected'); lEl.classList.add('matched'); rEl.classList.remove('selected'); rEl.classList.add('matched');
      matchMatched++; document.querySelector('.match-score').innerHTML = `Spárováno: <strong>${matchMatched}</strong>/${matchTotal}`;
      if (matchMatched === matchTotal) {
        setTimeout(() => {
          // UKÁŽE SE PLOVOUCÍ TLAČÍTKO "NOVÁ HRA"
          document.getElementById('match-controls').style.display = 'flex';
        }, 300);
      }
    } else {
      lEl.classList.add('wrong-flash'); rEl.classList.add('wrong-flash');
      setTimeout(() => { lEl.classList.remove('wrong-flash', 'selected'); rEl.classList.remove('wrong-flash', 'selected'); }, 450);
    }
    matchLeftSel = null; matchRightSel = null;
  }
}

// ════════════════════════════════════════════════
// BROWSE + TOGGLE
// ════════════════════════════════════════════════
function toggleWord(term, cb) {
  if (cb.checked) disabled.delete(term); else disabled.add(term);
  saveDisabled(); updateCounts();
  cb.closest('.browse-card').classList.toggle('disabled-word', !cb.checked);
  updateDisabledBanner();
}
function enableAll() { disabled.clear(); saveDisabled(); updateCounts(); renderBrowse(); }
function updateDisabledBanner() {
  const banner = document.getElementById('browse-banner');
  const n = disabled.size;
  banner.style.display = n > 0 ? 'flex' : 'none';
  if (n > 0) document.getElementById('disabled-count').textContent = n;
}
function toggleStarredBrowse(term, btn) {
  if (starred.has(term)) {
    starred.delete(term);
  } else {
    starred.add(term);
  }
  saveStarred();
  const isStarred = starred.has(term);
  btn.innerHTML = isStarred ? '★' : '☆';
  btn.classList.toggle('active', isStarred);
  updateCounts();
}

function toggleStarredWriteBrowse(term, btn) {
  if (writeStarred.has(term)) {
    writeStarred.delete(term);
  } else {
    writeStarred.add(term);
  }
  saveWriteStarred();
  const isStarred = writeStarred.has(term);
  btn.innerHTML = isStarred ? '★' : '☆';
  btn.classList.toggle('active', isStarred);
}

function renderBrowse() {
  const search = document.getElementById('browse-search').value.toLowerCase();
  const unit = document.getElementById('browse-unit').value;
  const show = document.getElementById('browse-show').value;
  let pool;
  if (unit === 'starred') {
    pool = WORDS.filter(w => starred.has(w.term));
  } else if (unit === 'write_starred') {
    pool = WORDS.filter(w => writeStarred.has(w.term));
  } else if (unit === 'unknown') {
    pool = WORDS.filter(w => knownStatus[w.term] === false);
  } else if (unit === 'known') {
    pool = WORDS.filter(w => knownStatus[w.term] === true);
  } else {
    pool = unit === 'all' ? WORDS : WORDS.filter(w => w.unit === unit);
  }
  if (search) pool = pool.filter(w => w.term.toLowerCase().includes(search) || w.tr.toLowerCase().includes(search) || w.def.toLowerCase().includes(search));
  if (show === 'active') pool = pool.filter(w => !disabled.has(w.term));
  if (show === 'disabled') pool = pool.filter(w => disabled.has(w.term));
  updateDisabledBanner();
  document.getElementById('browse-grid').innerHTML = pool.map(w => {
    const dis = disabled.has(w.term);
    const isStar = starred.has(w.term);
    const isWriteStar = writeStarred.has(w.term);
    const safe = w.term.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    return `<div class="browse-card${dis ? ' disabled-word' : ''}">
  <div class="browse-actions">
    <button class="browse-star-btn${isStar ? ' active' : ''}" onclick="toggleStarredBrowse('${safe}',this)" title="Označit hvězdičkou (kartičky)">${isStar ? '★' : '☆'}</button>
    <button class="browse-star-write-btn${isWriteStar ? ' active' : ''}" onclick="toggleStarredWriteBrowse('${safe}',this)" title="Označit hvězdičkou (psaní)">${isWriteStar ? '★' : '☆'}</button>
    <label class="toggle-switch" title="${dis ? 'Zapnout' : 'Vypnout'}"><input type="checkbox" ${dis ? '' : 'checked'} onchange="toggleWord('${safe}',this)"><span class="toggle-slider"></span></label>
  </div>
  <div class="browse-unit-tag">${w.unit}</div>
  <div class="browse-term">${w.term}</div>
  <div class="browse-translation">${w.tr}</div>
  <div class="browse-def">${w.def}</div>
</div>`;
  }).join('');
}

// ════════════════════════════════════════════════
// INIT — restore last active tab
// ════════════════════════════════════════════════
(function init() {
  const lastTab = LS.get('voc_tab', 'flashcards');
  if (lastTab && lastTab !== 'flashcards') {
    // activate the right nav button and section without triggering data fetches
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(lastTab).classList.add('active');
    const btns = document.querySelectorAll('.nav-btn');
    const idx = ['flashcards', 'quiz', 'write', 'match', 'browse'].indexOf(lastTab);
    if (idx >= 0) btns[idx].classList.add('active');
    if (lastTab === 'quiz') restoreOrStartQuiz();
    else if (lastTab === 'write') restoreOrStartWrite();
    else if (lastTab === 'match') startMatch();
    else if (lastTab === 'browse') renderBrowse();
  } else {
    // flashcards already restored above, quiz pre-load for when user switches
    setTimeout(() => {
      // pre-restore quiz state silently so it's ready
      const s = LS.get('quiz', null);
      if (!s) { quizCards = shuffle(activeWords('all')); quizIndex = 0; quizScore = 0; }
    }, 100);
  }
  renderBrowse();
})();

// ════════════════════════════════════════════════
// TINDER-LIKE SWIPING & KEYBOARD LISTENERS
// ════════════════════════════════════════════════
let isSwiping = false;

function swipeCard(direction) {
  if (isSwiping) return;
  if (!fcCards.length) return;
  isSwiping = true;

  const scene = document.getElementById('fc-scene');
  scene.style.transition = 'transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1), opacity 0.3s ease';
  
  const w = fcCards[fcIndex];
  if (direction === 'right') {
    scene.style.transform = 'translate(150%, 10px) rotate(20deg)';
    scene.style.opacity = '0';
    knownStatus[w.term] = true;
  } else {
    scene.style.transform = 'translate(-150%, 10px) rotate(-20deg)';
    scene.style.opacity = '0';
    knownStatus[w.term] = false;
  }
  
  saveKnownStatus();

  setTimeout(() => {
    const filter = document.getElementById('fc-unit').value;
    let shouldRemove = false;
    if (filter === 'unknown' && knownStatus[w.term] !== false) {
      shouldRemove = true;
    } else if (filter === 'known' && knownStatus[w.term] !== true) {
      shouldRemove = true;
    }

    if (shouldRemove) {
      fcCards.splice(fcIndex, 1);
      if (fcCards.length === 0) {
        fcIndex = 0;
      } else {
        fcIndex = fcIndex % fcCards.length;
      }
    } else {
      fcIndex = (fcIndex + 1) % fcCards.length;
    }
    
    saveFCState();
    
    scene.style.transition = 'none';
    scene.style.transform = 'translate(0, 0) rotate(0)';
    scene.style.opacity = '1';
    
    renderFlashcard();
    isSwiping = false;
  }, 300);
}

(function initSwipeAndKeys() {
  const scene = document.getElementById('fc-scene');
  if (!scene) return;

  let startX = 0, startY = 0, deltaX = 0, deltaY = 0;

  scene.addEventListener('touchstart', (e) => {
    if (isSwiping) return;
    const touch = e.touches[0];
    startX = touch.clientX;
    startY = touch.clientY;
    scene.style.transition = 'none';
  }, { passive: true });

  scene.addEventListener('touchmove', (e) => {
    if (isSwiping) return;
    e.preventDefault(); // Zamezit scrollování stránky během swipování
    const touch = e.touches[0];
    deltaX = touch.clientX - startX;
    deltaY = touch.clientY - startY;
    
    const rotate = deltaX * 0.05;
    scene.style.transform = `translate(${deltaX}px, ${deltaY}px) rotate(${rotate}deg)`;
  }, { passive: false });

  scene.addEventListener('touchend', () => {
    if (isSwiping) return;
    if (deltaY < -100 && Math.abs(deltaX) < 100) {
      swipeCard('up');
    } else if (Math.abs(deltaX) > 100) {
      swipeCard(deltaX > 0 ? 'right' : 'left');
    } else {
      scene.style.transition = 'transform 0.3s ease';
      scene.style.transform = 'translate(0, 0) rotate(0)';
    }
    deltaX = 0;
    deltaY = 0;
  });

  // KEYBINDINGS STATE & CONTROLLERS
  const DEFAULT_KEYS = {
    flip: { code: 'Space', label: 'Mezerník' },
    next: { code: 'ArrowDown', label: 'Šipka dolů' },
    prev: { code: 'ArrowUp', label: 'Šipka nahoru' },
    know: { code: 'ArrowRight', label: 'Šipka vpravo' },
    dontknow: { code: 'ArrowLeft', label: 'Šipka vlevo' },
    repeat: { code: 'KeyR', label: 'R' },
    star: { code: 'KeyS', label: 'S' }
  };

  let keys = LS.get('voc_keys', DEFAULT_KEYS);
  // Ensure backwards compatibility with older saved key bindings
  for (const k of Object.keys(DEFAULT_KEYS)) {
    if (!keys[k]) keys[k] = DEFAULT_KEYS[k];
  }
  let activeRecordingAction = null;

  window.openKeybindingsModal = function() {
    activeRecordingAction = null;
    document.querySelectorAll('.kb-bind-btn').forEach(btn => btn.classList.remove('recording'));
    updateKeybindingButtons();
    document.getElementById('keybindings-modal').style.display = 'flex';
  };

  window.closeKeybindingsModal = function() {
    activeRecordingAction = null;
    updateKeybindingButtons();
    document.getElementById('keybindings-modal').style.display = 'none';
  };

  window.recordKey = function(action) {
    // If already recording this action, cancel it
    if (activeRecordingAction === action) {
      activeRecordingAction = null;
      updateKeybindingButtons();
      return;
    }
    activeRecordingAction = action;
    updateKeybindingButtons();
    const btn = document.getElementById(`kb-${action}`);
    if (btn) {
      btn.textContent = 'Stiskni klávesu...';
      btn.classList.add('recording');
    }
  };

  window.resetKeybindings = function() {
    if (confirm('Chceš opravdu obnovit výchozí klávesové zkratky?')) {
      keys = JSON.parse(JSON.stringify(DEFAULT_KEYS));
      LS.set('voc_keys', keys);
      activeRecordingAction = null;
      updateKeybindingButtons();
    }
  };

  function updateKeybindingButtons() {
    for (const [action, bind] of Object.entries(keys)) {
      const btn = document.getElementById(`kb-${action}`);
      if (btn) {
        btn.textContent = bind.label;
        btn.classList.remove('recording');
      }
    }
  }

  function getKeyLabel(e) {
    if (e.code === 'Space') return 'Mezerník';
    if (e.code === 'ArrowRight') return 'Šipka vpravo';
    if (e.code === 'ArrowLeft') return 'Šipka vlevo';
    if (e.code === 'ArrowUp') return 'Šipka nahoru';
    if (e.code === 'ArrowDown') return 'Šipka dolů';
    if (e.code === 'Enter') return 'Enter';
    if (e.code === 'Escape') return 'Escape';
    if (e.code === 'Tab') return 'Tab';
    if (e.key.length === 1) return e.key.toUpperCase();
    return e.key;
  }

  // Global keydown handler
  document.addEventListener('keydown', (e) => {
    // 1. If recording a key binding inside modal
    if (activeRecordingAction) {
      e.preventDefault();
      const action = activeRecordingAction;
      activeRecordingAction = null;
      
      // Save new binding
      keys[action] = {
        code: e.code,
        label: getKeyLabel(e)
      };
      LS.set('voc_keys', keys);
      updateKeybindingButtons();
      return;
    }

    // 2. Escape closes keybindings modal if open
    if (e.code === 'Escape') {
      const modal = document.getElementById('keybindings-modal');
      if (modal && modal.style.display !== 'none') {
        e.preventDefault();
        closeKeybindingsModal();
        return;
      }
    }

    // 3. Ignore other shortcuts if keybindings modal is open
    const modal = document.getElementById('keybindings-modal');
    if (modal && modal.style.display !== 'none') {
      return;
    }

    // 4. If user is inside an input field or select dropdown, ignore shortcuts
    if (document.activeElement && (
      document.activeElement.tagName === 'INPUT' || 
      document.activeElement.tagName === 'SELECT' || 
      document.activeElement.tagName === 'TEXTAREA'
    )) {
      return;
    }

    // 5. Shortcuts active in flashcards section
    const fcSection = document.getElementById('flashcards');
    if (fcSection && fcSection.classList.contains('active')) {
      const code = e.code;
      
      if (code === keys.flip.code) {
        e.preventDefault();
        flipCard();
      } else if (code === keys.next.code) {
        e.preventDefault();
        nextCard();
      } else if (code === keys.prev.code) {
        e.preventDefault();
        prevCard();
      } else if (code === keys.know.code) {
        e.preventDefault();
        swipeCard('right');
      } else if (code === keys.dontknow.code) {
        e.preventDefault();
        swipeCard('left');
      } else if (code === keys.repeat.code) {
        e.preventDefault();
        swipeCard('up');
      } else if (code === keys.star.code) {
        e.preventDefault();
        toggleStarredCurrent();
      }
    }
  });
})();
