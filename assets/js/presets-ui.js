const PALETTE=[
  {hex:'#F04E23',name:'Laranja'},
  {hex:'#FFFFFF',name:'Branco'},
  {hex:'#2979FF',name:'Azul'},
  {hex:'#2DC653',name:'Verde'},
  {hex:'#B47FFF',name:'Roxo'},
  {hex:'#FF6B9D',name:'Rosa'},
];
const EX_LETTERS=['A','B','C','D','E','F'];
function escapeHtmlSafe(str){
  return String(str||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
const OBS_DEFAULTS={
  leve:'Carga leve: Usar uma carga que consiga realizar de 15 a 30 repetições dentro do tempo.',
  media:'Carga média: Usar uma carga que consiga realizar de 10 a 15 repetições dentro do tempo.',
  pesada:'Carga pesada: Usar uma carga que consiga realizar de 6 a 10 repetições dentro do tempo.',
  superpesada:'Carga super pesada: Usar uma carga que consiga realizar de 1 a 5 repetições dentro do tempo.',
};
// BRAVO_CARDS: fixed cards in 'Programas Bravo' section (not stored in presets)
const BRAVO_CARDS=[
  {id:'treinoDoDia',name:'Treino do Dia',color:'#F04E23',mode:'brain',brainExCount:5,brainSeries:3,brainAction:40,brainPrep:15,
   brainExercises:['Polichinelo','Agachamento','Flexão de braços','Barra fixa','Abdominal'],
   obs:'Descanso calculado pelo esforço. Exercícios e séries pré-definidos — o treino segue automaticamente.',_bravo:true},
];
const FACTORY_DEFAULTS=[
  {id:'leve',name:'Carga Leve',color:'#90BE6D',mode:'normal',cycles:4,prep:30,action:60,rest:40,obs:OBS_DEFAULTS.leve},
  {id:'media',name:'Carga Média',color:'#F9C74F',mode:'normal',cycles:4,prep:30,action:45,rest:60,obs:OBS_DEFAULTS.media},
  {id:'pesada',name:'Carga Pesada',color:'#F4845F',mode:'normal',cycles:4,prep:30,action:40,rest:120,obs:OBS_DEFAULTS.pesada},
  {id:'superpesada',name:'Carga Super Pesada',color:'#E63946',mode:'normal',cycles:4,prep:30,action:15,rest:300,obs:OBS_DEFAULTS.superpesada},
  {id:'circuito',name:'Circuito',color:'#4CC9F0',mode:'circuit',rounds:3,exCount:3,prep:30,action:30,rest:15,
   exercises:['Exercício A','Exercício B','Exercício C'],
   obs:'Circuito 3 rodadas · A → B → C · 30s execução · 15s intervalo · Preparação a cada rodada.'},
];

function loadPresets(){
  const VER='bravo-v5';
  if(localStorage.getItem('nt_ver')!==VER){localStorage.removeItem('nt_presets');localStorage.setItem('nt_ver',VER);}
  const s=localStorage.getItem('nt_presets');
  return s?JSON.parse(s):JSON.parse(JSON.stringify(FACTORY_DEFAULTS));
}
function savePresets(p){localStorage.setItem('nt_presets',JSON.stringify(p));if(window._fbSavePresets)window._fbSavePresets(p);}

let presets=loadPresets(),selectedId=null,editingId=null,editMode='normal',editColor=PALETTE[0].hex;
let autoModeSelected=true; // auto mode pre-selected by default

let cfg=JSON.parse(localStorage.getItem('nt_cfg')||'{}');
cfg={sound:true,vibrate:true,...cfg};
function saveCfg(){localStorage.setItem('nt_cfg',JSON.stringify(cfg));}

const toggleSound=document.getElementById('toggleSound');
const toggleVibrate=document.getElementById('toggleVibrate');
toggleSound.classList.toggle('on',cfg.sound);
toggleVibrate.classList.toggle('on',cfg.vibrate);
toggleSound.onclick=()=>{cfg.sound=!cfg.sound;toggleSound.classList.toggle('on',cfg.sound);saveCfg();};
toggleVibrate.onclick=()=>{cfg.vibrate=!cfg.vibrate;toggleVibrate.classList.toggle('on',cfg.vibrate);saveCfg();};

document.getElementById('btnLinkGoogle')?.addEventListener('click', async ()=>{
  if(!window._fbLinkGoogleToCurrentAccount)return;
  const result=await window._fbLinkGoogleToCurrentAccount();
  if(result.ok){
    showToast('Google vinculado! Agora você pode entrar por e-mail ou Google.');
    document.getElementById('btnLinkGoogle').style.display='none';
  } else if(result.reason==='already-in-use'){
    alert('Esse Google já está sendo usado em outra conta separada. Fale com seu professor pra unificar.');
  } else if(result.reason==='already-linked'){
    showToast('O Google já está vinculado a esta conta.');
    document.getElementById('btnLinkGoogle').style.display='none';
  } else {
    showToast('Não foi possível vincular agora. Tente de novo.');
  }
});

document.getElementById('btnSignOut')?.addEventListener('click', async ()=>{
  if(!confirm('Sair da conta? Você pode entrar de novo a qualquer momento com o mesmo e-mail/Google.'))return;
  if(window._fbSignOut) await window._fbSignOut();
  // Limpa os dados desta conta guardados no aparelho — sem isso, o nome,
  // calendário e treinos da conta anterior continuavam aparecendo mesmo
  // depois de deslogar. Preferências do aparelho (som/vibração) ficam.
  ['bravo_user','bravo_fb_uid','nt_calendar','nt_presets',
   'bravo_premium_pending','bravo_reg_done','bravo_reg_snoozed','bravo_workout_count']
    .forEach(k=>localStorage.removeItem(k));
  location.reload(); // garante que o app recarrega do zero, sem misturar dados da conta anterior
});
// Settings now opened via menu drawer
function closeSettings(){document.getElementById('settingsModal').classList.remove('open');}
document.getElementById('settingsModal').onclick=e=>{if(e.target.id==='settingsModal')closeSettings();};

function buildColorPicker(selHex){
  const picker=document.getElementById('colorPicker');picker.innerHTML='';
  PALETTE.forEach(c=>{
    const sw=document.createElement('button');
    sw.className='color-swatch'+(c.hex===selHex?' selected':'');
    sw.style.background=c.hex;sw.title=c.name;
    sw.onclick=()=>{editColor=c.hex;picker.querySelectorAll('.color-swatch').forEach(s=>s.classList.remove('selected'));sw.classList.add('selected');};
    picker.appendChild(sw);
  });
}

let AC=null;
function getAC(){if(!AC)AC=new(window.AudioContext||window.webkitAudioContext)();return AC;}
function beep(freq=880,dur=0.1,vol=0.5,type='sine',delay=0){
  if(!cfg.sound)return;
  const ac=getAC(),t=ac.currentTime+delay;
  const osc=ac.createOscillator(),g=ac.createGain();
  osc.connect(g);g.connect(ac.destination);osc.type=type;osc.frequency.value=freq;
  g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(vol,t+0.01);g.gain.exponentialRampToValueAtTime(0.001,t+dur);
  osc.start(t);osc.stop(t+dur+0.05);
}
function speak(text){if(!cfg.sound||!window.speechSynthesis)return;const u=new SpeechSynthesisUtterance(text);u.lang='pt-BR';u.rate=0.95;u.pitch=1.1;speechSynthesis.cancel();speechSynthesis.speak(u);}
function beepCountdown(){beep(600,.12,.4,'square',0);beep(750,.12,.5,'square',.4);beep(950,.2,.7,'square',.8);}
function vibrate(p=[100]){if(cfg.vibrate)navigator.vibrate?.(p);}

function fmtSec(s){return s>=60?`${Math.floor(s/60)}m${s%60?s%60+'s':''}`:`${s}s`;}
function fmtMs(ms){const s=Math.round(ms/1000);return s>=60?`${Math.floor(s/60)}m${s%60?String(s%60).padStart(2,'0')+'s':''}`:`${s}s`;}
function isLight(hex){const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);return(r*299+g*587+b*114)/1000>140;}

function hexToRgb(hex){
  const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);
  return `${r},${g},${b}`;
}
function toggleFav(id){
  const p=presets.find(x=>x.id===id);
  if(!p)return;
  p.fav=!p.fav;
  // Reordena: favoritos no topo, mantendo ordem relativa
  presets.sort((a,b)=>(b.fav?1:0)-(a.fav?1:0));
  savePresets(presets);
  renderHome();
}

