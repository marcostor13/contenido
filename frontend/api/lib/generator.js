// Pipeline de generación de contenido (pasos 2 y 3 del módulo).
//  Paso 2: analizar el material obtenido y relacionarlo con la tecnología
//          actual y la inteligencia artificial.
//  Paso 3: analizar viralidad y storytelling, generar el artículo final y
//          guardarlo en la base con la estructura del proyecto.
//
// El sistema genera VARIAS secciones en la misma corrida (misma frecuencia):
//   - historias     (noticias reales con moraleja, ahora más animadas y sarcásticas)
//   - productividad  (herramientas, tips y trucos de productividad con tecnología e IA)
//   - potencial      (reflexiones y tips para potenciar al ser humano)
// Ver `api/lib/sections.js` para el tono y la configuración de cada sección.

const { articles, getSettings, saveSettings } = require('./db')
const { chat, chatResilient } = require('./llm')
const { pickFreshStory, fetchArticleText } = require('./sources')
const { learnAndResearch, currentPlaybook } = require('./learn')
const { SECTIONS, getSection, pickFreshAngle } = require('./sections')
const { LINKEDIN_MAX, linkedinLength, trimToFit } = require('./linkedin')

const slugify = (s) =>
  s.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim().replace(/\s+/g, '-')
    .slice(0, 80)

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

// Asegura que el post entre en el límite de LinkedIn midiendo el texto YA formateado
// (título en negrita + cuerpo + hashtags). Si excede:
//   1) pide al modelo una versión más corta que respete el formato y el cierre;
//   2) si aún se pasa, recorta párrafos del final como red de seguridad.
async function fitLinkedIn(a, provider, baseMessages) {
  const measure = (art) => linkedinLength({ title: art.title, content: art.content, tags: art.tags })
  if (measure(a) <= LINKEDIN_MAX) return a

  // Objetivo con margen para el formato (negritas) y los hashtags.
  const target = LINKEDIN_MAX - 250
  try {
    const correction = `El artículo que generaste se publicará como un post normal de LinkedIn, cuyo límite es
${LINKEDIN_MAX} caracteres (contando espacios, formato y hashtags). Tu versión se pasa.

Reescríbelo MÁS CORTO para que TODO el post quede por debajo de ${target} caracteres, SIN perder el gancho
inicial, el hilo ni el bloque de cierre, y manteniendo el mismo formato markdown y el mismo tono.
Recorta lo accesorio, no lo esencial. Devuelve el MISMO objeto JSON con exactamente las mismas claves.

TÍTULO ACTUAL: ${a.title}
CONTENIDO ACTUAL:
"""
${a.content}
"""`
    const raw = await chat(
      provider,
      [...baseMessages, { role: 'assistant', content: JSON.stringify(a) }, { role: 'user', content: correction }],
      { json: true, temperature: 0.6 }
    )
    const shorter = parseArticle(raw)
    if (shorter.title && shorter.content && measure(shorter) < measure(a)) {
      a = shorter
    }
  } catch {
    // Si la corrección falla, seguimos con el recorte de seguridad.
  }

  if (measure(a) > LINKEDIN_MAX) {
    const trimmed = trimToFit({ title: a.title, content: a.content, tags: a.tags }, LINKEDIN_MAX)
    a = { ...a, content: trimmed.content }
  }
  return a
}

