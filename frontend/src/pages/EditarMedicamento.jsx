import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Loader from '../components/Loader'

const BASE = 'http://localhost:8000'
const ROUTE_OPTIONS = ['oral', 'sublingual', 'tópico', 'inalado', 'injetável', 'retal', 'nasal', 'oftálmico']

export default function EditarMedicamento() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [nome, setNome]             = useState('')
  const [dosagem, setDosagem]       = useState('')
  const [via, setVia]               = useState('oral')
  const [instrucoes, setInstrucoes] = useState('')
  const [duracao, setDuracao]       = useState('')
  const [times, setTimes]           = useState([])
  const [loading, setLoading]       = useState(true)
  const [salvando, setSalvando]     = useState(false)
  const [erro, setErro]             = useState('')

  // Carrega os dados atuais do medicamento e seus horários
  useEffect(() => {
    async function carregar() {
      try {
        const [resMed, resHor] = await Promise.all([
          fetch(`${BASE}/api/medications/${id}`),
          fetch(`${BASE}/api/schedules/medication/${id}`),
        ])
        if (!resMed.ok) throw new Error()

        const med = await resMed.json()
        const hor = resHor.ok ? await resHor.json() : []

        setNome(med.name || '')
        setDosagem(med.dosage || '')
        setVia(med.route || 'oral')
        setInstrucoes(med.instructions || '')
        setDuracao(med.duration_days ?? '')
        setTimes(hor.map(h => h.time))
      } catch {
        setErro('Não foi possível carregar o medicamento.')
      } finally {
        setLoading(false)
      }
    }
    carregar()
  }, [id])

  function alterarHorario(index, valor) {
    setTimes(prev => prev.map((t, i) => i === index ? valor : t))
  }

  function adicionarHorario() {
    setTimes(prev => [...prev, '08:00'])
  }

  function removerHorario(index) {
    if (times.length === 1) return
    setTimes(prev => prev.filter((_, i) => i !== index))
  }

  async function handleSalvar() {
    if (!nome.trim() || !dosagem.trim()) {
      setErro('Nome e dosagem são obrigatórios.')
      return
    }

    setSalvando(true)
    setErro('')
    try {
      const res = await fetch(`${BASE}/api/medications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:         nome.trim(),
          dosage:       dosagem.trim(),
          route:        via,
          instructions: instrucoes.trim() || null,
          duration_days: duracao !== '' ? Number(duracao) : null,
          times:        times.filter(Boolean),
        }),
      })

      if (!res.ok) {
        const corpo = await res.json().catch(() => null)
        setErro(corpo?.detail || 'Não foi possível salvar. Tente novamente.')
        return
      }

      navigate('/medicamentos')
    } catch {
      setErro('Sem conexão com o servidor.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="min-h-screen bg-background pb-8">

      {/* Header */}
      <header className="bg-white px-4 py-3 flex items-center gap-3 shadow-sm sticky top-0 z-40">
        <button onClick={() => navigate('/medicamentos')} className="text-primary">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M19 12H5M12 5l-7 7 7 7" stroke="#006B5E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <h1 className="text-lg font-bold text-gray-800">Editar Medicamento</h1>
      </header>

      {loading ? (
        <Loader />
      ) : (
        <main className="px-4 pt-4 flex flex-col gap-4">

          {erro && (
            <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 flex items-start gap-3">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="shrink-0 mt-0.5">
                <circle cx="12" cy="12" r="9" stroke="#D85A30" strokeWidth="2" />
                <path d="M12 8v4M12 16h.01" stroke="#D85A30" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <p className="text-sm text-red-700">{erro}</p>
            </div>
          )}

          {/* Nome */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-col gap-4">
            <div>
              <label className="text-[10px] text-gray-400 uppercase tracking-wide mb-1.5 block">Nome</label>
              <input
                value={nome}
                onChange={e => setNome(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:border-primary transition-colors"
                placeholder="Ex: Losartana Potássica"
              />
            </div>

            <div>
              <label className="text-[10px] text-gray-400 uppercase tracking-wide mb-1.5 block">Dosagem</label>
              <input
                value={dosagem}
                onChange={e => setDosagem(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:border-primary transition-colors"
                placeholder="Ex: 50mg"
              />
            </div>

            <div>
              <label className="text-[10px] text-gray-400 uppercase tracking-wide mb-1.5 block">Via de Administração</label>
              <select
                value={via}
                onChange={e => setVia(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 bg-white focus:outline-none focus:border-primary transition-colors"
              >
                {ROUTE_OPTIONS.map(opt => (
                  <option key={opt} value={opt}>{opt.charAt(0).toUpperCase() + opt.slice(1)}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] text-gray-400 uppercase tracking-wide mb-1.5 block">Instruções</label>
              <textarea
                value={instrucoes}
                onChange={e => setInstrucoes(e.target.value)}
                rows={2}
                placeholder="Ex: tomar em jejum, com água..."
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 resize-none focus:outline-none focus:border-primary transition-colors"
              />
            </div>

            <div>
              <label className="text-[10px] text-gray-400 uppercase tracking-wide mb-1.5 block">
                Duração (dias) — deixe em branco para uso contínuo
              </label>
              <input
                type="number"
                value={duracao}
                onChange={e => setDuracao(e.target.value)}
                min={1}
                placeholder="Ex: 7"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:border-primary transition-colors"
              />
            </div>
          </div>

          {/* Horários */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <label className="text-[10px] text-gray-400 uppercase tracking-wide mb-3 block">Horários</label>
            <div className="flex flex-col gap-2">
              {times.map((t, i) => (
                <div key={i} className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2.5">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="shrink-0">
                    <circle cx="12" cy="12" r="9" stroke="#006B5E" strokeWidth="1.8" />
                    <path d="M12 7v5l3 3" stroke="#006B5E" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                  <input
                    type="time"
                    value={t}
                    onChange={e => alterarHorario(i, e.target.value)}
                    className="flex-1 text-sm font-semibold text-gray-700 bg-transparent border-none outline-none [&::-webkit-calendar-picker-indicator]:hidden"
                  />
                  <button
                    onClick={() => removerHorario(i)}
                    disabled={times.length === 1}
                    className="text-gray-300 hover:text-danger disabled:opacity-30 transition-colors p-1"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
              ))}
              <button
                onClick={adicionarHorario}
                className="flex items-center gap-2 text-primary text-sm font-medium py-1 px-1"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M12 5v14M5 12h14" stroke="#006B5E" strokeWidth="2" strokeLinecap="round" />
                </svg>
                Adicionar horário
              </button>
            </div>
          </div>

          {/* Botão salvar */}
          <button
            onClick={handleSalvar}
            disabled={salvando}
            className="w-full bg-primary hover:opacity-90 text-white font-semibold rounded-full py-3 transition-colors disabled:opacity-60"
          >
            {salvando ? 'Salvando...' : 'Salvar alterações'}
          </button>

        </main>
      )}
    </div>
  )
}
