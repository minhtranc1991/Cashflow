// Dữ liệu demo, đã Việt hóa. Số liệu nghề lấy theo CashFlow 101 bản gốc (MIT, Sleighs/CashFlowJs).
// Bộ thẻ là bản rút gọn có chủ đích; mở rộng ở các nhánh sau.

const BOARD = [
  'opportunity', 'doodad', 'opportunity', 'charity', 'opportunity', 'paycheck',
  'opportunity', 'offer', 'opportunity', 'doodad', 'opportunity', 'child',
  'opportunity', 'paycheck', 'opportunity', 'offer', 'opportunity', 'doodad',
  'opportunity', 'downsize', 'opportunity', 'paycheck', 'opportunity', 'offer',
];

// salary: lương/tháng; debts: dư nợ (chỉ để hiển thị ở bản demo)
const JOBS = [
  { id: 'lao-cong', title: 'Lao công', salary: 1600, savings: 560, taxes: 280, mortgagePay: 200, carPay: 60, creditPay: 60, retailPay: 50, other: 300, debts: { mortgage: 20000, car: 4000, credit: 2000, retail: 1000 } },
  { id: 'giao-vien', title: 'Giáo viên', salary: 3300, savings: 400, taxes: 630, mortgagePay: 500, carPay: 100, creditPay: 90, retailPay: 50, other: 760, debts: { mortgage: 50000, car: 5000, credit: 3000, retail: 1000 } },
  { id: 'y-ta', title: 'Y tá', salary: 3100, savings: 480, taxes: 600, mortgagePay: 400, carPay: 100, creditPay: 90, retailPay: 50, other: 710, debts: { mortgage: 47000, car: 5000, credit: 3000, retail: 1000 } },
  { id: 'ky-su', title: 'Kỹ sư', salary: 4900, savings: 400, taxes: 1050, mortgagePay: 700, carPay: 140, creditPay: 120, retailPay: 50, other: 1090, debts: { mortgage: 75000, car: 7000, credit: 4000, retail: 1000 } },
  { id: 'luat-su', title: 'Luật sư', salary: 7500, savings: 400, taxes: 1830, mortgagePay: 1100, carPay: 220, creditPay: 180, retailPay: 50, other: 1650, debts: { mortgage: 115000, car: 11000, credit: 6000, retail: 1000 } },
  { id: 'bac-si', title: 'Bác sĩ', salary: 13200, savings: 400, taxes: 3420, mortgagePay: 1900, carPay: 380, creditPay: 270, retailPay: 50, other: 2880, debts: { mortgage: 202000, car: 19000, credit: 9000, retail: 1000 } },
];

