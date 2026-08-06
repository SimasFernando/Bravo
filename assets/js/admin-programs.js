// ============================================================
// ADMIN-PROGRAMS — criar e listar "Programas Bravo"
// ------------------------------------------------------------
// A estrutura de dados salva aqui é DE PROPÓSITO idêntica à de
// um preset comum do app (mesmos campos por formato: normal/
// circuit/brain). Isso é o que vai permitir, no próximo passo,
// que um programa atribuído a um aluno "vire" um preset dele
// sem precisar de nenhuma lógica de conversão.
//
// Um programa pode ter um único treino (campos direto no
// documento, como sempre foi) OU múltiplos treinos, guardados
// em `workouts: [{label, mode, ...campos do modo}, ...]`. Nesse
// segundo caso o programa inteiro continua sendo UM documento só
// — um único id, um único access/locked/salesLink — então tudo
// que já existe (liberar, ocultar, excluir) funciona igual sem
// mudança nenhuma. Só a apresentação no app muda: em vez de um
// botão TREINAR, mostra um botão por treino.
// ============================================================
import { collection, getDocs, doc, setDoc, deleteDoc }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const EX_LETTERS = ['A','B','C','D','E','F','G','H','I','J','K','L'];
let _programs = null;
let editingId = null;
let _workoutIdx = 0; // contador de blocos de treino na sessão atual do formulário

function isValidYtUrl(url) {
  if (!url) return true; // vazio é válido (campo opcional)
  return /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/))([A-Za-z0-9_-]{11})/.test(url);
}

