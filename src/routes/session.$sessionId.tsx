import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Copy } from "lucide-react";
import { SessionRoomBoard } from "@/features/sessions/SessionRoomBoard";
import { supabase } from "@/services/supabase/supabase";
import { useAppState } from "@/services/storage/storage";
import { loadUserXP } from "@/services/supabase/profile";
import { getSiteUrl } from "@/lib/site";
import { endSharedSession, loadSharedSession, type SharedSession } from "@/services/supabase/sessions";
import sessionBackground from "../../images/Untitled design.png";

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
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("Guest");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const postSignInStorageKey = "ascend.postSignInSessionId";
  const shareLink = useMemo(() => {
    if (typeof window === "undefined") return sessionId;

    return `${getSiteUrl()}/session/${sessionId}`;
  }, [sessionId]);

  const refresh = async () => {
    setError("");

    try {
      const { data } = await supabase.auth.getSession();

      setSignedIn(Boolean(data.session));
      setCurrentUserId(data.session?.user?.id ?? null);
      const userName =
        data.session?.user?.user_metadata?.full_name ||
        data.session?.user?.user_metadata?.name ||
        data.session?.user?.email?.split("@")[0] ||
        "Guest";
      setDisplayName(userName);

      if (!data.session) {
        setSession(null);
        setCloudXP(0);
        return;
      }

      const [loadedSession, profile] = await Promise.all([
        loadSharedSession(sessionId),
        loadUserXP(),
      ]);

      setSession(loadedSession);
      setCloudXP(profile?.xp ?? 0);
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

  useEffect(() => {
    if (typeof document === "undefined") return;

    const html = document.documentElement;
    const body = document.body;

    const originalHtmlBackground = html.style.background;
    const originalHtmlBackgroundImage = html.style.backgroundImage;
    const originalBodyBackground = body.style.background;
    const originalBodyBackgroundImage = body.style.backgroundImage;
    const originalBodyBackgroundRepeat = body.style.backgroundRepeat;
    const originalBodyBackgroundPosition = body.style.backgroundPosition;
    const originalBodyBackgroundSize = body.style.backgroundSize;
    const originalBodyBackgroundAttachment = body.style.backgroundAttachment;
    const originalBodyBackgroundColor = body.style.backgroundColor;

    html.style.background = "transparent";
    html.style.backgroundImage = "none";
    body.style.background = "transparent";
    body.style.backgroundImage = "none";
    body.style.backgroundRepeat = "no-repeat";
    body.style.backgroundPosition = "top center";
    body.style.backgroundSize = "auto";
    body.style.backgroundAttachment = "scroll";
    body.style.backgroundColor = "transparent";

    return () => {
      html.style.background = originalHtmlBackground;
      html.style.backgroundImage = originalHtmlBackgroundImage;
      body.style.background = originalBodyBackground;
      body.style.backgroundImage = originalBodyBackgroundImage;
      body.style.backgroundRepeat = originalBodyBackgroundRepeat;
      body.style.backgroundPosition = originalBodyBackgroundPosition;
      body.style.backgroundSize = originalBodyBackgroundSize;
      body.style.backgroundAttachment = originalBodyBackgroundAttachment;
      body.style.backgroundColor = originalBodyBackgroundColor;
    };
  }, []);

  const signInWithGoogle = async () => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(postSignInStorageKey, sessionId);
    }

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
      className="min-h-screen px-6 py-8 text-white"
      style={{
        backgroundImage: `url(${sessionBackground})`,
        backgroundSize: "100% auto",
        backgroundPosition: "top center",
        backgroundRepeat: "repeat-y",
        backgroundAttachment: "scroll",
      }}
    >
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold uppercase tracking-[0.18em] text-white">
              home
            </span>
            <span className="text-sm font-semibold text-white/90">{displayName}</span>
          </div>

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
            {session?.created_by && currentUserId === session.created_by ? (
              // UI-only host action control. The backend/database must enforce session ownership.
              <button
                type="button"
                onClick={endSession}
                className="rounded-none border-2 border-white bg-black px-5 py-3 font-bold text-white shadow-[4px_4px_0_rgba(255,255,255,0.22)] hover:bg-black/85"
              >
                End session
              </button>
            ) : (
              <button
                type="button"
                onClick={() => (window.location.href = "/")}
                className="rounded-none border-2 border-white bg-black px-5 py-3 font-bold text-white shadow-[4px_4px_0_rgba(255,255,255,0.22)] hover:bg-black/85"
              >
                Leave session
              </button>
            )}
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
            hostUserId={session?.created_by ?? null}
          />
        )}
      </div>
    </div>
  );
}
