/* ============================================================
   Iskra — galeria postaci (jak u OpenAI: wybierz, dopasuj, nazwij)
   ============================================================ */
'use strict';

/* Gotowe postaci — jak character picker dota */
const PRESETS = [
  {
    name:'Alfred', color:'#ffd23f', shape:'circle', eyes:'dot', acc:'halo', aura:'sparks', pet:false, size:1,
    bio:'Dżentelmen poranków',
    persona:{proactive:70, humor:25, formal:70, terse:40, skills:['news','cal'],
      role:'Pilnuje terminów i przygotowuje poranne zestawienia.',
      intro:'Twój poranny zwiadowca informacji.'}
  },
  {
    name:'Iggy', color:'#ff8fb1', shape:'blob', eyes:'happy', acc:'bow', aura:'bubbles', pet:false, size:1,
    bio:'Kreatywna iskra',
    persona:{proactive:60, humor:80, formal:15, terse:30, skills:['social','music'],
      role:'Wymyśla pomysły i pilnuje trendów.',
      intro:'Twoja muza na dobre pomysły.'}
  },
  {
    name:'Felipe', color:'#57b3ff', shape:'squircle', eyes:'visor', acc:'headphones', aura:'orbit', pet:false, size:1,
    bio:'Rytm pracy',
    persona:{proactive:55, humor:35, formal:40, terse:60, skills:['music','cal'],
      role:'Utrzymuje rytm dnia i przypomina o przerwach.',
      intro:'Twój metronom produktywności.'}
  },
  {
    name:'Todd', color:'#3ddc84', shape:'circle', eyes:'oval', acc:'glasses', aura:'none', pet:true, size:1,
    bio:'Spokojny analityk',
    persona:{proactive:75, humor:20, formal:55, terse:65, skills:['code','finance'],
      role:'Czyta dane, wyłapuje anomalie, pisze raporty.',
      intro:'Twoje drugie spojrzenie na liczby.'}
  },
  {
    name:'Jojo', color:'#b17aff', shape:'star', eyes:'dot', acc:'antenna', aura:'sparks', pet:false, size:1.05,
    bio:'Chaotic good',
    persona:{proactive:85, humor:65, formal:10, terse:25, skills:['news','shop'],
      role:'Łapie okazje i niespodzianki, zanim zdążyszmrugnąć.',
      intro:'Twój łowca okazji.'}
  },
  {
    name:'Błysk', color:'#ff7a1a', shape:'blob', eyes:'visor', acc:'antenna', aura:'sparks', pet:false, size:1,
    bio:'Energiczna iskra',
    persona:{proactive:70, humor:45, formal:20, terse:45, skills:['news','email'],
      role:'Sortuje napływające rzeczy i przypomina o pilnych.',
      intro:'Twój błyskawiczny filtr rzeczywistości.'}
  },
  {
    name:'Nocka', color:'#00d4c8', shape:'circle', eyes:'happy', acc:'halo', aura:'orbit', pet:true, size:.95,
    bio:'Nocny strażnik',
    persona:{proactive:50, humor:30, formal:35, terse:55, skills:['health','cal'],
      role:'Pilnuje rytmu doby, przypomina o śnie i wodzie.',
      intro:'Twoja nocna zmiana.'}
  },
  {
    name:'Mira', color:'#ff5470', shape:'squircle', eyes:'oval', acc:'bow', aura:'bubbles', pet:false, size:1,
    bio:'Serce zespołu',
    persona:{proactive:65, humor:55, formal:25, terse:35, skills:['email','social'],
      role:'Ogarnia follow-upy i utrzymuje kontakty.',
      intro:'Twoja dobra wróżka kontaktów.'}
  },
  {
    name:'Zenek', color:'#9adf5a', shape:'circle', eyes:'happy', acc:'none', aura:'none', pet:true, size:1.1,
    bio:'Spokojny towarzysz',
    persona:{proactive:35, humor:40, formal:20, terse:70, skills:['health'],
      role:'Po prostu jest. I przypomina, żeby odetchnąć.',
      intro:'Twój cichy kompan.'}
  },
  {
    name:'Ada', color:'#c9a0ff', shape:'star', eyes:'visor', acc:'headphones', aura:'sparks', pet:false, size:1,
    bio:'Future-focused',
    persona:{proactive:80, humor:30, formal:50, terse:50, skills:['code','news'],
      role:'Śledzi nowe technologie i wyciąga z nich to, co użyteczne.',
      intro:'Twoja szybka na przyszłość.'}
  },
];

