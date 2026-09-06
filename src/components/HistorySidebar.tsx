import { useState } from 'react';
import { Search, Calendar, Plus, BookText, Sparkles, ChevronRight, Tag, MapPin } from 'lucide-react';
import { JournalEntry } from '../types';

interface HistorySidebarProps {
  entries: JournalEntry[];
  activeEntryId: string | null;
  onSelectEntry: (entry: JournalEntry) => void;
  onNewEntry: () => void;
}

export function HistorySidebar({
  entries,
  activeEntryId,
  onSelectEntry,
  onNewEntry,
}: HistorySidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredEntries = entries.filter((item) => {
    const q = searchQuery.toLowerCase();
    return (
      item.title.toLowerCase().includes(q) ||
      item.content.toLowerCase().includes(q) ||
      (item.theme && item.theme.toLowerCase().includes(q)) ||
      (item.mood && item.mood.toLowerCase().includes(q))
    );
  });

  const getMoodEmoji = (mood?: string) => {
    switch (mood) {
      case 'Grateful':
        return '✨';
      case 'Energized':
        return '⚡';
      case 'Challenged':
        return '🌱';
      case 'Calm':
        return '🌊';
      default:
        return '🧘';
    }
  };

  return (
    <div className="flex flex-col h-full bg-stone-900 border border-stone-800 rounded-2xl p-4 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <BookText className="w-4 h-4 text-amber-400" />
          <h2 className="text-sm font-semibold text-stone-100">Journal History</h2>
          <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-stone-800 text-stone-400">
            {entries.length}
          </span>
        </div>

        <button
          id="sidebar-new-entry-btn"
          onClick={onNewEntry}
          className="p-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-amber-400 transition-colors cursor-pointer"
          title="Create New Reflection"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Search Input */}
      <div className="relative mb-3">
        <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          id="history-search-input"
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search reflections or themes..."
          className="w-full bg-stone-950/70 border border-stone-800 rounded-xl pl-8 pr-3 py-2 text-xs text-stone-100 placeholder-stone-400 focus:outline-none focus:border-amber-500/40 transition-colors"
        />
      </div>

      {/* Entries List */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {filteredEntries.length === 0 ? (
          <div className="h-48 flex flex-col items-center justify-center text-center p-4 text-stone-400 text-xs">
            <BookText className="w-8 h-8 text-stone-700 mb-2" />
            <p className="font-medium text-stone-300">No reflections found</p>
            <p className="text-stone-400 mt-1">
              {searchQuery ? 'Try matching another keyword' : 'Create your first journal entry above'}
            </p>
          </div>
        ) : (
          filteredEntries.map((item) => {
            const isSelected = activeEntryId === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectEntry(item)}
                className={`w-full text-left p-3 rounded-xl transition-all border cursor-pointer ${
                  isSelected
                    ? 'bg-amber-500/10 border-amber-500/40 text-stone-100 shadow-sm'
                    : 'bg-stone-950/40 border-stone-800/80 hover:bg-stone-800/60 hover:border-stone-700 text-stone-300'
                }`}
              >
                <div className="flex items-start justify-between gap-1.5 mb-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-xs">{getMoodEmoji(item.mood)}</span>
                    <p className="text-xs font-semibold truncate text-stone-100">
                      {item.title || 'Untitled Reflection'}
                    </p>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-stone-400 shrink-0 mt-0.5" />
                </div>

                <p className="text-[11px] text-stone-400 line-clamp-2 leading-relaxed">
                  {item.summary || item.content || 'No text recorded.'}
                </p>

                <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-stone-400 pt-1.5 border-t border-stone-800/60">
                  <div className="flex items-center gap-2 truncate">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-stone-400" />
                      {new Date(item.createdAt).toLocaleDateString([], {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                    {item.location && (
                      <span className="inline-flex items-center gap-0.5 text-amber-400/90 truncate max-w-[90px]" title={item.location.placeName || item.location.formattedAddress}>
                        <MapPin className="w-2.5 h-2.5 shrink-0" />
                        <span className="truncate">{item.location.placeName || 'Pinned'}</span>
                      </span>
                    )}
                  </div>

                  {item.theme ? (
                    <span className="truncate max-w-[100px] text-amber-400/90 font-medium shrink-0">
                      {item.theme}
                    </span>
                  ) : item.summary ? (
                    <span className="flex items-center gap-0.5 text-amber-400/90 shrink-0">
                      <Sparkles className="w-2.5 h-2.5" />
                      Analyzed
                    </span>
                  ) : null}
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
