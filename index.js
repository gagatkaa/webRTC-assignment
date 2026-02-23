const express = require("express");
const app = express();
const http = require("http");
const server = http.createServer(app);
const { Server } = require("socket.io");
const os = require("os");
const io = new Server(server);
const port = process.env.PORT || 3000;

const clients = {};
io.on("connection", (socket) => {
  clients[socket.id] = { id: socket.id };
  console.log("Socket connected", socket.id);

  clients[socket.id].x = 0;
  clients[socket.id].y = 0;

  socket.on("update", (targetSocketId, data) => {
    if (!clients[targetSocketId]) return;

    if (typeof data.x === "number") clients[socket.id].x = data.x;
    if (typeof data.y === "number") clients[socket.id].y = data.y;
    if (typeof data.gx === "number") clients[socket.id].gx = data.gx;
    if (typeof data.gy === "number") clients[socket.id].gy = data.gy;

    io.to(targetSocketId).emit("update", data);
  });

  socket.on("disconnect", () => {
    delete clients[socket.id];
  });
});

app.use(express.static("public"));

server.listen(port, () => {
  const networkInterfaces = os.networkInterfaces();
  for (const interfaceName in networkInterfaces) {
    for (const iface of networkInterfaces[interfaceName]) {
      if (iface.family === "IPv4" && !iface.internal) {
        console.log(`http://${iface.address}`);
      }
    }
  }
  console.log(`App listening on port ${port}!`);
});
