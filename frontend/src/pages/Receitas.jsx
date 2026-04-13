import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

const BASE = 'http://localhost:8000'

// ── Tela de detalhe de uma receita ────────────────────────
function DetalheReceita({ id, onVoltar }) {
  const [receita, setReceita] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${BASE}/api/prescriptions/${id}`)
      .then(r => r.json())
      .then(data => { setReceita(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-gray-400 text-sm">Carregando...</p>
      </div>
    )
  }

  if (!receita) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-gray-400 text-sm">Receita não encontrada.</p>
      </div>
    )
  }

  const meds = receita.medications_json ? JSON.parse(receita.medications_json) : []

  return (
    <div className="flex flex-col gap-4">

      {/* Imagem da receita */}
      {receita.image_base64 ? (
        <div className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm">
          <img
            src={receita.image_base64}
            alt="Receita médica"
            className="w-full object-contain max-h-72"
          />
        </div>
      ) : (
        <div className="bg-gray-50 rounded-2xl border border-dashed border-gray-200 flex items-center justify-center h-32">
          <p className="text-gray-300 text-sm">Imagem não disponível</p>
        </div>
      )}

      {/* Data de escaneamento */}
      <p className="text-xs text-gray-400 text-center">
        Escaneada em {new Date(receita.scanned_at).toLocaleDateString('pt-BR', {
          day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
        })}
      </p>

      {/* Card: dados da receita */}
      <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
        <h3 className="font-bold text-gray-800 text-sm mb-3">Dados da Receita</h3>

        <div className="flex flex-col gap-2.5">
          <div className="flex justify-between items-start">
            <span className="text-[10px] text-gray-400 uppercase tracking-wide">Paciente</span>
            <span className="text-sm text-gray-700 font-medium text-right">
              {receita.patient_name || '—'}
            </span>
          </div>
          <div className="flex justify-between items-start">
            <span className="text-[10px] text-gray-400 uppercase tracking-wide">Data da Receita</span>
            <span className="text-sm text-gray-700 font-medium">
              {receita.prescription_date
                ? new Date(receita.prescription_date + 'T12:00:00').toLocaleDateString('pt-BR')
                : '—'}
            </span>
          </div>
        </div>
      </div>

      {/* Card: médico */}
      {(receita.doctor_name || receita.doctor_crm) && (
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
              <p className="text-sm font-medium text-gray-700">{receita.doctor_name || '—'}</p>
              {receita.doctor_crm && (
                <p className="text-xs text-gray-400 mt-0.5">{receita.doctor_crm}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Card: medicamentos */}
      {meds.length > 0 && (
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <h3 className="font-bold text-gray-800 text-sm mb-3">
            Medicamentos ({meds.length})
          </h3>
          <div className="flex flex-col gap-3">
            {meds.map((med, i) => (
              <div key={i} className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-800">{med.medication}</p>
                  {med.description && (
                    <p className="text-xs text-primary mt-0.5">{med.description}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-0.5">{med.frequency_original}</p>
                </div>
                <span className="text-xs text-gray-500 shrink-0 mt-0.5">{med.dosage}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Tela de lista de receitas ──────────────────────────────
export default function Receitas() {
  const navigate = useNavigate()
  const [receitas, setReceitas] = useState([])
  const [loading, setLoading] = useState(true)
  const [receitaSelecionada, setReceitaSelecionada] = useState(null) // id ou null

  const userId = localStorage.getItem('userId')

  useEffect(() => {
    fetch(`${BASE}/api/prescriptions/user/${userId}`)
      .then(r => r.json())
      .then(data => { setReceitas(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [userId])

  function formatarData(iso) {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString('pt-BR', {
      day: '2-digit', month: 'short', year: 'numeric'
    })
  }

  function contarMeds(medications_json) {
    if (!medications_json) return 0
    try { return JSON.parse(medications_json).length } catch { return 0 }
  }

  return (
    <div className="min-h-screen bg-background pb-8">

      {/* Header */}
      <header className="px-4 pt-4 pb-2 flex items-center sticky top-0 bg-background z-40">
        <button
          onClick={() => receitaSelecionada ? setReceitaSelecionada(null) : navigate('/perfil')}
          className="text-primary mr-3"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M19 12H5M12 5l-7 7 7 7" stroke="#006B5E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <h1 className="text-lg font-bold text-gray-800 flex-1 text-center pr-6">
          {receitaSelecionada ? 'Detalhes da Receita' : 'Receitas Escaneadas'}
        </h1>
      </header>

      <main className="px-4 flex flex-col gap-3 mt-2">

        {/* Detalhe de uma receita */}
        {receitaSelecionada && (
          <DetalheReceita
            id={receitaSelecionada}
            onVoltar={() => setReceitaSelecionada(null)}
          />
        )}

        {/* Lista */}
        {!receitaSelecionada && (
          <>
            {loading && (
              <div className="flex items-center justify-center py-20">
                <p className="text-gray-400 text-sm">Carregando...</p>
              </div>
            )}

            {!loading && receitas.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" stroke="#9CA3AF" strokeWidth="1.5" strokeLinejoin="round" />
                    <circle cx="12" cy="13" r="4" stroke="#9CA3AF" strokeWidth="1.5" />
                  </svg>
                </div>
                <p className="text-gray-400 text-sm">Nenhuma receita escaneada ainda.</p>
                <button
                  onClick={() => navigate('/escanear')}
                  className="text-primary text-sm font-semibold"
                >
                  Escanear primeira receita →
                </button>
              </div>
            )}

            {!loading && receitas.map(r => (
              <button
                key={r.id}
                onClick={() => setReceitaSelecionada(r.id)}
                className="w-full bg-white rounded-2xl p-4 border border-gray-100 shadow-sm text-left flex items-start gap-3 hover:border-primary transition-colors active:scale-[0.99]"
              >
                {/* Ícone */}
                <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center shrink-0">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="#006B5E" strokeWidth="1.5" strokeLinejoin="round" />
                    <polyline points="14 2 14 8 20 8" stroke="#006B5E" strokeWidth="1.5" strokeLinejoin="round" />
                    <line x1="16" y1="13" x2="8" y2="13" stroke="#006B5E" strokeWidth="1.5" strokeLinecap="round" />
                    <line x1="16" y1="17" x2="8" y2="17" stroke="#006B5E" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-800 truncate">
                    {r.doctor_name ? `Dr(a). ${r.doctor_name}` : 'Médico não identificado'}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {r.prescription_date
                      ? `Receita de ${new Date(r.prescription_date + 'T12:00:00').toLocaleDateString('pt-BR')}`
                      : 'Data da receita não identificada'}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[10px] font-semibold bg-green-50 text-primary px-2 py-0.5 rounded-full">
                      {contarMeds(r.medications_json)} medicamento{contarMeds(r.medications_json) !== 1 ? 's' : ''}
                    </span>
                    <span className="text-[10px] text-gray-300">·</span>
                    <span className="text-[10px] text-gray-400">
                      {formatarData(r.scanned_at)}
                    </span>
                  </div>
                </div>

                {/* Seta */}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="shrink-0 mt-1 text-gray-300">
                  <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            ))}
          </>
        )}
      </main>
    </div>
  )
}
