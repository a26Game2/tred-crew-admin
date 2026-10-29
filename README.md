# TRED Crew Admin

Ứng dụng quản trị React, Vite, TypeScript, Tailwind CSS, Ant Design và React Router; sử dụng API của `tred-crew-api`.

## Chạy local

Cần Node.js 22 LTS trở lên và backend TRED Crew đang chạy (mặc định `http://localhost:5000`).

```powershell
cd D:\workspace\tred\crew\tred-crew-admin
npm install
Copy-Item .env.example .env
npm run dev
```

Trong `.env`, đặt `VITE_API_BASE_URL` thành URL đầy đủ của backend, ví dụ `http://localhost:5000/api/v1`, và `VITE_HOST_PORT` thành cổng chạy trang admin, ví dụ `5173`. Khởi động lại Vite sau khi đổi cấu hình. Trên Windows, `npm run dev` sẽ tự dừng phiên Vite cũ của chính dự án trên cổng này; nếu cổng do ứng dụng khác sử dụng, lệnh sẽ báo lỗi và không tự dừng ứng dụng đó. Ở chế độ dev, Vite proxy `/api/v1` đến URL API này. Mở `http://localhost:5173` (hoặc cổng đã cấu hình) và đăng nhập bằng tài khoản **ADMIN**.

Chọn **Ghi nhớ tài khoản và mật khẩu** khi đăng nhập. Ứng dụng lưu tên đăng nhập trên trình duyệt; mật khẩu được đề nghị lưu vào trình quản lý mật khẩu của trình duyệt nếu trình duyệt hỗ trợ và bạn đồng ý. Mật khẩu không được ghi vào `.env` hoặc localStorage. Trình duyệt có thể yêu cầu xác nhận và mức hỗ trợ tùy trình duyệt. Bỏ chọn sẽ xóa tên đăng nhập do ứng dụng lưu; mật khẩu đã lưu cần xóa trong trình quản lý mật khẩu của trình duyệt. Phiên đăng nhập dùng sessionStorage và được làm mới tự động; đăng xuất sẽ thu hồi refresh token.

Các màn hình quản lý tài khoản, nhân sự, sự kiện, phân công, chấm công, EXP, điểm, nhật ký và Lark dùng API thật. API Explorer cung cấp các endpoint còn lại theo đặc tả Swagger. Không phải mọi endpoint đều có màn hình chuyên biệt; chẳng hạn check-in cho nhân viên và các API quản lý yêu cầu nhân sự có thể gọi qua API Explorer.

## Kết nối Lark

Trên trang Kết nối Lark, chọn **Kết nối Lark**, hoàn tất cấp quyền trong tab mới, quay lại trang admin và bấm **Làm mới trạng thái**, rồi tải danh sách và chọn lịch. Cấu hình callback và quyền Lark theo README của backend trước khi kết nối. Sự kiện chỉ được đồng bộ sau khi bấm **Đồng bộ sự kiện**.

## Build và triển khai

```powershell
npm run build
npm run preview
```

Khi build, `VITE_API_BASE_URL` được đưa vào ứng dụng và trình duyệt gọi trực tiếp URL này; thêm origin của admin vào `CORS_ORIGINS` của backend. Vite proxy API trong chế độ dev. Cổng dev và preview đều lấy từ `VITE_HOST_PORT`. Không đưa secret vào biến `VITE_*` vì trình duyệt có thể đọc chúng. Dùng HTTPS khi truy cập ngoài máy local.

Đặc tả cho API Explorer là bản snapshot trong `src/openapi.json`. Sau khi backend thay đổi Swagger, chạy `npm run sync:swagger` (cần thư mục backend ở `../tred-crew-api` với dependencies đã cài; đặt `TRED_API_DIR` nếu đặt nơi khác), sau đó build lại.

## Tạo sự kiện từ ảnh

Trang Lịch hiển thị lịch tháng theo sự kiện trong hệ thống. Trang Sự kiện hiển thị danh sách và các thao tác quản lý sự kiện. Bấm **Tạo từ ảnh** để chọn ảnh và kiểm tra từng gợi ý trước khi xác nhận tạo. Ảnh xử lý trong trình duyệt; lần đầu cần kết nối mạng để tải dữ liệu nhận diện. Nhận diện chỉ tìm mã ngày dạng YYMMDD, có thể bỏ sót hoặc đọc sai ảnh mờ; bổ sung thủ công khi cần. Sự kiện nhập từ ảnh chưa xác định giờ, chỉnh sửa sự kiện và đánh dấu xác nhận khi đã nhập giờ thực tế.

Màu sắc ưu tiên đỏ (trong 5 ngày tới, chưa có người xác nhận nhận việc), cam (chưa phân công người), vàng (đã có người nhưng chưa xác định giờ), xanh (đã có người và xác định giờ).
