const socket = io();

const statusEl = document.getElementById("status");
const urlEl = document.getElementById("url");
const qrEl = document.getElementById("qr");
const hideBtn = document.getElementById("hide");
const canvas = document.getElementById("tank");
const ctx = canvas.getContext("2d");

// ── QR / overlay ────────────────────────────────────────────────────────────
socket.on("your-id", (myId) => {
  const controllerURL = `${location.protocol}//${location.host}/controller.html?target=${myId}`;

  statusEl.textContent = "Scan to connect your phone:";
  urlEl.textContent = controllerURL;
  urlEl.href = controllerURL;

  const qr = qrcode(0, "M");
  qr.addData(controllerURL);
  qr.make();
  qrEl.innerHTML = qr.createImgTag(4, 8);
});

hideBtn.addEventListener("click", () => {
  document.getElementById("overlay").style.display = "none";
});

// ── Canvas / tank rendering ──────────────────────────────────────────────────
let tankX = 0;
let tankY = 0;

// last aim direction so barrel doesn't glitch when centered
let aimX = 1;
let aimY = 0;

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener("resize", resize);
resize();

socket.on("update", (data) => {
  phoneConnected = true; // ← tell the game the phone is connected
  if (typeof data.gx === "number") tankX = data.gx;
  if (typeof data.gy === "number") tankY = data.gy;
  if (typeof data.x === "number") tankX = data.x;
  if (typeof data.y === "number") tankY = data.y;

  const mag = Math.hypot(tankX, tankY);
  if (mag > 0.15) {
    aimX = tankX / mag;
    aimY = tankY / mag;
  }
});

// ── Bullets ─────────────────────────────────────────────────────────────────
const bullets = [];
const BULLET_SIZE = 10;
const BULLET_SPEED = 14;
const MUZZLE_LEN = 36;

socket.on("shoot", (payload) => {
  let dirX = typeof payload?.dirX === "number" ? payload.dirX : aimX;
  let dirY = typeof payload?.dirY === "number" ? payload.dirY : aimY;

  const mag = Math.hypot(dirX, dirY);
  if (mag < 0.001) return;
  dirX /= mag;
  dirY /= mag;

  const W = canvas.width;
  const H = canvas.height;
  const cx = W / 2 + tankX * (W / 2 - 40);
  const cy = H / 2 + tankY * (H / 2 - 40);

  bullets.push({
    x: cx + dirX * MUZZLE_LEN,
    y: cy + dirY * MUZZLE_LEN,
    vx: dirX * BULLET_SPEED,
    vy: dirY * BULLET_SPEED,
    size: BULLET_SIZE,
  });
});

// ── Enemies ─────────────────────────────────────────────────────────────────
const enemies = [];
const ENEMY_COLORS = ["#ff2d2d", "#ff7a00", "#ffd400"];
const ENEMY_SPEED_MIN = 0.6;
const ENEMY_SPEED_MAX = 1.2;
const ENEMY_SIZE_MIN = 18;
const ENEMY_SIZE_MAX = 34;
const SPAWN_MARGIN = 60;

// ── Game state (MUST be outside draw so they don't reset every frame) ────────
let score = 0;
let gameOver = false;
let startTime = Date.now();
let frameCount = 0;
let phoneConnected = false;

function rand(min, max) {
  return min + Math.random() * (max - min);
}
function pick(arr) {
  return arr[(Math.random() * arr.length) | 0];
}

function spawnEnemy() {
  const W = canvas.width;
  const H = canvas.height;

  const side = (Math.random() * 4) | 0;
  let x, y;

  if (side === 0) {
    x = -SPAWN_MARGIN;
    y = rand(0, H);
  } else if (side === 1) {
    x = W + SPAWN_MARGIN;
    y = rand(0, H);
  } else if (side === 2) {
    x = rand(0, W);
    y = -SPAWN_MARGIN;
  } else {
    x = rand(0, W);
    y = H + SPAWN_MARGIN;
  }

  const elapsed = phoneConnected ? (Date.now() - startTime) / 1000 : 0;
  const difficulty = Math.min(elapsed / 60, 1);
  const speedBoost = difficulty * 3;

  enemies.push({
    x,
    y,
    size: rand(ENEMY_SIZE_MIN, ENEMY_SIZE_MAX),
    speed: rand(ENEMY_SPEED_MIN + speedBoost, ENEMY_SPEED_MAX + speedBoost),
    color: pick(ENEMY_COLORS),
  });
}

