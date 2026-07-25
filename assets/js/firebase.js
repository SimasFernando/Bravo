// ============================================================
// FIREBASE — inicialização e camada de sincronização
// ============================================================
import { initializeApp }           from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth, signInAnonymously, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, linkWithPopup,
         EmailAuthProvider, linkWithCredential, createUserWithEmailAndPassword, signInWithEmailAndPassword,
         sendPasswordResetEmail, signOut }
                                    from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, serverTimestamp, collection, getDocs, query, where }
                                    from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const _fbConfig = {
  apiKey:            "AIzaSyC6ZXhDAFkg7ef6hAl_YpWmG559FK84NJc",
  authDomain:        "bravotreino.firebaseapp.com",
  projectId:         "bravotreino",
  storageBucket:     "bravotreino.firebasestorage.app",
  messagingSenderId: "879643595983",
  appId:             "1:879643595983:web:efb490252a6f3c06e493ba"
};

const _fbApp  = initializeApp(_fbConfig);
const _fbAuth = getAuth(_fbApp);
const _fbDb   = getFirestore(_fbApp);

window._fbUid = null;

function _userDoc()   { return doc(_fbDb, 'users',     window._fbUid); }
function _calDoc()    { return doc(_fbDb, 'calendars', window._fbUid); }
function _presetsDoc(){ return doc(_fbDb, 'presets',   window._fbUid); }
function _premiumDoc(){ return doc(_fbDb, 'premiumApplications', window._fbUid); }

async function _fbSaveUser(data) {
  if (!window._fbUid) return;
  try { await setDoc(_userDoc(), data, { merge: true }); } catch(e) { console.warn('fbSaveUser', e); }
}
async function _fbSavePremiumApplication(answers) {
  if (!window._fbUid) return false;
  try {
    const existing = await getDoc(_premiumDoc());
    const payload = {
      uid: window._fbUid,
      updatedAt: serverTimestamp(),
      status: 'aguardando análise',
      answers
    };
    if (!existing.exists()) payload.createdAt = serverTimestamp();
    await setDoc(_premiumDoc(), payload, { merge: true });
    return true;
  } catch(e) { console.warn('fbSavePremiumApplication', e); return false; }
}
async function _fbSavePresets(arr) {
  if (!window._fbUid) return;
  try { await setDoc(_presetsDoc(), { presets: arr }); } catch(e) { console.warn('fbSavePresets', e); }
}
async function _fbSaveCalendar(arr) {
  if (!window._fbUid) return;
  try { await setDoc(_calDoc(), { records: arr }); } catch(e) { console.warn('fbSaveCalendar', e); }
}

async function _fbLoadAll() {
  try {
    const [uSnap, pSnap, cSnap] = await Promise.all([
      getDoc(_userDoc()), getDoc(_presetsDoc()), getDoc(_calDoc())
    ]);
    let needRender = false;

    if (uSnap.exists()) {
      const cloud = uSnap.data();
      const local = JSON.parse(localStorage.getItem('bravo_user') || 'null');
      if (JSON.stringify(cloud) !== JSON.stringify(local)) {
        localStorage.setItem('bravo_user', JSON.stringify(cloud));
        localStorage.setItem('bravo_reg_done', '1');
        needRender = true;
      }
    }

    if (pSnap.exists()) {
      const cloudArr = pSnap.data().presets || [];
      const localArr = JSON.parse(localStorage.getItem('nt_presets') || 'null');
      if (!localArr || cloudArr.length >= localArr.length) {
        if (JSON.stringify(cloudArr) !== JSON.stringify(localArr)) {
          localStorage.setItem('nt_presets', JSON.stringify(cloudArr));
          needRender = true;
        }
      }
    }

    if (cSnap.exists()) {
      const cloudRec = cSnap.data().records || [];
      const localRec = JSON.parse(localStorage.getItem('nt_calendar') || '[]');
      const merged = [...localRec];
      cloudRec.forEach(cr => {
        if (!merged.find(r => r.date === cr.date)) merged.push(cr);
      });
      merged.sort((a, b) => a.date.localeCompare(b.date));
      if (JSON.stringify(merged) !== JSON.stringify(localRec)) {
        localStorage.setItem('nt_calendar', JSON.stringify(merged));
        await _fbSaveCalendar(merged);
        needRender = true;
      }
    }

    if (needRender && typeof renderHome === 'function') renderHome();
  } catch(e) { console.warn('fbLoadAll', e); }
}

