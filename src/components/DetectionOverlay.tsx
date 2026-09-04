"use client";

import React from "react";
import type { DetectionBox } from "@/lib/modelConfig";

interface DetectionOverlayProps {
  boxedImage: string;
  className?: string;
}

/**
 * generateBoxedImageDataUrl
 * Draws high-visibility emerald green bounding box rectangle, corner brackets,
 * and a confidence badge pill over the detected note region in the raw canvas.
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

  // 1. Draw full original frame
  ctx.drawImage(sourceCanvas, 0, 0);

  const strokeWidth = Math.max(4, Math.round(sourceCanvas.width / 180));

  // 2. Semi-transparent fill over detected note area
  ctx.fillStyle = "rgba(16, 185, 129, 0.12)";
  ctx.fillRect(box.x, box.y, box.w, box.h);

  // 3. High-contrast bounding box border
  ctx.strokeStyle = "#10b981"; // emerald green
  ctx.lineWidth = strokeWidth;
  ctx.strokeRect(box.x, box.y, box.w, box.h);

  // 4. Corner accent brackets
  const cornerLen = Math.min(32, Math.min(box.w, box.h) * 0.25);
  ctx.strokeStyle = "#34d399";
  ctx.lineWidth = strokeWidth * 1.5;
  ctx.lineCap = "round";

  // Top-Left
  ctx.beginPath();
  ctx.moveTo(box.x, box.y + cornerLen);
  ctx.lineTo(box.x, box.y);
  ctx.lineTo(box.x + cornerLen, box.y);
  ctx.stroke();

  // Top-Right
  ctx.beginPath();
  ctx.moveTo(box.x + box.w - cornerLen, box.y);
  ctx.lineTo(box.x + box.w, box.y);
  ctx.lineTo(box.x + box.w, box.y + cornerLen);
  ctx.stroke();

  // Bottom-Left
  ctx.beginPath();
  ctx.moveTo(box.x, box.y + box.h - cornerLen);
  ctx.lineTo(box.x, box.y + box.h);
  ctx.lineTo(box.x + cornerLen, box.y + box.h);
  ctx.stroke();

  // Bottom-Right
  ctx.beginPath();
  ctx.moveTo(box.x + box.w - cornerLen, box.y + box.h);
  ctx.lineTo(box.x + box.w, box.y + box.h);
  ctx.lineTo(box.x + box.w, box.y + box.h - cornerLen);
  ctx.stroke();

  // 5. Confidence Label Pill on image
  const confPct = Math.round(box.confidence * 100);
  const labelText = `YOLO NOTE DETECTED (${confPct}%)`;
  const fontSize = Math.max(14, Math.round(sourceCanvas.width / 45));
  ctx.font = `bold ${fontSize}px sans-serif`;

  const textMetrics = ctx.measureText(labelText);
  const padX = 12;
  const padY = 8;
  const pillW = textMetrics.width + padX * 2;
  const pillH = fontSize + padY * 2;

  let pillX = box.x;
  let pillY = box.y - pillH - 6;

  // Clamp label position within canvas boundaries
  if (pillY < 10) pillY = box.y + 10;
  if (pillX + pillW > sourceCanvas.width) pillX = sourceCanvas.width - pillW - 10;
  if (pillX < 10) pillX = 10;

  // Fill label background pill
  ctx.fillStyle = "#059669";
  ctx.beginPath();
  ctx.roundRect?.(pillX, pillY, pillW, pillH, 8);
  ctx.fill();

  // Draw text
  ctx.fillStyle = "#ffffff";
  ctx.fillText(labelText, pillX + padX, pillY + fontSize + padY / 2 - 2);

  return canvas.toDataURL("image/jpeg", 0.92);
}

/**
 * DetectionOverlay Component
 * Renders the visual confirmation preview showing the YOLO bounding box and detection badge.
 */
export default function DetectionOverlay({
  boxedImage,
  className = "",
}: DetectionOverlayProps) {
  return (
    <div
      className={`relative w-full h-full flex items-center justify-center overflow-hidden rounded-2xl bg-black/90 shadow-2xl border-2 border-emerald-500/40 ${className}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={boxedImage}
        alt="YOLO detected note bounding box preview"
        className="w-full h-full object-contain"
      />
      <div className="absolute top-4 left-4 bg-emerald-600 text-white text-xs font-black tracking-wider uppercase px-4 py-2 rounded-full shadow-lg backdrop-blur-md flex items-center gap-2 border border-emerald-400/40">
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-200 animate-ping" />
        YOLO Bounding Box Located
      </div>
    </div>
  );
}
