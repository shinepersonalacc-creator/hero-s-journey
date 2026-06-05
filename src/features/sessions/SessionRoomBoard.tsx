import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import Draggable from "react-draggable";
import {
  Camera,
  CameraOff,
  Check,
  Eraser,
  Grip,
  ImagePlus,
  Maximize2,
  Video,
  VideoOff,
  X,
} from "lucide-react";
import { supabase } from "@/services/supabase/supabase";
import { Category, levelInfo, uid } from "@/services/storage/storage";
import { SignalSchema, type SignalMessage } from "./signalSchema";

const cameraOffPlaceholder = "/Image/camera-off-placeholder.svg";

type Props = {
  sessionId: string;
  categories: Category[];
  localXP: number;
  hostUserId?: string | null;
};

type SharedCategory = {
  id: string;
  name: string;
  emoji: string;
  aim?: string;
  tasks: {
    id: string;
    title: string;
    points: number;
    checked: boolean;
  }[];
};

type ParticipantPresence = {
  participantId: string;
  userId?: string;
  name: string;
  category: SharedCategory | null;
  cameraOn: boolean;
  xp: number;
  level: number;
  levelPercent: number;
  pointsToNextLevel: number;
  position?: { x: number; y: number };
  joinedAt: number;
};

type PeerContext = {
  peer: RTCPeerConnection;
  makingOffer: boolean;
  ignoreOffer: boolean;
  isSettingRemoteAnswerPending: boolean;
  polite: boolean;
};

type CustomImageLayer = "below" | "top";

type CustomImageAsset = {
  id: string;
  name: string;
  src: string;
  layer: CustomImageLayer;
  position: { x: number; y: number };
  size: { width: number; height: number };
};

function getParticipantId() {
  return uid();
}

function toSharedCategory(category?: Category | null): SharedCategory | null {
  if (!category) return null;
  const today = new Date().toISOString().slice(0, 10);

  return {
    id: category.id,
    name: category.name,
    emoji: category.emoji,
    aim: category.aim,
    tasks: category.tasks.map((task) => ({
      id: task.id,
      title: task.title,
      points: task.points,
      checked: task.completedDates.includes(today),
    })),
  };
}

function summarizePresence(state: Record<string, ParticipantPresence[]>) {
  const byId = new Map<string, ParticipantPresence>();

  Object.values(state).forEach((items) => {
    items.forEach((item) => {
      const existing = byId.get(item.participantId);
      if (!existing || item.joinedAt >= existing.joinedAt) byId.set(item.participantId, item);
    });
  });

  return Array.from(byId.values()).sort((a, b) => a.joinedAt - b.joinedAt);
}

