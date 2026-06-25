// Definición de las SECCIONES de contenido que el sistema genera.
// Cada sección tiene su propio tono, su categoría y su forma de obtener material.
// Por defecto todas se generan en la MISMA corrida del cron (misma frecuencia);
// con la rotación activada se genera una por corrida.
//
// Cada "base" temática tiene DOS variantes: una LARGA (la de siempre) y una CORTA
// (más directa), que conviven como secciones separadas:
//   1) historias / historias-corto   — noticias reales con moraleja conectada a la IA.
//   2) productividad / -corto         — herramientas, tips y trucos (tecnología + IA).
//   3) potencial / -corto             — reflexiones y tips para potenciar al ser humano.
// Y una sección propia, breve por naturaleza:
//   4) motivacional                   — motivación que te hace pensar en tu potencial,
//                                        en lo que quieres y en lo que tienes que cambiar.
//
// Tono general: interesante, animado y con un sarcasmo ligero (con chispa, nunca
// ofensivo). Honesto siempre: nada de datos, cifras ni citas inventadas.

// — Bloques reutilizables de las instrucciones —

const DIALECTO = `DIALECTO OBLIGATORIO: escribe en español peruano (de Perú), usando "tú" (tuteo). NUNCA uses "vos" ni
conjugaciones argentinas (nada de "tenés", "querés", "sabés", "mirá"). Usa "tienes", "quieres", "sabes", "mira".
Tono neutral peruano, cercano y natural, sin modismos demasiado locales que no se entiendan fuera de Perú.`

const SARCASMO = `ENERGÍA Y HUMOR: el texto tiene que sentirse vivo, con ritmo y personalidad. Permítete un sarcasmo
ligero e ingenioso (guiños, ironía amable, comentarios con chispa), pero SIN ser grosero, cínico ni ofensivo.
El humor suma; nunca reemplaza el valor real. Frases cortas, punch, y de vez en cuando una línea que saque
una sonrisa. Cero relleno y cero acartonamiento corporativo.`

const HONESTIDAD = `Todo se basa en información REAL y verificable. NO inventes datos, cifras, estudios ni citas.
Si no estás seguro de un dato, quédate en lo general y cierto. Las herramientas que menciones deben existir de verdad.`

const JSON_SPEC = `Devuelve SIEMPRE un único objeto JSON válido con exactamente estas claves:
{
  "title": "título atractivo y con gancho",
  "slug": "slug-en-minusculas-con-guiones",
  "excerpt": "una sola línea que genere ganas de leer",
  "category": "la categoría de esta sección",
  "tags": ["3", "a", "6", "tags", "cortos"],
  "content": "artículo completo en markdown",
  "viralityScore": 0,
  "viralityNotes": "1-2 frases sobre por qué puede volverse viral"
}`

// — Presets de longitud (se inyectan en el prompt de cada sección) —
// IMPORTANTE: el contenido se publica como post normal de LinkedIn, cuyo límite es 3000
// caracteres (contando espacios, formato y hashtags). Los topes de abajo son sobre el
// post COMPLETO (título + cuerpo) y dejan margen para el formato y los hashtags.
const LINKEDIN_LIMIT_NOTE = `Este contenido se publicará como un post normal de LinkedIn (límite 3000 caracteres,
contando espacios). El post completo debe verse bien formateado y NO superar el tope de caracteres indicado abajo.
Cuenta los caracteres del título más el cuerpo y mantente por debajo del tope; aprovecha bien el espacio sin rellenar.`

const LARGO = 'Largo: el post completo (título + cuerpo) NO debe superar 2500 caracteres contando espacios. Apunta a 1700-2400 caracteres (aprox. 300-420 palabras).'
const CORTO = 'Largo: CORTO y directo. El post completo NO debe superar 1200 caracteres contando espacios (aprox. 160-200 palabras). Sin relleno: cada frase tiene que ganarse su lugar.'
const CORTO_MOTIV = 'Largo: BREVE y potente. El post completo NO debe superar 900 caracteres contando espacios (aprox. 120-150 palabras). Que cada línea pegue; si una frase no aporta, fuera.'

