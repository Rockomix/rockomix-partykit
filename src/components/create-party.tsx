"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { api } from "~/trpc/react";
import { Input } from "./ui/ui/input";
import { ButtonHoverGradient } from "./ui/ui/button-hover-gradient";
import { ensureSessionId, setNameLocal } from "~/lib/session";
import { esMX } from "~/locales/es-MX";
import {
  ConfettiCanvas,
  type ConfettiCanvasHandle,
} from "./confetti-canvas";

// Animation variants for the container
// const containerVariants = {
//   hidden: { opacity: 0, y: 50 },
//   visible: { opacity: 1, y: 0 },
// };

export function CreateParty() {
  const router = useRouter();
  const [name, setName] = useState("");
  const confettiRef = useRef<ConfettiCanvasHandle>(null);

  const createParty = api.party.create.useMutation({
    onSuccess: (party) => {
      confettiRef.current?.fire();

      // Persist the same client state that Join would set (`name` and `sessionId`)
      try {
        setNameLocal(name);
        ensureSessionId();
      } catch {
        // best-effort
      }

      // Redirect to the party page
      setTimeout(() => {
        router.push(`/player/${party.hash}`);
      }, 1000);
    },
  });

  return (
    <>
      <ConfettiCanvas ref={confettiRef} />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          createParty.mutate({ name });
        }}
        className="flex flex-col gap-2"
      >
        <Input
          name="name"
          type="text"
          placeholder={esMX.landing.partyNamePlaceholder ?? "My Awesome Party..."}
          value={name}
          onChange={(e) => setName(e.target.value)}
          minLength={3}
          required
          autoComplete="off"
          className="text-lg"
          autoFocus
        />

        {/* <AnimatedGradientText>
          🎉 <hr className="mx-2 h-4 w-[1px] shrink-0 bg-gray-300" />{" "}
          <span
            className={cn(
              `animate-gradient inline bg-gradient-to-r from-[#ffaa40] via-[#9c40ff] to-[#ffaa40] bg-[length:var(--bg-size)_100%] bg-clip-text text-transparent`,
            )}
          >
            Start Party!
          </span>
          <ChevronRight className="ml-1 size-3 transition-transform duration-300 ease-in-out group-hover:translate-x-0.5" />
        </AnimatedGradientText> */}

        <ButtonHoverGradient type="submit" disabled={createParty.isPending}>
          {createParty.isPending
            ? esMX.landing.creating ?? "Creating..."
            : esMX.landing.startParty ?? "Start Party 🎉"}
        </ButtonHoverGradient>

        {/* <ShimmerButton className="shadow-2xl">
          <span className="whitespace-pre-wrap text-center text-sm font-medium leading-none tracking-tight text-white lg:text-lg dark:from-white dark:to-slate-900/10">
            Start Party
          </span>
        </ShimmerButton> */}
      </form>
    </>
  );
}
