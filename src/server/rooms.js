// Quản lý phòng trong bộ nhớ. Không phụ thuộc socket nên test được trực tiếp.
// ponytail: chỉ lưu RAM, restart server là mất phòng; thêm lưu JSON/SQLite khi cần giữ ván qua restart.
const crypto = require('node:crypto');
const { createGame, applyAction, publicState } = require('../game/engine');

const MAX_PLAYERS = 6;
const COLORS = ['#e53935', '#1e88e5', '#43a047', '#fb8c00', '#8e24aa', '#00acc1'];
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

const rooms = new Map();

const newCode = () => {
  for (;;) {
    const code = Array.from({ length: 5 }, () => CODE_CHARS[crypto.randomInt(CODE_CHARS.length)]).join('');
    if (!rooms.has(code)) return code;
  }
};

const cleanName = (n) => String(n || '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 20) || 'Người chơi';

function addPlayer(room, name) {
  const player = {
    id: crypto.randomBytes(6).toString('hex'),
    token: crypto.randomBytes(16).toString('hex'),
    name: cleanName(name),
    color: COLORS.find((c) => !room.players.some((p) => p.color === c)),
    connected: true,
  };
  room.players.push(player);
  return player;
}

function createRoom(name) {
  const room = { code: newCode(), status: 'lobby', hostId: null, players: [], game: null };
  room.hostId = addPlayer(room, name).id;
  rooms.set(room.code, room);
  return { room, player: room.players[0] };
}

function joinRoom(code, name, token) {
  const room = rooms.get(String(code || '').toUpperCase());
  if (!room) throw new Error('Không tìm thấy phòng.');
  const back = token && room.players.find((p) => p.token === token);
  if (back) {
    back.connected = true;
    return { room, player: back };
  }
  if (room.status !== 'lobby') throw new Error('Ván chơi đã bắt đầu.');
  if (room.players.length >= MAX_PLAYERS) throw new Error('Phòng đã đầy.');
  return { room, player: addPlayer(room, name) };
}

function startGame(room, playerId) {
  if (room.hostId !== playerId) throw new Error('Chỉ chủ phòng mới được bắt đầu.');
  if (room.status !== 'lobby') throw new Error('Ván chơi đã bắt đầu.');
  room.game = createGame({ players: room.players.map(({ id, name, color }) => ({ id, name, color })) });
  room.status = 'playing';
}

function doAction(room, playerId, action) {
  if (room.status !== 'playing') throw new Error('Ván chơi chưa bắt đầu.');
  const { type, size, assetId, amount, dice } = action || {};
  room.game = applyAction(room.game, { type, size, assetId, amount, dice, playerId });
}

function setConnected(room, playerId, connected) {
  const p = room.players.find((x) => x.id === playerId);
  if (p) p.connected = connected;
}

// Trạng thái gửi cho client: không có token, không có bộ bài.
function snapshot(room) {
  return {
    code: room.code,
    status: room.status,
    hostId: room.hostId,
    players: room.players.map(({ id, name, color, connected }) => ({ id, name, color, connected })),
    game: room.game ? publicState(room.game) : null,
  };
}

module.exports = { rooms, createRoom, joinRoom, startGame, doAction, setConnected, snapshot, MAX_PLAYERS };
