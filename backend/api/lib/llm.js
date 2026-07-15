// Gateway / capa de abstracción de LLM con failover automático y prioridad.
//
// PROVEEDORES por PRIORIDAD (menor `priority` = se usa primero en modo 'auto' y
// es el primero del failover). NVIDIA NIM encabeza la lista: da acceso GRATIS a los
// mejores modelos abiertos (DeepSeek, Llama, Qwen, Kimi…) con endpoint compatible
// con OpenAI. Los demás quedan como respaldo si NVIDIA no tiene key o falla.
//   1. nvidia      — meta/llama-3.3-70b-instruct    NVIDIA NIM, gratis, muy fiable
//   2. nvidia_pro  — deepseek-ai/deepseek-v3.1       NVIDIA NIM, gratis, máxima calidad
//   3. cerebras    — llama-3.3-70b                   1 M TPD gratis, latencia baja
//   4. gemini      — gemini-2.5-flash                250 RPD / 250 K TPM gratis
//   5. gemini_lite — gemini-2.5-flash-lite           1 000 RPD (4× más), mismo key
//   6. groq        — llama-3.3-70b-versatile         100 K TPD gratis
//   7. groq_fast   — llama-3.1-8b-instant            pool propio (~500 K TPD), mismo key
//   8. openai      — gpt-4o-mini                     pago, alta fiabilidad
//   9. deepseek    — deepseek-chat                   pago económico
//
// CLAVE: modelos distintos dentro del mismo proveedor tienen pools de cuota separados.
// Los dos slots NVIDIA usan la misma NVIDIA_API_KEY pero modelos distintos → cuotas
// independientes: si el primario se agota o cae, el segundo sigue disponible.
//
// Variables de entorno (definir las que tengas en Coolify):
//   NVIDIA_API_KEY      → activa slots nvidia + nvidia_pro (key nvapi-… de build.nvidia.com)
//   CEREBRAS_API_KEY    → activa slot cerebras (console.cerebras.ai)
//   GEMINI_API_KEY      → activa slots gemini + gemini_lite (o GOOGLE_API_KEY)
//   GROQ_API_KEY        → activa slots groq + groq_fast
//   OPENAI_API_KEY      → activa slot openai
//   DEEPSEEK_API_KEY    → activa slot deepseek
//
// Modelos NVIDIA configurables con NVIDIA_MODEL / NVIDIA_PRO_MODEL. Otros IDs de
// alta calidad en build.nvidia.com: meta/llama-3.1-405b-instruct,
// qwen/qwen3-235b-a22b, moonshotai/kimi-k2-instruct, openai/gpt-oss-120b.

// Endpoint OpenAI-compatible de NVIDIA NIM (todos los modelos comparten esta URL).
const NVIDIA_URL = 'https://integrate.api.nvidia.com/v1/chat/completions'

const PROVIDERS = {
  // NVIDIA NIM — primario: el mejor equilibrio calidad/fiabilidad gratis. Llama 3.3
  // 70B responde rápido y respeta bien el modo JSON.
  nvidia: {
    name: 'nvidia',
    url: NVIDIA_URL,
    key: () => process.env.NVIDIA_API_KEY,
    model: () => process.env.NVIDIA_MODEL || 'meta/llama-3.3-70b-instruct',
    jsonMode: true,
    priority: 1,
  },
  // NVIDIA NIM — pro: máxima calidad de escritura (DeepSeek V3.1). Misma key, otro
  // modelo → pool de cuota propio y respaldo natural del primario. jsonMode false
  // porque los modelos grandes de NIM son quisquillosos con response_format; el
  // prompt ya exige JSON y el parser tolera texto alrededor.
  nvidia_pro: {
    name: 'nvidia_pro',
    url: NVIDIA_URL,
    key: () => process.env.NVIDIA_API_KEY,
    model: () => process.env.NVIDIA_PRO_MODEL || 'deepseek-ai/deepseek-v3.1',
    jsonMode: false,
    priority: 2,
  },
  groq: {
    name: 'groq',
    url: 'https://api.groq.com/openai/v1/chat/completions',
    key: () => process.env.GROQ_API_KEY,
    model: () => process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
    jsonMode: true,
    priority: 6,
  },
  // Mismo key que groq, modelo distinto → pool de cuota propio.
  // Actúa como failover automático cuando llama-3.3-70b agota sus 100 K TPD diarios.
  groq_fast: {
    name: 'groq_fast',
    url: 'https://api.groq.com/openai/v1/chat/completions',
    key: () => process.env.GROQ_API_KEY,
    model: () => 'llama-3.1-8b-instant',
    jsonMode: true,
    priority: 7,
  },
  // Cerebras: 1 M TPD gratuito, latencia baja, API 100% compatible con OpenAI.
  // Obtén tu key en: https://cloud.cerebras.ai
  cerebras: {
    name: 'cerebras',
    url: 'https://api.cerebras.ai/v1/chat/completions',
    key: () => process.env.CEREBRAS_API_KEY,
    model: () => process.env.CEREBRAS_MODEL || 'llama-3.3-70b',
    jsonMode: true,
    priority: 3,
  },
  // Gemini 2.5 Flash: mejor relación calidad/límite gratuito en 2026 (250 RPD, 250 K TPM).
  gemini: {
    name: 'gemini',
    url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    key: () => process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
    model: () => process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    jsonMode: false,
    priority: 4,
  },
  // Mismo key que gemini, modelo lite → 1 000 RPD (4× más que 2.5-flash).
  gemini_lite: {
    name: 'gemini_lite',
    url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    key: () => process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
    model: () => 'gemini-2.5-flash-lite',
    jsonMode: false,
    priority: 5,
  },
  openai: {
    name: 'openai',
    url: 'https://api.openai.com/v1/chat/completions',
    key: () => process.env.OPENAI_API_KEY,
    model: () => process.env.OPENAI_MODEL || 'gpt-4o-mini',
    jsonMode: true,
    priority: 8,
  },
  deepseek: {
    name: 'deepseek',
    url: 'https://api.deepseek.com/chat/completions',
    key: () => process.env.DEEPSEEK_API_KEY,
    model: () => process.env.DEEPSEEK_MODEL || 'deepseek-chat',
    jsonMode: true,
    priority: 9,
  },
}

// Devuelve la lista de proveedores configurados (con key disponible), ordenados por
// prioridad (menor primero: NVIDIA → NVIDIA pro → Cerebras → Gemini → Groq → …).
function availableProviders() {
  return Object.values(PROVIDERS)
    .filter(p => !!p.key())
    .sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99))
}

// Elige el proveedor a usar.
//  - preference 'nvidia' | 'gemini' | etc. fuerza uno (si tiene key).
//  - 'auto' usa el de mayor prioridad disponible (NVIDIA primero).
//  El parámetro `rr` se mantiene por compatibilidad de firma; el orden lo fija la prioridad.
function pickProvider(preference, rr = 0) {
  const available = availableProviders()
  if (!available.length) {
    throw new Error('No hay ningún proveedor de IA configurado. Definí al menos NVIDIA_API_KEY (build.nvidia.com) o CEREBRAS_API_KEY.')
  }
  if (preference && preference !== 'auto' && PROVIDERS[preference]?.key()) {
    return PROVIDERS[preference]
  }
  return available[0]
}

// Devuelve los proveedores a probar EN ORDEN para el failover: primero el preferido
// (o el de mayor prioridad en 'auto'), y el resto ordenado por prioridad como respaldo.
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