// Data for Treino do Dia bravo card (used when selected)
const BRAVO_MARCADO={id:'_bravoMarcado',name:'Treino do Dia',color:'#F04E23',mode:'brain',
  brainExCount:5,brainSeries:3,brainAction:40,brainPrep:15,
  brainExercises:['Polichinelo','Agachamento','Flexão de braços','Barra fixa','Abdominal'],_bravo:true};

function selectBravoMarcado(){
  selectedId='_bravoMarcado';autoModeSelected=false;
  document.getElementById('autoCard').classList.remove('selected');
  renderHome();
}

function duplicatePreset(id){
  // Find source: could be in presets, be the bravo marcado, or an admin program
  let src=presets.find(p=>p.id===id);
  if(!src && id==='_bravoMarcado') src=BRAVO_MARCADO;
  if(!src && id.startsWith('_admin_')){
    const adminId=id.slice('_admin_'.length);
    src=(window._adminPrograms||[]).find(p=>p.id===adminId);
  }
  if(!src)return;
  const copy=JSON.parse(JSON.stringify(src));
  copy.id='p'+Date.now();
  copy._bravo=false;
  copy.name=src.name+' (cópia)';
  copy.fav=false;
  presets.push(copy);
  savePresets(presets);
  selectedId=copy.id;autoModeSelected=false;
  renderHome();
}

