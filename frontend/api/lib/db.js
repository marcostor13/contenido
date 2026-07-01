// Conexión compartida a MongoDB y acceso a colecciones.
const { MongoClient } = require('mongodb')
const dns = require('dns')

dns.setServers(['8.8.8.8', '1.1.1.1'])

let client = null

async function db() {
  if (!client) {
    client = new MongoClient(process.env.MONGODB_URI, { family: 4 })
    await client.connect()
  }
  return client.db('content')
}

async function articles() {
  return (await db()).collection('articles')
}

// Colección de configuración (un único documento con _id: 'autogen').
async function settings() {
  return (await db()).collection('settings')
}

// Colección de aprendizaje: historial acumulativo (append-only) de lo aprendido
// en cada ciclo, para no perder contexto entre ejecuciones.
async function learnings() {
  return (await db()).collection('learnings')
}

const DEFAULT_SETTINGS = {
  _id: 'autogen',
  enabled: false, // el cron solo genera si está activado
  frequencyMinutes: 30, // cada cuántos minutos generar un ciclo (default media hora)
  sectionsPerCycle: 2, // cuántas secciones genera por ciclo (rotando entre todas)
  rotateSections: false, // legado (ya no se usa; ver sectionsPerCycle)
  lastRunAt: null, // última generación automática
  lastError: null, // último error registrado
  category: 'Tecnología', // categoría por defecto para lo autogenerado
  provider: 'auto', // 'auto' (prioridad DeepSeek→OpenAI→Gemini→Groq) | 'deepseek' | 'openai' | 'groq' | 'gemini'
  _rr: 0, // contador round-robin (compatibilidad)
  _sectionRr: 0, // puntero de rotación de secciones entre ciclos
  _cycleCursor: 0, // etapa dentro del ciclo (0 = aprender; N = generar sección N)
}

async function getSettings() {
  const col = await settings()
  const doc = await col.findOne({ _id: 'autogen' })
  const merged = { ...DEFAULT_SETTINGS, ...(doc || {}) }
  // Migración: docs antiguos guardaban frequencyHours; derivar minutos si hace falta.
  if (doc && doc.frequencyMinutes == null && doc.frequencyHours != null) {
    merged.frequencyMinutes = Math.max(1, Math.round(Number(doc.frequencyHours) * 60) || 60)
  }
  return merged
}

async function saveSettings(patch) {
  const col = await settings()
  await col.updateOne(
    { _id: 'autogen' },
    { $set: patch, $setOnInsert: { _id: 'autogen' } },
    { upsert: true }
  )
  return getSettings()
}

module.exports = { db, articles, settings, learnings, getSettings, saveSettings, DEFAULT_SETTINGS }
