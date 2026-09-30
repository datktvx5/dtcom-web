const fs=require("fs"), path=require("path");

const files=[
  "products-camera.json",
  "products-network.json",
  "products-computer.json",
  "products-printer.json"
];

function read(file){
  if(!fs.existsSync(file)) return {raw:{items:[]}, wrapped:true, items:[]};
  const raw=JSON.parse(fs.readFileSync(file,"utf8"));
  if(Array.isArray(raw)) return {raw,wrapped:false,items:raw};
  return {raw,wrapped:true,items:Array.isArray(raw.items)?raw.items:[]};
}

let totalRemoved=0;

for(const file of files){
  const info=read(file);
  const before=info.items.length;

  const kept=info.items.filter(p=>{
    const marker=String(p.source_policy||"");
    return marker!=="official-only-2025plus-master";
  });

  const removed=before-kept.length;
  totalRemoved+=removed;

  const out=info.wrapped ? {...info.raw,items:kept} : kept;
  fs.writeFileSync(file,JSON.stringify(out,null,2)+"\n","utf8");

  console.log(`${file}: removed ${removed}, kept ${kept.length}`);
}

// Remove only media created by MASTER.
fs.rmSync("media/official-2025plus-master",{recursive:true,force:true});

// Remove only MASTER report.
fs.rmSync("reports/official-2025plus-master",{recursive:true,force:true});

console.log(`TOTAL REMOVED: ${totalRemoved}`);
