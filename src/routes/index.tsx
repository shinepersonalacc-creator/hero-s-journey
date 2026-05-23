import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAppState } from "@/lib/storage";
import { getDisplayNameFromMetadata, loadUserXP } from "@/lib/profile";
import { supabase } from "@/lib/supabase";
import { GoalSetup } from "@/components/GoalSetup";
import { Dashboard } from "@/components/Dashboard";
import { DisplayNamePrompt } from "@/components/DisplayNamePrompt";

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
  const [checkingProfile, setCheckingProfile] = useState(true);

  useEffect(() => {
    if (!hydrated) return;

    let cancelled = false;

    const syncCloudXP = async () => {
      const { data } = await supabase.auth.getUser();
      const profile = data.user ? await loadUserXP() : null;

      if (cancelled) return;

      setSignedIn(Boolean(data.user));
      setDisplayName(data.user ? getDisplayNameFromMetadata(data.user.user_metadata) : "");
      setCheckingProfile(false);

      if (profile) setState((current) => ({ ...current, totalPoints: profile.xp }));
    };

    syncCloudXP();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSignedIn(Boolean(session));
      setDisplayName(session ? getDisplayNameFromMetadata(session.user.user_metadata) : "");
      syncCloudXP();
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [hydrated, setState]);

  if (!hydrated) return <div className="min-h-screen" />;

  if (signedIn && !checkingProfile && !displayName) {
    return <DisplayNamePrompt onComplete={setDisplayName} />;
  }

  if (!state.goal) {
    return (
      <GoalSetup
        initialGoal={state.draftGoal || state.goal}
        onDraftChange={(goal) => {
          setState((s) => ({ ...s, draftGoal: goal }));
        }}
        onSave={(goal) => {
          setState((s) => ({ ...s, goal, draftGoal: goal }));
          // navigate to the welcome page
          window.location.href = "/welcome";
        }}
        onContinue={(goal) => {
          const nextGoal = goal || state.draftGoal || "Hero's Journey";
          setState((s) => ({ ...s, goal: nextGoal, draftGoal: nextGoal }));
          window.location.href = "/";
        }}
      />
    );
  }

  return <Dashboard state={state} setState={setState} displayName={displayName} />;
}
