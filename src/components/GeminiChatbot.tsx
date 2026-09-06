import { useState, useRef, useEffect } from 'react';
import Markdown from 'react-markdown';
import {
  Sparkles,
  Send,
  Loader2,
  Bot,
  User as UserIcon,
  MapPin,
  Search,
  Compass,
  BrainCircuit,
  Zap,
  HeartHandshake,
  Trash2,
  ExternalLink,
  BookOpen,
  Info,
  Navigation
} from 'lucide-react';
import { ChatMessage, ChatRole, GroundingSource, JournalEntry, SaveErrorState } from '../types';
import { saveUserChatMessage, fetchUserChatHistory } from '../lib/firestoreService';

const AVAILABLE_ROLES: ChatRole[] = [
  {
    id: 'mindful-companion',
    name: 'Mindful Companion',
    description: 'Empathetic listener for everyday self-discovery and emotional validation.',
    systemInstruction: 'You are a compassionate, non-judgmental reflective listener. Mirror back key emotions, offer validating perspective, and ask gentle questions that illuminate new self-discoveries.',
    defaultModel: 'gemini-3.5-flash',
    suggestedGrounding: 'none',
    iconName: 'HeartHandshake',
  },
  {
    id: 'introspective-analyst',
    name: 'Deep Introspective Analyst',
    description: 'Complex cognitive reframing, philosophical wisdom, and existential reflection.',
    systemInstruction: 'You apply deep cognitive reframing, philosophical inquiry, existential reflections, and structured self-awareness prompts. Help the user break down complex dilemmas into actionable wisdom.',
    defaultModel: 'gemini-3.1-pro-preview',
    suggestedGrounding: 'none',
    iconName: 'BrainCircuit',
  },
  {
    id: 'quick-coach',
    name: 'Quick Daily Coach',
    description: 'High-energy, fast check-ins with clear action points and morning/evening clarity.',
    systemInstruction: 'You provide fast, punchy, motivating, and concise reflections. Keep responses brief, practical, high-energy, and centered on 1-2 immediate daily focus areas.',
    defaultModel: 'gemini-3.1-flash-lite',
    suggestedGrounding: 'none',
    iconName: 'Zap',
  },
  {
    id: 'zen-guide',
    name: 'Zen Guide (Maps Grounded)',
    description: 'Find serene parks, meditation gardens, and quiet retreats using real Google Maps data.',
    systemInstruction: 'You help the user find peace, mindfulness retreats, quiet reflection spaces, botanical sanctuaries, and serene places to pause and reflect. When recommending locations, provide calm, evocative descriptions and helpful tips.',
    defaultModel: 'gemini-3.5-flash',
    suggestedGrounding: 'maps',
    iconName: 'MapPin',
  },
  {
    id: 'mindfulness-researcher',
    name: 'Mindfulness Researcher (Search Grounded)',
    description: 'Cites up-to-date scientific research, neuroscience studies, and habit formation data.',
    systemInstruction: 'Ground your answers in contemporary mindfulness research, stress management neuroscience, habit formation literature, and evidence-based psychological well-being principles from the live web.',
    defaultModel: 'gemini-3.5-flash',
    suggestedGrounding: 'search',
    iconName: 'Search',
  },
];

interface GeminiChatbotProps {
  userId: string;
  activeEntry: JournalEntry | null;
  onError: (err: SaveErrorState) => void;
}

