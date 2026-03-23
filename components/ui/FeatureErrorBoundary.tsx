'use client'

import { Component, type ReactNode } from 'react'
import * as Sentry from '@sentry/nextjs'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  name: string
}

interface State {
  hasError: boolean
  error: Error | null
}

export class FeatureErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[FeatureErrorBoundary:${this.props.name}]`, error, info.componentStack)
    Sentry.captureException(error, { tags: { feature: this.props.name } })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      return (
        <div className="glass rounded-[var(--r-lg)] p-4 text-center my-4">
          <p className="text-text text-sm font-semibold mb-1">Something went wrong</p>
          <p className="text-text-muted text-xs mb-3">
            The {this.props.name} section failed to load.
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-4 py-2 bg-accent text-background text-xs font-semibold rounded-[var(--r-md)] active:scale-95 transition-all"
          >
            Try again
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
