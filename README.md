# webRTC-assignment

This assignment is about controlling a desktop JavaScript experience with a smartphone using a WebRTC data channel.

The smartphone acts as a controller and sends input data to the desktop in real time. WebSockets are only allowed for the signaling layer. The actual interaction must happen through a WebRTC data channel.

The setup has to be one to one and initiated through a QR code. The project runs locally using `npm install` and `npm start`. The full development process and AI usage must be documented in this README.

The goal is to build a working minimum viable product and progressively improve it while keeping track of decisions, reflections, and experiments.

## 🔐 SSL Certificates

This project runs over HTTPS locally and requires self-signed certificates before starting.

Create the `certs/` folder and generate the certificates:

```bash
mkdir certs
openssl req -x509 -newkey rsa:4096 -keyout certs/localhost.key -out certs/localhost.crt -days 365 -nodes -subj "/CN=localhost"
```

## Week 1 – Concept Thinking

I created a project folder in ChatGPT and uploaded the project brief there so everything stays structured from the beginning and I can document the full thinking process.

I explained that the deadline is 22 March and that I want something strong but not overcomplicated. I was interested in using the gyroscope or accelerometer from the phone to make the interaction more physical.

First, we broke down what is actually required technically:

- WebRTC data channel for controls

- WebSocket only for signaling

- QR code one to one setup

- Local server with `npm install` and `npm start`

- README with development diary and AI reflection

- After that, we started ideating around the concept.

### First Exploration

#### My prompt

```
so now lets focus on the concept itself so I want to use smth extra
maybe the gyuroscrope or the accelerometr from the phone to controll stuff on the screen.
so what can we do ? maybe some 3d illustion with 2d ?
```

#### AI response summary

ChatGPT suggested several possible directions:

- Tilt the World

- Digital Terrarium

- Light Bender

- Perspective Illusion

I immediately liked Tilt the World because it connects physical movement with visual transformation in a very direct and intuitive way.

### Making it more Embodied

I did not want it to feel like just dragging shapes around. I wanted the phone to feel like it truly influences the environment.

#### My prompt

```
ok but how can we make it feel more interesting and less like just moving shapes around.
can we use like the accelerometer or the gyroscope?
is it going to be very complicated?
```

#### AI response summary

Instead of directly controlling object position, the phone could control gravity.
So tilting the phone changes gravity direction, and the desktop scene reacts physically.

This made the concept much stronger because the phone is no longer just a remote but a physical influence on a digital space.

### Final Concept Decision

After exploring different directions, I decided to go with the following concept:

- The phone becomes a gravity controller.
- The desktop becomes a digital terrarium.

By tilting the phone, the user manipulates gravity inside a digital environment displayed on the desktop.
Movement on the phone directly reshapes the digital space in real time using a WebRTC data channel.

## Next step

Next step will be technical planning and Week 1 setup, focusing first on signaling and the data channel before building the visual layer.

## Week 2 – Technical Setup and Getting the Connection Working

This week was fully focused on getting the actual technical foundation working:
server, sockets, QR code, and the phone-to-desktop connection.

---

### Starting Point

I started from the basic file structure provided by the assignment. I wrote
a basic `controller.js` and `desktop.js` myself, planning to extend them later
as the project grew. The server was already set up with Express and Socket.io.

The first real challenge was getting a secure connection working between the
desktop and the phone, since the gyroscope on iOS requires HTTPS.

---

### Setting Up HTTPS for iPhone Motion Support

I needed to connect a desktop browser and a phone using a QR code where the
phone acts as a controller using the gyroscope (`DeviceOrientation`).

The problem was that on iPhone, motion sensors do not work on insecure origins:

- `http://192.168.x.x` → blocked
- `http://localhost` → allowed (special browser exception)
- `https://192.168.x.x` → allowed if the certificate is trusted

So I had to configure my local Express server to run over HTTPS.

#### My prompt

```
so I am using express as a server and for this assignment i need to make a
connection between desktop and the phone via qr code so please revise this
code and show me issues that currently have there
```

#### AI response summary

Claude explained that the connection itself was not the problem. Socket.io
worked, the QR code worked, and the controller page opened correctly on the
phone. But pressing Enable Motion on iPhone always failed silently because
Safari blocks `DeviceOrientationEvent` on insecure origins.

While `localhost` is treated as a secure context by browsers, a LAN IP like
`http://192.168.x.x` is not. So the phone could reach the server but Safari
refused to grant motion permissions.

