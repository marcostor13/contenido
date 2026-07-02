# Módulo de auto-generación de contenido

Genera artículos reales, interesantes, animados y con un sarcasmo ligero de forma
automática (cron) o manual (desde el administrador), conectando noticias y herramientas
reales con la tecnología actual y la inteligencia artificial.

## Misión (el norte de todo el contenido)

Posicionar al autor como **referente de tecnología e IA** cuyo contenido ayuda a la gente a
**aumentar su productividad, mejorar en su trabajo o hacer crecer su empresa**. Un bloque
transversal `MISION` (en `api/lib/sections.js`) se inyecta al inicio de TODOS los prompts:
noticias, consejos, reflexiones y motivación deben aterrizar siempre en ese objetivo, con la
prueba de fuego "¿esto ayuda a producir más, trabajar mejor o hacer crecer un negocio usando
tecnología o IA?". La fase de aprendizaje también optimiza hacia esa meta (`learn.js` y la
estrategia base en `knowledge.js`).

- **Historias**: la noticia (cotidiana o de IA/tecnología con impacto en la gente) es el gancho;
  la moraleja aterriza en el trabajo o el negocio del lector. Se sumaron feeds de noticias de
  IA/tecnología/emprendimiento en `sources.js`.
- **Productividad & IA**: baja los consejos a dos terrenos — el empleado que quiere destacar y
  el emprendedor que quiere que su negocio funcione mejor.
- **Potencial Humano**: potencial EN LA ERA DE LA IA — hábitos, foco y mentalidad aterrizados en
  el rendimiento laboral, con la tecnología como aliada (o saboteadora) del hábito.
- **Motivación**: motiva a dar el paso tecnológico postergado (aprender, probar la IA,
  actualizarse, emprender), con agencia y sin miedo barato; el reto de hoy es un paso pequeño
  y tecnológico.

## Secciones

Por defecto, en cada corrida del cron se genera **una pieza por cada sección** (todas con la
misma frecuencia configurada); con la **rotación** activada se genera una por corrida. Cada
base temática tiene una variante **larga** (la de siempre) y una **corta** (más directa), que
conviven como secciones separadas. Las secciones y su tono están definidas en `api/lib/sections.js`:

1. **Historias con moraleja** (`historias`, categoría *Historias*) y **Historias Express**
   (`historias-corto`, categoría *Historias Express*). Noticias reales y cotidianas convertidas
   en reels con storytelling y moraleja conectada con la IA. Tono animado, con chispa y sarcasmo
   ligero. Parte de una noticia real.
2. **Productividad & IA** (`productividad`, categoría *Productividad*) y **Productividad Express**
   (`productividad-corto`, categoría *Productividad Express*). Herramientas actuales, tips y trucos
   REALES para producir más con tecnología e IA. Cierra con "Tu próximo paso". Ángulo rotativo.
3. **Potencial Humano** (`potencial`, categoría *Potencial Humano*) y **Potencial Express**
   (`potencial-corto`, categoría *Potencial Express*). Reflexiones y tips para potenciar al ser
   humano (hábitos, foco, mentalidad, energía). Cierra con "Para llevarte hoy". Ángulo rotativo.
4. **Motivación** (`motivacional`, categoría *Motivación*). Pieza breve y potente que te hace
   pensar en tu potencial, en lo que de verdad quieres y en lo que tienes que cambiar. Cierra con
   "Tu reto de hoy" (una pregunta o acción que te confronta). Ángulo rotativo.

La variante corta usa el mismo tono y los mismos ángulos que la larga, pero con un largo más
breve (≈150-280 palabras; Motivación ≈120-220). Las secciones por ángulo eligen un tema no usado
recientemente para variar en cada corrida; las categorías nuevas aparecen automáticamente como
filtros en la página principal.

## Dos formatos por pieza: post de LinkedIn + guion de video

Cada generación produce DOS formatos del mismo contenido:

