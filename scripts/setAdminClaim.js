// ============================================================
// setAdminClaim.js
// ------------------------------------------------------------
// Script de USO ÚNICO (rodar localmente no seu computador,
// não faz parte do site/app). Ele marca uma conta como
// administradora do painel Bravo.
//
// COMO USAR:
// 1. No Firebase Console > Configurações do projeto > Contas
//    de serviço > "Gerar nova chave privada". Isso baixa um
//    arquivo .json — salve como serviceAccountKey.json na
//    MESMA pasta deste script. NUNCA suba esse arquivo pro
//    GitHub (ele dá acesso total ao projeto).
// 2. No terminal, dentro desta pasta:
//      npm install firebase-admin
//      node setAdminClaim.js
// 3. Repita sempre que quiser adicionar/remover um admin —
//    é só editar a lista ADMIN_EMAILS abaixo e rodar de novo.
// ============================================================

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// Preencha aqui os e-mails que devem ter acesso ao painel admin.
// "scope" prepara o terreno pra quando você adicionar alguém que
// só cuida de treinos ou só de ofertas — por enquanto, os dois
// usam 'all' (acesso total).
const ADMINS = [
  { email: 'SEU_EMAIL_AQUI@exemplo.com',    scope: 'all' }, // Fernando
  { email: 'EMAIL_DA_MARINA@exemplo.com',   scope: 'all' }, // Marina
];

async function run() {
  for (const admin_ of ADMINS) {
    try {
      const user = await admin.auth().getUserByEmail(admin_.email);
      await admin.auth().setCustomUserClaims(user.uid, { admin: true, scope: admin_.scope });
      console.log(`✅ ${admin_.email} agora é admin (scope: ${admin_.scope}), uid: ${user.uid}`);
    } catch (e) {
      console.error(`❌ Erro em ${admin_.email}:`, e.message);
      console.error('   (confira se esse e-mail já tem conta criada no app Bravo)');
    }
  }
  process.exit(0);
}

run();
