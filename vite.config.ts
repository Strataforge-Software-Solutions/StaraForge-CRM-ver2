import { Buffer } from 'node:buffer'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import profilePhotoApi from './api/profile-photo'

function localProfilePhotoApi(): Plugin {
  return {
    name: 'local-profile-photo-api',
    configureServer(server) {
      server.middlewares.use(async (incoming, outgoing, next) => {
        const url = new URL(incoming.url ?? '/', `http://${incoming.headers.host ?? '127.0.0.1'}`)
        if (url.pathname !== '/api/profile-photo') return next()

        try {
          const headers = new Headers()
          for (const name of ['authorization', 'origin', 'content-type']) {
            const value = incoming.headers[name]
            if (typeof value === 'string') headers.set(name, value)
          }
          const method = incoming.method ?? 'GET'
          const hasBody = !['GET', 'HEAD'].includes(method)
          const request = new Request(url, {
            method,
            headers,
            ...(hasBody ? { body: incoming, duplex: 'half' } : {}),
          } as RequestInit)
          const response = await profilePhotoApi.fetch(request)
          outgoing.statusCode = response.status
          response.headers.forEach((value, name) => outgoing.setHeader(name, value))
          outgoing.end(Buffer.from(await response.arrayBuffer()))
        } catch (error) {
          outgoing.statusCode = 500
          outgoing.setHeader('content-type', 'application/json')
          outgoing.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Profile photo request failed.' }))
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  Object.entries(loadEnv(mode, process.cwd(), '')).forEach(([key, value]) => {
    if (!process.env[key]) process.env[key] = value
  })
  return {
    plugins: [react(), localProfilePhotoApi()],
    server: { host: '127.0.0.1', port: 55010, strictPort: true },
  }
})
