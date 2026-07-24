// ============================================================
// CALENDÁRIO BRAVO
// ============================================================
function loadCalendar(){const s=localStorage.getItem('nt_calendar');return s?JSON.parse(s):[];}
function saveCalendar(d){localStorage.setItem('nt_calendar',JSON.stringify(d));if(window._fbSaveCalendar)window._fbSaveCalendar(d);}

let calYear=new Date().getFullYear(),calMonth=new Date().getMonth();
const MONTH_NAMES=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const MONTH_PT=MONTH_NAMES.map(m=>m.toUpperCase());

document.getElementById('btnCalPrev').onclick=()=>{calMonth--;if(calMonth<0){calMonth=11;calYear--;}renderCalendar();};
document.getElementById('btnCalNext').onclick=()=>{calMonth++;if(calMonth>11){calMonth=0;calYear++;}renderCalendar();};

function renderCalendar(){
  const WDAY_PT=['DOM','SEG','TER','QUA','QUI','SEX','SÁB'];
  const today=new Date();
  // Update hero for current real date (not nav month)
  document.getElementById('calHeroDay').textContent=today.getDate();
  document.getElementById('calHeroMonth').textContent=MONTH_PT[today.getMonth()];
  document.getElementById('calHeroYear').textContent=today.getFullYear();
  document.getElementById('calHeroWeekday').textContent=WDAY_PT[today.getDay()];
  // Nav label
  document.getElementById('calMonthLabel').textContent=MONTH_NAMES[calMonth]+' '+calYear;
  const grid=document.getElementById('calGrid');grid.innerHTML='';
  document.getElementById('calDayDetail').classList.remove('open');
  const records=loadCalendar();
  const firstDay=new Date(calYear,calMonth,1).getDay();
  const daysInMonth=new Date(calYear,calMonth+1,0).getDate();
  for(let i=0;i<firstDay;i++){const e=document.createElement('div');e.className='cal-day empty';grid.appendChild(e);}
  for(let d=1;d<=daysInMonth;d++){
    const dateStr=`${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const rec=records.find(r=>r.date===dateStr);
    const cell=document.createElement('div');
    const isToday=today.getFullYear()===calYear&&today.getMonth()===calMonth&&today.getDate()===d;
    const isPast=new Date(calYear,calMonth,d)<new Date(today.getFullYear(),today.getMonth(),today.getDate());
    let cls='cal-day has-num';
    if(rec) cls+=' done';
    if(isToday) cls+=' today';
    if(!isPast&&!isToday&&!rec) cls+=' future';
    cell.className=cls;
    cell.textContent=d;
    if(rec){
      const count=(rec.workouts||[rec]).length;
      if(count>1){
        const badge=document.createElement('span');
        badge.style.cssText='position:absolute;top:-2px;right:-2px;background:var(--accent);color:#fff;font-size:8px;font-weight:700;border-radius:50%;width:14px;height:14px;display:flex;align-items:center;justify-content:center;line-height:1';
        badge.textContent=count;
        cell.style.position='relative';
        cell.appendChild(badge);
      }
      cell.onclick=()=>showCalDetail(dateStr,rec);
    }
    grid.appendChild(cell);
  }
  renderCalActivityStats(records);
  renderCalPoderStats(records);
}

// Card colapsável do calendário (Treinos + Poder Bravo) — mesmo conceito visual dos cards da home,
// mas aqui começa sempre contraído e cada toque apenas abre/fecha o próprio card.
function toggleCalStatsCard(){
  const body=document.getElementById('calStatBody');
  const toggle=document.getElementById('calStatToggle');
  const willOpen=!body.classList.contains('open');
  body.classList.toggle('open',willOpen);
  toggle.classList.toggle('open',willOpen);
}

// Conta treinos executados no mês/ano atualmente navegados no calendário (todos os modos, com ou sem Poder Bravo).
function renderCalActivityStats(records){
  records = records || loadCalendar();
  let monthCount=0, yearCount=0;
  records.forEach(dayRec=>{
    const workouts = dayRec.workouts || (dayRec.name ? [{name:dayRec.name}] : []);
    const [y,m] = dayRec.date.split('-').map(Number);
    if(y===calYear){
      yearCount += workouts.length;
      if((m-1)===calMonth) monthCount += workouts.length;
    }
  });
  document.getElementById('calTreinosMes').textContent = monthCount;
  document.getElementById('calTreinosAno').textContent = yearCount;
  document.getElementById('calStatTreinosInline').textContent = monthCount;
  // Mesma fonte de dados, espelhada na tela "Registros" (item 6.2) —
  // qualquer mudança aqui vale pros dois lugares automaticamente.
  const p2mes=document.getElementById('prog2TreinosMes'), p2ano=document.getElementById('prog2TreinosAno');
  if(p2mes)p2mes.textContent=monthCount;
  if(p2ano)p2ano.textContent=yearCount;
}

// Recalcula e exibe as estatísticas de Poder Bravo a partir de todos os treinos salvos.
// Chamada sempre que o calendário é renderizado (abertura, navegação de mês, marcação, edição ou exclusão de treino),
// garantindo que as estatísticas fiquem sempre atualizadas automaticamente.
function renderCalPoderStats(records){
  records = records || loadCalendar();
  let monthSum=0, monthCount=0, monthRecord=0, yearSum=0, allTimeRecord=0;
  records.forEach(dayRec=>{
    const workouts = dayRec.workouts || (dayRec.name ? [{name:dayRec.name,poderBravo:dayRec.poderBravo}] : []);
    const [y,m] = dayRec.date.split('-').map(Number);
    const isCurrentMonth = (y===calYear && (m-1)===calMonth);
    const isCurrentYear = (y===calYear);
    workouts.forEach(w=>{
      if(w.poderBravo==null) return;
      const pb=w.poderBravo;
      if(pb>allTimeRecord) allTimeRecord=pb;
      if(isCurrentYear) yearSum+=pb;
      if(isCurrentMonth){
        monthSum+=pb;
        monthCount++;
        if(pb>monthRecord) monthRecord=pb;
      }
    });
  });
  const monthAvg = monthCount>0 ? Math.round(monthSum/monthCount) : 0;
  document.getElementById('calPoderMonthSum').textContent   = monthCount>0 ? monthSum : '–';
  document.getElementById('calPoderYearSum').textContent    = yearSum>0 ? yearSum : '–';
  document.getElementById('calPoderMonthAvg').textContent   = monthCount>0 ? monthAvg : '–';
  document.getElementById('calPoderMonthRecord').textContent= monthCount>0 ? monthRecord : '–';
  document.getElementById('calPoderAllRecord').textContent  = allTimeRecord>0 ? allTimeRecord : '–';
  document.getElementById('calStatPoderInline').textContent = monthCount>0 ? monthSum : '0';
  // Espelha na tela "Registros" (mesma fonte, item 6.2)
  const p2=(id,val)=>{const el=document.getElementById(id);if(el)el.textContent=val;};
  p2('prog2PoderMonthSum',   monthCount>0 ? monthSum : '–');
  p2('prog2PoderYearSum',    yearSum>0 ? yearSum : '–');
  p2('prog2PoderMonthAvg',   monthCount>0 ? monthAvg : '–');
  p2('prog2PoderMonthRecord',monthCount>0 ? monthRecord : '–');
  p2('prog2PoderAllRecord',  allTimeRecord>0 ? allTimeRecord : '–');
}
function showCalDetail(dateStr,rec){
  _calDetailDateStr = dateStr;
  const det=document.getElementById('calDayDetail');
  const [y,m,d]=dateStr.split('-');
  document.getElementById('calDetailDate').textContent=`${d}/${m}/${y}`;
  // Support legacy and new multi-workout format
  const workouts=rec.workouts||(rec.name?[{name:rec.name,obs:rec.obs||'',exTypes:[]}]:[]);
  const EX_TYPE_MAP={puxar:{emoji:'🏋️',label:'Puxar',color:'#9966CC'},inferiores:{emoji:'🦵',label:'Inferiores',color:'#C49A2A'},empurrar:{emoji:'💪',label:'Empurrar',color:'#4A8AFF'},core:{emoji:'🔥',label:'Core',color:'#00B860'},composto:{emoji:'⚡',label:'Composto',color:'#888'},cardio:{emoji:'🏃',label:'Cardio',color:'#E05050'}};
  let html='';
  workouts.forEach((w,i)=>{
    html+=`<div style="margin-bottom:${i<workouts.length-1?'14px':'0'}">`;
    html+=`<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:4px">`;
    html+=`<div style="display:flex;align-items:center;gap:8px">`;
    if(workouts.length>1)html+=`<div style="font-size:11px;color:#555;background:var(--surface2);padding:2px 8px;border-radius:8px">#${i+1}</div>`;
    if(w.time)html+=`<div style="font-size:11px;color:#555">${w.time}</div>`;
    html+=`</div>`;
    if(workouts.length>1)html+=`<button onclick="confirmDeleteWorkoutAt(${i})" style="font-size:11px;padding:3px 10px;border-radius:8px;border:1px solid rgba(255,77,109,.35);background:transparent;color:#ff4d6d;cursor:pointer">🗑</button>`;
    html+=`</div>`;
    html+=`<div style="font-family:'Bebas Neue',sans-serif;font-size:20px;letter-spacing:2px;color:var(--accent)">${w.name||'Bravo Play'}</div>`;
    if(w.exTypes&&w.exTypes.length){
      html+=`<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">`;
      w.exTypes.forEach(t=>{const et=EX_TYPE_MAP[t];if(et)html+=`<div style="display:flex;align-items:center;gap:4px;padding:3px 10px;border-radius:8px;background:var(--surface2);font-size:12px;color:${et.color};font-weight:600"><img src="ic_${t}.png?v=202506" style="width:21px;height:21px;object-fit:cover;border-radius:3px;flex-shrink:0"> ${et.label}</div>`;});
      html+=`</div>`;
    }
    if(w.poderBravo!=null){
      html+=`<div class="cal-detail-poder"><img src="ic_execucao.png?v=202506" alt=""><span class="cdp-label">Poder Bravo</span><span class="cdp-value">${w.poderBravo}</span></div>`;
    }
    if(w.obs)html+=`<div style="font-size:13px;color:#888;margin-top:5px;font-style:italic">${w.obs}</div>`;
    html+=`</div>`;
    if(i<workouts.length-1)html+=`<hr style="border:none;border-top:1px solid var(--surface2);margin:8px 0">`;
  });
  // Botão deletar dia inteiro só aparece quando há 1 treino; com múltiplos cada um tem o seu
  document.getElementById('btnDelWorkout').style.display = workouts.length===1 ? '' : 'none';
  document.getElementById('calDetailName').innerHTML='';
  document.getElementById('calDetailObs').innerHTML=html;
  det.classList.add('open');
}
let _calDetailDateStr = null;
document.getElementById('btnDelWorkout').onclick = confirmDeleteWorkout;

