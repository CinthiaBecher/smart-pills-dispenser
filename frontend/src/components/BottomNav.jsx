import { useNavigate, useLocation } from 'react-router-dom'

const items = [
  {
    label: 'Início',
    path: '/dashboard',
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path
          d="M3 12L12 3L21 12V21H15V15H9V21H3V12Z"
          stroke={active ? '#006B5E' : '#9CA3AF'}
          strokeWidth="1.8"
          strokeLinejoin="round"
          fill={active ? '#006B5E' : 'none'}
          fillOpacity={active ? 0.1 : 0}
        />
      </svg>
    ),
  },
  {
    label: 'Medicamentos',
    path: '/medicamentos',
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path
          d="M4.5 12.5L11.5 5.5C13.5 3.5 16.5 3.5 18.5 5.5C20.5 7.5 20.5 10.5 18.5 12.5L11.5 19.5C9.5 21.5 6.5 21.5 4.5 19.5C2.5 17.5 2.5 14.5 4.5 12.5Z"
          stroke={active ? '#006B5E' : '#9CA3AF'}
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <line x1="8.5" y1="15.5" x2="15.5" y2="8.5" stroke={active ? '#006B5E' : '#9CA3AF'} strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
  },
  // Item central — Escanear (tratado separado abaixo)
  {
    label: 'Escanear',
    path: '/escanear',
    central: true,
    icon: () => (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
        <path
          d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"
          stroke="white"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <circle cx="12" cy="13" r="4" stroke="white" strokeWidth="1.8" />
      </svg>
    ),
  },
  {
    label: 'Chat',
    path: '/chat',
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path
          d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"
          stroke={active ? '#006B5E' : '#9CA3AF'}
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    label: 'Perfil',
    path: '/perfil',
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="8" r="4" stroke={active ? '#006B5E' : '#9CA3AF'} strokeWidth="1.8" />
        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke={active ? '#006B5E' : '#9CA3AF'} strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
  },
]

export default function BottomNav() {
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 flex items-end justify-around px-2 pb-4 pt-2 z-50 max-w-md mx-auto">
      {items.map((item) => {
        const active = location.pathname === item.path

        if (item.central) {
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className="flex flex-col items-center -mt-5"
            >
              <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center shadow-lg">
                {item.icon()}
              </div>
              <span className="text-[10px] text-gray-400 mt-1">{item.label}</span>
            </button>
          )
        }

        return (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className="flex flex-col items-center gap-1 min-w-[48px]"
          >
            {item.icon(active)}
            <span className={`text-[10px] ${active ? 'text-primary font-semibold' : 'text-gray-400'}`}>
              {item.label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
