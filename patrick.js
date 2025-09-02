const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
canvas.width = 800;
canvas.height = 600;

let gameRunning = false;
let paused = false;
let currentLevel = 1;
let score = 0;
let checkpoint = 1;

// Music & Sounds
const bgMusic = new Audio("https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3");
bgMusic.loop = true;
bgMusic.volume = 0.5;
const sfxShield = new Audio("https://freesound.org/data/previews/341/341695_5858296-lq.mp3");
const sfxOrb = new Audio("https://freesound.org/data/previews/350/350895_5121236-lq.mp3");
const sfxFail = new Audio("https://freesound.org/data/previews/198/198841_2859979-lq.mp3");

// Player
const player = {
  x: 50, y: 50, r: 12,
  speed: 3, // a little faster now
  shieldActive: false,
  shieldTimeLeft: 0,
  trail: []
};

// Game objects
let orbs = [];
let obstacles = [];
let shields = [];

// Utility
function resetPlayer() {
  player.x = 50;
  player.y = 50;
  player.shieldActive = false;
  player.shieldTimeLeft = 0;
  player.trail = [];
}

// Level Generator
function generateLevel(level) {
  orbs = [];
  obstacles = [];
  shields = [];
  resetPlayer();

  // Orbs
  for (let i = 0; i < 3 + Math.floor(level / 3); i++) {
    orbs.push({
      x: Math.random() * (canvas.width - 30) + 15,
      y: Math.random() * (canvas.height - 30) + 15,
      r: 8
    });
  }

  // Obstacles
  for (let i = 0; i < Math.min(5 + Math.floor(level / 2), 25); i++) {
    obstacles.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      w: 40, h: 15,
      dx: (Math.random() < 0.5 ? -1 : 1) * (2 + level * 0.2),
      dy: (Math.random() < 0.5 ? -1 : 1) * (2 + level * 0.2)
    });
  }

  // Shields (5 max)
  for (let i = 0; i < 5; i++) {
    shields.push({
      x: Math.random() * (canvas.width - 30) + 15,
      y: Math.random() * (canvas.height - 30) + 15,
      r: 10,
      active: true,
      respawnTime: 0
    });
  }
}

// Collision helpers
function dist(ax, ay, bx, by) {
  return Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2);
}

