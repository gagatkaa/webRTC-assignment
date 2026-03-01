const express = require("express");
const app = express();

const fs = require("fs");
const https = require("https");
const path = require("path");

const { Server } = require("socket.io");
const os = require("os");

const options = {
  key: fs.readFileSync(path.join(__dirname, "certs", "key.pem")),
  cert: fs.readFileSync(path.join(__dirname, "certs", "cert.pem")),
};

const server = https.createServer(options, app);
const io = new Server(server);
const port = process.env.PORT || 3000;

const clients = {};

io.on("connection", (socket) => {
  clients[socket.id] = { id: socket.id, x: 0, y: 0 };
  console.log("Socket connected", socket.id);

  socket.emit("your-id", socket.id);
  socket.on("shoot", (targetId, payload) => {
    io.to(targetId).emit("shoot", payload);
  });
  socket.on("update", (targetSocketId, data) => {
    if (!clients[targetSocketId]) return;

    if (typeof data?.x === "number") clients[socket.id].x = data.x;
    if (typeof data?.y === "number") clients[socket.id].y = data.y;
    if (typeof data?.gx === "number") clients[socket.id].gx = data.gx;
    if (typeof data?.gy === "number") clients[socket.id].gy = data.gy;

    io.to(targetSocketId).emit("update", data);
  });

  socket.on("disconnect", () => {
    console.log("Socket disconnected", socket.id);
    delete clients[socket.id];
  });
});

app.use(express.static("public"));

server.listen(port, "0.0.0.0", () => {
  const networkInterfaces = os.networkInterfaces();
  const allIPs = [];

  for (const interfaceName in networkInterfaces) {
    for (const iface of networkInterfaces[interfaceName]) {
      if (iface.family === "IPv4" && !iface.internal) {
        allIPs.push({ name: interfaceName, address: iface.address });
      }
    }
  }

  console.log("\nAll available addresses:");
  allIPs.forEach((i) =>
    console.log(`  [${i.name}] https://${i.address}:${port}`),
  );

  const preferred =
    allIPs.find((i) => i.address.startsWith("192.168.")) ||
    allIPs.find((i) => i.address.startsWith("10.")) ||
    allIPs[0];

  if (preferred) {
    console.log(
      `\n✅ Use this on your phone: https://${preferred.address}:${port}/controller.html\n`,
    );
  } else {
    console.log(`HTTPS listening on port ${port}`);
  }
});
