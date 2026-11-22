import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { apiFetch as authApi } from './api/auth'
import { apiFetch as crmDataApi } from './api/crm-data'

export default defineConfig(({ mode }) => {
  const serverEnv = loadEnv(mode, process.cwd(), '')

  // Keep server-only settings available to the local API handler without
  // exposing them through Vite's client-side import.meta.env values.
  for (const name of ['SUPABASE_URL', 'VITE_SUPABASE_URL', 'SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'AUTH_SESSION_SECRET', 'AUTH_BOOTSTRAP_TOKEN', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET']) {
    if (!process.env[name] && serverEnv[name]) process.env[name] = serverEnv[name]
  }

  return {
    plugins: [react(), {
      name: 'strataforge-server-api',
      configureServer(server) {
        const handlers: Record<string, (request: Request) => Promise<Response>> = {
          '/api/auth': authApi,
          '/api/crm-data': crmDataApi,
        }
        for (const [route, handler] of Object.entries(handlers)) server.middlewares.use(route, async (req, res, next) => {
          try {
            if (!req.url) return next()
            const method = req.method ?? 'GET'
            const headers = new Headers()
            for (const [name, value] of Object.entries(req.headers)) {
              if (typeof value === 'string') headers.set(name, value)
              else if (Array.isArray(value)) headers.set(name, value.join(', '))
            }

            let body: string | undefined
            if (method !== 'GET' && method !== 'HEAD') {
              const chunks: Uint8Array[] = []
              for await (const chunk of req) chunks.push(typeof chunk === 'string' ? new TextEncoder().encode(chunk) : chunk)
              body = new TextDecoder().decode(Buffer.concat(chunks))
            }

            const request = new Request(`http://${req.headers.host ?? '127.0.0.1'}${req.url}`, { method, headers, body })
            const response = await handler(request)
            res.statusCode = response.status
            response.headers.forEach((value, name) => res.setHeader(name, value))
            res.end(await response.text())
          } catch (error) {
            server.config.logger.error('Local CRM API failed', { error })
            res.statusCode = 500
            res.setHeader('content-type', 'application/json')
            res.end(JSON.stringify({ error: 'The local workspace member API could not complete the request.' }))
          }
        })
      },
    }],
    server: { host: '127.0.0.1', port: 55010, strictPort: true },
  }
})
