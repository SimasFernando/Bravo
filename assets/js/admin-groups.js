// ============================================================
// ADMIN-GROUPS — criar turmas e atribuir usuários a elas
// ============================================================
import { collection, getDocs, doc, setDoc, deleteDoc, updateDoc, deleteField }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

let _groups = null;
let _usersCache = null; // reaproveita se admin-users.js já carregou

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

async function fetchUsers() {
  if (_usersCache) return _usersCache;
  const snap = await getDocs(collection(window._adminDb, 'users'));
  _usersCache = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
  return _usersCache;
}

async function renderGroups() {
  const list = document.getElementById('adminGroupList');
  list.innerHTML = '<p style="color:var(--muted);font-size:14px;">Carregando...</p>';

  const [groupSnap, users] = await Promise.all([
    getDocs(collection(window._adminDb, 'groups')),
    fetchUsers()
  ]);
  _groups = groupSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  if (_groups.length === 0) {
    list.innerHTML = '<p style="color:var(--muted);font-size:14px;">Nenhum grupo criado ainda.</p>';
    return;
  }

  list.innerHTML = _groups.map(g => {
    const members = users.filter(u => u.groupId === g.id);
    return `
      <div style="background:var(--surface);border:1px solid var(--surface2);border-radius:12px;padding:14px 16px;margin-bottom:10px;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div style="font-size:15px;font-weight:600;">${escapeHtml(g.name)}</div>
          <button data-del-group="${g.id}" style="background:none;border:none;color:var(--muted);font-size:13px;cursor:pointer;">Excluir</button>
        </div>
        <div style="color:var(--muted);font-size:13px;margin-top:4px;">
          ${members.length} aluno${members.length === 1 ? '' : 's'}
        </div>
        <details style="margin-top:8px;">
          <summary style="font-size:13px;color:var(--accent);cursor:pointer;">Gerenciar alunos</summary>
          <div style="margin-top:10px;display:flex;flex-direction:column;gap:6px;">
            ${users.map(u => `
              <label style="display:flex;align-items:center;gap:8px;font-size:13px;">
                <input type="checkbox" data-assign-uid="${u.uid}" data-assign-group="${g.id}"
                  ${u.groupId === g.id ? 'checked' : ''}>
                ${escapeHtml(u.name || u.email || u.uid)}
              </label>
            `).join('')}
          </div>
        </details>
      </div>
    `;
  }).join('');
}

document.getElementById('adminGroupAddBtn')?.addEventListener('click', async () => {
  const input = document.getElementById('adminGroupName');
  const name = input.value.trim();
  if (!name) return;
  const id = 'g_' + Date.now().toString(36);
  await setDoc(doc(window._adminDb, 'groups', id), { name, createdAt: Date.now() });
  input.value = '';
  renderGroups();
});

document.getElementById('adminGroupList')?.addEventListener('click', async (e) => {
  const delId = e.target.dataset?.delGroup;
  if (delId) {
    if (!confirm('Excluir este grupo? Os alunos ficam sem turma, mas os dados deles não são apagados.')) return;
    await deleteDoc(doc(window._adminDb, 'groups', delId));
    renderGroups();
  }
});

document.getElementById('adminGroupList')?.addEventListener('change', async (e) => {
  const uid = e.target.dataset?.assignUid;
  const groupId = e.target.dataset?.assignGroup;
  if (!uid) return;
  if (e.target.checked) {
    await updateDoc(doc(window._adminDb, 'users', uid), { groupId });
  } else {
    await updateDoc(doc(window._adminDb, 'users', uid), { groupId: deleteField() });
  }
  _usersCache = null; // força recarregar pra refletir a mudança nas contagens
  renderGroups();
});

document.addEventListener('adminViewChange', (e) => {
  if (e.detail.view === 'groups') renderGroups();
});
