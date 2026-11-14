import { describe, expect, it, vi } from 'vitest'
import { delay, lookup, queryURL, readQuery, safeURL } from './search'

const empty = { query: 'Nook', country: 'us', platform: 'ios', status: 'no_public_match', availability: 'unconfirmed', matches: [], results_scanned: 0 }
describe('catalog client', () => {
  it('keeps empty results distinct from a failed lookup', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify(empty))).mockResolvedValueOnce(new Response(JSON.stringify({ status: 'error', error: 'Apple is offline' }), { status: 502 }))
    vi.stubGlobal('fetch', fetch)
    const signal = new AbortController().signal
    expect((await lookup('Nook', 'us', 'ios', signal)).status).toBe('no_public_match')
    await expect(lookup('Nook', 'us', 'ios', signal)).rejects.toThrow('Apple is offline')
  })
  it('rejects malformed JSON payloads without exposing a runtime exception', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('null')))
    await expect(lookup('Nook', 'us', 'ios', new AbortController().signal)).rejects.toThrow('unexpected response')
  })
  it('does not start an already cancelled request or delayed suggestion', async () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch)
    const controller = new AbortController(); controller.abort()
    await expect(lookup('Nook', 'us', 'ios', controller.signal)).rejects.toMatchObject({ name: 'AbortError' })
    await expect(delay(1000, controller.signal)).rejects.toMatchObject({ name: 'AbortError' })
    expect(fetch).not.toHaveBeenCalled()
  })
  it('restores query, storefront and platform from a shared link', () => {
    const query = { name: 'Café Notes', country: 'gb', platform: 'mac' as const }
    window.history.replaceState({}, '', queryURL(query))
    expect(readQuery()).toEqual(query)
  })
  it('rejects unsafe listing and image URLs', () => {
    expect(safeURL('https://apps.apple.com/us/app/test/id1')).toBeTruthy()
    expect(safeURL('https://is1.mzstatic.com/image.png', true)).toBeTruthy()
    for (const url of ['javascript:alert(1)', 'https://apps.apple.com.evil.example', 'https://user@is1.mzstatic.com/image']) {
      expect(safeURL(url)).toBeNull(); expect(safeURL(url, true)).toBeNull()
    }
  })
})
