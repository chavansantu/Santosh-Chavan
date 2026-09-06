import { useState } from 'react';
import { Lock, Sparkles, Database, Compass, Shield, ArrowRight, Loader2, AlertCircle } from 'lucide-react';

interface LandingPageProps {
  onSignIn: () => Promise<void>;
  isLoading: boolean;
}

export function LandingPage({ onSignIn, isLoading }: LandingPageProps) {
  const [error, setError] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);

  const handleLogin = async () => {
    try {
      setError(null);
      setSigningIn(true);
      await onSignIn();
    } catch (err: any) {
      console.error('Sign-in error:', err);
      setError(
        err?.message?.includes('popup-closed')
          ? 'Sign in was cancelled. Click below to try again.'
          : err?.message || 'Failed to sign in. Please verify your connection.'
      );
    } finally {
      setSigningIn(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col justify-center items-center px-4 sm:px-6 py-12 bg-stone-950 text-stone-100">
      <div className="w-full max-w-4xl mx-auto text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-stone-900 border border-stone-800 text-amber-400 mb-6">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Gemini 3.6 Flash + Cloud Firestore Vault</span>
        </div>

        {/* Title */}
        <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-stone-100 max-w-3xl mx-auto leading-tight sm:leading-tight">
          A Private Sanctuary for Mindful Reflection & Deeper Insights
        </h1>

        <p className="mt-5 text-base sm:text-lg text-stone-400 max-w-2xl mx-auto leading-relaxed">
          Record your daily journal entries, brainstorm breakthroughs, and engage in multi-turn dialogues with Gemini. Every interaction is strictly secured within your own private Firestore vault.
        </p>

        {/* Error notification if login blocked */}
        {error && (
          <div className="mt-6 max-w-md mx-auto p-3.5 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-200 text-sm flex items-start gap-3 text-left">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Authentication Notice</p>
              <p className="text-rose-300 text-xs mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* Sign In CTA */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            id="google-signin-btn"
            onClick={handleLogin}
            disabled={signingIn || isLoading}
            className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold text-sm sm:text-base flex items-center justify-center gap-3 transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-amber-950/20 cursor-pointer"
          >
            {signingIn || isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Signing in with Google...</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Sign In with Google</span>
                <ArrowRight className="w-4 h-4 text-stone-900" />
              </>
            )}
          </button>
        </div>

        {/* Security & Feature Matrix */}
        <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-6 text-left">
          <div className="p-6 rounded-2xl bg-stone-900/60 border border-stone-800 backdrop-blur-sm">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-4">
              <Shield className="w-5 h-5" />
            </div>
            <h2 className="text-base font-semibold text-stone-200">Zero-Leak User Vault</h2>
            <p className="mt-2 text-sm text-stone-400 leading-relaxed">
              Every document path is locked down with strict security rules: only you can query, write, or inspect your personal reflections.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-stone-900/60 border border-stone-800 backdrop-blur-sm">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-4">
              <Sparkles className="w-5 h-5" />
            </div>
            <h2 className="text-base font-semibold text-stone-200">Gemini 3.6 Flash Engine</h2>
            <p className="mt-2 text-sm text-stone-400 leading-relaxed">
              Engage in multi-turn coaching, receive executive summaries, or discover subconscious thinking patterns with AI assistance.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-stone-900/60 border border-stone-800 backdrop-blur-sm">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 mb-4">
              <Database className="w-5 h-5" />
            </div>
            <h2 className="text-base font-semibold text-stone-200">Guaranteed Persistence</h2>
            <p className="mt-2 text-sm text-stone-400 leading-relaxed">
              Dual-persistence records both your input and Gemini's response seamlessly to Cloud Firestore with built-in retry mechanisms.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
