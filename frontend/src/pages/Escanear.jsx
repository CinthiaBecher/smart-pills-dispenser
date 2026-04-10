import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

const BASE = 'http://localhost:8000'

// ── Stepper ────────────────────────────────────────────────
function Stepper({ etapa }) {
  const passos = ['Capturar', 'Revisar', 'Confirmar']

  return (
    <div className="flex items-center justify-center gap-0 my-4">
      {passos.map((passo, i) => {
        const num = i + 1
        const concluido = etapa > num
        const ativo = etapa === num

        return (
          <div key={passo} className="flex items-center">
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                concluido ? 'bg-primary text-white' :
                ativo     ? 'bg-accent text-white' :
                            'bg-gray-200 text-gray-400'
              }`}>
                {concluido ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M5 13l4 4L19 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : num}
              </div>
              <span className={`text-[10px] mt-1 ${ativo ? 'text-gray-700 font-semibold' : 'text-gray-400'}`}>
                {passo}
              </span>
            </div>
            {i < passos.length - 1 && (
              <div className={`w-10 h-px mb-4 mx-1 ${etapa > num ? 'bg-primary' : 'bg-gray-200'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Etapa 1: Capturar ──────────────────────────────────────
function EtapaCapturar({ onImagem }) {
  const inputCameraRef = useRef()
  const inputGaleriaRef = useRef()
  const [preview, setPreview] = useState(null)

  function handleArquivo(e) {
    const file = e.target.files[0]
    if (!file) return
    setPreview(URL.createObjectURL(file))
    onImagem(file)
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-gray-400 text-sm text-center">
        Posicione a receita médica dentro da área
      </p>

      {/* Área de captura */}
      <div
        className="rounded-2xl border-2 border-dashed border-primary bg-white flex flex-col items-center justify-center gap-2 cursor-pointer"
        style={{ minHeight: 280 }}
        onClick={() => inputGaleriaRef.current.click()}
      >
        {preview ? (
          <img src={preview} alt="Receita" className="w-full h-full object-contain rounded-2xl max-h-72" />
        ) : (
          <>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
              <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" stroke="#006B5E" strokeWidth="1.5" strokeLinejoin="round" />
              <circle cx="12" cy="13" r="4" stroke="#006B5E" strokeWidth="1.5" />
            </svg>
            <span className="text-gray-400 text-sm">Área de captura</span>
          </>
        )}
      </div>

      {/* Inputs de arquivo (ocultos) */}
      <input ref={inputCameraRef} type="file" accept="image/*" capture="environment"
        className="hidden" onChange={handleArquivo} />
      <input ref={inputGaleriaRef} type="file" accept="image/*"
        className="hidden" onChange={handleArquivo} />

      {/* Botões */}
      <button
        onClick={() => inputCameraRef.current.click()}
        className="flex items-center justify-center gap-2 w-full bg-accent hover:bg-accent-dark text-white font-semibold rounded-full py-3 transition-colors"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" stroke="white" strokeWidth="1.8" strokeLinejoin="round" />
          <circle cx="12" cy="13" r="4" stroke="white" strokeWidth="1.8" />
        </svg>
        Tirar Foto
      </button>

      <button
        onClick={() => inputGaleriaRef.current.click()}
        className="flex items-center justify-center gap-2 w-full border-2 border-primary text-primary font-semibold rounded-full py-3 hover:bg-green-50 transition-colors"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" stroke="#006B5E" strokeWidth="1.8" strokeLinecap="round" />
          <polyline points="17 8 12 3 7 8" stroke="#006B5E" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <line x1="12" y1="3" x2="12" y2="15" stroke="#006B5E" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        Enviar da Galeria
      </button>
    </div>
  )
}

// ── Etapa 2: Revisar ───────────────────────────────────────
function EtapaRevisar({ medicamentos, onChange, onContinuar }) {
  function atualizar(index, campo, valor) {
    const copia = [...medicamentos]
    copia[index] = { ...copia[index], [campo]: valor }
    onChange(copia)
  }

  function remover(index) {
    onChange(medicamentos.filter((_, i) => i !== index))
  }

  function adicionar() {
    onChange([...medicamentos, { name: '', dosage: '', frequency: '', route: 'oral', instructions: '' }])
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-gray-400 text-sm text-center">
        Revise os medicamentos extraídos da receita
      </p>

      {medicamentos.map((med, i) => (
        <div key={i} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-gray-800">{med.name || 'Medicamento'}</h3>
            <div className="flex gap-2">
              <button onClick={() => remover(i)} className="text-danger hover:opacity-70">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <polyline points="3 6 5 6 21 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  <path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-2 text-sm text-gray-600">
            <div className="flex gap-1">
              <span className="text-gray-400 w-24 shrink-0">Dosagem:</span>
              <span>{med.dosage}</span>
            </div>
            <div className="flex gap-1">
              <span className="text-gray-400 w-24 shrink-0">Frequência:</span>
              <span>{med.frequency}</span>
            </div>
            <div className="flex gap-1">
              <span className="text-gray-400 w-24 shrink-0">Via:</span>
              <span>{med.route}</span>
            </div>
            <div className="flex gap-1">
              <span className="text-gray-400 w-24 shrink-0">Instruções:</span>
              <span>{med.instructions}</span>
            </div>
          </div>
        </div>
      ))}

      <button
        onClick={adicionar}
        className="flex items-center justify-center gap-1 text-primary text-sm font-medium py-2"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M12 5v14M5 12h14" stroke="#006B5E" strokeWidth="2" strokeLinecap="round" />
        </svg>
        Adicionar medicamento
      </button>

      <button
        onClick={onContinuar}
        className="w-full bg-accent hover:bg-accent-dark text-white font-semibold rounded-full py-3 mt-2 transition-colors"
      >
        Continuar
      </button>
    </div>
  )
}

// ── Etapa 3: Confirmar ─────────────────────────────────────
function EtapaConfirmar({ medicamentos, onVoltar, onSalvar, salvando }) {
  // Gera horários de exemplo baseado na frequência
  function gerarHorarios(med) {
    const freq = (med.frequency || '').toLowerCase()
    if (freq.includes('2x') || freq.includes('2 x') || freq.includes('duas')) {
      return ['08:00', '20:00']
    }
    if (freq.includes('3x') || freq.includes('3 x') || freq.includes('três')) {
      return ['08:00', '14:00', '20:00']
    }
    return ['08:00']
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-gray-400 text-sm text-center">
        Confirme os medicamentos e agendamentos
      </p>

      {medicamentos.map((med, i) => {
        const horarios = gerarHorarios(med)
        return (
          <div key={i} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
            <h3 className="font-bold text-gray-800 mb-1">
              {med.name} {med.dosage}
            </h3>
            <p className="text-gray-400 text-xs mb-3">
              {med.frequency} • {med.route}
            </p>

            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide mb-2">
                Horários Gerados
              </p>
              {horarios.map((h) => (
                <p key={h} className="text-sm text-gray-600">
                  {h} — {med.name} {med.dosage}
                </p>
              ))}
            </div>
          </div>
        )
      })}

      <button onClick={onVoltar} className="text-primary text-sm text-center font-medium py-1">
        Voltar para Editar
      </button>

      <button
        onClick={onSalvar}
        disabled={salvando}
        className="w-full bg-accent hover:bg-accent-dark text-white font-semibold rounded-full py-3 mt-1 transition-colors disabled:opacity-60"
      >
        {salvando ? 'Salvando...' : 'Salvar e Criar Agendamentos'}
      </button>
    </div>
  )
}

// ── Componente principal ───────────────────────────────────
export default function Escanear() {
  const navigate = useNavigate()
  const [etapa, setEtapa] = useState(1)
  const [arquivo, setArquivo] = useState(null)
  const [medicamentos, setMedicamentos] = useState([])
  const [interpretando, setInterpretando] = useState(false)
  const [erroInterpretacao, setErroInterpretacao] = useState('')
  const [salvando, setSalvando] = useState(false)

  const userId = localStorage.getItem('userId') || '1'

  async function handleImagem(file) {
    setArquivo(file)
    setErroInterpretacao('')
    setInterpretando(true)

    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(`${BASE}/api/prescriptions/interpret`, { method: 'POST', body: fd })
      if (!res.ok) throw new Error('Erro na interpretação')
      const data = await res.json()
      // A API retorna { medications: [...] }
      setMedicamentos(data.medications || data)
      setEtapa(2)
    } catch (err) {
      setErroInterpretacao('Não foi possível interpretar a receita. Tente outra imagem.')
    } finally {
      setInterpretando(false)
    }
  }

  async function handleSalvar() {
    setSalvando(true)
    try {
      const res = await fetch(`${BASE}/api/prescriptions/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, medications: medicamentos }),
      })
      if (!res.ok) throw new Error('Erro ao salvar')
      navigate('/medicamentos')
    } catch (err) {
      alert('Erro ao salvar. Tente novamente.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="min-h-screen bg-background pb-8">

      {/* Header */}
      <header className="px-4 pt-4 pb-2 flex items-center">
        <button onClick={() => etapa > 1 ? setEtapa(etapa - 1) : navigate('/dashboard')} className="text-primary mr-3">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M19 12H5M12 5l-7 7 7 7" stroke="#006B5E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <h1 className="text-lg font-bold text-gray-800 flex-1 text-center pr-6">Escanear Receita</h1>
      </header>

      <Stepper etapa={etapa} />

      <main className="px-4 flex flex-col gap-3">

        {/* Loading da interpretação */}
        {interpretando && (
          <div className="flex flex-col items-center justify-center gap-3 py-20">
            <div className="w-14 h-14 rounded-full bg-accent flex items-center justify-center">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                <path d="M4.5 12.5L11.5 5.5C13.5 3.5 16.5 3.5 18.5 5.5C20.5 7.5 20.5 10.5 18.5 12.5L11.5 19.5C9.5 21.5 6.5 21.5 4.5 19.5C2.5 17.5 2.5 14.5 4.5 12.5Z" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="8.5" y1="15.5" x2="15.5" y2="8.5" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <p className="text-gray-400 text-base">Interpretando receita...</p>
          </div>
        )}

        {/* Erro na interpretação */}
        {erroInterpretacao && !interpretando && (
          <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-danger text-sm text-center">
            {erroInterpretacao}
          </div>
        )}

        {!interpretando && etapa === 1 && (
          <EtapaCapturar onImagem={handleImagem} />
        )}

        {!interpretando && etapa === 2 && (
          <EtapaRevisar
            medicamentos={medicamentos}
            onChange={setMedicamentos}
            onContinuar={() => setEtapa(3)}
          />
        )}

        {!interpretando && etapa === 3 && (
          <EtapaConfirmar
            medicamentos={medicamentos}
            onVoltar={() => setEtapa(2)}
            onSalvar={handleSalvar}
            salvando={salvando}
          />
        )}
      </main>
    </div>
  )
}
