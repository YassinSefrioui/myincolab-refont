import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const useAuthStore = create(
    persist(
        (set) => ({
            token: null,
            user: null,
            isAuthenticated: false,

            login: (token, user) => set({
                token,
                user: { ...user, id: user.userId },
                isAuthenticated: true
            }),

            logout: () => {
                localStorage.removeItem('token')
                localStorage.removeItem('user')
                set({ token: null, user: null, isAuthenticated: false })
            },

            updateUser: (user) => set({ user })
        }),
        {
            name: 'auth-storage',
            partialize: (state) => ({
                // Token is intentionally NOT persisted to localStorage — it is accessible
                // to JavaScript and would be stolen by any XSS. The HttpOnly cookie sent
                // by the backend is the authoritative auth transport for browser clients.
                user: state.user,
                isAuthenticated: state.isAuthenticated
            })
        }
    )
)

export default useAuthStore