window._fbSaveUser     = _fbSaveUser;
window._fbSavePresets  = _fbSavePresets;
window._fbSaveCalendar = _fbSaveCalendar;
window._fbSavePremiumApplication = _fbSavePremiumApplication;

onAuthStateChanged(_fbAuth, async user => {
  if (user) {
    window._fbUid = user.uid;
    window._fbCurrentUser = user;
    window._fbIsAnonymous = user.isAnonymous;
    localStorage.setItem('bravo_fb_uid', user.uid);
    await _fbEnsureUserDoc(user);
    await _fbLoadAll();
    _fbLoadAdminPrograms();
    _fbLoadMessages();
    _updateGoogleUI(user);
  } else {
    try { await signInAnonymously(_fbAuth); } catch(e) { console.warn('fbAnonymousLogin', e); }
  }
});

// Busca o catálogo de "Programas Bravo" criados no painel admin, e quais
// deles este usuário já tem liberado (compra manual ou futuramente Hotmart).
// Programas em rascunho (sem 'access' definido) não aparecem pra ninguém.
async function _fbLoadAdminPrograms() {
  try {
    const progsSnap = await getDocs(collection(_fbDb, 'programs'));
    const catalog = progsSnap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(p => p.access === 'free' || p.access === 'paid');

    let unlocked = {};
    if (window._fbUid) {
      const unlockSnap = await getDoc(doc(_fbDb, 'unlockedPrograms', window._fbUid));
      if (unlockSnap.exists()) unlocked = unlockSnap.data();
    }

    window._adminPrograms = catalog.map(p => ({
      ...p,
      locked: p.access === 'paid' && !unlocked[p.id]
    }));
  } catch (e) {
    console.warn('fbLoadAdminPrograms', e);
    window._adminPrograms = [];
  }
  if (typeof window.renderHome === 'function') window.renderHome();
}
window._fbLoadAdminPrograms = _fbLoadAdminPrograms;

// Busca as mensagens que valem pra este usuário: as de "todos", as
// individuais dirigidas a ele, e as do grupo dele (se tiver um). Cada
// tipo precisa de uma consulta separada porque as regras de segurança
// do Firestore exigem que o filtro (where) já bata com a condição da
// regra — uma busca "solta" na coleção inteira seria negada.
async function _fbLoadMessages() {
  try {
    const uid = window._fbUid;
    if (!uid) { window._inboxMessages = []; return; }

    const userSnap = await getDoc(_userDoc());
    const groupId = userSnap.exists() ? userSnap.data().groupId : null;

    const queries = [
      getDocs(query(collection(_fbDb, 'messages'), where('scope', '==', 'all'))),
      getDocs(query(collection(_fbDb, 'messages'), where('scope', '==', 'individual'), where('targetUid', '==', uid)))
    ];
    if (groupId) {
      queries.push(getDocs(query(collection(_fbDb, 'messages'), where('scope', '==', 'group'), where('targetGroupId', '==', groupId))));
    }
    const snaps = await Promise.all(queries);

    let all = [];
    snaps.forEach(s => s.forEach(d => all.push({ id: d.id, ...d.data() })));
    const seen = new Set();
    all = all.filter(m => !seen.has(m.id) && seen.add(m.id));
    all.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    const readSnap = await getDocs(collection(_fbDb, 'users', uid, 'inboxRead'));
    const readMap = {};
    readSnap.docs.forEach(d => { readMap[d.id] = d.data(); });

    // Mensagens apagadas por este aluno não aparecem mais pra ele —
    // mas continuam existindo normalmente pros outros que a receberam.
    window._inboxMessages = all
      .filter(m => !readMap[m.id]?.dismissed)
      .map(m => ({ ...m, read: !!readMap[m.id] }));
  } catch (e) {
    console.warn('fbLoadMessages', e);
    window._inboxMessages = [];
  }
  if (typeof window.renderInboxBadge === 'function') window.renderInboxBadge();
}
window._fbLoadMessages = _fbLoadMessages;

async function _fbMarkMessageRead(messageId) {
  if (!window._fbUid) return;
  try {
    await setDoc(doc(_fbDb, 'users', window._fbUid, 'inboxRead', messageId), { readAt: Date.now() }, { merge: true });
  } catch (e) { console.warn('fbMarkMessageRead', e); }
}
window._fbMarkMessageRead = _fbMarkMessageRead;

