// ============================================================
// PROGRAMA PREMIUM — questionário conversacional
// ============================================================
const PREMIUM_QUESTIONS=[
  {id:'q1',type:'longtext',title:'Como você se sente hoje em relação ao seu corpo?',placeholder:'Fique à vontade para escrever com suas palavras...',required:true},
  {id:'q2',type:'longtext',title:'Imagine que passaram três meses seguindo um plano pensado especialmente para você.',subtitle:'O que gostaria de ter conquistado?',placeholder:'Descreva como você se imagina...',required:true},
  {id:'birthdate',type:'date',title:'Agora preciso conhecer um pouco da sua realidade.',subtitle:'Qual sua data de nascimento?',required:true},
  {id:'gender',type:'options',title:'Gênero',options:['Feminino','Masculino','Prefiro não informar'],required:true},
  {id:'height',type:'number',title:'Altura',placeholder:'Ex: 170',unit:'cm',required:true},
  {id:'weight',type:'number',title:'Peso',placeholder:'Ex: 68',unit:'kg',required:true},
  {id:'injury',type:'longtext',title:'Existe alguma lesão ou limitação que influencia seu dia a dia?',placeholder:'Se não houver, pode escrever "Não".',required:true},
  {id:'medication',type:'longtext',title:'Você utiliza alguma medicação de uso contínuo que considera importante eu saber?',placeholder:'Se não houver, pode escrever "Não".',required:true},
  {id:'trainLocation',type:'options',title:'Onde pretende treinar?',options:['Academia','Casa','Ar livre','Outro'],required:true},
  {id:'homeEquipment',type:'longtext',title:'Caso vá treinar em casa:',subtitle:'Quais equipamentos você possui?',placeholder:'Ex: halteres, elástico, banco...',required:false,showIf:a=>a.trainLocation==='Casa'},
  {id:'buyEquipment',type:'options',title:'Você estaria disposto a adquirir algum equipamento simples caso isso melhorasse bastante seu treinamento?',options:['Sim','Não','Talvez'],required:true},
  {id:'time',type:'dual',title:'Em vez de montar o treino ideal, prefiro montar o treino que realmente funciona na sua rotina.',subtitle:'Quanto tempo você consegue dedicar ao treino?',fields:[{id:'daysPerWeek',label:'Dias por semana',placeholder:'Ex: 3'},{id:'minutesPerSession',label:'Tempo médio por treino (min)',placeholder:'Ex: 45'}],required:true},
  {id:'extra',type:'longtext',title:'Existe alguma informação importante que você gostaria de compartilhar e que eu ainda não perguntei?',placeholder:'Opcional...',required:false}
];
let premiumAnswers={};
let premiumStepIdx=0;

function premVisibleQuestions(){
  return PREMIUM_QUESTIONS.filter(q=>!q.showIf||q.showIf(premiumAnswers));
}

document.getElementById('btnPremiumIntroBack').onclick=()=>showScreen('home');
document.getElementById('btnPremiumStart').onclick=()=>{
  premiumAnswers={};
  premiumStepIdx=0;
  showScreen('premiumQuestion');
  renderPremiumStep();
};
document.getElementById('btnPremiumDoneBack').onclick=()=>showScreen('home');
document.getElementById('btnPremiumBack').onclick=()=>{
  if(premiumStepIdx<=0){showScreen('premiumIntro');return;}
  premiumStepIdx--;
  renderPremiumStep();
};
document.getElementById('btnPremiumNext').onclick=()=>premiumAdvance();
document.getElementById('btnPremiumSkip').onclick=()=>premiumAdvance(true);

function premiumCurrentInputValue(q){
  if(q.type==='longtext'){const el=document.getElementById('premInput_'+q.id);return el?el.value.trim():'';}
  if(q.type==='date'||q.type==='number'){const el=document.getElementById('premInput_'+q.id);return el?el.value.trim():'';}
  if(q.type==='options'){return premiumAnswers[q.id]||'';}
  if(q.type==='dual'){
    const vals={};
    q.fields.forEach(f=>{const el=document.getElementById('premInput_'+f.id);vals[f.id]=el?el.value.trim():'';});
    return vals;
  }
  return '';
}

