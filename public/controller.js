const statusEl = document.getElementById("status");
const enableBtn = document.getElementById("enable");
const debugEl = document.getElementById("debug");
const joystickEl = document.getElementById("joystick");
const knobEl = document.getElementById("knob");

function log(msg) {
  console.log(msg);
  debugEl.innerHTML += msg + "<br>";
  debugEl.scrollTop = debugEl.scrollHeight;
}

const params = new URLSearchParams(location.search);
const targetId = params.get("target") || params.get("id");

log("Protocol: " + location.protocol);
log("Target: " + (targetId || "MISSING"));

if (!targetId) {
  statusEl.textContent = "No target ID — scan the QR from the desktop.";
  enableBtn.disabled = true;
}

let sessionId = localStorage.getItem("controllerSessionId");
if (!sessionId) {
  sessionId = crypto.randomUUID();
  localStorage.setItem("controllerSessionId", sessionId);
}
log("Session ID: " + sessionId);

const socket = io({ reconnection: true });

socket.on("connect", () => {
  log("Socket " + socket.id);
  socket.emit("register", sessionId);
  statusEl.textContent = "Connected! Press Enable Motion.";
});

socket.on("your-id", (confirmedId) => {
  log("Session confirmed: " + confirmedId);
});

socket.on("connect_error", (err) => {
  log("Socket error " + err.message);
});

socket.on("disconnect", (reason) => {
  log("Socket disconnected: " + reason);
  stopAutoFire();
  statusEl.textContent = "Disconnected — reconnecting...";
});

let peer = null;

function startWebRTC() {
  log("Starting simple-peer...");

  if (peer) peer.destroy();

  peer = new SimplePeer({
    initiator: true,
    trickle: true,
    config: {
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    },
  });

  peer.on("signal", (data) => {
    console.log("Sending signal, type:", data.type);
    socket.emit("webrtcSignal", targetId, data);
  });

  peer.on("connect", () => {
    log("P2P connected!");
    statusEl.textContent = "P2P connected!";
  });

  peer.on("data", (data) => {
    log("Received: " + data);
  });

  peer.on("close", () => {
    log("Peer connection closed");
  });

  peer.on("error", (err) => {
    log("Peer error: " + err.code);
  });
}

socket.on("webrtcSignal", (signalData) => {
  if (peer) {
    peer.signal(signalData);
  }
});

function sendData(type, payload) {
  if (peer?.connected) {
    peer.send(JSON.stringify({ type, data: payload }));
  } else {
    if (type === "update") socket.emit("update", targetId, payload);
    else if (type === "shoot") socket.emit("shoot", targetId, payload);
  }
}

function sendMove(gx, gy) {
  if (!targetId) return;
  sendData("update", { gx, gy });
}

let aimX = 0;
let aimY = 0;

const SHOOT_EVERY_MS = 300;
const MIN_AIM_MAG = 0.08;
let shootTimer = null;

function setAim(x, y) {
  aimX = clamp(x, -1, 1);
  aimY = clamp(y, -1, 1);
}

function maybeStartAutoFire() {
  if (shootTimer) return;
  shootTimer = setInterval(() => {
    if (!targetId) return;
    const mag = Math.hypot(aimX, aimY);
    if (mag < MIN_AIM_MAG) return;
    sendData("shoot", { dirX: aimX / mag, dirY: aimY / mag, t: Date.now() });
  }, SHOOT_EVERY_MS);
  log("Auto-fire every " + SHOOT_EVERY_MS + "ms");
}

function stopAutoFire() {
  if (!shootTimer) return;
  clearInterval(shootTimer);
  shootTimer = null;
  log("Auto-fire stopped");
}

const noSleep = new NoSleep();

enableBtn.addEventListener("click", async () => {
  noSleep.enable();
  log("Button clicked, protocol=" + location.protocol);

  let useMotion = true;

  if (
    typeof DeviceOrientationEvent !== "undefined" &&
    typeof DeviceOrientationEvent.requestPermission === "function"
  ) {
    log("Requesting iOS permission...");
    try {
      const perm = await DeviceOrientationEvent.requestPermission();
      log("Permission: " + perm);
      useMotion = perm === "granted";
    } catch (e) {
      log("Permission error: " + e.message);
      useMotion = false;
    }
  }

  await startWebRTC();

  startMotion();
});

function startMotion() {
  enableBtn.style.display = "none";
  statusEl.textContent = "Tilt your phone to control the tank!";
  log("Listening for deviceorientation...");

  maybeStartAutoFire();

  let count = 0;
  window.addEventListener("deviceorientation", (e) => {
    count++;
    if (count <= 3)
      log(
        "event #" +
          count +
          ": gamma=" +
          e.gamma?.toFixed(1) +
          " beta=" +
          e.beta?.toFixed(1),
      );

    const gx = clamp((e.gamma ?? 0) / 30, -1, 1);
    const gy = clamp((e.beta ?? 0) / 40, -1, 1);

    sendMove(gx, gy);
    setAim(gx, gy);
  });

  setTimeout(() => {
    if (count === 0) {
      log("No gyro events after 2s — showing joystick as fallback.");
      showJoystick();
    }
  }, 2000);
}

function showJoystick() {
  joystickEl.style.display = "flex";
  statusEl.textContent = "Drag the circle to control the tank.";
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
    knobEl.style.transform = "translate(" + dx + "px, " + dy + "px)";

    const gx = dx / RADIUS;
    const gy = dy / RADIUS;

    sendMove(gx, gy);
    setAim(gx, gy);
  },
  { passive: false },
);

joystickEl.addEventListener("touchend", () => {
  knobEl.style.transform = "translate(0,0)";
  sendMove(0, 0);
  setAim(0, 0);
});

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}