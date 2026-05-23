import { create } from 'zustand';

type SocialMatchWidgetStore = {
  isOpen: boolean;
  unreadCount: number;
  toggle: () => void;
  setOpen: (v: boolean) => void;
  setUnreadCount: (n: number) => void;
};

export const useSocialMatchWidgetStore = create<SocialMatchWidgetStore>((set) => ({
  isOpen: false,
  unreadCount: 0,
  toggle: () => set((s) => ({ isOpen: !s.isOpen })),
  setOpen: (v) => set({ isOpen: v }),
  setUnreadCount: (n) => set({ unreadCount: n }),
}));
