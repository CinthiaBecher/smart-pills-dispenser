import { useEffect, useState } from 'react'
import logo from '../assets/logo.png'
import BottomNav from '../components/BottomNav'
import CalendarView from '../components/CalendarView'
import NotificationPanel from '../components/NotificationPanel'

const BASE = 'http://localhost:8000'

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

// ── Gráfico de barras semanal ────────────────────────────────
function WeeklyChart({ dados }) {
  if (!dados.length) return null

  const hoje = new Date().toISOString().slice(0, 10)

  return (
    <div className="flex items-end justify-between gap-1.5 h-20 mt-2">
      {dados.map((d, i) => {
        const isHoje = d.date === hoje
        const altura = d.total > 0 ? Math.max((d.percent / 100) * 100, 6) : 4

        return (
          <div key={i} className="flex flex-col items-center gap-1 flex-1">
            <div className="w-full relative" style={{ height: '56px' }}>
              {/* Fundo cinza */}
              <div className="absolute bottom-0 w-full bg-gray-100 rounded-t-md" style={{ height: '100%' }} />
              {/* Barra de adesão */}
              <div
                className={`absolute bottom-0 w-full rounded-t-md transition-all ${
                  d.percent >= 80 ? 'bg-accent' :
                  d.percent >= 50 ? 'bg-yellow-400' :
                  d.total > 0     ? 'bg-danger' :
                  'bg-gray-200'
                }`}
                style={{ height: `${altura}%` }}
              />
            </div>
            <span className={`text-[9px] font-medium ${isHoje ? 'text-primary' : 'text-gray-400'}`}>
              {d.day}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ── Helpers ─────────────────────────────────────────────────
function formatarHora(isoString) {
  return new Date(isoString).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

// ── Componente principal ─────────────────────────────────────
export default function CaregiverDashboard() {
  const [paciente, setPaciente] = useState(null)
  const [eventos, setEventos] = useState([])
  const [dadosSemana, setDadosSemana] = useState([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')
  const [notifs, setNotifs] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [showNotifs, setShowNotifs] = useState(false)

  const nomeUsuario = localStorage.getItem('userName') || 'Cuidador'
  const caregiverId = localStorage.getItem('userId')

  useEffect(() => {
    async function carregar() {
      try {
        // 1. Busca o paciente vinculado a este cuidador
        const resPaciente = await fetch(`${BASE}/api/caregivers/my-patient/${caregiverId}`)
        if (!resPaciente.ok) {
          setErro('Nenhum paciente vinculado. Peça ao paciente para criar uma conta e informar seu e-mail no cadastro.')
          setLoading(false)
          return
        }
        const dadosPaciente = await resPaciente.json()
        setPaciente(dadosPaciente)

        // 2. Busca eventos de hoje do paciente
        const resEventos = await fetch(`${BASE}/api/dispensation/today/${dadosPaciente.id}`)
        if (resEventos.ok) setEventos(await resEventos.json())

        // 3. Busca dados da semana para o gráfico
        const resSemana = await fetch(`${BASE}/api/dispensation/weekly/${dadosPaciente.id}`)
        if (resSemana.ok) setDadosSemana(await resSemana.json())
      } catch {
        setErro('Não foi possível conectar ao servidor.')
      } finally {
        setLoading(false)
      }
    }
    carregar()
  }, [caregiverId])

  async function carregarNotificacoes() {
    try {
      const [resNotifs, resCount] = await Promise.all([
        fetch(`${BASE}/api/notifications/${caregiverId}`),
        fetch(`${BASE}/api/notifications/${caregiverId}/unread-count`),
      ])
      if (resNotifs.ok) setNotifs(await resNotifs.json())
      if (resCount.ok)  setUnreadCount((await resCount.json()).count)
    } catch (err) {
      console.error('Erro ao carregar notificações:', err)
    }
  }

  useEffect(() => { carregarNotificacoes() }, [caregiverId])

  useEffect(() => {
    const intervalo = setInterval(carregarNotificacoes, 30000)
    return () => clearInterval(intervalo)
  }, [caregiverId])

  const missedHoje = eventos.filter(e => e.status === 'missed')
  const confirmados = eventos.filter(e => e.status === 'confirmed').length
  const total = eventos.length
  const adesaoHoje = total > 0 ? Math.round((confirmados / total) * 100) : null

  // Adesão da semana: média dos dias com dados
  const diasComDados = dadosSemana.filter(d => d.total > 0)
  const adesaoSemana = diasComDados.length > 0
    ? Math.round(diasComDados.reduce((acc, d) => acc + d.percent, 0) / diasComDados.length)
    : null

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
            <div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
            <p className="text-gray-400 text-sm">Carregando dados do paciente...</p>
          </div>
        )}

        {/* Erro: sem vínculo */}
        {!loading && erro && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-5 text-center">
            <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center mx-auto mb-3">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M12 9v4M12 17h.01" stroke="#D97706" strokeWidth="2" strokeLinecap="round" />
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="#D97706" strokeWidth="1.8" strokeLinejoin="round" />
              </svg>
            </div>
            <p className="text-gray-700 text-sm font-semibold">Sem paciente vinculado</p>
            <p className="text-gray-400 text-xs mt-1">{erro}</p>
          </div>
        )}

        {/* Conteúdo principal — só aparece quando tem paciente */}
        {!loading && paciente && (
          <>
            {/* Card: Paciente monitorado */}
            <div className="bg-primary rounded-2xl p-4 text-white">
              <p className="text-white/70 text-xs font-medium uppercase tracking-wider mb-1">Monitorando</p>
              <h2 className="text-lg font-bold">{paciente.name}</h2>
              <p className="text-white/60 text-xs mt-0.5">{paciente.email}</p>

              {adesaoHoje !== null && (
                <div className="flex items-center gap-2 mt-3 bg-white/10 rounded-xl px-3 py-2">
                  <div className="w-2 h-2 rounded-full bg-accent" />
                  <span className="text-sm font-semibold">
                    Adesão hoje: {adesaoHoje}%
                  </span>
                  <span className="text-white/60 text-xs ml-auto">
                    {confirmados}/{total} doses
                  </span>
                </div>
              )}
            </div>

            {/* Alerta: doses perdidas hoje */}
            {missedHoje.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" stroke="#D85A30" strokeWidth="2" strokeLinecap="round" />
                      <path d="M13.73 21a2 2 0 01-3.46 0" stroke="#D85A30" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-red-700">
                      {missedHoje.length === 1 ? '1 dose perdida hoje' : `${missedHoje.length} doses perdidas hoje`}
                    </p>
                    <p className="text-xs text-red-400">O paciente não confirmou as doses abaixo</p>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  {missedHoje.map(e => (
                    <div key={e.event_id} className="flex items-center gap-3 bg-white rounded-xl px-3 py-2 border border-red-100">
                      <MissedIcon />
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{e.medication_name}</p>
                        <p className="text-xs text-gray-400">{e.medication_dosage} · prevista às {formatarHora(e.scheduled_time)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Card: Agenda de hoje (read-only) */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <div className="flex items-center gap-2 mb-4">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="9" stroke="#B5CC18" strokeWidth="2" />
                  <path d="M12 7v5l3 3" stroke="#B5CC18" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <h3 className="font-bold text-gray-800">Doses de hoje</h3>
              </div>

              {eventos.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-2">Nenhuma dose agendada para hoje.</p>
              ) : (
                <div className="flex flex-col divide-y divide-gray-50">
                  {eventos.map(e => (
                    <div key={e.event_id} className="flex items-center gap-4 py-3">
                      <span className="text-sm font-semibold text-gray-600 w-12 shrink-0">
                        {formatarHora(e.scheduled_time)}
                      </span>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-gray-800">{e.medication_name}</p>
                        <p className="text-xs text-gray-400">{e.medication_dosage}</p>
                      </div>
                      {e.status === 'confirmed'                              && <CheckIcon />}
                      {e.status === 'missed'                                 && <MissedIcon />}
                      {(e.status === 'pending' || e.status === 'dispensed') && <ClockIcon />}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Card: Calendário de adesão mensal */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="4" width="18" height="18" rx="2" stroke="#006B5E" strokeWidth="1.8" />
                  <path d="M16 2v4M8 2v4M3 10h18" stroke="#006B5E" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
                Calendário de adesão
              </h3>
              <CalendarView userId={paciente.id} />
            </div>

            {/* Card: Gráfico de adesão semanal */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-bold text-gray-800">Adesão — últimos 7 dias</h3>
                {adesaoSemana !== null && (
                  <span className={`text-sm font-bold ${
                    adesaoSemana >= 80 ? 'text-primary' :
                    adesaoSemana >= 50 ? 'text-yellow-500' :
                    'text-danger'
                  }`}>
                    {adesaoSemana}%
                  </span>
                )}
              </div>

              {diasComDados.length === 0 ? (
                <p className="text-gray-400 text-xs text-center py-4">Nenhum dado de doses confirmadas ainda.</p>
              ) : (
                <>
                  <WeeklyChart dados={dadosSemana} />
                  {/* Legenda */}
                  <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-50">
                    <div className="flex items-center gap-1">
                      <div className="w-2.5 h-2.5 rounded-sm bg-accent" />
                      <span className="text-[10px] text-gray-400">≥80%</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-2.5 h-2.5 rounded-sm bg-yellow-400" />
                      <span className="text-[10px] text-gray-400">50–79%</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-2.5 h-2.5 rounded-sm bg-danger" />
                      <span className="text-[10px] text-gray-400">&lt;50%</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-2.5 h-2.5 rounded-sm bg-gray-200" />
                      <span className="text-[10px] text-gray-400">Sem dados</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </>
        )}

      </main>
      <BottomNav />

      {showNotifs && (
        <NotificationPanel
          userId={caregiverId}
          notifs={notifs}
          onClose={() => setShowNotifs(false)}
          onRefresh={() => { carregarNotificacoes(); setShowNotifs(true) }}
        />
      )}
    </div>
  )
}
