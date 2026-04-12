import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import logo from '../assets/logo.png'

const BASE = 'http://localhost:8000'

export default function Register() {
  const navigate = useNavigate()
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('patient')
  const [emailPaciente, setEmailPaciente] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  async function handleCadastro(e) {
    e.preventDefault()
    setErro('')

    if (!nome.trim()) { setErro('O nome é obrigatório.'); return }
    if (!email.trim()) { setErro('O e-mail é obrigatório.'); return }
    if (role === 'caregiver' && !emailPaciente.trim()) {
      setErro('Informe o e-mail do paciente que você cuida.')
      return
    }

    setLoading(true)
    try {
      const body = { name: nome.trim(), email: email.trim(), role }
      if (role === 'caregiver') body.patient_email = emailPaciente.trim()

      const res = await fetch(`${BASE}/api/users/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await res.json()

      if (!res.ok) {
        setErro(data.detail || 'Erro ao criar conta.')
        return
      }

      // Redireciona pro login com flag de sucesso
      navigate('/login?cadastro=sucesso')
    } catch {
      setErro('Não foi possível conectar ao servidor.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center relative overflow-hidden">

      {/* Blobs decorativos */}
      <div className="absolute top-[-40px] left-[-40px] w-40 h-40 rounded-full bg-primary opacity-15" />
      <div className="absolute top-[20px] right-[10px] w-20 h-20 rounded-full bg-accent opacity-25" />
      <div className="absolute bottom-[30px] left-[20px] w-14 h-14 rounded-full bg-accent opacity-20" />
      <div className="absolute bottom-[-30px] right-[-20px] w-36 h-24 rounded-full bg-primary opacity-10" />

      {/* Card */}
      <div className="bg-white rounded-3xl shadow-lg px-8 py-10 w-full max-w-xs mx-4 z-10">

        {/* Logo */}
        <div className="flex flex-col items-center mb-6">
          <img src={logo} alt="Dose Certa" className="w-14 h-14 object-contain mb-1" />
          <h1 className="text-xl font-bold text-gray-800">Criar conta</h1>
          <p className="text-gray-400 text-sm mt-1">Dose Certa</p>
        </div>

        <form onSubmit={handleCadastro} className="flex flex-col gap-3">

          {/* Nome */}
          <div className="flex items-center gap-3 border border-gray-200 rounded-xl px-4 py-3 focus-within:border-primary transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-gray-400 shrink-0">
              <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.8" />
              <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            <input
              type="text"
              placeholder="Nome completo"
              value={nome}
              onChange={e => setNome(e.target.value)}
              className="flex-1 outline-none text-sm text-gray-700 bg-transparent placeholder-gray-400"
            />
          </div>

          {/* Email */}
          <div className="flex items-center gap-3 border border-gray-200 rounded-xl px-4 py-3 focus-within:border-primary transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-gray-400 shrink-0">
              <rect x="2" y="4" width="20" height="16" rx="3" stroke="currentColor" strokeWidth="1.8" />
              <path d="M2 8l10 6 10-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            <input
              type="email"
              placeholder="E-mail"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="flex-1 outline-none text-sm text-gray-700 bg-transparent placeholder-gray-400"
            />
          </div>

          {/* Toggle Paciente / Cuidador */}
          <div>
            <p className="text-xs text-gray-400 mb-2 ml-1">Você é:</p>
            <div className="flex rounded-full border border-gray-200 overflow-hidden">
              <button
                type="button"
                onClick={() => setRole('patient')}
                className={`flex-1 py-2 text-sm font-semibold transition-colors ${
                  role === 'patient'
                    ? 'bg-primary text-white'
                    : 'bg-white text-gray-400 hover:text-gray-600'
                }`}
              >
                Paciente
              </button>
              <button
                type="button"
                onClick={() => setRole('caregiver')}
                className={`flex-1 py-2 text-sm font-semibold transition-colors ${
                  role === 'caregiver'
                    ? 'bg-primary text-white'
                    : 'bg-white text-gray-400 hover:text-gray-600'
                }`}
              >
                Cuidador
              </button>
            </div>
          </div>

          {/* Campo extra: email do paciente (só para cuidador) */}
          {role === 'caregiver' && (
            <div className="flex items-center gap-3 border border-gray-200 rounded-xl px-4 py-3 focus-within:border-primary transition-colors">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-gray-400 shrink-0">
                <path d="M4.5 12.5L11.5 5.5C13.5 3.5 16.5 3.5 18.5 5.5C20.5 7.5 20.5 10.5 18.5 12.5L11.5 19.5C9.5 21.5 6.5 21.5 4.5 19.5C2.5 17.5 2.5 14.5 4.5 12.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                <line x1="8.5" y1="15.5" x2="15.5" y2="8.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
              <input
                type="email"
                placeholder="E-mail do paciente que você cuida"
                value={emailPaciente}
                onChange={e => setEmailPaciente(e.target.value)}
                className="flex-1 outline-none text-sm text-gray-700 bg-transparent placeholder-gray-400"
              />
            </div>
          )}

          {/* Erro */}
          {erro && <p className="text-danger text-xs text-center">{erro}</p>}

          {/* Botão */}
          <button
            type="submit"
            disabled={loading}
            className="bg-accent hover:bg-accent-dark text-white font-semibold rounded-full py-3 mt-1 transition-colors disabled:opacity-60"
          >
            {loading ? 'Criando conta...' : 'Criar conta'}
          </button>

          {/* Link voltar pro login */}
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="text-primary text-sm text-center hover:underline mt-1"
          >
            Já tem conta? Entrar
          </button>

        </form>
      </div>
    </div>
  )
}
