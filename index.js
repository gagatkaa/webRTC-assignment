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

const sessionMap = {}; 

io.on("connection", (socket) => {
  let sessionId = null;

  socket.on("register", (clientSessionId) => {
    sessionId = clientSessionId;

    
    if (!sessionMap[sessionId]) {
      sessionMap[sessionId] = { socketId: socket.id, x: 0, y: 0 };
    } else {
      sessionMap[sessionId].socketId = socket.id; 
    }

    console.log(`Session registered: ${sessionId} → socket ${socket.id}`);
    socket.emit("your-id", sessionId); 
  });

  socket.on("shoot", (targetSessionId, payload) => {
    const target = sessionMap[targetSessionId];
    // console.log(
    //   "SHOOT → target socketId:",
    //   target?.socketId,
    //   "is that socket alive?",
    //   !!io.sockets.sockets.get(target?.socketId),
    // );
    if (!target) return;
    io.to(target.socketId).emit("shoot", payload);
  });

  socket.on("update", (targetSessionId, data) => {
    const target = sessionMap[targetSessionId];
    if (!target) return;

    const me = sessionMap[sessionId];
    if (me) {
      if (typeof data?.x === "number") me.x = data.x;
      if (typeof data?.y === "number") me.y = data.y;
      if (typeof data?.gx === "number") me.gx = data.gx;
      if (typeof data?.gy === "number") me.gy = data.gy;
    }

    io.to(target.socketId).emit("update", data);
  });

  socket.on("disconnect", () => {
    console.log(`Socket disconnected: ${socket.id} (session: ${sessionId})`);
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
