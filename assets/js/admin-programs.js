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

    document.querySelectorAll('.prog-fields').forEach(f => f.classList.add('hidden'));
    const map = { normal: 'progFieldsNormal', circuit: 'progFieldsCircuit', brain: 'progFieldsBrain' };
    document.getElementById(map[mode])?.classList.remove('hidden');
  });
});

function resetForm() {
  editingId = null;
  document.getElementById('progMode').value = 'normal';
  document.querySelectorAll('#adminViewPrograms .mode-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === 'normal'));
  document.getElementById('progName').value = '';
  document.getElementById('progObs').value = '';
  document.querySelectorAll('.prog-fields').forEach(f => f.classList.add('hidden'));
  document.getElementById('progFieldsNormal').classList.remove('hidden');
  document.getElementById('progNormalExCount').value = 1;
  document.getElementById('progExCount').value = 4;
  document.getElementById('progBrainExCount').value = 2;
  renderExerciseInputs('progNormalExList', 'progNfEx', 1);
  renderExerciseInputs('progCircuitExList', 'progCEx', 4);
  renderExerciseInputs('progBrainExList', 'progBEx', 2);
}

document.getElementById('adminProgramNewBtn')?.addEventListener('click', () => {
  resetForm();
  document.getElementById('adminProgramForm').classList.remove('hidden');
});

document.getElementById('progCancelBtn')?.addEventListener('click', () => {
  document.getElementById('adminProgramForm').classList.add('hidden');
});

document.getElementById('progSaveBtn')?.addEventListener('click', async () => {
  const name = document.getElementById('progName').value.trim();
  if (!name) { alert('Preencha o nome do programa'); return; }
  const obs = document.getElementById('progObs').value.trim();
  const mode = document.getElementById('progMode').value;

  let data = { name, obs, mode, color: BRAVO_ORANGE };
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
  await setDoc(doc(window._adminDb, 'programs', id), {
    ...data,
    createdAt: Date.now(),
    createdBy: window._adminUid || null
  }, { merge: true });

  document.getElementById('adminProgramForm').classList.add('hidden');
  _programs = null;
  renderPrograms();
});

function modeLabel(mode) {
  return { normal: 'Clássico', circuit: 'Circuito', brain: 'Bravo (Cérebro)' }[mode] || mode;
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

  list.innerHTML = _programs.map(p => `
    <div style="background:var(--surface);border:1px solid var(--surface2);border-radius:12px;padding:14px 16px;margin-bottom:10px;">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div style="font-size:15px;font-weight:600;">${escapeHtml(p.name)}</div>
        <button data-del-program="${p.id}" style="background:none;border:none;color:var(--muted);font-size:13px;cursor:pointer;">Excluir</button>
      </div>
      <div style="color:var(--muted);font-size:13px;margin-top:4px;">${modeLabel(p.mode)}${p.obs ? ' · ' + escapeHtml(p.obs) : ''}</div>
    </div>
  `).join('');
}

document.getElementById('adminProgramList')?.addEventListener('click', async (e) => {
  const delId = e.target.dataset?.delProgram;
  if (delId) {
    if (!confirm('Excluir este programa? Quem já tiver ele liberado deixa de ter acesso.')) return;
    await deleteDoc(doc(window._adminDb, 'programs', delId));
    _programs = null;
    renderPrograms();
  }
});

document.addEventListener('adminViewChange', (e) => {
  if (e.detail.view === 'programs') renderPrograms();
});
