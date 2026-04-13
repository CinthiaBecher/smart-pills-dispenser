import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BottomNav from '../components/BottomNav'
import CalendarView from '../components/CalendarView'

const BASE = 'http://localhost:8000'
const OPCOES_TIMEOUT = [15, 30, 45, 60]

// Agrupa medicamentos pela data de criação (cada grupo = uma receita)
function agruparPorData(medicamentos) {
  const grupos = {}
  medicamentos.forEach(med => {
    const data = med.created_at
      ? new Date(med.created_at).toLocaleDateString('pt-BR')
      : 'Data desconhecida'
    if (!grupos[data]) grupos[data] = []
    grupos[data].push(med)
  })
  // Retorna do mais recente pro mais antigo
  return Object.entries(grupos).sort((a, b) => {
    const [d, m, y] = a[0].split('/').map(Number)
    const [d2, m2, y2] = b[0].split('/').map(Number)
    return new Date(y2, m2 - 1, d2) - new Date(y, m - 1, d)
  })
}

function iniciais(nome) {
  return nome
    .split(' ')
    .slice(0, 2)
    .map(p => p[0])
    .join('')
    .toUpperCase()
}

function badgeRole(role) {
  if (role === 'caregiver') return { texto: 'Cuidador', cor: 'bg-blue-100 text-blue-700' }
  return { texto: 'Paciente', cor: 'bg-green-100 text-primary' }
}

