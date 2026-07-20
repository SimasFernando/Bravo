const CIRC=2*Math.PI*52;
const ringFg=document.getElementById('ringFg');
ringFg.style.strokeDasharray=CIRC;

let tmr={preset:null,phase:'prep',cycle:1,seconds:0,total:0,running:false,_int:null,isCircuit:false,round:1,exIndex:0,color:'#00E676'};

function phaseColor(phase,base){
  return '#F04E23';
}
function ringPhaseColorClassic(phase){
  if(phase==='prep')   return '#F2B33D'; // amarelo
  if(phase==='action') return '#F04E23'; // execução: laranja
  return '#D9483D'; // recuperação/transição: vermelho
}
function applyAccent(c){document.documentElement.style.setProperty('--accent',c);}
function applyProgColor(c){document.documentElement.style.setProperty('--prog',c);}
let wakeLock=null;
async function acquireWakeLock(){if(!('wakeLock' in navigator))return;try{wakeLock=await navigator.wakeLock.request('screen');wakeLock.addEventListener('release',()=>wakeLock=null);}catch(e){}}
function releaseWakeLock(){if(wakeLock){wakeLock.release();wakeLock=null;}}
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&tmr.running)acquireWakeLock();});

function startTimer(){
  const p=presets.find(x=>x.id===selectedId);if(!p)return;
  tmr.preset=p;tmr.running=true;tmr.isCircuit=(p.mode==='circuit');tmr.color=p.color||'#00E676';
  applyProgColor(tmr.color);
  if(tmr.isCircuit){
    tmr.round=1;tmr.exIndex=0;tmr.phase='prep';tmr.seconds=p.prep;tmr.total=p.prep;
    buildCircuitUI();
    document.getElementById('dotsRow').style.display='none';
    document.getElementById('roundDotsRow').style.display='none';
    updateCircuitExLabel();updateCircuitRoundDots();
    updateProgressChips(p.exCount||1,1,p.rounds,1);
  } else {
    tmr.cycle=1;tmr.phase='prep';tmr.seconds=p.prep;tmr.total=p.prep;
    tmr.exIndex=0;
    tmr.normalExCount=Math.max(1,p.normalExCount||1);
    buildDots();
    document.getElementById('dotsRow').style.display='none';
    document.getElementById('roundDotsRow').style.display='none';
    if(tmr.normalExCount>1){
      updateNormalExLabel();
    } else {
      document.getElementById('circuitExLabel').style.display='none';
    }
    updateProgressChips(tmr.normalExCount,1,p.cycles,1);
  }
  updateTimerUI();showScreen('timer');
  acquireWakeLock();phaseStart();tick();
}

function updateProgressChips(exTotal,exCur,serieTotal,serieCur){
  const exChip=document.getElementById('progExChip'),serieChip=document.getElementById('progSerieChip');
  if(exTotal>=1){
    exChip.style.display='flex';
    document.getElementById('progExCur').textContent=exCur;
    document.getElementById('progExTotal').textContent=exTotal;
  } else {
    exChip.style.display='none';
  }
  if(serieTotal>=1){
    serieChip.style.display='flex';
    document.getElementById('progSerieCur').textContent=serieCur;
    document.getElementById('progSerieTotal').textContent=serieTotal;
  } else {
    serieChip.style.display='none';
  }
}

function tick(){
  clearInterval(tmr._int);
  tmr._int=setInterval(()=>{
    if(!tmr.running)return;
    tmr.seconds--;
    if(tmr.seconds===3)beepCountdown();
    updateTimerUI();
    if(tmr.seconds<=0)nextPhase();
  },1000);
}

