// ============================================================
// ADMIN-MESSAGES — compor e listar mensagens (todos/grupo/aluno)
// ============================================================
import { collection, getDocs, doc, setDoc, deleteDoc }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

let _users = null;
let _groups = null;
let _messages = null;

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

async function ensureUsersGroups() {
  if (!_users) {
    const snap = await getDocs(collection(window._adminDb, 'users'));
    _users = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
    document.getElementById('msgUserSelect').innerHTML =
      '<option value="">Escolha um aluno...</option>' +
      _users.map(u => `<option value="${u.uid}">${escapeHtml(u.name || u.email || u.uid)}</option>`).join('');
  }
  if (!_groups) {
    const snap = await getDocs(collection(window._adminDb, 'groups'));
    _groups = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    document.getElementById('msgGroupSelect').innerHTML =
      '<option value="">Escolha um grupo...</option>' +
      _groups.map(g => `<option value="${g.id}">${escapeHtml(g.name)}</option>`).join('');
  }
}

document.querySelectorAll('#adminViewMessages .mode-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const scope = btn.dataset.scope;
    document.querySelectorAll('#adminViewMessages .mode-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('msgScope').value = scope;
    window.adminHide(document.getElementById('msgGroupField'));
    window.adminHide(document.getElementById('msgUserField'));
    if (scope === 'group') window.adminShow(document.getElementById('msgGroupField'));
    if (scope === 'individual') window.adminShow(document.getElementById('msgUserField'));
  });
});

document.getElementById('msgSendBtn')?.addEventListener('click', async () => {
  const text = document.getElementById('msgText').value.trim();
  if (!text) { document.getElementById('msgStatus').textContent = 'Escreva uma mensagem primeiro.'; return; }
  const scope = document.getElementById('msgScope').value;

  const data = { text, scope, createdAt: Date.now(), createdBy: window._adminUid || null };

  if (scope === 'individual') {
    const uid = document.getElementById('msgUserSelect').value;
    if (!uid) { document.getElementById('msgStatus').textContent = 'Escolha um aluno.'; return; }
    data.targetUid = uid;
  } else if (scope === 'group') {
    const groupId = document.getElementById('msgGroupSelect').value;
    if (!groupId) { document.getElementById('msgStatus').textContent = 'Escolha um grupo.'; return; }
    data.targetGroupId = groupId;
  }

  const id = 'm_' + Date.now().toString(36);
  await setDoc(doc(window._adminDb, 'messages', id), data);

  document.getElementById('msgText').value = '';
  document.getElementById('msgStatus').textContent = 'Mensagem enviada.';
  _messages = null;
  renderMessages();
});

function scopeLabel(m) {
  if (m.scope === 'all') return 'Todos';
  if (m.scope === 'group') {
    const g = _groups?.find(x => x.id === m.targetGroupId);
    return 'Grupo: ' + (g ? g.name : m.targetGroupId);
  }
  if (m.scope === 'individual') {
    const u = _users?.find(x => x.uid === m.targetUid);
    return 'Aluno: ' + (u ? (u.name || u.email || u.uid) : m.targetUid);
  }
  return m.scope;
}

async function renderMessages() {
  const list = document.getElementById('adminMessageList');
  await ensureUsersGroups();
  if (!_messages) {
    list.innerHTML = '<p style="color:var(--muted);font-size:14px;">Carregando...</p>';
    const snap = await getDocs(collection(window._adminDb, 'messages'));
    _messages = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => (b.createdAt||0) - (a.createdAt||0));
  }

  if (_messages.length === 0) {
    list.innerHTML = '<p style="color:var(--muted);font-size:14px;">Nenhuma mensagem enviada ainda.</p>';
    return;
  }

  list.innerHTML = _messages.map(m => `
    <div style="background:var(--surface);border:1px solid var(--surface2);border-radius:12px;padding:14px 16px;margin-bottom:10px;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
        <div style="font-size:14px;">${escapeHtml(m.text)}</div>
        <button data-del-msg="${m.id}" style="background:none;border:none;color:var(--muted);font-size:13px;cursor:pointer;white-space:nowrap;">Excluir</button>
      </div>
      <div style="color:var(--muted);font-size:12px;margin-top:6px;">${scopeLabel(m)} · ${new Date(m.createdAt).toLocaleString('pt-BR')}</div>
    </div>
  `).join('');
}

document.getElementById('adminMessageList')?.addEventListener('click', async (e) => {
  const delId = e.target.dataset?.delMsg;
  if (delId) {
    if (!confirm('Excluir esta mensagem?')) return;
    await deleteDoc(doc(window._adminDb, 'messages', delId));
    _messages = null;
    renderMessages();
  }
});

document.addEventListener('adminViewChange', (e) => {
  if (e.detail.view === 'messages') renderMessages();
});