export function SessionRoomBoard({ sessionId, categories, localXP, hostUserId }: Props) {
  const participantId = useMemo(getParticipantId, []);
  const joinedAtRef = useRef(Date.now());
  const customImageInputRef = useRef<HTMLInputElement>(null);
  const localCameraNodeRef = useRef<HTMLDivElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const cameraActiveRef = useRef(false);
  const peersRef = useRef(new Map<string, PeerContext>());
  const pendingIceRef = useRef(new Map<string, RTCIceCandidateInit[]>());
  const participantsRef = useRef<ParticipantPresence[]>([]);
  const [participants, setParticipants] = useState<ParticipantPresence[]>([]);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const [selectedCategoryId, setSelectedCategoryId] = useState(categories[0]?.id ?? "");
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [displayName, setDisplayName] = useState("Session guest");
  const [userId, setUserId] = useState<string | null>(null);
  const [cardPositions, setCardPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [customImage, setCustomImage] = useState<CustomImageAsset | null>(null);
  const [customImageError, setCustomImageError] = useState("");
  const [removingCustomBg, setRemovingCustomBg] = useState(false);

  const selectedCategory = useMemo(
    () =>
      categories.find((category) => category.id === selectedCategoryId) ?? categories[0] ?? null,
    [categories, selectedCategoryId],
  );
  const localLevelInfo = useMemo(() => levelInfo(localXP), [localXP]);
  const isHost = userId !== null && userId === hostUserId; // UI only; server/database must enforce kick/host permissions.

  const lastPresencePayloadRef = useRef<string>("");
  const presenceUpdateTimeoutRef = useRef<number | null>(null);

  const buildPresencePayload = () => {
    const category = toSharedCategory(selectedCategory);

    return {
      participantId,
      userId,
      name: displayName,
      category,
      cameraOn: cameraActiveRef.current,
      xp: localXP,
      level: localLevelInfo.level,
      levelPercent: localLevelInfo.percent,
      pointsToNextLevel: localLevelInfo.pointsToNextLevel ?? 0,
      joinedAt: joinedAtRef.current,
    };
  };

  const trackPresence = () => {
    const payload = buildPresencePayload();
    const serializedPayload = JSON.stringify(payload);
    if (serializedPayload === lastPresencePayloadRef.current) return;

    lastPresencePayloadRef.current = serializedPayload;
    void channelRef.current?.track(payload);
  };

  const schedulePresenceUpdate = () => {
    if (presenceUpdateTimeoutRef.current !== null) return;

    presenceUpdateTimeoutRef.current = window.setTimeout(() => {
      presenceUpdateTimeoutRef.current = null;
      trackPresence();
    }, 250);
  };

  const cleanupPeer = (remoteId: string) => {
    const context = peersRef.current.get(remoteId);
    if (!context) return;

    context.peer.close();
    peersRef.current.delete(remoteId);
    pendingIceRef.current.delete(remoteId);
    setRemoteStreams((current) => {
      const next = { ...current };
      delete next[remoteId];
      return next;
    });
  };

  const areParticipantsEqual = (
    current: ParticipantPresence[],
    next: ParticipantPresence[],
  ) => {
    if (current.length !== next.length) return false;
    return current.every((item, index) => {
      const nextItem = next[index];
      return (
        item.participantId === nextItem.participantId &&
        item.joinedAt === nextItem.joinedAt &&
        item.cameraOn === nextItem.cameraOn &&
        item.xp === nextItem.xp &&
        item.level === nextItem.level &&
        item.levelPercent === nextItem.levelPercent &&
        item.pointsToNextLevel === nextItem.pointsToNextLevel &&
        item.name === nextItem.name &&
        JSON.stringify(item.category) === JSON.stringify(nextItem.category)
      );
    });
  };

  useEffect(() => {
    if (selectedCategoryId || !categories[0]) return;
    setSelectedCategoryId(categories[0].id);
  }, [categories, selectedCategoryId]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const userName =
        data.user?.user_metadata?.full_name ||
        data.user?.user_metadata?.name ||
        data.user?.email?.split("@")[0] ||
        "Session guest";

      setDisplayName(userName);
      setUserId(data.user?.id ?? null);
    });
  }, []);

  const broadcastSignal = (message: Omit<SignalMessage, "from">) => {
    void channelRef.current?.send({
      type: "broadcast",
      event: "signal",
      payload: {
        ...message,
        from: participantId,
      },
    });
  };

  const attachLocalStreamToPeer = (peer: RTCPeerConnection, stream: MediaStream) => {
    stream.getTracks().forEach((track) => {
      const alreadySendingTrack = peer.getSenders().some((sender) => sender.track === track);
      const alreadySendingKind = peer
        .getSenders()
        .some((sender) => sender.track?.kind === track.kind);

      if (!alreadySendingTrack && !alreadySendingKind) {
        peer.addTrack(track, stream);
      }
    });
  };

  const flushPendingIce = async (remoteId: string, peer: RTCPeerConnection) => {
    const pendingCandidates = pendingIceRef.current.get(remoteId) ?? [];
    if (!pendingCandidates.length || !peer.remoteDescription) return;

    pendingIceRef.current.delete(remoteId);

    await Promise.all(
      pendingCandidates.map((candidate) => peer.addIceCandidate(new RTCIceCandidate(candidate))),
    );
  };

  const getPeerContext = (remoteId: string) => {
    const existing = peersRef.current.get(remoteId);
    if (existing) return existing;

    const peer = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });
    const context: PeerContext = {
      peer,
      makingOffer: false,
      ignoreOffer: false,
      isSettingRemoteAnswerPending: false,
      polite: participantId > remoteId,
    };

    if (localStreamRef.current) attachLocalStreamToPeer(peer, localStreamRef.current);

    peer.onnegotiationneeded = async () => {
      if (context.makingOffer) return;

      try {
        context.makingOffer = true;
        await peer.setLocalDescription();
        if (!peer.localDescription) return;

        broadcastSignal({
          to: remoteId,
          type: peer.localDescription.type as "offer" | "answer",
          description: peer.localDescription,
        });
      } catch (error) {
        console.error(error);
      } finally {
        context.makingOffer = false;
      }
    };

    peer.onicecandidate = (event) => {
      if (!event.candidate) return;
      broadcastSignal({ to: remoteId, type: "ice", candidate: event.candidate.toJSON() });
    };

    peer.ontrack = (event) => {
      const [stream] = event.streams;
      if (!stream) return;
      setRemoteStreams((current) => ({ ...current, [remoteId]: stream }));
    };

    peer.onconnectionstatechange = () => {
      if (["closed", "failed", "disconnected"].includes(peer.connectionState)) {
        setRemoteStreams((current) => {
          const next = { ...current };
          delete next[remoteId];
          return next;
        });
      }
    };

    peersRef.current.set(remoteId, context);
    return context;
  };

  const getPeer = (remoteId: string) => getPeerContext(remoteId).peer;

  const requestNegotiation = async (remoteId: string) => {
    const context = getPeerContext(remoteId);
    const { peer } = context;
    if (context.makingOffer || peer.signalingState !== "stable") return;

    try {
      context.makingOffer = true;
      await peer.setLocalDescription();
      if (!peer.localDescription) return;

      broadcastSignal({
        to: remoteId,
        type: peer.localDescription.type as "offer" | "answer",
        description: peer.localDescription,
      });
    } catch (error) {
      console.error(error);
    } finally {
      context.makingOffer = false;
    }
  };

  const handleSignal = async (message: SignalMessage) => {
    if (message.to !== participantId || message.from === participantId) return;

    if (message.type === "camera-off") {
      setRemoteStreams((current) => {
        const next = { ...current };
        delete next[message.from];
        return next;
      });
      return;
    }

    const context = getPeerContext(message.from);
    const { peer } = context;

    if (message.description) {
      const readyForOffer =
        !context.makingOffer &&
        (peer.signalingState === "stable" || context.isSettingRemoteAnswerPending);
      const offerCollision = message.description.type === "offer" && !readyForOffer;

      context.ignoreOffer = !context.polite && offerCollision;
      if (context.ignoreOffer) return;

      context.isSettingRemoteAnswerPending = message.description.type === "answer";
      await peer.setRemoteDescription(message.description);
      context.isSettingRemoteAnswerPending = false;
      await flushPendingIce(message.from, peer);

      if (message.description.type === "offer") {
        await peer.setLocalDescription();
        if (!peer.localDescription) return;

        broadcastSignal({
          to: message.from,
          type: peer.localDescription.type as "offer" | "answer",
          description: peer.localDescription,
        });
      }
    }

    if (message.type === "ice" && message.candidate) {
      if (!peer.remoteDescription) {
        const pendingCandidates = pendingIceRef.current.get(message.from) ?? [];
        pendingIceRef.current.set(message.from, [...pendingCandidates, message.candidate]);
        return;
      }

      try {
        await peer.addIceCandidate(new RTCIceCandidate(message.candidate));
      } catch (error) {
        if (!context.ignoreOffer) throw error;
      }
    }

    if (message.type === "kick" && message.to === participantId) {
      if (import.meta.env.DEV) {
        console.warn("Ignored client-broadcast kick signal. Kicks must be server-authorized.");
      }
    }
  };

  useEffect(() => {
    const channel = supabase.channel(`session-room-${sessionId}`, {
      config: { broadcast: { self: false }, presence: { key: participantId } },
    });

    channelRef.current = channel;

    channel
      .on("presence", { event: "sync" }, () => {
        const currentParticipants = participantsRef.current;
        const nextParticipants = summarizePresence(
          channel.presenceState<ParticipantPresence>() as Record<string, ParticipantPresence[]>,
        );

        if (areParticipantsEqual(currentParticipants, nextParticipants)) return;

        const removedPeers = currentParticipants
          .filter((participant) =>
            !nextParticipants.some((item) => item.participantId === participant.participantId),
          )
          .map((participant) => participant.participantId);

        removedPeers.forEach(cleanupPeer);

        const newPeers = nextParticipants.filter(
          (participant) =>
            participant.participantId !== participantId &&
            !currentParticipants.some((item) => item.participantId === participant.participantId),
        );

        participantsRef.current = nextParticipants;
        setParticipants(nextParticipants);

        if (cameraActiveRef.current) {
          newPeers.forEach((participant) => {
            if (peersRef.current.has(participant.participantId)) return;
            void requestNegotiation(participant.participantId);
          });
        }
      })
      .on("broadcast", { event: "signal" }, ({ payload }) => {
        const parsed = SignalSchema.safeParse(payload);

        if (!parsed.success) {
          if (import.meta.env.DEV) console.warn("Invalid realtime signal:", parsed.error);
          return;
        }

        const signal = parsed.data;

        if (signal.from === participantId) return;

        void handleSignal(signal);
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") trackPresence();
      });

    const peers = peersRef.current;
    const pendingIce = pendingIceRef.current;

   const handleVisibilityChange = () => {
  if (!document.hidden) {
    trackPresence();
  }
};

document.addEventListener('visibilitychange', handleVisibilityChange);

return () => {
  document.removeEventListener('visibilitychange', handleVisibilityChange);
  localStreamRef.current?.getTracks().forEach((track) => track.stop());
  peers.forEach(({ peer }) => peer.close());
  peers.clear();
  pendingIce.clear();
  void supabase.removeChannel(channel);
};
    // The realtime channel should only be recreated when the room identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, participantId]);

  useEffect(() => {
    if (!channelRef.current) return;
    schedulePresenceUpdate();

    return () => {
      if (presenceUpdateTimeoutRef.current !== null) {
        window.clearTimeout(presenceUpdateTimeoutRef.current);
        presenceUpdateTimeoutRef.current = null;
      }
    };
  }, [displayName, selectedCategoryId, cameraActive, localXP, localLevelInfo.level, localLevelInfo.percent, localLevelInfo.pointsToNextLevel, userId]);

  const startCamera = async () => {
    setCameraError("");
    setCameraOpen(true);

    if (typeof window !== "undefined" && !window.isSecureContext) {
      setCameraError("Camera needs a secure browser context to work.");
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Camera access is not available in this browser.");
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

      localStreamRef.current = stream;
      setLocalStream(stream);

      peersRef.current.forEach(({ peer }) => {
        attachLocalStreamToPeer(peer, stream);
      });

      setCameraActive(true);
      cameraActiveRef.current = true;
      trackPresence();
      await Promise.all(
        participantsRef.current
          .filter((participant) => participant.participantId !== participantId)
          .map((participant) => requestNegotiation(participant.participantId)),
      );
    } catch (error) {
      setCameraError(getCameraErrorMessage(error));
      setCameraActive(false);
      cameraActiveRef.current = false;
      trackPresence();
    }
  };

  const stopCamera = () => {
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    setLocalStream(null);
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    peersRef.current.forEach(({ peer }) => {
      peer.getSenders().forEach((sender) => {
        if (sender.track) peer.removeTrack(sender);
      });
    });
    participantsRef.current.forEach((participant) => {
      if (participant.participantId !== participantId) {
        broadcastSignal({ to: participant.participantId, type: "camera-off" });
      }
    });
    setCameraActive(false);
    cameraActiveRef.current = false;
    trackPresence();
  };

  const closeCamera = () => {
    stopCamera();
    setCameraOpen(false);
    setCameraError("");
  };

  const handleCustomImageUpload = async (file?: File | null) => {
    setCustomImageError("");
    if (!file) return;

    if (!["image/jpeg", "image/png"].includes(file.type)) {
      setCustomImageError("Upload a JPG or PNG image.");
      return;
    }

    try {
      const src = await readFileAsDataUrl(file);
      setCustomImage({
        id: uid(),
        name: file.name,
        src,
        layer: customImage?.layer ?? "top",
        position: customImage?.position ?? { x: 24, y: 120 },
        size: customImage?.size ?? { width: 280, height: 220 },
      });
    } catch (error) {
      setCustomImageError(error instanceof Error ? error.message : "Could not load that image.");
    } finally {
      if (customImageInputRef.current) customImageInputRef.current.value = "";
    }
  };

  const removeCustomImageBackground = async () => {
    if (!customImage) {
      setCustomImageError("Upload an image first.");
      return;
    }

    setRemovingCustomBg(true);
    setCustomImageError("");

    try {
      const src = await removeBackgroundFromImage(customImage.src);
      setCustomImage((current) => (current ? { ...current, src } : current));
    } catch (error) {
      setCustomImageError(
        error instanceof Error ? error.message : "Could not remove the background.",
      );
    } finally {
      setRemovingCustomBg(false);
    }
  };

  const displayedParticipants = participants.filter((participant) => participant.category);

  return (
    <div className="relative mt-8 min-h-[720px]">
      {customImage && (
        <CustomImageObject
          image={customImage}
          onMove={(position) => {
            setCustomImage((current) => (current ? { ...current, position } : current));
          }}
          onResize={(size) => {
            setCustomImage((current) => (current ? { ...current, size } : current));
          }}
          onRemoveBackground={() => void removeCustomImageBackground()}
          removingBackground={removingCustomBg}
          onRemove={() => setCustomImage(null)}
        />
      )}

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border-2 border-black bg-white p-4 text-black shadow-xl">
        <label className="flex min-w-[220px] flex-1 flex-col gap-1 font-bold">
          <span className="text-xs uppercase tracking-[0.2em] text-black/60">
            Category shown to group
          </span>
          <select
            value={selectedCategory?.id ?? ""}
            onChange={(event) => setSelectedCategoryId(event.target.value)}
            className="h-11 rounded-xl border-2 border-black bg-white px-3 text-base font-semibold"
          >
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.emoji} {category.name}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={cameraActive ? stopCamera : startCamera}
          className="inline-flex h-11 items-center gap-2 rounded-xl bg-black px-4 font-bold text-white hover:bg-black/85"
        >
          {cameraActive ? <VideoOff className="size-4" /> : <Video className="size-4" />}
          {cameraActive ? "Stop camera" : "Start camera"}
        </button>

        <button
          type="button"
          onClick={() => setCameraOpen(true)}
          className="inline-flex h-11 items-center gap-2 rounded-xl border-2 border-black bg-white px-4 font-bold text-black hover:bg-black/5"
        >
          <Maximize2 className="size-4" />
          Camera window
        </button>

        <button
          type="button"
          onClick={() => customImageInputRef.current?.click()}
          className="inline-flex h-11 items-center gap-2 rounded-xl border-2 border-black bg-[#f7e35b] px-4 font-bold text-black hover:bg-[#ffe95f]"
        >
          <ImagePlus className="size-4" />
          Custom
        </button>
        <input
          ref={customImageInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => void handleCustomImageUpload(event.target.files?.[0])}
        />
        {customImageError && <div className="font-semibold text-red-700">{customImageError}</div>}
      </div>

      {!categories.length && (
        <div className="mt-4 rounded-xl bg-black px-4 py-3 font-semibold text-white">
          Create a category on your dashboard, then come back here to share one with the group.
        </div>
      )}

      <div className="relative mt-6 min-h-[260px]">
        {displayedParticipants.map((participant, index) => (
          <ParticipantCategoryCard
            key={participant.participantId}
            participant={participant}
            canDrag
            position={cardPositions[participant.participantId]}
            defaultPosition={{ x: (index % 2) * 300, y: Math.floor(index / 2) * 210 }}
            onDragStop={(position) => {
              setCardPositions((current) => ({ ...current, [participant.participantId]: position }));
            }}
            isHost={isHost}
          />
        ))}
      </div>

      {cameraOpen && (
        <CameraWindow
          nodeRef={localCameraNodeRef}
          title={`${displayName} - lvl ${localLevelInfo.level}`}
          stream={localStream}
          videoRef={localVideoRef}
          active={cameraActive}
          canDrag
          defaultPosition={{ x: 0, y: 0 }}
          onClose={closeCamera}
          controls={
            <>
              <button
                type="button"
                onClick={cameraActive ? stopCamera : startCamera}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-black px-4 font-bold text-white hover:bg-black/85"
              >
                {cameraActive ? <CameraOff className="size-4" /> : <Camera className="size-4" />}
                {cameraActive ? "Turn off" : "Turn on"}
              </button>
              {cameraError && <div className="font-semibold text-black">{cameraError}</div>}
            </>
          }
        />
      )}

      <div className="relative mt-6 min-h-[260px]">
        {participants
          .filter(
            (participant) => participant.participantId !== participantId && participant.cameraOn,
          )
          .map((participant, index) => (
            <CameraWindow
              key={participant.participantId}
              title={`${participant.name} - lvl ${participant.level ?? 1}`}
              stream={remoteStreams[participant.participantId]}
              active={Boolean(remoteStreams[participant.participantId])}
              canDrag
              defaultPosition={{ x: (index % 2) * 340, y: Math.floor(index / 2) * 260 }}
            />
          ))}
      </div>
    </div>
  );
}

