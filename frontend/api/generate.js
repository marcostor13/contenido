// Endpoint de generación manual (admin).
// POST { topic } -> ejecuta los pasos 2 y 3 sobre el tema dado y guarda el artículo.
// POST { runCron: true } -> dispara el flujo del cron manualmente (paso 1 + 2 + 3).
const { generateArticle, runAutogen } = require('./lib/generator')
const { getSettings, saveSettings } = require('./lib/db')
const { currentPlaybook } = require('./lib/learn')

const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
const ok = (data, status = 200) => ({ statusCode: status, headers, body: JSON.stringify(data) })
const err = (msg, status = 400) => ({ statusCode: status, headers, body: JSON.stringify({ error: msg }) })
const authed = (event) => (event.headers?.['x-admin-password'] ?? '') === process.env.ADMIN_PASSWORD

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: { ...headers, 'Access-Control-Allow-Headers': 'x-admin-password,content-type' }, body: '' }
  }
  if (event.httpMethod !== 'POST') return err('Método no soportado', 405)
  if (!authed(event)) return err('No autorizado', 401)

  const body = JSON.parse(event.body ?? '{}')

  try {
    // Disparo manual del flujo automático (busca noticia real y genera).
    if (body.runCron) {
      const result = await runAutogen({ force: true })
      return ok(result)
    }

    // Generación a partir de un tema escrito por el admin.
    const topic = (body.topic || '').trim()
    if (!topic) return err('Indicá un tema o activá runCron')

    const s = await getSettings()
    const article = await generateArticle({
      topic,
      section: body.section || 'historias',
      providerPref: s.provider,
      rr: s._rr || 0,
      category: body.category || undefined,
      playbook: await currentPlaybook(),
    })
    await saveSettings({ _rr: ((s._rr || 0) + 1) % 1000 })
    return ok({ ok: true, article })
  } catch (e) {
    return err(e.message, 500)
  }
}
