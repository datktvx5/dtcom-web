const fs=require("fs");
const liveFile="products-network.json";
const cleanFile="imports/reyee-clean/products-network-reyee-clean.json";
const cleanRaw=JSON.parse(fs.readFileSync(cleanFile,"utf8"));
const clean=Array.isArray(cleanRaw)?cleanRaw:(cleanRaw.items||[]);
const raw=JSON.parse(fs.readFileSync(liveFile,"utf8"));
const live=Array.isArray(raw)?raw:(raw.items||[]);
const isReyee=p=>String(p.brand||"").trim().toLowerCase()==="reyee" || /^reyee\s+/i.test(String(p.name||"")) || /^rg-(rap|nbs|nis|es|eg|nbf|apf)/i.test(String(p.id||""));
const oldReyee=live.filter(isReyee);
const nonReyee=live.filter(p=>!isReyee(p));
const byId=new Map(oldReyee.map(p=>[String(p.id||"").toLowerCase(),p]));
const byModel=new Map(oldReyee.map(p=>{const m=String(p.name||"").match(/RG-[A-Z0-9()\-]+/i);return [m?m[0].toLowerCase():"",p]}));
for(const p of clean){
  const m=String(p.name||"").match(/RG-[A-Z0-9()\-]+/i);
  const old=byId.get(String(p.id||"").toLowerCase()) || (m&&byModel.get(m[0].toLowerCase()));
  if(old){
    for(const k of ["price","old_price","shopee_link","video","featured"]){
      if(old[k]!==undefined && old[k]!==null && old[k]!=="") p[k]=old[k];
    }
  }
}
const output=Array.isArray(raw)?[...nonReyee,...clean]:{...raw,items:[...nonReyee,...clean]};
fs.writeFileSync(liveFile,JSON.stringify(output,null,2)+"\n","utf8");
console.log(`Removed ${oldReyee.length} old Reyee items; inserted ${clean.length} clean Reyee items; kept ${nonReyee.length} non-Reyee items.`);
