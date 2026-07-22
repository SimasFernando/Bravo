// ============================================================
// ADMIN-USERS — lista de usuários cadastrados no Bravo
// ============================================================
import { collection, getDocs }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

let _allUsers = null; // cache simples: só busca uma vez por sessão

function renderUsers(users) {
  const list = document.getElementById('adminUserList');
  const count = document.getElementById('adminUserCount');
  count.textContent = `${users.length} usuário${users.length === 1 ? '' : 's'}`;

  if (users.length === 0) {
    list.innerHTML = '<p style="color:var(--muted);font-size:14px;">Nenhum usuário encontrado.</p>';
    return;
  }

  list.innerHTML = users.map(u => `
    <div style="background:var(--surface);border:1px solid var(--surface2);border-radius:12px;padding:14px 16px;margin-bottom:10px;">
      <div style="font-size:15px;font-weight:600;">${escapeHtml(u.name || '(sem nome)')}</div>
      <div style="color:var(--muted);font-size:13px;margin-top:4px;">
        ${escapeHtml(u.phone || '—')} · ${escapeHtml(u.email || 'sem e-mail')}
        ${u.year ? ' · ' + escapeHtml(u.year) : ''}
      </div>
    </div>
  `).join('');
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

async function loadUsers() {
  if (_allUsers) { renderUsers(_allUsers); return; }
  const list = document.getElementById('adminUserList');
  list.innerHTML = '<p style="color:var(--muted);font-size:14px;">Carregando...</p>';
  try {
    const snap = await getDocs(collection(window._adminDb, 'users'));
    _allUsers = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
    renderUsers(_allUsers);
  } catch (e) {
    console.warn('adminLoadUsers', e);
    list.innerHTML = '<p style="color:var(--muted);font-size:14px;">Erro ao carregar usuários.</p>';
  }
}

document.getElementById('adminUserSearch')?.addEventListener('input', (e) => {
  if (!_allUsers) return;
  const q = e.target.value.trim().toLowerCase();
  if (!q) { renderUsers(_allUsers); return; }
  renderUsers(_allUsers.filter(u =>
    (u.name || '').toLowerCase().includes(q) ||
    (u.phone || '').toLowerCase().includes(q) ||
    (u.email || '').toLowerCase().includes(q)
  ));
});

document.addEventListener('adminViewChange', (e) => {
  if (e.detail.view === 'users') loadUsers();
});
