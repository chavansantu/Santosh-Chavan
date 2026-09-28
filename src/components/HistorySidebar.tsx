import { useState, useMemo } from 'react';
import { 
  Search, 
  Calendar, 
  CalendarDays,
  Plus, 
  BookText, 
  Sparkles, 
  ChevronRight, 
  MapPin, 
  Smile, 
  X, 
  Filter,
  Check,
  RotateCcw
} from 'lucide-react';
import { JournalEntry } from '../types';

interface HistorySidebarProps {
  entries: JournalEntry[];
  activeEntryId: string | null;
  onSelectEntry: (entry: JournalEntry) => void;
  onNewEntry: () => void;
  onOpenCalendar?: () => void;
}

// Canonical mood definitions with representative emojis
const CANONICAL_MOODS: Array<{ id: string; label: string; emoji: string }> = [
  { id: 'Happy', label: 'Happy', emoji: '😊' },
  { id: 'Reflective', label: 'Reflective', emoji: '🧘' },
  { id: 'Stressed', label: 'Stressed', emoji: '🌪️' },
  { id: 'Grateful', label: 'Grateful', emoji: '✨' },
  { id: 'Energized', label: 'Energized', emoji: '⚡' },
  { id: 'Calm', label: 'Calm', emoji: '🌊' },
  { id: 'Challenged', label: 'Challenged', emoji: '🌱' },
];

export function getMoodEmoji(mood?: string): string {
  if (!mood) return '🧘';
  const m = mood.toLowerCase().trim();
  switch (m) {
    case 'happy':
    case 'joyful':
    case 'excited':
      return '😊';
    case 'stressed':
    case 'anxious':
    case 'overwhelmed':
      return '🌪️';
    case 'grateful':
    case 'thankful':
      return '✨';
    case 'energized':
    case 'motivated':
      return '⚡';
    case 'challenged':
    case 'growing':
      return '🌱';
    case 'calm':
    case 'peaceful':
    case 'relaxed':
      return '🌊';
    case 'reflective':
    case 'contemplative':
    default:
      return '🧘';
  }
}

