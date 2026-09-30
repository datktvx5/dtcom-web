const fs=require("fs"), path=require("path"), crypto=require("crypto");

const FILE="products-network.json";
const MEDIA_ROOT=path.join("media","reyee");
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

const slug=s=>String(s||"").toLowerCase()
  .replace(/[()]/g,"")
  .replace(/[^a-z0-9]+/g,"-")
  .replace(/^-+|-+$/g,"");

const norm=s=>String(s||"").toLowerCase().replace(/[^a-z0-9]/g,"");
const same=(a,b)=>norm(a).includes(norm(b));

function getItems(raw){
  return Array.isArray(raw)?{items:raw,wrapped:false}:{items:Array.isArray(raw?.items)?raw.items:[],wrapped:true};
}

function modelFromName(name){
  const s=String(name||"").replace(/^Reyee\s+/i,"").trim();
  const m=s.match(/^(RG-[A-Z0-9]+(?:-[A-Z0-9]+)*(?:\([A-Z0-9]+\))?(?:-[A-Z0-9]+)*)/i);
  return m?m[1]:s.split(/\s+-\s+/)[0].trim();
}

function isTarget(p){
  return /^Reyee\s+/i.test(String(p.name||"")) &&
    ["Router","Access Point","Switch"].includes(String(p.subcategory||""));
}

async function fetchText(url,referer=""){
  const r=await fetch(url,{
    redirect:"follow",
    headers:{
      "user-agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
      "accept-language":"en-US,en;q=0.9",
      ...(referer?{"referer":referer}:{})
    }
  });
  if(!r.ok) throw new Error(`HTTP ${r.status}`);
  return {text:await r.text(),url:r.url,headers:r.headers};
}

function abs(u,b){
  try{
    u=String(u||"").replace(/&amp;/g,"&").replace(/\\\//g,"/");
    if(u.startsWith("//"))u="https:"+u;
    return new URL(u,b).href;
  }catch{return null}
}

function officialPages(p,model){
  const m=slug(model), key=m.replace(/^rg-/,"");
  const b="https://reyee.ruijie.com/en-global";
  const out=[
    `${b}/resources/preview/${m}/`,
    `${b}/resources/preview/${key}/`
  ];
  const sub=String(p.subcategory||"");
  const type=String(p.product_type||"").toLowerCase();

  if(sub==="Access Point"){
    if(type.includes("wall")) out.push(`${b}/products/reyee-wireless/reyee-wall-ap/${key}/`);
    if(type.includes("outdoor")) out.push(`${b}/products/reyee-wireless/reyee-outdoor-ap/${key}/`);
    if(type.includes("ceiling")) out.push(`${b}/products/reyee-wireless/reyee-indoor-ap/${key}/`);
    if(type.includes("optical")) out.push(`${b}/products/e-lighten/e-lighten-access-point/${key}/`);
    out.push(`${b}/products/reyee-wireless/reyee-wall-ap/${key}/`);
    out.push(`${b}/products/reyee-wireless/reyee-indoor-ap/${key}/`);
    out.push(`${b}/products/reyee-wireless/reyee-outdoor-ap/${key}/`);
  }
  if(sub==="Switch"){
    out.push(`${b}/products/reyee-switch/l3-managed-switch/${key}/`);
    out.push(`${b}/products/reyee-switch/l2-managed-switch/${key}/`);
    out.push(`${b}/products/reyee-switch/unmanaged-switch/${key}/`);
    out.push(`${b}/products/reyee-switch/industrial-switch/${key}/`);
    out.push(`${b}/products/reyee-switch/smart-cctv-switch/${key}/`);
    out.push(`${b}/products/e-lighten/e-lighten-core-switch/${key}/`);
    out.push(`${b}/products/e-lighten/e-lighten-access-switch/${key}/`);
  }
  if(sub==="Router"){
    out.push(`${b}/products/reyee-router/eg-series/${key}/`);
    out.push(`${b}/products/reyee-router/cloud-managed-router/${key}/`);
  }
  return [...new Set(out)];
}

async function bingPages(model){
  const url="https://www.bing.com/search?q="+encodeURIComponent(`site:reyee.ruijie.com "${model}"`);
  try{
    const {text}=await fetchText(url);
    const links=[];
    for(const m of text.matchAll(/<a\s+href="(https?:\/\/[^"]+)"/gi)){
      const u=m[1].replace(/&amp;/g,"&");
      if(/reyee\.ruijie\.com/i.test(u)) links.push(u);
    }
    return [...new Set(links)].slice(0,8);
  }catch{return[]}
}

