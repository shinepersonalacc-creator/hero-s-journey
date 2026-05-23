import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { ensureUserProfile, getDisplayNameFromMetadata } from "@/lib/profile";
import { DisplayNamePrompt } from "@/components/DisplayNamePrompt";

export function GoalSetup({
  initialGoal = "",
  onDraftChange,
  onSave,
  onContinue,
}: {
  initialGoal?: string;
  onDraftChange?: (goal: string) => void;
  onSave: (goal: string) => void;
  onContinue: (goal?: string) => void;
}) {
  const [val, setVal] = useState(initialGoal);
  const [googleSignedIn, setGoogleSignedIn] = useState(false);
  const [needsDisplayName, setNeedsDisplayName] = useState(false);
  const [signInError, setSignInError] = useState("");

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session) await ensureUserProfile();
      if (mounted) {
        setGoogleSignedIn(Boolean(data.session));
        setNeedsDisplayName(
          Boolean(data.session && !getDisplayNameFromMetadata(data.session.user.user_metadata)),
        );
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) void ensureUserProfile();
      setGoogleSignedIn(Boolean(session));
      setNeedsDisplayName(
        Boolean(session && !getDisplayNameFromMetadata(session.user.user_metadata)),
      );
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
        redirectTo: `${window.location.origin}/welcome`,
      },
    });

    if (error) setSignInError(error.message);
  };

  if (googleSignedIn && needsDisplayName) {
    return <DisplayNamePrompt onComplete={() => setNeedsDisplayName(false)} />;
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
        <h1
          className="mt-4 text-center font-display text-7xl font-bold leading-tight md:text-8xl"
          style={{
            fontFamily: "UntoldStory",
            WebkitTextStroke: "2px black",
            textStroke: "2px black",
          }}
        >
          <span className="text-outline-black">Hero's Journey</span>
        </h1>

        <button
          type="button"
          onClick={signInWithGoogle}
          disabled={googleSignedIn}
          className="mt-6 inline-flex items-center justify-center gap-3 self-center rounded-full border-2 border-black bg-white px-6 py-3 text-base font-bold text-black shadow-sm transition hover:bg-white/90"
          aria-label="Sign in with Google"
        >
          <span className="flex size-7 items-center justify-center rounded-full border border-black/15 bg-white font-sans text-lg font-bold text-[#4285f4]">
            G
          </span>
          {googleSignedIn ? "Google sign-in complete" : "Sign in with Google"}
        </button>
        {signInError && (
          <div className="mt-3 rounded-xl bg-black px-4 py-2 text-center text-sm font-semibold text-white">
            {signInError}
          </div>
        )}

        {googleSignedIn && (
          <>
            <div className="mt-6 rounded-3xl bg-black p-4 shadow-xl">
              <p
                className="text-lg font-normal text-white md:text-xl"
                style={{ fontFamily: "UntoldStory" }}
              >
                Close your eyes. Picture the person you&apos;re working towards.....
              </p>
            </div>

            <div
              className="mt-4 w-full"
              style={{
                display: "block",
                width: "100%",
                minHeight: "300px",
                padding: "0",
                backgroundColor: "white",
                border: "5px solid black",
                borderRadius: "28px",
                boxShadow: "0 18px 35px rgba(0,0,0,0.35)",
              }}
            >
              <textarea
                id="hero-vision"
                value={val}
                onChange={(e) => {
                  setVal(e.target.value);
                  onDraftChange?.(e.target.value);
                }}
                placeholder={`I want to build something that outlives me - work that genuinely improves people's lives.
Every challenge feels like a step toward becoming stronger, wiser, and more capable.
Success, to me, isn't just achievement; it's having the freedom to create, explore, and keep growing.
No matter how long it takes, I refuse to settle for an ordinary life.`}
                rows={8}
                aria-label="Describe the person you are working toward"
                style={{
                  display: "block",
                  width: "100%",
                  minHeight: "300px",
                  resize: "none",
                  overflowY: "auto",
                  padding: "22px",
                  backgroundColor: "white",
                  color: "black",
                  border: "0",
                  borderRadius: "23px",
                  fontFamily: '"Roboto Mono", monospace',
                  fontSize: "18px",
                  fontWeight: 700,
                  lineHeight: 1.5,
                  outline: "none",
                }}
              />
            </div>

            <div className="mt-6 flex flex-col items-center gap-3">
              <span className="text-xs text-white">Stored locally on this device</span>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Button
                  size="lg"
                  disabled={val.trim().length < 4}
                  onClick={() => onSave(val.trim())}
                  className="rounded-full border-2 border-black bg-gradient-to-br from-[#e5de00] to-[#d4b500] px-12 py-4 text-lg font-semibold text-black shadow-sm hover:opacity-95"
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
