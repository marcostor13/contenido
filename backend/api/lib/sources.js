// Fuentes de noticias reales e importantes (sin API key).
// Google Noticias RSS en español: top mundial + queries temáticas rotadas.
// El criterio es IMPORTANCIA e IMPACTO, no rareza ni viralidad.

// Portada mundial: lo más importante del momento.
const GN_TOP = 'https://news.google.com/rss?hl=es-419&gl=US&ceid=US:es-419'

// Queries rotadas por área de alto impacto.
const GN_QUERIES = [
  'https://news.google.com/rss/search?q=inteligencia+artificial+OR+tecnología+OR+innovación&hl=es-419&gl=US&ceid=US:es-419',
  'https://news.google.com/rss/search?q=economía+OR+mercados+OR+crisis+OR+inflación+OR+dinero&hl=es-419&gl=US&ceid=US:es-419',
  'https://news.google.com/rss/search?q=ciencia+OR+salud+OR+clima+OR+medio+ambiente&hl=es-419&gl=US&ceid=US:es-419',
  'https://news.google.com/rss/search?q=geopolítica+OR+conflicto+OR+sociedad+OR+derechos&hl=es-419&gl=US&ceid=US:es-419',
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

async function pickFreshStory(usedKeys = new Set()) {
  const pool = []

  try { pool.push(...(await fetchFeed(GN_TOP))) } catch {}

  const q = GN_QUERIES[Math.floor(Math.random() * GN_QUERIES.length)]
  try { pool.push(...(await fetchFeed(q))) } catch {}

  const candidates = pool
    .filter(h => h && h.title)
    .filter(h => !usedKeys.has(`gn:${h.guid}`) && !usedKeys.has(h.link))

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
