import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { AlertCircle, ChevronRight, Terminal, Sparkles, Info, LoaderCircle, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { CountryPicker } from '@/components/country-picker'
import { AppCard } from '@/components/app-preview'
import { Suggestions } from '@/components/suggestions'
import { lookup, queryURL, readQuery } from '@/lib/search'
import type { Platform, Query, SearchResult } from '@/lib/types'

export default function App() {
  const initial = useRef(readQuery())
  const [name, setName] = useState(initial.current.name)
  const [country, setCountry] = useState(initial.current.country)
  const [platform, setPlatform] = useState<Platform>(initial.current.platform)
  const [result, setResult] = useState<SearchResult | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [shown, setShown] = useState(8)
  const inputRef = useRef<HTMLInputElement>(null)
  const active = useRef<AbortController | null>(null)

  const search = useCallback(async (query: Query, push = true, focus = true) => {
    active.current?.abort()
    const controller = new AbortController()
    active.current = controller
    const clean = { ...query, name: query.name.trim(), country: query.country.toLowerCase() }
    setName(clean.name); setCountry(clean.country); setPlatform(clean.platform)
    setResult(null); setError(''); setShown(8)
    if (focus) inputRef.current?.focus({ preventScroll: true })
    if (!clean.name) { setLoading(false); return }
    if (clean.name.length < 2 || clean.name.length > 30 || !/[\p{L}\p{N}]/u.test(clean.name)) {
      setError('Enter a name with letters or numbers, 2–30 characters long.')
      setLoading(false)
      return
    }
    if (push) {
      const url = queryURL(clean)
      if (window.location.pathname + window.location.search !== url) window.history.pushState({}, '', url)
    }
    setLoading(true)
    try {
      const data = await lookup(clean.name, clean.country, clean.platform, controller.signal)
      if (!controller.signal.aborted) setResult(data)
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'The lookup could not be completed. Please try again.')
    } finally {
      if (active.current === controller) setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (initial.current.name) void search(initial.current, false, false)
    const restore = () => { void search(readQuery(), false, false) }
    window.addEventListener('popstate', restore)
    return () => { active.current?.abort(); window.removeEventListener('popstate', restore) }
  }, [search])

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void search({ name, country, platform })
  }
  function clear() {
    active.current?.abort()
    setName(''); setResult(null); setError(''); setLoading(false)
    if (window.location.search) window.history.pushState({}, '', '/')
    inputRef.current?.focus()
  }
  const status = result?.status === 'exact_match' ? 'Exact match found' : result?.status === 'similar_matches' ? 'Similar names found' : 'No public match'

  return <div className="site-shell">
    <header className="site-header"><a className="brand" href="/" aria-label="appname home"><span aria-hidden="true">a</span>appname</a><Button variant="ghost" asChild className="github-link"><a href="https://github.com/il-figlio/appname" target="_blank" rel="noopener noreferrer"><Terminal aria-hidden="true" />Get the CLI<ChevronRight className="size-3.5" aria-hidden="true" /></a></Button></header>
    <main>
      <section className="intro" aria-labelledby="page-title"><p className="eyebrow">App Store name finder</p><h1 id="page-title">Find a name for<br />your next app.</h1><p>Have a name in mind? See what’s already on the App Store, take a look around, and discover a few fresh ideas.</p></section>
      <section className="search-section" aria-label="Search the App Store">
        <Card className="search-card"><CardContent><form onSubmit={submit}>
          <label className="field-label" htmlFor="name">App name</label>
          <div className="search-line"><div className="name-field"><Input ref={inputRef} id="name" name="name" value={name} onChange={event => setName(event.target.value)} placeholder="e.g. Nestling" autoComplete="off" autoCapitalize="words" enterKeyHint="search" spellCheck={false} minLength={2} maxLength={30} required aria-describedby="catalog-notice" className="name-input" />{name && <Button variant="ghost" size="icon" type="button" className="clear-search" aria-label="Clear name" onClick={clear}><X /></Button>}</div><Button type="submit" disabled={loading} className="search-button">{loading ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Search aria-hidden="true" />}{loading ? 'Searching…' : 'Search name'}</Button></div>
          <div className="search-options"><div className="platform-field"><span className="option-label" id="platform-label">App Store</span><ToggleGroup type="single" value={platform} onValueChange={value => { if (value === 'ios' || value === 'mac') setPlatform(value) }} variant="outline" className="platform-toggle" aria-labelledby="platform-label"><ToggleGroupItem value="ios" aria-label="iPhone and iPad">iPhone & iPad</ToggleGroupItem><ToggleGroupItem value="mac" aria-label="Mac App Store">Mac</ToggleGroupItem></ToggleGroup></div><div className="country-field"><span className="option-label">Storefront</span><CountryPicker value={country} onChange={setCountry} /></div></div>
        </form></CardContent></Card>
        <p className="catalog-notice" id="catalog-notice"><Info className="size-4 shrink-0" aria-hidden="true" /><span><strong>A helpful first check.</strong> Reserved or unpublished names may be missing. Confirm your choice in App Store Connect.</span></p>
      </section>
      <section className="results-section" aria-label="Search results" aria-busy={loading}>
        {loading ? <div role="status" aria-label="Searching Apple’s catalog"><div className="loading-label"><LoaderCircle className="size-4 animate-spin" aria-hidden="true" />Searching Apple’s catalog…</div><div className="results-grid">{[0,1,2,3].map(key => <Card className="skeleton-card" key={key}><CardContent><div className="flex gap-3"><Skeleton className="size-12 shrink-0 rounded-lg" /><div className="flex-1 space-y-3"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-3 w-1/2" /></div></div><Skeleton className="mt-7 h-10 w-full" /></CardContent></Card>)}</div></div>
        : error ? <div className="error-state" role="alert"><AlertCircle className="size-5" aria-hidden="true" /><div><h2>The lookup didn’t finish.</h2><p>{error}</p></div></div>
        : result ? <>
          <div className="results-heading"><div><h2>{result.query}</h2><p>{result.platform === 'mac' ? 'Mac' : 'iPhone & iPad'} · {result.country.toUpperCase()} storefront · {result.results_scanned} catalog results scanned</p></div><Badge variant="outline" className={result.status === 'exact_match' ? 'status-exact' : ''}>{status}</Badge></div>
          {Boolean(result.suggestions?.length) && <Suggestions key={`${result.query}-${result.country}-${result.platform}-${result.checked_at}`} data={result} onExplore={query => { void search(query) }} />}
          {result.matches.length ? <><div className="results-grid">{result.matches.slice(0, shown).map(match => <AppCard key={match.id ?? match.name} match={match} />)}</div>{shown < result.matches.length && <div className="more-results"><Button type="button" variant="outline" onClick={() => setShown(value => value + 8)}>Show more matches ({result.matches.length - shown} remaining)</Button></div>}</> : <Card className="empty-card"><CardContent><h3>No public matches found.</h3><p>This search found no exact or similar titles. Reserved, unpublished, and region-limited names may be missing. Confirm your name in App Store Connect.</p></CardContent></Card>}
          {result.search_limit_reached && <p className="fine-print">Apple returned its 200-result limit. This search may be incomplete.</p>}
        </> : <div className="initial-state"><span className="initial-icon" aria-hidden="true"><Sparkles className="size-5" /></span><h2>Your next name starts here</h2><p>Try a name you like. We’ll help you see what’s out there.</p><Button type="button" variant="ghost" className="example-search" onClick={() => { void search({ name: 'Cradle', country, platform }) }}>Try a search<ChevronRight className="size-3.5" aria-hidden="true" /></Button></div>}
      </section>
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">{result ? `${result.matches.length} exact or similar titles found for ${result.query}. Name availability is unconfirmed.` : ''}</div>
    </main>
    <footer className="site-footer"><div><span>Prefer the terminal?</span><code>appname check "Your Name"</code></div><span>public catalog · no account required</span></footer>
  </div>
}
