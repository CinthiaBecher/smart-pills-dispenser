import { useEffect, useState, useCallback } from 'react'

const BASE = 'http://localhost:8000'

const MESES = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
]
const DIAS_SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

function corDoDia(status) {
  switch (status) {
    case 'full':        return { bg: 'bg-[#2D9E75]', text: 'text-white' }
    case 'partial':     return { bg: 'bg-[#D85A30]', text: 'text-white' }
    case 'missed':      return { bg: 'bg-[#D85A30]', text: 'text-white' }
    case 'in_progress': return { bg: 'bg-[#EFF5C8]', text: 'text-[#4A6000]' }
    case 'future':      return { bg: 'bg-blue-50',   text: 'text-blue-300' }
    default:            return { bg: 'bg-gray-100',   text: 'text-gray-400' }
  }
}

function formatarHora(isoString) {
  return new Date(isoString).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

// ── Ícone de status de cada dose ──────────────────────────────
function StatusDot({ status }) {
  if (status === 'confirmed') {
    return (
      <div className="w-5 h-5 rounded-full bg-[#2D9E75] flex items-center justify-center shrink-0">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
          <path d="M5 13l4 4L19 7" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    )
  }
  if (status === 'missed') {
    return (
      <div className="w-5 h-5 rounded-full bg-[#D85A30] flex items-center justify-center shrink-0">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
          <path d="M18 6L6 18M6 6l12 12" stroke="white" strokeWidth="3" strokeLinecap="round" />
        </svg>
      </div>
    )
  }
  // pending / dispensed
  return (
    <div className="w-5 h-5 rounded-full bg-orange-200 flex items-center justify-center shrink-0">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="8" stroke="#D97706" strokeWidth="2.5" />
        <path d="M12 8v4l2 2" stroke="#D97706" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </div>
  )
}

// ── Accordion de detalhes do dia ──────────────────────────────
// Carrega eventos imediatamente — resumo usa dados reais, não cache do calendário
// Para dias futuros: consulta agendamentos e mostra "X doses agendadas"
function DayDetail({ userId, diaSel }) {
  const [expandido, setExpandido] = useState(false)
  const [eventos, setEventos]     = useState([])
  const [loading, setLoading]     = useState(true)

  const hojeStr  = new Date().toISOString().slice(0, 10)
  const isFuturo = diaSel.date > hojeStr

  useEffect(() => {
    async function buscar() {
      setLoading(true)
      setExpandido(false)
      try {
        const res = await fetch(`${BASE}/api/dispensation/day/${userId}?date_str=${diaSel.date}`)
        if (res.ok) setEventos(await res.json())
      } catch { /* silencioso */ }
      finally { setLoading(false) }
    }
    buscar()
  }, [userId, diaSel.date])

  const confirmadas = eventos.filter(e => e.status === 'confirmed').length
  const faltaram    = eventos.filter(e => e.status !== 'confirmed').length

  return (
    <div className="mt-3 bg-gray-50 rounded-xl border border-gray-100 overflow-hidden">

      {/* Resumo compacto — toque expande/fecha */}
      <button
        onClick={() => !loading && setExpandido(v => !v)}
        className="w-full flex items-center justify-between px-3 py-2.5 text-left"
      >
        {loading ? (
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            <span className="text-xs text-gray-400">Carregando...</span>
          </div>
        ) : isFuturo ? (
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-blue-300" />
            <span className="text-xs font-semibold text-gray-700">
              {eventos.length} dose{eventos.length !== 1 ? 's' : ''} agendada{eventos.length !== 1 ? 's' : ''}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-[#2D9E75]" />
              <span className="text-xs font-semibold text-gray-700">Tomou {confirmadas}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-[#D85A30]" />
              <span className="text-xs font-semibold text-gray-700">Faltou {faltaram}</span>
            </div>
          </div>
        )}

        {!loading && (expandido ? (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="text-gray-400 shrink-0">
            <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-gray-400 shrink-0">
            <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        ))}
      </button>

      {/* Lista de medicamentos */}
      {expandido && (
        <div className="border-t border-gray-100">
          {eventos.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-4">
              {isFuturo ? 'Nenhuma dose agendada para este dia.' : 'Nenhum evento registrado.'}
            </p>
          ) : (
            <div className="divide-y divide-gray-100">
              {eventos.map((e, i) => (
                <div key={e.event_id ?? `future-${i}`} className="flex items-center gap-3 px-3 py-2">
                  <StatusDot status={e.status} />
                  <span className="flex-1 text-sm text-gray-800 truncate">
                    {e.medication_name}{' '}
                    <span className="text-gray-400 font-normal">{e.medication_dosage}</span>
                  </span>
                  <span className="text-xs text-gray-400 shrink-0">{formatarHora(e.scheduled_time)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────
export default function CalendarView({ userId }) {
  const hoje    = new Date()
  const hojeStr = hoje.toISOString().slice(0, 10)

  const [ano, setAno]               = useState(hoje.getFullYear())
  const [mes, setMes]               = useState(hoje.getMonth() + 1)
  const [dados, setDados]           = useState([])
  const [loading, setLoading]       = useState(true)
  const [diaSelecionado, setDiaSel] = useState(null)

  const mesStr = `${ano}-${String(mes).padStart(2, '0')}`

  const carregar = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    try {
      const res = await fetch(`${BASE}/api/dispensation/calendar/${userId}?month=${mesStr}`)
      if (res.ok) setDados(await res.json())
    } catch { /* silencioso */ }
    finally { setLoading(false) }
  }, [userId, mesStr])

  useEffect(() => {
    carregar()
    setDiaSel(null)
  }, [carregar])

  function navMes(delta) {
    let m = mes + delta, a = ano
    if (m > 12) { m = 1;  a++ }
    if (m < 1)  { m = 12; a-- }
    setMes(m)
    setAno(a)
  }

  const primeiroDia = new Date(ano, mes - 1, 1).getDay()
  const diaSel      = diaSelecionado ? dados.find(d => d.date === diaSelecionado) : null
  const ehMesAtual  = ano === hoje.getFullYear() && mes === hoje.getMonth() + 1

  return (
    <div>
      {/* Navegação de mês */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => navMes(-1)}
          className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-primary transition-colors"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>

        <span className="font-bold text-gray-800 text-sm">{MESES[mes - 1]} {ano}</span>

        <button
          onClick={() => navMes(1)}
          disabled={ehMesAtual}
          className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-primary transition-colors disabled:opacity-30 disabled:cursor-default"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Cabeçalho dias da semana */}
      <div className="grid grid-cols-7 mb-1">
        {DIAS_SEMANA.map((d, i) => (
          <div key={i} className="text-center text-[10px] font-semibold text-gray-400 py-1">{d}</div>
        ))}
      </div>

      {/* Grid de dias */}
      {loading ? (
        <div className="flex justify-center py-8">
          <div className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: primeiroDia }).map((_, i) => (
            <div key={`vazio-${i}`} />
          ))}

          {dados.map((d) => {
            const num      = parseInt(d.date.split('-')[2], 10)
            const cores    = corDoDia(d.status)
            const isHoje   = d.date === hojeStr
            const isSel    = d.date === diaSelecionado
            // Clicável: dias com eventos registrados OU dias futuros (mostram agendamentos)
            // "none" = dia passado sem nenhum registro → não há o que mostrar
            const clicavel = d.status !== 'none'

            return (
              <button
                key={d.date}
                onClick={() => clicavel && setDiaSel(isSel ? null : d.date)}
                className={[
                  'aspect-square rounded-full flex items-center justify-center',
                  'text-xs font-semibold transition-all select-none',
                  cores.bg, cores.text,
                  isHoje   ? 'ring-2 ring-[#B5CC18] ring-offset-1' : '',
                  isSel    ? 'ring-2 ring-primary ring-offset-1 scale-110' : '',
                  clicavel ? 'cursor-pointer active:scale-95' : 'cursor-default',
                ].join(' ')}
              >
                {num}
              </button>
            )
          })}
        </div>
      )}

      {/* Accordion de detalhe — abre ao tocar num dia */}
      {/* Dias futuros têm total=0 mas ainda mostram agendamentos, por isso só excluímos "none" */}
      {diaSel && diaSel.status !== 'none' && (
        <DayDetail userId={userId} diaSel={diaSel} />
      )}

      {/* Legenda */}
      <div className="flex items-center gap-3 mt-3 flex-wrap">
        {[
          { cor: 'bg-[#2D9E75]', label: 'Completo' },
          { cor: 'bg-[#D85A30]', label: 'Faltou' },
          { cor: 'bg-[#EFF5C8]', label: 'Em dia' },
          { cor: 'bg-gray-100',  label: 'Sem doses' },
          { cor: 'bg-blue-50 border border-blue-100', label: 'Futuro' },
        ].map(({ cor, label }) => (
          <div key={label} className="flex items-center gap-1">
            <div className={`w-2.5 h-2.5 rounded-full ${cor}`} />
            <span className="text-[10px] text-gray-400">{label}</span>
          </div>
        ))}
        <div className="flex items-center gap-1 ml-auto">
          <div className="w-2.5 h-2.5 rounded-full bg-gray-200 ring-1 ring-[#B5CC18]" />
          <span className="text-[10px] text-gray-400">Hoje</span>
        </div>
      </div>
    </div>
  )
}
