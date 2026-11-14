import { useMemo, useState } from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'

const popular = ['US', 'GB', 'CA', 'AU', 'DE', 'FR', 'IT', 'JP', 'IN', 'NZ', 'NL', 'ES', 'BR', 'MX', 'KR', 'CN', 'SG', 'SE', 'CH', 'ZA']
function countryName(code: string) {
  try { return new Intl.DisplayNames(['en'], { type: 'region' }).of(code) || code }
  catch { return code }
}

export function CountryPicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const code = value.toUpperCase()
  const codes = useMemo(() => [...new Set([code, ...popular])], [code])
  const custom = /^[A-Za-z]{2}$/.test(search.trim()) ? search.trim().toUpperCase() : null
  function choose(next: string) { onChange(next.toLowerCase()); setOpen(false); setSearch('') }
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild><Button type="button" variant="outline" role="combobox" aria-expanded={open} aria-label={`Storefront: ${countryName(code)} (${code})`} className="country-trigger"><span>{code}</span><ChevronsUpDown className="size-3.5 opacity-50" /></Button></PopoverTrigger>
    <PopoverContent className="w-[min(300px,calc(100vw-32px))] p-0" align="end"><Command>
      <CommandInput placeholder="Country name or two-letter code…" aria-label="Search storefronts" value={search} onValueChange={setSearch} />
      <CommandList><CommandEmpty>Enter a two-letter country code.</CommandEmpty><CommandGroup heading="Storefronts">
        {custom && !codes.includes(custom) && <CommandItem value={`${custom} ${countryName(custom)}`} onSelect={() => choose(custom)}>Use {custom} — {countryName(custom)}</CommandItem>}
        {codes.map(item => <CommandItem key={item} value={`${item} ${countryName(item)}`} onSelect={() => choose(item)}><Check className={`size-4 ${item === code ? 'opacity-100' : 'opacity-0'}`} /><span>{countryName(item)}</span><span className="ml-auto font-mono text-xs text-muted-foreground">{item}</span></CommandItem>)}
      </CommandGroup></CommandList>
    </Command></PopoverContent>
  </Popover>
}
