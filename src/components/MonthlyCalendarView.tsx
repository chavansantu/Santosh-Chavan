import { useState, useMemo } from 'react';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Sparkles, 
  MapPin, 
  Clock, 
  Plus, 
  ArrowRight, 
  RotateCcw,
  Smile,
  BookText,
  CalendarDays,
  Flame,
  Check,
  Tag
} from 'lucide-react';
import { JournalEntry } from '../types';
import { getMoodEmoji } from './HistorySidebar';

interface MonthlyCalendarViewProps {
  entries: JournalEntry[];
  activeEntryId: string | null;
  onSelectEntry: (entry: JournalEntry) => void;
  onNewEntry: (targetDate?: Date) => void;
  onBackToJournal: () => void;
}

// Canonical mood filter buttons
const CALENDAR_MOODS = [
  { id: 'Happy', label: 'Happy', emoji: '😊' },
  { id: 'Reflective', label: 'Reflective', emoji: '🧘' },
  { id: 'Stressed', label: 'Stressed', emoji: '🌪️' },
  { id: 'Grateful', label: 'Grateful', emoji: '✨' },
  { id: 'Energized', label: 'Energized', emoji: '⚡' },
  { id: 'Calm', label: 'Calm', emoji: '🌊' },
  { id: 'Challenged', label: 'Challenged', emoji: '🌱' },
];

