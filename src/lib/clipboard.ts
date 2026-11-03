/**
 * Clipboard write with a legacy fallback.
 *
 * The promise must be honest: a caller shows "Copied" only when this returns
 * true. navigator.clipboard is absent outside a secure context and the
 * execCommand fallback can itself be refused, so both failures return false
 * instead of silently claiming success.
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}
