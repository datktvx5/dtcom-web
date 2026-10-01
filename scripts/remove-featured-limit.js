const fs=require("fs");

const files=["app.js","index.html"];
let changed=0;
const logs=[];

function patchFile(file){
  if(!fs.existsSync(file)) return;
  let s=fs.readFileSync(file,"utf8");
  const before=s;

  const replacements=[
    // Most common DTCOM patterns: only remove limits directly attached to "featured".
    [/(filter\s*\([^)]*featured[^)]*\)\s*)\.slice\(\s*0\s*,\s*6\s*\)/gi,"$1"],
    [/(filter\s*\([^)]*featured[^)]*\)\s*)\.slice\(\s*0\s*,\s*8\s*\)/gi,"$1"],
    [/(featured\w*\s*=\s*[^;\n]+?)\.slice\(\s*0\s*,\s*6\s*\)/gi,"$1"],
    [/(featured\w*\s*=\s*[^;\n]+?)\.slice\(\s*0\s*,\s*8\s*\)/gi,"$1"],
    [/\bFEATURED_LIMIT\s*=\s*6\b/g,"FEATURED_LIMIT = Number.POSITIVE_INFINITY"],
    [/\bFEATURED_LIMIT\s*=\s*8\b/g,"FEATURED_LIMIT = Number.POSITIVE_INFINITY"],
    [/\bMAX_FEATURED\s*=\s*6\b/g,"MAX_FEATURED = Number.POSITIVE_INFINITY"],
    [/\bMAX_FEATURED\s*=\s*8\b/g,"MAX_FEATURED = Number.POSITIVE_INFINITY"],
  ];

  for(const [re,rep] of replacements){
    const old=s;
    s=s.replace(re,rep);
    if(s!==old) logs.push(`${file}: ${re}`);
  }

  // Handle same-line patterns like:
  // const featuredProducts = products.filter(...); render(featuredProducts.slice(0,6))
  // but only when the line itself mentions "featured".
  const lines=s.split("\n").map(line=>{
    if(/featured/i.test(line) && /\.slice\(\s*0\s*,\s*(6|8)\s*\)/.test(line)){
      const nl=line.replace(/\.slice\(\s*0\s*,\s*(6|8)\s*\)/g,"");
      if(nl!==line) logs.push(`${file}: removed same-line featured slice`);
      return nl;
    }
    return line;
  });
  s=lines.join("\n");

  if(s!==before){
    fs.writeFileSync(file,s,"utf8");
    changed++;
  }
}

for(const f of files) patchFile(f);

console.log("PATCH LOG");
for(const x of logs) console.log("- "+x);

if(!changed){
  console.error("");
  console.error("No known featured-products limit was found.");
  console.error("For safety, no unrelated slice(0,6) was changed.");
  console.error("Please inspect app.js for the exact featured rendering code.");
  process.exit(2);
}

console.log("");
console.log("Featured products are now uncapped: every product with featured=true can render.");
