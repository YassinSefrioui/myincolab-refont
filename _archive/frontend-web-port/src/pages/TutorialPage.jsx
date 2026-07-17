import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import useAuthStore from '../store/authStore'
import gsap from 'gsap'
import {
    GraduationCap, ChevronRight, ChevronDown, CheckCircle2, Circle,
    Home, MessageSquare, FolderOpen, FileText, Users, Calendar,
    Megaphone, Archive, User, Shield, ShieldCheck, Sparkles,
    Search, Mic, Video, Phone, Monitor, Bell, Globe, Moon, Sun,
    Layers, Plus, Upload, Star, Eye, Download, Pin, Zap, Lock,
    BarChart2, Clock, Hash, AtSign, Paperclip, Languages, Volume2,
    BookOpen, GitBranch, Settings, Bookmark, CheckSquare, AlertTriangle,
    Play, ArrowRight, Info, Lightbulb, Keyboard
} from 'lucide-react'

// ─── Tutorial data ────────────────────────────────────────────────────────────

const ROLE_META = {
    EMPLOYEE:    { label: 'Employee',    color: 'bg-blue-500/20 text-blue-300 border-blue-500/30',    icon: User },
    MANAGER:     { label: 'Manager',     color: 'bg-purple-500/20 text-purple-300 border-purple-500/30', icon: Users },
    ADMIN:       { label: 'Admin',       color: 'bg-amber-500/20 text-amber-300 border-amber-500/30',  icon: Shield },
    SUPER_ADMIN: { label: 'Super Admin', color: 'bg-rose-500/20 text-rose-300 border-rose-500/30',    icon: ShieldCheck },
    GUEST:       { label: 'Guest',       color: 'bg-slate-500/20 text-slate-300 border-slate-500/30', icon: User },
}