function isValidHttpUrl(url) {
  if (!url) return true; // vazio é válido (campo opcional)
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

const BRAVO_ORANGE = '#F04E23';

// ---- geração dinâmica dos campos: nome + link do YouTube por exercício ----
// O nome tem autocomplete na biblioteca (assets/js/admin-exercises.js): a
// busca em si e o "+ adicionar à biblioteca" são tratados por delegação de
// evento lá embaixo, então essa função só marca os elementos certos com
// data-ex-* pra esses handlers encontrarem o que precisam.
function renderExerciseInputs(containerId, prefix, count, existingNames, existingVideos) {
  const el = document.getElementById(containerId);
  if (!el) return;
  let html = '';
  for (let i = 0; i < count; i++) {
    const nameVal = existingNames?.[i] || '';
    const videoVal = existingVideos?.[i] || '';
    const canUp = i > 0;
    const canDown = i < count - 1;
    html += `<div class="ex-row" style="margin-bottom:8px;">
      <div style="display:flex;gap:8px;align-items:flex-end;">
        <div style="display:flex;flex-direction:column;gap:3px;padding-bottom:2px;">
          <button type="button" data-ex-move="up" data-ex-move-prefix="${prefix}" data-ex-move-index="${i}" ${canUp ? '' : 'disabled'}
            style="border:none;background:var(--surface2);border-radius:6px;width:26px;height:22px;line-height:1;cursor:${canUp ? 'pointer' : 'default'};opacity:${canUp ? '1' : '.3'};color:var(--text);font-size:11px;"
            title="Mover para cima" aria-label="Mover exercício para cima">▲</button>
          <button type="button" data-ex-move="down" data-ex-move-prefix="${prefix}" data-ex-move-index="${i}" ${canDown ? '' : 'disabled'}
            style="border:none;background:var(--surface2);border-radius:6px;width:26px;height:22px;line-height:1;cursor:${canDown ? 'pointer' : 'default'};opacity:${canDown ? '1' : '.3'};color:var(--text);font-size:11px;"
            title="Mover para baixo" aria-label="Mover exercício para baixo">▼</button>
        </div>
        <div class="field-group ex-autocomplete-wrap" style="flex:1;">
          <label class="field-label">Exercício ${EX_LETTERS[i] || (i+1)}</label>
          <input class="field-input" id="${prefix}${i}" data-ex-name value="${escapeHtml(nameVal)}" placeholder="Digite pra buscar na biblioteca..." autocomplete="off">
          <div class="ex-suggestions hidden" data-ex-suggestions></div>
        </div>
        <div class="field-group" style="flex:1;">
          <label class="field-label">Link YouTube (opcional)</label>
          <input class="field-input" id="${prefix}Yt${i}" data-ex-video value="${escapeHtml(videoVal)}" placeholder="https://youtube.com/...">
        </div>
      </div>
    </div>`;
  }
  el.innerHTML = html;
  window._ensureExerciseLibrary?.(); // aquece o cache assim que a lista aparece na tela
}

// ---- reordenar exercícios: troca os VALORES (nome + vídeo) entre posições
// adjacentes, sem mexer nos ids/DOM. Isso mantém intacta toda a lógica de
// leitura por índice (salvar, editar, etc.) — só o conteúdo muda de lugar.
function swapExerciseValues(prefix, i, j) {
  const nameA = document.getElementById(prefix + i);
  const nameB = document.getElementById(prefix + j);
  const videoA = document.getElementById(prefix + 'Yt' + i);
  const videoB = document.getElementById(prefix + 'Yt' + j);
  if (!nameA || !nameB) return;
  const tmpName = nameA.value;
  nameA.value = nameB.value;
  nameB.value = tmpName;
  if (videoA && videoB) {
    const tmpVideo = videoA.value;
    videoA.value = videoB.value;
    videoB.value = tmpVideo;
  }
}

document.addEventListener('click', (e) => {
  const moveBtn = e.target.closest('[data-ex-move]');
  if (!moveBtn) return;
  const dir = moveBtn.dataset.exMove;
  const prefix = moveBtn.dataset.exMovePrefix;
  const i = parseInt(moveBtn.dataset.exMoveIndex);
  const j = dir === 'up' ? i - 1 : i + 1;
  swapExerciseValues(prefix, i, j);
});

// ---- herança de exercícios ao trocar de modo (Clássico/Circuito/Bravo) ----
// Cada modo guarda sua própria lista de campos, então trocar de modo por si
// só não apaga nada — mas o modo novo começa com a lista dele, que pode
// estar vazia. Isso fazia parecer que os exercícios tinham sido apagados.
// Aqui a gente lê o que estava no modo anterior e replica pro modo novo.
function modeFieldConf(mode, idx) {
  const p = idx == null ? '' : `progW${idx}_`;
  const map = {
    normal:  { countId: idx == null ? 'progNormalExCount' : `${p}NormalExCount`, listId: idx == null ? 'progNormalExList' : `${p}NormalExList`, prefix: idx == null ? 'progNfEx' : `${p}NfEx` },
    circuit: { countId: idx == null ? 'progExCount' : `${p}ExCount`, listId: idx == null ? 'progCircuitExList' : `${p}CircuitExList`, prefix: idx == null ? 'progCEx' : `${p}CEx` },
    brain:   { countId: idx == null ? 'progBrainExCount' : `${p}BrainExCount`, listId: idx == null ? 'progBrainExList' : `${p}BrainExList`, prefix: idx == null ? 'progBEx' : `${p}BEx` },
  };
  return map[mode];
}

function readExerciseValues(prefix, count) {
  const names = [], videos = [];
  for (let i = 0; i < count; i++) {
    names.push(document.getElementById(prefix + i)?.value.trim() || '');
    videos.push(document.getElementById(prefix + 'Yt' + i)?.value.trim() || '');
  }
  return { names, videos };
}

// Lê os exercícios do modo atual (oldMode) e, se houver algo preenchido,
// replica pro modo novo (newMode) antes da troca de visibilidade acontecer.
// idx é null pro formulário de modo único, ou o índice do bloco no builder
// de múltiplos treinos.
function carryExercisesOnModeSwitch(oldMode, newMode, idx) {
  if (oldMode === newMode) return;
  const oldConf = modeFieldConf(oldMode, idx);
  if (!oldConf) return;
  const oldCount = parseInt(document.getElementById(oldConf.countId)?.value) || 0;
  const { names, videos } = readExerciseValues(oldConf.prefix, oldCount);
  if (!names.some(n => n)) return; // nada preenchido no modo anterior, não há o que herdar
  const newConf = modeFieldConf(newMode, idx);
  if (!newConf) return;
  const newCount = Math.min(Math.max(names.length, 1), 12);
  const countInput = document.getElementById(newConf.countId);
  if (countInput) countInput.value = newCount;
  renderExerciseInputs(newConf.listId, newConf.prefix, newCount, names, videos);
}

// ============================================================
// AUTOCOMPLETE — sugestões da biblioteca de exercícios enquanto digita
// ============================================================
function normalizeSearch(str) {
  return String(str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function exerciseTagLabels(ex) {
  const groupLabels = (ex.grupamentos || []).map(id => window._GRUPAMENTOS?.find(g => g.id === id)?.label || id);
  const modLabels = (ex.modalidades || []).map(id => window._modalityList?.find(m => m.id === id)?.label || id);
  return [...groupLabels, ...modLabels].join(' · ');
}

async function showExerciseSuggestions(input) {
  const wrap = input.closest('.ex-autocomplete-wrap');
  const box = wrap?.querySelector('[data-ex-suggestions]');
  if (!box) return;
  const term = normalizeSearch(input.value);
  if (!term) { box.classList.add('hidden'); box.innerHTML = ''; return; }

  await window._ensureExerciseLibrary?.();
  const lib = window._exerciseLibrary || [];
  const matches = lib.filter(ex => ex.nomeBusca.includes(term)).slice(0, 8);

  let html = matches.map(ex => `
    <div class="ex-suggestion-item" data-ex-pick="${ex.id}">
      ${escapeHtml(ex.nome)}
      ${exerciseTagLabels(ex) ? `<div class="ex-suggestion-tags">${escapeHtml(exerciseTagLabels(ex))}</div>` : ''}
    </div>`).join('');

  const exactMatch = lib.some(ex => ex.nomeBusca === term);
  if (!exactMatch && input.value.trim()) {
    html += `<div class="ex-suggestion-add" data-ex-add-new>+ Adicionar "${escapeHtml(input.value.trim())}" à biblioteca</div>`;
  }

  if (!html) { box.classList.add('hidden'); box.innerHTML = ''; return; }
  box.innerHTML = html;
  box.classList.remove('hidden');
}

document.addEventListener('input', (e) => {
  const input = e.target.closest('[data-ex-name]');
  if (input) showExerciseSuggestions(input);
});

document.addEventListener('focusout', (e) => {
  const input = e.target.closest('[data-ex-name]');
  if (!input) return;
  // espera um instante pro clique numa sugestão registrar antes de esconder a lista
  setTimeout(() => {
    input.closest('.ex-autocomplete-wrap')?.querySelector('[data-ex-suggestions]')?.classList.add('hidden');
  }, 150);
});

document.addEventListener('click', (e) => {
  const pick = e.target.closest('[data-ex-pick]');
  if (pick) {
    const wrap = pick.closest('.ex-autocomplete-wrap');
    const nameInput = wrap?.querySelector('[data-ex-name]');
    const videoInput = nameInput?.closest('.ex-row')?.querySelector('[data-ex-video]');
    const ex = (window._exerciseLibrary || []).find(x => x.id === pick.dataset.exPick);
    if (nameInput && ex) nameInput.value = ex.nome;
    if (videoInput && ex?.youtubeUrl && !videoInput.value) videoInput.value = ex.youtubeUrl;
    wrap?.querySelector('[data-ex-suggestions]')?.classList.add('hidden');
    return;
  }
  const addNew = e.target.closest('[data-ex-add-new]');
  if (addNew) {
    const wrap = addNew.closest('.ex-autocomplete-wrap');
    const nameInput = wrap?.querySelector('[data-ex-name]');
    wrap?.querySelector('[data-ex-suggestions]')?.classList.add('hidden');
    if (nameInput) {
      window._openExerciseQuickAdd?.(nameInput.value.trim(), (savedEx) => {
        nameInput.value = savedEx.nome;
        const videoInput = nameInput.closest('.ex-row')?.querySelector('[data-ex-video]');
        if (videoInput && savedEx.youtubeUrl && !videoInput.value) videoInput.value = savedEx.youtubeUrl;
      });
    }
  }
});

// ============================================================
// FORMULÁRIO — modo único (comportamento original)
// ============================================================
document.getElementById('progNormalExCount')?.addEventListener('input', (e) => {
  renderExerciseInputs('progNormalExList', 'progNfEx', parseInt(e.target.value) || 1);
});
document.getElementById('progExCount')?.addEventListener('input', (e) => {
  renderExerciseInputs('progCircuitExList', 'progCEx', parseInt(e.target.value) || 1);
});
document.getElementById('progBrainExCount')?.addEventListener('input', (e) => {
  renderExerciseInputs('progBrainExList', 'progBEx', parseInt(e.target.value) || 1);
});
document.querySelectorAll('#progSingleFields .mode-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const mode = btn.dataset.mode;
    const oldMode = document.getElementById('progMode').value;
    carryExercisesOnModeSwitch(oldMode, mode, null);

    document.querySelectorAll('#progSingleFields .mode-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('progMode').value = mode;

    document.querySelectorAll('#progSingleFields .prog-fields').forEach(f => window.adminHide(f));
    const map = { normal: 'progFieldsNormal', circuit: 'progFieldsCircuit', brain: 'progFieldsBrain' };
    window.adminShow(document.getElementById(map[mode]));
  });
});

// ============================================================
// FORMULÁRIO — múltiplos treinos
// ============================================================
document.getElementById('progMultiToggle')?.addEventListener('change', (e) => {
  const multi = e.target.checked;
  if (multi) {
    window.adminHide(document.getElementById('progSingleFields'));
    window.adminShow(document.getElementById('progWorkoutsBuilder'));
    if (!document.getElementById('progWorkoutsList').children.length) {
      addWorkoutBlock(null);
      addWorkoutBlock(null);
    }
  } else {
    window.adminShow(document.getElementById('progSingleFields'));
    window.adminHide(document.getElementById('progWorkoutsBuilder'));
  }
});

document.getElementById('progAddWorkoutBtn')?.addEventListener('click', () => {
  addWorkoutBlock(null);
});

function addWorkoutBlock(existing) {
  const idx = _workoutIdx++;
  const container = document.getElementById('progWorkoutsList');
  const mode = existing?.mode || 'normal';
  const div = document.createElement('div');
  div.id = `progWorkoutBlock${idx}`;
  div.style.cssText = 'border:1px solid var(--surface2);border-radius:10px;padding:12px;margin-bottom:12px;';
  div.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:8px;gap:8px;">
      <div class="field-group" style="flex:1;margin-bottom:0;">
        <label class="field-label">Nome do treino</label>
        <input class="field-input" id="progW${idx}_label" value="${escapeHtml(existing?.label || '')}" placeholder="ex: Treino A">
      </div>
      <button type="button" data-remove-workout="${idx}" style="background:none;border:none;color:var(--muted);font-size:13px;cursor:pointer;white-space:nowrap;padding-bottom:8px;">Remover</button>
    </div>
    <div class="mode-toggle" style="grid-template-columns:1fr 1fr 1fr;margin-bottom:8px;">
      <button type="button" data-workout-mode-btn data-widx="${idx}" data-mode="normal" class="mode-btn${mode === 'normal' ? ' active' : ''}">⏱ Clássico</button>
      <button type="button" data-workout-mode-btn data-widx="${idx}" data-mode="circuit" class="mode-btn${mode === 'circuit' ? ' active' : ''}">🔄 Circuito</button>
      <button type="button" data-workout-mode-btn data-widx="${idx}" data-mode="brain" class="mode-btn${mode === 'brain' ? ' active' : ''}">Bravo</button>
    </div>
    <input type="hidden" id="progW${idx}_mode" value="${mode}">
    <div id="progW${idx}_fields">
      <div id="progW${idx}_FieldsNormal" class="prog-fields${mode === 'normal' ? '' : ' hidden'}">
        <div class="field-group" style="margin-bottom:8px;">
          <label class="field-label">Nº Exercícios</label>
          <input class="field-input" type="number" id="progW${idx}_NormalExCount" value="${existing?.normalExCount || 1}" min="1" max="12">
        </div>
        <div style="display:flex;gap:8px;margin-bottom:8px;flex-wrap:wrap;">
          <div class="field-group"><label class="field-label">Séries</label><input class="field-input" type="number" id="progW${idx}_Cycles" value="${existing?.cycles ?? 3}"></div>
          <div class="field-group"><label class="field-label">Preparação (s)</label><input class="field-input" type="number" id="progW${idx}_Prep" value="${existing?.prep ?? 10}"></div>
          <div class="field-group"><label class="field-label">Execução (s)</label><input class="field-input" type="number" id="progW${idx}_Action" value="${existing?.action ?? 40}"></div>
          <div class="field-group"><label class="field-label">Recuperação (s)</label><input class="field-input" type="number" id="progW${idx}_Rest" value="${existing?.rest ?? 20}"></div>
        </div>
        <div id="progW${idx}_NormalExList"></div>
      </div>
      <div id="progW${idx}_FieldsCircuit" class="prog-fields${mode === 'circuit' ? '' : ' hidden'}">
        <div class="field-group" style="margin-bottom:8px;">
          <label class="field-label">Nº Exercícios</label>
          <input class="field-input" type="number" id="progW${idx}_ExCount" value="${existing?.exCount || 4}" min="1" max="12">
        </div>
        <div style="display:flex;gap:8px;margin-bottom:8px;flex-wrap:wrap;">
          <div class="field-group"><label class="field-label">Rodadas</label><input class="field-input" type="number" id="progW${idx}_Rounds" value="${existing?.rounds ?? 3}"></div>
          <div class="field-group"><label class="field-label">Preparação (s)</label><input class="field-input" type="number" id="progW${idx}_CPrep" value="${existing?.prep ?? 10}"></div>
          <div class="field-group"><label class="field-label">Execução (s)</label><input class="field-input" type="number" id="progW${idx}_CAction" value="${existing?.action ?? 30}"></div>
          <div class="field-group"><label class="field-label">Intervalo (s)</label><input class="field-input" type="number" id="progW${idx}_CRest" value="${existing?.rest ?? 0}"></div>
        </div>
        <div id="progW${idx}_CircuitExList"></div>
      </div>
      <div id="progW${idx}_FieldsBrain" class="prog-fields${mode === 'brain' ? '' : ' hidden'}">
        <div class="field-group" style="margin-bottom:8px;">
          <label class="field-label">Nº Exercícios</label>
          <input class="field-input" type="number" id="progW${idx}_BrainExCount" value="${existing?.brainExCount || 2}" min="1" max="12">
        </div>
        <div style="display:flex;gap:8px;margin-bottom:8px;flex-wrap:wrap;">
          <div class="field-group"><label class="field-label">Séries</label><input class="field-input" type="number" id="progW${idx}_BrainSeries" value="${existing?.brainSeries ?? 3}"></div>
          <div class="field-group"><label class="field-label">Preparação (s)</label><input class="field-input" type="number" id="progW${idx}_BrainPrep" value="${existing?.brainPrep ?? 15}"></div>
          <div class="field-group"><label class="field-label">Execução (s)</label><input class="field-input" type="number" id="progW${idx}_BrainAction" value="${existing?.brainAction ?? 40}"></div>
        </div>
        <div id="progW${idx}_BrainExList"></div>
      </div>
    </div>
  `;
  container.appendChild(div);
  renderExerciseInputs(`progW${idx}_NormalExList`, `progW${idx}_NfEx`, existing?.normalExCount || 1, existing?.normalExercises, existing?.normalExerciseVideos);
  renderExerciseInputs(`progW${idx}_CircuitExList`, `progW${idx}_CEx`, existing?.exCount || 4, existing?.exercises, existing?.exerciseVideos);
  renderExerciseInputs(`progW${idx}_BrainExList`, `progW${idx}_BEx`, existing?.brainExCount || 2, existing?.brainExercises, existing?.brainExerciseVideos);
}

document.getElementById('progWorkoutsList')?.addEventListener('click', (e) => {
  const modeBtn = e.target.closest('[data-workout-mode-btn]');
  if (modeBtn) {
    const idx = modeBtn.dataset.widx;
    const mode = modeBtn.dataset.mode;
    const oldMode = document.getElementById(`progW${idx}_mode`)?.value;
    carryExercisesOnModeSwitch(oldMode, mode, idx);

    document.querySelectorAll(`[data-workout-mode-btn][data-widx="${idx}"]`).forEach(b => b.classList.toggle('active', b === modeBtn));
    document.getElementById(`progW${idx}_mode`).value = mode;
    document.querySelectorAll(`#progW${idx}_fields .prog-fields`).forEach(f => window.adminHide(f));
    const map = { normal: `progW${idx}_FieldsNormal`, circuit: `progW${idx}_FieldsCircuit`, brain: `progW${idx}_FieldsBrain` };
    window.adminShow(document.getElementById(map[mode]));
    return;
  }
  const removeBtn = e.target.closest('[data-remove-workout]');
  if (removeBtn) {
    document.getElementById(`progWorkoutBlock${removeBtn.dataset.removeWorkout}`)?.remove();
  }
});

