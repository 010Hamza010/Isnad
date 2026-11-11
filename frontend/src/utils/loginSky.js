// The login page's decorative isnad (no real data: nobody is logged in yet). A seeded random
// network that branches up from me and converges on one star at the top, laid out by skyLayout.
import { skyLayout } from './isnadSky.js';

/** Small seeded generator (mulberry32), so the picture is the same on every visit. */
export function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** /graph/full-shaped data: `depth` generations, widest in the middle, one person at the top. */
export function demoNetwork({ seed = 7, depth = 9, widest = 6 } = {}) {
  const rnd = seeded(seed);
  const matnEdges = [];
  let next = 1, layer = [0];
  for (let d = 1; d <= depth; d++) {
    const t = d / depth;
    const width = d === depth ? 1 : Math.max(1, Math.round(widest * Math.sin(Math.PI * Math.min(t * 1.15, 1))));
    const ids = Array.from({ length: width }, () => next++);
    // every student reaches one or two shaykhs above; every shaykh has at least one student
    layer.forEach((s, i) => {
      const a = ids[Math.floor((i / layer.length) * ids.length)];
      matnEdges.push({ from_person_id: s, to_person_id: a });
      if (ids.length > 1 && rnd() < 0.45) matnEdges.push({ from_person_id: s, to_person_id: ids[Math.floor(rnd() * ids.length)] });
    });
    ids.forEach(id => {
      if (!matnEdges.some(e => e.to_person_id === id)) matnEdges.push({ from_person_id: layer[Math.floor(rnd() * layer.length)], to_person_id: id });
    });
    layer = ids;
  }
  return { persons: [], matnEdges, quranEdges: [] };
}

/** skyLayout of the demo network. */
export const loginSky = opts => skyLayout(demoNetwork(opts));
