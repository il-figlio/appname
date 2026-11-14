import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import App from './App'
import * as searchClient from './lib/search'

const result = {
  query: 'Cradle', country: 'us', platform: 'ios', status: 'exact_match', availability: 'unconfirmed',
  checked_at: '2026-11-14T02:00:00Z', results_scanned: 1, search_limit_reached: false,
  matches: [{ id: 1234399947, name: 'Cradle', developer: 'Cradle.io', match: 'exact', url: 'https://apps.apple.com/us/app/cradle/id1234399947',
    preview: { icon: null, screenshots: [], description: 'A phone system.', category: 'Business', price: 'Free' } }],
}
function respond(body = result, status = 200) {
  const fetch = vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify(body), { status })))
  vi.stubGlobal('fetch', fetch)
  return fetch
}
async function search() {
  fireEvent.change(screen.getByLabelText('App name'), { target: { value: 'Cradle' } })
  fireEvent.submit(screen.getByRole('button', { name: 'Search name' }).closest('form')!)
  await screen.findByText('Exact match found')
}
describe('Appname interface', () => {
  it('shows real API-shaped results and an accessible desktop app preview', async () => {
    respond(); const user = userEvent.setup(); render(<App />)
    await search()
    expect(window.location.search).toContain('name=Cradle')
    await user.click(screen.getByRole('button', { name: 'Preview Cradle' }))
    expect(await screen.findByRole('dialog')).toHaveAccessibleName('Cradle')
    expect(screen.getByText(/No screenshots in Apple/)).toBeInTheDocument()
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Preview Cradle' })).toHaveFocus()
  })
  it('shows a mobile drawer with an explicit close control', async () => {
    vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({ matches: query.includes('max-width: 639px'), media: query, onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() }))
    respond(); render(<App />); await search()
    fireEvent.click(screen.getByRole('button', { name: 'Preview Cradle' }))
    expect(await screen.findByRole('dialog')).toHaveAccessibleName('Cradle')
    expect(screen.getByRole('button', { name: 'Close app preview' })).toBeInTheDocument()
  })
  it('retains a visible failure instead of claiming an empty catalog', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: 'error', error: 'Apple is offline' }), { status: 502 })))
    render(<App />)
    fireEvent.change(screen.getByLabelText('App name'), { target: { value: 'Cradle' } })
    fireEvent.submit(screen.getByRole('button', { name: 'Search name' }).closest('form')!)
    expect(await screen.findByRole('alert')).toHaveTextContent('Apple is offline')
    expect(screen.queryByText('No public matches found.')).not.toBeInTheDocument()
  })
  it('supports searching and selecting a storefront with the keyboard', async () => {
    render(<App />); const user = userEvent.setup()
    await user.click(screen.getByRole('combobox', { name: /Storefront/ }))
    await user.type(screen.getByPlaceholderText('Country name or two-letter code…'), 'Japan')
    await user.keyboard('{ArrowDown}{Enter}')
    await waitFor(() => expect(screen.getByRole('combobox', { name: /Storefront/ })).toHaveTextContent('JP'))
  })
  it('cancels pending alternative checks when the search is cleared', async () => {
    const pending = vi.spyOn(searchClient, 'delay')
    const fetch = respond({ ...result, suggestions: [{ name: 'Nestling', kind: 'related word' }] } as typeof result)
    render(<App />); await search()
    await screen.findByText('Nestling')
    fireEvent.click(screen.getByRole('button', { name: 'Clear name' }))
    expect(screen.getByLabelText('App name')).toHaveFocus()
    expect(screen.getByText('Your next name starts here')).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(pending.mock.calls[0][1].aborted).toBe(true)
  })
})