async function findOfficialPage(p,model){
  const candidates=[...officialPages(p,model),...(await bingPages(model))];
  for(const u of candidates){
    try{
      const r=await fetchText(u);
      if(same(r.text,model)||same(r.url,model)) return r;
    }catch{}
    await sleep(180);
  }
  return null;
}

// ---------- IMAGE EXTRACTION ----------
function imageCandidates(html,page,model){
  const out=[];
  const add=(u,score=0)=>{
    u=abs(u,page);
    if(!u||!/^https?:\/\//i.test(u)) return;
    if(!/\.(?:png|jpe?g|webp)(?:[?#]|$)/i.test(u)) return;
    const low=u.toLowerCase();
    if(/logo|icon|avatar|flag|qr|banner|sprite|loading|placeholder|certificate/i.test(low))score-=160;
    if(same(low,model))score+=100;
    if(/product|upload|media|image|gallery|goods|detail/i.test(low))score+=15;
    out.push({image:u,score});
  };

  for(const z of html.matchAll(/<img\b[^>]*>/gi)){
    const tag=z[0];
    const alt=((tag.match(/\b(?:alt|title)=["']([^"']*)["']/i)||[])[1]||"");
    let score=same(alt,model)?160:0;
    for(const a of tag.matchAll(/\b(?:src|data-src|data-original|data-lazy-src|data-zoom-image)=["']([^"']+)["']/gi)) add(a[1],score);
    const srcset=((tag.match(/\bsrcset=["']([^"']+)["']/i)||[])[1]||"");
    for(const part of srcset.split(",")){
      const u=part.trim().split(/\s+/)[0];
      if(u)add(u,score+5);
    }
  }
  for(const z of html.matchAll(/<meta\b[^>]+(?:property|name)=["'](?:og:image|twitter:image)["'][^>]+content=["']([^"']+)["']/gi)) add(z[1],80);

  const mp=new Map();
  for(const x of out) if(!mp.has(x.image)||mp.get(x.image).score<x.score)mp.set(x.image,x);
  return [...mp.values()].sort((a,b)=>b.score-a.score);
}

function extFrom(type,u){
  type=String(type||"").toLowerCase();
  if(type.includes("png"))return".png";
  if(type.includes("webp"))return".webp";
  if(type.includes("jpeg")||type.includes("jpg"))return".jpg";
  const m=String(u).match(/\.(png|webp|jpe?g)(?:[?#]|$)/i);
  return m?"."+m[1].toLowerCase().replace("jpeg","jpg"):".jpg";
}

async function downloadGallery(cands,folder,page,maxImages=5){
  fs.mkdirSync(folder,{recursive:true});
  const existing=fs.readdirSync(folder)
    .filter(f=>/^image-\d+\.(png|jpe?g|webp)$/i.test(f)||/^main\.(png|jpe?g|webp)$/i.test(f))
    .map(f=>path.join(folder,f).replace(/\\/g,"/"));

  const hashes=new Set();
  for(const f of existing){
    try{hashes.add(crypto.createHash("sha1").update(fs.readFileSync(f)).digest("hex"))}catch{}
  }

  const downloaded=[];
  for(const c of cands){
    if(existing.length+downloaded.length>=maxImages) break;
    try{
      const r=await fetch(c.image,{
        redirect:"follow",
        headers:{"user-agent":"Mozilla/5.0","referer":page}
      });
      if(!r.ok)continue;
      const ct=r.headers.get("content-type")||"";
      if(!ct.startsWith("image/"))continue;
      const buf=Buffer.from(await r.arrayBuffer());
      if(buf.length<15000)continue;
      const h=crypto.createHash("sha1").update(buf).digest("hex");
      if(hashes.has(h))continue;
      hashes.add(h);
      const ext=extFrom(ct,c.image);
      const idx=existing.length+downloaded.length+1;
      const dest=path.join(folder,`image-${idx}${ext}`);
      fs.writeFileSync(dest,buf);
      downloaded.push(dest.replace(/\\/g,"/"));
    }catch{}
  }
  return [...existing,...downloaded].slice(0,maxImages);
}

// ---------- SPEC EXTRACTION ----------
function decodeEntities(s){
  return String(s||"")
    .replace(/&nbsp;/gi," ")
    .replace(/&amp;/gi,"&")
    .replace(/&quot;/gi,'"')
    .replace(/&#39;/gi,"'")
    .replace(/&lt;/gi,"<")
    .replace(/&gt;/gi,">")
    .replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(Number(n)));
}

function htmlLines(html){
  let s=html
    .replace(/<script[\s\S]*?<\/script>/gi," ")
    .replace(/<style[\s\S]*?<\/style>/gi," ")
    .replace(/<(?:br|\/p|\/div|\/li|\/tr|\/td|\/th|\/h[1-6]|\/dt|\/dd)>/gi,"\n")
    .replace(/<[^>]+>/g," ");
  s=decodeEntities(s);
  return s.split(/\n+/)
    .map(x=>x.replace(/\s+/g," ").trim())
    .filter(x=>x.length>0 && x.length<500);
}

const LABELS={
  "Access Point":[
    "Product Type","Wi-Fi Radio","Radio design","Maximum wireless data rate",
    "5 GHz wireless data rate","2.4 GHz wireless data rate","6 GHz wireless data rate",
    "Antenna","Product dimensions (W x D x H)","Weight",
    "Number of 10/100/1000BASE-T ports","Number of 10/100/1000/2500BASE-T ports",
    "Power supply","Maximum power consumption","Operating temperature","IP rating",
    "Maximum number of associated wireless clients"
  ],
  "Switch":[
    "Product Category","Warranty","Total number of RJ45 ports","Total number of optical ports",
    "Number of 1GE SFP ports","Number of 10GE SFP+ ports",
    "Number of 10/100/1000BASE-T ports","Number of 10/100/1000/2500BASE-T ports",
    "PoE/PoE+ ports","PoE budget","Forwarding rate","Switching capacity",
    "Product dimensions (W x D x H)","Weight","Operating temperature"
  ],
  "Router":[
    "Number of 10/100/1000BASE-T ports","Number of 10/100/1000/2500BASE-T ports",
    "Number of 10GE SFP+ ports","Number of fixed LAN ports","Number of fixed WAN ports",
    "CPU","Flash memory","RAM","Product dimensions (W x D x H)","Weight",
    "Operating temperature","Recommended number of concurrent clients","Throughput"
  ]
};

function extractTitle(html){
  const h=(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)||[])[1]||
          (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)||[])[1]||"";
  return decodeEntities(h.replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim());
}

function extractSpecs(html,subcategory){
  const lines=htmlLines(html);
  const labels=LABELS[subcategory]||[];
  const specs=[];
  const seen=new Set();

  for(const label of labels){
    const idx=lines.findIndex(x=>x.toLowerCase()===label.toLowerCase());
    if(idx<0)continue;

    let values=[];
    for(let j=idx+1;j<Math.min(lines.length,idx+7);j++){
      const v=lines[j];
      if(labels.some(l=>l.toLowerCase()===v.toLowerCase()))break;
      if(/^(Features|Resources|Videos|FAQ|Order Information|Hardware Specifications|Software Specifications|System Specifications|Port Specifications|Dimensions and Weight|Environment and Reliability)$/i.test(v))break;
      if(v.length>2)values.push(v);
      if(values.join(" ").length>180)break;
    }
    let value=values.join(" ").trim();
    if(!value)continue;
    const key=label.toLowerCase();
    if(seen.has(key))continue;
    seen.add(key);
    specs.push([label,value]);
  }
  return specs.slice(0,10);
}

const oldGeneric=[
  /^Hỗ trợ quản lý tập trung qua/i,
  /^Hỗ trợ quản lý Cloud/i,
  /^Hỗ trợ nhiều WAN/i,
  /^Tích hợp các chức năng gateway/i,
  /^Hỗ trợ các tính năng quản lý mạng/i,
  /^Hỗ trợ cấp nguồn PoE/i,
  /^Các model quản lý hỗ trợ/i,
  /^Phù hợp hệ thống/i,
  /^Phù hợp triển khai/i,
  /^Thiết kế cho hệ thống/i,
  /^Thiết kế gắn tường/i,
  /^Thiết kế gắn trần/i,
  /^Thiết kế ngoài trời/i,
  /^Hỗ trợ roaming/i,
  /^Hỗ trợ SON/i,
  /^Nguồn thông số:/i
];

function cleanOldDescription(desc){
  return String(desc||"").split(/\r?\n/)
    .map(x=>x.trim())
    .filter(Boolean)
    .filter(line=>!oldGeneric.some(r=>r.test(line)))
    .filter(line=>!/^Nguồn:/i.test(line))
    .slice(0,3)
    .join("\n");
}

function vnLabel(label){
  const map={
    "Product Type":"Loại sản phẩm",
    "Product Category":"Phân lớp",
    "Radio design":"Thiết kế radio",
    "Maximum wireless data rate":"Tốc độ Wi-Fi tối đa",
    "5 GHz wireless data rate":"Tốc độ 5 GHz",
    "2.4 GHz wireless data rate":"Tốc độ 2.4 GHz",
    "6 GHz wireless data rate":"Tốc độ 6 GHz",
    "Antenna":"Ăng-ten",
    "Product dimensions (W x D x H)":"Kích thước",
    "Weight":"Khối lượng",
    "Number of 10/100/1000BASE-T ports":"Cổng Gigabit RJ45",
    "Number of 10/100/1000/2500BASE-T ports":"Cổng 2.5G RJ45",
    "Number of 10GE SFP+ ports":"Cổng 10G SFP+",
    "Number of fixed LAN ports":"Cổng LAN cố định",
    "Number of fixed WAN ports":"Cổng WAN cố định",
    "Power supply":"Nguồn cấp",
    "Maximum power consumption":"Công suất tiêu thụ tối đa",
    "Operating temperature":"Nhiệt độ hoạt động",
    "IP rating":"Chuẩn bảo vệ",
    "Maximum number of associated wireless clients":"Số client tối đa",
    "Recommended number of concurrent clients":"Số client khuyến nghị",
    "Throughput":"Thông lượng",
    "CPU":"CPU","Flash memory":"Flash","RAM":"RAM",
    "Warranty":"Bảo hành",
    "Total number of RJ45 ports":"Tổng cổng RJ45",
    "Total number of optical ports":"Tổng cổng quang",
    "Number of 1GE SFP ports":"Cổng 1G SFP",
    "PoE/PoE+ ports":"Cổng PoE/PoE+",
    "PoE budget":"Ngân sách PoE",
    "Forwarding rate":"Tốc độ chuyển tiếp",
    "Switching capacity":"Khả năng chuyển mạch"
  };
  return map[label]||label;
}

function buildDescription(p,title,specs){
  const intro=cleanOldDescription(p.description);
  const lines=[];
  if(intro)lines.push(intro);
  if(specs.length){
    lines.push("");
    lines.push("Thông số chính:");
    for(const [k,v] of specs) lines.push(`• ${vnLabel(k)}: ${v}`);
  }
  return lines.join("\n").trim();
}

(async()=>{
  if(!fs.existsSync(FILE))throw new Error(`Missing ${FILE}`);
  const raw=JSON.parse(fs.readFileSync(FILE,"utf8")), info=getItems(raw);
  const targets=info.items.filter(isTarget);

  console.log(`Reyee products to enrich: ${targets.length}`);
  const report=[];
  let specsOK=0, imageAdded=0, noOfficial=0;

  for(let i=0;i<targets.length;i++){
    const p=targets[i], model=modelFromName(p.name);
    process.stdout.write(`[${i+1}/${targets.length}] ${model} ... `);

    const official=await findOfficialPage(p,model);
    if(!official){
      // Always remove source/internal boilerplate even when official page is unavailable.
      p.description=cleanOldDescription(p.description);
      report.push([model,"NO_OFFICIAL_PAGE",0,0,""]);
      noOfficial++; console.log("NO OFFICIAL");
      continue;
    }

    // Exact specs from official Reyee page only.
    const specs=extractSpecs(official.text,p.subcategory);
    if(specs.length){
      p.description=buildDescription(p,extractTitle(official.text),specs);
      specsOK++;
    }else{
      p.description=cleanOldDescription(p.description);
    }

    // Download up to 5 unique official images.
    const folder=path.join(MEDIA_ROOT,slug(model));
    const before=Array.isArray(p.images)?p.images.filter(x=>!/^https?:/i.test(String(x))).length:0;
    const gallery=await downloadGallery(imageCandidates(official.text,official.url,model),folder,official.url,5);

    // Preserve manual local images outside media/reyee, then add local Reyee gallery.
    const manual=(Array.isArray(p.images)?p.images:[])
      .filter(Boolean)
      .filter(x=>!/^https?:/i.test(String(x)))
      .filter(x=>!String(x).replace(/\\/g,"/").startsWith("media/reyee/"));

    p.images=[...new Set([...manual,...gallery])].slice(0,8);
    if(p.images.length>before)imageAdded++;

    report.push([model,"UPDATED",specs.length,p.images.length,official.url]);
    console.log(`${specs.length} specs, ${p.images.length} images`);
    await sleep(250);
  }

  const output=info.wrapped?{...raw,items:info.items}:info.items;
  fs.writeFileSync(FILE,JSON.stringify(output,null,2)+"\n","utf8");

  fs.mkdirSync("reports",{recursive:true});
  const csv="model,status,spec_count,image_count,official_source\n"+
    report.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n")+"\n";
  fs.writeFileSync("reports/reyee-images-specs-v4.csv",csv,"utf8");

  console.log(`Done. Specs updated: ${specsOK}; products with image additions: ${imageAdded}; no official page: ${noOfficial}`);
})().catch(e=>{console.error(e);process.exit(1)});
