import { useEffect, useState } from "react";

export type Task = {
  id: string;
  title: string;
  points: number; // 1-10
  completedDates: string[]; // YYYY-MM-DD
};

export type Category = {
  id: string;
  name: string;
  emoji: string;
  aim?: string;
  position?: {
    x: number;
    y: number;
  };
  tasks: Task[];
};

export type AppState = {
  goal: string;
  draftGoal?: string;
  categories: Category[];
  totalPoints: number;
  showBeginMessage?: boolean;
};

const KEY = "ascend.app.v1";

const empty: AppState = { goal: "", categories: [], totalPoints: 0, showBeginMessage: false };

export function loadState(): AppState {
  if (typeof window === "undefined") return empty;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty;
    return { ...empty, ...JSON.parse(raw) };
  } catch {
    return empty
  }
}

export function useAppState() {
  const [state, setState] = useState<AppState>(empty);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setState(loadState());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      // Keep the app usable if the browser rejects a large draft save.
    }
  }, [state, hydrated]);

  return [state, setState, hydrated] as const;
}

export const todayKey = () => new Date().toISOString().slice(0, 10);

export function uid() {
  return Math.random().toString(36).slice(2, 10);
}

// Level system: each entry is the XP required to reach the next level
const levelRequirements = [
  50,
  70,
  90,
  140,
  160,
  200,
  220,
  240,
  280,
  300,
];

export function levelInfo(totalPoints: number) {
  let level = 1;
  let remainingXP = Math.round(totalPoints);

  for (let i = 0; i < levelRequirements.length; i++) {
    const needed = levelRequirements[i];

    if (remainingXP < needed) {
      return {
        level,
        currentXP: remainingXP,
        neededXP: needed,
        pointsToNextLevel: needed - remainingXP,
        percent: Math.round((remainingXP / needed) * 100),
      };
    }

    remainingXP -= needed;
    level++;
  }

  return {
    level,
    currentXP: remainingXP,
    neededXP: 0,
    percent: 100,
  };
}
