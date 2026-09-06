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
  fetchInteractionsForEntry,
  saveJournalEntry
} from './lib/firestoreService';
import { Header, ActiveAppView } from './components/Header';
import { LandingPage } from './components/LandingPage';
import { JournalEditor } from './components/JournalEditor';
import { GeminiReflectionPanel } from './components/GeminiReflectionPanel';
import { GeminiChatbot } from './components/GeminiChatbot';
import { ImageStudio } from './components/ImageStudio';
import { HistorySidebar } from './components/HistorySidebar';
import { ErrorBanner } from './components/ErrorBanner';
import { AdminDashboard } from './components/AdminDashboard';
import { Loader2, ShieldCheck, HelpCircle, MessageSquareText, Image as ImageIcon, BookOpen } from 'lucide-react';

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
  const [currentView, setCurrentView] = useState<ActiveAppView>('journal');
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

  // Attach generated or edited image to the active journal entry
  const handleAttachImageToEntry = async (imageUrl: string) => {
    if (!user) return;
    if (activeEntry) {
      const updatedContent = activeEntry.content
        ? `${activeEntry.content}\n\n![Visual Reflection](${imageUrl})`
        : `![Visual Reflection](${imageUrl})`;
      try {
        const saved = await saveJournalEntry(user.uid, {
          id: activeEntry.id,
          title: activeEntry.title,
          content: updatedContent,
          mood: activeEntry.mood,
          location: activeEntry.location,
          summary: activeEntry.summary,
          theme: activeEntry.theme,
          keyTakeaways: activeEntry.keyTakeaways,
        });
        setActiveEntry(saved);
        setEntries((prev) => prev.map((e) => (e.id === saved.id ? saved : e)));
      } catch (err: any) {
        console.error('Failed to attach image to entry:', err);
        setErrorState({
          hasError: true,
          message: `Failed to attach image: ${err.message}`,
        });
      }
    }
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
        currentView={currentView}
        onChangeView={setCurrentView}
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

          {/* Quick bar with Vault Status, Grounding badges, & Walkthrough Guide Modal toggle */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2 text-xs text-stone-400">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                Connected to Firestore Vault: <code className="text-amber-400/90 font-mono text-[11px]">/users/{user.uid.slice(0, 8)}...</code>
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                id="view-walkthrough-guide-btn"
                onClick={() => setShowWalkthrough(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-stone-400 hover:text-stone-200 hover:bg-stone-900 border border-stone-800 transition-colors cursor-pointer"
              >
                <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
                <span>Feature Test Walkthrough</span>
              </button>
            </div>
          </div>

          {/* Conditional View Rendering */}
          {currentView === 'chat' ? (
            /* View 1: Gemini Chatbot View */
            <div className="flex-1 min-h-[640px]">
              <GeminiChatbot
                userId={user.uid}
                activeEntry={activeEntry}
                onError={(err) => setErrorState(err)}
              />
            </div>
          ) : currentView === 'images' ? (
            /* View 2: Visual Reflections Studio */
            <div className="flex-1 min-h-[640px]">
              <ImageStudio
                userId={user.uid}
                activeEntry={activeEntry}
                onAttachImageToEntry={handleAttachImageToEntry}
                onError={(err) => setErrorState(err)}
              />
            </div>
          ) : currentView === 'admin' ? (
            /* View 3: Admin Dashboard */
            <div className="flex-1 min-h-[640px]">
              <AdminDashboard
                user={user}
                onClose={() => setCurrentView('journal')}
              />
            </div>
          ) : (
            /* View 4: Journal Editor & Reflection Bento Grid */
            <>
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
            </>
          )}
        </main>
      )}

      {/* Test Walkthrough Modal */}
      {showWalkthrough && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-stone-900 border border-stone-800 rounded-2xl p-6 shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-stone-800">
              <h3 className="text-base font-semibold text-stone-100 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                Comprehensive Features Verification Guide
              </h3>
              <button
                onClick={() => setShowWalkthrough(false)}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-200 hover:bg-stone-800 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs sm:text-sm text-stone-300 leading-relaxed">
              <p className="text-stone-400">
                Below are verifiable steps corresponding to every key process and interaction in the application:
              </p>

              <div className="p-3.5 rounded-xl bg-stone-950 border border-stone-800 space-y-2">
                <p className="font-semibold text-amber-400">1. Authentication & Tenant Isolation</p>
                <ul className="list-disc list-inside space-y-1 text-stone-300">
                  <li><strong>Step A:</strong> Click "Sign In with Google". Verify the header displays your profile picture and name.</li>
                  <li><strong>Step B:</strong> Verify data is strictly stored under <code>/users/{"{userId}"}</code> with owner-bound rules.</li>
                </ul>
              </div>

              <div className="p-3.5 rounded-xl bg-stone-950 border border-stone-800 space-y-2">
                <p className="font-semibold text-amber-400">2. Multi-Turn Gemini Chatbot with Persona Roles</p>
                <ul className="list-disc list-inside space-y-1 text-stone-300">
                  <li><strong>Step A:</strong> Click the <strong>"Gemini Chatbot"</strong> tab in the header.</li>
                  <li><strong>Step B:</strong> Switch roles between <em>Mindful Companion</em>, <em>Introspective Analyst</em>, <em>Socratic Mentor</em>, and <em>Creative Muse</em>.</li>
                  <li><strong>Step C:</strong> Switch models between <code>gemini-3.1-pro-preview</code> (Deep Reasoning), <code>gemini-3.5-flash</code> (Fast & Grounded), and <code>gemini-3.1-flash-lite</code> (Low-latency).</li>
                  <li><strong>Step D:</strong> Chat multi-turn; verify conversational history is preserved and stored in Firestore.</li>
                </ul>
              </div>

              <div className="p-3.5 rounded-xl bg-stone-950 border border-stone-800 space-y-2">
                <p className="font-semibold text-amber-400">3. Google Maps Grounding with Live Place Citations</p>
                <ul className="list-disc list-inside space-y-1 text-stone-300">
                  <li><strong>Step A:</strong> In the Gemini Chatbot, toggle the <strong>"Google Maps Grounding"</strong> switch.</li>
                  <li><strong>Step B:</strong> Click "Share GPS" or let it detect location, or ask: <em>"Find quiet zen gardens, tranquil public parks, or serene tea houses near my location"</em>.</li>
                  <li><strong>Step C:</strong> The server automatically routes through <code>gemini-3.5-flash</code> with the <code>googleMaps</code> tool.</li>
                  <li><strong>Step D:</strong> Confirm response displays real-world Google Maps place cards, address citations, and direct links.</li>
                </ul>
              </div>

              <div className="p-3.5 rounded-xl bg-stone-950 border border-stone-800 space-y-2">
                <p className="font-semibold text-amber-400">4. Google Search Grounding with Live Web Sources</p>
                <ul className="list-disc list-inside space-y-1 text-stone-300">
                  <li><strong>Step A:</strong> In the Gemini Chatbot, toggle the <strong>"Google Search Grounding"</strong> switch.</li>
                  <li><strong>Step B:</strong> Ask a timely question: <em>"What are the latest cognitive psychology findings on daily expressive writing and stress reduction in 2025/2026?"</em></li>
                  <li><strong>Step C:</strong> The server executes with <code>gemini-3.5-flash</code> and the <code>googleSearch</code> tool.</li>
                  <li><strong>Step D:</strong> Notice the verified web citations and direct external reference links at the bottom of the message.</li>
                </ul>
              </div>

              <div className="p-3.5 rounded-xl bg-stone-950 border border-stone-800 space-y-2">
                <p className="font-semibold text-amber-400">5. AI Image Creation & Editing (gemini-3.1-flash-image-preview)</p>
                <ul className="list-disc list-inside space-y-1 text-stone-300">
                  <li><strong>Step A:</strong> Click the <strong>"Visual Studio"</strong> tab in the header.</li>
                  <li><strong>Step B:</strong> Select an aspect ratio (1:1, 16:9, etc.) and enter a prompt: <em>"A serene lakeside mountain cabin during golden hour sunrise"</em>.</li>
                  <li><strong>Step C:</strong> Click "Generate Visual Reflection". Gemini 3.1 Flash Image Preview synthesizes the image.</li>
                  <li><strong>Step D:</strong> Switch to the "Edit" tab, describe modifications (e.g. <em>"Add glowing bioluminescent water and starry night sky"</em>), and synthesize.</li>
                  <li><strong>Step E:</strong> Click "Attach to Entry" to bind the generated artwork directly into your active journal entry, or download the PNG.</li>
                </ul>
              </div>

              <div className="p-3.5 rounded-xl bg-stone-950 border border-stone-800 space-y-2">
                <p className="font-semibold text-amber-400">6. Admin RBAC & SSRF-Protected Webhooks</p>
                <ul className="list-disc list-inside space-y-1 text-stone-300">
                  <li><strong>Step A:</strong> Click "Admin RBAC" in the header navigation.</li>
                  <li><strong>Step B:</strong> Check system telemetry, fallback ladder health, and SSRF firewall testing suite.</li>
                </ul>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowWalkthrough(false)}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold text-xs sm:text-sm cursor-pointer"
              >
                Close Guide
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin RBAC Console Modal (if opened directly via fallback button) */}
      {showAdmin && (
        <AdminDashboard
          user={user}
          onClose={() => setShowAdmin(false)}
        />
      )}
    </div>
  );
}
