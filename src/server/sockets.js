const R = require('./rooms');
const { log } = require('./log');

function attachSockets(io) {
  io.on('connection', (socket) => {
    let ctx = null; // { room, playerId }

    const broadcast = (room) => io.to(room.code).emit('state', R.snapshot(room));
    // bọc handler: lỗi nghiệp vụ trả về cho đúng người gọi, không làm sập server
    const on = (event, fn) => socket.on(event, (payload, reply) => {
      const ack = typeof reply === 'function' ? reply : () => {};
      const who = { sid: socket.id, room: ctx && ctx.room.code, player: ctx && ctx.playerId };
      try {
        const out = fn(payload || {}) || {};
        log(event, { ...who, room: ctx && ctx.room.code, player: ctx && ctx.playerId, payload: event === 'game:action' ? payload : undefined, ok: true });
        ack({ ok: true, ...out });
      } catch (err) {
        log(event, { ...who, payload, ok: false, error: err.message });
        ack({ ok: false, error: err.message });
      }
    });

    // một socket chỉ có một người chơi: yêu cầu vào lần nữa trả lại chính người đó, không tạo thêm
    const again = (code) => {
      if (!ctx || (code && ctx.room.code !== String(code).toUpperCase())) return null;
      log('duplicate-join-ignored', { sid: socket.id, room: ctx.room.code, player: ctx.playerId });
      const player = ctx.room.players.find((p) => p.id === ctx.playerId);
      return { code: ctx.room.code, playerId: player.id, token: player.token };
    };

    const enter = ({ room, player }) => {
      ctx = { room, playerId: player.id };
      socket.join(room.code);
      broadcast(room);
      return { code: room.code, playerId: player.id, token: player.token };
    };

    on('room:create', ({ name }) => again() || enter(R.createRoom(name)));
    on('room:join', ({ code, name, token }) => again(code) || enter(R.joinRoom(code, name, token)));
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

    log('socket:connect', { sid: socket.id });
    socket.on('disconnect', (reason) => {
      log('socket:disconnect', { sid: socket.id, room: ctx && ctx.room.code, player: ctx && ctx.playerId, reason });
      if (!ctx) return;
      R.setConnected(ctx.room, ctx.playerId, false);
      broadcast(ctx.room);
    });
  });
}

module.exports = { attachSockets };
