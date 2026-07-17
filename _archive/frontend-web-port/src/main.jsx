import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import useThemeStore from './store/themeStore.js'

// ✅ Apply saved theme before first render (prevents flash)
useThemeStore.getState().initTheme()

createRoot(document.getElementById('root')).render(
    <StrictMode>
        <App />
    </StrictMode>,
)
