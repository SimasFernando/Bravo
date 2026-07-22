// ============================================================
// ADMIN-NAV — alterna entre as seções do menu do painel
// ------------------------------------------------------------
// Script "clássico" de propósito (não é module): só mexe em UI,
// não depende do Firebase. Dispara o evento 'adminViewChange'
// pros scripts de cada seção (admin-users.js, etc.) carregarem
// os dados na hora que a aba é aberta, não antes.
// ============================================================
// ============================================================
// Helpers globais de visibilidade — usados por todos os scripts
// do admin (admin-auth.js, admin-programs.js, etc). Sempre mexem
// no style.display direto, nunca só na classe, pra não depender
// do CSS ter carregado/atualizado certo.
// ============================================================
window.adminShow = function(el) {
  if (!el) return;
  el.style.display = el.classList.contains('admin-screen') ? 'flex' : 'block';
  el.classList.remove('hidden');
};
window.adminHide = function(el) {
  if (!el) return;
  el.style.display = 'none';
  el.classList.add('hidden');
};

// Estado inicial: força a visibilidade certa assim que a página carrega,
// sem depender do CSS já ter sido aplicado.
document.querySelectorAll('[id^="adminView"]').forEach(el => {
  el.style.display = el.classList.contains('hidden') ? 'none' : 'block';
});

document.querySelectorAll('.admin-nav button').forEach(btn => {
  btn.addEventListener('click', () => {
    const view = btn.dataset.view;

    document.querySelectorAll('.admin-nav button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    document.querySelectorAll('[id^="adminView"]').forEach(el => window.adminHide(el));
    window.adminShow(document.getElementById('adminView' + view.charAt(0).toUpperCase() + view.slice(1)));

    document.dispatchEvent(new CustomEvent('adminViewChange', { detail: { view } }));
  });
});
