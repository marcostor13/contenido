const { MongoClient } = require('mongodb')
const dns = require('dns')
dns.setServers(['8.8.8.8', '1.1.1.1'])

const uri = process.env.MONGODB_URI
if (!uri) { console.error('MONGODB_URI no definida'); process.exit(1) }

const content = `Hay una pregunta que los padres hacen en voz baja cuando se cruzan con alguien del mundo tech: *¿Qué debería estudiar mi hijo?*

El Wall Street Journal se la hizo directamente a cinco de las personas más influyentes en inteligencia artificial — incluyendo a Daniela Amodei, cofundadora de Anthropic. Y las respuestas tienen un patrón que nadie esperaba.

## La paradoja de los expertos en IA

Daniela Amodei construye algunos de los modelos de IA más avanzados del mundo. Sus hijos tienen cuatro años y seis meses. Y esto es lo que dice sobre su futuro:

> "Lo que no va a ser reemplazable es cómo tratás a la gente, qué tan bien te comunicás, qué tan amable sos."

La persona que co-fundó Anthropic no quiere que sus hijos estudien IA. Quiere que sean más humanos.

## Las carreras con futuro concreto

Manny Medina, fundador de una empresa de agentes de IA, apostó diferente para sus hijos mayores: uno trabaja con Bill Gates en energía nuclear, otro estudia medicina nuclear para el tratamiento del cáncer. Dos sectores donde la demanda va a crecer sin importar lo que pase con la tecnología: energía y salud.

Su fórmula para elegir carrera es la más honesta que escuché: tiene que ser algo que disfrutás, algo en lo que sos bueno, y algo útil para alguien más. Si además da dinero, mejor — pero esos tres son los que importan.

## Por qué el título generalista importa más que nunca

Ethan Mollick, profesor de Wharton y uno de los investigadores más serios sobre IA en el trabajo, dice algo que parece contradictorio: una educación amplia — derecho, medicina, humanidades — puede ser mejor apuesta que especializarse en algo técnico que puede quedar obsoleto en dos años.

La lógica es directa: la IA ya hace lo técnico. Lo que no puede hacer es juzgar, tomar responsabilidad, adaptarse, conectar con otros. Los trabajos generalistas, donde hay muchas habilidades distintas combinadas, son los más difíciles de reemplazar.

## El giro que nadie dice en voz alta

Estamos tan preocupados por la IA que queremos que nuestros hijos compitan *con* ella estudiando exactamente lo que ella hace. Y las personas que la construyen nos están diciendo que eso es lo que no hay que hacer.

La IA va a ser tan buena en lo técnico que lo técnico dejará de ser la ventaja. La ventaja va a estar en lo que la IA no puede ser: alguien que entiende a un paciente, que defiende a un cliente, que lidera un equipo, que crea algo que mueva a alguien.

## La moraleja

En un mundo donde la inteligencia artificial hace el trabajo de la mente, lo más valioso vuelve a ser lo más humano.

No estudies *para* la IA. Estudiá *lo que la IA no puede ser.*`

async function run() {
  const client = new MongoClient(uri, { family: 4 })
  await client.connect()
  const col = client.db('content').collection('articles')

  const existing = await col.findOne({ slug: 'lo-que-los-creadores-de-ia-le-dicen-a-sus-hijos' })
  if (existing) {
    console.log('Ya existe, id:', existing._id.toString())
    await client.close()
    return
  }

  const now = new Date()
  const result = await col.insertOne({
    title: 'Lo que los creadores de la IA le dicen a sus hijos que estudien',
    slug: 'lo-que-los-creadores-de-ia-le-dicen-a-sus-hijos',
    excerpt: 'Los ejecutivos de Anthropic, Microsoft y Wharton tienen la misma respuesta para la pregunta que todos los padres se hacen — y no es lo que esperás.',
    category: 'Tecnología',
    tags: ['ia', 'educación', 'carreras', 'futuro', 'trabajo'],
    published: true,
    content,
    sources: ['https://www.wsj.com/lifestyle/careers/what-ai-executives-tell-their-own-kids-about-the-jobs-of-the-future-1ba43f65'],
    createdAt: now,
    updatedAt: now,
  })
  console.log('Guardado con id:', result.insertedId.toString())
  await client.close()
}

run().catch(e => { console.error(e.message); process.exit(1) })
