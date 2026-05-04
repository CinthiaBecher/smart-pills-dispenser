import { useState, useEffect } from 'react'

const BASE = 'http://localhost:8000'

const FREQUENCY_OPTIONS = [
  '1x ao dia',
  '2x ao dia',
  '3x ao dia',
  '4x ao dia',
  'A cada 6 horas',
  'A cada 8 horas',
  'A cada 12 horas',
  'De manhã',
  'À noite',
  'Ao dormir',
]

const ROUTE_OPTIONS = [
  'oral', 'sublingual', 'tópico', 'inalado',
  'injetável', 'retal', 'nasal', 'oftálmico',
]

// Espelha a lógica do backend (frequency_to_times) para feedback instantâneo
// Combina frequency + instructions para detectar período do dia
function frequencyToTimes(frequency, instructions = '') {
  if (!frequency) return ['08:00']
  const f        = frequency.toLowerCase()
  const inst     = (instructions || '').toLowerCase()
  const combined = `${f} ${inst}`.trim()

  if (f.includes('4x') || f.includes('a cada 6') || f.includes('6/6')) return ['08:00', '12:00', '18:00', '22:00']
  if (f.includes('3x') || f.includes('a cada 8') || f.includes('8/8')) return ['08:00', '14:00', '20:00']
  if (f.includes('2x') || f.includes('a cada 12') || f.includes('12/12')) return ['08:00', '20:00']
  if (combined.includes('manhã') && combined.includes('noite')) return ['08:00', '20:00']
  if (combined.includes('manhã') && combined.includes('tarde')) return ['08:00', '14:00']
  if (combined.includes('noite') || combined.includes('dormir') || combined.includes('deitar')) return ['22:00']
  if (combined.includes('manhã') || combined.includes('jejum')) return ['08:00']
  if (combined.includes('tarde') || combined.includes('almoço')) return ['12:00']
  return ['08:00']
}

