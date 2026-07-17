import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useRef } from 'react'
import { Toaster } from 'react-hot-toast'
import toast from 'react-hot-toast'
import useAuthStore from './store/authStore'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import ChatPage from './pages/ChatPage'
import ProjectsPage from './pages/ProjectsPage'
import TaskTemplatesPage from './pages/TaskTemplatesPage'
import ProfilePage from './pages/ProfilePage'
import AdminPage from './pages/AdminPage'
import SuperAdminPage from './pages/SuperAdminPage'
import DocumentsPage from './pages/DocumentsPage'
import GroupsPage from './pages/GroupsPage'
import GuestDashboard from './pages/GuestDashboard'
import CallLinkPage from './pages/CallLinkPage'
import CalendarPage from './pages/CalendarPage'
import AnnouncementsPage from './pages/AnnoucementsPage'
import ArchivedPage from './pages/ArchivedPage'
import TutorialPage from './pages/TutorialPage'
import SupportPage from './pages/SupportPage'
import PrivacyPage from './pages/PrivacyPage'
import ApkDownloadPage from './pages/ApkDownloadPage'
import Layout from './components/Layout'
import ErrorBoundary from './components/ErrorBoundary'

const IDLE_WARN_MS    = 25 * 60 * 1000
const IDLE_LOGOUT_MS  = 30 * 60 * 1000
const IDLE_EVENTS     = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click']

function IdleLogout() {
    const { isAuthenticated, logout } = useAuthStore()
    const warnTimer   = useRef(null)
    const logoutTimer = useRef(null)

    useEffect(() => {
        if (!isAuthenticated) return

        const reset = () => {
            clearTimeout(warnTimer.current)
            clearTimeout(logoutTimer.current)
            toast.dismiss('idle-warn')

            warnTimer.current = setTimeout(() => {
                toast('You will be logged out in 5 minutes due to inactivity.', {
                    id: 'idle-warn',
                    duration: 5 * 60 * 1000,
                    icon: '⚠️',
                })
            }, IDLE_WARN_MS)

            logoutTimer.current = setTimeout(() => {
                toast.dismiss('idle-warn')
                logout()
                toast('You were logged out due to inactivity.', { icon: '⏰', duration: 5000 })
            }, IDLE_LOGOUT_MS)
        }

        IDLE_EVENTS.forEach(e => document.addEventListener(e, reset, { passive: true }))
        reset()

        return () => {
            clearTimeout(warnTimer.current)
            clearTimeout(logoutTimer.current)
            toast.dismiss('idle-warn')
            IDLE_EVENTS.forEach(e => document.removeEventListener(e, reset))
        }
    }, [isAuthenticated])

    return null
}

// CODE MODIFIÉ POUR LE DEV 🔓
const ProtectedRoute = ({ children }) => {
    return children // Force l'accès direct
}

// CODE MODIFIÉ POUR LE DEV 🔓
const GuestRoute = ({ children }) => {
    return children // Force l'accès direct au Layout et au Dashboard
}

export default function App() {
    // ErrorBoundary wraps the entire router so a render bug anywhere in the
    // tree falls back to a recoverable screen instead of going white.
    return (
        <ErrorBoundary>
        <BrowserRouter>
            <IdleLogout />
            <Toaster position="top-right" />
            <Routes>
                {/* Public legal/help pages — must be reachable without authentication
                    so App Store reviewers and unauthenticated users can read them. */}
                <Route path="/support" element={<SupportPage />} />
                <Route path="/privacy" element={<PrivacyPage />} />
                <Route path="/apk" element={<ApkDownloadPage />} />

                <Route path="/login" element={<LoginPage />} />
                <Route path="/guest" element={<ProtectedRoute><GuestDashboard /></ProtectedRoute>} />
                <Route path="/" element={<GuestRoute><Layout /></GuestRoute>}>
                    <Route index element={<DashboardPage />} />
                    <Route path="chat" element={<ChatPage />} />
                    <Route path="projects" element={<ProjectsPage />} />
                    <Route path="tasks" element={<Navigate to="/projects" replace />} />
                    <Route path="documents" element={<DocumentsPage />} />
                    <Route path="groups" element={<GroupsPage />} />
                    <Route path="templates" element={<TaskTemplatesPage />} />
                    <Route path="profile" element={<ProfilePage />} />
                    <Route path="calendar" element={<CalendarPage />} />
                    <Route path="announcements" element={<AnnouncementsPage />} />
                    <Route path="archived" element={<ArchivedPage />} />
                    <Route path="tutorial" element={<TutorialPage />} />
                    <Route path="admin" element={<AdminPage />} />
                    <Route path="superadmin" element={<SuperAdminPage />} />
                </Route>
                <Route path="/call/:linkId" element={<CallLinkPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </BrowserRouter>
        </ErrorBoundary>
    )
}
