/* ============================================================
   Iskra — aplikacja (kreator / czat / aktywność / studio)
   ============================================================ */
'use strict';

const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];

let persona = {
  name:'', role:'', intro:'', goal:'',
  color:'#ff7a1a', shape:'circle', eyes:'dot', acc:'none', aura:'sparks', size:1, pet:false,
  proactive:60, humor:40, formal:30, terse:50,
  skills:['news','cal'],
};
let rules = DEFAULT_RULES.slice();
let step = 1;
let dot=null, chatDot=null;
let currentView='create';
let tasks=[]; let activityTimer=null; let paused=false;

/* ---------- toast ---------- */
function toast(msg, isErr){
  const w=$('#toasts');
  const t=document.createElement('div');
  t.className='toast'+(isErr?' err':'');
  t.textContent=msg;
  w.appendChild(t);
  setTimeout(()=>{ t.style.opacity='0'; t.style.transition='opacity .4s'; setTimeout(()=>t.remove(),400); }, 3400);
}

/* ---------- widoki ---------- */
function showView(v){
  currentView=v;
  $$('.view').forEach(x=>x.hidden = x.id!=='view-'+v);
  $$('.nav-btn').forEach(b=>b.classList.toggle('active', b.dataset.view===v));
  closeDrawer();
  if(v==='chat'){ chatDot && chatDot.start(); }
  window.scrollTo({top:0});
}

/* ---------- drawer ---------- */
function openDrawer(){ $('#drawer').classList.add('open'); $('#drawerBackdrop').hidden=false; }
function closeDrawer(){ $('#drawer').classList.remove('open'); $('#drawerBackdrop').hidden=true; }

function selectPreset(i){
  const p=PRESETS[i];
  Object.assign(persona, p.persona, {
    color:p.color, shape:p.shape, eyes:p.eyes, acc:p.acc, aura:p.aura, pet:p.pet, size:p.size
  });
  // sugeruj imię tylko gdy pole puste lub poprzednio z presetu
  const nm=$('#f_name');
  if(!nm.dataset.touched || nm.dataset.fromPreset==='1'){
    nm.value=p.name; persona.name=p.name; nm.dataset.fromPreset='1';
  }
  applyPersonaToUI(); applyPreview();
  [...$('#charGallery').children].forEach((c,j)=>c.classList.toggle('sel', j===i));
  toast(`Wybrano ${p.name} — dopasuj szczegóły niżej albo idź dalej.`);
}

