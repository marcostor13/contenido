const { signToken } = require('./lib/auth')

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
}
const ok = (data) => ({ statusCode: 200, headers, body: JSON.stringify(data) })
const err = (msg, status = 400) => ({ statusCode: status, headers, body: JSON.stringify({ error: msg }) })

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: { ...headers, 'Access-Control-Allow-Headers': 'content-type' }, body: '' }
  }
  if (event.httpMethod !== 'POST') return err('Método no soportado', 405)

  const body = JSON.parse(event.body ?? '{}')
  if (!body.password || body.password !== process.env.ADMIN_PASSWORD) {
    return err('Contraseña incorrecta', 401)
  }

  const token = signToken()
  return ok({ token })
}