function confirmDeleteWorkout(){
  if(!_calDetailDateStr) return;
  const [y,m,d] = _calDetailDateStr.split('-');
  const dateToDelete = _calDetailDateStr;
  showDeleteConfirm(`Deletar o treino do dia ${d}/${m}/${y}?`, ()=>{
    const records = loadCalendar().filter(r => r.date !== dateToDelete);
    saveCalendar(records);
    document.getElementById('calDayDetail').classList.remove('open');
    _calDetailDateStr = null;
    renderCalendar();
    showToast('Treino deletado ✓');
  });
}

function confirmDeleteWorkoutAt(index){
  if(!_calDetailDateStr) return;
  const [y,m,d] = _calDetailDateStr.split('-');
  const dateToDelete = _calDetailDateStr;
  showDeleteConfirm(`Deletar o treino #${index+1} do dia ${d}/${m}/${y}?`, ()=>{
    const records = loadCalendar();
    const dayRec = records.find(r => r.date === dateToDelete);
    if(!dayRec) return;
    const workouts = dayRec.workouts || (dayRec.name ? [{name:dayRec.name,obs:dayRec.obs||'',exTypes:[]}] : []);
    workouts.splice(index, 1);
    if(workouts.length === 0){
      const filtered = records.filter(r => r.date !== dateToDelete);
      saveCalendar(filtered);
      document.getElementById('calDayDetail').classList.remove('open');
      _calDetailDateStr = null;
    } else {
      dayRec.workouts = workouts;
      delete dayRec.name; delete dayRec.obs;
      saveCalendar(records);
      showCalDetail(dateToDelete, dayRec);
    }
    renderCalendar();
    showToast('Treino deletado ✓');
  });
}

function showDeleteConfirm(msg, onConfirm){
  const overlay = document.createElement('div');
  overlay.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:24px';
  overlay.innerHTML=`<div style="background:var(--surface);border-radius:20px;padding:28px 24px;max-width:320px;width:100%;text-align:center">
    <div style="font-size:15px;color:var(--text);margin-bottom:24px;line-height:1.5">${msg}</div>
    <div style="display:flex;gap:12px">
      <button id="_delCancel" style="flex:1;padding:14px;border-radius:14px;border:1.5px solid var(--surface2);background:transparent;color:var(--muted);font-size:15px;cursor:pointer">Cancelar</button>
      <button id="_delConfirm" style="flex:1;padding:14px;border-radius:14px;border:none;background:#ff4d6d;color:#fff;font-size:15px;font-weight:700;cursor:pointer">Deletar</button>
    </div>
  </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('#_delCancel').onclick = ()=> overlay.remove();
  overlay.querySelector('#_delConfirm').onclick = ()=>{ overlay.remove(); onConfirm(); };
}

function showMarkPoderBravo(value){
  const block=document.getElementById('markPoderBravoBlock');
  if(value!=null){
    document.getElementById('markPoderBravoValue').textContent=value;
    block.style.display='flex';
  } else {
    block.style.display='none';
  }
}

function markCalendar(name,obs,exTypes,poderBravo){
  const today=new Date();
  const dateStr=`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  const records=loadCalendar();
  // Find existing day entry or create new one with workouts array
  let dayEntry=records.find(r=>r.date===dateStr);
  if(!dayEntry){
    dayEntry={date:dateStr,workouts:[]};
    records.push(dayEntry);
  }
  // Support legacy single-workout format: migrate to workouts array
  if(!dayEntry.workouts){dayEntry.workouts=[{name:dayEntry.name,obs:dayEntry.obs||'',exTypes:[]}];delete dayEntry.name;delete dayEntry.obs;}
  const newWorkout={name,obs:obs||'',exTypes:exTypes||[],time:new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})};
  if(poderBravo!=null) newWorkout.poderBravo=poderBravo;
  dayEntry.workouts.push(newWorkout);
  saveCalendar(records);
  showToast('Treino marcado no calendário ✓');
}