1. **Post para LinkedIn** (`content`): estructurado según el algoritmo — las 2 primeras líneas
   funcionan como gancho (≈200 caracteres visibles antes del "ver más"), párrafos de 1-2 líneas
   con aire visual para maximizar el dwell time, remate + pregunta abierta al cierre.
2. **Guion de video vertical** (`videoScript`): 40-60 segundos en lenguaje HABLADO peruano para
   grabar TikTok, Instagram Reels, YouTube Shorts y Facebook. Estructura de retención con marcas:
   `[GANCHO]` (0-3s, sin saludos), `[PROMESA]`, `[DESARROLLO]` (con un bucle abierto),
   `[REMATE]` (payoff) y `[CIERRE]` (pregunta + efecto bucle con la primera frase).

En la página del artículo hay dos botones: *Copiar para LinkedIn* (con contador `N/3000`) y
*Copiar guion de video*, más un visor plegable del guion.

Los prompts aplican bloques transversales de **psicología de la atención** (brecha de curiosidad,
ruptura de patrón, emoción dominante, especificidad, bucles abiertos y payoff), **anti-clichés**,
**interacción/debate** y la estructura por plataforma. Ver `api/lib/sections.js` y la base
permanente en `api/lib/knowledge.js`.

## Límite de LinkedIn (3000 caracteres)

Un post normal de LinkedIn admite **3000 caracteres** (contando espacios). Todo el contenido se
genera para entrar en ese tope **ya formateado** (título en negrita + cuerpo + hashtags):

- Cada sección lleva en su prompt un **tope de caracteres** sobre el post completo, con margen para
  el formato y los hashtags (largas ≤2500, cortas ≤1200, Motivación ≤900).
- Tras generar, `generateArticle` mide el texto formateado para LinkedIn con `api/lib/linkedin.js`.
  Si se pasa de 3000, pide al modelo una **versión más corta** que conserve gancho, hilo y cierre y,
  como último recurso, **recorta** párrafos del final para no exceder nunca el límite.
- En la página del artículo, el botón *Copiar para LinkedIn* muestra el contador `N/3000` para
  verificar de un vistazo que el post entra. El conversor del cliente y el del servidor son espejos.

## Cómo funciona

0. **Aprender (antes de todo).** En cada corrida del cron, primero se ejecuta una fase de
   aprendizaje que parte de una **estrategia base permanente** (viralidad y monetización 2026:
   regla de los 3 segundos, ganchos, CTAs, afiliados, productos digitales, suscripciones, UGC, apoyo
   en IA — ver `api/lib/knowledge.js`). Sobre ese fundamento analiza los artículos previos (qué funcionó
   según su viralidad), **lee el historial de aprendizajes guardado en la base** (para no perder contexto)
   e investiga/recopila técnicas de viralidad actuales. Con eso construye y evoluciona un **playbook**
   accionable. La estrategia base se siembra una sola vez en `content.learnings` (cycle 0, seed); cada
   ciclo de aprendizaje se guarda de forma acumulativa (append-only) en la misma colección, y el playbook
   vigente queda en `settings.playbook` para inyectarse en la generación. La generación manual reutiliza
   el último playbook (o la estrategia base si aún no hubo ciclos).
1. **Buscar (paso 1).** Se toma una noticia/herramienta REAL y trending desde la API
   pública de Hacker News (front page + búsquedas de productividad / herramientas / IA).
   Se evitan repeticiones usando las fuentes ya procesadas.
2. **Analizar (paso 2).** Con el gateway de IA (OpenAI, DeepSeek, Groq o Gemini, con balanceo y failover) se analiza el material y se le encuentra
   una relación genuina con la tecnología actual y la IA.
3. **Generar y guardar (paso 3).** Se analiza viralidad y storytelling, se redacta el
   artículo (tono amical, sin jerga, no técnico) y se guarda en `content.articles` con la
   misma estructura del proyecto, quedando publicado en la página.

## Cron configurable

- La Scheduled Function de Netlify `autogen` corre **cada minuto** (`netlify.toml`). Es la
  resolución mínima: el cron base define cada cuánto se *revisa* si toca generar.
