"use client";

import { useEffect, useRef, useState } from "react";
import { decode } from "html-entities";
import useSound from "use-sound";
import type { RatingScore } from "~/utils/rating";
import {
  getRatingRevealSound,
  RATING_SPIN_SOUND,
} from "~/utils/rating-audio";

export type RatingResult = {
  ratingId: string;
  songId: string | null;
  singerName: string;
  title: string;
  score: RatingScore;
  phrase: string;
};

type Props = {
  result: RatingResult;
  onComplete: () => void;
  onReveal?: () => void;
  onPrepareRevealSound: (
    ratingId: string,
    path: string,
    onUnavailable: () => void,
  ) => void;
  onPlayRevealSound: (ratingId: string, onComplete: () => void) => void;
  onCancelRevealSound: (ratingId: string) => void;
};

const REVEAL_AT = 4063;
const RESULT_DISPLAY_DURATION = 4000;
const SPIN_HIT_TIMES = [
  68, 298, 530, 706, 878, 1059, 1238, 1417, 1590, 1775, 2041, 2339, 2628,
  2965, 3414,
] as const;

export function RatingOverlay({
  result,
  onComplete,
  onReveal,
  onPrepareRevealSound,
  onPlayRevealSound,
  onCancelRevealSound,
}: Props) {
  const [displayedScore, setDisplayedScore] = useState(1);
  const [revealed, setRevealed] = useState(false);
  const onCompleteRef = useRef(onComplete);
  const onRevealRef = useRef(onReveal);
  const onPrepareRevealSoundRef = useRef(onPrepareRevealSound);
  const onPlayRevealSoundRef = useRef(onPlayRevealSound);
  const onCancelRevealSoundRef = useRef(onCancelRevealSound);
  const startAnimationRef = useRef<(() => void) | null>(null);
  const stopSpinRef = useRef<(() => void) | null>(null);
  const [playSpin, { sound: spinSound, stop: stopSpin }] = useSound(
    RATING_SPIN_SOUND,
    {
      interrupt: true,
      onplay: () => startAnimationRef.current?.(),
      onplayerror: () => startAnimationRef.current?.(),
      onloaderror: () => startAnimationRef.current?.(),
    },
  );

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    onRevealRef.current = onReveal;
  }, [onReveal]);

  useEffect(() => {
    onPrepareRevealSoundRef.current = onPrepareRevealSound;
    onPlayRevealSoundRef.current = onPlayRevealSound;
    onCancelRevealSoundRef.current = onCancelRevealSound;
  }, [onCancelRevealSound, onPlayRevealSound, onPrepareRevealSound]);

  useEffect(() => {
    stopSpinRef.current = stopSpin;
  }, [stopSpin]);

  useEffect(() => {
    if (!spinSound) return;
    return () => {
      spinSound.unload();
    };
  }, [spinSound]);

  useEffect(() => {
    const revealSoundPath = getRatingRevealSound(result.score);

    let spinTimer: number | null = null;
    let revealTimer: number | null = null;
    let exposureTimer: number | null = null;
    let minimumExposureComplete = false;
    let finalAudioComplete = false;
    let completed = false;
    let disposed = false;
    let spinStartedAt: number | null = null;
    let nextHitIndex = 0;
    let animationScore = 1;

    const tryComplete = () => {
      if (
        !disposed &&
        !completed &&
        minimumExposureComplete &&
        finalAudioComplete
      ) {
        completed = true;
        onCompleteRef.current();
      }
    };

    const markFinalAudioComplete = () => {
      finalAudioComplete = true;
      tryComplete();
    };

    onPrepareRevealSoundRef.current(
      result.ratingId,
      revealSoundPath,
      markFinalAudioComplete,
    );

    const scheduleNextHit = () => {
      if (spinStartedAt === null || nextHitIndex >= SPIN_HIT_TIMES.length) {
        return;
      }

      const elapsed = performance.now() - spinStartedAt;
      const delay = Math.max(0, SPIN_HIT_TIMES[nextHitIndex]! - elapsed);
      spinTimer = window.setTimeout(() => {
        if (spinStartedAt === null) return;

        const currentElapsed = performance.now() - spinStartedAt;
        while (
          nextHitIndex < SPIN_HIT_TIMES.length &&
          SPIN_HIT_TIMES[nextHitIndex]! <= currentElapsed
        ) {
          animationScore = animationScore >= 10 ? 1 : animationScore + 1;
          nextHitIndex += 1;
        }

        setDisplayedScore(animationScore);
        scheduleNextHit();
      }, delay);
    };

    const revealResult = () => {
      if (spinTimer !== null) window.clearTimeout(spinTimer);
      stopSpinRef.current?.();
      setDisplayedScore(result.score);
      setRevealed(true);
      onRevealRef.current?.();
      exposureTimer = window.setTimeout(() => {
        minimumExposureComplete = true;
        tryComplete();
      }, RESULT_DISPLAY_DURATION);
      onPlayRevealSoundRef.current(result.ratingId, markFinalAudioComplete);
    };

    const startAnimation = () => {
      if (spinStartedAt !== null || disposed) return;
      spinStartedAt = performance.now();
      scheduleNextHit();
      revealTimer = window.setTimeout(revealResult, REVEAL_AT);
    };

    startAnimationRef.current = startAnimation;

    return () => {
      disposed = true;
      if (spinTimer !== null) window.clearTimeout(spinTimer);
      if (revealTimer !== null) window.clearTimeout(revealTimer);
      if (exposureTimer !== null) window.clearTimeout(exposureTimer);
      if (startAnimationRef.current === startAnimation) {
        startAnimationRef.current = null;
      }
      stopSpinRef.current?.();
      onCancelRevealSoundRef.current(result.ratingId);
    };
  }, [result.ratingId, result.score]);

  useEffect(() => {
    if (spinSound) {
      playSpin();
    }

    return () => stopSpin();
  }, [playSpin, result.ratingId, result.score, spinSound, stopSpin]);

  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-black/35 p-4 text-center">
      <div
        className={`flex w-full max-w-[min(90vw,42rem)] flex-col items-center rounded-3xl border border-white/25 bg-slate-950/75 px-5 py-5 text-white shadow-2xl backdrop-blur-md sm:px-10 sm:py-7 ${
          revealed
            ? "scale-100 opacity-100 transition-none"
            : "scale-95 opacity-95 transition-all duration-300"
        }`}
      >
        <p className="text-[0.65rem] font-bold uppercase tracking-[0.24em] text-white/70 sm:text-xs">
          Calificación de {result.singerName || "la interpretación"}
        </p>
        <div
          className={`my-3 text-[clamp(5.5rem,14vw,10rem)] font-mono font-black leading-[0.82] text-fuchsia-300 drop-shadow-[0_0_18px_rgba(244,114,182,0.8)] sm:my-4 ${
            revealed ? "scale-110" : "scale-100"
          }`}
        >
          {displayedScore}
        </div>
        <p
          className={`max-w-xl text-base font-bold leading-snug sm:text-xl ${
            revealed ? "opacity-100" : "opacity-0"
          }`}
        >
          {result.phrase}
        </p>
        <p className="mt-2 max-w-full truncate text-xs text-white/60 sm:text-sm">
          {decode(result.title)}
        </p>
      </div>
    </div>
  );
}
