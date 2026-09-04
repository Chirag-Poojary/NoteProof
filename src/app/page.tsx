"use client";

import { useState, useCallback, useEffect } from "react";
import CameraViewfinder from "@/components/CameraViewfinder";
import CaptureButton from "@/components/CaptureButton";
import ResultModal from "@/components/ResultModal";
import ErrorToast from "@/components/ErrorToast";
import CameraSplash from "@/components/CameraSplash";
import DetectionOverlay from "@/components/DetectionOverlay";
import { useCamera } from "@/lib/useCamera";
import { useNoteProofPipeline } from "@/lib/useNoteProofPipeline";

export default function ScannerPage() {
  const {
    videoRef,
    isReady: cameraReady,
    error: cameraError,
    errorMessage: cameraErrorMsg,
    startCamera,
  } = useCamera();

  const { state: pipelineState, resetState, capture } = useNoteProofPipeline();

  // Whether the user has tapped "Allow Camera" yet
  const [cameraStarted, setCameraStarted] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // ── Called by splash screen button ──────────────────────────────────────
  const handleStartCamera = useCallback(() => {
    setCameraStarted(true);
    startCamera();
  }, [startCamera]);

  // ── Handle Capture ────────────────────────────────────────────────────────
  const handleCapture = useCallback(async () => {
    if (!cameraReady || pipelineState.stage === "detecting" || pipelineState.stage === "classifying") {
      return;
    }
    setToastMsg(null);
    await capture(videoRef.current);
  }, [cameraReady, pipelineState.stage, capture, videoRef]);

  // ── React to Pipeline State transitions ────────────────────────────────────
  useEffect(() => {
    if (pipelineState.stage === "done") {
      setModalOpen(true);
    } else if (pipelineState.stage === "not_found") {
      setToastMsg("No note detected — please frame the currency note and retake.");
    } else if (pipelineState.stage === "error") {
      setToastMsg(pipelineState.message);
    }
  }, [pipelineState]);

  const handleCloseModal = useCallback(() => {
    setModalOpen(false);
    resetState();
  }, [resetState]);

  const handleDismissToast = useCallback(() => {
    setToastMsg(null);
    if (pipelineState.stage === "not_found" || pipelineState.stage === "error") {
      resetState();
    }
  }, [pipelineState.stage, resetState]);

  const isProcessing =
    pipelineState.stage === "detecting" ||
    pipelineState.stage === "classifying" ||
    pipelineState.stage === "detected";

  const boxedImage =
    pipelineState.stage === "detected" ||
    pipelineState.stage === "classifying" ||
    pipelineState.stage === "done"
      ? pipelineState.boxedImage
      : null;

  const classificationResult =
    pipelineState.stage === "done" ? pipelineState.result : null;

  return (
    <main id="scanner-main" className="scanner-root" aria-label="Currency scanner">
      {!cameraStarted && (
        <div className="absolute inset-0 z-50 bg-white">
          <CameraSplash onStart={handleStartCamera} />
        </div>
      )}

      {/* Main Viewfinder / Detection Overlay */}
      {boxedImage && (pipelineState.stage === "detected" || pipelineState.stage === "classifying") ? (
        <div className="absolute inset-0 z-10 p-4 pb-28 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <DetectionOverlay boxedImage={boxedImage} />
        </div>
      ) : (
        <CameraViewfinder videoRef={videoRef} isReady={cameraReady} />
      )}

      {/* App Header */}
      <header className="app-header" role="banner">
        <div className="flex flex-col items-center gap-1 mt-2">
          <div className="app-badge">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#16a34a"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M6 3h12" />
              <path d="M6 8h12" />
              <path d="m6 13 8.5 8" />
              <path d="M6 13h3" />
              <path d="M9 13c6.667 0 6.667-10 0-10" />
            </svg>
            <span className="tracking-wide">NoteProof</span>
          </div>
          <span className="text-[10px] font-bold tracking-widest uppercase text-gray-800 bg-white/80 px-2 py-0.5 rounded-full shadow-sm backdrop-blur-md border border-gray-200">
            Two-Model AI Verification
          </span>
        </div>
      </header>

      {/* Loading indicator overlay during inference steps */}
      {isProcessing && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 z-40 bg-gray-900/90 text-white px-5 py-2.5 rounded-full shadow-xl backdrop-blur-md border border-white/10 flex items-center gap-3">
          <div className="w-4 h-4 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-bold tracking-wide">
            {pipelineState.stage === "detecting" && "Detecting note…"}
            {pipelineState.stage === "detected" && "Note located!"}
            {pipelineState.stage === "classifying" && "Verifying authenticity…"}
          </span>
        </div>
      )}

      {/* Camera Permission or Failure Alert */}
      {cameraError && (
        <div className="camera-error-panel" role="alert">
          {cameraError === "NOT_ALLOWED" ? (
            <div className="flex flex-col text-left">
              <h3 className="text-xl font-black text-gray-900 mb-3">Camera Blocked</h3>
              <p className="text-sm font-medium text-gray-600 mb-6 leading-relaxed">
                Your browser has blocked camera access. The app cannot ask for permission again automatically.
                <br />
                <br />
                <strong>To fix this:</strong>
                <br />1. Tap the lock icon 🔒 (or settings menu) in your URL bar.
                <br />2. Go to <strong>Permissions</strong> and Allow camera.
                <br />3. Tap reload below.
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

      {/* Capture trigger button */}
      <CaptureButton
        onCapture={handleCapture}
        isLoading={isProcessing}
        disabled={!cameraReady || isProcessing}
      />

      {/* Results bottom sheet modal */}
      <ResultModal
        result={classificationResult}
        previewImage={boxedImage}
        isOpen={modalOpen}
        onClose={handleCloseModal}
      />

      {/* Toast notifications */}
      <ErrorToast
        message={toastMsg ?? (cameraErrorMsg && !modalOpen ? cameraErrorMsg : null)}
        onDismiss={handleDismissToast}
      />
    </main>
  );
}
