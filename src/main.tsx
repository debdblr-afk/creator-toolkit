import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import '@fontsource-variable/inter/index.css'
import '@fontsource-variable/bricolage-grotesque/index.css'
import '@fontsource/anton/400.css'
import '@fontsource/bebas-neue/400.css'
import '@fontsource/archivo-black/400.css'

import './styles/base.css'
import './styles/plan.css'
import './styles/script.css'
import './styles/produce.css'
import './styles/publish.css'
import './styles/grow.css'

import App from './App'
import { initStore } from './lib/store'

const root = document.getElementById('root')

if (root) {
  // Load saved data before the first render so every tool can read it synchronously.
  initStore().finally(() => {
    createRoot(root).render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
  })
}
