// ============================================================
// ADMIN-PROGRAMS — criar e listar "Programas Bravo"
// ------------------------------------------------------------
// A estrutura de dados salva aqui é DE PROPÓSITO idêntica à de
// um preset comum do app (mesmos campos por formato: normal/
// circuit/brain). Isso é o que vai permitir, no próximo passo,
// que um programa atribuído a um aluno "vire" um preset dele
// sem precisar de nenhuma lógica de conversão.
// ============================================================
import { collection, getDocs, doc, setDoc, deleteDoc }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const EX_LETTERS = ['A','B','C','D','E','F','G','H','I','J','K','L'];
let _programs = null;
let editingId = null;

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
function renderExerciseInputs(containerId, prefix, count, existingNames, existingVideos) {
  const el = document.getElementById(containerId);
  let html = '';
  for (let i = 0; i < count; i++) {
    const nameVal = existingNames?.[i] || '';
    const videoVal = existingVideos?.[i] || '';
    html += `<div style="display:flex;gap:8px;align-items:flex-end;margin-bottom:8px;">
      <div class="field-group" style="flex:1;">
        <label class="field-label">Exercício ${EX_LETTERS[i] || (i+1)}</label>
        <input class="field-input" id="${prefix}${i}" value="${escapeHtml(nameVal)}" placeholder="Nome do exercício">
      </div>
      <div class="field-group" style="flex:1;">
        <label class="field-label">Link YouTube (opcional)</label>
        <input class="field-input" id="${prefix}Yt${i}" value="${escapeHtml(videoVal)}" placeholder="https://youtube.com/...">
      </div>
    </div>`;
  }
  el.innerHTML = html;
}

document.getElementById('progNormalExCount')?.addEventListener('input', (e) => {
  renderExerciseInputs('progNormalExList', 'progNfEx', parseInt(e.target.value) || 1);
});
document.getElementById('progExCount')?.addEventListener('input', (e) => {
  renderExerciseInputs('progCircuitExList', 'progCEx', parseInt(e.target.value) || 1);
});
document.getElementById('progBrainExCount')?.addEventListener('input', (e) => {
  renderExerciseInputs('progBrainExList', 'progBEx', parseInt(e.target.value) || 1);
});
document.querySelectorAll('#adminViewPrograms .mode-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const mode = btn.dataset.mode;
    document.querySelectorAll('#adminViewPrograms .mode-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('progMode').value = mode;

    document.querySelectorAll('.prog-fields').forEach(f => window.adminHide(f));
    const map = { normal: 'progFieldsNormal', circuit: 'progFieldsCircuit', brain: 'progFieldsBrain' };
    window.adminShow(document.getElementById(map[mode]));
  });
});

