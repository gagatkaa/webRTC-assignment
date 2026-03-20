process.on("uncaughtException", (err) => {
  console.error("CRASH:", err.message);
});

const express = require("express");
const https = require("https");
const fs = require("fs");
const { Server } = require("socket.io");
const os = require("os");

const app = express();
const port = process.env.PORT || 3000;

const options = {
  key: fs.readFileSync("certs/localhost.key"),
  cert: fs.readFileSync("certs/localhost.crt"),
};

const server = https.createServer(options, app);
const io = new Server(server);
const clients = {};

app.use(express.static("public"));

function emitClientList() {
  io.emit("clients", clients);
}

io.on("connection", (socket) => {
  clients[socket.id] = { id: socket.id };
  console.log(`User connected: ${socket.id}`);
  emitClientList();

  socket.on("signal", (peerId, signal) => {
    console.log(
      `Routing signal ${signal?.type || "unknown"} from ${socket.id} to ${peerId}`,
    );
    io.to(peerId).emit("signal", peerId, signal, socket.id);
  });

  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`);
    delete clients[socket.id];
    emitClientList();
  });
});

server.listen(port, "0.0.0.0", () => {
  const networkInterfaces = os.networkInterfaces();

  for (const interfaceName in networkInterfaces) {
    for (const iface of networkInterfaces[interfaceName]) {
      if (iface.family === "IPv4" && !iface.internal) {
        console.log(`https://${iface.address}:${port}`);
      }
    }
  }

  console.log(`App listening on port ${port}`);
});
