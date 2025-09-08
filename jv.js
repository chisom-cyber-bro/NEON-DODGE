/* jv.js - Final working Neon Dodge
   - Inline audio (royalty-free)
   - Keyboard controls fixed (Enter to start; arrow/WASD to move)
   - Mobile touch arrows show on touch devices
   - Shields protect for 30s, respawn 60s
   - Orbs = objectives; obstacles move and speed up per level
   - Level restart at same level on fail; victory at level 100
*/

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

function resizeCanvas(){
  canvas.width = Math.min(window.innerWidth, 1400);
  canvas.height = Math.min(window.innerHeight - 120, 800);
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// UI refs
const intro = document.getElementById('intro');
const settings = document.getElementById('settings');
const hud = document.getElementById('hud');
const levelLabel = document.getElementById('levelLabel');
const scoreLabel = document.getElementById('scoreLabel');
const shieldCountEl = document.getElementById('shieldCount');
const shieldBar = document.getElementById('shieldBar');
const mobileControls = document.getElementById('mobileControls');
const victory = document.getElementById('victory');
const confettiCanvas = document.getElementById('confettiCanvas');

// buttons
const startBtn = document.getElementById('startBtn');
const settingsBtn = document.getElementById('settingsBtn');
const settingsBack = document.getElementById('settingsBack');
const musicVol = document.getElementById('musicVol');
const sfxToggle = document.getElementById('sfxToggle');
const pauseBtn = document.getElementById('pauseBtn');
const resumeBtn = document.getElementById('resumeBtn');
const retryBtn = document.getElementById('retryBtn');
const menuBtn = document.getElementById('menuBtn');
const playAgainBtn = document.getElementById('playAgain');
const mainMenuBtn = document.getElementById('mainMenu');

const btnUp = document.getElementById('btnUp');
const btnDown = document.getElementById('btnDown');
const btnLeft = document.getElementById('btnLeft');
const btnRight = document.getElementById('btnRight');

// Inline audio (royalty-free)
const SOUND = {
  bg: new Audio("https://cdn.pixabay.com/download/audio/2022/03/15/audio_194d8a97b9.mp3?filename=future-ambient-112199.mp3"),
  fail: new Audio("https://cdn.pixabay.com/download/audio/2022/03/15/audio_9f6b47fbe2.mp3?filename=game-over-arcade-6435.mp3"),
  orb: new Audio("https://cdn.pixabay.com/download/audio/2022/03/15/audio_7d5c3f90f4.mp3?filename=collect-coin-2-1852.mp3"),
  shield: new Audio("https://cdn.pixabay.com/download/audio/2021/09/15/audio_5f6c7c8f0d.mp3?filename=powerup-6077.mp3"),
  victory: new Audio("https://cdn.pixabay.com/download/audio/2022/03/15/audio_4f3b27b7f6.mp3?filename=victory-6432.mp3")
};
SOUND.bg.loop = true;
SOUND.bg.volume = 0.5;
if(musicVol) musicVol.addEventListener('input', ()=> SOUND.bg.volume = parseFloat(musicVol.value));
if(sfxToggle) sfxToggle.addEventListener('change', ()=> {
  const mute = !sfxToggle.checked;
  SOUND.fail.muted = SOUND.orb.muted = SOUND.shield.muted = SOUND.victory.muted = mute;
});

// game state
let running = false;
let paused = false;
let level = 1;
let score = 0;
let player = null;
let obstacles = [];
let orbs = [];
let shields = [];
let shieldActive = false;
let shieldExpiresAt = 0;
let particles = [];
const isMobile = /Mobi|Android|iPhone/i.test(navigator.userAgent);

// input
const keys = { ArrowUp:false, ArrowDown:false, ArrowLeft:false, ArrowRight:false, w:false, a:false, s:false, d:false };

// show mobile controls if on touch device
if(isMobile) mobileControls.classList.remove('hidden');

// helpers
const rand = (a,b)=> Math.random()*(b-a)+a;
const clamp = (v,a,b)=> Math.max(a, Math.min(b,v));
const dist = (ax,ay,bx,by)=> Math.hypot(ax-bx, ay-by);
function circleRect(cx,cy,r, rx,ry,rw,rh){
  const nx = clamp(cx, rx, rx+rw);
  const ny = clamp(cy, ry, ry+rh);
  return dist(cx,cy,nx,ny) < r;
}

// factories
function makePlayer(){ return { x: Math.max(80, canvas.width*0.08), y: Math.max(80, canvas.height*0.08), r:14, speed:4.5, trail:[] }; }
function makeObstacle(){ const base = 1.6 + level*0.18; return { x: rand(0,canvas.width-60), y: rand(0,canvas.height-60), w: rand(28,70), h: rand(12,34), vx: (Math.random()<0.5?-1:1)*(base+Math.random()*1.2), vy: (Math.random()<0.5?-1:1)*(base+Math.random()*1.2) }; }
function makeOrb(){ return { x: rand(30,canvas.width-30), y: rand(30,canvas.height-30), r:10, collected:false }; }
function makeShield(){ return { x: rand(30,canvas.width-30), y: rand(30,canvas.height-30), r:12, active:true, respawnAt:0 }; }

// spawners
function spawnObstacles(){ obstacles=[]; const count = Math.min(3 + Math.floor(level*0.7), 40); for(let i=0;i<count;i++) obstacles.push(makeObstacle()); }
function spawnOrbs(){ orbs=[]; const count = Math.max(3, 3 + Math.floor(level/2)); for(let i=0;i<count;i++) orbs.push(makeOrb()); }
function spawnShields(){ shields=[]; for(let i=0;i<5;i++) shields.push(makeShield()); }

// start level
function startLevel(n){
  level = n; score = 0;
  player = makePlayer();
  spawnObstacles(); spawnOrbs(); spawnShields();
  shieldActive = false; shieldExpiresAt = 0;
  running = true; paused = false;
  hud.classList.remove('hidden');
  updateHUD();
  // ensure audio allowed: play bg (user must press Start/Enter first)
  SOUND.bg.play().catch(()=>{});
  // focus canvas so keyboard input works
  setTimeout(()=>{ try{ canvas.focus(); }catch(e){} }, 60);
  requestAnimationFrame(loop);
}

function updateHUD(){
  levelLabel.textContent = `Level: ${level}`;
  scoreLabel.textContent = `Orbs: ${score}/${orbs.length}`;
  shieldCountEl.textContent = `Shields: ${shields.filter(s=>s.active).length}`;
}

// input handlers (keyboard)
function setKey(k, v){ if(k in keys) keys[k]=v; }
document.addEventListener('keydown', (e)=>{
  const key = e.key;
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','a','s','d','W','A','S','D'].includes(key)){
    if(key==='ArrowUp' || key==='w' || key==='W') setKey('ArrowUp',true), setKey('w',true);
    if(key==='ArrowDown' || key==='s' || key==='S') setKey('ArrowDown',true), setKey('s',true);
    if(key==='ArrowLeft' || key==='a' || key==='A') setKey('ArrowLeft',true), setKey('a',true);
    if(key==='ArrowRight' || key==='d' || key==='D') setKey('ArrowRight',true), setKey('d',true);
    e.preventDefault();
  }
  // Enter to start (also works on intro)
  if((e.key === 'Enter' || e.code === 'Enter') && !running && !victory.classList.contains('hidden') === false){
    if(!intro.classList.contains('hidden')) startBtn.click();
  }
  // P pause/resume
  if(e.key.toLowerCase && e.key.toLowerCase() === 'p'){
    if(running && !paused) pauseGame(); else if(running && paused) resumeGame();
  }
  // R retry
  if(e.key.toLowerCase && e.key.toLowerCase() === 'r') { if(running) startLevel(level); }
});
document.addEventListener('keyup', (e)=>{
  const key = e.key;
  if(key === 'ArrowUp' || key==='w' || key==='W') setKey('ArrowUp',false), setKey('w',false);
  if(key === 'ArrowDown' || key==='s' || key==='S') setKey('ArrowDown',false), setKey('s',false);
  if(key === 'ArrowLeft' || key==='a' || key==='A') setKey('ArrowLeft',false), setKey('a',false);
  if(key === 'ArrowRight' || key==='d' || key==='D') setKey('ArrowRight',false), setKey('d',false);
});

