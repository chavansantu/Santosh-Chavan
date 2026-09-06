/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { AuthUser, JournalEntry, InteractionMessage, SaveErrorState } from './types';
import { auth, signInWithGoogle, logOut, subscribeToAuth } from './lib/firebase';
import { 
  fetchUserEntries, 
  deleteJournalEntry, 
  fetchInteractionsForEntry 
} from './lib/firestoreService';
import { Header } from './components/Header';
import { LandingPage } from './components/LandingPage';
import { JournalEditor } from './components/JournalEditor';
import { GeminiReflectionPanel } from './components/GeminiReflectionPanel';
import { HistorySidebar } from './components/HistorySidebar';
import { ErrorBanner } from './components/ErrorBanner';
import { AdminDashboard } from './components/AdminDashboard';
import { Loader2, ShieldCheck, HelpCircle } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [activeEntry, setActiveEntry] = useState<JournalEntry | null>(null);
  const [interactions, setInteractions] = useState<InteractionMessage[]>([]);
  const [errorState, setErrorState] = useState<SaveErrorState>({
    hasError: false,
    message: '',
  });
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [mobileTab, setMobileTab] = useState<'editor' | 'gemini' | 'history'>('editor');
  const [showWalkthrough, setShowWalkthrough] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);

  // Subscribe to Firebase Authentication state
  useEffect(() => {
    const unsubscribe = subscribeToAuth(async (firebaseUser) => {
      if (firebaseUser) {
        const authUserData: AuthUser = {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          photoURL: firebaseUser.photoURL,
        };
        setUser(authUserData);
      } else {
        setUser(null);
        setEntries([]);
        setActiveEntry(null);
        setInteractions([]);
      }
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Load user's private Firestore entries on auth change
  useEffect(() => {
    if (!user) return;

    let isMounted = true;
    const loadEntries = async () => {
      setLoadingEntries(true);
      try {
        const data = await fetchUserEntries(user.uid);
        if (isMounted) {
          setEntries(data);
          if (data.length > 0 && !activeEntry) {
            setActiveEntry(data[0]);
          }
        }
      } catch (err: any) {
        console.error('Failed to load user entries from Firestore:', err);
        if (isMounted) {
          setErrorState({
            hasError: true,
            message: `Firestore sync failed: ${err.message}. Retrying or check permissions.`,
            retryAction: loadEntries,
          });
        }
      } finally {
        if (isMounted) {
          setLoadingEntries(false);
        }
      }
    };

    loadEntries();
    return () => {
      isMounted = false;
    };
  }, [user?.uid]);

  // Load interactions for active entry
  useEffect(() => {
    if (!user || !activeEntry?.id) {
      setInteractions([]);
      return;
    }

    let isMounted = true;
    const loadInteractions = async () => {
      try {
        const msgs = await fetchInteractionsForEntry(user.uid, activeEntry.id);
        if (isMounted) {
          setInteractions(msgs);
        }
      } catch (err: any) {
        console.warn('Could not load interactions for entry:', err);
      }
    };

    loadInteractions();
    return () => {
      isMounted = false;
    };
  }, [user?.uid, activeEntry?.id]);

  const handleSignIn = async () => {
    await signInWithGoogle();
  };

  const handleSignOut = async () => {
    await logOut();
  };

  const handleNewEntry = () => {
    setActiveEntry(null);
    setInteractions([]);
    setMobileTab('editor');
  };

  const handleSelectEntry = (entry: JournalEntry) => {
    setActiveEntry(entry);
    setMobileTab('editor');
  };

  const handleSaveSuccess = (savedEntry: JournalEntry) => {
    setEntries((prev) => {
      const exists = prev.some((e) => e.id === savedEntry.id);
      if (exists) {
        return prev.map((e) => (e.id === savedEntry.id ? savedEntry : e));
      }
      return [savedEntry, ...prev];
    });
    setActiveEntry(savedEntry);
  };

  const handleDeleteEntry = async (id: string) => {
    if (!user) return;
    try {
      await deleteJournalEntry(user.uid, id);
      setEntries((prev) => prev.filter((e) => e.id !== id));
      if (activeEntry?.id === id) {
        setActiveEntry(null);
        setInteractions([]);
      }
    } catch (err: any) {
      setErrorState({
        hasError: true,
        message: `Failed to delete entry: ${err.message}`,
      });
    }
  };

  const handleAddInteraction = (msg: InteractionMessage) => {
    setInteractions((prev) => [...prev, msg]);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-stone-950 flex flex-col items-center justify-center text-stone-300">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500 mb-3" />
        <p className="text-sm font-medium">Securing connection to Firebase Vault...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col font-sans selection:bg-amber-500 selection:text-stone-950">
      {/* App Header */}
      <Header
        user={user}
        onSignOut={handleSignOut}
        onNewEntry={handleNewEntry}
        entriesCount={entries.length}
        onOpenAdmin={() => setShowAdmin(true)}
      />

      {/* Main Content Area */}
      {!user ? (
        <LandingPage onSignIn={handleSignIn} isLoading={authLoading} />
      ) : (
        <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-6 flex flex-col">
          {/* Error Banner for persistence failure recovery */}
          <ErrorBanner
            error={errorState}
            onDismiss={() => setErrorState({ hasError: false, message: '' })}
          />

          {/* Quick bar with Vault Status, Admin Console & Walkthrough Guide Modal toggle */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2 text-xs text-stone-400">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                Connected to isolated Firestore collection: <code className="text-amber-400/90 font-mono text-[11px]">/users/{user.uid.slice(0, 8)}...</code>
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                id="quickbar-admin-console-btn"
                onClick={() => setShowAdmin(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-amber-300 hover:text-amber-200 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 transition-colors cursor-pointer"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                <span>Admin Console (RBAC)</span>
              </button>

              <button
                id="view-walkthrough-guide-btn"
                onClick={() => setShowWalkthrough(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-stone-400 hover:text-stone-200 hover:bg-stone-900 border border-stone-800 transition-colors cursor-pointer"
              >
                <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
                <span>Test Walkthrough</span>
              </button>
            </div>
          </div>

          {/* Mobile Tab Switcher */}
          <div className="lg:hidden flex items-center p-1 mb-4 rounded-xl bg-stone-900 border border-stone-800 text-xs font-medium">
            <button
              onClick={() => setMobileTab('editor')}
              className={`flex-1 py-2 rounded-lg text-center transition-colors cursor-pointer ${
                mobileTab === 'editor'
                  ? 'bg-amber-500 text-stone-950 font-semibold'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              Journal
            </button>
            <button
              onClick={() => setMobileTab('gemini')}
              className={`flex-1 py-2 rounded-lg text-center transition-colors cursor-pointer ${
                mobileTab === 'gemini'
                  ? 'bg-amber-500 text-stone-950 font-semibold'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              Gemini AI
            </button>
            <button
              onClick={() => setMobileTab('history')}
              className={`flex-1 py-2 rounded-lg text-center transition-colors cursor-pointer ${
                mobileTab === 'history'
                  ? 'bg-amber-500 text-stone-950 font-semibold'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              History ({entries.length})
            </button>
          </div>

          {/* Desktop 3-Column Bento Grid Layout */}
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-5 min-h-[620px]">
            {/* Column 1: History (Desktop: 3 cols) */}
            <div className={`lg:col-span-3 h-full ${mobileTab === 'history' ? 'block' : 'hidden lg:block'}`}>
              <HistorySidebar
                entries={entries}
                activeEntryId={activeEntry?.id || null}
                onSelectEntry={handleSelectEntry}
                onNewEntry={handleNewEntry}
              />
            </div>

            {/* Column 2: Journal Editor (Desktop: 5 cols) */}
            <div className={`lg:col-span-5 h-full ${mobileTab === 'editor' ? 'block' : 'hidden lg:block'}`}>
              <JournalEditor
                userId={user.uid}
                entry={activeEntry}
                onSaveSuccess={handleSaveSuccess}
                onDeleteEntry={handleDeleteEntry}
                onError={(err) => setErrorState(err)}
              />
            </div>

            {/* Column 3: Gemini Reflection & Multi-turn Chat (Desktop: 4 cols) */}
            <div className={`lg:col-span-4 h-full ${mobileTab === 'gemini' ? 'block' : 'hidden lg:block'}`}>
              <GeminiReflectionPanel
                userId={user.uid}
                activeEntry={activeEntry}
                interactions={interactions}
                onAddInteraction={handleAddInteraction}
                onError={(err) => setErrorState(err)}
              />
            </div>
          </div>
        </main>
      )}

      {/* Test Walkthrough Modal */}
      {showWalkthrough && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-stone-900 border border-stone-800 rounded-2xl p-6 shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-stone-800">
              <h3 className="text-base font-semibold text-stone-100 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                Functional Verification Walkthrough
              </h3>
              <button
                onClick={() => setShowWalkthrough(false)}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-200 hover:bg-stone-800"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs sm:text-sm text-stone-300 leading-relaxed">
              <p className="text-stone-400">
                Below are verifiable steps corresponding to every key process and interaction in the application:
              </p>

              <div className="p-3.5 rounded-xl bg-stone-950 border border-stone-800 space-y-2">
                <p className="font-semibold text-amber-400">1. Authentication & Isolation Test</p>
                <ul className="list-disc list-inside space-y-1 text-stone-300">
                  <li><strong>Step A:</strong> Click "Sign In with Google". After popup sign-in, verify the header displays your name and photo.</li>
                  <li><strong>Step B:</strong> Note your unique user ID under the header banner. Notice that queries are strictly isolated under <code>/users/{"{userId}"}</code> in Firestore.</li>
                  <li><strong>Step C:</strong> Click "Sign Out" to return to the landing page and verify private records are purged from memory.</li>
                </ul>
              </div>

              <div className="p-3.5 rounded-xl bg-stone-950 border border-stone-800 space-y-2">
                <p className="font-semibold text-amber-400">2. Journal Reflection & Firestore Persistence</p>
                <ul className="list-disc list-inside space-y-1 text-stone-300">
                  <li><strong>Step A:</strong> Enter a title, select a mood tag, and type your reflection thoughts into the main text area.</li>
                  <li><strong>Step B:</strong> Click "Save Entry". Confirm the "Saved!" notice appears and the entry appears in the "Journal History" sidebar.</li>
                  <li><strong>Step C:</strong> Refresh the page. Confirm your entry loads directly from Cloud Firestore.</li>
                </ul>
              </div>

              <div className="p-3.5 rounded-xl bg-stone-950 border border-stone-800 space-y-2">
                <p className="font-semibold text-amber-400">3. Gemini AI Summaries & Insights</p>
                <ul className="list-disc list-inside space-y-1 text-stone-300">
                  <li><strong>Step A:</strong> In the Journal Editor, click the "AI Insights" button.</li>
                  <li><strong>Step B:</strong> Verify Gemini analyzes the text, generates a theme badge, synthesis summary, and key takeaways checklist.</li>
                  <li><strong>Step C:</strong> Verify these insights are automatically saved back to Firestore with the entry.</li>
                </ul>
              </div>

              <div className="p-3.5 rounded-xl bg-stone-950 border border-stone-800 space-y-2">
                <p className="font-semibold text-amber-400">4. Multi-Turn Reflective Dialogue</p>
                <ul className="list-disc list-inside space-y-1 text-stone-300">
                  <li><strong>Step A:</strong> In the right panel, select a mode (Reflect, Summarize, or Brainstorm).</li>
                  <li><strong>Step B:</strong> Click a suggested prompt chip or type a custom question, then click Send.</li>
                  <li><strong>Step C:</strong> Watch Gemini reply using <code>gemini-3.6-flash</code> (with fallback ladder active).</li>
                  <li><strong>Step D:</strong> Send a follow-up message to verify conversational context preservation across turns.</li>
                </ul>
              </div>

              <div className="p-3.5 rounded-xl bg-stone-950 border border-stone-800 space-y-2">
                <p className="font-semibold text-amber-400">5. Location-Aware Journal Entries</p>
                <ul className="list-disc list-inside space-y-1 text-stone-300">
                  <li><strong>Step A:</strong> In the Journal Editor, click "Pin GPS" to capture your current browser coordinates, or click "Place Search" and type a city/landmark (e.g., "Kyoto, Japan").</li>
                  <li><strong>Step B:</strong> Verify the place name resolves securely through the server-side geocoding proxy without exposing API keys.</li>
                  <li><strong>Step C:</strong> Click "Save Entry". Confirm the location badge appears in the entry and in the Journal History card.</li>
                  <li><strong>Step D:</strong> Coordinate boundaries (-90 to 90 lat, -180 to 180 lng) are verified in <code>firestore.rules</code>.</li>
                </ul>
              </div>

              <div className="p-3.5 rounded-xl bg-stone-950 border border-stone-800 space-y-2">
                <p className="font-semibold text-amber-400">6. Admin RBAC & Privacy Telemetry</p>
                <ul className="list-disc list-inside space-y-1 text-stone-300">
                  <li><strong>Step A:</strong> Click "Admin Console (RBAC)" in the header or status bar.</li>
                  <li><strong>Step B:</strong> The server verifies the caller's email against authorized admin credentials (<code>ADMIN_EMAILS</code>).</li>
                  <li><strong>Step C:</strong> Confirm system-wide aggregated metrics (total entries, active tenants, location tag count, and Gemini fallback ladder statistics) are visible.</li>
                  <li><strong>Step D:</strong> Notice the Tenant Isolation guarantee: Admins never receive private entry text across tenant boundaries.</li>
                </ul>
              </div>

              <div className="p-3.5 rounded-xl bg-stone-950 border border-stone-800 space-y-2">
                <p className="font-semibold text-amber-400">7. External Notifications with SSRF Security Defense</p>
                <ul className="list-disc list-inside space-y-1 text-stone-300">
                  <li><strong>Step A:</strong> In the Admin Console, navigate to the "External Notification Dispatch Hub".</li>
                  <li><strong>Step B:</strong> Click "Test Cloud Metadata Probe" (<code>http://169.254.169.254/...</code>) and click Dispatch. Verify the server rejects the request with an SSRF blocking error.</li>
                  <li><strong>Step C:</strong> Click "Test Localhost Probe" (<code>http://localhost:3000/...</code>) and verify loopback traffic is actively blocked.</li>
                  <li><strong>Step D:</strong> Click "Test Safe Public HTTPS" (<code>https://httpbin.org/post</code>) to verify legitimate outbound notifications pass through safely.</li>
                </ul>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowWalkthrough(false)}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold text-xs sm:text-sm cursor-pointer"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin RBAC Console Modal */}
      {showAdmin && (
        <AdminDashboard
          user={user}
          onClose={() => setShowAdmin(false)}
        />
      )}
    </div>
  );
}
