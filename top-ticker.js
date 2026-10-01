(async function(){
  try{
    const res=await fetch('/homepage.json?v='+Date.now(),{cache:'no-store'});
    if(!res.ok) throw new Error('homepage.json '+res.status);
    const cfg=await res.json();
    const t=cfg.top_ticker||{};
    if(t.enabled===false) return;

    const text=String(t.text||'').trim();
    if(!text) return;

    document.getElementById('dt-top-ticker')?.remove();

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

    // Four copies keep the strip continuous even on very wide screens.
    for(let i=0;i<4;i++){
      const copy=document.createElement('span');
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
    root.style.setProperty('--dt-ticker-font',String(t.font_family||'Arial, sans-serif'));
    root.style.setProperty('--dt-ticker-size',(Number(t.font_size)||14)+'px');
    root.style.setProperty('--dt-ticker-weight',String(t.font_weight||'700'));
    root.style.setProperty('--dt-ticker-height',(Number(t.height)||36)+'px');
    root.style.setProperty('--dt-ticker-speed',Math.max(6,Number(t.speed_seconds)||22)+'s');

    // Force animation restart after all variables are applied.
    track.style.animation='none';
    void track.offsetWidth;
    track.style.animation='';
  }catch(err){
    console.warn('DTCOM ticker:',err);
  }
})();
