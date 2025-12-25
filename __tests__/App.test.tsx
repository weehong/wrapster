import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import App from '@/App'

vi.mock('@/lib/appwrite', () => ({
  authService: {
    getCurrentUser: vi.fn(),
  },
}))

vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: vi.fn().mockReturnValue(false),
}))

describe('App', () => {
  beforeEach(async () => {
    const { authService } = await import('@/lib/appwrite')
    vi.mocked(authService.getCurrentUser).mockResolvedValue(null)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should render the app with loading spinner initially', () => {
    render(<App />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('should render home page after lazy loading', async () => {
    render(<App />)
    await waitFor(() => {
      expect(screen.getByText('Home')).toBeInTheDocument()
    })
  })

  it('should render within a BrowserRouter context', () => {
    const { container } = render(<App />)
    expect(container).toBeInTheDocument()
  })
})

describe('App routing', () => {
  beforeEach(async () => {
    window.history.pushState({}, '', '/')
    const { authService } = await import('@/lib/appwrite')
    vi.mocked(authService.getCurrentUser).mockResolvedValue(null)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should display home page on root path', async () => {
    window.history.pushState({}, '', '/')
    render(<App />)
    await waitFor(() => {
      expect(screen.getByText('Home')).toBeInTheDocument()
    })
  })

  it('should display login page on /login path', async () => {
    window.history.pushState({}, '', '/login')
    render(<App />)
    await waitFor(() => {
      expect(screen.getByText('Login')).toBeInTheDocument()
    })
  })

  it('should redirect to login when accessing dashboard without auth', async () => {
    window.history.pushState({}, '', '/dashboard')
    render(<App />)
    await waitFor(() => {
      expect(screen.getByText('Login')).toBeInTheDocument()
    })
  })

  it('should display dashboard when authenticated', async () => {
    const { authService } = await import('@/lib/appwrite')
    vi.mocked(authService.getCurrentUser).mockResolvedValue({
      $id: '123',
      email: 'test@test.com',
    } as never)

    window.history.pushState({}, '', '/dashboard')
    render(<App />)
    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument()
    })
  })
})