const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Helper to format Date to 'YYYY-MM-DD' key for consistent dictionary indexing
function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function MonthlyCalendarView({
  entries,
  activeEntryId,
  onSelectEntry,
  onNewEntry,
  onBackToJournal,
}: MonthlyCalendarViewProps) {
  // Current month state (defaults to current date)
  const today = useMemo(() => new Date(), []);
  const [currentDate, setCurrentDate] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDateKey, setSelectedDateKey] = useState<string>(() => toDateKey(today));
  const [selectedMoodFilter, setSelectedMoodFilter] = useState<string | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Navigation handlers
  const handlePrevMonth = () => {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleJumpToToday = () => {
    const now = new Date();
    setCurrentDate(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedDateKey(toDateKey(now));
  };

  // Group entries by date key 'YYYY-MM-DD'
  const entriesByDate = useMemo(() => {
    const map = new Map<string, JournalEntry[]>();
    for (const entry of entries) {
      if (!entry.createdAt) continue;
      const d = new Date(entry.createdAt);
      if (isNaN(d.getTime())) continue;
      const key = toDateKey(d);
      const existing = map.get(key) || [];
      existing.push(entry);
      map.set(key, existing);
    }
    // Sort entries on each day chronologically descending (newest first)
    map.forEach((list) => {
      list.sort((a, b) => b.createdAt - a.createdAt);
    });
    return map;
  }, [entries]);

  // Compute calendar days grid (including padding for leading and trailing days)
  const calendarGrid = useMemo(() => {
    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Sun, 6 = Sat
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const days: Array<{
      date: Date;
      dateKey: string;
      isCurrentMonth: boolean;
      isToday: boolean;
      dayNumber: number;
    }> = [];

    const todayKey = toDateKey(today);

    // 1. Leading days from previous month
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const prevDate = new Date(year, month - 1, daysInPrevMonth - i);
      const key = toDateKey(prevDate);
      days.push({
        date: prevDate,
        dateKey: key,
        isCurrentMonth: false,
        isToday: key === todayKey,
        dayNumber: daysInPrevMonth - i,
      });
    }

    // 2. Days of current month
    for (let day = 1; day <= daysInMonth; day++) {
      const thisDate = new Date(year, month, day);
      const key = toDateKey(thisDate);
      days.push({
        date: thisDate,
        dateKey: key,
        isCurrentMonth: true,
        isToday: key === todayKey,
        dayNumber: day,
      });
    }

    // 3. Trailing days from next month to complete standard 35 or 42 grid
    const totalCells = days.length > 35 ? 42 : 35;
    const remaining = totalCells - days.length;
    for (let nextDay = 1; nextDay <= remaining; nextDay++) {
      const nextDate = new Date(year, month + 1, nextDay);
      const key = toDateKey(nextDate);
      days.push({
        date: nextDate,
        dateKey: key,
        isCurrentMonth: false,
        isToday: key === todayKey,
        dayNumber: nextDay,
      });
    }

    return days;
  }, [year, month, today]);

  // Month-level statistics
  const monthStats = useMemo(() => {
    let totalMonthEntries = 0;
    const activeDaysSet = new Set<string>();
    const moodCounts: Record<string, number> = {};

    entries.forEach((e) => {
      const d = new Date(e.createdAt);
      if (d.getFullYear() === year && d.getMonth() === month) {
        totalMonthEntries++;
        activeDaysSet.add(toDateKey(d));
        const m = (e.mood || 'Reflective').trim();
        moodCounts[m] = (moodCounts[m] || 0) + 1;
      }
    });

    let dominantMood = 'Reflective';
    let maxCount = 0;
    for (const [m, count] of Object.entries(moodCounts)) {
      if (count > maxCount) {
        maxCount = count;
        dominantMood = m;
      }
    }

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const consistencyRate = Math.round((activeDaysSet.size / daysInMonth) * 100);

    return {
      totalMonthEntries,
      activeDaysCount: activeDaysSet.size,
      dominantMood: maxCount > 0 ? dominantMood : 'None',
      dominantMoodEmoji: maxCount > 0 ? getMoodEmoji(dominantMood) : '🌱',
      consistencyRate,
    };
  }, [entries, year, month]);

  // Selected day entries (optionally filtered by selected mood)
  const selectedDayEntries = useMemo(() => {
    const list = entriesByDate.get(selectedDateKey) || [];
    if (!selectedMoodFilter) return list;
    return list.filter((e) => (e.mood || 'Reflective').toLowerCase() === selectedMoodFilter.toLowerCase());
  }, [entriesByDate, selectedDateKey, selectedMoodFilter]);

  // Parsed selected date object for friendly display
  const selectedDateObj = useMemo(() => {
    const [y, m, d] = selectedDateKey.split('-').map(Number);
    return new Date(y, m - 1, d);
  }, [selectedDateKey]);

  const formattedMonthTitle = currentDate.toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="flex-1 flex flex-col gap-4 animate-in fade-in duration-200">
      {/* Top Header Card */}
      <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 sm:p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Title & Month Navigation */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <CalendarDays className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="calendar-month-heading" className="text-lg font-bold text-stone-100">
                  {formattedMonthTitle}
                </h2>
                <span className="text-xs px-2 py-0.5 rounded-full bg-stone-800 text-stone-300 font-mono">
                  {monthStats.totalMonthEntries} {monthStats.totalMonthEntries === 1 ? 'reflection' : 'reflections'}
                </span>
              </div>
              <p className="text-xs text-stone-400">
                Explore reflections mapped across days, track mood rhythms, and jump to specific dates
              </p>
            </div>
          </div>

          {/* Month Navigation Controls */}
          <div className="flex items-center gap-2">
            <button
              id="calendar-today-btn"
              onClick={handleJumpToToday}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 transition-colors cursor-pointer"
              title="Jump to Current Date"
            >
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>Today</span>
            </button>

            <div className="flex items-center bg-stone-950 border border-stone-800 rounded-xl p-0.5">
              <button
                id="calendar-prev-month-btn"
                onClick={handlePrevMonth}
                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-100 hover:bg-stone-800 transition-colors cursor-pointer"
                title="Previous Month"
                aria-label="Previous Month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                id="calendar-next-month-btn"
                onClick={handleNextMonth}
                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-100 hover:bg-stone-800 transition-colors cursor-pointer"
                title="Next Month"
                aria-label="Next Month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <button
              id="calendar-back-to-editor-btn"
              onClick={onBackToJournal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500 hover:bg-amber-400 text-stone-950 transition-colors cursor-pointer shadow-xs ml-1"
            >
              <BookText className="w-3.5 h-3.5" />
              <span>Journal Editor</span>
            </button>
          </div>
        </div>

        {/* Monthly Summary Statistics Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-4 pt-4 border-t border-stone-800/80 text-xs">
          <div className="p-2.5 rounded-xl bg-stone-950/60 border border-stone-800/70 flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
              <BookText className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] text-stone-400 font-medium uppercase tracking-wider">Entries This Month</p>
              <p className="text-sm font-bold text-stone-100">{monthStats.totalMonthEntries}</p>
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-stone-950/60 border border-stone-800/70 flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
              <CalendarIcon className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] text-stone-400 font-medium uppercase tracking-wider">Active Days</p>
              <p className="text-sm font-bold text-stone-100">{monthStats.activeDaysCount} days</p>
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-stone-950/60 border border-stone-800/70 flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0">
              <Flame className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] text-stone-400 font-medium uppercase tracking-wider">Month Consistency</p>
              <p className="text-sm font-bold text-stone-100">{monthStats.consistencyRate}%</p>
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-stone-950/60 border border-stone-800/70 flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center text-sm shrink-0">
              {monthStats.dominantMoodEmoji}
            </div>
            <div>
              <p className="text-[10px] text-stone-400 font-medium uppercase tracking-wider">Dominant Mood</p>
              <p className="text-sm font-bold text-stone-100">{monthStats.dominantMood}</p>
            </div>
          </div>
        </div>

        {/* Mood Filter Chips */}
        <div className="mt-3 pt-3 border-t border-stone-800/60 flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <span className="text-[11px] text-stone-400 shrink-0 flex items-center gap-1 mr-1">
            <Smile className="w-3 h-3 text-amber-400" />
            <span>Highlight Mood:</span>
          </span>

          <button
            id="calendar-mood-filter-all"
            type="button"
            onClick={() => setSelectedMoodFilter(null)}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] shrink-0 transition-all cursor-pointer border ${
              selectedMoodFilter === null
                ? 'bg-amber-400 text-stone-950 font-bold border-amber-400'
                : 'bg-stone-950/70 text-stone-400 hover:text-stone-200 border-stone-800'
            }`}
          >
            <span>All Moods</span>
          </button>

          {CALENDAR_MOODS.map((m) => {
            const isSelected = selectedMoodFilter?.toLowerCase() === m.id.toLowerCase();
            return (
              <button
                key={m.id}
                id={`calendar-mood-filter-${m.id.toLowerCase()}`}
                type="button"
                onClick={() => setSelectedMoodFilter(isSelected ? null : m.id)}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] shrink-0 transition-all cursor-pointer border ${
                  isSelected
                    ? 'bg-amber-500/25 text-amber-300 border-amber-500/60 font-semibold ring-1 ring-amber-500/40'
                    : 'bg-stone-950/70 text-stone-400 hover:text-stone-200 border-stone-800'
                }`}
              >
                <span>{m.emoji}</span>
                <span>{m.label}</span>
                {isSelected && <Check className="w-2.5 h-2.5 text-amber-400 ml-0.5" />}
              </button>
            );
          })}

          {selectedMoodFilter && (
            <button
              onClick={() => setSelectedMoodFilter(null)}
              className="text-[10px] text-stone-400 hover:text-amber-400 underline ml-2 shrink-0 cursor-pointer"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Main Calendar & Day Detail Bento Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1 items-start">
        {/* Left Column: 7-Column Calendar Grid (8 cols on desktop) */}
        <div className="lg:col-span-8 bg-stone-900 border border-stone-800 rounded-2xl p-4 sm:p-5 shadow-sm">
          {/* Weekday Names Header */}
          <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2 text-center text-xs font-semibold text-stone-400">
            {WEEKDAY_NAMES.map((name, idx) => (
              <div
                key={name}
                className={`py-1.5 uppercase tracking-wider text-[11px] ${
                  idx === 0 || idx === 6 ? 'text-stone-400' : 'text-stone-300'
                }`}
              >
                {name}
              </div>
            ))}
          </div>

          {/* Month Day Cells */}
          <div className="grid grid-cols-7 gap-1 sm:gap-2">
            {calendarGrid.map((cell) => {
              const dayEntries = entriesByDate.get(cell.dateKey) || [];
              const hasEntries = dayEntries.length > 0;
              const isSelected = selectedDateKey === cell.dateKey;

              // Check if any entries on this day match the mood filter
              const matchesMoodFilter = selectedMoodFilter
                ? dayEntries.some((e) => (e.mood || 'Reflective').toLowerCase() === selectedMoodFilter.toLowerCase())
                : true;

              const isDimmed = !cell.isCurrentMonth;

              return (
                <button
                  key={cell.dateKey}
                  id={`calendar-cell-${cell.dateKey}`}
                  type="button"
                  onClick={() => setSelectedDateKey(cell.dateKey)}
                  className={`min-h-[78px] sm:min-h-[96px] p-1.5 sm:p-2 rounded-xl text-left flex flex-col justify-between transition-all cursor-pointer relative group border ${
                    isSelected
                      ? 'bg-amber-500/15 border-amber-500/60 ring-2 ring-amber-500/40 text-stone-100 shadow-md'
                      : cell.isToday
                      ? 'bg-stone-950/80 border-amber-500/40 hover:bg-stone-800/70 hover:border-amber-500/50'
                      : hasEntries
                      ? 'bg-stone-950/60 border-stone-800 hover:bg-stone-800/60 hover:border-stone-700'
                      : 'bg-stone-950/30 border-stone-800/40 hover:bg-stone-800/30 hover:border-stone-700/60'
                  } ${isDimmed ? 'opacity-40 hover:opacity-75' : 'opacity-100'} ${
                    selectedMoodFilter && !matchesMoodFilter ? 'opacity-30' : ''
                  }`}
                >
                  {/* Top Day Number Row */}
                  <div className="flex items-center justify-between w-full">
                    <span
                      className={`text-xs font-mono font-medium rounded-full w-5 h-5 flex items-center justify-center ${
                        cell.isToday
                          ? 'bg-amber-500 text-stone-950 font-bold'
                          : isSelected
                          ? 'text-amber-300 font-bold'
                          : isDimmed
                          ? 'text-stone-400'
                          : 'text-stone-300'
                      }`}
                    >
                      {cell.dayNumber}
                    </span>

                    {/* Entry Count Pill */}
                    {hasEntries && (
                      <span
                        className={`text-[9px] font-mono px-1.5 py-0.2 rounded-full font-bold ${
                          isSelected
                            ? 'bg-amber-500 text-stone-950'
                            : 'bg-stone-800 text-stone-300 border border-stone-700/60'
                        }`}
                        title={`${dayEntries.length} reflection${dayEntries.length > 1 ? 's' : ''}`}
                      >
                        {dayEntries.length}
                      </span>
                    )}
                  </div>

                  {/* Middle / Bottom: Mood & Entry Previews */}
                  <div className="mt-1 w-full space-y-1">
                    {hasEntries ? (
                      <>
                        {/* Mood Emoji Badges */}
                        <div className="flex items-center gap-1 flex-wrap">
                          {dayEntries.slice(0, 3).map((e, idx) => (
                            <span
                              key={e.id || idx}
                              className="text-xs transition-transform group-hover:scale-110"
                              title={`${e.mood || 'Reflective'}: ${e.title}`}
                            >
                              {getMoodEmoji(e.mood)}
                            </span>
                          ))}
                          {dayEntries.length > 3 && (
                            <span className="text-[9px] text-stone-400 font-mono">
                              +{dayEntries.length - 3}
                            </span>
                          )}
                        </div>

                        {/* First Entry Snippet (visible on larger screens) */}
                        <p className="text-[10px] text-stone-400 truncate hidden sm:block font-medium">
                          {dayEntries[0]?.title || 'Untitled'}
                        </p>
                      </>
                    ) : (
                      <div className="h-4" />
                    )}
                  </div>

                  {/* Location indicator dot */}
                  {dayEntries.some((e) => Boolean(e.location)) && (
                    <div 
                      className="absolute bottom-1 right-1 text-amber-400/80" 
                      title="Geographic coordinates pinned"
                    >
                      <MapPin className="w-2.5 h-2.5" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Column: Selected Day Inspector & Reflection Cards (4 cols on desktop) */}
        <div className="lg:col-span-4 bg-stone-900 border border-stone-800 rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col min-h-[460px]">
          {/* Day Inspector Header */}
          <div className="flex items-start justify-between gap-2 pb-3 border-b border-stone-800">
            <div>
              <div className="flex items-center gap-1.5 text-xs text-stone-400 mb-0.5">
                <CalendarIcon className="w-3.5 h-3.5 text-amber-400" />
                <span>Selected Date</span>
              </div>
              <h3 id="selected-day-heading" className="text-sm sm:text-base font-semibold text-stone-100">
                {selectedDateObj.toLocaleDateString(undefined, {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </h3>
            </div>

            <button
              id="day-inspector-new-entry-btn"
              onClick={() => onNewEntry(selectedDateObj)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-amber-500 hover:bg-amber-400 text-stone-950 transition-colors cursor-pointer shadow-xs shrink-0"
              title="Write a new reflection for this date"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Reflection</span>
            </button>
          </div>

          {/* Reflections List for Selected Day */}
          <div className="flex-1 overflow-y-auto mt-3 space-y-3 pr-0.5">
            {selectedDayEntries.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-center p-4 text-stone-400">
                <BookText className="w-10 h-10 text-stone-700 mb-3" />
                <p className="text-sm font-medium text-stone-300">No reflections on this day</p>
                <p className="text-xs text-stone-400 mt-1 max-w-[240px]">
                  Take a quiet moment to record your thoughts, mood, and insights for {selectedDateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}.
                </p>
                <button
                  id="write-reflection-empty-date-btn"
                  onClick={() => onNewEntry(selectedDateObj)}
                  className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-stone-950 transition-all cursor-pointer shadow-xs active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Write Reflection</span>
                </button>
              </div>
            ) : (
              selectedDayEntries.map((entry) => {
                const isActive = activeEntryId === entry.id;
                const entryTime = new Date(entry.createdAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                });

                return (
                  <div
                    key={entry.id}
                    id={`day-entry-card-${entry.id}`}
                    className={`p-3.5 rounded-xl border transition-all ${
                      isActive
                        ? 'bg-amber-500/10 border-amber-500/50 ring-1 ring-amber-500/30 text-stone-100'
                        : 'bg-stone-950/70 border-stone-800 hover:border-stone-700 text-stone-200'
                    }`}
                  >
                    {/* Entry Header: Mood & Time */}
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm" title={`Mood: ${entry.mood || 'Reflective'}`}>
                          {getMoodEmoji(entry.mood)}
                        </span>
                        <h4 className="text-xs font-bold text-stone-100 truncate max-w-[170px]">
                          {entry.title || 'Untitled Reflection'}
                        </h4>
                      </div>
                      <span className="text-[10px] text-stone-400 font-mono flex items-center gap-1 shrink-0">
                        <Clock className="w-2.5 h-2.5" />
                        {entryTime}
                      </span>
                    </div>

                    {/* Entry Snippet or Summary */}
                    <p className="text-[11px] text-stone-400 line-clamp-3 leading-relaxed mb-2.5">
                      {entry.summary || entry.content || 'No text recorded in this reflection.'}
                    </p>

                    {/* Badges: Mood, Theme, Location */}
                    <div className="flex items-center gap-1.5 flex-wrap text-[10px] mb-3">
                      {entry.mood && (
                        <span className="px-2 py-0.5 rounded-full bg-stone-800 text-stone-300 font-medium">
                          {entry.mood}
                        </span>
                      )}
                      {entry.theme && (
                        <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20 font-medium">
                          {entry.theme}
                        </span>
                      )}
                      {entry.location && (
                        <span 
                          className="px-2 py-0.5 rounded-full bg-stone-800/80 text-stone-400 flex items-center gap-1 truncate max-w-[150px]"
                          title={entry.location.placeName || entry.location.formattedAddress}
                        >
                          <MapPin className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                          <span className="truncate">{entry.location.placeName || 'Pinned'}</span>
                        </span>
                      )}
                    </div>

                    {/* Navigate / Open in Editor Button */}
                    <button
                      id={`open-entry-editor-btn-${entry.id}`}
                      onClick={() => onSelectEntry(entry)}
                      className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-stone-800 hover:bg-amber-500 hover:text-stone-950 text-stone-200 transition-all cursor-pointer shadow-xs active:scale-98"
                    >
                      <span>Open in Journal Editor</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
