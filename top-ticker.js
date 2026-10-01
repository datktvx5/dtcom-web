(async function(){
  try{
    const res=await fetch('/homepage.json?v='+Date.now(),{cache:'no-store'});
    if(!res.ok) throw new Error('homepage.json '+res.status);
    const cfg=await res.json();
    const t=cfg.top_ticker||{};
    if(t.enabled===false) return;

    const text=String(t.text||'').trim();
    if(!text) return;

    const bar=document.createElement('div');
    bar.id='dt-top-ticker';
    if(t.pause_on_hover!==false) bar.classList.add('dt-pause-hover');

    const link=document.createElement('a');
    link.className='dt-ticker-link';
    const href=String(t.link||'').trim();
    link.href=href||'#';
    if(!href) link.addEventListener('click',e=>e.preventDefault());

    const track=document.createElement('div');
    track.className='dt-ticker-track';

    for(let i=0;i<2;i++){
      const copy=document.createElement('div');
      copy.className='dt-ticker-copy';
      copy.textContent=text;
      track.appendChild(copy);
    }

    link.appendChild(track);
    bar.appendChild(link);
    document.body.insertBefore(bar,document.body.firstChild);

    const root=document.documentElement;
    root.style.setProperty('--dt-ticker-bg',String(t.background_color||'#0B2D55'));
    root.style.setProperty('--dt-ticker-fg',String(t.text_color||'#FFFFFF'));
    root.style.setProperty('--dt-ticker-font',String(t.font_family||'system-ui'));
    root.style.setProperty('--dt-ticker-size',(Number(t.font_size)||14)+'px');
    root.style.setProperty('--dt-ticker-weight',String(t.font_weight||'700'));
    root.style.setProperty('--dt-ticker-height',(Number(t.height)||36)+'px');
    root.style.setProperty('--dt-ticker-speed',Math.max(5,Number(t.speed_seconds)||22)+'s');
  }catch(err){
    console.warn('DTCOM ticker:',err);
  }
})();
