// Hash routing: works on GitHub Pages with no server rewrites.

import { useSyncExternalStore, type AnchorHTMLAttributes } from 'react'

const getPath = (): string => window.location.hash.replace(/^#/, '') || '/'

function subscribe(cb: () => void): () => void {
  window.addEventListener('hashchange', cb)
  return () => window.removeEventListener('hashchange', cb)
}

export const useRoute = (): string => useSyncExternalStore(subscribe, getPath)

export function navigate(to: string): void {
  window.location.hash = to
}

export function Link({ to, ...rest }: { to: string } & AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <a href={`#${to}`} {...rest} />
}
