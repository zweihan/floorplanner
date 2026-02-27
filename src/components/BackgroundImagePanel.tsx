import { useRef } from 'react';
import { useStore } from '../store';
import { screenToWorld, PPCM } from '../geometry/transforms';
import type { BackgroundImage } from '../types/plan';

export function BackgroundImagePanel() {
  const activePlanId = useStore(s => s.activePlanId);
  const plans = useStore(s => s.plans);
  const backgroundImages = useStore(s => s.backgroundImages);
  const setBackgroundImage = useStore(s => s.setBackgroundImage);
  const updateBackgroundImage = useStore(s => s.updateBackgroundImage);
  const setActiveTool = useStore(s => s.setActiveTool);
  const clearChain = useStore(s => s.clearChain);
  const setCalibrationLine = useStore(s => s.setCalibrationLine);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const bg = activePlanId ? (backgroundImages[activePlanId] ?? null) : null;
  const plan = activePlanId ? plans[activePlanId] : null;

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activePlanId || !plan) return;

    const reader = new FileReader();
    reader.onload = ev => {
      const dataUrl = ev.target?.result as string;
      const img = new Image();
      img.onload = () => {
        // Fit image into the visible canvas area (contain + center).
        // Layout: 48px left toolbar, 48px header, 24px status bar, 280px right panel.
        const vp = plan.viewport;
        const canvasPxW = window.innerWidth - 48 - 280;
        const canvasPxH = window.innerHeight - 48 - 24;
        const viewWorldW = canvasPxW / (PPCM * vp.zoom);
        const viewWorldH = canvasPxH / (PPCM * vp.zoom);

        // Scale to fit both dimensions (object-fit: contain)
        const cmPerPx = Math.min(viewWorldW / img.naturalWidth, viewWorldH / img.naturalHeight);

        // Center the image in the current viewport
        const imgWorldW = img.naturalWidth * cmPerPx;
        const imgWorldH = img.naturalHeight * cmPerPx;
        const centerWorld = screenToWorld(canvasPxW / 2, canvasPxH / 2, vp, PPCM);
        const offsetX = centerWorld.x - imgWorldW / 2;
        const offsetY = centerWorld.y - imgWorldH / 2;

        const newBg: BackgroundImage = {
          dataUrl,
          naturalWidth: img.naturalWidth,
          naturalHeight: img.naturalHeight,
          opacity: 0.4,
          visible: true,
          offsetX,
          offsetY,
          cmPerPx,
        };
        setBackgroundImage(activePlanId, newBg);
        // Auto-enter calibration mode
        clearChain();
        setCalibrationLine(null);
        setActiveTool('calibrate');
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
    // reset so same file can be re-selected
    e.target.value = '';
  };

  const handleRecalibrate = () => {
    clearChain();
    setCalibrationLine(null);
    setActiveTool('calibrate');
  };

  const handleClear = () => {
    if (!activePlanId) return;
    setBackgroundImage(activePlanId, null);
    setActiveTool('select');
  };

  if (!bg) {
    return (
      <>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleUpload}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          title="Upload reference floor plan image"
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white/90 backdrop-blur border border-gray-300 rounded shadow-sm text-xs text-gray-700 hover:bg-white hover:shadow-md transition-all"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          Ref Image
        </button>
      </>
    );
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleUpload}
      />
      <div className="flex items-center gap-1.5 px-2 py-1.5 bg-white/90 backdrop-blur border border-gray-300 rounded shadow-sm">
        {/* Visible toggle */}
        <button
          onClick={() => activePlanId && updateBackgroundImage(activePlanId, { visible: !bg.visible })}
          title={bg.visible ? 'Hide image' : 'Show image'}
          className={`w-6 h-6 rounded flex items-center justify-center text-xs transition-colors ${bg.visible ? 'text-blue-600 hover:bg-blue-50' : 'text-gray-400 hover:bg-gray-100'}`}
        >
          {bg.visible ? (
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
            </svg>
          )}
        </button>

        <div className="w-px h-4 bg-gray-200" />

        {/* Opacity slider */}
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-500 w-3">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="9" strokeWidth={2} />
            </svg>
          </span>
          <input
            type="range"
            min="5"
            max="100"
            step="5"
            value={Math.round(bg.opacity * 100)}
            onChange={e => activePlanId && updateBackgroundImage(activePlanId, { opacity: parseInt(e.target.value) / 100 })}
            className="w-16 h-1 accent-blue-600"
            title={`Opacity: ${Math.round(bg.opacity * 100)}%`}
          />
          <span className="text-xs text-gray-500 w-6 text-right">{Math.round(bg.opacity * 100)}%</span>
        </div>

        <div className="w-px h-4 bg-gray-200" />

        {/* Re-calibrate */}
        <button
          onClick={handleRecalibrate}
          title="Draw a reference line to set scale"
          className="flex items-center gap-1 px-1.5 py-0.5 text-xs text-gray-600 hover:bg-gray-100 rounded transition-colors"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
          </svg>
          Calibrate
        </button>

        {/* Replace image */}
        <button
          onClick={() => fileInputRef.current?.click()}
          title="Replace reference image"
          className="flex items-center gap-1 px-1.5 py-0.5 text-xs text-gray-600 hover:bg-gray-100 rounded transition-colors"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
        </button>

        {/* Clear */}
        <button
          onClick={handleClear}
          title="Remove reference image"
          className="flex items-center gap-1 px-1.5 py-0.5 text-xs text-red-500 hover:bg-red-50 rounded transition-colors"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </>
  );
}