document.getElementById('progWorkoutsList')?.addEventListener('input', (e) => {
  const id = e.target.id || '';
  const m = id.match(/^progW(\d+)_(NormalExCount|ExCount|BrainExCount)$/);
  if (!m) return;
  const idx = m[1];
  if (m[2] === 'NormalExCount') renderExerciseInputs(`progW${idx}_NormalExList`, `progW${idx}_NfEx`, parseInt(e.target.value) || 1);
  else if (m[2] === 'ExCount') renderExerciseInputs(`progW${idx}_CircuitExList`, `progW${idx}_CEx`, parseInt(e.target.value) || 1);
  else if (m[2] === 'BrainExCount') renderExerciseInputs(`progW${idx}_BrainExList`, `progW${idx}_BEx`, parseInt(e.target.value) || 1);
});

function readWorkoutBlock(idx) {
  const label = document.getElementById(`progW${idx}_label`)?.value.trim() || '';
  const mode = document.getElementById(`progW${idx}_mode`)?.value || 'normal';
  let w = { label, mode };
  const videoUrls = [];

  if (mode === 'normal') {
    const count = parseInt(document.getElementById(`progW${idx}_NormalExCount`)?.value) || 1;
    const exercises = [], videos = [];
    for (let i = 0; i < count; i++) {
      exercises.push(document.getElementById(`progW${idx}_NfEx${i}`)?.value.trim() || EX_LETTERS[i]);
      const v = document.getElementById(`progW${idx}_NfExYt${i}`)?.value.trim() || '';
      videos.push(v); videoUrls.push(v);
    }
    w = { ...w,
      normalExCount: count,
      cycles: parseInt(document.getElementById(`progW${idx}_Cycles`)?.value) || 1,
      prep: parseInt(document.getElementById(`progW${idx}_Prep`)?.value) || 0,
      action: parseInt(document.getElementById(`progW${idx}_Action`)?.value) || 0,
      rest: parseInt(document.getElementById(`progW${idx}_Rest`)?.value) || 0,
      normalExercises: exercises, normalExerciseVideos: videos
    };
  } else if (mode === 'circuit') {
    const count = parseInt(document.getElementById(`progW${idx}_ExCount`)?.value) || 1;
    const exercises = [], videos = [];
    for (let i = 0; i < count; i++) {
      exercises.push(document.getElementById(`progW${idx}_CEx${i}`)?.value.trim() || EX_LETTERS[i]);
      const v = document.getElementById(`progW${idx}_CExYt${i}`)?.value.trim() || '';
      videos.push(v); videoUrls.push(v);
    }
    w = { ...w,
      exCount: count,
      rounds: parseInt(document.getElementById(`progW${idx}_Rounds`)?.value) || 1,
      prep: parseInt(document.getElementById(`progW${idx}_CPrep`)?.value) || 0,
      action: parseInt(document.getElementById(`progW${idx}_CAction`)?.value) || 0,
      rest: parseInt(document.getElementById(`progW${idx}_CRest`)?.value) || 0,
      exercises, exerciseVideos: videos
    };
  } else {
    const count = parseInt(document.getElementById(`progW${idx}_BrainExCount`)?.value) || 1;
    const exercises = [], videos = [];
    for (let i = 0; i < count; i++) {
      exercises.push(document.getElementById(`progW${idx}_BEx${i}`)?.value.trim() || ('Exercício ' + (i + 1)));
      const v = document.getElementById(`progW${idx}_BExYt${i}`)?.value.trim() || '';
      videos.push(v); videoUrls.push(v);
    }
    w = { ...w,
      brainExCount: count,
      brainSeries: parseInt(document.getElementById(`progW${idx}_BrainSeries`)?.value) || 1,
      brainAction: parseInt(document.getElementById(`progW${idx}_BrainAction`)?.value) || 0,
      brainPrep: parseInt(document.getElementById(`progW${idx}_BrainPrep`)?.value) || 0,
      brainExercises: exercises, brainExerciseVideos: videos
    };
  }
  return { workout: w, videoUrls };
}

