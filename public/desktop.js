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

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener("resize", resize);
resize();

socket.on("update", (data) => {
  // data.gx / data.gy come from the phone's DeviceMotion / orientation
  // data.x  / data.y  can be a fallback joystick value
  if (typeof data.gx === "number") tankX = data.gx;
  if (typeof data.gy === "number") tankY = data.gy;
  if (typeof data.x === "number") tankX = data.x;
  if (typeof data.y === "number") tankY = data.y;
});

// Simple visual: a square that shifts position based on tilt
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
  const size = 48;

  ctx.fillStyle = "#4a9";
  ctx.fillRect(cx - size / 2, cy - size / 2, size, size);

 
  const angle = Math.atan2(tankY, tankX);
  ctx.strokeStyle = "#2d7";
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(angle) * 36, cy + Math.sin(angle) * 36);
  ctx.stroke();

  requestAnimationFrame(draw);
}
draw();
