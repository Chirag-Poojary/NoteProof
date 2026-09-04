"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { INPUT_SIZE } from "./modelConfig";

export type CameraError =
  | "NOT_ALLOWED"
  | "NOT_FOUND"
  | "NOT_SUPPORTED"
  | "UNKNOWN";

export interface UseCameraReturn {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isReady: boolean;
  error: CameraError | null;
  errorMessage: string | null;
  startCamera: () => Promise<void>;
  stopCamera: () => void;
  captureFrame: () => HTMLCanvasElement | null;
}

/**
 * useCamera
 * Manages the MediaDevices camera lifecycle and exposes a captureFrame()
 * helper that renders the current video frame into a hidden canvas.
 */
export function useCamera(): UseCameraReturn {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<CameraError | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setIsReady(false);
  }, []);

  const startCamera = useCallback(async () => {
    setError(null);
    setErrorMessage(null);

    if (!navigator.mediaDevices?.getUserMedia) {
      setError("NOT_SUPPORTED");
      setErrorMessage("Camera API is not supported in this browser.");
      return;
    }

    try {
      // Prefer rear camera on mobile. Simplified constraints to prevent Android hangs.
      const constraints = {
        video: {
          facingMode: "environment",
        },
        audio: false,
      };

      // Add a timeout so we don't hang forever if the browser permission dialog fails to show
      const streamPromise = navigator.mediaDevices.getUserMedia(constraints);
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Camera request timed out. Check site settings/permissions.")), 15000)
      );

      const stream = await Promise.race([streamPromise, timeoutPromise]);

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
          setIsReady(true);
        };
      }
    } catch (err: unknown) {
      const domErr = err as DOMException;
      if (
        domErr.name === "NotAllowedError" ||
        domErr.name === "PermissionDeniedError"
      ) {
        setError("NOT_ALLOWED");
        setErrorMessage("Camera permission denied. Please allow camera access.");
      } else if (
        domErr.name === "NotFoundError" ||
        domErr.name === "DevicesNotFoundError"
      ) {
        setError("NOT_FOUND");
        setErrorMessage("No camera found on this device.");
      } else {
        setError("UNKNOWN");
        setErrorMessage(domErr.message ?? "An unexpected camera error occurred.");
      }
    }
  }, []);

  /**
   * Draws the current video frame onto an off-screen canvas at native
   * video resolution (raw full frame, no pre-crop) and returns the canvas.
   */
  const captureFrame = useCallback((): HTMLCanvasElement | null => {
    const video = videoRef.current;
    if (!video || !isReady || video.videoWidth === 0) return null;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
    return canvas;
  }, [isReady]);

  // Stop camera tracks on unmount to release hardware
  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  return {
    videoRef,
    isReady,
    error,
    errorMessage,
    startCamera,
    stopCamera,
    captureFrame,
  };
}