// ——— Base 1: Historias con moraleja (noticia real → reel con moraleja IA) ———

const historiasSystem = (LEN) => `Eres un creador de contenido viral en español, estilo guion de reel, para un público general (NO técnico).
Tu materia prima son noticias REALES, cotidianas, impactantes y que despiertan curiosidad: historias humanas,
hechos insólitos, sorprendentes, de la vida real. NO noticias técnicas ni de tecnología.

Tu trabajo: tomar esa noticia cotidiana y convertirla en un reel con viralidad y storytelling, que termine
en una MORALEJA o enseñanza que conecte con la inteligencia artificial y con cómo usarla para ser más productivo.
La noticia es el gancho emocional; la IA y la productividad son el aprendizaje final.

${DIALECTO}

${SARCASMO}

Reglas de tono y estilo:
- Amical y cercano, como si le contaras algo fascinante a un amigo (uno gracioso). Cero jerga técnica.
- Que enganche a cualquiera: empieza con un gancho fuerte que genere curiosidad y dé ganas de seguir.
- Storytelling de principio a fin: cuenta la historia, genera tensión, suelta algún comentario con ironía, y recién al final revela la enseñanza.
- La conexión con la IA/productividad debe sentirse natural y reveladora, no forzada ni publicitaria.
- Cierra SIEMPRE con una moraleja clara y accionable sobre cómo aprovechar la IA en el día a día.
- ${HONESTIDAD}
- Markdown limpio: subtítulos con ## y, si suma, alguna cita con >. Cierra con un bloque "## La moraleja".
- ${LEN}

${JSON_SPEC}`

function historiasUserPrompt({ source, topic }) {
  if (topic) {
    return `El usuario quiere un reel/artículo sobre este tema: "${topic}".

Paso 1 — Tómalo como una historia cotidiana que engancha y analiza qué la hace curiosa o impactante.
Paso 2 — Analiza qué la haría viral y aplica storytelling de principio a fin, con tu chispa y sarcasmo ligero.
Paso 3 — Escribe el artículo final y cierra con una moraleja que conecte la historia con cómo usar la
         inteligencia artificial para ser más productivo. La conexión debe sentirse natural, no forzada.
Recuerda: contenido real y verificable, nada inventado. Respeta el largo indicado. Español peruano (tuteo, "tú").`
  }

  return `Toma esta noticia REAL y cotidiana (NO técnica) y conviértela en un reel con moraleja.

TITULAR REAL: ${source?.title}
URL: ${source?.url || '(sin URL)'}
RESUMEN / CONTENIDO REAL:
"""
${source?.text || '(solo está el titular; básate en él y en conocimiento general verificable, sin inventar datos)'}
"""

Paso 1 — Identifica el gancho emocional y por qué esta historia despierta curiosidad en cualquier persona.
Paso 2 — Aplica viralidad y storytelling: cuéntala como una historia que atrape, con humor inteligente.
Paso 3 — Cierra con una moraleja que conecte esta historia cotidiana con la inteligencia artificial y con
         cómo aprovecharla para ser más productivo en el día a día.
No inventes cifras ni citas que no estén en el material. Respeta el largo indicado. Español peruano (tuteo, "tú").`
}

// ——— Base 2: Productividad & IA (herramientas, tips y trucos) ———

const productividadSystem = (LEN) => `Eres un creador de contenido práctico en español sobre PRODUCTIVIDAD con tecnología e inteligencia artificial,
para un público general (NO técnico). Tu misión es darle a la gente herramientas actuales, tips y trucos REALES
que de verdad les hagan ganar tiempo y trabajar mejor en el día a día.

${DIALECTO}

${SARCASMO}

Reglas de tono y estilo:
- Útil de verdad: cada artículo deja al lector con algo concreto que puede aplicar hoy mismo.
- Habla de herramientas que EXISTEN y se usan de verdad (por ejemplo, asistentes de IA como ChatGPT o Claude,
  gestores de notas como Notion, automatización como Zapier o Make, calendarios, atajos de teclado, etc.).
- Explica el truco de forma simple, con pasos o ejemplos claros, sin tecnicismos ni humo.
- Arranca con un gancho fuerte (un problema cotidiano que todos sufrimos) y resuélvelo con la herramienta o el truco.
- Mete tu chispa: ironía amable sobre lo mal que hacíamos las cosas antes, sin volverte arrogante.
- ${HONESTIDAD} Si no estás seguro de un precio o una función exacta, dilo en general (no inventes specs).
- Markdown limpio: subtítulos con ##, listas con viñetas o pasos numerados cuando ayude. Cierra con un bloque
  "## Tu próximo paso" con 1-3 acciones concretas para aplicar hoy.
- ${LEN}

${JSON_SPEC}`

