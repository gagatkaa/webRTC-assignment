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

---

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
