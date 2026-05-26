import { useEffect, useState } from "react";
import { Button } from "@/components/ui/forms/button";
import { supabase } from "@/services/supabase/supabase";
import {
  ensureUserProfile,
  getDisplayNameFromMetadata,
  loadUserProfile,
} from "@/services/supabase/profile";
import { getSiteUrl } from "@/lib/site";
import { DisplayNamePrompt } from "@/features/onboarding/DisplayNamePrompt";
import { LogoutButton } from "@/features/auth/LogoutButton";

const DISCORD_URL = "https://discord.gg/cyqGzSPf";

export function GoalSetup({
  initialGoal = "",
  hasStartedJourney = false,
  signedIn = false,
  onDraftChange,
  onSave,
  onContinue,
}: {
  initialGoal?: string;
  hasStartedJourney?: boolean;
  signedIn?: boolean;
  onDraftChange?: (goal: string) => void;
  onSave: (goal: string) => void;
  onContinue: (goal?: string) => void;
}) {
  const [val, setVal] = useState(initialGoal);
  const [googleSignedIn, setGoogleSignedIn] = useState(signedIn);
  const [needsProfile, setNeedsProfile] = useState(false);
  const [signInError, setSignInError] = useState("");

  useEffect(() => {
    setGoogleSignedIn(signedIn);
  }, [signedIn]);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session) {
        const profile = await ensureUserProfile();
        const displayName = getDisplayNameFromMetadata(data.session.user.user_metadata);
        if (mounted) {
          setGoogleSignedIn(true);
          setNeedsProfile(!displayName || !profile?.gender);
        }
      } else if (mounted) {
        setGoogleSignedIn(false);
        setNeedsProfile(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session) {
        const profile = await loadUserProfile();
        setGoogleSignedIn(true);
        setNeedsProfile(!getDisplayNameFromMetadata(session.user.user_metadata) || !profile?.gender);
      } else {
        setGoogleSignedIn(false);
        setNeedsProfile(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signInWithGoogle = async () => {
    setSignInError("");

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${getSiteUrl()}/`,
      },
    });

    if (error) setSignInError(error.message);
  };

  if (googleSignedIn && needsProfile) {
    return <DisplayNamePrompt onComplete={() => setNeedsProfile(false)} />;
  }

  return (
    <div
      className="min-h-dvh overflow-y-auto bg-no-repeat"
      style={{
        backgroundImage: "url('/Image/swordncloud.png?v=2')",
        backgroundSize: "auto 100%",
        backgroundPosition: "top center",
      }}
    >
      <div className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center px-6 py-10 md:py-16">
        {googleSignedIn && (
          <div className="mb-6 flex justify-end">
            <LogoutButton />
          </div>
        )}
        <h1
          className="mt-4 text-center font-display text-7xl font-bold leading-tight md:text-8xl"
          style={{
            fontFamily: "UntoldStory",
            WebkitTextStroke: "2px black",
          }}
        >
          <span className="text-outline-black">Hero's Journey</span>
        </h1>

        {!googleSignedIn ? (
          <button
            type="button"
            onClick={signInWithGoogle}
            className="mt-6 inline-flex items-center justify-center gap-3 self-center rounded-full border-2 border-black bg-white px-6 py-3 text-base font-bold text-black shadow-sm transition hover:bg-white/90"
            aria-label="Sign in with Google"
          >
            <span className="flex size-7 items-center justify-center rounded-full border border-black/15 bg-white font-sans text-lg font-bold text-[#4285f4]">
              G
            </span>
            Sign in with Google
          </button>
        ) : (
          <div className="mt-6 self-center rounded-full border-2 border-black bg-white px-6 py-3 text-base font-bold text-black shadow-sm">
            Google sign-in complete
          </div>
        )}
        {signInError && (
          <div className="mt-3 rounded-xl bg-black px-4 py-2 text-center text-sm font-semibold text-white">
            {signInError}
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          <a
            href={DISCORD_URL}
            className="inline-flex items-center justify-center rounded-full border-2 border-black bg-white px-6 py-3 text-base font-bold text-black shadow-sm transition hover:bg-black/5"
          >
            Leave us your feedback in Discord
          </a>
        </div>

        <div
          className="mt-6 rounded-3xl border-2 border-black bg-white p-5 text-left text-sm font-bold leading-relaxed text-black shadow-xl md:text-base"
          style={{ fontFamily: '"Roboto Mono", monospace' }}
        >
          <p>
            Hi, I&apos;m Shine, a little bit about me, I have a background in design and psychology - and in my free time I like to make stuff.
          </p>
          <p className="mt-4">
            Hero&apos;s Journey was a product of a severe insomnia and determination to get my life together (to the best of my ability). I&apos;ve always been into the idea of gamifying growth and there are several apps that have inspired this journey - Habitica, Discord, Notion and Forest.
          </p>
        </div>

        {googleSignedIn && (
          <>
            {hasStartedJourney ? (
              <div className="mt-6 rounded-3xl bg-black p-4 text-center shadow-xl">
                <p
                  className="text-lg font-normal text-white md:text-xl"
                  style={{ fontFamily: "UntoldStory" }}
                >
                  Your journey has already begun. Continue from where you left off.
                </p>
              </div>
            ) : (
              <div className="mt-6 rounded-3xl bg-black p-4 shadow-xl">
                <p
                  className="text-lg font-normal text-white md:text-xl"
                  style={{ fontFamily: "UntoldStory" }}
                >
                  You need to make your first step: break your progress into goals that will help
                  you reach the person you are becoming.
                </p>
              </div>
            )}

            <div className="mt-6 flex flex-col items-center gap-3">
              <span className="text-xs text-white">Stored locally on this device</span>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Button
                  size="lg"
                  disabled={hasStartedJourney}
                  onClick={() => onSave(val.trim())}
                  className="rounded-full border-2 border-black bg-gradient-to-br from-[#e5de00] to-[#d4b500] px-12 py-4 text-lg font-semibold text-black shadow-sm hover:opacity-95 disabled:opacity-50"
                >
                  Begin
                </Button>
                <Button
                  size="lg"
                  onClick={() => onContinue(val.trim() || undefined)}
                  className="rounded-full border-2 border-black bg-black px-12 py-4 text-lg font-semibold text-white shadow-sm hover:bg-black/85"
                >
                  Continue
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
