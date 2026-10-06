/** Deterministic PRNG (mulberry32) so the demo dataset is identical on every load. */
export function makeRng(seed: number) {
  let a = seed >>> 0
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const int = (min: number, max: number) => Math.floor(next() * (max - min + 1)) + min
  const pick = <T>(list: readonly T[]): T => list[Math.floor(next() * list.length)]
  const chance = (p: number) => next() < p
  const weighted = <T>(entries: readonly (readonly [T, number])[]): T => {
    const total = entries.reduce((s, [, w]) => s + w, 0)
    let r = next() * total
    for (const [value, w] of entries) {
      r -= w
      if (r <= 0) return value
    }
    return entries[entries.length - 1][0]
  }
  const shuffle = <T>(list: readonly T[]): T[] => {
    const copy = [...list]
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(next() * (i + 1))
      ;[copy[i], copy[j]] = [copy[j], copy[i]]
    }
    return copy
  }
  return { next, int, pick, chance, weighted, shuffle }
}

export type Rng = ReturnType<typeof makeRng>
