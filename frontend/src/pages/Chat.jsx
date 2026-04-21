import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import BottomNav from '../components/BottomNav'

const BASE = 'http://localhost:8000'

const MENSAGEM_INICIAL = {
  de: 'bot',
  texto: 'Olá! Sou seu assistente de medicação. Posso ajudar com dúvidas sobre seus remédios, horários e interações. Como posso ajudar?',
}

const SUGESTOES = ['Efeitos colaterais', 'Horários', 'Interações']

function AvatarBot() {
  return (
    <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center shrink-0">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <rect x="2" y="7" width="20" height="14" rx="2" stroke="#4B5563" strokeWidth="1.8" />
        <path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2" stroke="#4B5563" strokeWidth="1.8" />
        <circle cx="9" cy="14" r="1.5" fill="#4B5563" />
        <circle cx="15" cy="14" r="1.5" fill="#4B5563" />
      </svg>
    </div>
  )
}

function BolhaBot({ texto }) {
  return (
    <div className="flex items-end gap-2 max-w-[82%]">
      <AvatarBot />
      <div className="bg-white rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
        <div className="text-gray-800 text-sm leading-relaxed prose prose-sm max-w-none">
          <ReactMarkdown>{texto}</ReactMarkdown>
        </div>
      </div>
    </div>
  )
}

function BolhaUsuario({ texto }) {
  return (
    <div className="flex justify-end">
      <div className="bg-primary rounded-2xl rounded-br-sm px-4 py-3 max-w-[82%] shadow-sm">
        <p className="text-white text-sm leading-relaxed">{texto}</p>
      </div>
    </div>
  )
}

function DigitandoIndicator() {
  return (
    <div className="flex items-end gap-2">
      <AvatarBot />
      <div className="bg-white rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm flex gap-1 items-center">
        <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  )
}

export default function Chat() {
  const navigate = useNavigate()
  const [mensagens, setMensagens] = useState([MENSAGEM_INICIAL])
  const [input, setInput] = useState('')
  const [digitando, setDigitando] = useState(false)
  const [carregando, setCarregando] = useState(true)
  const fimRef = useRef(null)

  const userId = localStorage.getItem('userId') || '1'

  // Carrega histórico do banco ao montar o componente
  useEffect(() => {
    async function carregarHistorico() {
      try {
        const res = await fetch(`${BASE}/api/chat/history/${userId}`)
        const data = await res.json()
        if (Array.isArray(data) && data.length > 0) {
          setMensagens(data.map((msg) => ({
            de: msg.role === 'user' ? 'user' : 'bot',
            texto: msg.content,
          })))
        }
        // se vazio, mantém MENSAGEM_INICIAL (já é o estado inicial)
      } catch {
        // falha silenciosa — mantém MENSAGEM_INICIAL
      } finally {
        setCarregando(false)
      }
    }
    carregarHistorico()
  }, [])

  // Rola para o final sempre que chegar nova mensagem
  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensagens, digitando])

  async function enviar(texto) {
    const msg = texto.trim()
    if (!msg || digitando) return

    setInput('')
    setMensagens((prev) => [...prev, { de: 'user', texto: msg }])
    setDigitando(true)

    try {
      const res = await fetch(`${BASE}/api/chat/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, message: msg }),
      })
      const data = await res.json()
      // A API retorna { reply: "..." }
      const resposta = data.reply || 'Não entendi. Pode reformular?'
      setMensagens((prev) => [...prev, { de: 'bot', texto: resposta }])
    } catch {
      setMensagens((prev) => [...prev, {
        de: 'bot',
        texto: 'Ocorreu um erro. Verifique sua conexão e tente novamente.',
      }])
    } finally {
      setDigitando(false)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      enviar(input)
    }
  }

  return (
    <div className="bg-background flex flex-col" style={{ height: '100dvh' }}>

      {/* Header */}
      <header className="bg-white px-4 py-3 flex items-center gap-3 shadow-sm shrink-0 z-40">
        <button onClick={() => navigate('/dashboard')} className="text-primary shrink-0">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M19 12H5M12 5l-7 7 7 7" stroke="#006B5E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center shrink-0">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <rect x="2" y="7" width="20" height="14" rx="2" stroke="#4B5563" strokeWidth="1.8" />
            <path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2" stroke="#4B5563" strokeWidth="1.8" />
            <circle cx="9" cy="14" r="1.5" fill="#4B5563" />
            <circle cx="15" cy="14" r="1.5" fill="#4B5563" />
          </svg>
        </div>

        <div>
          <h1 className="font-bold text-primary text-base leading-tight">Assistente Dose Certa</h1>
          <p className="text-gray-400 text-xs">Tire dúvidas sobre seus medicamentos</p>
        </div>
      </header>

      {/* Área de mensagens — scroll no meio */}
      {carregando ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-gray-400 text-sm">Carregando histórico...</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
          {mensagens.map((msg, i) =>
            msg.de === 'bot'
              ? <BolhaBot key={i} texto={msg.texto} />
              : <BolhaUsuario key={i} texto={msg.texto} />
          )}
          {digitando && <DigitandoIndicator />}
          <div ref={fimRef} />
        </div>
      )}

      {/* Área inferior — acima do nav */}
      <div className="bg-background px-4 pt-2 pb-20 shrink-0 z-30">

        {/* Chips de sugestão rápida */}
        <div className="flex gap-2 mb-3 overflow-x-auto pb-1 scrollbar-hide">
          {SUGESTOES.map((s) => (
            <button
              key={s}
              onClick={() => enviar(s)}
              disabled={digitando}
              className="shrink-0 border border-primary text-primary text-xs font-medium px-3 py-1.5 rounded-full hover:bg-green-50 transition-colors disabled:opacity-40"
            >
              {s}
            </button>
          ))}
        </div>

        {/* Input + botão enviar */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Digite sua dúvida..."
            disabled={digitando}
            className="flex-1 bg-white rounded-full px-4 py-3 text-sm text-gray-700 placeholder-gray-400 outline-none border border-gray-100 shadow-sm disabled:opacity-60"
          />
          <button
            onClick={() => enviar(input)}
            disabled={!input.trim() || digitando}
            className="w-11 h-11 rounded-full bg-accent flex items-center justify-center shadow-sm hover:bg-accent-dark transition-colors disabled:opacity-40 shrink-0"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M12 19V5M5 12l7-7 7 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        {/* Disclaimer */}
        <p className="text-gray-400 text-[10px] text-center mt-2 pb-4">
          Este assistente não substitui orientação médica profissional.
        </p>
      </div>

      <BottomNav />
    </div>
  )
}
