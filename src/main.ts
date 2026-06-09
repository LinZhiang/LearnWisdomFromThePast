import { createPinia } from 'pinia'
import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import App from './App.vue'
import router from './router'
import { APP_DESCRIPTION, APP_HTML_TITLE } from '@/constants/branding'
import { useAppearanceStore } from './stores/appearance'
import 'katex/dist/katex.min.css'
import './style.css'
import './styles/markdown-embed-images.css'
import './styles/page-focus-stretch.css'

document.title = APP_HTML_TITLE
const descEl = document.querySelector('meta[name="description"]')
if (descEl) descEl.setAttribute('content', APP_DESCRIPTION)

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)
app.use(ElementPlus)

const appearanceStore = useAppearanceStore(pinia)
appearanceStore.load()

app.mount('#app')
