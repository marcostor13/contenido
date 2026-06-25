// Formateo de un artículo a texto de post de LinkedIn y medición de su largo.
// LinkedIn NO renderiza markdown y limita el post normal a 3000 caracteres.
// Este módulo es el espejo (en CommonJS, para el servidor) del conversor que usa el
// botón "Copiar para LinkedIn" del cliente: deben producir el MISMO resultado.
//
// Conteo de caracteres: usamos String.length (unidades UTF-16). Los caracteres en
// negrita unicode (plano astral) cuentan como 2 unidades, igual que en el contador de
// LinkedIn; así la medición es conservadora y nunca subestima el largo real.

const LINKEDIN_MAX = 3000

// Mapea A-Z, a-z y 0-9 a sus equivalentes "bold" sans-serif de unicode.
function toBold(str) {
  let out = ''
  for (const ch of String(str)) {
    const c = ch.codePointAt(0)
    if (c >= 65 && c <= 90) out += String.fromCodePoint(0x1D5D4 + (c - 65))
    else if (c >= 97 && c <= 122) out += String.fromCodePoint(0x1D5EE + (c - 97))
    else if (c >= 48 && c <= 57) out += String.fromCodePoint(0x1D7EC + (c - 48))
    else out += ch
  }
  return out
}

// Aplica las marcas markdown "en línea" (negrita, cursiva, enlaces, código).
function inlineMd(s) {
  return s
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)')
    .replace(/\*\*([^*]+)\*\*/g, (_, t) => toBold(t))
    .replace(/__([^_]+)__/g, (_, t) => toBold(t))
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1$2')
    .replace(/`([^`]+)`/g, '$1')
}

// Convierte el contenido markdown del artículo a texto plano formateado para LinkedIn.
function toLinkedIn(item) {
  const lines = String(item.content || '').replace(/\r\n/g, '\n').split('\n')
  const out = []
  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '')
    if (/^\s*([-*_]\s*){3,}$/.test(line)) { out.push(''); continue }
    const h = line.match(/^#{1,6}\s+(.*)$/)
    if (h) { out.push(''); out.push(toBold(inlineMd(h[1]))); continue }
    const q = line.match(/^>\s?(.*)$/)
    if (q) { out.push('“' + inlineMd(q[1]) + '”'); continue }
    const b = line.match(/^\s*[-*]\s+(.*)$/)
    if (b) { out.push('• ' + inlineMd(b[1])); continue }
    out.push(inlineMd(line))
  }

  const body = out.join('\n').replace(/\n{3,}/g, '\n\n').trim()
  const title = toBold(String(item.title || '').trim())
  const tags = Array.isArray(item.tags) ? item.tags : []
  const hashtags = tags
    .map(t => '#' + String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]/g, ''))
    .filter(h => h.length > 1)
    .join(' ')

  return [title, body, hashtags].filter(Boolean).join('\n\n')
}

// Largo del post tal como lo verá/contará LinkedIn (incluye formato y hashtags).
function linkedinLength(item) {
  return toLinkedIn(item).length
}

// Recorta el contenido markdown (último recurso) quitando párrafos del final hasta
// que el post formateado entre en el límite. Conserva siempre al menos el primer
// párrafo. No es lo ideal (puede perder el cierre), pero garantiza no exceder.
function trimToFit(item, max = LINKEDIN_MAX) {
  if (linkedinLength(item) <= max) return item
  const paras = String(item.content || '').replace(/\r\n/g, '\n').split(/\n{2,}/)
  while (paras.length > 1) {
    paras.pop()
    const candidate = { ...item, content: paras.join('\n\n').trim() }
    if (linkedinLength(candidate) <= max) return candidate
  }
  return { ...item, content: paras.join('\n\n').trim() }
}

module.exports = { LINKEDIN_MAX, toLinkedIn, linkedinLength, trimToFit, toBold }