// "Apagar" uma mensagem é pessoal: só marca como escondida pra este
// aluno (não apaga o documento original, que continua valendo pra quem
// mais recebeu). O aluno não tem permissão de apagar o original mesmo.
async function _fbDismissMessage(messageId) {
  if (!window._fbUid) return;
  try {
    await setDoc(doc(_fbDb, 'users', window._fbUid, 'inboxRead', messageId), { dismissed: true, dismissedAt: Date.now() }, { merge: true });
  } catch (e) { console.warn('fbDismissMessage', e); }
}
window._fbDismissMessage = _fbDismissMessage;

// Garante que todo usuário logado (Google ou e-mail/senha) tenha um
// registro em 'users', mesmo que nunca tenha passado pela tela de
// Cadastro. Sem isso, ele fica invisível no painel admin. Não
// sobrescreve dados já preenchidos pelo formulário de cadastro.
// Reflete localmente (sem esperar o round-trip do Firestore) os dados que
// já temos do provedor de login. Só sobrescreve campos vindos com valor —
// nunca apaga nome/telefone/ano/gênero já salvos localmente.
function _fbSyncLocalUser(patch) {
  const current = JSON.parse(localStorage.getItem('bravo_user') || 'null') || {};
  const merged = { ...current };
  Object.keys(patch).forEach(k => { if (patch[k]) merged[k] = patch[k]; });
  localStorage.setItem('bravo_user', JSON.stringify(merged));
  if (merged.name || merged.email) localStorage.setItem('bravo_reg_done', '1');
  if (typeof window.renderHome === 'function') window.renderHome();
  return merged;
}
window._fbSyncLocalUser = _fbSyncLocalUser;

async function _fbEnsureUserDoc(user) {
  if (!user || user.isAnonymous) return;
  try {
    const ref = _userDoc();
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        name: user.displayName || '',
        email: user.email || '',
        phone: '',
        createdAt: serverTimestamp()
      }, { merge: true });
    } else if (user.email && !snap.data().email) {
      await setDoc(ref, { email: user.email }, { merge: true });
    }
  } catch (e) { console.warn('fbEnsureUserDoc', e); }
}

// Busca o documento de perfil do usuário direto do Firestore — usado logo
// após um login pra decidir, com dados frescos, se falta ano/gênero.
async function _fbFetchUserProfile() {
  if (!window._fbUid) return null;
  try {
    const snap = await getDoc(_userDoc());
    return snap.exists() ? snap.data() : null;
  } catch (e) { console.warn('fbFetchUserProfile', e); return null; }
}
window._fbFetchUserProfile = _fbFetchUserProfile;

function _updateGoogleUI(user) {
  const label = document.getElementById('googleSignInLabel');
  const status = document.getElementById('googleSignInStatus');
  const btn = document.getElementById('btnGoogleSignIn');
  if (!label || !status || !btn) return;
  if (user && !user.isAnonymous) {
    label.textContent = 'Conectado: ' + (user.email || user.displayName || '');
    status.textContent = 'Seus dados estão salvos na nuvem com esta conta.';
    btn.disabled = true;
    btn.style.opacity = '.6';
  } else {
    label.textContent = 'Entrar com Google';
    status.textContent = '';
    btn.disabled = false;
    btn.style.opacity = '1';
  }
}

