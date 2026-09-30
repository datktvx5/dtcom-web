const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const PRODUCT_FILE = "products-camera.json";
const OUT_ROOT = "media/hikvision-official";
const REPORT_FILE = "reports/hikvision-import-final.csv";
const MAX_IMAGES = 5;
const MIN_IMAGES = 1;

// 10 models from Hikvision 2025 Product Quick Guide + 2 current ColorVu 3.0 models.
// Only official Hikvision product pages are accepted.
const PRODUCTS = [
  {
    model:"DS-2CD1027G3-LIU",
    url:"https://www.hikvision.com/vn/products/IP-Products/Network-Cameras/Value-Series/ds-2cd1027g3-liu-f---sl---srb-/",
    type:"Bullet"
  },
  {
    model:"DS-2CD1127G3-LIU",
    url:"https://www.hikvision.com/en/products/IP-Products/Network-Cameras/value-series/ds-2cd1127g3-liu-f---sx-/",
    type:"Dome"
  },
  {
    model:"DS-2CD2047G2H-LIU/SL",
    url:"https://www.hikvision.com/en/products/IP-Products/Network-Cameras/Pro-Series-EasyIP-/ds-2cd2047g2h-liu-sl/",
    type:"Bullet"
  },
  {
    model:"DS-2CD2087G2H-LIU/SL",
    url:"https://www.hikvision.com/en/products/IP-Products/Network-Cameras/Pro-Series-EasyIP-/ds-2cd2087g2h-liu-sl/",
    type:"Bullet"
  },
  {
    model:"DS-2CD2147G2H-LISU",
    url:"https://www.hikvision.com/en/products/IP-Products/Network-Cameras/Pro-Series-EasyIP-/ds-2cd2147g2h-lisu/",
    type:"Dome"
  },
  {
    model:"DS-2CD2187G2H-LISU",
    url:"https://www.hikvision.com/en/products/IP-Products/Network-Cameras/Pro-Series-EasyIP-/ds-2cd2187g2h-lisu/",
    type:"Dome"
  },
  {
    model:"DS-2CD2347G2H-LISU/SL",
    url:"https://www.hikvision.com/en/products/IP-Products/Network-Cameras/Pro-Series-EasyIP-/ds-2cd2347g2h-lisu-sl/",
    type:"Turret"
  },
  {
    model:"DS-2CD2387G2H-LISU/SL",
    url:"https://www.hikvision.com/en/products/IP-Products/Network-Cameras/Pro-Series-EasyIP-/ds-2cd2387g2h-lisu-sl/",
    type:"Turret"
  },
  {
    model:"DS-2CD2647G2HT-LIZS",
    url:"https://www.hikvision.com/en/products/IP-Products/Network-Cameras/Pro-Series-EasyIP-/ds-2cd2647g2ht-lizs/",
    type:"Bullet"
  },
  {
    model:"DS-2CD2687G2HT-LIZS",
    url:"https://www.hikvision.com/en/products/IP-Products/Network-Cameras/Pro-Series-EasyIP-/ds-2cd2687g2ht-lizs/",
    type:"Bullet"
  },
  {
    model:"DS-2CD2747G2HT-LIZS",
    url:"https://www.hikvision.com/en/products/IP-Products/Network-Cameras/Pro-Series-EasyIP-/ds-2cd2747g2ht-lizs/",
    type:"Dome"
  },
  {
    model:"DS-2CD2787G2HT-LIZS",
    url:"https://www.hikvision.com/en/products/IP-Products/Network-Cameras/Pro-Series-EasyIP-/ds-2cd2787g2ht-lizs/",
    type:"Dome"
  }
];

