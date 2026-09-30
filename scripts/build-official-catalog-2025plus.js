const fs=require("fs"),path=require("path"),crypto=require("crypto");
const cfg=JSON.parse(fs.readFileSync("config/official-catalog-brands.json","utf8"));
const OUT="imports/official-2025plus", MEDIA="media/official-2025plus", REPORT="reports/official-2025plus";
fs.mkdirSync(OUT,{recursive:true}); fs.mkdirSync(MEDIA,{recursive:true}); fs.mkdirSync(REPORT,{recursive:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const norm=s=>String(s||"").toLowerCase().replace(/\s+/g," ").trim();
const slug=s=>String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"");
const strip=s=>String(s||"").replace(/<script[\s\S]*?<\/script>/gi," ").replace(/<style[\s\S]*?<\/style>/gi," ").replace(/<[^>]+>/g," ").replace(/&nbsp;/gi," ").replace(/&amp;/gi,"&").replace(/&quot;/gi,'"').replace(/&#39;/g,"'").replace(/\s+/g," ").trim();

async function fetchText(url,ref=""){
  const r=await fetch(url,{redirect:"follow",headers:{"user-agent":"Mozilla/5.0 (DTCOM official catalog builder)","accept-language":"en-US,en;q=0.9",...(ref?{"referer":ref}:{})}});
  if(!r.ok)throw Error(`HTTP ${r.status}`);
  return {html:await r.text(),url:r.url};
}
function hostAllowed(url,domains){try{const h=new URL(url).hostname.toLowerCase();return domains.some(d=>h===d||h.endsWith("."+d))}catch{return false}}
function decodeBing(u){try{u=u.replace(/&amp;/g,"&");return u}catch{return null}}
async function searchOfficial(brand,cat){
  const out=[];
  for(const year of cfg.years){
    const q=`${year} ${brand.query} ${brand.domains.map(d=>"site:"+d).join(" OR ")}`;
    const url="https://www.bing.com/search?q="+encodeURIComponent(q)+"&count=30";
    try{
      const {html}=await fetchText(url);
      for(const m of html.matchAll(/<a\s+href="(https?:\/\/[^"]+)"/gi)){
        const u=decodeBing(m[1]); if(!u||!hostAllowed(u,brand.domains))continue;
        if(/support|download|manual|privacy|login|search|newsroom\/?$|contact|where-to-buy/i.test(u))continue;
        out.push(u);
      }
    }catch{}
    await sleep(300);
  }
  return [...new Set(out)].slice(0,30);
}
function titleOf(html){
  const h1=(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)||[])[1];
  const og=(html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)||[])[1];
  const t=(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)||[])[1];
  return strip(h1||og||t||"");
}
function yearOf(html){
  const text=strip(html).slice(0,120000);
  for(const y of cfg.years) if(new RegExp(`\\b${y}\\b`).test(text)) return y;
  return null;
}
function specsFrom(html){
  const rows=[];
  const add=(k,v)=>{k=strip(k);v=strip(v);if(!k||!v||k.length>100||v.length>350)return;if(/cookie|privacy|subscribe|menu|share|sign in/i.test(k))return;rows.push([k,v])};
  for(const m of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)){
    const cells=[...m[1].matchAll(/<(?:th|td)[^>]*>([\s\S]*?)<\/(?:th|td)>/gi)].map(x=>x[1]);
    if(cells.length>=2)add(cells[0],cells.slice(1).join(" "));
  }
  for(const m of html.matchAll(/<dt[^>]*>([\s\S]*?)<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/gi))add(m[1],m[2]);
  for(const m of html.matchAll(/<li[^>]*>\s*<strong[^>]*>([^<:]{2,80})[:：]?\s*<\/strong>\s*([\s\S]{1,300}?)<\/li>/gi))add(m[1],m[2]);
  const seen=new Set(),clean=[];
  for(const [k,v] of rows){const key=norm(k);if(seen.has(key))continue;seen.add(key);clean.push([k,v])}
  return clean.slice(0,14);
}
function imagesFrom(html,page){
  const out=[];const add=u=>{try{u=String(u||"").replace(/&amp;/g,"&").replace(/\\\//g,"/");u=new URL(u,page).href;const l=u.toLowerCase();if(!/^https?:/.test(u)||!/(\.png|\.jpe?g|\.webp)(\?|$)/i.test(u))return;if(/logo|icon|favicon|avatar|flag|qr|sprite|loading|placeholder|banner/i.test(l))return;out.push(u)}catch{}};
  for(const m of html.matchAll(/<img\b[^>]*>/gi)){
    const tag=m[0]; for(const a of tag.matchAll(/\b(?:src|data-src|data-original|data-lazy-src|data-zoom-image)=["']([^"']+)["']/gi))add(a[1]);
    const ss=(tag.match(/\bsrcset=["']([^"']+)["']/i)||[])[1]; if(ss) for(const p of ss.split(","))add(p.trim().split(/\s+/)[0]);
  }
  for(const m of html.matchAll(/<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image)["'][^>]+content=["']([^"']+)["']/gi))add(m[1]);
  return [...new Set(out)];
}
async function saveImages(urls,folder,max){
  fs.mkdirSync(folder,{recursive:true}); const out=[],hashes=new Set();
  for(const u of urls){
    if(out.length>=max)break;
    try{
      const r=await fetch(u,{redirect:"follow",headers:{"user-agent":"Mozilla/5.0"}});
      if(!r.ok)continue; const ct=r.headers.get("content-type")||""; if(!ct.startsWith("image/"))continue;
      const b=Buffer.from(await r.arrayBuffer()); if(b.length<18000)continue;
      const h=crypto.createHash("sha1").update(b).digest("hex"); if(hashes.has(h))continue; hashes.add(h);
      const ext=ct.includes("png")?".png":ct.includes("webp")?".webp":".jpg";
      const p=path.join(folder,`image-${out.length+1}${ext}`); fs.writeFileSync(p,b); out.push(p.replace(/\\/g,"/"));
    }catch{}
  }
  return out;
}
function productLike(title,cat){
  const t=norm(title);
  const keys={
    camera:["camera","vigi","turret","bullet","dome","ptz"],
    network:["access point","switch","router","gateway","wifi","wi-fi","unifi","omada","reyee","aruba"],
    laptop:["laptop","notebook","thinkpad","elitebook","expertbook","travelmate","dell pro"],
    desktop:["desktop","tower","thinkcentre","elitedesk","expertcenter","veriton"],
    printer:["printer","laserjet","ecotank","imageforce","lexmark","mfc","hl-"],
    scanner:["scanner","scanjet","imageformula","scansnap","fi-","ds-"],
    ram:["memory","ddr5","cudimm","udimm"],
    mainboard:["motherboard","mainboard","b850","x870","z890"],
    cpu:["processor","core ultra","ryzen"],
    ssd:["ssd","nvme","9100 pro","wd_black","firecuda"],
    vga:["graphics card","geforce","radeon","rtx 50"],
    psu:["power supply","psu","atx 3.1"]
  };
  return (keys[cat]||[]).some(k=>t.includes(k));
}
function descFrom(specs,brand){
  const lines=["Thông số chính (nguồn: trang chính hãng "+brand+"):"];
  for(const [k,v] of specs.slice(0,10))lines.push(`• ${k}: ${v}`);
  return lines.join("\n");
}
(async()=>{
  const buckets={camera:[],network:[],computer:[],printer:[]}, report=[];
  for(const cat of cfg.categories){
    for(const brand of cat.brands){
      console.log(`\n[${cat.key}] ${brand.name}`);
      const urls=await searchOfficial(brand,cat);
      let accepted=0;
      for(const u of urls){
        if(accepted>=cfg.max_products_per_brand)break;
        try{
          const {html,url}=await fetchText(u);
          if(!hostAllowed(url,brand.domains))continue;
          const title=titleOf(html); if(!productLike(title,cat.key))continue;
          const year=yearOf(html); if(!year)continue;
          const specs=specsFrom(html); if(specs.length<cfg.min_specs)continue;
          const imgs=imagesFrom(html,url); if(!imgs.length)continue;
          const id=slug(`${brand.name}-${title}`).slice(0,96);
          const folder=path.join(MEDIA,cat.key,slug(brand.name),id);
          const local=await saveImages(imgs,folder,cfg.max_images); if(!local.length)continue;
          const item={
            id,name:title,brand:brand.name,subcategory:cat.subcategory,
            product_type:cat.subcategory,images:local,featured:false,
            description:descFrom(specs,brand.name),
            official_url:url,release_year:year,source_policy:"official-only-2025plus"
          };
          buckets[cat.target].push(item); accepted++;
          report.push([cat.key,brand.name,title,year,specs.length,local.length,url,"ACCEPTED"]);
          console.log("  +",title);
        }catch{}
        await sleep(150);
      }
      if(!accepted)report.push([cat.key,brand.name,"","",0,0,"","NO_VALID_PRODUCT_FOUND"]);
    }
  }
  for(const [k,v] of Object.entries(buckets)){
    fs.writeFileSync(path.join(OUT,`products-${k}.json`),JSON.stringify({items:v},null,2)+"\n");
  }
  const csv="category,brand,name,release_year,spec_count,image_count,official_url,status\n"+
    report.map(r=>r.map(v=>`"${String(v??"").replace(/"/g,'""')}"`).join(",")).join("\n")+"\n";
  fs.writeFileSync(path.join(REPORT,"official-2025plus-report.csv"),csv);
  console.log("\nSTAGING BUILD COMPLETE. Live JSON files were NOT modified.");
})().catch(e=>{console.error(e);process.exit(1)});
