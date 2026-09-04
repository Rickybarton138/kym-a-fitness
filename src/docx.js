// Pull the plain text out of a .docx, in the browser, with no dependency.
//
// Paul: "Can I upload a file to the ai voice or just copy and paste?" His book
// is a Word document, and "export it as .txt first" is a rubbish answer for
// someone with a broken hand.
//
// A .docx is a ZIP holding word/document.xml. The browser can already inflate
// with DecompressionStream, so the only work is walking the ZIP's central
// directory to find that one entry. Everything is wrapped so a malformed file
// falls back to "paste it instead" rather than breaking the screen.

const u32 = (dv, at) => dv.getUint32(at, true)
const u16 = (dv, at) => dv.getUint16(at, true)

async function inflateRaw(bytes) {
  const ds = new DecompressionStream('deflate-raw')
  const stream = new Blob([bytes]).stream().pipeThrough(ds)
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

/** The bytes of one file inside a zip, or null if it isn't there. */
async function readZipEntry(buf, wanted) {
  const dv = new DataView(buf)
  const bytes = new Uint8Array(buf)

  // End of central directory: scan back from the end for its signature. The
  // trailing comment is at most 64k, so this is bounded.
  let eocd = -1
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65558); i--) {
    if (u32(dv, i) === 0x06054b50) { eocd = i; break }
  }
  if (eocd < 0) throw new Error('not a zip')

  let count = u16(dv, eocd + 10)
  let at = u32(dv, eocd + 16) // start of central directory

  while (count-- > 0) {
    if (u32(dv, at) !== 0x02014b50) break
    const method = u16(dv, at + 10)
    const compSize = u32(dv, at + 20)
    const nameLen = u16(dv, at + 28)
    const extraLen = u16(dv, at + 30)
    const commentLen = u16(dv, at + 32)
    const localAt = u32(dv, at + 42)
    const name = new TextDecoder().decode(bytes.subarray(at + 46, at + 46 + nameLen))

    if (name === wanted) {
      if (u32(dv, localAt) !== 0x04034b50) throw new Error('bad local header')
      const lNameLen = u16(dv, localAt + 26)
      const lExtraLen = u16(dv, localAt + 28)
      const start = localAt + 30 + lNameLen + lExtraLen
      const raw = bytes.subarray(start, start + compSize)
      if (method === 0) return raw
      if (method === 8) return await inflateRaw(raw)
      throw new Error('unsupported compression')
    }
    at += 46 + nameLen + extraLen + commentLen
  }
  return null
}

const ENTITIES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'" }

/** Readable text from Word's document.xml — paragraphs kept, markup dropped. */
export function docXmlToText(xml) {
  return xml
    .replace(/<w:p[ >]/g, '\n<w:p ')      // a paragraph starts a new line
    .replace(/<w:br\s*\/>/g, '\n')
    .replace(/<w:tab\s*\/>/g, ' ')
    .replace(/<[^>]+>/g, '')               // drop every remaining tag
    .replace(/&[a-z]+;|&#\d+;/gi, (m) => ENTITIES[m] || (m.startsWith('&#') ? String.fromCharCode(Number(m.slice(2, -1))) : m))
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** Text from a .docx File, or throws with something worth showing a person. */
export async function docxToText(file) {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('This browser cannot open Word files — paste the text in instead.')
  }
  let xml
  try {
    const entry = await readZipEntry(await file.arrayBuffer(), 'word/document.xml')
    if (!entry) throw new Error('no document.xml')
    xml = new TextDecoder().decode(entry)
  } catch {
    throw new Error('Could not open that Word file — try “Save As” a .txt, or paste the text in.')
  }
  const text = docXmlToText(xml)
  if (text.length < 200) throw new Error('That file looked empty — paste the text in instead.')
  return text
}
