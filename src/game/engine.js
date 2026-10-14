// Engine thuần: không DOM, không mạng. applyAction(state, action, rng) -> state mới, lỗi -> throw Error(tiếng Việt).
const { BOARD, JOBS, DECKS, DREAMS } = require('./data');

const MAX_CHILDREN = 3;
const CHARITY_TURNS = 3;
const DOWNSIZE_TURNS = 2;
const LOAN_STEP = 1000;

const jobOf = (p) => JOBS.find((j) => j.id === p.jobId);
const childCost = (job) => Math.max(100, Math.round(job.salary * 0.056));
const money = (n) => `${n.toLocaleString('vi-VN')} ₫`;

function shuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function finance(p) {
  const job = jobOf(p);
  const passive = p.assets.reduce((s, a) => s + a.cashFlow, 0);
  const loanPay = Math.ceil(p.loan * 0.1);
  const childPay = p.children * childCost(job);
  const expenses = job.taxes + job.mortgagePay + job.carPay + job.creditPay + job.retailPay + job.other + childPay + loanPay;
  const income = job.salary + passive;
  return { salary: job.salary, passive, income, expenses, payday: income - expenses, loanPay, childPay };
}

function createGame({ players, rng = Math.random }) {
  if (!players.length) throw new Error('Cần ít nhất 1 người chơi.');
  const jobs = shuffle(JOBS, rng);
  const dreams = shuffle(DREAMS, rng);
  const decks = {};
  for (const [name, cards] of Object.entries(DECKS)) {
    decks[name] = { draw: shuffle(cards.map((c) => c.id), rng), discard: [] };
  }
  return {
    turn: 1,
    current: 0,
    phase: 'roll',
    dice: null,
    card: null,
    winner: null,
    nextAssetId: 1,
    log: ['Trò chơi bắt đầu. Hãy thoát khỏi cuộc đua chuột trước mọi người!'],
    players: players.map((p, i) => ({
      id: p.id,
      name: p.name,
      color: p.color,
      jobId: jobs[i % jobs.length].id,
      dream: dreams[i % dreams.length],
      cash: jobs[i % jobs.length].savings,
      position: 0,
      children: 0,
      loan: 0,
      skip: 0,
      charity: 0,
      assets: [],
    })),
    decks,
  };
}

// Bỏ bộ bài (server giữ bí mật), thêm bàn và số liệu tài chính đã tính sẵn cho client.
function publicState(s) {
  const { decks, ...rest } = s;
  return {
    ...rest,
    board: BOARD,
    players: s.players.map((p) => ({ ...p, job: jobOf(p), finance: finance(p), childCost: childCost(jobOf(p)) })),
  };
}

function draw(state, deck, rng) {
  const d = state.decks[deck];
  if (!d.draw.length) {
    d.draw = shuffle(d.discard, rng);
    d.discard = [];
  }
  const id = d.draw.shift();
  d.discard.push(id);
  return DECKS[deck].find((c) => c.id === id);
}

// Thiếu tiền thì ngân hàng tự cho vay, làm tròn lên bội số 1.000.
function pay(state, p, amount) {
  if (p.cash < amount) {
    const need = Math.ceil((amount - p.cash) / LOAN_STEP) * LOAN_STEP;
    p.loan += need;
    p.cash += need;
    state.log.push(`${p.name} vay ngân hàng ${money(need)} để đủ tiền.`);
  }
  p.cash -= amount;
}

function resolveCell(state, p, rng) {
  const type = BOARD[p.position];
  state.card = null;
  switch (type) {
    case 'opportunity':
      state.phase = 'dealType';
      break;
    case 'offer': {
      const card = draw(state, 'offer', rng);
      state.card = { kind: 'offer', ...card };
      if (!p.assets.some((a) => a.type === card.type)) {
        state.log.push(`${p.name} nhận đề nghị "${card.name}" nhưng không có tài sản phù hợp.`);
        state.phase = 'end';
      } else {
        state.phase = 'offer';
      }
      break;
    }
    case 'doodad':
      state.card = { kind: 'doodad', ...draw(state, 'doodad', rng) };
      state.phase = 'doodad';
      break;
    case 'charity':
      state.card = { kind: 'charity', cost: Math.ceil(finance(p).income * 0.1) };
      state.phase = 'charity';
      break;
    case 'child':
      if (p.children < MAX_CHILDREN) {
        p.children += 1;
        state.log.push(`${p.name} có thêm một em bé! Chi phí hằng tháng tăng.`);
      } else {
        state.log.push(`${p.name} đã đủ ${MAX_CHILDREN} con, không thêm nữa.`);
      }
      state.phase = 'end';
      break;
    case 'downsize': {
      const cost = finance(p).expenses;
      pay(state, p, cost);
      p.skip = DOWNSIZE_TURNS;
      state.log.push(`${p.name} bị cắt giảm việc làm: trả ${money(cost)} và nghỉ ${DOWNSIZE_TURNS} lượt.`);
      state.phase = 'end';
      break;
    }
    default: // paycheck: tiền lương đã được tính khi đi qua
      state.phase = 'end';
  }
}

function checkWin(state, p) {
  const f = finance(p);
  if (state.phase !== 'over' && f.passive > 0 && f.passive >= f.expenses) {
    state.phase = 'over';
    state.winner = p.id;
    state.log.push(`${p.name} thoát khỏi cuộc đua chuột! Thu nhập thụ động đã vượt chi phí.`);
  }
}