// ============================================================
// BRAVO PLAY: seleção de tipo de exercício na preparação
// ============================================================
const EX_TYPE_INFO={
  puxar:  {label:'PUXAR',    color:'#9966CC', border:'rgba(180,127,255,.5)', bg:'rgba(180,127,255,.22)'},
  inferiores:{label:'INFERIORES',color:'#C49A2A',border:'rgba(249,199,79,.5)', bg:'rgba(249,199,79,.2)'},
  empurrar:{label:'EMPURRAR', color:'#4A8AFF', border:'rgba(41,121,255,.5)',  bg:'rgba(41,121,255,.2)'},
  core:   {label:'CORE',     color:'#00B860', border:'rgba(0,230,118,.5)',   bg:'rgba(0,230,118,.2)'},
  composto:{label:'COMPOSTO', color:'#999',    border:'rgba(160,160,160,.5)',bg:'rgba(160,160,160,.2)'},
  cardio: {label:'CARDIO',   color:'#E05050', border:'rgba(255,80,80,.5)',   bg:'rgba(255,80,80,.2)'},
};
// Tipo selecionado na preparação atual (apenas 1 por exercício)
let autoCurrentPrepType=null;
// Acumulado de todos os tipos selecionados durante o treino
let autoWorkoutTypes=new Set();

function selectAutoPrepType(btn){
  const type=btn.dataset.type;
  const grid=document.getElementById('autoPrepExTypeGrid');
  const allBtns=grid.querySelectorAll('.auto-extype-btn');

  if(autoCurrentPrepType===type){
    // Deselecionar
    autoCurrentPrepType=null;
    allBtns.forEach(b=>b.classList.remove('selected'));
    grid.classList.add('none-selected');
  } else {
    autoCurrentPrepType=type;
    allBtns.forEach(b=>{
      b.classList.toggle('selected',b.dataset.type===type);
    });
    grid.classList.remove('none-selected');
  }
}

function resetAutoPrepType(){
  autoCurrentPrepType=null;
  const grid=document.getElementById('autoPrepExTypeGrid');
  if(grid){
    grid.querySelectorAll('.auto-extype-btn').forEach(b=>b.classList.remove('selected'));
    grid.classList.add('none-selected');
  }
}

function applyPrepTypeToExec(){
  const display=document.getElementById('autoExecTypeDisplay');
  if(!autoCurrentPrepType){
    display.classList.remove('visible');
    return;
  }
  const info=EX_TYPE_INFO[autoCurrentPrepType];
  const imgSrc='ic_'+autoCurrentPrepType+'.png?v=202506';

  // Chip (retrato + paisagem)
  document.getElementById('autoExecTypeImg').src=imgSrc;
  document.getElementById('autoExecTypeImg').alt=info.label;
  document.getElementById('autoExecTypeLabel').textContent=info.label;
  document.getElementById('autoExecTypeLabel').style.color=info.color;
  const chip=document.getElementById('autoExecTypeChip');
  chip.style.background='rgba(0,0,0,.1)';
  chip.style.border='1.5px solid '+info.border;
  display.classList.add('visible');

  // Acumula no conjunto do treino
  autoWorkoutTypes.add(autoCurrentPrepType);
}

function startAutoWorkout(){
  autoWorkoutTypes=new Set();
  resetAutoPrepType();
}


const REST_TABLE={
  '1-3':[180,210,240,270,300],
  '4-7':[90,105,120,150,180],
  '8-10':[50,60,75,90,120],
  '11-15':[40,50,60,75,90],
  '15-30':[30,40,45,60,75],
};

// ============================================================
// PODER BRAVO — pontuação de esforço (Bravo Play e Bravo)
// ============================================================
const PODER_BRAVO_REPS_VALUE={'1-3':5.0,'4-7':4.5,'8-10':4.0,'11-15':3.75,'15-30':3.5};
const PODER_BRAVO_INT_MULT=[1.0,1.25,1.6,2.0,2.5]; // indices 0..4 = Muito fácil..Limite
function poderSerie(repsKey,intIdx){
  const v=PODER_BRAVO_REPS_VALUE[repsKey];
  const m=PODER_BRAVO_INT_MULT[intIdx];
  return (v!=null&&m!=null)?v*m:0;
}
// Valor pendente de Poder Bravo do treino que está prestes a ser marcado no calendário.
// null quando o modo atual (Clássico/Circuito) não calcula Poder Bravo.
let pendingPoderBravo=null;

const AUTO_CIRC=2*Math.PI*44;
let auto={
  exIndex:1,serieNum:1,
  selectedRepsKey:null,selectedInt:null,
  restSecs:0,restTotal:0,
  execSecs:0,execTotal:60,execOverflow:false,
  prepSecs:15,_int:null,running:false,
  workoutName:'Bravo Play',
  pendingMarkName:'',
  poderBravoSum:0
};

function autoExName(){return'Exercício '+auto.exIndex;}

function startAutoMode(){
  getAC();
  auto.exIndex=1;auto.serieNum=1;
  auto.execSecs=60;auto.execTotal=60;auto.execOverflow=false;
  auto.prepSecs=15;
  auto.running=true;
  auto.poderBravoSum=0;
  startAutoWorkout(); // reset tipo de exercício acumulado
  showAutoPrep();
}

function showAutoPrep(){
  autoPrepPaused=false;
  document.getElementById('autoPrepSerieNum').textContent=auto.serieNum;
  document.getElementById('autoPrepExNum').textContent=auto.exIndex;
  const _apn=document.getElementById('autoPrepExName');_apn.textContent=autoExName();_apn.style.color='#F04E23';
  applyAccent('#F04E23');
  auto.prepSecs=15;
  resetAutoPrepType(); // limpa seleção para o novo exercício
  const ring=document.getElementById('autoPrepRing');
  ring.style.strokeDasharray=AUTO_CIRC;
  ring.style.strokeDashoffset=0;
  const prepBtn=document.getElementById('btnAutoPrepPlay');
  if(prepBtn){prepBtn.querySelector('svg').innerHTML=SVG_PAUSE;prepBtn.style.background='#F04E23';prepBtn.style.color='#fff';}
  showScreen('autoPrep');
  speak('Prepare-se. Escolha um exercício.');
  beep(800,.15,.5);
  clearInterval(auto._int);
  auto._int=setInterval(()=>{
    auto.prepSecs--;
    const s=Math.max(0,auto.prepSecs);
    document.getElementById('autoPrepTime').textContent=String(s).padStart(2,'0');
    ring.style.strokeDashoffset=AUTO_CIRC*(1-(s/15));
    if(s===3)beepCountdown();
    if(s<=0){clearInterval(auto._int);startAutoExec();}
  },1000);
}