async function _fbGoogleSignIn() {
  const status = document.getElementById('googleSignInStatus');
  const btn = document.getElementById('btnGoogleSignIn');
  if (btn) btn.disabled = true;
  if (status) status.textContent = 'Conectando...';
  const provider = new GoogleAuthProvider();
  try {
    const currentUser = _fbAuth.currentUser;
    if (currentUser && currentUser.isAnonymous) {
      // Tenta vincular a conta Google ao usuário anônimo atual, preservando todos os dados já salvos
      try {
        const result = await linkWithPopup(currentUser, provider);
        window._fbUid = result.user.uid;
        localStorage.setItem('bravo_fb_uid', result.user.uid);
        await _fbEnsureUserDoc(result.user);
        _fbSyncLocalUser({ name: result.user.displayName || '', email: result.user.email || '' });
        if (status) status.textContent = 'Conta vinculada com sucesso!';
        _updateGoogleUI(result.user);
        showToast('Conectado com Google! Seus dados estão seguros 💪');
        return;
      } catch (linkErr) {
        // Se já existe uma conta Google com este e-mail (credential-already-in-use),
        // faz login nessa conta e migra os dados do UID anônimo para ela
        if (linkErr.code === 'auth/credential-already-in-use' || linkErr.code === 'auth/email-already-in-use') {
          const anonUid = currentUser.uid;
          const result = await signInWithPopup(_fbAuth, provider);
          await _fbMigrateAnonData(anonUid, result.user.uid);
          window._fbUid = result.user.uid;
          localStorage.setItem('bravo_fb_uid', result.user.uid);
          await _fbEnsureUserDoc(result.user);
          const cloudProfile = await _fbFetchUserProfile();
          _fbSyncLocalUser(cloudProfile || { name: result.user.displayName || '', email: result.user.email || '' });
          if (status) status.textContent = 'Conta encontrada — dados sincronizados!';
          _updateGoogleUI(result.user);
          showToast('Conectado com Google! Seus dados estão seguros 💪');
          return;
        }
        throw linkErr;
      }
    } else {
      const result = await signInWithPopup(_fbAuth, provider);
      window._fbUid = result.user.uid;
      localStorage.setItem('bravo_fb_uid', result.user.uid);
      await _fbEnsureUserDoc(result.user);
      const cloudProfile = await _fbFetchUserProfile();
      _fbSyncLocalUser(cloudProfile || { name: result.user.displayName || '', email: result.user.email || '' });
      if (status) status.textContent = 'Conectado com sucesso!';
      _updateGoogleUI(result.user);
      showToast('Conectado com Google! Seus dados estão seguros 💪');
    }
  } catch (e) {
    console.warn('fbGoogleSignIn', e);
    if (status) status.textContent = 'Não foi possível conectar. Tente novamente.';
    if (btn) btn.disabled = false;
  }
}

// Migra documentos do UID anônimo antigo para o novo UID autenticado por Google,
// fazendo merge: se o destino já tiver dados, mantém o que tiver mais informação.
async function _fbMigrateAnonData(anonUid, newUid) {
  try {
    const anonUserDoc    = doc(_fbDb, 'users',     anonUid);
    const anonPresetsDoc = doc(_fbDb, 'presets',   anonUid);
    const anonCalDoc     = doc(_fbDb, 'calendars', anonUid);
    const newUserDoc    = doc(_fbDb, 'users',     newUid);
    const newPresetsDoc = doc(_fbDb, 'presets',   newUid);
    const newCalDoc     = doc(_fbDb, 'calendars', newUid);

    const [aU, aP, aC, nU, nP, nC] = await Promise.all([
      getDoc(anonUserDoc), getDoc(anonPresetsDoc), getDoc(anonCalDoc),
      getDoc(newUserDoc),  getDoc(newPresetsDoc),  getDoc(newCalDoc)
    ]);

    if (aU.exists() && !nU.exists()) {
      await setDoc(newUserDoc, aU.data(), { merge: true });
    }
    if (aP.exists()) {
      const anonPresets = aP.data().presets || [];
      const newPresets = nP.exists() ? (nP.data().presets || []) : [];
      if (anonPresets.length > newPresets.length) {
        await setDoc(newPresetsDoc, { presets: anonPresets });
      }
    }
    if (aC.exists()) {
      const anonRec = aC.data().records || [];
      const newRec = nC.exists() ? (nC.data().records || []) : [];
      const merged = [...newRec];
      anonRec.forEach(r => { if (!merged.find(m => m.date === r.date)) merged.push(r); });
      merged.sort((a, b) => a.date.localeCompare(b.date));
      if (merged.length !== newRec.length) {
        await setDoc(newCalDoc, { records: merged });
      }
    }
  } catch (e) { console.warn('fbMigrateAnonData', e); }
}

window._fbGoogleSignIn = _fbGoogleSignIn;

