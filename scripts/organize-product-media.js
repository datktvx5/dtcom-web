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
function loadArray(f){const x=parse(f);if(Array.isArray(x))return x;if(x&&Array.isArray(x.items))return x.items;return[];}
function saveArray(f,x){fs.writeFileSync(path.join(root,f),JSON.stringify({items:x},null,2)+'\n','utf8');}
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
      // Preserve existing data and fill the new browsing taxonomy when older fields exist.
      if(!p.brand){
        p.brand=p.camera_brand||p.computer_brand||p.printer_brand||p.network_brand||p.brand||'';
      }
      if(!p.subcategory){
        const oldType=p.camera_type||p.computer_type||p.printer_type||p.network_type||'';
        if(category==='Máy tính'){
          const parts=['Mainboard','CPU','RAM','SSD','HDD','VGA / Card đồ họa','Nguồn / PSU','Case','Tản nhiệt'];
          const accessories=['Bàn phím','Chuột','Webcam','Tai nghe'];
          if(oldType==='Laptop')p.subcategory='Laptop';
          else if(['PC Văn phòng','PC Gaming','Mini PC','All-in-One'].includes(oldType))p.subcategory='Máy tính để bàn';
          else if(oldType==='Màn hình')p.subcategory='Màn hình';
          else if(parts.includes(oldType)){p.subcategory='Linh kiện';if(!p.product_type)p.product_type=oldType;}
          else if(accessories.includes(oldType)){p.subcategory='Phụ kiện';if(!p.product_type)p.product_type=oldType;}
        }else if(category==='Máy in'){
          const map={'Laser đen trắng':'Laser đen trắng','Laser màu':'Laser màu','Phun màu':'Phun màu','In phun tiếp mực liên tục':'Phun màu','Máy in đa năng':'Đa chức năng','Máy in nhiệt / hóa đơn':'Máy in nhiệt / tem','Máy in tem / mã vạch':'Máy in nhiệt / tem','Máy Scan':'Máy Scan'};
          if(map[oldType])p.subcategory=map[oldType];
        }else if(category==='Thiết bị mạng'){
          const s=String(oldType).toLowerCase();
          if(s.includes('router'))p.subcategory='Router';
          else if(s.includes('access point')||s.includes('wifi'))p.subcategory='Access Point';
          else if(s.includes('switch'))p.subcategory='Switch';
          else if(s.includes('firewall')||s.includes('gateway'))p.subcategory='Firewall / Gateway';
        }else if(category==='Camera'){
          const s=String(oldType).toLowerCase();
          if(s.includes('trong nhà'))p.subcategory='Camera trong nhà';
          else if(s.includes('ngoài trời'))p.subcategory='Camera ngoài trời';
          else if(s.includes('poe'))p.subcategory='Camera IP PoE';
          else if(s.includes('ptz')||s.includes('360'))p.subcategory='Camera PTZ / 360';
          else if(s.includes('analog'))p.subcategory='Camera Analog';
        }
      }
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
  console.log('Updated product/project IDs and media; migrated product and project JSON files to { items: [...] }.');
}
main();
