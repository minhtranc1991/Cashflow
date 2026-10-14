// Client Dòng Tiền: chỉ render state từ server và gửi ý định (action). Mọi tính toán nằm ở server.
const socket = io();
const $app = document.getElementById('app');
const KEY = 'dongtien';

const CELLS = {
  opportunity: ['Cơ hội', 'Rút một thương vụ để mua tài sản tạo dòng tiền (nhà, cơ sở kinh doanh, cổ phiếu). Bạn chọn loại nhỏ hoặc lớn.'],
  doodad: ['Chi tiêu', 'Khoản chi bất ngờ hoặc "đồ chơi" đắt tiền. Bắt buộc phải trả; thiếu tiền ngân hàng tự cho vay.'],
  paycheck: ['Lương', 'Đi qua hoặc dừng ở đây: nhận dòng tiền hằng tháng (thu nhập trừ chi phí).'],
  offer: ['Đề nghị mua', 'Có người trả giá mua tài sản cùng loại của bạn. Bán được thì trả nợ và nhận phần còn lại.'],
  charity: ['Từ thiện', 'Quyên góp 10% thu nhập để được tung 2 xúc xắc trong 3 lượt tới.'],
  child: ['Em bé', 'Có thêm một đứa con (tối đa 3). Chi phí hằng tháng tăng.'],
  downsize: ['Mất việc', 'Trả toàn bộ chi phí hằng tháng một lần và nghỉ 2 lượt.'],
};

const GLOSS = {
  cashflow: 'Dòng tiền = tổng thu mỗi tháng trừ tổng chi mỗi tháng. Dương nghĩa là mỗi tháng bạn dư tiền.',
  passive: 'Thu nhập thụ động: tiền thu về từ tài sản (cho thuê, kinh doanh, cổ tức) mà không phải đi làm.',
  payday: 'Payday (ngày lương): mỗi lần đi qua ô Lương bạn nhận số này vào tiền mặt.',
  expenses: 'Tổng chi mỗi tháng: thuế, trả góp nhà, xe, thẻ tín dụng, con cái và tiền lãi khoản vay.',
  doodad: 'Doodad: món chi tiêu xa xỉ hoặc bất ngờ, không tạo ra thu nhập.',
  asset: 'Tài sản: thứ bỏ tiền ra mua và mang lại dòng tiền mỗi tháng.',
  liability: 'Khoản nợ: thứ khiến bạn phải trả tiền mỗi tháng.',
  down: 'Tiền đặt cọc: phần bạn phải trả ngay. Phần còn lại là dư nợ vay mua tài sản.',
  mortgage: 'Dư nợ: số tiền còn nợ ngân hàng cho tài sản này. Khi bán, khoản này được trừ trước.',
  ratrace: 'Cuộc đua chuột: vòng quay kiếm tiền để trả chi phí. Thoát ra khi thu nhập thụ động ≥ tổng chi.',
  loan: 'Vay ngân hàng: nhận tiền ngay theo bội số 1.000 ₫, mỗi tháng trả lãi 10% dư nợ.',
  goal: 'Mục tiêu thắng: làm cho thu nhập thụ động bằng hoặc vượt tổng chi mỗi tháng.',
};
const tip = (k, label) => `<span class="tip" tabindex="0" data-tip="${esc(GLOSS[k])}">${label}</span>`;

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n) => `${Math.round(n).toLocaleString('vi-VN')} ₫`;
const signed = (n) => `<span class="${n >= 0 ? 'pos' : 'neg'}">${fmt(n)}</span>`;

let me = null; try { me = JSON.parse(localStorage.getItem(KEY)); } catch { /* bỏ qua */ }
let st = null;
let viewId = null;
let home = { error: '' };

function toast(msg, err) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `show${err ? ' err' : ''}`;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => { t.className = ''; }, 3000);
}

