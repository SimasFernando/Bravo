// ============================================================
// ADMIN-EXERCISES — biblioteca de exercícios (aba "Exercícios")
// ------------------------------------------------------------
// Coleção `exercises` no Firestore. Cada exercício pode pertencer
// a mais de um grupamento muscular e mais de uma modalidade —
// por isso os dois campos são arrays de IDs.
//
// Grupamentos são fixos (lista abaixo). Modalidades são dinâmicas,
// guardadas em config/modalidades como { list: [{id,label}, ...] },
// e podem ser criadas a qualquer momento aqui ou no quick-add do
// formulário de programas (admin-programs.js), que reusa o mesmo
// cache e as mesmas funções via `window.*`.
//
// window._exerciseLibrary / window._modalityList ficam disponíveis
// pra qualquer outro módulo do admin depois de chamar
// window._ensureExerciseLibrary().
// ============================================================
import { collection, getDocs, doc, getDoc, setDoc, deleteDoc }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const GRUPAMENTOS = [
  { id: 'puxar',      label: 'Puxar' },
  { id: 'inferiores', label: 'Inferiores' },
  { id: 'empurrar',   label: 'Empurrar' },
  { id: 'core',       label: 'Core' },
  { id: 'composto',   label: 'Composto' },
  { id: 'cardio',     label: 'Cardio' }
];
window._GRUPAMENTOS = GRUPAMENTOS;

const DEFAULT_MODALITIES = [
  { id: 'musculacao_aparelhos', label: 'Musculação com aparelhos' },
  { id: 'yoga',                 label: 'Yoga' },
  { id: 'flexibilidade',        label: 'Flexibilidade' },
  { id: 'mobilidade_articular', label: 'Mobilidade articular' },
  { id: 'sem_equipamento',      label: 'Sem equipamento' },
  { id: 'trx',                  label: 'TRX' },
  { id: 'sandbag',               label: 'Sandbag' }
];

let _exercises = null;   // array em cache
let _modalities = null;  // array em cache
let _loadPromise = null;
let editingExId = null;

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}
function normalizeSearch(str) {
  return String(str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}
function slugify(str) {
  return normalizeSearch(str).replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || ('mod_' + Date.now().toString(36));
}
function isValidYtUrl(url) {
  if (!url) return true;
  return /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/))([A-Za-z0-9_-]{11})/.test(url);
}

// ============================================================
// CARREGAMENTO / CACHE (compartilhado com admin-programs.js)
// ============================================================
async function ensureExerciseLibrary() {
  if (_exercises && _modalities) return;
  if (_loadPromise) return _loadPromise;

  _loadPromise = (async () => {
    const [exSnap, modSnap] = await Promise.all([
      getDocs(collection(window._adminDb, 'exercises')),
      getDoc(doc(window._adminDb, 'config', 'modalidades'))
    ]);
    _exercises = exSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    if (modSnap.exists() && Array.isArray(modSnap.data().list) && modSnap.data().list.length) {
      _modalities = modSnap.data().list;
    } else {
      _modalities = DEFAULT_MODALITIES;
      // semeia o doc na primeira vez que alguém abre o admin
      await setDoc(doc(window._adminDb, 'config', 'modalidades'), { list: _modalities }, { merge: true });
    }

    window._exerciseLibrary = _exercises;
    window._modalityList = _modalities;
  })();

  await _loadPromise;
  _loadPromise = null;
}
window._ensureExerciseLibrary = ensureExerciseLibrary;

function labelFor(list, id) {
  return list.find(x => x.id === id)?.label || id;
}

