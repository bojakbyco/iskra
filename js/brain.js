/* ============================================================
   Iskra — lokalny "mózg" asystenta (bez API, offline)
   Osobowość + reguły + pamięć kontekstu + symulacja agenta
   ============================================================ */
'use strict';

const SKILLS = [
  {id:'news',   icon:'📰', label:'Newsy & research',  desc:'śledzi źródła, zbiera zmiany'},
  {id:'cal',    icon:'📅', label:'Kalendarz & terminy', desc:'pilnuje deadline\'ów, przypomina'},
  {id:'email',  icon:'✉️', label:'E-mail & follow-upy', desc:'drafty, dogonienia, podsumowania'},
  {id:'code',   icon:'🧑‍💻', label:'Kod & PR-y',        desc:'czyta bugi, proponuje poprawki'},
  {id:'social', icon:'📣', label:'Social media',      desc:'drafty postów, trendy'},
  {id:'shop',   icon:'🛒', label:'Zakupy & oferty',   desc:'porównuje ceny, pilnuje dostaw'},
  {id:'health', icon:'🍅', label:'Nawyki & zdrowie',  desc:'przypomina o przerwach, wodzie, ruchu'},
  {id:'finance',icon:'💸', label:'Finanse',           desc:'śledzi wydatki, faktury'},
  {id:'travel', icon:'🧭', label:'Podróże',           desc:'planuje trasy i rezerwacje'},
  {id:'music',  icon:'🎵', label:'Muzyka & vibe',     desc:'playlisty pod nastrój'},
];

const DEFAULT_RULES = [
  {id:'buy',     icon:'💳', text:'Zakupy powyżej 50 zł', mode:'ask'},
  {id:'msg',     icon:'📤', text:'Wysyłanie wiadomości w moim imieniu', mode:'ask'},
  {id:'web',     icon:'🌐', text:'Recherche w internecie (tylko odczyt)', mode:'auto'},
  {id:'notes',   icon:'📝', text:'Pisanie notatek i szkiców', mode:'auto'},
  {id:'pwd',     icon:'🔑', text:'Zmiana haseł i ustawień bezpieczeństwa', mode:'you'},
];

const RULE_MODES = [
  {id:'auto', label:'✅ Działa sama'},
  {id:'pre',  label:'⚡ Gdy zgodzę się w rozmowie'},
  {id:'ask',  label:'⚠️ Pyta o zgodę'},
  {id:'you',  label:'🔒 Zawsze tylko ja'},
];

function esc(s){ const d=document.createElement('div'); d.textContent=String(s); return d.innerHTML; }

/* niedeterministyczny wybór deterministyczny wg seeda */
function mulberry(seed){ return function(){ seed|=0; seed=(seed+0x6D2B79F5)|0; let t=Math.imul(seed^(seed>>>15),1|seed); t=(t+Math.imul(t^(t>>>7),61|t))^t; return ((t^(t>>>14))>>>0)/4294967296; }; }

