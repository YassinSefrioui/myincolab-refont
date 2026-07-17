import { X, Mail, Shield, Clock, User, MessageSquare, Phone, Video } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { getAvatarUrl } from '../utils/avatarUrl'

const ROLE_COLOR = {
    SUPER_ADMIN: 'bg-red-500/20 text-red-300 border-red-500/30',
    ADMIN:       'bg-purple-500/20 text-purple-300 border-purple-500/30',
    MANAGER:     'bg-blue-500/20 text-blue-300 border-blue-500/30',
    EMPLOYEE:    'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    GUEST:       'bg-slate-500/20 text-slate-300 border-slate-500/30',
}
const PRESENCE_COLOR = {
    ONLINE:  'bg-emerald-400',
    AWAY:    'bg-amber-400',
    BUSY:    'bg-red-400',
    OFFLINE: 'bg-slate-500',
}

export default function UserProfileModal({ user, onClose, onMessage, onVoiceCall, onVideoCall }) {
    const { t } = useTranslation()
    if (!user) return null

    const initials = (user.fullName || user.displayName || '?')
        .split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()

    const hasActions = onMessage || onVoiceCall || onVideoCall

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4"
             onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-sm shadow-2xl">

                {/* Header / Avatar */}
                <div className="relative p-6 pb-4">
                    <button onClick={onClose}
                            className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-slate-700/50">
                        <X className="w-5 h-5" />
                    </button>

                    <div className="flex flex-col items-center text-center">
                        <div className="relative mb-4">
                            {user.profilePhotoUrl ? (
                                <img src={getAvatarUrl(user)} alt={user.fullName}
                                     className="w-20 h-20 rounded-full object-cover border-2 border-slate-600" />
                            ) : (
                                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center border-2 border-slate-600">
                                    <span className="text-white text-2xl font-bold">{initials}</span>
                                </div>
                            )}
                            {user.presenceStatus && (
                                <div className={`absolute bottom-1 right-1 w-4 h-4 rounded-full border-2 border-slate-800 ${PRESENCE_COLOR[user.presenceStatus] || PRESENCE_COLOR.OFFLINE}`} />
                            )}
                        </div>

                        <h2 className="text-xl font-bold text-white">{user.fullName || user.displayName}</h2>
                        {user.displayName && user.displayName !== user.fullName && (
                            <p className="text-sm text-slate-400 mt-0.5">{user.displayName}</p>
                        )}

                        {user.role && (
                            <span className={`mt-2 text-xs px-2.5 py-1 rounded-full border font-medium ${ROLE_COLOR[user.role] || ROLE_COLOR.EMPLOYEE}`}>
                                {user.role.replace('_', ' ')}
                            </span>
                        )}

                        {user.presenceStatus && (
                            <div className="flex items-center gap-1.5 mt-2">
                                <div className={`w-2 h-2 rounded-full ${PRESENCE_COLOR[user.presenceStatus] || PRESENCE_COLOR.OFFLINE}`} />
                                <span className="text-xs text-slate-400 capitalize">{user.presenceStatus.toLowerCase()}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Action buttons */}
                {hasActions && (
                    <div className="px-6 pb-4">
                        <div className="flex gap-2">
                            {onMessage && (
                                <button
                                    onClick={() => { onMessage(user); onClose() }}
                                    className="flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl bg-blue-600/15 hover:bg-blue-600/25 border border-blue-500/20 text-blue-400 transition-all"
                                >
                                    <MessageSquare className="w-4 h-4" />
                                    <span className="text-xs font-medium">{t('userProfile.message')}</span>
                                </button>
                            )}
                            {onVoiceCall && (
                                <button
                                    onClick={() => { onVoiceCall(user); onClose() }}
                                    className="flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl bg-green-600/15 hover:bg-green-600/25 border border-green-500/20 text-green-400 transition-all"
                                >
                                    <Phone className="w-4 h-4" />
                                    <span className="text-xs font-medium">{t('userProfile.voiceCall')}</span>
                                </button>
                            )}
                            {onVideoCall && (
                                <button
                                    onClick={() => { onVideoCall(user); onClose() }}
                                    className="flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl bg-purple-600/15 hover:bg-purple-600/25 border border-purple-500/20 text-purple-400 transition-all"
                                >
                                    <Video className="w-4 h-4" />
                                    <span className="text-xs font-medium">{t('userProfile.videoCall')}</span>
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* Info rows */}
                <div className="px-6 pb-6 space-y-3">
                    <div className="h-px bg-slate-700/50" />

                    {user.email && (
                        <div className="flex items-center gap-3 p-3 bg-slate-700/30 rounded-xl">
                            <Mail className="w-4 h-4 text-slate-400 flex-shrink-0" />
                            <div>
                                <p className="text-xs text-slate-500">{t('userProfile.email')}</p>
                                <p className="text-sm text-white">{user.email}</p>
                            </div>
                        </div>
                    )}

                    {user.status && (
                        <div className="flex items-center gap-3 p-3 bg-slate-700/30 rounded-xl">
                            <User className="w-4 h-4 text-slate-400 flex-shrink-0" />
                            <div>
                                <p className="text-xs text-slate-500">{t('userProfile.accountStatus')}</p>
                                <p className={`text-sm font-medium ${user.status === 'ACTIVE' ? 'text-emerald-400' : 'text-red-400'}`}>
                                    {user.status}
                                </p>
                            </div>
                        </div>
                    )}

                    {user.createdAt && (
                        <div className="flex items-center gap-3 p-3 bg-slate-700/30 rounded-xl">
                            <Clock className="w-4 h-4 text-slate-400 flex-shrink-0" />
                            <div>
                                <p className="text-xs text-slate-500">{t('userProfile.memberSince')}</p>
                                <p className="text-sm text-white">{new Date(user.createdAt).toLocaleDateString('en', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
