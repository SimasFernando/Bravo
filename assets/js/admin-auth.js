// ============================================================
// ADMIN-AUTH — login e verificação de permissão do painel admin
// ------------------------------------------------------------
// Separado do firebase.js do app normal de propósito: aqui não
// existe login anônimo, cadastro, nem migração de dados — só
// entrada de quem já tem conta E tem o claim "admin".
// ============================================================
import { initializeApp }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, signOut }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

// Mesmo projeto Firebase do app Bravo.
const _fbConfig = {
  apiKey:            "AIzaSyC6ZXhDAFkg7ef6hAl_YpWmG559FK84NJc",
  authDomain:        "bravotreino.firebaseapp.com",
  projectId:         "bravotreino",
  storageBucket:     "bravotreino.firebasestorage.app",
  messagingSenderId: "879643595983",
  appId:             "1:879643595983:web:efb490252a6f3c06e493ba"
};

const _adminApp  = initializeApp(_fbConfig);
const _adminAuth = getAuth(_adminApp);
window._adminDb  = getFirestore(_adminApp);

const loginScreen = document.getElementById('adminLoginScreen');
const panelScreen = document.getElementById('adminPanelScreen');
const deniedScreen = document.getElementById('adminDeniedScreen');
const loginForm    = document.getElementById('adminLoginForm');
const loginEmail   = document.getElementById('adminEmail');
const loginPassword= document.getElementById('adminPassword');
const loginStatus  = document.getElementById('adminLoginStatus');
const adminNameEl  = document.getElementById('adminName');

function showScreen(el) {
  [loginScreen, panelScreen, deniedScreen].forEach(s => s && s.classList.add('hidden'));
  el && el.classList.remove('hidden');
}

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginStatus.textContent = 'Entrando...';
  try {
    await signInWithEmailAndPassword(_adminAuth, loginEmail.value.trim(), loginPassword.value);
    // onAuthStateChanged cuida do resto (checar claim e trocar de tela)
  } catch (err) {
    loginStatus.textContent = 'E-mail ou senha inválidos.';
    console.warn('admin login error', err);
  }
});

document.getElementById('adminLogoutBtn')?.addEventListener('click', () => signOut(_adminAuth));

document.getElementById('adminGoogleBtn')?.addEventListener('click', async () => {
  loginStatus.textContent = 'Entrando...';
  try {
    await signInWithPopup(_adminAuth, new GoogleAuthProvider());
  } catch (err) {
    loginStatus.textContent = 'Não foi possível entrar com Google.';
    console.warn('admin google login error', err);
  }
});

// Antes, o botão "Voltar" da tela de acesso negado só recarregava a
// página — como a sessão continuava logada com a conta sem permissão,
// ficava preso em looping. Agora ele desloga de verdade, liberando
// pra tentar com outra conta.
document.getElementById('adminDeniedLogoutBtn')?.addEventListener('click', (e) => {
  e.preventDefault();
  signOut(_adminAuth);
});

onAuthStateChanged(_adminAuth, async (user) => {
  if (!user) {
    showScreen(loginScreen);
    loginStatus.textContent = '';
    return;
  }
  // Força atualizar o token pra pegar o claim mais recente
  // (importante logo depois de você rodar o setAdminClaim.js).
  const tokenResult = await user.getIdTokenResult(true);
  const isAdmin = tokenResult.claims.admin === true;

  if (!isAdmin) {
    showScreen(deniedScreen);
    return;
  }

  window._adminUid   = user.uid;
  window._adminScope = tokenResult.claims.scope || 'all';
  if (adminNameEl) adminNameEl.textContent = user.email;
  showScreen(panelScreen);

  document.dispatchEvent(new CustomEvent('adminReady', {
    detail: { uid: user.uid, email: user.email, scope: window._adminScope }
  }));
});
