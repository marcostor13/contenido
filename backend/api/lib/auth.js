const jwt = require('jsonwebtoken')

const secret = () => {
  const s = process.env.JWT_SECRET
  if (!s) throw new Error('JWT_SECRET no está configurado')
  return s
}

const EXPIRY = '7d'

function signToken() {
  return jwt.sign({ admin: true }, secret(), { expiresIn: EXPIRY })
}

function verifyToken(token) {
  return jwt.verify(token, secret())
}

// Extrae y verifica el token del header Authorization: Bearer <token>
function authed(event) {
  try {
    const auth = event.headers?.authorization || ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : auth
    if (!token) return false
    verifyToken(token)
    return true
  } catch {
    return false
  }
}

module.exports = { signToken, verifyToken, authed }