// Steps visible per role (additive: MANAGER sees EMPLOYEE + MANAGER steps, etc.)
const STEPS = {

    // ── Shared for all standard users ────────────────────────────────────────
    COMMON: [
        {
            id: 'welcome',
            section: 'Getting Started',
            sectionIcon: GraduationCap,
            icon: Home,
            color: 'from-blue-600 to-blue-800',
            title: 'Welcome to INCO LAB',
            subtitle: 'Your all-in-one collaboration platform',
            description: 'INCO LAB brings together messaging, projects, documents, calendar, and real-time calls in one place. This guide will walk you through everything available to you.',
            features: [
                { icon: MessageSquare, title: 'Chat & Calls', desc: 'Direct messages, group chats, voice and video calls' },
                { icon: FolderOpen,    title: 'Projects',     desc: 'Tasks, deadlines, team collaboration' },
                { icon: FileText,      title: 'Documents',    desc: 'Upload, organize and preview files' },
                { icon: Calendar,      title: 'Calendar',     desc: 'Schedule meetings and events' },
                { icon: Users,         title: 'Groups',       desc: 'Team channels with voice rooms' },
                { icon: Sparkles,      title: 'AI Assistant', desc: 'Your intelligent work companion' },
            ],
            tips: [
                'Use the sidebar (desktop) or bottom bar (mobile) to navigate',
                'Press Ctrl+K (or ⌘K on Mac) to search anything instantly',
            ],
            action: null,
        },
        {
            id: 'navigation',
            section: 'Getting Started',
            sectionIcon: GraduationCap,
            icon: Bookmark,
            color: 'from-slate-600 to-slate-800',
            title: 'Navigation & Layout',
            subtitle: 'Find your way around',
            description: 'The sidebar on the left (desktop) or the bottom bar (mobile) is your main navigation. A persistent header lets you search globally and view notifications.',
            features: [
                { icon: Search,   title: 'Global Search',     desc: 'Ctrl+K — search tasks, files, people, chats, all at once' },
                { icon: Bell,     title: 'Notifications',     desc: 'Bell icon shows unread count; click to see all' },
                { icon: Sparkles, title: 'AI Assistant',      desc: 'Click "AI Assistant" in sidebar for an intelligent helper' },
                { icon: Globe,    title: 'World Clock',       desc: 'Sidebar bottom shows configured company timezones' },
                { icon: Moon,     title: 'Light / Dark Mode', desc: 'Toggle theme in your Profile page' },
                { icon: Languages,title: 'Language',          desc: '5 interface languages available in Profile' },
            ],
            tips: [
                'On mobile, swipe from the left edge or tap the ☰ menu to open the sidebar',
                'The World Clock auto-updates every second — great for remote teams',
            ],
            action: null,
        },
        {
            id: 'chat',
            section: 'Communication',
            sectionIcon: MessageSquare,
            icon: MessageSquare,
            color: 'from-emerald-600 to-emerald-800',
            title: 'Chat & Messaging',
            subtitle: 'Stay connected with your team',
            description: 'Chat supports direct messages and group conversations with rich features: file sharing, @mentions, message pinning, read receipts, and real-time translation.',
            features: [
                { icon: AtSign,    title: '@Mentions',         desc: 'Type @ in any message to notify a specific person' },
                { icon: Paperclip, title: 'File Attachments',  desc: 'Drag & drop, paste, or click the clip icon to share files' },
                { icon: Pin,       title: 'Pin Messages',      desc: 'Right-click or hover a message → Pin to save important info' },
                { icon: Languages, title: 'Translate',         desc: 'Hover a message → Translate to EN/FR/ES/ZH/IT instantly' },
                { icon: Eye,       title: 'Read Receipts',     desc: 'See who has read your messages with avatar indicators' },
                { icon: Hash,      title: 'Group Chats',       desc: 'Create named group conversations for teams or topics' },
            ],
            tips: [
                'Press Enter to send, Shift+Enter for a new line',
                'Hover over any message to reveal the action toolbar',
                'You can attach multiple files in one message',
            ],
            action: { label: 'Open Chat', path: '/chat' },
        },
        {
            id: 'calls',
            section: 'Communication',
            sectionIcon: MessageSquare,
            icon: Phone,
            color: 'from-teal-600 to-teal-800',
            title: 'Voice & Video Calls',
            subtitle: 'Real-time communication',
            description: 'Start 1-on-1 voice or video calls directly from a chat conversation, or join group voice channels from Groups. The platform uses mediasoup SFU for reliable multi-party calls.',
            features: [
                { icon: Phone,    title: '1-on-1 Calls',       desc: 'Click the phone icon in any direct message to call' },
                { icon: Video,    title: 'Video Calls',        desc: 'Click the video icon for face-to-face conversations' },
                { icon: Volume2,  title: 'Group Voice',        desc: 'Join persistent voice rooms from Groups or Calendar events' },
                { icon: Monitor,  title: 'Screen Sharing',     desc: 'Share your screen during any call — click the monitor icon' },
                { icon: Mic,      title: 'Noise Suppression',  desc: 'DTLN AI filters background noise automatically' },
                { icon: Settings, title: 'Audio Settings',     desc: 'Switch microphone or speaker mid-call from the toolbar' },
            ],
            tips: [
                'You can minimize a call to a floating bar while working in other tabs',
                'Pin a participant\'s video to make it the main view',
                'Noise suppression activates ~2 seconds after the call connects',
            ],
            action: { label: 'Go to Chat', path: '/chat' },
        },
        {
            id: 'projects',
            section: 'Work',
            sectionIcon: FolderOpen,
            icon: FolderOpen,
            color: 'from-orange-600 to-orange-800',
            title: 'Projects',
            subtitle: 'Organize and track your work',
            description: 'Projects are the main unit of work. Each project has its own chat, task board, file folder, decision log, and voice room. Create one for every initiative or client.',
            features: [
                { icon: Plus,         title: 'Create Project',  desc: 'Click "New Project" — give it a name, dates, and team members' },
                { icon: CheckSquare,  title: 'Task Board',      desc: 'Kanban columns: TODO → IN PROGRESS → REVIEW → DONE' },
                { icon: CheckCircle2, title: 'Complete Project', desc: 'Creator/Admin can mark a project COMPLETED (green badge)' },
                { icon: AlertTriangle,title: 'Overdue Projects', desc: 'Projects past their end date automatically turn red — OVERDUE' },
                { icon: GitBranch,    title: 'Linked Projects',  desc: 'Chain projects together to inherit tasks and history' },
                { icon: BookOpen,     title: 'Decision Log',     desc: 'Record important project decisions with context and rationale' },
            ],
            tips: [
                'Click any project card to enter its detail view with all tabs',
                'The Chat tab inside a project is private to its members',
                'Assign a due date so the system tracks overdue status automatically',
            ],
            action: { label: 'Open Projects', path: '/projects' },
        },
        {
            id: 'documents',
            section: 'Work',
            sectionIcon: FolderOpen,
            icon: FileText,
            color: 'from-cyan-600 to-cyan-800',
            title: 'Documents & Files',
            subtitle: 'Your team file system',
            description: 'Upload any file type into an organized folder structure. Preview images, PDFs, videos, audio, and code files directly in the browser without downloading.',
            features: [
                { icon: Upload,   title: 'Upload Files',    desc: 'Drag files onto the page, paste from clipboard, or click Browse' },
                { icon: FolderOpen, title: 'Folders',       desc: 'Create nested folders to organize by project, team, or type' },
                { icon: Eye,      title: 'Preview',         desc: 'Images, PDFs, videos, audio, and text files open in-browser' },
                { icon: Star,     title: 'Star Files',      desc: 'Star important files for quick access' },
                { icon: Search,   title: 'Filter & Search', desc: 'Filter by file type, size range, date range, or source' },
                { icon: Archive,  title: 'Archive',         desc: 'Archive files/folders without deleting — restore any time' },
            ],
            tips: [
                'Use the Filters panel to find files by type (PDF, image, video…) or date',
                'Folder access can be restricted to specific groups or users',
                'Archived items appear in the Archived page for recovery',
            ],
            action: { label: 'Open Documents', path: '/documents' },
        },
        {
            id: 'calendar',
            section: 'Work',
            sectionIcon: FolderOpen,
            icon: Calendar,
            color: 'from-violet-600 to-violet-800',
            title: 'Calendar',
            subtitle: 'Schedule meetings and events',
            description: 'Create and manage events visible to your team. Switch between Month, Week, 3-Day, and Day views. The calendar is timezone-aware — everyone sees events in their local time.',
            features: [
                { icon: Plus,        title: 'New Event',       desc: 'Click any day or "New Event" — set type, time, participants' },
                { icon: Users,       title: 'Invite People',   desc: 'Add participants by name — they get notified automatically' },
                { icon: Phone,       title: 'Join from Event', desc: 'MEETING/CALL/VIDEO_CALL events show a "Join Call" button' },
                { icon: Calendar,    title: '4 View Modes',    desc: 'Month overview, Week grid, 3-Day, or Day timeline' },
                { icon: Globe,       title: 'Timezone Aware',  desc: 'Your timezone shows on every event; others see their own' },
                { icon: CheckSquare, title: 'Edit Events',     desc: 'Click the pencil icon — change type, time, participants' },
            ],
            tips: [
                'Click a day cell in Month view to open its event panel on the right',
                'Linking a calendar event to a project helps keep timelines aligned',
                'EVENT types CALL and VIDEO_CALL launch directly into the voice/video channel',
            ],
            action: { label: 'Open Calendar', path: '/calendar' },
        },
        {
            id: 'groups',
            section: 'Work',
            sectionIcon: FolderOpen,
            icon: Users,
            color: 'from-pink-600 to-pink-800',
            title: 'Groups',
            subtitle: 'Team channels and voice rooms',
            description: 'Groups are persistent team spaces with member lists, subgroups, and voice channels. Great for departments, squads, or recurring meeting rooms.',
            features: [
                { icon: Plus,     title: 'Create Group',   desc: 'Name your group, add an optional description, invite members' },
                { icon: Users,    title: 'Subgroups',      desc: 'Create nested subgroups within a parent group' },
                { icon: Volume2,  title: 'Voice Channel',  desc: 'Each group has a persistent voice room — click Join to enter' },
                { icon: User,     title: 'Member Roles',   desc: 'Assign Manager role to a group member for admin rights' },
                { icon: Archive,  title: 'Archive Group',  desc: 'Archive groups you no longer need — data is preserved' },
                { icon: Calendar, title: 'Schedule Calls', desc: 'Link calendar events to group voice channels' },
            ],
            tips: [
                'Subgroup members must be a subset of the parent group',
                'You can join a group voice channel from the group card directly',
            ],
            action: { label: 'Open Groups', path: '/groups' },
        },
        {
            id: 'announcements',
            section: 'Information',
            sectionIcon: Megaphone,
            icon: Megaphone,
            color: 'from-yellow-600 to-yellow-800',
            title: 'Announcements',
            subtitle: 'Company-wide messages',
            description: 'The Announcements page shows official messages from your company (and from INCO LAB platform). Each announcement has an urgency level (High / Medium / Low) and may include attachments.',
            features: [
                { icon: AlertTriangle, title: 'Urgency Levels', desc: 'High (red), Medium (orange), Low (green) — sorted by priority' },
                { icon: Paperclip,     title: 'Attachments',    desc: 'Announcements can include downloadable file attachments' },
                { icon: Globe,         title: 'Platform Level', desc: 'INCOLAB announcements come from the platform team' },
                { icon: Users,         title: 'Company Level',  desc: 'Your Admin posts messages for your company or specific groups' },
            ],
            tips: [
                'Check Announcements regularly for policy updates and platform news',
                'Urgent announcements (High) appear at the top of the list',
            ],
            action: { label: 'Open Announcements', path: '/announcements' },
        },
        {
            id: 'archived',
            section: 'Information',
            sectionIcon: Megaphone,
            icon: Archive,
            color: 'from-slate-600 to-slate-800',
            title: 'Archived Items',
            subtitle: 'Nothing is permanently lost',
            description: 'When you archive a project, task, group, folder, or file — it is moved here. You can restore or permanently delete it at any time.',
            features: [
                { icon: FolderOpen,   title: 'Projects',      desc: 'Restore archived projects with all their data intact' },
                { icon: CheckSquare,  title: 'Tasks',         desc: 'Archived tasks from all your projects' },
                { icon: Users,        title: 'Groups',        desc: 'Reactivate dormant group channels' },
                { icon: FileText,     title: 'Files & Folders', desc: 'Recover any accidentally archived document' },
                { icon: MessageSquare, title: 'Conversations', desc: 'Reopen archived chat conversations' },
            ],
            tips: [
                'Archiving is safe — it hides items without deleting data',
                'Use Archive to keep your workspace clean without losing history',
            ],
            action: { label: 'Open Archived', path: '/archived' },
        },
        {
            id: 'profile',
            section: 'Your Account',
            sectionIcon: User,
            icon: User,
            color: 'from-indigo-600 to-indigo-800',
            title: 'Your Profile',
            subtitle: 'Personalise your experience',
            description: 'Your Profile page is where you control your personal settings: photo, display name, status, language, theme, and security settings.',
            features: [
                { icon: User,      title: 'Profile Photo',  desc: 'Upload a photo — visible in chat, calls, and avatars everywhere' },
                { icon: Globe,     title: 'Language',       desc: 'Switch between English, French, Spanish, Chinese, Italian' },
                { icon: Moon,      title: 'Dark / Light',   desc: 'Toggle the app theme to suit your preference' },
                { icon: Zap,       title: 'Presence Status', desc: 'Set Online / Away / Busy — teammates see this on your avatar' },
                { icon: Lock,      title: 'Change Password', desc: 'Update your password from the Security section' },
                { icon: Clock,     title: 'Do Not Disturb',  desc: 'Schedule DND hours to mute notifications automatically' },
            ],
            tips: [
                'Your presence status is broadcast live to all colleagues',
                'Setting your status to Busy reduces incoming call pop-ups',
            ],
            action: { label: 'Open Profile', path: '/profile' },
        },
        {
            id: 'ai',
            section: 'Your Account',
            sectionIcon: User,
            icon: Sparkles,
            color: 'from-purple-600 to-purple-800',
            title: 'AI Assistant',
            subtitle: 'Your intelligent work companion',
            description: 'The AI Assistant is available in the sidebar. Ask it anything — summarize documents, draft messages, explain concepts, or get help with any task.',
            features: [
                { icon: MessageSquare, title: 'Ask Anything',   desc: 'Natural language questions, summaries, drafts, explanations' },
                { icon: FileText,      title: 'Markdown Output', desc: 'Responses support formatted text, lists, and code blocks' },
                { icon: Archive,       title: 'History',         desc: 'Conversation persists in the session — clear when needed' },
                { icon: Pin,           title: 'Draggable Panel', desc: 'Drag the panel anywhere on screen — it stays on top of calls' },
            ],
            tips: [
                'The AI Assistant is a Beta feature — it may not always be perfect',
                'You can keep the AI panel open while working in other parts of the app',
            ],
            action: null,
        },
        {
            id: 'search',
            section: 'Your Account',
            sectionIcon: User,
            icon: Search,
            color: 'from-sky-600 to-sky-800',
            title: 'Global Search',
            subtitle: 'Find anything instantly',
            description: 'Press Ctrl+K (or ⌘K on Mac) from anywhere to open the global search. It searches across 8 resource types simultaneously in real time.',
            features: [
                { icon: CheckSquare,   title: 'Tasks',          desc: 'Find tasks by title — results show project and status' },
                { icon: FolderOpen,    title: 'Projects',       desc: 'Search project names and descriptions' },
                { icon: MessageSquare, title: 'Conversations',  desc: 'Jump directly to a direct message or group chat' },
                { icon: FileText,      title: 'Files & Folders', desc: 'Locate documents across all your folders' },
                { icon: Users,         title: 'People',         desc: 'Find colleagues and open a direct message instantly' },
                { icon: Layers,        title: 'Templates',      desc: 'Search task templates by name' },
            ],
            tips: [
                'Results update as you type (debounced 300ms)',
                'Click any result to navigate directly — tasks open in their project context',
                'Press Escape to close the search without navigating',
            ],
            action: null,
        },
    ],

    // ── Manager-only steps ────────────────────────────────────────────────────
    MANAGER: [
        {
            id: 'templates',
            section: 'Manager Tools',
            sectionIcon: Layers,
            icon: Layers,
            color: 'from-fuchsia-600 to-fuchsia-800',
            title: 'Task Templates',
            subtitle: 'Reusable task checklists',
            description: 'Create templates that define a standard set of tasks for repeated workflows (e.g., "Onboarding", "Sprint Setup"). Apply a template to any project to create all tasks at once.',
            features: [
                { icon: Plus,         title: 'Create Template',   desc: 'Name it, add tasks with titles and priorities' },
                { icon: CheckSquare,  title: 'Task Items',        desc: 'Each template item becomes a real task when applied' },
                { icon: FolderOpen,   title: 'Apply to Project',  desc: 'Select any project — tasks are created instantly' },
                { icon: Users,        title: 'Share Templates',   desc: 'Share your templates with specific groups or users' },
                { icon: CheckCircle2, title: 'Edit & Iterate',    desc: 'Refine templates over time as your processes improve' },
            ],
            tips: [
                'Templates save time when projects follow the same structure every time',
                'Shared templates appear in the recipient\'s template list for reuse',
            ],
            action: { label: 'Open Templates', path: '/templates' },
        },
        {
            id: 'team-dashboard',
            section: 'Manager Tools',
            sectionIcon: Layers,
            icon: BarChart2,
            color: 'from-blue-700 to-indigo-800',
            title: 'Team Dashboard',
            subtitle: 'Keep an eye on your team',
            description: 'As a Manager, your Dashboard shows extra panels: team overdue tasks, blocked tasks, and open project issues assigned to you. Use these to act before problems escalate.',
            features: [
                { icon: AlertTriangle, title: 'Overdue Tasks',   desc: 'All tasks past their due date across your team\'s projects' },
                { icon: Zap,           title: 'Blocked Tasks',   desc: 'Tasks that are stuck and waiting for unblocking action' },
                { icon: BookOpen,      title: 'Open Issues',     desc: 'Project issues assigned to you requiring resolution' },
                { icon: BarChart2,     title: 'Team Stats',      desc: 'Task counts, completion rates, role distribution' },
            ],
            tips: [
                'Check the Dashboard every morning to prioritise the day',
                'Blocked tasks often need a quick decision — don\'t let them linger',
            ],
            action: { label: 'Go to Dashboard', path: '/' },
        },
    ],

    // ── Admin-only steps ──────────────────────────────────────────────────────
    ADMIN: [
        {
            id: 'admin-panel',
            section: 'Admin Controls',
            sectionIcon: Shield,
            icon: Shield,
            color: 'from-amber-600 to-amber-800',
            title: 'Admin Panel',
            subtitle: 'Manage your company',
            description: 'The Admin panel gives you full control over your company\'s INCO LAB instance: users, roles, guest access, audit logs, and platform analytics.',
            features: [
                { icon: Users,    title: 'User Management',  desc: 'Create, edit, suspend, delete users — change roles at any time' },
                { icon: Lock,     title: 'Guest Codes',      desc: 'Generate time-limited or project-based guest access codes' },
                { icon: FileText, title: 'Audit Logs',       desc: 'Full log of every action taken on the platform' },
                { icon: Shield,   title: 'Locked Accounts',  desc: 'Review and unlock accounts locked after failed login attempts' },
                { icon: Globe,    title: 'Timezones',        desc: 'Configure world clock timezones shown in the sidebar for all users' },
                { icon: BarChart2,title: 'Analytics',        desc: 'Completion rates, priority heatmap, top performers, live activity feed' },
            ],
            tips: [
                'Guest codes can be time-based (expire in N days), project-based, or group-based',
                'The Analytics dashboard auto-refreshes every 60 seconds',
                'Audit logs capture every sensitive action for compliance',
            ],
            action: { label: 'Open Admin Panel', path: '/admin' },
        },
        {
            id: 'post-announcements',
            section: 'Admin Controls',
            sectionIcon: Shield,
            icon: Megaphone,
            color: 'from-red-600 to-red-800',
            title: 'Post Announcements',
            subtitle: 'Communicate to the entire company',
            description: 'As an Admin, you can post company-wide announcements with urgency levels, file attachments, and optional group targeting. Employees see these on the Announcements page.',
            features: [
                { icon: AlertTriangle, title: 'Urgency Levels',  desc: 'HIGH (red), MEDIUM (orange), LOW (green) — clearly communicated' },
                { icon: Users,         title: 'Target Groups',   desc: 'Send to specific groups or to the entire company' },
                { icon: Paperclip,     title: 'Attach Files',    desc: 'Include a downloadable file with your announcement' },
                { icon: Globe,         title: 'Platform Scope',  desc: 'Super Admins can post INCOLAB-level announcements across all companies' },
            ],
            tips: [
                'Use HIGH urgency sparingly — it creates the most visual prominence',
                'Leave "Target Groups" empty to send to the entire company',
            ],
            action: { label: 'Open Announcements', path: '/announcements' },
        },
        {
            id: 'admin-dashboard',
            section: 'Admin Controls',
            sectionIcon: Shield,
            icon: BarChart2,
            color: 'from-orange-600 to-red-700',
            title: 'Platform Dashboard',
            subtitle: 'Company-wide statistics',
            description: 'Your Dashboard shows company-wide statistics: total tasks, active users, completion rate, overdue tasks, locked accounts, and role breakdown.',
            features: [
                { icon: BarChart2,     title: 'KPI Cards',       desc: 'At-a-glance: total users, active projects, completion rate, overdue count' },
                { icon: Users,         title: 'Role Breakdown',  desc: 'Pie chart of Admins, Managers, Employees, Guests in your company' },
                { icon: AlertTriangle, title: 'Health Alerts',   desc: 'Stalled projects, locked accounts, suspended users flagged automatically' },
                { icon: Clock,         title: 'Live Activity',   desc: '30-day activity feed of all events across the company' },
            ],
            tips: [
                'The Analytics tab in Admin has a deep-dive view with performance timeline',
                'Stalled projects (no tasks IN PROGRESS) are highlighted for review',
            ],
            action: { label: 'Go to Dashboard', path: '/' },
        },
    ],

    // ── Super Admin steps ─────────────────────────────────────────────────────
    SUPER_ADMIN: [
        {
            id: 'superadmin-overview',
            section: 'Platform Management',
            sectionIcon: ShieldCheck,
            icon: ShieldCheck,
            color: 'from-rose-600 to-rose-800',
            title: 'Super Admin Dashboard',
            subtitle: 'Full platform oversight',
            description: 'As Super Admin you manage the entire INCO LAB platform across all companies. You have access to company management, global user lists, live sessions, storage, system alerts, and audit trails.',
            features: [
                { icon: Users,         title: 'All Companies',    desc: 'Create, activate, and deactivate company instances' },
                { icon: BarChart2,     title: 'Platform KPIs',    desc: 'Total companies, users, active sessions, storage usage' },
                { icon: Monitor,       title: 'Live Sessions',    desc: 'See all active voice/video sessions platform-wide' },
                { icon: FileText,      title: 'Storage Monitor',  desc: 'Track disk usage per company and across the platform' },
                { icon: Bell,          title: 'System Alerts',    desc: 'Flag anomalies, broadcast maintenance messages to all companies' },
                { icon: Clock,         title: 'Audit Trail',      desc: 'Complete chronological log of all platform-level events' },
            ],
            tips: [
                'Use the Timeline tab to trace any issue back to its root cause',
                'Broadcast messages go to all active users across all companies immediately',
                'Deactivating a company suspends all its users without deleting data',
            ],
            action: { label: 'Open Super Admin', path: '/superadmin' },
        },
        {
            id: 'superadmin-companies',
            section: 'Platform Management',
            sectionIcon: ShieldCheck,
            icon: FolderOpen,
            color: 'from-pink-700 to-rose-900',
            title: 'Company Management',
            subtitle: 'Multi-tenant administration',
            description: 'Each company is an isolated tenant with its own users, projects, and data. You can create new companies, assign them an Admin user, and control their activation status.',
            features: [
                { icon: Plus,       title: 'Create Company',     desc: 'Set company name, slug, and optional logo URL' },
                { icon: Shield,     title: 'Assign Admin',       desc: 'Create the first Admin user for a new company at setup' },
                { icon: CheckCircle2, title: 'Activate/Deactivate', desc: 'Toggle company active state without deleting any data' },
                { icon: Users,      title: 'Cross-company Users', desc: 'Search all users across all companies from one view' },
            ],
            tips: [
                'The company slug is used in URLs and API paths — choose carefully',
                'Deactivated companies cannot log in but their data is preserved',
            ],
            action: { label: 'Open Super Admin', path: '/superadmin' },
        },
    ],

    // ── Guest steps ───────────────────────────────────────────────────────────
    GUEST: [
        {
            id: 'guest-welcome',
            section: 'Getting Started',
            sectionIcon: GraduationCap,
            icon: GraduationCap,
            color: 'from-slate-600 to-slate-800',
            title: 'Welcome, Guest',
            subtitle: 'Your limited-access guide',
            description: 'You have guest access to INCO LAB. This means you can join calls, participate in assigned conversations, and view shared files — without needing a full account.',
            features: [
                { icon: Phone,         title: 'Join Calls',       desc: 'Use the call link provided to join voice or video channels' },
                { icon: MessageSquare, title: 'Group Chat',       desc: 'Participate in conversations you\'ve been added to' },
                { icon: FileText,      title: 'View Files',       desc: 'Download and view files shared with you' },
                { icon: Megaphone,     title: 'Announcements',    desc: 'View company announcements relevant to your access level' },
            ],
            tips: [
                'Your access is time-limited or project-based — check with your Admin if it expires',
                'You do not need a full account to participate in calls via a link',
            ],
            action: null,
        },
        {
            id: 'guest-calls',
            section: 'Calling',
            sectionIcon: Phone,
            icon: Phone,
            color: 'from-teal-600 to-teal-800',
            title: 'Joining Calls',
            subtitle: 'How to connect to voice and video',
            description: 'You can join a voice or video channel using a shareable link sent to you by a team member. No account is needed — just enter your display name and join.',
            features: [
                { icon: Play,    title: 'Click the Link',   desc: 'Open the call link in your browser — it works on any device' },
                { icon: User,    title: 'Display Name',     desc: 'Enter your name so participants know who you are' },
                { icon: Volume2, title: 'Voice Channel',    desc: 'Audio-only call — mute/unmute at any time' },
                { icon: Video,   title: 'Video Channel',    desc: 'Camera + audio — toggle camera on/off mid-call' },
                { icon: Monitor, title: 'Screen Sharing',   desc: 'You can share your screen even as a guest participant' },
            ],
            tips: [
                'Allow microphone (and camera) access in your browser when prompted',
                'If the call link has expired, contact the person who sent it',
            ],
            action: null,
        },
    ],
}

