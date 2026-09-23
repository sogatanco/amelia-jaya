const CATEGORY_ALIASES: Record<string, string> = {
  'tup up saldo': 'Top Up Saldo',
};

export function normalizeCategoryLabel(value: string) {
  const label = value.trim().replace(/\s+/g, ' ');
  return CATEGORY_ALIASES[label.toLocaleLowerCase('id-ID')] ?? label;
}

export function categoryKey(value: string) {
  return normalizeCategoryLabel(value).toLocaleLowerCase('id-ID');
}