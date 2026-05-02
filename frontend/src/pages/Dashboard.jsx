import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import logo from '../assets/logo.png'
import BottomNav from '../components/BottomNav'
import NotificationPanel from '../components/NotificationPanel'

const BASE = 'http://localhost:8000'
const DIAS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

// ── Ícones de status ────────────────────────────────────────
function CheckIcon() {
  return (
    <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <path d="M5 13l4 4L19 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  )
}

function ClockIcon() {
  return (
    <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="9" stroke="#F59E0B" strokeWidth="2" />
        <path d="M12 7v5l3 3" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </div>
  )
}

function MissedIcon() {
  return (
    <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center shrink-0">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="9" stroke="#D85A30" strokeWidth="2" />
        <path d="M15 9l-6 6M9 9l6 6" stroke="#D85A30" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </div>
  )
}

// ── Gráfico circular ────────────────────────────────────────
function CircularProgress({ percent }) {
  const raio = 30
  const circunferencia = 2 * Math.PI * raio
  const preenchido = (percent / 100) * circunferencia

  return (
    <svg width="80" height="80" viewBox="0 0 80 80">
      <circle cx="40" cy="40" r={raio} fill="none" stroke="#E5E7EB" strokeWidth="7" />
      <circle
        cx="40" cy="40" r={raio}
        fill="none" stroke="#B5CC18" strokeWidth="7"
        strokeDasharray={`${preenchido} ${circunferencia}`}
        strokeLinecap="round"
        transform="rotate(-90 40 40)"
      />
      <text x="40" y="45" textAnchor="middle" fontSize="14" fontWeight="700" fill="#006B5E">
        {percent}%
      </text>
    </svg>
  )
}

// ── Helpers ─────────────────────────────────────────────────
function formatarHora(isoString) {
  // Converte "2026-04-11T08:00:00" → "08:00"
  return new Date(isoString).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function tempoAte(isoString) {
  const diff = new Date(isoString) - new Date()
  if (diff <= 0) return null
  const horas = Math.floor(diff / 3600000)
  const minutos = Math.floor((diff % 3600000) / 60000)
  if (horas > 0) return `${horas}h${minutos > 0 ? `${minutos}min` : ''}`
  return `${minutos}min`
}

function mensagemAdesao(percent) {
  if (percent >= 80) return 'Excelente! Continue assim.'
  if (percent >= 60) return 'Bom progresso!'
  if (percent > 0)  return 'Vamos melhorar!'
  return 'Nenhuma dose confirmada hoje.'
}

// ── Componente principal ─────────────────────────────────────
export default function Dashboard() {
  const navigate = useNavigate()
  const [eventos, setEventos] = useState([])
  const [loading, setLoading] = useState(true)
  const [acionando, setAcionando] = useState(null)
  const [notifs, setNotifs] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [showNotifs, setShowNotifs] = useState(false)

  const nomeUsuario = localStorage.getItem('userName') || 'Você'
  const userId = localStorage.getItem('userId') || '1'

  async function carregarEventos() {
    try {
      const res = await fetch(`${BASE}/api/dispensation/today/${userId}`)
      if (res.ok) setEventos(await res.json())
    } catch (err) {
      console.error('Erro ao carregar agenda:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { carregarEventos() }, [userId])

  // Auto-refresh a cada 5s para refletir confirmação do ESP32 automaticamente
  useEffect(() => {
    const intervalo = setInterval(carregarEventos, 5000)
    return () => clearInterval(intervalo)
  }, [userId])

  async function carregarNotificacoes() {
    try {
      const [resNotifs, resCount] = await Promise.all([
        fetch(`${BASE}/api/notifications/${userId}`),
        fetch(`${BASE}/api/notifications/${userId}/unread-count`),
      ])
      if (resNotifs.ok) setNotifs(await resNotifs.json())
      if (resCount.ok)  setUnreadCount((await resCount.json()).count)
    } catch (err) {
      console.error('Erro ao carregar notificações:', err)
    }
  }

  useEffect(() => { carregarNotificacoes() }, [userId])

  // Polling de notificações a cada 30s
  useEffect(() => {
    const intervalo = setInterval(carregarNotificacoes, 30000)
    return () => clearInterval(intervalo)
  }, [userId])

  async function acionarDispenser(eventId) {
    setAcionando(eventId)
    try {
      const res = await fetch(`${BASE}/api/dispensation/trigger/${eventId}`, {
        method: 'POST',
      })
      if (res.ok) await carregarEventos()
    } catch (err) {
      console.error('Erro ao acionar dispenser:', err)
    } finally {
      setAcionando(null)
    }
  }

  // Próxima dose: primeiro evento pendente ou dispensado
  const proximaDose = eventos.find(e => e.status === 'pending' || e.status === 'dispensed')

  // Adesão: % de doses confirmadas hoje
  const total = eventos.length
  const confirmados = eventos.filter(e => e.status === 'confirmed').length
  const adesao = total > 0 ? Math.round((confirmados / total) * 100) : 0

  // Indicador de dias (bolinhas)
  const hoje = new Date().getDay()
  const diasSemana = DIAS.map((d, i) => ({ letra: d, ativo: i <= hoje }))

  return (
    <div className="min-h-screen bg-background pb-24">

      {/* Header */}
      <header className="bg-white px-4 py-3 flex items-center justify-between shadow-sm sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <img src={logo} alt="Dose Certa" className="w-8 h-8 object-contain" />
          <span className="font-bold text-primary text-base">Dose Certa</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-gray-500 text-sm">
            Olá, <span className="font-semibold text-gray-700">{nomeUsuario}</span>
          </span>
          <button className="relative" onClick={() => setShowNotifs(true)}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" stroke="#6B7280" strokeWidth="1.8" strokeLinecap="round" />
              <path d="M13.73 21a2 2 0 01-3.46 0" stroke="#6B7280" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-white text-[9px] font-bold flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
        </div>
      </header>

      <main className="px-4 pt-4 flex flex-col gap-4">

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-14 h-14 rounded-full bg-accent flex items-center justify-center">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                <path d="M4.5 12.5L11.5 5.5C13.5 3.5 16.5 3.5 18.5 5.5C20.5 7.5 20.5 10.5 18.5 12.5L11.5 19.5C9.5 21.5 6.5 21.5 4.5 19.5C2.5 17.5 2.5 14.5 4.5 12.5Z" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="8.5" y1="15.5" x2="15.5" y2="8.5" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <p className="text-gray-400">Carregando...</p>
          </div>
        )}

        {/* Card: Próxima Dose */}
        {!loading && proximaDose && (
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <span className="bg-green-100 text-primary text-xs font-semibold px-3 py-1 rounded-full flex items-center gap-1">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="9" stroke="#006B5E" strokeWidth="2" />
                  <path d="M12 7v5l3 3" stroke="#006B5E" strokeWidth="2" strokeLinecap="round" />
                </svg>
                No horário
              </span>
              <span className="text-gray-400 text-xs">Próxima dose</span>
            </div>

            <h2 className="text-xl font-bold text-gray-800">{proximaDose.medication_name}</h2>
            <p className="text-gray-500 text-sm mb-3">{proximaDose.medication_dosage} · 1 comprimido</p>

            {tempoAte(proximaDose.scheduled_time) && (
              <div className="flex items-center gap-2 mb-4">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="9" stroke="#F59E0B" strokeWidth="2" />
                  <path d="M12 7v5l3 3" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <span className="text-gray-600 text-sm">
                  Próxima dose em <strong>{tempoAte(proximaDose.scheduled_time)}</strong>
                </span>
              </div>
            )}

            {proximaDose.status === 'pending' && (
              <button
                onClick={() => acionarDispenser(proximaDose.event_id)}
                disabled={acionando === proximaDose.event_id}
                className="w-full bg-primary hover:bg-primary/90 text-white font-semibold rounded-full py-3 text-sm transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {acionando === proximaDose.event_id ? 'Acionando...' : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path d="M5 3l14 9-14 9V3z" fill="white" />
                    </svg>
                    Acionar Dispenser
                  </>
                )}
              </button>
            )}

            {proximaDose.status === 'dispensed' && (
              <div className="w-full bg-orange-50 border border-orange-200 rounded-full py-3 text-sm text-orange-600 font-semibold text-center">
                Aguardando retirada no dispenser...
              </div>
            )}
          </div>
        )}

        {/* Sem doses hoje */}
        {!loading && eventos.length === 0 && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 text-center">
            <p className="text-gray-400 text-sm">Nenhuma dose agendada para hoje.</p>
          </div>
        )}

        {/* Card: Agenda de Hoje */}
        {!loading && eventos.length > 0 && (
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-4">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="9" stroke="#B5CC18" strokeWidth="2" />
                <path d="M12 7v5l3 3" stroke="#B5CC18" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <h3 className="font-bold text-gray-800">Agenda de Hoje</h3>
            </div>

            <div className="flex flex-col divide-y divide-gray-50">
              {eventos.map((e) => (
                <div key={e.event_id} className="flex items-center gap-4 py-3">
                  <span className="text-sm font-semibold text-gray-600 w-12 shrink-0">
                    {formatarHora(e.scheduled_time)}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-800">{e.medication_name}</p>
                    <p className="text-xs text-gray-400">{e.medication_dosage}</p>
                  </div>
                  {e.status === 'confirmed'  && <CheckIcon />}
                  {e.status === 'missed'     && <MissedIcon />}
                  {(e.status === 'pending' || e.status === 'dispensed') && <ClockIcon />}
                </div>
              ))}
            </div>

            <button
              onClick={() => navigate('/medicamentos')}
              className="flex items-center justify-between w-full mt-3 pt-3 border-t border-gray-100 text-primary text-sm font-medium"
            >
              <span>Ver todos os medicamentos</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M9 18l6-6-6-6" stroke="#006B5E" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        )}

        {/* Card: Adesão */}
        {!loading && total > 0 && (
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-4">
              <CircularProgress percent={adesao} />
              <div>
                <h3 className="font-bold text-gray-800">Adesão esta semana</h3>
                <p className="text-gray-500 text-sm mt-1">{mensagemAdesao(adesao)}</p>
                <div className="flex gap-2 mt-3">
                  {diasSemana.map((d, i) => (
                    <div key={i} className="flex flex-col items-center gap-1">
                      <div className={`w-5 h-5 rounded-full ${d.ativo ? 'bg-accent' : 'bg-gray-200'}`} />
                      <span className="text-[9px] text-gray-400">{d.letra}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

      </main>
      <BottomNav />

      {showNotifs && (
        <NotificationPanel
          userId={userId}
          notifs={notifs}
          onClose={() => setShowNotifs(false)}
          onRefresh={() => { carregarNotificacoes(); setShowNotifs(true) }}
        />
      )}
    </div>
  )
}