// ============================================================
// SALVAR / EXCLUIR EXERCÍCIO
// ============================================================
async function createOrUpdateExercise({ nome, youtubeUrl, grupamentos, modalidades }, editId) {
  const id = editId || ('ex_' + Date.now().toString(36));
  const isNew = !editId;
  const data = {
    nome,
    nomeBusca: normalizeSearch(nome),
    youtubeUrl: youtubeUrl || null,
    grupamentos: grupamentos || [],
    modalidades: modalidades || [],
    atualizadoEm: Date.now(),
    ...(isNew ? { criadoEm: Date.now() } : {})
  };
  await setDoc(doc(window._adminDb, 'exercises', id), data, { merge: true });

  const saved = { id, ...data };
  if (!_exercises) _exercises = [];
  const idx = _exercises.findIndex(e => e.id === id);
  if (idx >= 0) _exercises[idx] = saved; else _exercises.push(saved);
  window._exerciseLibrary = _exercises;
  return saved;
}
window._createExercise = (data) => createOrUpdateExercise(data, null);

async function deleteExercise(id) {
  await deleteDoc(doc(window._adminDb, 'exercises', id));
  if (_exercises) _exercises = _exercises.filter(e => e.id !== id);
  window._exerciseLibrary = _exercises;
}

async function addModality(label) {
  const clean = label.trim();
  if (!clean) return null;
  const id = slugify(clean);
  if (!_modalities) _modalities = [];
  const existing = _modalities.find(m => m.id === id);
  if (existing) return existing;
  const mod = { id, label: clean };
  _modalities = [..._modalities, mod];
  await setDoc(doc(window._adminDb, 'config', 'modalidades'), { list: _modalities }, { merge: true });
  window._modalityList = _modalities;
  return mod;
}
window._addModality = addModality;

// ============================================================
// CHIPS DE SELEÇÃO (reusado no form principal E no quick-add)
// ============================================================
function renderChips(containerEl, items, selectedIds, dataAttr) {
  containerEl.innerHTML = items.map(it => `
    <button type="button" class="chip${selectedIds.includes(it.id) ? ' active' : ''}" ${dataAttr}="${it.id}">${escapeHtml(it.label)}</button>
  `).join('');
}
function bindChipToggle(containerEl) {
  containerEl.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    chip.classList.toggle('active');
  });
}
function getActiveChipIds(containerEl, dataAttr) {
  return [...containerEl.querySelectorAll(`.chip.active[${dataAttr}]`)].map(c => c.getAttribute(dataAttr));
}

// ============================================================
// FORMULÁRIO PRINCIPAL (aba Exercícios)
// ============================================================
async function initMainForm() {
  await ensureExerciseLibrary();
  const groupBox = document.getElementById('exGroupChips');
  const modBox = document.getElementById('exModalityChips');
  if (groupBox && !groupBox.dataset.bound) {
    renderChips(groupBox, GRUPAMENTOS, [], 'data-group-id');
    bindChipToggle(groupBox);
    groupBox.dataset.bound = '1';
  }
  if (modBox) {
    renderChips(modBox, _modalities, [], 'data-modality-id');
    if (!modBox.dataset.bound) { bindChipToggle(modBox); modBox.dataset.bound = '1'; }
  }
}

document.getElementById('exAddModalityBtn')?.addEventListener('click', async () => {
  const input = document.getElementById('exNewModalityInput');
  const label = input.value.trim();
  if (!label) return;
  await addModality(label);
  input.value = '';
  const modBox = document.getElementById('exModalityChips');
  const active = getActiveChipIds(modBox, 'data-modality-id');
  renderChips(modBox, _modalities, active, 'data-modality-id');
  // marca a recém-criada como ativa também, já que o professor provavelmente quer usá-la agora
  const newChip = modBox.querySelector(`[data-modality-id="${slugify(label)}"]`);
  newChip?.classList.add('active');
});

function resetMainForm() {
  editingExId = null;
  document.getElementById('exSaveBtn').textContent = 'SALVAR EXERCÍCIO';
  document.getElementById('exCancelEditBtn').style.display = 'none';
  document.getElementById('exName').value = '';
  document.getElementById('exYoutube').value = '';
  const groupBox = document.getElementById('exGroupChips');
  const modBox = document.getElementById('exModalityChips');
  renderChips(groupBox, GRUPAMENTOS, [], 'data-group-id');
  renderChips(modBox, _modalities, [], 'data-modality-id');
}