function call(ev, payload) {
  return new Promise((resolve) => socket.emit(ev, payload, (r) => {
    if (!r.ok) toast(r.error, true);
    resolve(r);
  }));
}
const act = (a) => call('game:action', a);

function saveMe(r, name) {
  me = { code: r.code, playerId: r.playerId, token: r.token, name };
  localStorage.setItem(KEY, JSON.stringify(me));
  render(); // 'state' có thể đến trước ack, lúc đó me chưa có nên phải vẽ lại ở đây
}

let busy = false; // chặn bấm đúp tạo/vào phòng hai lần
async function once(fn) {
  if (busy) return;
  busy = true;
  try { await fn(); } finally { busy = false; }
}

async function createRoom() {
  const name = document.getElementById('name').value.trim();
  if (!name) return toast('Hãy nhập tên của bạn.', true);
  const r = await call('room:create', { name });
  if (r.ok) saveMe(r, name);
}
async function joinRoom() {
  const name = document.getElementById('name').value.trim();
  const code = document.getElementById('code').value.trim().toUpperCase();
  if (!name || !code) return toast('Hãy nhập tên và mã phòng.', true);
  const r = await call('room:join', { name, code });
  if (r.ok) saveMe(r, name);
}

// Vào lại phòng cũ khi tải lại trang hoặc mất kết nối
socket.on('connect', async () => {
  if (!me) return;
  const r = await new Promise((res) => socket.emit('room:join', { code: me.code, name: me.name, token: me.token }, res));
  if (!r.ok) { me = null; st = null; localStorage.removeItem(KEY); render(); }
});
socket.on('state', (s) => { st = s; render(); });

/* ---------- màn hình ---------- */

function homeView() {
  const q = new URLSearchParams(location.search).get('room') || '';
  return `<div class="home stack">
    <h1>Dòng Tiền</h1>
    <p class="muted">Board game đầu tư tài chính chơi online cùng bạn bè. Mua tài sản, tăng ${tip('passive', 'thu nhập thụ động')} và thoát khỏi ${tip('ratrace', 'cuộc đua chuột')}.</p>
    <div class="panel stack">
      <input id="name" placeholder="Tên của bạn" maxlength="20" value="${esc(me?.name || '')}">
      <button data-act="create">Tạo phòng mới</button>
      <div class="muted" style="text-align:center">hoặc vào phòng của bạn bè</div>
      <input id="code" placeholder="Mã phòng (5 ký tự)" maxlength="5" value="${esc(q)}" style="text-transform:uppercase">
      <button class="ghost" data-act="join">Vào phòng</button>
    </div>
  </div>`;
}

function lobbyView() {
  const isHost = st.hostId === me.playerId;
  const link = `${location.origin}/?room=${st.code}`;
  return `<div class="home stack">
    <h1>Phòng chờ</h1>
    <div class="panel stack">
      <div class="muted">Mã phòng</div>
      <div class="code">${esc(st.code)}</div>
      <button class="ghost" data-act="copy" data-link="${esc(link)}">Sao chép liên kết mời</button>
    </div>
    <div class="panel">
      <h3>Người chơi (${st.players.length}/6)</h3>
      ${st.players.map((p) => `<div class="player-chip"><span class="dot" style="background:${p.color}"></span>${esc(p.name)}
        ${p.id === st.hostId ? '<span class="muted">· chủ phòng</span>' : ''}${p.connected ? '' : '<span class="muted">· mất kết nối</span>'}</div>`).join('')}
    </div>
    ${isHost
    ? `<button data-act="start">Bắt đầu ván chơi</button><div class="muted">Bạn có thể bắt đầu khi đủ người. Người vào sau lúc bắt đầu sẽ không tham gia được.</div>`
    : '<div class="muted">Đang chờ chủ phòng bắt đầu…</div>'}
    <button class="ghost" data-act="leave">Rời phòng</button>
  </div>`;
}

