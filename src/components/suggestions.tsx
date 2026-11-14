import { useEffect, useRef, useState } from 'react'
import { ChevronRight, LoaderCircle, Sparkles } from 'lucide-react'
import type { Candidate, Query, SearchResult, SearchStatus } from '@/lib/types'
import { delay, lookup } from '@/lib/search'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

type Checked = Candidate & { status: SearchStatus | 'checking' | 'error'; capped?: boolean }
export function Suggestions({ data, onExplore }: { data: SearchResult; onExplore: (query: Query) => void }) {
  const [rows, setRows] = useState<Checked[]>([])
  const [count, setCount] = useState(3)
  const [busy, setBusy] = useState(true)
  const cache = useRef(new Map<string, Checked>())
  useEffect(() => {
    const controller = new AbortController()
    const candidates = (data.suggestions || []).slice(0, count)
    setBusy(true)
    async function check() {
      for (const candidate of candidates) {
        if (controller.signal.aborted) return
        if (cache.current.has(candidate.name)) continue
        setRows(current => [...current.filter(item => item.name !== candidate.name), { ...candidate, status: 'checking' }])
        let row: Checked
        try {
          await delay(3200, controller.signal)
          const result = await lookup(candidate.name, data.country, data.platform, controller.signal)
          if (controller.signal.aborted) return
          row = { ...candidate, status: result.status, capped: result.search_limit_reached }
        } catch {
          if (controller.signal.aborted) return
          row = { ...candidate, status: 'error' }
        }
        cache.current.set(candidate.name, row)
        setRows(current => current.map(item => item.name === row.name ? row : item))
      }
      if (!controller.signal.aborted) setBusy(false)
    }
    void check()
    return () => controller.abort()
  }, [data, count])
  const labels = { checking: 'Checking…', error: 'Check failed', exact_match: 'Exact match found', similar_matches: 'No exact match · similar names', no_public_match: 'No public match' }
  return <Card className="suggestion-card" role="region" aria-label="Alternative name suggestions"><CardHeader><p className="eyebrow"><Sparkles className="size-3.5" aria-hidden="true" /> A little inspiration</p><CardTitle><h2>A few more names to try</h2></CardTitle><p className="muted-copy">An exact title came up. Here are some related words and playful twists, checked three at a time.</p></CardHeader>
    <CardContent><div className="suggestion-list">{rows.map(row => <div className="suggestion-row" key={row.name}><div className="suggestion-name"><strong>{row.name}</strong><span>{row.kind}</span></div><Badge variant="outline" className={row.status === 'no_public_match' ? 'status-clear' : ''}>{row.status === 'checking' && <LoaderCircle className="size-3 animate-spin" aria-hidden="true" />}{labels[row.status]}{row.capped ? ' · capped' : ''}</Badge><Button type="button" variant="ghost" className="explore-button" aria-label={`Search for ${row.name}`} onClick={() => onExplore({ name: row.name, country: data.country, platform: data.platform })}>Explore <ChevronRight className="size-3.5" aria-hidden="true" /></Button></div>)}</div>
    <p role="status" className="fine-print">{busy ? 'Checking ideas against this storefront…' : 'Catalog checks only. No public match does not confirm availability.'}</p>
    {!busy && count < (data.suggestions?.length || 0) && <Button type="button" variant="outline" onClick={() => setCount(value => value + 3)}>Check more ideas</Button>}
    </CardContent></Card>
}
