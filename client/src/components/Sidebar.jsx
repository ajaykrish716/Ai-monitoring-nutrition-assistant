/**
 * Sidebar Component for modern ChatGPT-style navigation and recent conversations.
 */

import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Leaf,
  Plus,
  MessageSquare,
  Home,
  BarChart3,
  User,
  Info,
  Mail,
  LogOut,
  Sun,
  Moon,
  Trash2,
  X,
} from "lucide-react";
import useAuthStore from "../store/authStore";
import useThemeStore from "../store/themeStore";
import useChatStore from "../store/chatStore";

export default function Sidebar({
  conversations: propConversations,
  activeConversationId: propActiveId,
  onSelectConversation,
  onNewChat,
  onDeleteConversation,
  mobileOpen = false,
  onCloseMobile,
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();

  const storeConversations = useChatStore((s) => s.conversations);
  const storeActiveId = useChatStore((s) => s.activeConversationId);
  const storeSelect = useChatStore((s) => s.selectConversation);
  const storeNewChat = useChatStore((s) => s.startNewChat);
  const storeDelete = useChatStore((s) => s.deleteConversation);

  // Use props if supplied, otherwise fallback to global chatStore
  const conversations = propConversations ?? storeConversations;
  const activeConversationId = propActiveId ?? storeActiveId;

  const isHome = location.pathname === "/home" || location.pathname === "/dashboard";

  const handleNewChatClick = async () => {
    if (onNewChat) {
      await onNewChat();
    } else {
      await storeNewChat();
    }
    if (!isHome) {
      navigate("/home");
    }
    if (onCloseMobile) onCloseMobile();
  };

  const handleSelectConvClick = (convId) => {
    if (onSelectConversation) {
      onSelectConversation(convId);
    } else {
      storeSelect(convId);
    }
    if (!isHome) {
      navigate("/home");
    }
    if (onCloseMobile) onCloseMobile();
  };

  const handleDeleteConvClick = async (convId) => {
    if (onDeleteConversation) {
      await onDeleteConversation(convId);
    } else {
      await storeDelete(convId);
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const navLinks = [
    { name: "Home", path: "/home", icon: Home },
    { name: "Analytics", path: "/analytics", icon: BarChart3 },
    { name: "Profile", path: "/profile", icon: User },
    { name: "About", path: "/about", icon: Info },
    { name: "Contact", path: "/contact", icon: Mail },
  ];

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {mobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-black/50 backdrop-blur-xs z-40 md:hidden"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 w-72 bg-white dark:bg-slate-900 border-r border-gray-200 dark:border-slate-800 flex flex-col h-full transition-transform duration-200 ease-in-out select-none ${
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        {/* Sidebar Header: Logo & New Chat */}
        <div className="p-4 border-b border-gray-100 dark:border-slate-800/80 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <Link to="/home" className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-primary-600 text-white flex items-center justify-center shadow-md shadow-primary-500/20">
                <Leaf className="w-5 h-5" />
              </div>
              <div>
                <span className="text-base font-black tracking-tight text-gray-900 dark:text-white flex items-center gap-1">
                  Nutri<span className="text-primary-600">Track</span>
                </span>
                <span className="text-[10px] uppercase font-bold text-primary-600 dark:text-primary-400 block -mt-1 tracking-wider">
                  AI Companion
                </span>
              </div>
            </Link>

            {/* Mobile Close Button */}
            <button
              onClick={onCloseMobile}
              className="md:hidden p-1.5 rounded-xl text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* New Chat Button */}
          <button
            onClick={handleNewChatClick}
            className="w-full flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 active:scale-[0.98] text-white py-2.5 px-4 rounded-2xl font-bold text-sm shadow-sm shadow-primary-500/20 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Chat</span>
          </button>
        </div>

        {/* Primary Navigation */}
        <div className="px-3 py-2 border-b border-gray-100 dark:border-slate-800/80 space-y-1">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive =
              link.path === "/home"
                ? isHome
                : location.pathname === link.path;

            return (
              <Link
                key={link.name}
                to={link.path}
                onClick={onCloseMobile}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition ${
                  isActive
                    ? "bg-primary-50 dark:bg-primary-950/80 text-primary-700 dark:text-primary-300 font-bold"
                    : "text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800/60"
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? "text-primary-600" : "text-gray-400"}`} />
                <span>{link.name}</span>
              </Link>
            );
          })}
        </div>

        {/* Recent Chats Section */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1 nutri-chat-scroll">
          <div className="px-3 pb-1.5 text-[10px] font-black uppercase tracking-wider text-gray-400 dark:text-slate-500">
            Recent Chats
          </div>

          {conversations.length === 0 ? (
            <div className="px-3 py-4 text-xs text-gray-400 dark:text-slate-500 text-center italic">
              No recent conversations yet.
            </div>
          ) : (
            conversations.map((c) => {
              const isSelected = activeConversationId === c.id;
              return (
                <div
                  key={c.id}
                  onClick={() => handleSelectConvClick(c.id)}
                  className={`group flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs font-medium cursor-pointer transition ${
                    isSelected
                      ? "bg-primary-50 dark:bg-primary-950/80 text-primary-800 dark:text-primary-200 font-bold shadow-2xs border border-primary-200/60 dark:border-primary-800/60"
                      : "text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800/60"
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <MessageSquare className={`w-3.5 h-3.5 shrink-0 ${isSelected ? "text-primary-600 dark:text-primary-400" : "text-gray-400"}`} />
                    <span className="truncate">{c.title || "Nutrition Chat"}</span>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteConvClick(c.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:text-danger-600 dark:hover:text-danger-400 rounded-md transition"
                    title="Delete conversation"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Sidebar Footer: User profile, Theme Toggle, Logout */}
        <div className="p-3 border-t border-gray-100 dark:border-slate-800/80 bg-gray-50/50 dark:bg-slate-950/50 flex items-center justify-between gap-2">
          <Link
            to="/profile"
            className="flex items-center gap-2 truncate min-w-0 hover:opacity-80 transition"
          >
            <div className="w-8 h-8 rounded-full bg-primary-600 text-white font-bold flex items-center justify-center text-xs shrink-0">
              {user?.name ? user.name.charAt(0).toUpperCase() : "U"}
            </div>
            <div className="truncate text-left">
              <span className="block text-xs font-bold text-gray-900 dark:text-white truncate">
                {user?.name || "My Profile"}
              </span>
              <span className="block text-[10px] text-gray-400 dark:text-slate-500 truncate">
                {user?.email || "Account"}
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800 transition"
              title="Toggle Theme"
            >
              {theme === "dark" ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-primary-600" />
              )}
            </button>

            <button
              onClick={handleLogout}
              className="p-2 rounded-xl text-gray-500 hover:text-danger-600 dark:hover:text-danger-400 hover:bg-gray-100 dark:hover:bg-slate-800 transition"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
