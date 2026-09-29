/* ============================================================
   Iskra — Studio AI-wideo
   Klatki: Pollinations (FLUX, bez klucza) → chroma-key → alpha
   Eksport: WebM VP9 z kanałem alpha albo sprite-sheet PNG
   ============================================================ */
'use strict';

const Studio = {
  frames: [],        // [{img, ts}]
  sel: 0,
  playing: false,
  timer: null,
  seq: 0,
  fps: 8,
  mode: 'loop',
  dir: 1,
  toler: 90,
  soft: 40,
  despill: true,
  keyColor: [0,255,0],

  el: {},

  init(){
    this.el = {
      prompt: document.getElementById('s_prompt'),
      frames: document.getElementById('s_frames'),
      framesVal: document.getElementById('s_framesVal'),
      bg: document.getElementById('s_bg'),
      drift: document.getElementById('s_drift'),
      driftVal: document.getElementById('s_driftVal'),
      genBtn: document.getElementById('genBtn'),
      prog: document.getElementById('genProgress'),
      bar: document.getElementById('genBar'),
      info: document.getElementById('genInfo'),
      opts: document.getElementById('studioOpts'),
      fps: document.getElementById('s_fps'),
      fpsVal: document.getElementById('s_fpsVal'),
      mode: document.getElementById('s_mode'),
      tol: document.getElementById('s_tol'),
      tolVal: document.getElementById('v_tol'),
      soft: document.getElementById('s_soft'),
      softVal: document.getElementById('v_soft'),
      despill: document.getElementById('s_despill'),
      webm: document.getElementById('exportWebmBtn'),
      png: document.getElementById('exportPngBtn'),
      canvas: document.getElementById('studioCanvas'),
      strip: document.getElementById('frameStrip'),
    };
    const c=this.el.canvas;
    c.width=480;c.height=480;
    this.ctx = c.getContext('2d', {willReadFrequently:true});

    this.el.frames.addEventListener('input', e=>{ this.el.framesVal.textContent=e.target.value; });
    this.el.drift.addEventListener('input', e=>{ this.el.driftVal.textContent=e.target.value; });
    this.el.fps.addEventListener('input', e=>{ this.el.fpsVal.textContent=e.target.value; this.fps=+e.target.value; this._restart(); });
    this.el.tol.addEventListener('input', e=>{ this.el.tolVal.textContent=e.target.value; this.toler=+e.target.value; });
    this.el.soft.addEventListener('input', e=>{ this.el.softVal.textContent=e.target.value; this.soft=+e.target.value; });
    this.el.despill.addEventListener('change', e=>{ this.despill=e.target.checked; });
    this.el.mode.addEventListener('change', e=>{ this.mode=e.target.value; this._restart(); });
    this.el.bg.addEventListener('change', e=>{
      const v=e.target.value; this.keyColor=hexRGB2(v);
      this.frames.forEach(f=> f.keyed=null);
      this._render();
    });
    this.el.genBtn.addEventListener('click', ()=>this.generate());
    this.el.webm.addEventListener('click', ()=>this.exportWebM());
    this.el.png.addEventListener('click', ()=>this.exportSprite());

    this._render();
  },

  async generate(){
    const prompt = this.el.prompt.value.trim() || 'maskotka lis, sticker 3D render';
    const n = +this.el.frames.value;
    const drift = +this.el.drift.value;
    const baseSeed = Math.floor(Math.random()*1e6);
    this.seq++;
    const mySeq = this.seq;

    this.el.genBtn.disabled = true;
    this.el.prog.hidden = false;
    this.el.opts.hidden = true;
    this.frames = [];
    this._renderStrip();

    const urlFor = (i)=>{
      const seed = baseSeed + i*drift;
      const p = encodeURIComponent(`${prompt}, pose ${i+1} of ${n}, chroma key ${this.el.bg.value} background, full body, centered`);
      return `https://image.pollinations.ai/prompt/${p}?width=512&height=512&seed=${seed}&nologo=true&model=flux`;
    };

    let done=0;
    const update=()=>{ done++; this.el.bar.style.width=(done/n*100)+'%'; this.el.info.textContent=`${done}/${n} klatek`; };

    const tasks = [];
    for(let i=0;i<n;i++){
      tasks.push(new Promise(res=>{
        const img = new Image();
        img.crossOrigin='anonymous';
        img.onload = ()=>{ if(mySeq===this.seq){ this.frames.push({img, keyed:null, src:'ai'}); update(); this._renderStrip(); this._render(); } res(); };
        img.onerror = ()=>{ update(); res(); };
        img.src = urlFor(i);
      }));
    }
    await Promise.all(tasks);

    // Fallback: klatki proceduralne, gdy AI nieosiągalne (sieć/blokada)
    if(this.seq===mySeq && !this.frames.length){
      for(let i=0;i<n;i++){
        this.frames.push({img: this._procFrame(i, n), keyed:null, src:'demo'});
      }
      this._renderStrip();
      toast('AI nieosiągalne z tej sieci — użyłem klatek DEMO (rysuje przeglądarka). Pipeline klucza i eksportu działa identycznie.', true);
    }

    this.el.genBtn.disabled=false;
    if(this.seq!==mySeq) return;
    if(!this.frames.length){
      this.el.prog.hidden=true;
      this.el.info.textContent='0/0';
      toast('Nie udało się pobrać klatek — sprawdź sieć / spróbuj ponownie.', true);
      return;
    }
    this.sel=0;
    this._renderStrip();
    this._restart();
    this.el.opts.hidden=false;
    this.el.prog.hidden=true;
    const aiCount = this.frames.filter(f=>f.src==='ai').length;
    if(aiCount) toast(`Gotowe: ${aiCount}/${n} klatek AI. Podgląd gra w pętlę — dostroj chroma-key i eksportuj.`);
  },

  /* Proceduralna klatka demo: postać na tle koloru klucza */
  _procFrame(i, n){
    const S=512;
    const c=document.createElement('canvas'); c.width=S; c.height=S;
    const x=c.getContext('2d');
    const [kr,kg,kb]=this.keyColor;
    x.fillStyle=`rgb(${kr},${kg},${kb})`;
    x.fillRect(0,0,S,S);
    const ph=i/n*Math.PI*2;
    const cx=S/2, cy=S*0.55;
    const bodyR=S*0.26 + Math.sin(ph)*S*0.02;
    // ciało
    const g=x.createRadialGradient(cx-bodyR*.3, cy-bodyR*.4, bodyR*.1, cx, cy, bodyR*1.05);
    g.addColorStop(0,'#ffd9a8'); g.addColorStop(.6,'#ff7a1a'); g.addColorStop(1,'#b34f07');
    x.fillStyle=g;
    x.beginPath();
    x.ellipse(cx, cy + Math.sin(ph)*6, bodyR, bodyR*(1.05+Math.cos(ph)*.05), Math.sin(ph)*.08, 0, Math.PI*2);
    x.fill();
    // uszy
    x.fillStyle='#ff7a1a';
    x.beginPath(); x.moveTo(cx-bodyR*.55, cy-bodyR*.75); x.lineTo(cx-bodyR*.85, cy-bodyR*1.35); x.lineTo(cx-bodyR*.15, cy-bodyR*1.0); x.closePath(); x.fill();
    x.beginPath(); x.moveTo(cx+bodyR*.55, cy-bodyR*.75); x.lineTo(cx+bodyR*.85, cy-bodyR*1.35); x.lineTo(cx+bodyR*.15, cy-bodyR*1.0); x.closePath(); x.fill();
    // łapki (poza w każdej klatce)
    const arm=Math.sin(ph)*bodyR*.45;
    x.strokeStyle='#ff7a1a'; x.lineWidth=bodyR*.22; x.lineCap='round';
    x.beginPath(); x.moveTo(cx-bodyR*.85, cy+bodyR*.1); x.lineTo(cx-bodyR*1.25, cy-arm); x.stroke();
    x.beginPath(); x.moveTo(cx+bodyR*.85, cy+bodyR*.1); x.lineTo(cx+bodyR*1.25, cy+arm); x.stroke();
    // buzia
    x.fillStyle='#fff';
    x.beginPath(); x.arc(cx-bodyR*.32, cy-bodyR*.15, bodyR*.14, 0, Math.PI*2); x.fill();
    x.beginPath(); x.arc(cx+bodyR*.32, cy-bodyR*.15, bodyR*.14, 0, Math.PI*2); x.fill();
    x.fillStyle='#222';
    x.beginPath(); x.arc(cx-bodyR*.32, cy-bodyR*.13, bodyR*.07, 0, Math.PI*2); x.fill();
    x.beginPath(); x.arc(cx+bodyR*.32, cy-bodyR*.13, bodyR*.07, 0, Math.PI*2); x.fill();
    x.strokeStyle='#7a2d05'; x.lineWidth=bodyR*.08; x.lineCap='round';
    x.beginPath(); x.arc(cx, cy+bodyR*.25, bodyR*.3, Math.PI*.15, Math.PI*.85); x.stroke();
    return c;
  },

  _keyFrame(img){
    const S=480;
    const off=document.createElement('canvas'); off.width=S; off.height=S;
    const c=off.getContext('2d',{willReadFrequently:true});
    c.drawImage(img,0,0,S,S);
    const d=c.getImageData(0,0,S,S);
    const px=d.data;
    const [kr,kg,kb]=this.keyColor;
    const tol=this.toler, soft=Math.max(1,this.soft);
    for(let i=0;i<px.length;i+=4){
      const r=px[i],g=px[i+1],b=px[i+2];
      const dist=Math.sqrt((r-kr)**2+(g-kg)**2+(b-kb)**2);
      if(dist<tol) px[i+3]=0;
      else if(dist<tol+soft){
        const a=(dist-tol)/soft;
        px[i+3]=Math.round(px[i+3]*a);
        if(this.despill){
          // odsuń kolor klucza z piksela
          const k=Math.max(0,1-a);
          px[i]=Math.min(255, px[i]+ (r-kr)*-k*0.5 );
          px[i+1]=Math.min(255, px[i+1]+ (g-kg)*-k*0.5 );
          px[i+2]=Math.min(255, px[i+2]+ (b-kb)*-k*0.5 );
        }
      }
    }
    c.putImageData(d,0,0);
    return off;
  },

  _frame(i){
    const f=this.frames[i];
    if(!f) return null;
    if(!f.keyed) f.keyed = this._keyFrame(f.img);
    return f.keyed;
  },

  _render(){
    const ctx=this.ctx, c=this.el.canvas;
    ctx.clearRect(0,0,c.width,c.height);
    const f=this._frame(this.sel);
    if(f) ctx.drawImage(f,0,0);
    else {
      ctx.fillStyle='#1a2133';
      ctx.fillRect(0,0,c.width,c.height);
      ctx.fillStyle='#9aa3b8';
      ctx.font='600 16px system-ui'; ctx.textAlign='center';
      ctx.fillText('Wygeneruj klatki AI →', c.width/2, c.height/2-10);
      ctx.font='500 13px system-ui';
      ctx.fillText('Podgląd na szachownicy = przezroczystość', c.width/2, c.height/2+16);
    }
  },

  _restart(){
    clearInterval(this.timer);
    if(!this.frames.length) return;
    this.timer=setInterval(()=>{
      const n=this.frames.length;
      if(this.mode==='pingpong'){
        this.sel+=this.dir;
        if(this.sel>=n){this.sel=n-2;this.dir=-1;}
        if(this.sel<0){this.sel=1;this.dir=1;}
        if(n===1)this.sel=0;
      } else if(this.mode==='loop'){
        this.sel=(this.sel+1)%n;
      } else {
        if(this.sel<n-1) this.sel++;
      }
      this._render();
      this._markStrip();
    }, 1000/this.fps);
  },

  _renderStrip(){
    const s=this.el.strip;
    s.innerHTML='';
    this.frames.forEach((f,i)=>{
      const t=document.createElement('canvas');
      t.width=54;t.height=54;
      t.className='frame-thumb'+(i===this.sel?' sel':'');
      const tc=t.getContext('2d');
      tc.drawImage(f.img,0,0,54,54);
      t.title=`Klatka ${i+1}`;
      t.addEventListener('click',()=>{ this.sel=i; this._render(); this._markStrip(); });
      s.appendChild(t);
    });
  },
  _markStrip(){
    [...this.el.strip.children].forEach((el,i)=>el.classList.toggle('sel',i===this.sel));
  },

  async exportWebM(){
    if(!this.frames.length){ toast('Najpierw wygeneruj klatki.', true); return; }
    const c=document.createElement('canvas');
    c.width=480;c.height=480;
    const ctx=c.getContext('2d');
    const stream=c.captureStream(0);
    const track=stream.getVideoTracks()[0];
    let codecUsed='';
    let rec;
    try{
      rec=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp9',videoBitsPerSecond:6_000_000});
      codecUsed='VP9 alpha';
    }catch(e){
      try{ rec=new MediaRecorder(stream,{mimeType:'video/webm'}); codecUsed='WebM (bez gwarancji alpha)'; }
      catch(e2){ toast('Ta przeglądarka nie wspiera MediaRecorder WebM.', true); return; }
    }
    const chunks=[];
    rec.ondataavailable=e=>{ if(e.data&&e.data.size) chunks.push(e.data); };
    const done=new Promise(r=>rec.onstop=r);
    rec.start();

    const loops = this.mode==='once'?1:3;
    const n=this.frames.length;
    const framesSeq=[];
    for(let l=0;l<loops;l++){
      if(this.mode==='pingpong'){
        for(let i=0;i<n;i++)framesSeq.push(i);
        for(let i=n-2;i>0;i--)framesSeq.push(i);
      } else for(let i=0;i<n;i++)framesSeq.push(i);
    }
    const frameMs=1000/this.fps;
    for(const i of framesSeq){
      const f=this._frame(i);
      ctx.clearRect(0,0,480,480);
      if(f) ctx.drawImage(f,0,0);
      track.requestFrame && track.requestFrame();
      await new Promise(r=>setTimeout(r,frameMs));
    }
    rec.stop();
    await done;
    const blob=new Blob(chunks,{type:'video/webm'});
    downloadBlob(blob, 'iskra-postac-alpha.webm');
    toast(`Zapisano przezroczyste wideo: ${codecUsed}.`);
  },

  exportSprite(){
    if(!this.frames.length){ toast('Najpierw wygeneruj klatki.', true); return; }
    const S=256, n=this.frames.length;
    const cols=Math.min(4,n), rows=Math.ceil(n/cols);
    const c=document.createElement('canvas');
    c.width=cols*S; c.height=rows*S;
    const ctx=c.getContext('2d');
    this.frames.forEach((f,i)=>{
      const kf=this._frame(i);
      if(kf) ctx.drawImage(kf, (i%cols)*S, Math.floor(i/cols)*S, S, S);
    });
    c.toBlob(b=>{
      downloadBlob(b,'iskra-sprite.png');
      toast(`Sprite-sheet PNG: ${cols}×${rows} klatek po 256 px.`);
    },'image/png');
  }
};

function hexRGB2(hex){ const n=parseInt(hex.slice(1),16); return [(n>>16)&255,(n>>8)&255,n&255]; }
function downloadBlob(blob, name){
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=name;
  a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href), 4000);
}

window.Studio = Studio;
