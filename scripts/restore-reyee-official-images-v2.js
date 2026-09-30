const fs=require("fs");
const path=require("path");
const crypto=require("crypto");

const FILE="products-network.json";
const ROOT="media/reyee-clean";
const REPORT="reports/reyee-image-restore-official-v2.csv";
const MAX_IMAGES=5;

const EXACT={
  "RG-RAP1260":"https://reyee.ruijie.com/en-global/products/reyee-wireless/reyee-wall-ap/rap1260/",
  "RG-RAP2266":"https://reyee.ruijie.com/en-global/products/reyee-wireless/reyee-indoor-ap/rap2266/",
  "RG-RAP73HD":"https://reyee.ruijie.com/en-global/products/reyee-wireless/reyee-indoor-ap/rap73hd/",
  "RG-RAP6260(G)":"https://reyee.ruijie.com/en-global/products/reyee-wireless/reyee-outdoor-ap/rap6260g/",
  "RG-RAP6260(H)":"https://reyee.ruijie.com/en-global/products/reyee-wireless/reyee-outdoor-ap/rap6260h/",
  "RG-RAP6260(H)-D":"https://reyee.ruijie.com/en-global/products/reyee-wireless/reyee-outdoor-ap/rap6260h-d/",
  "RG-NBS7003":"https://reyee.ruijie.com/en-global/products/reyee-switch/l3-managed-switch/nbs7003/",
  "RG-NBS6002":"https://reyee.ruijie.com/en-global/products/reyee-switch/l3-managed-switch/nbs6002/",
  "RG-ES209GC-P":"https://reyee.ruijie.com/en-global/products/reyee-switch/smart-cctv-switch/es209gc-p/",
  "RG-EG1510XS":"https://reyee.ruijie.com/en-global/products/reyee-router/eg-series/eg1510xs/"
};

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const norm=s=>String(s||"").toLowerCase().replace(/[^a-z0-9]/g,"");
const slug=s=>String(s||"").toLowerCase().replace(/[()]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"");

