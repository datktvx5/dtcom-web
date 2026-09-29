(() => {
  const btn = document.querySelector('[data-ask-zalo]');
  const box = document.querySelector('#serviceQuestion');
  if (!btn || !box) return;
  btn.addEventListener('click', async (e) => {
    e.preventDefault();
    const q = box.value.trim();
    if (!q) {
      box.focus();
      box.classList.add('needs-question');
      setTimeout(() => box.classList.remove('needs-question'), 1200);
      return;
    }
    const service = document.body.dataset.service || 'dịch vụ DTCOM';
    const text = `Xin chào DTCOM, tôi muốn hỏi về ${service}: ${q}`;
    try { await navigator.clipboard.writeText(text); } catch (_) {}
    const note = document.querySelector('#questionNote');
    if (note) note.textContent = 'Đã sao chép câu hỏi. Zalo đang mở — bạn chỉ cần dán và gửi.';
    window.open('https://zalo.me/0971675929', '_blank', 'noopener');
  });
})();