function premiumAdvance(skip){
  const list=premVisibleQuestions();
  const q=list[premiumStepIdx];
  if(!q)return;
  const val=skip?(q.type==='dual'?{}:''):premiumCurrentInputValue(q);
  if(q.required && !skip){
    let empty=false;
    if(q.type==='dual'){empty=Object.values(val).some(v=>!v);}
    else{empty=!val;}
    if(empty){showToast('Preencha para continuar');return;}
  }
  premiumAnswers[q.id]=val;
  const newList=premVisibleQuestions();
  const currentPos=newList.indexOf(q);
  premiumStepIdx=(currentPos>=0?currentPos:premiumStepIdx)+1;
  if(premiumStepIdx>=newList.length){finishPremiumQuestionnaire();return;}
  renderPremiumStep();
}

function renderPremiumStep(){
  const list=premVisibleQuestions();
  const q=list[premiumStepIdx];
  if(!q){finishPremiumQuestionnaire();return;}
  document.getElementById('premProgressTxt').textContent=(premiumStepIdx+1)+' / '+list.length;
  document.getElementById('premProgressFill').style.width=((premiumStepIdx)/list.length*100)+'%';
  document.getElementById('btnPremiumSkip').style.display=q.required?'none':'block';
  document.getElementById('btnPremiumNext').textContent=(premiumStepIdx===list.length-1)?'FINALIZAR':'CONTINUAR';

  const body=document.getElementById('premBody');
  body.classList.remove('in');

  let html='<div class="prem-q-title">'+q.title+'</div>';
  if(q.subtitle)html+='<div class="prem-q-subtitle">'+q.subtitle+'</div>';

  if(q.type==='longtext'){
    html+='<textarea class="prem-textarea" id="premInput_'+q.id+'" placeholder="'+q.placeholder+'">'+(premiumAnswers[q.id]||'')+'</textarea>';
  } else if(q.type==='date'){
    html+='<input class="prem-input" type="date" id="premInput_'+q.id+'" value="'+(premiumAnswers[q.id]||'')+'">';
  } else if(q.type==='number'){
    html+='<div class="prem-unit-wrap"><input class="prem-input" type="number" inputmode="decimal" id="premInput_'+q.id+'" placeholder="'+q.placeholder+'" value="'+(premiumAnswers[q.id]||'')+'"><span class="prem-unit-label">'+q.unit+'</span></div>';
  } else if(q.type==='options'){
    html+='<div class="prem-options">'+q.options.map(o=>'<button type="button" class="prem-opt-btn'+(premiumAnswers[q.id]===o?' selected':'')+'" data-val="'+o+'" onclick="premiumSelectOption(this,\''+q.id+'\')">'+o+'</button>').join('')+'</div>';
  } else if(q.type==='dual'){
    html+='<div class="prem-dual">'+q.fields.map(f=>{
      const existing=(premiumAnswers[q.id]&&premiumAnswers[q.id][f.id])||'';
      return '<div class="prem-dual-field"><div class="reg-label">'+f.label+'</div><input class="prem-input" type="number" inputmode="numeric" id="premInput_'+f.id+'" placeholder="'+f.placeholder+'" value="'+existing+'"></div>';
    }).join('')+'</div>';
  }

  body.innerHTML=html;
  requestAnimationFrame(()=>body.classList.add('in'));
  const focusable=body.querySelector('textarea,input');
  if(focusable && q.type!=='options') setTimeout(()=>focusable.focus({preventScroll:true}),50);
}

function premiumSelectOption(btn,qid){
  premiumAnswers[qid]=btn.dataset.val;
  btn.parentElement.querySelectorAll('.prem-opt-btn').forEach(b=>b.classList.remove('selected'));
  btn.classList.add('selected');
}

