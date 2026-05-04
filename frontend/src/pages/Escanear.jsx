import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ScanValidation from '../components/scan/ScanValidation'
import ScanReview from '../components/scan/ScanReview'
import ScanConfirm from '../components/scan/ScanConfirm'
import ErrorBanner from '../components/ErrorBanner'

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

// ── Etapa 1: Capturar (mantida exatamente como estava) ─────
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

// ── Componente principal ───────────────────────────────────
export default function Escanear() {
  const navigate = useNavigate()

  // Passo atual do stepper (1 = Capturar, 2 = Revisar, 3 = Confirmar)
  const [etapa, setEtapa] = useState(1)
  // Sub-etapa dentro do passo 2: 'validacao' → 'revisao'
  const [subEtapa, setSubEtapa] = useState('validacao')

  const [arquivo, setArquivo] = useState(null)
  // dadosReceita guarda tudo que a IA extraiu: patient_name, prescription_date, doctor_name, doctor_crm, medications
  const [dadosReceita, setDadosReceita] = useState(null)
  const [medicamentos, setMedicamentos] = useState([])

  const [interpretando, setInterpretando] = useState(false)
  const [erroInterpretacao, setErroInterpretacao] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [sucesso, setSucesso] = useState(false)
  const [erroSalvar, setErroSalvar] = useState('')

  const userId = localStorage.getItem('userId') || '1'
  const userName = localStorage.getItem('userName') || ''

  // Chamada ao backend quando o usuário seleciona uma imagem
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

      setDadosReceita(data)
      setMedicamentos(data.medications || [])
      setEtapa(2)
      setSubEtapa('validacao')
    } catch (err) {
      setErroInterpretacao('Não foi possível interpretar a receita. Tente outra imagem.')
    } finally {
      setInterpretando(false)
    }
  }

  // Volta ao passo 1 sem precisar navegar — só reseta o estado
  function handleTentarNovamente() {
    setArquivo(null)
    setDadosReceita(null)
    setMedicamentos([])
    setErroInterpretacao('')
    setEtapa(1)
    setSubEtapa('validacao')
  }

  // Converte a imagem capturada para base64 (data URL) para guardar no histórico
  function imagemParaBase64(file) {
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = (e) => resolve(e.target.result)
      reader.readAsDataURL(file)
    })
  }

  // Salva medicamentos + registro da receita no backend
  // Remove campos internos de UI (prefixo _) antes de enviar
  async function handleSalvar() {
    // Valida o userId antes de qualquer chamada ao backend
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!userId || !UUID_REGEX.test(userId)) {
      setErroSalvar('Sessão inválida. Saia do app e faça login novamente.')
      return
    }

    setSalvando(true)
    setErroSalvar('')
    try {
      const medsParaEnviar = medicamentos.map(({ _replaceDuplicate, _times, ...med }) => ({
        ...med,
        times: _times || [],
      }))
      const imageBase64 = arquivo ? await imagemParaBase64(arquivo) : null

      const res = await fetch(`${BASE}/api/prescriptions/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          medications: medsParaEnviar,
          patient_name: dadosReceita?.patient_name ?? null,
          prescription_date: dadosReceita?.prescription_date ?? null,
          doctor_name: dadosReceita?.doctor_name ?? null,
          doctor_crm: dadosReceita?.doctor_crm ?? null,
          image_base64: imageBase64,
        }),
      })

      if (!res.ok) {
        const corpo = await res.json().catch(() => null)
        console.error('[handleSalvar] erro', res.status, corpo)

        if (res.status === 422) {
          // FastAPI retorna array de erros de validação — pega o primeiro campo que falhou
          const erros = Array.isArray(corpo?.detail) ? corpo.detail : []
          const campo = erros[0]?.loc?.join(' → ') || ''
          const msg   = erros[0]?.msg || ''

          if (campo.includes('user_id')) {
            setErroSalvar('Sessão inválida. Saia do app e faça login novamente.')
          } else if (campo) {
            setErroSalvar(`Campo inválido: ${campo} — ${msg}`)
          } else {
            setErroSalvar('Não foi possível salvar: verifique se todos os medicamentos têm nome e dosagem preenchidos.')
          }
        } else if (res.status === 404) {
          setErroSalvar('Usuário não encontrado. Saia do app e faça login novamente.')
        } else if (corpo?.detail) {
          setErroSalvar(`Erro do servidor: ${corpo.detail}`)
        } else {
          setErroSalvar('Não foi possível salvar o tratamento. Tente novamente.')
        }
        return
      }

      setSucesso(true)
    } catch (err) {
      setErroSalvar('Sem conexão com o servidor. Verifique se o backend está rodando.')
    } finally {
      setSalvando(false)
    }
  }

  // Lógica do botão voltar no header
  function handleVoltar() {
    if (etapa === 3) {
      setEtapa(2)
      setSubEtapa('revisao')
      setErroSalvar('')
    } else if (etapa === 2 && subEtapa === 'revisao') {
      setSubEtapa('validacao')
    } else if (etapa === 2 && subEtapa === 'validacao') {
      setEtapa(1)
    } else {
      navigate('/dashboard')
    }
  }

  return (
    <div className="min-h-screen bg-background pb-8">

      {/* Header */}
      <header className="px-4 pt-4 pb-2 flex items-center">
        <button onClick={handleVoltar} className="text-primary mr-3">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M19 12H5M12 5l-7 7 7 7" stroke="#006B5E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <h1 className="text-lg font-bold text-gray-800 flex-1 text-center pr-6">Escanear Receita</h1>
      </header>

      {/* Stepper — não exibe durante a tela de sucesso */}
      {!sucesso && <Stepper etapa={etapa} />}

      <main className="px-4 flex flex-col gap-3">

        {/* Loading enquanto a IA processa a imagem */}
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

        {!interpretando && (
          <ErrorBanner erro={erroInterpretacao} onClose={() => setErroInterpretacao('')} />
        )}

        {/* ── PASSO 1: Capturar (sem alterações) ─────────────── */}
        {!interpretando && etapa === 1 && (
          <EtapaCapturar onImagem={handleImagem} />
        )}

        {/* ── PASSO 2A: Validação da receita ──────────────────── */}
        {!interpretando && etapa === 2 && subEtapa === 'validacao' && (
          <ScanValidation
            dadosReceita={dadosReceita}
            userName={userName}
            onContinuar={() => setSubEtapa('revisao')}
            onTentarNovamente={handleTentarNovamente}
          />
        )}

        {/* ── PASSO 2B: Revisão dos medicamentos ──────────────── */}
        {!interpretando && etapa === 2 && subEtapa === 'revisao' && (
          <ScanReview
            medicamentos={medicamentos}
            onChange={setMedicamentos}
            onProximo={() => setEtapa(3)}
            userId={userId}
          />
        )}

        {/* ── PASSO 3: Confirmar tratamento ───────────────────── */}
        {!interpretando && etapa === 3 && (
          <ScanConfirm
            medicamentos={medicamentos}
            onVoltar={() => { setEtapa(2); setSubEtapa('revisao'); setErroSalvar('') }}
            onSalvar={handleSalvar}
            salvando={salvando}
            sucesso={sucesso}
            erro={erroSalvar}
            navigate={navigate}
          />
        )}

      </main>
    </div>
  )
}
