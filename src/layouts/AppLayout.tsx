import { Suspense } from 'react'
import { Outlet } from 'react-router-dom'
import { LoadingState } from '@/components/common/States'
import { Header } from '@/components/layout/Header'
import { Sidebar } from '@/components/layout/Sidebar'

export function AppLayout() {
  return (
    <div className="min-h-dvh">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-brand-600 focus:px-4 focus:py-2 focus:text-white">
        Skip to main content
      </a>
      <div className="no-print">
        <Sidebar />
      </div>
      <div className="lg:pl-64">
        <Header />
        <main id="main" className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
          <Suspense fallback={<LoadingState label="Loading page…" />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  )
}
