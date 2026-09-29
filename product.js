const money=n=>Number(n||0).toLocaleString('vi-VN')+'đ';
const safeExternalUrl=value=>{const s=String(value||'').trim();return /^https?:\/\//i.test(s)?s:'';};
const normalizeMedia=src=>{if(!src)return'placeholder.svg';let s=String(src).trim().replace(/\\/g,'/');if(!s)return'placeholder.svg';if(/^(https?:|data:|blob:)/i.test(s))return s;if(s.startsWith('./'))s=s.slice(2);if(s==='placeholder.svg'||s.endsWith('/placeholder.svg'))return'placeholder.svg';if(s.startsWith('/'))s=s.slice(1);if(s.startsWith('media/'))return s;return'media/'+s;};
const getImages=p=>{let a=[];if(Array.isArray(p.images))a=p.images;else if(typeof p.images==='string'&&p.images.trim())a=[p.images];else if(p.image)a=[p.image];a=a.filter(Boolean).map(normalizeMedia);return a.length?a:['placeholder.svg'];};
const getSlides=p=>{const s=getImages(p).map(src=>({type:'image',src}));if(p.video)s.push({type:'video',src:normalizeMedia(p.video)});return s;};
const sources=[['products-camera.json','Camera'],['products-computer.json','Máy tính'],['products-printer.json','Máy in'],['products-network.json','Thiết bị mạng']];
const readItems=raw=>Array.isArray(raw)?raw:(Array.isArray(raw?.items)?raw.items:[]);
const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
(async()=>{
  const id=new URLSearchParams(location.search).get('id');
  const groups=await Promise.all(sources.map(async([file,category])=>{try{const r=await fetch(file,{cache:'no-store'});if(!r.ok)return[];const raw=await r.json();return readItems(raw).map(p=>({...p,category:p.category||category}));}catch{return[];}}));
  const p=groups.flat().find(x=>String(x.id)===String(id));
  const box=document.querySelector('#productDetail');
  if(!p){box.innerHTML='<div><h1>Không tìm thấy sản phẩm</h1><p><a href="products.html">Quay lại sản phẩm</a></p></div>';return;}
  document.title=p.name+' | DTCOM';
  const slides=getSlides(p);
  const arrows=slides.length>1?`<button class="gallery-arrow gallery-prev" type="button" aria-label="Nội dung trước">‹</button><button class="gallery-arrow gallery-next" type="button" aria-label="Nội dung tiếp theo">›</button><div class="gallery-count"><span class="gallery-current">1</span> / ${slides.length}</div>`:'';
  const shopeeUrl=safeExternalUrl(p.shopee_link);
  const shopeeButton=shopeeUrl?`<a class="btn shopee" href="${shopeeUrl}" target="_blank" rel="nofollow sponsored noopener">🛒 Tham khảo Shopee</a>`:'';
  box.innerHTML=`<div class="detail-image gallery"><div class="gallery-stage"><img class="gallery-main" alt="${esc(p.name)}"><video class="gallery-video" controls preload="metadata" playsinline></video></div>${arrows}</div><div class="detail-content"><span class="badge">${esc(p.category)}</span><h1>${esc(p.name)}</h1><div class="price">${money(p.price)}${p.old_price?`<span class="old-price">${money(p.old_price)}</span>`:''}</div><div class="desc">${esc(p.description||'').replace(/\n/g,'<br>')}</div><div class="detail-actions"><a class="btn primary" href="tel:0971675929">☎ Gọi đặt hàng</a><a class="btn orange" href="https://zalo.me/0971675929">Zalo DTCOM</a>${shopeeButton}</div></div>`;
  const imageEl=box.querySelector('.gallery-main'),videoEl=box.querySelector('.gallery-video'),currentEl=box.querySelector('.gallery-current');let current=0;
  slides.filter(s=>s.type==='image').forEach(s=>{const pre=new Image();pre.decoding='async';pre.src=s.src;});
  imageEl.addEventListener('error',()=>{if(!imageEl.src.endsWith('placeholder.svg'))imageEl.src='placeholder.svg';});
  const show=i=>{current=(i+slides.length)%slides.length;const slide=slides[current];if(videoEl&&!videoEl.paused)videoEl.pause();if(slide.type==='video'){imageEl.hidden=true;videoEl.hidden=false;if(videoEl.getAttribute('src')!==slide.src){videoEl.src=slide.src;videoEl.load();}}else{videoEl.hidden=true;imageEl.hidden=false;if(imageEl.getAttribute('src')!==slide.src)imageEl.src=slide.src;}if(currentEl)currentEl.textContent=String(current+1);};
  show(0);
  if(slides.length>1){box.querySelector('.gallery-prev').addEventListener('click',e=>{e.preventDefault();show(current-1);});box.querySelector('.gallery-next').addEventListener('click',e=>{e.preventDefault();show(current+1);});}
})();
