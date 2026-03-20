const socket = io({ reconnection: true });

// ── Canvas / DOM ──────────────────────────────────────────────────────────────
const canvas = document.getElementById("tank");
const ctx = canvas.getContext("2d");

const statusEl = document.getElementById("status");
const qrEl = document.getElementById("qr");
const overlay = document.getElementById("overlay");
const countdownEl = document.getElementById("countdown");
const countdownNumber = document.getElementById("countdown-number");
const readyScreenEl = document.getElementById("ready-screen");

// ── WebRTC ────────────────────────────────────────────────────────────────────
let peer = null;
let controllerSocketId = null;

function getIceConfig() {
  return {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      {
        urls: [
          "turn:openrelay.metered.ca:80",
          "turn:openrelay.metered.ca:443",
          "turn:openrelay.metered.ca:443?transport=tcp",
        ],
        username: "openrelayproject",
        credential: "openrelayproject",
      },
    ],
  };
}

function destroyPeer() {
  if (!peer) return;
  try {
    peer.destroy();
  } catch (err) {
    console.error("Destroy peer error:", err);
  }
  peer = null;
}

function createPeerForOffer(fromSocketId) {
  destroyPeer();
    controllerSocketId = fromSocketId;

  console.log("Creating desktop peer for controller:", controllerSocketId);

    peer = new SimplePeer({
      initiator: false,
      trickle: true,
    config: getIceConfig(),
    });

    peer.on("signal", (data) => {
    console.log("Desktop sending signal:", data.type, data);
      socket.emit("signal", controllerSocketId, data);
    });

    peer.on("connect", () => {
    console.log("Desktop peer connected");
      phoneConnected = true;
    statusEl.textContent = "Phone connected!";
      showReadyScreen();
    });

    peer.on("data", (data) => {
    const text = data.toString();
    console.log("Desktop received data:", text);

      try {
      handleDataChannelMessage(JSON.parse(text));
    } catch (err) {
      console.warn("Failed to parse data:", err);
      }
    });

    peer.on("close", () => {
      console.log("Peer connection closed");
      peer = null;
    phoneConnected = false;
    });

    peer.on("error", (err) => {
    console.error("Desktop peer error:", err);
  });

  const pc = peer._pc;
  if (pc) {
    pc.addEventListener("iceconnectionstatechange", () => {
      console.log("Desktop ICE state:", pc.iceConnectionState);
    });

    pc.addEventListener("connectionstatechange", () => {
      console.log("Desktop PC state:", pc.connectionState);
    });

    pc.addEventListener("icegatheringstatechange", () => {
      console.log("Desktop ICE gathering:", pc.iceGatheringState);
    });
  }
}

socket.on("signal", (_peerId, signalData, fromSocketId) => {
  console.log(
    "Signal received from phone:",
    signalData.type,
    signalData,
    fromSocketId,
  );

  if (!peer) {
    if (signalData.type !== "offer") {
      console.warn("Ignoring non-offer because no peer exists yet.");
      return;
    }
    createPeerForOffer(fromSocketId);
  }

  try {
  peer.signal(signalData);
  } catch (err) {
    console.error("peer.signal error:", err);
  }
});

// ── Game state ────────────────────────────────────────────────────────────────
let tankX = 0;
let tankY = 0;
let aimX = 1;
let aimY = 0;

let score = 0;
let bestScore = parseInt(localStorage.getItem("tiltSmashBest"), 10) || 0;
let lives = 5;
let gameOver = false;
let startTime = Date.now();
let phoneConnected = false;
let gameStarted = false;

const bullets = [];
const enemies = [];
const particles = [];
let spawnTimeoutId = null;

// ── Constants ─────────────────────────────────────────────────────────────────
const BULLET_SIZE = 10;
const BULLET_SPEED = 14;
const MUZZLE_LEN = 36;

const BULLET_COLOR = "#00ffaa";
const ENEMY_COLORS = ["#ff2d2d", "#ff7a00", "#ffd400"];
const ENEMY_SPEED_MIN = 0.6;
const ENEMY_SPEED_MAX = 1.2;
const ENEMY_SIZE_MIN = 18;
const ENEMY_SIZE_MAX = 34;
const SPAWN_MARGIN = 60;

// ── Ready screen / countdown ──────────────────────────────────────────────────
function showReadyScreen() {
  if (gameStarted) return;
  overlay.classList.add("hidden");
  readyScreenEl.classList.add("show");
}

function handleLetsGo() {
  readyScreenEl.classList.remove("show");

  [enemyHitSound, playerHitSound].forEach((sound) => {
    sound
      .play()
      .then(() => {
        sound.pause();
        sound.currentTime = 0;
      })
      .catch(() => {});
  });

  if (musicPlaying) {
    bgMusic.play().catch(() => {});
  }

  startCountdown();
}

window.handleLetsGo = handleLetsGo;