document.getElementById('exCancelEditBtn')?.addEventListener('click', resetMainForm);

document.getElementById('exSaveBtn')?.addEventListener('click', async () => {
  const nome = document.getElementById('exName').value.trim();
  const status = document.getElementById('exStatus');
  if (!nome) { if (status) status.textContent = 'Digite o nome do exercício.'; return; }
  const youtubeUrl = document.getElementById('exYoutube').value.trim();
  if (youtubeUrl && !isValidYtUrl(youtubeUrl)) { if (status) status.textContent = 'O link do YouTube parece inválido.'; return; }

  const grupamentos = getActiveChipIds(document.getElementById('exGroupChips'), 'data-group-id');
  const modalidades = getActiveChipIds(document.getElementById('exModalityChips'), 'data-modality-id');

  if (status) status.textContent = 'Salvando...';
  await createOrUpdateExercise({ nome, youtubeUrl, grupamentos, modalidades }, editingExId);
  if (status) status.textContent = 'Salvo!';
  resetMainForm();
  renderExerciseList();
  setTimeout(() => { if (status) status.textContent = ''; }, 2000);
});

function editExercise(ex) {
  editingExId = ex.id;
  document.getElementById('exSaveBtn').textContent = 'SALVAR ALTERAÇÕES';
  document.getElementById('exCancelEditBtn').style.display = 'inline-block';
  document.getElementById('exName').value = ex.nome || '';
  document.getElementById('exYoutube').value = ex.youtubeUrl || '';
  renderChips(document.getElementById('exGroupChips'), GRUPAMENTOS, ex.grupamentos || [], 'data-group-id');
  renderChips(document.getElementById('exModalityChips'), _modalities, ex.modalidades || [], 'data-modality-id');
  document.getElementById('exName').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ============================================================
// LISTAGEM / BUSCA
// ============================================================
function renderExerciseList() {
  const list = document.getElementById('exLibraryList');
  const countEl = document.getElementById('exLibraryCount');
  if (!list) return;
  const term = normalizeSearch(document.getElementById('exSearchInput')?.value || '');
  const filtered = (_exercises || []).filter(ex => !term || ex.nomeBusca.includes(term));

  if (countEl) countEl.textContent = `${filtered.length} exercício(s)`;
  if (filtered.length === 0) {
    list.innerHTML = '<p style="color:var(--muted);font-size:14px;">Nenhum exercício encontrado.</p>';
    return;
  }

  list.innerHTML = filtered
    .slice().sort((a, b) => a.nome.localeCompare(b.nome))
    .map(ex => `
    <div class="ex-lib-card">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div style="font-size:15px;font-weight:600;">${escapeHtml(ex.nome)}</div>
        <div style="display:flex;gap:12px;">
          <button data-ex-edit="${ex.id}" style="background:none;border:none;color:var(--accent);font-size:13px;cursor:pointer;">Editar</button>
          <button data-ex-del="${ex.id}" style="background:none;border:none;color:var(--muted);font-size:13px;cursor:pointer;">Excluir</button>
        </div>
      </div>
      <div style="margin-top:6px;">
        ${(ex.grupamentos || []).map(id => `<span class="ex-lib-tag">${escapeHtml(labelFor(GRUPAMENTOS, id))}</span>`).join('')}
        ${(ex.modalidades || []).map(id => `<span class="ex-lib-tag">${escapeHtml(labelFor(_modalities, id))}</span>`).join('')}
      </div>
      ${ex.youtubeUrl ? `<div style="font-size:12px;color:var(--muted);margin-top:6px;">▶ vídeo cadastrado</div>` : ''}
    </div>
  `).join('');
}

document.getElementById('exSearchInput')?.addEventListener('input', renderExerciseList);

document.getElementById('exLibraryList')?.addEventListener('click', async (e) => {
  const editId = e.target.dataset?.exEdit;
  if (editId) {
    const ex = (_exercises || []).find(x => x.id === editId);
    if (ex) editExercise(ex);
    return;
  }
  const delId = e.target.dataset?.exDel;
  if (delId) {
    const ok = confirm('Excluir este exercício da biblioteca? Treinos que já usam esse nome não são afetados, só deixa de aparecer nas sugestões de busca.');
    if (!ok) return;
    await deleteExercise(delId);
    renderExerciseList();
  }
});

document.addEventListener('adminViewChange', async (e) => {
  if (e.detail.view !== 'exercicios') return;
  await initMainForm();
  renderExerciseList();
});

// ============================================================
// QUICK-ADD — usado pelo autocomplete em admin-programs.js quando
// o professor digita um exercício que ainda não existe na biblioteca
// ============================================================
function openExerciseQuickAdd(prefillName, onSaved) {
  ensureExerciseLibrary().then(() => {
    const overlay = document.createElement('div');
    overlay.className = 'ex-modal-overlay';
    overlay.innerHTML = `
      <div class="ex-modal">
        <div class="admin-logo" style="font-size:18px;margin-bottom:14px;">Novo exercício</div>
        <div class="field-group" style="margin-bottom:12px;">
          <label class="field-label">Nome</label>
          <input class="field-input" id="qaName" value="${escapeHtml(prefillName || '')}">
        </div>
        <div class="field-group" style="margin-bottom:12px;">
          <label class="field-label">Link do YouTube (opcional)</label>
          <input class="field-input" id="qaYoutube" placeholder="https://youtube.com/...">
        </div>
        <div class="field-group" style="margin-bottom:12px;">
          <label class="field-label">Grupamento muscular</label>
          <div id="qaGroupChips" class="chip-select"></div>
        </div>
        <div class="field-group" style="margin-bottom:16px;">
          <label class="field-label">Modalidade</label>
          <div id="qaModalityChips" class="chip-select"></div>
        </div>
        <button class="admin-btn" id="qaSaveBtn">SALVAR NA BIBLIOTECA</button>
        <button class="admin-btn" id="qaCancelBtn" style="background:var(--surface2);margin-top:8px;">CANCELAR</button>
        <div class="admin-status" id="qaStatus"></div>
      </div>`;
    document.body.appendChild(overlay);

    const groupBox = overlay.querySelector('#qaGroupChips');
    const modBox = overlay.querySelector('#qaModalityChips');
    renderChips(groupBox, GRUPAMENTOS, [], 'data-group-id');
    renderChips(modBox, _modalities, [], 'data-modality-id');
    bindChipToggle(groupBox);
    bindChipToggle(modBox);

    const close = () => overlay.remove();
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    overlay.querySelector('#qaCancelBtn').addEventListener('click', close);

    overlay.querySelector('#qaSaveBtn').addEventListener('click', async () => {
      const nome = overlay.querySelector('#qaName').value.trim();
      const status = overlay.querySelector('#qaStatus');
      if (!nome) { status.textContent = 'Digite o nome do exercício.'; return; }
      const youtubeUrl = overlay.querySelector('#qaYoutube').value.trim();
      if (youtubeUrl && !isValidYtUrl(youtubeUrl)) { status.textContent = 'Link do YouTube inválido.'; return; }
      const grupamentos = getActiveChipIds(groupBox, 'data-group-id');
      const modalidades = getActiveChipIds(modBox, 'data-modality-id');
      status.textContent = 'Salvando...';
      const saved = await createOrUpdateExercise({ nome, youtubeUrl, grupamentos, modalidades }, null);
      close();
      onSaved?.(saved);
    });
  });
}
window._openExerciseQuickAdd = openExerciseQuickAdd;
