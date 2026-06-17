// Obtención de contenido REAL desde fuentes públicas (sin API key).
// Usamos la API de Hacker News (Algolia) que expone historias reales y
// trending: ideal para temas impactantes de tecnología y herramientas de
// productividad. Devolvemos un tema todavía no usado en la base.

const HN_FRONT = 'https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=30'
// Búsquedas orientadas a herramientas / productividad (Show HN y queries útiles).
const HN_QUERIES = [
  'https://hn.algolia.com/api/v1/search_by_date?tags=show_hn&hitsPerPage=30',
  'https://hn.algolia.com/api/v1/search?query=productivity%20tool&tags=story&hitsPerPage=30',
  'https://hn.algolia.com/api/v1/search?query=AI%20tool&tags=story&hitsPerPage=30',
]

async function fetchJson(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'contenido-autogen/1.0' } })
  if (!res.ok) throw new Error(`Fuente no disponible (${res.status}): ${url}`)
  return res.json()
}

// Extrae texto plano legible de una página web (mejor esfuerzo, sin deps).
async function fetchArticleText(url, maxChars = 6000) {
  if (!url) return ''
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; contenido-autogen/1.0)' },
      redirect: 'follow',
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
  }
}

// Devuelve un candidato { title, url, points, objectID, discussion } real,
// priorizando los de mayor relevancia y que no se hayan usado antes.
// `usedKeys` es un Set con identificadores ya procesados.
async function pickFreshStory(usedKeys = new Set()) {
  const pool = []

  // Front page (impactante / interesante).
  try {
    const front = await fetchJson(HN_FRONT)
    pool.push(...(front.hits || []))
  } catch {}

  // Una query rotada de productividad / herramientas.
  const q = HN_QUERIES[Math.floor(Math.random() * HN_QUERIES.length)]
  try {
    const extra = await fetchJson(q)
    pool.push(...(extra.hits || []))
  } catch {}

  const candidates = pool
    .filter(h => h && h.title && (h.url || h.story_text))
    .filter(h => !usedKeys.has(`hn:${h.objectID}`) && !usedKeys.has(h.url))
    .sort((a, b) => (b.points || 0) - (a.points || 0))

  const chosen = candidates[0]
  if (!chosen) return null

  return {
    key: `hn:${chosen.objectID}`,
    title: chosen.title,
    url: chosen.url || '',
    points: chosen.points || 0,
    discussion: `https://news.ycombinator.com/item?id=${chosen.objectID}`,
    objectID: chosen.objectID,
  }
}

module.exports = { pickFreshStory, fetchArticleText, fetchJson }
