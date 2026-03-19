import React, { Suspense, lazy } from 'react'
import { Routes, Route, Outlet } from 'react-router-dom'
import './App.css'
import ScrollToTop from './components/ScrollToTop.jsx'
import Layout from './components/Layout/Layout.jsx'
import Footer from './components/Footer/Footer.jsx'
import Loader from './components/Loader/Loader.jsx'
import SessionExpiredModal from './components/Auth/SessionExpiredModal.jsx'
import RequireAuth from './components/Auth/RequireAuth.jsx'

// Chargement immédiat — pages visitées sans être connecté
import Home from './pages/Home/Home.jsx'
import Article from './pages/Article/Article.jsx'
import Login from './components/Auth/Login.jsx'
import Signup from './components/Auth/Signup.jsx'
import Catalog from './components/ArticlesCatalog/ArticlesCatalog.jsx'

// Chargement différé — pages lourdes ou nécessitant une connexion
const Profile        = lazy(() => import('./pages/UsersProfil/Profile.jsx'))
const OtherProfil    = lazy(() => import('./pages/UsersProfil/Profil/OtherProfil.jsx'))
const AuteurRoutes   = lazy(() => import('./pages/Dashboards/Auteur/index.jsx'))
const AdminRoutes    = lazy(() => import('./pages/Dashboards/Admin/index.jsx'))
const Notifications  = lazy(() => import('./pages/Notifications/Notifications.jsx'))
const Search         = lazy(() => import('./pages/Search/Search.jsx'))
const NotFound       = lazy(() => import('./pages/NotFound/NotFound.jsx'))
const ForgotPassword = lazy(() => import('./components/Auth/ForgotPassword.jsx'))
const ResetPassword  = lazy(() => import('./components/Auth/ResetPassword.jsx'))
const AuthCallback   = lazy(() => import('./pages/AuthCallback/AuthCallback.jsx'))

// Layout pour les pages normales (avec .page + Footer)
const PageLayout = () => (
  <>
    <div className="page">
      <Outlet />
    </div>
    <Footer />
  </>
)

const App = () => {
  const [theme, setTheme] = React.useState('light');

  React.useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) { setTheme(savedTheme); return; }
    const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (systemPrefersDark) setTheme("dark");
  }, []);

  return (
    <div className={`container ${theme}`}>
      <Layout theme={theme} setTheme={setTheme} />
      <SessionExpiredModal />

      <main className="main-content">
        <Suspense fallback={<Loader />}>
          <Routes>
            {/* ── Routes AUTH — plein écran, sans .page ni Footer ── */}
            <Route path="/login"           element={<Login />} />
            <Route path="/signup"          element={<Signup />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password"  element={<ResetPassword />} />
            <Route path="/auth/callback"   element={<AuthCallback />} />

            {/* ── Routes normales — avec .page wrapper + Footer ── */}
            <Route element={<PageLayout />}>
              <Route path="/"               element={<Home />} />
              <Route path="/catalog"        element={<Catalog />} />
              <Route path="/Catalog"        element={<Catalog />} />
              <Route path="/article/:slug"  element={<Article />} />
              <Route path="/Article/:slug"  element={<Article />} />
              <Route path="/search"         element={<Search />} />
              <Route path="/profil/:userId" element={<OtherProfil />} />

              {/* ── Routes protégées ── */}
              <Route path="/profile"            element={<RequireAuth><Profile /></RequireAuth>} />
              <Route path="/notifications"      element={<RequireAuth><Notifications /></RequireAuth>} />
              <Route path="/dashboard/auteur/*" element={<RequireAuth><AuteurRoutes /></RequireAuth>} />
              <Route path="/dashboard/admin/*"  element={<RequireAuth><AdminRoutes /></RequireAuth>} />

              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </Suspense>
      </main>

      <ScrollToTop />
    </div>
  )
}

export default App