function startAutoExec(){
  auto.execSecs=60;auto.execTotal=60;auto.execOverflow=false;
  document.getElementById('autoExecSerieNum').textContent=auto.serieNum;
  document.getElementById('autoExecExNum').textContent=auto.exIndex;
  const _aen=document.getElementById('autoExecExName');_aen.textContent=autoExName();_aen.style.color='#F04E23';
  document.getElementById('autoExecPhaseLabel').innerHTML='<img class="phase-icon" src="ic_execucao.png?v=202506" alt="">VAMOS!';
  document.getElementById('autoExecPhaseLabel').style.color='#F04E23';
  const ring=document.getElementById('autoExecRing');
  ring.style.strokeDasharray=AUTO_CIRC;
  ring.style.stroke='#F04E23';
  document.getElementById('autoExecTime').style.color='#F04E23';
  document.getElementById('autoExecOverflowLabel').style.opacity='0';
  const gFg0=document.getElementById('autoExecGaugeFg');
  if(gFg0){gFg0.style.stroke='#F04E23';}
  const gT0=document.getElementById('autoExecGaugeTime');
  if(gT0){gT0.style.color='#F04E23';}
  applyPrepTypeToExec(); // mostra o ícone do tipo selecionado na preparação
  showScreen('autoExec');
  speak('Vamos!');beep(1200,.15,.6);vibrate([80,30,80]);
  const fl=document.getElementById('flash');fl.style.background='#F04E23';fl.classList.add('on');setTimeout(()=>fl.classList.remove('on'),150);
  clearInterval(auto._int);
  auto._int=setInterval(()=>{
    auto.execSecs--;
    updateAutoExecUI();
    if(auto.execSecs===3&&!auto.execOverflow)beepCountdown();
    if(auto.execSecs<=0&&!auto.execOverflow){
      auto.execOverflow=true;
      document.getElementById('autoExecOverflowLabel').style.opacity='1';
    }
  },1000);
}

function updateAutoExecUI(){
  const ring=document.getElementById('autoExecRing');
  const gFg=document.getElementById('autoExecGaugeFg');
  const gT=document.getElementById('autoExecGaugeTime');
  if(!auto.execOverflow){
    const s=Math.max(0,auto.execSecs);
    document.getElementById('autoExecTime').textContent=String(s).padStart(2,'0');
    document.getElementById('autoExecSub').textContent='segundos';
    ring.style.strokeDashoffset=AUTO_CIRC*(1-(s/auto.execTotal));
    if(gFg)gFg.style.strokeDashoffset=GAUGE_CIRC*(1-(auto.execTotal>0?s/auto.execTotal:0));
    if(gT)gT.textContent=String(s).padStart(2,'0');
  } else {
    const elapsed=Math.abs(auto.execSecs);
    const mm=String(Math.floor(elapsed/60)).padStart(2,'0');
    const ss=String(elapsed%60).padStart(2,'0');
    document.getElementById('autoExecTime').textContent=`+${mm}:${ss}`;
    document.getElementById('autoExecSub').textContent='';
    ring.style.strokeDashoffset=AUTO_CIRC;
    if(gFg)gFg.style.strokeDashoffset=GAUGE_CIRC;
    if(gT)gT.textContent=`+${mm}:${ss}`;
  }
}

document.getElementById('btnAutoSerieOk').onclick=()=>{
  clearInterval(auto._int);
  document.getElementById('autoRepsSerieNum').textContent=auto.serieNum;
  document.getElementById('autoRepsSerieNumVis').textContent=auto.serieNum;
  document.getElementById('autoRepsExNum').textContent=auto.exIndex;
  showScreen('autoReps');
};

// Auto prep controls
let autoPrepPaused=false;
document.getElementById('btnAutoPrepBack').onclick=()=>{
  clearInterval(auto._int);autoPrepPaused=false;
  applyAccent('#F04E23');showScreen('home');
};
document.getElementById('btnAutoPrepPlay').onclick=()=>{
  autoPrepPaused=!autoPrepPaused;
  const btn=document.getElementById('btnAutoPrepPlay');
  setPlayIcon(btn,!autoPrepPaused,'#F04E23');
  if(autoPrepPaused){
    clearInterval(auto._int);
  } else {
    const ring=document.getElementById('autoPrepRing');
    auto._int=setInterval(()=>{
      auto.prepSecs--;
      const s=Math.max(0,auto.prepSecs);
      document.getElementById('autoPrepTime').textContent=String(s).padStart(2,'0');
      ring.style.strokeDashoffset=AUTO_CIRC*(1-(s/15));
      if(s===3)beepCountdown();
      if(s<=0){clearInterval(auto._int);autoPrepPaused=false;startAutoExec();}
    },1000);
  }
};
document.getElementById('btnAutoPrepSkip').onclick=()=>{
  clearInterval(auto._int);autoPrepPaused=false;startAutoExec();
};

// Auto exec controls (fix 9)
let autoExecPaused=false;
document.getElementById('btnAutoExecBack').onclick=()=>{
  clearInterval(auto._int);autoExecPaused=false;
  applyAccent('#F04E23');showScreen('home');
};
const SVG_PAUSE='<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>';
const SVG_PLAY='<path d="M8 5v14l11-7z"/>';
function setPlayIcon(btn,playing,bg,color){
  btn.querySelector('svg').innerHTML=playing?SVG_PAUSE:SVG_PLAY;
  btn.style.background=playing?bg:'#555';
  if(color)btn.style.color=playing?color:'#fff';
}
document.getElementById('btnAutoExecPlay').onclick=()=>{
  autoExecPaused=!autoExecPaused;
  const btn=document.getElementById('btnAutoExecPlay');
  setPlayIcon(btn,!autoExecPaused,'#F04E23');
  if(autoExecPaused){
    clearInterval(auto._int);
  } else {
    auto._int=setInterval(()=>{
      auto.execSecs--;updateAutoExecUI();
      if(auto.execSecs===3&&!auto.execOverflow)beepCountdown();
      if(auto.execSecs<=0&&!auto.execOverflow){
        auto.execOverflow=true;
        document.getElementById('autoExecOverflowLabel').style.opacity='1';
      }
    },1000);
  }
};
document.getElementById('btnAutoExecSkip').onclick=()=>{
  clearInterval(auto._int);autoExecPaused=false;
  document.getElementById('autoRepsSerieNum').textContent=auto.serieNum;
  document.getElementById('autoRepsSerieNumVis').textContent=auto.serieNum;
  document.getElementById('autoRepsExNum').textContent=auto.exIndex;
  showScreen('autoReps');
};

