const test = require('node:test');
const assert = require('node:assert/strict');
const { createGame, applyAction, publicState, finance, BOARD } = require('../src/game/engine');

// rng tất định: trả lần lượt các giá trị, hết thì lặp lại
const seq = (...v) => { let i = 0; return () => v[i++ % v.length]; };
const die = (n) => (n - 1) / 6 + 0.01; // rng cho ra mặt n
const two = () => createGame({
  players: [{ id: 'a', name: 'An', color: 'red' }, { id: 'b', name: 'Bình', color: 'blue' }],
  rng: seq(0.1, 0.5, 0.9),
});
const act = (s, a, rng) => applyAction(s, { playerId: s.players[s.current].id, ...a }, rng);

test('chỉ người đến lượt mới được hành động', () => {
  assert.throws(() => applyAction(two(), { playerId: 'b', type: 'ROLL' }), /lượt/);
});

test('tung xúc xắc di chuyển và ô cơ hội chuyển sang chọn loại thương vụ', () => {
  const s = act(two(), { type: 'ROLL' }, seq(die(2)));
  assert.equal(s.players[0].position, 2);
  assert.equal(BOARD[2], 'opportunity');
  assert.equal(s.phase, 'dealType');
});

test('đi qua ô lương thì nhận payday', () => {
  let s = two();
  const before = s.players[0].cash;
  const payday = finance(s.players[0]).payday;
  s.players[0].position = 3; // tung 3 => đi qua ô 5 (lương), dừng ở ô 6
  s = act(s, { type: 'ROLL' }, seq(die(3)));
  assert.equal(s.players[0].cash, before + payday);
});

test('mua tài sản: trừ tiền cọc, tăng thu nhập thụ động', () => {
  let s = two();
  s.players[0].cash = 10000;
  s.phase = 'deal';
  s.card = { kind: 'deal', name: 'Nhà thử', type: 'house', cost: 3000, mortgage: 40000, cashFlow: 100 };
  s = act(s, { type: 'BUY' });
  assert.equal(s.players[0].cash, 7000);
  assert.equal(finance(s.players[0]).passive, 100);
  assert.equal(s.phase, 'end');
});

test('không đủ tiền thì không mua được', () => {
  const s = two();
  s.players[0].cash = 10;
  s.phase = 'deal';
  s.card = { kind: 'deal', name: 'x', type: 'house', cost: 3000, mortgage: 0, cashFlow: 1 };
  assert.throws(() => act(s, { type: 'BUY' }), /không đủ tiền/);
});

test('doodad thiếu tiền thì tự vay, làm tròn 1.000', () => {
  let s = two();
  s.players[0].cash = 100;
  s.phase = 'doodad';
  s.card = { kind: 'doodad', name: 'TV', cost: 1200 };
  s = act(s, { type: 'PAY_DOODAD' });
  assert.equal(s.players[0].loan, 2000);
  assert.equal(s.players[0].cash, 900);
});

test('vay và trả nợ kiểm tra bội số 1.000', () => {
  let s = two();
  assert.throws(() => act(s, { type: 'TAKE_LOAN', amount: 500 }), /bội số/);
  s = act(s, { type: 'TAKE_LOAN', amount: 2000 });
  assert.equal(s.players[0].loan, 2000);
  s = act(s, { type: 'REPAY_LOAN', amount: 1000 });
  assert.equal(s.players[0].loan, 1000);
});

test('bị cắt giảm việc làm thì nghỉ 2 lượt', () => {
  let s = two();
  s.players[0].position = 18;
  s = act(s, { type: 'ROLL' }, seq(die(1)));
  assert.equal(BOARD[s.players[0].position], 'downsize');
  assert.equal(s.players[0].skip, 2);
});

test('người bị nghỉ lượt bị bỏ qua khi chuyển lượt', () => {
  let s = two();
  s.players[1].skip = 1;
  s.phase = 'end';
  s = act(s, { type: 'END_TURN' });
  assert.equal(s.current, 0); // b nghỉ, quay lại a
  assert.equal(s.players[1].skip, 0);
});

test('thu nhập thụ động >= chi phí thì thắng', () => {
  let s = two();
  const f = finance(s.players[0]);
  s.players[0].assets.push({ id: 99, name: 'Mỏ vàng', type: 'business', cost: 0, mortgage: 0, cashFlow: f.expenses });
  s.phase = 'end';
  s = act(s, { type: 'END_TURN' });
  assert.equal(s.phase, 'over');
  assert.equal(s.winner, 'a');
  assert.throws(() => act(s, { type: 'ROLL' }), /kết thúc/);
});

test('bán tài sản theo đề nghị: trả nợ rồi nhận phần còn lại', () => {
  let s = two();
  s.players[0].assets.push({ id: 1, name: 'Nhà', type: 'house', cost: 5000, mortgage: 60000, cashFlow: 100 });
  const cash = s.players[0].cash;
  s.phase = 'offer';
  s.card = { kind: 'offer', type: 'house', mult: 1.5, name: 'x' };
  s = act(s, { type: 'SELL', assetId: 1 });
  assert.equal(s.players[0].cash, cash + Math.round(65000 * 1.5) - 60000);
  assert.equal(s.players[0].assets.length, 0);
});

test('publicState không lộ bộ bài', () => {
  const p = publicState(two());
  assert.equal(p.decks, undefined);
  assert.equal(p.board.length, 24);
  assert.ok(p.players[0].finance.payday !== undefined);
});

test('chơi ngẫu nhiên 500 lượt không văng lỗi ngoài ý muốn', () => {
  let s = createGame({ players: [{ id: 'a', name: 'A', color: 'red' }, { id: 'b', name: 'B', color: 'blue' }] });
  for (let i = 0; i < 500 && s.phase !== 'over'; i += 1) {
    const next = { roll: { type: 'ROLL' }, dealType: { type: 'CHOOSE_DEAL', size: 'small' }, deal: { type: 'BUY' },
      offer: { type: 'PASS' }, doodad: { type: 'PAY_DOODAD' }, charity: { type: 'PASS' }, end: { type: 'END_TURN' } }[s.phase];
    try { s = act(s, next); } catch (e) { s = act(s, s.phase === 'deal' ? { type: 'PASS' } : next); }
  }
  assert.ok(s.log.length > 1);
});
