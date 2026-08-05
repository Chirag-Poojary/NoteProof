"use client";

import { useState, useCallback } from "react";
import CameraViewfinder from "@/components/CameraViewfinder";
import CaptureButton from "@/components/CaptureButton";
import ResultModal from "@/components/ResultModal";
import ErrorToast from "@/components/ErrorToast";
import CameraSplash from "@/components/CameraSplash";
import { useCamera } from "@/lib/useCamera";
import { useOnnx } from "@/lib/useOnnx";
import type { InferenceResult } from "@/lib/modelConfig";

export default function ScannerPage() {
  const {
    videoRef,
    isReady: cameraReady,
    error: cameraError,
    errorMessage: cameraErrorMsg,
    startCamera,
  } = useCamera();

  const { isLoading, error: onnxError, runInference } = useOnnx();

  // Whether the user has tapped "Allow Camera" yet
  const [cameraStarted, setCameraStarted] = useState(false);

  const [result, setResult] = useState<InferenceResult | null>(null);
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // ── Called by the splash screen button ────────────────────────────────────
  // Must be a direct click handler so Android Chrome shows the permission dialog
  const handleStartCamera = useCallback(() => {
    setCameraStarted(true);
    startCamera();
  }, [startCamera]);

  // ── Capture + infer ────────────────────────────────────────────────────────
  const handleCapture = useCallback(async () => {
    if (!cameraReady || isLoading) return;

    const video = videoRef.current;
    if (!video) return;

    const canvas = document.createElement("canvas");
    canvas.width = 224;
    canvas.height = 224;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Centre-square crop → 224×224 (matches val_transform in notebook)
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const side = Math.min(vw, vh);
    const sx = (vw - side) / 2;
    const sy = (vh - side) / 2;
    ctx.drawImage(video, sx, sy, side, side, 0, 0, 224, 224);

    setThumbnail(canvas.toDataURL("image/jpeg", 0.85));

    const inferenceResult = await runInference(canvas);
    if (!inferenceResult) {
      setToastMsg(onnxError ?? "Inference failed. Please try again.");
      return;
    }

    setResult(inferenceResult);
    setModalOpen(true);
  }, [cameraReady, isLoading, videoRef, runInference, onnxError]);

  const handleCloseModal  = useCallback(() => setModalOpen(false), []);
  const handleDismissToast = useCallback(() => setToastMsg(null), []);

  const activeError = cameraErrorMsg ?? onnxError;

  // ── Main scanner UI ────────────────────────────────────────────────────────
  return (
    <main id="scanner-main" className="scanner-root" aria-label="Currency scanner">
      {!cameraStarted && (
        <div className="absolute inset-0 z-50 bg-white">
          <CameraSplash onStart={handleStartCamera} />
        </div>
      )}

      <CameraViewfinder videoRef={videoRef} isReady={cameraReady} />

      <header className="app-header" role="banner">
        <div className="flex flex-col items-center gap-1 mt-2">
          <div className="app-badge">
            <svg
              width="20" height="20" viewBox="0 0 24 24" fill="none"
              stroke="#16a34a" strokeWidth="2.5"
              strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
            >
              <path d="M6 3h12"/>
              <path d="M6 8h12"/>
              <path d="m6 13 8.5 8"/>
              <path d="M6 13h3"/>
              <path d="M9 13c6.667 0 6.667-10 0-10"/>
            </svg>
            <span className="tracking-wide">NoteProof</span>
          </div>
          <span className="text-[10px] font-bold tracking-widest uppercase text-gray-800 bg-white/80 px-2 py-0.5 rounded-full shadow-sm backdrop-blur-md border border-gray-200">Noticing Notes</span>
        </div>
      </header>

      {cameraError && (
        <div className="camera-error-panel" role="alert">
          {cameraError === "NOT_ALLOWED" ? (
            <div className="flex flex-col text-left">
              <h3 className="text-xl font-black text-gray-900 mb-3">Camera Blocked</h3>
              <p className="text-sm font-medium text-gray-600 mb-6 leading-relaxed">
                Your browser has blocked camera access. The app cannot ask for permission again automatically.
                <br /><br />
                <strong>To fix this:</strong>
                <br />1. Tap the lock icon 🔒 (or settings menu) in your URL bar at the top of the screen.
                <br />2. Go to <strong>Permissions</strong> and Allow the camera.
                <br />3. Tap the button below to reload.
              </p>
              <button
                onClick={() => window.location.reload()}
                className="w-full rounded-xl bg-gray-950 px-6 py-4 text-[0.95rem] font-bold text-white transition-transform active:scale-95 shadow-lg"
              >
                RELOAD PAGE
              </button>
            </div>
          ) : (
            <>
              <p className="font-semibold text-gray-800">{cameraErrorMsg}</p>
              <button
                id="retry-camera-btn"
                onClick={startCamera}
                aria-label="Retry camera access"
                className="rounded-full bg-gray-950 px-8 py-3 text-sm font-bold text-white transition-transform active:scale-95 shadow-md mt-2"
              >
                RETRY
              </button>
            </>
          )}
        </div>
      )}

      <CaptureButton
        onCapture={handleCapture}
        isLoading={isLoading}
        disabled={!cameraReady || isLoading}
      />

      <ResultModal
        result={result}
        thumbnail={thumbnail}
        isOpen={modalOpen}
        onClose={handleCloseModal}
      />

      <ErrorToast
        message={toastMsg ?? (activeError && !modalOpen ? activeError : null)}
        onDismiss={handleDismissToast}
      />
    </main>
  );
}