The solution was to run the Express server over HTTPS, generate a trusted local
certificate, trust it on the iPhone, and access the app via
`https://192.168.x.x:3000`.

#### My reflection

At first I assumed something was wrong in my permission handling or event
listener logic. Since everything else was working the motion issue felt like a
small bug in my code.

But the actual problem was architectural. This taught me that hardware APIs are
tightly controlled by the browser's security model, that a working connection
does not mean the environment is secure, and that platform-level restrictions
can easily look like application-level bugs. Once HTTPS was properly configured
and trusted, the motion worked immediately without any changes to my gyroscope
logic.

---

### Steps to Enable HTTPS (Windows edition)

#### Step 1 - Install mkcert

```powershell
winget install FiloSottile.mkcert
mkcert -install
```

`mkcert -install` registers a local certificate authority on your machine so
browsers trust the certificates it generates without showing a warning.

#### Step 2 - Generate certificates for your LAN IP

Run this from the project root, replacing the IP with your actual WiFi address:

```powershell
mkdir certs
mkcert -key-file certs/key.pem -cert-file certs/cert.pem 192.168.x.x localhost 127.0.0.1
```

This creates `certs/key.pem` and `certs/cert.pem`. These files are machine
specific and private - they go in `.gitignore` and are never committed.

#### Step 3 - Update Express to use HTTPS

```js
const fs = require("fs");
const https = require("https");
const path = require("path");

const options = {
  key: fs.readFileSync(path.join(__dirname, "certs", "key.pem")),
  cert: fs.readFileSync(path.join(__dirname, "certs", "cert.pem")),
};

const server = https.createServer(options, app);

server.listen(port, "0.0.0.0", () => {
  console.log(`https://192.168.x.x:${port}/desktop.html`);
});
```

Binding to `"0.0.0.0"` is important - without it the server only accepts
connections from the same machine and the phone cannot reach it.

---

## Shooting and Enemy System

Two days after getting the connection stable, I was testing the movement and saw the tank square actually responding to the phone in real time. That moment made me want to turn it into something more. Instead of just moving a shape around I decided to make a proper shooter - a tank the player controls, with enemies spawning from the edges and chasing its position. Shoot them before they reach you.

That decision shaped everything that followed.

---

### Adding Shooting

The idea was simple: the tank shoots automatically and continuously in whatever direction it is currently pointing. No button needed - the barrel just keeps firing.

#### My prompt

```
I want to add shooting to the game, the bullet should come out of the barrel
and go in the direction the tank is aiming.
```

#### AI response summary

Claude suggested adding a `shoot` socket event that fires on an interval rather than on button press. The server forwards it to the desktop, and the desktop creates a bullet object with a velocity based on the current aim direction. The game loop then moves and draws bullets each frame.

#### The problem

Everything looked correct but no bullets appeared at all. I assumed the velocity calculation was wrong or the draw loop was not rendering them. After going back and forth I realised I had forgotten to wire up the `socket.on("shoot")` listener properly on the desktop side. The server was forwarding the event correctly but the desktop was not receiving it.

#### My reflection

Classic three-point socket bug. Sender, relay, receiver - all three need to be wired. Missing one of them means the feature silently does nothing. Next time I will trace the full event path before assuming the logic is broken.

---

### Adding Enemies

Once shooting worked I wanted enemies. Simple coloured squares that spawn at the edges of the screen and chase the tank. Bullets destroy them, score goes up. If one reaches the tank, game over.

#### My prompt

```
write me a simple logic to add enemies, simple squares that follow the square
player origin and the player needs to shoot them down and if the square
gets too close its game over
```

#### AI response summary

Claude added an `enemies` array, a `spawnEnemy()` function that picks a random screen edge, and movement logic inside `draw()` that nudges each enemy toward the tank position each frame. Collision is a simple square-vs-square overlap check.

#### The problem - nothing appearing again

Loaded the game, no enemies. I asked why and Claude dug into the code.

The issue was that all the key game state variables - `score`, `gameOver`, `startTime`, `frameCount`, `phoneConnected` - had accidentally been placed **inside** the `draw()` function. That means they were re-declared and reset to their defaults on every single frame, 60 times per second. The game was essentially resetting itself constantly.

```js
// WRONG - inside draw(), so they reset every frame
let score = 0;
let gameOver = false;
let phoneConnected = false;
```

```js
// CORRECT - declared once at the top of the file
let score = 0;
let gameOver = false;
let phoneConnected = false;
```

#### My reflection

I had been following instructions across multiple messages and pasting code without thinking carefully about where it landed. The rule is simple: anything that needs to survive between frames lives outside `draw()`. Only temporary per-frame calculations go inside.

---

### Enemies Should Wait for the Phone

Even after fixing that, enemies spawned the moment the page loaded - before the phone was even connected. By the time a player scanned the QR code the tank was already surrounded.

#### Steps

I added a `phoneConnected` boolean flag, set to `false` at startup. The spawn scheduler checks the flag before spawning anything. The `socket.on("update")` handler - which receives movement data from the phone - sets it to `true` on the first message. A waiting overlay was also added so the screen does not just look broken before connection.

```js
socket.on("update", (data) => {
  phoneConnected = true; // game starts from first phone input
  ...
});
```

#### My reflection

Using the first `update` event as the game start trigger felt right. No extra handshake needed - the moment the player moves the phone, the game begins. It also means the difficulty timer only starts from that moment, which matters for the next thing I added.

---

### Difficulty Scaling

With enemies working I wanted the game to get harder over time rather than staying the same pace throughout.

#### What I implemented

I wanted enemies to start slow and get faster the longer you play. I added a difficulty multiplier that grows from 0 to 1 over the first 60 seconds and feeds into both the enemy speed and the spawn interval.

```js
const elapsed = phoneConnected ? (Date.now() - startTime) / 1000 : 0;
const difficulty = Math.min(elapsed / 60, 1);
const speedBoost = difficulty * 3;

