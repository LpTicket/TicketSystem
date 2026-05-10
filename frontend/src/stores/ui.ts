'use client';

import { create } from 'zustand';

interface UIState {
  mobileMenuOpen: boolean;
  sidebarOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
  setSidebarOpen: (open: boolean) => void;
  toggleMobileMenu: () => void;
  toggleSidebar: () => void;
  closeAll: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  mobileMenuOpen: false,
  sidebarOpen: false,

  setMobileMenuOpen: (open) => {
    set({ 
      mobileMenuOpen: open,
      // If we open mobile menu, close sidebar
      sidebarOpen: open ? false : undefined 
    });
  },

  setSidebarOpen: (open) => {
    set({ 
      sidebarOpen: open,
      // If we open sidebar, close mobile menu
      mobileMenuOpen: open ? false : undefined
    });
  },

  toggleMobileMenu: () => {
    set((state) => ({ 
      mobileMenuOpen: !state.mobileMenuOpen,
      sidebarOpen: !state.mobileMenuOpen ? false : state.sidebarOpen
    }));
  },

  toggleSidebar: () => {
    set((state) => ({ 
      sidebarOpen: !state.sidebarOpen,
      mobileMenuOpen: !state.sidebarOpen ? false : state.mobileMenuOpen
    }));
  },

  closeAll: () => set({ mobileMenuOpen: false, sidebarOpen: false }),
}));
