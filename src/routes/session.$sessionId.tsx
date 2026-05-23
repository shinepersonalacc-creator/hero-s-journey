import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Copy, Home } from "lucide-react";
import { SessionRoomBoard } from "@/components/SessionRoomBoard";
import { supabase } from "@/lib/supabase";
import { useAppState } from "@/lib/storage";
import { loadUserXP } from "@/lib/profile";
import { endSharedSession, loadSharedSession, type SharedSession } from "@/lib/sessions";

export const Route = createFileRoute("/session/$sessionId")({
  head: () => ({
    meta: [{ title: "Session - Ascend" }, { name: "description", content: "Shared focus session" }],
  }),
  component: SessionPage,
});

function SessionPage() {
  const { sessionId } = Route.useParams();
  const [appState] = useAppState();
  const [session, setSession] = useState<SharedSession | null>(null);
  const [cloudXP, setCloudXP] = useState(0);
  const [signedIn, setSignedIn] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const shareLink = useMemo(() => {
    if (typeof window === "undefined") return sessionId;

    return `${window.location.origin}/session/${sessionId}`;
  }, [sessionId]);

  const refresh = async () => {
    setError("");

    try {
      const [{ data }, loadedSession, profile] = await Promise.all([
        supabase.auth.getSession(),
        loadSharedSession(sessionId),
        loadUserXP(),
      ]);

      setSignedIn(Boolean(data.session));
      setSession(loadedSession);
      if (profile) setCloudXP(profile.xp);
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : "Could not load session.");
    }
  };

  useEffect(() => {
  let active = true;

  const runRefresh = async () => {
    if (!active) return;

    try {
      await refresh();
    } catch (err) {
      console.error(err);
    }
  };

  runRefresh();

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_IN" || event === "SIGNED_OUT") {
      runRefresh();
    }
  });

  return () => {
    active = false;
    subscription.unsubscribe();
  };
}, [sessionId])

  const signInWithGoogle = async () => {
    const { error: signInError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: shareLink,
      },
    });

    if (signInError) setError(signInError.message);
  };

  const copySession = async () => {
    await navigator.clipboard.writeText(shareLink);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const endSession = async () => {
    try {
      await endSharedSession(sessionId);
      window.location.href = "/";
    } catch (sessionError) {
      setError(sessionError instanceof Error ? sessionError.message : "Could not end session.");
    }
  };

  return (
    <div
      className="min-h-screen bg-no-repeat px-6 py-8 text-white"
      style={{
        backgroundImage: "url('/Image/adventurebg.png')",
        backgroundSize: "auto 100vh",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
      }}
    >
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <a
            href="/"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white hover:bg-white/20"
            aria-label="Home"
          >
            <Home className="size-4" />
          </a>

          <button
            type="button"
            onClick={copySession}
            className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 font-semibold text-white hover:bg-white/20"
          >
            <Copy className="size-4" />
            {copied ? "Copied" : "Copy session link"}
          </button>
        </div>

        <header className="mt-8">
          <div className="text-sm font-bold uppercase tracking-[0.35em] text-white/75">Session</div>
          <div className="mt-2 flex flex-wrap items-center gap-4">
            <h1 className="text-5xl font-bold text-white md:text-7xl">
              {session?.name ?? "Loading session..."}
            </h1>
            <button
              type="button"
              onClick={endSession}
              className="rounded-none border-2 border-white bg-black px-5 py-3 font-bold text-white shadow-[4px_4px_0_rgba(255,255,255,0.22)] hover:bg-black/85"
            >
              End session
            </button>
          </div>
          <div className="mt-3 max-w-full overflow-hidden text-ellipsis whitespace-nowrap rounded-xl bg-black/35 px-4 py-2 font-mono text-sm text-white/85">
            ID: {sessionId}
          </div>
        </header>

        {error && (
          <div className="mt-5 rounded-xl bg-black px-4 py-3 font-semibold text-white">{error}</div>
        )}

        {!signedIn ? (
          <div className="mt-10 max-w-xl rounded-2xl border-2 border-black bg-white p-6 text-black shadow-xl">
            <h2 className="text-3xl font-bold">Join with Google</h2>
            <p className="mt-2 font-semibold text-black/70">
              Sign in so your session XP goes to your own profile.
            </p>
            <button
              type="button"
              onClick={signInWithGoogle}
              className="mt-5 rounded-full bg-black px-6 py-3 font-bold text-white hover:bg-black/85"
            >
              Sign in with Google
            </button>
          </div>
        ) : (
          <SessionRoomBoard
            sessionId={sessionId}
            categories={appState.categories}
            localXP={cloudXP}
          />
        )}
      </div>
    </div>
  );
}
