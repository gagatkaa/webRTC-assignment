# webRTC-assignment

This assignment is about controlling a desktop JavaScript experience with a smartphone using a WebRTC data channel.

The smartphone acts as a controller and sends input data to the desktop in real time. WebSockets are only allowed for the signaling layer. The actual interaction must happen through a WebRTC data channel.

The setup has to be one to one and initiated through a QR code. The project runs locally using `npm install` and `npm start`. The full development process and AI usage must be documented in this README.

The goal is to build a working minimum viable product and progressively improve it while keeping track of decisions, reflections, and experiments.

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

## Next Step – Game States, Menu and Power-ups

Now that the core gameplay is stable I want to make it feel like an actual game and not just a technical demo.

First I want proper game states. Right now everything just loads straight into the canvas. I want a menu screen where the QR code is shown, then once the phone connects it transitions into the game, and when you die it shows a game over screen with the score and a restart option.

Second I want power-ups. Random pick-ups that appear on screen that the tank collects by moving over them. Things like a speed boost, a shield, or faster shooting. They should disappear if you do not reach them in time. That should make each run feel different.

And lastly some actual styling. The game looks very raw right now and I want to give it a proper visual identity with a cleaner HUD and visual feedback when you get hit or collect something.
