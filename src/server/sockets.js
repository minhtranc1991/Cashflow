const R = require('./rooms');

function attachSockets(io) {
  io.on('connection', (socket) => {
    let ctx = null; // { room, playerId }

    const broadcast = (room) => io.to(room.code).emit('state', R.snapshot(room));
    // bọc handler: lỗi nghiệp vụ trả về cho đúng người gọi, không làm sập server
    const on = (event, fn) => socket.on(event, (payload, reply) => {
      const ack = typeof reply === 'function' ? reply : () => {};
      try {
        ack({ ok: true, ...(fn(payload || {}) || {}) });
      } catch (err) {
        ack({ ok: false, error: err.message });
      }
    });

    const enter = ({ room, player }) => {
      ctx = { room, playerId: player.id };
      socket.join(room.code);
      broadcast(room);
      return { code: room.code, playerId: player.id, token: player.token };
    };

    on('room:create', ({ name }) => enter(R.createRoom(name)));
    on('room:join', ({ code, name, token }) => enter(R.joinRoom(code, name, token)));
    on('game:start', () => {
      if (!ctx) throw new Error('Bạn chưa vào phòng.');
      R.startGame(ctx.room, ctx.playerId);
      broadcast(ctx.room);
    });
    on('game:action', (action) => {
      if (!ctx) throw new Error('Bạn chưa vào phòng.');
      R.doAction(ctx.room, ctx.playerId, action);
      broadcast(ctx.room);
    });

    socket.on('disconnect', () => {
      if (!ctx) return;
      R.setConnected(ctx.room, ctx.playerId, false);
      broadcast(ctx.room);
    });
  });
}

module.exports = { attachSockets };