function ParticipantCategoryCard({
  participant,
  canDrag,
  defaultPosition,
  position,
  onDragStop,
  isHost,
  onRemove,
}: {
  participant: ParticipantPresence;
  canDrag: boolean;
  defaultPosition: { x: number; y: number };
  position?: { x: number; y: number } | null;
  onDragStop?: (position: { x: number; y: number }) => void;
  isHost: boolean;
  onRemove?: (participantId: string) => void;
}) {
  const nodeRef = useRef<HTMLDivElement>(null);
  const category = participant.category;

  if (!category) return null;

  const currentPosition = position ?? defaultPosition;
  const card = (
    <div
      ref={nodeRef}
      className={`absolute left-0 top-0 w-[min(320px,calc(100vw-2rem))] max-w-full min-w-[260px] rounded-2xl border-2 border-black bg-white p-4 text-black shadow-xl ${
        canDrag ? "cursor-grab active:cursor-grabbing" : ""
      } overflow-auto`}
      style={
        !canDrag
          ? { transform: `translate(${currentPosition.x}px, ${currentPosition.y}px)`, minHeight: 280 }
          : undefined
      }
    >
      {isHost && onRemove && (
        <button
          type="button"
          onClick={() => onRemove(participant.participantId)}
          className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full border-2 border-black bg-red-500 text-white hover:bg-red-600"
          aria-label={`Remove ${participant.name}`}
        >
          <X className="size-4" />
        </button>
      )}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-2xl font-black text-black break-words whitespace-normal">
            {participant.name} - lvl {participant.level ?? 1}
          </div>
          <div className="mt-3 flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-xl bg-[#f7e35b] text-2xl">
              {category.emoji}
            </div>
            <div className="min-w-0">
              <div className="text-2xl font-bold break-words whitespace-normal">{category.name}</div>
              <div className="font-semibold text-black/65">{category.tasks.length} quests</div>
            </div>
          </div>
        </div>
        {canDrag && <Grip className="mt-1 size-5 shrink-0 text-black/45" />}
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between font-mono text-sm font-bold">
          <span>{participant.xp ?? 0} XP</span>
          <span>{participant.pointsToNextLevel ?? 0} XP left</span>
        </div>
        <div className="mt-2 h-4 overflow-hidden rounded-full border-2 border-black bg-white">
          <div
            className="h-full bg-[#f7e35b]"
            style={{ width: `${participant.levelPercent ?? 0}%` }}
          />
        </div>
      </div>

      {category.aim && (
        <div className="mt-4 rounded-xl bg-[#f97316]/35 px-3 py-2 font-semibold">
          {category.aim}
        </div>
      )}
      <div className="mt-4 grid gap-2">
        {category.tasks.map((task) => (
          <div
            key={task.id}
            className={`flex items-center gap-2 rounded-xl border-2 border-black px-3 py-2 ${
              task.checked ? "bg-[#f7e35b]" : "bg-white"
            }`}
          >
            <span className="flex size-6 shrink-0 items-center justify-center rounded-md border-2 border-black bg-white font-bold">
              {task.checked && <Check className="size-4" strokeWidth={4} />}
            </span>
            <span className="min-w-0 flex-1 break-words whitespace-normal text-sm font-semibold">{task.title}</span>
            <span className="rounded-md bg-black px-2 py-0.5 text-sm font-bold text-white">
              +{task.points}
            </span>
          </div>
        ))}

        {!category.tasks.length && (
          <div className="rounded-xl border-2 border-dashed border-black/25 px-3 py-4 text-center font-semibold text-black/55">
            No checklist items yet.
          </div>
        )}
      </div>
      <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-black px-3 py-1 text-sm font-bold text-white">
        {participant.cameraOn ? (
          <Camera className="size-3.5" />
        ) : (
          <CameraOff className="size-3.5" />
        )}
        {participant.cameraOn ? "Camera on" : "Camera off"}
      </div>
    </div>
  );

  if (!canDrag) return card;

  return (
    <Draggable
      nodeRef={nodeRef}
      defaultPosition={defaultPosition}
      position={position ?? undefined}
      onStop={(_, data) => onDragStop?.({ x: data.x, y: data.y })}
      cancel="button,a"
    >
      {card}
    </Draggable>
  );
}

