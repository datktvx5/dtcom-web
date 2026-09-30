const fs=require("fs"),path=require("path");
const cfg=JSON.parse(fs.readFileSync("config/official-catalog-brands-v2.json","utf8"));
const group=process.argv[2];
const groups={camera:["camera"],network:["network"],computers:["laptop","desktop","ram","mainboard","cpu","ssd","vga","psu"],office:["printer","scanner"]};
if(!groups[group]) throw Error("Unknown group "+group);
const OUT=`imports/official-2025plus-v3/${group}`,REPORT=`reports/official-2025plus-v3/${group}`;
fs.mkdirSync(OUT,{recursive:true});fs.mkdirSync(REPORT,{recursive:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const strip=s=>String(s||"").replace(/<script[\\s\\S]*?<\\/script>/gi," ").replace(/<style[\\s\\S]*?<\\/style>/gi," ").replace(/<[^>]+>/g," ").replace(/&nbsp;/gi," ").replace(/&amp;/gi,"&").replace(/\\s+/g," ").trim();
const allowed=(u,ds)=>{try{const h=new URL(u).hostname.toLowerCase();return ds.some(d=>h===d||h.endsWith("."+d))}catch{return false}};
async function get(url){
 const c=new AbortController(),t=setTimeout(()=>c.abort(),10000);
 try{const r=await fetch(url,{redirect:"follow",signal:c.signal,headers:{"user-agent":"Mozilla/5.0"}});if(!r.ok)throw Error(r.status);return {text:await r.text(),url:r.url}}finally{clearTimeout(t)}
}
function xmlLocs(x){return [...x.matchAll(/<loc>\\s*([^<]+)\\s*<\\/loc>/gi)].map(m=>m[1].replace(/&amp;/g,"&"))}
async function seeds(domain,keys){
 const out=[],seen=new Set(),q=[`https://${domain}/sitemap.xml`,`https://www.${domain}/sitemap.xml`];
 while(q.length&&seen.size<8&&out.length<120){
  const u=q.shift();if(seen.has(u))continue;seen.add(u);
  try{const r=await get(u),locs=xmlLocs(r.text);
   if(/<sitemapindex/i.test(r.text)){for(const x of locs.filter(x=>allowed(x,[domain])).slice(0,4))q.push(x)}
   else for(const x of locs){const l=x.toLowerCase();if(allowed(x,[domain])&&keys.some(k=>l.includes(k)))out.push(x);if(out.length>=120)break}
  }catch{}
 }
 return out
}
function title(h){return strip((h.match(/<h1[^>]*>([\\s\\S]*?)<\\/h1>/i)||[])[1]||(h.match(/<title[^>]*>([\\s\\S]*?)<\\/title>/i)||[])[1]||"")}
function specs(h){
 const a=[];for(const m of h.matchAll(/<tr[^>]*>([\\s\\S]*?)<\\/tr>/gi)){const c=[...m[1].matchAll(/<(?:th|td)[^>]*>([\\s\\S]*?)<\\/(?:th|td)>/gi)].map(x=>strip(x[1]));if(c.length>=2&&c[0]&&c[1])a.push([c[0],c.slice(1).join(" ")])}
 return a.slice(0,12)
}
function fresh(h){return /\\b2025\\b|\\b2026\\b/.test(strip(h).slice(0,50000))}
(async()=>{
 const cats=cfg.categories.filter(c=>groups[group].includes(c.key)),report=[],buckets={camera:[],network:[],computer:[],printer:[]};
 for(const cat of cats)for(const brand of cat.brands){
  console.log(`[${group}/${cat.key}] ${brand.name}`);
  let urls=[];for(const d of brand.domains)urls.push(...await seeds(d,brand.keywords));
  let ok=0,checked=0;
  for(const u of [...new Set(urls)]){
   if(ok>=cfg.max_products_per_brand||checked>=20)break;checked++;
   try{
    const r=await get(u);if(!allowed(r.url,brand.domains))continue;
    const t=title(r.text);if(!t||!brand.keywords.some(k=>(t+" "+r.url).toLowerCase().includes(k)))continue;
    if(!fresh(r.text))continue;
    const sp=specs(r.text);if(sp.length<cfg.min_specs)continue;
    buckets[cat.target].push({name:t,brand:brand.name,subcategory:cat.subcategory,product_type:cat.subcategory,images:[],featured:false,description:["Thông số chính (nguồn: trang chính hãng "+brand.name+"):",...sp.slice(0,10).map(x=>`• ${x[0]}: ${x[1]}`)].join("\\n"),official_url:r.url,release_year:"2025+",source_policy:"official-only-2025plus"});
    report.push([cat.key,brand.name,t,sp.length,r.url,"ACCEPTED"]);ok++;
   }catch{}
   await sleep(50)
  }
  if(!ok)report.push([cat.key,brand.name,"",0,"","NO_VALID_PRODUCT_FOUND"])
 }
 for(const [k,v] of Object.entries(buckets))if(v.length)fs.writeFileSync(path.join(OUT,`products-${k}.json`),JSON.stringify({items:v},null,2));
 fs.writeFileSync(path.join(REPORT,`${group}-report.csv`),"category,brand,name,spec_count,official_url,status\\n"+report.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(",")).join("\\n"));
})().catch(e=>{console.error(e);process.exit(1)});
