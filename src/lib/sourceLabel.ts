/**
 * A source card may only print a citation the corpus actually states. Internal
 * record ids ("FIA_NR3C_CYBER") and chunk keys are filing labels, not sections,
 * so they never appear beside a citizen-facing source.
 */
export function provisionLabel(src: { type?: string; key?: string } | null | undefined): string {
  const key = String(src?.key || '').trim();
  if (!key) return '';
  const order = key.match(/^ORDER_(\d+)/i);
  if (order) return `Order ${order[1]}`;
  if (!/^\d+[A-Za-z]*(?:\([0-9ivxIVX]+\))?$/.test(key)) return '';
  return [src?.type, key].filter(Boolean).join(' ');
}