speed: rand(ENEMY_SPEED_MIN + speedBoost, ENEMY_SPEED_MAX + speedBoost),
```

For the spawn rate I replaced the fixed `setInterval` with a `setTimeout` that recalculates the interval each time, so it gets shorter as difficulty increases.

```js
function getSpawnInterval() {
  const elapsed = phoneConnected ? (Date.now() - startTime) / 1000 : 0;
  const difficulty = Math.min(elapsed / 60, 1);
  return 700 - difficulty * 500;
}
```

#### My reflection

The ramp feels good in practice. The first 10-15 seconds give enough time to understand the controls before things get chaotic. Because `startTime` only ticks from when the phone connects, the difficulty clock does not start counting while you are still scanning the QR code.

## Keeping the Phone Screen Awake

During playtesting I noticed the phone screen would go to sleep mid-game, which stops the gyroscope and breaks the controls completely.

### The Problem

The OS auto-locks because the browser has no active touch input. The gyroscope runs silently in the background and the system does not consider that activity. This happens on both iOS and Android.

### First Attempt - Wake Lock API

My first approach was the native browser Wake Lock API:

```js
const wakeLock = await navigator.wakeLock.request("screen");
```

It works on modern Chrome and Safari 16.4+ but silently fails on older iOS versions with no fallback.

### Final Solution - NoSleep.js

---

I switched to NoSleep.js, a library built specifically for this problem.

- GitHub: https://github.com/richtr/NoSleep.js
- CDN: https://cdnjs.cloudflare.com/ajax/libs/nosleep/0.12.0/NoSleep.min.js

It works by playing a tiny invisible looping video in the background. Because a video is actively playing the OS never triggers auto-lock. It covers iOS Safari, Android Chrome, and all other major mobile browsers.

#### Implementation

Add the script in `controller.html`:

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/nosleep/0.12.0/NoSleep.min.js"></script>
```

Create the instance at the top of `controller.js`:

```js
const noSleep = new NoSleep();
```

Enable it inside the button click - browsers only allow this inside a real user gesture:

```js
enableBtn.addEventListener("click", async () => {
  noSleep.enable();
  // ... rest unchanged
});
```

#### My reflection

I first tried the Wake Lock API because it looked like the clean built in solution but it just did not work on my phone. Claude then suggested NoSleep.js which is a library that plays a tiny invisible video in the background to trick the OS into thinking something is active. A bit hacky but it works everywhere and that is what matters. I should have just started with that.

## Next Step - WebRTC

At this point the game was fully working over Socket.io but that meant Socket.io was being used for everything, including the actual game controls. Every shoot and update event was bouncing through the server instead of going directly between the phone and the desktop. The assignment explicitly requires WebRTC data channels for the controls, with WebSockets only allowed for signaling. Before moving on to polishing the game I needed to go back and fix the foundation first.

