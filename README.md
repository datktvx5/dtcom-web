# DTCOM Free Web

Website tĩnh miễn phí dành cho DTCOM, dùng GitHub + Cloudflare Pages + Pages CMS.

## 1. Đưa source lên GitHub

- Tạo repository mới, ví dụ: `dtcom-web`
- Giải nén toàn bộ file trong gói này và upload vào repository.
- Nhánh chính dùng `main`.

## 2. Đưa website lên Cloudflare Pages

Trong Cloudflare:

1. Workers & Pages → Create application → Pages.
2. Import an existing Git repository.
3. Chọn repository `dtcom-web`.
4. Production branch: `main`.
5. Build command: `exit 0` (hoặc để trống nếu giao diện cho phép).
6. Build output directory: `.`
7. Deploy.

Sau khi deploy, Cloudflare cấp tên miền dạng `ten-du-an.pages.dev`.

## 3. Kết nối Pages CMS

1. Mở https://app.pagescms.org
2. Đăng nhập GitHub.
3. Cài Pages CMS GitHub App và cấp quyền cho repository `dtcom-web`.
4. Mở repository trong Pages CMS.
5. Pages CMS sẽ đọc file `.pages.yml` ở thư mục gốc.
6. Chọn `Sản phẩm` để thêm/sửa/xóa dữ liệu trong `products.json`.

## 4. Thêm sản phẩm

Trong Pages CMS → Sản phẩm → thêm dòng mới:

- Mã sản phẩm: viết không dấu, không khoảng trắng, ví dụ `hikvision-ds-2cd1043g2-liu`
- Tên sản phẩm
- Danh mục
- Nhóm con
- Thương hiệu
- Giá bán
- Giá cũ (nếu có)
- Bảo hành
- Ảnh sản phẩm
- Mô tả
- Thông số

Bấm lưu. Pages CMS sẽ commit thay đổi vào GitHub; Cloudflare Pages sẽ tự deploy lại website.

## 5. Thông tin đang cấu hình

- Hotline: 0971 675 929
- Zalo: 0971 675 929
- Địa chỉ: Xã Đại Đồng, tỉnh Nghệ An

## 6. File chính

- `index.html`: trang chủ
- `product.html`: chi tiết sản phẩm
- `products.json`: dữ liệu sản phẩm
- `.pages.yml`: cấu hình trang quản trị Pages CMS
- `style.css`: giao diện
- `app.js`: tìm kiếm/lọc sản phẩm