// Build ordered step list for a given role
function getStepsForRole(role) {
    if (role === 'GUEST') return STEPS.GUEST
    if (role === 'SUPER_ADMIN') return [...STEPS.COMMON, ...STEPS.SUPER_ADMIN]
    if (role === 'ADMIN') return [...STEPS.COMMON, ...STEPS.MANAGER, ...STEPS.ADMIN]
    if (role === 'MANAGER') return [...STEPS.COMMON, ...STEPS.MANAGER]
    return STEPS.COMMON // EMPLOYEE default
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TutorialPage() {
    const { user } = useAuthStore()
    const navigate = useNavigate()
    const pageRef  = useRef(null)
    const contentRef = useRef(null)

    const role   = user?.role || 'EMPLOYEE'
    const steps  = getStepsForRole(role)
    const meta   = ROLE_META[role] || ROLE_META.EMPLOYEE

    const STORAGE_KEY = `tutorial_done_${user?.id || 'x'}`
    const [done, setDone] = useState(() => {
        try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') }
        catch { return [] }
    })
    const [activeId, setActiveId] = useState(steps[0]?.id)
    const [openSections, setOpenSections] = useState(() => {
        const secs = [...new Set(steps.map(s => s.section))]
        return Object.fromEntries(secs.map(s => [s, true]))
    })

    const activeStep = steps.find(s => s.id === activeId) || steps[0]
    const sections   = [...new Map(steps.map(s => [s.section, { name: s.section, icon: s.sectionIcon }])).entries()]
    const progress   = Math.round((done.length / steps.length) * 100)

    // Persist done list
    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(done))
    }, [done, STORAGE_KEY])

    // Page entrance animation
    useEffect(() => {
        if (!pageRef.current) return
        const ctx = gsap.context(() => {
            gsap.fromTo(pageRef.current,
                { opacity: 0, y: 16 },
                { opacity: 1, y: 0, duration: 0.4, ease: 'power3.out' }
            )
        }, pageRef)
        return () => ctx.revert()
    }, [])

    // Content slide animation on step change
    useEffect(() => {
        if (!contentRef.current) return
        const ctx = gsap.context(() => {
            gsap.fromTo(contentRef.current,
                { opacity: 0, y: 12 },
                { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out' }
            )
        }, contentRef)
        return () => ctx.revert()
    }, [activeId])

    const markDone = (id) => {
        if (!done.includes(id)) setDone(prev => [...prev, id])
    }

    const goToStep = (id) => {
        setActiveId(id)
        markDone(id)
    }

    const goNext = () => {
        const idx = steps.findIndex(s => s.id === activeId)
        if (idx < steps.length - 1) goToStep(steps[idx + 1].id)
    }

    const goPrev = () => {
        const idx = steps.findIndex(s => s.id === activeId)
        if (idx > 0) goToStep(steps[idx - 1].id)
    }

    const toggleSection = (name) =>
        setOpenSections(prev => ({ ...prev, [name]: !prev[name] }))

    const currentIdx  = steps.findIndex(s => s.id === activeId)
    const isLast      = currentIdx === steps.length - 1
    const MetaIcon    = meta.icon
    const StepIcon    = activeStep?.icon || GraduationCap

    return (
        <div ref={pageRef} className="flex h-full overflow-hidden min-h-full">

            {/* ── Left sidebar ─────────────────────────────────────────────── */}
            <aside className="w-64 flex-shrink-0 flex flex-col border-r overflow-hidden"
                   style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-primary)' }}>

                {/* Header */}
                <div className="p-4 border-b" style={{ borderColor: 'var(--border-primary)' }}>
                    <div className="flex items-center gap-2 mb-3">
                        <GraduationCap className="w-5 h-5 text-blue-400" />
                        <span className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>Tutorial</span>
                    </div>
                    {/* Role badge */}
                    <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border font-medium ${meta.color}`}>
                        <MetaIcon className="w-3 h-3" />
                        {meta.label}
                    </span>
                    {/* Progress bar */}
                    <div className="mt-3">
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Progress</span>
                            <span className="text-[10px] font-semibold text-blue-400">{progress}%</span>
                        </div>
                        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-card)' }}>
                            <div className="h-full rounded-full bg-blue-500 transition-all duration-500"
                                 style={{ width: `${progress}%` }} />
                        </div>
                        <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
                            {done.length} / {steps.length} steps
                        </p>
                    </div>
                </div>

                {/* Step list */}
                <nav className="flex-1 overflow-y-auto p-2 space-y-1">
                    {sections.map(([secName, secMeta]) => {
                        const secSteps = steps.filter(s => s.section === secName)
                        const SIcon = secMeta.icon
                        const isOpen = openSections[secName] !== false
                        return (
                            <div key={secName}>
                                {/* Section header */}
                                <button
                                    onClick={() => toggleSection(secName)}
                                    className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg transition-all hover:bg-slate-700/30"
                                >
                                    <div className="flex items-center gap-1.5">
                                        <SIcon className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                                        <span className="text-[10px] font-bold uppercase tracking-wider"
                                              style={{ color: 'var(--text-muted)' }}>{secName}</span>
                                    </div>
                                    {isOpen
                                        ? <ChevronDown className="w-3 h-3" style={{ color: 'var(--text-muted)' }} />
                                        : <ChevronRight className="w-3 h-3" style={{ color: 'var(--text-muted)' }} />
                                    }
                                </button>
                                {/* Steps */}
                                {isOpen && secSteps.map(step => {
                                    const Icon    = step.icon
                                    const isDone  = done.includes(step.id)
                                    const isActive = step.id === activeId
                                    return (
                                        <button
                                            key={step.id}
                                            onClick={() => goToStep(step.id)}
                                            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left transition-all text-sm mb-0.5
                                                ${isActive
                                                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                                                    : 'hover:bg-slate-700/40'}`}
                                            style={{ color: isActive ? 'white' : 'var(--text-secondary)' }}
                                        >
                                            <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                                            <span className="flex-1 truncate text-xs font-medium">{step.title}</span>
                                            {isDone
                                                ? <CheckCircle2 className={`w-3.5 h-3.5 flex-shrink-0 ${isActive ? 'text-blue-200' : 'text-emerald-400'}`} />
                                                : <Circle className="w-3.5 h-3.5 flex-shrink-0 opacity-30" />
                                            }
                                        </button>
                                    )
                                })}
                            </div>
                        )
                    })}
                </nav>

                {/* Reset button */}
                <div className="p-3 border-t" style={{ borderColor: 'var(--border-primary)' }}>
                    <button
                        onClick={() => { setDone([]); setActiveId(steps[0]?.id) }}
                        className="w-full py-2 rounded-xl text-xs transition-all border"
                        style={{ borderColor: 'var(--border-primary)', color: 'var(--text-muted)' }}>
                        Reset progress
                    </button>
                </div>
            </aside>

            {/* ── Main content ─────────────────────────────────────────────── */}
            <div className="flex-1 flex flex-col overflow-hidden min-w-0">
                <div ref={contentRef} className="flex-1 overflow-y-auto p-6 space-y-6">

                    {/* Step hero */}
                    <div className={`relative rounded-2xl overflow-hidden p-6 bg-gradient-to-br ${activeStep?.color || 'from-blue-600 to-blue-800'}`}>
                        <div className="absolute inset-0 opacity-10"
                             style={{ backgroundImage: 'radial-gradient(circle at 80% 20%, white 0%, transparent 60%)' }} />
                        <div className="relative">
                            <div className="flex items-start justify-between mb-3">
                                <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center">
                                    <StepIcon className="w-6 h-6 text-white" />
                                </div>
                                <span className="text-xs font-semibold text-white/60 bg-white/10 px-2.5 py-1 rounded-full">
                                    {currentIdx + 1} / {steps.length}
                                </span>
                            </div>
                            <h1 className="text-2xl font-bold text-white mb-1">{activeStep?.title}</h1>
                            <p className="text-white/70 text-sm mb-4">{activeStep?.subtitle}</p>
                            <p className="text-white/90 text-sm leading-relaxed max-w-2xl">{activeStep?.description}</p>
                            {activeStep?.action && (
                                <button
                                    onClick={() => { markDone(activeStep.id); navigate(activeStep.action.path) }}
                                    className="mt-4 inline-flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all border border-white/20">
                                    {activeStep.action.label} <ArrowRight className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Feature grid */}
                    {activeStep?.features?.length > 0 && (
                        <div>
                            <h2 className="text-sm font-bold mb-3 flex items-center gap-2"
                                style={{ color: 'var(--text-secondary)' }}>
                                <Zap className="w-4 h-4 text-blue-400" /> What you can do
                            </h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                {activeStep.features.map((f, i) => {
                                    const FIcon = f.icon
                                    return (
                                        <div key={i} className="flex items-start gap-3 p-4 rounded-xl border transition-all hover:border-blue-500/30"
                                             style={{ background: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
                                            <div className="w-8 h-8 rounded-lg bg-blue-500/15 flex items-center justify-center flex-shrink-0">
                                                <FIcon className="w-4 h-4 text-blue-400" />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-sm font-semibold mb-0.5" style={{ color: 'var(--text-primary)' }}>{f.title}</p>
                                                <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{f.desc}</p>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    {/* Tips */}
                    {activeStep?.tips?.length > 0 && (
                        <div className="rounded-xl border p-4 space-y-2.5"
                             style={{ background: 'rgba(59,130,246,0.05)', borderColor: 'rgba(59,130,246,0.2)' }}>
                            <h3 className="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
                                <Lightbulb className="w-3.5 h-3.5" /> Tips
                            </h3>
                            {activeStep.tips.map((tip, i) => (
                                <div key={i} className="flex items-start gap-2.5">
                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 flex-shrink-0" />
                                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{tip}</p>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Keyboard shortcut callout (search step only) */}
                    {activeStep?.id === 'search' && (
                        <div className="rounded-xl border p-4 flex items-center gap-4"
                             style={{ background: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
                            <Keyboard className="w-8 h-8 text-slate-400 flex-shrink-0" />
                            <div>
                                <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Keyboard Shortcut</p>
                                <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                                    Press <kbd className="px-2 py-0.5 rounded bg-slate-700 text-slate-200 text-xs font-mono border border-slate-600">Ctrl</kbd>
                                    {' + '}
                                    <kbd className="px-2 py-0.5 rounded bg-slate-700 text-slate-200 text-xs font-mono border border-slate-600">K</kbd>
                                    {' '}(or <kbd className="px-2 py-0.5 rounded bg-slate-700 text-slate-200 text-xs font-mono border border-slate-600">⌘K</kbd> on Mac) from anywhere to open global search instantly.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Completion badge if last step */}
                    {isLast && done.includes(activeStep?.id) && (
                        <div className="rounded-2xl p-6 text-center border"
                             style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.08), rgba(59,130,246,0.08))', borderColor: 'rgba(16,185,129,0.3)' }}>
                            <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-3">
                                <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                            </div>
                            <h3 className="text-lg font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
                                🎉 Tutorial Complete!
                            </h3>
                            <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
                                You've covered all {steps.length} steps. You're ready to get the most out of INCO LAB.
                            </p>
                            <button
                                onClick={() => navigate('/')}
                                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all">
                                Go to Dashboard <ArrowRight className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                </div>

                {/* ── Bottom navigation ─────────────────────────────────────── */}
                <div className="flex items-center justify-between px-6 py-3 border-t flex-shrink-0"
                     style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-primary)' }}>
                    <button
                        onClick={goPrev}
                        disabled={currentIdx === 0}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all border disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-700/40"
                        style={{ borderColor: 'var(--border-primary)', color: 'var(--text-secondary)' }}>
                        ← Previous
                    </button>

                    <div className="flex items-center gap-1.5">
                        {steps.map((s, i) => (
                            <button
                                key={s.id}
                                onClick={() => goToStep(s.id)}
                                className={`rounded-full transition-all ${
                                    s.id === activeId ? 'w-6 h-2 bg-blue-500' :
                                    done.includes(s.id) ? 'w-2 h-2 bg-emerald-400/70' :
                                    'w-2 h-2 bg-slate-600'
                                }`}
                                title={s.title}
                            />
                        ))}
                    </div>

                    <button
                        onClick={isLast ? () => navigate('/') : goNext}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-all">
                        {isLast ? 'Finish' : 'Next →'}
                    </button>
                </div>
            </div>
        </div>
    )
}
