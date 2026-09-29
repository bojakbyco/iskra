/* ============================================================
   Iskra — silnik animowanej postaci (canvas 2D)
   Stany: idle, listen, think, speak, work, sleep, party
   ============================================================ */
'use strict';

const PALETTE = ['#ff7a1a','#ffb01a','#3ddc84','#57b3ff','#b17aff','#ff5470','#ffd23f','#00d4c8','#ff8fb1','#9adf5a','#5adfff','#c9a0ff'];

function shade(hex, amt){ // amt -1..1
  const n = parseInt(hex.slice(1),16);
  let r=(n>>16)&255,g=(n>>8)&255,b=n&255;
  if(amt>=0){ r+= (255-r)*amt; g+=(255-g)*amt; b+=(255-b)*amt; }
  else { r*= (1+amt); g*=(1+amt); b*=(1+amt); }
  return `rgb(${r|0},${g|0},${b|0})`;
}
function hexRGB(hex){ const n=parseInt(hex.slice(1),16); return [(n>>16)&255,(n>>8)&255,n&255]; }

class Dot {
  constructor(canvas, opts={}){
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.opts = Object.assign({
      color:'#ff7a1a', shape:'circle', eyes:'dot', acc:'none', aura:'sparks',
      size:1, pet:false, name:'Iskra'
    }, opts);
    this.state = 'idle';
    this.t = 0;                 // czas animacji
    this.last = performance.now();
    this.mouse = {x:.5, y:.35, inside:false};
    this.blink = 0;             // licznik mrugnięcia
    this.nextBlink = this._rand(1.5,4);
    this.mouthOpen = 0;         // 0..1 (mówienie)
    this.speakPulse = 0;
    this.parts = [];            // cząsteczki aury
    this.petAngle = 0;
    this.thinkBubbles = [];
    this._initParts();
    this._bindMouse();
    this.running = false;
  }
  _rand(a,b){ return a + Math.random()*(b-a); }
  _bindMouse(){
    const cv = this.cv;
    const rel = (e)=>{
      const r = cv.getBoundingClientRect();
      const p = e.touches ? e.touches[0] : e;
      this.mouse.x = (p.clientX - r.left)/r.width;
      this.mouse.y = (p.clientY - r.top)/r.height;
      this.mouse.inside = true;
    };
    cv.addEventListener('pointermove', rel);
    cv.addEventListener('pointerleave', ()=>{ this.mouse.inside=false; });
  }
  setOpts(o){ Object.assign(this.opts, o); this._initParts(); }
  setState(s){
    if(this.state!==s){ this.state=s; this.onstate && this.onstate(s); }
  }
  say(){ this.speakPulse = 1; } // wywołaj przy każdej "sylabie"

  _initParts(){
    this.parts = [];
    const n = this.opts.aura==='none'?0 : this.opts.aura==='orbit'?10 : 16;
    for(let i=0;i<n;i++){
      this.parts.push({
        a: Math.random()*Math.PI*2,
        r: this._rand(.55,.95),
        s: this._rand(.02,.05)*(Math.random()<.5?-1:1),
        size: this._rand(1.5,4),
        life: Math.random()
      });
    }
  }

