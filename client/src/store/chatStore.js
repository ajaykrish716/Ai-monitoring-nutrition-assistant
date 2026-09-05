/**
 * Zustand chat store — manages conversation threads, active session, and cross-page chat actions.
 */

import { create } from "zustand";
import {
  getNutriConversations,
  createNutriConversation,
  deleteNutriConversation,
} from "../services/nutriService";

const useChatStore = create((set, get) => ({
  conversations: [],
  activeConversationId: null,
  loadingConversations: false,

  fetchConversations: async () => {
    try {
      set({ loadingConversations: true });
      const res = await getNutriConversations();
      const list = res?.conversations || [];
      set({ conversations: list, loadingConversations: false });

      // If no active conversation selected yet, pick first if available
      const currentActive = get().activeConversationId;
      if (!currentActive && list.length > 0) {
        set({ activeConversationId: list[0].id });
      }
      return list;
    } catch (err) {
      console.warn("Could not load conversations:", err);
      set({ loadingConversations: false });
      return [];
    }
  },

  selectConversation: (id) => {
    set({ activeConversationId: id });
  },

  startNewChat: async () => {
    try {
      const newConv = await createNutriConversation();
      set((state) => ({
        conversations: [newConv, ...state.conversations],
        activeConversationId: newConv.id,
      }));
      return newConv;
    } catch (err) {
      console.warn("Failed to create remote conversation, using local:", err);
      set({ activeConversationId: null });
      return null;
    }
  },

  deleteConversation: async (convId) => {
    try {
      await deleteNutriConversation(convId);
      set((state) => {
        const remaining = state.conversations.filter((c) => c.id !== convId);
        let nextActive = state.activeConversationId;
        if (state.activeConversationId === convId) {
          nextActive = remaining.length > 0 ? remaining[0].id : null;
        }
        return { conversations: remaining, activeConversationId: nextActive };
      });
    } catch (err) {
      console.error("Failed to delete conversation:", err);
    }
  },

  updateConversationTitle: (convId, newTitle) => {
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === convId ? { ...c, title: newTitle } : c
      ),
    }));
  },
}));

export default useChatStore;
