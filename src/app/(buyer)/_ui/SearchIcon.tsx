// Paths transcribed from the current B03/B04 canvas, not the legacy icon pack.
export type SearchIconName = 'search' | 'pin' | 'heart' | 'more' | 'phone' | 'whatsapp' | 'telegram' | 'route' | 'leaf' | 'alert' | 'close' | 'left' | 'right' | 'user' | 'refresh' | 'blocked';
export function SearchIcon({ name, filled = false }: { name: SearchIconName; filled?: boolean }) {
  const paths: Record<SearchIconName, React.ReactNode> = {
    search: <><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.5-4.5" /></>,
    pin: <><path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z" /><circle cx="12" cy="10" r="2.5" /></>,
    heart: <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />,
    more: <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>,
    phone: <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A15 15 0 0 1 3 6a2 2 0 0 1 2-2z" />,
    whatsapp: <><path d="M3 21l1.65-3.8a9 9 0 1 1 3.4 2.9L3 21" /><path d="M9 10a.5.5 0 0 0 1 0V9a.5.5 0 0 0-1 0v1a5 5 0 0 0 5 5h1a.5.5 0 0 0 0-1h-1a.5.5 0 0 0 0 1" /></>,
    telegram: <path d="M15 10l-4 4 6 6 4-16-18 7 4 2 2 6 3-4" />,
    route: <path d="M4 11l16-7-7 16-2-7-7-2z" />,
    leaf: <><path d="M12 3c4 2.5 6 5.5 6 9s-2.5 6-6 7c-3.5-1-6-3.5-6-7s2-6.5 6-9z" /><path d="M12 22V9M12 15l-3-2M12 12l3-2" /></>,
    alert: <><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16.5v.01" /></>,
    close: <path d="M6 6l12 12M18 6L6 18" />,
    blocked: <><circle cx="12" cy="12" r="9" /><path d="M5.6 5.6l12.8 12.8" /></>,
    left: <path d="M15 5l-7 7 7 7" />,
    right: <path d="M9 5l7 7-7 7" />,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
    refresh: <path d="M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6" />,
  };
  return <svg viewBox="0 0 24 24" width="24" height="24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