// === kreator ===
function initWizard(){
  // === GALERIA POSTACI ===
  const gallery=$('#charGallery');
  PRESETS.forEach((p,i)=>{
    const card=document.createElement('button');
    card.type='button'; card.className='char-card'; card.dataset.i=i;
    const thumb=renderThumb(p, 132, 150);
    card.innerHTML=`<img src="${thumb}" alt="${p.name}"><span class="cn">${p.name}</span><span class="cb">${p.bio}</span>`;
    card.addEventListener('click',()=>selectPreset(i));
    gallery.appendChild(card);
  });

  // generator z opisu
  $('#describeBtn').addEventListener('click',()=>{
    const txt=$('#f_describe').value.trim();
    if(!txt){ toast('Najpierw opisz postać — choćby kilka słów.', true); return; }
    const cfg=describeToConfig(txt);
    const box=$('#describeResult');
    box.innerHTML='';
    const card=document.createElement('button');
    card.type='button'; card.className='char-card sel';
    card.innerHTML=`<img src="${renderThumb(cfg)}" alt="propozycja"><span class="cn">Twoja propozycja</span><span class="cb">z Twojego opisu</span>`;
    card.addEventListener('click',()=>{
      Object.assign(persona, cfg);
      applyPersonaToUI(); applyPreview();
      [...gallery.children].forEach(c=>c.classList.remove('sel'));
      card.classList.add('sel');
      toast('Propozycja załadowana do kreatora.');
    });
    box.appendChild(card);
    box.hidden=false;
    Object.assign(persona, cfg);
    applyPersonaToUI(); applyPreview();
    toast('Stworzyłem propozycję z opisu — kliknij, by załadować, lub dopasuj niżej.');
  });

  // swatches
  const sw=$('#swatches');
  PALETTE.forEach(col=>{
    const b=document.createElement('button');
    b.type='button'; b.className='swatch'+(col===persona.color?' sel':'');
    b.style.background=col;
    b.title=col;
    b.addEventListener('click',()=>{
      persona.color=col;
      $$('.swatch').forEach(x=>x.classList.toggle('sel',x===b));
      applyPreview();
    });
    sw.appendChild(b);
  });

  // chips umiejętności
  const chips=$('#skillChips');
  SKILLS.forEach(sk=>{
    const c=document.createElement('button');
    c.type='button'; c.className='chip'+(persona.skills.includes(sk.id)?' on':'');
    c.innerHTML=`${sk.icon} ${sk.label}`;
    c.title=sk.desc;
    c.addEventListener('click',()=>{
      const i=persona.skills.indexOf(sk.id);
      if(i>=0) persona.skills.splice(i,1); else persona.skills.push(sk.id);
      c.classList.toggle('on');
    });
    chips.appendChild(c);
  });

  // suwaki osobowości
  const bindSlider=(id,key,labelId)=>{
    const el=$(id);
    el.addEventListener('input',()=>{
      persona[key]=+el.value;
      $(labelId).textContent=el.value;
    });
  };
  bindSlider('#p_proactive','proactive','#v_proactive');
  bindSlider('#p_humor','humor','#v_humor');
  bindSlider('#p_formal','formal','#v_formal');
  bindSlider('#p_terse','terse','#v_terse');

  // pola tekstowe
  const bindField=(id,key)=>{
    const el=$(id);
    el.addEventListener('input',()=>{ persona[key]=el.value; });
  };
  bindField('#f_name','name'); bindField('#f_role','role');
  $('#f_name').addEventListener('input',e=>{ e.target.dataset.touched='1'; });
  bindField('#f_intro','intro'); bindField('#f_goal','goal');

  // wygląd
  const bindSel=(id,key)=>{
    const el=$(id);
    el.addEventListener('change',()=>{ persona[key]=el.value; applyPreview(); });
  };
  bindSel('#f_shape','shape'); bindSel('#f_eyes','eyes'); bindSel('#f_acc','acc'); bindSel('#f_aura','aura');
  $('#f_size').addEventListener('input',e=>{ persona.size=+e.target.value/100; $('#sizeVal').textContent=e.target.value; applyPreview(); });
  $('#f_pet').addEventListener('change',e=>{ persona.pet=e.target.checked; applyPreview(); });

  // stepper
  $$('#stepper li').forEach(li=>{
    li.addEventListener('click',()=>goStep(+li.dataset.step));
  });
  $('#prevBtn').addEventListener('click',()=>goStep(step-1));
  $('#nextBtn').addEventListener('click',()=>goStep(step+1));
  $('#finishBtn').addEventListener('click',finishWizard);

  renderRules();
  $('#addRuleBtn').addEventListener('click',()=>{
    rules.push({id:'c'+Date.now(), icon:'⭐', text:'Nowa reguła — opisz czynność', mode:'ask'});
    renderRules();
  });

  // stany podglądu
  $$('#stateRow button').forEach(b=>{
    b.addEventListener('click',()=>{
      $$('#stateRow button').forEach(x=>x.classList.toggle('active',x===b));
      dot.setState(b.dataset.state);
      $('#previewState').textContent=b.dataset.state;
    });
  });
}

function renderRules(){
  const list=$('#rulesList');
  list.innerHTML='';
  rules.forEach((r,i)=>{
    const row=document.createElement('div');
    row.className='rule-row';
    const sel=document.createElement('select');
    RULE_MODES.forEach(m=>{
      const o=document.createElement('option');
      o.value=m.id;o.textContent=m.label;
      if(r.mode===m.id)o.selected=true;
      sel.appendChild(o);
    });
    sel.addEventListener('change',()=>{ r.mode=sel.value; });
    const txt=document.createElement('input');
    txt.type='text'; txt.value=r.text; txt.className='rl';
    txt.addEventListener('input',()=>{ r.text=txt.value; });
    const del=document.createElement('button');
    del.type='button'; del.className='ghost-btn'; del.textContent='✕';
    del.addEventListener('click',()=>{ rules.splice(i,1); renderRules(); });
    row.append(txt,sel,del);
    list.appendChild(row);
  });
}

