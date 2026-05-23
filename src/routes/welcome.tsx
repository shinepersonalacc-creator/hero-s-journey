import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAppState, uid } from "@/lib/storage";
import { loadPreferredDisplayName } from "@/lib/profile";
import { Check, Home, Pencil } from "lucide-react";

export const Route = createFileRoute("/welcome")({
  head: () => ({
    meta: [{ title: "Welcome — Ascend" }, { name: "description", content: "First step intro" }],
  }),
  component: Welcome,
});

function Welcome() {
  const router = useRouter();
  const [state, setState] = useAppState();
  const [steps, setSteps] = useState(["", "", ""]);
  const [aims, setAims] = useState<string[]>([]);
  const [createdCategoryIds, setCreatedCategoryIds] = useState<string[]>([]);
  const [editingVision, setEditingVision] = useState(false);
  const [draftVision, setDraftVision] = useState(state.goal);
  const [displayName, setDisplayName] = useState("");
  const [showAimScreen, setShowAimScreen] = useState(false);
  const [showChapterIntro, setShowChapterIntro] = useState(false);
  const postSignInStorageKey = "ascend.postSignInSessionId";

  useEffect(() => {
    if (!editingVision) setDraftVision(state.goal);
  }, [editingVision, state.goal]);

  useEffect(() => {
    loadPreferredDisplayName().then(setDisplayName);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const redirectSessionId = window.localStorage.getItem(postSignInStorageKey);
    if (!redirectSessionId) return;

    window.localStorage.removeItem(postSignInStorageKey);
    router.navigate({ to: "/session/$sessionId", params: { sessionId: redirectSessionId } });
  }, [router]);

  const updateStep = (index: number, value: string) => {
    setSteps((current) => current.map((step, i) => (i === index ? value : step)));
  };

  const addStep = () => {
    setSteps((current) => {
      const next = [...current];
      next.splice(Math.max(0, next.length - 1), 0, "");
      return next;
    });
  };

  const updateAim = (index: number, value: string) => {
    setAims((current) => {
      const next = [...current];
      next[index] = value;
      return next;
    });
  };

  const questNames = steps.map((step) => step.trim()).filter(Boolean);

  const continueToAimScreen = () => {
    const newCategories = questNames.map((name) => ({
      id: uid(),
      name,
      emoji: "✨",
      aim: "",
      tasks: [],
    }));

    setState((current) => ({
      ...current,
      categories: [...current.categories, ...newCategories],
    }));

    setCreatedCategoryIds(newCategories.map((category) => category.id));
    setAims((current) =>
      questNames.map(
        (_, index) =>
          current[index] ??
          (index === 0 ? "I aim to sell 2 paintings at the end of this week" : ""),
      ),
    );
    setShowAimScreen(true);
  };

  const continueToChapterIntro = () => {
    setState((current) => ({
      ...current,
      categories: current.categories.map((category) => {
        const index = createdCategoryIds.indexOf(category.id);

        if (index === -1) return category;

        return {
          ...category,
          aim: aims[index]?.trim() ?? "",
        };
      }),
    }));
    setShowChapterIntro(true);
  };

  const goHome = () => {
    setState((current) => ({ ...current, goal: "" }));
    router.navigate({ to: "/" });
  };

  const saveVision = () => {
    setState((current) => ({ ...current, goal: draftVision.trim() || current.goal }));
    setEditingVision(false);
  };

  if (showChapterIntro) {
    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center px-6 py-16 text-center text-white"
        style={{
          backgroundImage: "url('/Image/lvl1.png')",
          backgroundSize: "auto 100vh",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          backgroundAttachment: "fixed",
        }}
      >
        <button
          type="button"
          onClick={goHome}
          className="fixed right-5 top-5 inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/40 text-black opacity-70 shadow-sm backdrop-blur-sm transition hover:bg-white/60 hover:opacity-100"
          aria-label="Home"
        >
          <Home className="size-5" />
        </button>

        <div
          className="rounded-3xl bg-[#6f4a2f] px-8 py-5 text-4xl font-bold text-white shadow-sm md:text-6xl"
          style={{ fontFamily: '"Caudex", serif' }}
        >
          Chapter I : Ordinary World
        </div>

        <div className="mt-8 w-full max-w-3xl rounded-3xl border-2 border-black bg-white p-5 text-black shadow-xl">
          {displayName && <div className="text-3xl font-black">Hi, {displayName}</div>}
          <div className="mt-3 flex items-start gap-3 text-left">
            {editingVision ? (
              <Textarea
                value={draftVision}
                onChange={(event) => setDraftVision(event.target.value)}
                rows={4}
                className="min-h-28 flex-1 resize-none rounded-xl border-2 border-black bg-white text-base font-bold text-black"
                style={{ fontFamily: '"Roboto Mono", monospace' }}
              />
            ) : (
              <div
                className="min-w-0 flex-1 text-base font-bold leading-relaxed md:text-lg"
                style={{ fontFamily: '"Roboto Mono", monospace' }}
              >
                {state.goal}
              </div>
            )}
            <button
              type="button"
              onClick={editingVision ? saveVision : () => setEditingVision(true)}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-black/10 text-black hover:bg-black/20"
              aria-label={editingVision ? "Save vision" : "Edit vision"}
            >
              {editingVision ? <Check className="size-4" /> : <Pencil className="size-4" />}
            </button>
          </div>
        </div>

        <div className="mt-12 flex flex-wrap items-center justify-center gap-4">
          <button
            type="button"
            onClick={() => router.navigate({ to: "/" })}
            className="inline-flex items-center justify-center rounded-full bg-black px-8 py-3 font-semibold text-white shadow-sm hover:bg-black/85"
          >
            Next
          </button>
        </div>
      </div>
    );
  }

  if (showAimScreen) {
    const displayQuests = questNames.length
      ? questNames
      : state.categories.map((category) => category.name);

    return (
      <div
        className="min-h-screen px-6 py-16 text-white"
        style={{
          backgroundImage: "url('/Image/adventurebg.png')",
          backgroundSize: "auto 100vh",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          backgroundAttachment: "fixed",
        }}
      >
        <button
          type="button"
          onClick={goHome}
          className="fixed right-5 top-5 inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/40 text-black opacity-70 shadow-sm backdrop-blur-sm transition hover:bg-white/60 hover:opacity-100"
          aria-label="Home"
        >
          <Home className="size-5" />
        </button>

        <div className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-6xl flex-col justify-center">
          <div
            className="mb-8 max-w-5xl text-2xl font-bold leading-snug text-white md:text-3xl"
            style={{ fontFamily: '"Roboto Mono", monospace' }}
          >
            It's important to be specific with your plans, what do you aim to achieve at the end of
            each of these quests?
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {displayQuests.map((quest, index) => (
              <div key={`${quest}-${index}`} className="space-y-3">
                <div className="rounded-2xl border border-black/20 bg-white p-6 text-black shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex size-12 items-center justify-center rounded-xl bg-[#f4b434] text-2xl">
                        *
                      </div>
                      <div>
                        <h3 className="font-display text-xl font-semibold text-black">{quest}</h3>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-black/10" />

                  <Input
                    value={aims[index] ?? ""}
                    onChange={(event) => updateAim(index, event.target.value)}
                    placeholder="What do you aim to achieve?"
                    aria-label={`Specific aim for ${quest}`}
                    className="mt-4 min-h-14 rounded-xl border-0 bg-[#fed7aa] px-4 py-3 text-base font-semibold text-gray-600 placeholder:text-gray-500 focus-visible:ring-0 focus-visible:ring-offset-0"
                    style={{ fontFamily: '"Roboto Mono", monospace' }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-12 flex justify-center">
            <button
              type="button"
              onClick={continueToChapterIntro}
              className="inline-flex items-center justify-center rounded-full bg-gradient-to-br from-[#e5de00] to-[#d4b500] px-8 py-3 font-semibold text-white shadow-sm hover:opacity-95"
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6 py-16">
      <button
        type="button"
        onClick={goHome}
        className="fixed right-5 top-5 inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/40 text-black opacity-70 shadow-sm backdrop-blur-sm transition hover:bg-white/60 hover:opacity-100"
        aria-label="Home"
      >
        <Home className="size-5" />
      </button>

      <div className="mb-10 rounded-xl border border-white/20 bg-white/10 p-6 text-white shadow-sm">
        {state.goal && (
          <div className="relative mb-5 rounded-2xl border-2 border-black bg-white p-5 pr-16 text-lg font-semibold text-black shadow-sm">
            {editingVision ? (
              <Textarea
                value={draftVision}
                onChange={(event) => setDraftVision(event.target.value)}
                rows={4}
                className="resize-none border-0 bg-transparent p-0 text-lg font-semibold text-black shadow-none focus-visible:ring-0"
                style={{ fontFamily: '"Roboto Mono", monospace' }}
              />
            ) : (
              <div style={{ fontFamily: '"Roboto Mono", monospace' }}>{state.goal}</div>
            )}
            <button
              type="button"
              onClick={editingVision ? saveVision : () => setEditingVision(true)}
              className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/10 text-black transition hover:bg-black/20"
              aria-label={editingVision ? "Save vision" : "Edit vision"}
            >
              {editingVision ? <Check className="size-4" /> : <Pencil className="size-4" />}
            </button>
          </div>
        )}
        <div
          className="text-2xl font-bold text-white"
          style={{ fontFamily: '"Roboto Mono", monospace' }}
        >
          You have now made the first step : it is now time to break down your progress into goals
          that will help you reach them.
        </div>
      </div>

      <div className="mb-12 text-white">
        <div className="flex flex-wrap items-center gap-2 text-xl font-semibold">
          <span>I will get there by</span>
          {steps.map((step, index) => (
            <div key={index} className="flex items-center gap-2">
              <Input
                value={step}
                onChange={(event) => updateStep(index, event.target.value)}
                aria-label={`Goal ${index + 1}`}
                className="h-11 w-36 rounded-xl border-2 border-black bg-white text-base font-semibold text-black placeholder:text-black/40 focus-visible:ring-mint"
              />
              {index < steps.length - 2 && <span>,</span>}
              {index === steps.length - 2 && <span>and</span>}
            </div>
          ))}
          <button
            type="button"
            onClick={addStep}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border-2 border-black bg-white text-2xl font-bold leading-none text-black transition hover:bg-mint"
            aria-label="Add another goal"
          >
            +
          </button>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-center gap-4">
        <button
          type="button"
          onClick={continueToAimScreen}
          className="inline-flex items-center justify-center rounded-full bg-gradient-to-br from-[#e5de00] to-[#d4b500] px-6 py-3 font-semibold text-white shadow-sm hover:opacity-95"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
