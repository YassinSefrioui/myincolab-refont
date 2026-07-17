import React from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Shield } from 'lucide-react'

/**
 * Public privacy policy page — required by Apple App Store review.
 * No authentication needed.
 */
export default function PrivacyPage() {
    const lastUpdated = 'May 31, 2026'

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

            <main className="max-w-3xl mx-auto px-6 py-12">
                <div className="flex items-center gap-3 mb-2">
                    <Shield className="w-8 h-8" style={{ color: 'var(--accent-blue)' }} />
                    <h1 className="text-4xl font-bold" style={{ color: 'var(--text-primary)' }}>Privacy Policy</h1>
                </div>
                <p className="text-sm mb-10" style={{ color: 'var(--text-muted)' }}>
                    Last updated: {lastUpdated}
                </p>

                <div className="space-y-8" style={{ color: 'var(--text-secondary)' }}>
                    <Section title="1. Who we are">
                        <p>
                            MyIncolab ("we", "us", "our") provides a collaborative workspace for teams,
                            available on the web and as a mobile application. This Privacy Policy explains
                            how we collect, use, and protect your information when you use our services.
                        </p>
                        <p className="mt-2">
                            For any privacy-related question, you can reach us at{' '}
                            <a href="mailto:privacy@myincolab.com" className="underline" style={{ color: 'var(--accent-blue)' }}>
                                privacy@myincolab.com
                            </a>.
                        </p>
                    </Section>

                    <Section title="2. Information we collect">
                        <p>We collect only the information necessary to provide the service:</p>
                        <ul className="list-disc pl-6 mt-2 space-y-1">
                            <li><strong>Account data</strong>: email, first name, last name, role, profile photo (optional).</li>
                            <li><strong>Authentication</strong>: hashed password (using bcrypt), session tokens.</li>
                            <li><strong>User content</strong>: messages, files, documents, tasks, calendar events, comments, and announcements you create or share within your organization.</li>
                            <li><strong>Communication metadata</strong>: timestamps, read receipts, presence status.</li>
                            <li><strong>Device data</strong>: device type, OS version, app version, push notification tokens.</li>
                            <li><strong>Technical logs</strong>: IP address, request times, errors (kept for 30 days for security and debugging).</li>
                        </ul>
                        <p className="mt-2">
                            We <strong>do not</strong> collect: location data, contacts, biometric data, or advertising identifiers.
                            We <strong>do not</strong> use third-party analytics or advertising trackers.
                        </p>
                    </Section>

                    <Section title="3. How we use your information">
                        <p>We use your data exclusively to:</p>
                        <ul className="list-disc pl-6 mt-2 space-y-1">
                            <li>Authenticate you and keep your session secure.</li>
                            <li>Display your messages, files, projects, and tasks to other members of your organization.</li>
                            <li>Send push notifications you have opted into.</li>
                            <li>Provide voice/video call signaling between authorized participants.</li>
                            <li>Generate optional AI summaries of conversations (only when you tap "Summarize").</li>
                            <li>Debug crashes and improve the service.</li>
                        </ul>
                        <p className="mt-2">
                            We <strong>never</strong> sell, rent, or trade your personal data to third parties.
                        </p>
                    </Section>

                    <Section title="4. Who can see your data">
                        <ul className="list-disc pl-6 space-y-1">
                            <li>Members of <strong>your organization</strong> can see content you share in shared channels, projects, or documents.</li>
                            <li>Direct messages are visible only to the participants of that conversation.</li>
                            <li>Your organization administrators have access to administrative settings (user list, roles, audit log) but not to the content of private direct messages.</li>
                            <li>Our staff <strong>does not access</strong> your content unless you explicitly request support and grant temporary access in writing.</li>
                        </ul>
                    </Section>

                    <Section title="5. Storage and security">
                        <p>
                            Your data is stored on servers located in the European Union (Germany).
                            All connections use TLS 1.2+ encryption. Passwords are hashed with bcrypt
                            (cost factor 10). Files and avatars are stored in a private, access-controlled
                            object storage and require authentication to be retrieved.
                        </p>
                        <p className="mt-2">
                            Push notifications are delivered via Apple Push Notification service (APNs)
                            and Google Firebase Cloud Messaging (FCM). These providers receive only the
                            notification payload and device token, not the full content of your messages.
                        </p>
                    </Section>

                    <Section title="6. Optional AI features">
                        <p>
                            When you tap "Summarize" on a conversation, the recent messages are sent
                            to an AI provider (currently Anthropic Claude) for processing. The provider
                            does not retain your data for training, and the summary is returned to you
                            within seconds. If you do not use the Summarize feature, no message content
                            ever leaves our servers for AI processing.
                        </p>
                    </Section>

                    <Section title="7. Your rights">
                        <p>Under GDPR and similar laws, you have the right to:</p>
                        <ul className="list-disc pl-6 mt-2 space-y-1">
                            <li><strong>Access</strong> your personal data — email <a href="mailto:privacy@myincolab.com" className="underline" style={{ color: 'var(--accent-blue)' }}>privacy@myincolab.com</a> for an export.</li>
                            <li><strong>Rectify</strong> inaccurate data — edit your profile directly in the app.</li>
                            <li><strong>Delete</strong> your account — use the "Delete my account" option in Profile, or email us.</li>
                            <li><strong>Object</strong> to processing — email us to opt out of optional features.</li>
                            <li><strong>Data portability</strong> — request an export in JSON format.</li>
                        </ul>
                        <p className="mt-2">
                            Most requests are honored within 7 business days. To file a complaint, contact
                            your local Data Protection Authority.
                        </p>
                    </Section>

                    <Section title="8. Account deletion">
                        <p>
                            You can delete your account at any time from the app:
                        </p>
                        <p className="mt-2 pl-4 italic">
                            Profile → scroll to the bottom → "Delete my account" → confirm.
                        </p>
                        <p className="mt-2">
                            This permanently removes your personal information (email, name, photo, password,
                            push tokens). Messages you sent in shared channels are anonymized but retained,
                            so other participants still see the conversation history. Files you uploaded
                            into shared spaces remain accessible to authorized organization members,
                            unless your organization has configured otherwise.
                        </p>
                        <p className="mt-2">
                            For a complete erasure (including anonymized content), email{' '}
                            <a href="mailto:privacy@myincolab.com" className="underline" style={{ color: 'var(--accent-blue)' }}>privacy@myincolab.com</a>{' '}
                            from your registered address.
                        </p>
                    </Section>

                    <Section title="9. Children's privacy">
                        <p>
                            MyIncolab is a workplace tool not directed at children under 16. We do not
                            knowingly collect personal data from anyone under 16. If you become aware
                            that a child has provided us with personal information, please contact us
                            and we will delete it.
                        </p>
                    </Section>

                    <Section title="10. Changes to this policy">
                        <p>
                            We may update this Privacy Policy from time to time. The "Last updated" date
                            at the top reflects the most recent change. Significant changes will be
                            announced in-app or by email at least 14 days before they take effect.
                        </p>
                    </Section>

                    <Section title="11. Contact">
                        <p>
                            For any privacy question or to exercise your rights, contact:
                        </p>
                        <p className="mt-2 pl-4">
                            <strong>MyIncolab — Privacy</strong><br />
                            Email: <a href="mailto:privacy@myincolab.com" className="underline" style={{ color: 'var(--accent-blue)' }}>privacy@myincolab.com</a>
                        </p>
                    </Section>
                </div>

                <div className="text-center pt-12 mt-12 border-t" style={{ borderColor: 'var(--border-primary)' }}>
                    <div className="flex justify-center gap-6 text-sm">
                        <Link to="/support" className="hover:underline" style={{ color: 'var(--accent-blue)' }}>
                            Support
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

const Section = ({ title, children }) => (
    <section>
        <h2 className="text-xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>{title}</h2>
        <div className="leading-relaxed">{children}</div>
    </section>
)