function goStep(n){
  n=Math.max(1,Math.min(4,n));
  step=n;
  $$('.step-panel').forEach(p=>p.hidden = +p.dataset.step!==n);
  $$('#stepper li').forEach(li=>{
    const s=+li.dataset.step;
    li.classList.toggle('active',s===n);
    li.classList.toggle('done',s<n);
  });
  $('#prevBtn').style.visibility = n===1?'hidden':'visible';
  $('#nextBtn').hidden = n===4;
  $('#finishBtn').hidden = n!==4;
  if(n===1){ const f=$('#f_name'); if(!f.value){ f.value=genName(); persona.name=f.value; } }
}

function genName(){
  const a=['Al','No','Błys','Is','Zia','Fe','Lu','Mo'];
  const b=['fred','cka','k','tempra','gor','ton','na','ra'];
  return a[Math.floor(Math.random()*a.length)]+b[Math.floor(Math.random()*b.length)];
}

function applyPreview(){
  if(dot) dot.setOpts({
    color:persona.color, shape:persona.shape, eyes:persona.eyes, acc:persona.acc,
    aura:persona.aura, size:persona.size, pet:persona.pet, name:persona.name||'Iskra'
  });
}

/* ---------- ożywienie ---------- */
function finishWizard(){
  if(!persona.name){ persona.name='Iskra'; $('#f_name').value='Iskra'; }
  Brain.init({...persona}, rules);
  chatDot && chatDot.setOpts({
    color:persona.color, shape:persona.shape, eyes:persona.eyes, acc:persona.acc,
    aura:persona.aura, size:persona.size, pet:persona.pet, name:persona.name
  });
  $('#chatName').textContent = persona.name;
  $('#chatRole').textContent = persona.role || 'asystent uniwersalny';
  const pr=$('#chatSkills'); pr.innerHTML='';
  (persona.skills.length?persona.skills.map(id=>SKILLS.find(s=>s.id===id)).filter(Boolean):SKILLS.slice(0,3))
    .forEach(s=>{ const p=document.createElement('span'); p.className='pill'; p.textContent=s.icon+' '+s.label; pr.appendChild(p); });
  const log=$('#chatLog'); log.innerHTML='';
  addMsg('bot', Brain.greeting());
  seedTasks();
  startActivityLoop();
  savePersona(true);
  showView('chat');
  toast(`${persona.name} ożywiona! Zobacz Rozmowę i Aktywność.`);
}

/* ---------- czat ---------- */
function addMsg(role, text, who){
  const log=$('#chatLog');
  const m=document.createElement('div');
  m.className='msg '+role;
  if(role==='bot' && who){ m.innerHTML=`<span class="who">${esc(who)}</span>${text}`; }
  else m.textContent=text;
  log.appendChild(m);
  log.scrollTop=log.scrollHeight;
  return m;
}

function addApprovalCard(card){
  const log=$('#chatLog');
  const el=document.createElement('div');
  el.className='acard';
  el.innerHTML=`
    <div class="ttl">${card.title}</div>
    <div class="desc">${esc(card.body)}</div>
    <div class="acts">
      <button class="a-approve">Zatwierdź</button>
      <button class="a-edit">Popraw</button>
      <button class="a-reject">Odrzuć</button>
    </div>`;
  log.appendChild(el);
  log.scrollTop=log.scrollHeight;
  const close=(txt,ok)=>{
    el.classList.add('result');
    el.innerHTML=`<div class="ttl">${ok?'✅':'⛔'} ${txt}</div><div class="desc">${esc(card.body)}</div>`;
    log.scrollTop=log.scrollHeight;
  };
  el.querySelector('.a-approve').onclick=()=>{
    close('Zatwierdzone — wykonuję', true);
    addMsg('bot', card.type==='purchase'
      ? 'Zamówienie złożone. Potwierdzenie wrzuciłem do Aktywności. 🧾'
      : 'Wysłane. Kopię zostawiam w kontekście na przyszłość. ✉️');
    chatDot && chatDot.setState('party');
    setTimeout(()=>chatDot && chatDot.setState('idle'),2600);
    pushTask(doneTaskFromCard(card));
  };
  el.querySelector('.a-edit').onclick=()=>{
    close('Wymaga poprawek — wróć do szkicu', false);
    addMsg('bot','Okej, szkic wraca do poprawek. Napisz, co zmienić.');
  };
  el.querySelector('.a-reject').onclick=()=>{
    close('Odrzucone', false);
    addMsg('bot','Anulowane. Nie wykonuję tej akcji.');
  };
}

