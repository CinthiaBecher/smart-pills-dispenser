import { useState, useEffect } from 'react'

const PROGRESS_STEPS = [
  'Lendo receita...',
  'Identificando medicamentos...',
  'Validando dados...',
  'Concluído!',
]

export default function ScanValidation({ dadosReceita, userName, onContinuar, onTentarNovamente }) {
  const [progressStep, setProgressStep] = useState(0)
  const [progressDone, setProgressDone] = useState(false)
  const [showModal, setShowModal] = useState(false)

  // Anima a barra de progresso quando o componente monta
  useEffect(() => {
    let step = 0
    const interval = setInterval(() => {
      step += 1
      setProgressStep(step)
      if (step >= PROGRESS_STEPS.length - 1) {
        clearInterval(interval)
        setProgressDone(true)
      }
    }, 550)
    return () => clearInterval(interval)
  }, [])

  // ── Lógica de validação ──────────────────────────────────
  const patientName = dadosReceita?.patient_name
  const prescriptionDate = dadosReceita?.prescription_date
  const doctorName = dadosReceita?.doctor_name
  const doctorCrm = dadosReceita?.doctor_crm

  // Receita vencida = data da receita há mais de 6 meses
  const isExpired = (() => {
    if (!prescriptionDate) return false
    const prescDate = new Date(prescriptionDate + 'T12:00:00')
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
    return prescDate < sixMonthsAgo
  })()

  // Compara primeiro nome do paciente na receita com o do usuário logado
  // null = não foi possível determinar (nome ausente)
  const nameMatch = (() => {
    if (!patientName || !userName) return null
    const firstWord = (s) => s.toLowerCase().trim().split(' ')[0]
    return firstWord(patientName) === firstWord(userName)
  })()

  // Receita é válida se não estiver vencida E o nome bater (ou não puder ser determinado)
  const isValid = !isExpired && nameMatch !== false

  function handleContinuar() {
    if (!isValid) {
      setShowModal(true)
    } else {
      onContinuar()
    }
  }

  // ── Render ───────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4">

      {/* Barra de progresso animada */}
      <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
        <div className="flex justify-between mb-3">
          {PROGRESS_STEPS.map((step, i) => (
            <span
              key={i}
              className={`text-[10px] font-medium transition-colors duration-300 text-center flex-1 ${
                i <= progressStep ? 'text-primary' : 'text-gray-300'
              }`}
            >
              {step}
            </span>
          ))}
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-accent rounded-full transition-all duration-500"
            style={{ width: `${(progressStep / (PROGRESS_STEPS.length - 1)) * 100}%` }}
          />
        </div>
      </div>

      {/* Conteúdo só aparece após a animação terminar */}
      {progressDone && (
        <>
          {/* Card: Dados da Receita */}
          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-gray-800 text-sm">Dados da Receita</h3>
              <div className="flex items-center gap-1 bg-green-50 text-primary text-[10px] font-semibold px-2 py-1 rounded-full">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="2" />
                  <path d="M7 11V7a5 5 0 0110 0v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                Ambiente Seguro
              </div>
            </div>

            {/* Nome do paciente */}
            <div className="py-2.5 border-b border-gray-50">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide">Paciente</p>
                  <p className="text-sm font-medium text-gray-700 mt-0.5">
                    {patientName || 'Não identificado'}
                  </p>
                </div>
                {patientName && (
                  nameMatch !== false ? (
                    /* Check verde */
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" fill="#2D9E75" fillOpacity="0.12" />
                      <path d="M8 12l3 3 5-5" stroke="#2D9E75" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    /* Triângulo de aviso laranja */
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" fill="#EF9F27" fillOpacity="0.15" stroke="#EF9F27" strokeWidth="1.5" strokeLinejoin="round" />
                      <path d="M12 9v4" stroke="#EF9F27" strokeWidth="1.8" strokeLinecap="round" />
                      <circle cx="12" cy="16.5" r="0.6" fill="#EF9F27" stroke="#EF9F27" strokeWidth="0.5" />
                    </svg>
                  )
                )}
              </div>
              {patientName && nameMatch === false && (
                <p className="text-[11px] text-yellow-600 mt-1">
                  Nome diferente do seu cadastro ({userName})
                </p>
              )}
            </div>

            {/* Data da receita */}
            <div className="py-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide">Data da Receita</p>
                  <p className="text-sm font-medium text-gray-700 mt-0.5">
                    {prescriptionDate
                      ? new Date(prescriptionDate + 'T12:00:00').toLocaleDateString('pt-BR')
                      : 'Não identificada'}
                  </p>
                </div>
                {prescriptionDate && (
                  !isExpired ? (
                    /* Check verde */
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" fill="#2D9E75" fillOpacity="0.12" />
                      <path d="M8 12l3 3 5-5" stroke="#2D9E75" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    /* Triângulo de aviso laranja */
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" fill="#EF9F27" fillOpacity="0.15" stroke="#EF9F27" strokeWidth="1.5" strokeLinejoin="round" />
                      <path d="M12 9v4" stroke="#EF9F27" strokeWidth="1.8" strokeLinecap="round" />
                      <circle cx="12" cy="16.5" r="0.6" fill="#EF9F27" stroke="#EF9F27" strokeWidth="0.5" />
                    </svg>
                  )
                )}
              </div>
              {prescriptionDate && isExpired && (
                <p className="text-[11px] text-yellow-600 mt-1">
                  Receita com mais de 6 meses — confirme com seu médico
                </p>
              )}
            </div>
          </div>

          {/* Card: Resultado da validação */}
          {isValid ? (
            <div className="bg-green-50 border border-green-100 rounded-2xl p-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: '#2D9E75' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M5 13l4 4L19 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div>
                  <p className="font-bold text-green-800 text-sm">Receita válida e prescrita para você</p>
                  <p className="text-green-600 text-xs mt-1">
                    Os dados extraídos do documento foram validados com sucesso.
                  </p>
                </div>
              </div>
            </div>
          ) : isExpired ? (
            <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: '#EF9F27' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="white" strokeWidth="2" strokeLinejoin="round" />
                    <path d="M12 9v4" stroke="white" strokeWidth="2" strokeLinecap="round" />
                    <circle cx="12" cy="16.5" r="0.8" fill="white" />
                  </svg>
                </div>
                <div>
                  <p className="font-bold text-orange-800 text-sm">Receita possivelmente desatualizada</p>
                  <p className="text-orange-600 text-xs mt-1">
                    A data desta receita é antiga. Recomendamos confirmar com seu médico se ela ainda é válida antes de continuar.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-yellow-50 border border-yellow-100 rounded-2xl p-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: '#EF9F27' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M12 8v5" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
                    <circle cx="12" cy="16" r="0.5" fill="white" stroke="white" strokeWidth="1.5" />
                  </svg>
                </div>
                <div>
                  <p className="font-bold text-yellow-800 text-sm">Receita pertence a outro paciente</p>
                  <p className="text-yellow-600 text-xs mt-1">
                    O nome na receita não corresponde ao seu cadastro. Verifique se a receita é sua.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Card: Médico prescritor (informativo, sem validação) */}
          {(doctorName || doctorCrm) && (
            <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
              <h3 className="font-bold text-gray-800 text-sm mb-3">Médico Prescritor</h3>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center shrink-0">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" />
                    <circle cx="12" cy="7" r="4" stroke="#9CA3AF" strokeWidth="1.5" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">{doctorName || '—'}</p>
                  {doctorCrm && <p className="text-xs text-gray-400 mt-0.5">{doctorCrm}</p>}
                </div>
              </div>
            </div>
          )}

          {/* Botão Tentar Novamente (só aparece se inválido) */}
          {!isValid && (
            <button
              onClick={onTentarNovamente}
              className="flex items-center justify-center gap-2 w-full border-2 border-primary text-primary font-semibold rounded-full py-3 hover:bg-green-50 transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M23 4v6h-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Tentar Novamente
            </button>
          )}

          {/* Botão Continuar */}
          <button
            onClick={handleContinuar}
            className={`w-full font-semibold rounded-full py-3 transition-colors ${
              isValid
                ? 'bg-accent hover:bg-accent-dark text-white'
                : 'text-white hover:opacity-90'
            }`}
            style={!isValid ? { backgroundColor: '#D85A30' } : {}}
          >
            Continuar
          </button>
        </>
      )}

      {/* Modal de confirmação — receita inválida */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <h3 className="font-bold text-gray-800 mb-2">Deseja continuar mesmo assim?</h3>
            <p className="text-sm text-gray-500 mb-6 leading-relaxed">
              A receita parece estar vencida ou ilegível. Prosseguir com dados incorretos pode
              afetar a segurança do seu tratamento.
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="w-full bg-accent hover:bg-accent-dark text-white font-semibold rounded-full py-3 transition-colors"
              >
                Voltar
              </button>
              <button
                onClick={() => { setShowModal(false); onContinuar() }}
                className="w-full border-2 border-gray-200 text-gray-500 font-semibold rounded-full py-3 hover:bg-gray-50 transition-colors"
              >
                Continuar assim mesmo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
