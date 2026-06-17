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

// Llama al LLM y devuelve el texto de la respuesta.
async function chat(provider, messages, { json = false, temperature = 0.8, maxTokens = 2500 } = {}) {
  const body = {
    model: provider.model(),
    messages,
    temperature,
    max_tokens: maxTokens,
  }
  if (json) body.response_format = { type: 'json_object' }

  const res = await fetch(provider.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${provider.key()}`,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Error de ${provider.name} (${res.status}): ${detail.slice(0, 300)}`)
  }

  const data = await res.json()
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error(`Respuesta vacía de ${provider.name}`)
  return content
}

module.exports = { PROVIDERS, availableProviders, pickProvider, chat }
