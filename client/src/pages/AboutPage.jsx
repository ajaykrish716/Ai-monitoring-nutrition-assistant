/**
 * About Page — Explains NutriTrack's AI personalization approach, science-backed methodology, and safety commitments.
 */

import { Leaf, ShieldCheck, Sparkles, Brain, Award, HeartHandshake } from "lucide-react";
import Navbar from "../components/Navbar";
import AppLayout from "../layouts/AppLayout";
import useAuthStore from "../store/authStore";

export default function AboutPage() {
  const { isAuthenticated } = useAuthStore();

  const content = (
    <div className="max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-12">
      {/* Hero */}
      <div className="text-center space-y-4 max-w-2xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-100 dark:bg-primary-950/80 text-primary-800 dark:text-primary-300 text-xs font-bold uppercase tracking-wider">
          <Sparkles className="w-3.5 h-3.5" />
          Science-Backed Mentorship
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-gray-900 dark:text-white tracking-tight">
          Nutritional Success That Realistically Fits Your Life
        </h1>
        <p className="text-sm sm:text-base text-gray-600 dark:text-slate-300 leading-relaxed">
          NutriTrack combines state-of-the-art conversational AI with deterministic nutritional calculations to deliver personalized daily guidance tailored dynamically to your budget, culture, and goals.
        </p>
      </div>

        {/* 3 Pillars */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-gray-200 dark:border-slate-800 shadow-xs space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-primary-50 dark:bg-primary-950/80 text-primary-600 dark:text-primary-400 flex items-center justify-center">
              <Brain className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-slate-100">Dynamic Reasoning</h3>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-slate-400 leading-relaxed">
              We never constrain your goals to pre-made dropdowns. Whether you are optimizing energy, marathon training, or managing food sensitivities, our AI reasons dynamically from your stated need.
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-gray-200 dark:border-slate-800 shadow-xs space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-primary-50 dark:bg-primary-950/80 text-primary-600 dark:text-primary-400 flex items-center justify-center">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-slate-100">Allergen Safety First</h3>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-slate-400 leading-relaxed">
              Your safety is paramount. All meal generation strictly respects collected allergies, medical context, and dietary restrictions, while emphasizing that we complement—never replace—your healthcare provider.
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-gray-200 dark:border-slate-800 shadow-xs space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Award className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-slate-100">
              Nutritional Success &gt; Obedience
            </h3>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-slate-400 leading-relaxed">
              Eat affordable alternatives or favorite local meals and still receive full nutritional success credit. All macro arithmetic and scores are calculated with deterministic precision.
            </p>
          </div>
        </div>

        {/* Safety & Medical Disclaimer */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-gray-200 dark:border-slate-800 shadow-xs space-y-3">
          <h2 className="text-base font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
            <HeartHandshake className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            Safety & Clinical Scope Notice
          </h2>
          <p className="text-xs sm:text-sm text-gray-600 dark:text-slate-400 leading-relaxed">
            NutriTrack is an educational and wellness mentoring tool designed to help you build balanced nutritional habits. It is not a medical diagnostic device, does not prescribe pharmaceuticals, and does not provide clinical treatments. If you have medical conditions, eating disorders, or are under a physician's care, always consult with your registered dietitian or medical professional.
          </p>
        </div>
    </div>
  );

  if (isAuthenticated) {
    return (
      <AppLayout
        title="About NutriTrack"
        subtitle="Our methodology, science-backed approach, and safety commitments"
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
