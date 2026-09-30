/**
 * Escape untuk Moodle XML (M12).
 *
 * Moodle mengimpor `<text>` sebagai HTML/CDATA. Dua konteks berbeda:
 *  - **Atribut** (`fraction="…"`, `format="…"`) → escape tanda kutip tunggal/ganda.
 *  - **Teks/elemen** → pakai **CDATA** karena isinya boleh HTML (KaTeX mentah
 *    berisi `<`, `&`, dsb.). CDATA menghindari escape berlebihan.
 */

/** Escape untuk nilai atribut XML. */
export function escapeXmlAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Escape teks XML biasa (bukan atribut). */
export function escapeXmlText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Bungkus teks ke CDATA yang **aman**: bila isi mengandung `]]>`, pecah agar
 * tak menutup blok lebih awal (satu-satunya urutan terlarang dalam CDATA).
 */
export function cdata(value: string): string {
  return `<![CDATA[${value.replace(/]]>/g, "]]]]><![CDATA[>")}]]>`;
}
