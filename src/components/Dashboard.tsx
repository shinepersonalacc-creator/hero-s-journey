import { AppState, Category, levelInfo, todayKey, uid } from "@/lib/storage";
import { saveUserXP } from "@/lib/profile";
import { createSharedSession } from "@/lib/sessions";
import { ProgressRing } from "./ProgressRing";
import { CategoryCard } from "./CategoryCard";
import { AddCategoryDialog } from "./AddCategoryDialog";
import { VideoCallBox } from "./VideoCallBox";
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Eye,
  Home,
  Link,
  Pencil,
  Plus,
  Target,
  Trophy,
  Users,
  Video,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Textarea } from "./ui/textarea";
import { Button } from "./ui/button";

type Props = {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  displayName?: string;
};

export function Dashboard({ state, setState, displayName = "" }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(state.goal);
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const [hiddenCategoryIds, setHiddenCategoryIds] = useState<string[]>([]);
  const [videoOpen, setVideoOpen] = useState(false);
  const [sessionDialogOpen, setSessionDialogOpen] = useState(false);
  const [sessionName, setSessionName] = useState("");
  const [joinSessionLink, setJoinSessionLink] = useState("");
  const [sessionError, setSessionError] = useState("");
  const [creatingSession, setCreatingSession] = useState(false);
  const [chapterIntroLevel, setChapterIntroLevel] = useState<number | null>(null);
  const [levelUpLevel, setLevelUpLevel] = useState<number | null>(null);
  const chapterTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const today = todayKey();
  const allTasks = state.categories.flatMap((c) => c.tasks);
  const doneToday = allTasks.filter((t) => t.completedDates.includes(today)).length;
  const dayPercent = allTasks.length ? Math.round((doneToday / allTasks.length) * 100) : 0;

  const { level, percent, neededXP, pointsToNextLevel } = levelInfo(state.totalPoints);
  const previousLevel = useRef(level);
  const levelImage = getLevelImage(level);
  const stageBackground = {
    backgroundImage: `url('${levelImage}')`,
    backgroundSize: getLevelBackgroundSize(level),
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
    backgroundAttachment: "fixed",
  };

  useEffect(() => {
    if (previousLevel.current !== level && (level === 2 || level === 3)) {
      setLevelUpLevel(level);

      if (chapterTimer.current) window.clearTimeout(chapterTimer.current);

      chapterTimer.current = window.setTimeout(() => {
        setChapterIntroLevel(level);
        setLevelUpLevel(null);
        chapterTimer.current = null;
      }, 3000);
    }

    previousLevel.current = level;
  }, [level]);

  useEffect(() => {
    return () => {
      if (chapterTimer.current) window.clearTimeout(chapterTimer.current);
    };
  }, []);

  const visibleCategories = state.categories.filter((c) => !hiddenCategoryIds.includes(c.id));
  const hideLeveling = categoryPickerOpen || hiddenCategoryIds.length > 0;

  const goBack = () => window.history.back();
  const goForward = () => window.history.forward();
  const goHome = () => setState((s) => ({ ...s, goal: "" }));

  const updateCategory = (c: Category) =>
    setState((s) => ({ ...s, categories: s.categories.map((x) => (x.id === c.id ? c : x)) }));

  const moveCategory = (id: string, position: { x: number; y: number }) =>
    setState((s) => ({
      ...s,
      categories: s.categories.map((c) => (c.id === id ? { ...c, position } : c)),
    }));

  const deleteCategory = (id: string) => {
    setHiddenCategoryIds((ids) => ids.filter((hiddenId) => hiddenId !== id));

    setState((s) => {
      const category = s.categories.find((c) => c.id === id);
      const pointsToRemove = category
        ? category.tasks.reduce((sum, task) => sum + task.points * task.completedDates.length, 0)
        : 0;
      const totalPoints = Math.max(0, s.totalPoints - pointsToRemove);

      void saveUserXP(totalPoints);

      return {
        ...s,
        categories: s.categories.filter((c) => c.id !== id),
        totalPoints,
      };
    });
  };

  const addCategory = (name: string, emoji: string, aim: string) =>
    setState((s) => ({
      ...s,
      categories: [...s.categories, { id: uid(), name, emoji, aim, tasks: [] }],
    }));

  const createSession = async () => {
    setSessionError("");
    setCreatingSession(true);

    try {
      const session = await createSharedSession(sessionName);
      window.location.href = `/session/${session.id}`;
    } catch (error) {
      setSessionError(getErrorMessage(error, "Could not create session."));
      setCreatingSession(false);
    }
  };

  const joinSession = () => {
    const value = joinSessionLink.trim();
    if (!value) {
      setSessionError("Paste a session link or session ID first.");
      return;
    }

    try {
      const url = new URL(value);
      const sessionId = url.pathname.split("/session/")[1]?.split("/")[0];

      if (sessionId) {
        window.location.href = `/session/${sessionId}`;
        return;
      }
    } catch {
      // Plain session IDs are valid too.
    }

    window.location.href = `/session/${encodeURIComponent(value)}`;
  };

  const onComplete = (delta: number) =>
    setState((s) => {
      const totalPoints = Math.max(0, s.totalPoints + delta);
      void saveUserXP(totalPoints);

      return { ...s, totalPoints };
    });

  const toggleCategoryVisibility = (id: string) =>
    setHiddenCategoryIds((ids) =>
      ids.includes(id) ? ids.filter((hiddenId) => hiddenId !== id) : [...ids, id],
    );

  if (chapterIntroLevel) {
    return (
      <ChapterIntro
        level={chapterIntroLevel}
        goal={state.goal}
        displayName={displayName}
        onGoalChange={(goal) => setState((s) => ({ ...s, goal, draftGoal: goal }))}
        onNext={() => setChapterIntroLevel(null)}
      />
    );
  }

  return (
    <div
      className={`relative h-screen overflow-hidden ${levelUpLevel ? "level-up-falling" : ""}`}
      style={stageBackground}
    >
      <div className="mx-auto max-w-7xl px-6 py-10 md:py-14">
        <header className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="level-fall-item flex-1" style={{ animationDelay: "0ms" }}>
            {displayName && (
              <div className="text-3xl font-black text-white md:text-5xl">Hi, {displayName}</div>
            )}

            <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs uppercase tracking-widest text-white backdrop-blur">
              <Target className="size-3" /> Your dream
            </div>

            <div className="mt-4 flex gap-2">
              <button
                onClick={goBack}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition hover:bg-white/20"
                aria-label="Go back"
              >
                <ArrowLeft className="size-4" />
              </button>
              <button
                onClick={goForward}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition hover:bg-white/20"
                aria-label="Go forward"
              >
                <ArrowRight className="size-4" />
              </button>
              <CategoryVisibilityPicker
                categories={state.categories}
                hiddenCategoryIds={hiddenCategoryIds}
                open={categoryPickerOpen}
                onOpenChange={setCategoryPickerOpen}
                onToggleCategory={toggleCategoryVisibility}
                onShowAll={() => setHiddenCategoryIds([])}
              />
              <button
                onClick={() => setVideoOpen(true)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition hover:bg-white/20"
                aria-label="Open camera"
              >
                <Video className="size-4" />
              </button>
              <button
                onClick={() => setSessionDialogOpen(true)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition hover:bg-white/20"
                aria-label="Create session"
              >
                <Users className="size-4" />
              </button>
              <button
                onClick={goHome}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition hover:bg-white/20"
                aria-label="Go home"
              >
                <Home className="size-4" />
              </button>
              <AddCategoryDialog
                onAdd={addCategory}
                trigger={
                  <button
                    className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition hover:bg-white/20"
                    aria-label="Add category"
                  >
                    <Plus className="size-4" />
                  </button>
                }
              />
            </div>

            {editing ? (
              <div className="mt-4 max-w-2xl">
                <Textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={3}
                  className="rounded-2xl border-2 border-black bg-white p-5 text-base font-semibold text-black placeholder:text-black/50 md:text-lg"
                  style={{ fontFamily: '"Roboto Mono", monospace' }}
                />
                <div className="mt-3 flex gap-2">
                  <Button
                    onClick={() => {
                      const nextGoal = draft.trim() || state.goal;
                      setState((s) => ({ ...s, goal: nextGoal, draftGoal: nextGoal }));
                      setEditing(false);
                    }}
                    className="bg-gradient-to-br from-mint to-mint-bright text-white"
                  >
                    Save
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setDraft(state.goal);
                      setEditing(false);
                    }}
                    className="text-white/80 hover:text-white"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setEditing(true)}
                className="group mt-4 flex max-w-2xl items-start gap-3 rounded-2xl border-2 border-black bg-white p-5 text-left shadow-sm"
              >
                <h1
                  className="text-base font-semibold leading-relaxed text-black md:text-lg"
                  style={{ fontFamily: '"Roboto Mono", monospace' }}
                >
                  {state.goal}
                </h1>
                <Pencil className="mt-1 size-5 shrink-0 text-black/60 opacity-0 transition group-hover:opacity-100" />
              </button>
            )}
          </div>

          {!hideLeveling && (
            <div className="flex flex-wrap items-center gap-6">
              <div
                className="level-fall-item rounded-3xl border border-white/20 bg-black/30 p-4 text-white shadow-sm backdrop-blur"
                style={{ animationDelay: "350ms" }}
              >
                <div className="text-xs uppercase tracking-[0.35em] text-white/70">
                  Level {level}
                </div>
                <div className="mt-3 text-4xl font-display font-bold text-white">
                  {neededXP} pts
                </div>
                <div className="mt-1 text-sm uppercase tracking-[0.18em] text-white font-semibold">
                  required
                </div>
              </div>
              <div className="level-fall-item" style={{ animationDelay: "700ms" }}>
                <ProgressRing
                  percent={percent}
                  label={`L${level}`}
                  sublabel={`${state.totalPoints} pts`}
                />
              </div>
              <div
                className="level-fall-item flex flex-col gap-3"
                style={{ animationDelay: "1050ms" }}
              >
                <Stat
                  icon={<Calendar className="size-4" />}
                  label="Today"
                  value={`${dayPercent}%`}
                  sub={`${doneToday}/${allTasks.length} tasks`}
                />
                <Stat
                  icon={<Trophy className="size-4" />}
                  label="To next level"
                  value={`${pointsToNextLevel}`}
                  sub="points"
                />
              </div>
            </div>
          )}
        </header>

        <section className="mt-12">
          <div
            className="level-fall-item mb-5 flex items-baseline justify-between"
            style={{ animationDelay: "1250ms" }}
          >
            <h2 className="font-display text-2xl font-semibold">Categories</h2>
            <span className="text-sm text-white/70">
              {visibleCategories.length}/{state.categories.length} visible
            </span>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {visibleCategories.map((c, index) => (
              <div
                key={c.id}
                className="level-fall-item"
                style={{ animationDelay: `${1450 + index * 220}ms` }}
              >
                <CategoryCard
                  category={c}
                  onChange={updateCategory}
                  onDelete={() => deleteCategory(c.id)}
                  onComplete={onComplete}
                  onMove={(position) => moveCategory(c.id, position)}
                />
              </div>
            ))}
          </div>
        </section>
      </div>
      <VideoCallBox open={videoOpen} onOpenChange={setVideoOpen} />
      {sessionDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4">
          <div className="w-full max-w-md rounded-2xl border-2 border-black bg-white p-5 text-black shadow-xl">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-2xl font-bold">Create session</h2>
              <button
                type="button"
                onClick={() => setSessionDialogOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/10 text-xl font-bold hover:bg-black/20"
                aria-label="Close session dialog"
              >
                X
              </button>
            </div>

            <label className="mt-5 block text-sm font-bold uppercase tracking-widest text-black/70">
              Session name
            </label>
            <input
              value={sessionName}
              onChange={(event) => setSessionName(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && createSession()}
              className="mt-2 h-12 w-full rounded-xl border-2 border-black bg-white px-4 text-base font-semibold text-black outline-none"
              placeholder="Deep work sprint"
              autoFocus
            />

            {sessionError && (
              <div className="mt-3 rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white">
                {sessionError}
              </div>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSessionDialogOpen(false)}
                className="rounded-full bg-black/10 px-5 py-2 font-semibold text-black hover:bg-black/15"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={createSession}
                disabled={creatingSession}
                className="rounded-full bg-black px-5 py-2 font-semibold text-white hover:bg-black/85 disabled:opacity-60"
              >
                {creatingSession ? "Creating..." : "Create"}
              </button>
            </div>

            <div className="mt-6 border-t-2 border-black/10 pt-5">
              <label className="block text-sm font-bold uppercase tracking-widest text-black/70">
                Join session link
              </label>
              <div className="mt-2 flex gap-2">
                <input
                  value={joinSessionLink}
                  onChange={(event) => setJoinSessionLink(event.target.value)}
                  onKeyDown={(event) => event.key === "Enter" && joinSession()}
                  className="h-12 min-w-0 flex-1 rounded-xl border-2 border-black bg-white px-4 text-base font-semibold text-black outline-none"
                  placeholder="Paste link or ID"
                />
                <button
                  type="button"
                  onClick={joinSession}
                  className="inline-flex h-12 items-center gap-2 rounded-full bg-black px-5 font-semibold text-white hover:bg-black/85"
                >
                  <Link className="size-4" />
                  Join
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;

  if (typeof error === "object" && error && "message" in error) {
    return String((error as { message?: unknown }).message);
  }

  return fallback;
}

function getLevelImage(level: number) {
  if (level === 2) return "/Image/lvl2.png";
  if (level === 3) return "/Image/lvl 3.png";
  if (level === 1) return "/Image/lvl1.png";

  return "/Image/adventurebg.png";
}

function getLevelBackgroundSize(level: number) {
  return "auto 100vh";
}

function getChapterTitle(level: number) {
  if (level === 2) return "Chapter 2 : Call to Adventure";
  if (level === 3) return "Chapter 3 : Answering the Call";

  return "";
}

function ChapterIntro({
  level,
  goal,
  displayName,
  onGoalChange,
  onNext,
}: {
  level: number;
  goal: string;
  displayName?: string;
  onGoalChange: (goal: string) => void;
  onNext: () => void;
}) {
  const [editingGoal, setEditingGoal] = useState(false);
  const [draftGoal, setDraftGoal] = useState(goal);

  const saveGoal = () => {
    const nextGoal = draftGoal.trim() || goal;
    onGoalChange(nextGoal);
    setDraftGoal(nextGoal);
    setEditingGoal(false);
  };

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center px-6 py-16 text-center text-white"
      style={{
        backgroundImage: `url('${getLevelImage(level)}')`,
        backgroundSize: getLevelBackgroundSize(level),
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        backgroundAttachment: "fixed",
      }}
    >
      <div
        className="rounded-3xl bg-[#6f4a2f] px-8 py-5 text-4xl font-bold text-white shadow-sm md:text-6xl"
        style={{ fontFamily: '"Caudex", serif' }}
      >
        {getChapterTitle(level)}
      </div>

      <div className="mt-8 w-full max-w-3xl rounded-3xl border-2 border-black bg-white p-5 text-black shadow-xl">
        {displayName && <div className="text-3xl font-black">Hi, {displayName}</div>}
        <div className="mt-3 flex items-start gap-3 text-left">
          {editingGoal ? (
            <Textarea
              value={draftGoal}
              onChange={(event) => setDraftGoal(event.target.value)}
              rows={4}
              className="min-h-28 flex-1 resize-none rounded-xl border-2 border-black bg-white text-base font-bold text-black"
              style={{ fontFamily: '"Roboto Mono", monospace' }}
            />
          ) : (
            <div
              className="min-w-0 flex-1 text-base font-bold leading-relaxed md:text-lg"
              style={{ fontFamily: '"Roboto Mono", monospace' }}
            >
              {goal}
            </div>
          )}
          <button
            type="button"
            onClick={editingGoal ? saveGoal : () => setEditingGoal(true)}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-black/10 text-black hover:bg-black/20"
            aria-label={editingGoal ? "Save goal" : "Edit goal"}
          >
            {editingGoal ? <Check className="size-4" /> : <Pencil className="size-4" />}
          </button>
        </div>
      </div>

      <div className="mt-12 flex flex-wrap items-center justify-center gap-4">
        <button
          type="button"
          onClick={onNext}
          className="inline-flex items-center justify-center rounded-full bg-black px-8 py-3 font-semibold text-white shadow-sm hover:bg-black/85"
        >
          Next
        </button>
      </div>
    </div>
  );
}

function CategoryVisibilityPicker({
  categories,
  hiddenCategoryIds,
  open,
  onOpenChange,
  onToggleCategory,
  onShowAll,
}: {
  categories: Category[];
  hiddenCategoryIds: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onToggleCategory: (id: string) => void;
  onShowAll: () => void;
}) {
  return (
    <div className="relative">
      <button
        onClick={() => onOpenChange(!open)}
        className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition hover:bg-white/20"
        aria-label="Choose visible categories"
      >
        <Eye className="size-4" />
      </button>

      {open && (
        <div className="absolute left-0 top-14 z-50 w-72 rounded-2xl border border-black/20 bg-white p-4 text-black shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em]">
              <Eye className="size-4" />
              Visible
            </div>
            <button
              onClick={onShowAll}
              className="text-sm font-semibold text-black/70 hover:text-black"
            >
              Show all
            </button>
          </div>

          <div className="grid gap-2">
            {categories.map((category) => {
              const visible = !hiddenCategoryIds.includes(category.id);

              return (
                <label
                  key={category.id}
                  className="flex cursor-pointer items-center gap-3 rounded-xl border border-black/10 px-3 py-2 text-sm font-semibold transition hover:bg-black/5"
                >
                  <input
                    type="checkbox"
                    checked={visible}
                    onChange={() => onToggleCategory(category.id)}
                    className="size-4 accent-black"
                  />
                  <span className="text-lg">{category.emoji}</span>
                  <span>{category.name}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="rounded-xl border border-white/20 bg-black/30 px-4 py-3 text-white shadow-sm backdrop-blur">
      <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-white/80">
        {icon} {label}
      </div>
      <div
        className="mt-1 text-2xl font-bold text-white"
        style={{ fontFamily: '"Roboto Mono", monospace' }}
      >
        {value}
      </div>
      <div
        className="text-lg font-semibold text-white/90"
        style={{ fontFamily: '"Roboto Mono", monospace' }}
      >
        {sub}
      </div>
    </div>
  );
}
