export type Platform = 'ios' | 'mac'
export type SearchStatus = 'exact_match' | 'similar_matches' | 'no_public_match'
export interface Query { name: string; country: string; platform: Platform }
export interface Match {
  id: number
  name: string
  developer: string
  match: 'exact' | 'similar'
  url: string
  preview?: { icon: string | null; screenshots: string[]; description: string; category: string; price: string }
}
export interface Candidate { name: string; kind: string }
export interface SearchResult {
  query: string
  country: string
  platform: Platform
  status: SearchStatus
  availability: 'unconfirmed'
  matches: Match[]
  checked_at: string
  results_scanned: number
  search_limit_reached: boolean
  suggestions?: Candidate[]
}
