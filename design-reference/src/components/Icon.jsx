// ============================================================
// Icônes SVG (style géométrique minimal, cf. DA) — ported 1:1
// ============================================================
export const ICONS = {
  home: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9.5 10 3.5l7 6V16a1 1 0 0 1-1 1h-4v-4.5H8V17H4a1 1 0 0 1-1-1V9.5Z"/></svg>',
  boards: '<svg viewBox="0 0 20 20" fill="currentColor"><rect x="3" y="4" width="4" height="12" rx="1.2"/><rect x="8.5" y="4" width="4" height="8" rx="1.2"/><rect x="14" y="4" width="4" height="10" rx="1.2"/></svg>',
  messages: '<svg viewBox="0 0 20 20" fill="currentColor"><path d="M3.5 4h13a1.5 1.5 0 0 1 1.5 1.5v7a1.5 1.5 0 0 1-1.5 1.5H8l-3.6 2.8c-.5.4-1.4 0-1.4-.7V5.5A1.5 1.5 0 0 1 3.5 4Z"/></svg>',
  files: '<svg viewBox="0 0 20 20" fill="currentColor"><path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h3.2l1.6 1.8h6.2A1.5 1.5 0 0 1 17 8.3v6.2a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 14.5v-8Z"/></svg>',
  meet: '<svg viewBox="0 0 20 20" fill="currentColor"><rect x="2.5" y="6" width="10" height="8" rx="1.6"/><path d="M13.5 9.4 17 7v6l-3.5-2.4v-1.2Z"/></svg>',
  calendar: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><rect x="3" y="4.5" width="14" height="12" rx="1.6"/><path d="M3 8.5h14M7 3v3M13 3v3"/></svg>',
  groups: '<svg viewBox="0 0 20 20" fill="currentColor"><circle cx="7" cy="7.5" r="2.6"/><circle cx="13.6" cy="8.5" r="2.1"/><path d="M2.5 15.5c0-2.3 2-4 4.5-4s4.5 1.7 4.5 4v.5h-9v-.5Z"/><path d="M12.6 15.9v-.4c0-1.3-.5-2.4-1.4-3.2.7-.4 1.5-.7 2.4-.7 2.1 0 3.9 1.5 3.9 3.5v.8h-4.9Z"/></svg>',
  announce: '<svg viewBox="0 0 20 20" fill="currentColor"><path d="M3 8.5v3a1 1 0 0 0 1 1h1.5l1 3.5a.8.8 0 0 0 .77.6h1.1a.6.6 0 0 0 .58-.76L8.1 12.9h1.4l6 3.1a.7.7 0 0 0 1-.62V4.6a.7.7 0 0 0-1-.62l-6 3.1H4a1 1 0 0 0-1 1.42Z"/></svg>',
  admin: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M10 2.8 16.5 5v4.6c0 4-2.8 6.9-6.5 7.9-3.7-1-6.5-3.9-6.5-7.9V5L10 2.8Z"/><path d="m7.5 9.8 1.8 1.8 3.2-3.4"/></svg>',
  search: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="8.8" cy="8.8" r="5.3"/><path d="m17 17-4.4-4.4"/></svg>',
  bell: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M10 3a4.6 4.6 0 0 0-4.6 4.6c0 3.5-1.4 4.9-1.4 4.9h12s-1.4-1.4-1.4-4.9A4.6 4.6 0 0 0 10 3Z"/><path d="M8.5 15.5a1.6 1.6 0 0 0 3 0"/></svg>',
  sun: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="10" cy="10" r="3.4"/><path d="M10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.7 4.7l1.4 1.4M13.9 13.9l1.4 1.4M15.3 4.7l-1.4 1.4M6.1 13.9l-1.4 1.4"/></svg>',
  moon: '<svg viewBox="0 0 20 20" fill="currentColor"><path d="M16.6 12.2A6.9 6.9 0 0 1 7.8 3.4a.5.5 0 0 0-.65-.62 7.6 7.6 0 1 0 10.07 10.07.5.5 0 0 0-.62-.65Z"/></svg>',
  mic: '<svg viewBox="0 0 20 20" fill="currentColor"><rect x="7.6" y="2.8" width="4.8" height="8.6" rx="2.4"/><path d="M5 9.5a5 5 0 0 0 10 0h-1.5a3.5 3.5 0 0 1-7 0H5Z"/><rect x="9.3" y="14.3" width="1.4" height="2.9" rx=".7"/></svg>',
  micOff: '<svg viewBox="0 0 20 20" fill="currentColor"><rect x="7.6" y="2.8" width="4.8" height="8.6" rx="2.4"/><path d="M5 9.5a5 5 0 0 0 10 0h-1.5a3.5 3.5 0 0 1-7 0H5Z"/><rect x="9.3" y="14.3" width="1.4" height="2.9" rx=".7"/><path d="m4 3 12 14" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/></svg>',
  cam: '<svg viewBox="0 0 20 20" fill="currentColor"><rect x="2.5" y="6" width="10" height="8" rx="1.6"/><path d="M13.5 9.4 17 7v6l-3.5-2.4v-1.2Z"/></svg>',
  camOff: '<svg viewBox="0 0 20 20" fill="currentColor"><rect x="2.5" y="6" width="10" height="8" rx="1.6"/><path d="M13.5 9.4 17 7v6l-3.5-2.4v-1.2Z"/><path d="m3 3.5 14 13" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/></svg>',
  leave: '<svg viewBox="0 0 20 20" fill="currentColor"><rect x="2" y="8.6" width="16" height="3" rx="1.5"/></svg>',
  plus: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M10 4v12M4 10h12"/></svg>',
  clip: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="m14.5 8.9-4.9 4.9a3.1 3.1 0 0 1-4.4-4.4l5.6-5.6a2.1 2.1 0 0 1 3 3l-5.6 5.6a1.05 1.05 0 0 1-1.5-1.5l4.9-4.9"/></svg>',
  send: '<svg viewBox="0 0 20 20" fill="currentColor"><path d="M2.8 9.2 16.6 3.3a.6.6 0 0 1 .8.76L12 17.1a.6.6 0 0 1-1.12.03l-1.9-4.62-4.6-1.94a.6.6 0 0 1 .02-1.12l7.5-2.72"/></svg>',
  spark: '<svg viewBox="0 0 20 20" fill="currentColor"><path d="M10 2.5c.5 3.6 1.9 5 5.5 5.5-3.6.5-5 1.9-5.5 5.5-.5-3.6-1.9-5-5.5-5.5 3.6-.5 5-1.9 5.5-5.5Z"/><path d="M15.4 12.4c.3 1.7.9 2.3 2.6 2.6-1.7.3-2.3.9-2.6 2.6-.3-1.7-.9-2.3-2.6-2.6 1.7-.3 2.3-.9 2.6-2.6Z"/></svg>',
  check: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="m4 10.5 4 4 8-9"/></svg>',
  phone: '<svg viewBox="0 0 20 20" fill="currentColor"><path d="M4.2 3h3l1.3 3.6-1.8 1.4a10.8 10.8 0 0 0 5.3 5.3l1.4-1.8L17 12.8v3a1.2 1.2 0 0 1-1.3 1.2C8.9 16.6 3.4 11.1 3 4.3A1.2 1.2 0 0 1 4.2 3Z"/></svg>',
  folder: '<svg viewBox="0 0 20 20" fill="currentColor"><path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h3.2l1.6 1.8h6.2A1.5 1.5 0 0 1 17 8.3v6.2a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 14.5v-8Z"/></svg>',
  chevron: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m5.5 7.5 4.5 4.5 4.5-4.5"/></svg>',
  filter: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4.5h14M6 10h8M8.5 15.5h3"/></svg>',
};

export default function Icon({ name, className = '', style }) {
  return <span className={`icon ${className}`} style={style} dangerouslySetInnerHTML={{ __html: ICONS[name] || '' }} />;
}
