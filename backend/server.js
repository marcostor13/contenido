const express = require('express')
const cron = require('node-cron')

const content = require('./api/content')
const generate = require('./api/generate')
const settings = require('./api/settings')
const autogen = require('./api/autogen')

const app = express()
app.use(express.json())

// Convierte el formato de evento de Netlify Functions a Express y viceversa.
// Los handlers existentes no se modifican: siguen recibiendo un "event" y devolviendo
// { statusCode, headers, body }. Este adaptador hace la traducción en los dos sentidos.
function netlify(handler) {
  return async (req, res) => {
    const event = {
      httpMethod: req.method,
      queryStringParameters: req.query || {},
      headers: req.headers,
      body: req.body ? JSON.stringify(req.body) : null,
    }
    try {
      const result = await handler(event)
      const { statusCode = 200, headers = {}, body = '' } = result
      res.status(statusCode)
      Object.entries(headers).forEach(([k, v]) => res.set(k, v))
      res.send(body)
    } catch (e) {
      console.error('[handler error]', e.message)
      res.status(500).json({ error: e.message })
    }
  }
}

app.all('/api/content', netlify(content.handler))
app.all('/api/generate', netlify(generate.handler))
app.all('/api/settings', netlify(settings.handler))

// Healthcheck para Coolify
app.get('/health', (_req, res) => res.json({ ok: true }))

// Cron: equivalente al Netlify Scheduled Function de autogen.
// Corre cada minuto (igual que el schedule "* * * * *" en netlify.toml).
// El on/off y la frecuencia real se controlan desde la base de datos; cada
// corrida sale de inmediato si no corresponde generar todavía.
cron.schedule('* * * * *', async () => {
  try {
    const result = await autogen.handler()
    console.log('[autogen cron]', result.body)
  } catch (e) {
    console.error('[autogen cron error]', e.message)
  }
})

const PORT = process.env.PORT || 3000
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend corriendo en http://0.0.0.0:${PORT}`)
})