async function finishPremiumQuestionnaire(){
  document.getElementById('premProgressFill').style.width='100%';
  const btn=document.getElementById('btnPremiumNext');
  btn.textContent='ENVIANDO...';btn.disabled=true;
  const answers={
    comoSeSente:premiumAnswers.q1||'',
    metaTresMeses:premiumAnswers.q2||'',
    dataNascimento:premiumAnswers.birthdate||'',
    genero:premiumAnswers.gender||'',
    altura:premiumAnswers.height||'',
    peso:premiumAnswers.weight||'',
    lesaoOuLimitacao:premiumAnswers.injury||'',
    medicacao:premiumAnswers.medication||'',
    localTreino:premiumAnswers.trainLocation||'',
    equipamentosCasa:premiumAnswers.homeEquipment||'',
    disponibilidadeComprarEquipamento:premiumAnswers.buyEquipment||'',
    diasPorSemana:(premiumAnswers.time&&premiumAnswers.time.daysPerWeek)||'',
    tempoMedioTreino:(premiumAnswers.time&&premiumAnswers.time.minutesPerSession)||'',
    infoAdicional:premiumAnswers.extra||''
  };
  let ok=false;
  if(window._fbSavePremiumApplication) ok=await window._fbSavePremiumApplication(answers);
  btn.disabled=false;btn.textContent='CONTINUAR';
  if(!ok){showToast('Não foi possível enviar agora. Tente novamente.');return;}
  showScreen('premiumDone');
}

// Trava a tela em modo retrato durante a execução do treino, em todos os modos.
// (Alguns navegadores só permitem isso com o app instalado/tela cheia; falha silenciosamente quando não suportado.)
const EXEC_ORIENT_SCREENS=new Set(['timer','autoPrep','autoReps','autoIntensity','autoExec','autoRest','autoContinue','brainPrep','brainReps','brainIntensity','brainExec','brainRest']);
function lockPortrait(){
  try{
    if(screen.orientation&&screen.orientation.lock){
      screen.orientation.lock('portrait').catch(()=>{});
    }
  }catch(e){}
}
function unlockOrientation(){
  try{
    if(screen.orientation&&screen.orientation.unlock)screen.orientation.unlock();
  }catch(e){}
}
function showScreen(id){
  document.querySelectorAll('.screen').forEach(s=>s.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
  if(EXEC_ORIENT_SCREENS.has(id))lockPortrait();else unlockOrientation();
}
let toastTmr;
function showToast(msg){const t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');clearTimeout(toastTmr);toastTmr=setTimeout(()=>t.classList.remove('show'),2500);}

// Pull-to-refresh para modo PWA instalado
(function(){
  const isStandalone=window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone===true;
  if(!isStandalone)return;
  let startY=0,pulling=false;
  const THRESHOLD=90;
  const indicator=document.createElement('div');
  indicator.style.cssText='position:fixed;top:0;left:0;right:0;display:flex;align-items:center;justify-content:center;height:0;overflow:hidden;background:var(--surface);z-index:9999;transition:height .2s;color:var(--muted);font-family:"DM Sans",sans-serif;font-size:13px;letter-spacing:1px;pointer-events:none;';
  indicator.textContent='↓ Puxe para atualizar';
  document.body.prepend(indicator);
  document.addEventListener('touchstart',e=>{
    // Puxar para atualizar só é permitido na tela inicial — em qualquer outra tela
    // (execução, descanso, calendário etc.) o gesto pode reiniciar um treino ou
    // tirar o usuário da tela sem querer, então fica desativado.
    const homeEl=document.getElementById('home');
    if(!homeEl||homeEl.classList.contains('hidden'))return;
    const scrollable=e.touches[0].target.closest('[style*="overflow"],.screen')||document.documentElement;
    if(scrollable.scrollTop>0)return;
    startY=e.touches[0].clientY;
    pulling=true;
  },{passive:true});
  document.addEventListener('touchmove',e=>{
    if(!pulling)return;
    const dy=e.touches[0].clientY-startY;
    if(dy>10){
      indicator.style.height=Math.min(dy,THRESHOLD+20)+'px';
      indicator.textContent=dy>THRESHOLD?'↑ Solte para atualizar':'↓ Puxe para atualizar';
    }
  },{passive:true});
  document.addEventListener('touchend',e=>{
    if(!pulling)return;
    const dy=e.changedTouches[0].clientY-startY;
    indicator.style.height='0';
    if(dy>THRESHOLD){setTimeout(()=>window.location.reload(true),200);}
    pulling=false;
  },{passive:true});
})();

