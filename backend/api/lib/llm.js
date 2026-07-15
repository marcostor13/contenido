// Gateway LLM — SOLO NVIDIA NIM (build.nvidia.com).
//
// Por qué solo NVIDIA: da acceso GRATIS a los mejores modelos abiertos con un endpoint
// compatible con OpenAI. El resto de proveedores se retiró a propósito (keys inválidas
// generaban ruido de failover y 401/429 que no aportaban nada).
//
// El tier gratuito de NVIDIA ENCOLA las peticiones y hace cold-start por modelo: por eso
// un modelo válido puede dar timeout puntualmente. La solución es un FAILOVER ENTRE VARIOS
// MODELOS (todos con la misma NVIDIA_API_KEY y el mismo endpoint): si el primero está en
// cola o tarda, se prueba el siguiente. Además cada modelo se reintenta una vez ante fallos
// transitorios (timeout / 429 / 5xx / respuesta vacía).
//
// Endpoint OpenAI-compatible (todos los modelos comparten esta URL):
//   https://integrate.api.nvidia.com/v1/chat/completions
//
// Variables de entorno:
//   NVIDIA_API_KEY   → OBLIGATORIA. Key nvapi-… de build.nvidia.com (Generate Key).
//   NVIDIA_MODELS    → opcional. Lista de modelos separada por comas para sobrescribir el
//                      orden de failover por defecto (el primero es el primario).
//   NVIDIA_TIMEOUT_MS→ opcional. Timeout por modelo en ms (default 75000).
//
// IDs verificados en el catálogo de build.nvidia.com (2026). Se lideran los modelos más
// usados (más probablemente "calientes" = sin cold-start) y de calidad instruct sólida
// para JSON; los flagship gigantes van más abajo (más lentos / con cold-start).

const NVIDIA_URL = 'https://integrate.api.nvidia.com/v1/chat/completions'
const NVIDIA_TIMEOUT_MS = Number(process.env.NVIDIA_TIMEOUT_MS) || 75000

// Cadena de failover por defecto (mejor equilibrio calidad + fiabilidad de capacidad).
const DEFAULT_NVIDIA_MODELS = [
  'meta/llama-3.3-70b-instruct',       // primario: fiable, popular (caliente), JSON sólido
  'openai/gpt-oss-120b',               // fuerte y muy usado (probable caliente)
  'meta/llama-3.1-405b-instruct',      // flagship Llama, máxima calidad instruct
  'qwen/qwen3.5-122b-a10b',            // Qwen3.5, rápido (10B activos) y de gran calidad
  'nvidia/nemotron-3-super-120b-a12b', // flagship propio de NVIDIA como último respaldo
]

const NVIDIA_MODELS = (process.env.NVIDIA_MODELS
  ? process.env.NVIDIA_MODELS.split(',').map(s => s.trim()).filter(Boolean)
  : DEFAULT_NVIDIA_MODELS)

// Cada modelo se expone como un "proveedor" del gateway para reutilizar el failover.
// El primero se llama 'nvidia' (así 'auto' y 'nvidia' apuntan al primario); el resto
// 'nvidia_2', 'nvidia_3'… Todos comparten key, endpoint y timeout.
const PROVIDERS = Object.fromEntries(
  NVIDIA_MODELS.map((modelId, i) => {
    const name = i === 0 ? 'nvidia' : `nvidia_${i + 1}`
    return [name, {
      name,
      modelId,
      url: NVIDIA_URL,
      key: () => process.env.NVIDIA_API_KEY,
      model: () => modelId,
      // No forzamos response_format: su soporte varía por modelo en NIM y un 400 tumbaría
      // el intento. El prompt ya exige JSON y el parser tolera texto alrededor.
      jsonMode: false,
      timeoutMs: NVIDIA_TIMEOUT_MS,
      priority: i + 1,
    }]
  })
)

