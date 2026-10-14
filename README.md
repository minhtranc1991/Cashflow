# Dòng Tiền

Board game đầu tư tài chính chơi **online nhiều người** cùng bạn bè, giao diện **tiếng Việt**.
Mua tài sản, tăng thu nhập thụ động và thoát khỏi "cuộc đua chuột" trước mọi người.

> Trạng thái: **demo v0.1**. Lấy cảm hứng từ board game *CashFlow 101* và dự án
> [Sleighs/CashFlowJs](https://github.com/Sleighs/CashFlowJs) (MIT). Đây là dự án fan làm cho vui,
> không liên kết và không có quyền với thương hiệu CashFlow.

## Chạy thử

Yêu cầu Node.js ≥ 18.

```bash
npm install
npm start          # http://localhost:3000
npm test           # engine, phòng chơi và test end-to-end qua socket
```

Chơi cùng bạn bè: mở trang, nhập tên, **Tạo phòng mới**, gửi liên kết mời. Mỗi người mở bằng trình duyệt riêng
(cùng mạng LAN dùng địa chỉ IP máy chủ, hoặc đưa lên VPS/tunnel). Tải lại trang sẽ tự vào lại phòng.

Biến môi trường: `PORT` (mặc định 3000), `LOG_DIR` (mặc định `logs/`).

Server ghi log ra console và file `logs/server-YYYY-MM-DD.log` (mỗi dòng: thời gian, sự kiện, JSON chi tiết gồm socket, phòng, người chơi, action, lỗi). Khi gặp lỗi, gửi file này để dò: `grep '"ok":false' logs/*.log`.

## Cách chơi (bản demo)

1. Mỗi người nhận một nghề, một ước mơ và số tiền tiết kiệm.
2. Đến lượt: **tung xúc xắc**, đi trên bàn 24 ô.

| Ô | Việc xảy ra |
|---|---|
| Cơ hội | Chọn thương vụ nhỏ/lớn và quyết định mua tài sản (trả tiền cọc) |
| Chi tiêu | Trả một khoản bắt buộc, thiếu tiền thì ngân hàng tự cho vay |
| Lương | Đi qua hoặc dừng: nhận dòng tiền hằng tháng |
| Đề nghị mua | Bán tài sản cùng loại với giá tốt (hoặc xấu) |
| Từ thiện | Quyên góp 10% thu nhập để được tung 2 xúc xắc trong 3 lượt |
| Em bé | Thêm một đứa con (tối đa 3), chi phí tăng |
| Mất việc | Trả toàn bộ chi phí tháng và nghỉ 2 lượt |

3. **Thắng** khi *thu nhập thụ động ≥ tổng chi mỗi tháng*.

Rê chuột (hoặc focus bằng Tab) lên thuật ngữ gạch chân và các ô trên bàn để xem giải thích.

### Đơn giản hóa có chủ đích so với bản gốc
- Chỉ có Rat Race, chưa có Fast Track (thắng ngay khi thoát cuộc đua chuột).
- Bộ thẻ rút gọn: 8 thương vụ nhỏ, 5 lớn, 5 đề nghị, 6 chi tiêu; 6 nghề.
- Chưa có cửa sổ "mọi người cùng được bán" và mua chung thương vụ; chỉ người đến lượt được mua/bán.
- Dư nợ nhà/xe/thẻ của nghề chỉ để tính chi phí, chưa trả hết được. Chỉ khoản vay ngân hàng là trả được.
- Số tiền giữ nguyên số liệu gốc, hiển thị theo định dạng Việt Nam kèm ₫. Chưa quy đổi theo thực tế Việt Nam.

## Kiến trúc

```
public/            client tĩnh (HTML + CSS + ES module, không cần build)
  app.js           render state từ server, gửi action
src/game/
  data.js          bàn, nghề, bộ thẻ (tiếng Việt)
  engine.js        engine thuần: applyAction(state, action, rng) -> state
src/server/
  index.js         Express + Socket.IO
  rooms.js         phòng chơi trong bộ nhớ (tạo, vào, rejoin, bắt đầu)
  sockets.js       sự kiện room:create | room:join | game:start | game:action | state
tests/             node:test
```

Nguyên tắc: **server là nguồn sự thật**. Xúc xắc, rút thẻ và tiền bạc đều tính ở server; client chỉ gửi ý định
(`ROLL`, `BUY`, `SELL`, `PAY_DOODAD`, `TAKE_LOAN`, `END_TURN`...) và vẽ lại. Engine không đụng DOM hay mạng nên test được trực tiếp.
Server không gửi bộ bài và token của người chơi xuống client.

## Quy trình làm việc

Mỗi thay đổi làm trên một nhánh riêng (`feat/...`), build và test trên nhánh đó rồi mở PR; **không commit thẳng vào `main`**.

## Lộ trình

- [ ] Fast Track (bàn 40 ô, điều kiện thắng riêng)
- [ ] Bộ thẻ đầy đủ (≈184 thẻ), cổ phiếu có giá và số lượng
- [ ] Cửa sổ phản ứng: mọi người cùng được bán theo giá trên thẻ
- [ ] Việt hóa số liệu (tiền tệ, thuế, nghề nghiệp, giá nhà đất)
- [ ] Lưu ván chơi qua restart, dọn phòng bỏ trống
- [ ] Luật tùy chọn (bảo hiểm, mua chung, vay giữa người chơi)

## Giấy phép

MIT. Giữ nguyên ghi công tác giả gốc: © 2019 Samuel Wright (CashFlowJs).