function nextPhase(){
  const p=tmr.preset;
  if(tmr.isCircuit){nextCircuitPhase();return;}
  const multiEx=(tmr.normalExCount>1);
  if(tmr.phase==='prep'){tmr.phase='action';tmr.seconds=p.action;tmr.total=p.action;phaseStart();}
  else if(tmr.phase==='action'){
    markDot(tmr.cycle-1,'done');
    if(tmr.cycle>=p.cycles){
      if(multiEx&&tmr.exIndex<tmr.normalExCount-1){
        tmr.exIndex++;tmr.cycle=1;
        tmr.phase='prep';tmr.seconds=p.prep;tmr.total=p.prep;
        buildDots();
        updateNormalExLabel();
        updateProgressChips(tmr.normalExCount,tmr.exIndex+1,p.cycles,1);
        phaseStart();updateTimerUI();return;
      }
      clearInterval(tmr._int);setTimeout(()=>showFinish(p),600);return;
    }
    tmr.phase='rest';tmr.seconds=p.rest;tmr.total=p.rest;phaseStart();
  } else {
    tmr.cycle++;tmr.phase='action';tmr.seconds=p.action;tmr.total=p.action;
    markDot(tmr.cycle-1,'active');phaseStart();
  }
  updateProgressChips(tmr.normalExCount,tmr.exIndex+1,p.cycles,tmr.cycle);
  updateTimerUI();
}

function nextCircuitPhase(){
  const p=tmr.preset;
  if(tmr.phase==='prep'){tmr.phase='action';tmr.seconds=p.action;tmr.total=p.action;phaseStart();updateCircuitExLabel();}
  else if(tmr.phase==='action'){
    const lastEx=(tmr.exIndex>=p.exCount-1),lastRound=(tmr.round>=p.rounds);
    if(lastEx&&lastRound){clearInterval(tmr._int);setTimeout(()=>showFinish(p),600);return;}
    if(lastEx){tmr.exIndex=0;tmr.round++;updateCircuitRoundDots();tmr.phase='prep';tmr.seconds=p.prep;tmr.total=p.prep;phaseStart();}
    else if(p.rest>0){tmr.phase='rest';tmr.seconds=p.rest;tmr.total=p.rest;phaseStart();}
    else{tmr.exIndex++;tmr.phase='action';tmr.seconds=p.action;tmr.total=p.action;phaseStart();updateCircuitExLabel();}
  } else {
    tmr.exIndex++;tmr.phase='action';tmr.seconds=p.action;tmr.total=p.action;phaseStart();updateCircuitExLabel();
  }
  updateProgressChips(p.exCount||1,tmr.exIndex+1,p.rounds,tmr.round);
  updateTimerUI();
}

function updateCircuitExLabel(){
  const p=tmr.preset;
  const name=(p.exercises?.[tmr.exIndex]||'').trim();
  const el=document.getElementById('circuitExLabel');
  if(name){el.textContent=name;el.style.display='block';el.style.color='var(--prog)';}
  else{el.style.display='none';}
}
function updateNormalExLabel(){
  const p=tmr.preset;
  const name=(p.normalExercises?.[tmr.exIndex]||'').trim();
  const el=document.getElementById('circuitExLabel');
  if(name){el.textContent=name;el.style.display='block';el.style.color='var(--prog)';}
  else{el.style.display='none';}
}
function buildCircuitUI(){
  const p=tmr.preset;
  const row=document.getElementById('roundDotsRow');row.innerHTML='';
  for(let i=0;i<p.rounds;i++){const d=document.createElement('div');d.className='round-dot'+(i===0?' active':'');row.appendChild(d);}
}
function updateCircuitRoundDots(){
  document.querySelectorAll('.round-dot').forEach((d,i)=>{d.className='round-dot'+(i<tmr.round-1?' done':i===tmr.round-1?' active':'');});
}

