import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import PrivateRoute from './components/PrivateRoute'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Medicamentos from './pages/Medicamentos'
import Escanear from './pages/Escanear'
import Chat from './pages/Chat'
import Perfil from './pages/Perfil'
import TestPanel from './pages/TestPanel'

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
        {/* Raiz → Login */}
        <Route path="/" element={<Navigate to="/login" replace />} />

        {/* Rotas públicas */}
        <Route path="/login" element={<Login />} />
        <Route path="/cadastro" element={<Register />} />

        {/* Rotas privadas — exigem login */}
        <Route path="/dashboard"    element={<PrivateRoute><Dashboard /></PrivateRoute>} />
        <Route path="/medicamentos" element={<PrivateRoute><Medicamentos /></PrivateRoute>} />
        <Route path="/escanear"     element={<PrivateRoute><Escanear /></PrivateRoute>} />
        <Route path="/chat"         element={<PrivateRoute><Chat /></PrivateRoute>} />
        <Route path="/perfil"       element={<PrivateRoute><Perfil /></PrivateRoute>} />

        {/* Painel de testes — sem proteção */}
        <Route path="/test" element={<TestPanel />} />
      </Routes>
    </BrowserRouter>
  )
}
