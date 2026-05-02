import { useEffect, useRef } from 'react'

const BASE = 'http://localhost:8000'

// Ícone e cor variam conforme o tipo da notificação
function NotifIcon({ type }) {
  if (type === 'dose_ready') return (
    <div className="w-9 h-9 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="9" stroke="#F59E0B" strokeWidth="2" />
        <path d="M12 7v5l3 3" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </div>
  )
  if (type === 'dose_taken') return (
    <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center shrink-0">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <path d="M5 13l4 4L19 7" stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  )
  // dose_missed
  return (
    <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center shrink-0">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="9" stroke="#D85A30" strokeWidth="2" />
        <path d="M15 9l-6 6M9 9l6 6" stroke="#D85A30" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </div>
  )
}

function formatarDataHora(isoString) {
  const data = new Date(isoString)
  const hoje = new Date()
  const ontem = new Date(); ontem.setDate(hoje.getDate() - 1)

  const hora = data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const diff = Date.now() - data
  const min  = Math.floor(diff / 60000)
  const h    = Math.floor(diff / 3600000)

  let relativo
  if (min < 1)       relativo = 'agora'
  else if (min < 60) relativo = `${min}min atrás`
  else if (h < 24)   relativo = `${h}h atrás`
  else if (data.toDateString() === ontem.toDateString()) relativo = 'ontem'
  else relativo = data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })

  return `${relativo} · ${hora}`
}

export default function NotificationPanel({ userId, notifs, onClose, onRefresh }) {
  const panelRef = useRef(null)

  // Fecha ao clicar fora do painel
  useEffect(() => {
    function handleClick(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) onClose()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  async function marcarComoLida(notifId) {
    await fetch(`${BASE}/api/notifications/${notifId}/read`, { method: 'POST' })
    onRefresh()
  }

  async function marcarTodasComoLidas() {
    await fetch(`${BASE}/api/notifications/${userId}/read-all`, { method: 'POST' })
    onRefresh()
  }

  const temNaoLidas = notifs.some(n => !n.read)

  return (
    // Fundo escuro cobrindo a tela toda
    <div className="fixed inset-0 bg-black/40 z-[60]">
      {/* Painel deslizando de cima */}
      <div
        ref={panelRef}
        className="absolute top-0 left-0 right-0 bg-white rounded-b-2xl shadow-xl max-h-[80vh] flex flex-col"
      >
        {/* Cabeçalho do painel */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-800 text-base">Notificações</h2>
          <div className="flex items-center gap-3">
            {temNaoLidas && (
              <button
                onClick={marcarTodasComoLidas}
                className="text-xs text-primary font-medium"
              >
                Marcar todas como lidas
              </button>
            )}
            <button onClick={onClose}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M18 6L6 18M6 6l12 12" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>

        {/* Lista de notificações */}
        <div className="overflow-y-auto flex-1">
          {notifs.length === 0 && (
            <div className="py-12 text-center text-gray-400 text-sm">
              Nenhuma notificação ainda.
            </div>
          )}

          {notifs.map(n => (
            <div
              key={n.id}
              onClick={() => !n.read && marcarComoLida(n.id)}
              className={`flex items-start gap-3 px-4 py-3 border-b border-gray-50 cursor-pointer transition-colors
                ${n.read ? 'bg-white' : 'bg-orange-50 hover:bg-orange-100'}`}
            >
              <NotifIcon type={n.type} />
              <div className="flex-1 min-w-0">
                <p className={`text-sm leading-snug ${n.read ? 'text-gray-500' : 'text-gray-800 font-medium'}`}>
                  {n.message}
                </p>
                <p className="text-xs text-gray-400 mt-1">{formatarDataHora(n.created_at)}</p>
              </div>
              {!n.read && (
                <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
