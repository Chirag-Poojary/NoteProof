"use client";

import React from "react";

interface CaptureButtonProps {
  onCapture: () => void;
  isLoading: boolean;
  disabled: boolean;
}

/**
 * CaptureButton
 * Circular glassmorphic shutter button fixed at the bottom-center.
 * Pulses while inference is running. Keyboard accessible.
 */
export default function CaptureButton({
  onCapture,
  isLoading,
  disabled,
}: CaptureButtonProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (!disabled) onCapture();
    }
  };

  return (
    <div className="shutter-wrap" aria-live="polite">
      <button
        id="capture-btn"
        className={`shutter-btn${isLoading ? " shutter-btn--loading" : ""}`}
        onClick={onCapture}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        aria-label={
          isLoading
            ? "Analysing currency note, please wait…"
            : "Capture and analyse currency note"
        }
        aria-busy={isLoading}
      >
        {/* Outer ring */}
        <span className="shutter-btn__ring" aria-hidden="true" />
        {/* Inner disc */}
        <span className="shutter-btn__disc" aria-hidden="true">
          {isLoading ? (
            /* Spinner arc */
            <svg
              width="28"
              height="28"
              viewBox="0 0 28 28"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="shutter-btn__spinner"
              aria-hidden="true"
            >
              <circle
                cx="14"
                cy="14"
                r="11"
                stroke="white"
                strokeOpacity="0.25"
                strokeWidth="2.5"
              />
              <path
                d="M14 3 A11 11 0 0 1 25 14"
                stroke="white"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
          ) : (
            /* Camera icon */
            <svg
              width="26"
              height="26"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
          )}
        </span>
      </button>

      <p className="shutter-label" aria-hidden="true">
        {isLoading ? "Analysing…" : "Tap to scan"}
      </p>
    </div>
  );
}
