import { useEffect, useRef, useState } from "react";
import Draggable from "react-draggable";
import { ExternalLink, Video, VideoOff, X } from "lucide-react";
import { Button } from "../../components/ui/forms/button";

const cameraOffPlaceholder = "/Image/camera-off-placeholder.svg";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function VideoCallBox({ open, onOpenChange }: Props) {
  const nodeRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [active, setActive] = useState(false);
  const [error, setError] = useState("");

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setActive(false);
  };

  const closeWindow = () => {
    stopCamera();
    onOpenChange(false);
    setError("");
  };

  const startCamera = async () => {
    setError("");

    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Camera access is not available in this browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: "user",
          width: { ideal: 960 },
          height: { ideal: 540 },
        },
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
      }

      setActive(true);
    } catch {
      setError("Camera permission was blocked or no front camera was found.");
      setActive(false);
    }
  };

  useEffect(() => stopCamera, []);

  if (!open) return null;

  return (
    <Draggable
      nodeRef={nodeRef}
      handle=".video-drag-handle"
      cancel="button,a,video"
      defaultPosition={{ x: 24, y: 92 }}
    >
      <div
        ref={nodeRef}
        className="absolute left-0 top-0 z-40 flex h-[360px] min-h-[300px] w-[430px] min-w-[300px] max-w-[calc(100vw-2rem)] resize overflow-hidden border-4 border-black bg-[#f6bfd8] p-2 text-black shadow-[8px_8px_0_rgba(0,0,0,0.25)]"
      >
        <div className="flex min-h-0 flex-1 flex-col">
        <div className="video-drag-handle flex shrink-0 cursor-move items-center justify-end gap-2 pb-2">
          <button
            className="flex size-8 items-center justify-center border-2 border-black bg-white text-xl font-bold leading-none"
            aria-label="Minimize camera"
            onClick={() => onOpenChange(false)}
          >
            -
          </button>
          <button
            className="flex size-8 items-center justify-center border-2 border-black bg-white text-lg font-bold leading-none"
            aria-label="Camera window"
            type="button"
          >
            □
          </button>
          <button
            onClick={closeWindow}
            className="flex size-8 items-center justify-center border-2 border-black bg-white"
            aria-label="Close camera"
          >
            <X className="size-5" strokeWidth={4} />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col border-4 border-black bg-white">
          <div className="flex items-center justify-between border-b-4 border-black bg-[#fff1dd] px-3 py-2 font-mono text-lg font-bold">
            <div className="flex gap-6">
              <span>File</span>
              <span>Edit</span>
              <span>View</span>
            </div>
            <a
              href="https://discord.com/app"
              target="_blank"
              rel="noreferrer"
              className="inline-flex size-8 items-center justify-center border-2 border-black bg-white transition hover:bg-[#f6bfd8]"
              aria-label="Open Discord"
            >
              <ExternalLink className="size-4" />
            </a>
          </div>

          <div className="flex min-h-0 flex-1 flex-col bg-[#f6d8e6]">
            <div className="relative min-h-[190px] flex-1 bg-[#eadb80]">
              <video
                ref={videoRef}
                muted
                autoPlay
                playsInline
                className={`h-full w-full object-cover ${active ? "block" : "hidden"}`}
                style={{ transform: "scaleX(-1)" }}
              />

              {!active && (
                <img
                  src={cameraOffPlaceholder}
                  alt="Camera off"
                  className="h-full w-full object-cover"
                />
              )}
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2 border-t-4 border-black bg-[#f6d8e6] px-3 py-2">
              {active ? (
                <Button onClick={stopCamera} className="bg-white text-black hover:bg-white/90">
                  <VideoOff className="size-4" />
                  Stop camera
                </Button>
              ) : (
                <Button onClick={startCamera} className="bg-white text-black hover:bg-white/90">
                  <Video className="size-4" />
                  Start camera
                </Button>
              )}
              {error && <div className="text-sm font-semibold text-black">{error}</div>}
            </div>

          </div>
        </div>
        </div>
      </div>
    </Draggable>
  );
}
