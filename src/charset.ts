/** Glyphs available to the renderer: printable ASCII plus two soft dots for snow. */
export const CHARSET =
  ' !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~·•';

const index = new Map<string, number>();
[...CHARSET].forEach((c, i) => index.set(c, i));

/** Char -> glyph index (unknown chars become a space). */
export const ci = (c: string) => index.get(c) ?? 0;

/** String -> array of glyph indices. */
export const cis = (s: string) => [...s].map(ci);