## Week 3 – Implementing WebRTC

I asked Claude what the steps were to properly implement WebRTC peer connection in the project, and it walked me through the full process.

### Understanding the Architecture First

Before touching any code, Claude explained how WebRTC signaling actually works and what role each part plays:

- **Socket.io stays** but only for the handshake. It relays three message types: `peerOffer`, `peerAnswer`, and `peerIce`. After that it sits idle.
- **RTCPeerConnection** is the native browser API that manages the peer-to-peer connection.
- **RTCDataChannel** is the channel that replaces the socket for actual game data. Once open, `shoot` and `update` messages travel directly phone to desktop with no server in the middle.
- **Controller = offerer** because it already knows the desktop session ID from the QR URL, so it naturally initiates. Desktop just waits and answers.

I had assumed WebRTC would need a lot of new infrastructure but seeing it broken down like this made it clear the server barely changes. Almost all the work is on the client side.

## What Changed in Each File

### index.js

The server got three new relay events, following the same pattern the teacher demonstrated:

```js
socket.on("peerOffer", (targetSessionId, offer) => {
  const target = sessionMap[targetSessionId];
  io.to(target.socketId).emit("peerOffer", targetSessionId, offer, socket.id);
});

socket.on("peerAnswer", (targetRawSocketId, answer) => {
  io.to(targetRawSocketId).emit(
    "peerAnswer",
    targetRawSocketId,
    answer,
    socket.id,
  );
});

socket.on("peerIce", (targetId, candidate) => {
  const bySession = sessionMap[targetId];
  if (bySession) {
    io.to(bySession.socketId).emit("peerIce", targetId, candidate, socket.id);
  } else {
    io.to(targetId).emit("peerIce", targetId, candidate, socket.id);
  }
});
```

The `peerAnswer` relay needed a special case. The desktop replies using the controller's raw socket ID, not a session UUID, so the lookup had to bypass the `sessionMap` entirely. Without this fix the answer was silently dropped and the connection never completed.

This was the part I would not have caught myself. I did not think about the difference between a session UUID and a raw socket ID until Claude pointed out that my server was mixing them up in the answer relay.

### controller.js

A `startWebRTC()` function was added that runs when the user taps the Enable button. It creates the `RTCPeerConnection`, opens the data channel as the offerer, and sends the offer to the desktop:

```js
pc = new RTCPeerConnection(RTC_CONFIG);
dataChannel = pc.createDataChannel("game", {
  ordered: false,
  maxRetransmits: 0, // drop stale packets, UDP-like behaviour
});
const offer = await pc.createOffer();
await pc.setLocalDescription(offer);
socket.emit("peerOffer", targetId, offer);
```

All `sendMove` and `sendData` calls now check if the data channel is open first and fall back to socket only if it is not ready:

```js
function sendData(type, payload) {
  if (rtcReady && dataChannel?.readyState === "open") {
    dataChannel.send(JSON.stringify({ type, data: payload }));
  } else {
    socket.emit(...); // fallback
  }
}
```

I liked this pattern. The game keeps working even during the brief window while WebRTC is negotiating, and once the channel opens everything switches over automatically without any manual intervention.

### desktop.js

The desktop listens for the offer and answers it. Because it is the answerer it does not create the data channel - it receives it via `ondatachannel`:

```js
socket.on("peerOffer", async (_, offer, fromSocketId) => {
  controllerSocketId = fromSocketId;
  pc = new RTCPeerConnection(RTC_CONFIG);
  pc.ondatachannel = (event) => {
    dataChannel = event.channel;
    dataChannel.onmessage = (e) => handleDataChannelMessage(JSON.parse(e.data));
  };
  await pc.setRemoteDescription(offer);
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  socket.emit("peerAnswer", controllerSocketId, answer);
});
```

## The ICE Candidate Race Condition Bug

After the first implementation the connection was stuck at `PC state: connecting` on both sides. The offer and answer were being exchanged correctly but the data channel never opened.

The problem was a race condition in ICE negotiation. The desktop sends its ICE candidates almost immediately after the answer. On the controller side those candidates were arriving before `setRemoteDescription` had finished executing. Calling `addIceCandidate` before the remote description is set causes WebRTC to silently drop the candidates. With no valid candidates the connection could never complete.

