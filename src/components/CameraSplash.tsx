"use client";

interface CameraSplashProps {
  onStart: () => void;
}

/**
 * CameraSplash
 * Full-screen prompt shown before camera access is requested.
 */
export default function CameraSplash({ onStart }: CameraSplashProps) {
  return (
    <div className="relative flex min-h-[100dvh] flex-col items-center justify-between bg-white px-8 py-8 md:py-16 overflow-hidden text-gray-900 w-full">
      {/* Subtle minimalist background shapes */}
      <div className="absolute top-[-15%] left-[-15%] h-[500px] w-[500px] rounded-full bg-gray-50 blur-[100px]" aria-hidden="true" />
      <div className="absolute bottom-[-10%] right-[-20%] h-[600px] w-[600px] rounded-full bg-gray-50 blur-[120px]" aria-hidden="true" />

      {/* Top Section: Logo & Titles */}
      <div className="relative z-10 flex w-full flex-col items-center pt-12">
        {/* Massive Green Rupee Icon */}
        <div className="mb-10 flex h-24 w-24 items-center justify-center rounded-[32px] bg-green-50 shadow-[0_8px_30px_rgba(22,163,74,0.12)]" aria-hidden="true">
          <svg
            width="44"
            height="44"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#16a34a"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M6 3h12"/>
            <path d="M6 8h12"/>
            <path d="m6 13 8.5 8"/>
            <path d="M6 13h3"/>
            <path d="M9 13c6.667 0 6.667-10 0-10"/>
          </svg>
        </div>

        <h1 className="mb-3 text-[2.75rem] font-black tracking-tight text-gray-950">NoteProof</h1>
        <p className="rounded-full bg-gray-100 px-4 py-1.5 text-xs font-bold tracking-[0.2em] uppercase text-gray-500">Noticing Notes</p>
      </div>

      {/* Middle Section: Features List */}
      <div className="relative z-10 flex w-full max-w-sm flex-col items-center my-auto py-12">
        <ul className="w-full space-y-6 text-[0.95rem] font-semibold text-gray-600" aria-label="App features">
          <li className="flex items-center gap-5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100" aria-hidden="true">
              <div className="h-2 w-2 rounded-full bg-gray-900" />
            </div>
            Identifies ₹10 – ₹2000 notes
          </li>
          <li className="flex items-center gap-5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100" aria-hidden="true">
              <div className="h-2 w-2 rounded-full bg-gray-900" />
            </div>
            Detects genuine vs. fake
          </li>
          <li className="flex items-center gap-5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100" aria-hidden="true">
              <div className="h-2 w-2 rounded-full bg-gray-900" />
            </div>
            100% private & offline AI
          </li>
        </ul>
      </div>

      {/* Bottom Section: CTA */}
      <div className="relative z-10 flex w-full max-w-sm flex-col items-center pb-[calc(env(safe-area-inset-bottom,0px)+1rem)]">
        <button
          id="start-camera-btn"
          className="group relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-2xl bg-gray-950 px-8 py-5 text-[1.05rem] font-bold text-white transition-transform active:scale-95 shadow-[0_16px_40px_rgba(0,0,0,0.18)]"
          onClick={onStart}
          aria-label="Allow camera access and start scanning"
        >
          <div className="absolute inset-0 bg-black opacity-0 transition-opacity group-hover:opacity-10" />
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="relative z-10 opacity-90"
            aria-hidden="true"
          >
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
          <span className="relative z-10 tracking-wide">ALLOW CAMERA</span>
        </button>

        <p className="mt-8 text-center text-xs font-medium text-gray-400 max-w-[280px] leading-relaxed">
          Camera access is required. Your video feed never leaves your device.
        </p>
      </div>
    </div>
  );
}
