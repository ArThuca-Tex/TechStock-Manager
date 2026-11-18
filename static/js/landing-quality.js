export function landingQuality() {
  const compact = matchMedia('(max-width: 700px), (pointer: coarse)').matches;
  const limited = (navigator.deviceMemory ?? 4) <= 4 || (navigator.hardwareConcurrency ?? 6) <= 4;
  return {
    compact,
    pixelRatio: Math.min(devicePixelRatio, compact || limited ? 1 : 1.5),
    minPixelRatio: compact ? .7 : .8,
    swarm: compact ? 17 : limited ? 23 : 32,
    antialias: !compact && !limited,
    detail: compact || limited ? 1 : 2,
  };
}
