import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import TestPanel from './pages/TestPanel'
import Login from './pages/Login'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Redireciona a raiz para login */}
        <Route path="/" element={<Navigate to="/login" replace />} />

        {/* Telas do app */}
        <Route path="/login" element={<Login />} />

        {/* Painel de testes antigo — mantido para referência */}
        <Route path="/test" element={<TestPanel />} />
      </Routes>
    </BrowserRouter>
  )
}
