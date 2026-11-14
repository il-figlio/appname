'use strict';

const form = document.getElementById('search-form');
const results = document.getElementById('results');
const submit = document.getElementById('submit');
const buttonLabel = document.getElementById('button-label');
const announcement = document.getElementById('announcement');
let activeSearch = null;

function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

function safeURL(value, media = false) {
  try {
    const url = new URL(value);
    const allowed = media
      ? url.hostname === 'mzstatic.com' || url.hostname.endsWith('.mzstatic.com')
      : ['apps.apple.com', 'itunes.apple.com'].includes(url.hostname);
    return url.protocol === 'https:' && !url.username && !url.password && allowed ? url.href : null;
  } catch { return null; }
}

function showError(message) {
  const box = el('div', 'error');
  box.append(el('h3', '', 'The lookup didn’t finish.'), el('p', '', message));
  results.replaceChildren(box);
  announcement.textContent = message;
}

function image(url, alt, cls) {
  const img = el('img', cls);
  img.src = url;
  img.alt = alt;
  img.loading = 'lazy';
  img.decoding = 'async';
  img.referrerPolicy = 'no-referrer';
  return img;
}

function appCard(match) {
  const card = el('article', 'match-card');
  const head = el('div', 'app-head');
  const preview = match.preview || {};
  const iconURL = safeURL(preview.icon, true);
  if (iconURL) {
    const icon = image(iconURL, '', 'app-icon');
    icon.width = 48;
    icon.height = 48;
    icon.addEventListener('error', () => icon.remove(), {once: true});
    head.append(icon);
  }
  const title = el('div', 'app-title');
  title.append(el('h3', 'match-title', match.name), el('p', 'developer', match.developer || 'Developer not listed'));
  head.append(title);
  card.append(head);
  const meta = [preview.category, preview.price].filter(Boolean).join(' · ');
  if (meta) card.append(el('p', 'app-meta', meta));
  const details = el('details', 'app-preview');
  details.append(el('summary', '', 'App preview'));
  details.addEventListener('toggle', () => {
    if (!details.open || details.dataset.loaded) return;
    details.dataset.loaded = 'true';
    const shots = Array.isArray(preview.screenshots) ? preview.screenshots.map(url => safeURL(url, true)).filter(Boolean) : [];
    if (shots.length) {
      const rail = el('div', 'preview-rail');
      rail.tabIndex = 0;
      rail.setAttribute('role', 'region');
      rail.setAttribute('aria-label', `${match.name} screenshots. Scroll horizontally to see more.`);
      let remaining = shots.length;
      shots.forEach((url, index) => {
        const link = el('a', 'screenshot-link');
        link.href = url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        const shot = image(url, `${match.name}, screenshot ${index + 1}`, 'screenshot');
        shot.addEventListener('error', () => {
          link.remove();
          if (--remaining === 0) rail.replaceWith(el('p', 'preview-note', 'Screenshots could not be loaded. Open the App Store listing below to see more.'));
        }, {once: true});
        link.append(shot);
        rail.append(link);
      });
      details.append(rail, el('p', 'preview-note', 'Swipe or scroll to browse. Tap an image to enlarge.'));
    } else {
      details.append(el('p', 'preview-note', 'No screenshots were included in Apple’s catalog for this listing.'));
    }
    if (preview.description) {
      const description = el('p', 'app-description', preview.description);
      description.tabIndex = 0;
      details.append(description);
    }
  });
  card.append(details);
  const bottom = el('div', 'card-bottom');
  bottom.append(el('span', `badge${match.match === 'exact' ? ' exact' : ''}`, match.match === 'exact' ? 'Exact title' : 'Similar title'));
  const url = safeURL(match.url);
  if (url) {
    const link = el('a', 'store-link', 'App Store ↗');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.setAttribute('aria-label', `View ${match.name} on the App Store`);
    bottom.append(link);
  }
  card.append(bottom);
  return card;
}

function delay(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new DOMException('Cancelled', 'AbortError'));
    const abort = () => { clearTimeout(timer); reject(new DOMException('Cancelled', 'AbortError')); };
    const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, ms);
    signal.addEventListener('abort', abort, {once: true});
  });
}

async function lookup(name, country, platform, signal) {
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
    if (!response.ok || body.status === 'error') throw new Error(body.error || 'The lookup could not be completed. Please try again.');
    if (!Array.isArray(body.matches) || !['exact_match', 'similar_matches', 'no_public_match'].includes(body.status)) {
      throw new Error('The search service returned an unexpected response. Please try again.');
    }
    return body;
  }
}

