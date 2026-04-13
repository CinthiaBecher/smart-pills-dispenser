import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import PrivateRoute from './components/PrivateRoute'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import CaregiverDashboard from './pages/CaregiverDashboard'
import Medicamentos from './pages/Medicamentos'
import Escanear from './pages/Escanear'
import Chat from './pages/Chat'
import Perfil from './pages/Perfil'
import Receitas from './pages/Receitas'
import TestPanel from './pages/TestPanel'

// Redireciona para o dashboard certo de acordo com o papel do usuário
function RoleDashboard() {
  const role = localStorage.getItem('userRole')
  if (role === 'caregiver') return <CaregiverDashboard />
  return <Dashboard />
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
        <Route path="/dashboard"    element={<PrivateRoute><RoleDashboard /></PrivateRoute>} />
        <Route path="/medicamentos" element={<PrivateRoute><Medicamentos /></PrivateRoute>} />
        <Route path="/escanear"     element={<PrivateRoute><Escanear /></PrivateRoute>} />
        <Route path="/chat"         element={<PrivateRoute><Chat /></PrivateRoute>} />
        <Route path="/perfil"       element={<PrivateRoute><Perfil /></PrivateRoute>} />
        <Route path="/receitas"     element={<PrivateRoute><Receitas /></PrivateRoute>} />

        {/* Painel de testes — sem proteção */}
        <Route path="/test" element={<TestPanel />} />
      </Routes>
    </BrowserRouter>
  )
}
