/**
 * Global Top Navigation Bar.
 *
 * Professional White + Green (Light) and Dark + Blue (Dark) theme support.
 * Links: Home, Analytics, Profile, About, Contact + Theme Toggle & Sign Out.
 * Mobile responsive with drawer/toggle.
 */

import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Leaf,
  Home,
  BarChart3,
  Info,
  Mail,
  LogOut,
  Menu,
  X,
  User,
  Sun,
  Moon,
} from "lucide-react";
import useAuthStore from "../store/authStore";
import useThemeStore from "../store/themeStore";

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const navLinks = [
    { name: "Home", path: "/home", icon: Home, authOnly: false },
    { name: "Analytics", path: "/analytics", icon: BarChart3, authOnly: true },
    { name: "Profile", path: "/profile", icon: User, authOnly: true },
    { name: "About", path: "/about", icon: Info, authOnly: false },
    { name: "Contact", path: "/contact", icon: Mail, authOnly: false },
  ];

  const visibleLinks = navLinks.filter((link) => !link.authOnly || isAuthenticated);

  const isActive = (path) => {
    if (path === "/home") {
      return location.pathname === "/home" || location.pathname === "/dashboard";
    }
    return location.pathname === path;
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-gray-200 dark:border-slate-800 shadow-xs transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo */}
          <Link
            to={isAuthenticated ? "/home" : "/login"}
            className="flex items-center gap-2.5 group transition"
          >
            <div className="w-10 h-10 rounded-2xl bg-primary-600 text-white flex items-center justify-center shadow-md shadow-primary-500/20 group-hover:scale-105 transition">
              <Leaf className="w-5 h-5" />
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight text-gray-900 dark:text-slate-100 flex items-center gap-1">
                Nutri<span className="text-primary-600">Track</span>
              </span>
              <span className="hidden sm:block text-[10px] uppercase font-semibold tracking-wider text-primary-700 dark:text-primary-400 -mt-1">
                AI Nutrition Assistant
              </span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1.5">
            {visibleLinks.map((link) => {
              const Icon = link.icon;
              const active = isActive(link.path);
              return (
                <Link
                  key={link.name}
                  to={link.path}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition ${
                    active
                      ? "bg-primary-50 dark:bg-primary-950/80 text-primary-700 dark:text-primary-300 font-semibold shadow-xs"
                      : "text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-100 hover:bg-gray-100 dark:hover:bg-slate-800"
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 ${
                      active ? "text-primary-600 dark:text-primary-400" : "text-gray-400 dark:text-slate-500"
                    }`}
                  />
                  <span>{link.name}</span>
                </Link>
              );
            })}
          </nav>

          {/* User Profile / Auth Area & Theme Toggle */}
          <div className="hidden md:flex items-center gap-3">
            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              title={`Switch to ${theme === "dark" ? "Light" : "Dark"} mode`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-slate-800 text-xs font-semibold text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 transition cursor-pointer"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? (
                <>
                  <Sun className="w-4 h-4 text-amber-400" />
                  <span>Light</span>
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4 text-primary-600" />
                  <span>Dark</span>
                </>
              )}
            </button>

            {isAuthenticated && user ? (
              <div className="flex items-center gap-3 pl-3 border-l border-gray-200 dark:border-slate-800">
                <Link
                  to="/profile"
                  className="flex items-center gap-2.5 text-right hover:opacity-90 transition group"
                >
                  <div className="text-right hidden lg:block">
                    <p className="text-xs font-semibold text-gray-900 dark:text-slate-100 truncate max-w-[130px]">
                      {user.name}
                    </p>
                    <p className="text-[11px] text-gray-500 dark:text-slate-400 truncate max-w-[130px]">
                      {user.email}
                    </p>
                  </div>
                  <div className="w-9 h-9 rounded-full bg-primary-100 dark:bg-primary-950 text-primary-700 dark:text-primary-300 border border-primary-200 dark:border-primary-800 flex items-center justify-center text-sm font-bold uppercase group-hover:scale-105 transition">
                    {user.name ? user.name.charAt(0) : "U"}
                  </div>
                </Link>

                <button
                  onClick={handleLogout}
                  title="Sign out"
                  className="p-2 rounded-xl text-gray-500 dark:text-slate-400 hover:text-danger-600 hover:bg-danger-50 dark:hover:bg-danger-950/40 transition cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to="/login"
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl transition"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="px-4 py-2 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-xl shadow-sm transition"
                >
                  Get Started
                </Link>
              </div>
            )}
          </div>

          {/* Mobile menu and theme buttons */}
          <div className="flex md:hidden items-center gap-1.5">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl text-gray-500 dark:text-slate-400"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-primary-600" />}
            </button>

            {isAuthenticated && user && (
              <Link to="/profile" className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-950 text-primary-700 dark:text-primary-300 flex items-center justify-center text-xs font-bold uppercase">
                {user.name ? user.name.charAt(0) : "U"}
              </Link>
            )}

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-xl text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 transition"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 pt-2 pb-4 space-y-1 shadow-lg">
          {visibleLinks.map((link) => {
            const Icon = link.icon;
            const active = isActive(link.path);
            return (
              <Link
                key={link.name}
                to={link.path}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium ${
                  active
                    ? "bg-primary-50 dark:bg-primary-950/80 text-primary-700 dark:text-primary-300 font-semibold"
                    : "text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800"
                }`}
              >
                <Icon className="w-4.5 h-4.5" />
                <span>{link.name}</span>
              </Link>
            );
          })}

          {isAuthenticated ? (
            <div className="pt-3 mt-2 border-t border-gray-200 dark:border-slate-800 space-y-2">
              <div className="px-3 py-1">
                <p className="text-xs font-bold text-gray-900 dark:text-slate-100">{user?.name}</p>
                <p className="text-xs text-gray-500 dark:text-slate-400">{user?.email}</p>
              </div>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleLogout();
                }}
                className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-danger-600 hover:bg-danger-50 dark:hover:bg-danger-950/40 rounded-xl transition"
              >
                <LogOut className="w-4.5 h-4.5" />
                <span>Sign Out</span>
              </button>
            </div>
          ) : (
            <div className="pt-3 mt-2 border-t border-gray-200 dark:border-slate-800 flex flex-col gap-2">
              <Link
                to="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full text-center py-2.5 text-sm font-medium text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700"
              >
                Sign In
              </Link>
              <Link
                to="/register"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full text-center py-2.5 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-xl shadow-sm"
              >
                Get Started
              </Link>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