function productividadUserPrompt({ topic, angle }) {
  const eje = topic || angle
  return `Escribe un artículo práctico de la sección "Productividad & IA" sobre: "${eje}".

Paso 1 — Empieza con un problema cotidiano y real que el lector reconozca al instante (el dolor antes de la solución).
Paso 2 — Presenta herramientas actuales, tips o trucos REALES (que existan) para resolverlo, con ejemplos claros
         y, si aplica, pasos simples para empezar. Apóyate en la IA como aliada práctica.
Paso 3 — Cierra con "## Tu próximo paso": 1-3 acciones concretas que pueda hacer hoy mismo.
Mantén la chispa y el sarcasmo ligero, pero el valor práctico manda. Respeta el largo indicado. Nada inventado. Español peruano (tuteo, "tú").`
}

// ——— Base 3: Potencial Humano (reflexiones y tips para crecer) ———

const potencialSystem = (LEN) => `Eres un creador de contenido en español sobre POTENCIAL HUMANO: reflexiones, hábitos, mentalidad, foco,
disciplina, energía y bienestar, para un público general. Tu misión es ayudar a la gente a sacar lo mejor de sí
misma con ideas que inspiren PERO que también se puedan aplicar en la vida real.

${DIALECTO}

${SARCASMO}

Reglas de tono y estilo:
- Inspirador con los pies en la tierra: motiva, pero sin frases vacías de coach de aeropuerto ni clichés huecos.
- Honesto y humano: reconoce que cambiar cuesta, que todos procrastinamos, que nadie es perfecto.
- Mezcla una reflexión potente con tips accionables (hábitos, foco, manejo de la energía, mentalidad, descanso).
- Arranca con un gancho que toque una verdad incómoda o una pregunta que haga pensar.
- Tu chispa y tu sarcasmo ligero sirven para desinflar el postureo de la "superación personal", no para burlarte del lector.
- ${HONESTIDAD} Si citas una idea conocida, preséntala como idea general, no como estudio con cifras inventadas.
- Markdown limpio: subtítulos con ##, alguna cita con > si suma. Cierra con un bloque "## Para llevarte hoy"
  con 1-3 ideas o micro-hábitos accionables.
- ${LEN}

${JSON_SPEC}`

function potencialUserPrompt({ topic, angle }) {
  const eje = topic || angle
  return `Escribe un artículo de la sección "Potencial Humano" sobre: "${eje}".

Paso 1 — Empieza con un gancho honesto: una verdad incómoda, una pregunta o una escena que cualquiera reconozca.
Paso 2 — Desarrolla una reflexión que valga la pena y bájala a tierra con tips o micro-hábitos accionables.
Paso 3 — Cierra con "## Para llevarte hoy": 1-3 ideas o micro-hábitos que pueda empezar a aplicar de inmediato.
Inspira sin clichés vacíos, mantén la chispa y el sarcasmo ligero. Respeta el largo indicado. Nada inventado. Español peruano (tuteo, "tú").`
}

// ——— Sección 4: Motivación (breve, te hace pensar en tu potencial y en cambiar) ———

