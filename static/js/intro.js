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
  const [chapter] = select('.cinema-chapter');
  const [chip, fan, board] = ['.chip-css', '.fan-css', '.board-css'].map((selector) => select(selector)[0]);
  const labels = select('.fan-labels li').map((label) => ({ part: label.dataset.part, line: label.querySelector('i') }));
  const cssCrystals = select('.cinema-crystal');
  const state = {
    chipSize: 1, chipTurn: 0, fanSize: 0, fanTurn: 0, rotor: 0, split: 0,
    boardSize: 0, boardTurn: 0, cameraMove: 0, phase: 0, ambient: 0,
  };
  const compact = matchMedia('(max-width: 670px)');
  let model;
  let frame = 0;
  let disposed = false;
  let active = true;
  const chapterStarts = [0, .78, 1.76, 2.7, 3.81, 4.74];
  let currentChapter = 0;
  let timeline;
  cinema.classList.add('is-animated');
  const pointer = trackCrystals(stage, cssCrystals, drawSoon);

  function drawSoon() {
    if (!disposed && !frame && active) frame = requestAnimationFrame(draw);
  }

  function draw() {
    frame = 0;
    const { chipSize, chipTurn, fanSize, fanTurn, split, rotor, boardSize, boardTurn, phase, ambient } = state;
    const progress = timeline?.progress() ?? 0;
    stage.style.setProperty('--progress', progress);
    const nextChapter = chapterStarts.findLastIndex((start) => phase >= start);
    if (nextChapter !== currentChapter) {
      currentChapter = nextChapter;
      chapter.textContent = `0${currentChapter + 1} / 06`;
    }
    chip.style.opacity = Math.min(chipSize * 1.5, 1);
    chip.style.setProperty('--chip-turn', `${-32 + chipTurn * 69 + ambient * 2}deg`);
    chip.style.setProperty('--chip-zoom', Math.max(.3, chipSize));
    fan.style.opacity = Math.min(fanSize * 1.6, 1);
    fan.style.scale = Math.max(.6, fanSize);
    fan.style.setProperty('--fan-depth', `${split * (compact.matches ? 23 : 50)}px`);
    fan.style.setProperty('--fan-angle', `${-12 + fanTurn * 26}deg`);
    fan.style.setProperty('--rotor', `${rotor + ambient * .3}rad`);
    board.style.opacity = Math.min(boardSize * 1.5, 1);
    board.style.setProperty('--board-pitch', `${45 - boardTurn * 34}deg`);
    board.style.setProperty('--board-scale', Math.max(.2, boardSize));
    const pointerMoving = pointer.update(phase, ambient, !cinema.classList.contains('has-webgl'));
    model?.setPointer(pointer.x, pointer.y);
    const modelMoving = model?.render();
    if (phase > 1.56 && phase < 2.56 && !compact.matches) {
      const bounds = stage.getBoundingClientRect();
      labels.forEach(({ part, line }, index) => {
        // offsetLeft is independent of the line's current rotation.
        const start = line.parentElement.getBoundingClientRect();
        const x = start.left + line.offsetLeft;
        const y = start.top + line.offsetTop;
        const end = model?.anchor(part) ?? { x: bounds.width * (.66 + index * .045), y: bounds.height * (.45 + index * .084) };
        const dx = end.x + bounds.left - x;
        const dy = end.y + bounds.top - y;
        line.style.setProperty('--line-length', `${Math.hypot(dx, dy)}px`);
        line.style.setProperty('--line-angle', `${Math.atan2(dy, dx)}rad`);
      });
    }
    if (pointerMoving || modelMoving) drawSoon();
  }

  const selectScene = (scene) => select(`.scene-${scene}`);
  const fadeIn = (scene, start, duration = .28) =>
    timeline.to(selectScene(scene), { autoAlpha: 1, duration }, start);
  const fadeOut = (scene, start, duration = .24) =>
    timeline.to(selectScene(scene), { autoAlpha: 0, duration }, start);

  timeline = gsap.timeline({
    defaults: { ease: 'power2.inOut' },
    onUpdate: drawSoon,
    scrollTrigger: {
      trigger: stage, pin: true, start: 'top top', scrub: .4,
      end: () => `+=${Math.round(stage.clientHeight * (compact.matches ? 2.9 : 3.45))}`,
      onToggle(trigger) {
        active = trigger.isActive || trigger.progress === 0;
        if (active) drawSoon();
      },
      onRefresh: drawSoon,
    },
  });
  timeline
    .to(state, { phase: 5, duration: 5, ease: 'none' }, 0)
    .to(state, { chipSize: 1.17, chipTurn: .72, cameraMove: -.68, duration: .55 }, .08)
    .to(select('.scene-chip h1 span:first-child'), { xPercent: -13, duration: .4 }, .28)
    .to(select('.scene-chip h1 span:last-child'), { xPercent: 12, duration: .4 }, .28)
    .to(state, { chipSize: 0, chipTurn: 1.38, fanSize: 1, cameraMove: .18, duration: .58 }, .54)
    .to(state, { rotor: 1.65, fanTurn: .34, duration: .82 }, .65)
    .to(state, { rotor: 8.7, fanTurn: .86, split: 1, cameraMove: -.24, duration: .94 }, 1.47)
    .from(select('.fan-labels li'), {
      x: -28, clipPath: 'inset(0 100% 0 0)', duration: .27, stagger: .1, immediateRender: false,
    }, 1.79)
    .to(state, { fanSize: 0, fanTurn: 1.16, boardSize: 1.08, boardTurn: .23, cameraMove: .42, duration: .62 }, 2.41)
    .to(state, { boardTurn: .85, cameraMove: -.29, duration: 1.1 }, 2.94)
    .fromTo(select('.scene-board h2 b'), { yPercent: 115 }, {
      yPercent: 0, duration: .41, stagger: .17, immediateRender: false,
    }, 2.76)
    .to(state, { boardSize: .26, boardTurn: 1.18, cameraMove: 1.24, duration: .66 }, 3.47)
    .to(state, { boardSize: 0, duration: .32 }, 4.13)
    .from(select('.scene-system h2 span'), {
      y: 24, opacity: 0, duration: .27, stagger: .11, immediateRender: false,
    }, 3.86)
    .from(select('.system-modules li'), {
      y: 30, rotationX: -28, scale: .84, opacity: 0, duration: .31, stagger: .055, immediateRender: false,
    }, 4.08)
    .to(select('.cinema-art'), { opacity: .15, duration: .42 }, 4.58);
  fadeOut('chip', .46, .35);
  fadeIn('fan', .86);
  fadeOut('fan', 1.55);
  fadeIn('exploded', 1.75);
  fadeOut('exploded', 2.43, .3);
  fadeIn('board', 2.75);
  fadeOut('board', 3.56, .3);
  fadeIn('system', 3.85);
  fadeOut('system', 4.72, .28);

  gsap.to(state, { ambient: 1, duration: 2.2, yoyo: true, repeat: 3, ease: 'sine.inOut', onUpdate: drawSoon });
  gsap.from(select('.entry-inner'), {
    y: 36, scrollTrigger: { trigger: '.cinema-entry', start: 'top bottom', end: 'center center', scrub: true },
  });
  drawSoon();

  let timer;
  if ('WebGL2RenderingContext' in window && !navigator.connection?.saveData && (navigator.deviceMemory ?? 4) >= 4) {
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
        // Each CSS model follows the same timeline when WebGL is unavailable.
      }
    }, 300);
  }

  return () => {
    disposed = true;
    clearTimeout(timer);
    cancelAnimationFrame(frame);
    pointer.dispose();
    model?.dispose();
    [stage, chip, fan, board, ...labels.map(({ line }) => line)].forEach((node) => node.removeAttribute('style'));
    cinema.classList.remove('is-animated', 'has-webgl');
  };
}

