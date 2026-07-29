// ============================================================
// ADMIN-OFFERS — gerenciamento das indicações do Escolhas Bravo
// ------------------------------------------------------------
// Formulário simples (nome, link de afiliado, texto, vídeo do
// YouTube opcional) + lista com edição e exclusão. Mais recentes
// primeiro, sem categorias — tudo em uma página só, como pedido.
// ============================================================
import { collection, getDocs, addDoc, doc, setDoc, deleteDoc, serverTimestamp }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

let _offers = null;
let _editingId = null;

function escapeHtml(str) {
  return String(str || '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

function fmtDate(ts) {
  if (!ts) return '—';
  const ms = typeof ts.toMillis === 'function' ? ts.toMillis() : ts;
  return new Date(ms).toLocaleString('pt-BR');
}

async function ensureOffers() {
  if (_offers) return;
  const snap = await getDocs(collection(window._adminDb, 'bravoOffers'));
  _offers = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => {
      const am = a.createdAt && a.createdAt.toMillis ? a.createdAt.toMillis() : 0;
      const bm = b.createdAt && b.createdAt.toMillis ? b.createdAt.toMillis() : 0;
      return bm - am;
    });
}

function renderOffers() {
  const list = document.getElementById('adminOfferList');
  if (_offers.length === 0) {
    list.innerHTML = '<p style="color:var(--muted);font-size:14px;">Nenhuma indicação publicada ainda.</p>';
    return;
  }
  list.innerHTML = _offers.map(o => `
    <div style="background:var(--surface);border:1px solid var(--surface2);border-radius:12px;padding:16px;margin-bottom:12px;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;flex-wrap:wrap;">
        <div style="font-size:15px;font-weight:600;">${escapeHtml(o.title)}</div>
        <div style="display:flex;gap:8px;">
          <button class="admin-btn" data-edit-id="${o.id}" style="padding:6px 12px;font-size:12px;">EDITAR</button>
          <button class="admin-btn" data-delete-id="${o.id}" style="padding:6px 12px;font-size:12px;background:var(--phase-rest);">EXCLUIR</button>
        </div>
      </div>
      <div style="color:var(--muted);font-size:12px;margin:6px 0 10px;">Publicado em ${fmtDate(o.createdAt)}</div>
      ${o.text ? `<div style="font-size:14px;margin-bottom:8px;white-space:pre-wrap;">${escapeHtml(o.text)}</div>` : ''}
      <div style="font-size:13px;color:var(--muted);word-break:break-all;">${escapeHtml(o.link)}</div>
      ${o.youtubeLink ? `<div style="font-size:13px;color:var(--muted);word-break:break-all;margin-top:4px;">🎬 ${escapeHtml(o.youtubeLink)}</div>` : ''}
    </div>
  `).join('');
}

async function loadOffers() {
  const list = document.getElementById('adminOfferList');
  list.innerHTML = '<p style="color:var(--muted);font-size:14px;">Carregando...</p>';
  try {
    _offers = null;
    await ensureOffers();
    renderOffers();
  } catch (e) {
    console.warn('adminLoadOffers', e);
    list.innerHTML = '<p style="color:var(--muted);font-size:14px;">Erro ao carregar.</p>';
  }
}

function clearForm() {
  document.getElementById('offerTitle').value = '';
  document.getElementById('offerLink').value = '';
  document.getElementById('offerText').value = '';
  document.getElementById('offerYoutube').value = '';
  _editingId = null;
  document.getElementById('offerSaveBtn').textContent = 'PUBLICAR';
  document.getElementById('offerCancelEditBtn').style.display = 'none';
}

document.getElementById('offerSaveBtn')?.addEventListener('click', async () => {
  const title = document.getElementById('offerTitle').value.trim();
  const link = document.getElementById('offerLink').value.trim();
  const text = document.getElementById('offerText').value.trim();
  const youtubeLink = document.getElementById('offerYoutube').value.trim();
  const status = document.getElementById('offerStatus');

  if (!title || !link) {
    status.textContent = 'Preencha ao menos o nome do produto e o link.';
    return;
  }

  status.textContent = 'Salvando...';
  try {
    if (_editingId) {
      await setDoc(doc(window._adminDb, 'bravoOffers', _editingId),
        { title, link, text, youtubeLink }, { merge: true });
    } else {
      await addDoc(collection(window._adminDb, 'bravoOffers'), {
        title, link, text, youtubeLink, createdAt: serverTimestamp()
      });
    }
    status.textContent = 'Salvo!';
    clearForm();
    await loadOffers();
    setTimeout(() => { status.textContent = ''; }, 2000);
  } catch (e) {
    console.warn('adminSaveOffer', e);
    status.textContent = 'Erro ao salvar.';
  }
});

document.getElementById('offerCancelEditBtn')?.addEventListener('click', clearForm);

document.getElementById('adminOfferList')?.addEventListener('click', async (e) => {
  const editId = e.target.dataset?.editId;
  const deleteId = e.target.dataset?.deleteId;

  if (editId) {
    const o = _offers.find(x => x.id === editId);
    if (!o) return;
    document.getElementById('offerTitle').value = o.title || '';
    document.getElementById('offerLink').value = o.link || '';
    document.getElementById('offerText').value = o.text || '';
    document.getElementById('offerYoutube').value = o.youtubeLink || '';
    _editingId = editId;
    document.getElementById('offerSaveBtn').textContent = 'SALVAR ALTERAÇÃO';
    document.getElementById('offerCancelEditBtn').style.display = 'inline-block';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  if (deleteId) {
    if (!confirm('Excluir essa indicação? Não dá pra desfazer.')) return;
    try {
      await deleteDoc(doc(window._adminDb, 'bravoOffers', deleteId));
      if (_editingId === deleteId) clearForm();
      await loadOffers();
    } catch (err) {
      console.warn('adminDeleteOffer', err);
    }
  }
});

document.addEventListener('adminViewChange', (e) => {
  if (e.detail.view === 'offers') loadOffers();
});