/* Miniatura postaci (statyczna klatka z silnika Dot) */
function renderThumb(opts, w=132, h=150){
  const c=document.createElement('canvas');
  c.width=w; c.height=h;
  const d=new Dot(c, Object.assign({size:.8}, opts));
  d.t = 1.7; d.mouse.inside = false;
  d._draw();
  return c.toDataURL();
}

/* „Generuj z opisu" — lokalny parser słów-kluczy (bez API) */
function describeToConfig(text){
  const t=(text||'').toLowerCase();
  const cfg={};
  let matched=false;
  const color=[
    [/pomarańcz|rud|oregan/, '#ff7a1a'],
    [/żółt|zolt|banan/, '#ffd23f'],
    [/zielon|limon|lis\b/, '#3ddc84'],
    [/niebie|błękit|blekit|morski|lavender/, '#57b3ff'],
    [/fiolet|purpur|lila/, '#b17aff'],
    [/róż|roz-czerw|Różowy|pinky/, '#ff8fb1'],
    [/turkus|teal|cyan/, '#00d4c8'],
    [/czerw|truskaw|rubin/, '#ff5470'],
  ];
  for(const [re,val] of color) if(re.test(t)){ cfg.color=val; matched=true; break; }
  if(/blob|plazm|galareta|luźn/.test(t)){ cfg.shape='blob'; matched=true; }
  else if(/kwadrat|squircle|miękki k/.test(t)){ cfg.shape='squircle'; matched=true; }
  else if(/gwiazd|star/.test(t)){ cfg.shape='star'; matched=true; }
  else if(/kul|dot|kółko|kolk/.test(t)){ cfg.shape='circle'; matched=true; }
  if(/wizor|robot|android|kosmit/.test(t)){ cfg.eyes='visor'; matched=true; }
  else if(/wesoł|uśmiechn|happy|ciekaw/.test(t)){ cfg.eyes='happy'; matched=true; }
  else if(/owaln|duż[ea] ocz|big eyes/.test(t)){ cfg.eyes='oval'; matched=true; }
  if(/słuchawk|headphon|dj/.test(t)){ cfg.acc='headphones'; matched=true; }
  else if(/okular|nerd|profesor/.test(t)){ cfg.acc='glasses'; matched=true; }
  else if(/aureol|anioł|aniol|święt/.test(t)){ cfg.acc='halo'; matched=true; }
  else if(/anten|radia|kosmicz/.test(t)){ cfg.acc='antenna'; matched=true; }
  else if(/mucha|koksard|prezent/.test(t)){ cfg.acc='bow'; matched=true; }
  if(/iskr|ogień|ogie|fire/.test(t)){ cfg.aura='sparks'; matched=true; }
  else if(/orbit|planety|księżyc/.test(t)){ cfg.aura='orbit'; matched=true; }
  else if(/bąbel|babel|woda|ryb/.test(t)){ cfg.aura='bubbles'; matched=true; }
  if(/pet|lis\b|kot|pies|ptak|zwierz|maskot/.test(t)){ cfg.pet=true; matched=true; }
  if(/duż[ea]|wielk/.test(t)){ cfg.size=1.2; matched=true; }
  else if(/mał[ey]|mini/.test(t)){ cfg.size=.82; matched=true; }
  if(!matched){
    // nic nie rozpoznano — losowa osobowość
    const pick=a=>a[Math.floor(Math.random()*a.length)];
    cfg.color=pick(PALETTE);
    cfg.shape=pick(['circle','blob','squircle','star']);
    cfg.eyes=pick(['dot','oval','happy','visor']);
    cfg.acc=pick(['none','halo','antenna','headphones','glasses','bow']);
    cfg.aura=pick(['none','sparks','orbit','bubbles']);
    cfg.pet=Math.random()<.4;
  }
  return cfg;
}

window.PRESETS = PRESETS;
window.renderThumb = renderThumb;
window.describeToConfig = describeToConfig;
