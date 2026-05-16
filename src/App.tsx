import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './hooks/useAuth'
import { ProtectedRoute } from './components/ProtectedRoute'
import { Toast } from './components/Toast'
import { Landing } from './pages/Landing'
import { Admin } from './pages/Admin'
import { AdminNewTeam } from './pages/AdminNewTeam'
import { AdminTeamDetail } from './pages/AdminTeamDetail'
import { MemberChat } from './pages/MemberChat'
import { Waiting } from './pages/Waiting'
import { SkillEditor } from './pages/SkillEditor'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/admin" element={
            <ProtectedRoute requiredRole="admin"><Admin /></ProtectedRoute>
          } />
          <Route path="/admin/new-team" element={
            <ProtectedRoute requiredRole="admin"><AdminNewTeam /></ProtectedRoute>
          } />
          <Route path="/admin/team/:id" element={
            <ProtectedRoute requiredRole="admin"><AdminTeamDetail /></ProtectedRoute>
          } />
          <Route path="/team" element={
            <ProtectedRoute><MemberChat /></ProtectedRoute>
          } />
          <Route path="/waiting" element={
            <ProtectedRoute><Waiting /></ProtectedRoute>
          } />
          <Route path="/skill-editor" element={
            <ProtectedRoute requiredRole="admin"><SkillEditor /></ProtectedRoute>
          } />
        </Routes>
        <Toast />
      </AuthProvider>
    </BrowserRouter>
  )
}
