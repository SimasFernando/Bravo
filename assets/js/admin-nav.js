// ============================================================
// ADMIN-NAV — alterna entre as seções do menu do painel
// ------------------------------------------------------------
// Script "clássico" de propósito (não é module): só mexe em UI,
// não depende do Firebase. Dispara o evento 'adminViewChange'
// pros scripts de cada seção (admin-users.js, etc.) carregarem
// os dados na hora que a aba é aberta, não antes.
// ============================================================
document.querySelectorAll('.admin-nav button').forEach(btn => {
  btn.addEventListener('click', () => {
    const view = btn.dataset.view;

    document.querySelectorAll('.admin-nav button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    document.querySelectorAll('[id^="adminView"]').forEach(el => el.classList.add('hidden'));
    const target = document.getElementById('adminView' + view.charAt(0).toUpperCase() + view.slice(1));
    if (target) target.classList.remove('hidden');

    document.dispatchEvent(new CustomEvent('adminViewChange', { detail: { view } }));
  });
});
