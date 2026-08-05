"use client";

import React from "react";

interface CameraViewfinderProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isReady: boolean;
}

/**
 * CameraViewfinder
 * Full-screen <video> with a minimalist corner-bracket aiming reticle overlay.
 */
export default function CameraViewfinder({
  videoRef,
  isReady,
}: CameraViewfinderProps) {
  return (
    <div className="viewfinder" role="img" aria-label="Live camera viewfinder">
      {/* Video stream */}
      <video
        ref={videoRef}
        className="viewfinder__video"
        autoPlay
        playsInline
        muted
        aria-hidden="true"
      />

      {/* Loading skeleton shown before stream starts */}
      {!isReady && (
        <div className="viewfinder__skeleton" aria-hidden="true">
          <div className="viewfinder__skeleton-pulse" />
          <p className="viewfinder__skeleton-text">Starting camera…</p>
        </div>
      )}

      {/* Corner bracket reticle */}
      {isReady && (
        <div className="reticle" aria-hidden="true">
          {/* top-left */}
          <span className="reticle__corner reticle__corner--tl" />
          {/* top-right */}
          <span className="reticle__corner reticle__corner--tr" />
          {/* bottom-left */}
          <span className="reticle__corner reticle__corner--bl" />
          {/* bottom-right */}
          <span className="reticle__corner reticle__corner--br" />
          {/* Scan line */}
          <span className="reticle__scanline" />
        </div>
      )}

      {/* Top gradient overlay for status bar contrast on mobile */}
      <div className="viewfinder__top-vignette" aria-hidden="true" />
      {/* Bottom gradient for button legibility */}
      <div className="viewfinder__bottom-vignette" aria-hidden="true" />
    </div>
  );
}
