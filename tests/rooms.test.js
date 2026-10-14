const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../src/server/rooms');

test('tạo phòng, vào phòng, host bắt đầu', () => {
  const { room, player: host } = R.createRoom('An <b>');
  assert.equal(room.players[0].name, 'An b');
  const { player: guest } = R.joinRoom(room.code.toLowerCase(), 'Bình');
  assert.throws(() => R.startGame(room, guest.id), /chủ phòng/);
  R.startGame(room, host.id);
  assert.equal(room.status, 'playing');
  assert.equal(room.game.players.length, 2);
});

test('snapshot không lộ token và bộ bài', () => {
  const { room, player } = R.createRoom('An');
  R.startGame(room, player.id);
  const json = JSON.stringify(R.snapshot(room));
  assert.ok(!json.includes(player.token));
  assert.ok(!json.includes('"decks"'));
});

test('không vào được phòng đã bắt đầu, nhưng vào lại được bằng token', () => {
  const { room, player } = R.createRoom('An');
  R.startGame(room, player.id);
  assert.throws(() => R.joinRoom(room.code, 'Lạ'), /đã bắt đầu/);
  R.setConnected(room, player.id, false);
  const back = R.joinRoom(room.code, '', player.token);
  assert.equal(back.player.id, player.id);
  assert.equal(room.players[0].connected, true);
});

test('phòng tối đa 6 người, mã sai báo lỗi', () => {
  const { room } = R.createRoom('A');
  for (let i = 0; i < 5; i += 1) R.joinRoom(room.code, `P${i}`);
  assert.throws(() => R.joinRoom(room.code, 'thừa'), /đầy/);
  assert.throws(() => R.joinRoom('XXXXX', 'a'), /Không tìm thấy/);
});

test('hành động đi qua engine, sai lượt bị từ chối', () => {
  const { room, player } = R.createRoom('An');
  const { player: guest } = R.joinRoom(room.code, 'Bình');
  R.startGame(room, player.id);
  assert.throws(() => R.doAction(room, guest.id, { type: 'ROLL' }), /lượt/);
  R.doAction(room, player.id, { type: 'ROLL' });
  assert.ok(room.game.dice);
});
