/**
 * Deterministic Mulberry32 32-bit pseudo-random number generator.
 */
export class Mulberry32 {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /**
   * Returns next float in [0, 1).
   */
  next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    this.state = t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * Returns random integer in [min, max] inclusive.
   */
  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  /**
   * Returns a random item from an array.
   */
  choice<T>(items: T[]): T {
    if (items.length === 0) {
      throw new Error('Cannot pick from empty array');
    }
    return items[this.nextInt(0, items.length - 1)];
  }

  /**
   * Shuffles an array in place (Fisher-Yates) deterministically.
   */
  shuffle<T>(array: T[]): T[] {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.nextInt(0, i);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}
