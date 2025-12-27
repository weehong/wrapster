import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { AppSidebar } from '@/components/AppSidebar'
import { Button } from '@/components/ui/button'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'

interface AppLayoutProps {
  children: ReactNode
}

export function AppLayout({ children }: AppLayoutProps) {
  const { i18n } = useTranslation()

  const toggleLanguage = () => {
    const newLang = i18n.language === 'en' ? 'zh' : 'en'
    i18n.changeLanguage(newLang)
    localStorage.setItem('language', newLang)
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="flex h-screen flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b px-4">
          <SidebarTrigger />
          <Button variant="ghost" size="sm" onClick={toggleLanguage}>
            {i18n.language === 'en' ? 'EN' : '中文'}
          </Button>
        </header>
        <main className="min-h-0 flex-1 overflow-hidden p-4">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}
