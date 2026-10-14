// Kiểm tra end-to-end qua Socket.IO thật: 2 client chơi một lượt.
const test = require('node:test');
const assert = require('node:assert/strict');
const { io: connect } = require('socket.io-client');
const { server } = require('../src/server/index');

const call = (sock, ev, payload) => new Promise((res) => sock.emit(ev, payload, res));
const nextState = (sock) => new Promise((res) => sock.once('state', res));

test('2 người chơi qua socket: tạo phòng, vào, bắt đầu, tung xúc xắc', async (t) => {
  await new Promise((r) => server.listen(0, r));
  const url = `http://localhost:${server.address().port}`;
  const a = connect(url);
  const b = connect(url);
  t.after(() => { a.close(); b.close(); server.close(); });

  const created = await call(a, 'room:create', { name: 'An' });
  assert.ok(created.ok && created.code);
  const joined = await call(b, 'room:join', { code: created.code, name: 'Bình' });
  assert.ok(joined.ok);
  assert.equal((await call(b, 'game:start', {})).ok, false); // không phải host

  const started = nextState(b);
  assert.ok((await call(a, 'game:start', {})).ok);
  assert.equal((await started).game.players.length, 2);

  assert.equal((await call(b, 'game:action', { type: 'ROLL' })).ok, false); // sai lượt
  const rolled = nextState(b);
  assert.ok((await call(a, 'game:action', { type: 'ROLL' })).ok);
  const st = await rolled;
  assert.ok(st.game.dice.length >= 1);
  assert.equal(st.players.length, 2);
});
