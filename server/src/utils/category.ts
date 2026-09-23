const CATEGORY_ALIASES: Record<string, string> = {
  'top up': 'Top Up Saldo',
  'top up saldo': 'Top Up Saldo',
  'tup up saldo': 'Top Up Saldo',
  bensin: 'Belanja Bensin',
  'belanja bensin': 'Belanja Bensin',
};

export function normalizeCategoryLabel(value: string) {
  const label = value.trim().replace(/\s+/g, ' ');
  return CATEGORY_ALIASES[label.toLocaleLowerCase('id-ID')] ?? label;
}

export function categoryKey(value: string) {
  return normalizeCategoryLabel(value).toLocaleLowerCase('id-ID');
}