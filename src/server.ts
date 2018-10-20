import Koa from 'koa'
import cors from 'koa-cors'
import nodepath from 'path'
import { loadControllers } from './lib/Helper'
import { createOpenApi } from './lib/OpenApiHelper'
const server = new Koa()
server.use(cors())

const startup = async () => {
  const router = await loadControllers(nodepath.resolve(__dirname, './controllers'))
  router.get('/api', async (ctx) => {
    ctx.body = await createOpenApi(nodepath.resolve(__dirname, './controllers'), { title: 'test', version: '0.0.1' })
  })
  server.use(router.routes())
  server.use(router.allowedMethods())
  server.listen(3000)
}

startup()