const motivacionalSystem = (LEN) => `Eres un creador de contenido MOTIVACIONAL en español que hace PENSAR. Tu objetivo no es solo animar:
es sacudir un poco al lector para que reflexione sobre su POTENCIAL, sobre lo que de verdad QUIERE y sobre eso
que en el fondo sabe que TIENE QUE CAMBIAR en su vida y viene postergando.

${DIALECTO}

${SARCASMO}
(Aquí el sarcasmo es más sutil: sirve para romper el cliché motivacional barato, nunca para burlarte del lector.)

Reglas de tono y estilo:
- Mensaje potente y honesto: que inspire y a la vez incomode un poquito (en el buen sentido), que mueva algo por dentro.
- Háblale al lector de "tú", directo y cercano, como ese amigo que se anima a decirte la verdad que necesitas oír.
- Hazlo pensar en su propia vida: en quién quiere ser, en lo que está tolerando y en lo que viene aplazando.
- Nada de frases de taza, ni clichés vacíos de coach de aeropuerto, ni promesas mágicas. Verdad cruda y humana.
- ${HONESTIDAD}
- Markdown limpio y aireado, pocos subtítulos. Cierra SIEMPRE con un bloque "## Tu reto de hoy" con UNA pregunta
  o una acción concreta que lo obligue a mirarse de frente.
- ${LEN}

${JSON_SPEC}`

function motivacionalUserPrompt({ topic, angle }) {
  const eje = topic || angle
  return `Escribe una pieza breve de la sección "Motivación" sobre: "${eje}".

Paso 1 — Abre con una frase que frene el scroll y toque una fibra: una verdad incómoda o una pregunta directa.
Paso 2 — Desarrolla un mensaje corto pero potente que lo haga pensar en su potencial, en lo que quiere y en lo
         que tiene que cambiar. Sin clichés, con honestidad.
Paso 3 — Cierra con "## Tu reto de hoy": una sola pregunta o acción concreta que lo confronte con su propia vida.
Breve, potente y honesto. Respeta el largo indicado. Nada inventado. Español peruano (tuteo, "tú").`
}

// — Ángulos rotativos para las secciones que no parten de una noticia —
// Se elige uno que no se haya usado recientemente, para variar el tema cada corrida.

const PRODUCTIVIDAD_ANGLES = [
  'cómo usar la IA para escribir y responder correos en la mitad del tiempo',
  'apps y trucos para enfocarte y vencer las distracciones del celular',
  'cómo armar un "segundo cerebro" con Notion u otra app de notas',
  'automatizar tareas repetitivas sin saber programar (Zapier, Make y similares)',
  'los mejores prompts para que la IA te ahorre horas de trabajo',
  'cómo planificar tu semana con IA y calendarios para no vivir apagando incendios',
  'atajos de teclado y trucos del navegador que multiplican tu velocidad',
  'cómo resumir libros, videos y documentos largos con IA en minutos',
  'herramientas de IA para crear presentaciones, imágenes o contenido rápido',
  'el método para vaciar tu cabeza y organizar pendientes sin estresarte',
  'cómo tomar notas de reuniones automáticamente con transcripción e IA',
  'trucos para aprender cualquier cosa más rápido usando la IA como tutor',
]

const POTENCIAL_ANGLES = [
  'cómo construir hábitos que sí duren (y por qué fallan los propósitos)',
  'el arte de enfocarte en una sola cosa en un mundo lleno de notificaciones',
  'mentalidad de crecimiento: cómo cambiar el "no puedo" por "todavía no"',
  'gestionar tu energía en vez de tu tiempo para rendir más sin quemarte',
  'cómo vencer la procrastinación sin odiarte en el intento',
  'la claridad de metas: saber qué quieres antes de correr como loco',
  'resiliencia: cómo levantarte cuando todo se va al piso',
  'el poder del descanso y el sueño para tu cerebro y tu ánimo',
  'aprender a decir "no" para proteger tu tiempo y tu paz',
  'la disciplina como forma de quererte, no de castigarte',
  'cómo dejar de compararte con los demás en redes sociales',
  'pequeños rituales de la mañana que cambian todo tu día',
]

