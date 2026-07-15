// Fuentes de material real (sin API key). Combina:
//  1. NOTICIAS: Google Noticias RSS en español (portada mundial + queries temáticas).
//  2. REDES SOCIALES EN TENDENCIA: lo que está caliente AHORA en foros/agregadores
//     sociales públicos — Reddit (top del día de subs relevantes) y Hacker News
//     (portada). Son "redes sociales" con feed abierto, ideales para captar tendencias
//     actuales antes de que lleguen a los medios tradicionales.
// El criterio sigue siendo IMPORTANCIA/INTERÉS real, no rareza inventada. El contenido
// se escribe en español aunque la fuente venga en inglés (tendencia global → explicada
// para el público latino).

// User-Agent tipo navegador: algunos feeds sociales (Reddit) rechazan bots genéricos.
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

// ─── 1) Novedades de IA (Google Noticias) ─────────────────────────────────────
// Enfocado en herramientas/novedades de IA y productividad (los dos temas del sistema).
const GN_TOP = 'https://news.google.com/rss/search?q=inteligencia+artificial+OR+IA+OR+ChatGPT&hl=es-419&gl=US&ceid=US:es-419'
const GN_QUERIES = [
  'https://news.google.com/rss/search?q=nueva+herramienta+de+IA+OR+lanzamiento+de+IA+OR+ChatGPT+OR+Gemini+OR+Claude&hl=es-419&gl=US&ceid=US:es-419',
  'https://news.google.com/rss/search?q=IA+productividad+OR+automatización+OR+agentes+de+IA&hl=es-419&gl=US&ceid=US:es-419',
  'https://news.google.com/rss/search?q=inteligencia+artificial+trabajo+OR+empleo+OR+empresas&hl=es-419&gl=US&ceid=US:es-419',
  'https://news.google.com/rss/search?q=herramientas+tecnología+OR+apps+OR+software+productividad&hl=es-419&gl=US&ceid=US:es-419',
]

// ─── 2) Redes sociales en tendencia (feeds públicos, sin key) ─────────────────
// Reddit: top del día = lo más votado en las últimas 24 h. Subs de IA / herramientas /
// productividad para captar lo que está sonando AHORA en el nicho.
const REDDIT_SUBS = [
  'artificial', 'ChatGPT', 'OpenAI', 'ClaudeAI',
  'productivity', 'InternetIsBeautiful', 'technology', 'SideProject',
]
const REDDIT_FEEDS = REDDIT_SUBS.map(s => `https://www.reddit.com/r/${s}/top/.rss?t=day&limit=25`)
// Hacker News: portada (tracción real) + Show HN (productos y herramientas nuevas).
const HN_FEEDS = [
  'https://hnrss.org/frontpage?points=50',
  'https://hnrss.org/show?points=30',
]
const TRENDING_FEEDS = [...REDDIT_FEEDS, ...HN_FEEDS]

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

// Extrae el enlace del elemento, tolerando RSS (<link>URL</link>) y Atom (<link href="URL"/>).
const pickLink = (block) => {
  const rss = block.match(/<link>([\s\S]*?)<\/link>/i)
  if (rss && rss[1].trim()) return decode(rss[1])
  // Atom: preferí rel="alternate"; si no, el primer href.
  const alt = block.match(/<link[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["']/i)
  if (alt) return decode(alt[1])
  const any = block.match(/<link[^>]*href=["']([^"']+)["']/i)
  return any ? decode(any[1]) : ''
}

// Parsea un feed RSS 2.0 (<item>) o Atom (<entry>) y devuelve items normalizados.
async function fetchFeed(url) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 9000)
  let res
  try {
    res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*' },
      redirect: 'follow',
      signal: ctrl.signal,
    })
  } finally {
    clearTimeout(timer)
  }
  if (!res.ok) throw new Error(`Fuente no disponible (${res.status})`)
  const xml = await res.text()

  // RSS usa <item>; Atom (Reddit) usa <entry>.
  const isAtom = !/<item[\s>]/i.test(xml) && /<entry[\s>]/i.test(xml)
  const re = isAtom ? /<entry[\s>]([\s\S]*?)<\/entry>/gi : /<item[\s>]([\s\S]*?)<\/item>/gi

  const items = []
  let m
  while ((m = re.exec(xml)) !== null) {
    const b = m[1]
    const title = pick(b, 'title')
    const link = pickLink(b)
    if (!title || !link) continue
    items.push({
      title,
      link,
      description: pick(b, 'description') || pick(b, 'summary') || pick(b, 'content'),
      source: pick(b, 'source'),
      guid: pick(b, 'guid') || pick(b, 'id') || link,
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
      headers: { 'User-Agent': UA },
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

const shuffle = (arr) => {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

// Devuelve una historia { key, title, url, summary, source, discussion } real y aún no
// usada. Mezcla noticias (Google Noticias) con tendencias sociales (Reddit / Hacker News)
// para que el contenido combine lo importante con lo que está caliente ahora mismo.
async function pickFreshStory(usedKeys = new Set()) {
  const pool = []

  // Noticias: portada + una query temática rotada.
  try { pool.push(...(await fetchFeed(GN_TOP)).map(h => ({ ...h, kind: 'gn' }))) } catch {}
  const q = GN_QUERIES[Math.floor(Math.random() * GN_QUERIES.length)]
  try { pool.push(...(await fetchFeed(q)).map(h => ({ ...h, kind: 'gn' }))) } catch {}

  // Redes sociales en tendencia: dos feeds rotados (para variar la comunidad/tema).
  for (const feed of shuffle([...TRENDING_FEEDS]).slice(0, 2)) {
    try { pool.push(...(await fetchFeed(feed)).map(h => ({ ...h, kind: 'soc' }))) } catch {}
  }

  const keyOf = (h) => `${h.kind}:${h.guid}`
  const candidates = pool
    .filter(h => h && h.title && h.link)
    .filter(h => !usedKeys.has(keyOf(h)) && !usedKeys.has(h.link))

  const chosen = shuffle(candidates)[0]
  if (!chosen) return null

  return {
    key: keyOf(chosen),
    title: chosen.title,
    url: chosen.link,
    summary: chosen.description,
    source: chosen.source || (chosen.kind === 'soc' ? 'Tendencia en redes' : ''),
    discussion: '',
  }
}

module.exports = { pickFreshStory, fetchArticleText, fetchFeed }
