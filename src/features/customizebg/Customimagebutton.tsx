import { ImagePlus } from "lucide-react";
import { useRef, useState } from "react";

type CustomImageAsset = {
  id: string;
  name: string;
  src: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
};

type Props = {
  customImage: CustomImageAsset | null;
  onImageChange: (image: CustomImageAsset | null) => void;
};

function uid() {
  return Math.random().toString(36).slice(2);
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

export function CustomImageButton({ customImage, onImageChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [customOnlyMode, setCustomOnlyMode] = useState(false);

  const handleUpload = async (file?: File | null) => {
    setError("");
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Upload an image file.");
      return;
    }

    try {
      const src = await readFileAsDataUrl(file);
      onImageChange({
        id: uid(),
        name: file.name,
        src,
        position: customImage?.position ?? { x: 24, y: 120 },
        size: customImage?.size ?? { width: 280, height: 220 },
      });
      setCustomOnlyMode(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load that image.");
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <>
      {/* The button shown in the toolbar */}
      <button
        type="button"
        onClick={() => setCustomOnlyMode(true)}
        className="inline-flex h-11 items-center gap-2 rounded-xl border-2 border-black bg-[#f7e35b] px-4 font-bold text-black hover:bg-[#ffe95f]"
      >
        <ImagePlus className="size-4" />
        Custom
      </button>

      {/* Full screen upload modal */}
      {customOnlyMode && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4">
          <div className="flex w-full max-w-lg flex-col items-center gap-4 rounded-3xl border-4 border-black bg-white p-8 text-black shadow-[8px_8px_0_rgba(0,0,0,0.25)]">
            <div className="text-center text-2xl font-black">Upload a custom image</div>
            <p className="text-center text-sm text-black/70">
              Upload any image to place it on the session board.
            </p>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl border-2 border-black bg-[#f7e35b] px-6 text-lg font-bold text-black hover:bg-[#ffe95f]"
            >
              <ImagePlus className="size-5" />
              Upload image
            </button>
            <button
              type="button"
              onClick={() => setCustomOnlyMode(false)}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border-2 border-black bg-white px-6 text-base font-bold text-black hover:bg-black/5"
            >
              Cancel
            </button>
            {error && <div className="font-semibold text-red-700">{error}</div>}
          </div>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => void handleUpload(e.target.files?.[0])}
      />
    </>
  );
}