Claude identified this as the issue and the fix was to queue incoming ICE candidates and flush them only after `setRemoteDescription` had succeeded. I would not have found this on my own - there was no error, no crash, just silence. The connection sat at connecting and nothing happened. Without knowing the exact order WebRTC expects things in, there was nothing obvious to look for.

```js
socket.on("peerIce", async (_targetId, candidate) => {
  if (!remoteDescSet) {
    pendingIceCandidates.push(candidate); // hold it until ready
    return;
  }
  await pc.addIceCandidate(new RTCIceCandidate(candidate));
});

// inside peerAnswer handler, after setRemoteDescription:
remoteDescSet = true;
const queued = pendingIceCandidates.splice(0);
for (const c of queued) {
  await pc.addIceCandidate(new RTCIceCandidate(c));
}
```

Once that was in place the connection went through immediately. The controller log showed `ICE state: connected`, `PC state: connected`, and `WebRTC data channel open` all in sequence.

This was probably the most frustrating bug of the whole project. Everything looked like it was working - the offer and answer were being exchanged - but nothing actually connected. I had no idea where to look until Claude explained the WebRTC lifecycle and why candidate ordering matters.

### iOS Permission Order Bug

There was a second bug specific to iOS. The `DeviceOrientationEvent.requestPermission()` call was placed after `await startWebRTC()`. iOS requires that permission prompts are the very first thing inside a user gesture handler. Any `await` before it breaks the gesture context and Safari throws an error instead of showing the prompt.

The fix was to move the permission request to the top of the click handler before any other awaits:

```js
enableBtn.addEventListener("click", async () => {
  // iOS: permission request MUST come before any other await
  const perm = await DeviceOrientationEvent.requestPermission();
  // then start WebRTC
  await startWebRTC();
  startMotion();
});
```

### Result

After both fixes the full connection flow works correctly. The controller shows `P2P connected!` and all game data travels directly between the phone and the desktop. Socket.io is only active during the initial handshake. A small indicator in the desktop HUD confirms whether the active transport is WebRTC or socket fallback.

## Next Step – Game States, Menu and Power-ups

Now that the core gameplay is stable and the WebRTC data channel is properly in place I want to make it feel like an actual game and not just a technical demo.

First I want proper game states. Right now everything just loads straight into the canvas. I want a menu screen where the QR code is shown, then once the phone connects it transitions into the game, and when you die it shows a game over screen with the score and a restart option.

Second I want power-ups. Random pick-ups that appear on screen that the tank collects by moving over them. Things like a speed boost, a shield, or faster shooting. They should disappear if you do not reach them in time. That should make each run feel different.

And lastly some actual styling. The game looks very raw right now and I want to give it a proper visual identity with a cleaner HUD and visual feedback when you get hit or collect something.

## Migrating to simple-peer

The teacher suggested switching from raw WebRTC to `simple-peer` since working that low level was unnecessary for this project. On top of that I was having connection issues at school that I could not reproduce at home - pretty hard to debug. Switching to `simple-peer` fixed it. I learned a lot from the raw implementation but this was definitely the right move.

### What I Changed

**controller.js and desktop.js** - replaced all the manual `RTCPeerConnection`, ICE candidate handling, and offer/answer logic with a `SimplePeer` instance. Both sides now just emit and listen to a single `webrtcSignal` event and the library handles the rest.

**index.js** - replaced the three separate socket events (`peerOffer`, `peerAnswer`, `peerIce`) with one unified relay:

```javascript
socket.on("webrtcSignal", (targetId, signalData) => {
  const bySession = sessionMap[targetId];
  if (bySession) {
    io.to(bySession.socketId).emit("webrtcSignal", signalData, socket.id);
  } else {
    io.to(targetId).emit("webrtcSignal", signalData, socket.id);
  }
});
```

### My Reflection

Working through raw WebRTC first actually helped - I understand what the library is doing under the hood. But for a project like this it just adds complexity you do not need. Would use `simple-peer` from the start next time.

## Week4 - Simple peer + styling

After finishing the WebRTC migration I moved on to adding some extra features to the game.

### Restart Button

The first thing I added was a proper restart flow. When the game ends the phone shows a restart button and tapping it resets everything on the desktop. The server just relays the event through to the right desktop session:

```js
socket.on("restart", (targetSessionId) => {
  const target = sessionMap[targetSessionId];
  if (!target) return;
  io.to(target.socketId).emit("restart");
});
```

