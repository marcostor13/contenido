// Gateway / capa de abstracción de LLM con failover automático.
//
// PROVEEDORES (en orden de failover cuando el primer slot falla):
//   1. groq        — llama-3.3-70b-versatile  100 K TPD gratis
//   2. groq_fast   — llama-3.1-8b-instant     pool propio (~500 K TPD), mismo key
//   3. cerebras    — llama-3.3-70b            1 M TPD gratis, API OpenAI-compatible
//   4. gemini      — gemini-2.5-flash         250 RPD / 250 K TPM gratis
//   5. gemini_lite — gemini-2.5-flash-lite    1 000 RPD (4× más), mismo key
//   6. openai      — gpt-4o-mini              pago, alta fiabilidad
//   7. deepseek    — deepseek-chat            pago económico
//
// CLAVE: modelos distintos dentro del mismo proveedor tienen pools de cuota separados.
// Cuando llama-3.3-70b agota sus 100 K TPD, llama-3.1-8b-instant sigue disponible.
// Mismo principio: gemini-2.5-flash (250 RPD) → gemini-2.5-flash-lite (1 000 RPD).
//
// Variables de entorno (definir las que tengas en Coolify):
//   GROQ_API_KEY        → activa slots groq + groq_fast
//   CEREBRAS_API_KEY    → activa slot cerebras (console.cerebras.ai)
//   GEMINI_API_KEY      → activa slots gemini + gemini_lite (o GOOGLE_API_KEY)
//   OPENAI_API_KEY      → activa slot openai
//   DEEPSEEK_API_KEY    → activa slot deepseek

const PROVIDERS = {
  groq: {
    name: 'groq',
    url: 'https://api.groq.com/openai/v1/chat/completions',
    key: () => process.env.GROQ_API_KEY,
    model: () => process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
    jsonMode: true,
  },
  // Mismo key que groq, modelo distinto → pool de cuota propio.
  // Actúa como failover automático cuando llama-3.3-70b agota sus 100 K TPD diarios.
  groq_fast: {
    name: 'groq_fast',
    url: 'https://api.groq.com/openai/v1/chat/completions',
    key: () => process.env.GROQ_API_KEY,
    model: () => 'llama-3.1-8b-instant',
    jsonMode: true,
  },
  // Cerebras: 1 M TPD gratuito, latencia baja, API 100% compatible con OpenAI.
  // Obtén tu key en: https://cloud.cerebras.ai
  cerebras: {
    name: 'cerebras',
    url: 'https://api.cerebras.ai/v1/chat/completions',
    key: () => process.env.CEREBRAS_API_KEY,
    model: () => process.env.CEREBRAS_MODEL || 'llama-3.3-70b',
    jsonMode: true,
  },
  // Gemini 2.5 Flash: mejor relación calidad/límite gratuito en 2026 (250 RPD, 250 K TPM).
  gemini: {
    name: 'gemini',
    url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    key: () => process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
    model: () => process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    jsonMode: false,
  },
  // Mismo key que gemini, modelo lite → 1 000 RPD (4× más que 2.5-flash).
  gemini_lite: {
    name: 'gemini_lite',
    url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    key: () => process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
    model: () => 'gemini-2.5-flash-lite',
    jsonMode: false,
  },
  openai: {
    name: 'openai',
    url: 'https://api.openai.com/v1/chat/completions',
    key: () => process.env.OPENAI_API_KEY,
    model: () => process.env.OPENAI_MODEL || 'gpt-4o-mini',
    jsonMode: true,
  },
  deepseek: {
    name: 'deepseek',
    url: 'https://api.deepseek.com/chat/completions',
    key: () => process.env.DEEPSEEK_API_KEY,
    model: () => process.env.DEEPSEEK_MODEL || 'deepseek-chat',
    jsonMode: true,
  },
}

// Devuelve la lista de proveedores configurados (con key disponible).
function availableProviders() {
  return Object.values(PROVIDERS).filter(p => !!p.key())
}

// Elige el proveedor a usar.
//  - preference 'groq' | 'openai' etc. fuerza uno (si tiene key).
//  - 'auto' reparte la carga según el contador round-robin (rr).
function pickProvider(preference, rr = 0) {
  const available = availableProviders()
  if (!available.length) {
    throw new Error('No hay ningún proveedor de IA configurado. Definí al menos GROQ_API_KEY o CEREBRAS_API_KEY.')
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
async function chat(provider, messages, { json = false, temperature = 0.8, maxTokens = 2500, timeoutMs = 60000 } = {}) {
  const body = {
    model: provider.model(),
    messages,
    temperature,
    max_tokens: maxTokens,
  }
  if (json && provider.jsonMode !== false) body.response_format = { type: 'json_object' }

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
