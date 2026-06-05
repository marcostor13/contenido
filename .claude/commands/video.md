# /video — Generador de contenido para video

Genera un guion de video y artículo para el proyecto de contenido del usuario.

## Estilo y preferencias del usuario

**Formato del video:**
- Duración: 2 a 4 minutos (~300–500 palabras habladas a 150 palabras/minuto)
- Estructura: Hook potente → Contexto → Desarrollo (2-3 puntos) → Giro/Paradoja → Moraleja
- El hook debe capturar atención en los primeros 5 segundos

**Tono y voz:**
- **Español de Perú** — tuteo (tú/ti/te/eres), nunca voseo argentino (vos/sos/hablás/disfrutás)
- Amigable y cercano, como alguien que te cuenta algo interesante en una charla — no un periodista ni un profesor
- Sin formalidad innecesaria: nada de "cabe destacar", "en tal sentido", "resulta que" o frases de nota académica
- Sin jergas ni palabras de moda forzadas: no "random", no "básicamente", no "o sea"
- Primera persona, directo, fluido — las oraciones cortas y naturales son mejores que las largas y perfectas
- Original: buscar el ángulo que nadie dice, no repetir lo que ya todos saben
- Alto valor: cada minuto tiene que aportar algo concreto — un dato, una historia, una idea que cambia cómo ves algo
- Con moraleja: cerrar siempre con una reflexión que se lleva el espectador

**Frases de ejemplo del tono buscado:**
- ✅ "Y lo que dijeron tiene un patrón que nadie esperaba."
- ✅ "Tiene cuatro hijos. El mayor acaba de entrar a trabajar con Bill Gates."
- ✅ "Para elegir carrera, tiene una fórmula simple que me parece la más honesta que escuché."
- ❌ "Según los expertos consultados, las tendencias indican que..."
- ❌ "Es importante destacar que en el contexto actual..."

**Temas:**
- Principal: tecnología e inteligencia artificial
- Puede tratar cualquier tema actual visto desde la lente de la IA y el cambio tecnológico
- El enfoque es impacto humano, no solo técnica

**Referencias de estilo visual/narrativo a incorporar:**
- TeresaGao (actualizar con más detalle cuando se analice el canal)
- Videos de alto valor, interesantes, originales, con moraleja

---

## Cómo usar este skill

Cuando el usuario invoque `/video`, pedile:
1. El tema del video
2. Las fuentes (artículos, links, notas)
3. Duración objetivo (2, 3 o 4 minutos)

Luego genera:

### Salida esperada

**1. GUION DEL VIDEO** (para grabar)
Escrito como se habla — marcas de pausa, énfasis, transiciones naturales.

Secciones:
- `[HOOK]` — pregunta o dato que rompe expectativas
- `[CONTEXTO]` — por qué importa esto ahora
- `[DESARROLLO]` — 2-3 ideas clave con ejemplos concretos
- `[GIRO]` — el ángulo inesperado, la paradoja, lo que cambia la perspectiva
- `[MORALEJA]` — el cierre: una idea que se lleva el espectador

**2. ARTÍCULO** (para guardar en la app)
Versión escrita del video, adaptada para leer. Incluye:
- Título
- Slug
- Excerpt (1-2 oraciones)
- Contenido en Markdown
- Categoría y tags

---

## Notas para evolución del skill

- Ir actualizando "Referencias de estilo" con feedback del usuario
- Agregar ejemplos de videos aprobados como muestra de voz
- Ajustar longitud y tono según métricas de los videos publicados
