const fs=require('fs'),path=require('path');
const root=process.cwd();
const mediaRoot=path.join(root,'media');
const projectMediaRoot=path.join(mediaRoot,'cong-trinh');
const productFiles=[['products-camera.json','Camera'],['products-computer.json','Máy tính'],['products-printer.json','Máy in'],['products-network.json','Thiết bị mạng']];
const projectFile='projects.json';
const slugify=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/đ/g,'d').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,120);
const clean=v=>String(v||'').trim().replace(/\\/g,'/').replace(/^\.\//,'').replace(/^\//,'');
const remote=v=>/^(https?:|data:|blob:)/i.test(String(v||''));
const ensure=d=>fs.mkdirSync(d,{recursive:true});
function same(a,b){try{return fs.statSync(a).size===fs.statSync(b).size&&fs.readFileSync(a).equals(fs.readFileSync(b));}catch{return false;}}
function unique(dir,name,src){const p=path.parse(name);let d=path.join(dir,name);if(!fs.existsSync(d)||same(src,d))return d;for(let i=2;;i++){d=path.join(dir,`${p.name}-${i}${p.ext}`);if(!fs.existsSync(d)||same(src,d))return d;}}
function moveMedia(v,targetDir,webPrefix){if(!v||remote(v))return v;const c=clean(v);if(!c.startsWith('media/'))return v;const src=path.join(root,c);if(!fs.existsSync(src)||!fs.statSync(src).isFile())return v;ensure(targetDir);const relTarget=path.relative(root,targetDir).replace(/\\/g,'/');if(c.startsWith(relTarget+'/'))return'/'+c;const dest=unique(targetDir,path.basename(c),src);if(path.resolve(src)!==path.resolve(dest))fs.renameSync(src,dest);return webPrefix+'/'+path.basename(dest);}
function parse(f){const p=path.join(root,f);if(!fs.existsSync(p))return null;try{return JSON.parse(fs.readFileSync(p,'utf8'));}catch{return null;}}
function loadProducts(f){const x=parse(f);if(Array.isArray(x))return x;if(x&&Array.isArray(x.items))return x.items;return[];}
function saveProducts(f,items){fs.writeFileSync(path.join(root,f),JSON.stringify({items},null,2)+'\n','utf8');}
function loadArray(f){const x=parse(f);return Array.isArray(x)?x:[];}
function saveArray(f,x){fs.writeFileSync(path.join(root,f),JSON.stringify(x,null,2)+'\n','utf8');}
function makeUnique(base,used){let id=base||'muc';if(!used.has(id)){used.add(id);return id;}for(let i=2;;i++){const x=`${id}-${i}`;if(!used.has(x)){used.add(x);return x;}}}
function main(){
  ensure(mediaRoot);ensure(projectMediaRoot);
  const activeProducts=new Set(),activeProjects=new Set(),usedProducts=new Set();
  const groups=productFiles.map(([f,c])=>[f,c,loadProducts(f)]);
  for(const[, ,arr]of groups)for(const p of arr){const id=slugify(p.id);if(id)usedProducts.add(id);}
  for(const[file,category,arr]of groups){
    for(const p of arr){
      let id=slugify(p.id);
      if(!id)id=makeUnique(slugify(p.name),usedProducts);
      p.id=id;p.category=category;activeProducts.add(id);
      if((!Array.isArray(p.images)||!p.images.length)&&p.image){p.images=[p.image];delete p.image;}
      const dir=path.join(mediaRoot,id),prefix='/media/'+id;
      if(Array.isArray(p.images))p.images=p.images.filter(Boolean).map(x=>moveMedia(x,dir,prefix));
      if(p.video)p.video=moveMedia(p.video,dir,prefix);
    }
    // Always save in the new Pages CMS shape so each collapsed item can show {name}.
    saveProducts(file,arr);
  }
  for(const e of fs.readdirSync(mediaRoot,{withFileTypes:true})){
    if(!e.isDirectory()||e.name==='cong-trinh')continue;
    if(!activeProducts.has(e.name))fs.rmSync(path.join(mediaRoot,e.name),{recursive:true,force:true});
  }
  const projects=loadArray(projectFile),usedProjects=new Set(projects.map(x=>slugify(x.id)).filter(Boolean));
  for(const p of projects){
    let id=slugify(p.id);if(!id)id=makeUnique(slugify(p.title),usedProjects);p.id=id;activeProjects.add(id);
    const dir=path.join(projectMediaRoot,id),prefix='/media/cong-trinh/'+id;
    if(Array.isArray(p.images))p.images=p.images.filter(Boolean).map(x=>moveMedia(x,dir,prefix));
    if(p.video)p.video=moveMedia(p.video,dir,prefix);
  }
  saveArray(projectFile,projects);
  for(const e of fs.readdirSync(projectMediaRoot,{withFileTypes:true}))if(e.isDirectory()&&!activeProjects.has(e.name))fs.rmSync(path.join(projectMediaRoot,e.name),{recursive:true,force:true});
  console.log('Updated product IDs/media and migrated product JSON files to { items: [...] }.');
}
main();
