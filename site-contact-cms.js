(async function(){
  function q(sel){return document.querySelector(sel)}
  function esc(s){return String(s??'')}
  try{
    const r=await fetch('/homepage.json?v='+Date.now(),{cache:'no-store'});
    if(!r.ok) throw new Error('homepage.json '+r.status);
    const cfg=await r.json();
    const c=cfg.site_contact||{};

    // Header call button
    const buttons=[...document.querySelectorAll('a,button')];
    const callBtn=buttons.find(el=>/gọi tư vấn|goi tu van/i.test(el.textContent||''));
    if(callBtn){
      if(c.show_header_call===false){
        callBtn.style.display='none';
      }else{
        callBtn.style.display='';
        callBtn.textContent=(c.header_call_icon||'☎')+' '+(c.header_call_label||'Gọi tư vấn');
        if(callBtn.tagName==='A') callBtn.href='tel:'+(c.phone_number||'');
      }
    }

    // Floating phone buttons
    for(const a of document.querySelectorAll('a[href^="tel:"]')){
      if(c.phone_number) a.href='tel:'+c.phone_number;
    }

    // Floating Zalo links
    for(const a of document.querySelectorAll('a[href*="zalo.me"],a[href*="zalo"]')){
      if(c.zalo_link) a.href=c.zalo_link;
    }

    const footer=q('footer');
    if(!footer) return;

    const contact=[];
    if(c.address) contact.push(`
      <div class="dtcom-contact-item">
        <span class="dtcom-contact-icon">${esc(c.address_icon||'📍')}</span>
        <p>${esc(c.address)}</p>
      </div>`);

    if(c.phone_number||c.phone_display) contact.push(`
      <div class="dtcom-contact-item">
        <span class="dtcom-contact-icon">${esc(c.phone_icon||'☎')}</span>
        <p>${esc(c.phone_label||'Điện thoại')}: <a href="tel:${esc(c.phone_number||'')}"><strong>${esc(c.phone_display||c.phone_number||'')}</strong></a></p>
      </div>`);

    if(c.zalo_number||c.zalo_display||c.zalo_link) contact.push(`
      <div class="dtcom-contact-item">
        <span class="dtcom-contact-icon">${esc(c.zalo_icon||'💬')}</span>
        <p>${esc(c.zalo_label||'Zalo')}: <a href="${esc(c.zalo_link||'#')}" target="_blank" rel="noopener"><strong>${esc(c.zalo_display||c.zalo_number||'')}</strong></a></p>
      </div>`);

    if(c.show_email && c.email) contact.push(`
      <div class="dtcom-contact-item">
        <span class="dtcom-contact-icon">${esc(c.email_icon||'✉️')}</span>
        <p>${esc(c.email_label||'Email')}: <a href="mailto:${esc(c.email)}">${esc(c.email)}</a></p>
      </div>`);

    if(c.show_working_hours && c.working_hours) contact.push(`
      <div class="dtcom-contact-item">
        <span class="dtcom-contact-icon">${esc(c.hours_icon||'🕒')}</span>
        <p>${esc(c.hours_label||'Thời gian làm việc')}: ${esc(c.working_hours)}</p>
      </div>`);

    footer.className='dtcom-footer';
    footer.innerHTML=`
      <div class="dtcom-footer-wrap">
        <div>
          <div class="dtcom-footer-brand">
            <img class="dtcom-footer-logo" src="/assets/dtcom-logo.svg" alt="DTCOM">
            <div>
              <div class="dtcom-footer-name">${esc(c.company_name||'DTCOM')}</div>
              <div class="dtcom-footer-sub">${esc(c.company_subtitle||'Technology & Security')}</div>
            </div>
          </div>
          <p>${esc(c.footer_description||'')}</p>
        </div>

        <div>
          <h3>Thông tin liên hệ</h3>
          ${contact.join('')}
        </div>

        <div>
          <h3>Liên kết nhanh</h3>
          <div class="dtcom-footer-links">
            <a href="/products.html">${esc(c.quick_products_label||'Sản phẩm')}</a>
            <a href="/projects.html">${esc(c.quick_projects_label||'Công trình')}</a>
            <a href="/services.html">${esc(c.quick_services_label||'Dịch vụ')}</a>
            <a href="/contact.html">${esc(c.quick_contact_label||'Liên hệ')}</a>
          </div>
        </div>
      </div>
      <div class="dtcom-footer-bottom">
        © ${esc(c.company_name||'DTCOM')} Technology &amp; Security. All rights reserved.
      </div>
    `;
  }catch(e){
    console.warn('DTCOM contact CMS:',e);
  }
})();
