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

### Next step
Next step will be technical planning and Week 1 setup, focusing first on signaling and the data channel before building the visual layer.