// Ejecuta los pasos 2 y 3 sobre un material dado y guarda el artículo.
//  section = key u objeto de sección (define el tono y la categoría).
//  source  = { title, text, url } cuando la sección parte de una noticia.
//  topic   = string cuando lo dispara el admin manualmente.
//  angle   = ángulo rotativo para secciones que no parten de noticia.
async function generateArticle({
  section = 'historias', source = null, topic = null, angle = null,
  providerPref = 'auto', rr = 0, category = null, sourceKey = null, playbook = '',
}) {
  const sec = getSection(section)

  const userPrompt = sec.buildUserPrompt({ source, topic, angle })

  // Inyectar el playbook aprendido (técnicas de viralidad y aprendizajes) si existe.
  const systemPrompt = playbook
    ? `${sec.system}\n\nGUÍA APRENDIDA (aplícala para maximizar la viralidad de este artículo):\n${playbook}`
    : sec.system

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ]
  // Con failover: si un proveedor falla (p. ej. saldo), usa el otro automáticamente.
  // maxTokens amplio: la respuesta incluye el post Y el guion de video.
  const { content: raw, provider } = await chatResilient(messages, { providerPref, rr, json: true, temperature: 0.85, maxTokens: 3800 })

  let a = parseArticle(raw)
  if (!a.title || !a.content) throw new Error('El modelo no devolvió título o contenido válidos.')

  // Garantizar que el post entre en el límite de LinkedIn (3000 caracteres con formato
  // y hashtags). Si se pasa, pedimos una corrección y, como último recurso, recortamos.
  // El guion de video no cuenta para ese límite: se preserva si la corrección lo pierde.
  const videoScript = typeof a.videoScript === 'string' ? a.videoScript.trim() : ''
  a = await fitLinkedIn(a, provider, messages)
  if (videoScript && !a.videoScript) a.videoScript = videoScript

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
    category: category || sec.category || a.category || 'Tecnología',
    tags: Array.isArray(a.tags) ? a.tags.map(t => String(t).trim()).filter(Boolean).slice(0, 8) : [],
    content: String(a.content),
    videoScript: a.videoScript ? String(a.videoScript) : null,
    published: true,
    sources,
    autogenerated: true,
    section: sec.key,
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

// Genera el artículo de UNA sección para la corrida del cron.
//  - Sección tipo 'news': busca una noticia fresca y la convierte en reel con moraleja.
//  - Sección tipo 'topic': elige un ángulo rotativo no usado recientemente.
async function generateForSection(sec, { providerPref, rr, usedKeys, playbook }) {
  if (sec.type === 'news') {
    const story = await pickFreshStory(usedKeys)
    if (!story) return { skipped: true, section: sec.key, reason: 'sin noticias nuevas' }

    const fetched = await fetchArticleText(story.url)
    const text = fetched && fetched.length > 200 ? fetched : (story.summary || fetched || '')

    const article = await generateArticle({
      section: sec.key,
      source: { title: story.title, text, url: story.url, discussion: story.discussion, key: story.key },
      providerPref, rr, sourceKey: story.key, playbook,
    })
    return { ok: true, section: sec.key, article }
  }

  // Sección por ángulo rotativo (productividad, potencial humano).
  const picked = pickFreshAngle(sec, usedKeys)
  if (!picked) return { skipped: true, section: sec.key, reason: 'sin ángulos configurados' }

  const article = await generateArticle({
    section: sec.key,
    angle: picked.angle,
    providerPref, rr, sourceKey: picked.key, playbook,
  })
  return { ok: true, section: sec.key, article }
}

// Construye el conjunto de claves (fuentes/ángulos) ya usadas, para no repetir.
async function buildUsedKeys() {
  const col = await articles()
  const used = await col
    .find({ autogenerated: true }, { projection: { sourceKey: 1, sources: 1 } })
    .sort({ createdAt: -1 }).limit(200).toArray()
  const usedKeys = new Set()
  for (const d of used) {
    if (d.sourceKey) usedKeys.add(d.sourceKey)
    for (const u of d.sources || []) usedKeys.add(u)
  }
  return usedKeys
}

// Genera TODAS las secciones de una (usado solo en el disparo manual "generar todo").
// Una sección que falle no tumba al resto.
async function generateAllSections(s, playbook) {
  const usedKeys = await buildUsedKeys()
  const toRun = s.rotateSections ? [SECTIONS[(s._sectionRr || 0) % SECTIONS.length]] : SECTIONS
  const results = []
  let rr = s._rr || 0
  for (const sec of toRun) {
    try {
      const r = await generateForSection(sec, { providerPref: s.provider, rr, usedKeys, playbook })
      results.push(r)
      if (r.article?.sourceKey) usedKeys.add(r.article.sourceKey)
    } catch (e) {
      results.push({ error: true, section: sec.key, message: e.message })
    }
    rr = (rr + 1) % 1000
  }
  const okCount = results.filter(r => r.ok).length
  const errors = results.filter(r => r.error)
  await saveSettings({
    lastRunAt: new Date(),
    _rr: rr,
    lastError: errors.length ? `${errors.length} sección(es) con error: ${errors.map(e => e.section + ' (' + e.message + ')').join('; ')}` : null,
  })
  return { ok: okCount > 0, generated: okCount, results }
}