export default function Perfil() {
  const navigate = useNavigate()
  const [usuario, setUsuario] = useState(null)
  const [medicamentos, setMedicamentos] = useState([])
  const [horariosPorMed, setHorariosPorMed] = useState({})
  const [loading, setLoading] = useState(true)
  const [salvandoTimeout, setSalvandoTimeout] = useState(false)
  const [timeout, setTimeout_] = useState(30)
  const [cuidadores, setCuidadores] = useState([])
  const [emailCuidador, setEmailCuidador] = useState('')
  const [adicionando, setAdicionando] = useState(false)
  const [erroCuidador, setErroCuidador] = useState('')

  const userId = localStorage.getItem('userId')

  useEffect(() => {
    async function carregar() {
      try {
        // Busca dados do usuário
        const resUser = await fetch(`${BASE}/api/users/${userId}`)
        if (resUser.ok) {
          const u = await resUser.json()
          setUsuario(u)
          setTimeout_(u.notification_timeout_minutes ?? 30)
        }

        // Busca cuidadores do paciente
        const resCuid = await fetch(`${BASE}/api/caregivers/${userId}`)
        if (resCuid.ok) setCuidadores(await resCuid.json())

        // Busca medicamentos ativos
        const resMeds = await fetch(`${BASE}/api/medications/user/${userId}`)
        if (resMeds.ok) {
          const meds = await resMeds.json()
          const ativos = meds.filter(m => m.active !== false)
          setMedicamentos(ativos)

          // Busca horários de cada medicamento
          const horariosMap = {}
          await Promise.all(ativos.map(async (med) => {
            const res = await fetch(`${BASE}/api/schedules/medication/${med.id}`)
            horariosMap[med.id] = res.ok ? await res.json() : []
          }))
          setHorariosPorMed(horariosMap)
        }
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    carregar()
  }, [userId])

  async function salvarTimeout(valor) {
    setTimeout_(valor)
    setSalvandoTimeout(true)
    try {
      await fetch(`${BASE}/api/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notification_timeout_minutes: valor }),
      })
    } catch (err) {
      console.error('Erro ao salvar timeout:', err)
    } finally {
      setSalvandoTimeout(false)
    }
  }

  async function adicionarCuidador() {
    if (!emailCuidador.trim()) return
    setErroCuidador('')
    setAdicionando(true)
    try {
      const res = await fetch(`${BASE}/api/caregivers/${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caregiver_email: emailCuidador.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { setErroCuidador(data.detail); return }
      setEmailCuidador('')
      // Recarrega lista
      const res2 = await fetch(`${BASE}/api/caregivers/${userId}`)
      if (res2.ok) setCuidadores(await res2.json())
    } catch {
      setErroCuidador('Erro ao adicionar. Tente novamente.')
    } finally {
      setAdicionando(false)
    }
  }

  async function removerCuidador(vinculoId) {
    try {
      await fetch(`${BASE}/api/caregivers/${userId}/${vinculoId}`, { method: 'DELETE' })
      setCuidadores(prev => prev.filter(c => c.id !== vinculoId))
    } catch {
      console.error('Erro ao remover cuidador')
    }
  }

  function logout() {
    localStorage.removeItem('userId')
    localStorage.removeItem('userName')
    localStorage.removeItem('userRole')
    navigate('/login')
  }

  const badge = usuario ? badgeRole(usuario.role) : null

  return (
    <div className="min-h-screen bg-background pb-24">

      {/* Header */}
      <header className="bg-background px-4 pt-4 pb-2 flex items-center sticky top-0 z-40">
        <button onClick={() => navigate('/dashboard')} className="text-primary mr-3">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M19 12H5M12 5l-7 7 7 7" stroke="#006B5E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <h1 className="text-lg font-bold text-primary">Perfil</h1>
      </header>

      <main className="px-4 pt-2 flex flex-col gap-4">

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center gap-3" style={{ minHeight: 'calc(100vh - 120px)' }}>
            <div className="w-14 h-14 rounded-full bg-accent flex items-center justify-center">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                <path d="M4.5 12.5L11.5 5.5C13.5 3.5 16.5 3.5 18.5 5.5C20.5 7.5 20.5 10.5 18.5 12.5L11.5 19.5C9.5 21.5 6.5 21.5 4.5 19.5C2.5 17.5 2.5 14.5 4.5 12.5Z" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="8.5" y1="15.5" x2="15.5" y2="8.5" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <p className="text-gray-400">Carregando...</p>
          </div>
        )}

        {!loading && usuario && (
          <>
            {/* Card do usuário */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex items-center gap-4">
              {/* Avatar com iniciais */}
              <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center shrink-0">
                <span className="text-white text-xl font-bold">{iniciais(usuario.name)}</span>
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="font-bold text-gray-800 text-base truncate">{usuario.name}</h2>
                <p className="text-gray-400 text-sm truncate">{usuario.email}</p>
                <span className={`inline-block mt-1 text-xs font-semibold px-2 py-0.5 rounded-full ${badge.cor}`}>
                  {badge.texto}
                </span>
              </div>
            </div>

            {/* Link para o histórico de receitas */}
            <button
              onClick={() => navigate('/receitas')}
              className="w-full bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center justify-between hover:border-primary transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="#006B5E" strokeWidth="1.5" strokeLinejoin="round" />
                    <polyline points="14 2 14 8 20 8" stroke="#006B5E" strokeWidth="1.5" strokeLinejoin="round" />
                    <line x1="16" y1="13" x2="8" y2="13" stroke="#006B5E" strokeWidth="1.5" strokeLinecap="round" />
                    <line x1="16" y1="17" x2="8" y2="17" stroke="#006B5E" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </div>
                <div className="text-left">
                  <p className="text-sm font-bold text-gray-800">Receitas escaneadas</p>
                  <p className="text-xs text-gray-400">Ver histórico de prescrições</p>
                </div>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-gray-300">
                <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            {/* Calendário de adesão — só para pacientes */}
            {usuario.role === 'patient' && (
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <rect x="3" y="4" width="18" height="18" rx="2" stroke="#006B5E" strokeWidth="1.8" />
                    <path d="M16 2v4M8 2v4M3 10h18" stroke="#006B5E" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                  Calendário de adesão
                </h3>
                <CalendarView userId={userId} />
              </div>
            )}

            {/* Card de notificações */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <h3 className="font-bold text-gray-800 mb-1 flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" stroke="#006B5E" strokeWidth="1.8" strokeLinecap="round" />
                  <path d="M13.73 21a2 2 0 01-3.46 0" stroke="#006B5E" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
                Alerta de dose perdida
              </h3>
              <p className="text-gray-400 text-xs mb-3">
                Notificar se a dose não for confirmada após:
              </p>
              <div className="flex gap-2">
                {OPCOES_TIMEOUT.map(op => (
                  <button
                    key={op}
                    onClick={() => salvarTimeout(op)}
                    disabled={salvandoTimeout}
                    className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-colors border ${
                      timeout === op
                        ? 'bg-primary text-white border-primary'
                        : 'bg-gray-50 text-gray-500 border-gray-100 hover:border-primary hover:text-primary'
                    }`}
                  >
                    {op}min
                  </button>
                ))}
              </div>
              {salvandoTimeout && (
                <p className="text-xs text-gray-400 mt-2 text-center">Salvando...</p>
              )}
            </div>

            {/* Card de cuidadores — só para pacientes */}
            {usuario.role === 'patient' && (
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <circle cx="9" cy="7" r="4" stroke="#006B5E" strokeWidth="1.8" />
                    <path d="M3 21v-2a4 4 0 014-4h4a4 4 0 014 4v2" stroke="#006B5E" strokeWidth="1.8" strokeLinecap="round" />
                    <path d="M19 8v6M16 11h6" stroke="#006B5E" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                  Meus cuidadores
                </h3>

                {/* Lista de cuidadores */}
                {cuidadores.length === 0 ? (
                  <p className="text-gray-400 text-sm mb-3">Nenhum cuidador vinculado.</p>
                ) : (
                  <div className="flex flex-col gap-2 mb-3">
                    {cuidadores.map(c => (
                      <div key={c.id} className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2">
                        <div>
                          <p className="text-sm font-semibold text-gray-800">{c.name}</p>
                          <p className="text-xs text-gray-400">{c.email}</p>
                        </div>
                        <button
                          onClick={() => removerCuidador(c.id)}
                          className="text-danger hover:opacity-70 p-1"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                            <polyline points="3 6 5 6 21 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                            <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Adicionar por email */}
                <div className="flex gap-2">
                  <input
                    type="email"
                    placeholder="E-mail do cuidador"
                    value={emailCuidador}
                    onChange={e => setEmailCuidador(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && adicionarCuidador()}
                    className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-primary transition-colors"
                  />
                  <button
                    onClick={adicionarCuidador}
                    disabled={adicionando || !emailCuidador.trim()}
                    className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shrink-0 disabled:opacity-40"
                  >
                    {adicionando ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <path d="M12 5v14M5 12h14" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
                      </svg>
                    )}
                  </button>
                </div>
                {erroCuidador && (
                  <p className="text-danger text-xs mt-2">{erroCuidador}</p>
                )}
              </div>
            )}

            {/* Botão de logout */}
            <button
              onClick={logout}
              className="w-full flex items-center justify-center gap-2 border-2 border-danger text-danger font-semibold rounded-full py-3 hover:bg-red-50 transition-colors"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <polyline points="16 17 21 12 16 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <line x1="21" y1="12" x2="9" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              Sair da conta
            </button>
          </>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