function renderHome(){
  // Welcome name
  const userData=JSON.parse(localStorage.getItem('bravo_user')||'null');
  const welcome=document.getElementById('homeWelcome');
  const welcomeBlock=document.getElementById('homeWelcomeBlock');
  const welcomeGreeting=document.getElementById('homeWelcomeGreeting');
  const welcomeName=document.getElementById('homeWelcomeName');
  const welcomeNameWrap=document.getElementById('homeWelcomeNameWrap');
  if(userData?.name?.trim()){
    if(welcome){welcome.style.display='block';welcome.textContent='Bem-vindo, '+userData.name.trim();}
    if(welcomeBlock)welcomeBlock.style.display='block';
    if(welcomeGreeting)welcomeGreeting.textContent=(userData.gender==='F')?'Bem-vinda':'Bem-vindo';
    if(welcomeName)welcomeName.textContent=userData.name.trim();
    if(welcomeNameWrap)welcomeNameWrap.style.display='inline';
  } else {
    if(welcome)welcome.style.display='none';
    // Sem nome cadastrado: mostra saudação genérica em vez de esconder
    if(welcomeBlock)welcomeBlock.style.display='block';
    if(welcomeGreeting)welcomeGreeting.textContent='Bem-vindo!';
    if(welcomeNameWrap)welcomeNameWrap.style.display='none';
  }

  // Render Programas Bravo dinamicamente (com drag & drop)
  const bravoList=document.getElementById('presetList');
  bravoList.innerHTML='';
  const bravoOrder=loadBravoOrder();
  // All bravo cards: Bravo Play (auto) + BRAVO_CARDS entries
  const allBravoCards=[
    {id:'_autoMode',name:'Bravo Play',color:'#F04E23'},
    ...BRAVO_CARDS.map(c=>({id:'_bravo_'+c.id,name:c.name,color:c.color,_data:c}))
  ];
  // Sort by persisted order
  allBravoCards.sort((a,b)=>{
    const ia=bravoOrder.indexOf(a.id),ib=bravoOrder.indexOf(b.id);
    if(ia===-1&&ib===-1)return 0;
    if(ia===-1)return 1;
    if(ib===-1)return -1;
    return ia-ib;
  });
  allBravoCards.forEach(bc=>{
    const isAuto=bc.id==='_autoMode';
    const cardSel=isAuto?(autoModeSelected&&!selectedId):(selectedId==='_bravoMarcado');
    const bCard=document.createElement('div');
    bCard.className='preset-card'+(cardSel?' selected':'');
    bCard.style.setProperty('--c',bc.color);
    bCard.style.setProperty('--cr',hexToRgb(bc.color));
    bCard.dataset.bravoId=bc.id;
    if(isAuto){
      bCard.id='autoCard';
      bCard.innerHTML=`
        <div class="card-color-band"></div>
        <div class="card-collapsed-row">
          <div class="drag-handle" title="Arrastar para reordenar">⠿</div>
          <div class="card-collapsed-name">Bravo Play</div>
          <div class="card-collapsed-meta"><img class="meta-icon" src="ic_play.png?v=202506" alt="">SIGA SEU TREINO</div>
        </div>
        <div class="card-expanded">
          <div class="card-exp-badge"><img class="meta-icon" src="ic_play.png?v=202506" alt="">BRAVO PLAY</div>
          <div class="card-exp-name">Siga seu treino</div>
          <div class="card-exp-pills">
            <div class="card-exp-pill-row">
              <div class="card-exp-pill">Descanso inteligente</div>
              <div class="card-exp-pill">Sem distrações</div>
            </div>
          </div>
          <div class="card-exp-obs">Descanso calculado pelo esforço. Siga no seu ritmo.</div>
        </div>`;
      bCard.addEventListener('click',e=>{if(e.target.closest('.drag-handle'))return;selectAutoMode();});
    } else {
      const d=bc._data;
      bCard.id='bravoMarcadoCard';
      bCard.innerHTML=`
        <div class="card-color-band"></div>
        <div class="card-collapsed-row">
          <div class="drag-handle" title="Arrastar para reordenar">⠿</div>
          <div class="card-collapsed-name">${d.name}</div>
          <div class="card-collapsed-meta"><img class="meta-icon" src="ic_noexe.png?v=202506" alt="">${d.brainExCount} ex<span class="meta-sep">·</span><img class="meta-icon" src="ic_noseries.png?v=202506" alt="">${d.brainSeries} sér</div>
        </div>
        <div class="card-expanded">
          <div class="card-exp-badge"><img class="meta-icon" src="ic_play.png?v=202506" alt="">BRAVO</div>
          <div class="card-exp-name">Treino do Dia</div>
          <div class="card-exp-pills">
            <div class="card-exp-pill-row">
              <div class="card-exp-pill"><img class="pill-icon" src="ic_noexe.png?v=202506" alt="">${d.brainExCount} ex</div>
              <div class="card-exp-pill"><img class="pill-icon" src="ic_noseries.png?v=202506" alt="">${d.brainSeries} séries</div>
            </div>
            <div class="card-exp-pill-row">
              <div class="card-exp-pill"><img class="pill-icon" src="ic_preparacao.png?v=202506" alt="">${fmtSec(d.brainPrep||15)} prep</div>
              <div class="card-exp-pill"><img class="pill-icon" src="ic_execucao.png?v=202506" alt="">${fmtSec(d.brainAction)} exec</div>
            </div>
          </div>
          <div class="card-exp-obs">${d.obs||''}</div>
        </div>
        <div class="card-exp-actions">
          <button class="btn-dup" data-dup="_bravoMarcado" title="Copiar para Meus Programas">⧉</button>
        </div>`;
      bCard.addEventListener('click',e=>{
        if(e.target.closest('.drag-handle'))return;
        if(e.target.dataset.dup){duplicatePreset(e.target.dataset.dup);return;}
        selectBravoMarcado();
      });
    }
    bravoList.appendChild(bCard);
  });

  // ---- Programas Bravo criados no painel admin (professor) ----
  // Caminho separado de propósito: não entra no sistema de arrastar/
  // reordenar nem no de seleção pra treinar direto — o aluno só pode
  // copiar pra "Meus Programas" e treinar por lá, igual sempre fez.
  (window._adminPrograms || []).forEach(ap => {
    const exCount = ap.mode === 'circuit' ? ap.exCount : (ap.mode === 'brain' ? ap.brainExCount : ap.normalExCount);
    const secondaryLabel = ap.mode === 'circuit' ? 'rounds' : 'séries';
    const secondaryVal = ap.mode === 'circuit' ? ap.rounds : (ap.mode === 'brain' ? ap.brainSeries : ap.cycles);
    const modeBadge = { normal: 'CLÁSSICO', circuit: 'CIRCUITO', brain: 'BRAVO' }[ap.mode] || '';

    const aCard = document.createElement('div');
    aCard.className = 'preset-card';
    aCard.style.setProperty('--c', ap.locked ? '#666' : (ap.color || '#F04E23'));
    aCard.style.setProperty('--cr', hexToRgb(ap.locked ? '#666' : (ap.color || '#F04E23')));
    aCard.innerHTML = `
      <div class="card-color-band"></div>
      <div class="card-collapsed-row">
        <div class="card-collapsed-name">${ap.locked ? '🔒 ' : ''}${escapeHtmlSafe(ap.name)}</div>
        <div class="card-collapsed-meta"><img class="meta-icon" src="ic_noexe.png?v=202506" alt="">${exCount||0} ex<span class="meta-sep">·</span><img class="meta-icon" src="ic_noseries.png?v=202506" alt="">${secondaryVal||0} ${secondaryLabel}</div>
      </div>
      <div class="card-expanded">
        <div class="card-exp-badge"><img class="meta-icon" src="ic_play.png?v=202506" alt="">${modeBadge}</div>
        <div class="card-exp-name">${escapeHtmlSafe(ap.name)}</div>
        <div class="card-exp-obs">${ap.locked ? 'Programa bloqueado. Fale com seu professor para liberar.' : (ap.obs||'')}</div>
      </div>
      ${ap.locked ? '' : `<div class="card-exp-actions"><button class="btn-dup" data-admin-dup="${ap.id}" title="Copiar para Meus Programas">⧉</button></div>`}
    `;
    aCard.addEventListener('click', e => {
      if (ap.locked) { if (typeof showToast === 'function') showToast('Programa bloqueado. Fale com seu professor.'); return; }
      if (e.target.dataset.adminDup) { duplicatePreset('_admin_' + e.target.dataset.adminDup); return; }
      aCard.classList.toggle('selected');
    });
    bravoList.appendChild(aCard);
  });

  const list=document.getElementById('userPresetList');list.innerHTML='';
  const userEmpty=document.getElementById('userPresetEmpty');
  // Favoritos primeiro
  const sorted=[...presets.filter(p=>p.fav),...presets.filter(p=>!p.fav)];
  sorted.forEach(p=>{
    const c=p.color||PALETTE[0].hex;
    const card=document.createElement('div');
    const isSelected = p.id === selectedId;
    card.className='preset-card'+(isSelected?' selected':'');
    card.style.setProperty('--c',c);
    card.style.setProperty('--cr',hexToRgb(c));

    let collapsedMeta='';
    if(p.mode==='circuit') collapsedMeta=`<img class="meta-icon" src="ic_noexe.png?v=202506" alt="">${p.exCount} ex<span class="meta-sep">·</span><img class="meta-icon" src="ic_norodadas.png?v=202506" alt="">${p.rounds} rod`;
    else if(p.mode==='brain') collapsedMeta=`<img class="meta-icon" src="ic_noexe.png?v=202506" alt="">${p.brainExCount||2} ex<span class="meta-sep">·</span><img class="meta-icon" src="ic_noseries.png?v=202506" alt="">${p.brainSeries||3} sér`;
    else collapsedMeta=`<img class="meta-icon" src="ic_noexe.png?v=202506" alt="">${p.normalExCount||1} ex<span class="meta-sep">·</span><img class="meta-icon" src="ic_noseries.png?v=202506" alt="">${p.cycles} sér`;

    let badge='';
    if(p.mode==='circuit') badge='🔄 CIRCUITO';
    else if(p.mode==='brain') badge=`<img class="meta-icon" src="ic_play.png?v=202506" alt="">BRAVO`;
    else badge='⏱ CLÁSSICO';

    let pills='';
    if(p.mode==='circuit'){
      pills=`<div class="card-exp-pill-row">
               <div class="card-exp-pill"><img class="pill-icon" src="ic_noexe.png?v=202506" alt="">${p.exCount} ex</div>
               <div class="card-exp-pill"><img class="pill-icon" src="ic_norodadas.png?v=202506" alt="">${p.rounds} rodadas</div>
             </div>
             <div class="card-exp-pill-row">
               <div class="card-exp-pill"><img class="pill-icon" src="ic_preparacao.png?v=202506" alt="">${fmtSec(p.prep)} prep</div>
               <div class="card-exp-pill"><img class="pill-icon" src="ic_execucao.png?v=202506" alt="">${fmtSec(p.action)} exec</div>
               <div class="card-exp-pill"><img class="pill-icon" src="ic_recuperacao.png?v=202506" alt="">${fmtSec(p.rest)} desc</div>
             </div>`;
    } else if(p.mode==='brain'){
      pills=`<div class="card-exp-pill-row">
               <div class="card-exp-pill"><img class="pill-icon" src="ic_noexe.png?v=202506" alt="">${p.brainExCount||2} ex</div>
               <div class="card-exp-pill"><img class="pill-icon" src="ic_noseries.png?v=202506" alt="">${p.brainSeries||3} séries</div>
             </div>
             <div class="card-exp-pill-row">
               <div class="card-exp-pill"><img class="pill-icon" src="ic_preparacao.png?v=202506" alt="">${fmtSec(p.brainPrep||15)} prep</div>
               <div class="card-exp-pill"><img class="pill-icon" src="ic_execucao.png?v=202506" alt="">${fmtSec(p.brainAction||40)} exec</div>
             </div>`;
    } else {
      pills=`<div class="card-exp-pill-row">
               <div class="card-exp-pill"><img class="pill-icon" src="ic_noexe.png?v=202506" alt="">${p.normalExCount||1} ex</div>
               <div class="card-exp-pill"><img class="pill-icon" src="ic_noseries.png?v=202506" alt="">${p.cycles} séries</div>
             </div>
             <div class="card-exp-pill-row">
               <div class="card-exp-pill"><img class="pill-icon" src="ic_preparacao.png?v=202506" alt="">${fmtSec(p.prep)} prep</div>
               <div class="card-exp-pill"><img class="pill-icon" src="ic_execucao.png?v=202506" alt="">${fmtSec(p.action)} exec</div>
               <div class="card-exp-pill"><img class="pill-icon" src="ic_recuperacao.png?v=202506" alt="">${fmtSec(p.rest)} desc</div>
             </div>`;
    }

    const obsHTML=p.obs?`<div class="card-exp-obs">${p.obs}</div>`:'';
    const favActive=p.fav?'active':'';
    // brain mode in Meus Programas: show duplicate instead of edit
    // All presets in Meus Programas are editable (including brain copies)
    const actionsHTML=`<button class="btn-fav ${favActive}" data-fav="${p.id}" title="Favorito">★</button>
         <button class="btn-edit" data-edit="${p.id}" title="Editar">✏</button>`;

    card.dataset.id=p.id;
    card.innerHTML=`
      <div class="card-color-band"></div>
      <div class="card-collapsed-row">
        <div class="drag-handle" title="Arrastar para reordenar">⠿</div>
        <div class="card-collapsed-name">${p.name}</div>
        <div class="card-collapsed-meta">${collapsedMeta}</div>
      </div>
      <div class="card-expanded">
        <div class="card-exp-badge">${badge}</div>
        <div class="card-exp-name">${p.name}</div>
        <div class="card-exp-pills">${pills}</div>
        ${obsHTML}
      </div>
      <div class="card-exp-actions">
        ${actionsHTML}
      </div>`;
    card.addEventListener('click',e=>{
      if(e.target.dataset.fav){toggleFav(e.target.dataset.fav);return;}
      if(e.target.dataset.edit){openEdit(e.target.dataset.edit);return;}
      if(e.target.dataset.dup){duplicatePreset(e.target.dataset.dup);return;}
      if(e.target.closest('.drag-handle'))return;
      selectedId=p.id;autoModeSelected=false;
      document.getElementById('autoCard').classList.remove('selected');
      renderHome();
    });
    list.appendChild(card);
  });
  if(userEmpty) userEmpty.style.display=presets.length===0?'block':'none';
  initDragDrop();
  initDragDropBravo();

  // Inject btn-treinar into the currently selected card
  injectTreinarBtn();
}