function resetForm() {
  editingId = null;
  const saveBtn = document.getElementById('progSaveBtn');
  if (saveBtn) saveBtn.textContent = 'SALVAR PROGRAMA';
  document.getElementById('progMode').value = 'normal';
  document.querySelectorAll('#adminViewPrograms .mode-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === 'normal'));
  document.getElementById('progName').value = '';
  document.getElementById('progObs').value = '';
  document.getElementById('progSalesLink').value = '';
  document.getElementById('progHotmartId').value = '';
  document.querySelectorAll('.prog-fields').forEach(f => window.adminHide(f));
  window.adminShow(document.getElementById('progFieldsNormal'));
  document.getElementById('progNormalExCount').value = 1;
  document.getElementById('progExCount').value = 4;
  document.getElementById('progBrainExCount').value = 2;
  renderExerciseInputs('progNormalExList', 'progNfEx', 1);
  renderExerciseInputs('progCircuitExList', 'progCEx', 4);
  renderExerciseInputs('progBrainExList', 'progBEx', 2);
}

document.getElementById('adminProgramNewBtn')?.addEventListener('click', () => {
  resetForm();
  window.adminShow(document.getElementById('adminProgramForm'));
});

function editProgram(p) {
  editingId = p.id;
  const saveBtn = document.getElementById('progSaveBtn');
  if (saveBtn) saveBtn.textContent = 'SALVAR ALTERAÇÕES';
  const mode = p.mode || 'normal';
  document.getElementById('progMode').value = mode;
  document.querySelectorAll('#adminViewPrograms .mode-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
  document.querySelectorAll('.prog-fields').forEach(f => window.adminHide(f));
  const map = { normal: 'progFieldsNormal', circuit: 'progFieldsCircuit', brain: 'progFieldsBrain' };
  window.adminShow(document.getElementById(map[mode]));

  document.getElementById('progName').value = p.name || '';
  document.getElementById('progObs').value = p.obs || '';
  document.getElementById('progSalesLink').value = p.salesLink || '';
  document.getElementById('progHotmartId').value = p.hotmartProductId || '';

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

  window.adminShow(document.getElementById('adminProgramForm'));
  document.getElementById('adminProgramForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

document.getElementById('progCancelBtn')?.addEventListener('click', () => {
  window.adminHide(document.getElementById('adminProgramForm'));
});

document.getElementById('progSaveBtn')?.addEventListener('click', async () => {
  const name = document.getElementById('progName').value.trim();
  if (!name) { alert('Preencha o nome do programa'); return; }
  const obs = document.getElementById('progObs').value.trim();
  const mode = document.getElementById('progMode').value;
  const salesLink = document.getElementById('progSalesLink').value.trim();
  if (salesLink && !isValidHttpUrl(salesLink)) {
    alert('O link da página de venda parece inválido. Confira e tente de novo.');
    return;
  }
  const hotmartProductId = document.getElementById('progHotmartId').value.trim();

  let data = { name, obs, mode, color: BRAVO_ORANGE, salesLink: salesLink || null, hotmartProductId: hotmartProductId || null };
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
    data = { ...data,
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
    data = { ...data,
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
      brainExercises.push(document.getElementById('progBEx' + i)?.value.trim() || ('Exercício ' + (i+1)));
      const v = document.getElementById('progBExYt' + i)?.value.trim() || '';
      brainExerciseVideos.push(v);
      allVideoUrls.push(v);
    }
    data = { ...data,
      brainExCount,
      brainSeries: parseInt(document.getElementById('progBrainSeries').value) || 1,
      brainAction: parseInt(document.getElementById('progBrainAction').value) || 0,
      brainPrep: parseInt(document.getElementById('progBrainPrep').value) || 0,
      brainExercises, brainExerciseVideos
    };
  }

  const invalid = allVideoUrls.some(v => v && !isValidYtUrl(v));
  if (invalid) { alert('Um dos links do YouTube parece inválido. Confira e tente de novo.'); return; }

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

function modeLabel(mode) {
  return { normal: 'Clássico', circuit: 'Circuito', brain: 'Bravo (Cérebro)' }[mode] || mode;
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
    return `
    <div style="background:var(--surface);border:1px solid var(--surface2);border-radius:12px;padding:14px 16px;margin-bottom:10px;">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div style="font-size:15px;font-weight:600;">${escapeHtml(p.name)}</div>
        <div style="display:flex;gap:12px;">
          <button data-edit-program="${p.id}" style="background:none;border:none;color:var(--accent);font-size:13px;cursor:pointer;">Editar</button>
          <button data-del-program="${p.id}" style="background:none;border:none;color:var(--muted);font-size:13px;cursor:pointer;">Excluir</button>
        </div>
      </div>
      <div style="color:var(--muted);font-size:13px;margin-top:4px;">${modeLabel(p.mode)}${p.obs ? ' · ' + escapeHtml(p.obs) : ''}</div>
      <div style="font-size:12px;margin-top:6px;color:${badge.color};">● ${badge.text}</div>
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

  const delId = e.target.dataset?.delProgram;
  if (delId) {
    if (!confirm('Excluir este programa? Quem já tiver ele liberado deixa de ter acesso.')) return;
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
