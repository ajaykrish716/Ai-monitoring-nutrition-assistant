/**
 * Register Page — simple account creation form.
 *
 * Only collects email, password, and name.
 * All profile data is gathered later during AI-driven onboarding.
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
  ChevronRight,
} from "lucide-react";

import { registerSchema } from "../schemas/authSchemas";
import { registerUser } from "../services/authService";
import useAuthStore from "../store/authStore";

export default function RegisterPage() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);

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
      email: "",
      password: "",
      confirmPassword: "",
      name: "",
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
      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
      tabIndex={-1}
      aria-label={label}
    >
      {show ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
    </button>
  );

  return (
    <div className="min-h-dvh flex items-center justify-center bg-gradient-to-br from-primary-50 via-white to-primary-100 px-4 py-12">
      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary-600 text-white mb-4 shadow-lg">
            <Leaf className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Create your account</h1>
          <p className="text-gray-500 mt-1 text-sm">
            Sign up to get started with personalized nutrition
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8">
          {/* Server error */}
          {serverError && (
            <div
              className="mb-6 rounded-lg bg-danger-50 border border-danger-500/30 px-4 py-3 text-sm text-danger-600"
              role="alert"
            >
              {serverError}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
            {/* Name */}
            <div>
              <label htmlFor="reg-name" className="block text-sm font-medium text-gray-700 mb-1.5">
                Full Name
              </label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-gray-400" />
                <input
                  id="reg-name"
                  type="text"
                  placeholder="John Doe"
                  autoComplete="name"
                  {...register("name")}
                  className={`w-full rounded-lg border bg-gray-50 pl-10 pr-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition focus:bg-white focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500 ${
                    errors.name
                      ? "border-danger-500 focus:ring-danger-500/40 focus:border-danger-500"
                      : "border-gray-300"
                  }`}
                />
              </div>
              {errors.name && (
                <p className="mt-1 text-xs text-danger-600">{errors.name.message}</p>
              )}
            </div>

            {/* Email */}
            <div>
              <label htmlFor="reg-email" className="block text-sm font-medium text-gray-700 mb-1.5">
                Email
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-gray-400" />
                <input
                  id="reg-email"
                  type="email"
                  placeholder="you@example.com"
                  autoComplete="email"
                  {...register("email")}
                  className={`w-full rounded-lg border bg-gray-50 pl-10 pr-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition focus:bg-white focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500 ${
                    errors.email
                      ? "border-danger-500 focus:ring-danger-500/40 focus:border-danger-500"
                      : "border-gray-300"
                  }`}
                />
              </div>
              {errors.email && (
                <p className="mt-1 text-xs text-danger-600">{errors.email.message}</p>
              )}
            </div>

            {/* Passwords */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="reg-password" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-gray-400" />
                  <input
                    id="reg-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Min. 8 characters"
                    autoComplete="new-password"
                    {...register("password")}
                    className={`w-full rounded-lg border bg-gray-50 pl-10 pr-10 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition focus:bg-white focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500 ${
                      errors.password
                        ? "border-danger-500 focus:ring-danger-500/40 focus:border-danger-500"
                        : "border-gray-300"
                    }`}
                  />
                  {toggleBtn(showPassword, setShowPassword, showPassword ? "Hide password" : "Show password")}
                </div>
                {errors.password && (
                  <p className="mt-1 text-xs text-danger-600">{errors.password.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="reg-confirm-password" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-gray-400" />
                  <input
                    id="reg-confirm-password"
                    type={showConfirm ? "text" : "password"}
                    placeholder="Re-enter password"
                    autoComplete="new-password"
                    {...register("confirmPassword")}
                    className={`w-full rounded-lg border bg-gray-50 pl-10 pr-10 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition focus:bg-white focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500 ${
                      errors.confirmPassword
                        ? "border-danger-500 focus:ring-danger-500/40 focus:border-danger-500"
                        : "border-gray-300"
                    }`}
                  />
                  {toggleBtn(showConfirm, setShowConfirm, showConfirm ? "Hide password" : "Show password")}
                </div>
                {errors.confirmPassword && (
                  <p className="mt-1 text-xs text-danger-600">{errors.confirmPassword.message}</p>
                )}
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating account…
                </>
              ) : (
                <>
                  Create Account
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Footer link */}
          <p className="mt-6 text-center text-sm text-gray-500">
            Already have an account?{" "}
            <Link
              to="/login"
              className="font-semibold text-primary-600 hover:text-primary-700"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
