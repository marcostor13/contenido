// Scheduled Function de Netlify: corre cada minuto (ver schedule en netlify.toml).
// Para no exceder el límite de tiempo de las funciones, cada corrida hace UN solo
// paso pesado (aprendizaje o una sección). Solo genera si está activado y si pasó la
// frecuencia configurada en el administrador. La frecuencia es configurable desde la
// plataforma aunque el cron base corra cada minuto.
const { runAutogen } = require('./lib/generator')

exports.handler = async () => {
  try {
    const result = await runAutogen()
    console.log('[autogen]', JSON.stringify(result))
    return { statusCode: 200, body: 'ok' }
  } catch (e) {
    console.error('[autogen] error:', e.message)
    // Devolver 200 para no marcar la función como fallida en cada reintento;
    // el error ya queda registrado en settings.lastError.
    return { statusCode: 200, body: 'error: ' + e.message }
  }
}
