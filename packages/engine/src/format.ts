const NBSP = ' ';
const MONTHS_FR = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

/** « 3 500 000 F CFA » : espace insécable, sans décimale. Pas d'Intl : le rendu ne dépend pas des données ICU. */
export function formatMoney(value: bigint): string {
  const negative = value < 0n;
  const digits = (negative ? -value : value).toString();
  const grouped = digits.replace(/\B(?=(\d{3})+$)/g, NBSP);
  return `${negative ? '−' : ''}${grouped}${NBSP}F${NBSP}CFA`;
}

/** « 18 octobre 2026 » depuis « 2026-10-18 ». */
export function formatDate(iso: string): string {
  const [year, month, day] = iso.split('-');
  const monthName = MONTHS_FR[Number.parseInt(month ?? '', 10) - 1];
  if (year === undefined || day === undefined || monthName === undefined) {
    throw new RangeError(`Date invalide : ${iso}`);
  }
  return `${day === '01' ? '1er' : String(Number.parseInt(day, 10))} ${monthName} ${year}`;
}