// mobile button bindings (touch + mouse)
[['btnUp','ArrowUp'],['btnDown','ArrowDown'],['btnLeft','ArrowLeft'],['btnRight','ArrowRight']].forEach(([id,key])=>{
  const el = document.getElementById(id);
  if(!el) return;
  el.addEventListener('touchstart', ev=>{ ev.preventDefault(); setKey(key,true); }, {passive:false});
  el.addEventListener('touchend', ev=>{ ev.preventDefault(); setKey(key,false); }, {passive:false});
  el.addEventListener('mousedown', ()=> setKey(key,true));
  el.addEventListener('mouseup', ()=> setKey(key,false));
  el.addEventListener('mouseleave', ()=> setKey(key,false));
});

// shield pickup
function pickShield(s){
  if(!s.active) return;
  s.active = false;
  s.respawnAt = Date.now() + 60000; // 60s
  shieldActive = true;
  shieldExpiresAt = Date.now() + 30000; // 30s
  if(sfxToggle.checked) SOUND.shield.play();
  updateHUD();
  // small particle burst handled in loop
}

// confetti
function confettiBurst(){
  const c = confettiCanvas; const cc = c.getContext('2d');
  c.width = canvas.width; c.height = canvas.height;
  const pieces = [];
  for(let i=0;i<160;i++) pieces.push({x:Math.random()*c.width, y:-Math.random()*c.height, vx:Math.random()*6-3, vy:2+Math.random()*4, r:2+Math.random()*6, col:`hsl(${Math.random()*360},100%,60%)`});
  let frames = 0;
  function draw(){
    cc.clearRect(0,0,c.width,c.height);
    pieces.forEach(p=>{ p.x += p.vx; p.y += p.vy; cc.fillStyle = p.col; cc.beginPath(); cc.arc(p.x,p.y,p.r,0,Math.PI*2); cc.fill(); });
    frames++; if(frames < 420) requestAnimationFrame(draw); else cc.clearRect(0,0,c.width,c.height);
  }
  draw();
}

