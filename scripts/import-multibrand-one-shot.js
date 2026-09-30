const fs=require("fs");
const path=require("path");
const {chromium}=require("playwright");

const CAMERA_FILE="products-camera.json";
const NETWORK_FILE="products-network.json";
const REPORT_FILE="reports/multibrand-import-final.csv";
const MAX_IMAGES=5;
const MIN_DETAILS=5;

const targets = [
  // ===== CAMERA: DAHUA =====
  {kind:"camera",brand:"Dahua",model:"IPC-HFW3449T1-AS-PV-PRO",subcategory:"Camera ngoài trời",product_type:"Bullet",url:"https://www.dahuasecurity.com/vi/products/network-products/network-cameras/wizsense-3-series/tioc-pro-wizcolor/ipc-hfw3449t1-as-pv-pro"},
  {kind:"camera",brand:"Dahua",model:"IPC-HFW3449T1-ZAS-PV-PRO",subcategory:"Camera ngoài trời",product_type:"Bullet",url:"https://www.dahuasecurity.com/vi/products/network-products/network-cameras/WizSense-3-Series/TiOC-PRO-WizColor/IPC-HFW3449T1-ZAS-PV-PRO"},
  {kind:"camera",brand:"Dahua",model:"IPC-HFW3849T1-AS-PV-PRO",subcategory:"Camera ngoài trời",product_type:"Bullet",url:"https://www.dahuasecurity.com/products/network-products/network-cameras/WizSense-Series/3-Series/WizColor/IPC-HFW3849T1-AS-PV-PRO"},
  {kind:"camera",brand:"Dahua",model:"IPC-HDW3449H-AS-PV-PRO",subcategory:"Camera ngoài trời",product_type:"Eyeball",discover:["https://www.dahuasecurity.com/vi/products/network-products/network-cameras/WizSense-3-Series/TiOC-PRO-WizColor"]},
  {kind:"camera",brand:"Dahua",model:"IPC-HDW3449H-ZAS-PV-PRO",subcategory:"Camera ngoài trời",product_type:"Eyeball",discover:["https://www.dahuasecurity.com/vi/products/network-products/network-cameras/WizSense-3-Series/TiOC-PRO-WizColor"]},
  {kind:"camera",brand:"Dahua",model:"IPC-HDW3849H-AS-PV-PRO",subcategory:"Camera ngoài trời",product_type:"Eyeball",url:"https://www.dahuasecurity.com/vi/products/network-products/network-cameras/WizSense-3-Series/TiOC-PRO-WizColor/IPC-HDW3849H-AS-PV-PRO"},
  {kind:"camera",brand:"Dahua",model:"IPC-HDBW3449R1-ZAS-PV-PRO",subcategory:"Camera ngoài trời",product_type:"Dome",discover:["https://www.dahuasecurity.com/vi/products/network-products/network-cameras/WizSense-3-Series/TiOC-PRO-WizColor"]},
  {kind:"camera",brand:"Dahua",model:"IPC-HDBW3849R1-ZAS-PV-PRO",subcategory:"Camera ngoài trời",product_type:"Dome",discover:["https://www.dahuasecurity.com/vi/products/network-products/network-cameras/WizSense-3-Series/TiOC-PRO-WizColor"]},

  // ===== CAMERA: KBVISION =====
  {kind:"camera",brand:"KBVision",model:"KX-A5W",subcategory:"Camera trong nhà",product_type:"Wi-Fi PT",url:"https://kbvisiongroup.com/product/kx-a5w.html"},
  {kind:"camera",brand:"KBVision",model:"KX-A3W",subcategory:"Camera trong nhà",product_type:"Wi-Fi PT",url:"https://kbvisiongroup.com/product/kx-a3w.html"},
  {kind:"camera",brand:"KBVision",model:"KX-C4W",subcategory:"Camera trong nhà",product_type:"Wi-Fi PT",url:"https://kbvisiongroup.com/product/kx-c4w.html"},
  {kind:"camera",brand:"KBVision",model:"KX-C2W",subcategory:"Camera trong nhà",product_type:"Wi-Fi PT",url:"https://kbvisiongroup.com/product/kx-c2w.html"},
  {kind:"camera",brand:"KBVision",model:"KX-Y4001SN3",subcategory:"Camera ngoài trời",product_type:"Bullet IP",url:"https://kbvisiongroup.com/product/kx-y4001sn3.html"},
  {kind:"camera",brand:"KBVision",model:"KX-Y4002SN3",subcategory:"Camera trong nhà",product_type:"Dome IP",url:"https://kbvisiongroup.com/product/kx-y4002sn3.html"},
  {kind:"camera",brand:"KBVision",model:"KX-Y4002AN3",subcategory:"Camera trong nhà",product_type:"Eyeball IP",url:"https://kbvisiongroup.com/product/kx-y4002an3.html"},
  {kind:"camera",brand:"KBVision",model:"KX-CAi4204N2-AB",subcategory:"Camera ngoài trời",product_type:"Dome AI IP",discover:["https://kbvision.vn/","https://kbvisiongroup.com/product.html"]},

  // ===== NETWORK: TP-LINK OMADA =====
  {kind:"network",brand:"TP-Link",model:"EAP723",subcategory:"Access Point",product_type:"Wi-Fi 7",discover:["https://www.tp-link.com/us/business-networking/omada/wifi/wifi-7/"]},
  {kind:"network",brand:"TP-Link",model:"EAP772",subcategory:"Access Point",product_type:"Wi-Fi 7",discover:["https://www.tp-link.com/us/business-networking/omada/wifi/wifi-7/"]},
  {kind:"network",brand:"TP-Link",model:"EAP773",subcategory:"Access Point",product_type:"Wi-Fi 7",discover:["https://www.tp-link.com/us/business-networking/omada/wifi/wifi-7/"]},
  {kind:"network",brand:"TP-Link",model:"EAP725-Outdoor",subcategory:"Access Point",product_type:"Wi-Fi 7 Outdoor",discover:["https://www.tp-link.com/us/business-networking/omada/wifi/wifi-7/"]},
  {kind:"network",brand:"TP-Link",model:"EAP775-Outdoor",subcategory:"Access Point",product_type:"Wi-Fi 7 Outdoor",discover:["https://www.tp-link.com/us/business-networking/omada/wifi/wifi-7/"]},
  {kind:"network",brand:"TP-Link",model:"SG2210P",subcategory:"Switch",product_type:"Managed PoE+",discover:["https://www.tp-link.com/us/business-networking/omada/switch/managed/"]},
  {kind:"network",brand:"TP-Link",model:"SG2210XMP-M2",subcategory:"Switch",product_type:"2.5G Managed PoE+",discover:["https://www.tp-link.com/us/business-networking/omada/switch/managed/"]},
  {kind:"network",brand:"TP-Link",model:"SG3428XPP-M2",subcategory:"Switch",product_type:"2.5G Managed PoE++",url:"https://www.tp-link.com/vn/business-networking/omada-sdn-switch/tl-sg3428xpp-m2/v1/"},
  {kind:"network",brand:"TP-Link",model:"SG3210X-M2",subcategory:"Switch",product_type:"2.5G Managed",url:"https://www.tp-link.com/vn/business-networking/omada-sdn-switch/sg3210x-m2/v1/"},
  {kind:"network",brand:"TP-Link",model:"ER707-M2",subcategory:"Router",product_type:"2.5G VPN Router",discover:["https://www.tp-link.com/us/business-networking/omada/router/"]},

  // ===== NETWORK: HPE INSTANT ON ("HP") =====
  {kind:"network",brand:"HPE Instant On",model:"AP22",subcategory:"Access Point",product_type:"Wi-Fi 6",discover:["https://www.hpe.com/us/en/instant-on/access-points.html","https://www.hpe.com/us/en/instant-on/resources.html"]},
  {kind:"network",brand:"HPE Instant On",model:"AP25",subcategory:"Access Point",product_type:"Wi-Fi 6",discover:["https://www.hpe.com/us/en/instant-on/access-points.html","https://www.hpe.com/us/en/instant-on/resources.html"]},
  {kind:"network",brand:"HPE Instant On",model:"AP27",subcategory:"Access Point",product_type:"Outdoor Wi-Fi 6",discover:["https://www.hpe.com/us/en/instant-on/access-points.html","https://www.hpe.com/us/en/instant-on/resources.html"]},
  {kind:"network",brand:"HPE Instant On",model:"AP32",subcategory:"Access Point",product_type:"Wi-Fi 6E",discover:["https://www.hpe.com/us/en/instant-on/access-points.html","https://www.hpe.com/us/en/instant-on/resources.html"]},
  {kind:"network",brand:"HPE Instant On",model:"1930 Switch Series",subcategory:"Switch",product_type:"Smart Managed",url:"https://www.hpe.com/us/en/instant-on/switches.html",imageKey:"1930"},
  {kind:"network",brand:"HPE Instant On",model:"1960 Switch Series",subcategory:"Switch",product_type:"Smart Managed 10G",url:"https://www.hpe.com/us/en/collaterals/collateral.a50002593enw.html",imageKey:"1960"},

  // ===== NETWORK: CISCO =====
  {kind:"network",brand:"Cisco",model:"C1300-8P-E-2G",subcategory:"Switch",product_type:"Catalyst 1300 PoE+",url:"https://www.cisco.com/c/en/us/products/collateral/switches/catalyst-1300-series-switches/nb-06-cat1300-ser-data-sheet-cte-en.html",imageKey:"Catalyst 1300"},
  {kind:"network",brand:"Cisco",model:"C1300-16P-2G",subcategory:"Switch",product_type:"Catalyst 1300 PoE+",url:"https://www.cisco.com/c/en/us/products/collateral/switches/catalyst-1300-series-switches/nb-06-cat1300-ser-data-sheet-cte-en.html",imageKey:"Catalyst 1300"},
  {kind:"network",brand:"Cisco",model:"C1300-24P-4G",subcategory:"Switch",product_type:"Catalyst 1300 PoE+",url:"https://www.cisco.com/c/en/us/products/collateral/switches/catalyst-1300-series-switches/nb-06-cat1300-ser-data-sheet-cte-en.html",imageKey:"Catalyst 1300"},
  {kind:"network",brand:"Cisco",model:"C1300-24P-4X",subcategory:"Switch",product_type:"Catalyst 1300 10G Uplink",url:"https://www.cisco.com/c/en/us/products/collateral/switches/catalyst-1300-series-switches/nb-06-cat1300-ser-data-sheet-cte-en.html",imageKey:"Catalyst 1300"},
  {kind:"network",brand:"Cisco",model:"C1300-24MGP-4X",subcategory:"Switch",product_type:"Catalyst 1300 Multi-Gig PoE+",url:"https://www.cisco.com/c/en/us/products/collateral/switches/catalyst-1300-series-switches/nb-06-cat1300-ser-data-sheet-cte-en.html",imageKey:"Catalyst 1300"},

  // ===== NETWORK: HPE ARUBA NETWORKING =====
  {kind:"network",brand:"Aruba",model:"CX 6000 Switch Series",subcategory:"Switch",product_type:"Managed L2",url:"https://buy.hpe.com/us/en/networking/switches/fixed-port-l3-managed-ethernet-switches/hpe-aruba-networking-cx-6000-switch-series/p/1014098570",imageKey:"CX 6000"},
  {kind:"network",brand:"Aruba",model:"CX 6100 Switch Series",subcategory:"Switch",product_type:"Managed L2 10G Uplink",url:"https://buy.hpe.com/us/en/networking/switches/fixed-port-l3-managed-ethernet-switches/hpe-aruba-networking-cx-6100-switch-series/p/1013114991",imageKey:"CX 6100"},
  {kind:"network",brand:"Aruba",model:"650 Series Campus AP",subcategory:"Access Point",product_type:"Wi-Fi 6E",url:"https://www.hpe.com/psnow/partner/doc/a50004266enw",imageKey:"650 Series"},
  {kind:"network",brand:"Aruba",model:"740 Series Campus AP",subcategory:"Access Point",product_type:"Wi-Fi 7",discover:["https://www.hpe.com/us/en/products/networking/wireless-devices.html","https://www.hpe.com/us/en/networking/hpe-aruba-networking.html"],imageKey:"740 Series"}
];

