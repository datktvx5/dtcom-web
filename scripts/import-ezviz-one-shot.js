const fs=require("fs");
const path=require("path");
const {chromium}=require("playwright");

const PRODUCT_FILE="products-camera.json";
const OUT_ROOT="media/ezviz-official";
const REPORT_FILE="reports/ezviz-import-final.csv";
const MAX_IMAGES=5;
const MIN_SPECS=5;

const CATEGORY_URLS=[
  "https://www.ezviz.com/vn/category/Indoor-Wi-Fi-Cameras",
  "https://www.ezviz.com/vn/category/Outdoor-Wi-Fi-Cameras",
  "https://www.ezviz.com/vn/category/security-wifi-cameras",
  "https://www.ezviz.com/category/indoor-wi-fi-cameras",
  "https://www.ezviz.com/category/Outdoor-Wi-Fi-Cameras"
];

// Current/modern EZVIZ families. Exact product pages are discovered from the
// official category pages at run time instead of hard-coding reseller URLs.
const TARGETS=[
  {match:"H6c G1 4K", type:"Trong nhà quay quét", subcategory:"Camera trong nhà"},
  {match:"H6c Pro", type:"Trong nhà quay quét", subcategory:"Camera trong nhà"},
  {match:"C6N G1 4K", type:"Trong nhà quay quét", subcategory:"Camera trong nhà"},
  {match:"H7c Dual 2K⁺", type:"Trong nhà ống kính kép", subcategory:"Camera trong nhà"},
  {match:"TY7 Dual 2K⁺", type:"Trong nhà ống kính kép", subcategory:"Camera trong nhà"},
  {match:"H90 Dual 2K⁺", type:"Ngoài trời ống kính kép", subcategory:"Camera ngoài trời"},
  {match:"H80f Multi 2K⁺", type:"Ngoài trời ba ống kính", subcategory:"Camera ngoài trời"},
  {match:"H80x Dual", type:"Ngoài trời quay quét", subcategory:"Camera ngoài trời"},
  {match:"H8x 2K⁺", type:"Ngoài trời quay quét", subcategory:"Camera ngoài trời"},
  {match:"H8 Pro 3K", type:"Ngoài trời quay quét", subcategory:"Camera ngoài trời"},
  {match:"H8c Pro", type:"Ngoài trời quay quét", subcategory:"Camera ngoài trời"},
  {match:"H9c Dual 3K", type:"Ngoài trời ống kính kép", subcategory:"Camera ngoài trời"},
  {match:"C8c 4K", type:"Ngoài trời quay quét", subcategory:"Camera ngoài trời"},
  {match:"C9c Dual 3K", type:"Ngoài trời ống kính kép", subcategory:"Camera ngoài trời"},
  {match:"H3c 2K⁺", type:"Ngoài trời cố định", subcategory:"Camera ngoài trời"}
];

const clean=s=>String(s||"").replace(/\u00a0/g," ").replace(/\s+/g," ").trim();
const norm=s=>String(s||"").toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}]+/gu,"");
const slug=s=>String(s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/đ/g,"d").replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"");

