import { useState, useRef, useEffect } from 'react';
import {
  Image as ImageIcon,
  Sparkles,
  Wand2,
  Download,
  Upload,
  Loader2,
  RefreshCw,
  PlusCircle,
  FileImage,
  Layers,
  BookOpen,
  CheckCircle2,
  Sliders
} from 'lucide-react';
import { GeneratedImageRecord, JournalEntry, SaveErrorState } from '../types';
import { saveGeneratedImageRecord, fetchUserGeneratedImages } from '../lib/firestoreService';

interface ImageStudioProps {
  userId: string;
  activeEntry: JournalEntry | null;
  onAttachImageToEntry?: (imageUrl: string) => void;
  onError: (err: SaveErrorState) => void;
}

const PRESET_PROMPTS = [
  'A tranquil minimalist Japanese Zen rock garden with cherry blossom petals and morning mist',
  'A quiet lakeside mountain cabin bathed in golden hour sunrise light, soft watercolor style',
  'A cozy rainy cafe window with steam rising from a ceramic tea cup, cinematic lighting',
  'An ethereal forest trail with warm sunbeams breaking through tall redwood trees, serene atmosphere',
  'A calm ocean horizon under twilight with gentle glowing bioluminescent waves',
];

const ASPECT_RATIOS = [
  { id: '1:1', label: '1:1 (Square)' },
  { id: '16:9', label: '16:9 (Landscape)' },
  { id: '9:16', label: '9:16 (Portrait)' },
  { id: '4:3', label: '4:3 (Classic)' },
  { id: '3:4', label: '3:4 (Tall)' },
];

