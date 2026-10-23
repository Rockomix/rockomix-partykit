"use client";

import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  type CSSProperties,
} from "react";
import ReactCanvasConfetti from "react-canvas-confetti";

const canvasStyles = {
  position: "absolute",
  pointerEvents: "none",
  width: "100%",
  height: "100%",
  zIndex: 1,
  overflow: "hidden",
  top: 0,
  left: 0,
} satisfies CSSProperties;

export type ConfettiCanvasHandle = {
  fire: () => void;
};

export const ConfettiCanvas = forwardRef<ConfettiCanvasHandle>(function ConfettiCanvas(
  _props,
  ref,
) {
  const refAnimationInstance = useRef<((options: unknown) => void) | null>(
    null,
  );

  const getInstance = useCallback((instance: unknown) => {
    refAnimationInstance.current = instance as
      | ((options: unknown) => void)
      | null;
  }, []);

  const makeShot = useCallback(
    (opts: Record<string, unknown>, originX: number, angle: number) => {
      refAnimationInstance.current?.({
        ...opts,
        origin: { x: originX, y: 0.5 },
        angle,
        particleCount: 500,
      });
    },
    [],
  );

  const fire = useCallback(() => {
    makeShot({ spread: 100, startVelocity: 40 }, -0.2, 20);
    makeShot({ spread: 100, startVelocity: 40 }, 1.2, 160);
  }, [makeShot]);

  useImperativeHandle(ref, () => ({ fire }), [fire]);

  return <ReactCanvasConfetti refConfetti={getInstance} style={canvasStyles} />;
});

ConfettiCanvas.displayName = "ConfettiCanvas";
