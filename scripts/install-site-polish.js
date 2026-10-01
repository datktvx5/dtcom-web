const fs = require("fs");

const css = `
/* DTCOM header/footer polish */
.dtcom-footer{
  background:#061a36;
  color:#d9e8ff;
  padding:42px 0 26px;
  border-top:1px solid rgba(255,255,255,.08);
}
.dtcom-footer .dtcom-footer-wrap{
  width:min(1180px,calc(100% - 40px));
  margin:0 auto;
  display:grid;
  grid-template-columns:1.25fr 1fr .8fr;
  gap:48px;
  align-items:start;
}
.dtcom-footer .dtcom-footer-brand{
  display:flex;
  align-items:center;
  gap:12px;
  margin-bottom:14px;
}
.dtcom-footer .dtcom-footer-logo{
  width:46px;
  height:46px;
  object-fit:contain;
  border-radius:10px;
  background:#fff;
  padding:5px;
  box-sizing:border-box;
}
.dtcom-footer .dtcom-footer-name{
  color:#fff;
  font-size:18px;
  font-weight:800;
  letter-spacing:.4px;
}
.dtcom-footer .dtcom-footer-sub{
  color:#8fb7ef;
  font-size:10px;
  font-weight:700;
  letter-spacing:1.5px;
  text-transform:uppercase;
}
.dtcom-footer h3{
  margin:0 0 16px;
  color:#fff;
  font-size:16px;
  font-weight:800;
}
.dtcom-footer p,
.dtcom-footer a{
  color:#c6d8f2;
  font-size:15px;
  line-height:1.8;
  text-decoration:none;
}
.dtcom-footer a:hover{
  color:#55c7ff;
}
.dtcom-footer .dtcom-contact-item{
  display:flex;
  gap:10px;
  align-items:flex-start;
  margin-bottom:9px;
}
.dtcom-footer .dtcom-contact-icon{
  width:22px;
  flex:0 0 22px;
  text-align:center;
}
.dtcom-footer .dtcom-footer-links{
  display:flex;
  flex-direction:column;
  gap:8px;
}
.dtcom-footer .dtcom-footer-bottom{
  width:min(1180px,calc(100% - 40px));
  margin:28px auto 0;
  padding-top:18px;
  border-top:1px solid rgba(255,255,255,.08);
  color:#7fa0c8;
  font-size:13px;
  text-align:center;
}
@media(max-width:800px){
  .dtcom-footer .dtcom-footer-wrap{
    grid-template-columns:1fr;
    gap:28px;
  }
}
`.trim()+"\n";

const js = `
(function(){
  function norm(s){
    return String(s||'').toLowerCase()
      .normalize('NFD').replace(/[\\u0300-\\u036f]/g,'')
      .replace(/đ/g,'d').replace(/\\s+/g,' ').trim();
  }

  function removeOldTopInfo(){
    const all=[...document.body.querySelectorAll('div,section,header')];
    const candidates=all.filter(el=>{
      const t=norm(el.innerText);
      return t.includes('xa dai dong') &&
             t.includes('0971 675 929') &&
             (t.includes('thu 2') || t.includes('8:00') || t.includes('18:00'));
    });

    if(!candidates.length) return;

    // Prefer the smallest matching wrapper to avoid hiding the navigation/header.
    candidates.sort((a,b)=>a.querySelectorAll('*').length-b.querySelectorAll('*').length);
    let el=candidates[0];

    // If this is one small inner row, remove its immediate bar wrapper only.
    if(el.parentElement && el.parentElement.children.length<=2){
      const ptxt=norm(el.parentElement.innerText);
      if(ptxt.includes('xa dai dong') && ptxt.includes('0971 675 929')){
        el=el.parentElement;
      }
    }
    el.remove();
  }

  function replaceFooter(){
    const footer=document.querySelector('footer');
    if(!footer) return;

    footer.className='dtcom-footer';
    footer.innerHTML=\`
      <div class="dtcom-footer-wrap">
        <div>
          <div class="dtcom-footer-brand">
            <img class="dtcom-footer-logo" src="/assets/dtcom-logo.svg" alt="DTCOM">
            <div>
              <div class="dtcom-footer-name">DTCOM</div>
              <div class="dtcom-footer-sub">Technology &amp; Security</div>
            </div>
          </div>
          <p>Giải pháp công nghệ và an ninh toàn diện cho gia đình, cửa hàng, văn phòng và doanh nghiệp.</p>
        </div>

        <div>
          <h3>Thông tin liên hệ</h3>
          <div class="dtcom-contact-item">
            <span class="dtcom-contact-icon">📍</span>
            <p>Xã Đại Đồng, tỉnh Nghệ An</p>
          </div>
          <div class="dtcom-contact-item">
            <span class="dtcom-contact-icon">☎</span>
            <p>Điện thoại / Zalo: <a href="tel:0971675929"><strong>0971 675 929</strong></a></p>
          </div>
        </div>

        <div>
          <h3>Liên kết nhanh</h3>
          <div class="dtcom-footer-links">
            <a href="/products.html">Sản phẩm</a>
            <a href="/projects.html">Công trình</a>
            <a href="/services.html">Dịch vụ</a>
            <a href="/contact.html">Liên hệ</a>
          </div>
        </div>
      </div>
      <div class="dtcom-footer-bottom">
        © DTCOM Technology &amp; Security. All rights reserved.
      </div>
    \`;
  }

  function run(){
    removeOldTopInfo();
    replaceFooter();
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',run);
  }else{
    run();
  }
})();
`.trim()+"\n";

fs.writeFileSync("site-polish.css", css, "utf8");
fs.writeFileSync("site-polish.js", js, "utf8");

const htmlFiles=fs.readdirSync(".").filter(f=>f.toLowerCase().endsWith(".html"));
for(const file of htmlFiles){
  let html=fs.readFileSync(file,"utf8");
  let changed=false;

  if(!html.includes('site-polish.css') && /<\/head>/i.test(html)){
    html=html.replace(/<\/head>/i,'  <link rel="stylesheet" href="/site-polish.css">\\n</head>');
    changed=true;
  }

  if(!html.includes('site-polish.js') && /<\/body>/i.test(html)){
    html=html.replace(/<\/body>/i,'  <script src="/site-polish.js" defer></script>\\n</body>');
    changed=true;
  }

  if(changed){
    fs.writeFileSync(file,html,"utf8");
    console.log("Patched",file);
  }
}

console.log("Installed header/footer polish.");
