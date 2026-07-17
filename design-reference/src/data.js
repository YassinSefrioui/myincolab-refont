// ============================================================
// INCO LAB — Données de démarrage
// ============================================================

export const SEED = {
  team: [
    { id: 'ava',    name: 'Ava Chen',    role: 'MANAGER',  job: 'Product',     initials: 'AC', color: '#f0a04b', email: 'ava@incolab.com',    presence: 'online'  },
    { id: 'marcus', name: 'Marcus Webb', role: 'EMPLOYEE', job: 'Design',      initials: 'MW', color: '#5b8def', email: 'marcus@incolab.com', presence: 'away'    },
    { id: 'priya',  name: 'Priya Nair',  role: 'EMPLOYEE', job: 'Engineering', initials: 'PN', color: '#9b7bf0', email: 'priya@incolab.com',  presence: 'online'  },
    { id: 'tomas',  name: 'Tomas Rein',  role: 'EMPLOYEE', job: 'Engineering', initials: 'TR', color: '#4bb37a', email: 'tomas@incolab.com',  presence: 'busy'    },
    { id: 'jules',  name: 'Jules Kim',   role: 'EMPLOYEE', job: 'Marketing',   initials: 'JK', color: '#e0607a', email: 'jules@incolab.com',  presence: 'offline' },
    { id: 'you',    name: 'Sam Ortiz',   role: 'ADMIN',    job: 'You',         initials: 'SO', color: '#2a9d8f', email: 'sam@incolab.com',    presence: 'online', locked: false },
  ],

  labels: [
    { name: 'Product',     color: '#f0a04b' },
    { name: 'Marketing',   color: '#e0607a' },
    { name: 'Design',      color: '#5b8def' },
    { name: 'Engineering', color: '#9b7bf0' },
    { name: 'QA',          color: '#4bb37a' },
  ],

  projects: [
    {
      id: 'launch', name: 'Product Launch Q3', archived: false, unread: 3,
      description: 'Lancement produit du troisième trimestre',
      members: ['ava', 'marcus', 'priya', 'tomas', 'jules', 'you'],
      columns: [
        { id: 'backlog', title: 'Backlog', cards: [
          { id: 1, title: 'Finalize pricing tiers', assignee: 'ava', label: 'Product', due: null, priority: 'MEDIUM',
            comments: [ { user: 'marcus', text: 'On vise 3 paliers ?', time: 'Hier' }, { user: 'ava', text: 'Oui, avec -20% en annuel', time: 'Hier' } ],
            subtasks: [], deps: [], done: false },
          { id: 2, title: 'Localize landing page copy', assignee: 'jules', label: 'Marketing', due: null, priority: 'LOW',
            comments: [], subtasks: [ { text: 'FR', done: false }, { text: 'ES', done: false } ], deps: [], done: false },
        ]},
        { id: 'progress', title: 'In Progress', cards: [
          { id: 3, title: 'Onboarding flow redesign', assignee: 'marcus', label: 'Design', due: 'Demain', priority: 'HIGH',
            comments: [ { user: 'ava', text: 'Superbe direction 👏', time: '9:20' }, { user: 'priya', text: 'Écran 3 à revoir', time: '10:02' },
              { user: 'marcus', text: 'Corrigé', time: '10:15' }, { user: 'you', text: 'Validé pour moi', time: '10:30' }, { user: 'ava', text: 'On ship', time: '11:00' } ],
            subtasks: [ { text: 'Wireframes', done: true }, { text: 'Maquettes HD', done: true }, { text: 'Prototype', done: false } ], deps: [], done: false },
          { id: 4, title: 'Billing API integration', assignee: 'priya', label: 'Engineering', due: '17 juil.', priority: 'URGENT',
            comments: [ { user: 'tomas', text: 'Staging prêt', time: '9:41' }, { user: 'priya', text: 'Endpoint /discount ok', time: '9:55' }, { user: 'you', text: 'Test cet aprem', time: '10:00' } ],
            subtasks: [ { text: 'Endpoint discount', done: true }, { text: 'Webhooks', done: false } ], deps: [5], done: false },
          { id: 5, title: 'Set up staging environment', assignee: 'tomas', label: 'Engineering', due: '16 juil.', priority: 'HIGH',
            comments: [ { user: 'priya', text: 'Merci !', time: '11:21' } ], subtasks: [], deps: [], done: false },
        ]},
        { id: 'review', title: 'Review', cards: [
          { id: 6, title: 'Checkout flow QA pass', assignee: 'tomas', label: 'QA', due: "Aujourd'hui", priority: 'URGENT',
            comments: [ { user: 'you', text: 'Reste le cas 3DS', time: '9:00' }, { user: 'tomas', text: 'En cours', time: '9:12' },
              { user: 'you', text: 'Ok', time: '9:14' }, { user: 'tomas', text: 'Fait ✅', time: '11:40' } ],
            subtasks: [ { text: 'Panier', done: true }, { text: 'Paiement', done: true }, { text: '3DS', done: false } ], deps: [4], done: false },
          { id: 7, title: 'Landing page accessibility review', assignee: 'marcus', label: 'Design', due: null, priority: 'MEDIUM',
            comments: [], subtasks: [], deps: [], done: false },
        ]},
        { id: 'done', title: 'Done', cards: [
          { id: 8, title: 'Set up analytics events', assignee: 'priya', label: 'Engineering', due: null, priority: 'MEDIUM',
            comments: [ { user: 'ava', text: 'Dashboard ok', time: 'Lun.' }, { user: 'priya', text: '👍', time: 'Lun.' } ], subtasks: [], deps: [], done: true },
          { id: 9, title: 'Draft launch announcement', assignee: 'jules', label: 'Marketing', due: null, priority: 'LOW',
            comments: [ { user: 'ava', text: 'Relu, top', time: 'Mar.' } ], subtasks: [], deps: [], done: true },
        ]},
      ],
    },
    {
      id: 'site', name: 'Marketing Site Redesign', archived: false, unread: 0,
      description: 'Refonte du site marketing',
      members: ['marcus', 'jules', 'you'],
      columns: [
        { id: 'backlog', title: 'Backlog', cards: [
          { id: 101, title: 'Moodboard & direction artistique', assignee: 'marcus', label: 'Design', due: null, priority: 'MEDIUM', comments: [], subtasks: [], deps: [], done: false },
          { id: 102, title: 'Plan de contenu blog', assignee: 'jules', label: 'Marketing', due: '22 juil.', priority: 'LOW', comments: [], subtasks: [], deps: [], done: false },
        ]},
        { id: 'progress', title: 'In Progress', cards: [
          { id: 103, title: 'Hero section responsive', assignee: 'marcus', label: 'Design', due: '18 juil.', priority: 'HIGH', comments: [], subtasks: [], deps: [], done: false },
        ]},
        { id: 'review', title: 'Review', cards: [
          { id: 104, title: 'Audit SEO technique', assignee: 'jules', label: 'Marketing', due: null, priority: 'MEDIUM', comments: [], subtasks: [], deps: [], done: false },
        ]},
        { id: 'done', title: 'Done', cards: [
          { id: 105, title: 'Benchmark concurrents', assignee: 'you', label: 'Product', due: null, priority: 'LOW', comments: [], subtasks: [], deps: [], done: true },
        ]},
      ],
    },
    {
      id: 'mobile', name: 'Mobile App v2', archived: true,
      description: 'Version 2 de l\'application mobile (archivé)',
      members: ['priya', 'tomas', 'you'],
      columns: [
        { id: 'backlog', title: 'Backlog', cards: [] },
        { id: 'progress', title: 'In Progress', cards: [] },
        { id: 'review', title: 'Review', cards: [] },
        { id: 'done', title: 'Done', cards: [
          { id: 201, title: 'Migration API v2', assignee: 'priya', label: 'Engineering', due: null, priority: 'HIGH', comments: [], subtasks: [], deps: [], done: true },
        ]},
      ],
    },
    {
      id: 'design-system', name: 'Design System v3', archived: false, unread: 1,
      description: 'Bibliothèque de composants unifiée',
      members: ['marcus', 'ava', 'you'],
      columns: [
        { id: 'backlog', title: 'Backlog', cards: [] },
        { id: 'progress', title: 'In Progress', cards: [] },
        { id: 'review', title: 'Review', cards: [] },
        { id: 'done', title: 'Done', cards: [
          { id: 301, title: 'Tokens couleur', assignee: 'marcus', label: 'Design', due: null, priority: 'MEDIUM', comments: [], subtasks: [], deps: [], done: true },
          { id: 302, title: 'Composants boutons', assignee: 'ava', label: 'Design', due: null, priority: 'LOW', comments: [], subtasks: [], deps: [], done: true },
        ]},
      ],
    },
  ],

  templates: [
    { id: 't1', name: 'Sprint QA', tasks: ['Revue de code', 'Tests de régression', 'Rapport de bugs'], label: 'QA' },
    { id: 't2', name: 'Lancement feature', tasks: ['Spec produit', 'Design', 'Développement', 'QA', 'Annonce'], label: 'Product' },
  ],

  dms: [
    { id: 'dm-ava',    user: 'ava' },
    { id: 'dm-marcus', user: 'marcus' },
  ],
  groupChats: [
    { id: 'gc-launch', name: 'Launch crew', members: ['ava', 'priya', 'jules', 'you'] },
  ],

  messagesByConv: {
    launch: [
      { id: 1, user: 'ava',    text: 'Morning team — pushed the updated pricing doc, take a look before standup', time: '9:02', reactions: [{ emoji: '👍', users: ['you', 'priya'] }] },
      { id: 2, user: 'you',    text: 'On it. Quick q: are we still doing the annual discount at 20%?', time: '9:05' },
      { id: 3, user: 'ava',    text: 'Yep, 20% holds. Marcus is folding it into the onboarding flow too', time: '9:06' },
      { id: 4, user: 'marcus', text: 'Confirmed — mockups for that screen are in the Product Launch board', time: '9:11',
        threadReplies: [
          { id: 1, user: 'priya', text: "Nice, I'll update the staging env accordingly", time: '9:15' },
          { id: 2, user: 'tomas', text: 'Should I flag this in the eng channel too?', time: '9:20' },
          { id: 3, user: 'marcus', text: 'Yes please, cross-post it', time: '9:22' },
          { id: 4, user: 'ava', text: 'Thanks for closing the loop 👍', time: '9:30' },
        ] },
      { id: 5, user: 'priya',  text: 'Billing API supports the discount code param now, staging is live', time: '9:40', file: { name: 'billing-api-notes.pdf', size: '214 KB' }, reactions: [{ emoji: '🎉', users: ['ava'] }] },
      { id: 6, user: 'you',    text: 'Nice, testing it against checkout this afternoon', time: '9:42' },
      { id: 7, user: 'tomas',  text: 'Staging env is back up after the migration', time: '11:20' },
    ],
    site: [
      { id: 1, user: 'marcus', text: 'Moodboard partagé, direction "clair & minimal" retenue', time: 'Hier' },
      { id: 2, user: 'jules',  text: 'Plan de contenu blog prêt, je le mets en Backlog', time: 'Hier' },
      { id: 3, user: 'marcus', text: 'Hero section responsive en cours, mockups mobile inclus', time: '18 juil.' },
    ],
    'design-system': [
      { id: 1, user: 'marcus', text: 'Updated the component spacing scale — 4/8/12/16/24/32', time: 'Hier' },
      { id: 2, user: 'ava',    text: 'Nickel, ça simplifie bien la grille des boutons', time: 'Hier' },
    ],
    'dm-ava': [
      { id: 1, user: 'ava', text: 'Tu peux relire le doc pricing avant 11h ?', time: '9:50' },
    ],
    'dm-marcus': [
      { id: 1, user: 'marcus', text: 'Je t\'ai envoyé les maquettes du flow d\'onboarding', time: '10:30' },
    ],
    'gc-launch': [
      { id: 1, user: 'jules', text: 'Annonce de lancement prête pour relecture 🎉', time: '10:45' },
    ],
  },

  voiceChannels: [
    { id: 'vc-standup', name: 'Stand-up', live: false },
    { id: 'vc-warroom', name: 'War room', live: true },
  ],

  folders: [
    { id: 'root',   name: 'Racine',   parent: null,   archived: false },
    { id: 'specs',  name: 'Specs produit', parent: 'root', archived: false },
    { id: 'design', name: 'Design',   parent: 'root', archived: false },
    { id: 'legal',  name: 'Legal 2024', parent: 'root', archived: true },
  ],
  files: [
    { id: 1, name: 'pricing-tiers-v3.pdf',             size: '1,2 Mo', from: 'ava',    where: 'Product Launch Q3', time: 'Il y a 2 h',   folder: 'specs',  version: 3 },
    { id: 2, name: 'onboarding-flow.fig',              size: '8,4 Mo', from: 'marcus', where: 'Product Launch Q3', time: 'Hier',         folder: 'design', version: 1 },
    { id: 3, name: 'billing-api-notes.pdf',            size: '214 Ko', from: 'priya',  where: 'Product Launch Q3', time: 'Hier',         folder: 'specs',  version: 1 },
    { id: 4, name: 'launch-announcement-draft.docx',   size: '48 Ko',  from: 'jules',  where: 'Product Launch Q3', time: 'Il y a 2 j',   folder: 'root',   version: 2 },
    { id: 5, name: 'checkout-qa-checklist.xlsx',       size: '32 Ko',  from: 'tomas',  where: 'Product Launch Q3', time: 'Il y a 3 j',   folder: 'root',   version: 1 },
  ],

  events: [
    { id: 1, title: 'Product sync',      offset: 0, time: '14:00', allDay: false, with: ['ava', 'marcus', 'priya', 'tomas', 'jules'] },
    { id: 2, title: 'Design review',     offset: 1, time: '10:30', allDay: false, with: ['marcus', 'you'] },
    { id: 3, title: 'Sprint planning',   offset: 3, time: '09:30', allDay: false, with: ['priya', 'tomas', 'you'] },
    { id: 4, title: 'Lancement Q3 🚀',   offset: 9, time: '',      allDay: true,  with: ['ava', 'marcus', 'priya', 'tomas', 'jules', 'you'] },
  ],

  groups: [
    { id: 'g-prod', name: 'Produit & Design', parent: null, members: ['ava', 'marcus', 'you'] },
    { id: 'g-eng',  name: 'Engineering',      parent: null, members: ['priya', 'tomas'] },
    { id: 'g-front', name: 'Frontend',        parent: 'g-eng', members: ['priya'] },
    { id: 'g-mkt',  name: 'Marketing',        parent: null, members: ['jules'] },
  ],

  announcements: [
    { id: 1, type: 'global',  title: 'Maintenance planifiée', body: 'La plateforme sera indisponible dimanche de 02:00 à 04:00 (UTC) pour une mise à jour d\'infrastructure.', by: 'you', time: 'Il y a 1 j', attachment: null },
    { id: 2, type: 'company', title: 'Bienvenue à Jules 🎉', body: 'Jules Kim rejoint l\'équipe Marketing cette semaine. Souhaitez-lui la bienvenue sur #random !', by: 'ava', time: 'Il y a 3 j', attachment: 'onboarding-pack.pdf' },
  ],

  notifications: [
    { id: 1, text: 'Priya a commenté <b>Billing API integration</b>', when: 'Il y a 12 min', read: false, view: 'projects' },
    { id: 2, text: 'Marcus a déplacé <b>Onboarding flow redesign</b> vers En cours', when: 'Il y a 40 min', read: false, view: 'projects' },
    { id: 3, text: 'Jules a téléversé <b>launch-announcement-draft.docx</b>', when: 'Il y a 2 h', read: false, view: 'files' },
    { id: 4, text: 'Ava a créé <b>Finalize pricing tiers</b>', when: 'Hier', read: true, view: 'projects' },
    { id: 5, text: 'Nouvelle annonce : <b>Maintenance planifiée</b>', when: 'Hier', read: true, view: 'announcements' },
  ],

  activity: [
    'Priya a commenté <b>Billing API integration</b>',
    'Marcus a déplacé <b>Onboarding flow redesign</b> vers En cours',
    'Jules a téléversé <b>launch-announcement-draft.docx</b>',
    'Ava a créé <b>Finalize pricing tiers</b>',
  ],

  auditLogs: [
    { id: 1, action: 'LOGIN',          user: 'you',    detail: 'Connexion réussie',                    time: '08:54', sensitive: false },
    { id: 2, action: 'USER_CREATED',   user: 'you',    detail: 'Création du compte jules@incolab.com', time: 'Hier',  sensitive: true },
    { id: 3, action: 'ROLE_CHANGED',   user: 'you',    detail: 'Ava Chen : EMPLOYEE → MANAGER',        time: 'Hier',  sensitive: true },
    { id: 4, action: 'FILE_UPLOADED',  user: 'jules',  detail: 'launch-announcement-draft.docx',       time: 'Il y a 2 j', sensitive: false },
    { id: 5, action: 'LOGIN_FAILED',   user: 'tomas',  detail: '3 tentatives échouées',                time: 'Il y a 2 j', sensitive: true },
  ],

  guestCodes: [
    { id: 1, code: 'GUEST-7F2K', createdBy: 'you', uses: 2, max: 5, active: true },
  ],

  meeting: {
    title: 'Product sync',
    participants: [
      { id: 'you',    camOn: true,  speaking: false },
      { id: 'ava',    camOn: true,  speaking: false },
      { id: 'marcus', camOn: false, speaking: false },
      { id: 'priya',  camOn: true,  speaking: true },
    ],
  },

  timezones: [
    { id: 'paris',  label: 'Paris (CET/CEST)',    tz: 'Europe/Paris' },
    { id: 'ny',     label: 'New York (EST/EDT)',  tz: 'America/New_York' },
  ],
  timezoneChoices: [
    { label: 'Paris (CET/CEST)',   tz: 'Europe/Paris' },
    { label: 'New York (EST/EDT)', tz: 'America/New_York' },
    { label: 'Londres (GMT/BST)',  tz: 'Europe/London' },
    { label: 'Tokyo (JST)',        tz: 'Asia/Tokyo' },
    { label: 'Casablanca (WET)',   tz: 'Africa/Casablanca' },
    { label: 'Dubaï (GST)',        tz: 'Asia/Dubai' },
  ],
};
