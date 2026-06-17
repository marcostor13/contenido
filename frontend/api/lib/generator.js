// Pipeline de generación de contenido (pasos 2 y 3 del módulo).
//  Paso 2: analizar el material obtenido y relacionarlo con la tecnología
//          actual y la inteligencia artificial.
//  Paso 3: analizar viralidad y storytelling, generar el artículo final y
//          guardarlo en la base con la estructura del proyecto.

const { articles, getSettings, saveSettings } = require('./db')
const { pickProvider, chat } = require('./llm')
const { pickFreshStory, fetchArticleText } = require('./sources')

const slugify = (s) =>
  s.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim().replace(/\s+/g, '-')
    .slice(0, 80)

// Prompt de sistema: define el tono y el rol del modelo.
const SYSTEM_PROMPT = `Sos un editor de contenido viral en español que escribe para un público general (no técnico).
Tu trabajo es tomar una noticia o herramienta REAL y convertirla en un artículo interesantísimo,
conectándola con la tecnología actual y la inteligencia artificial.

Reglas de tono y estilo:
- Amical y cercano, como si le contaras algo fascinante a un amigo. Nada de jerga técnica ni tecnicismos.
- Ni muy formal ni acartonado, pero tampoco vulgar.
- Storytelling: empezá con un gancho que enganche, contá una historia, generá curiosidad.
- Todo debe basarse en información REAL del material entregado. NO inventes datos, cifras ni citas.
- Si el material es escaso, quedate en lo general y verificable; nunca inventes hechos falsos.
- Markdown limpio: usá subtítulos con ## y, si suma, alguna cita con >.
- Largo: entre 500 y 900 palabras.

Devolvé SIEMPRE un único objeto JSON válido con exactamente estas claves:
{
  "title": "título atractivo y con gancho",
  "slug": "slug-en-minusculas-con-guiones",
  "excerpt": "una sola línea que genere ganas de leer",
  "category": "una categoría corta, ej: Tecnología, Productividad, IA",
  "tags": ["3", "a", "6", "tags", "cortos"],
  "content": "artículo completo en markdown",
  "viralityScore": 0,
  "viralityNotes": "1-2 frases sobre por qué puede volverse viral"
}`

// Construye el prompt de usuario según haya material de fuente o un tema libre.
function buildUserPrompt({ sourceTitle, sourceText, sourceUrl, topic }) {
  if (topic) {
    return `El usuario quiere un artículo sobre este tema: "${topic}".

Paso 1 — Analizá el tema y relacionalo con la tecnología actual y la inteligencia artificial.
Paso 2 — Analizá qué lo haría viral y aplicá storytelling.
Paso 3 — Escribí el artículo final siguiendo todas las reglas.

Si el tema no menciona IA o tecnología, encontrá un ángulo genuino que lo conecte con ellas.
Recordá: contenido real y verificable, nada inventado.`
  }

  return `Tomá esta noticia/herramienta REAL y trabajala.

TÍTULO ORIGINAL: ${sourceTitle}
URL: ${sourceUrl || '(sin URL)'}
EXTRACTO DEL CONTENIDO REAL:
"""
${sourceText || '(no se pudo extraer el cuerpo; basate en el título y en conocimiento general verificable, sin inventar datos)'}
"""

Paso 1 — Analizá este material y encontrá su relación con la tecnología actual y la inteligencia artificial.
Paso 2 — Analizá viralidad y aplicá storytelling.
Paso 3 — Escribí el artículo final siguiendo todas las reglas.
No inventes cifras ni citas que no estén en el material.`
}

// Parsea la respuesta del modelo a objeto, tolerando texto alrededor del JSON.
function parseArticle(raw) {
  let txt = raw.trim()
  const fence = txt.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fence) txt = fence[1].trim()
  const start = txt.indexOf('{')
  const end = txt.lastIndexOf('}')
  if (start !== -1 && end !== -1) txt = txt.slice(start, end + 1)
  return JSON.parse(txt)
}

