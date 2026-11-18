export function trackCrystals(stage, crystals, schedule) {
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  const position = { x: 10, y: 10 };
  const offsets = crystals.map(() => ({ x: 0, y: 0 }));

  function move(event) {
    if (!finePointer.matches || event.pointerType === 'touch') return;
    const { left, top, width, height } = stage.getBoundingClientRect();
    position.x = (event.clientX - left) / width * 2 - 1;
    position.y = 1 - (event.clientY - top) / height * 2;
    schedule();
  }

  function reset() {
    position.x = position.y = 10;
    schedule();
  }

  stage.addEventListener('pointermove', move, { passive: true });
  stage.addEventListener('pointerleave', reset);
  return {
    get x() { return position.x; },
    get y() { return position.y; },
    update(phase, ambient, fallback) {
      if (!fallback) return false;
      let moving = false;
      crystals.forEach((element, index) => {
        const side = index ? 1 : -1;
        const driftX = Math.sin(phase + index) * (index ? 15 : 25);
        const driftY = Math.cos(phase * .7 + index) * 17 + ambient * side * 7;
        const x = side * .63 - position.x;
        const y = side * .43 - position.y;
        const proximity = Math.max(0, 1 - Math.hypot(x, y) / .43);
        const targetX = x * proximity * 95;
        const targetY = -y * proximity * 95;
        const offset = offsets[index];
        offset.x += (targetX - offset.x) * .14;
        offset.y += (targetY - offset.y) * .14;
        moving ||= Math.abs(targetX - offset.x) + Math.abs(targetY - offset.y) > .04;
        element.style.translate = `${offset.x + driftX}px ${offset.y + driftY}px`;
        element.style.rotate = `${(index ? 34 : -28) + phase * side * 7 + offset.x * .7}deg`;
      });
      return moving;
    },
    dispose() {
      stage.removeEventListener('pointermove', move);
      stage.removeEventListener('pointerleave', reset);
      crystals.forEach((element) => element.removeAttribute('style'));
    },
  };
}
