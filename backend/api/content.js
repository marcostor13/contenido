const { MongoClient, ObjectId } = require('mongodb')
const dns = require('dns')

dns.setServers(['8.8.8.8', '1.1.1.1'])

let client = null

async function col() {
  if (!client) {
    client = new MongoClient(process.env.MONGODB_URI, { family: 4 })
    await client.connect()
  }
  return client.db('content').collection('articles')
}

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
}

const ok = (data, status = 200) => ({
  statusCode: status,
  headers,
  body: JSON.stringify(data),
})

const err = (msg, status = 400) => ({
  statusCode: status,
  headers,
  body: JSON.stringify({ error: msg }),
})

const authed = (event) =>
  (event.headers?.['x-admin-password'] ?? '') === process.env.ADMIN_PASSWORD

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: { ...headers, 'Access-Control-Allow-Headers': 'x-admin-password,content-type' }, body: '' }
  }

  const c = await col()
  const params = event.queryStringParameters ?? {}

  // GET — lista o artículo individual
  if (event.httpMethod === 'GET') {
    if (params.slug) {
      const item = await c.findOne({ slug: params.slug, published: true })
      if (!item) return err('No encontrado', 404)
      return ok({ ...item, _id: item._id.toString() })
    }

    const filter = { published: true }
    if (params.q) filter.$text = { $search: params.q }
    if (params.category) filter.category = params.category

    const items = await c
      .find(filter, { projection: { content: 0 } })
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray()

    const categories = await c.distinct('category', { published: true })

    return ok({
      items: items.map(i => ({ ...i, _id: i._id.toString() })),
      categories,
    })
  }

  // POST — crear artículo
  if (event.httpMethod === 'POST') {
    if (!authed(event)) return err('No autorizado', 401)
    const body = JSON.parse(event.body ?? '{}')
    if (!body.title || !body.content) return err('Título y contenido requeridos')
    const now = new Date()
    const doc = {
      title: body.title,
      slug: body.slug || body.title.toLowerCase().replace(/\s+/g, '-'),
      content: body.content,
      excerpt: body.excerpt ?? '',
      category: body.category ?? 'General',
      tags: body.tags ?? [],
      published: body.published ?? true,
      createdAt: now,
      updatedAt: now,
    }
    const result = await c.insertOne(doc)
    return ok({ ...doc, _id: result.insertedId.toString() }, 201)
  }

  // DELETE — eliminar artículo
  if (event.httpMethod === 'DELETE') {
    if (!authed(event)) return err('No autorizado', 401)
    if (!params.id) return err('id requerido')
    await c.deleteOne({ _id: new ObjectId(params.id) })
    return ok({ ok: true })
  }

  return err('Método no soportado', 405)
}