const clean=s=>String(s||"").replace(/\u00a0/g," ").replace(/[ \t]+/g," ").replace(/\n{3,}/g,"\n\n").trim();
const norm=s=>String(s||"").toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}]+/gu,"");
const slug=s=>String(s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/đ/g,"d").replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"");

function productId(t){ return `${slug(t.brand)}-${slug(t.model)}`; }
function csv(v){ return `"${String(v??"").replace(/"/g,'""')}"`; }
function extFrom(ct,u){
  ct=String(ct||"").toLowerCase();
  if(ct.includes("png"))return ".png";
  if(ct.includes("webp"))return ".webp";
  if(ct.includes("jpeg")||ct.includes("jpg"))return ".jpg";
  const m=String(u||"").match(/\.(png|jpe?g|webp)(?:[?#]|$)/i);
  return m?"."+m[1].toLowerCase().replace("jpeg","jpg"):".jpg";
}
function load(file){
  if(!fs.existsSync(file))return {raw:{items:[]},items:[],wrapped:true};
  const raw=JSON.parse(fs.readFileSync(file,"utf8"));
  if(Array.isArray(raw))return {raw,items:raw,wrapped:false};
  if(raw&&Array.isArray(raw.items))return {raw,items:raw.items,wrapped:true};
  throw new Error(`${file} must be array or {items:[...]}`);
}
function save(file,raw,items,wrapped){
  fs.writeFileSync(file,JSON.stringify(wrapped?{...raw,items}:items,null,2)+"\n");
}

async function discoverUrl(page,t){
  if(t.url)return t.url;
  const key=norm(t.model);
  const family=norm(t.imageKey||t.model);
  for(const base of (t.discover||[])){
    try{
      const r=await page.goto(base,{waitUntil:"domcontentloaded",timeout:90000});
      if(!r||r.status()>=400)continue;
      await page.waitForTimeout(3500);
      const links=await page.locator("a").evaluateAll(as=>as.map(a=>({
        text:(a.innerText||a.textContent||"").replace(/\s+/g," ").trim(),
        href:a.href||""
      })).filter(x=>x.href));
      const hits=links.filter(l=>{
        const hay=norm(l.text+" "+l.href);
        return hay.includes(key)||hay.includes(family);
      });
      if(hits.length){
        hits.sort((a,b)=>{
          const ae=norm(a.text)===key?1:0,be=norm(b.text)===key?1:0;
          return be-ae||a.text.length-b.text.length;
        });
        return hits[0].href;
      }
    }catch{}
  }
  return null;
}

async function extractDetails(page,t){
  const pairs=await page.evaluate(()=>{
    const c=s=>String(s||"").replace(/\s+/g," ").trim();
    const out=[];
    const selectors=[
      "tr","dl",".spec-item",".specification-item",".parameter-item",
      ".product-specs__row",".tech-specs__row",".specs-row",".table-row"
    ];
    for(const sel of selectors){
      for(const el of document.querySelectorAll(sel)){
        const cells=[...el.querySelectorAll("th,td,dt,dd,.name,.label,.value,.key,.title,.content")]
          .map(x=>c(x.innerText||x.textContent)).filter(Boolean);
        if(cells.length>=2)out.push([cells[0],cells.slice(1).join(" ")]);
      }
    }
    return out;
  });

  const useful=[],seen=new Set();
  for(const [k0,v0] of pairs){
    const k=clean(k0),v=clean(v0);
    if(!k||!v||k.length>100||v.length>900)continue;
    if(k===v)continue;
    const kk=k.toLowerCase();
    if(seen.has(kk))continue;
    if(/cookie|privacy|contact|support|download|related|compare|price/i.test(k))continue;
    seen.add(kk);useful.push([k,v]);
    if(useful.length>=18)break;
  }

  const body=clean(await page.locator("body").innerText());
  const lines=body.split("\n").map(clean).filter(Boolean);
  const features=[];
  for(const line of lines){
    if(line.length<18||line.length>220)continue;
    if(/(resolution|image sensor|poe|wi-?fi|switching capacity|uplink|ethernet|sfp|port|bandwidth|wdr|illumination|lens|microphone|storage|routing|vlan|managed|802\.11|wireless|throughput|power budget|client|radio|mimo|security|cloud)/i.test(line)){
      if(!features.includes(line))features.push(line);
    }
    if(features.length>=8)break;
  }

  return {pairs:useful,features,body};
}

async function extractImages(page,t,outDir,context){
  const imageKey=t.imageKey||t.model;
  const imgs=await page.locator("img").evaluateAll((els,key)=>{
    const n=s=>String(s||"").toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}]+/gu,"");
    const k=n(key);
    return els.map((img,idx)=>{
      const src=img.currentSrc||img.src||img.getAttribute("data-src")||img.getAttribute("data-original")||"";
      const alt=img.alt||"",title=img.title||"";
      const w=img.naturalWidth||img.width||0,h=img.naturalHeight||img.height||0;
      let score=0;
      if(n(alt).includes(k))score+=1000;
      if(n(title).includes(k))score+=750;
      if(n(src).includes(k))score+=500;
      if(/product|gallery|swiper|carousel|detail|goods|image|hero|family/i.test(src))score+=120;
      if(w>=1200)score+=180; else if(w>=800)score+=130; else if(w>=500)score+=80; else if(w>=300)score+=30;
      if(h>=220)score+=30;
      if(/logo|icon|qr|favicon|loading|placeholder|banner|wechat|facebook|youtube|arrow|close|avatar|flag/i.test(src))score-=1500;
      if(w<260||h<160)score-=500;
      return {idx,src,score,w,h};
    }).filter(x=>x.src&&x.score>0);
  },imageKey);

  imgs.sort((a,b)=>b.score-a.score||(b.w*b.h)-(a.w*a.h));
  const uniq=[],seen=new Set();
  for(const x of imgs){
    const u=x.src.split("#")[0];
    if(seen.has(u))continue;
    seen.add(u);uniq.push(x);
    if(uniq.length>=16)break;
  }

  const tmp=outDir+"-tmp";
  fs.rmSync(tmp,{recursive:true,force:true});
  fs.mkdirSync(tmp,{recursive:true});
  const saved=[];

  for(const x of uniq){
    if(saved.length>=MAX_IMAGES)break;
    try{
      const r=await context.request.get(x.src,{timeout:30000,headers:{Referer:page.url()}});
      if(!r.ok())continue;
      const ct=r.headers()["content-type"]||"";
      const buf=await r.body();
      if(!ct.startsWith("image/")||buf.length<22000)continue;
      const dest=path.join(tmp,`image-${saved.length+1}${extFrom(ct,x.src)}`);
      fs.writeFileSync(dest,buf);
      saved.push(dest);
    }catch{}
  }

  if(!saved.length){
    fs.rmSync(tmp,{recursive:true,force:true});
    return [];
  }

  fs.rmSync(outDir,{recursive:true,force:true});
  fs.renameSync(tmp,outDir);

  return fs.readdirSync(outDir)
    .filter(f=>/^image-\d+\.(png|jpe?g|webp)$/i.test(f))
    .sort((a,b)=>Number((a.match(/\d+/)||[0])[0])-Number((b.match(/\d+/)||[0])[0]))
    .map(f=>path.join(outDir,f).replace(/\\/g,"/"));
}