export function GeminiChatbot({ userId, activeEntry, onError }: GeminiChatbotProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputPrompt, setInputPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState<ChatRole>(AVAILABLE_ROLES[0]);
  const [selectedModel, setSelectedModel] = useState<string>('gemini-3.5-flash');
  const [groundingMode, setGroundingMode] = useState<'none' | 'maps' | 'search'>('none');
  const [includeEntryContext, setIncludeEntryContext] = useState(true);
  const [userCoords, setUserCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [locationStatus, setLocationStatus] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load chat history from Firestore on component mount
  useEffect(() => {
    let isMounted = true;
    const loadHistory = async () => {
      try {
        const history = await fetchUserChatHistory(userId);
        if (isMounted && history.length > 0) {
          setMessages(history);
        }
      } catch (err: any) {
        console.warn('Could not load chat history from Firestore:', err);
      }
    };
    loadHistory();
    return () => {
      isMounted = false;
    };
  }, [userId]);

  // Scroll to bottom of message thread
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Sync role changes to default model & grounding
  const handleSelectRole = (role: ChatRole) => {
    setSelectedRole(role);
    setSelectedModel(role.defaultModel);
    setGroundingMode(role.suggestedGrounding || 'none');
  };

  // Detect location for Google Maps Grounding
  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      setLocationStatus('Geolocation not supported by browser.');
      return;
    }
    setDetectingLocation(true);
    setLocationStatus('Detecting coordinates...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserCoords({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
        setDetectingLocation(false);
        setLocationStatus(`Locked: ${pos.coords.latitude.toFixed(3)}, ${pos.coords.longitude.toFixed(3)}`);
      },
      (err) => {
        setDetectingLocation(false);
        setLocationStatus(`Could not detect GPS (${err.message}). Using general maps query.`);
      },
      { timeout: 8000 }
    );
  };

  const handleSendMessage = async (overridePrompt?: string) => {
    const text = (overridePrompt || inputPrompt).trim();
    if (!text || loading) return;

    setInputPrompt('');

    const userMessage: ChatMessage = {
      id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setLoading(true);

    // Persist user turn to Firestore
    try {
      await saveUserChatMessage(userId, userMessage);
    } catch (err) {
      console.warn('Failed to save user turn to Firestore:', err);
    }

    // Prepare multi-turn payload
    const messagesPayload = newMessages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: messagesPayload,
          role: selectedRole.name,
          systemInstruction: selectedRole.systemInstruction,
          model: selectedModel,
          grounding: groundingMode,
          userLocation: userCoords,
          entryContext: includeEntryContext && activeEntry
            ? `Title: ${activeEntry.title}\nMood: ${activeEntry.mood}\nBody: ${activeEntry.content}`
            : '',
        }),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || `Server responded with ${response.status}`);
      }

      const data = await response.json();

      const botMessage: ChatMessage = {
        id: `bot_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        role: 'model',
        content: data.reply || 'I am listening deeply. Please share more of what is on your mind.',
        modelUsed: data.modelUsed || selectedModel,
        groundingSources: data.groundingSources || [],
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, botMessage]);

      // Persist bot turn to Firestore
      try {
        await saveUserChatMessage(userId, botMessage);
      } catch (err) {
        console.warn('Failed to save bot turn to Firestore:', err);
      }
    } catch (err: any) {
      console.error('Chat error:', err);
      onError({
        hasError: true,
        message: `Gemini Chat failed: ${err.message}`,
        retryAction: () => handleSendMessage(text),
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClearChat = () => {
    if (confirm('Clear current chat view? Saved messages remain in your private Firestore vault.')) {
      setMessages([]);
    }
  };

  const getRoleIcon = (iconName: string) => {
    switch (iconName) {
      case 'BrainCircuit':
        return <BrainCircuit className="w-4 h-4 text-purple-400" />;
      case 'Zap':
        return <Zap className="w-4 h-4 text-amber-400" />;
      case 'MapPin':
        return <MapPin className="w-4 h-4 text-emerald-400" />;
      case 'Search':
        return <Search className="w-4 h-4 text-blue-400" />;
      default:
        return <HeartHandshake className="w-4 h-4 text-rose-400" />;
    }
  };

  return (
    <div className="flex flex-col h-full bg-stone-900 border border-stone-800 rounded-2xl overflow-hidden shadow-xl">
      {/* Top Configuration Bar */}
      <div className="p-3.5 bg-stone-950 border-b border-stone-800 flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-stone-100 flex items-center gap-2">
                Gemini Multi-Turn Conversational Guide
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-stone-800 text-stone-300 border border-stone-700">
                  {selectedModel}
                </span>
              </h2>
              <p className="text-xs text-stone-400">{selectedRole.description}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {messages.length > 0 && (
              <button
                onClick={handleClearChat}
                title="Clear current view"
                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-200 hover:bg-stone-800 transition-colors cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Role Selector Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
          {AVAILABLE_ROLES.map((role) => {
            const isSelected = selectedRole.id === role.id;
            return (
              <button
                key={role.id}
                onClick={() => handleSelectRole(role)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-amber-500 text-stone-950 shadow-xs font-semibold'
                    : 'bg-stone-900 text-stone-300 hover:bg-stone-800 border border-stone-800'
                }`}
              >
                {getRoleIcon(role.iconName)}
                <span>{role.name}</span>
              </button>
            );
          })}
        </div>

        {/* Model & Grounding Controls */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-stone-850 text-xs text-stone-400">
          <div className="flex items-center gap-3">
            {/* Model Override Selector */}
            <div className="flex items-center gap-1.5">
              <span className="text-stone-400 font-medium">Model:</span>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="bg-stone-900 border border-stone-700 text-stone-200 rounded-md px-2 py-0.5 text-xs focus:outline-hidden focus:border-amber-500 cursor-pointer"
              >
                <option value="gemini-3.5-flash">gemini-3.5-flash (General)</option>
                <option value="gemini-3.1-pro-preview">gemini-3.1-pro-preview (Complex Tasks)</option>
                <option value="gemini-3.1-flash-lite">gemini-3.1-flash-lite (Fast)</option>
              </select>
            </div>

            {/* Grounding Mode Selector */}
            <div className="flex items-center gap-1.5">
              <span className="text-stone-400 font-medium">Grounding:</span>
              <div className="inline-flex rounded-md p-0.5 bg-stone-900 border border-stone-800">
                <button
                  onClick={() => setGroundingMode('none')}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                    groundingMode === 'none'
                      ? 'bg-stone-800 text-stone-100'
                      : 'text-stone-400 hover:text-stone-200'
                  }`}
                >
                  Standard
                </button>
                <button
                  onClick={() => {
                    setGroundingMode('maps');
                    setSelectedModel('gemini-3.5-flash');
                  }}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                    groundingMode === 'maps'
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                      : 'text-stone-400 hover:text-stone-200'
                  }`}
                >
                  <MapPin className="w-3 h-3 text-emerald-400" />
                  Maps
                </button>
                <button
                  onClick={() => {
                    setGroundingMode('search');
                    setSelectedModel('gemini-3.5-flash');
                  }}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                    groundingMode === 'search'
                      ? 'bg-blue-950 text-blue-300 border border-blue-800'
                      : 'text-stone-400 hover:text-stone-200'
                  }`}
                >
                  <Search className="w-3 h-3 text-blue-400" />
                  Search
                </button>
              </div>
            </div>
          </div>

          {/* Context & Location toggles */}
          <div className="flex items-center gap-3">
            {groundingMode === 'maps' && (
              <button
                onClick={handleDetectLocation}
                disabled={detectingLocation}
                className="flex items-center gap-1 text-[11px] text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer"
              >
                <Navigation className="w-3 h-3" />
                <span>{userCoords ? 'GPS Active' : detectingLocation ? 'Locating...' : 'Pin My Coordinates'}</span>
              </button>
            )}

            {activeEntry && (
              <label className="flex items-center gap-1.5 cursor-pointer select-none text-[11px] text-stone-300">
                <input
                  type="checkbox"
                  checked={includeEntryContext}
                  onChange={(e) => setIncludeEntryContext(e.target.checked)}
                  className="rounded border-stone-700 bg-stone-900 text-amber-500 focus:ring-0 cursor-pointer"
                />
                <span className="truncate max-w-[150px]">
                  Context: <strong>{activeEntry.title || 'Active Entry'}</strong>
                </span>
              </label>
            )}
          </div>
        </div>

        {locationStatus && (
          <p className="text-[11px] text-emerald-400/90 font-mono">{locationStatus}</p>
        )}
      </div>

      {/* Message Scrollable Thread */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Sparkles className="w-6 h-6" />
            </div>
            <div className="max-w-md space-y-1">
              <h3 className="text-sm font-semibold text-stone-200">
                Start a Reflective Conversation
              </h3>
              <p className="text-xs text-stone-400 leading-relaxed">
                Connect with {selectedRole.name}. You can explore emotional breakthroughs, search for serene meditation locations via Google Maps, or ground questions in scientific research.
              </p>
            </div>

            {/* Quick Suggested Starter Chips */}
            <div className="w-full max-w-md grid grid-cols-1 gap-2 pt-2 text-left">
              {groundingMode === 'maps' ? (
                <>
                  <button
                    onClick={() => handleSendMessage('Recommend 3 tranquil public parks, botanical gardens, or zen sanctuaries nearby for quiet contemplation.')}
                    className="p-2.5 rounded-xl bg-stone-950 border border-stone-800 hover:border-emerald-500/40 text-xs text-stone-300 hover:text-stone-100 transition-colors text-left cursor-pointer flex items-center gap-2"
                  >
                    <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Find serene parks or nature reserves for meditation</span>
                  </button>
                  <button
                    onClick={() => handleSendMessage('Where are quiet places or scenic vistas to watch the sunrise and write in my journal?')}
                    className="p-2.5 rounded-xl bg-stone-950 border border-stone-800 hover:border-emerald-500/40 text-xs text-stone-300 hover:text-stone-100 transition-colors text-left cursor-pointer flex items-center gap-2"
                  >
                    <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Scenic spots to watch the sunrise and journal</span>
                  </button>
                </>
              ) : groundingMode === 'search' ? (
                <>
                  <button
                    onClick={() => handleSendMessage('What does the latest neuroscience say about a 10-minute daily mindfulness journaling practice?')}
                    className="p-2.5 rounded-xl bg-stone-950 border border-stone-800 hover:border-blue-500/40 text-xs text-stone-300 hover:text-stone-100 transition-colors text-left cursor-pointer flex items-center gap-2"
                  >
                    <Search className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    <span>Latest neuroscience research on daily reflection</span>
                  </button>
                  <button
                    onClick={() => handleSendMessage('What are evidence-based breathing techniques to lower cortisol before sleep?')}
                    className="p-2.5 rounded-xl bg-stone-950 border border-stone-800 hover:border-blue-500/40 text-xs text-stone-300 hover:text-stone-100 transition-colors text-left cursor-pointer flex items-center gap-2"
                  >
                    <Search className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    <span>Evidence-based methods to lower evening stress</span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => handleSendMessage('Help me break down what I am feeling right now and find a compassionate lens.')}
                    className="p-2.5 rounded-xl bg-stone-950 border border-stone-800 hover:border-amber-500/40 text-xs text-stone-300 hover:text-stone-100 transition-colors text-left cursor-pointer flex items-center gap-2"
                  >
                    <HeartHandshake className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                    <span>Explore what I am feeling with self-compassion</span>
                  </button>
                  <button
                    onClick={() => handleSendMessage('What is a powerful stoic or mindful reframing for unexpected adversity?')}
                    className="p-2.5 rounded-xl bg-stone-950 border border-stone-800 hover:border-purple-500/40 text-xs text-stone-300 hover:text-stone-100 transition-colors text-left cursor-pointer flex items-center gap-2"
                  >
                    <BrainCircuit className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                    <span>Stoic cognitive reframing for sudden stress</span>
                  </button>
                  <button
                    onClick={() => handleSendMessage('Give me 3 practical high-clarity questions for my evening review.')}
                    className="p-2.5 rounded-xl bg-stone-950 border border-stone-800 hover:border-amber-500/40 text-xs text-stone-300 hover:text-stone-100 transition-colors text-left cursor-pointer flex items-center gap-2"
                  >
                    <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>3 high-impact questions for evening review</span>
                  </button>
                </>
              )}
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={msg.id}
                className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {!isUser && (
                  <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 mt-0.5">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div
                  className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-3.5 text-xs sm:text-sm leading-relaxed ${
                    isUser
                      ? 'bg-amber-500 text-stone-950 font-medium ml-auto'
                      : 'bg-stone-950 border border-stone-800 text-stone-200 shadow-md'
                  }`}
                >
                  {isUser ? (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  ) : (
                    <div>
                      <div className="prose prose-invert prose-xs max-w-none space-y-2">
                        <Markdown>{msg.content}</Markdown>
                      </div>

                      {/* Grounding Citations & Map Links */}
                      {msg.groundingSources && msg.groundingSources.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-stone-800 space-y-2">
                          <p className="text-[11px] font-semibold text-stone-400 flex items-center gap-1.5">
                            <Compass className="w-3.5 h-3.5 text-amber-400" />
                            <span>Grounded Live References ({msg.groundingSources.length})</span>
                          </p>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {msg.groundingSources.map((source, idx) => (
                              <a
                                key={idx}
                                href={source.uri || '#'}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 rounded-xl bg-stone-900 border border-stone-800 hover:border-amber-500/50 transition-colors flex items-start gap-2 group cursor-pointer"
                              >
                                {source.type === 'maps' ? (
                                  <MapPin className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                                ) : (
                                  <Search className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                                )}
                                <div className="overflow-hidden">
                                  <p className="font-medium text-stone-200 text-xs truncate group-hover:text-amber-400 transition-colors flex items-center gap-1">
                                    <span>{source.title || 'Reference Link'}</span>
                                    <ExternalLink className="w-3 h-3 opacity-60" />
                                  </p>
                                  {source.snippets && source.snippets.length > 0 && (
                                    <p className="text-[10px] text-stone-400 line-clamp-1 mt-0.5">
                                      {source.snippets[0]}
                                    </p>
                                  )}
                                </div>
                              </a>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Footer info: Model tag */}
                      {msg.modelUsed && (
                        <div className="mt-2 text-[10px] text-stone-500 font-mono flex items-center gap-1 justify-end">
                          <span>Generated by {msg.modelUsed}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {isUser && (
                  <div className="w-7 h-7 rounded-lg bg-stone-800 border border-stone-700 flex items-center justify-center text-stone-400 shrink-0 mt-0.5">
                    <UserIcon className="w-4 h-4" />
                  </div>
                )}
              </div>
            );
          })
        )}

        {loading && (
          <div className="flex gap-3 justify-start items-center">
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <Bot className="w-4 h-4 animate-pulse" />
            </div>
            <div className="px-3.5 py-2.5 rounded-2xl bg-stone-950 border border-stone-800 flex items-center gap-2 text-xs text-stone-400">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
              <span>{selectedRole.name} is reflecting with {selectedModel}...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Composer */}
      <div className="p-3.5 bg-stone-950 border-t border-stone-800">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            value={inputPrompt}
            onChange={(e) => setInputPrompt(e.target.value)}
            placeholder={`Ask ${selectedRole.name}...`}
            disabled={loading}
            className="flex-1 bg-stone-900 border border-stone-800 focus:border-amber-500 text-stone-100 placeholder-stone-500 text-xs sm:text-sm rounded-xl px-3.5 py-2.5 focus:outline-hidden transition-colors"
          />
          <button
            type="submit"
            disabled={!inputPrompt.trim() || loading}
            className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-stone-950 font-semibold transition-all flex items-center justify-center cursor-pointer shadow-xs active:scale-95"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
