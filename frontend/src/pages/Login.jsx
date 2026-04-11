import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import logo from '../assets/logo.png'

export default function Login() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const navigate = useNavigate()

  async function handleEntrar(e) {
    e.preventDefault()
    setErro('')

    if (!email || !senha) {
      setErro('Preencha o e-mail e a senha.')
      return
    }

    setLoading(true)
    try {
      // Busca o usuário pelo email no banco
      const res = await fetch(`http://localhost:8000/api/users/by-email/${encodeURIComponent(email)}`)

      if (!res.ok) {
        setErro('E-mail não encontrado. Verifique ou crie uma conta.')
        return
      }

      const usuario = await res.json()

      // Salva os dados do usuário no localStorage
      localStorage.setItem('userId', usuario.id)
      localStorage.setItem('userName', usuario.name)
      localStorage.setItem('userRole', usuario.role)

      navigate('/dashboard')
    } catch (err) {
      setErro('Não foi possível conectar ao servidor.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center relative overflow-hidden">

      {/* Blobs decorativos nos cantos */}
      <div className="absolute top-[-40px] left-[-40px] w-40 h-40 rounded-full bg-primary opacity-15" />
      <div className="absolute top-[20px] right-[10px] w-20 h-20 rounded-full bg-accent opacity-25" />
      <div className="absolute bottom-[30px] left-[20px] w-14 h-14 rounded-full bg-accent opacity-20" />
      <div className="absolute bottom-[-30px] right-[-20px] w-36 h-24 rounded-full bg-primary opacity-10" />

      {/* Card */}
      <div className="bg-white rounded-3xl shadow-lg px-8 py-10 w-full max-w-xs mx-4 z-10">

        {/* Logo */}
        <div className="flex flex-col items-center mb-6">
          <img src={logo} alt="Dose Certa" className="w-16 h-16 object-contain mb-1" />
          <h1 className="text-xl font-bold text-gray-800">Dose Certa</h1>
          <p className="text-gray-400 text-sm mt-1">Sua medicação sob controle</p>
        </div>

        {/* Formulário */}
        <form onSubmit={handleEntrar} className="flex flex-col gap-3">

          {/* Campo E-mail */}
          <div className="flex items-center gap-3 border border-gray-200 rounded-xl px-4 py-3 focus-within:border-primary transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-gray-400 shrink-0">
              <rect x="2" y="4" width="20" height="16" rx="3" stroke="currentColor" strokeWidth="1.8" />
              <path d="M2 8l10 6 10-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            <input
              type="email"
              placeholder="E-mail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1 outline-none text-sm text-gray-700 bg-transparent placeholder-gray-400"
            />
          </div>

          {/* Campo Senha */}
          <div className="flex items-center gap-3 border border-gray-200 rounded-xl px-4 py-3 focus-within:border-primary transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-gray-400 shrink-0">
              <rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.8" />
              <path d="M8 11V7a4 4 0 018 0v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            <input
              type={mostrarSenha ? 'text' : 'password'}
              placeholder="Senha"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className="flex-1 outline-none text-sm text-gray-700 bg-transparent placeholder-gray-400"
            />
            <button
              type="button"
              onClick={() => setMostrarSenha(!mostrarSenha)}
              className="text-gray-400 hover:text-gray-600"
            >
              {mostrarSenha ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  <line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="1.8" />
                  <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
                </svg>
              )}
            </button>
          </div>

          {/* Mensagem de erro */}
          {erro && (
            <p className="text-danger text-xs text-center">{erro}</p>
          )}

          {/* Botão Entrar */}
          <button
            type="submit"
            disabled={loading}
            className="bg-accent hover:bg-accent-dark text-white font-semibold rounded-full py-3 mt-2 transition-colors disabled:opacity-60"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>

          {/* Link criar conta */}
          <button
            type="button"
            className="text-primary text-sm text-center hover:underline mt-1"
            onClick={() => alert('Criar conta — em breve!')}
          >
            Criar conta
          </button>

        </form>
      </div>
    </div>
  )
}