async function main(){
  const cam=load(CAMERA_FILE),net=load(NETWORK_FILE);
  fs.mkdirSync("reports",{recursive:true});
  fs.mkdirSync("media",{recursive:true});

  const browser=await chromium.launch({headless:true});
  const context=await browser.newContext({
    viewport:{width:1440,height:1200},
    locale:"en-US",
    userAgent:"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36"
  });
  const page=await context.newPage();

  const acceptedCam=[],acceptedNet=[],report=[];

  for(let i=0;i<targets.length;i++){
    const t=targets[i],id=productId(t);
    console.log(`[${i+1}/${targets.length}] ${t.brand} ${t.model}`);

    try{
      const url=await discoverUrl(page,t);
      if(!url)throw new Error("No official product URL discovered");

      const r=await page.goto(url,{waitUntil:"domcontentloaded",timeout:90000});
      if(!r||r.status()>=400)throw new Error(`Official page HTTP ${r?r.status():"?"}`);
      await page.waitForTimeout(4200);

      await page.evaluate(async()=>{
        for(let y=0;y<document.body.scrollHeight;y+=900){
          window.scrollTo(0,y);
          await new Promise(r=>setTimeout(r,80));
        }
        window.scrollTo(0,0);
      });
      await page.waitForTimeout(1000);

      const details=await extractDetails(page,t);
      const modelKey=norm(t.model.replace(/\s+series$/i,""));
      if(!norm(details.body).includes(modelKey)){
        throw new Error("Official page does not contain target model/family");
      }

      const detailCount=details.pairs.length+Math.min(details.features.length,5);
      if(detailCount<MIN_DETAILS){
        throw new Error(`Insufficient official details (${detailCount})`);
      }

      const outDir=path.join("media",id);
      const images=await extractImages(page,t,outDir,context);
      if(!images.length)throw new Error("No usable official product image");

      const desc=[
        "Thông số chính:",
        ...details.pairs.slice(0,16).map(([k,v])=>`• ${k}: ${v}`),
        ...(details.features.length?["","Tính năng nổi bật:",...details.features.slice(0,6).map(x=>`• ${x}`)]:[])
      ].join("\n");

      const item={
        id,
        name:`${t.brand} ${t.model}`,
        category:t.kind==="camera"?"Camera":"Thiết bị mạng",
        subcategory:t.subcategory,
        product_type:t.product_type||"",
        brand:t.brand,
        price:0,
        old_price:0,
        warranty:"",
        shopee_link:"",
        images,
        video:"",
        featured:false,
        description:desc,
        source_policy:"multibrand-official-one-shot",
        official_page:page.url()
      };

      if(t.kind==="camera")acceptedCam.push(item); else acceptedNet.push(item);
      report.push([t.kind,t.brand,t.model,"ACCEPTED",images.length,detailCount,page.url(),""]);
      console.log(`  ACCEPTED: ${images.length} images, ${detailCount} details`);

    }catch(e){
      fs.rmSync(path.join("media",id+"-tmp"),{recursive:true,force:true});
      report.push([t.kind,t.brand,t.model,"DROPPED",0,0,t.url||"",String(e.message||e)]);
      console.log(`  DROPPED: ${e.message}`);
    }
  }

  await browser.close();

  const targetCamIds=new Set(targets.filter(t=>t.kind==="camera").map(productId));
  const targetNetIds=new Set(targets.filter(t=>t.kind==="network").map(productId));

  const camKeep=cam.items.filter(p=>!targetCamIds.has(String(p.id||"")));
  const netKeep=net.items.filter(p=>!targetNetIds.has(String(p.id||"")));

  save(CAMERA_FILE,cam.raw,[...camKeep,...acceptedCam],cam.wrapped);
  save(NETWORK_FILE,net.raw,[...netKeep,...acceptedNet],net.wrapped);

  const header=["kind","brand","model","status","image_count","detail_count","official_page","note"];
  fs.writeFileSync(REPORT_FILE,[header,...report].map(r=>r.map(csv).join(",")).join("\n")+"\n");

  const byBrand={};
  for(const r of report){
    const b=r[1]; byBrand[b]??={accepted:0,dropped:0};
    if(r[3]==="ACCEPTED")byBrand[b].accepted++; else byBrand[b].dropped++;
  }
  console.log("\nSUMMARY");
  for(const [b,s] of Object.entries(byBrand))console.log(`${b}: accepted ${s.accepted}, dropped ${s.dropped}`);
  console.log(`Camera accepted: ${acceptedCam.length}`);
  console.log(`Network accepted: ${acceptedNet.length}`);

  if(!acceptedCam.length && !acceptedNet.length){
    throw new Error("No products accepted; refusing to publish empty import.");
  }
}

main().catch(e=>{console.error(e);process.exit(1);});
