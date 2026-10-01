import { COLOR_PALETTES } from '../constants/colorPalettes';

/**
 * Deterministically retrieves a color palette based on a string key (e.g. category name).
 * @param {string} keyName
 * @returns {object} Palette configuration object with tailwind color classes
 */
export function getPalette(keyName) {
  if (!keyName) return COLOR_PALETTES[0];
  let hash = 0;
  const str = String(keyName);
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return COLOR_PALETTES[Math.abs(hash) % COLOR_PALETTES.length];
}

/**
 * Category-specific palette resolver with semantic category matching.
 * @param {string} categoryName
 * @returns {object} Palette configuration
 */
export function getCategoryPalette(categoryName) {
  if (!categoryName) return COLOR_PALETTES[0];
  const cat = String(categoryName).toLowerCase();
  if (cat.includes('sales')) return COLOR_PALETTES[0]; // emerald
  if (cat.includes('marketing')) return COLOR_PALETTES[1]; // purple
  if (cat.includes('finance')) return COLOR_PALETTES[2]; // sky
  if (cat.includes('operations') || cat.includes('system')) return COLOR_PALETTES[3]; // amber
  if (cat.includes('support')) return COLOR_PALETTES[4]; // rose
  if (cat.includes('executive') || cat.includes('bi')) return COLOR_PALETTES[5]; // indigo
  return getPalette(categoryName);
}