function items(raw){return Array.isArray(raw)?{a:raw,w:false}:{a:Array.isArray(raw?.items)?raw.items:[],w:true}}
function model(name){return String(name||"").replace(/^Reyee\s+/i,"").trim()}
function abs(u,b){try{u=String(u||"").replace(/&amp;/g,"&").replace(/\\\//g,"/");if(u.startsWith("//"))u="https:"+u;return new URL(u,b).href}catch{return null}}

async function get(url){
  const c=new AbortController(),t=setTimeout(()=>c.abort(),18000);
  try{
    const r=await fetch(url,{redirect:"follow",signal:c.signal,headers:{
      "user-agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
      "accept-language":"en-US,en;q=0.9"
    }});
    if(!r.ok)throw Error("HTTP "+r.status);
    return {html:await r.text(),url:r.url};
  } finally {clearTimeout(t)}
}

function exactPage(html,url,m){
  const n=norm(m);
  const title=((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)||[])[1]||"");
  const h1=((html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)||[])[1]||"");
  return norm(title).includes(n)||norm(h1).includes(n)||norm(url).includes(n);
}

function previewUrl(m){return `https://reyee.ruijie.com/en-global/resources/preview/${slug(m)}/`}

function linkedProductPages(html,base,m){
  const n=norm(m),out=[];
  for(const x of html.matchAll(/href=["']([^"']+)["']/gi)){
    const u=abs(x[1],base); if(!u)continue;
    if(!/reyee\.ruijie\.com/i.test(u)||!/\/products\//i.test(u))continue;
    if(norm(u).includes(n)||norm(x[0]).includes(n))out.push(u);
  }
  return [...new Set(out)];
}

function imageCandidates(html,page,m){
  const out=[],n=norm(m);
  const add=(raw,score=0,alt="")=>{
    const u=abs(raw,page);if(!u||!/^https?:/i.test(u))return;
    if(!/\.(png|jpe?g|webp)(\?|$)/i.test(u))return;
    const low=u.toLowerCase();
    if(/logo|favicon|icon|flag|qr|sprite|loading|placeholder|banner|avatar|wechat|facebook|youtube|close|arrow|footer|header/i.test(low))score-=250;
    if(norm(u).includes(n))score+=180;
    if(norm(alt).includes(n))score+=250;
    if(/product|gallery|upload|image|images|detail|goods|swiper|carousel/i.test(low))score+=30;
    out.push({u,score});
  };
  for(const m0 of html.matchAll(/<img\b[^>]*>/gi)){
    const tag=m0[0],alt=((tag.match(/\b(?:alt|title)=["']([^"']*)["']/i)||[])[1]||"");
    for(const x of tag.matchAll(/\b(?:src|data-src|data-original|data-lazy-src|data-zoom-image)=["']([^"']+)["']/gi))add(x[1],0,alt);
    const ss=((tag.match(/\bsrcset=["']([^"']+)["']/i)||[])[1]||"");
    if(ss)for(const p of ss.split(","))add(p.trim().split(/\s+/)[0],5,alt);
  }
  for(const x of html.matchAll(/<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image)["'][^>]+content=["']([^"']+)["']/gi))add(x[1],80,"");
  for(const x of html.matchAll(/https?:\\?\/\\?\/[^"'<>\\\s]+?\.(?:png|jpe?g|webp)(?:\?[^"'<>\\\s]*)?/gi))add(x[0].replace(/\\\//g,"/"),0,"");
  const mp=new Map();for(const x of out)if(!mp.has(x.u)||mp.get(x.u).score<x.score)mp.set(x.u,x);
  return [...mp.values()].sort((a,b)=>b.score-a.score);
}

async function download(cands,dir,referer){
  const tmp=dir+"-restore-v2";fs.rmSync(tmp,{recursive:true,force:true});fs.mkdirSync(tmp,{recursive:true});
  const out=[],hashes=new Set();
  for(const x of cands.slice(0,80)){
    if(out.length>=MAX_IMAGES)break;
    try{
      const c=new AbortController(),t=setTimeout(()=>c.abort(),15000);
      let r;try{r=await fetch(x.u,{redirect:"follow",signal:c.signal,headers:{"user-agent":"Mozilla/5.0","referer":referer}})}finally{clearTimeout(t)}
      if(!r.ok)continue;const ct=r.headers.get("content-type")||"";if(!ct.startsWith("image/"))continue;
      const b=Buffer.from(await r.arrayBuffer());if(b.length<25000)continue;
      const h=crypto.createHash("sha1").update(b).digest("hex");if(hashes.has(h))continue;hashes.add(h);
      const ext=ct.includes("png")?".png":ct.includes("webp")?".webp":".jpg";
      const f=path.join(tmp,`image-${out.length+1}${ext}`);fs.writeFileSync(f,b);out.push(f);
    }catch{}
  }
  if(!out.length){fs.rmSync(tmp,{recursive:true,force:true});return []}
  fs.mkdirSync(dir,{recursive:true});
  for(const f of fs.readdirSync(dir))if(/^image-\d+\.(png|jpe?g|webp)$/i.test(f))fs.rmSync(path.join(dir,f),{force:true});
  const final=[];
  out.forEach((f,i)=>{const ext=path.extname(f),dest=path.join(dir,`image-${i+1}${ext}`);fs.copyFileSync(f,dest);final.push(dest.replace(/\\/g,"/"))});
  fs.rmSync(tmp,{recursive:true,force:true});
  return final;
}

(async()=>{
  const raw=JSON.parse(fs.readFileSync(FILE,"utf8")),I=items(raw);
  const ps=I.a.filter(p=>String(p.brand||"").toLowerCase()==="reyee"||/^Reyee\s+/i.test(String(p.name||"")));
  const rep=[];
  for(let i=0;i<ps.length;i++){
    const p=ps[i],m=model(p.name),old=Array.isArray(p.images)?p.images.length:0,dir=path.join(ROOT,p.id||slug(m));
    process.stdout.write(`[${i+1}/${ps.length}] ${m} ... `);

    const pages=[];
    if(EXACT[m])pages.push(EXACT[m]);
    pages.push(previewUrl(m));

    let page=null,html="";
    for(const u of pages){
      try{
        const r=await get(u);
        if(exactPage(r.html,r.url,m)){page=r.url;html=r.html;break}
      }catch{}
    }

    // From preview page, follow exact official product link if available.
    if(page && /\/resources\/preview\//i.test(page)){
      for(const u of linkedProductPages(html,page,m)){
        try{
          const r=await get(u);
          if(exactPage(r.html,r.url,m)){page=r.url;html=r.html;break}
        }catch{}
      }
    }

    if(!page){rep.push([m,"NO_OFFICIAL_PAGE",old,old,""]);console.log("no page");continue}

    const gallery=await download(imageCandidates(html,page,m),dir,page);
    if(!gallery.length){rep.push([m,"NO_NEW_GALLERY",old,old,page]);console.log("no gallery");continue}

    // Always switch to new filenames so Cloudflare/browser cannot keep old main.webp cache.
    p.images=gallery;
    rep.push([m,"RESTORED_V2",old,gallery.length,page]);
    console.log(`${old} -> ${gallery.length}`);
    await sleep(120);
  }

  fs.writeFileSync(FILE,JSON.stringify(I.w?{...raw,items:I.a}:I.a,null,2)+"\n");
  fs.mkdirSync("reports",{recursive:true});
  fs.writeFileSync(REPORT,"model,status,old_count,new_count,official_page\n"+rep.map(r=>r.map(v=>`"${String(v??"").replace(/"/g,'""')}"`).join(",")).join("\n")+"\n");
})().catch(e=>{console.error(e);process.exit(1)});
