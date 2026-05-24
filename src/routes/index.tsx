import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAppState } from "@/lib/storage";
import {
  getDisplayNameFromMetadata,
  hasCompletedOnboardingFromMetadata,
  loadUserProfile,
  loadUserXP,
} from "@/lib/profile";
import { supabase } from "@/lib/supabase";
import { GoalSetup } from "@/components/GoalSetup";
import { Dashboard } from "@/components/Dashboard";
import { DisplayNamePrompt } from "@/components/DisplayNamePrompt";

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
  const [checkingProfile, setCheckingProfile] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (!hydrated) return;

    let cancelled = false;

    const syncCloudXP = async () => {
      const { data } = await supabase.auth.getUser();
      const profile = data.user ? await loadUserProfile() : null;
      const cloudXP = data.user ? await loadUserXP() : null;

      if (cancelled) return;

      setSignedIn(Boolean(data.user));
      setDisplayName(data.user ? getDisplayNameFromMetadata(data.user.user_metadata) : "");
      setCloudOnboardingComplete(
        data.user ? hasCompletedOnboardingFromMetadata(data.user.user_metadata) : false,
      );
      setProfile(profile);
      setCheckingProfile(false);

      if (cloudXP) setState((current) => ({ ...current, totalPoints: cloudXP.xp }));
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

  const hasStartedJourney =
    cloudOnboardingComplete ||
    Boolean(state.hasStartedJourney || state.goal || state.draftGoal || state.categories.length);

  const shouldResumeDashboard =
    signedIn && !checkingProfile && cloudOnboardingComplete && !state.goal;

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

  if (!hydrated) return <div className="min-h-screen" />;

  if (signedIn && !checkingProfile && (!displayName || !profile?.gender)) {
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

  if (!state.goal) {
    return (
      <GoalSetup
        initialGoal={state.draftGoal || state.goal}
        hasStartedJourney={hasStartedJourney}
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
