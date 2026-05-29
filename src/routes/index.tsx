import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAppState } from "@/services/storage/storage";
import {
  ensureUserProfile,
  getDisplayNameFromMetadata,
  hasCompletedOnboardingFromMetadata,
  loadUserXP,
} from "@/services/supabase/profile";
import { supabase } from "@/services/supabase/supabase";
import { GoalSetup } from "@/features/onboarding/GoalSetup";
import { Dashboard } from "@/features/dashboard/Dashboard";
import { DisplayNamePrompt } from "@/features/onboarding/DisplayNamePrompt";

const DEFAULT_GOAL_PROMPT = "Where do you see yourself in the end of this journey";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Hero's Journey — Level up your dream goal" },
      {
        name: "description",
        content: "Define your dream, break it into daily quests, earn points and reach 100%.",
      },
      { property: "og:title", content: "Hero's Journey — Level up your dream goal" },
      {
        property: "og:description",
        content: "Gamified productivity. Define your dream, build daily quests, level up.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const [state, setState, hydrated] = useAppState();
  const [signedIn, setSignedIn] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [profile, setProfile] = useState<{ gender?: string | null } | null>(null);
  const [cloudOnboardingComplete, setCloudOnboardingComplete] = useState(false);
  const [checkingProfile, setCheckingProfile] = useState(false);
  const router = useRouter();
  const postSignInStorageKey = "ascend.postSignInSessionId";

  useEffect(() => {
    if (typeof window === "undefined") return;

    const redirectSessionId = window.localStorage.getItem(postSignInStorageKey);
    if (!redirectSessionId) return;

    window.localStorage.removeItem(postSignInStorageKey);
    router.navigate({ to: "/session/$sessionId", params: { sessionId: redirectSessionId } });
  }, [router]);

  useEffect(() => {
    if (!hydrated) return;

    let cancelled = false;

    const syncCloudXP = async () => {
      setCheckingProfile(true);

      const timeout = setTimeout(() => {
        if (!cancelled) setCheckingProfile(false);
      }, 5000);

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const user = session?.user ?? null;
        const profile = user ? await ensureUserProfile() : null;
        const cloudXP = user ? await loadUserXP() : null;

        if (cancelled) return;

        setSignedIn(Boolean(user));
        setDisplayName(user ? getDisplayNameFromMetadata(user.user_metadata) : "");
        setCloudOnboardingComplete(
          user ? hasCompletedOnboardingFromMetadata(user.user_metadata) : false,
        );
        setProfile(profile);

        if (cloudXP) setState((current) => ({ ...current, totalPoints: cloudXP.xp }));
      } catch (error) {
        console.error("Could not sync auth state:", error);

        if (!cancelled) {
          setSignedIn(false);
          setDisplayName("");
          setCloudOnboardingComplete(false);
          setProfile(null);
        }
      } finally {
        clearTimeout(timeout);
        if (!cancelled) {
          setCheckingProfile(false);
        }
      }
    };

    syncCloudXP();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSignedIn(Boolean(session));
      setDisplayName(
        session ? getDisplayNameFromMetadata(session.user.user_metadata) : ""
      );
      setCloudOnboardingComplete(
        session ? hasCompletedOnboardingFromMetadata(session.user.user_metadata) : false,
      );

      if (event === "SIGNED_IN") {
        await syncCloudXP();
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [hydrated, setState]);

  const localHasStartedJourney = Boolean(
    state.hasStartedJourney || state.goal || state.draftGoal || state.categories.length,
  );
  const profileComplete = Boolean(displayName);
  const needsProfile = signedIn && !checkingProfile && !profileComplete;
  const needsSignedInOnboarding =
    signedIn &&
    !checkingProfile &&
    profileComplete &&
    !cloudOnboardingComplete &&
    !localHasStartedJourney;
  const hasStartedJourney =
    cloudOnboardingComplete || (!needsSignedInOnboarding && localHasStartedJourney);

  const shouldResumeDashboard =
    signedIn &&
    !checkingProfile &&
    profileComplete &&
    (cloudOnboardingComplete || localHasStartedJourney) &&
    !state.goal;

  useEffect(() => {
    if (!shouldResumeDashboard) return;

    const nextGoal = state.draftGoal || DEFAULT_GOAL_PROMPT;
    setState((current) => ({
      ...current,
      goal: nextGoal,
      draftGoal: nextGoal,
      hasStartedJourney: true,
    }));
  }, [setState, shouldResumeDashboard, state.draftGoal]);

if (!hydrated || checkingProfile) return (
  <div className="min-h-screen flex items-center justify-center bg-white">
    <div className="text-2xl font-black animate-pulse">Loading your journey...</div>
  </div>
);
  if (needsProfile) {
    return (
      <DisplayNamePrompt
        onComplete={(displayName, gender) => {
          setDisplayName(displayName);
          setProfile((current) => ({ ...current, gender }));
        }}
      />
    );
  }

  if (shouldResumeDashboard) return <div className="min-h-screen" />;

  if (needsSignedInOnboarding || !state.goal) {
    return (
      <GoalSetup
        initialGoal={state.draftGoal || state.goal}
        hasStartedJourney={hasStartedJourney}
        signedIn={signedIn}
        onDraftChange={(goal) => {
          setState((s) => ({ ...s, draftGoal: goal }));
        }}
        onSave={(goal) => {
          setState((s) => ({ ...s, draftGoal: goal, hasStartedJourney: true }));
          router.navigate({ to: "/welcome" });
        }}
        onContinue={(goal) => {
          if (hasStartedJourney) {
            const nextGoal = state.draftGoal || goal || DEFAULT_GOAL_PROMPT;
            setState((s) => ({ ...s, goal: nextGoal, draftGoal: nextGoal }));
            router.navigate({ to: "/" });
            return;
          }

          setState((s) => ({ ...s, draftGoal: goal || s.draftGoal, hasStartedJourney: true }));
          router.navigate({ to: "/welcome" });
        }}
      />
    );
  }

  return <Dashboard state={state} setState={setState} displayName={displayName} />;
}