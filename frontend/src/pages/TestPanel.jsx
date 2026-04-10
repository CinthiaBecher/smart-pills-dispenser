import { useState } from 'react'

const BASE = 'http://localhost:8000'

// Definição de todos os endpoints do painel
const ENDPOINTS = [
  {
    group: 'Usuários',
    actions: [
      {
        label: '+ Criar usuário',
        method: 'POST',
        path: '/api/users/',
        fields: [
          { name: 'name', label: 'Nome', type: 'text' },
          { name: 'email', label: 'Email', type: 'text' },
          { name: 'role', label: 'Papel', type: 'select', options: ['patient', 'caregiver'] },
        ],
      },
      {
        label: '📋 Listar usuários',
        method: 'GET',
        path: '/api/users/',
      },
      {
        label: '🔍 Buscar por ID',
        method: 'GET',
        path: '/api/users/{id}',
        fields: [{ name: 'id', label: 'ID do usuário', type: 'text' }],
      },
    ],
  },
  {
    group: 'Medicamentos',
    actions: [
      {
        label: '+ Criar medicamento',
        method: 'POST',
        path: '/api/medications/',
        fields: [
          { name: 'user_id', label: 'ID do usuário', type: 'text' },
          { name: 'name', label: 'Nome', type: 'text' },
          { name: 'dosage', label: 'Dosagem (ex: 50mg)', type: 'text' },
          { name: 'route', label: 'Via (ex: oral)', type: 'text' },
          { name: 'instructions', label: 'Instruções', type: 'text' },
        ],
      },
      {
        label: '📋 Listar por usuário',
        method: 'GET',
        path: '/api/medications/user/{user_id}',
        fields: [{ name: 'user_id', label: 'ID do usuário', type: 'text' }],
      },
      {
        label: '🔍 Buscar por ID',
        method: 'GET',
        path: '/api/medications/{id}',
        fields: [{ name: 'id', label: 'ID do medicamento', type: 'text' }],
      },
    ],
  },
  {
    group: 'Agendamentos',
    actions: [
      {
        label: '+ Criar agendamento',
        method: 'POST',
        path: '/api/schedules/',
        fields: [
          { name: 'medication_id', label: 'ID do medicamento', type: 'text' },
          { name: 'time', label: 'Horário (ex: 08:00)', type: 'text' },
          { name: 'frequency', label: 'Frequência (ex: daily)', type: 'text' },
        ],
      },
      {
        label: '📋 Listar por medicamento',
        method: 'GET',
        path: '/api/schedules/medication/{medication_id}',
        fields: [{ name: 'medication_id', label: 'ID do medicamento', type: 'text' }],
      },
    ],
  },
  {
    group: 'Prescrições (IA)',
    actions: [
      {
        label: '📷 Interpretar receita',
        method: 'POST',
        path: '/api/prescriptions/interpret',
        fields: [{ name: 'file', label: 'Imagem da receita', type: 'file' }],
      },
      {
        label: '✅ Confirmar prescrição',
        method: 'POST',
        path: '/api/prescriptions/confirm',
        fields: [
          { name: 'user_id', label: 'ID do usuário', type: 'text' },
          { name: 'medications', label: 'Medicamentos (JSON array)', type: 'json' },
        ],
      },
    ],
  },
  {
    group: 'Chat (IA)',
    actions: [
      {
        label: '💬 Enviar mensagem',
        method: 'POST',
        path: '/api/chat/',
        fields: [
          { name: 'user_id', label: 'ID do usuário', type: 'text' },
          { name: 'message', label: 'Mensagem', type: 'text' },
        ],
      },
    ],
  },
]

function Modal({ action, onClose }) {
  const [form, setForm] = useState({})
  const [response, setResponse] = useState(null)
  const [loading, setLoading] = useState(false)
  const [isError, setIsError] = useState(false)

  async function handleSubmit() {
    setLoading(true)
    setResponse(null)
    setIsError(false)

    try {
      let url = BASE + action.path
      let options = { method: action.method }

      // Substitui parâmetros de path como {id}, {user_id}, etc.
      Object.keys(form).forEach((key) => {
        url = url.replace(`{${key}}`, form[key])
      })

      if (action.method === 'POST' && action.fields) {
        const fileField = action.fields.find((f) => f.type === 'file')

        if (fileField) {
          // Upload de arquivo usa FormData
          const fd = new FormData()
          fd.append('file', form[fileField.name])
          options.body = fd
        } else {
          // Campos do tipo 'json' precisam ser parseados antes de enviar
          const parsed = { ...form }
          action.fields.forEach((f) => {
            if (f.type === 'json' && typeof parsed[f.name] === 'string') {
              try { parsed[f.name] = JSON.parse(parsed[f.name]) } catch {}
            }
          })
          options.headers = { 'Content-Type': 'application/json' }
          options.body = JSON.stringify(parsed)
        }
      }

      const res = await fetch(url, options)
      const data = await res.json()
      setIsError(!res.ok)
      setResponse(JSON.stringify(data, null, 2))
    } catch (err) {
      setIsError(true)
      setResponse(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h3>{action.label}</h3>

        {action.fields?.map((field) => (
          <label key={field.name}>
            {field.label}
            {field.type === 'select' ? (
              <select onChange={(e) => setForm({ ...form, [field.name]: e.target.value })}>
                <option value="">Selecione...</option>
                {field.options.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            ) : field.type === 'json' ? (
              <textarea
                rows={5}
                placeholder='[{"name": "Losartana", "dosage": "50mg", "route": "oral", "frequency": "1x ao dia"}]'
                style={{ display: 'block', width: '100%', marginTop: 4, padding: '8px 10px', border: '1px solid #ddd', borderRadius: 6, fontSize: '0.82rem', fontFamily: 'monospace', resize: 'vertical' }}
                onChange={(e) => setForm({ ...form, [field.name]: e.target.value })}
              />
            ) : field.type === 'file' ? (
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setForm({ ...form, [field.name]: e.target.files[0] })}
              />
            ) : (
              <input
                type="text"
                placeholder={field.label}
                onChange={(e) => setForm({ ...form, [field.name]: e.target.value })}
              />
            )}
          </label>
        ))}

        <div className="modal-actions">
          <button className="btn-cancel" onClick={onClose}>Cancelar</button>
          <button className="btn-confirm" onClick={handleSubmit} disabled={loading}>
            {loading ? 'Aguarde...' : 'Executar'}
          </button>
        </div>

        {response && (
          <div className={`response-box ${isError ? 'error' : ''}`}>
            {response}
          </div>
        )}
      </div>
    </div>
  )
}

export default function App() {
  const [activeAction, setActiveAction] = useState(null)

  return (
    <>
      <h1>💊 Smart Pills Dispenser — Painel de Testes</h1>

      <div className="groups">
        {ENDPOINTS.map((group) => (
          <div className="group" key={group.group}>
            <h2>{group.group}</h2>
            {group.actions.map((action) => (
              <button key={action.label} onClick={() => setActiveAction(action)}>
                {action.label}
              </button>
            ))}
          </div>
        ))}
      </div>

      {activeAction && (
        <Modal action={activeAction} onClose={() => setActiveAction(null)} />
      )}
    </>
  )
}
