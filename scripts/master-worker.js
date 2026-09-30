const fs=require("fs"),path=require("path"),crypto=require("crypto"),cp=require("child_process");
const cfg=JSON.parse(fs.readFileSync("config/master-official-2025plus.json","utf8"));
const groupKey=process.argv[2];
const group=cfg.groups.find(g=>g.key===groupKey);
if(!group)throw new Error("Unknown group "+groupKey);

const OUT=`build/master/${groupKey}`;
const MEDIA=path.join(OUT,"media");
fs.rmSync(OUT,{recursive:true,force:true});fs.mkdirSync(MEDIA,{recursive:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const slug=s=>String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"");
const strip=s=>String(s||"").replace(/<script[\s\S]*?<\/script>/gi," ").replace(/<style[\s\S]*?<\/style>/gi," ").replace(/<[^>]+>/g," ").replace(/&nbsp;/gi," ").replace(/&amp;/gi,"&").replace(/&quot;/gi,'"').replace(/&#39;/g,"'").replace(/\s+/g," ").trim();

function hostAllowed(url,domains){try{const h=new URL(url).hostname.toLowerCase();return domains.some(d=>h===d||h.endsWith("."+d))}catch{return false}}
async function get(url,accept="text/html",ref=""){
 const c=new AbortController(),t=setTimeout(()=>c.abort(),18000);
 try{
  const r=await fetch(url,{redirect:"follow",signal:c.signal,headers:{
   "user-agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
   "accept":accept,"accept-language":"en-US,en;q=0.9",...(ref?{"referer":ref}:{})
  }});
  const b=Buffer.from(await r.arrayBuffer());
  return {ok:r.ok,status:r.status,url:r.url,headers:r.headers,buf:b,text:b.toString("utf8")};
 }finally{clearTimeout(t)}
}
function run(cmd,args){const r=cp.spawnSync(cmd,args,{encoding:"utf8"});return {status:r.status,stdout:r.stdout||"",stderr:r.stderr||""}}

async function bing(domain,q){
 const url="https://www.bing.com/search?q="+encodeURIComponent(`site:${domain} ${q}`)+"&count=30";
 try{
  const r=await get(url);
  const out=[];
  for(const m of r.text.matchAll(/<li class="b_algo"[\s\S]*?<a[^>]+href="(https?:\/\/[^"]+)"/gi)){
   const u=m[1].replace(/&amp;/g,"&");
   if(hostAllowed(u,[domain]))out.push(u);
  }
  // fallback: any official URL in search page
  for(const m of r.text.matchAll(/https?:\/\/[^"' <>&]+/gi)){
   const u=m[0].replace(/&amp;/g,"&");
   if(hostAllowed(u,[domain]))out.push(u);
  }
  return [...new Set(out)].slice(0,20);
 }catch{return[]}
}
function xmlLocs(x){return [...x.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi)].map(m=>m[1].replace(/&amp;/g,"&"))}
async function sitemap(domain,queries){
 const keys=[...new Set(queries.flatMap(q=>q.toLowerCase().split(/\s+/).filter(x=>x.length>=4)))];
 const q=[`https://${domain}/sitemap.xml`,`https://www.${domain}/sitemap.xml`],seen=new Set(),out=[];
 while(q.length&&seen.size<12&&out.length<150){
  const u=q.shift();if(seen.has(u))continue;seen.add(u);
  try{
   const r=await get(u,"application/xml,text/xml,text/plain");
   const locs=xmlLocs(r.text);
   if(/<sitemapindex/i.test(r.text)){
    const ranked=locs.filter(x=>hostAllowed(x,[domain])).sort((a,b)=>{
     const A=keys.some(k=>a.toLowerCase().includes(k))?1:0,B=keys.some(k=>b.toLowerCase().includes(k))?1:0;return B-A
    });
    q.push(...ranked.slice(0,6));
   }else{
    for(const x of locs){
     if(!hostAllowed(x,[domain]))continue;
     const l=x.toLowerCase();
     if(keys.some(k=>l.includes(k)))out.push(x);
     if(out.length>=150)break;
    }
   }
  }catch{}
 }
 return out;
}
function titleOf(h){return strip((h.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)||[])[1]||(h.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)||[])[1]||(h.match(/<title[^>]*>([\s\S]*?)<\/title>/i)||[])[1]||"")}
function dateEvidence(h,url){
 const vals=[];
 for(const re of [
  /<meta[^>]+(?:property|name)=["'](?:article:published_time|datePublished|dateModified|last-modified)["'][^>]+content=["']([^"']+)["']/ig,
  /"(?:datePublished|dateModified)"\s*:\s*"([^"]+)"/ig
 ])for(const m of h.matchAll(re))vals.push(m[1]);
 const text=strip(h).slice(0,90000);
 if(/\b2026\b/.test(text))vals.push("2026");
 if(/\b2025\b/.test(text))vals.push("2025");
 if(/\b2026\b/.test(url))vals.push("2026");
 if(/\b2025\b/.test(url))vals.push("2025");
 return vals.some(v=>/202[56]/.test(v));
}
function specsHtml(h){
 const a=[],add=(k,v)=>{k=strip(k);v=strip(v);if(!k||!v||k.length>130||v.length>650)return;if(/cookie|privacy|menu|share|subscribe|support|contact|download/i.test(k))return;a.push([k,v])};
 for(const m of h.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)){const c=[...m[1].matchAll(/<(?:th|td)[^>]*>([\s\S]*?)<\/(?:th|td)>/gi)].map(x=>x[1]);if(c.length>=2)add(c[0],c.slice(1).join(" "))}
 for(const m of h.matchAll(/<dt[^>]*>([\s\S]*?)<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/gi))add(m[1],m[2]);
 for(const m of h.matchAll(/"name"\s*:\s*"([^"]{2,120})"\s*,\s*"value"\s*:\s*"([^"]{1,500})"/gi))add(m[1],m[2]);
 const seen=new Set(),o=[];for(const x of a){const k=x[0].toLowerCase();if(seen.has(k))continue;seen.add(k);o.push(x)}return o.slice(0,18)
}
function pdfLinks(h,page,domains){
 const out=[];
 for(const m of h.matchAll(/href=["']([^"']+\.pdf(?:\?[^"']*)?)["']/gi)){
  try{const u=new URL(m[1].replace(/&amp;/g,"&"),page).href;if(hostAllowed(u,domains))out.push(u)}catch{}
 }
 return [...new Set(out)];
}
function imagesHtml(h,page,domains){
 const out=[];const add=u=>{try{u=String(u||"").replace(/&amp;/g,"&").replace(/\\\//g,"/");u=new URL(u,page).href;const l=u.toLowerCase();if(!hostAllowed(u,domains))return;if(!/\.(png|jpe?g|webp)(\?|$)/i.test(u))return;if(/logo|icon|favicon|avatar|flag|qr|sprite|loading|placeholder|banner|arrow|close/i.test(l))return;out.push(u)}catch{}};
 for(const m of h.matchAll(/<img\b[^>]*>/gi)){for(const x of m[0].matchAll(/\b(?:src|data-src|data-original|data-lazy-src|data-zoom-image)=["']([^"']+)["']/gi))add(x[1]);const ss=(m[0].match(/\bsrcset=["']([^"']+)["']/i)||[])[1];if(ss)for(const p of ss.split(","))add(p.trim().split(/\s+/)[0])}
 for(const m of h.matchAll(/<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image)["'][^>]+content=["']([^"']+)["']/gi))add(m[1]);
 return [...new Set(out)]
}
function extractPdfSpecs(txt){
 const lines=String(txt||"").split(/\r?\n/).map(x=>x.trim()).filter(Boolean),out=[];
 for(let i=0;i<lines.length;i++){
  const l=lines[i];
  const m=l.match(/^([A-Za-z][A-Za-z0-9 /()+&.,_-]{2,55})\s{2,}(.{2,300})$/);
  if(m)out.push([m[1].trim(),m[2].trim()]);
 }
 const seen=new Set(),clean=[];for(const x of out){const k=x[0].toLowerCase();if(seen.has(k))continue;seen.add(k);clean.push(x)}return clean.slice(0,18)
}
function identify(file){const r=run("identify",["-format","%w %h",file]);const m=r.stdout.trim().match(/^(\d+)\s+(\d+)$/);return m?{w:+m[1],h:+m[2],area:+m[1]*+m[2]}:null}
async function pdfFallback(pdfUrl,folder,domains){
 try{
  const r=await get(pdfUrl,"application/pdf");if(!r.ok)return null;
  const pdf=path.join("/tmp",crypto.createHash("md5").update(pdfUrl).digest("hex")+".pdf");fs.writeFileSync(pdf,r.buf);
  const txt=pdf+".txt";run("pdftotext",["-layout",pdf,txt]);const specs=fs.existsSync(txt)?extractPdfSpecs(fs.readFileSync(txt,"utf8")):[];
  const tmp=pdf+".imgs";fs.mkdirSync(tmp,{recursive:true});run("pdfimages",["-f","1","-l","2","-png",pdf,path.join(tmp,"img")]);
  fs.mkdirSync(folder,{recursive:true});const imgs=[],hashes=new Set();
  for(const f of fs.readdirSync(tmp).filter(x=>x.endsWith(".png"))){
   const src=path.join(tmp,f),inf=identify(src);if(!inf||inf.w<280||inf.h<180||inf.area<70000)continue;
   const h=crypto.createHash("sha1").update(fs.readFileSync(src)).digest("hex");if(hashes.has(h))continue;hashes.add(h);
   const dest=path.join(folder,`image-${imgs.length+1}.png`);fs.copyFileSync(src,dest);imgs.push(dest.replace(/\\/g,"/"));if(imgs.length>=cfg.policy.max_images)break;
  }
  return {specs,images:imgs};
 }catch{return null}
}
async function downloadImages(urls,folder,ref){
 fs.mkdirSync(folder,{recursive:true});const out=[],hashes=new Set();
 for(const u of urls){
  if(out.length>=cfg.policy.max_images)break;
  try{
   const r=await get(u,"image/*",ref);if(!r.ok)continue;const ct=r.headers.get("content-type")||"";if(!ct.startsWith("image/"))continue;if(r.buf.length<18000)continue;
   const h=crypto.createHash("sha1").update(r.buf).digest("hex");if(hashes.has(h))continue;hashes.add(h);
   const ext=ct.includes("png")?".png":ct.includes("webp")?".webp":".jpg",dest=path.join(folder,`image-${out.length+1}${ext}`);fs.writeFileSync(dest,r.buf);out.push(dest.replace(/\\/g,"/"));
  }catch{}
 }
 return out
}
function productLooksRelevant(title,url,queries){const x=(title+" "+url).toLowerCase();const words=[...new Set(queries.flatMap(q=>q.toLowerCase().split(/\s+/).filter(w=>w.length>=4&&!/^202[56]$/.test(w))))];return words.some(w=>x.includes(w))}
function description(brand,specs){return [`Thông số chính (nguồn: trang chính hãng ${brand}):`,...specs.slice(0,12).map(([k,v])=>`• ${k}: ${v}`)].join("\n")}

(async()=>{
 const products=[],report=[];
 for(const brand of group.brands){
  console.log(`\n== ${groupKey} / ${brand.name} ==`);
  const candidates=[];
  for(const domain of brand.domains){
   candidates.push(...await sitemap(domain,brand.queries));
   for(const q of brand.queries)candidates.push(...await bing(domain,q));
  }
  let accepted=0,checked=0;
  for(const url of [...new Set(candidates)]){
   if(accepted>=cfg.policy.max_products_per_brand||checked>=80)break;checked++;
   try{
    const page=await get(url);if(!page.ok||!hostAllowed(page.url,brand.domains))continue;
    const title=titleOf(page.text);if(!title||!productLooksRelevant(title,page.url,brand.queries))continue;
    if(!dateEvidence(page.text,page.url))continue;
    let specs=specsHtml(page.text);
    const id=slug(`${brand.name}-${title}`).slice(0,100);
    const folder=path.join(MEDIA,slug(brand.name),id);
    let images=await downloadImages(imagesHtml(page.text,page.url,brand.domains),folder,page.url);
    const pdfs=pdfLinks(page.text,page.url,brand.domains);
    if((specs.length<cfg.policy.min_specs||images.length===0)&&pdfs.length){
      for(const pdf of pdfs.slice(0,3)){
       const fb=await pdfFallback(pdf,folder,brand.domains);
       if(!fb)continue;
       if(fb.specs.length>specs.length)specs=fb.specs;
       if(!images.length&&fb.images.length)images=fb.images;
       if(specs.length>=cfg.policy.min_specs&&images.length)break;
      }
    }
    if(images.length===0){report.push([brand.name,title,"DROPPED_NO_IMAGE",specs.length,0,page.url]);continue}
    if(specs.length<cfg.policy.min_specs){report.push([brand.name,title,"DROPPED_SPECS",specs.length,images.length,page.url]);continue}
    products.push({
      id,name:title,brand:brand.name,subcategory:group.subcategory,product_type:group.subcategory,
      images,featured:false,description:description(brand.name,specs),
      official_url:page.url,release_year:"2025+",source_policy:"official-only-2025plus-master",
      auto_import_group:groupKey
    });
    report.push([brand.name,title,"ACCEPTED",specs.length,images.length,page.url]);accepted++;
    console.log(`+ ${title} (${images.length} images, ${specs.length} specs)`);
   }catch{}
   await sleep(80);
  }
  if(!accepted)report.push([brand.name,"","NO_VALID_PRODUCT_FOUND",0,0,""]);
 }
 fs.writeFileSync(path.join(OUT,"products.json"),JSON.stringify({group:groupKey,target:group.target,items:products},null,2)+"\n");
 fs.writeFileSync(path.join(OUT,"report.csv"),"brand,name,status,spec_count,image_count,official_url\n"+report.map(r=>r.map(v=>`"${String(v??"").replace(/"/g,'""')}"`).join(",")).join("\n")+"\n");
 console.log(`\n${groupKey}: ${products.length} accepted`);
})().catch(e=>{console.error(e);process.exit(1)});