// Devuelve la lista de modelos NVIDIA disponibles (requieren NVIDIA_API_KEY), en orden.
function availableProviders() {
  return Object.values(PROVIDERS)
    .filter(p => !!p.key())
    .sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99))
}

// Elige el modelo a usar.
//  - preference 'nvidia' | 'nvidia_2' | … fuerza uno (si hay key).
//  - 'auto' (o cualquier valor legado como 'gemini'/'groq') usa el primario.
//  El parámetro `rr` se mantiene por compatibilidad de firma.
function pickProvider(preference, rr = 0) {
  const available = availableProviders()
  if (!available.length) {
    throw new Error('NVIDIA_API_KEY no está configurada. Definila con tu key nvapi-… de build.nvidia.com.')
  }
  if (preference && preference !== 'auto' && PROVIDERS[preference]?.key()) {
    return PROVIDERS[preference]
  }
  return available[0]
}

// Devuelve los modelos a probar EN ORDEN para el failover: primero el preferido (o el
// primario en 'auto'), y el resto como respaldo.
function providersInOrder(preference, rr = 0) {
  const first = pickProvider(preference, rr)
  const rest = availableProviders().filter(p => p.name !== first.name)
  return [first, ...rest]
}

// Llama a un modelo y devuelve el texto de la respuesta.
async function chat(provider, messages, { json = false, temperature = 0.8, maxTokens = 2000, timeoutMs = NVIDIA_TIMEOUT_MS } = {}) {
  const body = {
    model: provider.model(),
    messages,
    temperature,
    max_tokens: maxTokens,
  }
  if (json && provider.jsonMode !== false) body.response_format = { type: 'json_object' }

  const effTimeout = provider.timeoutMs || timeoutMs
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), effTimeout)
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
    if (e.name === 'AbortError') throw new Error(`Tiempo de espera agotado con ${provider.name} [${provider.modelId}] (${effTimeout}ms)`)
    throw new Error(`Fallo de red con ${provider.name} [${provider.modelId}]: ${e.message}`)
  } finally {
    clearTimeout(timer)
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Error de ${provider.name} [${provider.modelId}] (${res.status}): ${detail.slice(0, 300)}`)
  }

  const data = await res.json()
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error(`Respuesta vacía de ${provider.name} [${provider.modelId}]`)
  return content
}

// ¿El error justifica reintentar el MISMO modelo una vez? Solo fallos RÁPIDOS y transitorios
// (429 / 5xx / red / respuesta vacía). Ante TIMEOUT NO se reintenta el mismo modelo (si está
// en cola o cold-start no estará listo 1,5s después): mejor saltar directo al siguiente modelo.
function isTransient(msg = '') {
  return /Fallo de red|Respuesta vacía|\((?:429|5\d\d)\)/.test(msg)
}

// Llama al LLM con FAILOVER entre modelos NVIDIA y REINTENTO por modelo.
// Recorre la cadena de modelos; cada uno se intenta hasta (maxRetries+1) veces si el fallo
// es transitorio. Devuelve { content, provider } del primero que responda. Si todos fallan,
// lanza un error con el detalle de cada intento.
async function chatResilient(messages, { providerPref = 'auto', rr = 0, maxRetries = 1, ...opts } = {}) {
  const order = providersInOrder(providerPref, rr)
  const errors = []
  for (const provider of order) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const content = await chat(provider, messages, opts)
        return { content, provider }
      } catch (e) {
        errors.push(`${provider.name}${attempt ? ' (reintento)' : ''}: ${e.message}`)
        if (attempt < maxRetries && isTransient(e.message)) {
          await new Promise(r => setTimeout(r, 1500))
          continue
        }
        break
      }
    }
  }
  throw new Error(`Todos los modelos NVIDIA fallaron — ${errors.join(' | ')}`)
}

module.exports = { PROVIDERS, NVIDIA_MODELS, availableProviders, pickProvider, providersInOrder, chat, chatResilient }
