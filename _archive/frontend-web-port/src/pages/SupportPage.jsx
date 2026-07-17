import React from 'react'
import { Link } from 'react-router-dom'
import { Mail, MessageSquare, BookOpen, ChevronRight, ArrowLeft } from 'lucide-react'

/**
 * Public support page — required by Apple App Store review.
 * No authentication needed (Apple reviewers must be able to access it).
 */
export default function SupportPage() {
    return (
        <div className="min-h-screen" style={{ background: 'var(--bg-primary)' }}>
            {/* Header */}
            <header className="border-b" style={{ borderColor: 'var(--border-primary)', background: 'var(--bg-secondary)' }}>
                <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
                    <Link to="/" className="flex items-center gap-2 text-sm hover:opacity-80" style={{ color: 'var(--text-secondary)' }}>
                        <ArrowLeft className="w-4 h-4" />
                        <span>Back to app</span>
                    </Link>
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--accent-blue)' }}>
                            <span className="text-white font-bold text-sm">M</span>
                        </div>
                        <span className="font-bold" style={{ color: 'var(--text-primary)' }}>MyIncolab</span>
                    </div>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-6 py-12">
                {/* Hero */}
                <div className="text-center mb-12">
                    <h1 className="text-4xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
                        How can we help?
                    </h1>
                    <p className="text-lg" style={{ color: 'var(--text-secondary)' }}>
                        We're here to help you get the most out of MyIncolab.
                    </p>
                </div>

                {/* Contact cards */}
                <div className="grid md:grid-cols-2 gap-4 mb-12">
                    <a
                        href="mailto:support@myincolab.com"
                        className="block p-6 rounded-xl border hover:scale-[1.02] transition-transform"
                        style={{ background: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}
                    >
                        <div className="flex items-start gap-4">
                            <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'var(--accent-blue)' + '22' }}>
                                <Mail className="w-6 h-6" style={{ color: 'var(--accent-blue)' }} />
                            </div>
                            <div className="flex-1">
                                <h3 className="font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Email us</h3>
                                <p className="text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>
                                    Get a personalized response within 24 hours
                                </p>
                                <p className="text-sm font-semibold" style={{ color: 'var(--accent-blue)' }}>
                                    support@myincolab.com
                                </p>
                            </div>
                            <ChevronRight className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                        </div>
                    </a>

                    <a
                        href="mailto:mahboub.zyadd@gmail.com"
                        className="block p-6 rounded-xl border hover:scale-[1.02] transition-transform"
                        style={{ background: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}
                    >
                        <div className="flex items-start gap-4">
                            <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#ef444422' }}>
                                <MessageSquare className="w-6 h-6" style={{ color: '#ef4444' }} />
                            </div>
                            <div className="flex-1">
                                <h3 className="font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Report a bug</h3>
                                <p className="text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>
                                    Tell us what's not working
                                </p>
                                <p className="text-sm font-semibold" style={{ color: '#ef4444' }}>
                                    mahboub.zyadd@gmail.com
                                </p>
                            </div>
                            <ChevronRight className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                        </div>
                    </a>
                </div>

                {/* FAQ */}
                <div className="mb-12">
                    <h2 className="text-2xl font-bold mb-6 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                        <BookOpen className="w-6 h-6" />
                        Frequently Asked Questions
                    </h2>

                    <div className="space-y-3">
                        {FAQ.map((item, i) => (
                            <details
                                key={i}
                                className="group rounded-xl border p-4"
                                style={{ background: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}
                            >
                                <summary className="cursor-pointer font-semibold flex items-center justify-between" style={{ color: 'var(--text-primary)' }}>
                                    <span>{item.q}</span>
                                    <ChevronRight className="w-5 h-5 transition-transform group-open:rotate-90" style={{ color: 'var(--text-muted)' }} />
                                </summary>
                                <p className="mt-3 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                                    {item.a}
                                </p>
                            </details>
                        ))}
                    </div>
                </div>

                {/* Other links */}
                <div className="text-center pt-8 border-t" style={{ borderColor: 'var(--border-primary)' }}>
                    <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
                        Looking for something else?
                    </p>
                    <div className="flex justify-center gap-6 text-sm">
                        <Link to="/privacy" className="hover:underline" style={{ color: 'var(--accent-blue)' }}>
                            Privacy Policy
                        </Link>
                        <Link to="/" className="hover:underline" style={{ color: 'var(--accent-blue)' }}>
                            Back to app
                        </Link>
                    </div>
                </div>
            </main>

            <footer className="border-t mt-12 py-6" style={{ borderColor: 'var(--border-primary)' }}>
                <p className="text-center text-xs" style={{ color: 'var(--text-muted)' }}>
                    © {new Date().getFullYear()} MyIncolab. All rights reserved.
                </p>
            </footer>
        </div>
    )
}

const FAQ = [
    {
        q: 'How do I create an account?',
        a: 'MyIncolab is currently used by teams. Your organization administrator will send you an invitation by email with credentials to log in. If you haven\'t received your invitation, please contact your administrator or reach out to support@myincolab.com.',
    },
    {
        q: 'I forgot my password — how do I reset it?',
        a: 'Contact your organization administrator. They can reset your password from the admin panel. If you are the administrator, contact support@myincolab.com and we will help you regain access.',
    },
    {
        q: 'How do I delete my account?',
        a: 'You can delete your account directly from the app: open the Profile tab, scroll to the bottom, tap "Delete my account", and confirm. This will permanently remove your personal data — messages you sent will be anonymized but kept for organization compliance.',
    },
    {
        q: 'Why can\'t I hear anyone in voice/video calls?',
        a: 'Make sure microphone and camera permissions are enabled (iOS: Settings → MyIncolab → Microphone/Camera). If the speaker is set to earpiece, tap the speaker icon in the call screen to switch to speakerphone. If the issue persists, try leaving and rejoining the call.',
    },
    {
        q: 'How do push notifications work?',
        a: 'You\'ll receive push notifications for new messages, mentions, task assignments, and announcements when the app is closed. You can manage which notifications you receive from Profile → Notifications.',
    },
    {
        q: 'Is my data encrypted?',
        a: 'Yes. All connections between the app and our servers use TLS encryption. Passwords are hashed with bcrypt. Files and avatars are stored in a secure, access-controlled object store and require authentication to be retrieved.',
    },
    {
        q: 'What languages are supported?',
        a: 'MyIncolab is available in English, French, Spanish, Italian, and Chinese. You can change the language from Profile → Language.',
    },
    {
        q: 'How do I switch between dark and light mode?',
        a: 'Go to Profile → Dark mode (or use the toggle in the side menu). Your preference is saved across sessions.',
    },
    {
        q: 'How do I export my data?',
        a: 'For a personal export of your data, please email support@myincolab.com from your registered address. We\'ll prepare an archive of your messages, files, and profile information within 7 business days.',
    },
    {
        q: 'Where can I leave feedback?',
        a: 'We love feedback! Send your suggestions, feature requests, or anything else to support@myincolab.com. We read every message.',
    },
]
