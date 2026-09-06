import { useState, useEffect } from 'react';
import { 
  Save, 
  Sparkles, 
  Clock, 
  Tag, 
  Smile, 
  Check, 
  Loader2, 
  BookOpen, 
  Trash2,
  FileText,
  Lightbulb,
  CheckCircle2,
  MapPin,
  Navigation,
  Search,
  X,
  Globe
} from 'lucide-react';
import { JournalEntry, SaveErrorState, EntryLocation } from '../types';
import { saveJournalEntry } from '../lib/firestoreService';

interface JournalEditorProps {
  userId: string;
  entry: JournalEntry | null;
  onSaveSuccess: (entry: JournalEntry) => void;
  onDeleteEntry: (id: string) => void;
  onError: (err: SaveErrorState) => void;
}

const MOODS = [
  { id: 'Reflective', label: 'Reflective', emoji: '🧘' },
  { id: 'Grateful', label: 'Grateful', emoji: '✨' },
  { id: 'Energized', label: 'Energized', emoji: '⚡' },
  { id: 'Challenged', label: 'Challenged', emoji: '🌱' },
  { id: 'Calm', label: 'Calm', emoji: '🌊' },
];

export function JournalEditor({
  userId,
  entry,
  onSaveSuccess,
  onDeleteEntry,
  onError,
}: JournalEditorProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [mood, setMood] = useState('Reflective');
  const [location, setLocation] = useState<EntryLocation | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [showLocationInput, setShowLocationInput] = useState(false);
  const [placeSearchText, setPlaceSearchText] = useState('');
  const [isSearchingPlace, setIsSearchingPlace] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [saveSuccessNotice, setSaveSuccessNotice] = useState(false);

  // Sync state when active entry changes
  useEffect(() => {
    if (entry) {
      setTitle(entry.title || '');
      setContent(entry.content || '');
      setMood(entry.mood || 'Reflective');
      setLocation(entry.location || null);
    } else {
      setTitle('');
      setContent('');
      setMood('Reflective');
      setLocation(null);
    }
    setShowLocationInput(false);
    setPlaceSearchText('');
  }, [entry?.id]);

  // Handler: Pin current GPS location
  const handlePinCurrentLocation = () => {
    if (!navigator.geolocation) {
      onError({
        hasError: true,
        message: 'Geolocation is not supported by your current browser.',
      });
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;

        try {
          // Query server-side reverse geocoding proxy
          const res = await fetch(`/api/geocode?lat=${lat}&lng=${lng}`);
          if (res.ok) {
            const data = await res.json();
            setLocation({
              latitude: data.latitude,
              longitude: data.longitude,
              placeName: data.placeName || `${lat.toFixed(3)}°, ${lng.toFixed(3)}°`,
              formattedAddress: data.formattedAddress,
            });
          } else {
            // Coordinate boundary fallback
            setLocation({
              latitude: lat,
              longitude: lng,
              placeName: `Coordinates (${lat.toFixed(3)}°, ${lng.toFixed(3)}°)`,
            });
          }
        } catch (err: any) {
          console.warn('Reverse geocode lookup error:', err);
          setLocation({
            latitude: lat,
            longitude: lng,
            placeName: `Pinned (${lat.toFixed(3)}°, ${lng.toFixed(3)}°)`,
          });
        } finally {
          setIsLocating(false);
        }
      },
      (error) => {
        setIsLocating(false);
        console.warn('Geolocation error:', error);
        onError({
          hasError: true,
          message: `Location access issue (${error.message}). You can also search by city or landmark name.`,
        });
      },
      { timeout: 8000, enableHighAccuracy: false }
    );
  };

  // Handler: Search place / city by name
  const handleSearchPlace = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!placeSearchText.trim()) return;

    setIsSearchingPlace(true);
    try {
      const res = await fetch(`/api/geocode?address=${encodeURIComponent(placeSearchText.trim())}`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Location could not be resolved.');
      }
      const data = await res.json();
      setLocation({
        latitude: data.latitude,
        longitude: data.longitude,
        placeName: data.placeName || placeSearchText.trim(),
        formattedAddress: data.formattedAddress,
      });
      setShowLocationInput(false);
      setPlaceSearchText('');
    } catch (err: any) {
      onError({
        hasError: true,
        message: `Place lookup failed: ${err.message}`,
      });
    } finally {
      setIsSearchingPlace(false);
    }
  };

  const handleSave = async (extraData: Partial<JournalEntry> = {}) => {
    if (!content.trim() && !title.trim()) return;

    setIsSaving(true);
    setSaveSuccessNotice(false);

    const payloadToSave: Partial<JournalEntry> = {
      id: entry?.id,
      title: title.trim() || 'Untitled Reflection',
      content,
      mood,
      summary: extraData.summary !== undefined ? extraData.summary : entry?.summary,
      theme: extraData.theme !== undefined ? extraData.theme : entry?.theme,
      keyTakeaways: extraData.keyTakeaways !== undefined ? extraData.keyTakeaways : entry?.keyTakeaways,
      location: location || undefined,
      createdAt: entry?.createdAt,
    };

    try {
      const saved = await saveJournalEntry(userId, payloadToSave as any);
      onSaveSuccess(saved);
      setSaveSuccessNotice(true);
      setTimeout(() => setSaveSuccessNotice(false), 3000);
    } catch (err: any) {
      console.error('Save error:', err);
      onError({
        hasError: true,
        message: `Failed to persist reflection: ${err.message}. Your text is intact.`,
        failedPayload: payloadToSave,
        retryAction: async () => {
          await handleSave(extraData);
        },
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSummarizeWithGemini = async () => {
    if (!content.trim()) {
      onError({
        hasError: true,
        message: 'Please write some thoughts before generating Gemini insights.',
      });
      return;
    }

    setIsSummarizing(true);
    try {
      const res = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim() || 'Untitled Reflection',
          content,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Summary API returned ${res.status}`);
      }

      const analysis = await res.json();

      // Automatically persist updated entry with the new AI summary and takeaways
      await handleSave({
        summary: analysis.summary,
        theme: analysis.theme,
        keyTakeaways: analysis.keyTakeaways,
      });
    } catch (err: any) {
      console.error('Summary error:', err);
      onError({
        hasError: true,
        message: `Gemini Analysis failed: ${err.message}`,
        retryAction: async () => {
          await handleSummarizeWithGemini();
        },
      });
    } finally {
      setIsSummarizing(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-stone-900 border border-stone-800 rounded-2xl p-4 sm:p-6 shadow-sm overflow-y-auto">
      {/* Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-stone-800">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-semibold text-stone-100">
              {entry ? 'Edit Reflection' : 'New Journal Entry'}
            </h2>
            <div className="flex items-center gap-2 text-xs text-stone-400">
              <Clock className="w-3.5 h-3.5" />
              <span>
                {entry?.updatedAt
                  ? `Updated ${new Date(entry.updatedAt).toLocaleDateString()} at ${new Date(entry.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                  : 'Drafting in private vault'}
              </span>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {entry?.id && (
            <button
              id="delete-entry-btn"
              onClick={() => onDeleteEntry(entry.id)}
              className="p-2 rounded-xl text-stone-400 hover:text-rose-400 hover:bg-rose-950/40 border border-transparent hover:border-rose-900/60 transition-colors cursor-pointer"
              title="Delete this reflection"
            >
              <Trash2 className="w-4 h-4" />
              <span className="sr-only">Delete</span>
            </button>
          )}

          <button
            id="gemini-insights-btn"
            onClick={handleSummarizeWithGemini}
            disabled={isSummarizing || isSaving || !content.trim()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-medium bg-stone-800 hover:bg-stone-700 text-amber-300 border border-stone-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer shadow-sm"
          >
            {isSummarizing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                <span>Analyzing...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>AI Insights</span>
              </>
            )}
          </button>

          <button
            id="save-reflection-btn"
            onClick={() => handleSave()}
            disabled={isSaving || isSummarizing || (!content.trim() && !title.trim())}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-medium bg-amber-500 hover:bg-amber-400 text-stone-950 disabled:opacity-40 disabled:cursor-not-allowed transition-all transform active:scale-95 cursor-pointer shadow-sm font-semibold"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Saving...</span>
              </>
            ) : saveSuccessNotice ? (
              <>
                <Check className="w-4 h-4 text-emerald-950" />
                <span>Saved!</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Save Entry</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Title Input */}
      <div className="mt-4">
        <input
          id="entry-title-input"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title of this reflection (e.g., Morning Breakthrough, Mindful Reset...)"
          className="w-full bg-transparent text-lg sm:text-xl font-bold text-stone-100 placeholder-stone-400 focus:outline-none tracking-tight"
        />
      </div>

      {/* Mood Selector & Location Controls Row */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 pt-1">
        {/* Mood Selector Pills */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-stone-400 flex items-center gap-1 mr-1">
            <Smile className="w-3.5 h-3.5 text-stone-400" />
            Mood:
          </span>
          {MOODS.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMood(m.id)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs transition-colors cursor-pointer ${
                mood === m.id
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-medium'
                  : 'bg-stone-800/60 text-stone-400 hover:text-stone-200 border border-stone-800'
              }`}
            >
              <span>{m.emoji}</span>
              <span>{m.label}</span>
            </button>
          ))}
        </div>

        {/* Location Action Buttons */}
        <div className="flex items-center gap-2">
          {!location ? (
            <>
              <button
                type="button"
                id="pin-current-location-btn"
                onClick={handlePinCurrentLocation}
                disabled={isLocating}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-stone-300 hover:text-amber-300 bg-stone-800/80 hover:bg-stone-800 border border-stone-700/60 transition-colors cursor-pointer"
                title="Pin Current Geolocation"
              >
                {isLocating ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                ) : (
                  <Navigation className="w-3.5 h-3.5 text-amber-400" />
                )}
                <span>Pin GPS</span>
              </button>

              <button
                type="button"
                id="search-location-btn"
                onClick={() => setShowLocationInput(!showLocationInput)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-stone-400 hover:text-stone-200 bg-stone-800/60 hover:bg-stone-800 border border-stone-800 transition-colors cursor-pointer"
              >
                <Search className="w-3.5 h-3.5 text-stone-400" />
                <span>Place Search</span>
              </button>
            </>
          ) : (
            /* Pinned Location Chip */
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs bg-amber-500/10 border border-amber-500/30 text-amber-300">
              <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="font-medium max-w-[200px] truncate" title={location.formattedAddress || location.placeName}>
                {location.placeName || `${location.latitude.toFixed(2)}°, ${location.longitude.toFixed(2)}°`}
              </span>
              <button
                type="button"
                onClick={() => setLocation(null)}
                className="text-stone-400 hover:text-rose-400 transition-colors ml-1 cursor-pointer"
                title="Remove pinned location"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Place search popdown input */}
      {showLocationInput && !location && (
        <form onSubmit={handleSearchPlace} className="mt-2.5 flex items-center gap-2 bg-stone-950/70 p-2 rounded-xl border border-stone-800">
          <Globe className="w-4 h-4 text-amber-400 shrink-0 ml-1" />
          <input
            type="text"
            value={placeSearchText}
            onChange={(e) => setPlaceSearchText(e.target.value)}
            placeholder="Enter city, park, café, or landmark (e.g., Central Park, Tokyo, Paris)..."
            className="flex-1 bg-transparent text-xs sm:text-sm text-stone-200 placeholder-stone-400 focus:outline-none"
            autoFocus
          />
          <button
            type="submit"
            disabled={isSearchingPlace || !placeSearchText.trim()}
            className="px-2.5 py-1 rounded-lg text-xs font-medium bg-amber-500 hover:bg-amber-400 text-stone-950 disabled:opacity-40 cursor-pointer"
          >
            {isSearchingPlace ? 'Resolving...' : 'Pin Place'}
          </button>
          <button
            type="button"
            onClick={() => setShowLocationInput(false)}
            className="p-1 text-stone-400 hover:text-stone-200 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </form>
      )}

      {/* Main Journal Content Area */}
      <div className="mt-4 flex-1 min-h-[220px]">
        <textarea
          id="entry-content-textarea"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Pour your thoughts, questions, or today's reflections here. What is on your mind? What felt significant? You can converse directly with Gemini about this entry anytime..."
          className="w-full h-full min-h-[240px] bg-stone-950/50 border border-stone-800/80 rounded-xl p-4 text-sm sm:text-base text-stone-200 placeholder-stone-400 focus:outline-none focus:border-amber-500/40 focus:ring-1 focus:ring-amber-500/40 resize-y leading-relaxed font-sans"
        />
      </div>

      {/* AI Insights & Summary Display Box (If generated) */}
      {(entry?.summary || entry?.theme || (entry?.keyTakeaways && entry.keyTakeaways.length > 0)) && (
        <div className="mt-5 p-4 rounded-xl bg-stone-950/80 border border-amber-500/30 text-stone-200">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-300">
                Gemini AI Reflection Summary
              </h3>
            </div>
            {entry.theme && (
              <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                {entry.theme}
              </span>
            )}
          </div>

          {entry.summary && (
            <p className="text-xs sm:text-sm text-stone-300 leading-relaxed italic">
              "{entry.summary}"
            </p>
          )}

          {entry.keyTakeaways && entry.keyTakeaways.length > 0 && (
            <div className="mt-3 pt-3 border-t border-stone-800">
              <p className="text-[11px] font-semibold text-stone-400 mb-1.5">Key Insights & Takeaways:</p>
              <ul className="space-y-1">
                {entry.keyTakeaways.map((takeaway, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-xs text-stone-300">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{takeaway}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