const slug = s => String(s||"")
  .toLowerCase()
  .replace(/\//g,"-")
  .replace(/[()]/g,"")
  .replace(/[^a-z0-9]+/g,"-")
  .replace(/^-+|-+$/g,"");

const norm = s => String(s||"").toUpperCase().replace(/[^A-Z0-9]/g,"");

function loadProducts(){
  if(!fs.existsSync(PRODUCT_FILE)) return {raw:{items:[]},items:[],wrapped:true};
  const raw=JSON.parse(fs.readFileSync(PRODUCT_FILE,"utf8"));
  if(Array.isArray(raw)) return {raw,items:raw,wrapped:false};
  if(raw && Array.isArray(raw.items)) return {raw,items:raw.items,wrapped:true};
  throw new Error(`${PRODUCT_FILE} must be an array or {items:[...]}`);
}

function saveProducts(raw,items,wrapped){
  const out=wrapped?{...raw,items}:items;
  fs.writeFileSync(PRODUCT_FILE,JSON.stringify(out,null,2)+"\n","utf8");
}

function cleanText(s){
  return String(s||"")
    .replace(/\u00a0/g," ")
    .replace(/[ \t]+/g," ")
    .replace(/\n{3,}/g,"\n\n")
    .trim();
}

function escCsv(v){
  return `"${String(v??"").replace(/"/g,'""')}"`;
}

function extFrom(ct,url){
  const s=String(ct||"").toLowerCase();
  if(s.includes("png")) return ".png";
  if(s.includes("webp")) return ".webp";
  if(s.includes("jpeg")||s.includes("jpg")) return ".jpg";
  const m=String(url||"").match(/\.(png|jpe?g|webp)(?:[?#]|$)/i);
  return m ? "."+m[1].toLowerCase().replace("jpeg","jpg") : ".jpg";
}

async function main(){
  const {raw,items,wrapped}=loadProducts();

  fs.mkdirSync(OUT_ROOT,{recursive:true});
  fs.mkdirSync("reports",{recursive:true});

  const browser=await chromium.launch({headless:true});
  const context=await browser.newContext({
    viewport:{width:1440,height:1200},
    locale:"en-US",
    userAgent:"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36"
  });
  const page=await context.newPage();

  const report=[];
  const accepted=[];

  for(let i=0;i<PRODUCTS.length;i++){
    const cfg=PRODUCTS[i];
    console.log(`[${i+1}/${PRODUCTS.length}] ${cfg.model}`);

    try{
      const resp=await page.goto(cfg.url,{waitUntil:"domcontentloaded",timeout:90000});
      await page.waitForTimeout(5000);

      if(!resp || resp.status()>=400){
        throw new Error(`product page HTTP ${resp?resp.status():"?"}`);
      }

      await page.evaluate(async()=>{
        for(let y=0;y<document.body.scrollHeight;y+=900){
          window.scrollTo(0,y);
          await new Promise(r=>setTimeout(r,100));
        }
        window.scrollTo(0,0);
      });
      await page.waitForTimeout(1200);

      const bodyText=cleanText(await page.locator("body").innerText());
      if(!norm(bodyText).includes(norm(cfg.model))){
        throw new Error("official page does not contain exact model");
      }

      // Product title: first meaningful H1.
      const h1s=await page.locator("h1").allInnerTexts();
      let productTitle=cleanText(h1s.find(x=>cleanText(x).length>10)||"");
      if(!productTitle || norm(productTitle).includes(norm(cfg.model))){
        const lines=bodyText.split("\n").map(cleanText).filter(Boolean);
        productTitle=lines.find(x=>/(MP|Network Camera|Camera)/i.test(x) && x.length<180) || `Hikvision ${cfg.model}`;
      }

      // Get official rendered gallery images.
      const imgs=await page.locator("img").evaluateAll((els,model)=>{
        const n=s=>String(s||"").toUpperCase().replace(/[^A-Z0-9]/g,"");
        const mk=n(model);
        return els.map((img,idx)=>{
          const src=img.currentSrc||img.src||img.getAttribute("data-src")||img.getAttribute("data-original")||"";
          const alt=img.alt||"";
          const title=img.title||"";
          const w=img.naturalWidth||img.width||0;
          const h=img.naturalHeight||img.height||0;
          let score=0;
          if(n(alt).includes(mk))score+=1200;
          if(n(title).includes(mk))score+=900;
          if(n(src).includes(mk))score+=550;
          if(/product|gallery|swiper|carousel|detail|goods|normal|prd/i.test(src))score+=120;
          if(w>=1000)score+=180;
          else if(w>=700)score+=120;
          else if(w>=450)score+=70;
          else if(w>=300)score+=30;
          if(h>=300)score+=30;
          if(/logo|icon|flag|qr|avatar|favicon|loading|placeholder|banner|wechat|facebook|youtube|arrow|close|compare|favorite/i.test(src))score-=1500;
          if(w<300||h<200)score-=500;
          return {idx,src,alt,title,w,h,score};
        }).filter(x=>x.src&&x.score>0);
      },cfg.model);

      imgs.sort((a,b)=>b.score-a.score||(b.w*b.h)-(a.w*a.h));

      const imageSeen=new Set();
      const selected=[];
      for(const x of imgs){
        const u=x.src.split("#")[0];
        if(imageSeen.has(u))continue;
        imageSeen.add(u);
        selected.push(x);
        if(selected.length>=15)break;
      }

      const outDir=path.join(OUT_ROOT,slug(cfg.model));
      const tmp=outDir+"-tmp";
      fs.rmSync(tmp,{recursive:true,force:true});
      fs.mkdirSync(tmp,{recursive:true});

      const saved=[];
      for(const x of selected){
        if(saved.length>=MAX_IMAGES)break;
        try{
          const r=await context.request.get(x.src,{
            timeout:30000,
            headers:{Referer:page.url()}
          });
          if(!r.ok())continue;
          const ct=r.headers()["content-type"]||"";
          const buf=await r.body();
          if(!ct.startsWith("image/")||buf.length<30000)continue;
          const ext=extFrom(ct,x.src);
          const dest=path.join(tmp,`image-${saved.length+1}${ext}`);
          fs.writeFileSync(dest,buf);
          saved.push(dest);
        }catch{}
      }

      if(saved.length<MIN_IMAGES){
        fs.rmSync(tmp,{recursive:true,force:true});
        throw new Error("no usable official product image");
      }

      fs.rmSync(outDir,{recursive:true,force:true});
      fs.renameSync(tmp,outDir);

      const imagePaths=fs.readdirSync(outDir)
        .filter(f=>/^image-\d+\.(png|jpe?g|webp)$/i.test(f))
        .sort((a,b)=>Number((a.match(/\d+/)||[0])[0])-Number((b.match(/\d+/)||[0])[0]))
        .map(f=>path.join(outDir,f).replace(/\\/g,"/"));

      // Extract a compact but detailed set of official specifications.
      const wanted=[
        "Image Sensor","Max. Resolution","Min. Illumination","Shutter Time","Day & Night",
        "Lens Type","Focal Length & FOV","Lens Mount","Iris Type","Aperture",
        "Supplement Light Type","Supplement Light Range","Smart Supplement Light",
        "Wide Dynamic Range (WDR)","WDR","Video Compression",
        "Built-in Microphone","Built-in Speaker","Audio","Alarm",
        "On-Board Storage","Ethernet Interface","Power","Material","Dimension",
        "Protection","Approval"
      ];

      const specs=await page.evaluate((wanted)=>{
        const out=[];
        const nodes=[...document.querySelectorAll("td,th,dt,dd,li,p,div,span")];
        const txt=e=>(e.innerText||e.textContent||"").replace(/\s+/g," ").trim();
        for(const label of wanted){
          let value="";
          for(const el of nodes){
            const t=txt(el);
            if(t===label || t.toLowerCase()===label.toLowerCase()){
              const parent=el.parentElement;
              if(parent){
                const kids=[...parent.children].map(txt).filter(Boolean);
                const idx=kids.findIndex(x=>x.toLowerCase()===label.toLowerCase());
                if(idx>=0 && kids[idx+1] && kids[idx+1]!==label){
                  value=kids[idx+1];
                  break;
                }
              }
              const next=el.nextElementSibling;
              if(next){
                const n=txt(next);
                if(n && n!==label){value=n;break;}
              }
            }
          }
          if(value && value.length<900)out.push([label,value]);
        }
        return out;
      },wanted);

      // De-duplicate specs and limit to the most useful 16.
      const uniq=[];
      const seenLabels=new Set();
      for(const [k,v] of specs){
        const key=k.toLowerCase();
        if(seenLabels.has(key))continue;
        seenLabels.add(key);
        uniq.push([cleanText(k),cleanText(v)]);
        if(uniq.length>=16)break;
      }

      if(uniq.length<5){
        throw new Error(`insufficient official specs (${uniq.length})`);
      }

      const featureLines=[];
      const bodyLines=bodyText.split("\n").map(cleanText).filter(Boolean);
      for(const line of bodyLines){
        if(line.length<20||line.length>220)continue;
        if(/^(High quality imaging|Smart Hybrid Light|Clear imaging|Efficient H\.265|Focus on human|Water and dust|Provide real-time|Active strobe|Support on-board|Motorized varifocal|HikAI-ISP|Super clear 24\/7|Motion Detection)/i.test(line)){
          if(!featureLines.includes(line))featureLines.push(line);
        }
        if(featureLines.length>=6)break;
      }

      const desc=[
        "Thông số chính:",
        ...uniq.map(([k,v])=>`• ${k}: ${v}`),
        ...(featureLines.length?["","Tính năng nổi bật:",...featureLines.map(x=>`• ${x}`)]:[])
      ].join("\n");

      const id=slug(cfg.model);
      const product={
        id,
        name:`Hikvision ${cfg.model}`,
        category:"Camera",
        subcategory:"Camera IP PoE",
        product_type:cfg.type,
        brand:"Hikvision",
        price:0,
        old_price:0,
        warranty:"",
        shopee_link:"",
        images:imagePaths,
        video:"",
        featured:false,
        description:desc,
        source_policy:"hikvision-official-one-shot",
        official_page:page.url()
      };

      accepted.push(product);
      report.push([cfg.model,"ACCEPTED",imagePaths.length,uniq.length,page.url()]);
      console.log(`  ACCEPTED: ${imagePaths.length} images, ${uniq.length} specs`);

    }catch(e){
      report.push([cfg.model,"DROPPED",0,0,cfg.url,String(e.message||e)]);
      console.log(`  DROPPED: ${e.message}`);
    }
  }

  await browser.close();

  // Preserve all existing non-Hikvision products.
  // Replace only Hikvision products created by this one-shot importer or exact same IDs.
  const acceptedIds=new Set(accepted.map(x=>x.id));
  const kept=items.filter(p=>{
    const id=String(p.id||"");
    if(acceptedIds.has(id))return false;
    if(p.source_policy==="hikvision-official-one-shot")return false;
    return true;
  });

  const merged=[...kept,...accepted];
  saveProducts(raw,merged,wrapped);

  const header=["model","status","image_count","spec_count","official_page","note"];
  const csv=[header,...report]
    .map(row=>row.map(escCsv).join(","))
    .join("\n")+"\n";
  fs.writeFileSync(REPORT_FILE,csv,"utf8");

  console.log("");
  console.log(`Accepted: ${accepted.length}/${PRODUCTS.length}`);
  console.log(`Saved ${PRODUCT_FILE}`);
  console.log(`Report: ${REPORT_FILE}`);

  if(accepted.length===0){
    throw new Error("No Hikvision products accepted; refusing to publish empty import.");
  }
}

main().catch(err=>{
  console.error(err);
  process.exit(1);
});