// Game loop
function update() {
  if (!gameRunning || paused) return;

  // Movement
  if (keys["ArrowUp"]) player.y -= player.speed;
  if (keys["ArrowDown"]) player.y += player.speed;
  if (keys["ArrowLeft"]) player.x -= player.speed;
  if (keys["ArrowRight"]) player.x += player.speed;

  // Trail effect
  player.trail.push({ x: player.x, y: player.y });
  if (player.trail.length > 15) player.trail.shift();

  // Obstacles movement
  for (let o of obstacles) {
    o.x += o.dx;
    o.y += o.dy;
    if (o.x <= 0 || o.x + o.w >= canvas.width) o.dx *= -1;
    if (o.y <= 0 || o.y + o.h >= canvas.height) o.dy *= -1;
  }

  // Orbs collection
  orbs = orbs.filter(orb => {
    if (dist(player.x, player.y, orb.x, orb.y) < player.r + orb.r) {
      score++;
      if (document.getElementById("sfxToggle").checked) sfxOrb.play();
      return false;
    }
    return true;
  });

  // Shields
  shields.forEach(sh => {
    if (sh.active && dist(player.x, player.y, sh.x, sh.y) < player.r + sh.r) {
      player.shieldActive = true;
      player.shieldTimeLeft = 30 * 60; // 30s at 60fps
      sh.active = false;
      sh.respawnTime = 60 * 60; // 1 min
      if (document.getElementById("sfxToggle").checked) sfxShield.play();
    }
    if (!sh.active) {
      sh.respawnTime--;
      if (sh.respawnTime <= 0) sh.active = true;
    }
  });

  // Shield timer
  if (player.shieldActive) {
    player.shieldTimeLeft--;
    if (player.shieldTimeLeft <= 0) {
      player.shieldActive = false;
    }
  }

  // Collisions
  for (let o of obstacles) {
    if (player.x + player.r > o.x && player.x - player.r < o.x + o.w &&
        player.y + player.r > o.y && player.y - player.r < o.y + o.h) {
      if (!player.shieldActive) {
        if (document.getElementById("sfxToggle").checked) sfxFail.play();
        failLevel();
      }
    }
  }

  // Level cleared
  if (orbs.length === 0) {
    nextLevel();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Trail
  ctx.strokeStyle = "cyan";
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < player.trail.length - 1; i++) {
    ctx.moveTo(player.trail[i].x, player.trail[i].y);
    ctx.lineTo(player.trail[i + 1].x, player.trail[i + 1].y);
  }
  ctx.stroke();

  // Player
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.r, 0, Math.PI * 2);
  ctx.fillStyle = "white";
  ctx.shadowBlur = 20;
  ctx.shadowColor = "cyan";
  ctx.fill();
  ctx.closePath();

  // Shield aura
  if (player.shieldActive) {
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.r + 8, 0, Math.PI * 2);
    ctx.strokeStyle = "cyan";
    ctx.lineWidth = 3;
    ctx.shadowBlur = 20;
    ctx.shadowColor = "cyan";
    ctx.stroke();
  }

  // Orbs
  orbs.forEach(orb => {
    ctx.beginPath();
    ctx.arc(orb.x, orb.y, orb.r, 0, Math.PI * 2);
    ctx.fillStyle = "magenta";
    ctx.shadowBlur = 15;
    ctx.shadowColor = "magenta";
    ctx.fill();
  });

  // Obstacles
  obstacles.forEach(o => {
    ctx.fillStyle = "red";
    ctx.shadowBlur = 10;
    ctx.shadowColor = "red";
    ctx.fillRect(o.x, o.y, o.w, o.h);
  });

  // Shields
  shields.forEach(sh => {
    if (sh.active) {
      ctx.beginPath();
      ctx.arc(sh.x, sh.y, sh.r, 0, Math.PI * 2);
      ctx.fillStyle = "cyan";
      ctx.shadowBlur = 20;
      ctx.shadowColor = "cyan";
      ctx.fill();
    }
  });

  // HUD
  document.getElementById("levelDisplay").textContent = `Level: ${currentLevel}`;
  document.getElementById("scoreDisplay").textContent = `Score: ${score}`;

  // Shield indicator UI
  const shieldBar = document.querySelector("#shieldTimerBar::after");
  const barElem = document.getElementById("shieldTimerBar");
  if (player.shieldActive) {
    let percent = (player.shieldTimeLeft / (30 * 60)) * 100;
    barElem.style.setProperty("--shield-progress", percent + "%");
    barElem.style.background = "rgba(0,255,255,0.2)";
    barElem.style.boxShadow = "0 0 10px cyan";
    barElem.querySelector("::after");
  } else {
    barElem.style.setProperty("--shield-progress", "0%");
  }
}

// Game control
function nextLevel() {
  currentLevel++;
  if (currentLevel > 100) {
    gameRunning = false;
    document.getElementById("gameUI").classList.add("hidden");
    document.getElementById("victoryScreen").classList.remove("hidden");
    bgMusic.pause();
    return;
  }
  generateLevel(currentLevel);
}

function failLevel() {
  currentLevel = Math.floor((currentLevel - 1) / 10) * 10 + 1;
  generateLevel(currentLevel);
}

function gameLoop() {
  update();
  draw();
  requestAnimationFrame(gameLoop);
}

// Controls
let keys = {};
window.addEventListener("keydown", e => keys[e.key] = true);
window.addEventListener("keyup", e => keys[e.key] = false);

// UI Buttons
document.getElementById("startGameBtn").onclick = () => {
  document.getElementById("introScreen").classList.add("hidden");
  document.getElementById("gameUI").classList.remove("hidden");
  bgMusic.play();
  gameRunning = true;
  generateLevel(1);
  gameLoop();
};

document.getElementById("pauseBtn").onclick = () => {
  paused = true;
  document.getElementById("pauseMenu").classList.remove("hidden");
};

document.getElementById("resumeBtn").onclick = () => {
  paused = false;
  document.getElementById("pauseMenu").classList.add("hidden");
};

document.getElementById("retryBtn").onclick = () => {
  paused = false;
  document.getElementById("pauseMenu").classList.add("hidden");
  generateLevel(checkpoint);
};

document.getElementById("mainMenuBtn").onclick = () => {
  location.reload();
};

document.getElementById("playAgainBtn").onclick = () => {
  location.reload();
};

document.getElementById("victoryMainMenuBtn").onclick = () => {
  location.reload();
};

document.getElementById("settingsBtn").onclick = () => {
  document.getElementById("introScreen").classList.add("hidden");
  document.getElementById("settingsScreen").classList.remove("hidden");
};

document.getElementById("backToIntro").onclick = () => {
  document.getElementById("settingsScreen").classList.add("hidden");
  document.getElementById("introScreen").classList.remove("hidden");
};

document.getElementById("musicVolume").oninput = (e) => {
  bgMusic.volume = e.target.value;
};
