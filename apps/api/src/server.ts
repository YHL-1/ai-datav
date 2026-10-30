import 'dotenv/config'
import { buildApp } from './app.js'

const { app, config } = await buildApp()

try {
  await app.listen({ host: config.host, port: config.port })
} catch (error) {
  app.log.error(error)
  process.exit(1)
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, async () => {
    await app.close()
    process.exit(0)
  })
}
