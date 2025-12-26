import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AppSidebar } from '@/components/AppSidebar'
import { SidebarProvider } from '@/components/ui/sidebar'
import { AuthProvider } from '@/contexts/AuthContext'

vi.mock('@/lib/appwrite', () => ({
  authService: {
    getCurrentUser: vi.fn().mockResolvedValue({
      $id: '123',
      email: 'test@test.com',
    }),
    logout: vi.fn().mockResolvedValue(undefined),
  },
}))

vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: vi.fn().mockReturnValue(false),
}))

const renderSidebar = (initialPath = '/dashboard') => {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AuthProvider>
        <SidebarProvider>
          <AppSidebar />
        </SidebarProvider>
      </AuthProvider>
    </MemoryRouter>
  )
}

describe('AppSidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Navigation Items', () => {
    it('should render all navigation menu items', () => {
      renderSidebar()

      expect(screen.getByText('Dashboard')).toBeInTheDocument()
      expect(screen.getByText('Packaging')).toBeInTheDocument()
      expect(screen.getByText('Unpack')).toBeInTheDocument()
      expect(screen.getByText('Products')).toBeInTheDocument()
      expect(screen.getByText('Reports')).toBeInTheDocument()
    })

    it('should render navigation items as links with correct href', () => {
      renderSidebar()

      const dashboardLink = screen.getByRole('link', { name: /dashboard/i })
      const packagingLink = screen.getByRole('link', { name: /packaging/i })
      const unpackLink = screen.getByRole('link', { name: /unpack/i })
      const productsLink = screen.getByRole('link', { name: /products/i })
      const reportsLink = screen.getByRole('link', { name: /reports/i })

      expect(dashboardLink).toHaveAttribute('href', '/dashboard')
      expect(packagingLink).toHaveAttribute('href', '/packaging')
      expect(unpackLink).toHaveAttribute('href', '/unpack')
      expect(productsLink).toHaveAttribute('href', '/products')
      expect(reportsLink).toHaveAttribute('href', '/reports')
    })

    it('should mark current route as active', () => {
      renderSidebar('/dashboard')

      const dashboardButton = screen.getByRole('link', { name: /dashboard/i })
      expect(dashboardButton).toHaveAttribute('data-active', 'true')
    })

    it('should mark packaging route as active when on packaging page', () => {
      renderSidebar('/packaging')

      const packagingButton = screen.getByRole('link', { name: /packaging/i })
      expect(packagingButton).toHaveAttribute('data-active', 'true')
    })

    it('should render navigation items in correct order', () => {
      renderSidebar()

      const menuItems = screen.getAllByRole('link')
      const navItems = menuItems.filter(
        (item) =>
          item.textContent?.includes('Dashboard') ||
          item.textContent?.includes('Packaging') ||
          item.textContent?.includes('Unpack') ||
          item.textContent?.includes('Products') ||
          item.textContent?.includes('Reports')
      )

      expect(navItems[0]).toHaveTextContent('Dashboard')
      expect(navItems[1]).toHaveTextContent('Packaging')
      expect(navItems[2]).toHaveTextContent('Unpack')
      expect(navItems[3]).toHaveTextContent('Products')
      expect(navItems[4]).toHaveTextContent('Reports')
    })
  })

  describe('Sidebar Header', () => {
    it('should render the app name', () => {
      renderSidebar()

      expect(screen.getByText('Wrapster')).toBeInTheDocument()
    })
  })

  describe('Sidebar Footer', () => {
    it('should render logout button', () => {
      renderSidebar()

      expect(screen.getByText('Logout')).toBeInTheDocument()
    })

    it('should call logout when logout button is clicked', async () => {
      const user = userEvent.setup()
      renderSidebar()

      const logoutButton = screen.getByText('Logout').closest('button')
      expect(logoutButton).toBeInTheDocument()

      await user.click(logoutButton!)

      const { authService } = await import('@/lib/appwrite')
      expect(authService.logout).toHaveBeenCalled()
    })
  })
})
