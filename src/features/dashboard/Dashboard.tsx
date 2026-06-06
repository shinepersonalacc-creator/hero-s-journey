import { AppState, Category, emptyAppState, levelInfo, todayKey, uid } from "@/services/storage/storage";
import { createSharedSession } from "@/services/supabase/sessions";
import {
  getChapterBackgroundImage,
  getChapterBackgroundRepeat,
  getChapterBackgroundSize,
  getChapterInfo,
} from "@/lib/chapters";
import { LogoutButton } from "@/features/auth/LogoutButton";
import { ProgressRing } from "../../components/ui/display/ProgressRing";
import { CategoryCard } from "../goals/CategoryCard";
import { AddCategoryDialog } from "../goals/AddCategoryDialog";
import { VideoCallBox } from "../sessions/VideoCallBox";
import Draggable from "react-draggable";
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Check,
  Eraser,
  Eye,
  Home,
  ImagePlus,
  Link,
  Maximize2,
  Pencil,
  Plus,
  RotateCcw,
  Target,
  Trophy,
  Upload,
  Users,
  Video,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { Textarea } from "../../components/ui/forms/textarea";
import { Button } from "../../components/ui/forms/button";

const DEFAULT_GOAL_PROMPT = "Where do you see yourself in the end of this journey";
const DISCORD_URL = "https://discord.gg/cyqGzSPf";
const CUSTOM_WORKSPACE_IMAGES_KEY = "ascend.dashboard.customImages";

type Props = {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  displayName?: string;
};

type CustomWorkspaceImage = {
  id: string;
  name: string;
  src: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
};

