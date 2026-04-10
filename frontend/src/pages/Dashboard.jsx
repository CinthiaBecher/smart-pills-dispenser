import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import logo from '../assets/logo.png'
import BottomNav from '../components/BottomNav'

const BASE = 'http://localhost:8000'

// Dias da semana em português (S T Q Q S S D)
const DIAS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

// Ícone de check verde
function CheckIcon() {
  return (
    <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <path d="M5 13l4 4L19 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  )
}

// Ícone de relógio laranja (pendente)
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

// Gráfico circular de adesão (SVG puro)
function CircularProgress({ percent }) {
  const raio = 30
  const circunferencia = 2 * Math.PI * raio
  const preenchido = (percent / 100) * circunferencia

  return (
    <svg width="80" height="80" viewBox="0 0 80 80">
      {/* Trilha cinza */}
      <circle cx="40" cy="40" r={raio} fill="none" stroke="#E5E7EB" strokeWidth="7" />
      {/* Arco verde */}
      <circle
        cx="40" cy="40" r={raio}
        fill="none"
        stroke="#B5CC18"
        strokeWidth="7"
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

export default function Dashboard() {
  const navigate = useNavigate()
  const [medicamentos, setMedicamentos] = useState([])
  const [loading, setLoading] = useState(true)

  // Usuário salvo no login — por ora usa ID fixo para demo
  const nomeUsuario = localStorage.getItem('userName') || 'Cinthia'
  const userId = localStorage.getItem('userId') || '1'

  useEffect(() => {
    async function carregarMedicamentos() {
      try {
        const res = await fetch(`${BASE}/api/medications/user/${userId}`)
        if (res.ok) {
          const data = await res.json()
          setMedicamentos(data)
        }
      } catch (err) {
        console.error('Erro ao carregar medicamentos:', err)
      } finally {
        setLoading(false)
      }
    }
    carregarMedicamentos()
  }, [userId])

  // Agenda do dia: usa os medicamentos reais, horários fixos para demo
  // TODO: buscar horários reais dos agendamentos quando endpoint estiver disponível
  const agendaHoje = [
    { hora: '08:00', nome: 'Metformina', dosagem: '850mg', confirmado: true },
    { hora: '12:00', nome: 'Losartana', dosagem: '50mg', confirmado: true },
    { hora: '14:30', nome: 'Omeprazol', dosagem: '20mg', confirmado: false },
    { hora: '20:00', nome: 'Atenolol', dosagem: '25mg', confirmado: false },
    { hora: '22:00', nome: 'Sinvastatina', dosagem: '20mg', confirmado: false },
  ]

  // Próxima dose = primeiro item não confirmado
  const proximaDose = agendaHoje.find((a) => !a.confirmado)

  // Adesão: % de confirmados hoje
  const adesaoSemana = 87

  // Dias da semana para o indicador (hoje = índice do dia atual)
  const hoje = new Date().getDay() // 0=dom, 1=seg...
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
          <span className="text-gray-500 text-sm">Olá, <span className="font-semibold text-gray-700">{nomeUsuario}</span></span>
          <button className="relative">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" stroke="#6B7280" strokeWidth="1.8" strokeLinecap="round" />
              <path d="M13.73 21a2 2 0 01-3.46 0" stroke="#6B7280" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            <span className="absolute -top-1 -right-1 bg-danger text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
              2
            </span>
          </button>
        </div>
      </header>

      <main className="px-4 pt-4 flex flex-col gap-4">

        {/* Card: Próxima Dose */}
        {proximaDose && (
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

            <h2 className="text-xl font-bold text-gray-800">{proximaDose.nome}</h2>
            <p className="text-gray-500 text-sm mb-3">{proximaDose.dosagem} · 1 comprimido</p>

            <div className="flex items-center gap-2 text-orange-500 text-sm mb-4">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="9" stroke="#F59E0B" strokeWidth="2" />
                <path d="M12 7v5l3 3" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <span className="text-gray-600 text-sm">Próxima dose em <strong>2h30min</strong></span>
            </div>

            <button className="w-full bg-accent hover:bg-accent-dark text-white font-semibold rounded-full py-3 text-sm transition-colors">
              Confirmar retirada
            </button>
          </div>
        )}

        {/* Card: Agenda de Hoje */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-4">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke="#B5CC18" strokeWidth="2" />
              <path d="M12 7v5l3 3" stroke="#B5CC18" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <h3 className="font-bold text-gray-800">Agenda de Hoje</h3>
          </div>

          <div className="flex flex-col divide-y divide-gray-50">
            {agendaHoje.map((item, i) => (
              <div key={i} className="flex items-center gap-4 py-3">
                <span className="text-sm font-semibold text-gray-600 w-12 shrink-0">{item.hora}</span>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-800">{item.nome}</p>
                  <p className="text-xs text-gray-400">{item.dosagem}</p>
                </div>
                {item.confirmado ? <CheckIcon /> : <ClockIcon />}
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

        {/* Card: Adesão esta semana */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-4">
            <CircularProgress percent={adesaoSemana} />
            <div>
              <h3 className="font-bold text-gray-800">Adesão esta semana</h3>
              <p className="text-gray-500 text-sm mt-1">Excelente! Continue assim.</p>
              {/* Indicador dos dias */}
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

      </main>

      <BottomNav />
    </div>
  )
}
