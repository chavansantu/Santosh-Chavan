import { AuthUser } from '../types';
import { 
  BookOpen, 
  LogOut, 
  Sparkles, 
  User as UserIcon, 
  ShieldCheck, 
  Shield, 
  MessageSquareText, 
  Image as ImageIcon 
} from 'lucide-react';

export type ActiveAppView = 'journal' | 'chat' | 'images' | 'admin';

interface HeaderProps {
  user: AuthUser | null;
  onSignOut: () => void;
  onNewEntry: () => void;
  entriesCount: number;
  currentView: ActiveAppView;
  onChangeView: (view: ActiveAppView) => void;
}

export function Header({
  user,
  onSignOut,
  onNewEntry,
  entriesCount,
  currentView,
  onChangeView,
}: HeaderProps) {
  return (
    <header className="w-full bg-stone-900 text-stone-100 border-b border-stone-800 sticky top-0 z-30 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3 shrink-0">
          <div 
            onClick={() => onChangeView('journal')}
            className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 cursor-pointer hover:bg-amber-500/20 transition-colors"
          >
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 
                onClick={() => onChangeView('journal')}
                className="text-base font-semibold tracking-tight text-stone-100 cursor-pointer hover:text-amber-300 transition-colors"
              >
                AI Journal & Reflections
              </h1>
              <span className="hidden xl:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-950/80 text-emerald-300 border border-emerald-800/60">
                <ShieldCheck className="w-3 h-3" />
                Firebase Vault
              </span>
            </div>
            <p className="text-xs text-stone-400 hidden sm:block">
              Multi-Turn Gemini Chat, Maps & Search Grounding, and AI Visual Studio
            </p>
          </div>
        </div>

        {/* Primary View Switcher Navigation */}
        {user && (
          <nav className="hidden md:flex items-center gap-1 bg-stone-950/80 border border-stone-800 rounded-xl p-1">
            <button
              id="nav-tab-journal"
              onClick={() => onChangeView('journal')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                currentView === 'journal'
                  ? 'bg-amber-500 text-stone-950 font-semibold shadow-xs'
                  : 'text-stone-400 hover:text-stone-200 hover:bg-stone-900'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Journal Editor</span>
            </button>

            <button
              id="nav-tab-chat"
              onClick={() => onChangeView('chat')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                currentView === 'chat'
                  ? 'bg-amber-500 text-stone-950 font-semibold shadow-xs'
                  : 'text-stone-400 hover:text-stone-200 hover:bg-stone-900'
              }`}
            >
              <MessageSquareText className="w-3.5 h-3.5" />
              <span>Gemini Chatbot</span>
            </button>

            <button
              id="nav-tab-images"
              onClick={() => onChangeView('images')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                currentView === 'images'
                  ? 'bg-amber-500 text-stone-950 font-semibold shadow-xs'
                  : 'text-stone-400 hover:text-stone-200 hover:bg-stone-900'
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span>Visual Studio</span>
            </button>

            <button
              id="nav-tab-admin"
              onClick={() => onChangeView('admin')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                currentView === 'admin'
                  ? 'bg-amber-500 text-stone-950 font-semibold shadow-xs'
                  : 'text-stone-400 hover:text-amber-300 hover:bg-stone-900'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Admin RBAC</span>
            </button>
          </nav>
        )}

        {/* User profile & Actions */}
        {user ? (
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {currentView === 'journal' && (
              <button
                id="new-reflection-btn"
                onClick={onNewEntry}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium bg-amber-500 hover:bg-amber-400 text-stone-950 transition-colors cursor-pointer shadow-xs active:scale-95"
              >
                <Sparkles className="w-4 h-4" />
                <span>New Entry</span>
              </button>
            )}

            <div className="h-6 w-px bg-stone-800 mx-1 hidden sm:block" />

            <div className="flex items-center gap-2">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'User'}
                  className="w-8 h-8 rounded-full border border-stone-700 object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-stone-800 border border-stone-700 flex items-center justify-center text-stone-400">
                  <UserIcon className="w-4 h-4" />
                </div>
              )}
              <div className="hidden lg:block text-left text-xs">
                <p className="font-medium text-stone-200 truncate max-w-[120px]">
                  {user.displayName || user.email?.split('@')[0] || 'Member'}
                </p>
                <p className="text-stone-400">{entriesCount} {entriesCount === 1 ? 'entry' : 'entries'}</p>
              </div>
            </div>

            <button
              id="logout-btn"
              onClick={onSignOut}
              title="Sign Out"
              className="p-2 rounded-lg text-stone-400 hover:text-stone-200 hover:bg-stone-800 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span className="sr-only">Sign Out</span>
            </button>
          </div>
        ) : null}
      </div>

      {/* Mobile view sub-navigation */}
      {user && (
        <div className="md:hidden flex items-center justify-around px-2 py-1.5 bg-stone-950 border-t border-stone-800 text-xs">
          <button
            onClick={() => onChangeView('journal')}
            className={`px-3 py-1 rounded-md ${
              currentView === 'journal' ? 'bg-amber-500 text-stone-950 font-bold' : 'text-stone-400'
            }`}
          >
            Journal
          </button>
          <button
            onClick={() => onChangeView('chat')}
            className={`px-3 py-1 rounded-md ${
              currentView === 'chat' ? 'bg-amber-500 text-stone-950 font-bold' : 'text-stone-400'
            }`}
          >
            Chatbot
          </button>
          <button
            onClick={() => onChangeView('images')}
            className={`px-3 py-1 rounded-md ${
              currentView === 'images' ? 'bg-amber-500 text-stone-950 font-bold' : 'text-stone-400'
            }`}
          >
            Visual Studio
          </button>
          <button
            onClick={() => onChangeView('admin')}
            className={`px-2 py-1 rounded-md ${
              currentView === 'admin' ? 'bg-amber-500 text-stone-950 font-bold' : 'text-stone-400'
            }`}
          >
            Admin
          </button>
        </div>
      )}
    </header>
  );
}
