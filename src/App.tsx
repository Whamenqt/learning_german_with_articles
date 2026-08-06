import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '@/lib/AuthContext'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { LoginPage } from '@/pages/admin/LoginPage'
import { DashboardPage } from '@/pages/admin/DashboardPage'
import { NewArticlePage } from '@/pages/admin/NewArticlePage'
import { GeneratePage } from '@/pages/admin/GeneratePage'
import { EditorPage } from '@/pages/admin/EditorPage'
import { ArticlePage } from '@/pages/public/ArticlePage'
import { SentencePracticePage } from '@/pages/public/SentencePracticePage'
import { NotFoundPage } from '@/pages/public/NotFoundPage'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Navigate to="/admin" replace />} />
          <Route path="/login" element={<LoginPage />} />

          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/articles/new"
            element={
              <ProtectedRoute>
                <NewArticlePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/articles/:id/generate"
            element={
              <ProtectedRoute>
                <GeneratePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/articles/:id/edit"
            element={
              <ProtectedRoute>
                <EditorPage />
              </ProtectedRoute>
            }
          />

          {/* Public, unauthenticated */}
          <Route path="/articles/:slug" element={<ArticlePage />} />
          <Route path="/practice" element={<SentencePracticePage />} />

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
