/**
 * AppLayout — Unified Application Shell across Dashboard, Analytics, Profile, and other pages.
 *
 * Provides a 100% consistent layout:
 * - Persistent Left Sidebar with Logo, New Chat, Nav Links, Recent Chats, Profile, Theme Toggle
 * - Top Header Bar with Mobile menu toggle, Title, "+ New Chat" button, Score / Stats, and User Profile
 * - Fluid content container with responsive layout
 */

import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Menu,
  Sparkles,
  Plus,
  Sun,
  Moon,
  User,
  ArrowLeft,
} from "lucide-react";
import Sidebar from "../components/Sidebar";
import useAuthStore from "../store/authStore";
import useThemeStore from "../store/themeStore";
import useChatStore from "../store/chatStore";

export default function AppLayout({
  children,
  title,
  subtitle,
  headerActions,
  fixedHeight = false,
  activeConversationId,
  onSelectConversation,
  onNewChat,
  onDeleteConversation,
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();
  const { fetchConversations, startNewChat } = useChatStore();

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Load conversations into store on mount
  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const isHome = location.pathname === "/home" || location.pathname === "/dashboard";

  const handleTopNewChat = async () => {
    if (onNewChat) {
      await onNewChat();
    } else {
      await startNewChat();
    }
    if (!isHome) {
      navigate("/home");
    }
  };

  return (
    <div className="h-screen max-h-screen overflow-hidden flex bg-gray-50 dark:bg-slate-950 font-sans transition-colors">
      {/* 1. PERSISTENT LEFT SIDEBAR */}
      <Sidebar
        activeConversationId={activeConversationId}
        onSelectConversation={onSelectConversation}
        onNewChat={onNewChat}
        onDeleteConversation={onDeleteConversation}
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
      />

      {/* 2. MAIN WORKSPACE */}
      <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
        {/* Top Header Bar */}
        <header className="h-16 border-b border-gray-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between shrink-0 z-30 transition-colors">
          <div className="flex items-center gap-3 min-w-0">
            {/* Mobile Sidebar Hamburger */}
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="md:hidden p-2 rounded-xl text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 transition cursor-pointer"
              title="Open Navigation"
              aria-label="Open Navigation"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Page Title / Context Header */}
            <div className="truncate">
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-bold text-gray-900 dark:text-white truncate">
                  {title || (
                    <>
                      Hello, {user?.name ? user.name.split(" ")[0] : "Friend"} 👋
                    </>
                  )}
                </h1>
                {user?.goals && user.goals.filter((g) => g.status === "active").length > 0 && (
                  <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider bg-primary-50 dark:bg-primary-950/90 text-primary-700 dark:text-primary-300 px-2 py-0.5 rounded-full border border-primary-200 dark:border-primary-800 shrink-0">
                    <Sparkles className="w-2.5 h-2.5" />
                    {user.goals.filter((g) => g.status === "active").length} Active Focus
                  </span>
                )}
              </div>
              {subtitle && (
                <p className="text-[11px] text-gray-500 dark:text-slate-400 truncate hidden sm:block">
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          {/* Right Header Actions */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Custom Header Actions if passed */}
            {headerActions}

            {/* Global "New Chat" Quick Button */}
            <button
              onClick={handleTopNewChat}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary-600 hover:bg-primary-700 active:scale-95 text-white text-xs font-bold shadow-xs shadow-primary-500/20 transition cursor-pointer"
              title="Start a new chat"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">New Chat</span>
            </button>

            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl border border-gray-200 dark:border-slate-800 text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 transition cursor-pointer"
              title={`Switch to ${theme === "dark" ? "Light" : "Dark"} mode`}
              aria-label="Toggle theme"
            >
              {theme === "dark" ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-primary-600" />
              )}
            </button>

            {/* User Profile Mini Badge */}
            <Link
              to="/profile"
              className="flex items-center gap-1.5 p-1 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 transition"
              title="Go to profile"
            >
              <div className="w-8 h-8 rounded-full bg-primary-600 text-white font-bold flex items-center justify-center text-xs shadow-xs">
                {user?.name ? user.name.charAt(0).toUpperCase() : "U"}
              </div>
            </Link>
          </div>
        </header>

        {/* Main Content Area */}
        <main
          className={`flex-1 min-w-0 ${
            fixedHeight
              ? "overflow-hidden flex flex-col"
              : "overflow-y-auto"
          }`}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
