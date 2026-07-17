import { useEffect, useState } from 'react'
import { Download, Smartphone, ShieldAlert, ArrowRight, Apple } from 'lucide-react'

/**
 * Public APK download landing — no auth required so testers and pilot users
 * can grab the build by simply visiting /apk. The actual file is served by
 * nginx straight from /opt/incolab/public/downloads with a Content-Disposition
 * attachment header, so clicking the button kicks off a direct download
 * instead of opening the binary in the browser.
 */
const APK_URL     = '/downloads/incolab-latest.apk'
const APK_VERSION = '1.0.1 (build 8)'

export default function ApkDownloadPage() {
    const [size, setSize] = useState(null)

    // Best-effort HEAD to display the file size — purely cosmetic, so any
    // failure just hides the size hint rather than blocking the download.
    useEffect(() => {
        fetch(APK_URL, { method: 'HEAD' })
            .then(r => {
                const len = r.headers.get('content-length')
                if (len) setSize((Number(len) / 1024 / 1024).toFixed(1) + ' MB')
            })
            .catch(() => {})
    }, [])

    return (
        <div className="min-h-screen flex items-center justify-center p-6"
             style={{ background: 'var(--bg-secondary)' }}>
            <div className="w-full max-w-lg rounded-3xl border p-8 shadow-2xl"
                 style={{ background: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 rounded-2xl bg-blue-600/20 flex items-center justify-center">
                        <Smartphone className="w-6 h-6 text-blue-400" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
                            MyIncolab — Android App
                        </h1>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            Version {APK_VERSION}{size ? ` · ${size}` : ''}
                        </p>
                    </div>
                </div>

                <p className="text-sm mb-6 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    Install the MyIncolab Android app directly without going through the Play Store.
                    Use this build for internal testing and pilot users while the store listing is
                    under review.
                </p>

                <a
                    href={APK_URL}
                    download
                    className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-all shadow-lg shadow-blue-600/30"
                >
                    <Download className="w-5 h-5" />
                    Download APK
                </a>

                <div className="mt-6 rounded-2xl border p-4 text-xs"
                     style={{ background: 'var(--bg-input)', borderColor: 'var(--border-input)', color: 'var(--text-secondary)' }}>
                    <div className="flex items-center gap-2 font-semibold mb-2"
                         style={{ color: 'var(--text-primary)' }}>
                        <ShieldAlert className="w-4 h-4 text-amber-400" />
                        Android install steps
                    </div>
                    <ol className="space-y-1.5 list-decimal pl-5">
                        <li>Tap <strong>Download APK</strong>.</li>
                        <li>
                            When prompted, allow your browser (Chrome/Firefox) to install apps
                            from unknown sources: <em>Settings → Apps → Special access →
                            Install unknown apps → Chrome → Allow</em>.
                        </li>
                        <li>Open the downloaded file and tap <strong>Install</strong>.</li>
                        <li>Launch MyIncolab from the home screen and sign in.</li>
                    </ol>
                </div>

                <div className="mt-4 rounded-2xl border p-4 text-xs flex items-start gap-3"
                     style={{ background: 'var(--bg-input)', borderColor: 'var(--border-input)', color: 'var(--text-secondary)' }}>
                    <Apple className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                    <span>
                        iOS users: this APK is Android-only. The iOS build is distributed via
                        TestFlight during the pilot phase — request an invite at{' '}
                        <a href="mailto:support@myincolab.com" className="text-blue-400 hover:underline">
                            support@myincolab.com
                        </a>.
                    </span>
                </div>

                <a href="/" className="mt-6 inline-flex items-center gap-1.5 text-xs hover:underline"
                   style={{ color: 'var(--text-muted)' }}>
                    Back to MyIncolab
                    <ArrowRight className="w-3 h-3" />
                </a>
            </div>
        </div>
    )
}