// ---- BRAVO CARDS ORDER ----
function loadBravoOrder(){
  const s=localStorage.getItem('bravo_cards_order');
  return s?JSON.parse(s):['_autoMode','_bravo_treinoDoDia'];
}
function saveBravoOrder(order){localStorage.setItem('bravo_cards_order',JSON.stringify(order));}

// ---- DRAG & DROP GENÉRICO PARA CARDS ----
function initCardDragDrop(listEl,onDone){
  let dragging=null,ghost=null,activePointerId=null,offsetY=0;
  listEl.addEventListener('pointerdown',e=>{
    const handle=e.target.closest('.drag-handle');
    if(!handle)return;
    const card=handle.closest('.preset-card');
    if(!card)return;
    e.preventDefault();
    dragging=card;activePointerId=e.pointerId;
    listEl.setPointerCapture(e.pointerId);
    const rect=card.getBoundingClientRect();
    offsetY=e.clientY-rect.top;
    card.style.opacity='0.3';
    const cardColor=card.style.getPropertyValue('--c')||'#555';
    ghost=document.createElement('div');
    ghost.innerHTML=card.innerHTML;
    ghost.style.cssText=`position:fixed;left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px;pointer-events:none;z-index:9999;overflow:hidden;border-radius:var(--radius);background:var(--surface);border:2px solid ${cardColor};box-shadow:0 8px 32px rgba(0,0,0,.6);padding:14px 18px 14px 22px;box-sizing:border-box;`;
    const bar=document.createElement('div');
    bar.style.cssText=`position:absolute;left:0;top:0;bottom:0;width:4px;background:${cardColor};border-radius:4px 0 0 4px;`;
    ghost.appendChild(bar);
    document.body.appendChild(ghost);
  });
  listEl.addEventListener('pointermove',e=>{
    if(!dragging||e.pointerId!==activePointerId)return;
    e.preventDefault();
    ghost.style.top=e.clientY-offsetY+'px';
    const cards=[...listEl.querySelectorAll('.preset-card')].filter(c=>c!==dragging);
    let target=null;
    for(const c of cards){const r=c.getBoundingClientRect();if(e.clientY<r.top+r.height/2){target=c;break;}}
    if(target)listEl.insertBefore(dragging,target);
    else listEl.appendChild(dragging);
  });
  const finishDrag=e=>{
    if(!dragging||e.pointerId!==activePointerId)return;
    dragging.style.opacity='';
    ghost?.remove();ghost=null;
    onDone(listEl);
    dragging=null;activePointerId=null;
  };
  listEl.addEventListener('pointerup',finishDrag);
  listEl.addEventListener('pointercancel',finishDrag);
}
function initDragDropBravo(){
  initCardDragDrop(document.getElementById('presetList'),list=>{
    const newOrder=[...list.querySelectorAll('.preset-card')].map(c=>c.dataset.bravoId);
    saveBravoOrder(newOrder);
  });
}

// ---- EXERCISE DRAG & DROP (edit screen) ----
function relabelExRows(container,field){
  const rows=[...container.querySelectorAll('.exercise-row')];
  rows.forEach((row,i)=>{
    // Update letter display
    const letterEl=row.querySelector('.exercise-letter');
    if(letterEl) letterEl.textContent=EX_LETTERS[i]||String(i+1);
    // Re-ID input
    const inp=row.querySelector('input.field-input');
    if(inp){
      inp.placeholder=inp.placeholder.replace(/^[A-Z] —/,`${EX_LETTERS[i]} —`);
      inp.id=`${field}${i}`;
    }
    // Re-ID yt button
    const ytb=row.querySelector('.btn-yt-link');
    if(ytb){
      ytb.id=`ytbtn_${field}_${i}`;
      ytb.setAttribute('onclick',`openYtModal('${field}',${i})`);
    }
  });
}
function initExDragDrop(container,field){
  let dragging=null,ghost=null,activePointerId=null,offsetY=0;
  // Remove any pre-existing listeners by cloning container's listener scope via flags
  container._exDragInit=true;

  container.addEventListener('pointerdown',e=>{
    const handle=e.target.closest('.ex-drag-handle');
    if(!handle)return;
    const row=handle.closest('.exercise-row');
    if(!row)return;
    e.preventDefault();
    dragging=row;
    activePointerId=e.pointerId;
    container.setPointerCapture(e.pointerId);
    const rect=row.getBoundingClientRect();
    offsetY=e.clientY-rect.top;
    row.classList.add('dragging-ex');
    ghost=document.createElement('div');
    ghost.innerHTML=row.innerHTML;
    ghost.style.cssText=`position:fixed;left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px;pointer-events:none;z-index:9999;border-radius:12px;background:var(--surface);border:2px solid ${editColor};box-shadow:0 6px 24px rgba(0,0,0,.5);display:flex;align-items:center;gap:10px;padding:0 10px;box-sizing:border-box;opacity:.92;`;
    document.body.appendChild(ghost);
  });

  container.addEventListener('pointermove',e=>{
    if(!dragging||e.pointerId!==activePointerId)return;
    e.preventDefault();
    ghost.style.top=e.clientY-offsetY+'px';
    const rows=[...container.querySelectorAll('.exercise-row')].filter(r=>r!==dragging);
    let target=null;
    for(const r of rows){
      const rc=r.getBoundingClientRect();
      if(e.clientY<rc.top+rc.height/2){target=r;break;}
    }
    if(target) container.insertBefore(dragging,target);
    else container.appendChild(dragging);
  });

  const finishExDrag=e=>{
    if(!dragging||e.pointerId!==activePointerId)return;
    dragging.classList.remove('dragging-ex');
    ghost?.remove();ghost=null;
    // Capture current values and yt URLs BEFORE re-labeling
    const rows=[...container.querySelectorAll('.exercise-row')];
    const snapshot=rows.map(r=>{
      const inp=r.querySelector('input.field-input');
      const oldIdx=inp?.id?.replace(field,'')||'0';
      return{
        name:inp?.value||'',
        url:window._ytTemp?.[`yt_${field}_${oldIdx}`]||''
      };
    });
    relabelExRows(container,field);
    // Re-sync values and _ytTemp with new order
    snapshot.forEach((s,i)=>{
      const inp=document.getElementById(`${field}${i}`);
      if(inp) inp.value=s.name;
      const key=`yt_${field}_${i}`;
      if(s.url) window._ytTemp[key]=s.url;
      else delete window._ytTemp[key];
      const btn=document.getElementById(`ytbtn_${field}_${i}`);
      if(btn){btn.classList.toggle('has-video',!!s.url);btn.title=s.url?'Vídeo adicionado ✓':'Adicionar vídeo';}
    });
    dragging=null;activePointerId=null;
  };
  container.addEventListener('pointerup',finishExDrag);
  container.addEventListener('pointercancel',finishExDrag);
}

