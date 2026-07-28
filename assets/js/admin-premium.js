// ============================================================
// ADMIN-PREMIUM — lista de candidaturas ao Programa Premium
// ============================================================
import { collection, getDocs, doc, setDoc }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

let _applications = null;
let _usersByUid = null;

// Mesmas chaves salvas em finishPremiumQuestionnaire() (premium-misc.js)
const ANSWER_LABELS = {
  comoSeSente: 'Como se sente em relação ao corpo',
  metaTresMeses: 'Meta para os próximos 3 meses',
  dataNascimento: 'Data de nascimento',
  genero: 'Gênero',
  altura: 'Altura (cm)',
  peso: 'Peso (kg)',
  lesaoOuLimitacao: 'Lesão ou limitação',
  medicacao: 'Medicação de uso contínuo',
  localTreino: 'Onde pretende treinar',
  equipamentosCasa: 'Equipamentos em casa',
  disponibilidadeComprarEquipamento: 'Disposto a comprar equipamento',
  diasPorSemana: 'Dias por semana',
  tempoMedioTreino: 'Tempo médio por treino (min)',
  infoAdicional: 'Informação adicional'
};

const STATUS_OPTIONS = ['aguardando análise', 'em contato', 'aprovado', 'recusado'];

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

function fmtDate(ts) {
  if (!ts) return '—';
  const ms = typeof ts.toMillis === 'function' ? ts.toMillis() : ts;
  return new Date(ms).toLocaleString('pt-BR');
}

async function ensureData() {
  if (!_applications) {
    const snap = await getDocs(collection(window._adminDb, 'premiumApplications'));
    _applications = snap.docs.map(d => ({ uid: d.id, ...d.data() }))
      .sort((a, b) => {
        const am = a.createdAt && a.createdAt.toMillis ? a.createdAt.toMillis() : 0;
        const bm = b.createdAt && b.createdAt.toMillis ? b.createdAt.toMillis() : 0;
        return bm - am;
      });
  }
  if (!_usersByUid) {
    const snap = await getDocs(collection(window._adminDb, 'users'));
    _usersByUid = {};
    snap.docs.forEach(d => { _usersByUid[d.id] = d.data(); });
  }
}

function renderAnswers(answers) {
  if (!answers) return '';
  return Object.keys(ANSWER_LABELS).map(key => {
    const val = answers[key];
    if (val === undefined || val === '' || val === null) return '';
    return `<div style="margin-bottom:8px;">
      <div style="color:var(--muted);font-size:12px;">${ANSWER_LABELS[key]}</div>
      <div style="font-size:14px;">${escapeHtml(val)}</div>
    </div>`;
  }).join('');
}

function renderList() {
  const list = document.getElementById('adminPremiumList');
  const count = document.getElementById('adminPremiumCount');
  count.textContent = `${_applications.length} candidatura${_applications.length === 1 ? '' : 's'}`;

  if (_applications.length === 0) {
    list.innerHTML = '<p style="color:var(--muted);font-size:14px;">Nenhuma candidatura ainda.</p>';
    return;
  }

  list.innerHTML = _applications.map(app => {
    const u = _usersByUid[app.uid] || {};
    return `
      <div style="background:var(--surface);border:1px solid var(--surface2);border-radius:12px;padding:16px;margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;flex-wrap:wrap;">
          <div>
            <div style="font-size:15px;font-weight:600;">${escapeHtml(u.name || '(sem nome)')}</div>
            <div style="color:var(--muted);font-size:13px;margin-top:2px;">
              ${escapeHtml(u.phone || '—')} · ${escapeHtml(u.email || 'sem e-mail')}
            </div>
          </div>
          <select class="field-input" data-status-uid="${app.uid}" style="width:auto;max-width:170px;">
            ${STATUS_OPTIONS.map(s => `<option value="${s}"${app.status === s ? ' selected' : ''}>${s}</option>`).join('')}
          </select>
        </div>
        <div style="color:var(--muted);font-size:12px;margin:8px 0 12px;">Enviado em ${fmtDate(app.createdAt)}</div>
        ${renderAnswers(app.answers)}
      </div>
    `;
  }).join('');
}

async function loadPremium() {
  const list = document.getElementById('adminPremiumList');
  list.innerHTML = '<p style="color:var(--muted);font-size:14px;">Carregando...</p>';
  try {
    await ensureData();
    renderList();
  } catch (e) {
    console.warn('adminLoadPremium', e);
    list.innerHTML = '<p style="color:var(--muted);font-size:14px;">Erro ao carregar candidaturas.</p>';
  }
}

document.getElementById('adminPremiumList')?.addEventListener('change', async (e) => {
  const uid = e.target.dataset?.statusUid;
  if (!uid) return;
  const newStatus = e.target.value;
  try {
    await setDoc(doc(window._adminDb, 'premiumApplications', uid), { status: newStatus }, { merge: true });
    const app = _applications.find(a => a.uid === uid);
    if (app) app.status = newStatus;
  } catch (err) {
    console.warn('adminUpdatePremiumStatus', err);
  }
});

document.addEventListener('adminViewChange', (e) => {
  if (e.detail.view === 'premium') loadPremium();
});
