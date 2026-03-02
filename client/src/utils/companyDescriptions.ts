/**
 * Maps company name (as it appears in the data) to optional description text.
 * Used to add a Description column to the AI Results table/export only.
 * Extend this map for more companies or variants.
 */
const DESCRIPTIONS: Record<string, string> = {
  'Coca-Cola Europacific':
    "Coca-Cola Europacific Partners (CCEP) is the world's largest independent Coca-Cola bottler. While The Coca-Cola Company owns the brands and formulas, CCEP is the operational giant that manufactures, distributes, and sells them across 31 countries in Europe and the Asia-Pacific.",
  'Coca-Cola Company':
    "The Coca-Cola Company is the brand owner and formula holder. It licenses its trademarks and concentrates to bottlers worldwide; it does not manufacture or distribute the finished drinks in most markets.",
  'Sprite LLC':
    "Sprite is a lemon-lime soft drink brand owned by The Coca-Cola Company. 'Sprite LLC' in the list is a legal or regional entity name under which the brand is operated.",
  'Fanta Inc.':
    "Fanta is a global soft drink brand owned by The Coca-Cola Company. 'Fanta Inc.' represents a subsidiary or regional entity that markets and distributes Fanta.",
}

export function getDescriptionForCompanyName(companyName: string | undefined): string {
  const key = (companyName ?? '').trim()
  return DESCRIPTIONS[key] ?? ''
}