// ---- DRAG & DROP REORDER ----
function initDragDrop(){
  initCardDragDrop(document.getElementById('userPresetList'),list=>{
    const newOrder=[...list.querySelectorAll('.preset-card')].map(c=>c.dataset.id);
    presets.sort((a,b)=>newOrder.indexOf(a.id)-newOrder.indexOf(b.id));
    savePresets(presets);
  });
}
function selectAutoMode(){
  autoModeSelected=true;
  selectedId=null;
  renderHome();
}
renderHome();
function startTreinar(){
  getAC();
  if(autoModeSelected&&!selectedId) startAutoMode();
  else if(selectedId==='_bravoMarcado') startBrainMode(BRAVO_MARCADO);
  else {
    const p=presets.find(x=>x.id===selectedId);
    if(p?.mode==='brain') startBrainMode(p);
    else startTimer();
  }
}

function injectTreinarBtn(){
  // Remove any existing btn-treinar instances
  document.querySelectorAll('.btn-treinar').forEach(b=>b.remove());

  // Determine what's selected
  let targetEl=null;
  let color='#F04E23';

  if(selectedId==='_bravoMarcado'){
    targetEl=document.getElementById('bravoMarcadoCard');
    color=BRAVO_MARCADO?.color||'#F04E23';
  } else if(selectedId){
    const p=presets.find(x=>x.id===selectedId);
    color=p?.color||'#F04E23';
    targetEl=document.querySelector(`.preset-card[data-id="${selectedId}"]`);
  } else if(autoModeSelected){
    targetEl=document.getElementById('autoCard');
    color='#F04E23';
  }

  if(!targetEl) return;

  const btn=document.createElement('button');
  btn.className='btn-treinar';
  btn.setAttribute('aria-label','Iniciar treino');
  btn.style.setProperty('--c',color);
  btn.style.background='#F04E23';
  btn.style.color='#fff';
  btn.innerHTML=`<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>TREINAR`;
  btn.addEventListener('click',(e)=>{e.stopPropagation();startTreinar();});

  // Find the expanded details container inside the card
  const anchor=targetEl.querySelector('.card-expanded')||targetEl;

  // Wrap in a flex row aligned right
  const row=document.createElement('div');
  row.className='btn-treinar-row';
  row.style.cssText='display:flex;justify-content:flex-end;padding:10px 0 2px 0;overflow:visible;';
  row.appendChild(btn);
  anchor.appendChild(row);

  // Trigger animation on next frame
  requestAnimationFrame(()=>requestAnimationFrame(()=>btn.classList.add('visible')));
}
document.getElementById('btnNew').onclick=()=>openEdit(null);

// ---- MENU ----
document.getElementById('btnMenu').onclick=()=>document.getElementById('menuOverlay').classList.add('open');
function closeMenu(e){if(e.target===document.getElementById('menuOverlay')){document.getElementById('menuOverlay').classList.remove('open');resetMenuAccordions();}}
function closeMenuForce(){document.getElementById('menuOverlay').classList.remove('open');resetMenuAccordions();}
const MENU_ACCORDIONS=['programas','indicacoes'];
function toggleMenuAccordion(name){
  const wasOpen=document.getElementById('accBody-'+name).classList.contains('open');
  MENU_ACCORDIONS.forEach(s=>{
    document.getElementById('accBody-'+s).classList.remove('open');
    document.getElementById('accToggle-'+s).classList.remove('open');
  });
  if(!wasOpen){
    document.getElementById('accBody-'+name).classList.add('open');
    document.getElementById('accToggle-'+name).classList.add('open');
  }
}
function resetMenuAccordions(){
  MENU_ACCORDIONS.forEach(s=>{
    document.getElementById('accBody-'+s).classList.remove('open');
    document.getElementById('accToggle-'+s).classList.remove('open');
  });
}
function openSettingsFromMenu(){
  closeMenuForce();
  const emailEl=document.getElementById('settingsAccountEmail');
  const linkBtn=document.getElementById('btnLinkGoogle');
  const user=window._fbCurrentUser;
  if(emailEl){
    emailEl.textContent=(user&&!user.isAnonymous)?('Conectado como '+(user.email||'')):'Você ainda não está logado';
  }
  if(linkBtn){
    const hasGoogle=user?.providerData?.some(p=>p.providerId==='google.com');
    linkBtn.style.display=(user&&!user.isAnonymous&&!hasGoogle)?'block':'none';
  }
  const currentTheme=localStorage.getItem('bravo_theme')||'dark';
  document.querySelectorAll('#settingsModal [data-theme]').forEach(b=>{
    b.classList.toggle('active',b.dataset.theme===currentTheme);
  });
  document.getElementById('settingsModal').classList.add('open');
}
document.querySelectorAll('#settingsModal [data-theme]').forEach(btn=>{
  btn.addEventListener('click',()=>{
    const theme=btn.dataset.theme;
    localStorage.setItem('bravo_theme',theme);
    document.querySelectorAll('#settingsModal [data-theme]').forEach(b=>b.classList.toggle('active',b===btn));
    const link=document.getElementById('themeStylesheet');
    if(link)link.href=theme==='light'?'assets/css/styles-light.css':'assets/css/styles-dark.css';
  });
});
function openAbout(){closeMenuForce();showScreen('aboutScreen');}
function openBravoPlayFromMenu(){closeMenuForce();showScreen('home');selectAutoMode();}
function openTreinoDoDiaFromMenu(){closeMenuForce();showScreen('home');selectBravoMarcado();}
function openIndicacoes(categoria){
  closeMenuForce();
  document.getElementById('indicacoesTitle').textContent=categoria;
  showScreen('indicacoesScreen');
}
function openRegisterFromMenu(){closeMenuForce();showScreen('registerScreen');if(window._fbAuthCurrentUser)_refreshGoogleUIIfPossible();}
function openLoginFromMenu(){closeMenuForce();document.getElementById('loginStatus').textContent='';showScreen('loginScreen');}

// ---- PROGRAMA PREMIUM ----
function openPremiumFromMenu(){
  closeMenuForce();
  if(!localStorage.getItem('bravo_reg_done')){
    localStorage.setItem('bravo_premium_pending','1');
    showScreen('registerScreen');
    if(window._fbAuthCurrentUser)_refreshGoogleUIIfPossible();
    return;
  }
  showScreen('premiumIntro');
}
function _refreshGoogleUIIfPossible(){
  const label=document.getElementById('googleSignInLabel');
  if(!label)return;
  const uid=localStorage.getItem('bravo_fb_uid');
  if(uid&&window._fbUid&&!window._fbIsAnonymous){
    label.textContent='Conectado ✓';
    const btn=document.getElementById('btnGoogleSignIn');
    if(btn){btn.disabled=true;btn.style.opacity='.6';}
  }
}

// ---- ABOUT ----
document.getElementById('btnAboutBack').onclick=()=>showScreen('home');
document.getElementById('btnIndicacoesBack').onclick=()=>showScreen('home');