  start(){
    if(this.running) return;
    this.running = true;
    const loop = (now)=>{
      if(!this.running) return;
      const dt = Math.min(50, now-this.last)/1000;
      this.last = now;
      this.t += dt;
      this._update(dt);
      this._draw();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
  stop(){ this.running=false; }

  /* ---------- UPDATE ---------- */
  _update(dt){
    const st = this.state;
    // mruganie
    this.nextBlink -= dt;
    if(this.nextBlink<=0){ this.blink=.18; this.nextBlink=this._rand(1.8,5); }
    if(this.blink>0) this.blink-=dt;
    // usta
    if(st==='speak'){
      this.speakPulse = Math.max(0,this.speakPulse-dt*2.5);
      this.mouthOpen = .35 + Math.abs(Math.sin(this.t*9))*.65;
    } else this.mouthOpen = Math.max(0,this.mouthOpen-dt*3);
    // cząsteczki
    for(const p of this.parts){
      p.a += p.s*dt* (st==='party'?4: st==='work'?2:1);
      p.life += dt*.6;
      if(p.life>1) p.life=0;
    }
    // pet
    this.petAngle += dt * (st==='party'?2.4:.8);
    // bąble myślenia
    if(st==='think'){
      if(Math.random()<dt*2.2 && this.thinkBubbles.length<4)
        this.thinkBubbles.push({y:0, a:0});
    }
    this.thinkBubbles.forEach(b=>{ b.y+=dt*.9; b.a=Math.min(1,b.a+dt*2); });
    this.thinkBubbles = this.thinkBubbles.filter(b=>b.y<1);
  }

  /* ---------- DRAW ---------- */
  _draw(){
    const {ctx,cv} = this;
    const W=cv.width, H=cv.height;
    ctx.clearRect(0,0,W,H);
    const o=this.opts;
    const st=this.state;
    const cx=W/2, cy=H*0.52;
    const base = Math.min(W,H)*0.30*o.size;
    const t=this.t;

    // rytm oddechu / stanów
    let sq=1, sy=1, wob=0, tilt=0;
    if(st==='idle'){ sy=1+Math.sin(t*1.6)*.02; }
    if(st==='listen'){ sy=1+Math.sin(t*3)*.015; sq=1.03; tilt=Math.sin(t*1.2)*.03; }
    if(st==='think'){ tilt=Math.sin(t*.8)*.12; }
    if(st==='speak'){ sy=1+Math.sin(t*10)*.03; }
    if(st==='work'){ wob=Math.sin(t*5)*.03; }
    if(st==='sleep'){ sy=.94+Math.sin(t*.9)*.012; tilt=.16; }
    if(st==='party'){ wob=Math.sin(t*8)*.06; sq=1+Math.cos(t*8)*.05; }

    const rx = base*sq*(1+wob), ry = base*sy;

    ctx.save();
    ctx.translate(cx,cy);
    ctx.rotate(tilt);

    // cień pod postacią
    ctx.save();
    ctx.rotate(-tilt);
    ctx.translate(0, base*1.18);
    ctx.scale(1,.28);
    ctx.beginPath(); ctx.arc(0,0,base*.8,0,Math.PI*2);
    ctx.fillStyle='rgba(0,0,0,.35)'; ctx.fill();
    ctx.restore();

    this._drawAura(rx, ry, st);
    this._drawBody(rx, ry, st);
    this._drawAccessory(rx, ry, st);
    this._drawFace(rx, ry, st);
    if(o.pet) this._drawPet(rx, ry, st);
    if(st==='think') this._drawBubbles(rx, ry);
    if(st==='sleep') this._drawZzz(rx, ry);
    ctx.restore();
  }

  _bodyPath(rx, ry, morph=0){
    // blob / squircle / gwiazdka przez path
    const ctx=this.ctx, o=this.opts;
    ctx.beginPath();
    if(o.shape==='circle'){
      ctx.ellipse(0,0,rx,ry,0,0,Math.PI*2);
    } else if(o.shape==='blob'){
      const k=8;
      for(let i=0;i<=k;i++){
        const a=i/k*Math.PI*2;
        const wob = 1 + Math.sin(a*3 + this.t*1.4)*.06 + Math.sin(a*5 - this.t*2)*.03;
        const px=Math.cos(a)*rx*wob, py=Math.sin(a)*ry*wob;
        i?ctx.lineTo(px,py):ctx.moveTo(px,py);
      }
      ctx.closePath();
    } else if(o.shape==='squircle'){
      const r=Math.min(rx,ry)*.42;
      const w=rx*.98,h=ry*.98;
      ctx.moveTo(-w+r,-h);
      ctx.arcTo(w,-h,w,h,r);
      ctx.arcTo(w,h,-w,h,r);
      ctx.arcTo(-w,h,-w,-h,r);
      ctx.arcTo(-w,-h,w,-h,r);
      ctx.closePath();
    } else if(o.shape==='star'){
      const spikes=5;
      for(let i=0;i<spikes*2;i++){
        const a=i/(spikes*2)*Math.PI*2 - Math.PI/2;
        const rad = i%2? .62:1;
        const px=Math.cos(a)*rx*rad, py=Math.sin(a)*ry*rad;
        i?ctx.lineTo(px,py):ctx.moveTo(px,py);
      }
      ctx.closePath();
    }
  }

  _drawBody(rx, ry, st){
    const ctx=this.ctx, o=this.opts;
    const c = o.color;
    // poświata
    ctx.save();
    ctx.shadowColor = c + (st==='party'?'cc':'88');
    ctx.shadowBlur = 24 + (st==='listen'?10:0) + Math.sin(this.t*2)*4;
    const g = ctx.createRadialGradient(-rx*.3,-ry*.4, rx*.1, 0,0, Math.max(rx,ry)*1.05);
    g.addColorStop(0, shade(c,.35));
    g.addColorStop(.65, c);
    g.addColorStop(1, shade(c,-.28));
    ctx.fillStyle=g;
    this._bodyPath(rx,ry);
    ctx.fill();
    ctx.restore();
    // highlight
    ctx.save();
    ctx.globalAlpha=.5;
    ctx.beginPath();
    ctx.ellipse(-rx*.32,-ry*.42, rx*.28, ry*.16, -.5, 0, Math.PI*2);
    ctx.fillStyle='rgba(255,255,255,.55)';
    ctx.fill();
    ctx.restore();
  }

  _drawAura(rx, ry, st){
    const ctx=this.ctx, o=this.opts, t=this.t;
    if(o.aura==='none'||!this.parts.length) return;
    ctx.save();
    for(const p of this.parts){
      let px,py,alpha=p.life*.8, sz=p.size;
      if(o.aura==='orbit'){
        px=Math.cos(p.a)*rx*1.35*p.r;
        py=Math.sin(p.a)*ry*1.35*p.r*.55 - ry*.2;
        alpha=.7; sz=3;
        ctx.fillStyle=shade(o.color,.5);
      } else if(o.aura==='sparks'){
        px=Math.cos(p.a)*rx*(1.05+p.life*.5);
        py=-ry*1.1 + p.life*ry*2.3;
        alpha=(1-p.life)*.9;
        ctx.fillStyle= Math.random()<.5? '#ffd23f': shade(o.color,.6);
      } else { // bubbles
        px=Math.cos(p.a)*rx*.95 + Math.sin(p.life*9)*6;
        py=ry*.9 - p.life*ry*2.1;
        alpha=(1-p.life)*.5;
        ctx.strokeStyle=shade(o.color,.4); ctx.lineWidth=1.4;
        ctx.beginPath(); ctx.arc(px,py,sz*1.6,0,Math.PI*2); ctx.stroke();
        continue;
      }
      ctx.globalAlpha=Math.max(0,alpha);
      ctx.beginPath(); ctx.arc(px,py,sz,0,Math.PI*2); ctx.fill();
    }
    ctx.restore();
  }

  _eyeTargets(rx, ry){
    // spojrzenie na kursor lub wahadło
    let tx=0, ty=0;
    if(this.mouse.inside){
      const W=this.cv.width,H=this.cv.height;
      const cx=W/2, cy=H*0.52;
      const mx=this.mouse.x*W-cx, my=this.mouse.y*H-cy;
      const d=Math.hypot(mx,my)||1;
      tx=(mx/d)*Math.min(1,d/220); ty=(my/d)*Math.min(1,d/220);
    } else {
      tx=Math.sin(this.t*.7)*.4; ty=Math.cos(this.t*.5)*.25;
    }
    return [tx*rx*.16, ty*ry*.18];
  }

  _drawFace(rx, ry, st){
    const ctx=this.ctx, o=this.opts, t=this.t;
    const [ex,ey]=this._eyeTargets(rx,ry);
    const eyeY=-ry*.08, gap=rx*.34;
    const blink = this.blink>0 || st==='sleep';

    ctx.save();
    ctx.fillStyle='#fff'; ctx.strokeStyle='#fff';

    const drawEye=(sx)=>{
      const x=sx+ex, y=eyeY+ey;
      if(o.eyes==='visor'){
        if(sx>0) return; // jeden wizor
        ctx.save();
        ctx.fillStyle='rgba(10,14,22,.85)';
        ctx.beginPath();
        ctx.roundRect(-rx*.62, eyeY-ry*.22, rx*1.24, ry*.46, ry*.22);
        ctx.fill();
        const n=5;
        for(let i=0;i<n;i++){
          const px=-rx*.4 + (i/(n-1))*rx*.8 + ex*.5;
          const on = st==='think' ? (Math.floor(t*4)%n===i) : true;
          ctx.fillStyle= on? shade(o.color,.65):'rgba(255,255,255,.15)';
          ctx.beginPath(); ctx.arc(px, eyeY+ey*.4, ry*.07,0,Math.PI*2); ctx.fill();
        }
        ctx.restore();
        return;
      }
      if(blink){
        ctx.strokeStyle='#fff'; ctx.lineWidth=ry*.06; ctx.lineCap='round';
        ctx.beginPath(); ctx.moveTo(x-rx*.13, y); ctx.lineTo(x+rx*.13, y); ctx.stroke();
        return;
      }
      if(o.eyes==='happy'){
        ctx.strokeStyle='#fff'; ctx.lineWidth=ry*.09; ctx.lineCap='round';
        ctx.beginPath(); ctx.arc(x, y+ry*.06, rx*.16, Math.PI*1.15, Math.PI*1.85); ctx.stroke();
        return;
      }
      const w = o.eyes==='oval'? rx*.11 : rx*.14;
      const h = o.eyes==='oval'? ry*.19 : rx*.14;
      ctx.beginPath(); ctx.ellipse(x,y,w,h,0,0,Math.PI*2); ctx.fill();
      // źrenica
      ctx.fillStyle='#141a26';
      ctx.beginPath(); ctx.ellipse(x+ex*.6, y+ey*.6+ry*.02, w*.45,h*.45,0,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#fff';
      ctx.beginPath(); ctx.arc(x-w*.25, y-h*.3, w*.18,0,Math.PI*2); ctx.fill();
    };
    drawEye(-gap); drawEye(gap);

    // usta
    const my=ry*.42;
    if(st==='speak'){
      const mo=this.mouthOpen;
      ctx.fillStyle='#2a1015';
      ctx.beginPath();
      ctx.ellipse(ex*.4, my+ey*.3, rx*.16, ry*(.06+.16*mo), 0,0,Math.PI*2);
      ctx.fill();
      ctx.fillStyle='#ff7a8f';
      ctx.beginPath();
      ctx.ellipse(ex*.4, my+ey*.3+ry*.08*mo, rx*.08, ry*.05*mo,0,0,Math.PI*2);
      ctx.fill();
    } else if(st==='sleep'){
      ctx.strokeStyle='#fff'; ctx.lineWidth=ry*.05; ctx.lineCap='round';
      ctx.beginPath(); ctx.arc(ex*.4, my-ry*.05, rx*.12, Math.PI*.15, Math.PI*.85); ctx.stroke();
    } else if(st==='party'){
      ctx.strokeStyle='#fff'; ctx.lineWidth=ry*.06; ctx.lineCap='round';
      ctx.beginPath(); ctx.arc(ex*.4, my-ry*.06, rx*.18, Math.PI*.1, Math.PI*.9); ctx.stroke();
    } else {
      ctx.strokeStyle='rgba(255,255,255,.85)'; ctx.lineWidth=ry*.045; ctx.lineCap='round';
      ctx.beginPath(); ctx.arc(ex*.4, my-ry*.05, rx*.15, Math.PI*.2, Math.PI*.8); ctx.stroke();
    }

    // rumieńce gdy party/listen
    if(st==='party'||st==='listen'){
      ctx.globalAlpha=.4;
      ctx.fillStyle='#ff5470';
      ctx.beginPath(); ctx.ellipse(-rx*.55, ry*.16, rx*.13, ry*.08,0,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(rx*.55, ry*.16, rx*.13, ry*.08,0,0,Math.PI*2); ctx.fill();
      ctx.globalAlpha=1;
    }
    ctx.restore();
  }

  _drawAccessory(rx, ry, st){
    const ctx=this.ctx, o=this.opts, t=this.t;
    ctx.save();
    if(o.acc==='halo'){
      ctx.strokeStyle='#ffd23f'; ctx.lineWidth=ry*.06;
      ctx.shadowColor='#ffd23f'; ctx.shadowBlur=14;
      ctx.beginPath();
      ctx.ellipse(0,-ry*1.22, rx*.55, ry*.14, Math.sin(t*.8)*.06, 0, Math.PI*2);
      ctx.stroke();
    } else if(o.acc==='antenna'){
      ctx.strokeStyle=shade(o.color,-.2); ctx.lineWidth=ry*.055; ctx.lineCap='round';
      ctx.beginPath(); ctx.moveTo(0,-ry*.92); ctx.quadraticCurveTo(rx*.12,-ry*1.2, rx*.2,-ry*1.32); ctx.stroke();
      const on = st==='think'||st==='work';
      ctx.fillStyle= on? '#ffd23f' : shade(o.color,.4);
      if(on){ ctx.shadowColor='#ffd23f'; ctx.shadowBlur=12; }
      ctx.beginPath(); ctx.arc(rx*.2,-ry*1.32, ry*.1,0,Math.PI*2); ctx.fill();
    } else if(o.acc==='headphones'){
      ctx.strokeStyle='#1b2130'; ctx.lineWidth=ry*.09;
      ctx.beginPath(); ctx.arc(0,-ry*.15, rx*.98, Math.PI*1.05, Math.PI*1.95); ctx.stroke();
      ctx.fillStyle='#262f45';
      ctx.beginPath(); ctx.roundRect(-rx*1.12,-ry*.15, rx*.24, ry*.34, ry*.1); ctx.fill();
      ctx.beginPath(); ctx.roundRect(rx*.88,-ry*.15, rx*.24, ry*.34, ry*.1); ctx.fill();
    } else if(o.acc==='glasses'){
      ctx.strokeStyle='#10151f'; ctx.lineWidth=ry*.06;
      const eyeY=-ry*.08, gap=rx*.34;
      ctx.beginPath(); ctx.arc(-gap,eyeY,rx*.2,0,Math.PI*2); ctx.stroke();
      ctx.beginPath(); ctx.arc(gap,eyeY,rx*.2,0,Math.PI*2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-gap+rx*.2,eyeY); ctx.lineTo(gap-rx*.2,eyeY); ctx.stroke();
    } else if(o.acc==='bow'){
      ctx.fillStyle='#ff5470';
      const bx=rx*.62, by=-ry*.78;
      ctx.beginPath();
      ctx.moveTo(bx,by);
      ctx.lineTo(bx+rx*.3,by-ry*.2); ctx.lineTo(bx+rx*.3,by+ry*.2); ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(bx,by);
      ctx.lineTo(bx-rx*.08,by-ry*.26); ctx.lineTo(bx+rx*.14,by-ry*.18); ctx.closePath(); ctx.fill();
      ctx.fillStyle='#ffd23f';
      ctx.beginPath(); ctx.arc(bx,by,ry*.07,0,Math.PI*2); ctx.fill();
    }
    ctx.restore();
  }

  _drawPet(rx, ry, st){
    const ctx=this.ctx, t=this.t;
    const a=this.petAngle;
    const px=Math.cos(a)*rx*1.55, py=Math.sin(a)*ry*1.1 - ry*.2;
    ctx.save();
    ctx.translate(px,py);
    ctx.rotate(Math.sin(t*3)*.2);
    // ciałko mini-dot
    ctx.shadowColor='#3ddc84'; ctx.shadowBlur=10;
    ctx.fillStyle='#3ddc84';
    ctx.beginPath(); ctx.ellipse(0,0,rx*.16,ry*.14,0,0,Math.PI*2); ctx.fill();
    // uszko/ogonek
    ctx.beginPath();
    ctx.moveTo(rx*.1,-ry*.1); ctx.lineTo(rx*.24,-ry*.26); ctx.lineTo(rx*.18,-ry*.06); ctx.closePath(); ctx.fill();
    // oko
    ctx.shadowBlur=0; ctx.fillStyle='#0b2417';
    ctx.beginPath(); ctx.arc(rx*.05,-ry*.02,rx*.035,0,Math.PI*2); ctx.fill();
    ctx.restore();
  }

  _drawBubbles(rx, ry){
    const ctx=this.ctx;
    this.thinkBubbles.forEach((b,i)=>{
      const y=-ry*1.0 - b.y*ry*.8;
      const x=rx*.5 + i*rx*.12;
      const r= (3+i*2.2)*b.a;
      ctx.globalAlpha=b.a*.9;
      ctx.strokeStyle='rgba(255,255,255,.75)'; ctx.lineWidth=1.6;
      ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.stroke();
      ctx.globalAlpha=1;
    });
  }

  _drawZzz(rx, ry){
    const ctx=this.ctx, t=this.t;
    ctx.save();
    ctx.fillStyle='rgba(255,255,255,.85)';
    ctx.font='700 '+Math.round(ry*.22)+'px system-ui';
    for(let i=0;i<3;i++){
      const ph=(t*.5+i*.33)%1;
      ctx.globalAlpha=(1-ph)*.8;
      ctx.fillText('z', rx*.55+ph*ry*.6, -ry*.9-ph*ry*.7 - i*4);
    }
    ctx.restore();
  }
}

window.Dot = Dot;
window.PALETTE = PALETTE;
