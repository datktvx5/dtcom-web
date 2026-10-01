const fs = require("fs");
const path = require("path");
const YAML = require("yaml");

const PAGES = ".pages.yml";
const SETTINGS = "homepage.json";
const CSS_FILE = "top-ticker.css";
const JS_FILE = "top-ticker.js";

if (!fs.existsSync(PAGES)) throw new Error("Missing .pages.yml");

function readJson(file, fallback={}) {
  if (!fs.existsSync(file)) return fallback;
  try { return JSON.parse(fs.readFileSync(file, "utf8")); }
  catch { return fallback; }
}

// 1) Preserve homepage.json and add ticker defaults only when fields are missing.
const cfg = readJson(SETTINGS, {});
const defaults = {
  enabled: true,
  text: "🎉 KHAI TRƯƠNG DTCOM • ƯU ĐÃI HẤP DẪN • CAMERA • MÁY TÍNH • MÁY IN • THIẾT BỊ MẠNG • HOTLINE 0971 675 929",
  link: "",
  background_color: "#0B2D55",
  text_color: "#FFFFFF",
  font_family: "system-ui",
  font_size: 14,
  font_weight: "700",
  speed_seconds: 22,
  height: 36,
  pause_on_hover: true
};

cfg.top_ticker = {
  ...defaults,
  ...(cfg.top_ticker || {})
};

fs.writeFileSync(SETTINGS, JSON.stringify(cfg, null, 2) + "\n", "utf8");

// 2) Add CMS item by editing current .pages.yml instead of replacing it.
const doc = YAML.parse(fs.readFileSync(PAGES, "utf8")) || {};
doc.content = Array.isArray(doc.content) ? doc.content : [];

doc.content = doc.content.filter(x => x && x.name !== "homepage_ticker");

doc.content.push({
  name: "homepage_ticker",
  label: "Chữ chạy đầu trang",
  type: "file",
  path: SETTINGS,
  operations: {
    create: false,
    rename: false,
    delete: false
  },
  fields: [
    {
      name: "top_ticker.enabled",
      label: "Bật chữ chạy",
      type: "boolean",
      default: true
    },
    {
      name: "top_ticker.text",
      label: "Nội dung chữ chạy",
      type: "string",
      required: true
    },
    {
      name: "top_ticker.link",
      label: "Link khi bấm vào chữ chạy",
      type: "string",
      description: "Có thể để trống. Ví dụ: /products.html hoặc https://..."
    },
    {
      name: "top_ticker.background_color",
      label: "Màu nền",
      type: "string",
      required: true,
      description: "Mã màu HEX, ví dụ #0B2D55"
    },
    {
      name: "top_ticker.text_color",
      label: "Màu chữ",
      type: "string",
      required: true,
      description: "Mã màu HEX, ví dụ #FFFFFF"
    },
    {
      name: "top_ticker.font_family",
      label: "Font chữ",
      type: "select",
      required: true,
      options: {
        values: [
          { value: "system-ui", label: "Mặc định hiện đại" },
          { value: "Arial, sans-serif", label: "Arial" },
          { value: "Tahoma, sans-serif", label: "Tahoma" },
          { value: "Verdana, sans-serif", label: "Verdana" },
          { value: "'Trebuchet MS', sans-serif", label: "Trebuchet MS" },
          { value: "Georgia, serif", label: "Georgia" }
        ]
      }
    },
    {
      name: "top_ticker.font_size",
      label: "Cỡ chữ (px)",
      type: "number",
      required: true,
      default: 14
    },
    {
      name: "top_ticker.font_weight",
      label: "Độ đậm chữ",
      type: "select",
      required: true,
      options: {
        values: [
          { value: "400", label: "Thường" },
          { value: "500", label: "Vừa" },
          { value: "600", label: "Hơi đậm" },
          { value: "700", label: "Đậm" },
          { value: "800", label: "Rất đậm" }
        ]
      }
    },
    {
      name: "top_ticker.speed_seconds",
      label: "Tốc độ chạy (giây/vòng)",
      type: "number",
      required: true,
      default: 22,
      description: "Số càng nhỏ chạy càng nhanh. Gợi ý 15–35."
    },
    {
      name: "top_ticker.height",
      label: "Chiều cao thanh (px)",
      type: "number",
      required: true,
      default: 36
    },
    {
      name: "top_ticker.pause_on_hover",
      label: "Dừng khi rê chuột",
      type: "boolean",
      default: true
    }
  ]
});

fs.writeFileSync(PAGES, YAML.stringify(doc), "utf8");