function startCountdown() {
  if (gameStarted) return;

  countdownEl.classList.add("show");

  let count = 3;
  countdownNumber.textContent = count;

  const interval = setInterval(() => {
    count -= 1;
    enemyHitSound.currentTime = 0;
    enemyHitSound.play().catch(() => {});

    if (count > 0) {
      countdownNumber.textContent = count;
      return;
    }

      clearInterval(interval);
      countdownEl.classList.remove("show");
      startTime = Date.now();
      gameStarted = true;
    startSpawnCycle();
  }, 1000);
}

// ── Music ────────────────────────────────────────────────────────────────────
const bgMusic = new Audio("/music.mp3");
bgMusic.loop = true;
bgMusic.volume = 0.4;
bgMusic.addEventListener("error", (e) =>
  console.error("Music error:", e, bgMusic.error),
);

let musicPlaying = true;

const enemyHitSound = new Audio("/enemyHitSound.wav");
const playerHitSound = new Audio("/playerHitSound.wav");
enemyHitSound.volume = 0.3;

// ── Music button hit area ────────────────────────────────────────────────────
const musicBtn = { x: 110, y: 44, w: 22, h: 22 };

canvas.addEventListener("click", (e) => {
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  if (
    mx >= musicBtn.x &&
    mx <= musicBtn.x + musicBtn.w &&
    my >= musicBtn.y &&
    my <= musicBtn.y + musicBtn.h
  ) {
    musicPlaying = !musicPlaying;
    if (musicPlaying) {
      if (gameStarted && !gameOver) bgMusic.play().catch(() => {});
    } else {
      bgMusic.pause();
    }
  }
});

// ── QR / overlay ─────────────────────────────────────────────────────────────
socket.on("connect", () => {
  // Build the controller URL using OUR socket id as the target
  const controllerURL = `${location.protocol}//${location.host}/controller.html?target=${socket.id}`;

  statusEl.textContent = "Scan to connect your phone:";

  const qr = qrcode(0, "M");
  qr.addData(controllerURL);
  qr.make();
  qrEl.innerHTML = qr.createImgTag(4, 8);
});

// ── Resize ───────────────────────────────────────────────────────────────────
function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener("resize", resize);
resize();

// ── Game Logic ──────────────────────────────────────────────────────────────
function handleDataChannelMessage(msg) {
  if (msg.type === "update") {
    handleUpdate(msg.data);
  } else if (msg.type === "shoot") {
    handleShoot(msg.data);
  } else if (msg.type === "restart") {
    restartGame();
  }
}

function handleUpdate(data) {
  if (gameOver) return;
  phoneConnected = true;

  if (typeof data.gx === "number") tankX = data.gx;
  if (typeof data.gy === "number") tankY = data.gy;
  if (typeof data.x === "number") tankX = data.x;
  if (typeof data.y === "number") tankY = data.y;

  const mag = Math.hypot(tankX, tankY);
  if (mag > 0.05) {
    const targetAimX = tankX / mag;
    const targetAimY = tankY / mag;
    aimX += (targetAimX - aimX) * 0.15;
    aimY += (targetAimY - aimY) * 0.15;
  }
}

function handleShoot(payload) {
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
}

function restartGame() {
  score = 0;
  lives = 5;
  gameOver = false;
  startTime = Date.now();

  bullets.length = 0;
  enemies.length = 0;

  tankX = 0;
  tankY = 0;
  aimX = 1;
  aimY = 0;

  if (musicPlaying) bgMusic.play().catch(() => {});

  startSpawnCycle();
  requestAnimationFrame(draw);
}

// ── Enemies ─────────────────────────────────────────────────────────────────
function rand(min, max) {
  return min + Math.random() * (max - min);
}

function pick(arr) {
  return arr[(Math.random() * arr.length) | 0];
}

function spawnParticles(x, y, color, size) {
  const count = 8 + Math.random() * 4;
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 2 + Math.random() * 4;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: size * 0.3 * (0.5 + Math.random() * 0.5),
      color,
      life: 1,
    });
  }
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

  const elapsed = gameStarted ? (Date.now() - startTime) / 1000 : 0;
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
  const elapsed = gameStarted ? (Date.now() - startTime) / 1000 : 0;
  const difficulty = Math.min(elapsed / 90, 1);
  return 2000 - difficulty * 1500;
}

function startSpawnCycle() {
  if (spawnTimeoutId) clearTimeout(spawnTimeoutId);

  function scheduleSpawn() {
    spawnTimeoutId = setTimeout(() => {
      if (!gameOver && gameStarted) spawnEnemy();
      if (!gameOver) scheduleSpawn();
    }, getSpawnInterval());
  }

  scheduleSpawn();
}

function hit(ax, ay, as, bx, by, bs) {
  return Math.abs(ax - bx) * 2 < as + bs && Math.abs(ay - by) * 2 < as + bs;
}

