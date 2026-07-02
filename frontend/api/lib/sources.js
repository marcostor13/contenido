// Obtención de noticias REALES, generales e impactantes (sin API key).
// Usamos los feeds RSS de Google Noticias en español: traen lo más relevante y
// curioso del día (no técnico), pensado para que cualquier persona se enganche.
// Luego el pipeline les encuentra una moraleja conectada con la IA y la productividad.

// Feed principal: portada / lo más importante del día.
const GN_TOP = 'https://news.google.com/rss?hl=es-419&gl=US&ceid=US:es-419'

// Búsquedas rotadas para sumar noticias curiosas / impactantes / humanas.
const GN_QUERIES = [
  'https://news.google.com/rss/search?q=insólito%20OR%20increíble%20OR%20histórico&hl=es-419&gl=US&ceid=US:es-419',
  'https://news.google.com/rss/search?q=récord%20OR%20sorprendente%20OR%20viral&hl=es-419&gl=US&ceid=US:es-419',
  'https://news.google.com/rss/search?q=historia%20OR%20descubrimiento%20OR%20curiosidad&hl=es-419&gl=US&ceid=US:es-419',
  'https://news.google.com/rss/search?q=ciencia%20OR%20naturaleza%20OR%20espacio&hl=es-419&gl=US&ceid=US:es-419',
  // Noticias de IA/tecnología con impacto en el trabajo y los negocios de la gente
  // (materia prima directa para el posicionamiento como referente tech).
  'https://news.google.com/rss/search?q=inteligencia%20artificial%20trabajo%20OR%20empleo%20OR%20empresas&hl=es-419&gl=US&ceid=US:es-419',
  'https://news.google.com/rss/search?q=inteligencia%20artificial%20OR%20ChatGPT%20OR%20tecnología%20productividad&hl=es-419&gl=US&ceid=US:es-419',
  'https://news.google.com/rss/search?q=emprendedores%20OR%20negocios%20tecnología%20OR%20digital&hl=es-419&gl=US&ceid=US:es-419',
]

const decode = (s = '') =>
  s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ').trim()

const pick = (block, tag) => {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'))
  return m ? decode(m[1]) : ''
}

// Parsea un feed RSS y devuelve los items con título, link, descripción y fuente.
async function fetchFeed(url) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 8000)
  let res
  try {
    res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; contenido-autogen/1.0)' }, signal: ctrl.signal })
  } finally {
    clearTimeout(timer)
  }
  if (!res.ok) throw new Error(`Fuente no disponible (${res.status})`)
  const xml = await res.text()
  const items = []
  const re = /<item>([\s\S]*?)<\/item>/g
  let m
  while ((m = re.exec(xml)) !== null) {
    const b = m[1]
    const title = pick(b, 'title')
    const link = pick(b, 'link')
    if (!title || !link) continue
    items.push({
      title,
      link,
      description: pick(b, 'description'),
      source: pick(b, 'source'),
      guid: pick(b, 'guid') || link,
    })
  }
  return items
}

// Extrae texto plano legible de una página web (mejor esfuerzo, sin deps).
async function fetchArticleText(url, maxChars = 6000) {
  if (!url) return ''
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 8000)
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; contenido-autogen/1.0)' },
      redirect: 'follow',
      signal: ctrl.signal,
    })
    if (!res.ok) return ''
    const ctype = res.headers.get('content-type') || ''
    if (!ctype.includes('text/html') && !ctype.includes('text/plain')) return ''
    const html = await res.text()
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&[a-z]+;/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    return text.slice(0, maxChars)
  } catch {
    return ''
  } finally {
    clearTimeout(timer)
  }
}

// Devuelve una noticia { key, title, url, summary, source } real y todavía no usada.
// `usedKeys` es un Set con identificadores ya procesados, para no repetir.
async function pickFreshStory(usedKeys = new Set()) {
  const pool = []

  // Portada del día (lo más relevante / impactante).
  try { pool.push(...(await fetchFeed(GN_TOP))) } catch {}

  // Una búsqueda rotada de noticias curiosas / humanas.
  const q = GN_QUERIES[Math.floor(Math.random() * GN_QUERIES.length)]
  try { pool.push(...(await fetchFeed(q))) } catch {}

  const candidates = pool
    .filter(h => h && h.title)
    .filter(h => !usedKeys.has(`gn:${h.guid}`) && !usedKeys.has(h.link))

  // Mezclar para variar el tema en cada corrida.
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[candidates[i], candidates[j]] = [candidates[j], candidates[i]]
  }

  const chosen = candidates[0]
  if (!chosen) return null

  return {
    key: `gn:${chosen.guid}`,
    title: chosen.title,
    url: chosen.link,
    summary: chosen.description,
    source: chosen.source,
    discussion: '',
  }
}

module.exports = { pickFreshStory, fetchArticleText, fetchFeed }
