"use client";

import React, { useEffect, useRef, useCallback } from "react";
import type { InferenceResult, ClassificationResult } from "@/lib/modelConfig";

interface ResultModalProps {
  result: InferenceResult | ClassificationResult | null;
  previewImage?: string | null;
  thumbnail?: string | null; // legacy fallback
  isOpen: boolean;
  onClose: () => void;
}

/**
 * ResultModal
 * Slide-up bottom sheet displaying denomination, confidence, and authenticity.
 * Supports swipe-down gesture, Escape key, and backdrop tap to dismiss.
 */
export default function ResultModal({
  result,
  previewImage,
  thumbnail,
  isOpen,
  onClose,
}: ResultModalProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef<number>(0);
  const dragCurrentY = useRef<number>(0);

  const displayImage = previewImage ?? thumbnail;

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  // Focus trap: move focus into dialog when it opens
  useEffect(() => {
    if (isOpen && sheetRef.current) {
      sheetRef.current.focus();
    }
  }, [isOpen]);

  // Swipe-down to dismiss
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    dragStartY.current = e.touches[0].clientY;
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    const delta = e.touches[0].clientY - dragStartY.current;
    dragCurrentY.current = delta;
    if (delta > 0 && sheetRef.current) {
      sheetRef.current.style.transform = `translateY(${delta}px)`;
    }
  }, []);

  const onTouchEnd = useCallback(() => {
    if (dragCurrentY.current > 100) {
      onClose();
    } else if (sheetRef.current) {
      sheetRef.current.style.transform = "";
    }
    dragCurrentY.current = 0;
  }, [onClose]);

  if (!result) return null;

  const confidencePct = Math.round(result.denominationConfidence * 100);
  const authPct = Math.round(result.authenticityScore * 100);
  const authStatus = result.authStatus ?? (result.authenticityScore >= 0.5 ? "genuine" : "fake");

  return (
    <>
      {/* Backdrop */}
      <div
        className={`modal-backdrop${isOpen ? " modal-backdrop--visible" : ""}`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Bottom sheet */}
      <div
        id="result-modal"
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        aria-describedby="modal-desc"
        tabIndex={-1}
        className={`modal-sheet${isOpen ? " modal-sheet--open" : ""}`}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* Drag handle */}
        <div className="modal-sheet__handle" aria-hidden="true" />

        {/* Close button */}
        <button
          id="modal-close-btn"
          onClick={onClose}
          aria-label="Close results"
          className="modal-sheet__close"
        >
          ✕
        </button>

        {/* Header row */}
        <div className="modal-sheet__header">
          {displayImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={displayImage}
              alt="Captured currency note thumbnail"
              className="modal-sheet__thumb"
              width={80}
              height={80}
            />
          )}

          <div className="modal-sheet__headline">
            <h2 id="modal-title" className="modal-sheet__denomination">
              {result.denomination}
            </h2>
            <p id="modal-desc" className="modal-sheet__subtitle">
              Indian Rupee Note
            </p>
          </div>

          {/* Genuine / Fake / Uncertain chip */}
          {authStatus === "uncertain" ? (
            <div
              className="authenticity-chip authenticity-chip--uncertain"
              aria-label="Note authenticity is uncertain — retake in better light"
            >
              <span className="authenticity-chip__dot" aria-hidden="true" />
              Uncertain — retake
            </div>
          ) : (
            <div
              className={`authenticity-chip ${authStatus === "genuine" ? "authenticity-chip--genuine" : "authenticity-chip--fake"}`}
              aria-label={`Note is ${authStatus === "genuine" ? "genuine" : "fake"}`}
            >
              <span className="authenticity-chip__dot" aria-hidden="true" />
              {authStatus === "genuine" ? "Genuine" : "Fake"}
            </div>
          )}
        </div>

        {/* Confidence bars */}
        <div className="modal-sheet__bars">
          {/* Denomination confidence */}
          <div className="confidence-row">
            <div className="confidence-row__labels">
              <span className="confidence-row__name">Denomination</span>
              <span className="confidence-row__pct">{confidencePct}%</span>
            </div>
            <div
              className="confidence-row__track"
              role="progressbar"
              aria-valuenow={confidencePct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Denomination confidence ${confidencePct}%`}
            >
              <div
                className="confidence-row__fill"
                style={{ width: `${confidencePct}%` }}
              />
            </div>
          </div>

          {/* Authenticity confidence */}
          <div className="confidence-row">
            <div className="confidence-row__labels">
              <span className="confidence-row__name">Authenticity</span>
              <span className="confidence-row__pct">{authPct}%</span>
            </div>
            <div
              className="confidence-row__track"
              role="progressbar"
              aria-valuenow={authPct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Authenticity confidence ${authPct}%`}
            >
              <div
                className="confidence-row__fill"
                style={{ width: `${authPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Disclaimer */}
        <p className="modal-sheet__disclaimer">
          Results are AI-generated estimates. Always verify with an official
          source.
        </p>
      </div>
    </>
  );
}