function boardView(g) {
  const pos = (i) => {
    if (i <= 6) return [1, i + 1];
    if (i <= 11) return [i - 5, 7];
    if (i <= 18) return [7, 7 - (i - 12)];
    return [7 - (i - 18), 1];
  };
  const cur = g.players[g.current];
  const cells = g.board.map((type, i) => {
    const [r, c] = pos(i);
    const here = g.players.filter((p) => p.position === i);
    const [label, desc] = CELLS[type];
    return `<div class="cell ${type}" style="grid-area:${r}/${c}" data-tip="${esc(`${i + 1}. ${label}: ${desc}`)}" tabindex="0">
      <span>${label}</span>
      <div class="tokens">${here.map((p) => `<span class="token ${p.id === cur.id ? 'cur' : ''}" style="background:${p.color}" title="${esc(p.name)}"></span>`).join('')}</div>
    </div>`;
  }).join('');
  return `<div class="board">${cells}<div class="center">${centerView(g)}</div></div>`;
}

function dealCard(c) {
  return `<div class="deal"><h3>${esc(c.name)}</h3><div class="muted">${esc(c.text || '')}</div>
    <dl>
      <dt>${tip('down', 'Tiền cọc')}</dt><dd>${fmt(c.cost)}</dd>
      ${c.mortgage ? `<dt>${tip('mortgage', 'Dư nợ')}</dt><dd>${fmt(c.mortgage)}</dd>` : ''}
      <dt>${tip('cashflow', 'Dòng tiền')}</dt><dd class="pos">+${fmt(c.cashFlow)}/tháng</dd>
    </dl></div>`;
}

