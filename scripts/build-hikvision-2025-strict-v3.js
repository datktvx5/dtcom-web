const fs=require("fs"),path=require("path"),crypto=require("crypto"),cp=require("child_process");
const cfg=JSON.parse(fs.readFileSync("config/hikvision-2025-strict.json","utf8"));

const OUT="imports/official-2025plus-v4/hikvision-v3";
const MEDIA="media/official-2025plus-v4/camera/hikvision-v3";
const REPORT="reports/official-2025plus-v4/hikvision-v3";
for(const d of [OUT,MEDIA,REPORT])fs.mkdirSync(d,{recursive:true});

const slug=s=>String(s||"").toLowerCase().replace(/[()\/]/g,"-").replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"");

async function fetchBin(url,accept="application/pdf"){
  const c=new AbortController(),t=setTimeout(()=>c.abort(),25000);
  try{
    const r=await fetch(url,{
      redirect:"follow",
      signal:c.signal,
      headers:{
        "user-agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
        "accept":accept
      }
    });
    const b=Buffer.from(await r.arrayBuffer());
    return {ok:r.ok,status:r.status,url:r.url,headers:r.headers,buf:b};
  }finally{clearTimeout(t)}
}

function run(cmd,args){
  const r=cp.spawnSync(cmd,args,{encoding:"utf8"});
  return {status:r.status,stdout:r.stdout||"",stderr:r.stderr||""};
}

function extractSpecs(txt){
  const lines=String(txt||"").split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  const keys=[
    "Image Sensor","Max. Resolution","Min. Illumination","Shutter Time","Day & Night",
    "Lens Type","Focal Length & FOV","Aperture","Supplement Light Range","Supplement Light Type",
    "Main Stream","Video Compression","Audio Type","Built-in Microphone","Protocols",
    "Ethernet Interface","Power","Power Supply","Power Consumption","Material",
    "Dimension","Dimensions","Weight","Storage Conditions","Startup and Operating Conditions",
    "Protection","IP67","IK10"
  ];
  const out=[];
  for(let i=0;i<lines.length;i++){
    const line=lines[i];
    for(const k of keys){
      if(line.toLowerCase().startsWith(k.toLowerCase())){
        let v=line.slice(k.length).replace(/^[:\s-]+/,"").trim();
        if(!v && lines[i+1] && lines[i+1].length<350)v=lines[i+1];
        if(v)out.push([k,v]);
        break;
      }
    }
  }
  const seen=new Set(),clean=[];
  for(const x of out){
    const k=x[0].toLowerCase();
    if(seen.has(k))continue;
    seen.add(k);clean.push(x);
  }
  return clean.slice(0,16);
}

function imageInfo(file){
  const r=run("identify",["-format","%w %h",file]);
  if(r.status!==0)return null;
  const m=r.stdout.trim().match(/^(\d+)\s+(\d+)$/);
  if(!m)return null;
  return {w:Number(m[1]),h:Number(m[2]),area:Number(m[1])*Number(m[2])};
}

function sha1(file){
  return crypto.createHash("sha1").update(fs.readFileSync(file)).digest("hex");
}

function extractOfficialImages(pdfPath,model){
  const tmp=path.join("/tmp","hik-"+slug(model));
  fs.rmSync(tmp,{recursive:true,force:true});
  fs.mkdirSync(tmp,{recursive:true});

  // First page only: this is where Hikvision places the actual product photo.
  const prefix=path.join(tmp,"img");
  run("pdfimages",["-f","1","-l","1","-png",pdfPath,prefix]);

  const candidates=[];
  for(const f of fs.readdirSync(tmp)){
    if(!/^img-\d+\.png$/i.test(f))continue;
    const full=path.join(tmp,f),info=imageInfo(full);
    if(!info)continue;

    // Reject feature icons / logos. Keep only substantial raster objects.
    if(info.w<280 || info.h<180 || info.area<70000)continue;
    candidates.push({file:full,...info});
  }

  candidates.sort((a,b)=>b.area-a.area);

  const destDir=path.join(MEDIA,slug(model));
  fs.mkdirSync(destDir,{recursive:true});
  const hashes=new Set(),out=[];

  for(const c of candidates){
    if(out.length>=5)break;
    const h=sha1(c.file);
    if(hashes.has(h))continue;
    hashes.add(h);

    const dest=path.join(destDir,`image-${out.length+1}.png`);
    fs.copyFileSync(c.file,dest);
    out.push(dest.replace(/\\/g,"/"));
  }
  return out;
}