function phaseStart(){
  const c=phaseColor(tmr.phase,tmr.color);
  const rc=ringPhaseColorClassic(tmr.phase);
  const isCircuitRest=tmr.isCircuit&&tmr.phase==='rest';
  const NAMES={prep:'PREPARE-SE',action:'VAMOS!',rest:isCircuitRest?'TRANSIÇÃO':'RECUPERAÇÃO'};
  const _v='?v=202506';
  const PHASE_ICONS={prep:'ic_preparacao.png'+_v,action:'ic_execucao.png'+_v,rest:isCircuitRest?'ic_transicao.png'+_v:'ic_recuperacao.png'+_v};
  const icon=PHASE_ICONS[tmr.phase];
  const lbl=document.getElementById('phaseLabel');
  lbl.innerHTML=`<img class="phase-icon" src="${icon}" alt="">${NAMES[tmr.phase]}`;
  lbl.style.color=c;
  document.getElementById('timeDisplay').style.color=c;
  document.getElementById('timeSub').style.color=c;
  const play=document.getElementById('btnPlay');
  play.style.background=c;play.style.color=isLight(c)?'#000':'#fff';
  ringFg.style.stroke=rc;
  const fl=document.getElementById('flash');
  fl.style.background=c;fl.classList.add('on');setTimeout(()=>fl.classList.remove('on'),150);
  vibrate([80,30,80]);
  if(tmr.phase==='prep')speak('Prepare-se. Concentre-se.');
  if(tmr.phase==='action')speak(tmr.isCircuit?('Exercício '+EX_LETTERS[tmr.exIndex]):(tmr.normalExCount>1?('Exercício '+EX_LETTERS[tmr.exIndex]):'Vamos!'));
  if(tmr.phase==='rest')speak('Recuperação.');
  beep(tmr.phase==='action'?1200:800,.15,.6);
  // Vídeo: já aparece na fase de preparação e continua na execução (não reaparece no descanso)
  if(tmr.phase==='prep'||tmr.phase==='action'){
    const p=presets.find(x=>x.id===selectedId);
    const idx=tmr.exIndex||0;
    const vids=tmr.isCircuit?p?.exerciseVideos:p?.normalExerciseVideos;
    const names=tmr.isCircuit?p?.exercises:p?.normalExercises;
    const vid=extractYtId(vids?.[idx]||'');
    const label=(names?.[idx]||'').trim();
    showYtEmbed('timerYtWrap',vid,'timerMain',label);
  } else {
    showYtEmbed('timerYtWrap',null,'timerMain');
  }
  setGauge('timer',tmr.seconds,tmr.total,rc);
}

