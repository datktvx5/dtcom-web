(() => {
  const btn = document.querySelector('.menu-btn');
  const links = document.querySelector('.links');
  if (!btn || !links) return;
  const close = () => {
    links.classList.remove('open');
    btn.setAttribute('aria-expanded','false');
  };
  btn.addEventListener('click', () => {
    const open = links.classList.toggle('open');
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  links.querySelectorAll('a').forEach(a => a.addEventListener('click', close));
  document.addEventListener('click', e => {
    if (window.innerWidth <= 900 && links.classList.contains('open') && !links.contains(e.target) && !btn.contains(e.target)) close();
  });
  window.addEventListener('resize', () => { if (window.innerWidth > 900) close(); });
})();