// Flujo del cron. Para no exceder el límite de tiempo de las funciones de Netlify,
// cada corrida hace UN SOLO paso pesado (≤1 llamada al LLM por invocación):
//   - cursor 0  → inicio de ciclo: respeta la frecuencia, aprende y prepara el playbook.
//   - cursor N  → genera la sección (N-1). Al terminar la última, cierra el ciclo.
// Con el cron por minuto, un ciclo completo (aprendizaje + cada sección) se reparte
// en varias corridas seguidas; luego espera la frecuencia configurada para el próximo.
// El disparo manual (force) genera todo de una (mejor esfuerzo).
async function runAutogen({ force = false } = {}) {
  const s = await getSettings()

  if (!force && !s.enabled) {
    return { skipped: true, reason: 'desactivado' }
  }

  // ===== Disparo manual: genera todo en una sola llamada (mejor esfuerzo) =====
  if (force) {
    const playbook = await learnAndResearch({ providerPref: s.provider, rr: s._rr || 0 })
    return await generateAllSections(s, playbook)
  }

  // ===== Cron programado: una etapa por corrida =====
  // Cada ciclo genera `sectionsPerCycle` secciones (2 por defecto), rotando entre
  // todas con `_sectionRr`. Para no exceder el timeout, se genera UNA por corrida:
  //   cursor 0        → inicio de ciclo: respeta la frecuencia y solo aprende.
  //   cursor 1..N     → genera la sección k del ciclo (k = cursor - 1).
  const cursor = s._cycleCursor || 0
  const startIdx = (s._sectionRr || 0) % SECTIONS.length
  const count = Math.max(1, Math.min(SECTIONS.length, s.sectionsPerCycle || 2))
  // Secciones de este ciclo (consecutivas desde el puntero de rotación).
  const cycleSections = Array.from({ length: count }, (_, i) => SECTIONS[(startIdx + i) % SECTIONS.length])

  // Cursor 0: inicio de ciclo. Respetar la frecuencia y ejecutar solo el aprendizaje.
  if (cursor === 0) {
    if (s.lastRunAt) {
      const elapsedMin = (Date.now() - new Date(s.lastRunAt).getTime()) / 6e4
      const freqMin = s.frequencyMinutes || 30
      if (elapsedMin < freqMin - 0.25) {
        return { skipped: true, reason: `frecuencia: faltan ${(freqMin - elapsedMin).toFixed(1)} min` }
      }
    }
    // Aprende e investiga (guarda su propio error si falla, sin tumbar el ciclo).
    await learnAndResearch({ providerPref: s.provider, rr: s._rr || 0 })
    await saveSettings({ _cycleCursor: 1 })
    return { ok: true, phase: 'aprendizaje', reason: 'playbook actualizado; la generación arranca en la próxima corrida' }
  }

  // Cursor >= 1: generar la sección (cursor - 1) del ciclo.
  const idx = cursor - 1
  if (idx >= cycleSections.length) {
    // Defensa: cursor fuera de rango → reiniciar ciclo.
    await saveSettings({ _cycleCursor: 0 })
    return { skipped: true, reason: 'ciclo reiniciado' }
  }

  const playbook = await currentPlaybook()
  const usedKeys = await buildUsedKeys()
  const sec = cycleSections[idx]

  let result
  try {
    result = await generateForSection(sec, { providerPref: s.provider, rr: s._rr || 0, usedKeys, playbook })
  } catch (e) {
    result = { error: true, section: sec.key, message: e.message }
  }

  const isLast = idx >= cycleSections.length - 1
  const patch = { _rr: ((s._rr || 0) + 1) % 1000 }

  if (isLast) {
    // Cierre del ciclo: reinicia el cursor, avanza la rotación `count` secciones y
    // arranca el reloj de la frecuencia (aunque alguna sección haya fallado, para
    // no repetir el ciclo).
    patch._cycleCursor = 0
    patch._sectionRr = (startIdx + count) % SECTIONS.length
    patch.lastRunAt = new Date()
  } else {
    patch._cycleCursor = cursor + 1
  }
  patch.lastError = result.error ? `${sec.key}: ${result.message}` : null
  await saveSettings(patch)

  return { ok: !!result.ok, phase: 'generación', section: sec.key, isLast, result }
}

module.exports = { generateArticle, generateForSection, runAutogen, slugify }
