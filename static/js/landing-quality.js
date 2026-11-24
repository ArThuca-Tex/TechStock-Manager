export function landingQuality() {
  const compact = matchMedia('(max-width: 700px), (pointer: coarse)').matches;
  const limited = (navigator.deviceMemory ?? 4) <= 4 || (navigator.hardwareConcurrency ?? 6) <= 4;
  const requested = new URLSearchParams(location.search).get('qualidade');
  const automatic = compact || navigator.connection?.saveData ? 'baixa' : limited ? 'media' : 'alta';
  const level = ['alta', 'media', 'baixa'].includes(requested) ? requested : automatic;
  return {
    compact: level === 'baixa',
    pixelRatio: Math.min(devicePixelRatio, level === 'alta' ? 1.5 : level === 'media' ? 1.15 : 1),
    minPixelRatio: level === 'baixa' ? .7 : .8,
    swarm: level === 'baixa' ? 12 : level === 'media' ? 20 : 28,
    antialias: level === 'alta',
    detail: level === 'alta' ? 2 : 1,
  };
}
