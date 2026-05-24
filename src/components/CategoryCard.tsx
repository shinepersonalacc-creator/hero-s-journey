import { useRef, useState } from "react";
import Draggable, { DraggableData, DraggableEvent } from "react-draggable";
import { Category, Task, todayKey, uid } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, Flame, Pencil, Plus, Trash2 } from "lucide-react";

type Props = {
  category: Category;
  onChange: (c: Category) => void;
  onDelete: () => void;
  onComplete: (gainedPoints: number) => void;
  onMove: (position: { x: number; y: number }) => void;
};

export function CategoryCard({ category, onChange, onDelete, onComplete, onMove }: Props) {
  const nodeRef = useRef<HTMLDivElement>(null);
  const [newTask, setNewTask] = useState("");
  const [points, setPoints] = useState(5);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(category.name);
  const today = todayKey();

  const completedToday = category.tasks.filter((t) => t.completedDates.includes(today)).length;
  const progress = category.tasks.length ? (completedToday / category.tasks.length) * 100 : 0;

  const addTask = () => {
    if (newTask.trim().length < 1) return;
    const task: Task = { id: uid(), title: newTask.trim(), points, completedDates: [] };
    onChange({ ...category, tasks: [...category.tasks, task] });
    setNewTask("");
    setPoints(5);
  };

  const toggle = (task: Task) => {
    const has = task.completedDates.includes(today);
    const updated: Task = {
      ...task,
      completedDates: has
        ? task.completedDates.filter((d) => d !== today)
        : [...task.completedDates, today],
    };
    onChange({
      ...category,
      tasks: category.tasks.map((t) => (t.id === task.id ? updated : t)),
    });
    onComplete(has ? -task.points : task.points);
  };

  const removeTask = (id: string) =>
    onChange({ ...category, tasks: category.tasks.filter((t) => t.id !== id) });

  const saveTitle = () => {
    onChange({ ...category, name: titleDraft.trim() || category.name });
    setEditingTitle(false);
  };

  const savePosition = (_event: DraggableEvent, data: DraggableData) => {
    onMove({ x: data.x, y: data.y });
  };

  return (
    <Draggable
      nodeRef={nodeRef}
      defaultPosition={category.position || { x: 0, y: 0 }}
      cancel="button,input,textarea,select,option,a,.no-drag"
      onStop={savePosition}
    >
      <div
        ref={nodeRef}
        className="relative overflow-hidden rounded-2xl border border-black/20 bg-white p-6 text-black shadow-sm cursor-grab active:cursor-grabbing"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-xl bg-gradient-to-br from-forest to-secondary text-2xl text-black">
              {category.emoji}
            </div>
            <div>
              {editingTitle ? (
                <Input
                  value={titleDraft}
                  onChange={(event) => setTitleDraft(event.target.value)}
                  onKeyDown={(event) => event.key === "Enter" && saveTitle()}
                  className="h-9 border border-black/20 bg-white text-xl font-semibold text-black"
                  autoFocus
                />
              ) : (
                <h3 className="font-display text-xl font-semibold text-black break-words whitespace-normal">
                  {category.name}
                </h3>
              )}
              <div className="mt-0.5 flex items-center gap-2 text-xs text-black/70">
                <Flame className="size-3 text-black" />
                {completedToday}/{category.tasks.length} today
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={editingTitle ? saveTitle : () => setEditingTitle(true)}
              className="rounded-lg p-2 text-black/70 transition hover:bg-black/5 hover:text-black"
              aria-label={editingTitle ? "Save category title" : "Edit category title"}
            >
              {editingTitle ? <Check className="size-4" /> : <Pencil className="size-4" />}
            </button>
            <button
              onClick={onDelete}
              className="rounded-lg p-2 text-black/70 transition hover:bg-black/5 hover:text-black"
              aria-label="Delete category"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        </div>

        <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-black/10">
          <div
            className="h-full bg-gradient-to-r from-mint to-mint-bright transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        <ul className="mt-5 space-y-2">
          {category.tasks.map((t) => {
            const done = t.completedDates.includes(today);
            return (
              <li
                key={t.id}
                className={`group flex items-center gap-3 rounded-xl border px-3 py-2.5 transition ${
                  done ? "border-black/20 bg-[#f7e35b] text-black" : "border-black/20 bg-white text-black"
                }`}
              >
                <button
                  onClick={() => toggle(t)}
                  className={`flex size-7 shrink-0 items-center justify-center rounded-lg border transition ${
                    done
                      ? "border-black/20 bg-[#f7e35b] text-black"
                      : "border-black/20 bg-white text-black"
                  }`}
                >
                  {done && <Check className="size-4 text-black" strokeWidth={3} />}
                </button>
                <span className={`min-w-0 flex-1 break-words whitespace-normal text-sm ${done ? "text-black font-semibold" : "text-black"}`}>
                  {t.title}
                </span>
                <span className="rounded-md border border-black/10 bg-black/5 px-3 py-1 font-display text-sm font-semibold text-black">
                  +{t.points}
                </span>
                <button
                  onClick={() => removeTask(t.id)}
                  className="text-black/70 opacity-0 transition hover:text-black group-hover:opacity-100"
                  aria-label="Remove task"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </li>
            );
          })}
        </ul>

        <div className="mt-4 flex items-center gap-2">
          <Input
            value={newTask}
            onChange={(e) => setNewTask(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addTask()}
            placeholder="Add a daily quest..."
            className="border border-black/20 bg-white text-black placeholder:text-black/50"
          />
          <select
            value={points}
            onChange={(e) => setPoints(Number(e.target.value))}
            className="h-11 rounded-md border border-black/20 bg-white px-3 text-base text-black"
            aria-label="Points"
          >
            {[1, 2, 3, 5].map((p) => (
              <option key={p} value={p}>
                +{p} pts
              </option>
            ))}
          </select>
          <Button
            onClick={addTask}
            size="icon"
            className="bg-gradient-to-br from-mint to-mint-bright text-white hover:opacity-90"
          >
            <Plus className="size-4" />
          </Button>
        </div>

        {category.aim && (
          <div className="mt-4 rounded-xl bg-[#f97316]/50 px-4 py-3 text-sm font-semibold text-black shadow-sm">
            {category.aim}
          </div>
        )}
      </div>
    </Draggable>
  );
}
