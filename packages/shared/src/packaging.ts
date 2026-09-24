/**
 * حسابات التعبئة: البلاطة كام متر، الكرتونة كام متر، والبالتة كام متر.
 * المقاسات بالملّيمتر عشان مفيش كسور.
 */
export function round(value: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * f) / f;
}

export function sqmPerPiece(lengthMm: number, widthMm: number): number {
  return (lengthMm * widthMm) / 1_000_000;
}

export function sqmPerCarton(lengthMm: number, widthMm: number, piecesPerCarton: number): number {
  return round(sqmPerPiece(lengthMm, widthMm) * piecesPerCarton, 4);
}

export function sqmPerPallet(lengthMm: number, widthMm: number, piecesPerCarton: number, cartonsPerPallet: number): number {
  return round(sqmPerCarton(lengthMm, widthMm, piecesPerCarton) * cartonsPerPallet, 4);
}

/** "600×600" mm → "٦٠×٦٠" cm label as used on the factory floor. */
export function sizeLabel(lengthMm: number, widthMm: number): string {
  const cm = (mm: number) => {
    const v = mm / 10;
    return Number.isInteger(v) ? String(v) : v.toFixed(1);
  };
  return `${cm(widthMm)}×${cm(lengthMm)}`;
}
