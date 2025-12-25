import type { FormEvent } from 'react'

import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/contexts/AuthContext'
import { authService } from '@/lib/appwrite'

const SESSION_ACTIVE_ERROR = 'Creation of a session is prohibited when a session is active'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showSessionDialog, setShowSessionDialog] = useState(false)

  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const from = location.state?.from?.pathname || '/dashboard'

  async function attemptLogin() {
    await login(email, password)
    navigate(from, { replace: true })
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      await attemptLogin()
    } catch (err) {
      console.error('Login error:', err)
      const message = err instanceof Error ? err.message : 'Invalid email or password'

      if (message.includes(SESSION_ACTIVE_ERROR)) {
        setShowSessionDialog(true)
      } else {
        setError(message)
      }
    } finally {
      setIsLoading(false)
    }
  }

  async function handleRevokeSession() {
    setShowSessionDialog(false)
    setIsLoading(true)
    setError('')

    try {
      await authService.deleteCurrentSession()
      await attemptLogin()
    } catch (err) {
      console.error('Session revoke error:', err)
      const message = err instanceof Error ? err.message : 'Failed to revoke session'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <div className="flex min-h-screen items-center justify-center px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold">Login</CardTitle>
            <CardDescription>
              Enter your email and password to access your account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Signing in...' : 'Sign in'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={showSessionDialog} onOpenChange={setShowSessionDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Active Session Detected</AlertDialogTitle>
            <AlertDialogDescription>
              You already have an active session. Would you like to revoke the
              current session and log in with these credentials?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRevokeSession} disabled={isLoading}>
              {isLoading ? 'Revoking...' : 'Revoke & Login'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
