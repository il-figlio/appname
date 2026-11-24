import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Search, LoaderCircle, Info, Sparkles, ChevronRight, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

type Mode = 'username' | 'domain'
type Row = { target: string; name: string; status: string; detail: string; source: string; checked_at: string }
const platforms = ['github', 'bluesky', 'npm', 'pypi']
const tlds = ['com', 'ai', 'io', 'sh', 'dev', 'app', 'bot', 'xyz', 'co', 'net', 'org', 'gg']
const names: Record<string,string> = {github:'GitHub',bluesky:'Bluesky',npm:'npm',pypi:'PyPI'}
const labels: Record<string,string> = {taken:'Record found',no_public_match:'No public record',unknown:'Unknown',rate_limited:'Rate limited',invalid:'Invalid name'}
export default function Namespace({mode}: {mode:Mode}) {
  const domain = mode === 'domain'
  const brand = domain ? 'domainname' : 'username'
  const options = domain ? tlds : platforms
  const [name,setName] = useState('')
  const [targets,setTargets] = useState(domain ? tlds.slice(0,8) : platforms)
  const [rows,setRows] = useState<Row[]>([])
  const [searched,setSearched] = useState('')
  const [error,setError] = useState('')
  const [busy,setBusy] = useState(false)
  const controller = useRef<AbortController|null>(null)
  useEffect(() => { document.title = brand + ' — Find your next ' + (domain?'address':'identity'); return () => controller.current?.abort() }, [brand,domain])
  async function search(value:string) {
    const clean = value.trim().toLowerCase().replace(/^@/,'')
    controller.current?.abort()
    const active = new AbortController()
    controller.current = active
    setRows([]);setError('');setSearched('');setBusy(true)
    try {
      const response = await fetch('/api/namespace?' + new URLSearchParams({mode,name:clean,targets:targets.join(',')}),{signal:active.signal})
      const data = await response.json()
      if (!response.ok || !Array.isArray(data.results)) throw new Error(data.error || 'Lookup failed.')
      if (!active.signal.aborted) {setRows(data.results);setSearched(clean)}
    } catch (e) { if (!active.signal.aborted) setError(e instanceof Error?e.message:'Lookup failed.') }
    finally { if (controller.current===active) setBusy(false) }
  }
  function submit(e:FormEvent<HTMLFormElement>) {e.preventDefault();void search(name)}
  return <div className="site-shell">
    <header className="site-header"><a className="brand" href={domain?'/domainname':'/username'}><span>{domain?'.':'@'}</span>{brand}</a><nav className="flex gap-3 text-xs"><a href="/">appname</a><a href={domain?'/username':'/domainname'}>{domain?'username':'domainname'}</a></nav></header>
    <main><section className="intro"><p className="eyebrow">{domain?'Domain name finder':'Public username finder'}</p><h1>Find your next<br/>{domain?'address.':'identity.'}</h1><p>{domain?'Explore your name across domain extensions before choosing where to build.':'Explore a name across social and developer namespaces before making it yours.'}</p></section>
    <section className="search-section"><Card className="search-card"><CardContent><form onSubmit={submit}><label className="field-label" htmlFor="namespace-name">{domain?'Domain label':'Username'}</label><div className="search-line"><div className="name-field"><Input id="namespace-name" className="name-input" value={name} onChange={e=>setName(e.target.value)} placeholder={domain?'e.g. nestling':'e.g. spezo'} maxLength={63} required autoCapitalize="none" autoComplete="off" spellCheck={false}/></div><Button className="search-button" type="submit" disabled={busy||!targets.length}>{busy?<LoaderCircle className="animate-spin"/>:<Search/>}{busy?'Searching…':'Search name'}</Button></div><div className="search-options"><span className="option-label">{domain?'Extensions':'Platforms'}</span><div className="flex flex-wrap gap-2">{options.map(t=><Button key={t} type="button" size="sm" variant={targets.includes(t)?'default':'outline'} aria-pressed={targets.includes(t)} onClick={()=>setTargets(old=>old.includes(t)?old.filter(x=>x!==t):[...old,t])}>{domain?'.'+t:names[t]}</Button>)}</div></div></form></CardContent></Card>
    <p className="catalog-notice"><Info className="size-4 shrink-0"/><span><strong>A helpful first check.</strong> No public record does not mean available. {domain?'Confirm registration and pricing with a registrar.':'Confirm claimability directly on the platform.'}</span></p></section>
    <section className="results-section" aria-busy={busy} aria-live="polite">{busy?<div className="loading-label"><LoaderCircle className="size-4 animate-spin"/>Checking public records…</div>:error?<div className="error-state"><AlertCircle/><div><h2>The lookup didn’t finish.</h2><p>{error}</p></div></div>:rows.length?<><div className="results-heading"><div><h2>{searched}</h2><p>{rows.length} namespaces checked · public records only</p></div></div><div className="results-grid">{rows.map(row=><Card key={row.target} className="app-card"><CardContent className="app-card-content"><div className="app-heading"><div className="app-icon icon-fallback">{domain?'.': '@'}</div><div><h3>{row.name}</h3><p>{domain?'.'+row.target:names[row.target]}</p></div></div><p className="listing-meta">{row.detail}</p><div className="flex flex-wrap items-center gap-2 mt-4"><Badge variant="outline">{labels[row.status]||'Unknown'}</Badge>{row.source&&<a className="text-xs underline" href={row.source} target="_blank" rel="noreferrer">Source</a>}</div></CardContent></Card>)}</div></>:<div className="initial-state"><span className="initial-icon"><Sparkles className="size-5"/></span><h2>Your next name starts here</h2><p>Try a name you like. We’ll help you see what’s out there.</p><Button variant="ghost" className="example-search" onClick={()=>{const example=domain?'nestling':'spezo';setName(example);void search(example)}} disabled={!targets.length}>Try a search<ChevronRight className="size-3.5"/></Button></div>}</section>
    </main><footer className="site-footer"><span>Part of the appname family</span><span>public records · no account required</span></footer></div>
}
