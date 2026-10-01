const fs = require("fs");
const YAML = require("yaml");

const PAGES = ".pages.yml";
const SETTINGS = "homepage.json";

if(!fs.existsSync(PAGES)) throw new Error("Missing .pages.yml");

let cfg = {};
if(fs.existsSync(SETTINGS)){
  try{ cfg = JSON.parse(fs.readFileSync(SETTINGS,"utf8")); }catch{}
}

cfg.site_contact = {
  company_name: "DTCOM",
  company_subtitle: "Technology & Security",
  footer_description: "Giải pháp công nghệ và an ninh toàn diện cho gia đình, cửa hàng, văn phòng và doanh nghiệp.",

  address_icon: "📍",
  address: "Xã Đại Đồng, tỉnh Nghệ An",

  phone_icon: "☎",
  phone_label: "Điện thoại",
  phone_number: "0971675929",
  phone_display: "0971 675 929",

  zalo_icon: "💬",
  zalo_label: "Zalo",
  zalo_number: "0971675929",
  zalo_display: "0971 675 929",
  zalo_link: "https://zalo.me/0971675929",

  email_icon: "✉️",
  email_label: "Email",
  email: "",
  show_email: false,

  hours_icon: "🕒",
  hours_label: "Thời gian làm việc",
  working_hours: "Thứ 2 - Chủ nhật: 8:00 - 18:00",
  show_working_hours: false,

  header_call_icon: "☎",
  header_call_label: "Gọi tư vấn",
  show_header_call: true,

  quick_products_label: "Sản phẩm",
  quick_projects_label: "Công trình",
  quick_services_label: "Dịch vụ",
  quick_contact_label: "Liên hệ",
  ...(cfg.site_contact || {})
};

fs.writeFileSync(SETTINGS, JSON.stringify(cfg,null,2)+"\n","utf8");

const doc = YAML.parse(fs.readFileSync(PAGES,"utf8")) || {};
doc.content = Array.isArray(doc.content) ? doc.content : [];
doc.content = doc.content.filter(x => x && x.name !== "site_contact_settings");

doc.content.push({
  name: "site_contact_settings",
  label: "Header & Footer",
  type: "file",
  path: SETTINGS,
  operations: { create:false, rename:false, delete:false },
  fields: [
    {
      name: "site_contact",
      label: "Thông tin Header & Footer",
      type: "object",
      fields: [
        {name:"company_name",label:"Tên thương hiệu",type:"string",required:true},
        {name:"company_subtitle",label:"Dòng chữ dưới thương hiệu",type:"string"},
        {name:"footer_description",label:"Mô tả ngắn ở chân trang",type:"text"},

        {name:"address_icon",label:"Biểu tượng địa chỉ",type:"string",description:"Có thể nhập emoji, ví dụ 📍"},
        {name:"address",label:"Địa chỉ",type:"string"},

        {name:"phone_icon",label:"Biểu tượng điện thoại",type:"string",description:"Ví dụ ☎ hoặc 📞"},
        {name:"phone_label",label:"Nhãn điện thoại",type:"string"},
        {name:"phone_number",label:"Số điện thoại để gọi",type:"string",description:"Chỉ số, ví dụ 0971675929"},
        {name:"phone_display",label:"Số điện thoại hiển thị",type:"string",description:"Ví dụ 0971 675 929"},

        {name:"zalo_icon",label:"Biểu tượng Zalo",type:"string",description:"Ví dụ 💬"},
        {name:"zalo_label",label:"Nhãn Zalo",type:"string"},
        {name:"zalo_number",label:"Số Zalo",type:"string"},
        {name:"zalo_display",label:"Số Zalo hiển thị",type:"string"},
        {name:"zalo_link",label:"Link Zalo",type:"string",description:"Ví dụ https://zalo.me/0971675929"},

        {name:"show_email",label:"Hiện Email",type:"boolean"},
        {name:"email_icon",label:"Biểu tượng Email",type:"string",description:"Ví dụ ✉️"},
        {name:"email_label",label:"Nhãn Email",type:"string"},
        {name:"email",label:"Địa chỉ Email",type:"string"},

        {name:"show_working_hours",label:"Hiện thời gian làm việc",type:"boolean"},
        {name:"hours_icon",label:"Biểu tượng thời gian",type:"string",description:"Ví dụ 🕒"},
        {name:"hours_label",label:"Nhãn thời gian",type:"string"},
        {name:"working_hours",label:"Thời gian làm việc",type:"string"},

        {name:"show_header_call",label:"Hiện nút gọi tư vấn trên Header",type:"boolean"},
        {name:"header_call_icon",label:"Biểu tượng nút gọi",type:"string",description:"Ví dụ ☎ hoặc 📞"},
        {name:"header_call_label",label:"Chữ trên nút gọi",type:"string"},

        {name:"quick_products_label",label:"Tên link Sản phẩm",type:"string"},
        {name:"quick_projects_label",label:"Tên link Công trình",type:"string"},
        {name:"quick_services_label",label:"Tên link Dịch vụ",type:"string"},
        {name:"quick_contact_label",label:"Tên link Liên hệ",type:"string"}
      ]
    }
  ]
});

