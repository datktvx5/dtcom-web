const fs = require("fs");
const YAML = require("yaml");

const PAGES=".pages.yml";
const SETTINGS="homepage.json";

if(!fs.existsSync(PAGES)) throw new Error("Missing .pages.yml");

let cfg={};
if(fs.existsSync(SETTINGS)){
  try{ cfg=JSON.parse(fs.readFileSync(SETTINGS,"utf8")); }catch{}
}

cfg.top_ticker={
  enabled: true,
  text: "🎉 KHAI TRƯƠNG DTCOM • ƯU ĐÃI HẤP DẪN • CAMERA • MÁY TÍNH • MÁY IN • THIẾT BỊ MẠNG • HOTLINE 0971 675 929",
  link: "",
  background_color: "#0B2D55",
  text_color: "#FFFFFF",
  font_family: "Arial, sans-serif",
  font_size: "14",
  font_weight: "700",
  speed_seconds: "22",
  height: "36",
  pause_on_hover: true,
  ...(cfg.top_ticker||{})
};

fs.writeFileSync(SETTINGS,JSON.stringify(cfg,null,2)+"\n","utf8");

const doc=YAML.parse(fs.readFileSync(PAGES,"utf8"))||{};
doc.content=Array.isArray(doc.content)?doc.content:[];

doc.content=doc.content.filter(x=>x&&x.name!=="homepage_ticker");

doc.content.push({
  name:"homepage_ticker",
  label:"Chữ chạy đầu trang",
  type:"file",
  path:SETTINGS,
  operations:{create:false,rename:false,delete:false},
  fields:[
    {
      name:"top_ticker",
      label:"Cài đặt chữ chạy",
      type:"object",
      fields:[
        {name:"enabled",label:"Bật chữ chạy",type:"boolean"},
        {
          name:"text",
          label:"Nội dung chữ chạy",
          type:"text",
          required:true,
          description:"Có thể dùng tiếng Việt, ký tự đặc biệt và emoji như 🎉 🔥 🎁 📞 ⭐."
        },
        {
          name:"link",
          label:"Link khi bấm vào chữ chạy",
          type:"string",
          description:"Có thể để trống. Ví dụ: /products.html"
        },
        {
          name:"background_color",
          label:"Màu nền",
          type:"select",
          required:true,
          options:{values:[
            {name:"#0B2D55",label:"Xanh navy DTCOM"},
            {name:"#087CF0",label:"Xanh điện"},
            {name:"#005EAA",label:"Xanh công nghệ"},
            {name:"#111827",label:"Đen xanh"},
            {name:"#000000",label:"Đen"},
            {name:"#D71920",label:"Đỏ khuyến mãi"},
            {name:"#B91C1C",label:"Đỏ đậm"},
            {name:"#F59E0B",label:"Cam vàng"},
            {name:"#16A34A",label:"Xanh lá"},
            {name:"#7C3AED",label:"Tím"}
          ]}
        },
        {
          name:"text_color",
          label:"Màu chữ",
          type:"select",
          required:true,
          options:{values:[
            {name:"#FFFFFF",label:"Trắng"},
            {name:"#FFD400",label:"Vàng nổi bật"},
            {name:"#67E8F9",label:"Xanh cyan"},
            {name:"#BAE6FD",label:"Xanh nhạt"},
            {name:"#FDE68A",label:"Vàng nhạt"},
            {name:"#000000",label:"Đen"}
          ]}
        },
        {
          name:"font_family",
          label:"Font chữ",
          type:"select",
          required:true,
          options:{values:[
            {name:"Arial, sans-serif",label:"Arial"},
            {name:"Tahoma, sans-serif",label:"Tahoma"},
            {name:"Verdana, sans-serif",label:"Verdana"},
            {name:"'Trebuchet MS', sans-serif",label:"Trebuchet MS"},
            {name:"Georgia, serif",label:"Georgia"},
            {name:"system-ui",label:"Mặc định hiện đại"}
          ]}
        },
        {
          name:"font_size",
          label:"Cỡ chữ",
          type:"select",
          required:true,
          options:{values:[
            {name:"12",label:"Nhỏ - 12 px"},
            {name:"14",label:"Vừa - 14 px"},
            {name:"16",label:"Lớn - 16 px"},
            {name:"18",label:"Rất lớn - 18 px"}
          ]}
        },
        {
          name:"font_weight",
          label:"Độ đậm chữ",
          type:"select",
          required:true,
          options:{values:[
            {name:"400",label:"Thường"},
            {name:"500",label:"Vừa"},
            {name:"600",label:"Hơi đậm"},
            {name:"700",label:"Đậm"},
            {name:"800",label:"Rất đậm"}
          ]}
        },
        {
          name:"speed_seconds",
          label:"Tốc độ di chuyển",
          type:"select",
          required:true,
          options:{values:[
            {name:"10",label:"Rất nhanh"},
            {name:"15",label:"Nhanh"},
            {name:"22",label:"Vừa"},
            {name:"30",label:"Chậm"},
            {name:"40",label:"Rất chậm"}
          ]}
        },
        {
          name:"height",
          label:"Chiều cao thanh",
          type:"select",
          required:true,
          options:{values:[
            {name:"30",label:"Mỏng - 30 px"},
            {name:"36",label:"Vừa - 36 px"},
            {name:"42",label:"Cao - 42 px"},
            {name:"48",label:"Rất cao - 48 px"}
          ]}
        },
        {name:"pause_on_hover",label:"Dừng khi rê chuột",type:"boolean"}
      ]
    }
  ]
});