// ── Main Loop ────────────────────────────────────────────────────────────────
function draw() {
  const W = canvas.width;
  const H = canvas.height;

  ctx.clearRect(0, 0, W, H);

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

  const cx = W / 2 + tankX * (W / 2 - 40);
  const cy = H / 2 + tankY * (H / 2 - 40);
  const tankSize = 48;

  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.x += b.vx;
    b.y += b.vy;
    if (b.x < -80 || b.x > W + 80 || b.y < -80 || b.y > H + 80)
      bullets.splice(i, 1);
  }

  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    const dx = cx - e.x;
    const dy = cy - e.y;
    const mag = Math.hypot(dx, dy) || 1;
    e.x += (dx / mag) * e.speed;
    e.y += (dy / mag) * e.speed;

    if (hit(e.x, e.y, e.size, cx, cy, tankSize)) {
      enemies.splice(i, 1);
      lives -= 1;
      playerHitSound.currentTime = 0;
      playerHitSound.play().catch(() => {});
      if (lives <= 0) gameOver = true;
    }
  }

  for (let ei = enemies.length - 1; ei >= 0; ei--) {
    const e = enemies[ei];
    for (let bi = bullets.length - 1; bi >= 0; bi--) {
      const b = bullets[bi];
      if (hit(e.x, e.y, e.size, b.x, b.y, b.size)) {
        spawnParticles(e.x, e.y, e.color, e.size);
        enemyHitSound.currentTime = 0;
        enemyHitSound.play().catch(() => {});
        enemies.splice(ei, 1);
        bullets.splice(bi, 1);
        score += 1;
        if (score > bestScore) {
          bestScore = score;
          localStorage.setItem("tiltSmashBest", bestScore);
        }
        break;
      }
    }
  }

  ctx.fillStyle = BULLET_COLOR;
  for (const b of bullets)
    ctx.fillRect(b.x - b.size / 2, b.y - b.size / 2, b.size, b.size);

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.life -= 0.03;
    if (p.life <= 0) {
      particles.splice(i, 1);
      continue;
    }
    ctx.globalAlpha = p.life;
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;

  for (const e of enemies) {
    ctx.fillStyle = e.color;
    ctx.fillRect(e.x - e.size / 2, e.y - e.size / 2, e.size, e.size);
  }

  ctx.fillStyle = "#4a9";
  ctx.fillRect(cx - tankSize / 2, cy - tankSize / 2, tankSize, tankSize);

  ctx.strokeStyle = "#2d7";
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + aimX * MUZZLE_LEN, cy + aimY * MUZZLE_LEN);
  ctx.stroke();

  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.fillRect(0, 0, W, 64);

  ctx.fillStyle = "white";
  ctx.font = "bold 22px system-ui";
  ctx.textAlign = "center";
  ctx.fillText(`SCORE: ${score}`, W / 2, 38);

  if (bestScore > 0) {
    ctx.font = "12px system-ui";
    ctx.fillStyle = "#aaa";
    ctx.fillText(`BEST: ${bestScore}`, W / 2, 56);
  }

  ctx.font = "15px system-ui";
  ctx.textAlign = "left";
  ctx.fillText(`enemies: ${enemies.length}`, 20, 38);

  ctx.textAlign = "right";
  ctx.font = "22px system-ui";
  const heartsDisplay =
    "❤️".repeat(Math.max(0, lives)) + "🖤".repeat(Math.max(0, 5 - lives));
  ctx.fillText(heartsDisplay, W - 20, 38);

  // WebRTC indicator
  ctx.textAlign = "left";
  ctx.font = "12px system-ui";
  ctx.fillStyle = peer?.connected ? "#2d7" : "#f80";
  ctx.fillText(peer?.connected ? "● WebRTC" : "● Waiting...", 20, 58);

  // Music toggle
  const bx = musicBtn.x,
    by = musicBtn.y,
    bs = musicBtn.w;
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.strokeStyle = "#555";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(bx, by, bs, bs, 3);
  ctx.fill();
  ctx.stroke();
  const cx2 = bx + bs / 2,
    cy2 = by + bs / 2;
  ctx.fillStyle = "#ccc";
  if (musicPlaying) {
    ctx.fillRect(cx2 - 4, cy2 - 4, 3, 8);
    ctx.fillRect(cx2 + 1, cy2 - 4, 3, 8);
  } else {
    ctx.beginPath();
    ctx.moveTo(cx2 - 3, cy2 - 5);
    ctx.lineTo(cx2 + 5, cy2);
    ctx.lineTo(cx2 - 3, cy2 + 5);
    ctx.closePath();
    ctx.fill();
  }

  ctx.textAlign = "left";

  if (gameOver) {
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "white";
    ctx.font = "bold 48px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("GAME OVER", W / 2, H / 2);
    ctx.font = "18px system-ui";
    ctx.fillText(`score: ${score}`, W / 2, H / 2 + 36);
    if (score >= bestScore && score > 0) {
      ctx.fillStyle = "#ffd400";
      ctx.fillText("NEW BEST!", W / 2, H / 2 + 60);
    } else {
      ctx.fillStyle = "#aaa";
      ctx.fillText(`best: ${bestScore}`, W / 2, H / 2 + 60);
    }
    ctx.fillStyle = "white";
    ctx.fillText("Tap Restart on your phone", W / 2, H / 2 + 90);
    return;
  }

  requestAnimationFrame(draw);
}

// ── Start ────────────────────────────────────────────────────────────────────
startSpawnCycle();
draw();
