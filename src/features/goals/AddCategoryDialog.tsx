import { ReactNode, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/overlays/dialog";
import { Button } from "@/components/ui/forms/button";
import { Input } from "@/components/ui/forms/input";
import { Plus } from "lucide-react";

const EMOJIS = ["🎯", "💪", "📚", "🧠", "🎨", "💼", "🧘", "💰", "🏃", "🌱", "🔥", "🎵"];

export function AddCategoryDialog({
  onAdd,
  trigger,
}: {
  onAdd: (name: string, emoji: string, aim: string) => void;
  trigger?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [aim, setAim] = useState("");
  const [emoji, setEmoji] = useState(EMOJIS[0]);

  const submit = () => {
    if (!name.trim()) return;
    onAdd(name.trim(), emoji, aim.trim());
    setName("");
    setAim("");
    setEmoji(EMOJIS[0]);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
        <button className="card-elevated flex min-h-[260px] flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border bg-card/30 p-6 text-muted-foreground transition hover:border-mint hover:bg-card/60 hover:text-mint">
          <div className="flex size-12 items-center justify-center rounded-xl bg-secondary">
            <Plus className="size-6" />
          </div>
          <span className="font-display text-base font-semibold">New category</span>
        </button>
        )}
      </DialogTrigger>
      <DialogContent className="border-2 border-black bg-white text-black shadow-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">New quest</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-xs uppercase tracking-widest text-black/70">Name</label>
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="e.g. Health, Learning, Career"
              className="border border-black/20 bg-white text-black placeholder:text-black/50"
            />
          </div>
          <div>
            <label className="mb-2 block text-xs uppercase tracking-widest text-black/70">End goal</label>
            <Input
              value={aim}
              onChange={(e) => setAim(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="I aim to..."
              className="border-0 bg-[#f97316] text-black placeholder:text-black/60"
            />
          </div>
          <div>
            <label className="mb-2 block text-xs uppercase tracking-widest text-black/70">Icon</label>
            <div className="grid grid-cols-6 gap-2">
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  onClick={() => setEmoji(e)}
                  className={`flex size-12 items-center justify-center rounded-xl border text-2xl transition ${
                    emoji === e ? "border-black bg-[#f7e35b] shadow-sm" : "border-black/20 bg-white hover:border-black"
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
          <Button
            onClick={submit}
            disabled={!name.trim()}
            className="w-full bg-gradient-to-br from-mint to-mint-bright text-primary-foreground hover:opacity-90"
          >
            New quest
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