// Auto rest controls (fix 9)
let autoRestPaused=false;
document.getElementById('btnAutoRestBack').onclick=()=>{
  clearInterval(auto._int);autoRestPaused=false;
  applyAccent('#F04E23');showScreen('home');
};
document.getElementById('btnAutoRestPlay').onclick=()=>{
  autoRestPaused=!autoRestPaused;
  const btn=document.getElementById('btnAutoRestPlay');
  setPlayIcon(btn,!autoRestPaused,'#F04E23');
  if(autoRestPaused){
    clearInterval(auto._int);
  } else {
    auto._int=setInterval(()=>{
      auto.restSecs--;updateAutoRestUI();
      if(auto.restSecs===3)beepCountdown();
      if(auto.restSecs<=0){clearInterval(auto._int);onAutoRestDone();}
    },1000);
  }
};
document.getElementById('btnAutoRestSkip').onclick=()=>{
  clearInterval(auto._int);autoRestPaused=false;onAutoRestDone();
};

// Brain prep controls
let brainPrepPaused=false;
document.getElementById('btnBrainPrepBack').onclick=()=>{
  clearInterval(brain._int);brainPrepPaused=false;releaseWakeLock();applyAccent('#F04E23');showScreen('home');
};
document.getElementById('btnBrainPrepPlay').onclick=()=>{
  brainPrepPaused=!brainPrepPaused;
  const btn=document.getElementById('btnBrainPrepPlay');
  setPlayIcon(btn,!brainPrepPaused,'#F04E23','#fff');
  if(brainPrepPaused){
    clearInterval(brain._int);
  } else {
    let secs=parseInt(document.getElementById('brainPrepTime').textContent)||0;
    const ring=document.getElementById('brainPrepRing');
    brain._int=setInterval(()=>{
      secs--;
      const s=Math.max(0,secs);
      document.getElementById('brainPrepTime').textContent=String(s).padStart(2,'0');
      ring.style.strokeDashoffset=AUTO_CIRC*(1-(s/brain.prepSecs));
      if(s===3)beepCountdown();
      if(s<=0){clearInterval(brain._int);brainPrepPaused=false;startBrainExec();}
    },1000);
  }
};
document.getElementById('btnBrainPrepSkip').onclick=()=>{
  clearInterval(brain._int);brainPrepPaused=false;startBrainExec();
};

// Brain exec controls
let brainExecPaused=false;
document.getElementById('btnBrainExecBack').onclick=()=>{
  clearInterval(brain._int);brainExecPaused=false;releaseWakeLock();applyAccent('#F04E23');showScreen('home');
};
document.getElementById('btnBrainExecPlay').onclick=()=>{
  brainExecPaused=!brainExecPaused;
  const btn=document.getElementById('btnBrainExecPlay');
  setPlayIcon(btn,!brainExecPaused,brainColor('action'));
  if(brainExecPaused){
    clearInterval(brain._int);
  } else {
    brain._int=setInterval(()=>{
      brain.execSecs--;
      updateBrainExecUI();
      if(brain.execSecs===3&&!brain.execOverflow)beepCountdown();
      if(brain.execSecs<=0&&!brain.execOverflow){
        brain.execOverflow=true;
        clearInterval(brain._int);
        brainSerieOk();
      }
    },1000);
  }
};
document.getElementById('btnBrainExecSkip').onclick=()=>{
  clearInterval(brain._int);brainExecPaused=false;
  document.getElementById('brainRepsSerieNum').textContent=brain.serieNum;
  document.getElementById('brainRepsSerieNumVis').textContent=brain.serieNum;
  document.getElementById('brainRepsExNum').textContent=brain.exIndex+1;
  showScreen('brainReps');
};

function selectReps(btn){
  auto.selectedRepsKey=btn.dataset.restKey;
  document.getElementById('autoIntSerieNum').textContent=auto.serieNum;
  document.getElementById('autoIntSerieNumVis').textContent=auto.serieNum;
  document.getElementById('autoIntExNum').textContent=auto.exIndex;
  showScreen('autoIntensity');
}

function selectIntensity(btn){
  auto.selectedInt=parseInt(btn.dataset.int);
  const restSecs=REST_TABLE[auto.selectedRepsKey][auto.selectedInt];
  auto.restSecs=restSecs;auto.restTotal=restSecs;
  auto.poderBravoSum+=poderSerie(auto.selectedRepsKey,auto.selectedInt);
  startAutoRest();
}

function startAutoRest(){
  document.getElementById('autoRestSerieNum').textContent=auto.serieNum;
  document.getElementById('autoRestExNum').textContent=auto.exIndex;
  const ring=document.getElementById('autoRestRing');
  ring.style.strokeDasharray=AUTO_CIRC;ring.style.strokeDashoffset=0;
  updateAutoRestUI();
  showScreen('autoRest');
  speak('Recuperação.');beep(800,.15,.5);
  const fl=document.getElementById('flash');fl.style.background='#F04E23';fl.classList.add('on');setTimeout(()=>fl.classList.remove('on'),150);
  clearInterval(auto._int);
  auto._int=setInterval(()=>{
    auto.restSecs--;
    updateAutoRestUI();
    if(auto.restSecs===3)beepCountdown();
    if(auto.restSecs<=0){clearInterval(auto._int);onAutoRestDone();}
  },1000);
}

function updateAutoRestUI(){
  const s=Math.max(0,auto.restSecs);
  const mm=String(Math.floor(s/60)).padStart(2,'0');
  const ss=String(s%60).padStart(2,'0');
  document.getElementById('autoRestTime').textContent=`${mm}:${ss}`;
  document.getElementById('autoRestRing').style.strokeDashoffset=AUTO_CIRC*(1-(auto.restTotal>0?s/auto.restTotal:0));
}

// Skip-rest helpers used from rest screen buttons
function autoSkipRestNextSerie(){
  if(auto.restSecs<=0){
    clearInterval(auto._int);
    auto.serieNum++;
    startAutoExecDirect();
    return;
  }
  const s=Math.max(0,Math.ceil(auto.restSecs));
  document.getElementById('earlyRestSubtext').textContent=`Restam ${s}s de recuperação.`;
  document.getElementById('earlyRestModal').classList.add('open');
}
function autoSkipRestNewExercise(){
  clearInterval(auto._int);
  auto.exIndex++;auto.serieNum=1;
  showAutoPrep();
}
function autoSkipRestFinish(){
  clearInterval(auto._int);
  autoFinishWorkout();
}

document.getElementById('btnEarlyRestContinue').onclick=()=>{
  document.getElementById('earlyRestModal').classList.remove('open');
  clearInterval(auto._int);
  auto.serieNum++;
  startAutoExecDirect();
};
document.getElementById('btnEarlyRestWait').onclick=()=>{
  document.getElementById('earlyRestModal').classList.remove('open');
};
document.getElementById('earlyRestModal').onclick=e=>{
  if(e.target.id==='earlyRestModal')document.getElementById('earlyRestModal').classList.remove('open');
};