function initChat(){
  $('#chatForm').addEventListener('submit',e=>{
    e.preventDefault();
    const inp=$('#chatText');
    const v=inp.value.trim();
    if(!v) return;
    inp.value='';
    addMsg('user', v);
    chatDot && chatDot.setState('think');
    const ty=document.createElement('div');
    ty.className='msg bot typing';
    ty.innerHTML='<i></i><i></i><i></i>';
    $('#chatLog').appendChild(ty);
    $('#chatLog').scrollTop=1e9;
    setTimeout(()=>{
      ty.remove();
      const r=Brain.reply(v);
      addMsg('bot', r.text, persona.name||'Iskra');
      if(r.card) addApprovalCard(r.card);
      chatDot && chatDot.setState(r.stateAfter||'speak');
      // powrót do idle
      setTimeout(()=>{ if(chatDot&&chatDot.state==='speak') chatDot.setState('idle'); }, 3500);
    }, 500+Math.random()*900);
  });

  const sugg=[
    'Co potrafisz?',
    'Zrób poranny raport',
    'Znajdź nowe trendy w AI',
    'Napisz maila do drukarni',
    'Kup zapas kawy',
    'Przypomnij o fakturze jutro',
  ];
  const row=$('#suggRow');
  sugg.forEach(s=>{
    const b=document.createElement('button');
    b.type='button'; b.className='sugg'; b.textContent=s;
    b.addEventListener('click',()=>{ $('#chatText').value=s; $('#chatForm').requestSubmit(); });
    row.appendChild(b);
  });
}

/* ---------- aktywność ---------- */
const TASK_POOL=[
  {icon:'📰',t:'Przegląd 12 źródeł — zmiany w branży',eta:'~4 min',skill:'news'},
  {icon:'🧹',t:'Czyszczenie starego backlogu notatek',eta:'~2 min',skill:'notes'},
  {icon:'📅',t:'Sprawdzenie kalendarza na jutro',eta:'~1 min',skill:'cal'},
  {icon:'✉️',t:'Skan skrzynki: follow-upy bez odpowiedzi',eta:'~3 min',skill:'email'},
  {icon:'🛒',t:'Porównanie cen: materiały eksploatacyjne',eta:'~5 min',skill:'shop'},
  {icon:'🧑‍💻',t:'Triage nowych zgłoszeń z repo',eta:'~6 min',skill:'code'},
];
const DONE_POOL=[
  {icon:'📊',t:'Poranne zestawienie gotowe',from:'Zadanie cykliczne'},
  {icon:'🗂',t:'Uporządkowane notatki z tygodnia',from:'Zadanie cykliczne'},
  {icon:'🔔',t:'Przypomnienie o terminie dostarczone',from:'Reminder'},
];