// main loop
function loop(){
  if(!running) return;
  if(paused){ requestAnimationFrame(loop); return; }

  // movement
  let mx = 0, my = 0;
  if(keys.ArrowLeft || keys.a) mx = -1;
  if(keys.ArrowRight || keys.d) mx = 1;
  if(keys.ArrowUp || keys.w) my = -1;
  if(keys.ArrowDown || keys.s) my = 1;
  if(mx !== 0 && my !== 0){ mx *= Math.SQRT1_2; my *= Math.SQRT1_2; }
  player.x += mx * player.speed;
  player.y += my * player.speed;
  player.x = clamp(player.x, player.r, canvas.width - player.r);
  player.y = clamp(player.y, player.r, canvas.height - player.r);

  // trail
  player.trail.push({x:player.x, y:player.y, life:20});
  if(player.trail.length > 30) player.trail.shift();

  // obstacles movement
  obstacles.forEach(o=>{
    o.x += o.vx; o.y += o.vy;
    if(o.x < 0 || o.x + o.w > canvas.width) o.vx *= -1;
    if(o.y < 0 || o.y + o.h > canvas.height) o.vy *= -1;
  });

  // respawn shields
  shields.forEach(s=>{
    if(!s.active && s.respawnAt && Date.now() >= s.respawnAt){ s.active = true; s.respawnAt = 0; updateHUD(); }
  });

  // shield expiry
  if(shieldActive && Date.now() >= shieldExpiresAt){ shieldActive = false; shieldExpiresAt = 0; }

  // collect orbs
  orbs.forEach(o=>{
    if(!o.collected && dist(player.x,player.y,o.x,o.y) < player.r + o.r){
      o.collected = true;
      score++;
      if(sfxToggle.checked) SOUND.orb.play();
      // particles
      for(let i=0;i<12;i++) particles.push({x:o.x, y:o.y, vx:rand(-2,2), vy:rand(-2,2), life:30, col:'#ffd700'});
      updateHUD();
    }
  });

  // collect shields
  shields.forEach(s=>{
    if(s.active && dist(player.x,player.y,s.x,s.y) < player.r + s.r){
      pickShield(s);
      for(let i=0;i<14;i++) particles.push({x:s.x, y:s.y, vx:rand(-2,2), vy:rand(-2,2), life:30, col:'#00ffff'});
    }
  });

  // check collisions with obstacles
  for(const o of obstacles){
    if(circleRect(player.x, player.y, player.r, o.x, o.y, o.w, o.h)){
      if(shieldActive){
        // shield protects; continue
      } else {
        // fail -> restart same level
        if(sfxToggle.checked) SOUND.fail.play();
        running = false;
        setTimeout(()=> startLevel(level), 900);
        return;
      }
    }
  }

  // level complete?
  if(orbs.every(o=>o.collected)){
    level++;
    if(level > 100){
      // victory
      running = false;
      hud.classList.add('hidden');
      victory.classList.remove('hidden');
      if(sfxToggle.checked) SOUND.victory.play();
      SOUND.bg.pause();
      confettiBurst();
      return;
    } else {
      startLevel(level);
      return;
    }
  }

  // drawing
  drawAll();

  // update HUD
  levelLabel.textContent = `Level: ${level}`;
  scoreLabel.textContent = `Orbs: ${score}/${orbs.length}`;
  shieldCountEl.textContent = `Shields: ${shields.filter(s=>s.active).length}`;
  if(shieldActive){
    const rem = Math.max(0, Math.ceil((shieldExpiresAt - Date.now())/1000));
    shieldBar.style.width = `${(rem/30)*100}%`;
  } else shieldBar.style.width = '0%';

  requestAnimationFrame(loop);
}