const Brain = {
  persona:null,
  history:[],   // {role, text}
  rules:[],
  memUsed:new Set(),

  init(persona, rules){
    this.persona = persona;
    this.rules = rules || DEFAULT_RULES.slice();
    this.history = [];
    this.memUsed = new Set();
  },

  descriptor(){
    const p=this.persona; if(!p) return '';
    const d=[];
    d.push(p.formal>66?'bardzo formalny':p.formal>33?'zrównoważony w tonie':'luźny i bezpośredni');
    d.push(p.humor>66?'żartuje często':p.humor>33?'rzeadko rzuca żartem':'na temat, bez żartów');
    d.push(p.proactive>66?'działa z własnej inicjatywy':p.proactive>33?'inicjatywa umiarkowana':'czeka na polecenia');
    d.push(p.terse>66?'odpowiada bardzo zwięźle':p.terse>33?'zwięzły z kontekstem':'rzuci szczegółami');
    return d.join(' · ');
  },

  greeting(){
    const p=this.persona;
    const rnd = mulberry(hash(p?p.name:'x') + Date.now()/60000|0);
    const hour = new Date().getHours();
    const tod = hour<5?'Taka noc dziś…':hour<12?'Dzień dobry':hour<18?'Cześć':'Dobry wieczór';
    const who = p.formal>60? `${tod}.` : `${tod}!`;
    const intro = p.intro? `${who} ${p.intro}` : who;
    const role = p.role? `\n\nBędę się zajmować: ${p.role.toLowerCase()}` : '';
    const firstGoal = p.goal? `\n\nCel na start: ${p.goal}` : '';
    const skills = p.skills&&p.skills.length? `\n\n(${SKILLS.filter(s=>p.skills.includes(s.id)).map(s=>s.icon+' '+s.label).join(', ')})` : '';
    return intro + role + firstGoal + skills;
  },

  reply(userText){
    const p=this.persona;
    const txt = (userText||'').toLowerCase();
    this.history.push({role:'user', text:userText});
    if(this.history.length>30) this.history.shift();

    let out, card=null, stateAfter='speak';

    // intencje
    if(/(hej|cześć|czesc|siema|dzien dobry|hello|hi)\b/.test(txt)){
      out = this._pick([`Hej! Słucham.`, `Nośmy się! Co podać?`, `Jestem. Co porabiamy?`]);
    }
    else if(/(dziękuję|dzieki|thx|thanks)/.test(txt)){
      out = this._pick([`Zawsze do usług. 🙂`, `Nie ma sprawy — to moja robota.`, `Spoko! Co dalej?`]);
    }
    else if(/(raport|podsumuj|podsumowanie|streszcz|resume)/.test(txt)){
      out = `O poranne zestawienie:\n• 3 nowe rzeczy w ${p.skills&&p.skills.length?SKILLS.find(s=>p.skills.includes(s.id))?.label.toLowerCase()||'Twoich tematach':'Twoich tematach'}\n• 1 termin na dziś: ${this._fakeThing()}\n• 0 pilnych blockerów\n\nChcesz, żebym rozwinął któryś punkt?`;
    }
    else if(/(przypomnij|remind|termin|deadline)/.test(txt)){
      out = `Ustawione. Przypomnę o: „${userText.replace(/przypomnij|mi|o|remind/gi,'').trim()||'termie'}”.\nKiedy? Napisz np. „jutro 9:00” — dopiszę do Zaplanowanych.`;
    }
    else if(/(znajdź|poszukaj|research|recherche|szukaj)/.test(txt)){
      out = `Zaczynam recherche: „${esc(userText).slice(0,80)}…”\nZgodnie z regułami działa to tylko do odczytu — wyniki zobaczysz w Aktywności, a gotowe zestawienie wrzucę tu.`;
    }
    else if(/(napisz|draft|szybki szkic|sformatuj)/.test(txt)){
      card = {type:'draft', title:'✉️ Szkic do wysłania', body:`„${this._fakeThing()} — …”`, rule: this.rules.find(r=>r.id==='msg')};
      out = `Przygotowałem szkic. Zanim wyślę w Twoim imieniu — reguła „${card.rule.text}” wymaga Twojej zgody:`;
    }
    else if(/(kup|zamów|zamow|koszyk)/.test(txt)){
      card = {type:'purchase', title:'🛒 Zgoda na zakup', body:`${this._fakeThing()} — ok. ${20+Math.floor(Math.random()*180)} zł`, rule: this.rules.find(r=>r.id==='buy')};
      out = `Znalazłem najlepszą ofertę. Zakupy >50 zł wymagają zatwierdzenia (Twoja reguła):`;
    }
    else if(/(co potrafisz|umiesz|pomoc|help|co możesz)/.test(txt)){
      const sk = p.skills&&p.skills.length? SKILLS.filter(s=>p.skills.includes(s.id)) : SKILLS.slice(0,4);
      out = `Jestem ${p.name}. Mój profil: ${this.descriptor()}.\n\nŚwiaty, w których żyję:\n${sk.map(s=>'• '+s.icon+' '+s.label+' — '+s.desc).join('\n')}\n\nNapisz „raport”, „znajdź …”, „napisz …” albo po prostu pogadaj.`;
    }
    else if(/(pa|do usłyszenia|do uslyszenia|narazie|na razie|koniec)/.test(txt)){
      out = `Do usłyszenia! Przechodzę w tryb czuwania — jeśli coś się wydarzy, dam znać w Aktywności. 👋`;
      stateAfter='idle';
    }
    else if(txt.includes('?')){
      const s = this._pick([
        `Dobre pytanie. Krótko: ${this._fakeFact()}`,
        `Z mojej perspektywy: ${this._fakeFact()}`,
        `Sprawdziłbym dwie rzeczy. Po pierwsze ${this._fakeThing().toLowerCase()}. Po drugie — kontekst, który znamy z poprzednich rozmów. Chcesz, żebym rozwinął?`,
      ]);
      out = s;
    }
    else {
      // reakcja osobowości
      const reactions = [];
      if(p.humor>50) reactions.push(`Zabawne. ${this._fakeFact()}`);
      if(p.proactive>50) reactions.push(`Zanotowane. Mogę z tym coś zrobić w tle — daj znać.`);
      if(p.terse>60) reactions.push(`OK.`);
      reactions.push(`Rozumiem: „${esc(userText).slice(0,90)}”. Dopisuję do kontekstu.`);
      out = this._pick(reactions.length?reactions:['Słucham dalej.']);
    }

    // wpływ osobowości na długość
    if(p.terse>66 && out.length>260) out = out.slice(0,240).replace(/\s\S*$/,'')+'…';
    if(p.formal>66) out = out.replace(/Spoko|OK\./g,'Rozumiem.').replace(/Hej! /g,'Dzień dobry. ');

    this.history.push({role:'bot', text:out});
    return {text:out, card, stateAfter};
  },

  _pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; },
  _fakeThing(){
    const p=this.persona;
    const things = ['Faktura dla klienta','Podsumowanie tygodnia','Nowa wersja decka','Wypełniony formularz ZUS','Mail do drukarni','Oferta na drona','Lista gości','Brief dla grafika','Raport z sensometrów','Migracja na nowy hosting'];
    return this._pick(things);
  },
  _fakeFact(){
    const facts=[
      'w ostatnich tygodniach temat wrócił w 3 niezależnych źródłach.',
      'statystycznie lepiej działa wersja krótsza.',
      'dwa z trzech przypadków to kwestia terminu, nie treści.',
      'warto to rozbić na dwa mniejsze kroki.',
      'najszybszy zwrot daje automatyzacja powtarzalnego kroku.',
    ];
    return this._pick(facts);
  }
};

function hash(s){ let h=0; for(let i=0;i<s.length;i++){ h=(h<<5)-h+s.charCodeAt(i); h|=0; } return h; }

window.Brain = Brain;
window.SKILLS = SKILLS;
window.DEFAULT_RULES = DEFAULT_RULES;
window.RULE_MODES = RULE_MODES;
window.esc = esc;