function getSpawnInterval() {
  const elapsed = phoneConnected ? (Date.now() - startTime) / 1000 : 0;
  const difficulty = Math.min(elapsed / 60, 1);
  return 700 - difficulty * 500; // 700ms → 200ms over 60 seconds
}

function scheduleSpawn() {
  setTimeout(() => {
    if (!gameOver && phoneConnected) spawnEnemy();
    if (!gameOver) scheduleSpawn();
  }, getSpawnInterval());
}

scheduleSpawn();

// ── Collision (square-square, center based) ──────────────────────────────────
function hit(ax, ay, as, bx, by, bs) {
  return Math.abs(ax - bx) * 2 < as + bs && Math.abs(ay - by) * 2 < as + bs;
}

// ── Main loop ───────────────────────────────────────────────────────────────
function draw() {
  frameCount++;

  const W = canvas.width;
  const H = canvas.height;

  ctx.clearRect(0, 0, W, H);

  // grid
  ctx.strokeStyle = "#222";
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  for (let y = 0; y < H; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }

  // tank in pixels
  const cx = W / 2 + tankX * (W / 2 - 40);
  const cy = H / 2 + tankY * (H / 2 - 40);
  const tankSize = 48;

  // update bullets
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.x += b.vx;
    b.y += b.vy;

    if (b.x < -80 || b.x > W + 80 || b.y < -80 || b.y > H + 80) {
      bullets.splice(i, 1);
      continue;
    }
  }

  // update enemies (chase tank)
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];

    const dx = cx - e.x;
    const dy = cy - e.y;
    const mag = Math.hypot(dx, dy) || 1;

    e.x += (dx / mag) * e.speed;
    e.y += (dy / mag) * e.speed;

    // enemy hits tank => game over
    if (hit(e.x, e.y, e.size, cx, cy, tankSize)) {
      gameOver = true;
    }
  }

  // bullet vs enemy
  for (let ei = enemies.length - 1; ei >= 0; ei--) {
    const e = enemies[ei];
    for (let bi = bullets.length - 1; bi >= 0; bi--) {
      const b = bullets[bi];
      if (hit(e.x, e.y, e.size, b.x, b.y, b.size)) {
        enemies.splice(ei, 1);
        bullets.splice(bi, 1);
        score += 1;
        break;
      }
    }
  }

  // draw bullets (RED squares)
  ctx.fillStyle = "red";
  for (const b of bullets) {
    ctx.fillRect(b.x - b.size / 2, b.y - b.size / 2, b.size, b.size);
  }

  // draw enemies
  for (const e of enemies) {
    ctx.fillStyle = e.color;
    ctx.fillRect(e.x - e.size / 2, e.y - e.size / 2, e.size, e.size);
  }

  // tank body
  ctx.fillStyle = "#4a9";
  ctx.fillRect(cx - tankSize / 2, cy - tankSize / 2, tankSize, tankSize);

  // barrel line
  ctx.strokeStyle = "#2d7";
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + aimX * MUZZLE_LEN, cy + aimY * MUZZLE_LEN);
  ctx.stroke();

  // HUD
  ctx.fillStyle = "white";
  ctx.font = "16px system-ui";
  ctx.fillText(`score: ${score}`, 20, 30);
  ctx.fillText(`enemies: ${enemies.length}`, 20, 52);

  // Show waiting message if phone not yet connected
  if (!phoneConnected) {
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "white";
    ctx.font = "bold 28px system-ui";
    ctx.fillText("Waiting for phone to connect...", W / 2 - 200, H / 2);
  }

  if (gameOver) {
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "white";
    ctx.font = "bold 48px system-ui";
    ctx.fillText("GAME OVER", W / 2 - 150, H / 2);
    ctx.font = "18px system-ui";
    ctx.fillText(`final score: ${score}`, W / 2 - 60, H / 2 + 36);
    ctx.fillText("refresh to restart", W / 2 - 85, H / 2 + 66);
    return;
  }

  requestAnimationFrame(draw);
}

draw();