fs.writeFileSync(PAGES, YAML.stringify(doc), "utf8");

const js = `
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
    if(c.address) contact.push(\`
      <div class="dtcom-contact-item">
        <span class="dtcom-contact-icon">\${esc(c.address_icon||'📍')}</span>
        <p>\${esc(c.address)}</p>
      </div>\`);

    if(c.phone_number||c.phone_display) contact.push(\`
      <div class="dtcom-contact-item">
        <span class="dtcom-contact-icon">\${esc(c.phone_icon||'☎')}</span>
        <p>\${esc(c.phone_label||'Điện thoại')}: <a href="tel:\${esc(c.phone_number||'')}"><strong>\${esc(c.phone_display||c.phone_number||'')}</strong></a></p>
      </div>\`);

    if(c.zalo_number||c.zalo_display||c.zalo_link) contact.push(\`
      <div class="dtcom-contact-item">
        <span class="dtcom-contact-icon">\${esc(c.zalo_icon||'💬')}</span>
        <p>\${esc(c.zalo_label||'Zalo')}: <a href="\${esc(c.zalo_link||'#')}" target="_blank" rel="noopener"><strong>\${esc(c.zalo_display||c.zalo_number||'')}</strong></a></p>
      </div>\`);

    if(c.show_email && c.email) contact.push(\`
      <div class="dtcom-contact-item">
        <span class="dtcom-contact-icon">\${esc(c.email_icon||'✉️')}</span>
        <p>\${esc(c.email_label||'Email')}: <a href="mailto:\${esc(c.email)}">\${esc(c.email)}</a></p>
      </div>\`);

    if(c.show_working_hours && c.working_hours) contact.push(\`
      <div class="dtcom-contact-item">
        <span class="dtcom-contact-icon">\${esc(c.hours_icon||'🕒')}</span>
        <p>\${esc(c.hours_label||'Thời gian làm việc')}: \${esc(c.working_hours)}</p>
      </div>\`);

    footer.className='dtcom-footer';
    footer.innerHTML=\`
      <div class="dtcom-footer-wrap">
        <div>
          <div class="dtcom-footer-brand">
            <img class="dtcom-footer-logo" src="/assets/dtcom-logo.svg" alt="DTCOM">
            <div>
              <div class="dtcom-footer-name">\${esc(c.company_name||'DTCOM')}</div>
              <div class="dtcom-footer-sub">\${esc(c.company_subtitle||'Technology & Security')}</div>
            </div>
          </div>
          <p>\${esc(c.footer_description||'')}</p>
        </div>

        <div>
          <h3>Thông tin liên hệ</h3>
          \${contact.join('')}
        </div>

        <div>
          <h3>Liên kết nhanh</h3>
          <div class="dtcom-footer-links">
            <a href="/products.html">\${esc(c.quick_products_label||'Sản phẩm')}</a>
            <a href="/projects.html">\${esc(c.quick_projects_label||'Công trình')}</a>
            <a href="/services.html">\${esc(c.quick_services_label||'Dịch vụ')}</a>
            <a href="/contact.html">\${esc(c.quick_contact_label||'Liên hệ')}</a>
          </div>
        </div>
      </div>
      <div class="dtcom-footer-bottom">
        © \${esc(c.company_name||'DTCOM')} Technology &amp; Security. All rights reserved.
      </div>
    \`;
  }catch(e){
    console.warn('DTCOM contact CMS:',e);
  }
})();
`.trim()+"\n";

fs.writeFileSync("site-contact-cms.js", js, "utf8");

for(const file of fs.readdirSync(".").filter(f=>f.toLowerCase().endsWith(".html"))){
  let html=fs.readFileSync(file,"utf8");
  let changed=false;
  if(!html.includes('site-contact-cms.js') && /<\/body>/i.test(html)){
    html=html.replace(/<\/body>/i,'  <script src="/site-contact-cms.js" defer></script>\\n</body>');
    changed=true;
  }
  if(changed){
    fs.writeFileSync(file,html,"utf8");
    console.log("Patched",file);
  }
}

console.log("Installed Header & Footer CMS controls.");
