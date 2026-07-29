// ============================================================
// ADMIN-OFFERS — gerenciamento das indicações do Escolhas Bravo
// ------------------------------------------------------------
// Formulário (nome, link de afiliado, imagem, texto, vídeo do
// YouTube opcional) + lista com edição e exclusão. Mais recentes
// primeiro, sem categorias — tudo em uma página só.
//
// A imagem pode ser buscada automaticamente a partir do link
// (via Cloud Function fetchLinkPreview, que lê as tags Open Graph
// da página) ou colada manualmente — alguns sites bloqueiam a
// busca automática, por isso sempre dá pra colar na mão.
// ============================================================
import { collection, getDocs, addDoc, doc, setDoc, deleteDoc, serverTimestamp }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { getApp }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getFunctions, httpsCallable }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-functions.js';

const _functions = getFunctions(getApp(), 'southamerica-east1');
const _fetchLinkPreview = httpsCallable(_functions, 'fetchLinkPreview');

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

function setImagePreview(url) {
  const img = document.getElementById('offerImagePreview');
  if (url) {
    img.src = url;
    img.style.display = 'block';
  } else {
    img.removeAttribute('src');
    img.style.display = 'none';
  }
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
      <div style="display:flex;gap:12px;">
        ${o.imageUrl ? `<img src="${escapeHtml(o.imageUrl)}" style="width:64px;height:64px;object-fit:cover;border-radius:8px;flex-shrink:0;" alt="">` : ''}
        <div style="flex:1;min-width:0;">
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
      </div>
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
  document.getElementById('offerImageUrl').value = '';
  document.getElementById('offerText').value = '';
  document.getElementById('offerYoutube').value = '';
  setImagePreview(null);
  _editingId = null;
  document.getElementById('offerSaveBtn').textContent = 'PUBLICAR';
  document.getElementById('offerCancelEditBtn').style.display = 'none';
}

document.getElementById('offerFetchPreviewBtn')?.addEventListener('click', async () => {
  const link = document.getElementById('offerLink').value.trim();
  const status = document.getElementById('offerStatus');
  if (!link) {
    status.textContent = 'Cole o link antes de buscar.';
    return;
  }
  status.textContent = 'Buscando imagem e descrição do link...';
  try {
    const result = await _fetchLinkPreview({ url: link });
    const data = result.data || {};

    if (data.image) {
      document.getElementById('offerImageUrl').value = data.image;
      setImagePreview(data.image);
    }
    const titleField = document.getElementById('offerTitle');
    if (!titleField.value.trim() && data.title) titleField.value = data.title;
    const textField = document.getElementById('offerText');
    if (!textField.value.trim() && data.description) textField.value = data.description;

    status.textContent = data.image
      ? 'Encontrado — confira e ajuste se quiser.'
      : 'Não achei uma imagem nesse link. Cole a URL manualmente se tiver uma.';
  } catch (e) {
    console.warn('fetchLinkPreview', e);
    status.textContent = 'Não consegui ler esse link automaticamente. Cole a imagem manualmente.';
  }
});

document.getElementById('offerImageUrl')?.addEventListener('input', (e) => {
  setImagePreview(e.target.value.trim() || null);
});

document.getElementById('offerSaveBtn')?.addEventListener('click', async () => {
  const title = document.getElementById('offerTitle').value.trim();
  const link = document.getElementById('offerLink').value.trim();
  const imageUrl = document.getElementById('offerImageUrl').value.trim();
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
        { title, link, imageUrl, text, youtubeLink }, { merge: true });
    } else {
      await addDoc(collection(window._adminDb, 'bravoOffers'), {
        title, link, imageUrl, text, youtubeLink, createdAt: serverTimestamp()
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
    document.getElementById('offerImageUrl').value = o.imageUrl || '';
    document.getElementById('offerText').value = o.text || '';
    document.getElementById('offerYoutube').value = o.youtubeLink || '';
    setImagePreview(o.imageUrl || null);
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
