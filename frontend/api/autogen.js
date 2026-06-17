// Scheduled Function de Netlify: se ejecuta cada hora (ver schedule en netlify.toml).
// En cada corrida revisa la configuración: solo genera si está activado y si pasó
// el intervalo de horas seteado en el administrador. Así la frecuencia es
// configurable desde la plataforma aunque el cron base corra cada hora.
const { runAutogen } = require('./lib/generator')

exports.handler = async () => {
  try {
    const result = await runAutogen()
    console.log('[autogen]', JSON.stringify(result?.skipped ? result : { ok: true, slug: result?.article?.slug }))
    return { statusCode: 200, body: 'ok' }
  } catch (e) {
    console.error('[autogen] error:', e.message)
    // Devolver 200 para no marcar la función como fallida en cada reintento;
    // el error ya queda registrado en settings.lastError.
    return { statusCode: 200, body: 'error: ' + e.message }
  }
}
