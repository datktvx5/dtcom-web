const fs=require("fs"),path=require("path"),crypto=require("crypto");
const cfg=JSON.parse(fs.readFileSync("config/official-catalog-brands-v2.json","utf8"));
const OUT="imports/official-2025plus-v2", MEDIA="media/official-2025plus-v2", REPORT="reports/official-2025plus-v2";
for(const d of [OUT,MEDIA,REPORT])fs.mkdirSync(d,{recursive:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const norm=s=>String(s||"").toLowerCase().replace(/\s+/g," ").trim();
const strip=s=>String(s||"").replace(/<script[\s\S]*?<\/script>/gi," ").replace(/<style[\s\S]*?<\/style>/gi," ").replace(/<[^>]+>/g," ").replace(/&nbsp;/gi," ").replace(/&amp;/gi,"&").replace(/&quot;/gi,'"').replace(/&#39;/g,"'").replace(/\s+/g," ").trim();
const slug=s=>String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"");
const allowed=(u,ds)=>{try{const h=new URL(u).hostname.toLowerCase();return ds.some(d=>h===d||h.endsWith("."+d))}catch{return false}};

async function get(url,ref=""){
 const r=await fetch(url,{redirect:"follow",headers:{"user-agent":"Mozilla/5.0 (DTCOM official-only crawler)","accept-language":"en-US,en;q=0.9",...(ref?{"referer":ref}:{})}});
 if(!r.ok)throw Error(`${r.status} ${url}`); return {text:await r.text(),url:r.url,headers:r.headers}
}
function xmlLocs(x){return [...x.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi)].map(m=>m[1].replace(/&amp;/g,"&"))}
function xmlLastmods(x){const out=[];for(const m of x.matchAll(/<url>([\s\S]*?)<\/url>/gi)){const b=m[1],u=(b.match(/<loc>\s*([^<]+)\s*<\/loc>/i)||[])[1],lm=(b.match(/<lastmod>\s*([^<]+)\s*<\/lastmod>/i)||[])[1];if(u)out.push({url:u.replace(/&amp;/g,"&"),lastmod:lm||""})}return out}
async function sitemapSeeds(domain,keywords){
 const origins=[`https://www.${domain}`,`https://${domain}`], sm=new Set(), pages=[];
 for(const o of origins){
   try{const r=await get(o+"/robots.txt");for(const m of r.text.matchAll(/^\s*Sitemap:\s*(\S+)/gmi))sm.add(m[1])}catch{}
   sm.add(o+"/sitemap.xml"); sm.add(o+"/sitemap_index.xml");
 }
 const queue=[...sm], seen=new Set();
 while(queue.length && seen.size<30 && pages.length<1000){
   const u=queue.shift(); if(seen.has(u))continue; seen.add(u);
   try{
     const r=await get(u); const locs=xmlLocs(r.text);
     const isIndex=/<sitemapindex/i.test(r.text);
     if(isIndex){
       const ranked=locs.filter(x=>allowed(x,[domain])).sort((a,b)=>{
         const A=keywords.some(k=>a.toLowerCase().includes(k))?1:0,B=keywords.some(k=>b.toLowerCase().includes(k))?1:0;return B-A
       });
       for(const x of ranked.slice(0,12)) if(!seen.has(x))queue.push(x);
     }else{
       for(const e of xmlLastmods(r.text)){
         if(!allowed(e.url,[domain]))continue;
         const l=e.url.toLowerCase();
         if(keywords.some(k=>l.includes(k)))pages.push(e);
       }
     }
   }catch{}
   await sleep(80);
 }
 return pages;
}
async function bingSeeds(domain,keywords){
 const out=[];
 for(const k of keywords.slice(0,4)){
   try{
     const q=`site:${domain} ${k}`;
     const r=await get("https://www.bing.com/search?q="+encodeURIComponent(q)+"&count=50");
     for(const m of r.text.matchAll(/<li class="b_algo"[\s\S]*?<h2[^>]*>\s*<a[^>]+href="([^"]+)"/gi)){
       const u=m[1].replace(/&amp;/g,"&");if(allowed(u,[domain]))out.push({url:u,lastmod:""})
     }
   }catch{}
   await sleep(150)
 }
 return out;
}
function titleOf(h){return strip((h.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)||[])[1]||(h.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)||[])[1]||(h.match(/<title[^>]*>([\s\S]*?)<\/title>/i)||[])[1]||"")}
function specs(h){
 const r=[],add=(k,v)=>{k=strip(k);v=strip(v);if(!k||!v||k.length>120||v.length>500)return;if(/cookie|privacy|menu|share|subscribe|support|contact/i.test(k))return;r.push([k,v])};
 for(const m of h.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)){const c=[...m[1].matchAll(/<(?:th|td)[^>]*>([\s\S]*?)<\/(?:th|td)>/gi)].map(x=>x[1]);if(c.length>=2)add(c[0],c.slice(1).join(" "))}
 for(const m of h.matchAll(/<dt[^>]*>([\s\S]*?)<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/gi))add(m[1],m[2]);
 for(const m of h.matchAll(/"name"\s*:\s*"([^"]{2,100})"\s*,\s*"value"\s*:\s*"([^"]{1,400})"/gi))add(m[1],m[2]);
 const seen=new Set(),o=[];for(const x of r){const k=norm(x[0]);if(seen.has(k))continue;seen.add(k);o.push(x)}return o.slice(0,16)
}
function images(h,page){
 const a=[];const add=u=>{try{u=String(u||"").replace(/&amp;/g,"&").replace(/\\\//g,"/");u=new URL(u,page).href;const l=u.toLowerCase();if(!/\.(png|jpe?g|webp)(\?|$)/i.test(u)||/logo|icon|favicon|avatar|flag|qr|sprite|loading|placeholder|banner/i.test(l))return;a.push(u)}catch{}};
 for(const m of h.matchAll(/<img\b[^>]*>/gi)){for(const x of m[0].matchAll(/\b(?:src|data-src|data-original|data-lazy-src|data-zoom-image)=["']([^"']+)["']/gi))add(x[1]);const ss=(m[0].match(/\bsrcset=["']([^"']+)["']/i)||[])[1];if(ss)for(const p of ss.split(","))add(p.trim().split(/\s+/)[0])}
 for(const m of h.matchAll(/<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image)["'][^>]+content=["']([^"']+)["']/gi))add(m[1]);
 return [...new Set(a)]
}
async function saveImgs(urls,folder,ref){fs.mkdirSync(folder,{recursive:true});const out=[],hashes=new Set();for(const u of urls){if(out.length>=cfg.max_images)break;try{const r=await fetch(u,{redirect:"follow",headers:{"user-agent":"Mozilla/5.0","referer":ref}});if(!r.ok)continue;const ct=r.headers.get("content-type")||"";if(!ct.startsWith("image/"))continue;const b=Buffer.from(await r.arrayBuffer());if(b.length<18000)continue;const h=crypto.createHash("sha1").update(b).digest("hex");if(hashes.has(h))continue;hashes.add(h);const e=ct.includes("png")?".png":ct.includes("webp")?".webp":".jpg";const p=path.join(folder,`image-${out.length+1}${e}`);fs.writeFileSync(p,b);out.push(p.replace(/\\/g,"/"))}catch{}}return out}
function fresh(entry,html){
 if(entry.lastmod && entry.lastmod.slice(0,10)>=cfg.fresh_after)return true;
 const head=(html.match(/<meta[^>]+(?:property|name)=["'](?:article:published_time|datePublished|dateModified|last-modified)["'][^>]+content=["']([^"']+)["']/i)||[])[1]||"";
 if(head && head.slice(0,10)>=cfg.fresh_after)return true;
 const text=strip(html).slice(0,80000);return /\b2025\b|\b2026\b/.test(text)
}
function productLike(title,url,keys){
 const x=(title+" "+url).toLowerCase();return keys.some(k=>x.includes(k))
}
(async()=>{
 const buckets={camera:[],network:[],computer:[],printer:[]},report=[];
 for(const cat of cfg.categories){
  for(const brand of cat.brands){
   console.log(`\n[${cat.key}] ${brand.name}`);
   let seeds=[];
   for(const d of brand.domains){seeds.push(...await sitemapSeeds(d,brand.keywords));seeds.push(...await bingSeeds(d,brand.keywords))}
   const uniq=new Map();for(const e of seeds)if(!uniq.has(e.url)||(e.lastmod&&!uniq.get(e.url).lastmod))uniq.set(e.url,e);
   let accepted=0,checked=0;
   for(const e of uniq.values()){
    if(accepted>=cfg.max_products_per_brand||checked>=80)break;checked++;
    try{
      const r=await get(e.url); if(!allowed(r.url,brand.domains))continue;
      const title=titleOf(r.text); if(!title||!productLike(title,r.url,brand.keywords))continue;
      if(!fresh(e,r.text))continue;
      const sp=specs(r.text); if(sp.length<cfg.min_specs)continue;
      const im=images(r.text,r.url); if(!im.length)continue;
      const id=slug(`${brand.name}-${title}`).slice(0,100);
      const loc=await saveImgs(im,path.join(MEDIA,cat.key,slug(brand.name),id),r.url); if(!loc.length)continue;
      const year=(e.lastmod&&e.lastmod.slice(0,4))||((strip(r.text).match(/\b(2025|2026)\b/)||[])[1])||"2025+";
      const item={id,name:title,brand:brand.name,subcategory:cat.subcategory,product_type:cat.subcategory,images:loc,featured:false,description:["Thông số chính (nguồn: trang chính hãng "+brand.name+"):",...sp.slice(0,10).map(x=>`• ${x[0]}: ${x[1]}`)].join("\n"),official_url:r.url,release_year:year,source_policy:"official-only-2025plus"};
      buckets[cat.target].push(item);accepted++;report.push([cat.key,brand.name,title,year,sp.length,loc.length,r.url,"ACCEPTED"]);console.log(" +",title)
    }catch{}
    await sleep(80)
   }
   if(!accepted)report.push([cat.key,brand.name,"","",0,0,"","NO_VALID_PRODUCT_FOUND"])
  }
 }
 for(const [k,v] of Object.entries(buckets))fs.writeFileSync(path.join(OUT,`products-${k}.json`),JSON.stringify({items:v},null,2)+"\n");
 fs.writeFileSync(path.join(REPORT,"official-2025plus-v2-report.csv"),"category,brand,name,release_year,spec_count,image_count,official_url,status\n"+report.map(r=>r.map(v=>`"${String(v??"").replace(/"/g,'""')}"`).join(",")).join("\n")+"\n");
 console.log("DONE - staging only, live JSON untouched");
})().catch(e=>{console.error(e);process.exit(1)});