// Helpers de conversão de horário
const toMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
const fromMin = m => {
  const total = ((m % 1440) + 1440) % 1440
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

// Retorna o intervalo esperado em horas se a frequência for "a cada X horas", ou null
function getIntervaloEsperado(frequency) {
  if (!frequency) return null
  const f = frequency.toLowerCase()
  if (f.includes('a cada 6')  || f === '4x ao dia') return 6
  if (f.includes('a cada 8')  || f === '3x ao dia') return 8
  if (f.includes('a cada 12') || f === '2x ao dia') return 12
  return null // "1x ao dia", "de manhã" etc. — sem restrição de intervalo
}

// Recalcula todos os horários a partir do horário que o usuário já tomou.
// Ex: tomou às 07:30, remédio de 12h → [07:30, 19:30]
function recalcularAPartirDaTomada(horarioTomado, frequency) {
  const count = frequencyToTimes(frequency).length
  const intervalo = getIntervaloEsperado(frequency)
  const base = toMin(horarioTomado)

  if (intervalo) {
    // Frequência com intervalo fixo: distribui a partir do horário tomado
    return Array.from({ length: count }, (_, i) => fromMin(base + i * intervalo * 60))
  }
  // Sem intervalo fixo (ex: "De manhã"): só substitui o primeiro horário
  const original = frequencyToTimes(frequency)
  return [horarioTomado, ...original.slice(1)]
}

// Verifica se os horários respeitam o intervalo esperado (tolerância de 1h)
// Retorna uma string de aviso ou null se estiver ok
function verificarIntervalos(times, frequency) {
  const esperado = getIntervaloEsperado(frequency)
  if (!esperado || times.length < 2) return null

  const toMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
  const sorted = [...times].sort((a, b) => toMin(a) - toMin(b))

  const intervalos = sorted.map((t, i) => {
    const curr = toMin(t)
    const prox = toMin(sorted[(i + 1) % sorted.length])
    const diff = prox > curr ? prox - curr : prox + 1440 - curr
    return Math.round(diff / 60)
  })

  const foraDoIntervalo = intervalos.some(h => Math.abs(h - esperado) > 1)
  if (!foraDoIntervalo) return null

  return `Este medicamento deve ser tomado a cada ${esperado}h, mas os horários informados têm intervalos de ${intervalos.map(h => h + 'h').join(', ')}.`
}

export default function ScanReview({ medicamentos, onChange, onProximo, userId }) {
  const [medAtual, setMedAtual] = useState(0)
  const [duplicatas, setDuplicatas] = useState({})   // { [index]: boolean }
  const [jaTomou, setJaTomou] = useState(            // pré-seleciona "Não" para todos
    () => Object.fromEntries(medicamentos.map((_, i) => [i, 'nao']))
  )
  const [horarioTomado, setHorarioTomado] = useState({}) // { [index]: 'HH:MM' }
  const [avisoIntervalo, setAvisoIntervalo] = useState(null) // string de aviso ou null

  // Inicializa os horários ao montar o componente (frequência já vem normalizada do backend)
  useEffect(() => {
    const comHorarios = medicamentos.map(med => ({
      ...med,
      route: med.route || 'oral',   // garante valor padrão se o Gemini retornar null
      _times: frequencyToTimes(med.frequency, med.instructions),
    }))
    onChange(comHorarios)
  }, [])

  // Verifica duplicatas no banco ao montar o componente
  useEffect(() => {
    medicamentos.forEach((med, i) => {
      if (!med.name) return
      fetch(`${BASE}/api/medications/check-duplicate/${userId}?name=${encodeURIComponent(med.name)}`)
        .then(r => r.json())
        .then(data => {
          if (data.exists) {
            setDuplicatas(prev => ({ ...prev, [i]: true }))
          }
        })
        .catch(() => {}) // silencia erros de rede — não é crítico
    })
  }, [])

  function atualizar(index, campo, valor) {
    const copia = [...medicamentos]
    const updated = { ...copia[index], [campo]: valor }
    // Quando a frequência muda, recalcula os horários automaticamente
    if (campo === 'frequency') {
      updated._times = frequencyToTimes(valor, updated.instructions)
    }
    copia[index] = updated
    onChange(copia)
  }

  function handleHorarioTomado(index, horario) {
    setHorarioTomado(prev => ({ ...prev, [index]: horario }))
    // Recalcula os horários sugeridos com base no que já foi tomado
    const med = medicamentos[index]
    const novos = recalcularAPartirDaTomada(horario, med.frequency)
    atualizar(index, '_times', novos)
  }

  function confirmarMed(index) {
    setAvisoIntervalo(null)
  }

  function avancar() {
    confirmarMed(medAtual)
    if (medAtual < medicamentos.length - 1) {
      setMedAtual(medAtual + 1)
    } else {
      onProximo()
    }
  }

  function irParaProximo() {
    const med = medicamentos[medAtual]
    const aviso = verificarIntervalos(
      med._times || frequencyToTimes(med.frequency, med.instructions),
      med.frequency
    )
    if (aviso) {
      setAvisoIntervalo(aviso) // mostra o modal antes de avançar
    } else {
      avancar()
    }
  }

  const totalDoses = medicamentos.reduce(
    (acc, m) => acc + (m._times || frequencyToTimes(m.frequency, m.instructions)).length,
    0
  )

  const med = medicamentos[medAtual]
  if (!med) return null

  // Usa os horários editados pelo usuário; se ainda não existirem, calcula da frequência
  const horarios = med._times || frequencyToTimes(med.frequency, med.instructions)
  const isDuplicata = duplicatas[medAtual]
  const isUltimo = medAtual === medicamentos.length - 1

  return (
    <div className="flex flex-col gap-4">

      {/* Header com totais */}
      <p className="text-gray-400 text-xs text-center">
        Total de <strong className="text-gray-600">{medicamentos.length}</strong> medicamento{medicamentos.length !== 1 ? 's' : ''} · {' '}
        <strong className="text-gray-600">{totalDoses}</strong> doses diárias no total
      </p>

      {/* Navegação entre medicamentos */}
      <div className="flex items-center justify-between px-1">
        <button
          onClick={() => setMedAtual(i => Math.max(0, i - 1))}
          disabled={medAtual === 0}
          className="w-10 h-10 flex items-center justify-center text-primary disabled:text-gray-200 transition-colors"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <p className="text-sm font-semibold text-gray-700">
          {medAtual + 1} de {medicamentos.length} medicamento{medicamentos.length !== 1 ? 's' : ''}
        </p>
        <button
          onClick={() => setMedAtual(i => Math.min(medicamentos.length - 1, i + 1))}
          disabled={medAtual === medicamentos.length - 1}
          className="w-10 h-10 flex items-center justify-center text-primary disabled:text-gray-200 transition-colors"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {/* Card do medicamento atual */}
      <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">

        {/* Cabeçalho do card */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1 mr-2">
            <h3 className="font-bold text-gray-800">{med.name || 'Medicamento'}</h3>
            <p className="text-gray-400 text-xs mt-0.5">
              {med.dosage}
            </p>
          </div>
          <span className="text-[10px] font-bold px-2.5 py-1 rounded-full shrink-0 bg-gray-100 text-gray-500">
            {med.dosage}
          </span>
        </div>

        {/* Pergunta: já tomou hoje? */}
        <div className="mb-4">
          <p className="text-sm font-medium text-gray-700 mb-2">
            Você já tomou este medicamento hoje?
          </p>
          <div className="flex gap-2">
            {[
              { value: 'nao', label: 'Não, começar do zero' },
              { value: 'sim', label: 'Sim, já tomei' },
            ].map(opt => (
              <label
                key={opt.value}
                className={`flex-1 flex items-center gap-2 p-3 rounded-xl border-2 cursor-pointer transition-colors ${
                  jaTomou[medAtual] === opt.value
                    ? 'border-primary bg-green-50'
                    : 'border-gray-100 hover:border-gray-200'
                }`}
              >
                <input
                  type="radio"
                  name={`tomou-${medAtual}`}
                  value={opt.value}
                  checked={jaTomou[medAtual] === opt.value}
                  onChange={() => {
                    setJaTomou(prev => ({ ...prev, [medAtual]: opt.value }))
                    // Limpa o horário tomado ao trocar para "não"
                    if (opt.value === 'nao') {
                      setHorarioTomado(prev => ({ ...prev, [medAtual]: undefined }))
                      atualizar(medAtual, '_times', frequencyToTimes(med.frequency, med.instructions))
                    }
                  }}
                  className="hidden"
                />
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                  jaTomou[medAtual] === opt.value ? 'border-primary' : 'border-gray-300'
                }`}>
                  {jaTomou[medAtual] === opt.value && (
                    <div className="w-2 h-2 rounded-full bg-primary" />
                  )}
                </div>
                <span className="text-xs text-gray-600 leading-tight">{opt.label}</span>
              </label>
            ))}
          </div>

          {/* Campo de horário — aparece só quando "Sim, já tomei" */}
          {jaTomou[medAtual] === 'sim' && (
            <div className="mt-3 flex items-center gap-3 bg-gray-50 rounded-xl px-3 py-2.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="shrink-0">
                <circle cx="12" cy="12" r="10" stroke="#006B5E" strokeWidth="1.5" />
                <path d="M12 7v5l3 3" stroke="#006B5E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <label className="text-xs text-gray-500 shrink-0">Que horas você tomou?</label>
              <input
                type="time"
                value={horarioTomado[medAtual] || ''}
                onChange={e => handleHorarioTomado(medAtual, e.target.value)}
                className="ml-auto text-sm font-semibold text-primary bg-transparent border-none outline-none [&::-webkit-calendar-picker-indicator]:hidden"
              />
            </div>
          )}
        </div>

        {/* Campos editáveis */}
        <div className="flex flex-col gap-3 mb-4">
          <div>
            <label className="text-[10px] text-gray-400 uppercase tracking-wide mb-1.5 block">
              Frequência
            </label>
            <select
              value={med.frequency || ''}
              onChange={e => atualizar(medAtual, 'frequency', e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 bg-white focus:outline-none focus:border-primary transition-colors"
            >
              <option value="">Selecione a frequência...</option>
              {FREQUENCY_OPTIONS.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] text-gray-400 uppercase tracking-wide mb-1.5 block">
              Via de Administração
            </label>
            <select
              value={med.route || 'oral'}
              onChange={e => atualizar(medAtual, 'route', e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 bg-white focus:outline-none focus:border-primary transition-colors"
            >
              {ROUTE_OPTIONS.map(opt => (
                <option key={opt} value={opt}>
                  {opt.charAt(0).toUpperCase() + opt.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] text-gray-400 uppercase tracking-wide mb-1.5 block">
              Instruções
            </label>
            <textarea
              value={med.instructions || ''}
              onChange={e => atualizar(medAtual, 'instructions', e.target.value)}
              rows={2}
              placeholder="Ex: tomar com água, em jejum..."
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 resize-none focus:outline-none focus:border-primary transition-colors"
            />
          </div>
        </div>

        {/* Cronograma sugerido — horários editáveis */}
        <div className="bg-gray-50 rounded-xl p-3 mb-4">
          <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide mb-2">
            Cronograma Sugerido
          </p>
          <div className="flex flex-wrap gap-2">
            {horarios.map((h, hi) => (
              <div
                key={hi}
                className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-lg px-2.5 py-1.5"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="#006B5E" strokeWidth="1.5" />
                  <path d="M12 7v5l3 3" stroke="#006B5E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <input
                  type="time"
                  value={h}
                  onChange={e => {
                    const novos = [...horarios]
                    novos[hi] = e.target.value
                    atualizar(medAtual, '_times', novos)
                  }}
                  className="text-xs font-semibold text-gray-700 bg-transparent border-none outline-none w-16 [&::-webkit-calendar-picker-indicator]:hidden"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Alerta de duplicata */}
        {isDuplicata && (
          <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-3 mb-4">
            <p className="text-xs text-yellow-700 font-medium mb-2">
              Você já possui <strong>{med.name}</strong> cadastrado. Deseja substituir o cadastro anterior?
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => atualizar(medAtual, '_replaceDuplicate', true)}
                className={`flex-1 text-xs font-semibold py-2 rounded-lg border-2 transition-colors ${
                  med._replaceDuplicate === true
                    ? 'border-primary bg-green-50 text-primary'
                    : 'border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
              >
                Sim, substituir
              </button>
              <button
                onClick={() => atualizar(medAtual, '_replaceDuplicate', false)}
                className={`flex-1 text-xs font-semibold py-2 rounded-lg border-2 transition-colors ${
                  med._replaceDuplicate === false
                    ? 'border-red-300 bg-red-50 text-danger'
                    : 'border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
              >
                Não, manter
              </button>
            </div>
          </div>
        )}

      </div>

      {/* Modal: aviso de intervalo incompatível */}
      {avisoIntervalo && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50 p-4 pb-6">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <div className="flex items-center gap-2 mb-3">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" fill="#EF9F27" fillOpacity="0.2" stroke="#EF9F27" strokeWidth="1.5" strokeLinejoin="round" />
                <path d="M12 9v4" stroke="#EF9F27" strokeWidth="2" strokeLinecap="round" />
                <circle cx="12" cy="16.5" r="0.7" fill="#EF9F27" />
              </svg>
              <h3 className="font-bold text-gray-800 text-sm">Atenção: intervalo irregular</h3>
            </div>
            <p className="text-sm text-gray-500 mb-6 leading-relaxed">{avisoIntervalo}</p>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => setAvisoIntervalo(null)}
                className="w-full bg-accent hover:bg-accent-dark text-white font-semibold rounded-full py-3 transition-colors"
              >
                Ajustar horários
              </button>
              <button
                onClick={avancar}
                className="w-full border-2 border-gray-200 text-gray-500 font-semibold rounded-full py-3 hover:bg-gray-50 transition-colors"
              >
                Confirmar mesmo assim
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Botão Próximo / Ir para confirmação */}
      <button
        onClick={irParaProximo}
        className="w-full bg-accent hover:bg-accent-dark text-white font-semibold rounded-full py-3 transition-colors"
      >
        {isUltimo
          ? 'Próximo →'
          : `Próximo medicamento (${medAtual + 1}/${medicamentos.length})`}
      </button>
    </div>
  )
}
