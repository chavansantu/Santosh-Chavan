import { useState, useEffect, useRef } from 'react';
import { 
  JournalEntry, 
  SaveErrorState, 
  GeminiVoiceName, 
  VoiceOption, 
  VoiceTranscriptItem, 
  VoiceSessionRecord 
} from '../types';
import { 
  saveVoiceSession, 
  fetchUserVoiceSessions, 
  deleteVoiceSession,
  saveJournalEntry 
} from '../lib/firestoreService';
import { 
  Mic, 
  MicOff, 
  Radio, 
  PhoneOff, 
  Sparkles, 
  Volume2, 
  VolumeX, 
  BookOpen, 
  Save, 
  Clock, 
  RotateCcw, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Trash2, 
  AudioLines,
  MessageSquare,
  ArrowRight
} from 'lucide-react';

interface GeminiLiveVoiceProps {
  userId: string;
  activeEntry: JournalEntry | null;
  onSaveEntrySuccess: (entry: JournalEntry) => void;
  onError: (error: SaveErrorState) => void;
}

const AVAILABLE_VOICES: VoiceOption[] = [
  {
    id: 'Zephyr',
    name: 'Zephyr',
    gender: 'Calm & Gentle',
    style: 'Reflective & Soothing',
    description: 'A soft, patient voice ideal for mindful evening reflections and emotional debriefing.'
  },
  {
    id: 'Kore',
    name: 'Kore',
    gender: 'Warm & Grounded',
    style: 'Empathetic & Attentive',
    description: 'A balanced, comforting presence suited for self-care and gratitude journaling.'
  },
  {
    id: 'Puck',
    name: 'Puck',
    gender: 'Spirited & Clear',
    style: 'Energizing & Inquisitive',
    description: 'An enthusiastic voice that prompts deeper curiosity and motivation.'
  },
  {
    id: 'Charon',
    name: 'Charon',
    gender: 'Deep & Resonant',
    style: 'Philosophical & Steady',
    description: 'A thoughtful cadence for navigating heavy dilemmas and strategic life planning.'
  },
  {
    id: 'Fenrir',
    name: 'Fenrir',
    gender: 'Direct & Focused',
    style: 'Insightful & Structured',
    description: 'A structured, grounded voice that helps clarify priorities and action steps.'
  }
];

const REFLECTION_PROMPTS = [
  "How can I untangle the mental fatigue I felt today?",
  "I want to celebrate a meaningful breakthrough this week.",
  "Help me reflect on an uneasy conversation I had today.",
  "Guide me through a mindful decompression reflection.",
];

