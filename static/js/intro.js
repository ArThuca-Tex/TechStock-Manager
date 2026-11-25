import { cues, underwaterCue } from './landing-timeline.js';
import { trackCrystals } from './landing-pointer.js';

const cinema = document.querySelector('.cinema');
const { gsap, ScrollTrigger } = window;

if (cinema && gsap && ScrollTrigger) {
  gsap.registerPlugin(ScrollTrigger);
  const motion = gsap.matchMedia();
  motion.add('(prefers-reduced-motion: no-preference) and (min-height: 450px)', setupLanding);
  window.addEventListener('pagehide', (event) => {
    if (!event.persisted) motion.revert();
  });
}

function setupLanding() {
  const select = gsap.utils.selector(cinema);
  const [stage] = select('.cinema-stage');
  const [host] = select('.cinema-webgl');
  const [chip, fan, board] = ['.chip-css', '.fan-css', '.board-css'].map((selector) => select(selector)[0]);
  const labels = select('.fan-labels li').map((label) => ({ part: label.dataset.part, line: label.querySelector('i') }));
  const state = {
    chipSize: 1, chipTurn: 0, fanSize: 0, fanTurn: 0, rotor: 0, split: 0,
    boardSize: 0, boardTurn: 0, cameraMove: 0, phase: 0, ambient: 0,
    water: 0, rise: 0, spread: 0, spin: 0,
  };
  const compact = matchMedia('(max-width: 760px)');
  const started = performance.now();
  let lastDraw = started;
  let model;
  let frame = 0;
  let disposed = false;
  let visible = true;
  cinema.classList.add('is-animated');
  const pointer = trackCrystals(stage, select('.cinema-crystal'), drawSoon);
  const visibility = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) drawSoon();
  });
  visibility.observe(stage);
  document.addEventListener('visibilitychange', drawSoon);

  function drawSoon() {
    if (!disposed && !frame && visible && !document.hidden) frame = requestAnimationFrame(draw);
  }

  function draw(now) {
    frame = 0;
    const { chipSize, chipTurn, fanSize, split, rotor, boardSize, boardTurn, phase, water, rise, spread } = state;
    const elapsed = now - started;
    const current = Math.sin(elapsed * .00165);
    const spinning = (phase >= .07 && phase < .25 || phase >= .61 && phase < .69) && split < .96;
    if (spinning) state.spin += Math.min(now - lastDraw, 50) * .00068 * (1 - split) ** 2;
    lastDraw = now;
    state.ambient = current * .18;

    stage.style.setProperty('--water', water);
    stage.style.setProperty('--light-drift', `${current * water * 28}px`);
    stage.style.setProperty('--rise', rise);
    stage.style.setProperty('--spread', spread);
    stage.style.setProperty('--current', current);
    stage.style.setProperty('--jelly-opacity', Math.min(rise * 8, 1, (1 - rise) * 12));
    stage.style.setProperty('--swarm-opacity', Math.min(rise * 3, .9));
    const hasWebGL = cinema.classList.contains('has-webgl');
    if (!hasWebGL) {
      const { hardware, descent } = underwaterCue(phase);
      [[chip, chipSize, 'cpu'], [fan, fanSize, 'cooler'], [board, boardSize, 'motherboard']].forEach(([node, size, name]) => {
        const falling = hardware === name;
        node.style.opacity = phase < .33 ? Math.min(size * 1.5, 1) : Number(falling);
        node.style.translate = falling ? `${name === 'cpu' ? -22 : 10}vw ${(descent * 2 - 1) * 130}vh` : '';
      });
      chip.style.setProperty('--chip-turn', `${-32 + chipTurn * 69 + current * 7}deg`);
      chip.style.setProperty('--chip-zoom', Math.max(.3, chipSize));
      fan.style.setProperty('--explode', split);
      fan.style.setProperty('--fan-depth', `${split * (compact.matches ? 24 : 43)}px`);
      fan.style.setProperty('--rotor', `${rotor + state.spin}rad`);
      board.style.setProperty('--board-pitch', `${45 - boardTurn * 34}deg`);
      board.style.setProperty('--board-scale', Math.max(.65, boardSize));
    }
    const pointerMoving = pointer.update(phase * 5, state.ambient, !hasWebGL && water < .75);
    model?.setPointer(pointer.x, pointer.y);
    const modelMoving = model?.render(elapsed);
    stage.toggleAttribute('data-login-ready', phase >= cues.loginEnter);
    if (phase > .155 && phase < .248 && !compact.matches) {
      const bounds = stage.getBoundingClientRect();
      labels.forEach(({ part, line }, index) => {
        const start = line.parentElement.getBoundingClientRect();
        const x = start.left + line.offsetLeft;
        const y = start.top + line.offsetTop;
        const end = (hasWebGL && model?.anchor(part)) || { x: bounds.width * .56, y: bounds.height * (.37 + index * .14) };
        const dx = end.x + bounds.left - x;
        const dy = end.y + bounds.top - y;
        line.style.setProperty('--line-length', `${Math.hypot(dx, dy)}px`);
        line.style.setProperty('--line-angle', `${Math.atan2(dy, dx)}rad`);
      });
    }
    if (pointerMoving || modelMoving || water > .04 || spinning || phase < .07) drawSoon();
  }

  const timeline = gsap.timeline({
    defaults: { ease: 'sine.inOut' },
    onUpdate: drawSoon,
    scrollTrigger: {
      trigger: stage, pin: true, start: 'top top', scrub: true,
      end: () => `+=${Math.round(stage.clientHeight * (compact.matches ? 9 : 12))}`,
      invalidateOnRefresh: true,
      onRefresh: drawSoon,
    },
  });
  for (const [label, position] of Object.entries(cues)) timeline.addLabel(label, position);
  const reveal = (selector, start, end) => timeline
    .fromTo(select(selector), { autoAlpha: 0, y: -20, clipPath: 'inset(0 0 100% 0)' },
      { autoAlpha: 1, y: 0, clipPath: 'inset(0 0 0% 0)', duration: .012 }, start)
    .to(select(selector), { autoAlpha: 0, y: 24, duration: .009 }, end - .009);
  timeline
    .to(state, { phase: 1, duration: 1, ease: 'none' }, 0)
    .to(select('.cinema-scroll'), { autoAlpha: 0, duration: .025 }, .01)
    .to(select('.scene-chip'), { autoAlpha: 0, y: -18, duration: .024 }, .041)
    .to(state, { chipTurn: .8, cameraMove: -.35, duration: .058 }, 0)
    .to(state, { chipSize: 0, duration: .016 }, .054)
    .to(state, { fanSize: 1, fanTurn: .7, cameraMove: 0, duration: .06 }, .07)
    .to(state, { split: 1, cameraMove: .38, duration: .085 }, .14)
    .to(state, { fanSize: 0, duration: .009 }, .241)
    .set(state, { split: 0 }, .25)
    .to(state, { boardSize: 1, duration: .017 }, .25)
    .to(state, { boardTurn: .92, cameraMove: 0, duration: .065 }, .251)
    .to(state, { boardSize: 0, duration: .012 }, .318)
    .to(state, { water: 1, duration: .063 }, .304)
    .to(select('.cinema-grid, .cinema-orbit'), { opacity: 0, duration: .06 }, .304)
    .to(state, { rise: 1, duration: .67, ease: 'none' }, .33)
    .to(state, { spread: 1, duration: .06 }, 'jellyfishExit')
    .fromTo(select('.entry-link'), { autoAlpha: 0, y: () => -stage.clientHeight * .75 },
      { autoAlpha: 1, y: 0, duration: .07, ease: 'power2.out' }, 'loginEnter')
    .fromTo(select('.entry-copy'), { autoAlpha: 0, y: 14 },
      { autoAlpha: 1, y: 0, duration: .032 }, .968);
  reveal('.scene-fan', .08, .14);
  reveal('.scene-exploded', .157, .245);
  reveal('.scene-board', .259, .326);
  reveal('.ocean-caption:first-of-type', .387, .446);
  reveal('.ocean-caption:nth-child(2)', .57, .605);
  reveal('.ocean-caption:last-of-type', .827, .865);
  select('.fan-labels li').forEach((label, index) => {
    timeline.fromTo(label, { autoAlpha: 0 }, { autoAlpha: 1, duration: .007 }, .17 + index * .015);
  });
  drawSoon();

  if ('WebGL2RenderingContext' in window && !navigator.connection?.saveData) {
    import('./landing-scene.js').then(({ mountScene }) => {
      if (disposed) return;
      model = mountScene(host, state, () => {
        cinema.classList.remove('has-webgl');
        drawSoon();
      });
      if (model) {
        cinema.classList.add('has-webgl');
        drawSoon();
      }
    }).catch((error) => console.warn('TechStock WebGL:', error));
  }

  return () => {
    disposed = true;
    cancelAnimationFrame(frame);
    visibility.disconnect();
    document.removeEventListener('visibilitychange', drawSoon);
    pointer.dispose();
    model?.dispose();
    [stage, chip, fan, board, ...labels.map(({ line }) => line)].forEach((node) => node.removeAttribute('style'));
    stage.removeAttribute('data-login-ready');
    cinema.classList.remove('is-animated', 'has-webgl');
  };
}

