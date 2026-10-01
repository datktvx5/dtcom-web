(function(){
  function norm(s){
    return String(s||'').toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
      .replace(/đ/g,'d').replace(/\s+/g,' ').trim();
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
    footer.innerHTML=`
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
    `;
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