Simple relay, same pattern as everything else on the server. The desktop listens for `restart` and resets all game state back to the starting values.

---

### Particles and Sound Effects

The game felt very silent and flat when you hit an enemy - nothing to tell you something happened. I added two things to fix that: particles that burst out when an enemy dies, and sound effects for both taking damage and hitting an enemy.

For particles I added a `spawnParticles()` function that fires a burst of small squares in random directions whenever a bullet connects with an enemy. Each particle has a velocity, a size, and a `life` value that counts down to 0 so they fade out naturally:

```js
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
```

The draw loop updates and fades them out each frame using `globalAlpha`.

For sounds I added `enemyHitSound` and `playerHitSound` as `Audio` objects. The enemy hit plays when a bullet connects, the player hit plays when an enemy reaches the tank. I reset `currentTime` to 0 before each play so rapid hits don't get swallowed:

```js
enemyHitSound.currentTime = 0;
enemyHitSound.play().catch(() => {});
```

The game feels way more alive with both of these in. Hitting a chain of enemies now has actual crunch to it.

---

### Best Score, Better Menu and Countdown

The last batch of changes was about making the game feel more complete from start to finish.

**Best score** - I added a `bestScore` variable that reads from `localStorage` on load so it survives between sessions. Every time you score a point it checks if the new score beats the best and saves it:

```js
let bestScore = parseInt(localStorage.getItem("tiltSmashBest")) || 0;

if (score > bestScore) {
  bestScore = score;
  localStorage.setItem("tiltSmashBest", bestScore);
}
```

On the game over screen it shows the current score and best score. If you just beat your best it shows "NEW BEST!" in yellow instead.

**Menu screen** - the QR code waiting screen got a proper redesign. Instead of just a plain overlay it now has a big logo and title so it looks like an actual game menu rather than some not important thing.

**Countdown** - when the phone connects the game does not start immediately anymore. There is a 3-2-1 countdown first so the player has a moment to get ready. I reused the `enemyHitSound` as a tick sound on each number which gives it a nice rhythm. When it hits 0 the game starts.

#### My Reflection

These were all small individual changes but together they make the game feel finished. The particles and sounds give immediate feedback on every action. The best score gives you something to chase on repeat runs. The countdown removes that jarring jump straight into gameplay. None of it is technically complex but it makes a big difference in how the game feels to actually play.

## Week 5 – ICE Failures, Cleanup and Simplification

### The Connection Problem

Everything worked fine on my home wifi - both phone and desktop connected instantly, Android and iPhone, no issues. But the moment I tested on the university network it broke. The ICE negotiation was getting blocked by the network and the peer connection never completed.

I had a socket.io fallback in place for when WebRTC failed but instead of making things more stable it just made the code harder to follow. Two transport paths running in parallel, conditional checks everywhere, state that was hard to reason about. It was not a clean solution - it was a band-aid on top of a band-aid.

### Cleaning Up First

Before trying to fix the connection problem I decided the code needed a cleanup first. The project had grown messy over the weeks - things added quickly, workarounds left in, commented out code sitting around. `index.js` alone had grown to the point where I deleted over 100 lines that were either redundant, overcomplicated, or left over from earlier experiments.

The goal was to get back to something I could actually read and reason about before touching anything else.

### What Changed in index.js

The server ended up cleaner and more explicit after the rewrite:

**Added a crash handler** at the top so uncaught errors don't silently kill the process:

```javascript
process.on("uncaughtException", (err) => {
  console.error("CRASH:", err.message);
});
```

**Renamed the cert files** from `key.pem` / `cert.pem` to `localhost.key` / `localhost.crt` to make it clearer what they are and align with the generation command in the README.

**Converted `emitClientList` from an arrow function to a regular function declaration** - small but more consistent with the rest of the codebase.

**Added signal routing log** so it's visible in the console which signals are being relayed and between which peers - useful for debugging ICE issues:

```javascript
socket.on("signal", (peerId, signal) => {
  console.log(
    `Routing signal ${signal?.type || "unknown"} from ${socket.id} to ${peerId}`,
  );
  io.to(peerId).emit("signal", peerId, signal, socket.id);
});
```

### What changed in desktop.js

The problem was that I was only using a STUN server:

```javascript
iceServers: [{ urls: "stun:stun.l.google.com:19302" }];
```

STUN servers only help a device discover its public IP address. On a network that actively blocks peer-to-peer traffic - like a university network - STUN is not enough. The two devices can find each other but cannot actually send data directly between them.

