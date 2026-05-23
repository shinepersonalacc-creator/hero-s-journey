import { useState } from "react";
import { savePreferredDisplayName } from "@/lib/profile";

export function DisplayNamePrompt({ onComplete }: { onComplete: (displayName: string) => void }) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setError("");
    setSaving(true);

    try {
      const displayName = await savePreferredDisplayName(name);
      onComplete(displayName);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save your name.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="min-h-dvh bg-no-repeat px-6 py-12"
      style={{
        backgroundImage: "url('/Image/swordncloud.png?v=2')",
        backgroundSize: "auto 100%",
        backgroundPosition: "top center",
      }}
    >
      <div className="mx-auto flex min-h-[calc(100vh-6rem)] max-w-xl flex-col justify-center">
        <div className="rounded-3xl border-4 border-black bg-white p-6 text-black shadow-[8px_8px_0_rgba(0,0,0,0.25)]">
          <h1 className="text-4xl font-black">How do you want us to call you?</h1>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && save()}
            className="mt-6 h-14 w-full rounded-xl border-2 border-black bg-white px-4 text-xl font-bold outline-none"
            placeholder="Your name"
            autoFocus
          />
          {error && (
            <div className="mt-3 rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white">
              {error}
            </div>
          )}
          <button
            type="button"
            onClick={save}
            disabled={saving || name.trim().length < 2}
            className="mt-6 rounded-full bg-black px-8 py-3 font-bold text-white hover:bg-black/85 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Continue"}
          </button>
        </div>
      </div>
    </div>
  );
}
