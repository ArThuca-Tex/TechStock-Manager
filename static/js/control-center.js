if (matchMedia('(prefers-reduced-motion: no-preference)').matches) {
  const indicators = Array.from(document.querySelectorAll('[data-count]'), (node) => ({
    node, value: Number(node.dataset.count),
  })).filter(({ value }) => Number.isSafeInteger(value) && value > 0);

  if (indicators.length) requestAnimationFrame(animateCounts);

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('plan-visible');
          observer.unobserve(entry.target);
        }
      }
    }, { threshold: 0.1 });
    document.querySelectorAll('.plan-card').forEach((card) => observer.observe(card));
  }

  function animateCounts(start) {
    function tick(now) {
      const progress = Math.min(1, (now - start) / 550);
      const eased = 1 - Math.pow(1 - progress, 3);
      indicators.forEach(({ node, value }) => {
        node.textContent = String(Math.round(value * eased));
      });
      if (progress < 1) requestAnimationFrame(tick);
    }
    tick(start);
  }
}