function suggestionBox(data, signal) {
  if (!Array.isArray(data.suggestions) || !data.suggestions.length) return null;
  const section = el('section', 'suggestion-box');
  section.setAttribute('aria-label', 'Alternative name suggestions');
  section.append(el('p', 'eyebrow', '[ another direction ]'), el('h2', '', 'Same idea. A different name.'),
    el('p', 'suggestion-intro', 'An exact title showed up. Try a related word, a spelling twist, or a playful pairing. We’ll check three ideas at a time.'));
  const list = el('div', 'suggestion-list');
  const status = el('p', 'preview-note', 'Checking ideas against this storefront…');
  status.setAttribute('role', 'status');
  const more = el('button', 'suggest-more', 'Check more ideas');
  more.type = 'button';
  more.hidden = true;
  const suggestions = data.suggestions.slice(0, 6);
  let cursor = 0;
  async function checkNext() {
    more.hidden = true;
    const batch = suggestions.slice(cursor, cursor + 3);
    cursor += batch.length;
    for (const candidate of batch) {
      if (signal.aborted) return;
      const row = el('div', 'suggestion-row');
      const text = el('div', 'suggestion-name');
      text.append(el('strong', '', candidate.name), el('span', '', candidate.kind));
      const state = el('span', 'suggestion-state', 'Checking…');
      const use = el('button', 'suggest-use', 'Explore ↗');
      use.type = 'button';
      use.setAttribute('aria-label', `Search for ${candidate.name}`);
      use.addEventListener('click', () => {
        document.getElementById('name').value = candidate.name;
        document.getElementById('country').value = data.country.toUpperCase();
        form.elements.platform.value = data.platform;
        form.requestSubmit();
      });
      row.append(text, state, use);
      list.append(row);
      try {
        await delay(3200, signal);
        const check = await lookup(candidate.name, data.country, data.platform, signal);
        if (signal.aborted) return;
        state.textContent = check.status === 'no_public_match' ? 'No public match' : check.status === 'exact_match' ? 'Exact match found' : 'No exact match · similar names';
        if (check.status === 'no_public_match') row.classList.add('clear');
        if (check.search_limit_reached) state.textContent += ' · search capped';
      } catch (error) {
        if (signal.aborted) return;
        state.textContent = 'Check failed · try Explore';
      }
    }
    if (signal.aborted) return;
    status.textContent = 'Catalog checks only. No public match does not confirm that a name is available.';
    more.hidden = cursor >= suggestions.length;
  }
  more.addEventListener('click', checkNext);
  section.append(list, status, more);
  checkNext();
  return section;
}

function render(data, signal) {
  results.replaceChildren();
  const exact = data.status === 'exact_match';
  const heading = el('div', 'result-heading');
  const description = el('div');
  description.append(el('h2', '', data.query));
  const date = new Date(data.checked_at);
  const time = Number.isNaN(date.valueOf()) ? '' : ` · checked ${date.toLocaleTimeString([], {hour: 'numeric', minute: '2-digit'})}`;
  description.append(el('p', 'result-meta', `${data.platform === 'mac' ? 'Mac' : 'iPhone & iPad'} · ${data.country.toUpperCase()} storefront · ${data.results_scanned} catalog results scanned${time}`));
  heading.append(description, el('span', `badge${exact ? ' exact' : ''}`, exact ? 'Exact match found' : data.status === 'similar_matches' ? 'Similar names found' : 'No public match'));
  results.append(heading);
  const suggestions = suggestionBox(data, signal);
  if (suggestions) results.append(suggestions);
  if (!data.matches.length) {
    const box = el('div', 'empty');
    box.append(el('h3', '', 'No public matches found.'), el('p', '', 'Reserved, unpublished and region-limited names may be missing. Confirm the name in App Store Connect before committing to it.'));
    results.append(box);
  } else {
    const grid = el('div', 'grid');
    let shown = 0;
    const addMatches = () => {
      const end = Math.min(shown + 8, data.matches.length);
      for (; shown < end; shown++) grid.append(appCard(data.matches[shown]));
    };
    addMatches();
    results.append(grid);
    if (shown < data.matches.length) {
      const more = el('button', 'more', `Show more matches (${data.matches.length - shown} remaining)`);
      more.type = 'button';
      more.addEventListener('click', () => {
        addMatches();
        if (shown === data.matches.length) more.remove();
        else more.textContent = `Show more matches (${data.matches.length - shown} remaining)`;
      });
      results.append(more);
    }
  }
  if (data.search_limit_reached) results.append(el('p', 'cap-note', 'Apple returned its 200-result limit. This search may be incomplete.'));
  announcement.textContent = `${data.matches.length} exact or similar titles found for ${data.query}. Name availability is unconfirmed.`;
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  const data = new FormData(form);
  const name = String(data.get('name')).trim();
  const country = String(data.get('country')).toLowerCase();
  if (name.length < 2 || name.length > 30 || !/[\p{L}\p{N}]/u.test(name)) {
    if (activeSearch) activeSearch.abort();
    showError('Enter a name with letters or numbers, 2–30 characters long.');
    return;
  }
  if (activeSearch) activeSearch.abort();
  const current = new AbortController();
  activeSearch = current;
  submit.disabled = true;
  buttonLabel.textContent = 'Searching…';
  results.setAttribute('aria-busy', 'true');
  const loading = el('div', 'loading');
  loading.append(el('span', 'spinner'), el('span', '', 'Searching Apple’s catalog…'));
  results.replaceChildren(loading);
  announcement.textContent = 'Searching Apple’s catalog.';
  try {
    const body = await lookup(name, country, String(data.get('platform')), current.signal);
    if (!current.signal.aborted) render(body, current.signal);
  } catch (error) {
    if (!current.signal.aborted) showError(error.name === 'TimeoutError' ? 'The lookup took too long. Please try again.' : error.message || 'The search could not be completed.');
  } finally {
    if (activeSearch === current) {
      submit.disabled = false;
      buttonLabel.textContent = 'Search name';
      results.setAttribute('aria-busy', 'false');
    }
  }
});