function desc(model,specs){
  return [
    `Hikvision ${model}`,
    "",
    "Thông số chính:",
    ...specs.map(([k,v])=>`• ${k}: ${v}`)
  ].join("\n");
}

(async()=>{
  const items=[],report=[];

  for(const p of cfg.products){
    process.stdout.write(`${p.model} ... `);
    let pdfStatus="",specCount=0,imageCount=0;

    try{
      const r=await fetchBin(p.official_datasheet);
      pdfStatus=`HTTP_${r.status}`;
      if(!r.ok){
        report.push([p.model,"DROPPED_DATASHEET_ERROR",0,0,pdfStatus,p.official_datasheet]);
        console.log(`DROP ${pdfStatus}`);
        continue;
      }

      const pdfPath=path.join("/tmp",slug(p.model)+".pdf");
      fs.writeFileSync(pdfPath,r.buf);

      const txtPath=path.join("/tmp",slug(p.model)+".txt");
      const tx=run("pdftotext",["-layout",pdfPath,txtPath]);
      if(tx.status!==0 || !fs.existsSync(txtPath)){
        report.push([p.model,"DROPPED_PDFTEXT_FAILED",0,0,pdfStatus,p.official_datasheet]);
        console.log("DROP text");
        continue;
      }

      const text=fs.readFileSync(txtPath,"utf8");
      const specs=extractSpecs(text);
      specCount=specs.length;

      // Image source is also the official Hikvision datasheet.
      const images=extractOfficialImages(pdfPath,p.model);
      imageCount=images.length;

      if(!imageCount){
        report.push([p.model,"DROPPED_NO_OFFICIAL_IMAGE",0,specCount,pdfStatus,p.official_datasheet]);
        console.log(`DROP no image (${specCount} specs)`);
        continue;
      }
      if(specCount<3){
        report.push([p.model,"DROPPED_INSUFFICIENT_SPECS",imageCount,specCount,pdfStatus,p.official_datasheet]);
        console.log(`DROP specs ${specCount}`);
        continue;
      }

      items.push({
        id:"hikvision-"+slug(p.model),
        name:`Hikvision ${p.model}`,
        brand:"Hikvision",
        subcategory:"Camera",
        product_type:p.product_type,
        images,
        featured:false,
        description:desc(p.model,specs),
        official_url:p.official_url,
        official_datasheet:p.official_datasheet,
        release_year:p.release_year,
        source_policy:"official-only"
      });

      report.push([p.model,"ACCEPTED",imageCount,specCount,pdfStatus,p.official_datasheet]);
      console.log(`OK ${imageCount} image(s), ${specCount} specs`);
    }catch(e){
      report.push([p.model,"ERROR",imageCount,specCount,pdfStatus||"FETCH_ERROR",p.official_datasheet]);
      console.log("ERROR",e.message);
    }
  }

  fs.writeFileSync(
    path.join(OUT,"products-camera-hikvision.json"),
    JSON.stringify({items},null,2)+"\n",
    "utf8"
  );

  const csv=
    "model,status,image_count,spec_count,datasheet_status,official_datasheet\n"+
    report.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n")+
    "\n";
  fs.writeFileSync(path.join(REPORT,"hikvision-v3-report.csv"),csv,"utf8");

  console.log(`Accepted ${items.length}/${cfg.products.length}`);
})().catch(e=>{console.error(e);process.exit(1)});
