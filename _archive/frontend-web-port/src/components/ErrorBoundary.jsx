import React from 'react'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'

/**
 * Top-level React error boundary.
 *
 * Without this, any uncaught render error inside the app tree produces a blank
 * white page — for 250 employees that means "the app is broken, what do I do".
 * With it, the user sees a clear message, the option to reload, and a way to
 * go back to the dashboard. The original error is also reported to console so
 * we can dig in via remote logs later (Sentry hookable via componentDidCatch).
 *
 * Class component is required — hooks can't replace componentDidCatch yet.
 */
export default class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props)
        this.state = { error: null, info: null }
    }

    static getDerivedStateFromError(error) {
        return { error }
    }

    componentDidCatch(error, info) {
        this.setState({ info })
        // Log raw error so it shows up in the browser console + any remote
        // logger we attach later (Sentry.captureException(error)).
        // eslint-disable-next-line no-console
        console.error('[ErrorBoundary] Caught:', error, info)
    }

    handleReload = () => {
        // Hard reload so we drop any corrupted state in stores/closures.
        window.location.reload()
    }

    handleGoHome = () => {
        // Reset error state + navigate. Using location for a fresh tree mount
        // so transient errors don't keep re-throwing on the same components.
        window.location.href = '/'
    }

    render() {
        if (!this.state.error) return this.props.children

        const message = this.state.error?.message || String(this.state.error)

        return (
            <div className="min-h-screen flex items-center justify-center p-4"
                 style={{ background: 'linear-gradient(135deg,#0f172a,#1e293b)' }}>
                <div className="max-w-md w-full bg-slate-900/90 border border-slate-700 rounded-2xl p-8 shadow-2xl">
                    <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-red-500/15 mb-4 mx-auto">
                        <AlertTriangle className="w-7 h-7 text-red-400" />
                    </div>
                    <h1 className="text-white text-xl font-bold text-center mb-2">
                        Something went wrong
                    </h1>
                    <p className="text-slate-400 text-sm text-center mb-6">
                        The page hit an unexpected error. Your data is safe.
                        Reload to try again, or go back to the dashboard.
                    </p>
                    {/* Show the actual error message in dev — keep it compact in prod
                        so the user isn't intimidated by a stack trace. */}
                    {import.meta.env.DEV && (
                        <pre className="text-[11px] text-red-300 bg-red-950/40 border border-red-900/40 rounded-lg p-3 mb-4 overflow-auto max-h-40 font-mono">
{message}
                        </pre>
                    )}
                    <div className="flex gap-2">
                        <button onClick={this.handleReload}
                                className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2.5 rounded-xl transition-colors">
                            <RefreshCw className="w-4 h-4" /> Reload
                        </button>
                        <button onClick={this.handleGoHome}
                                className="flex-1 flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2.5 rounded-xl transition-colors">
                            <Home className="w-4 h-4" /> Home
                        </button>
                    </div>
                </div>
            </div>
        )
    }
}