function seedTasks(){
  tasks=[
    mkTask(TASK_POOL[0]), mkTask(TASK_POOL[1]),
    {icon:'📅',t:'Codzienny przegląd kalendarza o 8:00',eta:'cyklicznie',kind:'scheduled'},
    {icon:'✉️',t:'Tygodniowe podsumowanie skrzynki (pon. 9:00)',eta:'cyklicznie',kind:'scheduled'},
    {icon:'📊',t:'Poranne zestawienie',eta:'dziś 8:04',kind:'done',from:'Zadanie cykliczne'},
  ];
  renderTasks();
}
function mkTask(p){ return {...p, kind:'progress', start:Date.now()}; }
function pushTask(t){ tasks.unshift(t); renderTasks(); }
function doneTaskFromCard(card){ return {icon: card.type==='purchase'?'🧾':'✉️', t:(card.title.replace(/^[^ ]+ /,''))+' — wykonane', eta:'właśnie teraz', kind:'done', from:'Zatwierdzone w rozmowie'}; }

function renderTasks(){
  $$('#actCols .act-col').forEach(col=>{
    const kind=col.dataset.col;
    const list=col.querySelector('.act-list');
    list.innerHTML='';
    const items=tasks.filter(t=>t.kind===kind);
    if(!items.length){ const e=document.createElement('div'); e.className='muted small'; e.textContent='— pusto —'; list.appendChild(e); return; }
    items.forEach(t=>{
      const d=document.createElement('div');
      d.className='task'+(t.kind==='progress'?' running':'');
      d.innerHTML=`<div class="tt"><span>${t.icon} ${esc(t.t)}</span><span class="eta">${esc(t.eta||'')}</span></div>`+
        (t.from?`<div class="meta">↳ ${esc(t.from)}</div>`:'');
      if(t.kind==='scheduled'){
        const b=document.createElement('button'); b.textContent='⏸ Wstrzymaj';
        b.onclick=()=>{ t.paused=!t.paused; b.textContent=t.paused?'▶ Wznów':'⏸ Wstrzymaj'; };
        d.appendChild(b);
      }
      if(t.kind==='done' && t.result){
        const r=document.createElement('div'); r.className='meta'; r.textContent=' Wynik: '+t.result; d.appendChild(r);
      }
      list.appendChild(d);
    });
  });
}

function startActivityLoop(){
  clearInterval(activityTimer);
  activityTimer=setInterval(()=>{
    if(paused||currentView!=='activity') return;
    const roll=Math.random();
    if(roll<.35 && tasks.filter(t=>t.kind==='progress').length<4){
      tasks.unshift(mkTask(TASK_POOL[Math.floor(Math.random()*TASK_POOL.length)]));
      toast('Iskra wzięła nowe zadanie w tle.');
    } else if(roll<.6){
      const p=tasks.filter(t=>t.kind==='progress');
      if(p.length){ const t=p[p.length-1]; t.kind='done'; t.from='Zakończone automatycznie'; t.result='wynik w rozmowie'; }
    }
    renderTasks();
  }, 7000);
}

function initActivity(){
  $('#pauseBtn').addEventListener('click',e=>{
    paused=!paused;
    e.target.textContent=paused?'▶ Wznów':'⏸ Pauza';
    toast(paused?'Iskra wstrzymana.':'Iskra wraca do pracy.');
  });
  $('#wakeBtn').addEventListener('click',()=>{
    for(let i=0;i<2;i++) tasks.unshift(mkTask(TASK_POOL[Math.floor(Math.random()*TASK_POOL.length)]));
    renderTasks();
    toast('Wygenerowano zdarzenia testowe.');
  });
}