function onAutoRestDone(){
  beep(880,.15,.6,'sine',0);beep(1100,.15,.6,'sine',.2);vibrate([80,30,80]);
  speak('Pronto pra continuar?');
  document.getElementById('autoContinueSerieNum').textContent=auto.serieNum;
  document.getElementById('autoContinueExName').textContent=autoExName();
  showScreen('autoContinue');
}

function startAutoExecDirect(){
  // Goes straight to execution without prep countdown
  auto.execSecs=60;auto.execTotal=60;auto.execOverflow=false;
  document.getElementById('autoExecSerieNum').textContent=auto.serieNum;
  document.getElementById('autoExecExNum').textContent=auto.exIndex;
  document.getElementById('autoExecExName').textContent=autoExName();
  document.getElementById('autoExecPhaseLabel').innerHTML='<img class="phase-icon" src="ic_execucao.png?v=202506" alt="">VAMOS!';
  document.getElementById('autoExecPhaseLabel').style.color='#F04E23';
  const ring=document.getElementById('autoExecRing');
  ring.style.strokeDasharray=AUTO_CIRC;ring.style.stroke='#F04E23';
  document.getElementById('autoExecTime').style.color='#F04E23';
  document.getElementById('autoExecOverflowLabel').style.opacity='0';
  const gFg0=document.getElementById('autoExecGaugeFg');
  if(gFg0){gFg0.style.stroke='#F04E23';}
  const gT0=document.getElementById('autoExecGaugeTime');
  if(gT0){gT0.style.color='#F04E23';}
  applyPrepTypeToExec(); // mostra o ícone do tipo selecionado
  showScreen('autoExec');
  speak('Vamos!');beep(1200,.15,.6);vibrate([80,30,80]);
  const fl=document.getElementById('flash');fl.style.background='#F04E23';fl.classList.add('on');setTimeout(()=>fl.classList.remove('on'),150);
  clearInterval(auto._int);
  auto._int=setInterval(()=>{
    auto.execSecs--;
    updateAutoExecUI();
    if(auto.execSecs===3&&!auto.execOverflow)beepCountdown();
    if(auto.execSecs<=0&&!auto.execOverflow){
      auto.execOverflow=true;
      document.getElementById('autoExecOverflowLabel').style.opacity='1';
    }
  },1000);
}

function autoNextSerie(){
  auto.serieNum++;
  startAutoExecDirect(); // Fix 6: nova série vai direto para execução, sem prep
}

function autoNewExercise(){
  auto.exIndex++;auto.serieNum=1;
  showAutoPrep(); // novo exercício tem tempo de preparação
}

function autoFinishWorkout(){
  clearInterval(auto._int);
  auto.pendingMarkName='Bravo Play';
  pendingPoderBravo=Math.ceil(auto.poderBravoSum);
  speak('Treino concluído. Parabéns!');
  beep(880,.15,.6,'sine',0);beep(1100,.15,.6,'sine',.2);beep(1320,.3,.7,'sine',.4);
  vibrate([100,50,100,50,200]);
  document.getElementById('finishSub').textContent='Bravo Play';
  showScreen('finish');
  showBravoFixed('Bravo Play');
  setTimeout(()=>{
    document.getElementById('markWorkoutName').textContent=auto.pendingMarkName;
    document.getElementById('markWorkoutObs').value='';
    showMarkPoderBravo(pendingPoderBravo);
    // Pré-seleciona os tipos acumulados durante o treino
    resetExTypes();
    autoWorkoutTypes.forEach(t=>{
      const btn=document.querySelector(`.mark-extype-btn[data-type="${t}"]`);
      if(btn) toggleExType(btn);
    });
    document.getElementById('markWorkoutModal').classList.add('open');
  },2000);
}

let selectedExTypes=new Set();
const EX_TYPE_COLORS={
  puxar:'rgba(180,127,255,.25)',
  inferiores:'rgba(249,199,79,.3)',
  empurrar:'rgba(41,121,255,.25)',
  core:'rgba(0,230,118,.25)',
  composto:'rgba(160,160,160,.25)',
  cardio:'rgba(255,80,80,.25)'
};
const EX_TYPE_BORDER={
  puxar:'#9966CC',
  inferiores:'#C49A2A',
  empurrar:'#4A8AFF',
  core:'#00B860',
  composto:'#999',
  cardio:'#E05050'
};
function toggleExType(btn){
  const t=btn.dataset.type;
  if(selectedExTypes.has(t)){
    selectedExTypes.delete(t);
  } else {
    selectedExTypes.add(t);
  }
  // Update visual state for all buttons
  document.querySelectorAll('.mark-extype-btn').forEach(b=>{
    const bt=b.dataset.type;
    const w=b.parentElement;
    const label=w.querySelector('span');
    // remove existing checkmark if any
    let ck=b.querySelector('.extype-check');
    if(selectedExTypes.has(bt)){
      b.style.background=EX_TYPE_COLORS[bt]||'rgba(180,127,255,.2)';
      b.style.border='3px solid '+(EX_TYPE_BORDER[bt]||'#9966CC');
      b.style.opacity='1';
      w.style.transform='scale(1.08)';
      if(label){label.style.fontWeight='700';label.style.textDecoration='underline';}
      if(!ck){
        ck=document.createElement('div');
        ck.className='extype-check';
        ck.innerHTML='✓';
        ck.style.cssText='position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:28px;font-weight:900;color:#fff;text-shadow:0 1px 4px rgba(0,0,0,.55);pointer-events:none;';
        b.appendChild(ck);
      }
    } else {
      b.style.background='transparent';
      b.style.border='1.5px solid '+(EX_TYPE_BORDER[bt]+'44'||'rgba(180,127,255,.3)');
      b.style.opacity='0.55';
      w.style.transform='scale(1)';
      if(label){label.style.fontWeight='600';label.style.textDecoration='none';}
      if(ck) ck.remove();
    }
  });
  // if nothing selected, reset opacity
  if(selectedExTypes.size===0){
    document.querySelectorAll('.mark-extype-btn').forEach(b=>{b.style.opacity='1';});
  }
}
function resetExTypes(){
  selectedExTypes=new Set();
  document.querySelectorAll('.mark-extype-btn').forEach(b=>{
    b.style.background='transparent';
    b.style.border='1.5px solid '+(EX_TYPE_BORDER[b.dataset.type]+'44'||'rgba(180,127,255,.3)');
    b.style.opacity='1';
    b.parentElement.style.transform='scale(1)';
    const label=b.parentElement.querySelector('span');
    if(label){label.style.fontWeight='600';label.style.textDecoration='none';}
    const ck=b.querySelector('.extype-check');
    if(ck) ck.remove();
  });
}