// ---- REGISTER ----
document.getElementById('btnRegBack').onclick=()=>{localStorage.removeItem('bravo_premium_pending');showScreen('home');};
const btnGoogleSignIn=document.getElementById('btnGoogleSignIn');
if(btnGoogleSignIn){
  btnGoogleSignIn.onclick=()=>{ if(window._fbGoogleSignIn) window._fbGoogleSignIn(); };
}
let selectedGender='';
function selectGender(btn){
  selectedGender=btn.dataset.g;
  document.querySelectorAll('.btn-gender').forEach(b=>b.classList.remove('selected'));
  btn.classList.add('selected');
}
document.getElementById('btnRegSave').onclick=async()=>{
  const name=document.getElementById('regName').value.trim();
  const phone=document.getElementById('regPhone').value.trim();
  if(!name){showToast('Informe como quer ser chamado');return;}
  if(!phone){showToast('Informe seu WhatsApp');return;}
  const email=document.getElementById('regEmail').value.trim();
  const password=document.getElementById('regPassword').value;
  const data={name,phone,email,year:document.getElementById('regYear').value.trim(),gender:selectedGender};
  const btn=document.getElementById('btnRegSave');
  btn.textContent='SALVANDO...';btn.disabled=true;
  const params=new URLSearchParams(data).toString();
  const url='https://script.google.com/macros/s/AKfycbzTDMoxP_m6z0ArFqLsaTsIwQcjoH4ebWNIZP7IDoBGRMtwPVIsfTI8iFKCjcfWyMqJ/exec?'+params;
  // fetch no-cors funciona em todos os browsers incluindo Safari/iOS
  try{await fetch(url,{method:'GET',mode:'no-cors'});}catch(e){}
  await new Promise(r=>setTimeout(r,800));
  localStorage.setItem('bravo_user',JSON.stringify(data));
  localStorage.setItem('bravo_reg_done','1');
  if(window._fbSaveUser)window._fbSaveUser(data);
  // E-mail e senha preenchidos: cria login por e-mail, permitindo recuperar os dados em outro aparelho depois
  if(email&&password){
    if(password.length<6){
      showToast('Senha muito curta (mín. 6 caracteres) — cadastro salvo, mas sem login por e-mail');
    } else if(window._fbEmailSignUp){
      const res=await window._fbEmailSignUp(email,password);
      if(res&&res.ok&&res.status==='merged')showToast('Conta encontrada — dados sincronizados! 🔒');
    }
  }
  btn.disabled=false;
  renderHome();
  if(localStorage.getItem('bravo_premium_pending')){
    localStorage.removeItem('bravo_premium_pending');
    showToast('Cadastro salvo! Vamos começar 💪');
    showScreen('premiumIntro');
  } else {
    showToast('Cadastro salvo! Bora treinar 💪');
    showScreen('home');
  }
};

// ---- LOGIN (recuperar conta em outro aparelho) ----
document.getElementById('btnLoginBack').onclick=()=>showScreen('home');
const btnGoogleSignInLogin=document.getElementById('btnGoogleSignInLogin');
if(btnGoogleSignInLogin){
  btnGoogleSignInLogin.onclick=async()=>{
    if(!window._fbGoogleSignIn)return;
    const status=document.getElementById('loginStatus');
    status.textContent='Conectando...';
    await window._fbGoogleSignIn();
    status.textContent='';
    showScreen('home');
    if(typeof renderHome==='function')renderHome();
  };
}
function _loginErrorMessage(code){
  if(code==='auth/invalid-credential'||code==='auth/wrong-password'||code==='auth/user-not-found')return 'E-mail ou senha incorretos.';
  if(code==='auth/invalid-email')return 'E-mail inválido.';
  if(code==='auth/too-many-requests')return 'Muitas tentativas. Tente novamente mais tarde.';
  return 'Não foi possível entrar. Tente novamente.';
}
document.getElementById('btnLoginSubmit').onclick=async()=>{
  const email=document.getElementById('loginEmail').value.trim();
  const password=document.getElementById('loginPassword').value;
  const status=document.getElementById('loginStatus');
  const btn=document.getElementById('btnLoginSubmit');
  if(!email||!password){status.textContent='Informe e-mail e senha.';return;}
  btn.disabled=true;btn.textContent='ENTRANDO...';
  status.textContent='Entrando...';
  const res=window._fbEmailLogin?await window._fbEmailLogin(email,password):{ok:false};
  btn.disabled=false;btn.textContent='ENTRAR';
  if(res.ok){
    status.textContent='';
    showToast('Login realizado! Seus dados foram sincronizados 💪');
    showScreen('home');
    if(typeof renderHome==='function')renderHome();
  } else {
    status.textContent=_loginErrorMessage(res.code);
  }
};
document.getElementById('btnLoginForgotPw').onclick=async()=>{
  const email=document.getElementById('loginEmail').value.trim();
  const status=document.getElementById('loginStatus');
  if(!email){status.textContent='Digite seu e-mail acima para receber o link de redefinição.';return;}
  status.textContent='Enviando...';
  const res=window._fbResetPassword?await window._fbResetPassword(email):{ok:false};
  status.textContent=res.ok?'Enviamos um link para redefinir sua senha.':'Não foi possível enviar. Confira o e-mail.';
};


function getWorkoutCount(){return parseInt(localStorage.getItem('bravo_workout_count')||'0');}
function incrementWorkoutCount(){const n=getWorkoutCount()+1;localStorage.setItem('bravo_workout_count',n);return n;}
function checkRegPrompt(){
  if(localStorage.getItem('bravo_reg_done'))return;
  const n=getWorkoutCount();
  const snoozedAt=parseInt(localStorage.getItem('bravo_reg_snoozed')||'0');
  if(n>=3&&(snoozedAt===0||n>=snoozedAt+3)){
    setTimeout(()=>document.getElementById('regPromptOverlay').classList.add('open'),1200);
  }
}
function dismissRegPrompt(){
  document.getElementById('regPromptOverlay').classList.remove('open');
  localStorage.setItem('bravo_reg_snoozed',getWorkoutCount());
}
function openRegisterScreen(){
  document.getElementById('regPromptOverlay').classList.remove('open');
  showScreen('registerScreen');
  _refreshGoogleUIIfPossible();
}

