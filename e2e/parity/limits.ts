// What counts as a match between the app and the prototype in the image check (TOKI-109 R9). All
// three values are set here and nowhere else.
export const LIMITS = {
  // The ratio of different pixels to all pixels; the image matches when it is at most this.
  // Started at 0.02 (concern 2); tuned on real screens.
  ratio: 0.02,
  // `pixelmatch`: the distance of colour, from 0 to 1, above which two pixels differ. In pixelmatch
  // 8 it is the OKLab HyAB distance; a smaller value is more sensitive.
  threshold: 0.1,
  // `pixelmatch`: false ignores the soft edges of text and shapes (anti-aliasing).
  includeAA: false,
} as const;