/* ---------- zapis / import ---------- */
function personaFile(){ return JSON.stringify({v:1, persona, rules}, null, 2); }
function savePersona(silent){
  try{
    const all=JSON.parse(localStorage.getItem('iskra-personas')||'{}');
    const key=(persona.name||'Iskra').trim()||'Iskra';
    all[key]={persona, rules, ts:Date.now()};
    localStorage.setItem('iskra-personas', JSON.stringify(all));
    if(!silent) toast(`Zapisano „${key}”.`);
    renderSaved();
  }catch(e){ toast('Nie udało się zapisać.', true); }
}
function renderSaved(){
  const list=$('#savedList'); list.innerHTML='';
  let all={};
  try{ all=JSON.parse(localStorage.getItem('iskra-personas')||'{}'); }catch(e){}
  const keys=Object.keys(all).sort((a,b)=>all[b].ts-all[a].ts);
  if(!keys.length){ list.innerHTML='<div class="muted small">Jeszcze nic tu nie ma.</div>'; return; }
  keys.forEach(k=>{
    const it=document.createElement('div'); it.className='saved-item';
    const sw=document.createElement('span'); sw.className='sw'; sw.style.background=all[k].persona.color||'#ff7a1a';
    const nm=document.createElement('span'); nm.className='nm'; nm.textContent=k;
    const load=document.createElement('button'); load.textContent='📂'; load.title='Wczytaj';
    load.onclick=()=>{ loadPersona(all[k].persona, all[k].rules); };
    const dl=document.createElement('button'); dl.textContent='⬇'; dl.title='Eksport JSON';
    dl.onclick=()=>{ downloadBlob2(new Blob([JSON.stringify({persona:all[k].persona,rules:all[k].rules},null,2)],{type:'application/json'}), k+'.json'); };
    it.append(sw,nm,load,dl);
    list.appendChild(it);
  });
}
function downloadBlob2(blob,name){ const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),4000); }
function loadPersona(p, r){
  persona={...persona, ...p};
  rules = r && r.length? r.slice(): DEFAULT_RULES.slice();
  applyPersonaToUI();
  Brain.init({...persona}, rules);
  applyPreview();
  toast(`Wczytano „${persona.name}”.`);
  showView('create');
}
function applyPersonaToUI(){
  $('#f_name').value=persona.name||'';
  $('#f_role').value=persona.role||'';
  $('#f_intro').value=persona.intro||'';
  $('#f_goal').value=persona.goal||'';
  $('#f_shape').value=persona.shape; $('#f_eyes').value=persona.eyes;
  $('#f_acc').value=persona.acc; $('#f_aura').value=persona.aura;
  $('#f_size').value=Math.round(persona.size*100); $('#sizeVal').textContent=Math.round(persona.size*100);
  $('#f_pet').checked=!!persona.pet;
  $('#p_proactive').value=persona.proactive; $('#v_proactive').textContent=persona.proactive;
  $('#p_humor').value=persona.humor; $('#v_humor').textContent=persona.humor;
  $('#p_formal').value=persona.formal; $('#v_formal').textContent=persona.formal;
  $('#p_terse').value=persona.terse; $('#v_terse').textContent=persona.terse;
  $$('.swatch').forEach(s=>s.classList.toggle('sel', s.title===persona.color));
  $$('.chip').forEach(c=>{
    const id=SKILLS.find(s=>s.label===c.textContent.replace(/^\S+\s/,''))?.id;
    c.classList.toggle('on', persona.skills.includes(id));
  });
  renderRules();
}

/* ---------- boot ---------- */
function boot(){
  dot = new Dot($('#previewCanvas'), {});
  dot.start();
  chatDot = new Dot($('#chatCanvas'), {});
  chatDot.start(); chatDot.setState('idle');

  dot.onstate = s=>{ $('#previewState').textContent=s; };

  // nawigacja
  $$('.nav-btn').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.view)));
  $('#brandBtn').addEventListener('click',()=>showView('create'));
  $('#brandBtn').addEventListener('keydown',e=>{ if(e.key==='Enter')showView('create'); });
  $('#menuBtn').addEventListener('click',openDrawer);
  $('#drawerClose').addEventListener('click',closeDrawer);
  $('#drawerBackdrop').addEventListener('click',closeDrawer);

  $('#saveBtn').addEventListener('click',()=>savePersona(false));
  $('#importBtn').addEventListener('click',()=>$('#importFile').click());
  $('#importFile').addEventListener('change',e=>{
    const f=e.target.files[0]; if(!f)return;
    const rd=new FileReader();
    rd.onload=()=>{
      try{
        const j=JSON.parse(rd.result);
        loadPersona(j.persona||j, j.rules);
      }catch(err){ toast('Nieprawidłowy JSON.', true); }
    };
    rd.readAsText(f);
    e.target.value='';
  });

  initWizard();
  initChat();
  initActivity();
  Studio.init();
  renderSaved();
  goStep(1);
}
document.addEventListener('DOMContentLoaded', boot);