function setMode(m){
  editMode=m;
  document.getElementById('modeNormal').classList.toggle('active',m==='normal');
  document.getElementById('modeCircuit').classList.toggle('active',m==='circuit');
  document.getElementById('modeBrain').classList.toggle('active',m==='brain');
  document.getElementById('normalFields').style.display=m==='normal'?'flex':'none';
  document.getElementById('circuitFields').style.display=m==='circuit'?'flex':'none';
  document.getElementById('brainFields').style.display=m==='brain'?'flex':'none';
  if(m==='normal')document.getElementById('normalFields').style.flexDirection='column';
  if(m==='circuit')updateExerciseInputs();
  if(m==='brain')updateBrainExerciseInputs();
}
function buildExerciseInputs(countInputId,containerId,field,max,placeholderFn){
  const n=parseInt(document.getElementById(countInputId).value)||3;
  const container=document.getElementById(containerId);
  const existing=[...container.querySelectorAll('input')].map(i=>i.value);
  container.innerHTML='';
  for(let i=0;i<Math.min(n,max);i++){
    const row=document.createElement('div');row.className='exercise-row';
    row.dataset.exIdx=i;
    row.innerHTML=`<div class="ex-drag-handle" title="Arrastar">⠿</div><div class="exercise-letter" style="color:${editColor}">${EX_LETTERS[i]||String(i+1)}</div>
      <input class="field-input" id="${field}${i}" placeholder="${placeholderFn(i)}" value="${existing[i]||''}">
      ${ytBtn(field,i)}`;
    container.appendChild(row);
  }
  initExDragDrop(container,field);
}
function updateExerciseInputs(){
  buildExerciseInputs('efExCount','exerciseInputs','efEx',6,i=>`${EX_LETTERS[i]} — nome`);
}
// ---- YOUTUBE HELPERS ----
function extractYtId(url){
  if(!url)return null;
  const m=url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/))([A-Za-z0-9_-]{11})/);
  return m?m[1]:null;
}
function escHtml(s){
  const d=document.createElement('div');d.textContent=s||'';return d.innerHTML;
}
// Estado global do vídeo: garante que o vídeo só pausa/retoma por decisão do usuário,
// mesmo quando o mesmo exercício passa da tela de preparação para a de execução.
let videoCtrl={id:null,paused:false,label:''};
function ytEmbedHtml(videoId,label){
  const params='autoplay=1&mute=1&loop=1&playlist='+videoId+'&controls=0&rel=0&modestbranding=1&playsinline=1&iv_load_policy=3&disablekb=1&fs=0&enablejsapi=1';
  return `<iframe src="https://www.youtube.com/embed/${videoId}?${params}" allow="autoplay; encrypted-media; picture-in-picture" frameborder="0"></iframe>`
    +(label?`<div class="yt-exname-overlay">${escHtml(label)}</div>`:'')
    +`<div class="yt-tap-layer${videoCtrl.paused?' is-paused':''}" onclick="toggleVideoPlay(this)"><div class="yt-pause-badge"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></div></div>`;
}
function postYtCommand(wrap,func){
  const ifr=wrap&&wrap.querySelector('iframe');
  if(!ifr||!ifr.contentWindow)return;
  try{ifr.contentWindow.postMessage(JSON.stringify({event:'command',func,args:[]}),'*');}catch(e){}
}
function toggleVideoPlay(layer){
  const wrap=layer.closest('.yt-embed-wrap');
  if(!wrap)return;
  videoCtrl.paused=!videoCtrl.paused;
  layer.classList.toggle('is-paused',videoCtrl.paused);
  postYtCommand(wrap,videoCtrl.paused?'pauseVideo':'playVideo');
}
function showYtEmbed(wrapId,videoId,containerId,label){
  const wrap=document.getElementById(wrapId);
  if(!wrap)return;
  const container=containerId?document.getElementById(containerId):wrap.parentElement;
  if(!videoId){
    wrap.classList.remove('visible');
    wrap.style.display='none';
    if(container)container.classList.remove('has-video');
    wrap.innerHTML='';
    videoCtrl.id=null;videoCtrl.paused=false;videoCtrl.label='';
    return;
  }
  if(container)container.classList.add('has-video');
  wrap.classList.add('visible');
  wrap.style.display='block';
  if(videoCtrl.id!==videoId){
    // Novo vídeo: começa a tocar automaticamente, em loop e mudo
    videoCtrl.id=videoId;videoCtrl.paused=false;videoCtrl.label=label||'';
    wrap.innerHTML=ytEmbedHtml(videoId,videoCtrl.label);
  } else if(!wrap.querySelector('iframe')){
    // Mesmo vídeo, mas esta tela ainda não tem o player (ex.: passou de preparação para execução):
    // recria o player respeitando se o usuário havia pausado
    wrap.innerHTML=ytEmbedHtml(videoId,videoCtrl.label||label||'');
    if(videoCtrl.paused)setTimeout(()=>postYtCommand(wrap,'pauseVideo'),350);
  }
}
let ytModalTarget={field:'',index:0};
function openYtModal(field,index){
  ytModalTarget={field,index};
  const key=`yt_${field}_${index}`;
  document.getElementById('ytLinkInput').value=ytModalTarget._current||'';
  // load from temp storage on edit form
  const inp=document.getElementById(field+index);
  document.getElementById('ytLinkInput').value=window._ytTemp?.[key]||'';
  document.getElementById('ytLinkModal').classList.add('open');
}
if(!window._ytTemp)window._ytTemp={};
document.getElementById('btnYtSave').onclick=()=>{
  const url=document.getElementById('ytLinkInput').value.trim();
  const id=extractYtId(url);
  const key=`yt_${ytModalTarget.field}_${ytModalTarget.index}`;
  if(url&&!id){showToast('Link do YouTube inválido');return;}
  window._ytTemp[key]=url;
  // Update button visual
  const btn=document.getElementById(`ytbtn_${ytModalTarget.field}_${ytModalTarget.index}`);
  if(btn){btn.classList.toggle('has-video',!!url);btn.title=url?'Vídeo adicionado ✓':'Adicionar vídeo';}
  document.getElementById('ytLinkModal').classList.remove('open');
};
document.getElementById('btnYtRemove').onclick=()=>{
  const key=`yt_${ytModalTarget.field}_${ytModalTarget.index}`;
  delete window._ytTemp[key];
  const btn=document.getElementById(`ytbtn_${ytModalTarget.field}_${ytModalTarget.index}`);
  if(btn){btn.classList.remove('has-video');btn.title='Adicionar vídeo';}
  document.getElementById('ytLinkInput').value='';
  document.getElementById('ytLinkModal').classList.remove('open');
};
document.getElementById('ytLinkModal').onclick=e=>{
  if(e.target.id==='ytLinkModal')document.getElementById('ytLinkModal').classList.remove('open');
};
function loadYtTemp(field,videos){
  if(!videos)return;
  videos.forEach((url,i)=>{
    const key=`yt_${field}_${i}`;
    if(url){window._ytTemp[key]=url;
      const btn=document.getElementById(`ytbtn_${field}_${i}`);
      if(btn){btn.classList.add('has-video');btn.title='Vídeo adicionado ✓';}
    }
  });
}
function collectYtUrls(field,count){
  const arr=[];
  for(let i=0;i<count;i++) arr.push(window._ytTemp[`yt_${field}_${i}`]||'');
  return arr;
}
function clearYtTemp(){window._ytTemp={};}
function ytBtn(field,index){
  return `<button type="button" id="ytbtn_${field}_${index}" class="btn-yt-link" title="Adicionar vídeo" onclick="openYtModal('${field}',${index})">▶</button>`;
}
function clearObs(){document.getElementById('efObs').value='';}
function updateBrainExerciseInputs(){
  const group=document.getElementById('brainExercisesGroup');
  group.style.display='flex';group.style.flexDirection='column';
  buildExerciseInputs('efBrainExCount','brainExerciseInputs','bfEx',9,i=>`Exercício ${i+1}`);
}
document.getElementById('efBrainExCount')?.addEventListener('input',updateBrainExerciseInputs);
function updateNormalExerciseInputs(){
  const n=parseInt(document.getElementById('efNormalExCount').value)||1;
  const group=document.getElementById('normalExercisesGroup');
  const container=document.getElementById('normalExerciseInputs');
  group.style.display='flex';group.style.flexDirection='column';
  const existing=[...container.querySelectorAll('input')].map(i=>i.value);
  container.innerHTML='';
  for(let i=0;i<Math.min(n,6);i++){
    const row=document.createElement('div');row.className='exercise-row';
    row.dataset.exIdx=i;
    const dragHandle=n>1?`<div class="ex-drag-handle" title="Arrastar">⠿</div>`:'';
    const letterHtml=n>1?`<div class="exercise-letter" style="color:${editColor}">${EX_LETTERS[i]}</div>`:'';
    row.innerHTML=`${dragHandle}${letterHtml}<input class="field-input" id="nfEx${i}" placeholder="${n>1?EX_LETTERS[i]+' — nome':'Nome do exercício (opcional)'}" value="${existing[i]||''}">
      ${ytBtn('nfEx',i)}`;
    container.appendChild(row);
  }
  if(n>1) initExDragDrop(container,'nfEx');
}

