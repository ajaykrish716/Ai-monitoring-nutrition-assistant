/**
 * Contact Page — Contact & Mentorship Support Form with full Theme support.
 */

import { useState } from "react";
import { Mail, MessageCircle, Send, CheckCircle2, HelpCircle } from "lucide-react";
import Navbar from "../components/Navbar";
import AppLayout from "../layouts/AppLayout";
import useAuthStore from "../store/authStore";

export default function ContactPage() {
  const { isAuthenticated } = useAuthStore();
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "General Question",
    message: "",
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);
  };

  const content = (
    <div className="max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        <div className="text-center space-y-2 max-w-xl mx-auto">
          <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            Get in Touch
          </h1>
          <p className="text-sm text-gray-600 dark:text-slate-400">
            Have questions about your nutrition plan, dynamic onboarding, or platform features? We're here to help.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Info Card */}
          <div className="bg-gradient-to-br from-primary-700 to-primary-900 dark:from-slate-900 dark:to-primary-950 text-white rounded-3xl p-6 sm:p-8 space-y-6 flex flex-col justify-between shadow-lg border border-primary-600/30 dark:border-primary-800/40">
            <div className="space-y-4">
              <h2 className="text-lg font-bold">Contact Info</h2>
              <p className="text-xs text-primary-100 dark:text-slate-300 leading-relaxed">
                Our support team and nutrition mentors typically respond within 24 hours.
              </p>
              <div className="space-y-3 text-xs text-primary-100 dark:text-slate-300">
                <div className="flex items-center gap-2.5">
                  <Mail className="w-4 h-4 text-primary-300 dark:text-primary-400" />
                  <span>support@nutritrack.ai</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <MessageCircle className="w-4 h-4 text-primary-300 dark:text-primary-400" />
                  <span>Nutri Companion Available in App</span>
                </div>
              </div>
            </div>

            <div className="bg-white/10 dark:bg-slate-950/80 rounded-2xl p-4 text-xs text-primary-100 dark:text-primary-300 border border-white/20 dark:border-primary-800/50 backdrop-blur-md">
              <span className="font-semibold text-white block mb-1">Instant Coaching:</span>
              Use the in-app AI Mentor page for personalized meal substitutions and budget advice.
            </div>
          </div>

          {/* Form */}
          <div className="md:col-span-2 bg-white dark:bg-slate-900 rounded-3xl border border-gray-200 dark:border-slate-800 p-6 sm:p-8 shadow-xs">
            {submitted ? (
              <div className="text-center py-12 space-y-4">
                <div className="w-14 h-14 rounded-full bg-primary-100 dark:bg-primary-950 text-primary-600 dark:text-primary-400 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Message Received!</h3>
                <p className="text-xs sm:text-sm text-gray-500 dark:text-slate-400 max-w-sm mx-auto">
                  Thank you for reaching out. We will review your message and get back to you shortly.
                </p>
                <button
                  onClick={() => setSubmitted(false)}
                  className="mt-4 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold rounded-xl transition cursor-pointer"
                >
                  Send Another Message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                    Your Name
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Jane Doe"
                    className="w-full rounded-2xl border border-gray-300 dark:border-slate-700 bg-gray-50 dark:bg-slate-950 p-3 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="jane@example.com"
                    className="w-full rounded-2xl border border-gray-300 dark:border-slate-700 bg-gray-50 dark:bg-slate-950 p-3 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                    Topic
                  </label>
                  <select
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    className="w-full rounded-2xl border border-gray-300 dark:border-slate-700 bg-gray-50 dark:bg-slate-950 p-3 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="General Question">General Question</option>
                    <option value="Feedback on Daily Plan">Feedback on Daily Plan</option>
                    <option value="Technical Support">Technical Support</option>
                    <option value="Dietary Consultation">Dietary Consultation</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                    Message
                  </label>
                  <textarea
                    rows={4}
                    required
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    placeholder="How can we assist you?"
                    className="w-full rounded-2xl border border-gray-300 dark:border-slate-700 bg-gray-50 dark:bg-slate-950 p-3 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 text-white font-bold py-3.5 px-6 rounded-2xl text-sm shadow-sm transition cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  <span>Send Message</span>
                </button>
              </form>
            )}
          </div>
        </div>
    </div>
  );

  if (isAuthenticated) {
    return (
      <AppLayout
        title="Contact & Support"
        subtitle="Get in touch with the NutriTrack team and nutrition mentors"
      >
        {content}
      </AppLayout>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex flex-col font-sans transition-colors">
      <Navbar />
      <main className="flex-1">{content}</main>
    </div>
  );
}