function centerView(g) {
  const cur = g.players[g.current];
  const mine = cur.id === me.playerId;
  const c = g.card;
  let html = '';
  if (g.dice) html += `<div class="dice">🎲 ${g.dice.join(' + ')}${g.dice.length > 1 ? ` = ${g.dice[0] + g.dice[1]}` : ''}</div>`;
  if (g.phase === 'over') {
    const w = g.players.find((p) => p.id === g.winner);
    return `<div class="win"><h2>🎉 ${esc(w.name)} thắng!</h2><p>${tip('passive', 'Thu nhập thụ động')} đã vượt tổng chi. Họ đã thoát khỏi ${tip('ratrace', 'cuộc đua chuột')}.</p>
      <button data-act="leave">Về màn hình chính</button></div>`;
  }
  if (c) {
    if (c.kind === 'deal') html += `<div class="muted">Thương vụ ${c.size === 'big' ? 'lớn' : 'nhỏ'}</div>${dealCard(c)}`;
    if (c.kind === 'offer') html += `<div class="deal"><h3>${esc(c.name)}</h3><div class="muted">${esc(c.text)} Giá bán = ${c.mult} × giá trị tài sản.</div></div>`;
    if (c.kind === 'doodad') html += `<div class="deal"><h3>${esc(c.name)}</h3><div class="muted">${esc(c.text)}</div><div><b>${fmt(c.cost)}</b></div></div>`;
    if (c.kind === 'charity') html += `<div class="deal"><h3>Từ thiện</h3><div class="muted">Quyên góp ${fmt(c.cost)} (10% thu nhập) để tung 2 xúc xắc trong 3 lượt.</div></div>`;
  }
  if (!mine) return `${html}<div class="muted">Đang chờ <b>${esc(cur.name)}</b>…</div>`;

  const me_ = cur;
  const b = (a, label, extra = '', t = '') => `<button data-act="game" data-a='${esc(JSON.stringify(a))}' ${extra} ${t ? `data-tip="${esc(t)}"` : ''}>${label}</button>`;
  switch (g.phase) {
    case 'roll':
      html += `<div class="row">${b({ type: 'ROLL' }, 'Tung xúc xắc')}${me_.charity > 0 ? b({ type: 'ROLL', dice: 2 }, `Tung 2 xúc xắc (còn ${me_.charity})`) : ''}</div>`;
      break;
    case 'dealType':
      html += `<div>Chọn loại thương vụ:</div><div class="row">
        ${b({ type: 'CHOOSE_DEAL', size: 'small' }, 'Thương vụ nhỏ', '', 'Ít tiền cọc, rủi ro thấp, dòng tiền nhỏ. Hợp khi mới bắt đầu.')}
        ${b({ type: 'CHOOSE_DEAL', size: 'big' }, 'Thương vụ lớn', '', 'Cần nhiều tiền cọc nhưng dòng tiền lớn hơn nhiều.')}</div>`;
      break;
    case 'deal':
      html += `<div class="row">${b({ type: 'BUY' }, `Mua (${fmt(c.cost)})`, me_.cash < c.cost ? 'class="ghost"' : '', me_.cash < c.cost ? 'Bạn chưa đủ tiền mặt. Có thể vay ngân hàng ở bảng bên phải rồi quay lại mua.' : '')}${b({ type: 'PASS' }, 'Bỏ qua', 'class="ghost"')}</div>`;
      break;
    case 'offer':
      html += `<div>Chọn tài sản để bán:</div><div class="row">${me_.assets.filter((a) => a.type === c.type).map((a) => {
        const price = Math.round((a.cost + a.mortgage) * c.mult);
        return b({ type: 'SELL', assetId: a.id }, `${esc(a.name)}: nhận ${fmt(price - a.mortgage)}`, '', `Giá bán ${fmt(price)}, trừ dư nợ ${fmt(a.mortgage)}. Bạn mất dòng tiền ${fmt(a.cashFlow)}/tháng.`);
      }).join('')}${b({ type: 'PASS' }, 'Không bán', 'class="ghost"')}</div>`;
      break;
    case 'doodad':
      html += `<div class="row">${b({ type: 'PAY_DOODAD' }, `Thanh toán ${fmt(c.cost)}`)}</div>`;
      break;
    case 'charity':
      html += `<div class="row">${b({ type: 'DONATE' }, `Quyên góp ${fmt(c.cost)}`)}${b({ type: 'PASS' }, 'Bỏ qua', 'class="ghost"')}</div>`;
      break;
    case 'end':
      html += `<div class="row">${b({ type: 'END_TURN' }, 'Kết thúc lượt')}</div><div class="muted">Trước khi kết thúc, bạn có thể vay hoặc trả nợ ở bảng tài chính.</div>`;
      break;
    default:
  }
  return html;
}

function financeView(g, p, mine) {
  const f = p.finance;
  const j = p.job;
  const row = (label, v) => `<tr><td>${label}</td><td>${v}</td></tr>`;
  const pct = Math.min(100, Math.round((f.passive / Math.max(1, f.expenses)) * 100));
  const loanBtns = mine && g.phase !== 'over'
    ? `<div class="row" style="margin-top:6px">
        <button class="ghost" data-act="game" data-a='{"type":"TAKE_LOAN","amount":1000}'>Vay 1.000</button>
        <button class="ghost" data-act="game" data-a='{"type":"TAKE_LOAN","amount":5000}'>Vay 5.000</button>
        <button class="ghost" data-act="game" data-a='{"type":"REPAY_LOAN","amount":1000}' ${p.loan < 1000 ? 'disabled' : ''}>Trả 1.000</button>
      </div>` : '';
  return `<h3>${esc(p.name)} · ${esc(j.title)}</h3>
    <div class="muted">Ước mơ: ${esc(p.dream)}</div>
    <table>
      ${row('Tiền mặt', `<b>${fmt(p.cash)}</b>`)}
      <tr class="sum"><td>Thu nhập</td><td></td></tr>
      ${row('Lương', fmt(f.salary))}
      ${row(tip('passive', 'Thu nhập thụ động'), fmt(f.passive))}
      <tr class="sum"><td>${tip('expenses', 'Tổng chi')}</td><td>${fmt(f.expenses)}</td></tr>
      ${row('Thuế', fmt(j.taxes))}
      ${row('Trả góp nhà', fmt(j.mortgagePay))}
      ${row('Trả góp xe', fmt(j.carPay))}
      ${row('Thẻ tín dụng', fmt(j.creditPay))}
      ${row('Mua sắm trả góp', fmt(j.retailPay))}
      ${row('Chi tiêu khác', fmt(j.other))}
      ${row(`Con cái (${p.children})`, fmt(f.childPay))}
      ${row(`Lãi vay ngân hàng`, fmt(f.loanPay))}
      <tr class="sum"><td>${tip('payday', 'Dòng tiền hằng tháng')}</td><td>${signed(f.payday)}</td></tr>
      ${row(tip('loan', 'Vay ngân hàng'), fmt(p.loan))}
    </table>
    ${loanBtns}
    <div style="margin-top:10px">${tip('goal', 'Đường thoát')}: ${fmt(f.passive)} / ${fmt(f.expenses)}</div>
    <div class="progress"><i style="width:${pct}%"></i></div>
    <h3 style="margin-top:12px">${tip('asset', 'Tài sản')}</h3>
    ${p.assets.length ? `<table>${p.assets.map((a) => `<tr><td>${esc(a.name)} <span class="muted">(cọc ${fmt(a.cost)})</span></td><td class="pos">+${fmt(a.cashFlow)}</td></tr>`).join('')}</table>` : '<div class="muted">Chưa có tài sản nào.</div>'}`;
}