function openEdit(id){
  editingId=id;
  const p=id?presets.find(x=>x.id===id):null;
  document.getElementById('editTitle').textContent=id?'EDITAR':'NOVO PROGRAMA';
  document.getElementById('efName').value=p?.name??'';
  document.getElementById('efObs').value=p?.obs??'';
  clearYtTemp();
  editColor=p?.color||PALETTE[0].hex;
  buildColorPicker(editColor);
  const mode=p?.mode??'normal';setMode(mode);
  if(mode==='circuit'){
    document.getElementById('efExCount').value=p?.exCount??3;
    document.getElementById('efRounds').value=p?.rounds??3;
    document.getElementById('efCPrep').value=p?.prep??30;
    document.getElementById('efCAction').value=p?.action??30;
    document.getElementById('efCRest').value=p?.rest??15;
    updateExerciseInputs();
    p?.exercises?.forEach((name,i)=>{const inp=document.getElementById('efEx'+i);if(inp)inp.value=name;});
    setTimeout(()=>loadYtTemp('efEx',p?.exerciseVideos||[]),50);
  } else if(mode==='brain'){
    document.getElementById('efBrainExCount').value=p?.brainExCount??2;
    document.getElementById('efBrainSeries').value=p?.brainSeries??3;
    document.getElementById('efBrainAction').value=p?.brainAction??40;
    document.getElementById('efBrainPrep').value=p?.brainPrep??15;
    updateBrainExerciseInputs();
    p?.brainExercises?.forEach((name,i)=>{const inp=document.getElementById('bfEx'+i);if(inp)inp.value=name;});
    setTimeout(()=>loadYtTemp('bfEx',p?.brainExerciseVideos||[]),50);
  } else {
    document.getElementById('efCycles').value=p?.cycles??4;
    document.getElementById('efPrep').value=p?.prep??30;
    document.getElementById('efAction').value=p?.action??60;
    document.getElementById('efRest').value=p?.rest??40;
    const nex=p?.normalExCount??1;
    document.getElementById('efNormalExCount').value=nex>1?nex:'';
    updateNormalExerciseInputs();
    if(p?.normalExercises){p.normalExercises.forEach((name,i)=>{const inp=document.getElementById('nfEx'+i);if(inp)inp.value=name;});}
    setTimeout(()=>loadYtTemp('nfEx',p?.normalExerciseVideos||[]),50);
  }
  document.getElementById('btnDeleteEdit').style.display=id?'block':'none';
  showScreen('edit');
}
document.getElementById('btnEditBack').onclick=()=>showScreen('home');
document.getElementById('btnDeleteEdit').onclick=()=>{
  if(!editingId)return;
  const p=presets.find(x=>x.id===editingId);
  document.getElementById('deleteConfirmName').textContent=p?.name||'';
  document.getElementById('deleteConfirmModal').classList.add('open');
};
document.getElementById('btnConfirmDelete').onclick=()=>{
  document.getElementById('deleteConfirmModal').classList.remove('open');
  if(editingId){deletePreset(editingId);showScreen('home');}
};
document.getElementById('btnCancelDelete').onclick=()=>{
  document.getElementById('deleteConfirmModal').classList.remove('open');
};
document.getElementById('btnSave').onclick=()=>{
  const name=document.getElementById('efName').value.trim();
  const obs=document.getElementById('efObs').value.trim();
  if(!name){showToast('Preencha o nome');return;}
  let data;
  if(editMode==='circuit'){
    const exCount=parseInt(document.getElementById('efExCount').value);
    const rounds=parseInt(document.getElementById('efRounds').value);
    const prep=parseInt(document.getElementById('efCPrep').value);
    const action=parseInt(document.getElementById('efCAction').value);
    const rest=parseInt(document.getElementById('efCRest').value)||0;
    if(isNaN(exCount)||isNaN(rounds)||isNaN(prep)||isNaN(action)){showToast('Preencha todos os campos');return;}
    const exercises=[];
    for(let i=0;i<exCount;i++){const inp=document.getElementById('efEx'+i);exercises.push(inp?.value.trim()||EX_LETTERS[i]);}
    const exerciseVideos=collectYtUrls('efEx',exCount);
    data={name,obs,color:editColor,mode:'circuit',exCount,rounds,prep,action,rest,exercises,exerciseVideos};
  } else if(editMode==='brain'){
    const brainExCount=parseInt(document.getElementById('efBrainExCount').value)||2;
    const brainSeries=parseInt(document.getElementById('efBrainSeries').value)||3;
    const brainAction=parseInt(document.getElementById('efBrainAction').value)||40;
    const brainPrep=parseInt(document.getElementById('efBrainPrep').value)||15;
    const brainExercises=[];
    for(let i=0;i<brainExCount;i++){const inp=document.getElementById('bfEx'+i);brainExercises.push(inp?.value.trim()||('Exercício '+(i+1)));}
    const brainExerciseVideos=collectYtUrls('bfEx',brainExCount);
    data={name,obs,color:editColor,mode:'brain',brainExCount,brainSeries,brainAction,brainPrep,brainExercises,brainExerciseVideos};
  } else {
    const cycles=parseInt(document.getElementById('efCycles').value);
    const prep=parseInt(document.getElementById('efPrep').value);
    const action=parseInt(document.getElementById('efAction').value);
    const rest=parseInt(document.getElementById('efRest').value);
    if(isNaN(cycles)||isNaN(prep)||isNaN(action)||isNaN(rest)){showToast('Preencha todos os campos');return;}
    const normalExCount=Math.max(1,parseInt(document.getElementById('efNormalExCount').value)||1);
    const normalExercises=[];
    for(let i=0;i<normalExCount;i++){const inp=document.getElementById('nfEx'+i);normalExercises.push(inp?.value.trim()||EX_LETTERS[i]);}
    const normalExerciseVideos=collectYtUrls('nfEx',normalExCount);
    data={name,obs,color:editColor,mode:'normal',cycles,prep,action,rest,normalExCount,normalExercises,normalExerciseVideos};
  }
  if(editingId){Object.assign(presets.find(x=>x.id===editingId),data);}
  else{presets.push({id:'c'+Date.now(),...data});}
  savePresets(presets);renderHome();showScreen('home');
};
function deletePreset(id){
  presets=presets.filter(p=>p.id!==id);
  if(selectedId===id)selectedId=presets[0]?.id??null;
  savePresets(presets);renderHome();
}

// ============================================================
// CAIXA DE ENTRADA — mensagens do professor (todos/grupo/individual)
// ============================================================
function renderInboxBadge(){
  const badge=document.getElementById('inboxBadge');
  if(!badge)return;
  const unread=(window._inboxMessages||[]).filter(m=>!m.read).length;
  if(unread>0){badge.textContent=unread>9?'9+':unread;badge.classList.remove('hidden');}
  else{badge.classList.add('hidden');}
}
window.renderInboxBadge=renderInboxBadge;

function renderInboxList(){
  const list=document.getElementById('inboxList');
  const messages=window._inboxMessages||[];
  const clearAllBtn=document.getElementById('btnInboxClearAll');
  if(clearAllBtn)clearAllBtn.style.display=messages.length>0?'block':'none';
  if(messages.length===0){
    list.innerHTML='<p style="color:#888;font-size:14px;text-align:center;margin-top:40px;">Nenhuma mensagem ainda.</p>';
    return;
  }
  list.innerHTML=messages.map(m=>{
    const date=m.createdAt?new Date(m.createdAt).toLocaleDateString('pt-BR'):'';
    return `<div style="background:#181818;border:1px solid #242424;border-radius:12px;padding:14px 16px;margin-bottom:10px;${m.read?'':'border-color:#F04E23;'}">
      <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;">
        <div style="font-size:14px;line-height:1.4;">${escapeHtmlSafe(m.text)}</div>
        <button data-del-msg="${m.id}" style="background:none;border:none;color:#888;font-size:16px;cursor:pointer;line-height:1;padding:0;flex-shrink:0;">✕</button>
      </div>
      <div style="color:#888;font-size:12px;margin-top:8px;">${date}</div>
    </div>`;
  }).join('');
}

document.getElementById('inboxList')?.addEventListener('click',async(e)=>{
  const delId=e.target.dataset?.delMsg;
  if(!delId)return;
  window._inboxMessages=(window._inboxMessages||[]).filter(m=>m.id!==delId);
  renderInboxList();renderInboxBadge();
  if(window._fbDismissMessage)await window._fbDismissMessage(delId);
});

document.getElementById('btnInboxClearAll')?.addEventListener('click',async()=>{
  if(!confirm('Apagar todas as mensagens? Isso só some da sua caixa, não afeta os outros alunos.'))return;
  const ids=(window._inboxMessages||[]).map(m=>m.id);
  window._inboxMessages=[];
  renderInboxList();renderInboxBadge();
  if(window._fbDismissMessage)for(const id of ids)await window._fbDismissMessage(id);
});

async function openInbox(){
  showScreen('inboxScreen');
  renderInboxList();
  // Abrir a caixa já marca tudo como lido (mais simples pro aluno)
  const unread=(window._inboxMessages||[]).filter(m=>!m.read);
  for(const m of unread){
    m.read=true;
    if(window._fbMarkMessageRead)await window._fbMarkMessageRead(m.id);
  }
  renderInboxBadge();
  renderInboxList();
}

document.getElementById('btnInbox')?.addEventListener('click',openInbox);
document.getElementById('btnInboxBack')?.addEventListener('click',()=>showScreen('home'));


