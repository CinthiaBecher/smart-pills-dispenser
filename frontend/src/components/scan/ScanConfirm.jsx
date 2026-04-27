// Espelha a lógica de geração de horários do backend para exibição no resumo
function frequencyToTimes(frequency) {
  if (!frequency) return ['08:00']
  const f = frequency.toLowerCase()
  if (f.includes('4x') || f.includes('a cada 6')) return ['08:00', '12:00', '18:00', '22:00']
  if (f.includes('3x') || f.includes('a cada 8')) return ['08:00', '14:00', '20:00']
  if (f.includes('2x') || f.includes('a cada 12') || (f.includes('manhã') && f.includes('noite'))) return ['08:00', '20:00']
  if (f.includes('noite') || f.includes('dormir') || f.includes('deitar')) return ['22:00']
  if (f.includes('manhã') || f.includes('jejum')) return ['08:00']
  return ['08:00']
}

export default function ScanConfirm({ medicamentos, onVoltar, onSalvar, salvando, sucesso, navigate }) {
  // Tela de sucesso — exibida após salvar com êxito
  if (sucesso) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 py-16 px-4">
        {/* Animação de check */}
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center"
          style={{ backgroundColor: '#2D9E75' }}
        >
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
            <path
              d="M5 13l4 4L19 7"
              stroke="white"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <div className="text-center">
          <h2 className="text-xl font-bold text-gray-800 mb-2">
            Tratamento cadastrado com sucesso!
          </h2>
          <p className="text-gray-400 text-sm">
            Seus medicamentos e horários foram salvos. Você receberá notificações nos horários programados.
          </p>
        </div>
        <button
          onClick={() => navigate('/dashboard')}
          className="w-full bg-accent hover:bg-accent-dark text-white font-semibold rounded-full py-3 transition-colors"
        >
          Ir para o Dashboard
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-gray-400 text-sm text-center">
        Revise o resumo antes de salvar o tratamento
      </p>

      {/* Cards de resumo por medicamento */}
      {medicamentos.map((med, i) => {
        const horarios = med._times || frequencyToTimes(med.frequency)
        return (
          <div key={i} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
            {/* Nome + dosagem */}
            <div className="flex items-start justify-between mb-1">
              <h3 className="font-bold text-gray-800">
                {med.name} <span className="font-normal text-gray-500">{med.dosage}</span>
              </h3>
            </div>

            {/* Badges de horários */}
            <div className="flex flex-wrap gap-1.5">
              {horarios.map(h => (
                <span
                  key={h}
                  className="text-xs font-semibold px-2.5 py-1 rounded-full text-white"
                  style={{ backgroundColor: '#B5CC18' }}
                >
                  {h}
                </span>
              ))}
            </div>

            {/* Frequência e via */}
            <p className="text-[11px] text-gray-400 mt-2">
              {med.frequency} · via {med.route}
              {med.duration_days ? ` · por ${med.duration_days} dias` : ' · uso contínuo'}
            </p>
          </div>
        )
      })}

      {/* Aviso importante */}
      <div className="bg-yellow-50 border border-yellow-100 rounded-2xl p-4">
        <div className="flex items-start gap-3">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="shrink-0 mt-0.5">
            <path
              d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
              stroke="#EF9F27"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <line x1="12" y1="9" x2="12" y2="13" stroke="#EF9F27" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="12" y1="17" x2="12.01" y2="17" stroke="#EF9F27" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <p className="text-xs text-yellow-700 leading-relaxed">
            Certifique-se de que os horários coincidem com as orientações do seu médico.
            Você receberá notificações nos horários programados.
          </p>
        </div>
      </div>

      {/* Botão principal: Começar tratamento */}
      <button
        onClick={onSalvar}
        disabled={salvando}
        className="w-full flex items-center justify-center gap-2 bg-accent hover:bg-accent-dark text-white font-bold rounded-full py-4 text-base transition-colors disabled:opacity-60"
      >
        {salvando ? (
          'Salvando...'
        ) : (
          <>
            {/* Ícone de play */}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <polygon points="5 3 19 12 5 21 5 3" fill="white" stroke="white" strokeWidth="1.5" strokeLinejoin="round" />
            </svg>
            Começar tratamento
          </>
        )}
      </button>

      {/* Link voltar */}
      <button
        onClick={onVoltar}
        className="text-primary text-sm text-center font-medium py-1 hover:underline"
      >
        Voltar para editar
      </button>
    </div>
  )
}
