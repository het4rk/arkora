'use client'

import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      return (
        <div className="min-h-[50vh] flex flex-col items-center justify-center px-6 text-center">
          <p className="text-text text-lg font-semibold mb-2">Something went wrong</p>
          <p className="text-text-muted text-sm mb-6">
            An unexpected error occurred. Try refreshing the page.
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-5 py-2.5 bg-accent text-white text-sm font-semibold rounded-[var(--r-md)] active:scale-95 transition-all"
          >
            Try again
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
