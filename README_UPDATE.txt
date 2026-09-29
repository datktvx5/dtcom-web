DTCOM - 4 nhóm sản phẩm + Công trình tiêu biểu

Bản này KHÔNG chuyển sản phẩm cũ. 4 file sản phẩm và projects.json đều bắt đầu rỗng.

Upload/thay thế ở thư mục gốc repo:
- .pages.yml
- index.html
- app.js
- product.js
- product.html
- project.js
- project.html
- style.css
- products-camera.json
- products-computer.json
- products-printer.json
- products-network.json
- projects.json

Giữ đúng đường dẫn:
- scripts/organize-product-media.js
- .github/workflows/organize-product-media.yml

Sau khi cập nhật, có thể XÓA file products.json cũ khỏi repo.

Pages CMS sẽ có 5 mục:
- Camera
- Máy tính
- Máy in
- Thiết bị mạng
- Công trình tiêu biểu

Media tự động:
- Sản phẩm: media/<ma-san-pham>/...
- Công trình: media/cong-trinh/<ma-cong-trinh>/...

Xóa sản phẩm/công trình thì GitHub Action tự dọn thư mục media tương ứng.