- El on/off y la **frecuencia real** (cada cuántos **minutos** genera) se controlan desde el
  administrador → pestaña **Generar con IA** → *Automatización (cron)*. La función solo
  genera si está activada y si pasó el intervalo configurado (mínimo de seguridad **5 minutos**,
  máximo 10080 = 7 días). Las corridas en las que aún no toca generar salen de inmediato (sin costo de IA).
- La frecuencia se guarda como `frequencyMinutes` (default **30 min**). Los valores antiguos en
  `frequencyHours` se migran automáticamente a minutos al leer la configuración.
- **Secciones por ciclo** (`sectionsPerCycle`, default **2**): cada ciclo genera esa cantidad de
  secciones, rotando entre todas con el puntero `_sectionRr` (así todas aparecen por igual con el
  tiempo). Para no exceder el límite de tiempo de las funciones, se genera **una sección por corrida**
  del cron (máquina de estados `_cycleCursor`: primero aprende, luego una sección por corrida hasta
  completar el ciclo); recién entonces arranca el reloj de la frecuencia.

## Generación manual (administrador)

Pestaña **Generar con IA**:
- **Generar desde un tema:** elegís la sección, escribís un tema y el botón redacta una pieza
  con el tono de esa sección (pasos 2 y 3).
- **Generar todas las secciones ahora:** dispara el flujo completo una vez y publica una pieza
  por cada sección (Historias, Productividad & IA y Potencial Humano).

## Gateway de IA: prioridad y failover

El gateway (`api/lib/llm.js`, función `chatResilient`) elige el proveedor por **prioridad** y
hace **failover** automático si uno no responde. Orden de prioridad (modo `auto`):

1. **DeepSeek** (prioridad — su mejor modelo, `deepseek-chat` V3)
2. **OpenAI**
3. **Gemini** (gratis)
4. **Groq** (gratis, **solo respaldo** — último de la lista)

En `auto` usa el de mayor prioridad disponible y, si falla (saldo, clave, límite o timeout),
reintenta con el siguiente. También se puede **forzar** un motor desde el administrador; incluso
forzado, el resto queda como respaldo ordenado por prioridad (Groq siempre al final).

## Variables de entorno

| Variable | Requerida | Descripción |
|----------|-----------|-------------|
| `MONGODB_URI` | sí | Conexión a MongoDB (ya existente). |
| `ADMIN_PASSWORD` | sí | Contraseña del administrador (ya existente). |
| `OPENAI_API_KEY` | al menos una | API key de OpenAI (de pago). |
| `DEEPSEEK_API_KEY` | al menos una | API key de DeepSeek (de pago, económico). |
| `GROQ_API_KEY` | al menos una | API key de Groq — **plan gratuito**. |
| `GEMINI_API_KEY` | al menos una | API key de Google Gemini — **plan gratuito** (también acepta `GOOGLE_API_KEY`). |
| `OPENAI_MODEL` | no | Modelo OpenAI (default `gpt-4o-mini`). |
| `DEEPSEEK_MODEL` | no | Modelo DeepSeek (default `deepseek-chat`). |
| `GROQ_MODEL` | no | Modelo Groq (default `llama-3.3-70b-versatile`). |
| `GEMINI_MODEL` | no | Modelo Gemini (default `gemini-2.0-flash`). |

> Configurá **al menos una** de las keys de IA en Netlify. Si ponés varias, el gateway
> reparte la carga (round-robin) y hace **failover automático**: si un proveedor no
> responde (saldo, clave, límite o timeout), reintenta con el siguiente.
> Groq y Gemini son **gratuitos**, ideales como respaldo sin costo.

## Endpoints nuevos

- `GET/POST /api/settings` — leer/actualizar la configuración del cron (admin).
- `POST /api/generate` — `{ topic }` genera desde un tema; `{ runCron: true }` dispara el flujo completo (admin).
- `autogen` — Scheduled Function (cron horario).