function gameView() {
  const g = st.game;
  const cur = g.players[g.current];
  const mine = cur.id === me.playerId;
  const shown = g.players.find((p) => p.id === (viewId || me.playerId)) || g.players[0];
  return `<div class="wrap">
    <div class="topbar">
      <div class="turn-banner ${mine ? 'mine' : ''}">${g.phase === 'over' ? 'Ván chơi kết thúc' : mine ? 'Đến lượt bạn!' : `Lượt của ${esc(cur.name)}`} · Vòng ${g.turn}</div>
      <div class="row"><span class="muted">Phòng ${esc(st.code)}</span><button class="ghost" data-act="leave">Thoát</button></div>
    </div>
    <div class="game">
      <div>${boardView(g)}</div>
      <div class="stack">
        <div class="panel">
          <div class="tabs">${g.players.map((p) => `<button class="${p.id === shown.id ? '' : 'ghost'}" data-act="view" data-id="${p.id}">
            <span class="dot" style="display:inline-block;background:${p.color};vertical-align:middle"></span> ${esc(p.id === me.playerId ? 'Bạn' : p.name)}</button>`).join('')}</div>
          ${financeView(g, shown, shown.id === me.playerId && mine)}
        </div>
        <div class="panel"><h3>Nhật ký</h3><div class="log">${[...g.log].reverse().slice(0, 40).reverse().map((l) => `<div>${esc(l)}</div>`).join('')}</div></div>
      </div>
    </div>
  </div>`;
}

function render() {
  if (!me || !st) $app.innerHTML = `<div class="wrap">${homeView()}</div>`;
  else if (st.status === 'lobby') $app.innerHTML = `<div class="wrap">${lobbyView()}</div>`;
  else $app.innerHTML = gameView();
}

$app.addEventListener('click', async (e) => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  switch (el.dataset.act) {
    case 'create': return once(createRoom);
    case 'join': return once(joinRoom);
    case 'start': return call('game:start', {});
    case 'game': return act(JSON.parse(el.dataset.a));
    case 'view': viewId = el.dataset.id; return render();
    case 'copy':
      try { await navigator.clipboard.writeText(el.dataset.link); toast('Đã sao chép liên kết mời.'); } catch { toast(el.dataset.link); }
      return undefined;
    case 'leave':
      localStorage.removeItem(KEY); me = null; st = null; viewId = null;
      socket.disconnect().connect();
      return render();
    default: return undefined;
  }
});

render();
