type CdnAssetType = 'theme' | 'grammar' | 'oniguruma'

type Cdn = string | ((type: CdnAssetType, id: string) => string)

export let CDN: Cdn = 'https://esm.sh'
const CACHE = {
  theme: {} as Record<string, Promise<any>>,
  grammar: {} as Record<string, Promise<any>>,
}

/**
 * Sets the CDN from which the theme/lang of <shiki-textarea/> is fetched.
 *
 * Accepts as arguments
 * - url: string
 * - callback: (type: 'lang' | 'theme' | 'oniguruma', id: string) => string
 *
 * When given an url, this will be used to fetch
 * - `${cdn}/tm-themes/themes/${theme}.json` for the `themes`
 * - `${cdn}/tm-grammars/grammars/${grammar}.json` for the `grammars`
 * - `${cdn}/vscode-oniguruma/release/onig.wasm` for the `oniguruma` wasm-file
 *
 * When given a callback, the returned string will be used to fetch.
 */
export function setCDN(cdn: Cdn) {
  CDN = cdn
}

export function urlFromCDN(type: CdnAssetType, key: string) {
  if (typeof CDN === 'function') {
    return CDN(type, key)
  }
  switch (type) {
    case 'theme':
      return `${CDN}/tm-themes/themes/${key}.json`
    case 'grammar':
      return `${CDN}/tm-grammars/grammars/${key}.json`
    case 'oniguruma':
      return `${CDN}/vscode-oniguruma/release/onig.wasm`
  }
}

export async function fetchFromCDN(type: 'theme' | 'grammar', key: string) {
  if (key in CACHE[type]) {
    return CACHE[type][key]
  }
  return (CACHE[type][key] = fetch(urlFromCDN(type, key))
    .then(response => (response.ok ? response.json() : null))
    .catch(console.error))
}
