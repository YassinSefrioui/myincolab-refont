import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const useThemeStore = create(
    persist(
        (set, get) => ({
            theme: 'light', // 'dark' | 'light' — la refonte Compass est claire par défaut

            toggleTheme: () => {
                const next = get().theme === 'dark' ? 'light' : 'dark'
                set({ theme: next })
                applyTheme(next)
            },

            setTheme: (theme) => {
                set({ theme })
                applyTheme(theme)
            },

            initTheme: () => {
                applyTheme(get().theme)
            },
        }),
        {
            name: 'incolab-theme',
            partialize: (state) => ({ theme: state.theme }),
        }
    )
)

function applyTheme(theme) {
    const root = document.documentElement
    if (theme === 'light') {
        root.setAttribute('data-theme', 'light')
    } else {
        root.removeAttribute('data-theme')
    }
}

export default useThemeStore
