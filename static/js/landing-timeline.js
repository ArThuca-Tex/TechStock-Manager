export const cues = Object.freeze({
  motherboardEnter: .48, motherboardExit: .56, motherboardPause: .56,
  coolerEnter: .61, coolerExit: .69, coolerPause: .69,
  cpuEnter: .74, cpuExit: .82, cpuPause: .82,
  loginEnter: .87, jellyfishExit: .94,
});

export function underwaterCue(progress) {
  for (const hardware of ['motherboard', 'cooler', 'cpu']) {
    const start = cues[hardware + 'Enter'];
    const end = cues[hardware + 'Exit'];
    if (progress >= start && progress < end) {
      const t = (progress - start) / (end - start);
      return { hardware, descent: t + .25 * t * (1 - t) };
    }
  }
  return { hardware: null, descent: 0 };
}
