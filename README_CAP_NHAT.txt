DTCOM - CAP NHAT CARD SAN PHAM + CMS GON

UPLOAD DE (ghi de dung duong dan):
- .pages.yml
- app.js
- product.js
- style.css
- scripts/organize-product-media.js

KHONG UP/DE CAC FILE products-*.json de tranh mat du lieu.

Sau khi commit:
1. Vao GitHub Actions, cho workflow "Organize product and project media" chay xanh.
2. Workflow se tu dong chuyen du lieu san pham tu mang JSON cu sang dang {"items":[...]} ma KHONG xoa san pham.
3. Sau do refresh Pages CMS (Ctrl+F5).

CMS moi chi con:
- Ten san pham
- Gia ban
- Gia cu
- Link Shopee Affiliate
- Anh san pham
- Video san pham
- San pham noi bat
- Mo ta
- Ma/duong dan van an va tu sinh.

Moi item trong CMS se hien ten san pham thay vi Item #1, Item #2...

Web:
- Anh san pham dung object-fit: contain, luon uu tien hien du anh.
- Ten + gia nam sat day card.
- Mobile van hien 2 cot va khong crop anh.