// Vincula o Google à conta ATUAL (não-anônima) que já está logada — ex:
// alguém que sempre entrou por e-mail/senha e quer poder entrar com
// Google também, sem virar uma conta separada. Não mexe em dados: só
// liga os dois métodos de login ao mesmo uid.
async function _fbLinkGoogleToCurrentAccount() {
  const currentUser = _fbAuth.currentUser;
  if (!currentUser || currentUser.isAnonymous) return { ok: false, reason: 'no-user' };
  try {
    await linkWithPopup(currentUser, new GoogleAuthProvider());
    return { ok: true };
  } catch (e) {
    if (e.code === 'auth/credential-already-in-use') {
      // Já existe uma OUTRA conta Google separada com este e-mail.
      // Não mesclamos automaticamente pra não arriscar perder dados de
      // nenhuma das duas — precisa de uma migração manual deliberada.
      return { ok: false, reason: 'already-in-use' };
    }
    if (e.code === 'auth/provider-already-linked') {
      return { ok: false, reason: 'already-linked' };
    }
    console.warn('fbLinkGoogleToCurrentAccount', e);
    return { ok: false, reason: 'error' };
  }
}
window._fbLinkGoogleToCurrentAccount = _fbLinkGoogleToCurrentAccount;
window._fbSignOut = async () => { try { await signOut(_fbAuth); } catch(e) { console.warn(e); } };

// ---- LOGIN / CADASTRO POR E-MAIL E SENHA ----
// Usado no Cadastro Rápido (opcional): vincula e-mail/senha ao usuário anônimo atual,
// preservando os dados já salvos — mesmo princípio do link do Google.
async function _fbEmailSignUp(email, password) {
  try {
    const currentUser = _fbAuth.currentUser;
    if (currentUser && currentUser.isAnonymous) {
      try {
        const cred = EmailAuthProvider.credential(email, password);
        const result = await linkWithCredential(currentUser, cred);
        window._fbUid = result.user.uid;
        localStorage.setItem('bravo_fb_uid', result.user.uid);
        return { ok: true, status: 'linked' };
      } catch (linkErr) {
        if (linkErr.code === 'auth/email-already-in-use' || linkErr.code === 'auth/credential-already-in-use') {
          // Já existe uma conta com este e-mail: faz login nela e migra os dados do UID anônimo
          const anonUid = currentUser.uid;
          try {
            const result = await signInWithEmailAndPassword(_fbAuth, email, password);
            await _fbMigrateAnonData(anonUid, result.user.uid);
            window._fbUid = result.user.uid;
            localStorage.setItem('bravo_fb_uid', result.user.uid);
            return { ok: true, status: 'merged' };
          } catch (signInErr) {
            console.warn('fbEmailSignUp signIn', signInErr);
            return { ok: false, code: signInErr.code };
          }
        }
        console.warn('fbEmailSignUp link', linkErr);
        return { ok: false, code: linkErr.code };
      }
    } else {
      const result = await createUserWithEmailAndPassword(_fbAuth, email, password);
      window._fbUid = result.user.uid;
      localStorage.setItem('bravo_fb_uid', result.user.uid);
      return { ok: true, status: 'created' };
    }
  } catch (e) {
    console.warn('fbEmailSignUp', e);
    return { ok: false, code: e.code };
  }
}

// Usado na tela "Entrar": login em um aparelho novo com e-mail/senha já cadastrados.
// Se o aparelho ainda tinha um usuário anônimo com dados locais, faz a migração antes de trocar de UID.
async function _fbEmailLogin(email, password) {
  try {
    const currentUser = _fbAuth.currentUser;
    const anonUid = (currentUser && currentUser.isAnonymous) ? currentUser.uid : null;
    const result = await signInWithEmailAndPassword(_fbAuth, email, password);
    if (anonUid && anonUid !== result.user.uid) {
      await _fbMigrateAnonData(anonUid, result.user.uid);
    }
    window._fbUid = result.user.uid;
    localStorage.setItem('bravo_fb_uid', result.user.uid);
    const cloudProfile = await _fbFetchUserProfile();
    _fbSyncLocalUser(cloudProfile || { email: result.user.email || '' });
    return { ok: true };
  } catch (e) {
    console.warn('fbEmailLogin', e);
    return { ok: false, code: e.code };
  }
}

async function _fbResetPassword(email) {
  try { await sendPasswordResetEmail(_fbAuth, email); return { ok: true }; }
  catch (e) { console.warn('fbResetPassword', e); return { ok: false, code: e.code }; }
}

window._fbEmailSignUp = _fbEmailSignUp;
window._fbEmailLogin = _fbEmailLogin;
window._fbResetPassword = _fbResetPassword;
