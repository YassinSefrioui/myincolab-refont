import { create } from 'zustand'

const getToken = () =>
    JSON.parse(localStorage.getItem('auth-storage') || '{}')?.state?.token ||
    localStorage.getItem('token') || ''

const useVoiceStore = create((set, get) => ({
    activeChannel: null, // { roomId, channelId, channelName, mode, type, projectId?, conversationId? }
    heartbeatInterval: null,

    joinChannel: async (type, projectId, conversationId, channelName, mode, roomIdOverride, explicitToken) => {
        // Leave current channel first
        const { activeChannel } = get()
        if (activeChannel) await get().leaveChannel()

        const token = explicitToken || getToken()
        const body = { type, name: roomIdOverride || channelName, mode }
        if (projectId)      body.projectId      = projectId
        if (conversationId) body.conversationId = conversationId

        const res = await fetch('/api/voice-channels/join', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify(body),
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.message || 'Failed to join channel')

        const channel = {
            roomId:      json.data.roomId,
            channelId:   json.data.channelId,
            channelName: json.data.name,
            mode:        json.data.mode,
            type,
            projectId,
            conversationId,
        }
        set({ activeChannel: channel })

        // Heartbeat every 30s
        const interval = setInterval(async () => {
            try {
                await fetch(`/api/voice-channels/${channel.roomId}/heartbeat`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${getToken()}` },
                })
            } catch {}
        }, 30000)
        set({ heartbeatInterval: interval })

        return json.data
    },

    leaveChannel: async () => {
        const { activeChannel, heartbeatInterval } = get()
        if (!activeChannel) return
        clearInterval(heartbeatInterval)
        set({ activeChannel: null, heartbeatInterval: null })
        try {
            await fetch(`/api/voice-channels/${activeChannel.roomId}/leave`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${getToken()}` },
            })
        } catch {}
    },
}))

export default useVoiceStore
