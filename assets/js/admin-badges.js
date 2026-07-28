// ============================================================
// ADMIN-BADGES — alerta de novos cadastros (Usuários e Premium)
// ------------------------------------------------------------
// Mostra um numerozinho no botão do menu com quantos cadastros
// novos (ou candidaturas Premium novas) chegaram desde a última
// vez que este admin abriu aquela aba. O "última vez que vi"
// fica salvo no Firestore (doc adminSeen/{seu uid}), não no
// navegador — assim funciona igual em qualquer aparelho que
// você ou a Marina usem pra entrar no painel.
// ============================================================
import { doc, getDoc, setDoc, collection, getDocs }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

let _seen = null; // { usersSeenAt, premiumSeenAt } em ms

function seenRef() {
  return doc(window._adminDb, 'adminSeen', window._adminUid);
}

async function loadSeen() {
  if (_seen) return _seen;
  try {
    const snap = await getDoc(seenRef());
    _seen = snap.exists() ? snap.data() : {};
  } catch (e) {
    console.warn('adminBadges loadSeen', e);
    _seen = {};
  }
  if (!_seen.usersSeenAt) _seen.usersSeenAt = 0;
  if (!_seen.premiumSeenAt) _seen.premiumSeenAt = 0;
  return _seen;
}

function toMillis(ts) {
  if (!ts) return 0;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  return 0;
}

function setBadge(view, count) {
  const btn = document.querySelector(`.admin-nav button[data-view="${view}"]`);
  if (!btn) return;
  let badge = btn.querySelector('.admin-nav-badge');
  if (!count || count <= 0) {
    if (badge) badge.remove();
    return;
  }
  if (!badge) {
    badge = document.createElement('span');
    badge.className = 'admin-nav-badge';
    btn.appendChild(badge);
  }
  badge.textContent = count > 99 ? '99+' : String(count);
}

async function refreshBadges() {
  if (!window._adminUid) return;
  const seen = await loadSeen();
  try {
    const [usersSnap, premiumSnap] = await Promise.all([
      getDocs(collection(window._adminDb, 'users')),
      getDocs(collection(window._adminDb, 'premiumApplications'))
    ]);
    const newUsers = usersSnap.docs.filter(d => toMillis(d.data().createdAt) > seen.usersSeenAt).length;
    const newPremium = premiumSnap.docs.filter(d => toMillis(d.data().createdAt) > seen.premiumSeenAt).length;
    setBadge('users', newUsers);
    setBadge('premium', newPremium);
  } catch (e) {
    console.warn('adminBadges refresh', e);
  }
}

async function markSeen(view) {
  const field = view === 'users' ? 'usersSeenAt' : (view === 'premium' ? 'premiumSeenAt' : null);
  if (!field) return;
  const seen = await loadSeen();
  seen[field] = Date.now();
  setBadge(view, 0);
  try { await setDoc(seenRef(), seen, { merge: true }); } catch (e) { console.warn('adminBadges markSeen', e); }
}

document.addEventListener('adminReady', refreshBadges);
document.addEventListener('adminViewChange', (e) => {
  if (e.detail.view === 'users' || e.detail.view === 'premium') markSeen(e.detail.view);
});
