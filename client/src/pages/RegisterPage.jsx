/**
 * Register Page — Split-screen modern design with unified Light (Green) and Dark (Blue) theme support.
 */

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate } from "react-router-dom";
import {
  Leaf,
  Mail,
  Lock,
  User,
  Loader2,
  Eye,
  EyeOff,
  Sparkles,
  ShieldCheck,
  Heart,
  ChevronRight,
  Sun,
  Moon,
} from "lucide-react";

import { registerSchema } from "../schemas/authSchemas";
import { registerUser } from "../services/authService";
import useAuthStore from "../store/authStore";
import useThemeStore from "../store/themeStore";

export default function RegisterPage() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const { theme, toggleTheme } = useThemeStore();

  const [serverError, setServerError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      age: "",
      gender: "",
      height: "",
      current_weight: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const onSubmit = async (data) => {
    setServerError("");
    const { confirmPassword: _confirmPassword, ...payload } = data;

    try {
      const { access_token } = await registerUser(payload);
      await login(access_token);
      navigate("/onboarding");
    } catch (err) {
      setServerError(err.message || "Registration failed. Please try again.");
    }
  };

  const toggleBtn = (show, setShow, label) => (
    <button
      type="button"
      onClick={() => setShow((v) => !v)}
      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300"
      tabIndex={-1}
      aria-label={label}
    >
      {show ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
    </button>
  );

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
      <div className="lg:w-5/12 bg-gradient-to-br from-primary-700 via-primary-600 to-primary-900 dark:from-slate-900 dark:via-primary-950 dark:to-slate-950 p-8 sm:p-12 lg:p-16 text-white flex flex-col justify-between relative overflow-hidden">
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
              <span>Smart Onboarding Engine</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight leading-tight">
              Personalized guidance designed around you.
            </h2>
            <p className="text-primary-100 dark:text-slate-300 text-sm sm:text-base leading-relaxed">
              Tell us your baseline, and our dynamic AI mentor will tailor daily meal ideas and practical habits to whatever you want to achieve.
            </p>
          </div>

          <div className="bg-white/10 dark:bg-slate-900/60 backdrop-blur-md rounded-3xl p-6 border border-white/15 dark:border-primary-800/40 space-y-3 max-w-md shadow-xl">
            <div className="flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-primary-300 dark:text-primary-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold">Free-Text Personalized Need</p>
                <p className="text-[11px] text-primary-100 dark:text-slate-400">
                  Whether improving hair health, muscle building, or sustained energy, your onboarding dynamically adapts.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Heart className="w-5 h-5 text-primary-300 dark:text-primary-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold">Budget & Choice Freedom</p>
                <p className="text-[11px] text-primary-100 dark:text-slate-400">
                  Eat affordable local foods and still get 100% nutritional success credit.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-10 pt-8 text-xs text-primary-200 dark:text-slate-400">
          © {new Date().getFullYear()} NutriTrack AI. Privacy and evidence-informed health.
        </div>
      </div>

      {/* RIGHT SECTION: Registration Form */}
      <div className="lg:w-7/12 flex items-center justify-center p-6 sm:p-10 lg:p-14">
        <div className="w-full max-w-xl space-y-6">
          <div className="space-y-1.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
              Create Your Profile
            </h1>
            <p className="text-sm text-gray-500 dark:text-slate-400">
              Start with your baseline metrics. Dynamic AI questions will follow.
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

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
            {/* Full Name */}
            <div>
              <label htmlFor="reg-name" className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1">
                Full Name
              </label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-gray-400 dark:text-slate-500" />
                <input
                  id="reg-name"
                  type="text"
                  placeholder="Jane Doe"
                  autoComplete="name"
                  {...register("name")}
                  className={`w-full rounded-2xl border bg-white dark:bg-slate-900 pl-11 pr-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-500 outline-none transition focus:ring-2 focus:ring-primary-500/40 ${
                    errors.name
                      ? "border-danger-500 focus:border-danger-500"
                      : "border-gray-300 dark:border-slate-800 focus:border-primary-500"
                  }`}
                />
              </div>
              {errors.name && (
                <p className="mt-1 text-xs text-danger-600 dark:text-danger-400">{errors.name.message}</p>
              )}
            </div>

            {/* Age & Gender Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label htmlFor="reg-age" className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1">
                  Age
                </label>
                <input
                  id="reg-age"
                  type="number"
                  placeholder="e.g. 26"
                  {...register("age")}
                  className={`w-full rounded-2xl border bg-white dark:bg-slate-900 px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-500 outline-none transition focus:ring-2 focus:ring-primary-500/40 ${
                    errors.age
                      ? "border-danger-500 focus:border-danger-500"
                      : "border-gray-300 dark:border-slate-800 focus:border-primary-500"
                  }`}
                />
                {errors.age && (
                  <p className="mt-1 text-xs text-danger-600 dark:text-danger-400">{errors.age.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="reg-gender" className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1">
                  Gender
                </label>
                <select
                  id="reg-gender"
                  {...register("gender")}
                  className={`w-full rounded-2xl border bg-white dark:bg-slate-900 px-4 py-2.5 text-sm text-gray-900 dark:text-white outline-none transition focus:ring-2 focus:ring-primary-500/40 ${
                    errors.gender
                      ? "border-danger-500 focus:border-danger-500"
                      : "border-gray-300 dark:border-slate-800 focus:border-primary-500"
                  }`}
                >
                  <option value="">Select gender</option>
                  <option value="Female">Female</option>
                  <option value="Male">Male</option>
                  <option value="Non-binary">Non-binary</option>
                  <option value="Other">Other</option>
                  <option value="Prefer not to say">Prefer not to say</option>
                </select>
                {errors.gender && (
                  <p className="mt-1 text-xs text-danger-600 dark:text-danger-400">{errors.gender.message}</p>
                )}
              </div>
            </div>

            {/* Height & Weight Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label htmlFor="reg-height" className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1">
                  Height (cm)
                </label>
                <input
                  id="reg-height"
                  type="number"
                  step="0.1"
                  placeholder="e.g. 170"
                  {...register("height")}
                  className={`w-full rounded-2xl border bg-white dark:bg-slate-900 px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-500 outline-none transition focus:ring-2 focus:ring-primary-500/40 ${
                    errors.height
                      ? "border-danger-500 focus:border-danger-500"
                      : "border-gray-300 dark:border-slate-800 focus:border-primary-500"
                  }`}
                />
                {errors.height && (
                  <p className="mt-1 text-xs text-danger-600 dark:text-danger-400">{errors.height.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="reg-weight" className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1">
                  Current Weight (kg)
                </label>
                <input
                  id="reg-weight"
                  type="number"
                  step="0.1"
                  placeholder="e.g. 65"
                  {...register("current_weight")}
                  className={`w-full rounded-2xl border bg-white dark:bg-slate-900 px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-500 outline-none transition focus:ring-2 focus:ring-primary-500/40 ${
                    errors.current_weight
                      ? "border-danger-500 focus:border-danger-500"
                      : "border-gray-300 dark:border-slate-800 focus:border-primary-500"
                  }`}
                />
                {errors.current_weight && (
                  <p className="mt-1 text-xs text-danger-600 dark:text-danger-400">{errors.current_weight.message}</p>
                )}
              </div>
            </div>

            {/* Email */}
            <div>
              <label htmlFor="reg-email" className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-gray-400 dark:text-slate-500" />
                <input
                  id="reg-email"
                  type="email"
                  placeholder="you@example.com"
                  autoComplete="email"
                  {...register("email")}
                  className={`w-full rounded-2xl border bg-white dark:bg-slate-900 pl-11 pr-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-500 outline-none transition focus:ring-2 focus:ring-primary-500/40 ${
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

            {/* Passwords Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label htmlFor="reg-password" className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1">
                  Password
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-gray-400 dark:text-slate-500" />
                  <input
                    id="reg-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Min. 8 characters"
                    autoComplete="new-password"
                    {...register("password")}
                    className={`w-full rounded-2xl border bg-white dark:bg-slate-900 pl-11 pr-11 py-2.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-500 outline-none transition focus:ring-2 focus:ring-primary-500/40 ${
                      errors.password
                        ? "border-danger-500 focus:border-danger-500"
                        : "border-gray-300 dark:border-slate-800 focus:border-primary-500"
                    }`}
                  />
                  {toggleBtn(showPassword, setShowPassword, "Toggle password")}
                </div>
                {errors.password && (
                  <p className="mt-1 text-xs text-danger-600 dark:text-danger-400">{errors.password.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="reg-confirm-password" className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-gray-400 dark:text-slate-500" />
                  <input
                    id="reg-confirm-password"
                    type={showConfirm ? "text" : "password"}
                    placeholder="Re-enter password"
                    autoComplete="new-password"
                    {...register("confirmPassword")}
                    className={`w-full rounded-2xl border bg-white dark:bg-slate-900 pl-11 pr-11 py-2.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-500 outline-none transition focus:ring-2 focus:ring-primary-500/40 ${
                      errors.confirmPassword
                        ? "border-danger-500 focus:border-danger-500"
                        : "border-gray-300 dark:border-slate-800 focus:border-primary-500"
                    }`}
                  />
                  {toggleBtn(showConfirm, setShowConfirm, "Toggle confirm password")}
                </div>
                {errors.confirmPassword && (
                  <p className="mt-1 text-xs text-danger-600 dark:text-danger-400">{errors.confirmPassword.message}</p>
                )}
              </div>
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
                  <span>Creating Account…</span>
                </>
              ) : (
                <>
                  <span>Create Account & Start Onboarding</span>
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 dark:text-slate-400">
            Already have an account?{" "}
            <Link
              to="/login"
              className="font-bold text-primary-600 dark:text-primary-400 hover:underline"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
