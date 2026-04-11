import { Navigate } from 'react-router-dom'

// Envolve qualquer rota que precisa de login
// Se não tiver userId salvo, redireciona pro Login
export default function PrivateRoute({ children }) {
  const userId = localStorage.getItem('userId')
  if (!userId) return <Navigate to="/login" replace />
  return children
}
