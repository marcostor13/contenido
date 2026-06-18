# Módulo de auto-generación de contenido

Genera artículos reales, interesantes y con tono amical de forma automática (cron)
o manual (desde el administrador), conectando noticias y herramientas reales con la
tecnología actual y la inteligencia artificial.

## Cómo funciona

0. **Aprender (antes de todo).** En cada corrida del cron, primero se ejecuta una fase de
   aprendizaje: analiza los artículos previos (qué funcionó según su viralidad), **lee el historial de
   aprendizajes guardado en la base** (para no perder contexto) e investiga/recopila herramientas y
   técnicas de viralidad actuales. Con eso construye y evoluciona un **playbook** (guía accionable).
   Cada ciclo se guarda de forma acumulativa (append-only) en la colección `content.learnings`, y el
   playbook vigente queda en `settings.playbook` para inyectarse en la generación. La generación
   manual reutiliza el último playbook guardado.
1. **Buscar (paso 1).** Se toma una noticia/herramienta REAL y trending desde la API
   pública de Hacker News (front page + búsquedas de productividad / herramientas / IA).
   Se evitan repeticiones usando las fuentes ya procesadas.
2. **Analizar (paso 2).** Con OpenAI o DeepSeek se analiza el material y se le encuentra
   una relación genuina con la tecnología actual y la IA.
3. **Generar y guardar (paso 3).** Se analiza viralidad y storytelling, se redacta el
   artículo (tono amical, sin jerga, no técnico) y se guarda en `content.articles` con la
   misma estructura del proyecto, quedando publicado en la página.

## Cron configurable

- La Scheduled Function de Netlify `autogen` corre **cada hora** (`netlify.toml`).
- El on/off y la **frecuencia real** (cada cuántas horas genera) se controlan desde el
  administrador → pestaña **Generar con IA** → *Automatización (cron)*. La función solo
  genera si está activada y si pasó el intervalo configurado (1 a 168 horas).

## Generación manual (administrador)

Pestaña **Generar con IA**:
- **Generar desde un tema:** escribís un tema en el input y el botón ejecuta los pasos 2 y 3.
- **Buscar y generar ahora:** dispara el flujo completo (pasos 1, 2 y 3) una vez.

## Balanceo de carga OpenAI / DeepSeek

Si están configuradas ambas keys y el motor está en `auto`, las cargas se reparten
(round-robin). También se puede forzar uno de los dos motores desde el administrador.

## Variables de entorno

| Variable | Requerida | Descripción |
|----------|-----------|-------------|
| `MONGODB_URI` | sí | Conexión a MongoDB (ya existente). |
| `ADMIN_PASSWORD` | sí | Contraseña del administrador (ya existente). |
| `OPENAI_API_KEY` | una de las dos | API key de OpenAI. |
| `DEEPSEEK_API_KEY` | una de las dos | API key de DeepSeek. |
| `OPENAI_MODEL` | no | Modelo OpenAI (default `gpt-4o-mini`). |
| `DEEPSEEK_MODEL` | no | Modelo DeepSeek (default `deepseek-chat`). |

> Configurá al menos una de `OPENAI_API_KEY` o `DEEPSEEK_API_KEY` en Netlify.
> Si ponés las dos, el sistema reparte la carga entre ambas cuentas.

## Endpoints nuevos

- `GET/POST /api/settings` — leer/actualizar la configuración del cron (admin).
- `POST /api/generate` — `{ topic }` genera desde un tema; `{ runCron: true }` dispara el flujo completo (admin).
- `autogen` — Scheduled Function (cron horario).
