// Capa de abstracción de LLM con soporte para OpenAI y DeepSeek.
// Si están ambas keys configuradas, reparte la carga (balanceo round-robin).
// Ambas APIs son compatibles con el formato de chat completions de OpenAI.

const PROVIDERS = {
  openai: {
    name: 'openai',
    url: 'https://api.openai.com/v1/chat/completions',
    key: () => process.env.OPENAI_API_KEY,
    model: () => process.env.OPENAI_MODEL || 'gpt-4o-mini',
  },
  deepseek: {
    name: 'deepseek',
    url: 'https://api.deepseek.com/chat/completions',
    key: () => process.env.DEEPSEEK_API_KEY,
    model: () => process.env.DEEPSEEK_MODEL || 'deepseek-chat',
  },
}

// Devuelve la lista de proveedores configurados (con key disponible).
function availableProviders() {
  return Object.values(PROVIDERS).filter(p => !!p.key())
}

// Elige el proveedor a usar.
//  - preference 'openai' | 'deepseek' fuerza uno (si tiene key).
//  - 'auto' reparte la carga según el contador round-robin (rr).
function pickProvider(preference, rr = 0) {
  const available = availableProviders()
  if (!available.length) {
    throw new Error('No hay ningún proveedor de IA configurado. Definí OPENAI_API_KEY y/o DEEPSEEK_API_KEY.')
  }
  if (preference && preference !== 'auto' && PROVIDERS[preference]?.key()) {
    return PROVIDERS[preference]
  }
  return available[rr % available.length]
}

// Devuelve los proveedores a probar EN ORDEN: primero el preferido (o el del
// round-robin), y a continuación el resto como respaldo para el failover.
function providersInOrder(preference, rr = 0) {
  const first = pickProvider(preference, rr)
  const rest = availableProviders().filter(p => p.name !== first.name)
  return [first, ...rest]
}

// Llama al LLM y devuelve el texto de la respuesta.
// timeoutMs: corta la petición si el proveedor no responde, para no colgar la función.
async function chat(provider, messages, { json = false, temperature = 0.8, maxTokens = 2500, timeoutMs = 60000 } = {}) {
  const body = {
    model: provider.model(),
    messages,
    temperature,
    max_tokens: maxTokens,
  }
  if (json) body.response_format = { type: 'json_object' }

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  let res
  try {
    res = await fetch(provider.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${provider.key()}`,
      },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    })
  } catch (e) {
    if (e.name === 'AbortError') throw new Error(`Tiempo de espera agotado con ${provider.name} (${timeoutMs}ms)`)
    throw new Error(`Fallo de red con ${provider.name}: ${e.message}`)
  } finally {
    clearTimeout(timer)
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Error de ${provider.name} (${res.status}): ${detail.slice(0, 300)}`)
  }

  const data = await res.json()
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error(`Respuesta vacía de ${provider.name}`)
  return content
}

// Llama al LLM con FAILOVER automático: intenta con el proveedor preferido y, si
// falla (saldo insuficiente, clave inválida, límite, timeout, red…), reintenta con
// los demás proveedores disponibles. Devuelve { content, provider } del que funcionó.
// Si todos fallan, lanza un error con el detalle de cada intento.
async function chatResilient(messages, { providerPref = 'auto', rr = 0, ...opts } = {}) {
  const order = providersInOrder(providerPref, rr)
  const errors = []
  for (const provider of order) {
    try {
      const content = await chat(provider, messages, opts)
      return { content, provider }
    } catch (e) {
      errors.push(`${provider.name}: ${e.message}`)
    }
  }
  throw new Error(`Todos los proveedores fallaron — ${errors.join(' | ')}`)
}

module.exports = { PROVIDERS, availableProviders, pickProvider, providersInOrder, chat, chatResilient }