function fmtTime(s){
  if(s>=60){const m=Math.floor(s/60),ss=s%60;return`${String(m).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;}
  return String(s).padStart(2,'0');
}
// Cronômetro semicircular (velocímetro): 180° no início, 90° no meio, 0° no fim.
const GAUGE_CIRC=157;
function setGauge(prefix,s,total,color){
  const fg=document.getElementById(prefix+'GaugeFg');
  const t=document.getElementById(prefix+'GaugeTime');
  if(fg)fg.style.strokeDashoffset=GAUGE_CIRC*(1-(total>0?s/total:0));
  if(fg&&color)fg.style.stroke=color;
  if(t)t.textContent=fmtTime(Math.max(0,s));
  if(t&&color)t.style.color=color;
}
function updateTimerUI(){
  const s=Math.max(0,tmr.seconds);
  document.getElementById('timeDisplay').textContent=fmtTime(s);
  document.getElementById('timeSub').textContent=s>=60?'MIN : SEG':'SEGUNDOS';
  ringFg.style.strokeDashoffset=CIRC*(1-(tmr.total>0?s/tmr.total:0));
  setGauge('timer',s,tmr.total,ringFg.style.stroke);
}

function buildDots(){
  const row=document.getElementById('dotsRow');row.innerHTML='';
  for(let i=0;i<tmr.preset.cycles;i++){const d=document.createElement('div');d.className='dot'+(i===0?' active':'');row.appendChild(d);}
}
function markDot(i,cls){
  document.querySelectorAll('.dot').forEach((d,j)=>{d.className='dot'+(j===i?' '+cls:j<i?' done':'');});
}

document.getElementById('btnPlay').onclick=()=>{
  tmr.running=!tmr.running;
  const play=document.getElementById('btnPlay');
  play.querySelector('svg').innerHTML=tmr.running?'<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>':'<path d="M8 5v14l11-7z"/>';
  if(tmr.running){getAC();acquireWakeLock();tick();}else{clearInterval(tmr._int);releaseWakeLock();}
};
document.getElementById('btnSkip').onclick=()=>{clearInterval(tmr._int);tmr.seconds=1;nextPhase();if(tmr.running)tick();};
document.getElementById('btnTimerBack').onclick=()=>{clearInterval(tmr._int);tmr.running=false;releaseWakeLock();applyProgColor('#F04E23');showScreen('home');};


const BRAVO_PHRASES_PLAIN=[
  'Boa.','Feito ✔','Treino concluído.','Hoje foi.','Muito bom.',
  'Mais um feito.','Presença registrada.','Treino entregue.',
  'Excelente.','Bom trabalho.','Valeu o esforço.','Missão cumprida.'
];
const BRAVO_PHRASES_NAME=[
  'Boa, {n}.','Muito bom, {n}.','Treino concluído, {n}.',
  'Bom trabalho, {n}.','Hoje foi, {n}.','Mais um feito, {n}.',
  'Excelente, {n}.','Valeu, {n}.','Feito, {n} ✔','Bravo, {n}.'
];
function getBravoPhrase(){
  const userData=JSON.parse(localStorage.getItem('bravo_user')||'null');
  const name=userData?.name?.trim();
  if(name&&Math.random()<0.4){
    const tmpl=BRAVO_PHRASES_NAME[Math.floor(Math.random()*BRAVO_PHRASES_NAME.length)];
    return tmpl.replace('{n}',name);
  }
  return BRAVO_PHRASES_PLAIN[Math.floor(Math.random()*BRAVO_PHRASES_PLAIN.length)];
}

function showBravoFixed(sub){
  const el=document.getElementById('bravoFixed');
  document.getElementById('bravoFixedSub').textContent=sub||'';
  document.getElementById('bravoPhrase').textContent=getBravoPhrase();
  el.style.display='flex';
}
function hideBravoFixed(){
  document.getElementById('bravoFixed').style.display='none';
}

function showFinish(p){
  releaseWakeLock();
  auto.pendingMarkName=p.name||'Treino';
  pendingPoderBravo=null; // Clássico/Circuito não calculam Poder Bravo
  speak('Treino concluído. Parabéns!');
  beep(880,.15,.6,'sine',0);beep(1100,.15,.6,'sine',.2);beep(1320,.3,.7,'sine',.4);
  vibrate([100,50,100,50,200]);
  const label=p.mode==='circuit'?`${p.name} · ${p.rounds} rodadas`:`${p.name} · ${p.cycles} séries`;
  document.getElementById('finishSub').textContent=label;
  showScreen('finish');
  showBravoFixed(label);
  setTimeout(()=>{
    document.getElementById('markWorkoutName').textContent=auto.pendingMarkName;
    document.getElementById('markWorkoutObs').value='';
    showMarkPoderBravo(null);
    resetExTypes();
    document.getElementById('markWorkoutModal').classList.add('open');
  },2000);
}
document.getElementById('btnFinishHome').onclick=()=>{hideBravoFixed();applyProgColor('#F04E23');showScreen('home');};



document.getElementById('btnCalendar').onclick=()=>{
  const body=document.getElementById('calStatBody'),toggle=document.getElementById('calStatToggle');
  if(body){body.classList.remove('open');toggle.classList.remove('open');} // card sempre inicia contraído
  renderCalendar();showScreen('calendarScreen');
};
document.getElementById('btnCalBack').onclick=()=>showScreen('home');

