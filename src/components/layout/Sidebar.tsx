import { GraduationCap, X } from 'lucide-react'
import { useEffect } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { COMPANY_NAME, APP_NAME } from '@/constants/config'
import { NAVIGATION } from '@/constants/navigation'
import { useAuth } from '@/features/auth/AuthContext'
import { useUiStore } from '@/store/uiStore'
import { cn } from '@/utils/cn'

export function Sidebar() {
  const { can } = useAuth()
  const { sidebarOpen, closeSidebar } = useUiStore()
  const location = useLocation()

  useEffect(() => {
    closeSidebar()
  }, [location.pathname, closeSidebar])

  const sections = NAVIGATION.map((s) => ({ ...s, items: s.items.filter((i) => can(i.permission)) })).filter((s) => s.items.length)

  return (
    <>
      {sidebarOpen && <div className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden" onClick={closeSidebar} aria-hidden />}
      <aside
        aria-label="Primary"
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform duration-200 lg:translate-x-0',
          sidebarOpen ? 'translate-x-0 shadow-xl' : '-translate-x-full',
        )}
      >
        <div className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-slate-100 px-5">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-white" aria-hidden>
              <GraduationCap className="h-5 w-5" />
            </span>
            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-semibold text-slate-900">{COMPANY_NAME}</p>
              <p className="truncate text-[11px] text-slate-500">{APP_NAME}</p>
            </div>
          </div>
          <button type="button" onClick={closeSidebar} className="rounded-md p-1 text-slate-500 hover:bg-slate-100 lg:hidden" aria-label="Close navigation">
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4 scrollbar-thin" aria-label="Main navigation">
          {sections.map((section, i) => (
            <div key={section.title ?? i} className={cn(i > 0 && 'mt-5')}>
              {section.title && <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{section.title}</p>}
              <ul className="space-y-0.5">
                {section.items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.end ?? false}
                      className={({ isActive }) =>
                        cn(
                          'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                          isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <item.icon className={cn('h-[18px] w-[18px] shrink-0', isActive ? 'text-brand-600' : 'text-slate-400 group-hover:text-slate-600')} aria-hidden />
                          <span className="truncate">{item.label}</span>
                        </>
                      )}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </aside>
    </>
  )
}
