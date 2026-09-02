/**
 * Login Page — Split-screen modern design with unified Light (Green) and Dark (Blue) theme support.
 */

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate } from "react-router-dom";
import {
  Leaf,
  Mail,
  Lock,
  Loader2,
  Eye,
  EyeOff,
  Sparkles,
  ShieldCheck,
  Heart,
  CheckCircle2,
  Sun,
  Moon,
} from "lucide-react";

import { loginSchema } from "../schemas/authSchemas";
import { loginUser } from "../services/authService";
import useAuthStore from "../store/authStore";
import useThemeStore from "../store/themeStore";

export default function LoginPage() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const { theme, toggleTheme } = useThemeStore();

  const [serverError, setServerError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (data) => {
    setServerError("");
    try {
      const { access_token } = await loginUser(data.email, data.password);
      await login(access_token);
      const user = useAuthStore.getState().user;
      if (user?.onboarding_complete) {
        navigate("/home");
      } else {
        navigate("/onboarding");
      }
    } catch (err) {
      setServerError(err.message || "Something went wrong. Please try again.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex flex-col lg:flex-row transition-colors">
      {/* Top Floating Theme Switcher */}
      <div className="absolute top-4 right-4 z-50">
        <button
          onClick={toggleTheme}
          className="p-2.5 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-gray-200 dark:border-slate-800 text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white shadow-xs transition cursor-pointer"
          aria-label="Toggle theme"
        >
          {theme === "dark" ? <Sun className="w-4.5 h-4.5 text-amber-400" /> : <Moon className="w-4.5 h-4.5 text-primary-600" />}
        </button>
      </div>

      {/* LEFT SECTION: Brand, Visual & Value Proposition */}
      <div className="lg:w-1/2 bg-gradient-to-br from-primary-700 via-primary-600 to-primary-900 dark:from-slate-900 dark:via-primary-950 dark:to-slate-950 p-8 sm:p-12 lg:p-16 text-white flex flex-col justify-between relative overflow-hidden">
        {/* Subtle Decorative Lighting */}
        <div className="absolute -right-20 -top-20 w-80 h-80 bg-white/10 dark:bg-primary-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -left-20 -bottom-20 w-80 h-80 bg-primary-400/20 dark:bg-primary-600/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-6">
          <Link to="/" className="inline-flex items-center gap-2.5 group">
            <div className="w-11 h-11 rounded-2xl bg-white text-primary-700 dark:bg-slate-900 dark:text-primary-400 flex items-center justify-center shadow-lg group-hover:scale-105 transition">
              <Leaf className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight text-white flex items-center">
                Nutri<span className="text-primary-200 dark:text-primary-400">Track</span>
              </span>
              <span className="text-[10px] uppercase font-bold tracking-wider text-primary-200 dark:text-primary-300 block -mt-1">
                AI Nutrition Assistant
              </span>
            </div>
          </Link>

          <div className="space-y-3 pt-6 max-w-lg">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 dark:bg-primary-900/40 text-xs font-semibold backdrop-blur-md text-primary-100 dark:text-primary-200">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Personalized Wellness Companion</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight leading-tight">
              Nutritional success that fits your actual life.
            </h2>
            <p className="text-primary-100 dark:text-slate-300 text-sm sm:text-base leading-relaxed">
              No rigid scripts or mandatory ingredients. Achieve your goals with dynamic meal recommendations, affordable alternatives, and supportive daily coaching.
            </p>
          </div>

          {/* Value Props Card */}
          <div className="bg-white/10 dark:bg-slate-900/60 backdrop-blur-md rounded-3xl p-6 border border-white/15 dark:border-primary-800/40 space-y-3 max-w-md shadow-xl">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-primary-300 dark:text-primary-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold">Nutritional Success Over Rigid Diets</p>
                <p className="text-[11px] text-primary-100 dark:text-slate-400">
                  Swap meals for cheaper, culturally familiar, or preferred foods with instant AI feedback.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-primary-300 dark:text-primary-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold">Allergen & Preference First</p>
                <p className="text-[11px] text-primary-100 dark:text-slate-400">
                  Zero tolerance for allergens; respects medical context and dietary choices.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Heart className="w-5 h-5 text-primary-300 dark:text-primary-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold">Meet "Nutri" — Non-Judgmental Coach</p>
                <p className="text-[11px] text-primary-100 dark:text-slate-400">
                  Celebrate progress and stay consistent with supportive encouragement.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-10 pt-8 text-xs text-primary-200 dark:text-slate-400">
          © {new Date().getFullYear()} NutriTrack AI. Evidence-informed nutrition mentoring.
        </div>
      </div>

      {/* RIGHT SECTION: Login Form */}
      <div className="lg:w-1/2 flex items-center justify-center p-6 sm:p-12 lg:p-16">
        <div className="w-full max-w-md space-y-8">
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
              Welcome back
            </h1>
            <p className="text-sm text-gray-500 dark:text-slate-400">
              Sign in to continue your personalized nutrition journey
            </p>
          </div>

          {serverError && (
            <div
              className="rounded-2xl bg-danger-50 dark:bg-danger-950/40 border border-danger-500/30 p-4 text-sm text-danger-600 dark:text-danger-400"
              role="alert"
            >
              {serverError}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
            {/* Email */}
            <div>
              <label
                htmlFor="login-email"
                className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1.5"
              >
                Email Address
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-gray-400 dark:text-slate-500" />
                <input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  placeholder="name@example.com"
                  {...register("email")}
                  className={`w-full rounded-2xl border bg-white dark:bg-slate-900 pl-11 pr-4 py-3 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-500 outline-none transition focus:ring-2 focus:ring-primary-500/40 ${
                    errors.email
                      ? "border-danger-500 focus:border-danger-500"
                      : "border-gray-300 dark:border-slate-800 focus:border-primary-500"
                  }`}
                />
              </div>
              {errors.email && (
                <p className="mt-1 text-xs text-danger-600 dark:text-danger-400">{errors.email.message}</p>
              )}
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="login-password"
                className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1.5"
              >
                Password
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-gray-400 dark:text-slate-500" />
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  {...register("password")}
                  className={`w-full rounded-2xl border bg-white dark:bg-slate-900 pl-11 pr-11 py-3 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-500 outline-none transition focus:ring-2 focus:ring-primary-500/40 ${
                    errors.password
                      ? "border-danger-500 focus:border-danger-500"
                      : "border-gray-300 dark:border-slate-800 focus:border-primary-500"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 transition"
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-xs text-danger-600 dark:text-danger-400">{errors.password.message}</p>
              )}
            </div>

            {/* Remember Me */}
            <div className="flex items-center justify-between text-xs">
              <label className="flex items-center gap-2 cursor-pointer text-gray-600 dark:text-slate-400 select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded-md border-gray-300 dark:border-slate-700 text-primary-600 focus:ring-primary-500"
                />
                <span>Remember this device</span>
              </label>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 rounded-2xl bg-primary-600 hover:bg-primary-700 text-white font-bold py-3.5 px-4 text-sm shadow-md shadow-primary-500/20 transition hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4.5 h-4.5 animate-spin" />
                  <span>Signing in…</span>
                </>
              ) : (
                "Sign In"
              )}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 dark:text-slate-400">
            Don&apos;t have an account?{" "}
            <Link
              to="/register"
              className="font-bold text-primary-600 dark:text-primary-400 hover:underline"
            >
              Create Account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
