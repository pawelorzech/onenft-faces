/**
 * A 32x32 canvas of roles, the unit every sprite is drawn in.
 *
 * A pixel is a role, not a colour: 0 nothing, 1 outline, 2 fill, 3 fill shade,
 * 4 fill light, 5 second fill, 6 second shade, 7 white. The token's palette turns
 * roles into colours at render time, so one hair sprite serves every hair colour
 * and one top every top colour. Three bits per pixel: a layer is 384 bytes.
 */
export const N = 32;
export const ROLE = { none: 0, K: 1, A: 2, a: 3, L: 4, B: 5, b: 6, W: 7 } as const;
export type Role = (typeof ROLE)[keyof typeof ROLE];
const CH = ".KAaLBbW";

export class Canvas {
  g: Uint8Array = new Uint8Array(N * N);
  get(x: number, y: number): number { return x < 0 || y < 0 || x >= N || y >= N ? 0 : this.g[y * N + x]; }
  px(x: number, y: number, r: Role) { if (x >= 0 && y >= 0 && x < N && y < N) this.g[y * N + x] = r; }
  rect(x: number, y: number, w: number, h: number, r: Role) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.px(i, j, r); }
  hline(x0: number, x1: number, y: number, r: Role) { for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) this.px(x, y, r); }
  vline(x: number, y0: number, y1: number, r: Role) { for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) this.px(x, y, r); }
  /** Filled ellipse, centre (cx, cy) in pixel units, radii rx, ry. */
  ellipse(cx: number, cy: number, rx: number, ry: number, r: Role) {
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy <= 1) this.px(x, y, r);
    }
  }
  /** Paint rows of role letters at (x, y). */
  rows(x: number, y: number, rows: string[]) {
    rows.forEach((row, dy) => [...row].forEach((c, dx) => { const r = CH.indexOf(c); if (r > 0) this.px(x + dx, y + dy, r as Role); }));
  }
  /** Every filled pixel that touches nothing (4-neighbours) becomes outline. Shapes lose one pixel of fill at the edge. */
  outline() {
    const src = this.g.slice();
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const v = src[y * N + x];
      if (!v || v === ROLE.K) continue;
      const nb = [src[(y - 1) * N + x] ?? 0, y + 1 < N ? src[(y + 1) * N + x] : 0, x > 0 ? src[y * N + x - 1] : 0, x + 1 < N ? src[y * N + x + 1] : 0];
      if (nb.some((n) => n === 0)) this.g[y * N + x] = ROLE.K;
    }
  }
  /** The right edge of every fill run becomes shade: a lamp on the left. */
  shadeRight(depth = 1) {
    const src = this.g.slice();
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const v = src[y * N + x];
      if (v !== ROLE.A && v !== ROLE.B) continue;
      let edge = false;
      for (let d = 1; d <= depth; d++) { const n = x + d < N ? src[y * N + x + d] : 0; if (n === ROLE.K || n === 0) edge = true; }
      if (edge) this.g[y * N + x] = v === ROLE.A ? ROLE.a : ROLE.b;
    }
  }
  toRows(): string[] { const out: string[] = []; for (let y = 0; y < N; y++) { let s = ""; for (let x = 0; x < N; x++) s += CH[this.g[y * N + x]]; out.push(s); } return out; }
  static fromRows(rows: string[]): Canvas { const c = new Canvas(); c.rows(0, 0, rows); return c; }
  /** 384 bytes, three bits per pixel, row by row, most significant first. The chain format. */
  encode(): Uint8Array {
    const out = new Uint8Array((N * N * 3) / 8);
    let bit = 0;
    for (let i = 0; i < N * N; i++) {
      const v = this.g[i];
      for (let b = 2; b >= 0; b--) { if ((v >> b) & 1) out[bit >> 3] |= 0x80 >> (bit & 7); bit++; }
    }
    return out;
  }
  static decode(bytes: Uint8Array): Canvas {
    const c = new Canvas();
    let bit = 0;
    for (let i = 0; i < N * N; i++) {
      let v = 0;
      for (let b = 0; b < 3; b++) { v = (v << 1) | ((bytes[bit >> 3] >> (7 - (bit & 7))) & 1); bit++; }
      c.g[i] = v;
    }
    return c;
  }
}