export function ImageStudio({
  userId,
  activeEntry,
  onAttachImageToEntry,
  onError,
}: ImageStudioProps) {
  const [mode, setMode] = useState<'create' | 'edit'>('create');
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [generating, setGenerating] = useState(false);
  const [currentImage, setCurrentImage] = useState<GeneratedImageRecord | null>(null);
  const [userGallery, setUserGallery] = useState<GeneratedImageRecord[]>([]);
  const [loadingGallery, setLoadingGallery] = useState(false);

  // Edit mode state
  const [imageToEdit, setImageToEdit] = useState<string | null>(null);
  const [editPrompt, setEditPrompt] = useState('');
  const [attachedNotice, setAttachedNotice] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load user generated images on mount
  useEffect(() => {
    let isMounted = true;
    const loadGallery = async () => {
      setLoadingGallery(true);
      try {
        const records = await fetchUserGeneratedImages(userId);
        if (isMounted) {
          setUserGallery(records);
          if (records.length > 0 && !currentImage) {
            setCurrentImage(records[0]);
          }
        }
      } catch (err: any) {
        console.warn('Could not load user images:', err);
      } finally {
        if (isMounted) setLoadingGallery(false);
      }
    };
    loadGallery();
    return () => {
      isMounted = false;
    };
  }, [userId]);

  // Handle Text-to-Image Generation
  const handleGenerateImage = async () => {
    if (!prompt.trim() || generating) return;

    setGenerating(true);
    setAttachedNotice(null);

    try {
      const response = await fetch('/api/gemini/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt.trim(),
          aspectRatio,
        }),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || `Server returned ${response.status}`);
      }

      const data = await response.json();

      // Persist to Cloud Firestore under /users/{uid}/images
      const record: Omit<GeneratedImageRecord, 'userId'> = {
        id: `img_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        prompt: prompt.trim(),
        imageUrl: data.imageUrl,
        aspectRatio,
        modelUsed: data.modelUsed || 'gemini-3.1-flash-image-preview',
        isEdit: false,
        createdAt: Date.now(),
      };

      const saved = await saveGeneratedImageRecord(userId, record);
      setCurrentImage(saved);
      setUserGallery((prev) => [saved, ...prev]);
    } catch (err: any) {
      console.error('Image generation error:', err);
      onError({
        hasError: true,
        message: `Image generation failed: ${err.message}`,
        retryAction: handleGenerateImage,
      });
    } finally {
      setGenerating(false);
    }
  };

  // Handle Image-to-Image Editing
  const handleEditImage = async () => {
    if (!imageToEdit || !editPrompt.trim() || generating) return;

    setGenerating(true);
    setAttachedNotice(null);

    try {
      const response = await fetch('/api/gemini/edit-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          base64ImageData: imageToEdit,
          prompt: editPrompt.trim(),
        }),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || `Server returned ${response.status}`);
      }

      const data = await response.json();

      // Persist to Cloud Firestore
      const record: Omit<GeneratedImageRecord, 'userId'> = {
        id: `img_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        prompt: editPrompt.trim(),
        imageUrl: data.imageUrl,
        aspectRatio: '1:1',
        modelUsed: data.modelUsed || 'gemini-3.1-flash-image-preview',
        isEdit: true,
        createdAt: Date.now(),
      };

      const saved = await saveGeneratedImageRecord(userId, record);
      setCurrentImage(saved);
      setUserGallery((prev) => [saved, ...prev]);
    } catch (err: any) {
      console.error('Image edit error:', err);
      onError({
        hasError: true,
        message: `Image edit failed: ${err.message}`,
        retryAction: handleEditImage,
      });
    } finally {
      setGenerating(false);
    }
  };

  // Handle file upload for editing
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please upload a valid image file (PNG, JPG, WebP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setImageToEdit(result);
    };
    reader.readAsDataURL(file);
  };

  // Download image helper
  const handleDownload = (imageUrl: string, promptText: string) => {
    const a = document.createElement('a');
    a.href = imageUrl;
    a.download = `reflection-${promptText.slice(0, 20).replace(/[^a-z0-9]/gi, '_') || 'image'}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Attach to active journal entry
  const handleAttachToEntry = (imageUrl: string) => {
    if (onAttachImageToEntry) {
      onAttachImageToEntry(imageUrl);
      setAttachedNotice('Image successfully attached to current Journal Entry!');
      setTimeout(() => setAttachedNotice(null), 4000);
    }
  };

  return (
    <div className="flex flex-col h-full bg-stone-900 border border-stone-800 rounded-2xl overflow-hidden shadow-xl">
      {/* Header Bar */}
      <div className="p-3.5 bg-stone-950 border-b border-stone-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <ImageIcon className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-stone-100 flex items-center gap-2">
              Visual Reflections Studio
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-stone-800 text-stone-300 border border-stone-700">
                gemini-3.1-flash-image-preview
              </span>
            </h2>
            <p className="text-xs text-stone-400">
              Transform written reflections into visual mindfulness imagery or edit existing scenes
            </p>
          </div>
        </div>

        {/* Mode switcher tabs */}
        <div className="inline-flex rounded-lg p-0.5 bg-stone-900 border border-stone-800">
          <button
            onClick={() => setMode('create')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
              mode === 'create'
                ? 'bg-amber-500 text-stone-950 font-semibold'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Create</span>
          </button>
          <button
            onClick={() => {
              setMode('edit');
              if (!imageToEdit && currentImage) {
                setImageToEdit(currentImage.imageUrl);
              }
            }}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
              mode === 'edit'
                ? 'bg-amber-500 text-stone-950 font-semibold'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <Wand2 className="w-3.5 h-3.5" />
            <span>Edit</span>
          </button>
        </div>
      </div>

      {/* Main Studio Body: Controls + Preview */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-0 overflow-y-auto">
        {/* Left Column: Input Form (5 cols) */}
        <div className="lg:col-span-5 p-4 border-b lg:border-b-0 lg:border-r border-stone-800 flex flex-col justify-between space-y-4">
          {mode === 'create' ? (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-stone-300 mb-1.5">
                  Reflective Image Prompt
                </label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Describe a serene visual scene or symbolic representation of your reflection..."
                  rows={4}
                  className="w-full bg-stone-950 border border-stone-800 focus:border-amber-500 text-stone-100 placeholder-stone-500 text-xs sm:text-sm rounded-xl p-3 focus:outline-hidden transition-colors resize-none"
                />
              </div>

              {/* Aspect Ratio selector */}
              <div>
                <label className="block text-xs font-medium text-stone-400 mb-1.5 flex items-center gap-1">
                  <Sliders className="w-3.5 h-3.5 text-amber-400" />
                  <span>Aspect Ratio</span>
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                  {ASPECT_RATIOS.map((ar) => (
                    <button
                      key={ar.id}
                      type="button"
                      onClick={() => setAspectRatio(ar.id)}
                      className={`px-2 py-1.5 rounded-lg text-xs font-medium transition-colors text-center cursor-pointer ${
                        aspectRatio === ar.id
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50'
                          : 'bg-stone-950 text-stone-400 border border-stone-800 hover:border-stone-700'
                      }`}
                    >
                      {ar.id}
                    </button>
                  ))}
                </div>
              </div>

              {/* Inspiration Presets */}
              <div>
                <p className="text-[11px] font-medium text-stone-400 mb-1.5">Suggested Inspiration:</p>
                <div className="space-y-1.5">
                  {PRESET_PROMPTS.map((sample, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setPrompt(sample)}
                      className="w-full text-left p-2 rounded-lg bg-stone-950/70 border border-stone-850 hover:border-amber-500/40 text-[11px] text-stone-300 hover:text-stone-100 transition-colors line-clamp-1 cursor-pointer"
                    >
                      "{sample}"
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleGenerateImage}
                disabled={!prompt.trim() || generating}
                className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-stone-950 font-semibold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md active:scale-98"
              >
                {generating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Synthesizing Image with gemini-3.1-flash-image-preview...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Generate Visual Reflection</span>
                  </>
                )}
              </button>
            </div>
          ) : (
            /* Edit Mode Form */
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-stone-300 mb-1.5">
                  Select or Upload Image to Edit
                </label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 py-2 rounded-xl bg-stone-950 border border-stone-800 hover:border-amber-500/50 text-xs font-medium text-stone-300 hover:text-stone-100 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5 text-amber-400" />
                    <span>Upload Local Image</span>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </div>
              </div>

              {/* Image thumbnail to edit */}
              {imageToEdit && (
                <div className="relative rounded-xl overflow-hidden border border-stone-800 max-h-36 bg-stone-950 flex items-center justify-center">
                  <img
                    src={imageToEdit}
                    alt="Source to edit"
                    className="max-h-36 object-contain"
                  />
                  <span className="absolute bottom-1 right-1 px-2 py-0.5 rounded bg-stone-950/80 text-[10px] text-stone-300 border border-stone-700">
                    Source
                  </span>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-stone-300 mb-1.5">
                  Edit Instructions
                </label>
                <textarea
                  value={editPrompt}
                  onChange={(e) => setEditPrompt(e.target.value)}
                  placeholder="e.g., 'Add a warm golden sunrise on the water and soft falling petals', 'Convert into a Japanese woodblock print style'..."
                  rows={3}
                  className="w-full bg-stone-950 border border-stone-800 focus:border-amber-500 text-stone-100 placeholder-stone-500 text-xs sm:text-sm rounded-xl p-3 focus:outline-hidden transition-colors resize-none"
                />
              </div>

              <button
                onClick={handleEditImage}
                disabled={!imageToEdit || !editPrompt.trim() || generating}
                className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-stone-950 font-semibold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md active:scale-98"
              >
                {generating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Applying Edits with gemini-3.1-flash-image-preview...</span>
                  </>
                ) : (
                  <>
                    <Wand2 className="w-4 h-4" />
                    <span>Apply AI Edit to Image</span>
                  </>
                )}
              </button>
            </div>
          )}

          {attachedNotice && (
            <div className="p-2.5 rounded-xl bg-emerald-950/80 border border-emerald-800/80 text-xs text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{attachedNotice}</span>
            </div>
          )}
        </div>

        {/* Right Column: Active Canvas & Gallery (7 cols) */}
        <div className="lg:col-span-7 p-4 flex flex-col justify-between space-y-4">
          {/* Active Canvas Display */}
          <div className="flex-1 min-h-[260px] max-h-[380px] bg-stone-950 border border-stone-850 rounded-2xl flex flex-col items-center justify-center relative overflow-hidden group">
            {currentImage ? (
              <>
                <img
                  src={currentImage.imageUrl}
                  alt={currentImage.prompt}
                  className="max-h-[350px] w-auto max-w-full object-contain"
                />

                {/* Floating controls on hover */}
                <div className="absolute top-2 right-2 flex items-center gap-1.5 opacity-90 group-hover:opacity-100 transition-opacity bg-stone-950/80 backdrop-blur-xs p-1 rounded-xl border border-stone-800">
                  <button
                    onClick={() => handleDownload(currentImage.imageUrl, currentImage.prompt)}
                    title="Download PNG"
                    className="p-1.5 rounded-lg text-stone-300 hover:text-stone-100 hover:bg-stone-800 transition-colors cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  {onAttachImageToEntry && (
                    <button
                      onClick={() => handleAttachToEntry(currentImage.imageUrl)}
                      title="Attach to Active Journal Entry"
                      className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-semibold transition-colors cursor-pointer"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>Attach to Entry</span>
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setImageToEdit(currentImage.imageUrl);
                      setMode('edit');
                    }}
                    title="Edit this image"
                    className="p-1.5 rounded-lg text-stone-300 hover:text-stone-100 hover:bg-stone-800 transition-colors cursor-pointer"
                  >
                    <Wand2 className="w-4 h-4 text-amber-400" />
                  </button>
                </div>

                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-stone-950 via-stone-950/80 to-transparent p-3 pt-6">
                  <p className="text-xs text-stone-200 line-clamp-1 font-medium">
                    {currentImage.prompt}
                  </p>
                  <p className="text-[10px] text-stone-400 font-mono mt-0.5 flex items-center gap-2">
                    <span>Model: {currentImage.modelUsed}</span>
                    <span>Ratio: {currentImage.aspectRatio}</span>
                    {currentImage.isEdit && <span className="text-amber-400">Edited Scene</span>}
                  </p>
                </div>
              </>
            ) : (
              <div className="text-center p-6 space-y-2">
                <FileImage className="w-10 h-10 text-stone-700 mx-auto" />
                <p className="text-xs text-stone-400">
                  No visual generated yet. Type a prompt on the left to begin.
                </p>
              </div>
            )}
          </div>

          {/* User Gallery Carousel */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-stone-300 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-amber-400" />
                <span>Your Firestore Reflections Gallery ({userGallery.length})</span>
              </p>
              {loadingGallery && (
                <span className="text-[10px] text-stone-500">Loading gallery...</span>
              )}
            </div>

            {userGallery.length > 0 ? (
              <div className="flex items-center gap-2.5 overflow-x-auto pb-2 scrollbar-thin">
                {userGallery.map((item) => {
                  const isSelected = currentImage?.id === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setCurrentImage(item)}
                      className={`relative w-16 h-16 rounded-xl overflow-hidden shrink-0 border transition-all cursor-pointer group ${
                        isSelected
                          ? 'border-amber-500 ring-2 ring-amber-500/30'
                          : 'border-stone-800 hover:border-stone-650 opacity-80 hover:opacity-100'
                      }`}
                    >
                      <img
                        src={item.imageUrl}
                        alt={item.prompt}
                        className="w-full h-full object-cover"
                      />
                      {item.isEdit && (
                        <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-amber-400" />
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-[11px] text-stone-500 italic">
                Images created will persist securely in your Cloud Firestore vault.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