The fix was to add a TURN server to the ICE config:

```javascript
{
  urls: [
    "turn:openrelay.metered.ca:80",
    "turn:openrelay.metered.ca:443",
    "turn:openrelay.metered.ca:443?transport=tcp",
  ],
  username: "openrelayproject",
  credential: "openrelayproject",
}
```

TURN acts as a relay - instead of the data going directly between the phone and the desktop, it goes through the TURN server. This gets around network restrictions because the traffic looks like normal HTTPS traffic on port 443. The connection is slower than a direct peer-to-peer link but it works everywhere.

I also pulled the ICE config out into its own function so it is easy to swap servers in one place:

```javascript
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
```

### What Changed in controller.js

Same TURN server fix as desktop.js - the before version only had a STUN server which is why the connection failed on the university network. TURN was added to the ICE config:

A few other things were cleaned up at the same time:

**`destroyPeer()` function** - before, peer cleanup was just `peer.destroy()` called inline. Now it's a proper function with a try/catch and a null check, and it's called on disconnect so a stale peer doesn't linger:

```javascript
socket.on("disconnect", (reason) => {
  stopAutoFire();
  destroyPeer(); // ← now called on disconnect
  statusEl.textContent = "Disconnected - reconnecting...";
});
```

**iOS permission fix** - the before version called `DeviceOrientationEvent.requestPermission()` after `startWebRTC()`. iOS requires the permission prompt to be the first thing inside a user gesture handler - any `await` before it breaks the gesture context and Safari silently fails. The after version requests both motion and orientation permissions first, before anything else runs:

```javascript
const [motionPermission, orientationPermission] = await Promise.all([
  DeviceMotionEvent.requestPermission(),
  DeviceOrientationEvent.requestPermission(),
]);
```

**Joystick removed** - the before version had a full virtual joystick fallback for devices without a gyroscope. It was removed to keep the controller focused. The gyroscope is required to play.

**`log()` made safe** - the debug div is now commented out in the HTML by default. The `log()` function was updated to check if `debugEl` exists before writing to it so the page doesn't crash when the div is absent:

```javascript
function log(message) {
  console.log(message);
  if (!debugEl) return;
  // ...
}
```

After those changes the connection worked on the university network.

### My Reflection

The university network problem was frustrating because it only showed up in one specific environment and worked everywhere else. Trying to patch around it with a socket fallback made the codebase harder to manage than the problem itself. Stepping back, deleting the overcomplicated parts, and simplifying first was the right call - it's much easier to debug a clean codebase than a messy one.

## Cleaning Up the File Structure

With the connection finally stable I turned my attention to the project structure. Everything had been growing organically and the CSS had ended up in the wrong places. I split the styling into dedicated files - one for the desktop game view, one for the controller - so each file only contains what it needs. Much easier to find things and make changes without worrying about breaking something on the other page.

### Styling

This was probably the most enjoyable part of the whole project so far. With the structure clean I could actually focus on making the game look good and watch it come together visually. I switched everything over to Press Start 2P to give it a consistent retro feel - the HUD, the overlays, the controller buttons, all of it. Seeing it go from raw canvas with plain system fonts to something that actually looks like a game was satisfying.

I also added the instructions section to the desktop overlay so new players know what to expect before connecting their phone. The debug div on the controller was commented out since the connection is stable and there is nothing left to debug - the phone UI is now clean with just the status text and buttons.

## Adding Power-ups

With the game feeling solid I moved on to the feature I had been planning since week 4 - collectibles and power-ups. The idea was to spawn random pick-ups on the screen that the tank collects by moving over them, each one giving a temporary effect. Things like a speed boost, a shield, or faster shooting to make each run feel different and give the player something to chase beyond just the score.

### Power-ups

With the core gameplay stable I wanted to add something that would make each run feel different. The idea was simple - spawn collectibles that chase the tank just like enemies do, but instead of hurting it they give a temporary boost when touched.

#### How They Work

Power-ups use the exact same movement system as enemies. Every frame they calculate the direction toward the tank and move along it at a fixed speed. The only difference is what happens on collision - instead of losing a life, the effect is applied and the power-up disappears.