export function HistorySidebar({
  entries,
  activeEntryId,
  onSelectEntry,
  onNewEntry,
  onOpenCalendar,
}: HistorySidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMoods, setSelectedMoods] = useState<string[]>([]);

  // Dynamically compute mood counts and build available mood filter options
  const moodFilterOptions = useMemo(() => {
    const countsMap = new Map<string, number>();
    entries.forEach((e) => {
      const m = (e.mood || 'Reflective').trim();
      const lower = m.toLowerCase();
      countsMap.set(lower, (countsMap.get(lower) || 0) + 1);
    });

    // Start with canonical moods
    const options = CANONICAL_MOODS.map((item) => ({
      ...item,
      count: countsMap.get(item.id.toLowerCase()) || 0,
    }));

    // Find any extra moods stored in entries that are not in CANONICAL_MOODS
    const canonicalIds = new Set(CANONICAL_MOODS.map((m) => m.id.toLowerCase()));
    entries.forEach((e) => {
      if (e.mood) {
        const lower = e.mood.toLowerCase().trim();
        if (!canonicalIds.has(lower)) {
          canonicalIds.add(lower);
          options.push({
            id: e.mood.trim(),
            label: e.mood.trim(),
            emoji: getMoodEmoji(e.mood),
            count: countsMap.get(lower) || 0,
          });
        }
      }
    });

    return options;
  }, [entries]);

  // Toggle or untoggle a specific mood in the filter selection
  const handleToggleMood = (moodId: string) => {
    setSelectedMoods((prev) => {
      const exists = prev.some((m) => m.toLowerCase() === moodId.toLowerCase());
      if (exists) {
        return prev.filter((m) => m.toLowerCase() !== moodId.toLowerCase());
      } else {
        return [...prev, moodId];
      }
    });
  };

  // Clear all mood filters (reverts to showing all)
  const handleClearMoods = () => {
    setSelectedMoods([]);
  };

  // Filter entries based on both active mood filters and search term
  const filteredEntries = useMemo(() => {
    return entries.filter((item) => {
      // 1. Mood filter check
      if (selectedMoods.length > 0) {
        const itemMood = (item.mood || 'Reflective').toLowerCase();
        const matchesMood = selectedMoods.some((sm) => sm.toLowerCase() === itemMood);
        if (!matchesMood) return false;
      }

      // 2. Search query check
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const titleMatch = item.title && item.title.toLowerCase().includes(q);
        const contentMatch = item.content && item.content.toLowerCase().includes(q);
        const themeMatch = item.theme && item.theme.toLowerCase().includes(q);
        const moodMatch = item.mood && item.mood.toLowerCase().includes(q);
        const tagsMatch = item.tags && item.tags.some((t) => t.toLowerCase().includes(q));
        const summaryMatch = item.summary && item.summary.toLowerCase().includes(q);
        return Boolean(titleMatch || contentMatch || themeMatch || moodMatch || tagsMatch || summaryMatch);
      }

      return true;
    });
  }, [entries, selectedMoods, searchQuery]);

  return (
    <div className="flex flex-col h-full bg-stone-900 border border-stone-800 rounded-2xl p-4 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <BookText className="w-4 h-4 text-amber-400" />
          <h2 className="text-sm font-semibold text-stone-100">Journal History</h2>
          <span 
            id="sidebar-entries-count"
            className="text-xs font-mono px-1.5 py-0.5 rounded bg-stone-800 text-stone-400"
            title="Total journal entries in private vault"
          >
            {entries.length}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {onOpenCalendar && (
            <button
              id="sidebar-calendar-view-btn"
              onClick={onOpenCalendar}
              className="p-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-amber-400 transition-colors cursor-pointer"
              title="Open Monthly Calendar View"
            >
              <CalendarDays className="w-4 h-4" />
            </button>
          )}

          <button
            id="sidebar-new-entry-btn"
            onClick={onNewEntry}
            className="p-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-amber-400 transition-colors cursor-pointer"
            title="Create New Reflection"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative mb-2.5">
        <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          id="history-search-input"
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search reflections, themes, or tags..."
          className="w-full bg-stone-950/70 border border-stone-800 rounded-xl pl-8 pr-8 py-1.5 text-xs text-stone-100 placeholder-stone-400 focus:outline-none focus:border-amber-500/40 transition-colors"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-200 cursor-pointer"
            title="Clear search text"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Mood-Based Filtering System Section */}
      <div className="mb-3 pt-1 border-t border-stone-800/60">
        <div className="flex items-center justify-between gap-1 text-[11px] text-stone-400 mb-1.5 px-0.5">
          <span className="flex items-center gap-1 font-medium text-stone-300">
            <Smile className="w-3 h-3 text-amber-400" />
            <span>Filter by Mood</span>
          </span>
          {selectedMoods.length > 0 && (
            <button
              id="mood-filter-clear-btn"
              onClick={handleClearMoods}
              className="inline-flex items-center gap-1 text-[10px] text-amber-400 hover:text-amber-300 transition-colors cursor-pointer font-medium"
              title="Reset all mood filters"
            >
              <RotateCcw className="w-2.5 h-2.5" />
              <span>Reset ({selectedMoods.length})</span>
            </button>
          )}
        </div>

        {/* Mood Toggle Buttons Row */}
        <div 
          id="mood-filter-toggle-container"
          className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-0.5 scrollbar-thin scrollbar-thumb-stone-800"
        >
          {/* 'All' Mood Toggle Button */}
          <button
            id="mood-filter-all"
            type="button"
            onClick={handleClearMoods}
            aria-pressed={selectedMoods.length === 0}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] shrink-0 transition-all cursor-pointer border ${
              selectedMoods.length === 0
                ? 'bg-amber-400 text-stone-950 font-semibold border-amber-400 shadow-xs'
                : 'bg-stone-950/60 text-stone-400 hover:text-stone-200 hover:bg-stone-800/60 border-stone-800'
            }`}
          >
            <span>All</span>
            <span className={`text-[10px] px-1 py-0.2 rounded-full ${
              selectedMoods.length === 0 ? 'bg-amber-500 text-stone-950 font-bold' : 'bg-stone-800 text-stone-400'
            }`}>
              {entries.length}
            </span>
          </button>

          {/* Individual Mood Toggles */}
          {moodFilterOptions.map((item) => {
            const isSelected = selectedMoods.some((m) => m.toLowerCase() === item.id.toLowerCase());
            return (
              <button
                key={item.id}
                id={`mood-filter-${item.id.toLowerCase()}`}
                type="button"
                onClick={() => handleToggleMood(item.id)}
                aria-pressed={isSelected}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] shrink-0 transition-all cursor-pointer border ${
                  isSelected
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 font-medium ring-1 ring-amber-500/30 shadow-xs'
                    : 'bg-stone-950/60 text-stone-400 hover:text-stone-200 hover:bg-stone-800/60 border-stone-800/80 hover:border-stone-700'
                }`}
                title={`Toggle filter for ${item.label} (${item.count} entries)`}
              >
                <span>{item.emoji}</span>
                <span>{item.label}</span>
                <span className={`text-[10px] px-1 py-0.2 rounded-full ${
                  isSelected 
                    ? 'bg-amber-500/40 text-amber-200 font-bold' 
                    : item.count > 0 
                      ? 'bg-stone-800 text-stone-300' 
                      : 'bg-stone-800/40 text-stone-500'
                }`}>
                  {item.count}
                </span>
                {isSelected && (
                  <Check className="w-2.5 h-2.5 text-amber-400 shrink-0 ml-0.5" />
                )}
              </button>
            );
          })}
        </div>

        {/* Active Mood Filters Indicator Banner */}
        {selectedMoods.length > 0 && (
          <div className="mt-1.5 flex items-center justify-between text-[10px] bg-amber-500/10 border border-amber-500/20 rounded-lg px-2 py-1 text-amber-300">
            <span className="truncate">
              Filtered by: <strong>{selectedMoods.join(', ')}</strong> ({filteredEntries.length} {filteredEntries.length === 1 ? 'entry' : 'entries'})
            </span>
            <button
              onClick={handleClearMoods}
              className="text-amber-400 hover:text-amber-200 ml-1 shrink-0 p-0.5 cursor-pointer"
              title="Remove filter"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {/* Entries List */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {filteredEntries.length === 0 ? (
          <div className="h-48 flex flex-col items-center justify-center text-center p-4 text-stone-400 text-xs">
            <BookText className="w-8 h-8 text-stone-700 mb-2" />
            <p className="font-medium text-stone-300">No reflections found</p>
            {selectedMoods.length > 0 ? (
              <div className="mt-1 text-center">
                <p className="text-stone-400 text-[11px]">
                  No entries match mood: <span className="text-amber-300">{selectedMoods.join(', ')}</span>
                </p>
                <button
                  id="reset-mood-filter-empty-state-btn"
                  onClick={handleClearMoods}
                  className="mt-2.5 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Show All Moods</span>
                </button>
              </div>
            ) : searchQuery ? (
              <div className="mt-1 text-center">
                <p className="text-stone-400 text-[11px]">
                  No entries match "<span className="text-stone-200">{searchQuery}</span>"
                </p>
                <button
                  onClick={() => setSearchQuery('')}
                  className="mt-2.5 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs bg-stone-800 hover:bg-stone-700 text-stone-300 border border-stone-700 transition-colors cursor-pointer"
                >
                  <X className="w-3 h-3" />
                  <span>Clear Search</span>
                </button>
              </div>
            ) : (
              <p className="text-stone-400 mt-1">Create your first journal entry above</p>
            )}
          </div>
        ) : (
          filteredEntries.map((item) => {
            const isSelected = activeEntryId === item.id;
            return (
              <button
                key={item.id}
                id={`sidebar-entry-${item.id}`}
                onClick={() => onSelectEntry(item)}
                className={`w-full text-left p-3 rounded-xl transition-all border cursor-pointer ${
                  isSelected
                    ? 'bg-amber-500/10 border-amber-500/40 text-stone-100 shadow-sm'
                    : 'bg-stone-950/40 border-stone-800/80 hover:bg-stone-800/60 hover:border-stone-700 text-stone-300'
                }`}
              >
                <div className="flex items-start justify-between gap-1.5 mb-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-xs" title={`Mood: ${item.mood || 'Reflective'}`}>
                      {getMoodEmoji(item.mood)}
                    </span>
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
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-stone-400" />
                      {new Date(item.createdAt).toLocaleDateString([], {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                    {item.mood && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full bg-stone-800/80 text-stone-300 border border-stone-700/50 text-[9px] font-medium">
                        {item.mood}
                      </span>
                    )}
                    {item.location && (
                      <span className="inline-flex items-center gap-0.5 text-amber-400/90 truncate max-w-[80px]" title={item.location.placeName || item.location.formattedAddress}>
                        <MapPin className="w-2.5 h-2.5 shrink-0" />
                        <span className="truncate">{item.location.placeName || 'Pinned'}</span>
                      </span>
                    )}
                  </div>

                  {item.theme ? (
                    <span className="truncate max-w-[90px] text-amber-400/90 font-medium shrink-0">
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
