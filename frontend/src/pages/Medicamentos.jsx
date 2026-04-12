import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BottomNav from '../components/BottomNav'

const BASE = 'http://localhost:8000'

function PilulIcon() {
  return (
    <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center shrink-0">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path
          d="M4.5 12.5L11.5 5.5C13.5 3.5 16.5 3.5 18.5 5.5C20.5 7.5 20.5 10.5 18.5 12.5L11.5 19.5C9.5 21.5 6.5 21.5 4.5 19.5C2.5 17.5 2.5 14.5 4.5 12.5Z"
          stroke="#006B5E"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <line x1="8.5" y1="15.5" x2="15.5" y2="8.5" stroke="#006B5E" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    </div>
  )
}

// Calcula quantos dias restam de um tratamento com prazo
function diasRestantes(med) {
  if (!med.duration_days || !med.start_date) return null
  const fim  = new Date(med.start_date)
  fim.setDate(fim.getDate() + med.duration_days)
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  fim.setHours(0, 0, 0, 0)
  return Math.ceil((fim - hoje) / (1000 * 60 * 60 * 24))
}

function CardMedicamento({ med, horarios }) {
  const [menuAberto, setMenuAberto] = useState(false)
  const ativo   = med.active !== false
  const restam  = diasRestantes(med)

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
      <div className="flex items-start gap-3">
        <PilulIcon />

        <div className="flex-1 min-w-0">
          {/* Nome + badges + menu */}
          <div className="flex items-center justify-between gap-2 mb-1">
            <h3 className="font-bold text-gray-800 text-sm leading-tight">{med.name}</h3>
            <div className="flex items-center gap-2 shrink-0">
              {/* Badge de dias restantes — só para tratamentos temporários */}
              {restam !== null && restam > 0 && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-orange-100 text-orange-600">
                  {restam}d restantes
                </span>
              )}
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                ativo
                  ? 'bg-green-100 text-primary'
                  : 'bg-gray-100 text-gray-400'
              }`}>
                {ativo ? 'Ativo' : 'Inativo'}
              </span>
              <div className="relative">
                <button
                  onClick={() => setMenuAberto(!menuAberto)}
                  className="text-gray-400 hover:text-gray-600 p-1"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <circle cx="12" cy="5" r="1.5" />
                    <circle cx="12" cy="12" r="1.5" />
                    <circle cx="12" cy="19" r="1.5" />
                  </svg>
                </button>
                {menuAberto && (
                  <div className="absolute right-0 top-6 bg-white rounded-xl shadow-lg border border-gray-100 z-10 py-1 w-36">
                    <button className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                      Editar
                    </button>
                    <button className="w-full text-left px-4 py-2 text-sm text-danger hover:bg-red-50">
                      Remover
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Dosagem e via */}
          <p className="text-gray-500 text-xs mb-1">
            {med.dosage}{med.route ? ` — ${med.route}` : ''}
          </p>

          {/* Instruções */}
          {med.instructions && (
            <p className="text-gray-400 text-xs mb-2">
              Instruções: {med.instructions}
            </p>
          )}

          {/* Horários */}
          {horarios.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="9" stroke="#9CA3AF" strokeWidth="2" />
                <path d="M12 7v5l3 3" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" />
              </svg>
              {horarios.map((h, i) => (
                <span key={i} className="text-xs font-medium text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">
                  {h.time}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function Medicamentos() {
  const navigate = useNavigate()
  const [medicamentos, setMedicamentos] = useState([])
  const [horariosPorMed, setHorariosPorMed] = useState({})
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')

  const userId = localStorage.getItem('userId') || '1'

  useEffect(() => {
    async function carregar() {
      try {
        // 1. Busca medicamentos do usuário
        const resMeds = await fetch(`${BASE}/api/medications/user/${userId}`)
        if (!resMeds.ok) throw new Error('Erro ao carregar medicamentos')
        const meds = await resMeds.json()
        setMedicamentos(meds)

        // 2. Para cada medicamento, busca os horários
        const horariosMap = {}
        await Promise.all(
          meds.map(async (med) => {
            try {
              const resHor = await fetch(`${BASE}/api/schedules/medication/${med.id}`)
              if (resHor.ok) {
                horariosMap[med.id] = await resHor.json()
              } else {
                horariosMap[med.id] = []
              }
            } catch {
              horariosMap[med.id] = []
            }
          })
        )
        setHorariosPorMed(horariosMap)
      } catch (err) {
        setErro('Não foi possível carregar os medicamentos.')
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    carregar()
  }, [userId])

  return (
    <div className="min-h-screen bg-background pb-24">

      {/* Header — sempre visível */}
      <header className="bg-background px-4 pt-4 pb-2 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/dashboard')} className="text-primary">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M19 12H5M12 5l-7 7 7 7" stroke="#006B5E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <h1 className="text-lg font-bold text-primary">Meus Medicamentos</h1>
        </div>
        <button
          onClick={() => alert('Adicionar medicamento — em breve!')}
          className="w-9 h-9 rounded-full bg-primary flex items-center justify-center shadow-sm"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M12 5v14M5 12h14" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </button>
      </header>

      {/* Conteúdo — loading, erro ou lista */}
      <main className="px-4 pt-2 flex flex-col gap-3">
        {loading && (
          <div className="flex flex-col items-center justify-center gap-4" style={{ minHeight: 'calc(100vh - 120px)' }}>
            <div className="w-14 h-14 rounded-full bg-accent flex items-center justify-center">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                <path d="M4.5 12.5L11.5 5.5C13.5 3.5 16.5 3.5 18.5 5.5C20.5 7.5 20.5 10.5 18.5 12.5L11.5 19.5C9.5 21.5 6.5 21.5 4.5 19.5C2.5 17.5 2.5 14.5 4.5 12.5Z" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="8.5" y1="15.5" x2="15.5" y2="8.5" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <p className="text-gray-400 text-base">Carregando...</p>
          </div>
        )}

        {!loading && erro && (
          <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-danger text-sm text-center">
            {erro}
          </div>
        )}

        {!loading && !erro && medicamentos.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <path d="M4.5 12.5L11.5 5.5C13.5 3.5 16.5 3.5 18.5 5.5C20.5 7.5 20.5 10.5 18.5 12.5L11.5 19.5C9.5 21.5 6.5 21.5 4.5 19.5C2.5 17.5 2.5 14.5 4.5 12.5Z" stroke="#9CA3AF" strokeWidth="1.8" />
              </svg>
            </div>
            <p className="text-gray-400 text-sm">Nenhum medicamento cadastrado.</p>
            <p className="text-gray-300 text-xs mt-1">Toque no + para adicionar.</p>
          </div>
        )}

        {!loading && !erro && medicamentos.map((med) => (
          <CardMedicamento
            key={med.id}
            med={med}
            horarios={horariosPorMed[med.id] || []}
          />
        ))}
      </main>

      {/* Nav — sempre visível */}
      <BottomNav />
    </div>
  )
}
