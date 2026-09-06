import { AuthUser } from '../types';
import { BookOpen, LogOut, Sparkles, User as UserIcon, ShieldCheck, Shield } from 'lucide-react';

interface HeaderProps {
  user: AuthUser | null;
  onSignOut: () => void;
  onNewEntry: () => void;
  entriesCount: number;
  onOpenAdmin?: () => void;
}

export function Header({ user, onSignOut, onNewEntry, entriesCount, onOpenAdmin }: HeaderProps) {
  return (
    <header className="w-full bg-stone-900 text-stone-100 border-b border-stone-800 sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-semibold tracking-tight text-stone-100">
                AI Journal & Reflections
              </h1>
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-950/80 text-emerald-300 border border-emerald-800/60">
                <ShieldCheck className="w-3 h-3" />
                Isolated User Vault
              </span>
            </div>
            <p className="text-xs text-stone-400 hidden sm:block">
              Private thoughts guided by Gemini 3.6 Flash & Cloud Firestore
            </p>
          </div>
        </div>

        {/* User profile & Actions */}
        {user ? (
          <div className="flex items-center gap-2 sm:gap-3">
            {onOpenAdmin && (
              <button
                id="header-admin-console-btn"
                onClick={onOpenAdmin}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-amber-300 hover:text-amber-200 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 transition-colors cursor-pointer"
                title="Admin Security & Telemetry Console"
              >
                <Shield className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">Admin Console</span>
              </button>
            )}

            <button
              id="new-reflection-btn"
              onClick={onNewEntry}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium bg-amber-500 hover:bg-amber-400 text-stone-950 transition-colors cursor-pointer shadow-sm active:scale-95"
            >
              <Sparkles className="w-4 h-4" />
              <span>New Entry</span>
            </button>

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
              <div className="hidden md:block text-left text-xs">
                <p className="font-medium text-stone-200 truncate max-w-[140px]">
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
    </header>
  );
}