// Ejecuta los pasos 2 y 3 sobre un material dado y guarda el artículo.
//  source = { title, text, url } cuando viene del cron.
//  topic  = string cuando lo dispara el admin manualmente.
async function generateArticle({ source = null, topic = null, providerPref = 'auto', rr = 0, category = null, sourceKey = null }) {
  const provider = pickProvider(providerPref, rr)

  const userPrompt = buildUserPrompt({
    sourceTitle: source?.title,
    sourceText: source?.text,
    sourceUrl: source?.url,
    topic,
  })

  const raw = await chat(provider, [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userPrompt },
  ], { json: true, temperature: 0.85 })

  const a = parseArticle(raw)
  if (!a.title || !a.content) throw new Error('El modelo no devolvió título o contenido válidos.')

  const col = await articles()
  let slug = (a.slug && slugify(a.slug)) || slugify(a.title)
  // Evitar colisión de slug.
  if (await col.findOne({ slug })) slug = `${slug}-${Date.now().toString(36).slice(-4)}`

  const now = new Date()
  const sources = []
  if (source?.url) sources.push(source.url)
  if (source?.discussion) sources.push(source.discussion)

  const doc = {
    title: String(a.title).slice(0, 200),
    slug,
    excerpt: String(a.excerpt || '').slice(0, 300),
    category: category || a.category || 'Tecnología',
    tags: Array.isArray(a.tags) ? a.tags.map(t => String(t).trim()).filter(Boolean).slice(0, 8) : [],
    content: String(a.content),
    published: true,
    sources,
    autogenerated: true,
    generatedBy: provider.name,
    sourceKey: sourceKey || source?.key || null,
    viralityScore: Number(a.viralityScore) || null,
    viralityNotes: a.viralityNotes || null,
    createdAt: now,
    updatedAt: now,
  }

  const result = await col.insertOne(doc)
  return { ...doc, _id: result.insertedId.toString(), provider: provider.name }
}

// Flujo completo del cron: paso 1 (buscar) + pasos 2 y 3 (generar y guardar).
async function runAutogen({ force = false } = {}) {
  const s = await getSettings()

  if (!force && !s.enabled) {
    return { skipped: true, reason: 'desactivado' }
  }

  // Respetar la frecuencia configurada: solo generar si pasó el intervalo.
  if (!force && s.lastRunAt) {
    const elapsedH = (Date.now() - new Date(s.lastRunAt).getTime()) / 36e5
    if (elapsedH < (s.frequencyHours || 1) - 0.05) {
      return { skipped: true, reason: `frecuencia: faltan ${((s.frequencyHours || 1) - elapsedH).toFixed(1)}h` }
    }
  }

  const col = await articles()
  // Claves de fuentes ya usadas, para no repetir noticias.
  const used = await col
    .find({ autogenerated: true }, { projection: { sourceKey: 1, sources: 1 } })
    .sort({ createdAt: -1 }).limit(200).toArray()
  const usedKeys = new Set()
  for (const d of used) {
    if (d.sourceKey) usedKeys.add(d.sourceKey)
    for (const u of d.sources || []) usedKeys.add(u)
  }

  const story = await pickFreshStory(usedKeys)
  if (!story) {
    await saveSettings({ lastError: 'No se encontró una noticia nueva para procesar.' })
    return { skipped: true, reason: 'sin noticias nuevas' }
  }

  const text = await fetchArticleText(story.url)

  try {
    const article = await generateArticle({
      source: { title: story.title, text, url: story.url, discussion: story.discussion, key: story.key },
      providerPref: s.provider,
      rr: s._rr || 0,
      category: s.category,
      sourceKey: story.key,
    })
    await saveSettings({ lastRunAt: new Date(), lastError: null, _rr: ((s._rr || 0) + 1) % 1000 })
    return { ok: true, article }
  } catch (e) {
    await saveSettings({ lastError: e.message })
    throw e
  }
}

module.exports = { generateArticle, runAutogen, slugify }
