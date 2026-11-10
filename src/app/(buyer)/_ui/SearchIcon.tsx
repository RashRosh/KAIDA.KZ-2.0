// Paths transcribed from the current B03/B04/B07 canvas, not the legacy icon pack.
// `aim` and `refresh` come from QingIcon (https://github.com/asorn/qingicon-open, Map/crosshair-3,
// System/refresh; Apache-2.0) as the baseline icon set.
export type SearchIconName = 'search' | 'pin' | 'heart' | 'more' | 'phone' | 'whatsapp' | 'telegram' | 'route' | 'leaf' | 'alert' | 'close' | 'left' | 'right' | 'user' | 'refresh' | 'blocked' | 'aim';
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
    refresh: <path d="M20.736 12.5C20.4768 17.0998 16.6647 20.75 12 20.75C7.16751 20.75 3.25 16.8325 3.25 12C3.25 7.16751 7.16751 3.25 12 3.25C15.5881 3.25 18.6717 5.40967 20.0219 8.5M20.5 4.5V8.5H16.5" />,
    aim: <path d="M12 2V5M12 19V22M5 12H2M22 12H19M20.5 12C20.5 16.6944 16.6944 20.5 12 20.5C7.30558 20.5 3.5 16.6944 3.5 12C3.5 7.30558 7.30558 3.5 12 3.5C16.6944 3.5 20.5 7.30558 20.5 12ZM15 12C15 13.6569 13.6569 15 12 15C10.3431 15 9 13.6569 9 12C9 10.3431 10.3431 9 12 9C13.6569 9 15 10.3431 15 12Z" />,
  };
  return <svg viewBox="0 0 24 24" width="24" height="24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
