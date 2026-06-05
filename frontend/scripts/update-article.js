const { MongoClient, ObjectId } = require('mongodb')
const dns = require('dns')
dns.setServers(['8.8.8.8', '1.1.1.1'])

const uri = process.env.MONGODB_URI
if (!uri) { console.error('MONGODB_URI no definida'); process.exit(1) }

const content = `Hay una pregunta que los padres se hacen pero casi nunca dicen en voz alta cuando están con alguien del mundo tech: *¿Qué debería estudiar mi hijo?*

El WSJ fue a buscar la respuesta donde tiene más sentido buscarla: con los ejecutivos que están construyendo la IA hoy. Cinco personas, incluyendo a Daniela Amodei, cofundadora de Anthropic. Y lo que dijeron tiene un patrón que nadie esperaba.

## La paradoja de los que construyen la IA

Daniela Amodei tiene hijos de cuatro años y seis meses. Construye algunos de los modelos de IA más avanzados que existen. Y cuando le preguntan qué quiere para el futuro de sus hijos, dice esto:

> "Lo que no va a ser reemplazable es cómo tratas a la gente, qué tan bien te comunicas, qué tan amable eres."

No dijo: aprendan a programar. No dijo: estudien machine learning. Dijo: sean más humanos.

## Las apuestas concretas que sí tienen sentido

Manny Medina tiene cuatro hijos. El mayor acaba de entrar a trabajar en energía nuclear con Bill Gates. El de 19 estudia medicina nuclear para el tratamiento del cáncer. No es casualidad: dos sectores donde la demanda va a seguir creciendo, con o sin IA.

Para elegir carrera, Manny tiene una fórmula simple que me parece la más honesta que escuché: tiene que ser algo que disfrutas, algo en lo que eres bueno, y algo que le sirva a alguien más. Si encima da dinero, genial. Pero esos tres son los que importan de verdad.

## El título generalista tiene más futuro de lo que piensas

Ethan Mollick da clases en Wharton y estudia el impacto de la IA en el trabajo. Y dice algo que al principio suena raro: estudiar derecho, medicina, o humanidades puede ser mejor apuesta que meterse en algo técnico muy específico que en dos años ya quedó viejo.

¿Por qué? Porque la IA ya hace lo técnico, y cada vez lo va a hacer mejor. Lo que no puede hacer es juzgar, hacerse responsable, adaptarse a situaciones que nunca vio, conectar con otra persona. Los trabajos donde hay muchas habilidades distintas mezcladas son los más difíciles de reemplazar.

## Lo que nadie dice en voz alta

Estamos tan preocupados por la IA que queremos que nuestros hijos compitan con ella estudiando lo mismo que ella hace. Y justamente las personas que la están construyendo nos dicen que eso es lo que no hay que hacer.

La IA va a ser tan buena en lo técnico que lo técnico va a dejar de ser la ventaja. La ventaja va a estar en lo que la IA no puede ser: alguien que realmente entiende a un paciente, que defiende a un cliente, que lleva un equipo, que crea algo que mueve a alguien.

## La moraleja

En un mundo donde la IA hace el trabajo de la mente, lo más valioso vuelve a ser lo más humano.

No estudies para la IA. Estudia lo que la IA no puede ser.`

async function run() {
  const client = new MongoClient(uri, { family: 4 })
  await client.connect()
  const col = client.db('content').collection('articles')

  const result = await col.updateOne(
    { slug: 'lo-que-los-creadores-de-ia-le-dicen-a-sus-hijos' },
    { $set: { content, updatedAt: new Date() } }
  )
  console.log('Actualizado:', result.modifiedCount, 'documento(s)')
  await client.close()
}

run().catch(e => { console.error(e.message); process.exit(1) })
