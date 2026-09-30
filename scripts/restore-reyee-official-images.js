const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
const cp=require('child_process');

const FILE='products-network.json';
const REPORT='reports/reyee-image-restore-official.csv';
const ROOT='media/reyee-clean';
const MAX_IMAGES=5;

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const norm=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
const slug=s=>String(s||'').toLowerCase().replace(/[()]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');

function getItems(raw){
  if(Array.isArray(raw)) return {items:raw,wrapped:false};
  return {items:Array.isArray(raw?.items)?raw.items:[],wrapped:true};
}
function modelFromName(name){return String(name||'').replace(/^Reyee\s+/i,'').trim()}
function run(cmd,args){const r=cp.spawnSync(cmd,args,{encoding:'utf8'});return {status:r.status,stdout:r.stdout||'',stderr:r.stderr||''}}
function identify(file){
  const r=run('identify',['-format','%w %h',file]);
  const m=r.stdout.trim().match(/^(\d+)\s+(\d+)$/);
  return m?{w:+m[1],h:+m[2],area:+m[1]*+m[2]}:null;
}
function abs(u,base){
  try{u=String(u||'').replace(/&amp;/g,'&').replace(/\\\//g,'/');if(u.startsWith('//'))u='https:'+u;return new URL(u,base).href}catch{return null}
}
async function fetchText(url){
  const c=new AbortController(),t=setTimeout(()=>c.abort(),15000);
  try{
    const r=await fetch(url,{redirect:'follow',signal:c.signal,headers:{
      'user-agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
      'accept-language':'en-US,en;q=0.9'
    }});
    if(!r.ok) throw new Error('HTTP '+r.status);
    return {html:await r.text(),url:r.url};
  } finally {clearTimeout(t)}
}
function exactModelInPage(html,url,model){
  const n=norm(model);
  const title=((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)||[])[1]||'');
  const h1=((html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)||[])[1]||'');
  return norm(title).includes(n)||norm(h1).includes(n)||norm(url).includes(n);
}
function candidatePages(model,subcategory){
  const m=slug(model).replace(/^rg-/,'');
  const rg=slug(model);
  const base='https://reyee.ruijie.com/en-global/products';
  const vi='https://reyee.ruijie.com/vi-vn/products';
  let out=[];
  if(subcategory==='Access Point'){
    const paths=['reyee-wireless/reyee-indoor-ap','reyee-wireless/reyee-wall-ap','reyee-wireless/reyee-outdoor-ap'];
    for(const p of paths){
      out.push(`${base}/${p}/${m}/`,`${base}/${p}/${rg}/`,`${vi}/${p}/${m}/`,`${vi}/${p}/${rg}/`);
    }
  } else if(subcategory==='Switch'){
    const paths=['reyee-switch','reyee-switch/l2-managed-switch','reyee-switch/l3-managed-switch','reyee-switch/unmanaged-switch','reyee-switch/industrial-switch','reyee-switch/smart-cctv-switch'];
    for(const p of paths){
      out.push(`${base}/${p}/${m}/`,`${base}/${p}/${rg}/`,`${vi}/${p}/${m}/`,`${vi}/${p}/${rg}/`);
    }
  } else if(subcategory==='Router'){
    const paths=['reyee-router/eg-series','reyee-router/cloud-managed-router','reyee-router'];
    for(const p of paths){
      out.push(`${base}/${p}/${m}/`,`${base}/${p}/${rg}/`,`${vi}/${p}/${m}/`,`${vi}/${p}/${rg}/`);
    }
  }
  return [...new Set(out)];
}
function imageCandidates(html,pageUrl,model){
  const out=[];
  const n=norm(model);
  const add=(raw,score=0,alt='')=>{
    const u=abs(raw,pageUrl);if(!u||!/^https?:/i.test(u))return;
    if(!/\.(png|jpe?g|webp)(\?|$)/i.test(u))return;
    const low=u.toLowerCase();
    if(/logo|favicon|icon|flag|qr|sprite|loading|placeholder|banner|avatar|wechat|facebook|youtube|close|arrow|footer|header/i.test(low))score-=200;
    if(norm(u).includes(n))score+=150;
    if(norm(alt).includes(n))score+=200;
    if(/product|gallery|upload|image|images|detail|goods/i.test(low))score+=20;
    out.push({url:u,score});
  };
  for(const m of html.matchAll(/<img\b[^>]*>/gi)){
    const tag=m[0];
    const alt=((tag.match(/\b(?:alt|title)=["']([^"']*)["']/i)||[])[1]||'');
    for(const x of tag.matchAll(/\b(?:src|data-src|data-original|data-lazy-src|data-zoom-image)=["']([^"']+)["']/gi))add(x[1],0,alt);
    const ss=((tag.match(/\bsrcset=["']([^"']+)["']/i)||[])[1]||'');
    if(ss)for(const p of ss.split(','))add(p.trim().split(/\s+/)[0],5,alt);
  }
  for(const m of html.matchAll(/<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image)["'][^>]+content=["']([^"']+)["']/gi))add(m[1],80,'');
  // Catch gallery assets embedded in JSON/script blocks.
  for(const m of html.matchAll(/https?:\\?\/\\?\/[^"'<>\\\s]+?\.(?:png|jpe?g|webp)(?:\?[^"'<>\\\s]*)?/gi))add(m[0].replace(/\\\//g,'/'),0,'');
  const best=new Map();
  for(const x of out)if(!best.has(x.url)||best.get(x.url).score<x.score)best.set(x.url,x);
  return [...best.values()].sort((a,b)=>b.score-a.score);
}
async function downloadGallery(cands,dir,pageUrl){
  const tmp=dir+'-new';fs.rmSync(tmp,{recursive:true,force:true});fs.mkdirSync(tmp,{recursive:true});
  const kept=[],hashes=new Set();
  for(const c of cands.slice(0,60)){
    if(kept.length>=MAX_IMAGES)break;
    try{
      const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),12000);
      let r;
      try{r=await fetch(c.url,{redirect:'follow',signal:ctrl.signal,headers:{'user-agent':'Mozilla/5.0','referer':pageUrl}})}finally{clearTimeout(timer)}
      if(!r.ok)continue;
      const ct=r.headers.get('content-type')||'';if(!ct.startsWith('image/'))continue;
      const buf=Buffer.from(await r.arrayBuffer());if(buf.length<18000)continue;
      const ext=ct.includes('png')?'.png':ct.includes('webp')?'.webp':'.jpg';
      const f=path.join(tmp,`candidate-${kept.length+1}${ext}`);fs.writeFileSync(f,buf);
      const inf=identify(f);if(!inf||inf.w<420||inf.h<220||inf.area<130000){fs.rmSync(f,{force:true});continue}
      const h=crypto.createHash('sha1').update(buf).digest('hex');if(hashes.has(h)){fs.rmSync(f,{force:true});continue}hashes.add(h);
      // Reject extreme banners / strips.
      const ratio=Math.max(inf.w/inf.h,inf.h/inf.w);if(ratio>5.5){fs.rmSync(f,{force:true});continue}
      kept.push({file:f,score:c.score+Math.min(inf.area/10000,100),inf});
    }catch{}
  }
  kept.sort((a,b)=>b.score-a.score);
  if(!kept.length){fs.rmSync(tmp,{recursive:true,force:true});return []}
  fs.rmSync(dir,{recursive:true,force:true});fs.mkdirSync(dir,{recursive:true});
  const out=[];
  kept.slice(0,MAX_IMAGES).forEach((x,i)=>{
    const ext=path.extname(x.file);const dest=path.join(dir,`image-${i+1}${ext}`);fs.copyFileSync(x.file,dest);out.push(dest.replace(/\\/g,'/'));
  });
  fs.rmSync(tmp,{recursive:true,force:true});
  return out;
}

(async()=>{
  if(!fs.existsSync(FILE))throw new Error('Missing '+FILE);
  const raw=JSON.parse(fs.readFileSync(FILE,'utf8')),info=getItems(raw);
  const products=info.items.filter(p=>String(p.brand||'').toLowerCase()==='reyee' || /^Reyee\s+/i.test(String(p.name||'')));
  const report=[];
  console.log('Reyee products:',products.length);
  for(let i=0;i<products.length;i++){
    const p=products[i],model=modelFromName(p.name),dir=path.join(ROOT,p.id||slug(model));
    process.stdout.write(`[${i+1}/${products.length}] ${model} ... `);
    let foundPage=null,html='';
    for(const u of candidatePages(model,p.subcategory)){
      try{
        const r=await fetchText(u);
        if(exactModelInPage(r.html,r.url,model)){foundPage=r.url;html=r.html;break}
      }catch{}
    }
    if(!foundPage){report.push([model,'KEEP_CURRENT_NO_OFFICIAL_PAGE',(p.images||[]).length,'']);console.log('keep current');continue}
    const cands=imageCandidates(html,foundPage,model);
    const imgs=await downloadGallery(cands,dir,foundPage);
    if(imgs.length){
      p.images=imgs;report.push([model,'RESTORED',imgs.length,foundPage]);console.log(`${imgs.length} image(s)`);
    }else{
      report.push([model,'KEEP_CURRENT_NO_GOOD_GALLERY',(p.images||[]).length,foundPage]);console.log('keep current');
    }
    await sleep(150);
  }
  fs.writeFileSync(FILE,JSON.stringify(info.wrapped?{...raw,items:info.items}:info.items,null,2)+'\n','utf8');
  fs.mkdirSync('reports',{recursive:true});
  fs.writeFileSync(REPORT,'model,status,image_count,official_page\n'+report.map(r=>r.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(',')).join('\n')+'\n','utf8');
  console.log('Done');
})().catch(e=>{console.error(e);process.exit(1)});