// ============================================================
// RESET / NOVO / EDITAR
// ============================================================
function resetForm() {
  editingId = null;
  const saveBtn = document.getElementById('progSaveBtn');
  if (saveBtn) saveBtn.textContent = 'SALVAR PROGRAMA';
  document.getElementById('progMode').value = 'normal';
  document.querySelectorAll('#progSingleFields .mode-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === 'normal'));
  document.getElementById('progName').value = '';
  document.getElementById('progObs').value = '';
  document.getElementById('progSalesLink').value = '';
  document.getElementById('progHotmartId').value = '';
  document.querySelectorAll('#progSingleFields .prog-fields').forEach(f => window.adminHide(f));
  window.adminShow(document.getElementById('progFieldsNormal'));
  document.getElementById('progNormalExCount').value = 1;
  document.getElementById('progExCount').value = 4;
  document.getElementById('progBrainExCount').value = 2;
  renderExerciseInputs('progNormalExList', 'progNfEx', 1);
  renderExerciseInputs('progCircuitExList', 'progCEx', 4);
  renderExerciseInputs('progBrainExList', 'progBEx', 2);

  document.getElementById('progMultiToggle').checked = false;
  document.getElementById('progWorkoutsList').innerHTML = '';
  _workoutIdx = 0;
  window.adminShow(document.getElementById('progSingleFields'));
  window.adminHide(document.getElementById('progWorkoutsBuilder'));
}

document.getElementById('adminProgramNewBtn')?.addEventListener('click', () => {
  resetForm();
  window.adminShow(document.getElementById('adminProgramForm'));
});

function editProgram(p) {
  editingId = p.id;
  const saveBtn = document.getElementById('progSaveBtn');
  if (saveBtn) saveBtn.textContent = 'SALVAR ALTERAÇÕES';

  document.getElementById('progName').value = p.name || '';
  document.getElementById('progObs').value = p.obs || '';
  document.getElementById('progSalesLink').value = p.salesLink || '';
  document.getElementById('progHotmartId').value = p.hotmartProductId || '';

  document.getElementById('progWorkoutsList').innerHTML = '';
  _workoutIdx = 0;

  const isMulti = Array.isArray(p.workouts) && p.workouts.length > 0;
  document.getElementById('progMultiToggle').checked = isMulti;

  if (isMulti) {
    window.adminHide(document.getElementById('progSingleFields'));
    window.adminShow(document.getElementById('progWorkoutsBuilder'));
    p.workouts.forEach(w => addWorkoutBlock(w));
  } else {
    window.adminShow(document.getElementById('progSingleFields'));
    window.adminHide(document.getElementById('progWorkoutsBuilder'));

    const mode = p.mode || 'normal';
    document.getElementById('progMode').value = mode;
    document.querySelectorAll('#progSingleFields .mode-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
    document.querySelectorAll('#progSingleFields .prog-fields').forEach(f => window.adminHide(f));
    const map = { normal: 'progFieldsNormal', circuit: 'progFieldsCircuit', brain: 'progFieldsBrain' };
    window.adminShow(document.getElementById(map[mode]));

    if (mode === 'normal') {
      const count = p.normalExCount || 1;
      document.getElementById('progNormalExCount').value = count;
      document.getElementById('progCycles').value = p.cycles ?? 3;
      document.getElementById('progPrep').value = p.prep ?? 10;
      document.getElementById('progAction').value = p.action ?? 40;
      document.getElementById('progRest').value = p.rest ?? 20;
      renderExerciseInputs('progNormalExList', 'progNfEx', count, p.normalExercises, p.normalExerciseVideos);
    } else if (mode === 'circuit') {
      const count = p.exCount || 4;
      document.getElementById('progExCount').value = count;
      document.getElementById('progRounds').value = p.rounds ?? 3;
      document.getElementById('progCPrep').value = p.prep ?? 10;
      document.getElementById('progCAction').value = p.action ?? 30;
      document.getElementById('progCRest').value = p.rest ?? 0;
      renderExerciseInputs('progCircuitExList', 'progCEx', count, p.exercises, p.exerciseVideos);
    } else {
      const count = p.brainExCount || 2;
      document.getElementById('progBrainExCount').value = count;
      document.getElementById('progBrainSeries').value = p.brainSeries ?? 3;
      document.getElementById('progBrainPrep').value = p.brainPrep ?? 15;
      document.getElementById('progBrainAction').value = p.brainAction ?? 40;
      renderExerciseInputs('progBrainExList', 'progBEx', count, p.brainExercises, p.brainExerciseVideos);
    }
  }

  window.adminShow(document.getElementById('adminProgramForm'));
  document.getElementById('adminProgramForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

document.getElementById('progCancelBtn')?.addEventListener('click', () => {
  window.adminHide(document.getElementById('adminProgramForm'));
});

// ============================================================
// SALVAR
// ============================================================
document.getElementById('progSaveBtn')?.addEventListener('click', async () => {
  const name = document.getElementById('progName').value.trim();
  if (!name) { alert('Preencha o nome do programa'); return; }
  const obs = document.getElementById('progObs').value.trim();
  const salesLink = document.getElementById('progSalesLink').value.trim();
  if (salesLink && !isValidHttpUrl(salesLink)) {
    alert('O link da página de venda parece inválido. Confira e tente de novo.');
    return;
  }
  const hotmartProductId = document.getElementById('progHotmartId').value.trim();
  const isMulti = document.getElementById('progMultiToggle').checked;

  let data = { name, obs, color: BRAVO_ORANGE, salesLink: salesLink || null, hotmartProductId: hotmartProductId || null };

  if (isMulti) {
    const blocks = [...document.querySelectorAll('#progWorkoutsList > div')];
    if (blocks.length === 0) { alert('Adicione pelo menos um treino.'); return; }
    const workouts = [];
    const allVideoUrls = [];
    for (const block of blocks) {
      const idx = block.id.replace('progWorkoutBlock', '');
      const { workout, videoUrls } = readWorkoutBlock(idx);
      if (!workout.label) workout.label = `Treino ${EX_LETTERS[workouts.length] || (workouts.length + 1)}`;
      workouts.push(workout);
      allVideoUrls.push(...videoUrls);
    }
    const invalid = allVideoUrls.some(v => v && !isValidYtUrl(v));
    if (invalid) { alert('Um dos links do YouTube parece inválido. Confira e tente de novo.'); return; }
    data = { ...data, mode: 'multi', workouts };
  } else {
    const mode = document.getElementById('progMode').value;
    let allVideoUrls = [];

    if (mode === 'normal') {
      const normalExCount = parseInt(document.getElementById('progNormalExCount').value) || 1;
      const normalExercises = [];
      const normalExerciseVideos = [];
      for (let i = 0; i < normalExCount; i++) {
        normalExercises.push(document.getElementById('progNfEx' + i)?.value.trim() || EX_LETTERS[i]);
        const v = document.getElementById('progNfExYt' + i)?.value.trim() || '';
        normalExerciseVideos.push(v);
        allVideoUrls.push(v);
      }
      data = { ...data, mode,
        cycles: parseInt(document.getElementById('progCycles').value) || 1,
        prep: parseInt(document.getElementById('progPrep').value) || 0,
        action: parseInt(document.getElementById('progAction').value) || 0,
        rest: parseInt(document.getElementById('progRest').value) || 0,
        normalExCount, normalExercises, normalExerciseVideos
      };
    } else if (mode === 'circuit') {
      const exCount = parseInt(document.getElementById('progExCount').value) || 1;
      const exercises = [];
      const exerciseVideos = [];
      for (let i = 0; i < exCount; i++) {
        exercises.push(document.getElementById('progCEx' + i)?.value.trim() || EX_LETTERS[i]);
        const v = document.getElementById('progCExYt' + i)?.value.trim() || '';
        exerciseVideos.push(v);
        allVideoUrls.push(v);
      }
      data = { ...data, mode,
        exCount,
        rounds: parseInt(document.getElementById('progRounds').value) || 1,
        prep: parseInt(document.getElementById('progCPrep').value) || 0,
        action: parseInt(document.getElementById('progCAction').value) || 0,
        rest: parseInt(document.getElementById('progCRest').value) || 0,
        exercises, exerciseVideos
      };
    } else { // brain
      const brainExCount = parseInt(document.getElementById('progBrainExCount').value) || 1;
      const brainExercises = [];
      const brainExerciseVideos = [];
      for (let i = 0; i < brainExCount; i++) {
        brainExercises.push(document.getElementById('progBEx' + i)?.value.trim() || ('Exercício ' + (i + 1)));
        const v = document.getElementById('progBExYt' + i)?.value.trim() || '';
        brainExerciseVideos.push(v);
        allVideoUrls.push(v);
      }
      data = { ...data, mode,
        brainExCount,
        brainSeries: parseInt(document.getElementById('progBrainSeries').value) || 1,
        brainAction: parseInt(document.getElementById('progBrainAction').value) || 0,
        brainPrep: parseInt(document.getElementById('progBrainPrep').value) || 0,
        brainExercises, brainExerciseVideos
      };
    }

    const invalid = allVideoUrls.some(v => v && !isValidYtUrl(v));
    if (invalid) { alert('Um dos links do YouTube parece inválido. Confira e tente de novo.'); return; }
    data = { ...data, workouts: null };
  }

  const id = editingId || ('p_' + Date.now().toString(36));
  const isNew = !editingId;
  await setDoc(doc(window._adminDb, 'programs', id), {
    ...data,
    ...(isNew ? { createdAt: Date.now(), createdBy: window._adminUid || null } : {})
  }, { merge: true });

  window.adminHide(document.getElementById('adminProgramForm'));
  _programs = null;
  renderPrograms();
});

// ============================================================
// LISTAGEM
// ============================================================
function modeLabel(mode) {
  return { normal: 'Clássico', circuit: 'Circuito', brain: 'Bravo (Cérebro)', multi: 'Múltiplos treinos' }[mode] || mode;
}

function accessBadge(access) {
  if (access === 'free') return { text: 'Livre p/ todos', color: '#2DC653' };
  if (access === 'paid') return { text: 'Bloqueado (pago)', color: 'var(--accent)' };
  return { text: 'Rascunho — ninguém vê ainda', color: 'var(--muted)' };
}

let _users = null;
let _groups = null;
async function ensureUsersGroups() {
  if (!_users) {
    const snap = await getDocs(collection(window._adminDb, 'users'));
    _users = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
  }
  if (!_groups) {
    const snap = await getDocs(collection(window._adminDb, 'groups'));
    _groups = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }
}

async function renderPrograms() {
  const list = document.getElementById('adminProgramList');
  if (!_programs) {
    list.innerHTML = '<p style="color:var(--muted);font-size:14px;">Carregando...</p>';
    const snap = await getDocs(collection(window._adminDb, 'programs'));
    _programs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }

  if (_programs.length === 0) {
    list.innerHTML = '<p style="color:var(--muted);font-size:14px;">Nenhum programa criado ainda.</p>';
    return;
  }

  await ensureUsersGroups();

  list.innerHTML = _programs.map(p => {
    const badge = accessBadge(p.access);
    const isHidden = !!p.hidden;
    const modeText = p.mode === 'multi' && Array.isArray(p.workouts)
      ? `${modeLabel(p.mode)} (${p.workouts.length})`
      : modeLabel(p.mode);
    return `
    <div style="background:var(--surface);border:1px solid var(--surface2);border-radius:12px;padding:14px 16px;margin-bottom:10px;${isHidden ? 'opacity:.7;' : ''}">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div style="font-size:15px;font-weight:600;">${escapeHtml(p.name)}</div>
        <div style="display:flex;gap:12px;">
          <button data-edit-program="${p.id}" style="background:none;border:none;color:var(--accent);font-size:13px;cursor:pointer;">Editar</button>
          <button data-dup-program="${p.id}" style="background:none;border:none;color:var(--accent);font-size:13px;cursor:pointer;">Duplicar</button>
          <button data-toggle-hidden="${p.id}" style="background:none;border:none;color:var(--muted);font-size:13px;cursor:pointer;">${isHidden ? 'Mostrar' : 'Ocultar'}</button>
          <button data-del-program="${p.id}" style="background:none;border:none;color:var(--muted);font-size:13px;cursor:pointer;">Excluir</button>
        </div>
      </div>
      <div style="color:var(--muted);font-size:13px;margin-top:4px;">${modeText}${p.obs ? ' · ' + escapeHtml(p.obs) : ''}</div>
      <div style="font-size:12px;margin-top:6px;color:${badge.color};">● ${badge.text}</div>
      <div style="font-size:12px;margin-top:4px;color:${isHidden ? 'var(--accent)' : 'var(--muted)'};">${isHidden ? '🙈 Oculto — some do menu de quem ainda não liberou, mas continua disponível pra quem já tem' : '👁 Visível no menu'}</div>
      <div style="font-size:12px;margin-top:4px;color:var(--muted);">${p.salesLink ? '🔗 Link de venda configurado' : '— Sem link de venda'}${p.hotmartProductId ? ' · 🏷 Hotmart: ' + escapeHtml(p.hotmartProductId) : ''}</div>

      <details style="margin-top:10px;">
        <summary style="font-size:13px;color:var(--accent);cursor:pointer;">Atribuir</summary>
        <div style="margin-top:10px;display:flex;flex-direction:column;gap:10px;">
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            <button class="admin-btn" data-assign-action="free" data-pid="${p.id}" style="font-size:12px;padding:8px 12px;">Todos (livre)</button>
            <button class="admin-btn" data-assign-action="paid" data-pid="${p.id}" style="font-size:12px;padding:8px 12px;background:var(--surface2);">Todos (bloqueado)</button>
          </div>
          <div style="display:flex;gap:6px;align-items:center;">
            <select class="field-input" data-assign-user-select="${p.id}" style="flex:1;">
              <option value="">Escolha um aluno...</option>
              ${_users.map(u => `<option value="${u.uid}">${escapeHtml(u.name || u.email || u.uid)}</option>`).join('')}
            </select>
            <button class="admin-btn" data-assign-action="individual" data-pid="${p.id}" style="font-size:12px;padding:8px 12px;white-space:nowrap;">Liberar</button>
          </div>
          <div style="display:flex;gap:6px;align-items:center;">
            <select class="field-input" data-assign-group-select="${p.id}" style="flex:1;">
              <option value="">Escolha um grupo...</option>
              ${_groups.map(g => `<option value="${g.id}">${escapeHtml(g.name)}</option>`).join('')}
            </select>
            <button class="admin-btn" data-assign-action="group" data-pid="${p.id}" style="font-size:12px;padding:8px 12px;white-space:nowrap;">Liberar</button>
          </div>
          <div data-assign-status="${p.id}" style="font-size:12px;color:var(--muted);min-height:16px;"></div>
        </div>
      </details>
    </div>
  `;
  }).join('');
}

document.getElementById('adminProgramList')?.addEventListener('click', async (e) => {
  const editId = e.target.dataset?.editProgram;
  if (editId) {
    const p = _programs?.find(x => x.id === editId);
    if (p) editProgram(p);
    return;
  }

  const dupId = e.target.dataset?.dupProgram;
  if (dupId) {
    const p = _programs?.find(x => x.id === dupId);
    if (!p) return;
    const { id: _oldId, createdAt: _oldCreatedAt, createdBy: _oldCreatedBy, ...rest } = p;
    const newId = 'p_' + Date.now().toString(36);
    const newData = {
      ...rest,
      name: (p.name || 'Programa') + ' (cópia)',
      // Fica oculto até você revisar a variação e decidir publicar — evita que
      // a cópia apareça pros alunos antes de você ajustar o que precisa mudar.
      hidden: true,
      createdAt: Date.now(),
      createdBy: window._adminUid || null
    };
    await setDoc(doc(window._adminDb, 'programs', newId), newData);
    _programs.push({ id: newId, ...newData });
    renderPrograms();
    return;
  }

  const toggleId = e.target.dataset?.toggleHidden;
  if (toggleId) {
    const p = _programs?.find(x => x.id === toggleId);
    if (!p) return;
    const newHidden = !p.hidden;
    await setDoc(doc(window._adminDb, 'programs', toggleId), { hidden: newHidden }, { merge: true });
    p.hidden = newHidden;
    renderPrograms();
    return;
  }

  const delId = e.target.dataset?.delProgram;
  if (delId) {
    const ok = confirm(
      'Excluir este programa apaga ele de vez, inclusive para quem já tinha liberado.\n\n' +
      'Se você só quer tirar ele do menu de quem ainda não comprou (mas manter o acesso de quem já tem), use "Ocultar" em vez de excluir.\n\n' +
      'Quer mesmo excluir?'
    );
    if (!ok) return;
    await deleteDoc(doc(window._adminDb, 'programs', delId));
    _programs = null;
    renderPrograms();
    return;
  }

  const action = e.target.dataset?.assignAction;
  const pid = e.target.dataset?.pid;
  if (!action || !pid) return;
  const statusEl = document.querySelector(`[data-assign-status="${pid}"]`);

  if (action === 'free' || action === 'paid') {
    await setDoc(doc(window._adminDb, 'programs', pid), { access: action }, { merge: true });
    const p = _programs.find(x => x.id === pid);
    if (p) p.access = action;
    if (statusEl) statusEl.textContent = action === 'free' ? 'Liberado pra todos.' : 'Marcado como bloqueado (pago) pra todos.';
    renderPrograms();
    return;
  }

  if (action === 'individual') {
    const sel = document.querySelector(`[data-assign-user-select="${pid}"]`);
    const uid = sel?.value;
    if (!uid) { if (statusEl) statusEl.textContent = 'Escolha um aluno primeiro.'; return; }
    await setDoc(doc(window._adminDb, 'unlockedPrograms', uid), { [pid]: true }, { merge: true });
    if (statusEl) statusEl.textContent = 'Liberado pra esse aluno.';
    return;
  }

  if (action === 'group') {
    const sel = document.querySelector(`[data-assign-group-select="${pid}"]`);
    const groupId = sel?.value;
    if (!groupId) { if (statusEl) statusEl.textContent = 'Escolha um grupo primeiro.'; return; }
    const members = _users.filter(u => u.groupId === groupId);
    if (members.length === 0) { if (statusEl) statusEl.textContent = 'Esse grupo não tem alunos ainda.'; return; }
    if (statusEl) statusEl.textContent = `Liberando pra ${members.length} aluno(s)...`;
    await Promise.all(members.map(u =>
      setDoc(doc(window._adminDb, 'unlockedPrograms', u.uid), { [pid]: true }, { merge: true })
    ));
    if (statusEl) statusEl.textContent = `Liberado pra ${members.length} aluno(s) do grupo.`;
    return;
  }
});

document.addEventListener('adminViewChange', (e) => {
  if (e.detail.view === 'programs') renderPrograms();
});
