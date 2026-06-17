"use client";

// VideoFeed — the user's self-view. The <video> element is where MediaPipe reads frames
// from. We mirror it (like a webcam preview should be) and show a small "on-device" badge
// to reinforce that nothing is uploaded.

import { useEffect, useRef } from "react";

export default function VideoFeed({ attachVideo, badge = true, className = "" }) {
  const localRef = useRef(null);

  // Hand the <video> element up to the biometrics hook once it mounts.
  useEffect(() => {
    if (localRef.current) attachVideo(localRef.current);
  }, [attachVideo]);

  return (
    <div className={`relative overflow-hidden rounded-xl border border-ink-700 bg-black ${className}`}>
      <video
        ref={localRef}
        className="mirror h-full w-full object-cover"
        playsInline
        muted
        autoPlay
      />
      {badge && (
        <div className="absolute left-2 top-2 flex items-center gap-1.5 rounded bg-black/60 px-2 py-1 text-[10px] font-medium text-ink-200 backdrop-blur">
          <span className="h-1.5 w-1.5 rounded-full bg-tell-gaze animate-pulseDot" />
          ON-DEVICE
        </div>
      )}
    </div>
  );
}
