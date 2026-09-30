const fs=require("fs"),path=require("path"),crypto=require("crypto");
const cfg=JSON.parse(fs.readFileSync("config/hikvision-2025-strict.json","utf8"));
const OUT="imports/official-2025plus-v4/hikvision";
const MEDIA="media/official-2025plus-v4/camera/hikvision";
const REPORT="reports/official-2025plus-v4/hikvision";
for(const d of [OUT,MEDIA,REPORT])fs.mkdirSync(d,{recursive:true});

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const strip=s=>String(s||"").replace(/<script[\s\S]*?<\/script>/gi," ").replace(/<style[\s\S]*?<\/style>/gi," ").replace(/<[^>]+>/g," ").replace(/&nbsp;/gi," ").replace(/&amp;/gi,"&").replace(/&quot;/gi,'"').replace(/&#39;/g,"'").replace(/\s+/g," ").trim();
const slug=s=>String(s||"").toLowerCase().replace(/[()\/]/g,"-").replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"");

async function get(url){
 const c=new AbortController(),t=setTimeout(()=>c.abort(),15000);
 try{
  const r=await fetch(url,{redirect:"follow",signal:c.signal,headers:{"user-agent":"Mozilla/5.0","accept-language":"en-US,en;q=0.9"}});
  if(!r.ok)throw Error(`${r.status} ${url}`);
  return {text:await r.text(),url:r.url}
 }finally{clearTimeout(t)}
}
function titleOf(h){return strip((h.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)||[])[1]||(h.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)||[])[1]||(h.match(/<title[^>]*>([\s\S]*?)<\/title>/i)||[])[1]||"")}
function specs(h){
 const a=[],add=(k,v)=>{k=strip(k);v=strip(v);if(!k||!v||k.length>100||v.length>500)return;if(/cookie|privacy|menu|share|support|download/i.test(k))return;a.push([k,v])};
 for(const m of h.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)){const c=[...m[1].matchAll(/<(?:th|td)[^>]*>([\s\S]*?)<\/(?:th|td)>/gi)].map(x=>x[1]);if(c.length>=2)add(c[0],c.slice(1).join(" "))}
 for(const m of h.matchAll(/<dt[^>]*>([\s\S]*?)<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/gi))add(m[1],m[2]);
 const seen=new Set(),o=[];for(const x of a){const k=x[0].toLowerCase();if(seen.has(k))continue;seen.add(k);o.push(x)}return o.slice(0,18)
}
function imgs(h,page){
 const o=[],add=u=>{try{u=String(u||"").replace(/&amp;/g,"&").replace(/\\\//g,"/");u=new URL(u,page).href;const l=u.toLowerCase();if(!/\.(png|jpe?g|webp)(\?|$)/i.test(u))return;if(/logo|icon|favicon|avatar|flag|qr|sprite|loading|placeholder|banner/i.test(l))return;o.push(u)}catch{}};
 for(const m of h.matchAll(/<img\b[^>]*>/gi)){for(const x of m[0].matchAll(/\b(?:src|data-src|data-original|data-lazy-src|data-zoom-image)=["']([^"']+)["']/gi))add(x[1]);const ss=(m[0].match(/\bsrcset=["']([^"']+)["']/i)||[])[1];if(ss)for(const p of ss.split(","))add(p.trim().split(/\s+/)[0])}
 for(const m of h.matchAll(/<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image)["'][^>]+content=["']([^"']+)["']/gi))add(m[1]);
 return [...new Set(o)]
}
async function saveImages(urls,folder,ref){
 fs.mkdirSync(folder,{recursive:true});const out=[],hashes=new Set();
 for(const u of urls){
  if(out.length>=5)break;
  try{
   const r=await fetch(u,{redirect:"follow",headers:{"user-agent":"Mozilla/5.0","referer":ref}});
   if(!r.ok)continue;const ct=r.headers.get("content-type")||"";if(!ct.startsWith("image/"))continue;
   const b=Buffer.from(await r.arrayBuffer());if(b.length<20000)continue;
   const h=crypto.createHash("sha1").update(b).digest("hex");if(hashes.has(h))continue;hashes.add(h);
   const ext=ct.includes("png")?".png":ct.includes("webp")?".webp":".jpg";
   const p=path.join(folder,`image-${out.length+1}${ext}`);fs.writeFileSync(p,b);out.push(p.replace(/\\/g,"/"))
  }catch{}
 }
 return out
}
function desc(title,sp){
 const lines=[title,"","Thông số chính:"];
 for(const [k,v] of sp.slice(0,12))lines.push(`• ${k}: ${v}`);
 return lines.join("\n")
}

(async()=>{
 const items=[],report=[];
 for(const p of cfg.products){
  process.stdout.write(`${p.model} ... `);
  try{
   const r=await get(p.official_url);
   const t=titleOf(r.text);
   const sp=specs(r.text);
   const im=await saveImages(imgs(r.text,r.url),path.join(MEDIA,slug(p.model)),r.url);

   // Strict rule requested by user: no official image => drop product.
   if(!im.length){
    report.push([p.model,"DROPPED_NO_IMAGE",0,sp.length,r.url,p.official_datasheet]);
    console.log("DROP (no image)");
    continue;
   }
   if(sp.length<3){
    report.push([p.model,"DROPPED_INSUFFICIENT_SPECS",im.length,sp.length,r.url,p.official_datasheet]);
    console.log("DROP (insufficient specs)");
    continue;
   }

   items.push({
    id:"hikvision-"+slug(p.model),
    name:`Hikvision ${p.model} - ${t.replace(p.model,"").replace(/^-+/,"").trim()}`,
    brand:"Hikvision",
    subcategory:"Camera",
    product_type:p.product_type,
    images:im,
    featured:false,
    description:desc(t,sp),
    official_url:r.url,
    official_datasheet:p.official_datasheet,
    release_year:p.release_year,
    source_policy:"official-only"
   });
   report.push([p.model,"ACCEPTED",im.length,sp.length,r.url,p.official_datasheet]);
   console.log(`OK (${im.length} images, ${sp.length} specs)`);
  }catch(e){
   report.push([p.model,"ERROR",0,0,p.official_url,p.official_datasheet]);
   console.log("ERROR");
  }
  await sleep(250)
 }
 fs.writeFileSync(path.join(OUT,"products-camera-hikvision.json"),JSON.stringify({items},null,2)+"\n");
 const csv="model,status,image_count,spec_count,official_url,official_datasheet\n"+report.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n")+"\n";
 fs.writeFileSync(path.join(REPORT,"hikvision-report.csv"),csv);
 console.log(`Accepted ${items.length}/${cfg.products.length}`);
})().catch(e=>{console.error(e);process.exit(1)});