```javascript
for (let i = powerups.length - 1; i >= 0; i -= 1) {
  const pu = powerups[i];
  const dx = cx - pu.x;
  const dy = cy - pu.y;
  const mag = Math.hypot(dx, dy) || 1;
  pu.x += (dx / mag) * POWERUP_SPEED;
  pu.y += (dy / mag) * POWERUP_SPEED;

  if (hit(pu.x, pu.y, POWERUP_SIZE, cx, cy, TANK_SIZE)) {
    applyPowerup(pu.type);
    powerups.splice(i, 1);
  }
}
```

They move slower than enemies (`POWERUP_SPEED = 0.6`) so the player has time to decide whether to go for them or focus on surviving.

### The Five Power-ups

There are five types split across three color families so they're easy to read at a glance on screen:

**Green - survival**

- `extraLife` - adds one heart back instantly, capped at 5

**Blue - shooting**

- `bigBullet` - bullets are 2.5x their normal size for 10 seconds
- `tripleShot` - fires three bullets in a spread for 10 seconds

**Purple - crowd control**

- `nuke` - instantly destroys every enemy on screen and spawns particles for each one
- `slow` - reduces all enemy speed to 30% for 10 seconds

#### Weighted Spawn

Not all power-ups spawn with equal probability. Extra life and nuke are more common because they have the most immediate impact on a run. Blue power-ups are rarer since they're more powerful offensively.

```javascript
const POWERUPS = [
  { type: "extraLife", color: "#44ff88", weight: 4 },
  { type: "bigBullet", color: "#44aaff", weight: 2 },
  { type: "tripleShot", color: "#2266ff", weight: 2 },
  { type: "nuke", color: "#cc44ff", weight: 3 },
  { type: "slow", color: "#aa22ff", weight: 2 },
];
```

The `pickWeighted()` function rolls a random number against the total weight and walks the list until it finds the winner - simple and easy to rebalance just by changing the numbers.

#### Triple Shot Rotation

The triple shot was the most interesting to implement. The left and right bullets need to fire at an angle from the main direction. I used a 2D rotation matrix to rotate the direction vector by ±0.3 radians:

```javascript
const spread = 0.3;
const left = {
  x: dirX * Math.cos(-spread) - dirY * Math.sin(-spread),
  y: dirX * Math.sin(-spread) + dirY * Math.cos(-spread),
};
const right = {
  x: dirX * Math.cos(spread) - dirY * Math.sin(spread),
  y: dirX * Math.sin(spread) + dirY * Math.cos(spread),
};
shootBullet(cx, cy, dirX, dirY);
shootBullet(cx, cy, left.x, left.y);
shootBullet(cx, cy, right.x, right.y);
```

#### Toast Notifications

When a power-up is collected a small message appears on the right side of the HUD in the matching color - `+1 LIFE`, `NUKE!`, `BIG BULLETS`, `TRIPLE SHOT`, or `ENEMIES SLOW`. It fades out slowly so the player has time to read it without it being distracting.

```javascript
function showToast(message, color) {
  activeToast = { message, color, life: 1 };
}
```

Each frame the `life` value ticks down and `globalAlpha` is set from it. The multiplier on the alpha controls how fast the fade actually kicks in - it stays fully opaque for most of its duration and then drops off at the end.

#### Power-up Legend on the Ready Screen

Since the power-ups aren't obvious from color alone I added a legend to the ready screen so players know what each color means before the game starts. Each entry is a colored square next to a short label, matching the exact colors used in the game.

#### My Reflection

The power-ups turned out to be one of the most fun things to add. Seeing the nuke wipe the screen clean with a burst of particles, or watching the enemies crawl during a slow - it changed the feel of the game completely. Each run now has moments where the timing of a power-up changes everything, which is exactly what I was going for.

## Final Reflection

This project was a fun experience but also a stressful one. The hardest part wasn't really the network - it was that I kept overcomplicating the code. Things would stop working and instead of stepping back I'd add another layer to fix it, which just made everything messier and harder to debug. At some point the codebase got to a state where I couldn't easily reason about it anymore and that's when I had to stop and clean everything up from scratch.

But I learned a lot from that. Bugs and errors are honestly one of the best ways to learn - when something breaks and you have to figure out why, it sticks in your memory in a way that just reading about it never does. For me the big lesson was to stop overcomplicating things. Simpler code is easier to fix, easier to read, and easier to build on top of.

I'm glad I did it. It was stressful at times but I had fun watching it grow from a basic canvas demo into something that actually feels like a game. And there's still more I'd want to add - this is the kind of project I could keep building on.
