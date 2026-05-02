import { useEffect, useRef, useState } from 'react'

const BASE = 'http://localhost:8000'

const ROUTE_OPTIONS = ['oral', 'sublingual', 'tópico', 'inalado', 'injetável', 'retal', 'nasal', 'oftálmico']

export default function EditMedicamentoModal({ med, horarios, onClose, onSalvo }) {
  const [nome, setNome]               = useState(med.name || '')
  const [dosagem, setDosagem]         = useState(med.dosage || '')
  const [via, setVia]                 = useState(med.route || 'oral')
  const [instrucoes, setInstrucoes]   = useState(med.instructions || '')
  const [duracao, setDuracao]         = useState(med.duration_days ?? '')
  const [times, setTimes]             = useState(horarios.map(h => h.time))
  const [salvando, setSalvando]       = useState(false)
  const [erro, setErro]               = useState('')
  const panelRef = useRef(null)

  // Fecha ao clicar fora
  useEffect(() => {
    function handleClick(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) onClose()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  function alterarHorario(index, valor) {
    setTimes(prev => prev.map((t, i) => i === index ? valor : t))
  }

  function adicionarHorario() {
    setTimes(prev => [...prev, '08:00'])
  }

  function removerHorario(index) {
    if (times.length === 1) return // pelo menos 1 horário
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
      const res = await fetch(`${BASE}/api/medications/${med.id}`, {
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

      onSalvo() // recarrega a lista na tela pai
      onClose()
    } catch {
      setErro('Sem conexão com o servidor.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-end justify-center">
      <div
        ref={panelRef}
        className="bg-white rounded-t-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden"
      >
        {/* Cabeçalho */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100 shrink-0">
          <h2 className="font-bold text-gray-800">Editar Medicamento</h2>
          <button onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Formulário */}
        <div className="overflow-y-auto flex-1 px-4 py-4 flex flex-col gap-4">

          {erro && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
              {erro}
            </div>
          )}

          {/* Nome */}
          <div>
            <label className="text-[10px] text-gray-400 uppercase tracking-wide mb-1.5 block">Nome</label>
            <input
              value={nome}
              onChange={e => setNome(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:border-primary transition-colors"
              placeholder="Ex: Losartana Potássica"
            />
          </div>

          {/* Dosagem */}
          <div>
            <label className="text-[10px] text-gray-400 uppercase tracking-wide mb-1.5 block">Dosagem</label>
            <input
              value={dosagem}
              onChange={e => setDosagem(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:border-primary transition-colors"
              placeholder="Ex: 50mg"
            />
          </div>

          {/* Via */}
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

          {/* Instruções */}
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

          {/* Duração */}
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

          {/* Horários */}
          <div>
            <label className="text-[10px] text-gray-400 uppercase tracking-wide mb-1.5 block">Horários</label>
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
                    className="text-gray-300 hover:text-danger disabled:opacity-30 transition-colors"
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
        </div>

        {/* Botão salvar */}
        <div className="px-4 py-4 border-t border-gray-100 shrink-0">
          <button
            onClick={handleSalvar}
            disabled={salvando}
            className="w-full bg-primary hover:opacity-90 text-white font-semibold rounded-full py-3 transition-colors disabled:opacity-60"
          >
            {salvando ? 'Salvando...' : 'Salvar alterações'}
          </button>
        </div>
      </div>
    </div>
  )
}
