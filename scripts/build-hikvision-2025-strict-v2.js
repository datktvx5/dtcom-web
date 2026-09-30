const fs=require("fs"),path=require("path"),crypto=require("crypto");
const cfg=JSON.parse(fs.readFileSync("config/hikvision-2025-strict.json","utf8"));
const OUT="imports/official-2025plus-v4/hikvision-v2";
const MEDIA="media/official-2025plus-v4/camera/hikvision-v2";
const REPORT="reports/official-2025plus-v4/hikvision-v2";
for(const d of [OUT,MEDIA,REPORT])fs.mkdirSync(d,{recursive:true});

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const strip=s=>String(s||"").replace(/<script[\s\S]*?<\/script>/gi," ").replace(/<style[\s\S]*?<\/style>/gi," ").replace(/<[^>]+>/g," ").replace(/&nbsp;/gi," ").replace(/&amp;/gi,"&").replace(/&quot;/gi,'"').replace(/&#39;/g,"'").replace(/\s+/g," ").trim();
const slug=s=>String(s||"").toLowerCase().replace(/[()\/]/g,"-").replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"");

async function fetchAny(url,accept="text/html"){
  const c=new AbortController(),t=setTimeout(()=>c.abort(),20000);
  try{
    const r=await fetch(url,{
      redirect:"follow",
      signal:c.signal,
      headers:{
        "user-agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
        "accept":accept,
        "accept-language":"en-US,en;q=0.9"
      }
    });
    const buf=Buffer.from(await r.arrayBuffer());
    return {ok:r.ok,status:r.status,url:r.url,headers:r.headers,buf,text:buf.toString("utf8")};
  }finally{clearTimeout(t)}
}

function titleOf(h){
  return strip(
    (h.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)||[])[1] ||
    (h.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)||[])[1] ||
    (h.match(/<title[^>]*>([\s\S]*?)<\/title>/i)||[])[1] || ""
  );
}

function specPairs(h){
  const a=[],add=(k,v)=>{k=strip(k);v=strip(v);if(!k||!v||k.length>120||v.length>600)return;if(/cookie|privacy|menu|share|support|download/i.test(k))return;a.push([k,v])};
  for(const m of h.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)){
    const c=[...m[1].matchAll(/<(?:th|td)[^>]*>([\s\S]*?)<\/(?:th|td)>/gi)].map(x=>x[1]);
    if(c.length>=2)add(c[0],c.slice(1).join(" "));
  }
  for(const m of h.matchAll(/<dt[^>]*>([\s\S]*?)<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/gi))add(m[1],m[2]);
  const seen=new Set(),o=[];for(const x of a){const k=x[0].toLowerCase();if(seen.has(k))continue;seen.add(k);o.push(x)}
  return o.slice(0,20);
}