// Helper: Float32Array to 16-bit PCM little-endian Base64
function floatTo16BitPCMBase64(float32Array: Float32Array): string {
  const buffer = new ArrayBuffer(float32Array.length * 2);
  const view = new DataView(buffer);
  let offset = 0;
  for (let i = 0; i < float32Array.length; i++, offset += 2) {
    let s = Math.max(-1, Math.min(1, float32Array[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

// Helper: Base64 16-bit PCM to Float32Array
function base64PCMToFloat32Array(base64: string): Float32Array {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  const int16Array = new Int16Array(bytes.buffer);
  const float32Array = new Float32Array(int16Array.length);
  for (let i = 0; i < int16Array.length; i++) {
    float32Array[i] = int16Array[i] / (int16Array[i] < 0 ? 0x8000 : 0x7fff);
  }
  return float32Array;
}

export function GeminiLiveVoice({
  userId,
  activeEntry,
  onSaveEntrySuccess,
  onError,
}: GeminiLiveVoiceProps) {
  // Connection & Session State
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState<GeminiVoiceName>('Zephyr');
  const [isMuted, setIsMuted] = useState(false);
  const [isModelSpeaking, setIsModelSpeaking] = useState(false);
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [inputVolume, setInputVolume] = useState(0);
  const [outputVolume, setOutputVolume] = useState(0);

  // Transcript & Dialogue
  const [transcript, setTranscript] = useState<VoiceTranscriptItem[]>([]);
  const [currentPartialUserText, setCurrentPartialUserText] = useState('');
  const [currentPartialModelText, setCurrentPartialModelText] = useState('');

  // History & Actions
  const [savedSessions, setSavedSessions] = useState<VoiceSessionRecord[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [synthesisSuccessMessage, setSynthesisSuccessMessage] = useState<string | null>(null);

  // Audio & Hardware Refs
  const wsRef = useRef<WebSocket | null>(null);
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const outputAudioCtxRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const inputAnalyserRef = useRef<AnalyserNode | null>(null);
  const outputAnalyserRef = useRef<AnalyserNode | null>(null);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const nextStartTimeRef = useRef<number>(0);
  const timerIntervalRef = useRef<any>(null);
  const isMutedRef = useRef(false);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);

  // Sync mute state ref for realtime audio callback
  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  // Load saved voice sessions
  useEffect(() => {
    if (!userId) return;
    fetchUserVoiceSessions(userId)
      .then(setSavedSessions)
      .catch((err) => console.warn('Could not load voice sessions:', err));
  }, [userId]);

  // Auto-scroll transcript feed
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript, currentPartialUserText, currentPartialModelText]);

  // Session duration timer
  useEffect(() => {
    if (isConnected) {
      timerIntervalRef.current = setInterval(() => {
        setSessionSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [isConnected]);

  // Volume meter animation loop
  useEffect(() => {
    let animId: number;
    const updateVolumes = () => {
      if (inputAnalyserRef.current && !isMutedRef.current && isConnected) {
        const data = new Uint8Array(inputAnalyserRef.current.frequencyBinCount);
        inputAnalyserRef.current.getByteFrequencyData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i];
        const avg = sum / data.length;
        setInputVolume(Math.min(100, Math.round((avg / 128) * 100)));
      } else {
        setInputVolume(0);
      }

      if (outputAnalyserRef.current && isConnected) {
        const data = new Uint8Array(outputAnalyserRef.current.frequencyBinCount);
        outputAnalyserRef.current.getByteFrequencyData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i];
        const avg = sum / data.length;
        const vol = Math.min(100, Math.round((avg / 128) * 100));
        setOutputVolume(vol);
        setIsModelSpeaking(vol > 5);
      } else {
        setOutputVolume(0);
        setIsModelSpeaking(false);
      }

      animId = requestAnimationFrame(updateVolumes);
    };

    if (isConnected) {
      animId = requestAnimationFrame(updateVolumes);
    } else {
      setInputVolume(0);
      setOutputVolume(0);
      setIsModelSpeaking(false);
    }

    return () => cancelAnimationFrame(animId);
  }, [isConnected]);

  // Audio Playback helper with gapless scheduling
  const playAudioChunk = (base64PCM: string) => {
    const audioCtx = outputAudioCtxRef.current;
    if (!audioCtx) return;

    try {
      const float32 = base64PCMToFloat32Array(base64PCM);
      if (float32.length === 0) return;

      const audioBuffer = audioCtx.createBuffer(1, float32.length, 24000);
      audioBuffer.copyToChannel(float32, 0);

      const source = audioCtx.createBufferSource();
      source.buffer = audioBuffer;

      // Connect source through output analyser for visualizer
      if (outputAnalyserRef.current) {
        source.connect(outputAnalyserRef.current);
        outputAnalyserRef.current.connect(audioCtx.destination);
      } else {
        source.connect(audioCtx.destination);
      }

      const currentTime = audioCtx.currentTime;
      if (nextStartTimeRef.current < currentTime) {
        nextStartTimeRef.current = currentTime;
      }

      source.start(nextStartTimeRef.current);
      nextStartTimeRef.current += audioBuffer.duration;

      activeSourcesRef.current.push(source);
      source.onended = () => {
        const idx = activeSourcesRef.current.indexOf(source);
        if (idx !== -1) activeSourcesRef.current.splice(idx, 1);
      };
    } catch (err) {
      console.warn('[Audio Playback Error]:', err);
    }
  };

  // Stop all model audio immediately (e.g. on user interruption)
  const stopAllAudio = () => {
    for (const source of activeSourcesRef.current) {
      try {
        source.stop();
      } catch {}
    }
    activeSourcesRef.current = [];
    if (outputAudioCtxRef.current) {
      nextStartTimeRef.current = outputAudioCtxRef.current.currentTime;
    }
    setIsModelSpeaking(false);
  };

  // Connect to Gemini 3.8 Live API
  const handleStartConversation = async () => {
    if (isConnected || isConnecting) return;
    setIsConnecting(true);

    try {
      // 1. Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });
      mediaStreamRef.current = stream;

      // 2. Setup AudioContexts (16kHz for input mic, 24kHz for Gemini Live audio)
      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 16000,
      });
      inputAudioCtxRef.current = inputCtx;
      if (inputCtx.state === 'suspended') await inputCtx.resume();

      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 24000,
      });
      outputAudioCtxRef.current = outputCtx;
      if (outputCtx.state === 'suspended') await outputCtx.resume();
      nextStartTimeRef.current = outputCtx.currentTime;

      // Setup analysers
      const inputAnalyser = inputCtx.createAnalyser();
      inputAnalyser.fftSize = 64;
      inputAnalyserRef.current = inputAnalyser;

      const outputAnalyser = outputCtx.createAnalyser();
      outputAnalyser.fftSize = 64;
      outputAnalyserRef.current = outputAnalyser;

      // 3. Connect WebSocket to /live?voice=...
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/live?voice=${encodeURIComponent(selectedVoice)}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        setIsConnecting(false);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);

          if (msg.type === 'audio' && msg.audio) {
            playAudioChunk(msg.audio);
          } else if (msg.type === 'interrupted') {
            stopAllAudio();
          } else if (msg.type === 'input_transcription') {
            if (msg.finished) {
              if (msg.text?.trim()) {
                setTranscript((prev) => [
                  ...prev,
                  {
                    id: `user_${Date.now()}`,
                    speaker: 'user',
                    text: msg.text.trim(),
                    timestamp: Date.now(),
                  },
                ]);
              }
              setCurrentPartialUserText('');
            } else {
              setCurrentPartialUserText(msg.text || '');
            }
          } else if (msg.type === 'output_transcription') {
            if (msg.finished) {
              if (msg.text?.trim()) {
                setTranscript((prev) => [
                  ...prev,
                  {
                    id: `model_${Date.now()}`,
                    speaker: 'model',
                    text: msg.text.trim(),
                    timestamp: Date.now(),
                  },
                ]);
              }
              setCurrentPartialModelText('');
            } else {
              setCurrentPartialModelText(msg.text || '');
            }
          } else if (msg.type === 'model_text') {
            if (msg.text?.trim()) {
              setTranscript((prev) => [
                ...prev,
                {
                  id: `model_${Date.now()}`,
                  speaker: 'model',
                  text: msg.text.trim(),
                  timestamp: Date.now(),
                },
              ]);
            }
          } else if (msg.type === 'error') {
            console.error('[Gemini Live Error]:', msg.error);
            onError({
              hasError: true,
              message: `Gemini Live Voice error: ${msg.error}`,
            });
          }
        } catch (e) {
          console.warn('Error parsing incoming WebSocket message:', e);
        }
      };

      ws.onerror = (e) => {
        console.error('WebSocket error:', e);
        setIsConnecting(false);
        onError({
          hasError: true,
          message: 'WebSocket connection to Gemini Live failed. Please ensure the dev server is active and API key is set.',
        });
      };

      ws.onclose = () => {
        handleEndConversation();
      };

      // 4. Hook up audio processor to stream mic data to Gemini
      const source = inputCtx.createMediaStreamSource(stream);
      source.connect(inputAnalyser);

      const processor = inputCtx.createScriptProcessor(4096, 1, 1);
      scriptProcessorRef.current = processor;

      processor.onaudioprocess = (e) => {
        if (isMutedRef.current || ws.readyState !== WebSocket.OPEN) return;
        const channelData = e.inputBuffer.getChannelData(0);
        const base64PCM = floatTo16BitPCMBase64(channelData);
        ws.send(JSON.stringify({
          type: 'audio',
          audio: base64PCM,
        }));
      };

      inputAnalyser.connect(processor);
      processor.connect(inputCtx.destination);

    } catch (err: any) {
      console.error('Failed to start voice reflection:', err);
      setIsConnecting(false);
      setIsConnected(false);
      onError({
        hasError: true,
        message: `Microphone permission or audio setup failed: ${err.message}. Please allow microphone permissions in your browser.`,
      });
    }
  };

  // End conversation and clean up all audio nodes
  const handleEndConversation = () => {
    stopAllAudio();

    if (wsRef.current) {
      try {
        wsRef.current.send(JSON.stringify({ type: 'close' }));
        wsRef.current.close();
      } catch {}
      wsRef.current = null;
    }

    if (scriptProcessorRef.current) {
      try { scriptProcessorRef.current.disconnect(); } catch {}
      scriptProcessorRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    if (inputAudioCtxRef.current) {
      try { inputAudioCtxRef.current.close(); } catch {}
      inputAudioCtxRef.current = null;
    }

    if (outputAudioCtxRef.current) {
      try { outputAudioCtxRef.current.close(); } catch {}
      outputAudioCtxRef.current = null;
    }

    setIsConnected(false);
    setIsConnecting(false);
    setIsModelSpeaking(false);
    setInputVolume(0);
    setOutputVolume(0);
  };

  // Send a quick text prompt to model in real-time
  const handleSendPrompt = (promptText: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    setTranscript((prev) => [
      ...prev,
      {
        id: `user_${Date.now()}`,
        speaker: 'user',
        text: promptText,
        timestamp: Date.now(),
      }
    ]);
    wsRef.current.send(JSON.stringify({
      type: 'text',
      text: promptText,
    }));
  };

  // Save session transcript directly to Firestore /users/{userId}/voice_sessions
  const handleSaveSessionLog = async () => {
    if (transcript.length === 0) return;
    try {
      const sessionId = `voice_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const saved = await saveVoiceSession(userId, {
        id: sessionId,
        title: `Spoken Reflection (${selectedVoice}) - ${new Date().toLocaleDateString()}`,
        voiceName: selectedVoice,
        modelUsed: 'gemini-3.8-live',
        durationSeconds: sessionSeconds,
        transcript: transcript,
        summary: transcript.slice(-3).map((t) => t.text).join(' '),
        tags: ['Voice Reflection', 'Gemini Live', selectedVoice],
        createdAt: Date.now(),
      });
      setSavedSessions((prev) => [saved, ...prev]);
      setSynthesisSuccessMessage('Voice reflection log saved to Firestore Vault.');
      setTimeout(() => setSynthesisSuccessMessage(null), 4000);
    } catch (err: any) {
      onError({
        hasError: true,
        message: `Failed to save voice session: ${err.message}`,
      });
    }
  };

  // Synthesize transcript into a full first-person Journal Entry
  const handleSynthesizeToJournal = async (mode: 'new' | 'append') => {
    if (transcript.length === 0) return;
    setIsSynthesizing(true);
    setSynthesisSuccessMessage(null);

    try {
      const res = await fetch('/api/voice/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript }),
      });

      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}`);
      }

      const analysis = await res.json();

      let targetContent = analysis.summary || '';
      if (mode === 'append' && activeEntry) {
        targetContent = `${activeEntry.content}\n\n### Spoken Voice Reflection (${new Date().toLocaleTimeString()})\n${analysis.summary}`;
      }

      const saved = await saveJournalEntry(userId, {
        id: mode === 'append' && activeEntry ? activeEntry.id : undefined,
        title: mode === 'append' && activeEntry ? activeEntry.title : analysis.title || `Voice Reflection - ${new Date().toLocaleDateString()}`,
        content: targetContent,
        mood: analysis.mood || 'Contemplative',
        theme: analysis.theme || 'Spoken Dialogue & Mindful Reflection',
        tags: analysis.tags || ['Voice Reflection', 'Gemini Live', selectedVoice],
        keyTakeaways: analysis.keyTakeaways || [],
        location: activeEntry?.location,
      });

      onSaveEntrySuccess(saved);
      setSynthesisSuccessMessage(
        mode === 'append' 
          ? 'Reflection appended to your active journal entry!' 
          : 'Synthesized voice reflection saved as a new journal entry!'
      );
      setTimeout(() => setSynthesisSuccessMessage(null), 5000);
    } catch (err: any) {
      console.error('Failed to synthesize journal entry:', err);
      onError({
        hasError: true,
        message: `Failed to synthesize journal entry: ${err.message}`,
      });
    } finally {
      setIsSynthesizing(false);
    }
  };

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="w-full h-full flex flex-col gap-6">
      {/* Top Banner & Voice Model Status */}
      <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 sm:p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Radio className={`w-3.5 h-3.5 ${isConnected ? 'text-emerald-400 animate-pulse' : 'text-amber-400'}`} />
                <span>gemini-3.8-live</span>
              </span>
              <span className="text-xs text-stone-400 font-mono">
                Real-Time Bidirectional Voice (16kHz / 24kHz PCM)
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-stone-100 flex items-center gap-2">
              Gemini Live Voice Journaling
              <Sparkles className="w-5 h-5 text-amber-400" />
            </h2>
            <p className="text-xs sm:text-sm text-stone-400 mt-1 max-w-2xl">
              Engage in a spontaneous, low-latency spoken conversation with Gemini. Talk through your thoughts, unpack challenging emotions, or speak freely while Gemini listens, reflects, and transcribes.
            </p>
          </div>

          {/* Active Voice Selector */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <label className="text-xs font-medium text-stone-400 flex items-center gap-1">
              <Volume2 className="w-3.5 h-3.5 text-amber-400" />
              Companion Voice:
            </label>
            <select
              value={selectedVoice}
              disabled={isConnected || isConnecting}
              onChange={(e) => setSelectedVoice(e.target.value as GeminiVoiceName)}
              className="bg-stone-950 border border-stone-800 rounded-xl px-3 py-1.5 text-xs font-medium text-stone-200 focus:outline-none focus:border-amber-500 disabled:opacity-50 cursor-pointer"
            >
              {AVAILABLE_VOICES.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} ({v.style})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Success Alert Banner */}
        {synthesisSuccessMessage && (
          <div className="mt-4 p-3 rounded-xl bg-emerald-950/70 border border-emerald-800/80 text-emerald-200 text-xs flex items-center gap-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{synthesisSuccessMessage}</span>
          </div>
        )}
      </div>

      {/* Main Interactive Voice Visualizer & Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-[500px]">
        {/* Left Column: Visualizer Orb, Mic State, & Session Controls */}
        <div className="lg:col-span-5 bg-stone-900 border border-stone-800 rounded-2xl p-6 flex flex-col items-center justify-between shadow-xl relative overflow-hidden">
          {/* Status Header */}
          <div className="w-full flex items-center justify-between text-xs text-stone-400 pb-4 border-b border-stone-800">
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-emerald-500 animate-ping' : 'bg-stone-600'}`} />
              <span className="font-medium text-stone-300">
                {isConnecting ? 'Connecting to Live Session...' : isConnected ? 'Live Session Active' : 'Ready to Connect'}
              </span>
            </div>
            <div className="flex items-center gap-1 font-mono text-stone-300 bg-stone-950 px-2 py-1 rounded-lg border border-stone-800">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>{formatTimer(sessionSeconds)}</span>
            </div>
          </div>

          {/* Central Pulsating Audio Visualizer Orb */}
          <div className="my-8 relative flex items-center justify-center">
            {/* Ambient animated ripple rings */}
            {isConnected && (
              <>
                <div 
                  className="absolute rounded-full bg-amber-500/10 transition-all duration-150 pointer-events-none"
                  style={{
                    width: `${160 + outputVolume * 1.5}px`,
                    height: `${160 + outputVolume * 1.5}px`,
                  }}
                />
                <div 
                  className="absolute rounded-full bg-amber-500/20 transition-all duration-100 pointer-events-none"
                  style={{
                    width: `${130 + inputVolume * 1.2}px`,
                    height: `${130 + inputVolume * 1.2}px`,
                  }}
                />
              </>
            )}

            {/* Core Orb */}
            <div 
              className={`w-36 h-36 rounded-full flex flex-col items-center justify-center shadow-2xl transition-all duration-300 ${
                isConnected
                  ? isModelSpeaking
                    ? 'bg-gradient-to-tr from-amber-500 to-amber-300 text-stone-950 shadow-amber-500/30 scale-105'
                    : inputVolume > 5
                    ? 'bg-gradient-to-tr from-emerald-600 to-teal-400 text-stone-950 shadow-emerald-500/30'
                    : 'bg-stone-800 text-stone-300 shadow-stone-900 border border-stone-700'
                  : 'bg-stone-950 text-stone-600 border border-stone-800'
              }`}
            >
              {isConnecting ? (
                <Loader2 className="w-10 h-10 animate-spin text-amber-400" />
              ) : isConnected ? (
                <>
                  <AudioLines className={`w-10 h-10 mb-1 ${isModelSpeaking ? 'animate-bounce' : ''}`} />
                  <span className="text-[11px] font-bold uppercase tracking-wider">
                    {isModelSpeaking ? 'Gemini Speaking' : inputVolume > 5 ? 'Listening' : 'Ready'}
                  </span>
                </>
              ) : (
                <>
                  <Mic className="w-10 h-10 mb-1 opacity-40" />
                  <span className="text-[11px] font-medium opacity-60">Tap to Start</span>
                </>
              )}
            </div>
          </div>

          {/* Realtime Dual Audio Meters */}
          <div className="w-full space-y-3 mb-6 bg-stone-950/60 p-3.5 rounded-xl border border-stone-800/80">
            {/* User Mic Audio Input Bar */}
            <div>
              <div className="flex items-center justify-between text-[11px] text-stone-400 mb-1">
                <span className="flex items-center gap-1">
                  <Mic className="w-3 h-3 text-emerald-400" />
                  Your Microphone (16kHz)
                </span>
                <span className="font-mono text-stone-300">{inputVolume}%</span>
              </div>
              <div className="w-full h-1.5 bg-stone-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-emerald-400 transition-all duration-75 rounded-full"
                  style={{ width: `${inputVolume}%` }}
                />
              </div>
            </div>

            {/* Model Audio Output Bar */}
            <div>
              <div className="flex items-center justify-between text-[11px] text-stone-400 mb-1">
                <span className="flex items-center gap-1">
                  <Volume2 className="w-3 h-3 text-amber-400" />
                  Gemini Voice Output (24kHz)
                </span>
                <span className="font-mono text-stone-300">{outputVolume}%</span>
              </div>
              <div className="w-full h-1.5 bg-stone-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-amber-400 transition-all duration-75 rounded-full"
                  style={{ width: `${outputVolume}%` }}
                />
              </div>
            </div>
          </div>

          {/* Interactive Controls Toolbar */}
          <div className="w-full flex items-center justify-center gap-3">
            {!isConnected ? (
              <button
                id="start-live-voice-btn"
                onClick={handleStartConversation}
                disabled={isConnecting}
                className="w-full py-3.5 px-6 rounded-xl font-semibold text-sm bg-amber-500 hover:bg-amber-400 text-stone-950 flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all active:scale-[0.98] cursor-pointer disabled:opacity-60"
              >
                {isConnecting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Connecting WebSocket...</span>
                  </>
                ) : (
                  <>
                    <Mic className="w-4 h-4" />
                    <span>Start Voice Reflection ({selectedVoice})</span>
                  </>
                )}
              </button>
            ) : (
              <>
                {/* Mute Button */}
                <button
                  onClick={() => setIsMuted(!isMuted)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer ${
                    isMuted
                      ? 'bg-rose-950 text-rose-300 border-rose-800 hover:bg-rose-900'
                      : 'bg-stone-800 text-stone-200 border-stone-700 hover:bg-stone-700'
                  }`}
                  title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
                >
                  {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                </button>

                {/* Interrupt / Stop Audio Button */}
                {isModelSpeaking && (
                  <button
                    onClick={stopAllAudio}
                    className="px-3.5 py-3 rounded-xl bg-stone-800 border border-stone-700 text-amber-400 hover:bg-stone-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                    title="Pause companion speech"
                  >
                    <VolumeX className="w-4 h-4" />
                    <span>Hold</span>
                  </button>
                )}

                {/* End Session Button */}
                <button
                  id="end-live-voice-btn"
                  onClick={handleEndConversation}
                  className="flex-1 py-3 px-4 rounded-xl font-semibold text-xs bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center gap-2 shadow-md transition-all active:scale-[0.98] cursor-pointer"
                >
                  <PhoneOff className="w-4 h-4" />
                  <span>End Voice Session</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Right Column: Live Spoken Transcript & Reflection Synthesis Actions */}
        <div className="lg:col-span-7 bg-stone-900 border border-stone-800 rounded-2xl p-6 flex flex-col shadow-xl">
          {/* Panel Header & Quick Actions */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-stone-800">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-semibold text-stone-200">
                Live Speech Dialogue & Transcripts
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-stone-800 text-stone-400">
                {transcript.length} turns
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="text-xs text-stone-400 hover:text-stone-200 px-2 py-1 rounded-lg border border-stone-800 hover:bg-stone-800/60 transition-colors flex items-center gap-1 cursor-pointer"
              >
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>Saved Logs ({savedSessions.length})</span>
              </button>

              {transcript.length > 0 && (
                <button
                  onClick={() => setTranscript([])}
                  className="text-xs text-stone-500 hover:text-rose-400 px-2 py-1 rounded-lg transition-colors cursor-pointer"
                  title="Clear current transcript"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Quick Icebreaker Prompts (when transcript is empty) */}
          {transcript.length === 0 && !currentPartialUserText && !currentPartialModelText && (
            <div className="py-6 px-4 my-auto flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-3">
                <Sparkles className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-semibold text-stone-200 mb-1">
                Your Spoken Reflection Space
              </h4>
              <p className="text-xs text-stone-400 max-w-md mb-4">
                Start talking naturally about anything on your mind. You can also tap one of these prompts to guide your conversation:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
                {REFLECTION_PROMPTS.map((prompt, idx) => (
                  <button
                    key={idx}
                    disabled={!isConnected}
                    onClick={() => handleSendPrompt(prompt)}
                    className="text-left p-2.5 rounded-xl bg-stone-950/80 border border-stone-800/80 hover:border-amber-500/40 text-stone-300 hover:text-amber-300 text-xs transition-colors flex items-start justify-between gap-2 disabled:opacity-40 cursor-pointer"
                  >
                    <span>{prompt}</span>
                    <ArrowRight className="w-3 h-3 text-amber-400/60 shrink-0 mt-0.5" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Conversation Transcript Feed */}
          {(transcript.length > 0 || currentPartialUserText || currentPartialModelText) && (
            <div className="flex-1 overflow-y-auto space-y-3.5 my-4 pr-1 max-h-[380px]">
              {transcript.map((item) => (
                <div
                  key={item.id}
                  className={`flex flex-col ${item.speaker === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div className="flex items-center gap-1.5 mb-1 px-1 text-[11px] text-stone-400">
                    <span className="font-semibold text-stone-300">
                      {item.speaker === 'user' ? 'You' : `Gemini (${selectedVoice})`}
                    </span>
                    <span>•</span>
                    <span className="font-mono text-[10px]">
                      {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div
                    className={`p-3 rounded-2xl text-xs leading-relaxed max-w-[85%] ${
                      item.speaker === 'user'
                        ? 'bg-amber-500 text-stone-950 font-medium rounded-tr-none'
                        : 'bg-stone-950 border border-stone-800 text-stone-200 rounded-tl-none'
                    }`}
                  >
                    {item.text}
                  </div>
                </div>
              ))}

              {/* Streaming Interim Transcriptions */}
              {currentPartialUserText && (
                <div className="flex flex-col items-end opacity-75">
                  <span className="text-[10px] text-amber-400/80 font-mono mb-1">Transcribing speech...</span>
                  <div className="p-3 rounded-2xl bg-amber-500/40 text-stone-100 text-xs italic max-w-[85%]">
                    {currentPartialUserText}
                  </div>
                </div>
              )}

              {currentPartialModelText && (
                <div className="flex flex-col items-start opacity-75">
                  <span className="text-[10px] text-amber-400/80 font-mono mb-1">Gemini responding...</span>
                  <div className="p-3 rounded-2xl bg-stone-950/60 border border-stone-800 text-stone-300 text-xs italic max-w-[85%]">
                    {currentPartialModelText}
                  </div>
                </div>
              )}

              <div ref={transcriptEndRef} />
            </div>
          )}

          {/* Reflection Export & Journal Vault Actions */}
          <div className="pt-4 border-t border-stone-800 flex flex-wrap items-center justify-between gap-2 mt-auto">
            <button
              onClick={handleSaveSessionLog}
              disabled={transcript.length === 0}
              className="px-3 py-2 rounded-xl text-xs font-medium text-stone-300 bg-stone-950 hover:bg-stone-800 border border-stone-800 transition-colors flex items-center gap-1.5 disabled:opacity-40 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5 text-stone-400" />
              <span>Save Session Log</span>
            </button>

            <div className="flex items-center gap-2">
              {activeEntry && (
                <button
                  onClick={() => handleSynthesizeToJournal('append')}
                  disabled={transcript.length === 0 || isSynthesizing}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 transition-all flex items-center gap-1.5 disabled:opacity-40 cursor-pointer"
                >
                  {isSynthesizing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BookOpen className="w-3.5 h-3.5" />}
                  <span>Append to Active Entry</span>
                </button>
              )}

              <button
                id="synthesize-journal-entry-btn"
                onClick={() => handleSynthesizeToJournal('new')}
                disabled={transcript.length === 0 || isSynthesizing}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-stone-950 flex items-center gap-1.5 shadow-md shadow-amber-500/10 transition-all active:scale-[0.98] disabled:opacity-40 cursor-pointer"
              >
                {isSynthesizing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Synthesizing Reflection...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Save as New Journal Entry</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Saved Voice Reflection Sessions Drawer / Modal */}
      {showHistory && (
        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-6 shadow-2xl">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-400" />
              <h3 className="text-base font-semibold text-stone-100">
                Your Saved Voice Reflection Sessions
              </h3>
            </div>
            <button
              onClick={() => setShowHistory(false)}
              className="text-xs text-stone-400 hover:text-stone-200 px-2.5 py-1 rounded-lg border border-stone-800 hover:bg-stone-800 transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>

          {savedSessions.length === 0 ? (
            <p className="text-xs text-stone-500 italic py-4">
              No saved voice reflection sessions yet. Have a voice conversation with Gemini and click "Save Session Log" to archive it here.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-72 overflow-y-auto pr-1">
              {savedSessions.map((session) => (
                <div
                  key={session.id}
                  className="bg-stone-950 border border-stone-800/80 rounded-xl p-3.5 flex flex-col justify-between hover:border-amber-500/30 transition-colors"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="text-xs font-semibold text-stone-200 truncate">
                        {session.title}
                      </span>
                      <span className="text-[10px] font-mono text-stone-400 px-1.5 py-0.5 rounded bg-stone-900 border border-stone-800 shrink-0">
                        {formatTimer(session.durationSeconds)}
                      </span>
                    </div>
                    <p className="text-[11px] text-stone-400 line-clamp-2 mb-2">
                      {session.summary || 'Spoken reflection session with Gemini Live.'}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-stone-800/60 text-[11px]">
                    <span className="text-stone-500 font-mono">
                      {new Date(session.createdAt).toLocaleDateString()}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setTranscript(session.transcript || []);
                          setShowHistory(false);
                        }}
                        className="text-amber-400 hover:text-amber-300 font-medium cursor-pointer"
                      >
                        Load Transcript
                      </button>
                      <button
                        onClick={async () => {
                          try {
                            await deleteVoiceSession(userId, session.id);
                            setSavedSessions((prev) => prev.filter((s) => s.id !== session.id));
                          } catch (err: any) {
                            onError({ hasError: true, message: `Could not delete session: ${err.message}` });
                          }
                        }}
                        className="text-stone-500 hover:text-rose-400 p-1 cursor-pointer"
                        title="Delete log"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
