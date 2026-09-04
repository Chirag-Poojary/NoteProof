"use client";

import React, { useMemo } from "react";
import type { DetectionBox } from "@/lib/modelConfig";

interface DetectionOverlayProps {
  boxedImage: string;
  className?: string;
}

/**
 * generateBoxedImageDataUrl
 * Takes raw full-frame canvas and a DetectionBox, draws a high-visibility accent rectangle
 * around the detected note, and returns a data URL.
 */
export function generateBoxedImageDataUrl(
  sourceCanvas: HTMLCanvasElement,
  box: DetectionBox
): string {
  const canvas = document.createElement("canvas");
  canvas.width = sourceCanvas.width;
  canvas.height = sourceCanvas.height;

  const ctx = canvas.getContext("2d");
  if (!ctx) return sourceCanvas.toDataURL("image/jpeg", 0.85);

  // Draw full original frame
  ctx.drawImage(sourceCanvas, 0, 0);

  // Bounding box styling matching app accent
  ctx.strokeStyle = "#16a34a"; // emerald green matching NoteProof accent
  ctx.lineWidth = Math.max(3, Math.round(sourceCanvas.width / 200));
  ctx.strokeRect(box.x, box.y, box.w, box.h);

  // Corner highlights for visual polish
  const cornerLen = Math.min(24, Math.min(box.w, box.h) * 0.2);
  ctx.strokeStyle = "#22c55e";
  ctx.lineWidth = ctx.lineWidth * 1.5;

  // Top-left
  ctx.beginPath();
  ctx.moveTo(box.x, box.y + cornerLen);
  ctx.lineTo(box.x, box.y);
  ctx.lineTo(box.x + cornerLen, box.y);
  ctx.stroke();

  // Top-right
  ctx.beginPath();
  ctx.moveTo(box.x + box.w - cornerLen, box.y);
  ctx.lineTo(box.x + box.w, box.y);
  ctx.lineTo(box.x + box.w, box.y + cornerLen);
  ctx.stroke();

  // Bottom-left
  ctx.beginPath();
  ctx.moveTo(box.x, box.y + box.h - cornerLen);
  ctx.lineTo(box.x, box.y + box.h);
  ctx.lineTo(box.x + cornerLen, box.y + box.h);
  ctx.stroke();

  // Bottom-right
  ctx.beginPath();
  ctx.moveTo(box.x + box.w - cornerLen, box.y + box.h);
  ctx.lineTo(box.x + box.w, box.y + box.h);
  ctx.lineTo(box.x + box.w, box.y + box.h - cornerLen);
  ctx.stroke();

  return canvas.toDataURL("image/jpeg", 0.9);
}

/**
 * DetectionOverlay Component
 * Displays the visual confirmation preview of the detected note frame with bounding box.
 */
export default function DetectionOverlay({
  boxedImage,
  className = "",
}: DetectionOverlayProps) {
  return (
    <div
      className={`relative w-full h-full flex items-center justify-center overflow-hidden rounded-2xl bg-black ${className}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={boxedImage}
        alt="Detected note bounding box preview"
        className="w-full h-full object-contain shadow-2xl"
      />
      <div className="absolute top-4 left-4 bg-emerald-600/90 text-white text-xs font-bold px-3 py-1.5 rounded-full backdrop-blur-md shadow-md flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-emerald-300 animate-ping" />
        Note Detected
      </div>
    </div>
  );
}
