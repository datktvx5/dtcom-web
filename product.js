const money=n=>Number(n||0).toLocaleString('vi-VN')+'đ';

const normalizeMedia=src=>{
  if(!src) return 'placeholder.svg';
  let s=String(src).trim().replace(/\\/g,'/');
  if(!s) return 'placeholder.svg';
  if(/^(https?:|data:|blob:)/i.test(s)) return s;
  if(s.startsWith('./')) s=s.slice(2);
  if(s==='placeholder.svg'||s.endsWith('/placeholder.svg')) return 'placeholder.svg';
  if(s.startsWith('/')) return s;
  if(s.startsWith('media/')) return '/'+s;
  return '/media/'+s;
};

const getImages=p=>{
  let images=[];
  if(Array.isArray(p.images)) images=p.images;
  else if(typeof p.images==='string'&&p.images.trim()) images=[p.images];
  else if(p.image) images=[p.image];
  images=images.filter(Boolean).map(normalizeMedia);
  return images.length?images:['placeholder.svg'];
};

const getSlides=p=>{
  const slides=getImages(p).map(src=>({type:'image',src}));
  if(p.video) slides.push({type:'video',src:normalizeMedia(p.video)});
  return slides;
};

(async()=>{
  const id=new URLSearchParams(location.search).get('id');
  const products=await fetch('products.json',{cache:'no-store'}).then(r=>r.json());
  const p=products.find(x=>String(x.id)===String(id));
  const box=document.querySelector('#productDetail');
  if(!p){
    box.innerHTML='<div><h1>Không tìm thấy sản phẩm</h1><p><a href="index.html">Quay lại trang chủ</a></p></div>';
    return;
  }

  document.title=p.name+' | DTCOM';
  const specs=(p.specs||[]).map(s=>`<div class="spec-row"><b>${s.name}</b><span>${s.value}</span></div>`).join('');
  const slides=getSlides(p);
  const arrows=slides.length>1?`<button class="gallery-arrow gallery-prev" type="button" aria-label="Nội dung trước">‹</button><button class="gallery-arrow gallery-next" type="button" aria-label="Nội dung tiếp theo">›</button><div class="gallery-count"><span class="gallery-current">1</span> / ${slides.length}</div>`:'';

  box.innerHTML=`<div class="detail-image gallery"><div class="gallery-stage"><img class="gallery-main" alt="${p.name}"><video class="gallery-video" controls preload="metadata" playsinline></video></div>${arrows}</div><div class="detail-content"><span class="badge">${p.category}</span><h1>${p.name}</h1><div class="muted">${p.brand||'DTCOM'}${p.warranty?' • Bảo hành '+p.warranty:''}</div><div class="price">${money(p.price)}${p.old_price?`<span class="old-price">${money(p.old_price)}</span>`:''}</div><p class="desc">${p.description||''}</p><div class="specs">${specs}</div><div class="detail-actions"><a class="btn primary" href="tel:0971675929">☎ Gọi đặt hàng</a><a class="btn orange" href="https://zalo.me/0971675929">Zalo DTCOM</a></div></div>`;

  const stage=box.querySelector('.gallery-stage');
  const imageEl=box.querySelector('.gallery-main');
  const videoEl=box.querySelector('.gallery-video');
  const currentEl=box.querySelector('.gallery-current');
  let current=0;

  // Nạp trước ảnh để khi bấm mũi tên không bị chớp trắng.
  slides.filter(s=>s.type==='image').forEach(s=>{
    const preload=new Image();
    preload.decoding='async';
    preload.src=s.src;
  });

  imageEl.addEventListener('error',()=>{
    if(!imageEl.src.endsWith('placeholder.svg')) imageEl.src='placeholder.svg';
  });

  const show=i=>{
    current=(i+slides.length)%slides.length;
    const slide=slides[current];
    if(videoEl&&!videoEl.paused) videoEl.pause();

    if(slide.type==='video'){
      imageEl.hidden=true;
      videoEl.hidden=false;
      if(videoEl.getAttribute('src')!==slide.src){
        videoEl.src=slide.src;
        videoEl.load();
      }
    }else{
      videoEl.hidden=true;
      imageEl.hidden=false;
      if(imageEl.getAttribute('src')!==slide.src) imageEl.src=slide.src;
    }
    if(currentEl) currentEl.textContent=String(current+1);
  };

  show(0);
  if(slides.length>1){
    box.querySelector('.gallery-prev').addEventListener('click',e=>{e.preventDefault();show(current-1);});
    box.querySelector('.gallery-next').addEventListener('click',e=>{e.preventDefault();show(current+1);});
  }
})();
