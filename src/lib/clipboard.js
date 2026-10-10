/**
 * navigator.clipboard hanya tersedia di konteks aman (https/localhost).
 * Di jaringan lokal lewat IP — cara paling umum menguji di ponsel — ia tidak
 * ada, jadi disiapkan jalan lain lewat textarea tersembunyi.
 */
export async function copyText(text) {
  const value = String(text ?? '');
  if (!value) return false;

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    /* lanjut ke cara cadangan */
  }

  try {
    const field = document.createElement('textarea');
    field.value = value;
    field.setAttribute('readonly', '');
    field.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none';
    document.body.appendChild(field);
    field.select();
    field.setSelectionRange(0, value.length);
    const ok = document.execCommand('copy');
    field.remove();
    return ok;
  } catch {
    return false;
  }
}