// draw everything
function drawAll(){
  ctx.clearRect(0,0,canvas.width,canvas.height);

  // orbs
  orbs.forEach(o=>{
    if(!o.collected){
      ctx.beginPath(); ctx.arc(o.x,o.y,o.r,0,Math.PI*2);
      ctx.fillStyle = '#ffd700'; ctx.shadowColor = '#ffd700'; ctx.shadowBlur = 18; ctx.fill(); ctx.closePath();
    }
  });

  // shields
  shields.forEach(s=>{
    if(s.active){
      ctx.beginPath(); ctx.arc(s.x,s.y,s.r,0,Math.PI*2);
      ctx.fillStyle = '#00ffff'; ctx.shadowColor = '#00ffff'; ctx.shadowBlur = 20; ctx.fill(); ctx.closePath();
    }
  });

  // obstacles
  ctx.fillStyle = '#ff33ff'; ctx.shadowColor = '#ff33ff'; ctx.shadowBlur = 12;
  obstacles.forEach(o=> ctx.fillRect(o.x,o.y,o.w,o.h));

  // particles
  for(let i=particles.length-1;i>=0;i--){
    const p = particles[i];
    ctx.fillStyle = p.col || '#0ff';
    ctx.globalAlpha = Math.max(0, p.life/30);
    ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI*2); ctx.fill(); ctx.closePath();
    p.x += p.vx; p.y += p.vy; p.life--;
    if(p.life <= 0) particles.splice(i,1);
    ctx.globalAlpha = 1;
  }

  // trail
  for(let i=0;i<player.trail.length;i++){
    const t = player.trail[i];
    ctx.fillStyle = `rgba(0,255,255,${i/player.trail.length})`;
    ctx.beginPath(); ctx.arc(t.x,t.y,4,0,Math.PI*2); ctx.fill(); ctx.closePath();
  }

  // player
  ctx.beginPath(); ctx.arc(player.x, player.y, player.r, 0, Math.PI*2);
  ctx.fillStyle = shieldActive ? '#b7ffb7' : '#ffffff';
  ctx.shadowColor = shieldActive ? '#b7ffb7' : '#00ffff';
  ctx.shadowBlur = 22; ctx.fill(); ctx.closePath();

  // shield aura
  if(shieldActive){
    ctx.beginPath(); ctx.arc(player.x, player.y, player.r + 10, 0, Math.PI*2);
    ctx.strokeStyle = 'rgba(183,255,183,0.9)'; ctx.lineWidth = 4; ctx.stroke(); ctx.closePath();
  }
}