function nextPlayer(state) {
  const n = state.players.length;
  // mỗi người nghỉ tối đa DOWNSIZE_TURNS lượt nên vòng lặp luôn dừng
  for (let guard = 0; guard <= n * (DOWNSIZE_TURNS + 1); guard += 1) {
    state.current = (state.current + 1) % n;
    if (state.current === 0) state.turn += 1;
    const p = state.players[state.current];
    if (p.skip > 0) {
      p.skip -= 1;
      state.log.push(`${p.name} đang nghỉ lượt.`);
      continue;
    }
    break;
  }
  state.phase = 'roll';
  state.dice = null;
  state.card = null;
}

function checkAmount(amt) {
  if (!Number.isInteger(amt) || amt <= 0 || amt % LOAN_STEP) {
    throw new Error(`Số tiền phải là bội số của ${LOAN_STEP.toLocaleString('vi-VN')} ₫.`);
  }
}

function applyAction(state, action, rng = Math.random) {
  const s = structuredClone(state);
  const p = s.players[s.current];
  if (s.phase === 'over') throw new Error('Trò chơi đã kết thúc.');
  if (action.playerId !== p.id) throw new Error('Chưa đến lượt của bạn.');
  const need = (...phases) => {
    if (!phases.includes(s.phase)) throw new Error('Hành động này chưa dùng được lúc này.');
  };

  switch (action.type) {
    case 'ROLL': {
      need('roll');
      const count = action.dice === 2 && p.charity > 0 ? 2 : 1;
      if (p.charity > 0) p.charity -= 1;
      const dice = Array.from({ length: count }, () => 1 + Math.floor(rng() * 6));
      const total = dice.reduce((a, b) => a + b, 0);
      s.dice = dice;
      s.log.push(`${p.name} tung ${dice.join(' + ')} = ${total}.`);
      for (let i = 1; i <= total; i += 1) {
        if (BOARD[(p.position + i) % BOARD.length] === 'paycheck') {
          const payday = finance(p).payday;
          p.cash += payday;
          s.log.push(`${p.name} nhận lương: ${money(payday)}.`);
        }
      }
      p.position = (p.position + total) % BOARD.length;
      resolveCell(s, p, rng);
      break;
    }
    case 'CHOOSE_DEAL': {
      need('dealType');
      if (action.size !== 'small' && action.size !== 'big') throw new Error('Loại thương vụ không hợp lệ.');
      s.card = { kind: 'deal', size: action.size, ...draw(s, action.size, rng) };
      s.phase = 'deal';
      break;
    }
    case 'BUY': {
      need('deal');
      const c = s.card;
      if (p.cash < c.cost) throw new Error('Bạn không đủ tiền. Hãy vay ngân hàng hoặc bỏ qua.');
      p.cash -= c.cost;
      p.assets.push({ id: s.nextAssetId, name: c.name, type: c.type, cost: c.cost, mortgage: c.mortgage, cashFlow: c.cashFlow });
      s.nextAssetId += 1;
      s.log.push(`${p.name} mua "${c.name}" (+${money(c.cashFlow)}/tháng).`);
      s.phase = 'end';
      break;
    }
    case 'PASS':
      need('deal', 'offer', 'charity');
      s.log.push(`${p.name} bỏ qua.`);
      s.phase = 'end';
      break;
    case 'SELL': {
      need('offer');
      const asset = p.assets.find((a) => a.id === action.assetId && a.type === s.card.type);
      if (!asset) throw new Error('Tài sản không phù hợp với đề nghị này.');
      const price = Math.round((asset.cost + asset.mortgage) * s.card.mult);
      const proceeds = price - asset.mortgage;
      p.cash += proceeds;
      p.assets = p.assets.filter((a) => a.id !== asset.id);
      s.log.push(`${p.name} bán "${asset.name}" giá ${money(price)}, nhận về ${money(proceeds)} sau khi trả nợ.`);
      s.phase = 'end';
      break;
    }
    case 'PAY_DOODAD':
      need('doodad');
      pay(s, p, s.card.cost);
      s.log.push(`${p.name} chi ${money(s.card.cost)} cho "${s.card.name}".`);
      s.phase = 'end';
      break;
    case 'DONATE':
      need('charity');
      if (p.cash < s.card.cost) throw new Error('Bạn không đủ tiền để quyên góp.');
      p.cash -= s.card.cost;
      p.charity = CHARITY_TURNS;
      s.log.push(`${p.name} quyên góp ${money(s.card.cost)}, được tung 2 xúc xắc trong ${CHARITY_TURNS} lượt.`);
      s.phase = 'end';
      break;
    case 'TAKE_LOAN':
      checkAmount(action.amount);
      p.loan += action.amount;
      p.cash += action.amount;
      if (finance(p).payday < 0) throw new Error('Ngân hàng từ chối: khoản vay làm dòng tiền hằng tháng âm.');
      s.log.push(`${p.name} vay ${money(action.amount)}.`);
      break;
    case 'REPAY_LOAN':
      checkAmount(action.amount);
      if (action.amount > p.loan) throw new Error('Số tiền trả lớn hơn dư nợ.');
      if (action.amount > p.cash) throw new Error('Bạn không đủ tiền mặt.');
      p.loan -= action.amount;
      p.cash -= action.amount;
      s.log.push(`${p.name} trả nợ ${money(action.amount)}.`);
      break;
    case 'END_TURN':
      need('end');
      checkWin(s, p);
      if (s.phase !== 'over') nextPlayer(s);
      return s;
    default:
      throw new Error('Hành động không hợp lệ.');
  }
  checkWin(s, p);
  return s;
}

module.exports = { createGame, applyAction, publicState, finance, jobOf, BOARD };
