import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import TestPanel from './pages/TestPanel'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Medicamentos from './pages/Medicamentos'
import Escanear from './pages/Escanear'
import Chat from './pages/Chat'

// Placeholder temporário para rotas ainda não implementadas
function EmBreve({ nome }) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="bg-white rounded-2xl p-8 shadow-md text-center">
        <p className="text-gray-400 text-sm">Tela "{nome}" em construção...</p>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />

        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/medicamentos" element={<Medicamentos />} />
        <Route path="/escanear" element={<Escanear />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/perfil" element={<EmBreve nome="Perfil" />} />

        {/* Painel de testes original */}
        <Route path="/test" element={<TestPanel />} />
      </Routes>
    </BrowserRouter>
  )
}
