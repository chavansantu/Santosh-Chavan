import { useState, useRef, useEffect } from 'react';
import Markdown from 'react-markdown';
import { 
  Sparkles, 
  Send, 
  Loader2, 
  Bot, 
  User as UserIcon, 
  Lightbulb, 
  HelpCircle, 
  Compass, 
  CheckCircle2,
  Cpu
} from 'lucide-react';
import { InteractionMessage, JournalEntry, SaveErrorState } from '../types';
import { saveInteraction } from '../lib/firestoreService';

interface GeminiReflectionPanelProps {
  userId: string;
  activeEntry: JournalEntry | null;
  interactions: InteractionMessage[];
  onAddInteraction: (msg: InteractionMessage) => void;
  onError: (err: SaveErrorState) => void;
}

export function GeminiReflectionPanel({
  userId,
  activeEntry,
  interactions,
  onAddInteraction,
  onError,
}: GeminiReflectionPanelProps) {
  const [prompt, setPrompt] = useState('');
  const [mode, setMode] = useState<'reflection' | 'summary' | 'brainstorm'>('reflection');
  const [loading, setLoading] = useState(false);
  const [modelUsed, setModelUsed] = useState<string>('gemini-3.6-flash');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [interactions, loading]);

  const quickPrompts = [
    'What underlying themes or emotions do you notice?',
    'Help me reframe this challenge with more compassion.',
    'What are 3 practical questions I can ask myself tomorrow?',
    'Give me a short mindfulness affirmation based on this.',
  ];

  const handleSend = async (customPrompt?: string) => {
    const textToSend = customPrompt || prompt;
    if (!textToSend.trim() || loading) return;

    const userPromptText = textToSend.trim();
    if (!customPrompt) {
      setPrompt('');
    }
    setLoading(true);

    // Build payload messages for multi-turn history
    const historyPayload = interactions.map((item) => ({
      role: item.role,
      content: item.content,
    }));
    historyPayload.push({
      role: 'user',
      content: userPromptText,
    });

    let savedUserMsg: InteractionMessage | null = null;
    let savedModelMsg: InteractionMessage | null = null;

    try {
      // 1. Guaranteed Transaction Verification: Save user message first to Firestore
      savedUserMsg = await saveInteraction(userId, {
        entryId: activeEntry?.id,
        role: 'user',
        content: userPromptText,
        mode,
        createdAt: Date.now(),
      });
      onAddInteraction(savedUserMsg);

      // 2. Call server-side Gemini API proxy
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: historyPayload,
          mode,
          entryContext: activeEntry ? `Title: ${activeEntry.title}\nContent:\n${activeEntry.content}` : '',
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Gemini API returned error (${response.status})`);
      }

      const data = await response.json();
      const replyText = data.reply || 'No response generated.';
      if (data.modelUsed) {
        setModelUsed(data.modelUsed);
      }

      // 3. Save Gemini's response to Firestore
      savedModelMsg = await saveInteraction(userId, {
        entryId: activeEntry?.id,
        role: 'model',
        content: replyText,
        mode,
        modelUsed: data.modelUsed || 'gemini-3.6-flash',
        createdAt: Date.now(),
      });
      onAddInteraction(savedModelMsg);
    } catch (err: any) {
      console.error('Gemini interaction error:', err);
      // Explicit Error Escalation & User Feedback
      onError({
        hasError: true,
        message: `Failed to complete interaction: ${err.message}. Your input is preserved.`,
        failedPayload: userPromptText,
        retryAction: async () => {
          await handleSend(userPromptText);
        },
      });
      // Restore prompt text if not sent
      if (!savedUserMsg) {
        setPrompt(userPromptText);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-stone-900 border border-stone-800 rounded-2xl overflow-hidden shadow-sm">
      {/* Panel Header */}
      <div className="px-4 py-3 bg-stone-900/90 border-b border-stone-800 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-stone-100 flex items-center gap-1.5">
              <span>Gemini Reflections</span>
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-normal bg-stone-800 text-stone-300 border border-stone-700">
                <Cpu className="w-3 h-3 text-amber-400" />
                {modelUsed}
              </span>
            </h2>
            <p className="text-[11px] text-stone-400">
              {activeEntry ? `Context: "${activeEntry.title || 'Untitled'}"` : 'General Reflection Vault'}
            </p>
          </div>
        </div>

        {/* Mode Selector */}
        <div className="flex items-center p-0.5 rounded-lg bg-stone-950 border border-stone-800 text-xs">
          <button
            id="mode-reflection-btn"
            onClick={() => setMode('reflection')}
            className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
              mode === 'reflection'
                ? 'bg-amber-500 text-stone-950 font-medium'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            Reflect
          </button>
          <button
            id="mode-summary-btn"
            onClick={() => setMode('summary')}
            className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
              mode === 'summary'
                ? 'bg-amber-500 text-stone-950 font-medium'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            Summarize
          </button>
          <button
            id="mode-brainstorm-btn"
            onClick={() => setMode('brainstorm')}
            className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
              mode === 'brainstorm'
                ? 'bg-amber-500 text-stone-950 font-medium'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            Brainstorm
          </button>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {interactions.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-stone-400">
            <div className="w-12 h-12 rounded-2xl bg-stone-800/80 border border-stone-700/60 flex items-center justify-center text-amber-400 mb-3">
              <Compass className="w-6 h-6" />
            </div>
            <p className="text-sm font-medium text-stone-200">Start a Reflective Conversation</p>
            <p className="text-xs text-stone-400 mt-1 max-w-xs leading-relaxed">
              Ask Gemini to analyze emotional cues in your journal, explore deeper perspectives, or brainstorm constructive pathways.
            </p>

            {/* Quick Prompt Starters */}
            <div className="mt-5 w-full max-w-sm space-y-2">
              <p className="text-[11px] font-semibold text-stone-300 uppercase tracking-wider text-left">
                Suggested Prompts
              </p>
              {quickPrompts.slice(0, 3).map((promptText, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(promptText)}
                  className="w-full text-left p-2 rounded-lg bg-stone-800/50 hover:bg-stone-800 border border-stone-700/60 text-xs text-stone-300 hover:text-amber-300 transition-colors flex items-center gap-2 cursor-pointer"
                >
                  <Lightbulb className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="truncate">{promptText}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          interactions.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 ${
                msg.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              {msg.role === 'model' && (
                <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 mt-0.5">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div
                className={`max-w-[85%] rounded-2xl p-3.5 text-xs sm:text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-amber-500 text-stone-950 rounded-tr-sm font-medium'
                    : 'bg-stone-800/90 text-stone-200 border border-stone-700/80 rounded-tl-sm'
                }`}
              >
                {msg.role === 'user' ? (
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                ) : (
                  <div className="markdown-body space-y-2 prose prose-invert prose-stone max-w-none text-stone-200 prose-p:leading-relaxed prose-pre:bg-stone-950">
                    <Markdown>{msg.content}</Markdown>
                  </div>
                )}

                <div
                  className={`mt-1.5 flex items-center gap-2 text-[10px] ${
                    msg.role === 'user' ? 'text-stone-800' : 'text-stone-400'
                  }`}
                >
                  <span>
                    {new Date(msg.createdAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  {msg.modelUsed && (
                    <span>• {msg.modelUsed}</span>
                  )}
                  {msg.mode && (
                    <span className="capitalize">• {msg.mode}</span>
                  )}
                </div>
              </div>

              {msg.role === 'user' && (
                <div className="w-7 h-7 rounded-lg bg-stone-800 border border-stone-700 flex items-center justify-center text-stone-300 shrink-0 mt-0.5">
                  <UserIcon className="w-4 h-4" />
                </div>
              )}
            </div>
          ))
        )}

        {loading && (
          <div className="flex gap-3 items-center text-stone-400 text-xs">
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <Loader2 className="w-4 h-4 animate-spin" />
            </div>
            <div className="p-3 rounded-2xl bg-stone-800 border border-stone-700 text-stone-300 flex items-center gap-2">
              <span>Gemini is reflecting with {modelUsed}...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="p-3 bg-stone-950/80 border-t border-stone-800">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2"
        >
          <input
            id="gemini-prompt-input"
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={
              mode === 'reflection'
                ? 'Ask for a reflection or deeper inquiry...'
                : mode === 'summary'
                ? 'Request a summary or core insights...'
                : 'Ask for brainstorming pathways...'
            }
            disabled={loading}
            className="flex-1 bg-stone-900 border border-stone-800 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-stone-100 placeholder-stone-400 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition-colors"
          />
          <button
            id="send-gemini-prompt-btn"
            type="submit"
            disabled={loading || !prompt.trim()}
            className="p-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer shrink-0"
            title="Send to Gemini"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            <span className="sr-only">Send</span>
          </button>
        </form>
      </div>
    </div>
  );
}