document.getElementById('btnMarkDone').onclick=()=>{
  const obs=document.getElementById('markWorkoutObs').value.trim();
  markCalendar(auto.pendingMarkName,obs,[...selectedExTypes],pendingPoderBravo);
  pendingPoderBravo=null;
  showMarkPoderBravo(null);
  resetExTypes();
  document.getElementById('markWorkoutModal').classList.remove('open');
  hideBravoFixed();applyAccent('#F04E23');showScreen('home');
  incrementWorkoutCount();checkRegPrompt();
};
function skipMarkWorkout(){
  pendingPoderBravo=null;
  showMarkPoderBravo(null);
  document.getElementById('markWorkoutModal').classList.remove('open');
  hideBravoFixed();applyAccent('#F04E23');showScreen('home');
  incrementWorkoutCount();checkRegPrompt();
}
document.getElementById('markWorkoutModal').onclick=e=>{if(e.target.id==='markWorkoutModal')skipMarkWorkout();};

// Calendar mark flow now auto-triggers from showFinish and autoFinishWorkout


// ============================================================
// BRAVO — clássico com descanso calculado pelo esforço
// ============================================================
let brain={
  preset:null,exIndex:0,serieNum:1,
  totalExercises:2,totalSeries:3,actionSecs:40,prepSecs:15,
  execSecs:0,execTotal:0,execOverflow:false,
  restSecs:0,restTotal:0,
  _int:null,running:false,
  pendingMarkName:'',_afterRest:'',
  poderBravoSum:0
};

function startBrainMode(p){
  getAC();
  brain.preset=p;
  brain.totalExercises=p.brainExCount||2;
  brain.totalSeries=p.brainSeries||3;
  brain.actionSecs=p.brainAction||40;
  brain.prepSecs=p.brainPrep||15;
  brain.exIndex=0;brain.serieNum=1;
  brain.execOverflow=false;brain.running=true;
  brain.pendingMarkName=p.name;
  brain.poderBravoSum=0;
  applyAccent('#F04E23');
  brain._cardColor=p.color||'#F04E23';
  acquireWakeLock();
  showBrainPrep(); // prep sempre no início
}

function brainExName(){
  const names=brain.preset?.brainExercises;
  return (names&&names[brain.exIndex])||('Exercício '+(brain.exIndex+1));
}

function brainColor(phase){
  // used for labels, name color, play button, flash — stays orange brand color
  return '#F04E23';
}
function ringPhaseColor(phase){
  // used only for the ring + time digits inside it
  if(phase==='prep')   return '#F2B33D'; // amarelo
  if(phase==='action') return '#F04E23'; // execução: laranja
  return '#D9483D'; // recuperação: vermelho
}

function showBrainPrep(){
  clearInterval(brain._int);
  brainPrepPaused=false;
  const prepBtn=document.getElementById('btnBrainPrepPlay');
  if(prepBtn){prepBtn.querySelector('svg').innerHTML=SVG_PAUSE;prepBtn.style.background='#F04E23';prepBtn.style.color='#000';}
  const c=brainColor('prep'); // #F04E23
  const rc=ringPhaseColor('prep');
  document.getElementById('brainPrepSerieNum').textContent=brain.serieNum;
  document.getElementById('brainPrepSerieTotal').textContent=brain.totalSeries;
  document.getElementById('brainPrepExCur').textContent=brain.exIndex+1;
  document.getElementById('brainPrepExTotal').textContent=brain.totalExercises;
  const _bpn=document.getElementById('brainPrepExName');
  if(brain.totalExercises>1){_bpn.textContent=brainExName();_bpn.style.color=brain._cardColor||'#F04E23';_bpn.style.display='block';}
  else{_bpn.style.display='none';}
  const ring=document.getElementById('brainPrepRing');
  ring.style.strokeDasharray=AUTO_CIRC;ring.style.strokeDashoffset=0;ring.style.stroke=rc;
  document.getElementById('brainPrepTime').style.color=c;
  const label=document.getElementById('brainPrepPhaseLabel');
  if(label){label.innerHTML='<img class="phase-icon" src="ic_preparacao.png?v=202506" alt="">PREPARE-SE';label.style.color=c;}
  let secs=brain.prepSecs;
  document.getElementById('brainPrepTime').textContent=String(secs).padStart(2,'0');
  setGauge('brainPrep',secs,brain.prepSecs,rc);
  // Vídeo: já aparece na fase de preparação, tocando em loop e mudo
  const vids=brain.preset?.brainExerciseVideos;
  showYtEmbed('brainPrepYtWrap',extractYtId(vids?.[brain.exIndex]||''),'brainPrepCenter',brainExName());
  showScreen('brainPrep');
  speak('Prepare-se.');beep(800,.15,.5);
  const fl=document.getElementById('flash');fl.style.background=c;fl.classList.add('on');setTimeout(()=>fl.classList.remove('on'),150);
  brain._int=setInterval(()=>{
    secs--;
    const s=Math.max(0,secs);
    document.getElementById('brainPrepTime').textContent=String(s).padStart(2,'0');
    ring.style.strokeDashoffset=AUTO_CIRC*(1-(s/brain.prepSecs));
    setGauge('brainPrep',s,brain.prepSecs,rc);
    if(s===3)beepCountdown();
    if(s<=0){clearInterval(brain._int);startBrainExec();}
  },1000);
}

function startBrainExec(){
  clearInterval(brain._int);
  brainExecPaused=false;
  const exBtn=document.getElementById('btnBrainExecPlay');
  if(exBtn){exBtn.querySelector('svg').innerHTML=SVG_PAUSE;exBtn.style.background=brainColor('action');}
  brain.execSecs=brain.actionSecs;brain.execTotal=brain.actionSecs;brain.execOverflow=false;
  const c=brainColor('action');
  const rc=ringPhaseColor('action');
  const ring=document.getElementById('brainExecRing');
  const label=document.getElementById('brainExecPhaseLabel');
  label.innerHTML='<img class="phase-icon" src="ic_execucao.png?v=202506" alt="">VAMOS!';label.style.color=c;
  const _ben=document.getElementById('brainExecExName');
  if(brain.totalExercises>1){_ben.textContent=brainExName();_ben.style.color=brain._cardColor||'#F04E23';_ben.style.display='block';}
  else{_ben.style.display='none';}
  document.getElementById('brainExecSerieCur').textContent=brain.serieNum;
  document.getElementById('brainExecSerieTotal').textContent=brain.totalSeries;
  document.getElementById('brainExecExCur').textContent=brain.exIndex+1;
  document.getElementById('brainExecExTotal').textContent=brain.totalExercises;
  document.getElementById('brainExecTime').style.color=c;
  ring.style.strokeDasharray=AUTO_CIRC;ring.style.stroke=rc;
  setGauge('brainExec',brain.execSecs,brain.execTotal,rc);
  // Vídeo: mesmo vídeo iniciado na preparação continua tocando (sem reiniciar caso já esteja rodando)
  const vids=brain.preset?.brainExerciseVideos;
  showYtEmbed('brainExecYtWrap',extractYtId(vids?.[brain.exIndex]||''),'brainExecCenter',brainExName());
  showScreen('brainExec');
  speak('Vamos!');beep(1200,.15,.6);vibrate([80,30,80]);
  const fl=document.getElementById('flash');fl.style.background=c;fl.classList.add('on');setTimeout(()=>fl.classList.remove('on'),150);
  brain._int=setInterval(()=>{
    brain.execSecs--;
    updateBrainExecUI();
    if(brain.execSecs===3&&!brain.execOverflow)beepCountdown();
    if(brain.execSecs<=0&&!brain.execOverflow){
      brain.execOverflow=true;
      clearInterval(brain._int);
      brainSerieOk();
    }
  },1000);
}

