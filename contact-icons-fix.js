(async function(){
  try{
    const r=await fetch('/homepage.json?v='+Date.now(),{cache:'no-store'});
    if(!r.ok) return;
    const cfg=await r.json();
    const c=cfg.site_contact||{};

    // Footer alignment is CSS-only.

    // Remove previous hard-coded floating phone/zalo buttons to avoid duplicates.
    const candidates=[...document.querySelectorAll('body > a, body > div > a')];
    for(const a of candidates){
      const txt=(a.textContent||'').trim().toLowerCase();
      const href=(a.getAttribute('href')||'').toLowerCase();
      if(href.startsWith('tel:') || href.includes('zalo.me') || txt==='zalo'){
        const rect=a.getBoundingClientRect();
        const style=getComputedStyle(a);
        if(style.position==='fixed' || rect.right>window.innerWidth-120){
          a.remove();
        }
      }
    }

    document.getElementById('dtcom-floating-contact')?.remove();

    const wrap=document.createElement('div');
    wrap.id='dtcom-floating-contact';

    if(c.floating_phone_enabled!==false && c.phone_number){
      const a=document.createElement('a');
      a.className='dt-float-phone';
      a.href='tel:'+String(c.phone_number);
      a.setAttribute('aria-label','Gọi '+String(c.phone_display||c.phone_number));
      a.innerHTML='<span>'+String(c.floating_phone_icon||'☎')+'</span>'+
        (String(c.floating_phone_text||'').trim()?'<span>'+String(c.floating_phone_text).trim()+'</span>':'');
      wrap.appendChild(a);
    }

    if(c.floating_zalo_enabled!==false && c.zalo_link){
      const a=document.createElement('a');
      a.className='dt-float-zalo';
      a.href=String(c.zalo_link);
      a.target='_blank';
      a.rel='noopener';
      a.textContent=String(c.floating_zalo_text||'Zalo');
      wrap.appendChild(a);
    }

    if(wrap.children.length){
      document.body.appendChild(wrap);
      document.documentElement.style.setProperty('--dt-float-phone-bg',String(c.floating_phone_bg||'#18B86B'));
      document.documentElement.style.setProperty('--dt-float-zalo-bg',String(c.floating_zalo_bg||'#1688F8'));
    }
  }catch(e){
    console.warn('Floating contact CMS:',e);
  }
})();
