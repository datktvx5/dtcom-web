const fs=require("fs");
const YAML=require("yaml");

const PAGES=".pages.yml";
const SETTINGS="homepage.json";

if(!fs.existsSync(PAGES)) throw new Error("Missing .pages.yml");

let cfg={};
if(fs.existsSync(SETTINGS)){
  try{cfg=JSON.parse(fs.readFileSync(SETTINGS,"utf8"));}catch{}
}

cfg.site_contact={
  ...(cfg.site_contact||{}),

  floating_phone_enabled: cfg.site_contact?.floating_phone_enabled ?? true,
  floating_phone_icon: cfg.site_contact?.floating_phone_icon ?? "☎",
  floating_phone_text: cfg.site_contact?.floating_phone_text ?? "",
  floating_phone_bg: cfg.site_contact?.floating_phone_bg ?? "#18B86B",

  floating_zalo_enabled: cfg.site_contact?.floating_zalo_enabled ?? true,
  floating_zalo_text: cfg.site_contact?.floating_zalo_text ?? "Zalo",
  floating_zalo_bg: cfg.site_contact?.floating_zalo_bg ?? "#1688F8"
};

fs.writeFileSync(SETTINGS,JSON.stringify(cfg,null,2)+"\n","utf8");

const doc=YAML.parse(fs.readFileSync(PAGES,"utf8"))||{};
doc.content=Array.isArray(doc.content)?doc.content:[];

// Patch existing Header & Footer CMS entry in place.
for(const item of doc.content){
  if(item && item.name==="site_contact_settings"){
    const obj=(item.fields||[]).find(f=>f.name==="site_contact");
    if(obj && Array.isArray(obj.fields)){
      const remove=new Set([
        "floating_phone_enabled","floating_phone_icon","floating_phone_text","floating_phone_bg",
        "floating_zalo_enabled","floating_zalo_text","floating_zalo_bg"
      ]);
      obj.fields=obj.fields.filter(f=>!remove.has(f.name));

      obj.fields.push(
        {name:"floating_phone_enabled",label:"Hiện nút điện thoại nổi",type:"boolean"},
        {name:"floating_phone_icon",label:"Biểu tượng nút điện thoại nổi",type:"string",description:"Ví dụ ☎ 📞 📱"},
        {name:"floating_phone_text",label:"Chữ trong nút điện thoại nổi",type:"string",description:"Để trống nếu chỉ muốn biểu tượng"},
        {
          name:"floating_phone_bg",label:"Màu nút điện thoại nổi",type:"select",
          options:{values:[
            {name:"#18B86B",label:"Xanh lá"},
            {name:"#16A34A",label:"Xanh lá đậm"},
            {name:"#087CF0",label:"Xanh điện"},
            {name:"#0B2D55",label:"Xanh navy"},
            {name:"#D71920",label:"Đỏ"}
          ]}
        },

        {name:"floating_zalo_enabled",label:"Hiện nút Zalo nổi",type:"boolean"},
        {name:"floating_zalo_text",label:"Chữ trên nút Zalo nổi",type:"string"},
        {
          name:"floating_zalo_bg",label:"Màu nút Zalo nổi",type:"select",
          options:{values:[
            {name:"#1688F8",label:"Xanh Zalo"},
            {name:"#087CF0",label:"Xanh điện"},
            {name:"#0B2D55",label:"Xanh navy"},
            {name:"#FFFFFF",label:"Trắng"}
          ]}
        }
      );
    }
  }
}

fs.writeFileSync(PAGES,YAML.stringify(doc),"utf8");

const css=`
/* Align footer contact icons and text */
.dtcom-footer .dtcom-contact-item{
  display:grid !important;
  grid-template-columns:28px 1fr !important;
  column-gap:10px !important;
  align-items:start !important;
  margin:0 0 12px !important;
}
.dtcom-footer .dtcom-contact-icon{
  width:28px !important;
  min-width:28px !important;
  height:24px !important;
  display:flex !important;
  align-items:center !important;
  justify-content:center !important;
  line-height:24px !important;
  font-size:16px !important;
  margin:0 !important;
}
.dtcom-footer .dtcom-contact-item p{
  margin:0 !important;
  line-height:24px !important;
}
.dtcom-footer .dtcom-contact-item a{
  line-height:inherit !important;
}

/* Floating contact buttons */
#dtcom-floating-contact{
  position:fixed;
  right:18px;
  bottom:20px;
  z-index:99998;
  display:flex;
  flex-direction:column;
  gap:10px;
  align-items:flex-end;
}
#dtcom-floating-contact a{
  min-width:52px;
  height:52px;
  padding:0 14px;
  border-radius:999px;
  display:flex;
  align-items:center;
  justify-content:center;
  gap:7px;
  box-sizing:border-box;
  color:#fff;
  text-decoration:none;
  font-weight:800;
  font-size:15px;
  box-shadow:0 8px 22px rgba(0,0,0,.18);
  transition:transform .15s ease,box-shadow .15s ease;
}
#dtcom-floating-contact a:hover{
  transform:translateY(-2px);
  box-shadow:0 10px 26px rgba(0,0,0,.24);
}
#dtcom-floating-contact .dt-float-phone{
  background:var(--dt-float-phone-bg,#18B86B);
}
#dtcom-floating-contact .dt-float-zalo{
  background:var(--dt-float-zalo-bg,#1688F8);
}
@media(max-width:640px){
  #dtcom-floating-contact{
    right:12px;
    bottom:14px;
  }
  #dtcom-floating-contact a{
    min-width:48px;
    height:48px;
    padding:0 12px;
  }
}
`.trim()+"\n";

fs.writeFileSync("contact-icons-fix.css",css,"utf8");

const js=`
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
`.trim()+"\n";

fs.writeFileSync("contact-icons-fix.js",js,"utf8");

for(const file of fs.readdirSync(".").filter(f=>f.toLowerCase().endsWith(".html"))){
  let html=fs.readFileSync(file,"utf8"),changed=false;

  if(!html.includes("contact-icons-fix.css") && /<\/head>/i.test(html)){
    html=html.replace(/<\/head>/i,'  <link rel="stylesheet" href="/contact-icons-fix.css">\\n</head>');
    changed=true;
  }

  if(!html.includes("contact-icons-fix.js") && /<\/body>/i.test(html)){
    html=html.replace(/<\/body>/i,'  <script src="/contact-icons-fix.js" defer></script>\\n</body>');
    changed=true;
  }

  if(changed){
    fs.writeFileSync(file,html,"utf8");
    console.log("Patched",file);
  }
}

console.log("Installed footer alignment and CMS-controlled floating contact buttons.");
