const path = require('node:path');
const http = require('node:http');
const express = require('express');
const { Server } = require('socket.io');
const { attachSockets } = require('./sockets');

const PORT = Number(process.env.PORT) || 3000;

const app = express();
app.use(express.static(path.join(__dirname, '..', '..', 'public')));
app.get('/healthz', (_req, res) => res.send('ok'));

const server = http.createServer(app);
const io = new Server(server);
attachSockets(io);

if (require.main === module) {
  server.listen(PORT, () => console.log(`Dòng Tiền chạy tại http://localhost:${PORT}`));
}

module.exports = { app, server, io };
