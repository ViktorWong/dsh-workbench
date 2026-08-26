import * as net from 'node:net'
import { describe, expect, it } from 'vitest'
import { isPortFree, parseServiceUrl } from '../electron/supervisor'

describe('parseServiceUrl', () => {
  it('extracts the URL from the dsh banner line', () => {
    expect(parseServiceUrl('dsh web: http://127.0.0.1:3999\n')).toBe('http://127.0.0.1:3999')
  })

  it('returns null when no URL is printed', () => {
    expect(parseServiceUrl('some unrelated log line')).toBeNull()
  })

  it('picks the first URL when multiple chunks arrive', () => {
    expect(parseServiceUrl('listening on http://127.0.0.1:45555 extra http://x:1')).toBe(
      'http://127.0.0.1:45555',
    )
  })
})

describe('isPortFree', () => {
  it('reports a bound port as busy', async () => {
    const server = net.createServer()
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const { port } = server.address() as net.AddressInfo
    await expect(isPortFree(port)).resolves.toBe(false)
    server.close()
  })

  it('reports a free port as free', async () => {
    // Grab a port, release it, then probe it.
    const server = net.createServer()
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const { port } = server.address() as net.AddressInfo
    await new Promise<void>((resolve) => server.close(() => resolve()))
    await expect(isPortFree(port)).resolves.toBe(true)
  })
})