// cost: tiền đặt cọc phải trả ngay; mortgage: dư nợ đi kèm; cashFlow: dòng tiền thụ động/tháng
const DECKS = {
  small: [
    { id: 's1', name: 'Nhà 3 phòng ngủ / 2 WC', type: 'house', cost: 5000, mortgage: 60000, cashFlow: 100, text: 'Chủ nhà cần bán gấp vì chuyển nơi ở. Khu dân cư ổn định.' },
    { id: 's2', name: 'Nhà 2 phòng ngủ / 1 WC', type: 'house', cost: 3000, mortgage: 42000, cashFlow: 100, text: 'Nhà nhỏ gần trường học, dễ cho thuê.' },
    { id: 's3', name: 'Căn hộ cho thuê', type: 'house', cost: 4000, mortgage: 56000, cashFlow: 150, text: 'Căn hộ đã có khách thuê dài hạn.' },
    { id: 's4', name: 'Nhà 3 phòng ngủ (đang xuống cấp)', type: 'house', cost: 3000, mortgage: 47000, cashFlow: 120, text: 'Cần sửa nhẹ nhưng giá tốt.' },
    { id: 's5', name: 'Quầy cà phê', type: 'business', cost: 4500, mortgage: 0, cashFlow: 150, text: 'Quầy nhỏ ở khu văn phòng, khách quen đông.' },
    { id: 's6', name: 'Cổ phiếu ưu đãi cổ tức', type: 'stock', cost: 2000, mortgage: 0, cashFlow: 20, text: 'Công ty ổn định, trả cổ tức đều mỗi tháng.' },
    { id: 's7', name: 'Máy giặt tự động', type: 'business', cost: 3000, mortgage: 0, cashFlow: 100, text: 'Đặt máy ở khu trọ sinh viên, thu tiền tự động.' },
    { id: 's8', name: 'Quỹ trái phiếu', type: 'stock', cost: 5000, mortgage: 0, cashFlow: 50, text: 'Trái phiếu doanh nghiệp lãi suất cố định.' },
  ],
  big: [
    { id: 'b1', name: 'Nhà phố 4 căn cho thuê', type: 'house', cost: 25000, mortgage: 175000, cashFlow: 400, text: 'Đã có sẵn khách thuê, chỉ cần tiền đặt cọc.' },
    { id: 'b2', name: 'Chung cư mini 8 căn', type: 'house', cost: 40000, mortgage: 180000, cashFlow: 1700, text: 'Chủ đầu tư cũ bán lại với giá hợp lý, đã có vay.' },
    { id: 'b3', name: 'Tiệm rửa xe', type: 'business', cost: 100000, mortgage: 0, cashFlow: 3000, text: 'Hoạt động ổn định nhiều năm, có quản lý.' },
    { id: 'b4', name: 'Nhà trọ 12 phòng', type: 'house', cost: 30000, mortgage: 120000, cashFlow: 900, text: 'Gần khu công nghiệp, kín phòng quanh năm.' },
    { id: 'b5', name: 'Cửa hàng nhượng quyền', type: 'business', cost: 50000, mortgage: 0, cashFlow: 2000, text: 'Thương hiệu quen thuộc, có hỗ trợ vận hành.' },
  ],
  // Bán tài sản cùng loại với giá (cost + mortgage) * mult; chỉ người đang đến lượt được bán
  offer: [
    { id: 'o1', name: 'Nhà đầu tư mua nhà', type: 'house', mult: 1.5, text: 'Nhà đầu tư trả giá cao cho bất kỳ căn nhà nào của bạn.' },
    { id: 'o2', name: 'Cặp vợ chồng trẻ tìm nhà', type: 'house', mult: 1.25, text: 'Họ đã có sẵn tiền, muốn mua ngay.' },
    { id: 'o3', name: 'Thâu tóm cơ sở kinh doanh', type: 'business', mult: 2, text: 'Một tập đoàn muốn mua lại cơ sở kinh doanh nhỏ.' },
    { id: 'o4', name: 'Người mua cổ phiếu', type: 'stock', mult: 2.5, text: 'Giá cổ phiếu tăng mạnh, có người trả cao.' },
    { id: 'o5', name: 'Thị trường nhà đất đi xuống', type: 'house', mult: 0.8, text: 'Giá nhà giảm, chỉ nên bán nếu thật sự cần tiền.' },
  ],
  doodad: [
    { id: 'd1', name: 'Bình nóng lạnh bị hỏng', cost: 450, text: 'Phải thay bình mới.' },
    { id: 'd2', name: 'Đi ăn tối ngoài', cost: 80, text: 'Một bữa tối ngon miệng.' },
    { id: 'd3', name: 'Mua TV mới', cost: 1200, text: 'TV cũ hỏng, và bạn bị cuốn vào đợt giảm giá.' },
    { id: 'd4', name: 'Chữa răng', cost: 700, text: 'Đau răng không thể chờ.' },
    { id: 'd5', name: 'Mừng cưới bạn thân', cost: 500, text: 'Phong bì và quà tặng.' },
    { id: 'd6', name: 'Sửa xe', cost: 300, text: 'Xe hỏng giữa đường.' },
  ],
};

const DREAMS = [
  'Mở trường dạy đầu tư cho trẻ em',
  'Du lịch vòng quanh thế giới',
  'Xây thư viện cho trẻ em vùng cao',
  'Mua một khu rừng và bảo vệ nó',
  'Có du thuyền riêng đi biển cùng bạn bè',
  'Mở trang trại sinh thái cho học sinh thành phố',
  'Nghỉ hưu sớm cùng gia đình',
  'Quỹ học bổng cho học sinh nghèo',
];

module.exports = { BOARD, JOBS, DECKS, DREAMS };