function updateBrainExecUI(){
  const c=brainColor('action');
  const ring=document.getElementById('brainExecRing');
  const timeEl=document.getElementById('brainExecTime');
  const gaugeFg=document.getElementById('brainExecGaugeFg');
  const gaugeTime=document.getElementById('brainExecGaugeTime');
  if(!brain.execOverflow){
    const s=Math.max(0,brain.execSecs);
    timeEl.textContent=String(s).padStart(2,'0');
    ring.style.strokeDashoffset=AUTO_CIRC*(1-(s/brain.execTotal));
    if(gaugeFg)gaugeFg.style.strokeDashoffset=GAUGE_CIRC*(1-(s/brain.execTotal));
    if(gaugeTime)gaugeTime.textContent=String(s).padStart(2,'0');
  } else {
    const elapsed=Math.abs(brain.execSecs);
    const txt=`+${String(Math.floor(elapsed/60)).padStart(2,'0')}:${String(elapsed%60).padStart(2,'0')}`;
    timeEl.textContent=txt;
    ring.style.strokeDashoffset=AUTO_CIRC;
    if(gaugeFg)gaugeFg.style.strokeDashoffset=0;
    if(gaugeTime)gaugeTime.textContent=txt;
  }
}

function brainSerieOk(){
  clearInterval(brain._int);
  document.getElementById('brainRepsSerieNum').textContent=brain.serieNum;
  document.getElementById('brainRepsSerieNumVis').textContent=brain.serieNum;
  document.getElementById('brainRepsExNum').textContent=brain.exIndex+1;
  showScreen('brainReps');
}

function selectBrainReps(btn){
  brain._repsKey=btn.dataset.restKey;
  document.getElementById('brainIntSerieNum').textContent=brain.serieNum;
  document.getElementById('brainIntSerieNumVis').textContent=brain.serieNum;
  document.getElementById('brainIntExNum').textContent=brain.exIndex+1;
  showScreen('brainIntensity');
}

function selectBrainIntensity(btn){
  const intIdx=parseInt(btn.dataset.int);
  const restSecs=REST_TABLE[brain._repsKey][intIdx];
  brain.restSecs=restSecs;brain.restTotal=restSecs;
  brain.poderBravoSum+=poderSerie(brain._repsKey,intIdx);
  const isLastSerie=(brain.serieNum>=brain.totalSeries);
  const isLastEx=(brain.exIndex>=brain.totalExercises-1);
  if(isLastSerie&&isLastEx)       brain._afterRest='finish';
  else if(isLastSerie)            brain._afterRest='nextEx';
  else                            brain._afterRest='nextSerie';
  startBrainRest();
}

function startBrainRest(){
  clearInterval(brain._int);
  const c=brainColor('rest');
  const rc=ringPhaseColor('rest');
  document.getElementById('brainRestSerieNum').textContent=brain.serieNum;
  document.getElementById('brainRestSerieTotal').textContent=brain.totalSeries;
  document.getElementById('brainRestExCur').textContent=brain.exIndex+1;
  document.getElementById('brainRestExTotal').textContent=brain.totalExercises;
  document.getElementById('brainRestPhaseLabel').style.color=c;
  document.getElementById('brainRestTime').style.color=c;
  const ring=document.getElementById('brainRestRing');
  ring.style.strokeDasharray=AUTO_CIRC;ring.style.strokeDashoffset=0;ring.style.stroke=rc;
  updateBrainRestUI();
  showScreen('brainRest');
  speak('Recuperação.');beep(800,.15,.5);
  const fl=document.getElementById('flash');fl.style.background=c;fl.classList.add('on');setTimeout(()=>fl.classList.remove('on'),150);
  brain._int=setInterval(()=>{
    brain.restSecs--;
    updateBrainRestUI();
    if(brain.restSecs===3)beepCountdown();
    if(brain.restSecs<=0){clearInterval(brain._int);onBrainRestDone();}
  },1000);
}

function updateBrainRestUI(){
  const s=Math.max(0,brain.restSecs);
  document.getElementById('brainRestTime').textContent=`${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
  document.getElementById('brainRestRing').style.strokeDashoffset=AUTO_CIRC*(1-(brain.restTotal>0?s/brain.restTotal:0));
}

// "Avançar agora" — mostra modal igual ao Bravo Play (earlyRestModal) com tempo restante
function brainSkipRest(){
  if(brain.restSecs<=0){
    clearInterval(brain._int);onBrainRestDone();return;
  }
  const s=Math.max(0,Math.ceil(brain.restSecs));
  document.getElementById('earlyRestSubtext').textContent=`Restam ${s}s de recuperação.`;
  document.getElementById('earlyRestModal').classList.add('open');
  // Override the continue button to advance brain mode
  document.getElementById('btnEarlyRestContinue').onclick=()=>{
    document.getElementById('earlyRestModal').classList.remove('open');
    clearInterval(brain._int);
    onBrainRestDone();
    // Restore original Bravo Play handler after use
    document.getElementById('btnEarlyRestContinue').onclick=()=>{
      document.getElementById('earlyRestModal').classList.remove('open');
      clearInterval(auto._int);auto.serieNum++;startAutoExecDirect();
    };
  };
}

function onBrainRestDone(){
  beep(880,.15,.6,'sine',0);beep(1100,.15,.6,'sine',.2);vibrate([80,30,80]);
  const after=brain._afterRest;
  if(after==='finish'){
    brainFinishWorkout();
  } else if(after==='nextEx'){
    // novo exercício → mostra prep
    brain.exIndex++;brain.serieNum=1;
    showBrainPrep();
  } else {
    // próxima série → vai DIRETO para exec (sem prep)
    brain.serieNum++;
    speak('Próxima série.');
    startBrainExec();
  }
}

function brainFinishWorkout(){
  clearInterval(brain._int);
  releaseWakeLock();
  pendingPoderBravo=Math.ceil(brain.poderBravoSum);
  speak('Treino concluído. Parabéns!');
  beep(880,.15,.6,'sine',0);beep(1100,.15,.6,'sine',.2);beep(1320,.3,.7,'sine',.4);
  vibrate([100,50,100,50,200]);
  const label=brain.pendingMarkName||'Treino do Dia 🏋️';
  auto.pendingMarkName=label;
  document.getElementById('finishSub').textContent=label;
  showScreen('finish');
  showBravoFixed(label);
  setTimeout(()=>{
    document.getElementById('markWorkoutName').textContent=label;
    document.getElementById('markWorkoutObs').value='';
    showMarkPoderBravo(pendingPoderBravo);
    resetExTypes();
    document.getElementById('markWorkoutModal').classList.add('open');
  },2000);
}