function CustomImageObject({
  image,
  onMove,
  onResize,
  onRemoveBackground,
  removingBackground,
  onRemove,
}: {
  image: CustomImageAsset;
  onMove: (position: { x: number; y: number }) => void;
  onResize: (size: { width: number; height: number }) => void;
  onRemoveBackground: () => void;
  removingBackground: boolean;
  onRemove: () => void;
}) {
  const nodeRef = useRef<HTMLDivElement>(null);
  const lastSizeRef = useRef(image.size);
  const zIndex = image.layer === "top" ? 60 : 1;

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
      position={image.position}
      onStop={(_, data) => onMove({ x: data.x, y: data.y })}
      cancel="button"
    >
      <div
        ref={nodeRef}
        className="group absolute left-0 top-0 min-h-[80px] min-w-[80px] cursor-move resize overflow-hidden outline outline-2 outline-transparent transition hover:outline-black"
        style={{ zIndex, width: image.size.width, height: image.size.height }}
      >
        <img
          src={image.src}
          alt={image.name}
          className="h-full w-full object-contain"
          draggable={false}
        />
        <div className="absolute right-1 top-1 hidden gap-1 group-hover:flex">
          <button
            type="button"
            onClick={onRemoveBackground}
            disabled={removingBackground}
            className="flex size-8 items-center justify-center border-2 border-black bg-white text-black shadow-md disabled:cursor-not-allowed disabled:opacity-60"
            aria-label={`Remove background from ${image.name}`}
            title="Remove background"
          >
            <Eraser className="size-4" strokeWidth={3} />
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="flex size-8 items-center justify-center border-2 border-black bg-white text-black shadow-md"
            aria-label={`Remove ${image.name}`}
            title="Remove image"
          >
            <X className="size-4" strokeWidth={4} />
          </button>
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

function CameraWindow({
  title,
  stream,
  videoRef,
  active,
  canDrag,
  defaultPosition,
  nodeRef,
  controls,
  onClose,
}: {
  title: string;
  stream?: MediaStream | null;
  videoRef?: RefObject<HTMLVideoElement | null>;
  active: boolean;
  canDrag: boolean;
  defaultPosition: { x: number; y: number };
  nodeRef?: RefObject<HTMLDivElement | null>;
  controls?: React.ReactNode;
  onClose?: () => void;
}) {
  const internalRef = useRef<HTMLVideoElement>(null);
  const internalNodeRef = useRef<HTMLDivElement>(null);
  const ref = videoRef ?? internalRef;
  const windowRef = nodeRef ?? internalNodeRef;

  useEffect(() => {
    const video = ref.current;
    if (!video) return;

    let cancelled = false;
    if (video.srcObject !== stream) {
      video.srcObject = stream ?? null;
    }

    if (stream) {
      void video.play().catch((error: unknown) => {
        if (cancelled || isInterruptedPlayError(error)) return;
        console.error(error);
      });
    }

    return () => {
      cancelled = true;
    };
  }, [ref, stream]);

  const content = (
    <div
     ref={windowRef}
className="absolute left-0 top-0 z-40 flex h-[300px] w-[min(340px,calc(100vw-2rem))] resize flex-col overflow-hidden border-4 border-black bg-[#f6bfd8] p-2 text-black shadow-[8px_8px_0_rgba(0,0,0,0.25)]"
style={{
  minWidth: 280,
  minHeight: 200,
  ...(!canDrag ? { transform: `translate(${defaultPosition.x}px, ${defaultPosition.y}px)` } : {}),
}}
    >
      <div className="session-camera-handle flex shrink-0 items-center justify-between gap-3 pb-2">
        <div className="flex min-w-0 items-center gap-2 font-mono text-xl font-black">
          {canDrag && <Grip className="size-5 shrink-0" />}
          <span className="truncate">{title}</span>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="flex size-8 shrink-0 items-center justify-center border-2 border-black bg-white"
            aria-label="Close camera window"
          >
            <X className="size-5" strokeWidth={4} />
          </button>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-hidden border-4 border-black bg-black">
        <div className="relative h-full min-h-[150px]">
          <video
            ref={ref}
            autoPlay
            muted={Boolean(videoRef)}
            playsInline
            className={`h-full w-full object-cover ${active ? "block" : "hidden"}`}
            style={videoRef ? { transform: "scaleX(-1)" } : undefined}
          />
          {!active && (
            <img
              src={cameraOffPlaceholder}
              alt="Camera off"
              className="h-full w-full object-cover"
            />
          )}
        </div>
      </div>
      {controls && (
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-x-4 border-b-4 border-black bg-[#fff1dd] px-3 py-2">
          {controls}
        </div>
      )}
    </div>
  );

  if (!canDrag) return content;

  return (
    <Draggable
      nodeRef={windowRef}
      handle=".session-camera-handle"
      cancel="button,video"
      defaultPosition={defaultPosition}
    >
      {content}
    </Draggable>
  );
}

function getCameraErrorMessage(error: unknown) {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError") return "Camera permission was blocked.";
    if (error.name === "NotFoundError") return "No camera was found on this device.";
    if (error.name === "NotReadableError") return "Your camera is already in use by another app.";
    if (error.name === "OverconstrainedError")
      return "This camera does not match the requested settings.";
    if (error.message) return error.message;
  }

  if (error instanceof Error && error.message) return error.message;

  return "Camera permission was blocked or no camera was found.";
}

function isInterruptedPlayError(error: unknown) {
  if (!(error instanceof DOMException)) return false;

  return error.name === "AbortError" || error.message.includes("interrupted");
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