// 3) Write standalone CSS/JS. These are easier to maintain than editing app.js/style.css.
const css = `
:root{
  --dt-ticker-bg:#0B2D55;
  --dt-ticker-fg:#FFFFFF;
  --dt-ticker-size:14px;
  --dt-ticker-weight:700;
  --dt-ticker-height:36px;
  --dt-ticker-speed:22s;
  --dt-ticker-font:system-ui;
}
#dt-top-ticker{
  width:100%;
  height:var(--dt-ticker-height);
  overflow:hidden;
  background:var(--dt-ticker-bg);
  color:var(--dt-ticker-fg);
  display:flex;
  align-items:center;
  position:relative;
  z-index:9999;
  box-sizing:border-box;
}
#dt-top-ticker[hidden]{display:none!important}
#dt-top-ticker .dt-ticker-link{
  display:block;
  width:100%;
  color:inherit;
  text-decoration:none;
  overflow:hidden;
}
#dt-top-ticker .dt-ticker-track{
  display:flex;
  width:max-content;
  min-width:200%;
  will-change:transform;
  animation:dtcomTicker var(--dt-ticker-speed) linear infinite;
  font-family:var(--dt-ticker-font);
  font-size:var(--dt-ticker-size);
  font-weight:var(--dt-ticker-weight);
  line-height:1;
  white-space:nowrap;
}
#dt-top-ticker .dt-ticker-copy{
  display:flex;
  align-items:center;
  min-width:100vw;
  padding:0 48px;
  box-sizing:border-box;
  letter-spacing:.25px;
}
#dt-top-ticker.dt-pause-hover:hover .dt-ticker-track{
  animation-play-state:paused;
}
@keyframes dtcomTicker{
  from{transform:translateX(0)}
  to{transform:translateX(-50%)}
}
@media (prefers-reduced-motion:reduce){
  #dt-top-ticker .dt-ticker-track{animation:none}
}
@media (max-width:640px){
  #dt-top-ticker .dt-ticker-copy{padding:0 28px}
}
`.trim()+"\n";

const js = `
(async function(){
  try{
    const res=await fetch('/homepage.json?v='+Date.now(),{cache:'no-store'});
    if(!res.ok) throw new Error('homepage.json '+res.status);
    const cfg=await res.json();
    const t=cfg.top_ticker||{};
    if(t.enabled===false) return;

    const text=String(t.text||'').trim();
    if(!text) return;

    const bar=document.createElement('div');
    bar.id='dt-top-ticker';
    if(t.pause_on_hover!==false) bar.classList.add('dt-pause-hover');

    const link=document.createElement('a');
    link.className='dt-ticker-link';
    const href=String(t.link||'').trim();
    link.href=href||'#';
    if(!href) link.addEventListener('click',e=>e.preventDefault());

    const track=document.createElement('div');
    track.className='dt-ticker-track';

    for(let i=0;i<2;i++){
      const copy=document.createElement('div');
      copy.className='dt-ticker-copy';
      copy.textContent=text;
      track.appendChild(copy);
    }

    link.appendChild(track);
    bar.appendChild(link);
    document.body.insertBefore(bar,document.body.firstChild);

    const root=document.documentElement;
    root.style.setProperty('--dt-ticker-bg',String(t.background_color||'#0B2D55'));
    root.style.setProperty('--dt-ticker-fg',String(t.text_color||'#FFFFFF'));
    root.style.setProperty('--dt-ticker-font',String(t.font_family||'system-ui'));
    root.style.setProperty('--dt-ticker-size',(Number(t.font_size)||14)+'px');
    root.style.setProperty('--dt-ticker-weight',String(t.font_weight||'700'));
    root.style.setProperty('--dt-ticker-height',(Number(t.height)||36)+'px');
    root.style.setProperty('--dt-ticker-speed',Math.max(5,Number(t.speed_seconds)||22)+'s');
  }catch(err){
    console.warn('DTCOM ticker:',err);
  }
})();
`.trim()+"\n";

fs.writeFileSync(CSS_FILE, css, "utf8");
fs.writeFileSync(JS_FILE, js, "utf8");

// 4) Inject into all root HTML pages, safely/idempotently.
const htmlFiles=fs.readdirSync(".").filter(f=>f.toLowerCase().endsWith(".html"));

for(const file of htmlFiles){
  let html=fs.readFileSync(file,"utf8");
  let changed=false;

  if(!html.includes('top-ticker.css')){
    if(/<\/head>/i.test(html)){
      html=html.replace(/<\/head>/i, '  <link rel="stylesheet" href="/top-ticker.css">\\n</head>');
      changed=true;
    }
  }

  if(!html.includes('top-ticker.js')){
    if(/<\/body>/i.test(html)){
      html=html.replace(/<\/body>/i, '  <script src="/top-ticker.js" defer></script>\\n</body>');
      changed=true;
    }
  }

  if(changed){
    fs.writeFileSync(file,html,"utf8");
    console.log("Patched",file);
  }
}

console.log("Installed CMS-controlled top ticker.");
