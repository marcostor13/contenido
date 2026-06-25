// Endpoint de configuración del módulo de auto-generación.
// GET  -> devuelve la configuración actual y los proveedores disponibles (admin).
// POST -> actualiza enabled / frequencyMinutes / provider / category (admin).
const { getSettings, saveSettings } = require('./lib/db')
const { availableProviders } = require('./lib/llm')

const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
const ok = (data, status = 200) => ({ statusCode: status, headers, body: JSON.stringify(data) })
const err = (msg, status = 400) => ({ statusCode: status, headers, body: JSON.stringify({ error: msg }) })
const authed = (event) => (event.headers?.['x-admin-password'] ?? '') === process.env.ADMIN_PASSWORD

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: { ...headers, 'Access-Control-Allow-Headers': 'x-admin-password,content-type' }, body: '' }
  }
  if (!authed(event)) return err('No autorizado', 401)

  if (event.httpMethod === 'GET') {
    const s = await getSettings()
    return ok({
      settings: s,
      providers: availableProviders().map(p => p.name),
    })
  }

  if (event.httpMethod === 'POST') {
    const body = JSON.parse(event.body ?? '{}')
    const patch = {}
    if (typeof body.enabled === 'boolean') patch.enabled = body.enabled
    // Frecuencia en minutos (1 min a 7 días). Se acepta frequencyHours legado por compatibilidad.
    if (body.frequencyMinutes != null) {
      patch.frequencyMinutes = Math.max(1, Math.min(10080, Math.round(Number(body.frequencyMinutes)) || 60))
    } else if (body.frequencyHours != null) {
      patch.frequencyMinutes = Math.max(1, Math.min(10080, Math.round((Number(body.frequencyHours) || 1) * 60)))
    }
    if (body.provider && ['auto', 'openai', 'deepseek'].includes(body.provider)) patch.provider = body.provider
    if (typeof body.category === 'string' && body.category.trim()) patch.category = body.category.trim()
    if (!Object.keys(patch).length) return err('Nada para actualizar')
    const s = await saveSettings(patch)
    return ok({ settings: s })
  }

  return err('Método no soportado', 405)
}
