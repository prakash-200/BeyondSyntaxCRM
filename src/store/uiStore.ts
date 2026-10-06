import { create } from 'zustand'

/** Purely client-side UI state (no server data lives here). */
interface UiState {
  sidebarOpen: boolean
  openSidebar: () => void
  closeSidebar: () => void
}

export const useUiStore = create<UiState>((set) => ({
  sidebarOpen: false,
  openSidebar: () => set({ sidebarOpen: true }),
  closeSidebar: () => set({ sidebarOpen: false }),
}))