function loadProducts(){
  if(!fs.existsSync(PRODUCT_FILE)) return {raw:{items:[]},items:[],wrapped:true};
  const raw=JSON.parse(fs.readFileSync(PRODUCT_FILE,"utf8"));
  if(Array.isArray(raw)) return {raw,items:raw,wrapped:false};
  if(raw&&Array.isArray(raw.items)) return {raw,items:raw.items,wrapped:true};
  throw new Error(`${PRODUCT_FILE} must be array or {items:[...]}`);
}
function saveProducts(raw,items,wrapped){
  fs.writeFileSync(PRODUCT_FILE,JSON.stringify(wrapped?{...raw,items}:items,null,2)+"\n");
}
function csv(v){return `"${String(v??"").replace(/"/g,'""')}"`;}
function extFrom(ct,u){
  ct=String(ct||"").toLowerCase();
  if(ct.includes("png"))return ".png";
  if(ct.includes("webp"))return ".webp";
  if(ct.includes("jpeg")||ct.includes("jpg"))return ".jpg";
  const m=String(u||"").match(/\.(png|jpe?g|webp)(?:[?#]|$)/i);
  return m?"."+m[1].toLowerCase().replace("jpeg","jpg"):".jpg";
}

async function main(){
  const {raw,items,wrapped}=loadProducts();
  fs.mkdirSync(OUT_ROOT,{recursive:true});
  fs.mkdirSync("reports",{recursive:true});

  const browser=await chromium.launch({headless:true});
  const context=await browser.newContext({
    viewport:{width:1440,height:1200},
    locale:"vi-VN",
    userAgent:"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36"
  });
  const page=await context.newPage();

  const discovered=[];
  for(const categoryUrl of CATEGORY_URLS){
    try{
      const r=await page.goto(categoryUrl,{waitUntil:"domcontentloaded",timeout:90000});
      if(!r||r.status()>=400)continue;
      await page.waitForTimeout(3500);
      const links=await page.locator("a").evaluateAll(as=>as.map(a=>({
        text:(a.innerText||a.textContent||"").replace(/\s+/g," ").trim(),
        href:a.href||""
      })).filter(x=>x.href&&x.text));
      for(const l of links){
        if(/ezviz\.com/i.test(l.href)&&/\/product\//i.test(l.href))discovered.push(l);
      }
    }catch{}
  }

  const dedupLinks=[];
  const seenHref=new Set();
  for(const l of discovered){
    const href=l.href.split("#")[0];
    if(seenHref.has(href))continue;
    seenHref.add(href);
    dedupLinks.push({...l,href});
  }

  console.log(`Official product links discovered: ${dedupLinks.length}`);

  const accepted=[];
  const report=[];

  for(let i=0;i<TARGETS.length;i++){
    const t=TARGETS[i];
    console.log(`[${i+1}/${TARGETS.length}] ${t.match}`);

    let candidates=dedupLinks
      .filter(l=>norm(l.text).includes(norm(t.match))||norm(l.href).includes(norm(t.match)))
      .sort((a,b)=>{
        const ae=norm(a.text)===norm(t.match)?1:0;
        const be=norm(b.text)===norm(t.match)?1:0;
        return be-ae || a.text.length-b.text.length;
      });

    // If variant text is absent, allow the family name before resolution token.
    if(!candidates.length){
      const family=t.match.replace(/\s+(1080p|2K\+?|2K⁺|3K|4K).*$/i,"").trim();
      candidates=dedupLinks.filter(l=>norm(l.text).includes(norm(family)));
    }

    if(!candidates.length){
      report.push([t.match,"DROPPED",0,0,"","No official product page discovered"]);
      console.log("  DROPPED: no official page");
      continue;
    }

    let chosen=null,bodyText="";
    for(const c of candidates.slice(0,6)){
      try{
        const r=await page.goto(c.href,{waitUntil:"domcontentloaded",timeout:90000});
        if(!r||r.status()>=400)continue;
        await page.waitForTimeout(4500);
        const txt=clean(await page.locator("body").innerText());
        const family=t.match.replace(/\s+(1080p|2K\+?|2K⁺|3K|4K).*$/i,"").trim();
        if(norm(txt).includes(norm(family))){
          chosen=page.url(); bodyText=txt; break;
        }
      }catch{}
    }

    if(!chosen){
      report.push([t.match,"DROPPED",0,0,"","Official page failed validation"]);
      console.log("  DROPPED: validation failed");
      continue;
    }

    try{
      await page.evaluate(async()=>{
        for(let y=0;y<document.body.scrollHeight;y+=900){
          window.scrollTo(0,y);
          await new Promise(r=>setTimeout(r,90));
        }
        window.scrollTo(0,0);
      });
      await page.waitForTimeout(1200);

      const h1s=await page.locator("h1").allInnerTexts();
      let title=clean(h1s.find(x=>clean(x).length>2)||t.match);

      // Rendered product images only.
      const imgs=await page.locator("img").evaluateAll((els,target)=>{
        const n=s=>String(s||"").toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}]+/gu,"");
        const fam=target.replace(/\s+(1080p|2K\+?|2K⁺|3K|4K).*$/i,"").trim();
        const fk=n(fam);
        return els.map((img,idx)=>{
          const src=img.currentSrc||img.src||img.getAttribute("data-src")||img.getAttribute("data-original")||"";
          const alt=img.alt||"",title=img.title||"";
          const w=img.naturalWidth||img.width||0,h=img.naturalHeight||img.height||0;
          let score=0;
          if(n(alt).includes(fk))score+=1000;
          if(n(title).includes(fk))score+=700;
          if(n(src).includes(fk))score+=450;
          if(/product|goods|gallery|swiper|carousel|detail|upload/i.test(src))score+=120;
          if(w>=1000)score+=180; else if(w>=700)score+=120; else if(w>=450)score+=70; else if(w>=300)score+=30;
          if(h>=250)score+=30;
          if(/logo|icon|qr|favicon|loading|placeholder|banner|wechat|facebook|youtube|arrow|close|appstore|googleplay/i.test(src))score-=1400;
          if(w<280||h<180)score-=500;
          return {idx,src,alt,title,w,h,score};
        }).filter(x=>x.src&&x.score>0);
      },t.match);

      imgs.sort((a,b)=>b.score-a.score||(b.w*b.h)-(a.w*a.h));
      const uniq=[],seen=new Set();
      for(const x of imgs){
        const u=x.src.split("#")[0];
        if(seen.has(u))continue;
        seen.add(u);uniq.push(x);
        if(uniq.length>=15)break;
      }

      const id="ezviz-"+slug(t.match);
      const outDir=path.join(OUT_ROOT,id);
      const tmp=outDir+"-tmp";
      fs.rmSync(tmp,{recursive:true,force:true});
      fs.mkdirSync(tmp,{recursive:true});
      const saved=[];

      for(const x of uniq){
        if(saved.length>=MAX_IMAGES)break;
        try{
          const r=await context.request.get(x.src,{timeout:30000,headers:{Referer:chosen}});
          if(!r.ok())continue;
          const ct=r.headers()["content-type"]||"";
          const buf=await r.body();
          if(!ct.startsWith("image/")||buf.length<25000)continue;
          const dest=path.join(tmp,`image-${saved.length+1}${extFrom(ct,x.src)}`);
          fs.writeFileSync(dest,buf);saved.push(dest);
        }catch{}
      }

      if(!saved.length){
        fs.rmSync(tmp,{recursive:true,force:true});
        throw new Error("No usable official product image");
      }

      fs.rmSync(outDir,{recursive:true,force:true});
      fs.renameSync(tmp,outDir);

      const imagePaths=fs.readdirSync(outDir)
        .filter(f=>/^image-\d+\.(png|jpe?g|webp)$/i.test(f))
        .sort((a,b)=>Number((a.match(/\d+/)||[0])[0])-Number((b.match(/\d+/)||[0])[0]))
        .map(f=>path.join(outDir,f).replace(/\\/g,"/"));

      // EZVIZ specification tables are rendered as rows/blocks. Extract label/value pairs.
      const pairs=await page.evaluate(()=>{
        const clean=s=>String(s||"").replace(/\s+/g," ").trim();
        const rows=[];
        const selectors=["tr",".spec-item",".specification-item",".parameter-item",".detail-parameter-item","dl"];
        for(const sel of selectors){
          for(const el of document.querySelectorAll(sel)){
            const cells=[...el.querySelectorAll("th,td,dt,dd,.name,.label,.value,.key")].map(x=>clean(x.innerText||x.textContent)).filter(Boolean);
            if(cells.length>=2)rows.push([cells[0],cells.slice(1).join(" ")]);
          }
        }
        return rows;
      });

      const useful=[];
      const used=new Set();
      for(const [k0,v0] of pairs){
        const k=clean(k0),v=clean(v0);
        if(!k||!v||k.length>80||v.length>700)continue;
        if(/^(camera|video|audio|network|storage|general|specification|thông số)/i.test(k)&&v.length<5)continue;
        const kk=k.toLowerCase();
        if(used.has(kk))continue;
        used.add(kk);useful.push([k,v]);
        if(useful.length>=18)break;
      }

      // Fallback from visible lines around common Vietnamese/English spec labels.
      if(useful.length<MIN_SPECS){
        const lines=(await page.locator("body").innerText()).split("\n").map(clean).filter(Boolean);
        const labels=[
          "Model","Cảm biến hình ảnh","Image Sensor","Ống kính","Lens",
          "Độ phân giải tối đa","Max. Resolution","Góc PT","Video Compression",
          "Nén video","Wi-Fi","Lưu trữ","Storage","Nguồn","Power",
          "Kích thước","Dimensions","Trọng lượng","Weight","IP Rating","Protection"
        ];
        for(let i=0;i<lines.length-1;i++){
          if(labels.some(l=>lines[i].toLowerCase()===l.toLowerCase())){
            const k=lines[i],v=lines[i+1];
            if(v&&v!==k&&!used.has(k.toLowerCase())){
              used.add(k.toLowerCase());useful.push([k,v]);
            }
          }
          if(useful.length>=18)break;
        }
      }

      if(useful.length<MIN_SPECS) throw new Error(`Insufficient official specs (${useful.length})`);

      const bodyLines=bodyText.split("\n").map(clean).filter(Boolean);
      const features=[];
      for(const line of bodyLines){
        if(line.length<12||line.length>180)continue;
        if(/(độ phân giải|2K|3K|4K|AI|phát hiện|theo dõi|đàm thoại|nhìn đêm|ban đêm|360|ống kính|IP6|microSD|CloudPlay|color)/i.test(line)){
          if(!features.includes(line))features.push(line);
        }
        if(features.length>=6)break;
      }

      const desc=[
        "Thông số chính:",
        ...useful.map(([k,v])=>`• ${k}: ${v}`),
        ...(features.length?["","Tính năng nổi bật:",...features.map(x=>`• ${x}`)]:[])
      ].join("\n");

      accepted.push({
        id,
        name:`EZVIZ ${t.match}`,
        category:"Camera",
        subcategory:t.subcategory,
        product_type:t.type,
        brand:"EZVIZ",
        price:0,
        old_price:0,
        warranty:"",
        shopee_link:"",
        images:imagePaths,
        video:"",
        featured:false,
        description:desc,
        source_policy:"ezviz-official-one-shot",
        official_page:chosen
      });

      report.push([t.match,"ACCEPTED",imagePaths.length,useful.length,chosen,""]);
      console.log(`  ACCEPTED: ${imagePaths.length} images, ${useful.length} specs`);

    }catch(e){
      report.push([t.match,"DROPPED",0,0,chosen,String(e.message||e)]);
      console.log(`  DROPPED: ${e.message}`);
    }
  }

  await browser.close();

  const ids=new Set(accepted.map(x=>x.id));
  const kept=items.filter(p=>!ids.has(String(p.id||"")) && p.source_policy!=="ezviz-official-one-shot");
  saveProducts(raw,[...kept,...accepted],wrapped);

  const header=["model","status","image_count","spec_count","official_page","note"];
  fs.writeFileSync(REPORT_FILE,[header,...report].map(r=>r.map(csv).join(",")).join("\n")+"\n");

  console.log(`Accepted: ${accepted.length}/${TARGETS.length}`);
  if(!accepted.length) throw new Error("No EZVIZ products accepted; refusing empty import.");
}

main().catch(e=>{console.error(e);process.exit(1);});
