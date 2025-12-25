import type { ReactNode } from 'react'

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import Login from '@/pages/Login'
import { AuthProvider } from '@/contexts/AuthContext'

const mockLogin = vi.fn()
const mockDeleteCurrentSession = vi.fn()

vi.mock('@/lib/appwrite', () => ({
  authService: {
    getCurrentUser: vi.fn().mockResolvedValue(null),
    login: vi.fn(),
    deleteCurrentSession: vi.fn(),
  },
}))

vi.mock('@/contexts/AuthContext', async () => {
  const actual = await vi.importActual('@/contexts/AuthContext')
  return {
    ...actual,
    useAuth: () => ({
      login: mockLogin,
      user: null,
      isLoading: false,
      logout: vi.fn(),
      register: vi.fn(),
    }),
  }
})

interface WrapperProps {
  children: ReactNode
}

function TestWrapper({ children }: WrapperProps) {
  return (
    <MemoryRouter>
      <AuthProvider>{children}</AuthProvider>
    </MemoryRouter>
  )
}

describe('Login', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render the login page', async () => {
    render(<Login />, { wrapper: TestWrapper })
    expect(await screen.findByText('Login')).toBeInTheDocument()
  })

  it('should render email and password inputs', async () => {
    render(<Login />, { wrapper: TestWrapper })
    expect(await screen.findByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
  })

  it('should render sign in button', async () => {
    render(<Login />, { wrapper: TestWrapper })
    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument()
  })

  it('should render card description', async () => {
    render(<Login />, { wrapper: TestWrapper })
    expect(
      await screen.findByText('Enter your email and password to access your account')
    ).toBeInTheDocument()
  })

  it('should show error message on login failure', async () => {
    mockLogin.mockRejectedValueOnce(new Error('Invalid credentials'))

    render(<Login />, { wrapper: TestWrapper })

    await userEvent.type(screen.getByLabelText('Email'), 'test@test.com')
    await userEvent.type(screen.getByLabelText('Password'), 'password')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    await waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument()
    })
  })

  describe('Active Session Handling', () => {
    it('should show session dialog when active session error occurs', async () => {
      mockLogin.mockRejectedValueOnce(
        new Error('Creation of a session is prohibited when a session is active')
      )

      render(<Login />, { wrapper: TestWrapper })

      await userEvent.type(screen.getByLabelText('Email'), 'test@test.com')
      await userEvent.type(screen.getByLabelText('Password'), 'password')
      await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))

      await waitFor(() => {
        expect(screen.getByText('Active Session Detected')).toBeInTheDocument()
      })
    })

    it('should show dialog description explaining the situation', async () => {
      mockLogin.mockRejectedValueOnce(
        new Error('Creation of a session is prohibited when a session is active')
      )

      render(<Login />, { wrapper: TestWrapper })

      await userEvent.type(screen.getByLabelText('Email'), 'test@test.com')
      await userEvent.type(screen.getByLabelText('Password'), 'password')
      await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))

      await waitFor(() => {
        expect(
          screen.getByText(/Would you like to revoke the current session/)
        ).toBeInTheDocument()
      })
    })

    it('should have cancel and revoke buttons in dialog', async () => {
      mockLogin.mockRejectedValueOnce(
        new Error('Creation of a session is prohibited when a session is active')
      )

      render(<Login />, { wrapper: TestWrapper })

      await userEvent.type(screen.getByLabelText('Email'), 'test@test.com')
      await userEvent.type(screen.getByLabelText('Password'), 'password')
      await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Revoke & Login' })).toBeInTheDocument()
      })
    })

    it('should close dialog when cancel is clicked', async () => {
      mockLogin.mockRejectedValueOnce(
        new Error('Creation of a session is prohibited when a session is active')
      )

      render(<Login />, { wrapper: TestWrapper })

      await userEvent.type(screen.getByLabelText('Email'), 'test@test.com')
      await userEvent.type(screen.getByLabelText('Password'), 'password')
      await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))

      await waitFor(() => {
        expect(screen.getByText('Active Session Detected')).toBeInTheDocument()
      })

      await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))

      await waitFor(() => {
        expect(screen.queryByText('Active Session Detected')).not.toBeInTheDocument()
      })
    })
  })
})
