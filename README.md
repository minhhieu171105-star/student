# Student — cổng học sinh

## Cấu hình lần đầu

Nếu chưa có `student/.env`, sao chép `.env.example` thành `.env`. Dùng đúng `MONGODB_URI` non-SRV và `MONGODB_DATABASE` từ `Admin/.env`; lấy URI Atlas tại **Connect → Drivers → tắt SRV Connection String**. Giữ `SESSION_SECRET` riêng cho học sinh. Không cần khai báo thông tin Admin hoặc Cloudinary trong file này.

## Chạy

Mở terminal thứ hai tại thư mục `student` trong VS Code:

```powershell
npm install
npm start
```

Mở `http://127.0.0.1:8001`. Máy chủ kết nối MongoDB trước khi nhận request.

Học sinh nhập ngày sinh bằng 8 chữ số theo thứ tự ngày/tháng/năm, ví dụ `01012006`, xác nhận đúng họ tên rồi đăng nhập. Trong bài thi, đáp án được lưu bằng POST; đồng hồ tự nộp khi hết giờ, và rời tab/trang thi đủ 3 lần sẽ tự nộp. Sau khi nộp, học sinh xem được điểm, bài đã chọn và đáp án đúng.

## Cấu trúc

- `server.js`: nạp `.env`, kết nối MongoDB và khởi động cổng học sinh.
- `config/db.js`: cấu hình kết nối MongoDB.
- `controllers/examViewController.js`: dựng giao diện thi, tính điểm và hiển thị kết quả.
- `middleware/authMiddleware.js`: yêu cầu đăng nhập trước API bài thi.
- `routes/studentRoutes.js`: route đăng nhập, làm bài, lưu đáp án và nộp bài.
- `public/`: HTML/CSS/JavaScript phía trình duyệt.

Không commit hoặc chia sẻ `.env`; file này nằm trong `.gitignore`.