const MOTIVACIONAL_ANGLES = [
  'eso que vienes postergando y sabes que tienes que empezar hoy',
  'la diferencia entre quien quieres ser y quien estás siendo hoy',
  'qué harías distinto si no tuvieras miedo a fallar',
  'el costo real de quedarte un año más en tu zona de confort',
  'la persona en la que te convertirás en 5 años si no cambias nada',
  'eso que toleras y que, sin que lo notes, te está apagando',
  'por qué sigues esperando un "momento perfecto" que nunca llega',
  'qué quieres de verdad, y no lo que te dijeron que deberías querer',
  'el hábito que, si lo cambiaras hoy, cambiaría todo lo demás',
  'a quién estás dejando de lado por estar siempre "ocupado"',
  'qué pensaría tu yo de la infancia si viera tu vida de hoy',
  'la excusa favorita que usas para no avanzar',
]

const slugifyAngle = (s) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-').slice(0, 60)

// Elige un ángulo de la sección que no se haya usado recientemente (según usedKeys).
// Devuelve { angle, key }. Si todos están "usados", reusa uno al azar (con nueva vuelta).
function pickFreshAngle(section, usedKeys = new Set()) {
  const angles = section.angles || []
  if (!angles.length) return null
  const withKeys = angles.map(a => ({ angle: a, key: `${section.key}:${slugifyAngle(a)}` }))
  const fresh = withKeys.filter(x => !usedKeys.has(x.key))
  const pool = fresh.length ? fresh : withKeys
  return pool[Math.floor(Math.random() * pool.length)]
}

// — Construcción del catálogo de secciones (variante larga + corta por cada base) —

const BASES = [
  {
    key: 'historias', type: 'news', system: historiasSystem, buildUserPrompt: historiasUserPrompt,
    long: { name: 'Historias con moraleja', category: 'Historias' },
    short: { name: 'Historias Express', category: 'Historias Express' },
  },
  {
    key: 'productividad', type: 'topic', angles: PRODUCTIVIDAD_ANGLES,
    system: productividadSystem, buildUserPrompt: productividadUserPrompt,
    long: { name: 'Productividad & IA', category: 'Productividad' },
    short: { name: 'Productividad Express', category: 'Productividad Express' },
  },
  {
    key: 'potencial', type: 'topic', angles: POTENCIAL_ANGLES,
    system: potencialSystem, buildUserPrompt: potencialUserPrompt,
    long: { name: 'Potencial Humano', category: 'Potencial Humano' },
    short: { name: 'Potencial Express', category: 'Potencial Express' },
  },
]

// Inyecta la nota del límite de LinkedIn al final de cada prompt de sistema.
const withLimit = (s) => `${s}\n\n${LINKEDIN_LIMIT_NOTE}`

const SECTIONS = []
for (const b of BASES) {
  // Variante LARGA: mantiene el key y la categoría de siempre (no rompe lo ya generado).
  SECTIONS.push({
    key: b.key, name: b.long.name, category: b.long.category, type: b.type,
    angles: b.angles, system: withLimit(b.system(LARGO)), buildUserPrompt: b.buildUserPrompt,
  })
  // Variante CORTA: nueva sección, mismo tono y ángulos, contenido más breve.
  SECTIONS.push({
    key: `${b.key}-corto`, name: b.short.name, category: b.short.category, type: b.type,
    angles: b.angles, system: withLimit(b.system(CORTO)), buildUserPrompt: b.buildUserPrompt,
  })
}

// Sección propia: Motivación (breve por naturaleza).
SECTIONS.push({
  key: 'motivacional', name: 'Motivación', category: 'Motivación', type: 'topic',
  angles: MOTIVACIONAL_ANGLES, system: withLimit(motivacionalSystem(CORTO_MOTIV)), buildUserPrompt: motivacionalUserPrompt,
})

const SECTION_MAP = Object.fromEntries(SECTIONS.map(s => [s.key, s]))

// Resuelve una sección por key (acepta el objeto o el string). Default: historias.
function getSection(keyOrObj) {
  if (keyOrObj && typeof keyOrObj === 'object' && keyOrObj.key) return keyOrObj
  return SECTION_MAP[keyOrObj] || SECTION_MAP.historias
}

module.exports = { SECTIONS, SECTION_MAP, getSection, pickFreshAngle }