function imageUrls(h,page){
  const o=[];const add=u=>{try{u=String(u||"").replace(/&amp;/g,"&").replace(/\\\//g,"/");u=new URL(u,page).href;const l=u.toLowerCase();if(!/\.(png|jpe?g|webp)(\?|$)/i.test(u))return;if(/logo|icon|favicon|avatar|flag|qr|sprite|loading|placeholder|banner|arrow|close|check/i.test(l))return;o.push(u)}catch{}};
  for(const m of h.matchAll(/<img\b[^>]*>/gi)){
    for(const x of m[0].matchAll(/\b(?:src|data-src|data-original|data-lazy-src|data-zoom-image)=["']([^"']+)["']/gi))add(x[1]);
    const ss=(m[0].match(/\bsrcset=["']([^"']+)["']/i)||[])[1];
    if(ss)for(const p of ss.split(","))add(p.trim().split(/\s+/)[0]);
  }
  for(const m of h.matchAll(/<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image)["'][^>]+content=["']([^"']+)["']/gi))add(m[1]);
  return [...new Set(o)];
}

async function saveImages(urls,folder,ref){
  fs.mkdirSync(folder,{recursive:true});const out=[],hashes=new Set();
  for(const u of urls){
    if(out.length>=5)break;
    try{
      const r=await fetch(u,{redirect:"follow",headers:{"user-agent":"Mozilla/5.0","referer":ref}});
      if(!r.ok)continue;
      const ct=r.headers.get("content-type")||"";
      if(!ct.startsWith("image/"))continue;
      const b=Buffer.from(await r.arrayBuffer());
      if(b.length<20000)continue;
      const h=crypto.createHash("sha1").update(b).digest("hex");if(hashes.has(h))continue;hashes.add(h);
      const ext=ct.includes("png")?".png":ct.includes("webp")?".webp":".jpg";
      const p=path.join(folder,`image-${out.length+1}${ext}`);
      fs.writeFileSync(p,b);out.push(p.replace(/\\/g,"/"));
    }catch{}
  }
  return out;
}

async function pdfTextFromDatasheet(url,model){
  const r=await fetchAny(url,"application/pdf");
  if(!r.ok) return {text:"",status:`HTTP_${r.status}`};
  const pdfPath=path.join("/tmp",slug(model)+".pdf");
  fs.writeFileSync(pdfPath,r.buf);
  const outPath=path.join("/tmp",slug(model)+".txt");
  const {spawnSync}=require("child_process");
  const p=spawnSync("pdftotext",["-layout",pdfPath,outPath],{encoding:"utf8"});
  if(p.status!==0||!fs.existsSync(outPath))return {text:"",status:"PDFTEXT_FAILED"};
  return {text:fs.readFileSync(outPath,"utf8"),status:"OK"};
}

function specsFromPdfText(txt){
  const lines=String(txt||"").split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  const keys=[
    "Max. Resolution","Image Sensor","Min. Illumination","Shutter Time","Lens","Focal Length",
    "Aperture","Field of View","IR Range","White Light Range","Supplement Light",
    "Video Compression","Main Stream","Sub Stream","Audio","Built-in Microphone",
    "Network Storage","Protocols","Ethernet Interface","Alarm","Reset Key",
    "Power Supply","Power Consumption","Working Temperature","Operating Conditions",
    "Protection","IP67","IK10","Dimensions","Weight","Material"
  ];
  const out=[];
  for(let i=0;i<lines.length;i++){
    const l=lines[i];
    for(const k of keys){
      if(l.toLowerCase().startsWith(k.toLowerCase())){
        let v=l.slice(k.length).replace(/^[:\s-]+/,"").trim();
        if(!v && lines[i+1] && lines[i+1].length<220)v=lines[i+1];
        if(v)out.push([k,v]);
        break;
      }
    }
  }
  const seen=new Set(),clean=[];
  for(const x of out){const k=x[0].toLowerCase();if(seen.has(k))continue;seen.add(k);clean.push(x)}
  return clean.slice(0,16);
}

function desc(title,sp){
  return [title,"","Thông số chính:",...sp.map(([k,v])=>`• ${k}: ${v}`)].join("\n");
}

(async()=>{
  const items=[],report=[];
  for(const p of cfg.products){
    let pageStatus="",datasheetStatus="",imageCount=0,specCount=0;
    process.stdout.write(`${p.model} ... `);
    try{
      let html="",finalUrl=p.official_url,title=p.model,sp=[],imgs=[];
      try{
        const page=await fetchAny(p.official_url);
        pageStatus=`HTTP_${page.status}`;
        if(page.ok){
          html=page.text;finalUrl=page.url;title=titleOf(html)||p.model;
          sp=specPairs(html);
          imgs=imageUrls(html,finalUrl);
        }
      }catch(e){pageStatus="FETCH_ERROR"}

      // Datasheet is the authoritative fallback for specs.
      if(sp.length<3){
        try{
          const pdf=await pdfTextFromDatasheet(p.official_datasheet,p.model);
          datasheetStatus=pdf.status;
          const dsp=specsFromPdfText(pdf.text);
          if(dsp.length>sp.length)sp=dsp;
        }catch(e){datasheetStatus="FETCH_ERROR"}
      }else{
        datasheetStatus="NOT_NEEDED";
      }

      // If product page has no usable images, explicitly drop as requested.
      if(html){
        try{imgs=await saveImages(imgs,path.join(MEDIA,slug(p.model)),finalUrl)}catch{imgs=[]}
      }else imgs=[];

      imageCount=imgs.length;specCount=sp.length;

      if(!imageCount){
        report.push([p.model,"DROPPED_NO_IMAGE",imageCount,specCount,pageStatus,datasheetStatus,finalUrl,p.official_datasheet]);
        console.log(`DROP no image (${pageStatus})`);
        continue;
      }
      if(specCount<3){
        report.push([p.model,"DROPPED_INSUFFICIENT_SPECS",imageCount,specCount,pageStatus,datasheetStatus,finalUrl,p.official_datasheet]);
        console.log(`DROP specs ${specCount}`);
        continue;
      }

      items.push({
        id:"hikvision-"+slug(p.model),
        name:`Hikvision ${p.model}`,
        brand:"Hikvision",
        subcategory:"Camera",
        product_type:p.product_type,
        images:imgs,
        featured:false,
        description:desc(title,sp),
        official_url:finalUrl,
        official_datasheet:p.official_datasheet,
        release_year:p.release_year,
        source_policy:"official-only"
      });
      report.push([p.model,"ACCEPTED",imageCount,specCount,pageStatus,datasheetStatus,finalUrl,p.official_datasheet]);
      console.log(`OK ${imageCount} images ${specCount} specs`);
    }catch(e){
      report.push([p.model,"ERROR",0,0,pageStatus||"UNKNOWN",datasheetStatus||"UNKNOWN",p.official_url,p.official_datasheet]);
      console.log("ERROR",e.message);
    }
    await sleep(200);
  }

  fs.writeFileSync(path.join(OUT,"products-camera-hikvision.json"),JSON.stringify({items},null,2)+"\n");
  const csv="model,status,image_count,spec_count,page_status,datasheet_status,official_url,official_datasheet\n"+
    report.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n")+"\n";
  fs.writeFileSync(path.join(REPORT,"hikvision-v2-report.csv"),csv);
  console.log(`Accepted ${items.length}/${cfg.products.length}`);
})().catch(e=>{console.error(e);process.exit(1)});
