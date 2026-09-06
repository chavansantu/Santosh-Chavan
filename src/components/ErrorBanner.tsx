import { AlertTriangle, RefreshCw, X } from 'lucide-react';
import { SaveErrorState } from '../types';

interface ErrorBannerProps {
  error: SaveErrorState;
  onDismiss: () => void;
}

export function ErrorBanner({ error, onDismiss }: ErrorBannerProps) {
  if (!error.hasError) return null;

  return (
    <div
      role="alert"
      className="w-full mb-4 p-4 rounded-xl bg-amber-950/90 border border-amber-800/80 text-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <p className="font-medium text-stone-100 text-sm">Persistence Warning</p>
          <p className="text-xs text-amber-300/90 mt-0.5">{error.message}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 self-end sm:self-center">
        {error.retryAction && (
          <button
            id="retry-save-btn"
            onClick={error.retryAction}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500 hover:bg-amber-400 text-stone-950 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry Save</span>
          </button>
        )}
        <button
          onClick={onDismiss}
          className="p-1.5 text-stone-400 hover:text-stone-200 rounded-lg hover:bg-amber-900/40 transition-colors cursor-pointer"
          title="Dismiss warning"
        >
          <X className="w-4 h-4" />
          <span className="sr-only">Dismiss</span>
        </button>
      </div>
    </div>
  );
}
