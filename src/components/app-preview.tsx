import { useState } from 'react'
import { ExternalLink, ImageOff, X, ChevronRight } from 'lucide-react'
import type { Match } from '@/lib/types'
import { safeURL } from '@/lib/search'
import { useMobile } from '@/hooks/use-mobile'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer'
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel'

export function AppIcon({ match }: { match: Match }) {
  const [failed, setFailed] = useState(false)
  const url = safeURL(match.preview?.icon, true)
  return url && !failed
    ? <img className="app-icon" src={url} alt="" width={48} height={48} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
    : <span className="app-icon icon-fallback" aria-hidden="true">{match.name.charAt(0).toUpperCase()}</span>
}

function PreviewBody({ match }: { match: Match }) {
  const [failed, setFailed] = useState<string[]>([])
  const screenshots = (match.preview?.screenshots || []).map(url => safeURL(url, true)).filter((url): url is string => Boolean(url) && !failed.includes(url!))
  const store = safeURL(match.url)
  return <div className="preview-body">
    {screenshots.length ? <Carousel opts={{ align: 'start', containScroll: 'trimSnaps' }} aria-label={`Screenshots for ${match.name}`}>
      <CarouselContent className="-ml-3">
        {screenshots.map((url, index) => <CarouselItem key={url} className="basis-auto pl-3">
          <a href={url} target="_blank" rel="noopener noreferrer" className="screenshot-link" aria-label={`Enlarge ${match.name} screenshot ${index + 1}`}>
            <img src={url} alt={`${match.name}, screenshot ${index + 1}`} className="preview-shot" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(current => [...current, url])} />
          </a>
        </CarouselItem>)}
      </CarouselContent>
      <div className="carousel-controls"><p>Swipe to browse · tap to enlarge</p><div><CarouselPrevious className="static size-11 translate-y-0" /><CarouselNext className="static size-11 translate-y-0" /></div></div>
    </Carousel> : <div className="preview-empty"><ImageOff className="size-5" aria-hidden="true" /><p>{failed.length ? 'Screenshots could not be loaded.' : 'No screenshots in Apple’s catalog for this listing.'}</p></div>}
    {match.preview?.description && <p className="listing-description">{match.preview.description}</p>}
    {store && <Button asChild className="store-action"><a href={store} target="_blank" rel="noopener noreferrer">Open in App Store <ExternalLink className="size-3.5" aria-hidden="true" /></a></Button>}
  </div>
}

function Preview({ match }: { match: Match }) {
  const mobile = useMobile()
  const [open, setOpen] = useState(false)
  const trigger = <Button type="button" variant="outline" className="preview-trigger" aria-label={`Preview ${match.name}`}>App preview <ChevronRight className="size-3.5" aria-hidden="true" /></Button>
  const meta = [match.developer, match.preview?.category, match.preview?.price].filter(Boolean).join(' · ')
  if (mobile) return <Drawer open={open} onOpenChange={setOpen}>
    <DrawerTrigger asChild>{trigger}</DrawerTrigger>
    <DrawerContent className="app-drawer">
      <DrawerHeader className="text-left"><div className="preview-heading"><AppIcon match={match} /><div className="min-w-0"><DrawerTitle>{match.name}</DrawerTitle><DrawerDescription>{meta}</DrawerDescription></div><DrawerClose asChild><Button variant="ghost" size="icon" className="size-11 shrink-0" aria-label="Close app preview"><X /></Button></DrawerClose></div></DrawerHeader>
      {open && <PreviewBody match={match} />}
    </DrawerContent>
  </Drawer>
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild>{trigger}</DialogTrigger>
    <DialogContent className="app-dialog sm:max-w-3xl">
      <DialogHeader className="pr-7"><div className="preview-heading"><AppIcon match={match} /><div className="min-w-0"><DialogTitle>{match.name}</DialogTitle><DialogDescription>{meta}</DialogDescription></div></div></DialogHeader>
      {open && <PreviewBody match={match} />}
    </DialogContent>
  </Dialog>
}

export function AppCard({ match }: { match: Match }) {
  const meta = [match.preview?.category, match.preview?.price].filter(Boolean).join(' · ')
  return <Card className="app-card">
    <CardContent className="app-card-content"><div className="app-heading"><AppIcon match={match} /><div className="min-w-0"><h3>{match.name}</h3><p>{match.developer || 'Developer not listed'}</p></div></div>{meta && <p className="listing-meta">{meta}</p>}</CardContent>
    <CardFooter className="app-card-footer"><Badge variant="outline" className={match.match === 'exact' ? 'status-exact' : ''}>{match.match === 'exact' ? 'Exact title' : 'Similar title'}</Badge><Preview match={match} /></CardFooter>
  </Card>
}