// helper: start wrapper (used by Start button)
function startGame(){
  intro.classList.add('hidden');
  settings.classList.add('hidden');
  startLevel(1);
  SOUND.bg.play().catch(()=>{});
  setTimeout(()=>{ try{ canvas.focus(); } catch(e){} }, 60);
}
window.startGame = startGame;

// buttons wiring
startBtn.addEventListener('click', startGame);
settingsBtn.addEventListener('click', ()=>{ intro.classList.add('hidden'); settings.classList.remove('hidden'); });
settingsBack.addEventListener('click', ()=>{ settings.classList.add('hidden'); intro.classList.remove('hidden'); });

pauseBtn.addEventListener('click', ()=>{ paused = true; pauseBtn.classList.add('hidden'); resumeBtn.classList.remove('hidden'); SOUND.bg.pause(); });
resumeBtn.addEventListener('click', ()=>{ paused = false; resumeBtn.classList.add('hidden'); pauseBtn.classList.remove('hidden'); SOUND.bg.play().catch(()=>{}); requestAnimationFrame(loop); });
retryBtn.addEventListener('click', ()=> startLevel(level));
menuBtn.addEventListener('click', ()=> location.reload());
playAgainBtn.addEventListener('click', ()=> { victory.classList.add('hidden'); startLevel(1); SOUND.victory.pause(); SOUND.bg.play().catch(()=>{}); });
mainMenuBtn.addEventListener('click', ()=> location.reload());

// start level implementation
function startLevel(n){
  level = n; score = 0;
  player = makePlayer();
  spawnObstacles(); spawnOrbs(); spawnShields();
  shieldActive = false; shieldExpiresAt = 0;
  running = true; paused = false;
  hud.classList.remove('hidden');
  pauseBtn.classList.remove('hidden'); resumeBtn.classList.add('hidden');
  SOUND.bg.play().catch(()=>{});
  updateHUD();
  setTimeout(()=>{ try{ canvas.focus(); }catch(e){} }, 60);
  requestAnimationFrame(loop);
}

// spawn helpers
function spawnObstacles(){ obstacles = []; const count = Math.min(3 + Math.floor(level*0.7), 40); for(let i=0;i<count;i++) obstacles.push(makeObstacle()); }
function spawnOrbs(){ orbs = []; const count = Math.max(3, 3 + Math.floor(level/2)); for(let i=0;i<count;i++) orbs.push(makeOrb()); }
function spawnShields(){ shields = []; for(let i=0;i<5;i++) shields.push(makeShield()); }

// initial UI: show intro
hud.classList.add('hidden');
victory.classList.add('hidden');

// allow Enter to start while on intro
document.addEventListener('keydown', (e)=>{
  if((e.key === 'Enter' || e.code === 'Enter') && !running && !intro.classList.contains('hidden')){
    startBtn.click();
  }
});
