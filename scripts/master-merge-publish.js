const fs=require("fs"),path=require("path");
const cfg=JSON.parse(fs.readFileSync("config/master-official-2025plus.json","utf8"));
const BUILD="downloaded-master";
const targets={camera:"products-camera.json",network:"products-network.json",computer:"products-computer.json",printer:"products-printer.json"};

function readItems(file){
 if(!fs.existsSync(file))return [];
 const raw=JSON.parse(fs.readFileSync(file,"utf8"));
 return Array.isArray(raw)?raw:(Array.isArray(raw.items)?raw.items:[]);
}
function key(p){return String(p.official_url||p.id||p.name||"").trim().toLowerCase()}

const incoming={camera:[],network:[],computer:[],printer:[]};
for(const g of cfg.groups){
 const f=path.join(BUILD,g.key,"products.json");
 if(!fs.existsSync(f))continue;
 const raw=JSON.parse(fs.readFileSync(f,"utf8"));
 incoming[g.target].push(...(raw.items||[]));
}

// Copy all downloaded media into repo.
function copyTree(src,dst){
 if(!fs.existsSync(src))return;
 fs.mkdirSync(dst,{recursive:true});
 for(const e of fs.readdirSync(src,{withFileTypes:true})){
  const s=path.join(src,e.name),d=path.join(dst,e.name);
  if(e.isDirectory())copyTree(s,d);else fs.copyFileSync(s,d);
 }
}
for(const g of cfg.groups){
 const src=path.join(BUILD,g.key,"media");
 const dst=path.join("media","official-2025plus-master",g.key);
 copyTree(src,dst);
}
// Rewrite image paths from build/master/... to live media path.
for(const g of cfg.groups){
 for(const p of incoming[g.target]){
  p.images=(p.images||[]).map(x=>{
   const marker=`build/master/${g.key}/media/`;
   const i=String(x).replace(/\\/g,"/").indexOf(marker);
   return i>=0 ? `media/official-2025plus-master/${g.key}/`+String(x).replace(/\\/g,"/").slice(i+marker.length) : x;
  });
 }
}

for(const [target,live] of Object.entries(targets)){
 const current=readItems(live);
 // Remove only prior automated catalog entries. Preserve manual/CMS products.
 const manual=current.filter(p=>String(p.source_policy||"")!=="official-only-2025plus-master");
 const merged=[...manual];
 const seen=new Set(manual.map(key).filter(Boolean));
 for(const p of incoming[target]){
  const k=key(p);if(!k||seen.has(k))continue;seen.add(k);merged.push(p);
 }
 fs.writeFileSync(live,JSON.stringify({items:merged},null,2)+"\n","utf8");
 console.log(`${live}: manual ${manual.length}, new official ${incoming[target].length}, total ${merged.length}`);
}

// Aggregate reports for QA.
fs.mkdirSync("reports/official-2025plus-master",{recursive:true});
let all="group,brand,name,status,spec_count,image_count,official_url\n";
for(const g of cfg.groups){
 const f=path.join(BUILD,g.key,"report.csv");if(!fs.existsSync(f))continue;
 const lines=fs.readFileSync(f,"utf8").trim().split(/\r?\n/).slice(1);
 for(const line of lines)all+=`"${g.key}",`+line+"\n";
}
fs.writeFileSync("reports/official-2025plus-master/master-report.csv",all);
