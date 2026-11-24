import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router'
import Layout from './Layout'
import { AuthProvider } from './auth'
import Home from './pages/Home'
import GamePage from './pages/GamePage'
import Engines from './pages/Engines'
import EngineDetail from './pages/EngineDetail'
import Runners from './pages/Runners'
import RunnerDetail from './pages/RunnerDetail'
import UploadInfo from './pages/UploadInfo'
import CliToken from './pages/CliToken'
import Register from './pages/Register'
import UserProfile from './pages/UserProfile'
import Tournaments from './pages/Tournaments'
import TournamentNew from './pages/TournamentNew'
import TournamentDetail from './pages/TournamentDetail'
import NotFound from './pages/NotFound'

// Markdown, renderer and figures stay out of the main bundle.
const Docs = lazy(() => import('./pages/Docs'))

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="game/:id" element={<GamePage />} />
            <Route path="engine" element={<Engines />} />
            <Route path="engine/upload" element={<UploadInfo />} />
            <Route path="runners" element={<Runners />} />
            <Route path="runners/:id" element={<RunnerDetail />} />
            <Route path="cli" element={<CliToken />} />
            <Route path="register" element={<Register />} />
            <Route path="tournament" element={<Tournaments />} />
            <Route path="tournament/new" element={<TournamentNew />} />
            <Route path="tournament/:id" element={<TournamentDetail />} />
            <Route
              path="docs/:slug?"
              element={
                <Suspense>
                  <Docs />
                </Suspense>
              }
            />
            {/* Static routes win over these; see RESERVED_HANDLES. */}
            <Route path=":login" element={<UserProfile />} />
            <Route path=":login/:engineName" element={<EngineDetail />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