fs.writeFileSync(PAGES,YAML.stringify(doc),"utf8");

const css=`
:root{
  --dt-ticker-bg:#0B2D55;
  --dt-ticker-fg:#FFFFFF;
  --dt-ticker-size:14px;
  --dt-ticker-weight:700;
  --dt-ticker-height:36px;
  --dt-ticker-speed:22s;
  --dt-ticker-font:Arial,sans-serif;
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
  z-index:99999;
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
  align-items:center;
  width:max-content;
  white-space:nowrap;
  will-change:transform;
  animation:dtcomTicker var(--dt-ticker-speed) linear infinite;
  font-family:var(--dt-ticker-font);
  font-size:var(--dt-ticker-size);
  font-weight:var(--dt-ticker-weight);
  line-height:1;
}
#dt-top-ticker .dt-ticker-copy{
  display:inline-flex;
  align-items:center;
  flex:none;
  padding-right:80px;
  letter-spacing:.2px;
}
#dt-top-ticker.dt-pause-hover:hover .dt-ticker-track{
  animation-play-state:paused;
}
@keyframes dtcomTicker{
  from{transform:translate3d(0,0,0)}
  to{transform:translate3d(-50%,0,0)}
}
`.trim()+"\n";
fs.writeFileSync("top-ticker.css",css,"utf8");

const js=`
(async function(){
  try{
    const res=await fetch('/homepage.json?v='+Date.now(),{cache:'no-store'});
    if(!res.ok) throw new Error('homepage.json '+res.status);
    const cfg=await res.json();
    const t=cfg.top_ticker||{};
    if(t.enabled===false) return;

    const text=String(t.text||'').trim();
    if(!text) return;

    document.getElementById('dt-top-ticker')?.remove();

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

    // Four copies keep the strip continuous even on very wide screens.
    for(let i=0;i<4;i++){
      const copy=document.createElement('span');
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
    root.style.setProperty('--dt-ticker-font',String(t.font_family||'Arial, sans-serif'));
    root.style.setProperty('--dt-ticker-size',(Number(t.font_size)||14)+'px');
    root.style.setProperty('--dt-ticker-weight',String(t.font_weight||'700'));
    root.style.setProperty('--dt-ticker-height',(Number(t.height)||36)+'px');
    root.style.setProperty('--dt-ticker-speed',Math.max(6,Number(t.speed_seconds)||22)+'s');

    // Force animation restart after all variables are applied.
    track.style.animation='none';
    void track.offsetWidth;
    track.style.animation='';
  }catch(err){
    console.warn('DTCOM ticker:',err);
  }
})();
`.trim()+"\n";
fs.writeFileSync("top-ticker.js",js,"utf8");

console.log("Fixed CMS ticker fields and animation.");
