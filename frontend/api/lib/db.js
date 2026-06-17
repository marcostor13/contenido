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

const DEFAULT_SETTINGS = {
  _id: 'autogen',
  enabled: false, // el cron solo genera si está activado
  frequencyHours: 1, // cada cuántas horas generar
  lastRunAt: null, // última generación automática
  lastError: null, // último error registrado
  category: 'Tecnología', // categoría por defecto para lo autogenerado
  provider: 'auto', // 'auto' | 'openai' | 'deepseek'
  _rr: 0, // contador round-robin para balanceo de carga
}

async function getSettings() {
  const col = await settings()
  const doc = await col.findOne({ _id: 'autogen' })
  return { ...DEFAULT_SETTINGS, ...(doc || {}) }
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

module.exports = { db, articles, settings, getSettings, saveSettings, DEFAULT_SETTINGS }
