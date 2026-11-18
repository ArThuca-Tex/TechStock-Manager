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
    water: 0, sink: 0, rise: 0, spread: 0, spin: 0,
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
    const { chipSize, chipTurn, fanSize, fanTurn, split, rotor, boardSize, boardTurn, phase, water, sink, rise, spread } = state;
    const elapsed = now - started;
    const current = Math.sin(elapsed * .00165);
    const spinning = phase > .14 && phase < .40 && split < .96;
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
      const falling = sink > .001 && sink < .998;
      const submerged = Math.pow(Math.max(0, Math.sin(sink * Math.PI)), .78) * .66;
      chip.style.opacity = falling ? submerged : Math.min(chipSize * 1.5, 1);
      chip.style.translate = falling ? `${-16 + current * 2}vw ${-48 + sink * 104}vh` : '';
      chip.style.setProperty('--chip-turn', `${-32 + chipTurn * 69 + state.ambient * 2}deg`);
      chip.style.setProperty('--chip-zoom', falling ? .63 : Math.max(.3, chipSize));
      fan.style.opacity = falling ? submerged : Math.min(fanSize * 1.6, 1);
      fan.style.translate = falling ? `${18 + current * 3}vw ${-48 + sink * 124}vh` : '';
      fan.style.scale = falling ? .5 : Math.max(.6, fanSize);
      fan.style.setProperty('--explode', falling ? 0 : split);
      fan.style.setProperty('--fan-depth', `${falling ? 0 : split * (compact.matches ? 24 : 43)}px`);
      fan.style.setProperty('--rotor', `${rotor + state.spin}rad`);
      board.style.opacity = Math.min(boardSize * 1.5, 1);
      board.style.translate = `0 ${sink * 83}vh`;
      board.style.setProperty('--board-pitch', `${45 - boardTurn * 34}deg`);
      board.style.setProperty('--board-scale', Math.max(.2, boardSize));
    }
    const pointerMoving = pointer.update(phase * 5, state.ambient, !hasWebGL && water < .75);
    model?.setPointer(pointer.x, pointer.y);
    const modelMoving = model?.render(elapsed);
    if (phase > .30 && phase < .49 && !compact.matches) {
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
    if (pointerMoving || modelMoving || water > .04 || spinning || (phase < .03 && elapsed < 4500)) drawSoon();
  }

  const timeline = gsap.timeline({
    defaults: { ease: 'sine.inOut' },
    onUpdate: drawSoon,
    scrollTrigger: {
      trigger: stage, pin: true, start: 'top top', scrub: .48,
      end: () => `+=${Math.round(stage.clientHeight * (compact.matches ? 4.6 : 5.4))}`,
      invalidateOnRefresh: true,
      onRefresh: drawSoon,
    },
  });
  const crossfade = (node, start, end, duration = .052) => timeline
    .to(select(node), { autoAlpha: 1, duration }, start)
    .to(select(node), { autoAlpha: 0, duration }, end);

  timeline
    .to(state, { phase: 1, duration: 1, ease: 'none' }, 0)
    .to(select('.cinema-scroll'), { autoAlpha: 0, y: 8, duration: .043 }, .006)
    .to(state, { chipTurn: .72, chipSize: 1.15, cameraMove: -.72, duration: .083 }, .018)
    .to(select('.scene-chip h1 span:first-child'), { xPercent: -7, duration: .078 }, .066)
    .to(select('.scene-chip h1 span:last-child'), { xPercent: 10, duration: .078 }, .066)
    .to(select('.scene-chip'), { autoAlpha: 0, y: -17, duration: .075 }, .088)
    .to(state, { chipTurn: 1.4, chipSize: 0, fanSize: 1, cameraMove: .16, duration: .10 }, .092)
    .to(state, { rotor: 2.1, fanTurn: .7, cameraMove: -.50, duration: .123, ease: 'sine.out' }, .178)
    .to(state, { split: 1, duration: .113 }, .298)
    .to(state, { rotor: 2.37, duration: .027, ease: 'power2.out' }, .301)
    .from(select('.fan-labels li strong, .fan-labels li small'), {
      autoAlpha: 0, y: 7, duration: .04, stagger: .009, immediateRender: false,
    }, .323)
    .to(state, { fanSize: 0, boardSize: 1, cameraMove: -.01, duration: .111 }, .405)
    .to(state, { boardTurn: .74, split: 0, duration: .112 }, .434)
    .fromTo(select('.scene-board h2 b'), { yPercent: 106 }, {
      yPercent: 0, duration: .043, stagger: .024, immediateRender: false,
    }, .468)
    .to(state, { water: 1, cameraMove: .69, duration: .139 }, .549)
    .to(select('.cinema-grid, .cinema-orbit'), { opacity: 0, duration: .12 }, .545)
    .to(state, { sink: 1, boardSize: 0, boardTurn: 1.8, duration: .227, ease: 'sine.in' }, .557)
    .to(state, { rise: 1, duration: .282, ease: 'sine.inOut' }, .660)
    .to(state, { spread: 1, duration: .155, ease: 'sine.inOut' }, .845)
    .fromTo(select('.entry-link'), {
      autoAlpha: 0, x: () => compact.matches ? 0 : stage.clientWidth * .23, y: () => -stage.clientHeight * .60, scale: .92,
    }, {
      autoAlpha: .92, y: () => stage.clientHeight * .22, scale: .92, duration: .102,
      immediateRender: false, ease: 'sine.in',
    }, .764)
    .to(select('.entry-link'), { autoAlpha: 1, x: 0, y: 0, scale: 1, duration: .11 }, .866)
    .fromTo(select('.entry-copy'), { autoAlpha: 0, y: 18 }, {
      autoAlpha: 1, y: 0, duration: .083, immediateRender: false,
    }, .919);
  crossfade('.scene-fan', .144, .285);
  crossfade('.scene-exploded', .300, .428);
  crossfade('.scene-board', .462, .545, .061);
  drawSoon();

  let timer;
  if ('WebGL2RenderingContext' in window && !navigator.connection?.saveData) {
    timer = setTimeout(async () => {
      try {
        const { mountScene } = await import('./landing-scene.js');
        if (disposed) return;
        model = mountScene(host, state, () => {
          cinema.classList.remove('has-webgl');
          drawSoon();
        });
        if (model) {
          cinema.classList.add('has-webgl');
          drawSoon();
        }
      } catch {
        // The CSS models and the login links remain available without a working context.
      }
    }, 300);
  }

  return () => {
    disposed = true;
    clearTimeout(timer);
    cancelAnimationFrame(frame);
    visibility.disconnect();
    document.removeEventListener('visibilitychange', drawSoon);
    pointer.dispose();
    model?.dispose();
    [stage, chip, fan, board, ...labels.map(({ line }) => line)].forEach((node) => node.removeAttribute('style'));
    cinema.classList.remove('is-animated', 'has-webgl');
  };
}

