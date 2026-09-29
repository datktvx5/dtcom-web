const fs=require('fs'),path=require('path');
const root=process.cwd();
const mediaRoot=path.join(root,'media');
const projectMediaRoot=path.join(mediaRoot,'cong-trinh');
const pagesPath=path.join(root,'.pages.yml');
const OTHER='Khác / thêm mới';
const productFiles=[['products-camera.json','Camera','camera'],['products-computer.json','Máy tính','computer'],['products-printer.json','Máy in','printer'],['products-network.json','Thiết bị mạng','network']];
const projectFile='projects.json';
const slugify=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/đ/g,'d').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,120);
const clean=v=>String(v||'').trim().replace(/\\/g,'/').replace(/^\.\//,'').replace(/^\//,'');
const remote=v=>/^(https?:|data:|blob:)/i.test(String(v||''));
const ensure=d=>fs.mkdirSync(d,{recursive:true});
function same(a,b){try{return fs.statSync(a).size===fs.statSync(b).size&&fs.readFileSync(a).equals(fs.readFileSync(b));}catch{return false;}}
function unique(dir,name,src){const p=path.parse(name);let d=path.join(dir,name);if(!fs.existsSync(d)||same(src,d))return d;for(let i=2;;i++){d=path.join(dir,`${p.name}-${i}${p.ext}`);if(!fs.existsSync(d)||same(src,d))return d;}}
function moveMedia(v,targetDir,webPrefix){if(!v||remote(v))return v;const c=clean(v);if(!c.startsWith('media/'))return v;const src=path.join(root,c);if(!fs.existsSync(src)||!fs.statSync(src).isFile())return v;ensure(targetDir);const relTarget=path.relative(root,targetDir).replace(/\\/g,'/');if(c.startsWith(relTarget+'/'))return'/'+c;const dest=unique(targetDir,path.basename(c),src);if(path.resolve(src)!==path.resolve(dest))fs.renameSync(src,dest);return webPrefix+'/'+path.basename(dest);}
function load(f){const p=path.join(root,f);if(!fs.existsSync(p))return[];try{const x=JSON.parse(fs.readFileSync(p,'utf8'));return Array.isArray(x)?x:[];}catch{return[];}}
function save(f,x){fs.writeFileSync(path.join(root,f),JSON.stringify(x,null,2)+'\n','utf8');}
function yamlValue(v){return '"'+String(v).replace(/\\/g,'\\\\').replace(/"/g,'\\"')+'"';}
function unquote(line){let s=line.trim().replace(/^-\s*/,'').trim();if((s.startsWith('"')&&s.endsWith('"'))||(s.startsWith("'")&&s.endsWith("'")))s=s.slice(1,-1);return s.replace(/\\"/g,'"').replace(/\\\\/g,'\\');}
function ensureOptions(yaml,field,vals){const lines=yaml.split(/\r?\n/),re=new RegExp(`^\\s*- name: ${field}\\s*$`),start=lines.findIndex(x=>re.test(x));if(start<0)return yaml;const indent=(lines[start].match(/^\s*/)||[''])[0].length;let end=lines.length;for(let i=start+1;i<lines.length;i++){const m=lines[i].match(/^(\s*)- name:/);if(m&&m[1].length===indent){end=i;break;}}let vl=-1;for(let i=start;i<end;i++)if(/^\s*values:\s*$/.test(lines[i])){vl=i;break;}if(vl<0)return yaml;const oi=(lines[vl].match(/^\s*/)||[''])[0]+'  ';let a=vl+1,b=a;while(b<end&&(lines[b].trim()===''||lines[b].startsWith(oi+'- ')))b++;const cur=[];for(let i=a;i<b;i++)if(lines[i].startsWith(oi+'- '))cur.push(unquote(lines[i]));const merged=[];for(const v of [...cur,...vals]){const s=String(v||'').trim();if(!s||s===OTHER||merged.some(x=>x.toLowerCase()===s.toLowerCase()))continue;merged.push(s);}merged.push(OTHER);lines.splice(a,b-a,...merged.map(v=>oi+'- '+yamlValue(v)));return lines.join('\n');}
const learnable=['camera_brand','camera_type','camera_resolution','camera_connection','camera_lens','camera_night','camera_audio','camera_storage','computer_brand','computer_type','computer_cpu','computer_ram','computer_storage','computer_gpu','computer_screen','computer_refresh','printer_brand','printer_type','printer_paper','printer_color','printer_functions','printer_duplex','printer_connection','printer_speed','network_brand','network_type','network_wifi','network_speed','network_ports','network_poe','network_management','warranty'];
const brandKey={camera:'camera_brand',computer:'computer_brand',printer:'printer_brand',network:'network_brand'};
const modelKey={camera:'camera_model',computer:'computer_model',printer:'printer_model',network:'network_model'};
function makeUnique(base,used){let id=base||'muc';if(!used.has(id)){used.add(id);return id;}for(let i=2;;i++){const x=`${id}-${i}`;if(!used.has(x)){used.add(x);return x;}}}
function main(){
  ensure(mediaRoot);ensure(projectMediaRoot);
  const usedProducts=new Set(),activeProducts=new Set(),activeProjects=new Set();
  const learn=Object.fromEntries(learnable.map(k=>[k,new Set()]));
  let changed=false;
  const groups=productFiles.map(([f,c,k])=>[f,c,k,load(f)]);
  for(const[, , ,arr]of groups)for(const p of arr){const s=slugify(p.id);if(s)usedProducts.add(s);}
  for(const [file,category,kind,arr] of groups){
    for(const p of arr){
      let id=slugify(p.id);
      if(!id){id=makeUnique(slugify(p.name),usedProducts);p.id=id;changed=true;}
      else if(p.id!==id){p.id=id;changed=true;}
      activeProducts.add(id);p.category=category;
      const bk=brandKey[kind],mk=modelKey[kind];
      if(p[bk]&&p[bk]!==OTHER&&p.brand!==p[bk]){p.brand=p[bk];changed=true;}
      if(p[mk]&&p.model!==p[mk]){p.model=p[mk];changed=true;}
      for(const fld of learnable){const v=p[fld];if(Array.isArray(v))v.forEach(x=>x&&x!==OTHER&&learn[fld].add(String(x).trim()));else if(v&&v!==OTHER)learn[fld].add(String(v).trim());}
      if(Array.isArray(p.custom_options)){
        for(const it of p.custom_options){if(!it)continue;const fld=String(it.field||''),val=String(it.value||'').trim();if(!learnable.includes(fld)||!val)continue;learn[fld].add(val);if(fld==='warranty'&&(!p.warranty||p.warranty===OTHER))p.warranty=val;else if(Array.isArray(p[fld])){const v=p[fld].filter(x=>x&&x!==OTHER);if(!v.some(x=>String(x).toLowerCase()===val.toLowerCase()))v.push(val);p[fld]=v;}else if(!p[fld]||p[fld]===OTHER)p[fld]=val;}delete p.custom_options;changed=true;
      }
      if((!Array.isArray(p.images)||!p.images.length)&&p.image){p.images=[p.image];delete p.image;changed=true;}
      const dir=path.join(mediaRoot,id),prefix='/media/'+id;
      if(Array.isArray(p.images))p.images=p.images.filter(Boolean).map(x=>moveMedia(x,dir,prefix));
      if(p.video)p.video=moveMedia(p.video,dir,prefix);
    }
    save(file,arr);
  }
  for(const e of fs.readdirSync(mediaRoot,{withFileTypes:true})){
    if(!e.isDirectory()||e.name==='cong-trinh')continue;
    if(!activeProducts.has(e.name)){fs.rmSync(path.join(mediaRoot,e.name),{recursive:true,force:true});changed=true;}
  }

  const projects=load(projectFile),usedProjects=new Set(projects.map(x=>slugify(x.id)).filter(Boolean));
  for(const p of projects){
    let id=slugify(p.id);
    if(!id){id=makeUnique(slugify(p.title),usedProjects);p.id=id;changed=true;}
    else if(p.id!==id){p.id=id;changed=true;}
    activeProjects.add(id);
    const dir=path.join(projectMediaRoot,id),prefix='/media/cong-trinh/'+id;
    if(Array.isArray(p.images))p.images=p.images.filter(Boolean).map(x=>moveMedia(x,dir,prefix));
    if(p.video)p.video=moveMedia(p.video,dir,prefix);
  }
  save(projectFile,projects);
  for(const e of fs.readdirSync(projectMediaRoot,{withFileTypes:true})){
    if(e.isDirectory()&&!activeProjects.has(e.name)){fs.rmSync(path.join(projectMediaRoot,e.name),{recursive:true,force:true});changed=true;}
  }

  if(fs.existsSync(pagesPath)){
    let y=fs.readFileSync(pagesPath,'utf8');
    for(const f of learnable)y=ensureOptions(y,f,[...learn[f]]);
    const old=fs.readFileSync(pagesPath,'utf8');
    if(y!==old){fs.writeFileSync(pagesPath,y.endsWith('\n')?y:y+'\n');changed=true;}
  }
  console.log(changed?'Updated products, projects, media and options.':'No changes needed.');
}
main();
