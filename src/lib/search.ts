import type { Platform, SearchResult, Query } from './types'

export function safeURL(value: unknown, media = false): string | null {
  if (typeof value !== 'string') return null
  try {
    const url = new URL(value)
    const allowed = media
      ? url.hostname === 'mzstatic.com' || url.hostname.endsWith('.mzstatic.com')
      : ['apps.apple.com', 'itunes.apple.com'].includes(url.hostname)
    return url.protocol === 'https:' && !url.username && !url.password && allowed ? url.href : null
  } catch { return null }
}

export function readQuery(): Query {
  const params = new URLSearchParams(window.location.search)
  return { name: (params.get('name') || '').slice(0, 30),
    country: /^[a-z]{2}$/i.test(params.get('country') || '') ? params.get('country')!.toLowerCase() : 'us',
    platform: params.get('platform') === 'mac' ? 'mac' : 'ios' }
}

export function queryURL(query: Query): string {
  return '/?' + new URLSearchParams({ name: query.name, country: query.country, platform: query.platform })
}

export function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) return reject(new DOMException('Cancelled', 'AbortError'));
    const abort = () => { clearTimeout(timer); reject(new DOMException('Cancelled', 'AbortError')); };
    const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, ms);
    signal.addEventListener('abort', abort, {once: true});
  });
}

export async function lookup(name: string, country: string, platform: Platform, signal: AbortSignal): Promise<SearchResult> {
  for (let attempt = 0; attempt < 3; attempt++) {
    if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
    const controller = new AbortController();
    let timedOut = false;
    const cancel = () => controller.abort();
    signal.addEventListener('abort', cancel, {once: true});
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, 22000);
    let response, body;
    try {
      response = await fetch('/api/search?' + new URLSearchParams({name, country, platform}), {
        signal: controller.signal, headers: {Accept: 'application/json'}
      });
      try { body = await response.json(); }
      catch (error) {
        if (controller.signal.aborted) throw error;
        throw new Error('The search service returned an unexpected response. Please try again.');
      }
    } catch (error) {
      if (timedOut && !signal.aborted) throw new Error('The lookup took too long. Please try again.');
      throw error;
    } finally {
      clearTimeout(timer);
      signal.removeEventListener('abort', cancel);
    }
    if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
    if (response.status === 429 && attempt < 2) {
      const seconds = Number(response.headers.get('Retry-After'));
      await delay((Number.isFinite(seconds) ? Math.min(6, Math.max(1, seconds)) : 4) * 1000, signal);
      continue;
    }
    if (!body || typeof body !== 'object') throw new Error('The search service returned an unexpected response. Please try again.');
    if (!response.ok || body.status === 'error') throw new Error(body.error || 'The lookup could not be completed. Please try again.');
    if (!Array.isArray(body.matches) || !['exact_match', 'similar_matches', 'no_public_match'].includes(body.status)
      || typeof body.query !== 'string' || !/^[a-z]{2}$/i.test(body.country || '')
      || !['ios', 'mac'].includes(body.platform) || body.availability !== 'unconfirmed'
      || typeof body.results_scanned !== 'number'
      || body.matches.some((match: unknown) => !match || typeof match !== 'object' || typeof (match as { name?: unknown }).name !== 'string')) {
      throw new Error('The search service returned an unexpected response. Please try again.');
    }
    return body as SearchResult;
  }
  throw new Error("The catalog is busy. Please try again.");
}