export function Dashboard({ state, setState, displayName = "" }: Props) {
  const router = useRouter();
  const customImageInputRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(state.goal);
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const [hiddenCategoryIds, setHiddenCategoryIds] = useState<string[]>([]);
  const [visibilityFocusMode, setVisibilityFocusMode] = useState(false);
  const [videoOpen, setVideoOpen] = useState(false);
  const [customImages, setCustomImages] = useState<CustomWorkspaceImage[]>(loadStoredCustomImages);
  const [customImageError, setCustomImageError] = useState("");
  const [customBackgroundProcessingId, setCustomBackgroundProcessingId] = useState<string | null>(null);
  const [sessionDialogOpen, setSessionDialogOpen] = useState(false);
  const [sessionName, setSessionName] = useState("");
  const [joinSessionLink, setJoinSessionLink] = useState("");
  const [sessionError, setSessionError] = useState("");
  const [creatingSession, setCreatingSession] = useState(false);
  const [chapterIntroLevel, setChapterIntroLevel] = useState<number | null>(null);
  const [levelUpLevel, setLevelUpLevel] = useState<number | null>(null);
  const [resetPointsOpen, setResetPointsOpen] = useState(false);
  const [pointsToReset, setPointsToReset] = useState("");
  const chapterTimer = useRef<number | null>(null);

  const today = todayKey();
  const allTasks = state.categories.flatMap((c) => c.tasks);
  const doneToday = allTasks.filter((t) => t.completedDates.includes(today)).length;
  const dayPercent = allTasks.length ? Math.round((doneToday / allTasks.length) * 100) : 0;

  const { level, percent, neededXP, pointsToNextLevel } = levelInfo(state.totalPoints);
  const previousLevel = useRef(level);
  const chapter = getChapterInfo(level);
  const displayedGoal = state.goal.trim() && state.goal !== "Hero's Journey"
    ? state.goal
    : DEFAULT_GOAL_PROMPT;
  const stageBackground = {
    backgroundImage: getChapterBackgroundImage(level),
    backgroundSize: getChapterBackgroundSize(),
    backgroundPosition: "top center",
    backgroundRepeat: getChapterBackgroundRepeat(),
    backgroundAttachment: "scroll",
  };

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      window.localStorage.setItem(CUSTOM_WORKSPACE_IMAGES_KEY, JSON.stringify(customImages));
    } catch {
      setCustomImageError("Could not save custom images in this browser.");
    }
  }, [customImages]);

  useEffect(() => {
    if (previousLevel.current !== level && level >= 2 && level <= 10) {
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
    if (!sessionName.trim()) {
      setSessionError("Enter a session name first.");
      return;
    }

    setSessionError("");
    setCreatingSession(true);

    try {
      const session = await createSharedSession(sessionName);
      if (!session?.id) {
        throw new Error("Session creation failed. Please try again.");
      }

      setSessionDialogOpen(false);
      setCreatingSession(false);

      void router.navigate({ to: "/session/$sessionId", params: { sessionId: session.id } });
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
        router.navigate({ to: "/session/$sessionId", params: { sessionId } });
        return;
      }
    } catch {
      // Plain session IDs are valid too.
    }

    router.navigate({ to: "/session/$sessionId", params: { sessionId: encodeURIComponent(value) } });
  };

  const onComplete = (delta: number) =>
    setState((s) => {
      const totalPoints = Math.max(0, s.totalPoints + delta);

      return { ...s, totalPoints };
    });

  const resetPoints = () => {
    const amount = Math.max(0, Math.round(Number(pointsToReset)));
    if (!amount) return;

    setState((s) => ({ ...s, totalPoints: Math.max(0, s.totalPoints - amount) }));
    setPointsToReset("");
    setResetPointsOpen(false);
  };

  const toggleCategoryVisibility = (id: string) =>
    setHiddenCategoryIds((ids) =>
      ids.includes(id) ? ids.filter((hiddenId) => hiddenId !== id) : [...ids, id],
    );

  const openVisibilityControls = (open: boolean) => {
    setVisibilityFocusMode(true);
    setCategoryPickerOpen(open);
  };

  const exitVisibilityFocus = () => {
    setVisibilityFocusMode(false);
    setCategoryPickerOpen(false);
  };

  const openCustomUpload = () => {
    setCustomImageError("");
    customImageInputRef.current?.click();
  };

  const handleCustomImageUpload = async (files?: FileList | null) => {
    setCustomImageError("");
    const selectedFiles = Array.from(files ?? []);
    if (!selectedFiles.length) return;

    const imageFiles = selectedFiles.filter((file) => file.type.startsWith("image/"));
    if (!imageFiles.length) {
      setCustomImageError("Upload an image file.");
      return;
    }

    try {
      const nextImages = await Promise.all(
        imageFiles.map(async (file, index) => ({
          id: uid(),
          name: file.name,
          src: await readFileAsDataUrl(file),
          position: { x: index * 28, y: index * 28 },
          size: { width: 280, height: 220 },
        })),
      );

      setCustomImages((current) => [...current, ...nextImages]);
    } catch (error) {
      setCustomImageError(error instanceof Error ? error.message : "Could not load that image.");
    } finally {
      if (customImageInputRef.current) customImageInputRef.current.value = "";
    }
  };

  const removeCustomImageBackground = async (imageId: string) => {
    const image = customImages.find((item) => item.id === imageId);
    if (!image) return;

    setCustomImageError("");
    setCustomBackgroundProcessingId(imageId);

    try {
      const src = await removeBackgroundFromImage(image.src);
      setCustomImages((current) =>
        current.map((item) => (item.id === imageId ? { ...item, src } : item)),
      );
    } catch (error) {
      setCustomImageError(
        error instanceof Error ? error.message : "Could not remove the background.",
      );
    } finally {
      setCustomBackgroundProcessingId(null);
    }
  };

  if (chapterIntroLevel) {
    return (
      <ChapterIntro
        level={chapterIntroLevel}
        onNext={() => setChapterIntroLevel(null)}
      />
    );
  }

  return (
    <div
      className={`relative min-h-screen overflow-y-auto ${levelUpLevel ? "level-up-falling" : ""}`}
      style={stageBackground}
    >
      <input
        ref={customImageInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(event) => void handleCustomImageUpload(event.target.files)}
      />
      {!visibilityFocusMode && (
        <div className="fixed left-5 top-5 z-50">
          <a
            href={DISCORD_URL}
            className="inline-flex items-center justify-center rounded-full border-2 border-black bg-white px-4 py-2 font-bold text-black shadow-sm transition hover:bg-black/5"
          >
            Leave us your feedback in Discord
          </a>
        </div>
      )}
      {!visibilityFocusMode && (
        <div className="fixed right-5 top-5 z-50">
          <LogoutButton onLoggedOut={() => setState(emptyAppState)} />
        </div>
      )}
      {visibilityFocusMode && (
        <div className="fixed left-5 top-5 z-50 flex flex-wrap gap-2">
          <CategoryVisibilityPicker
            categories={state.categories}
            hiddenCategoryIds={hiddenCategoryIds}
            open={categoryPickerOpen}
            onOpenChange={openVisibilityControls}
            onToggleCategory={toggleCategoryVisibility}
            onShowAll={() => setHiddenCategoryIds([])}
            onExitFocus={exitVisibilityFocus}
          />
          <button
            onClick={() => setVideoOpen(true)}
            className="inline-flex h-11 items-center justify-center rounded-full border-2 border-black bg-white px-4 font-bold text-black shadow-sm transition hover:bg-black/5"
            aria-label="camera"
          >
            camera
          </button>
          <button
            type="button"
            onClick={openCustomUpload}
            className="inline-flex h-11 items-center gap-2 rounded-full border-2 border-black bg-white px-4 font-bold text-black shadow-sm transition hover:bg-black/5"
            aria-label="custom upload"
          >
            <ImagePlus className="size-4" />
            custom
          </button>
          <button
            onClick={() => setSessionDialogOpen(true)}
            className="inline-flex h-11 items-center justify-center rounded-full border-2 border-black bg-white px-4 font-bold text-black shadow-sm transition hover:bg-black/5"
            aria-label="session"
          >
            session
          </button>
          <button
            onClick={goHome}
            className="inline-flex h-11 items-center justify-center rounded-full border-2 border-black bg-white px-4 font-bold text-black shadow-sm transition hover:bg-black/5"
            aria-label="home"
          >
            home
          </button>
          {customImageError && (
            <div className="rounded-full border-2 border-black bg-white px-4 py-2 font-bold text-red-700 shadow-sm">
              {customImageError}
            </div>
          )}
        </div>
      )}
      <div className="mx-auto max-w-7xl px-6 py-10 md:py-14">
        {!visibilityFocusMode && (
          <header className="relative z-40 flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="level-fall-item flex-1" style={{ animationDelay: "0ms" }}>
            <div className="mt-3 inline-flex items-center gap-2 rounded-full border-2 border-black bg-white px-4 py-2 text-base md:text-lg font-bold uppercase tracking-[0.18em] text-black shadow-sm">
              <Target className="size-3" /> {chapter.label}
            </div>

            <div className="mt-4 flex gap-2">
              <button
                onClick={goBack}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border-2 border-black bg-white text-black shadow-sm transition hover:bg-black/5"
                aria-label="Go back"
              >
                <ArrowLeft className="size-4" />
              </button>
              <button
                onClick={goForward}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border-2 border-black bg-white text-black shadow-sm transition hover:bg-black/5"
                aria-label="Go forward"
              >
                <ArrowRight className="size-4" />
              </button>
              <CategoryVisibilityPicker
                categories={state.categories}
                hiddenCategoryIds={hiddenCategoryIds}
                open={categoryPickerOpen}
                onOpenChange={openVisibilityControls}
                onToggleCategory={toggleCategoryVisibility}
                onShowAll={() => setHiddenCategoryIds([])}
              />
              <button
                onClick={() => setVideoOpen(true)}
                className="inline-flex h-11 items-center justify-center rounded-full border-2 border-black bg-white px-4 font-bold text-black shadow-sm transition hover:bg-black/5"
                aria-label="camera"
              >
                camera
              </button>
              <button
                type="button"
                onClick={openCustomUpload}
                className="inline-flex h-11 items-center gap-2 rounded-full border-2 border-black bg-white px-4 font-bold text-black shadow-sm transition hover:bg-black/5"
                aria-label="custom upload"
              >
                <Upload className="size-4" />
                custom
              </button>
              <button
                onClick={() => setSessionDialogOpen(true)}
                className="inline-flex h-11 items-center justify-center rounded-full border-2 border-black bg-white px-4 font-bold text-black shadow-sm transition hover:bg-black/5"
                aria-label="session"
              >
                session
              </button>
              <button
                onClick={goHome}
                className="inline-flex h-11 items-center justify-center rounded-full border-2 border-black bg-white px-4 font-bold text-black shadow-sm transition hover:bg-black/5"
                aria-label="home"
              >
                home
              </button>
              <button
                type="button"
                onClick={() => setResetPointsOpen(true)}
                className="inline-flex h-11 items-center gap-2 rounded-full border-2 border-black bg-white px-4 font-bold text-black shadow-sm transition hover:bg-black/5"
              >
                <RotateCcw className="size-4" />
                reset points
              </button>
              <AddCategoryDialog
                onAdd={addCategory}
                trigger={
                  <button
                    className="inline-flex h-11 items-center justify-center rounded-full border-2 border-black bg-white px-4 font-bold text-black shadow-sm transition hover:bg-black/5"
                    aria-label="ccategory"
                  >
                    ccategory
                  </button>
                }
              />
              {customImageError && (
                <div className="inline-flex h-11 items-center rounded-full border-2 border-black bg-white px-4 text-sm font-bold text-red-700 shadow-sm">
                  {customImageError}
                </div>
              )}
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
                      const nextGoal = draft.trim() || displayedGoal;
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
                onClick={() => {
                  setDraft(displayedGoal);
                  setEditing(true);
                }}
                className="group mt-4 flex max-w-2xl items-start gap-3 rounded-2xl border-2 border-black bg-white p-5 text-left shadow-sm"
              >
                <h1
                  className="text-base font-semibold leading-relaxed text-black md:text-lg"
                  style={{ fontFamily: '"Roboto Mono", monospace' }}
                >
                  {displayedGoal}
                </h1>
                <Pencil className="mt-1 size-5 shrink-0 text-black/60 opacity-0 transition group-hover:opacity-100" />
              </button>
            )}
            </div>

            <div className="grid w-full max-w-[520px] grid-cols-1 items-center justify-items-center gap-4 sm:grid-cols-[140px_180px_140px] sm:justify-items-stretch lg:w-auto">
            <div
              className="level-fall-item flex min-h-28 w-full flex-col justify-center rounded-2xl border border-white/20 bg-black/30 p-4 text-white shadow-sm backdrop-blur"
              style={{ animationDelay: "350ms" }}
            >
              <div className="text-xs uppercase tracking-[0.35em] text-white/70">
                Level {level}
              </div>
              <div className="mt-3 font-display text-4xl font-bold text-white">
                {neededXP} pts
              </div>
              <div className="mt-1 text-sm font-semibold uppercase tracking-[0.18em] text-white">
                required
              </div>
            </div>
            <div
              className="level-fall-item flex justify-center"
              style={{ animationDelay: "700ms" }}
            >
              <ProgressRing
                percent={percent}
                label={`L${level}`}
                sublabel={`${state.totalPoints} pts`}
              />
            </div>
            <div
              className="level-fall-item flex w-full flex-col gap-2"
              style={{ animationDelay: "1050ms" }}
            >
              <Stat
                icon={<Trophy className="size-4" />}
                label="Total"
                value={`${state.totalPoints}`}
                sub="points"
              />
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
          </header>
        )}

        <section className={visibilityFocusMode ? "pt-20" : "mt-12"}>
          {!visibilityFocusMode && (
            <div
              className="level-fall-item mb-5 flex items-baseline justify-between"
              style={{ animationDelay: "1250ms" }}
            >
              <h2 className="font-display text-2xl font-semibold">Categories</h2>
              <span className="text-sm text-white/70">
                {visibleCategories.length}/{state.categories.length} visible
              </span>
            </div>
          )}

          <div className="relative z-20 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
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

          {customImages.length > 0 && (
            <div className="relative mt-8 min-h-[520px] overflow-visible">
              {customImages.map((image) => (
                <CustomWorkspaceImageObject
                  key={image.id}
                  image={image}
                  onMove={(position) => {
                    setCustomImages((current) =>
                      current.map((item) => (item.id === image.id ? { ...item, position } : item)),
                    );
                  }}
                  onResize={(size) => {
                    setCustomImages((current) =>
                      current.map((item) => (item.id === image.id ? { ...item, size } : item)),
                    );
                  }}
                  onRemove={() => {
                    setCustomImages((current) => current.filter((item) => item.id !== image.id));
                  }}
                  onRemoveBackground={() => void removeCustomImageBackground(image.id)}
                  removingBackground={customBackgroundProcessingId === image.id}
                />
              ))}
            </div>
          )}
        </section>

      </div>
      <VideoCallBox open={videoOpen} onOpenChange={setVideoOpen} />
      {resetPointsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4">
          <div className="w-full max-w-sm rounded-2xl border-2 border-black bg-white p-5 text-black shadow-xl">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-2xl font-bold">Reset points</h2>
              <button
                type="button"
                onClick={() => setResetPointsOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/10 text-xl font-bold hover:bg-black/20"
                aria-label="Close reset points dialog"
              >
                X
              </button>
            </div>

            <label className="mt-5 block text-sm font-bold uppercase tracking-widest text-black/70">
              Points to remove
            </label>
            <input
              type="number"
              min="0"
              step="1"
              inputMode="numeric"
              value={pointsToReset}
              onChange={(event) => setPointsToReset(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && resetPoints()}
              className="mt-2 h-12 w-full rounded-xl border-2 border-black bg-white px-4 text-base font-semibold text-black outline-none"
              placeholder="0"
              autoFocus
            />

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setResetPointsOpen(false)}
                className="rounded-full bg-black/10 px-5 py-2 font-semibold text-black hover:bg-black/15"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={resetPoints}
                disabled={!Number(pointsToReset)}
                className="rounded-full bg-black px-5 py-2 font-semibold text-white hover:bg-black/85 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
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

function CustomWorkspaceImageObject({
  image,
  onMove,
  onResize,
  onRemove,
  onRemoveBackground,
  removingBackground,
}: {
  image: CustomWorkspaceImage;
  onMove: (position: { x: number; y: number }) => void;
  onResize: (size: { width: number; height: number }) => void;
  onRemove: () => void;
  onRemoveBackground: () => void;
  removingBackground: boolean;
}) {
  const nodeRef = useRef<HTMLDivElement>(null);
  const lastSizeRef = useRef(image.size);

  useEffect(() => {
    const node = nodeRef.current;
    if (!node || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(([entry]) => {
      const width = Math.round(entry.contentRect.width);
      const height = Math.round(entry.contentRect.height);
      const lastSize = lastSizeRef.current;

      if (width === lastSize.width && height === lastSize.height) return;

      lastSizeRef.current = { width, height };
      onResize({ width, height });
    });

    observer.observe(node);
    return () => observer.disconnect();
  }, [onResize]);

  useEffect(() => {
    lastSizeRef.current = image.size;
  }, [image.size]);

  return (
    <Draggable
      nodeRef={nodeRef}
      defaultPosition={image.position}
      onStop={(_, data) => onMove({ x: data.x, y: data.y })}
      cancel="button,.custom-image-action"
    >
      <div
        ref={nodeRef}
        className="group absolute left-0 top-0 z-10 min-h-[80px] min-w-[80px] cursor-grab touch-none select-none resize overflow-hidden outline outline-2 outline-transparent will-change-transform hover:outline-black active:cursor-grabbing"
        style={{ width: image.size.width, height: image.size.height }}
      >
        <img
          src={image.src}
          alt={image.name}
          className="pointer-events-none h-full w-full select-none object-contain"
          draggable={false}
        />
        <div className="absolute right-1 top-1 hidden gap-1 group-hover:flex">
          <button
            type="button"
            onClick={onRemoveBackground}
            onMouseDown={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
            disabled={removingBackground}
            className="custom-image-action flex size-9 items-center justify-center border-2 border-black bg-white text-black shadow-md disabled:cursor-not-allowed disabled:opacity-60 hover:bg-black/5"
            aria-label={`Remove background from ${image.name}`}
            title="Remove background"
          >
            <Eraser className="size-4" strokeWidth={3} />
          </button>
          <button
            type="button"
            onClick={onRemove}
            onMouseDown={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
            className="custom-image-action flex size-9 items-center justify-center border-2 border-black bg-white text-black shadow-md hover:bg-red-50"
            aria-label={`Remove ${image.name}`}
            title="Remove image"
          >
            <X className="size-4" strokeWidth={4} />
          </button>
        </div>
        <div
          className="pointer-events-none absolute bottom-1 right-1 hidden size-8 items-center justify-center border-2 border-black bg-white text-black shadow-md group-hover:flex"
          title="Drag the corner to resize"
        >
          <Maximize2 className="size-4" strokeWidth={3} />
        </div>
        {removingBackground && (
          <div className="absolute inset-x-2 bottom-2 bg-white px-2 py-1 text-center text-xs font-bold text-black shadow-md">
            Removing bg...
          </div>
        )}
      </div>
    </Draggable>
  );
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;

  if (typeof error === "object" && error && "message" in error) {
    return String((error as { message?: unknown }).message);
  }

  return fallback;
}

function loadStoredCustomImages() {
  if (typeof window === "undefined") return [];

  try {
    const storedImages = window.localStorage.getItem(CUSTOM_WORKSPACE_IMAGES_KEY);
    if (!storedImages) return [];

    const parsedImages = JSON.parse(storedImages);
    return Array.isArray(parsedImages) && parsedImages.every(isCustomWorkspaceImage)
      ? parsedImages
      : [];
  } catch {
    return [];
  }
}

function isCustomWorkspaceImage(value: unknown): value is CustomWorkspaceImage {
  if (!value || typeof value !== "object") return false;

  const image = value as {
    id?: unknown;
    name?: unknown;
    src?: unknown;
    position?: unknown;
    size?: unknown;
  };

  return (
    typeof image.id === "string" &&
    typeof image.name === "string" &&
    typeof image.src === "string" &&
    isPoint(image.position) &&
    isSize(image.size)
  );
}

function isPoint(value: unknown): value is { x: number; y: number } {
  if (!value || typeof value !== "object") return false;
  const point = value as { x?: unknown; y?: unknown };
  return typeof point.x === "number" && typeof point.y === "number";
}

function isSize(value: unknown): value is { width: number; height: number } {
  if (!value || typeof value !== "object") return false;
  const size = value as { width?: unknown; height?: unknown };
  return typeof size.width === "number" && typeof size.height === "number";
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Could not read that image."));
    };
    reader.onerror = () => reject(new Error("Could not read that image."));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not process that image."));
    image.src = src;
  });
}

async function removeBackgroundFromImage(src: string) {
  const image = await loadImage(src);
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Background removal is not available in this browser.");

  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  context.drawImage(image, 0, 0);

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const background = sampleCornerColor(data, canvas.width, canvas.height);
  const tolerance = 72;
  const softEdge = 28;

  for (let index = 0; index < data.length; index += 4) {
    const distance = colorDistance(
      data[index],
      data[index + 1],
      data[index + 2],
      background.r,
      background.g,
      background.b,
    );

    if (distance <= tolerance) {
      data[index + 3] = 0;
    } else if (distance <= tolerance + softEdge) {
      const alphaRatio = (distance - tolerance) / softEdge;
      data[index + 3] = Math.round(data[index + 3] * alphaRatio);
    }
  }

  context.putImageData(imageData, 0, 0);
  return canvas.toDataURL("image/png");
}

function sampleCornerColor(data: Uint8ClampedArray, width: number, height: number) {
  const points = [
    { x: 0, y: 0 },
    { x: width - 1, y: 0 },
    { x: 0, y: height - 1 },
    { x: width - 1, y: height - 1 },
  ];

  const totals = points.reduce(
    (acc, point) => {
      const index = (point.y * width + point.x) * 4;
      return {
        r: acc.r + data[index],
        g: acc.g + data[index + 1],
        b: acc.b + data[index + 2],
      };
    },
    { r: 0, g: 0, b: 0 },
  );

  return {
    r: totals.r / points.length,
    g: totals.g / points.length,
    b: totals.b / points.length,
  };
}

function colorDistance(
  redA: number,
  greenA: number,
  blueA: number,
  redB: number,
  greenB: number,
  blueB: number,
) {
  return Math.sqrt(
    (redA - redB) ** 2 + (greenA - greenB) ** 2 + (blueA - blueB) ** 2,
  );
}

function ChapterIntro({
  level,
  onNext,
}: {
  level: number;
  onNext: () => void;
}) {
  const chapter = getChapterInfo(level);

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center px-6 py-16 text-center text-white"
      style={{
        backgroundImage: getChapterBackgroundImage(level),
        backgroundSize: getChapterBackgroundSize(),
        backgroundPosition: "top center",
        backgroundRepeat: getChapterBackgroundRepeat(),
        backgroundAttachment: "scroll",
      }}
    >
      <div
        className="rounded-3xl bg-[#6f4a2f] px-8 py-5 text-4xl font-bold text-white shadow-sm md:text-6xl"
        style={{ fontFamily: '"Caudex", serif' }}
      >
        {chapter.label}
      </div>

      <div
        className="mt-5 w-full max-w-3xl rounded-3xl border-2 border-black bg-white p-5 text-left text-base font-bold leading-relaxed text-black shadow-xl md:text-lg"
        style={{ fontFamily: '"Roboto Mono", monospace' }}
      >
        {chapter.description}
      </div>

      <div className="mt-12 flex flex-wrap items-center justify-center gap-4">
        <button
          type="button"
          onClick={onNext}
          className="inline-flex items-center justify-center rounded-full border-2 border-black bg-white px-8 py-3 font-bold text-black shadow-sm hover:bg-black/5"
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
  onExitFocus,
}: {
  categories: Category[];
  hiddenCategoryIds: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onToggleCategory: (id: string) => void;
  onShowAll: () => void;
  onExitFocus?: () => void;
}) {
  return (
    <div className="relative">
      <button
        onClick={() => onOpenChange(!open)}
        className="inline-flex h-11 items-center justify-center rounded-full border-2 border-black bg-white px-4 font-bold text-black shadow-sm transition hover:bg-black/5"
        aria-label="visibility"
      >
        visibility
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
          {onExitFocus && (
            <button
              type="button"
              onClick={onExitFocus}
              className="mb-3 w-full rounded-xl bg-black px-3 py-2 text-sm font-bold text-white transition hover:bg-black/85"
            >
              Show dashboard
            </button>
          )}

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
    <div className="rounded-xl border border-white/20 bg-black/30 px-3 py-2 text-white shadow-sm backdrop-blur">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-white/80">
        {icon} {label}
      </div>
      <div
        className="mt-0.5 text-xl font-bold text-white"
        style={{ fontFamily: '"Roboto Mono", monospace' }}
      >
        {value}
      </div>
      <div
        className="text-base font-semibold text-white/90"
        style={{ fontFamily: '"Roboto Mono", monospace' }}
      >
        {sub}
      </div>
    </div>
  );
}
