// ============================================================
// BRAVO-OFFERS — tela "Escolhas Bravo" (indicações de produtos)
// ------------------------------------------------------------
// Script clássico (não module), no mesmo padrão do premium-misc.js:
// usa as funções globais _fb* expostas por firebase.js e a global
// showScreen() já existente no app. Feed único, mais recentes
// primeiro — sem categorias.
// ============================================================

function escapeHtmlOffer(str) {
  return String(str || '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

// Aceita link normal, youtu.be ou /shorts/ e devolve a URL de embed.
function youtubeEmbedUrl(link) {
  if (!link) return null;
  const m = link.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{6,})/);
  return m ? `https://www.youtube.com/embed/${m[1]}` : null;
}

function renderBravoOffers(offers) {
  const list = document.getElementById('bravoOffersList');
  if (!list) return;
  if (!offers || offers.length === 0) {
    list.innerHTML = '<div class="about-body">Em breve, nossas indicações favoritas por aqui.</div>';
    return;
  }
  list.innerHTML = offers.map(o => {
    const embed = youtubeEmbedUrl(o.youtubeLink);
    return `
      <div style="background:var(--surface);border:1px solid var(--surface2);border-radius:16px;padding:18px;margin-bottom:16px;">
        <div style="font-size:16px;font-weight:700;margin-bottom:8px;">${escapeHtmlOffer(o.title)}</div>
        ${o.text ? `<div style="font-size:14px;color:var(--text);line-height:1.5;margin-bottom:14px;white-space:pre-wrap;">${escapeHtmlOffer(o.text)}</div>` : ''}
        ${embed ? `<div style="position:relative;padding-top:56.25%;border-radius:12px;overflow:hidden;margin-bottom:14px;">
          <iframe src="${embed}" style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;" allowfullscreen loading="lazy"></iframe>
        </div>` : ''}
        <a href="${o.link}" target="_blank" rel="noopener noreferrer sponsored" class="btn-save" style="display:block;text-align:center;text-decoration:none;">VER PRODUTO</a>
      </div>
    `;
  }).join('');
}

async function openBravoOffers() {
  if (typeof closeMenuForce === 'function') closeMenuForce();
  if (typeof showScreen === 'function') showScreen('bravoOffersScreen'); else showScreenById('bravoOffersScreen');
  const list = document.getElementById('bravoOffersList');
  if (list) list.innerHTML = '<div class="about-body">Carregando...</div>';
  try {
    const offers = typeof window._fbLoadBravoOffers === 'function' ? await window._fbLoadBravoOffers() : [];
    renderBravoOffers(offers);
  } catch (e) {
    console.warn('openBravoOffers', e);
    if (list) list.innerHTML = '<div class="about-body">Não foi possível carregar agora.</div>';
  }
}
