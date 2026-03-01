const statusEl = document.getElementById("status");
const enableBtn = document.getElementById("enable");
const debugEl = document.getElementById("debug");
const joystickEl = document.getElementById("joystick");
const knobEl = document.getElementById("knob");

// ── Logging ──────────────────────────────────────────────────────────────────
function log(msg) {
  console.log(msg);
  debugEl.innerHTML += msg + "<br>";
  debugEl.scrollTop = debugEl.scrollHeight;
}

// ── 1. Target ID ─────────────────────────────────────────────────────────────
const params = new URLSearchParams(location.search);
const targetId = params.get("target") || params.get("id");

log("Protocol: " + location.protocol);
log("Target: " + (targetId || "MISSING ⚠️"));

if (!targetId) {
  statusEl.textContent = "⚠️ No target ID — scan the QR from the desktop.";
  enableBtn.disabled = true;
}

// ── 2. Socket ────────────────────────────────────────────────────────────────
const socket = io();

socket.on("connect", () => {
  log("Socket ✅ " + socket.id);
  statusEl.textContent = "Connected! Press Enable Motion.";
});

socket.on("connect_error", (err) => {
  log("Socket error ❌ " + err.message);
});

socket.on("disconnect", (reason) => {
  log("Socket disconnected: " + reason);
  stopAutoFire();
});

// Existing movement send
function sendMove(gx, gy) {
  if (!targetId || !socket.connected) return;
  socket.emit("update", targetId, { gx, gy });
}

// ── 2.5 Shooting state ───────────────────────────────────────────────────────
// We keep the latest aim vector here.
// Desktop can use it as "barrel direction".
let aimX = 0;
let aimY = 0;

const SHOOT_EVERY_MS = 300;
const MIN_AIM_MAG = 0.08; // deadzone so it doesn't shoot when nearly centered
let shootTimer = null;

function setAim(x, y) {
  // Clamp and store
  aimX = clamp(x, -1, 1);
  aimY = clamp(y, -1, 1);
}

function maybeStartAutoFire() {
  if (shootTimer) return;

  shootTimer = setInterval(() => {
    if (!targetId || !socket.connected) return;

    const mag = Math.hypot(aimX, aimY);
    if (mag < MIN_AIM_MAG) return;

    // Normalize direction so bullet speed is consistent
    const dirX = aimX / mag;
    const dirY = aimY / mag;

    socket.emit("shoot", targetId, {
      dirX,
      dirY,
      t: Date.now(),
    });
  }, SHOOT_EVERY_MS);

  log(`Auto-fire ✅ every ${SHOOT_EVERY_MS}ms`);
}

function stopAutoFire() {
  if (!shootTimer) return;
  clearInterval(shootTimer);
  shootTimer = null;
  log("Auto-fire stopped");
}

// ── 3. Motion button ─────────────────────────────────────────────────────────
enableBtn.addEventListener("click", async () => {
  log("Button clicked, protocol=" + location.protocol);

  if (
    typeof DeviceOrientationEvent !== "undefined" &&
    typeof DeviceOrientationEvent.requestPermission === "function"
  ) {
    log("Requesting iOS permission…");
    try {
      const perm = await DeviceOrientationEvent.requestPermission();
      log("Permission: " + perm);
      if (perm === "granted") {
        startMotion();
      } else {
        log("Denied — showing joystick.");
        showJoystick();
      }
    } catch (e) {
      log("Permission threw: " + e.message + " — showing joystick.");
      showJoystick();
    }
  } else {
    log("No permission API — starting motion directly.");
    startMotion();
  }
});

// ── 4. Gyro ──────────────────────────────────────────────────────────────────
function startMotion() {
  enableBtn.style.display = "none";
  statusEl.textContent = "📡 Tilt your phone to control the tank!";
  log("Listening for deviceorientation…");

  // start auto-fire once input method is active
  maybeStartAutoFire();

  let count = 0;
  window.addEventListener("deviceorientation", (e) => {
    count++;
    if (count <= 3)
      log(`event #${count}: γ=${e.gamma?.toFixed(1)} β=${e.beta?.toFixed(1)}`);

    const gx = clamp((e.gamma ?? 0) / 90, -1, 1);
    const gy = clamp((e.beta ?? 0) / 90, -1, 1);

    // Movement stays the same
    sendMove(gx, gy);

    // Aim uses same vector (tank direction / barrel direction)
    setAim(gx, gy);
  });

  setTimeout(() => {
    if (count === 0) {
      log("⚠️ No events after 2s — showing joystick as fallback.");
      showJoystick();
    }
  }, 2000);
}

// ── 5. Joystick fallback ─────────────────────────────────────────────────────
function showJoystick() {
  enableBtn.style.display = "none";
  joystickEl.style.display = "flex";
  statusEl.textContent = "Drag the circle to control the tank.";

  // start auto-fire once input method is active
  maybeStartAutoFire();
}

const RADIUS = 60;
let originX = 0,
  originY = 0;

joystickEl.addEventListener(
  "touchstart",
  (e) => {
    e.preventDefault();
    const rect = joystickEl.getBoundingClientRect();
    originX = rect.left + rect.width / 2;
    originY = rect.top + rect.height / 2;
  },
  { passive: false },
);

joystickEl.addEventListener(
  "touchmove",
  (e) => {
    e.preventDefault();
    let dx = e.touches[0].clientX - originX;
    let dy = e.touches[0].clientY - originY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > RADIUS) {
      dx = (dx / dist) * RADIUS;
      dy = (dy / dist) * RADIUS;
    }
    knobEl.style.transform = `translate(${dx}px, ${dy}px)`;

    const gx = dx / RADIUS;
    const gy = dy / RADIUS;

    // Movement stays the same
    sendMove(gx, gy);

    // Aim uses same vector
    setAim(gx, gy);
  },
  { passive: false },
);

joystickEl.addEventListener("touchend", () => {
  knobEl.style.transform = "translate(0,0)";
  sendMove(0, 0);
  setAim(0, 0);
});

// ── Helpers ──────────────────────────────────────────────────────────────────
function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}
