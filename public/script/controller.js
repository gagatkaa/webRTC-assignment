const statusEl = document.getElementById("status");
const enableBtn = document.getElementById("enable");
const restartBtn = document.getElementById("restart");
const debugEl = document.getElementById("debug");

function log(message) {
  console.log(message);
  if (!debugEl) return;

  debugEl.innerHTML += `${message}<br>`;

  const lines = debugEl.innerHTML.split("<br>");
  if (lines.length > 24) {
    debugEl.innerHTML = lines.slice(-24).join("<br>");
  }

  debugEl.scrollTop = debugEl.scrollHeight;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

const params = new URLSearchParams(location.search);
const targetId = params.get("target") || params.get("id");

log(`Protocol: ${location.protocol}`);
log(`Target: ${targetId || "MISSING"}`);

if (!targetId) {
  statusEl.textContent = "No target ID — scan the QR from the desktop.";
  enableBtn.disabled = true;
}

const socket = io({ reconnection: true });

socket.on("connect", () => {
  log(`Socket connected: ${socket.id}`);
  statusEl.textContent = "Connected. Press Enable Motion.";
});

socket.on("connect_error", (err) => {
  log(`Socket error: ${err.message}`);
});

socket.on("disconnect", (reason) => {
  log(`Socket disconnected: ${reason}`);
  stopAutoFire();
  destroyPeer();
  statusEl.textContent = "Disconnected — reconnecting...";
});

// ── WebRTC ────────────────────────────────────────────────────────────────────
let peer = null;

function destroyPeer() {
  if (!peer) return;

  try {
    peer.destroy();
  } catch (err) {
    log(`Destroy peer error: ${err.message}`);
  }

  peer = null;
}

function createPeer() {
  if (!targetId) return;

  destroyPeer();
  log("Creating peer...");

  peer = new SimplePeer({
    initiator: true,
    trickle: true,
    config: {
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
    },
  });

  peer.on("signal", (data) => {
    log(`Sending signal: ${data.type}`);
    socket.emit("signal", targetId, data);
  });

  peer.on("connect", () => {
    log("P2P connected!");
    statusEl.textContent = "Tilt your phone to control the tank.";
  });

  peer.on("data", (data) => {
    const text = data.toString();
    log(`Received: ${text}`);
  });

  peer.on("close", () => {
    log("Peer closed");
    peer = null;
  });

  peer.on("error", (err) => {
    console.error("Phone peer error:", err);
    log(`Peer error: ${err.message || err.code || "unknown"}`);
  });

  const pc = peer._pc;
  if (pc) {
    pc.addEventListener("iceconnectionstatechange", () => {
      log(`ICE state: ${pc.iceConnectionState}`);
    });

    pc.addEventListener("connectionstatechange", () => {
      log(`PC state: ${pc.connectionState}`);
    });

    pc.addEventListener("icegatheringstatechange", () => {
      log(`ICE gathering: ${pc.iceGatheringState}`);
    });
  }
}

socket.on("signal", (_myId, signalData, fromSocketId) => {
  log(`Phone received signal: ${signalData.type} from ${fromSocketId}`);

  if (!peer) {
    log("Received signal but peer does not exist yet.");
    return;
  }

  try {
    peer.signal(signalData);
  } catch (err) {
    log(`peer.signal error: ${err.message}`);
  }
});

// ── Data sending ──────────────────────────────────────────────────────────────
function sendData(type, payload) {
  if (!peer?.connected) return;

  try {
    peer.send(JSON.stringify({ type, data: payload }));
  } catch (err) {
    log(`Send error: ${err.message}`);
  }
}

function sendMove(gx, gy) {
  sendData("update", { gx, gy });
}

// ── Auto-fire ─────────────────────────────────────────────────────────────────
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
    const mag = Math.hypot(aimX, aimY);
    if (mag < MIN_AIM_MAG) return;

    sendData("shoot", {
      dirX: aimX / mag,
      dirY: aimY / mag,
      t: Date.now(),
    });
  }, SHOOT_EVERY_MS);

  log(`Auto-fire every ${SHOOT_EVERY_MS}ms`);
}

function stopAutoFire() {
  if (!shootTimer) return;

  clearInterval(shootTimer);
  shootTimer = null;
  log("Auto-fire stopped");
}

// ── Motion ────────────────────────────────────────────────────────────────────
const noSleep = new NoSleep();
let orientationListening = false;

async function enableMotion() {
  if (!targetId) return;

  log(`Button clicked, protocol=${location.protocol}`);

  try {
    if (
      typeof DeviceMotionEvent !== "undefined" &&
      typeof DeviceMotionEvent.requestPermission === "function"
    ) {
      log("Requesting iOS motion/orientation permissions...");

      const [motionPermission, orientationPermission] = await Promise.all([
        DeviceMotionEvent.requestPermission(),
        DeviceOrientationEvent.requestPermission(),
      ]);

      log(`Motion permission: ${motionPermission}`);
      log(`Orientation permission: ${orientationPermission}`);

      if (
        motionPermission !== "granted" ||
        orientationPermission !== "granted"
      ) {
        statusEl.textContent = "Motion permission denied.";
        return;
      }
    }

    try {
      await noSleep.enable();
      log("NoSleep enabled");
    } catch (err) {
      log(`NoSleep error: ${err.message}`);
    }

    createPeer();
    startMotion();

    enableBtn.style.display = "none";
    restartBtn.style.display = "inline-block";
  } catch (err) {
    log(`Permission error: ${err.message}`);
    statusEl.textContent = "Could not enable motion permission.";
  }
}
function startMotion() {
  if (orientationListening) return;

  orientationListening = true;
  statusEl.textContent = "Waiting for P2P connection...";
  log("Listening for deviceorientation...");

  maybeStartAutoFire();

  let count = 0;

  window.addEventListener("deviceorientation", (event) => {
    count += 1;

    if (count <= 3) {
      log(
        `event #${count}: gamma=${event.gamma?.toFixed(1)} beta=${event.beta?.toFixed(1)}`,
      );
    }

    const gx = clamp((event.gamma ?? 0) / 30, -1, 1);
    const gy = clamp((event.beta ?? 0) / 40, -1, 1);

    sendMove(gx, gy);
    setAim(gx, gy);
  });
}

enableBtn.addEventListener("click", enableMotion);

restartBtn.addEventListener("click", () => {
  log("Restart requested");
  sendData("restart", {});
});
