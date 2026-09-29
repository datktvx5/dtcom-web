const money=n=>Number(n||0).toLocaleString('vi-VN')+'đ';
const getImages=p=>{
  if(Array.isArray(p.images)&&p.images.length) return p.images.filter(Boolean);
  if(p.image) return [p.image];
  return ['placeholder.svg'];
};
const getSlides=p=>{
  const slides=getImages(p).map(src=>({type:'image',src}));
  if(p.video) slides.push({type:'video',src:p.video});
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
  box.innerHTML=`<div class="detail-image gallery"><div class="gallery-stage"></div>${arrows}</div><div class="detail-content"><span class="badge">${p.category}</span><h1>${p.name}</h1><div class="muted">${p.brand||'DTCOM'}${p.warranty?' • Bảo hành '+p.warranty:''}</div><div class="price">${money(p.price)}${p.old_price?`<span class="old-price">${money(p.old_price)}</span>`:''}</div><p class="desc">${p.description||''}</p><div class="specs">${specs}</div><div class="detail-actions"><a class="btn primary" href="tel:0971675929">☎ Gọi đặt hàng</a><a class="btn orange" href="https://zalo.me/0971675929">Zalo DTCOM</a></div></div>`;

  let current=0;
  const stage=box.querySelector('.gallery-stage');
  const currentEl=box.querySelector('.gallery-current');
  const show=i=>{
    const oldVideo=stage.querySelector('video');
    if(oldVideo) oldVideo.pause();
    current=(i+slides.length)%slides.length;
    const slide=slides[current];
    if(slide.type==='video'){
      stage.innerHTML=`<video class="gallery-video" controls preload="metadata" playsinline><source src="${slide.src}"></video>`;
    }else{
      stage.innerHTML=`<img class="gallery-main" src="${slide.src}" alt="${p.name} - ảnh ${current+1}">`;
    }
    if(currentEl) currentEl.textContent=String(current+1);
  };
  show(0);
  if(slides.length>1){
    box.querySelector('.gallery-prev').addEventListener('click',()=>show(current-1));
    box.querySelector('.gallery-next').addEventListener('click',()=>show(current+1));
  }
})();
