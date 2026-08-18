import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'
import { AuthProvider } from './store/auth'
import { ThemeProvider } from './store/theme'
import { BrandingProvider } from './store/branding'
import { Toaster } from 'react-hot-toast'

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('React Uncaught Error:', error, errorInfo)
  }

  handleReset = () => {
    localStorage.clear()
    window.location.href = '/login'
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-slate-900 text-white font-sans">
          <div className="max-w-md w-full bg-slate-800/80 backdrop-blur-xl p-8 rounded-3xl border border-slate-700 shadow-2xl text-center space-y-5">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center text-2xl font-bold">
              ⚠️
            </div>
            <h2 className="text-2xl font-bold">Application Alert</h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              An error occurred during rendering. Click below to clear cache and reload cleanly.
            </p>
            <div className="p-3 bg-slate-950/60 rounded-xl text-left text-xs font-mono text-amber-300 max-h-32 overflow-auto border border-slate-800">
              {this.state.error?.message || 'Uncaught Application Error'}
            </div>
            <button
              onClick={this.handleReset}
              className="w-full py-3.5 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-lg shadow-indigo-600/30 transition-all"
            >
              Reset Session & Reload
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <ThemeProvider>
          <BrandingProvider>
            <AuthProvider>
              <App />
              <Toaster position="top-right" toastOptions={{ style: { borderRadius: '12px' } }} />
            </AuthProvider>
          </BrandingProvider>
        </ThemeProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>,
)
