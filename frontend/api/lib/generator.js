// Pipeline de generación de contenido (pasos 2 y 3 del módulo).
//  Paso 2: analizar el material obtenido y relacionarlo con la tecnología
//          actual y la inteligencia artificial.
//  Paso 3: analizar viralidad y storytelling, generar el artículo final y
//          guardarlo en la base con la estructura del proyecto.

const { articles, getSettings, saveSettings } = require('./db')
const { pickProvider, chat } = require('./llm')
const { pickFreshStory, fetchArticleText } = require('./sources')
const { learnAndResearch } = require('./learn')

const slugify = (s) =>
  s.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim().replace(/\s+/g, '-')
    .slice(0, 80)

// Prompt de sistema: define el tono y el rol del modelo.
const SYSTEM_PROMPT = `Eres un creador de contenido viral en español, estilo guion de reel, para un público general (NO técnico).
Tu materia prima son noticias REALES, cotidianas, impactantes y que despiertan curiosidad: historias humanas,
hechos insólitos, sorprendentes, de la vida real. NO noticias técnicas ni de tecnología.

Tu trabajo: tomar esa noticia cotidiana y convertirla en un reel con viralidad y storytelling, que termine
en una MORALEJA o enseñanza que conecte con la inteligencia artificial y con cómo usarla para ser más productivo.
La noticia es el gancho emocional; la IA y la productividad son el aprendizaje final.

DIALECTO OBLIGATORIO: escribe en español peruano (de Perú), usando "tú" (tuteo). NUNCA uses "vos" ni
conjugaciones argentinas (nada de "tenés", "querés", "sabés", "mirá"). Usa "tienes", "quieres", "sabes", "mira".
Tono neutral peruano, cercano y natural, sin modismos demasiado locales que no se entiendan fuera de Perú.

Reglas de tono y estilo:
- Amical y cercano, como si le contaras algo fascinante a un amigo. Cero jerga técnica, cero tecnicismos.
- Que enganche a cualquiera: empieza con un gancho fuerte que genere curiosidad y dé ganas de seguir.
- Storytelling de principio a fin: cuenta la historia, genera tensión, y recién al final revela la enseñanza.
- La conexión con la IA/productividad debe sentirse natural y reveladora, no forzada ni publicitaria.
- Cierra SIEMPRE con una moraleja clara y accionable sobre cómo aprovechar la IA en el día a día.
- Todo se basa en información REAL del material entregado. NO inventes datos, cifras ni citas.
- Si el material es escaso, quédate en lo general y verificable; nunca inventes hechos falsos.
- Markdown limpio: subtítulos con ## y, si suma, alguna cita con >. Cierra con un bloque "## La moraleja".
- Largo: entre 500 y 900 palabras.

Devuelve SIEMPRE un único objeto JSON válido con exactamente estas claves:
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
    return `El usuario quiere un reel/artículo sobre este tema: "${topic}".

Paso 1 — Tómalo como una historia cotidiana que engancha y analiza qué la hace curiosa o impactante.
Paso 2 — Analiza qué la haría viral y aplica storytelling de principio a fin.
Paso 3 — Escribe el artículo final y cierra con una moraleja que conecte la historia con cómo usar la
         inteligencia artificial para ser más productivo. La conexión debe sentirse natural, no forzada.
Recuerda: contenido real y verificable, nada inventado. Escribe en español peruano (tuteo, "tú").`
  }

  return `Toma esta noticia REAL y cotidiana (NO técnica) y conviértela en un reel con moraleja.

TITULAR REAL: ${sourceTitle}
URL: ${sourceUrl || '(sin URL)'}
RESUMEN / CONTENIDO REAL:
"""
${sourceText || '(solo está el titular; básate en él y en conocimiento general verificable, sin inventar datos)'}
"""

Paso 1 — Identifica el gancho emocional y por qué esta historia despierta curiosidad en cualquier persona.
Paso 2 — Aplica viralidad y storytelling: cuéntala como una historia que atrape.
Paso 3 — Cierra con una moraleja que conecte esta historia cotidiana con la inteligencia artificial y con
         cómo aprovecharla para ser más productivo en el día a día.
No inventes cifras ni citas que no estén en el material. Escribe en español peruano (tuteo, "tú").`
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
async function generateArticle({ source = null, topic = null, providerPref = 'auto', rr = 0, category = null, sourceKey = null, playbook = '' }) {
  const provider = pickProvider(providerPref, rr)

  const userPrompt = buildUserPrompt({
    sourceTitle: source?.title,
    sourceText: source?.text,
    sourceUrl: source?.url,
    topic,
  })

  // Inyectar el playbook aprendido (técnicas de viralidad y aprendizajes) si existe.
  const systemPrompt = playbook
    ? `${SYSTEM_PROMPT}\n\nGUÍA APRENDIDA (aplícala para maximizar la viralidad de este artículo):\n${playbook}`
    : SYSTEM_PROMPT

  const raw = await chat(provider, [
    { role: 'system', content: systemPrompt },
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

  // ANTES DE TODO: fase de aprendizaje. Analiza lo previo e investiga técnicas
  // de viralidad para mejorar el contenido de esta corrida.
  const playbook = await learnAndResearch({ providerPref: s.provider, rr: s._rr || 0 })

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

  // Texto del artículo (mejor esfuerzo); si no se puede, usar el resumen del feed.
  const fetched = await fetchArticleText(story.url)
  const text = fetched && fetched.length > 200 ? fetched : (story.summary || fetched || '')

  try {
    const article = await generateArticle({
      source: { title: story.title, text, url: story.url, discussion: story.discussion, key: story.key },
      providerPref: s.provider,
      rr: s._rr || 0,
      category: s.category,
      sourceKey: story.key,
      playbook,
    })
    await saveSettings({ lastRunAt: new Date(), lastError: null, _rr: ((s._rr || 0) + 1) % 1000 })
    return { ok: true, article }
  } catch (e) {
    await saveSettings({ lastError: e.message })
    throw e
  }
}

module.exports = { generateArticle, runAutogen, slugify }
