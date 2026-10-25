"use client";

import {
  type FormEvent,
  type PointerEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowUpRight,
  CalendarDays,
  Camera,
  Check,
  Compass,
  Download,
  ImagePlus,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  Mail,
  Plus,
  Sparkles,
  Target,
  Trash2,
  X,
} from "lucide-react";

type Profile = {
  id: string;
  email: string;
  displayName: string;
  avatarColor: string;
  birthDate: string | null;
  gender: string;
  lifespanYears: number;
  avatarUrl: string | null;
  updatedAt: string;
};

type Memory = {
  id: string;
  type: "image" | "video";
  url: string;
  caption: string;
  createdAt: string;
};

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type Wish = {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  category: string;
  color: string;
  status: string;
  privacy: string;
  progress: number;
  nextStep: string;
  targetDate: string | null;
  completedAt: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  memories: Memory[];
};

const palette: Record<string, { label: string; className: string; calendarColor: string }> = {
  terracotta: { label: "Terracotta", className: "terracotta", calendarColor: "#cb755a" },
  mimosa: { label: "Mimosa", className: "mimosa", calendarColor: "#d3ad49" },
  sage: { label: "Sauge", className: "sage", calendarColor: "#76946b" },
  ocean: { label: "Brume bleue", className: "ocean", calendarColor: "#729da6" },
  rose: { label: "Pétale", className: "rose", calendarColor: "#c77b8d" },
};

const categories = ["À vivre", "Voyage", "Sport", "Entreprendre", "Créer", "Rencontre", "Bien-être", "Défi"];
const statuses: Record<string, string> = {
  dreaming: "À rêver",
  progress: "En chemin",
  done: "Réalisé",
};

const initialDraft = {
  title: "",
  description: "",
  category: "À vivre",
  color: "terracotta",
  status: "dreaming",
  progress: 0,
  nextStep: "",
  targetDate: "",
};

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const data = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(data.error || "Une erreur est survenue.");
  return data;
}

function initials(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function statusClass(status: string) {
  if (status === "done") return "done";
  if (status === "progress") return "progress";
  return "dreaming";
}

function todayInputDate() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 10);
}

function avatarSource(profile: Profile) {
  return profile.avatarUrl ? profile.avatarUrl + "?v=" + encodeURIComponent(profile.updatedAt) : null;
}

export default function WishlistApp() {
  const [phase, setPhase] = useState<"loading" | "signed-out" | "ready">("loading");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [wishes, setWishes] = useState<Wish[]>([]);
  const [filter, setFilter] = useState<"all" | "done">("all");
  const [selectedWish, setSelectedWish] = useState<Wish | null>(null);
  const [showComposer, setShowComposer] = useState(false);
  const [view, setView] = useState<"wishes" | "profile">("wishes");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [dragPlacement, setDragPlacement] = useState<"before" | "after" | null>(null);
  const wishesRef = useRef<Wish[]>([]);
  const draggingIdRef = useRef<string | null>(null);
  const dragOverIdRef = useRef<string | null>(null);
  const dragPlacementRef = useRef<"before" | "after" | null>(null);
  const reorderStartWishesRef = useRef<Wish[] | null>(null);
  const [toast, setToast] = useState("");
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  const notify = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 3200);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/bootstrap", { cache: "no-store" });
      if (response.status === 401) {
        setProfile(null);
        setWishes([]);
        setPhase("signed-out");
        return;
      }
      const data = (await response.json()) as { profile?: Profile; wishes?: Wish[]; error?: string };
      if (!response.ok || !data.profile) throw new Error(data.error || "Impossible de charger ton espace.");
      setProfile(data.profile);
      setWishes(data.wishes ?? []);
      setPhase("ready");
    } catch (error) {
      setPhase("signed-out");
      notify(error instanceof Error ? error.message : "Impossible de charger ton espace.");
    }
  }, [notify]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refresh();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  useEffect(() => {
    wishesRef.current = wishes;
  }, [wishes]);

  useEffect(() => {
    const standaloneQuery = window.matchMedia("(display-mode: standalone)");
    const updateInstalledState = () => {
      const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean };
      setIsInstalled(standaloneQuery.matches || navigatorWithStandalone.standalone === true);
    };
    const savePrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const markInstalled = () => {
      setInstallPrompt(null);
      setIsInstalled(true);
    };

    updateInstalledState();
    if ("serviceWorker" in navigator) void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    window.addEventListener("beforeinstallprompt", savePrompt);
    window.addEventListener("appinstalled", markInstalled);
    standaloneQuery.addEventListener("change", updateInstalledState);
    return () => {
      window.removeEventListener("beforeinstallprompt", savePrompt);
      window.removeEventListener("appinstalled", markInstalled);
      standaloneQuery.removeEventListener("change", updateInstalledState);
    };
  }, []);

  const installApplication = useCallback(async () => {
    if (isInstalled) {
      notify("L’application est déjà installée.");
      return;
    }
    if (!installPrompt) {
      notify("Dans le menu du navigateur, choisis « Ajouter à l’écran d’accueil ».");
      return;
    }
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") {
      setInstallPrompt(null);
      setIsInstalled(true);
      notify("Application installée.");
    }
  }, [installPrompt, isInstalled, notify]);

  const filteredWishes = useMemo(
    () => (filter === "done" ? wishes.filter((wish) => wish.status === "done") : wishes),
    [filter, wishes],
  );

  function replaceWish(next: Wish) {
    setWishes((current) => current.map((wish) => wish.id === next.id ? next : wish));
    setSelectedWish(next);
  }

  async function saveWish(id: string, patch: Partial<Wish>) {
    const data = await api<{ wish: Wish }>("/api/wishes/" + id, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (data.wish) replaceWish(data.wish);
    notify("Objectif mis à jour.");
  }

  async function deleteWish(id: string) {
    await api<{ ok: boolean }>("/api/wishes/" + id, { method: "DELETE" });
    setWishes((current) => current.filter((wish) => wish.id !== id));
    setSelectedWish(null);
    notify("Objectif supprimé.");
  }

  function startReorder(id: string) {
    if (filter !== "all" || wishesRef.current.length < 2) return;
    draggingIdRef.current = id;
    dragOverIdRef.current = null;
    dragPlacementRef.current = null;
    reorderStartWishesRef.current = wishesRef.current;
    setDraggingId(id);
    setDragOverId(null);
    setDragPlacement(null);
  }

  function moveReorder(clientX: number, clientY: number) {
    const target = document.elementFromPoint(clientX, clientY)?.closest<HTMLElement>("[data-wish-id]");
    const nextId = target?.dataset.wishId;
    const draggedId = draggingIdRef.current;
    if (!nextId || !draggedId || nextId === draggedId) return;
    const rect = target.getBoundingClientRect();
    const placement = clientY < rect.top + rect.height / 2 ? "before" : "after";
    if (nextId === dragOverIdRef.current && placement === dragPlacementRef.current) return;

    const current = wishesRef.current;
    const draggedWish = current.find((wish) => wish.id === draggedId);
    const withoutDragged = current.filter((wish) => wish.id !== draggedId);
    let targetIndex = withoutDragged.findIndex((wish) => wish.id === nextId);
    if (!draggedWish || targetIndex < 0) return;
    if (placement === "after") targetIndex += 1;

    const next = [...withoutDragged];
    next.splice(targetIndex, 0, draggedWish);
    dragOverIdRef.current = nextId;
    dragPlacementRef.current = placement;
    setDragOverId(nextId);
    setDragPlacement(placement);
    if (next.some((wish, index) => wish.id !== current[index]?.id)) {
      wishesRef.current = next;
      setWishes(next);
    }

    const edge = 82;
    if (clientY < edge) window.scrollBy({ top: -16 });
    if (clientY > window.innerHeight - edge - 70) window.scrollBy({ top: 16 });
  }

  function finishReorder() {
    const draggedId = draggingIdRef.current;
    const initial = reorderStartWishesRef.current;
    const next = wishesRef.current;
    draggingIdRef.current = null;
    setDraggingId(null);
    setDragOverId(null);
    setDragPlacement(null);
    dragOverIdRef.current = null;
    dragPlacementRef.current = null;
    reorderStartWishesRef.current = null;
    if (!draggedId || !initial || initial.every((wish, index) => wish.id === next[index]?.id)) return;

    void api<{ wishes: Wish[] }>("/api/wishes/reorder", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ids: next.map((wish) => wish.id) }),
    })
      .then((data) => {
        wishesRef.current = data.wishes;
        setWishes(data.wishes);
        notify("Ordre mis à jour.");
      })
      .catch((reason) => {
        wishesRef.current = initial;
        setWishes(initial);
        notify(reason instanceof Error ? reason.message : "Impossible de modifier l’ordre.");
      });
  }

  function cancelReorder() {
    const initial = reorderStartWishesRef.current;
    draggingIdRef.current = null;
    dragOverIdRef.current = null;
    dragPlacementRef.current = null;
    reorderStartWishesRef.current = null;
    setDraggingId(null);
    setDragOverId(null);
    setDragPlacement(null);
    if (initial) {
      wishesRef.current = initial;
      setWishes(initial);
    }
  }

  async function logout() {
    try {
      await api<{ ok: boolean }>("/api/auth/logout", { method: "POST" });
    } catch {
      // La session locale est tout de même effacée à l’écran.
    }
    setView("wishes");
    setSelectedWish(null);
    setProfile(null);
    setWishes([]);
    setPhase("signed-out");
  }

  if (phase === "loading") return <LoadingCanvas />;
  if (phase === "signed-out") return <AuthScreen onAuthenticated={refresh} />;
  if (!profile) return <LoadingCanvas />;

  if (view === "profile") {
    return (
      <ProfilePage
        profile={profile}
        wishes={wishes}
        onClose={() => setView("wishes")}
        onSaved={(next) => {
          setProfile(next);
          notify("Profil mis à jour.");
        }}
        onOpenWish={(wish) => {
          setSelectedWish(wish);
          setView("wishes");
        }}
        onLogout={logout}
        onNotify={notify}
        onInstallApp={installApplication}
        isInstalled={isInstalled}
      />
    );
  }

  return (
    <main className="app-shell">
      <div className="sun-disc" />
      <div className="desktop-brand">
        <Brand />
      </div>
      <button className="desktop-profile-fab" onClick={() => setView("profile")} aria-label="Profil">
        <Avatar profile={profile} />
      </button>

      <section className="main-content">
        <header className="page-hero">
          <h1>Mes rêves<span className="accent-dot">.</span></h1>
          <button className="primary-button desktop-add" onClick={() => setShowComposer(true)}>
            <Plus size={18} /> Ajouter
          </button>
        </header>

        <div className="filter-row" aria-label="Filtrer les rêves">
          {[
            ["all", "Tous"],
            ["done", "Réalisés"],
          ].map(([key, label]) => (
            <button
              key={key}
              className={filter === key ? "filter-pill selected" : "filter-pill"}
              onClick={() => setFilter(key as typeof filter)}
            >
              {label}
            </button>
          ))}
        </div>

        {filteredWishes.length ? (
          <div className="wish-stack">
            {filteredWishes.map((wish, index) => (
              <WishLane
                key={wish.id}
                wish={wish}
                index={index}
                onOpen={() => setSelectedWish(wish)}
                reorderable={filter === "all"}
                dragging={draggingId === wish.id}
                dropPosition={draggingId && dragOverId === wish.id && draggingId !== wish.id ? dragPlacement : null}
                onReorderStart={() => startReorder(wish.id)}
                onReorderMove={moveReorder}
                onReorderEnd={finishReorder}
                onReorderCancel={cancelReorder}
              />
            ))}
          </div>
        ) : (
          <EmptyWishes filter={filter} onAdd={() => setShowComposer(true)} />
        )}
      </section>

      <nav className="mobile-bottom-nav" aria-label="Navigation">
        <button className="mobile-nav-item active" aria-label="Mes rêves">
          <Compass size={21} />
        </button>
        <button className="mobile-create" onClick={() => setShowComposer(true)} aria-label="Ajouter un rêve">
          <Plus size={25} />
        </button>
        <button className="mobile-nav-item profile-nav" onClick={() => setView("profile")} aria-label="Profil">
          <Avatar profile={profile} />
        </button>
      </nav>

      {showComposer && (
        <WishComposer
          onClose={() => setShowComposer(false)}
          onCreated={(wish) => {
            setWishes((current) => [wish, ...current]);
            setShowComposer(false);
            setSelectedWish(wish);
            notify("Nouveau rêve ajouté.");
          }}
        />
      )}
      {selectedWish && (
        <WishDetail
          key={selectedWish.id}
          wish={selectedWish}
          onClose={() => setSelectedWish(null)}
          onSave={saveWish}
          onDelete={() => deleteWish(selectedWish.id)}
          onNotify={notify}
        />
      )}
      {toast && <div className="toast" role="status"><Check size={16} /> {toast}</div>}
    </main>
  );
}

function Brand() {
  return (
    <button className="brand" aria-label="À vivre, accueil">
      <span className="brand-mark"><Sparkles size={16} /></span>
      <span>à vivre<span className="accent-dot">.</span></span>
    </button>
  );
}

function Avatar({ profile, className = "" }: { profile: Profile; className?: string }) {
  const src = avatarSource(profile);
  if (src) return <img className={"avatar-image " + className} src={src} alt="" />;
  return (
    <span className={"avatar-fallback " + className} style={{ background: profile.avatarColor }}>
      {initials(profile.displayName)}
    </span>
  );
}

function WishLane({
  wish,
  index,
  onOpen,
  reorderable,
  dragging,
  dropPosition,
  onReorderStart,
  onReorderMove,
  onReorderEnd,
  onReorderCancel,
}: {
  wish: Wish;
  index: number;
  onOpen: () => void;
  reorderable: boolean;
  dragging: boolean;
  dropPosition: "before" | "after" | null;
  onReorderStart: () => void;
  onReorderMove: (clientX: number, clientY: number) => void;
  onReorderEnd: () => void;
  onReorderCancel: () => void;
}) {
  const laneRef = useRef<HTMLElement>(null);
  const [focused, setFocused] = useState(index === 0);
  const longPressTimer = useRef<number | null>(null);
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const dragInProgress = useRef(false);
  const suppressOpen = useRef(false);
  const memories = wish.memories.slice(0, 6);

  useEffect(() => {
    const element = laneRef.current;
    if (!element || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => setFocused(entry.isIntersecting && entry.intersectionRatio > 0.52),
      { threshold: [0.35, 0.52, 0.72] },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => () => {
    if (longPressTimer.current) window.clearTimeout(longPressTimer.current);
  }, []);

  function clearLongPress() {
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  function handlePointerDown(event: PointerEvent<HTMLElement>) {
    if (!reorderable || (event.pointerType === "mouse" && event.button !== 0)) return;
    const element = event.currentTarget;
    const pointerId = event.pointerId;
    pointerStart.current = { x: event.clientX, y: event.clientY };
    clearLongPress();
    longPressTimer.current = window.setTimeout(() => {
      dragInProgress.current = true;
      suppressOpen.current = true;
      element.setPointerCapture?.(pointerId);
      (navigator as Navigator & { vibrate?: (pattern: number) => boolean }).vibrate?.(12);
      onReorderStart();
    }, 420);
  }

  function handlePointerMove(event: PointerEvent<HTMLElement>) {
    const start = pointerStart.current;
    if (!start) return;
    if (!dragInProgress.current) {
      if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > 12) clearLongPress();
      return;
    }
    event.preventDefault();
    onReorderMove(event.clientX, event.clientY);
  }

  function handlePointerEnd(event: PointerEvent<HTMLElement>) {
    clearLongPress();
    pointerStart.current = null;
    if (!dragInProgress.current) return;
    event.preventDefault();
    dragInProgress.current = false;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    onReorderEnd();
    window.setTimeout(() => { suppressOpen.current = false; }, 0);
  }

  function handlePointerCancel(event: PointerEvent<HTMLElement>) {
    clearLongPress();
    pointerStart.current = null;
    if (!dragInProgress.current) return;
    dragInProgress.current = false;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    onReorderCancel();
    window.setTimeout(() => { suppressOpen.current = false; }, 0);
  }

  return (
    <article
      ref={laneRef}
      data-wish-id={wish.id}
      className={[
        "wish-lane",
        focused ? "focused" : "",
        dragging ? "reorder-dragging" : "",
        dropPosition ? "reorder-target reorder-target-" + dropPosition : "",
      ].filter(Boolean).join(" ")}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerCancel}
    >
      <div className="memory-backdrop" aria-hidden="true">
        {memories.length ? (
          <div className="memory-track" style={{ animationDuration: String(Math.max(16, memories.length * 7)) + "s" }}>
            {[...memories, ...memories].map((memory, memoryIndex) =>
              memory.type === "video" ? (
                <video key={memory.id + "-" + memoryIndex} src={memory.url} muted loop autoPlay playsInline preload="metadata" />
              ) : (
                <img key={memory.id + "-" + memoryIndex} src={memory.url} alt="" />
              ),
            )}
          </div>
        ) : (
          <div className="memory-wash">
            <span />
            <span />
            <span />
          </div>
        )}
      </div>
      <button
        className={"wish-square " + (palette[wish.color]?.className ?? "terracotta")}
        onClick={(event) => {
          if (suppressOpen.current) {
            event.preventDefault();
            return;
          }
          onOpen();
        }}
        aria-label={"Ouvrir " + wish.title}
      >
        <span className={"wish-state " + statusClass(wish.status)}>{statuses[wish.status] ?? "À rêver"}</span>
        <p className="wish-category">{wish.category}</p>
        <h2>{wish.title}</h2>
        <div className="square-footer">
          {wish.memories.length > 0 ? <span><ImagePlus size={14} /> {wish.memories.length}</span> : <span />}
          <strong>{wish.progress}%</strong>
          <span className="square-arrow"><ArrowUpRight size={17} /></span>
        </div>
        <span className="square-progress"><i style={{ width: wish.progress + "%" }} /></span>
      </button>
    </article>
  );
}

function EmptyWishes({ filter, onAdd }: { filter: string; onAdd: () => void }) {
  if (filter !== "all") {
    return (
      <div className="empty-state">
        <div className="empty-orb"><Target size={28} /></div>
        <h2>Aucun rêve</h2>
      </div>
    );
  }
  return (
    <div className="empty-state">
      <div className="empty-orb"><Sparkles size={29} /></div>
      <h2>Un rêve à ajouter ?</h2>
      <button className="primary-button" onClick={onAdd}><Plus size={18} /> Ajouter</button>
    </div>
  );
}

function CategorySuggestions() {
  return (
    <datalist id="wish-categories">
      {categories.map((category) => <option key={category} value={category} />)}
    </datalist>
  );
}

function MemoryRivers({ memories, variant = "stage" }: { memories: Memory[]; variant?: "stage" | "ambient" }) {
  const source = memories.slice(0, 5);
  const repeats = source.length ? 4 : 0;
  const stream = Array.from({ length: repeats }, () => source).flat();

  return (
    <div className={"memory-rivers memory-rivers-" + variant} aria-hidden="true">
      {[0, 1, 2].map((row) => (
        <div className={"memory-river memory-river-" + row} key={row}>
          {stream.length ? [...stream.slice((row * Math.max(1, Math.ceil(source.length / 2))) % stream.length), ...stream.slice(0, (row * Math.max(1, Math.ceil(source.length / 2))) % stream.length)].map((memory, index) => (
            memory.type === "video" ? (
              <video key={`${row}-${memory.id}-${index}`} src={memory.url} muted loop autoPlay playsInline preload="metadata" />
            ) : (
              <img key={`${row}-${memory.id}-${index}`} src={memory.url} alt="" />
            )
          )) : <span className="memory-river-wash" />}
        </div>
      ))}
    </div>
  );
}

function MemoryStrip({ memories }: { memories: Memory[] }) {
  const source = memories.slice(0, 4);
  const stream = source.length ? [...source, ...source] : [];
  return (
    <div className="calendar-preview-media" aria-hidden="true">
      {stream.length ? stream.map((memory, index) => (
        memory.type === "video" ? (
          <video key={`${memory.id}-${index}`} src={memory.url} muted loop autoPlay playsInline preload="metadata" />
        ) : (
          <img key={`${memory.id}-${index}`} src={memory.url} alt="" />
        )
      )) : <span className="calendar-preview-wash" />}
    </div>
  );
}

function GoalHeader({
  wish,
  onClose,
  onTitleChange,
}: {
  wish: Wish;
  onClose: () => void;
  onTitleChange: (title: string) => void;
}) {
  const tone = palette[wish.color] ?? palette.terracotta;
  return (
    <header className={"memory-goal-header " + tone.className}>
      <div className="memory-goal-copy">
        <span className={"detail-status " + statusClass(wish.status)}>{statuses[wish.status] ?? "À rêver"}</span>
        <p>{wish.category}</p>
        <textarea
          className="memory-goal-title"
          rows={2}
          aria-label="Titre de l’objectif"
          value={wish.title}
          onChange={(event) => onTitleChange(event.target.value)}
        />
        {wish.completedAt && <small>Réalisé le {formattedDate(new Date(`${wish.completedAt}T12:00:00`))}</small>}
      </div>
      <CloseButton onClick={onClose} />
    </header>
  );
}

function MemoryModal({ wish, onClose, children }: { wish: Wish; onClose: () => void; children: ReactNode }) {
  return (
    <div className="memory-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <MemoryRivers memories={wish.memories} variant="ambient" />
      <div className="memory-modal-veil" aria-hidden="true" />
      <section className="memory-modal-panel detail-modal" role="dialog" aria-modal="true">{children}</section>
    </div>
  );
}

function WishComposer({ onClose, onCreated }: { onClose: () => void; onCreated: (wish: Wish) => void }) {
  const [draft, setDraft] = useState(initialDraft);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const data = await api<{ wish: Wish }>("/api/wishes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (data.wish) onCreated(data.wish);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Impossible d’ajouter ce rêve.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal onClose={onClose} className="composer-modal">
      <div className="modal-head">
        <h2>Ajouter un rêve<span className="accent-dot">.</span></h2>
        <CloseButton onClick={onClose} />
      </div>
      <form onSubmit={submit} className="form-grid">
        <label className="full-field">
          <span>Titre</span>
          <input autoFocus required placeholder="Ex. Aurores boréales" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
        </label>
        <label className="full-field">
          <span>Notes</span>
          <textarea rows={3} placeholder="Facultatif" value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} />
        </label>
        <label>
          <span>Catégorie</span>
          <input list="wish-categories" placeholder="Ex. Sport" value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })} />
        </label>
        <label>
          <span>Date</span>
          <input type="month" value={draft.targetDate} onChange={(event) => setDraft({ ...draft, targetDate: event.target.value })} />
        </label>
        <fieldset className="full-field palette-picker">
          <legend>Couleur</legend>
          <div>
            {Object.entries(palette).map(([key, value]) => (
              <button
                type="button"
                aria-label={value.label}
                className={draft.color === key ? "palette-dot " + value.className + " selected" : "palette-dot " + value.className}
                key={key}
                onClick={() => setDraft({ ...draft, color: key })}
              >
                <Check size={14} />
              </button>
            ))}
          </div>
        </fieldset>
        <label className="full-field">
          <span>Prochaine étape</span>
          <input placeholder="Facultatif" value={draft.nextStep} onChange={(event) => setDraft({ ...draft, nextStep: event.target.value })} />
        </label>
        {error && <p className="form-error">{error}</p>}
        <div className="form-actions">
          <button type="button" className="ghost-button" onClick={onClose}>Annuler</button>
          <button className="primary-button" disabled={saving}>{saving ? "Création…" : <><Sparkles size={17} /> Ajouter</>}</button>
        </div>
        <CategorySuggestions />
      </form>
    </Modal>
  );
}

function WishDetail({
  wish,
  onClose,
  onSave,
  onDelete,
  onNotify,
}: {
  wish: Wish;
  onClose: () => void;
  onSave: (id: string, patch: Partial<Wish>) => Promise<void>;
  onDelete: () => Promise<void>;
  onNotify: (value: string) => void;
}) {
  const [draft, setDraft] = useState(() => ({
    ...wish,
    progress: wish.status === "done" ? 100 : wish.progress,
    completedAt: wish.status === "done" ? wish.completedAt || todayInputDate() : wish.completedAt,
  }));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (draft.progress === 100 && !draft.completedAt) {
      setError("Indique la date de réalisation avant d’enregistrer.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave(wish.id, draft);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Impossible de sauvegarder.");
    } finally {
      setSaving(false);
    }
  }

  function updateProgress(progress: number) {
    setDraft((current) => ({
      ...current,
      progress,
      status: progress === 100 ? "done" : current.status === "done" ? "progress" : current.status,
      completedAt: progress === 100 ? current.completedAt || todayInputDate() : null,
    }));
  }

  function updateStatus(status: string) {
    setDraft((current) => {
      if (status === "done") {
        return { ...current, status, progress: 100, completedAt: current.completedAt || todayInputDate() };
      }
      return {
        ...current,
        status,
        progress: current.progress === 100 ? 99 : current.progress,
        completedAt: null,
      };
    });
  }

  async function deleteGoal() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleting(true);
    setError("");
    try {
      await onDelete();
    } catch (reason) {
      setDeleting(false);
      setError(reason instanceof Error ? reason.message : "Impossible de supprimer cet objectif.");
    }
  }

  async function upload(file: File) {
    setUploading(true);
    setError("");
    try {
      const form = new FormData();
      form.append("wishId", wish.id);
      form.append("asset", file);
      const data = await api<{ memory: Memory }>("/api/uploads", { method: "POST", body: form });
      setDraft((current) => ({ ...current, memories: [data.memory, ...current.memories] }));
      await onSave(wish.id, {});
      onNotify("Souvenir ajouté.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Impossible d’ajouter ce fichier.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <MemoryModal wish={draft} onClose={onClose}>
      <form onSubmit={submit}>
        <GoalHeader wish={draft} onClose={onClose} onTitleChange={(title) => setDraft((current) => ({ ...current, title }))} />
        <div className="detail-body">
          <label className="full-field">
            <span>Notes</span>
            <textarea rows={3} placeholder="Facultatif" value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} />
          </label>
          <div className="detail-customization">
            <label>
              <span>Catégorie</span>
              <input list="wish-categories" placeholder="Ex. Sport" value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })} />
            </label>
            <fieldset className="palette-picker detail-palette-picker">
              <legend>Couleur</legend>
              <div>
                {Object.entries(palette).map(([key, value]) => (
                  <button
                    type="button"
                    aria-label={value.label}
                    className={draft.color === key ? "palette-dot " + value.className + " selected" : "palette-dot " + value.className}
                    key={key}
                    onClick={() => setDraft({ ...draft, color: key })}
                  >
                    <Check size={14} />
                  </button>
                ))}
              </div>
            </fieldset>
          </div>
          <CategorySuggestions />
          <div className="detail-columns">
            <section>
              <span className="field-label">Avancement</span>
              <div className="progress-edit">
                <strong>{draft.progress}%</strong>
                <input type="range" min="0" max="100" value={draft.progress} onChange={(event) => updateProgress(Number(event.target.value))} />
              </div>
              <div className="status-toggle">
                {Object.entries(statuses).map(([key, label]) => (
                  <button type="button" className={draft.status === key ? "active" : ""} key={key} onClick={() => updateStatus(key)}>
                    {label}
                  </button>
                ))}
              </div>
            </section>
            <section>
              <span className="field-label">Échéance</span>
              <label className="date-input">
                <CalendarDays size={17} />
                <input type="month" value={draft.targetDate ?? ""} onChange={(event) => setDraft({ ...draft, targetDate: event.target.value })} />
              </label>
              {draft.progress === 100 && (
                <>
                  <span className="field-label completion-label">Réalisé le</span>
                  <label className="date-input completion-date">
                    <CalendarDays size={17} />
                    <input required type="date" value={draft.completedAt ?? ""} onChange={(event) => setDraft({ ...draft, completedAt: event.target.value })} />
                  </label>
                </>
              )}
            </section>
          </div>
          <label className="full-field action-field">
            <span><Target size={16} /> Prochaine étape</span>
            <textarea rows={2} placeholder="Facultatif" value={draft.nextStep} onChange={(event) => setDraft({ ...draft, nextStep: event.target.value })} />
          </label>
          <section className="memory-section">
            <div className="memory-heading">
              <span className="field-label">Souvenirs</span>
              <button type="button" className="upload-button" onClick={() => fileRef.current?.click()} disabled={uploading}>
                <ImagePlus size={17} /> {uploading ? "Ajout…" : "Ajouter"}
              </button>
              <input
                ref={fileRef}
                className="visually-hidden"
                type="file"
                accept="image/*,video/*"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void upload(file);
                  event.currentTarget.value = "";
                }}
              />
            </div>
            {draft.memories.length ? (
              <div className="memory-grid">
                {draft.memories.map((memory) => (
                  <div className="memory-tile" key={memory.id}>
                    {memory.type === "video" ? <video src={memory.url} controls preload="metadata" /> : <img src={memory.url} alt={memory.caption || "Souvenir"} />}
                    {memory.type === "video" && <span className="video-badge">Vidéo</span>}
                    <a className="memory-download" href={memory.url} download aria-label={`Télécharger ${memory.caption || "ce souvenir"}`}>
                      <Download size={15} />
                    </a>
                  </div>
                ))}
              </div>
            ) : (
              <button type="button" className="memory-placeholder" onClick={() => fileRef.current?.click()}>
                <ImagePlus size={23} />
                <span>Ajouter un souvenir</span>
              </button>
            )}
          </section>
          {error && <p className="form-error">{error}</p>}
          <div className="form-actions detail-actions">
            <button type="button" className={confirmDelete ? "delete-button confirm" : "delete-button"} disabled={deleting} onClick={() => void deleteGoal()}>
              <Trash2 size={16} /> {deleting ? "Suppression…" : confirmDelete ? "Confirmer" : "Supprimer"}
            </button>
            <button className="primary-button" disabled={saving || deleting}>{saving ? "Sauvegarde…" : <><Check size={17} /> Enregistrer</>}</button>
          </div>
        </div>
      </form>
    </MemoryModal>
  );
}

function ProfilePage({
  profile,
  wishes,
  onClose,
  onSaved,
  onOpenWish,
  onLogout,
  onNotify,
  onInstallApp,
  isInstalled,
}: {
  profile: Profile;
  wishes: Wish[];
  onClose: () => void;
  onSaved: (profile: Profile) => void;
  onOpenWish: (wish: Wish) => void;
  onLogout: () => Promise<void>;
  onNotify: (message: string) => void;
  onInstallApp: () => Promise<void>;
  isInstalled: boolean;
}) {
  const [draft, setDraft] = useState({
    displayName: profile.displayName,
    birthDate: profile.birthDate ?? "",
    gender: profile.gender,
    lifespanYears: profile.lifespanYears,
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const [error, setError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [selectedWeek, setSelectedWeek] = useState<LifeWeek | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const data = await api<{ profile: Profile }>("/api/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(draft),
      });
      onSaved(data.profile);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Impossible de modifier ton profil.");
    } finally {
      setSaving(false);
    }
  }

  async function uploadAvatar(file: File) {
    setUploading(true);
    setError("");
    try {
      const form = new FormData();
      form.append("asset", file);
      const data = await api<{ profile: Profile }>("/api/avatar", { method: "POST", body: form });
      onSaved(data.profile);
      onNotify("Photo mise à jour.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Impossible d’ajouter cette photo.");
    } finally {
      setUploading(false);
    }
  }

  async function updatePassword(event: FormEvent) {
    event.preventDefault();
    setPasswordError("");
    try {
      await api<{ ok: boolean }>("/api/auth/change-password", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ currentPassword, nextPassword }),
      });
      setCurrentPassword("");
      setNextPassword("");
      setShowPassword(false);
      onNotify("Mot de passe mis à jour.");
    } catch (reason) {
      setPasswordError(reason instanceof Error ? reason.message : "Impossible de modifier le mot de passe.");
    }
  }

  return (
    <main className="profile-page">
      <div className="sun-disc" />
      <header className="profile-page-top">
        <Brand />
        <CloseButton onClick={onClose} label="Retour aux rêves" />
      </header>
      <section className="profile-page-content">
        <div className="avatar-editor">
          <button type="button" className="avatar-editor-button" onClick={() => fileRef.current?.click()} aria-label="Modifier la photo">
            <Avatar profile={profile} className="profile-avatar" />
            <span><Camera size={16} /></span>
          </button>
          <input
            ref={fileRef}
            className="visually-hidden"
            type="file"
            accept="image/*"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void uploadAvatar(file);
              event.currentTarget.value = "";
            }}
          />
          {uploading && <LoaderCircle className="avatar-loader" size={22} />}
        </div>

        <LifeCalendar
          birthDate={draft.birthDate}
          lifespanYears={draft.lifespanYears}
          wishes={wishes}
          onSelectWeek={setSelectedWeek}
          onOpenWish={onOpenWish}
        />

        <form onSubmit={saveProfile} className="profile-form">
          <label>
            <span>Nom</span>
            <input value={draft.displayName} onChange={(event) => setDraft({ ...draft, displayName: event.target.value })} />
          </label>
          <div className="profile-email">
            <Mail size={16} />
            <span>{profile.email}</span>
          </div>
          <div className="profile-two-columns">
            <label>
              <span>Je suis</span>
              <select value={draft.gender} onChange={(event) => setDraft({ ...draft, gender: event.target.value })}>
                <option value="female">Une femme</option>
                <option value="male">Un homme</option>
                <option value="other">Autre</option>
                <option value="unspecified">Je ne précise pas</option>
              </select>
            </label>
            <label>
              <span>Naissance</span>
              <input type="date" value={draft.birthDate} onChange={(event) => setDraft({ ...draft, birthDate: event.target.value })} />
            </label>
          </div>
          <label className="life-setting">
            <span>Repère de vie</span>
            <div><input type="number" min="50" max="120" value={draft.lifespanYears} onChange={(event) => setDraft({ ...draft, lifespanYears: Number(event.target.value) })} /><b>ans</b></div>
          </label>
          {error && <p className="form-error">{error}</p>}
          <div className="form-actions">
            <button className="primary-button" disabled={saving}>{saving ? "Sauvegarde…" : "Enregistrer"}</button>
          </div>
        </form>

        <section className="password-section">
          <button type="button" className="section-toggle" onClick={() => setShowPassword((value) => !value)}>
            <span><KeyRound size={17} /> Mot de passe</span>
            <span>{showPassword ? "Fermer" : "Modifier"}</span>
          </button>
          {showPassword && (
            <form onSubmit={updatePassword} className="password-form">
              <input type="password" autoComplete="current-password" placeholder="Mot de passe actuel" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
              <input type="password" autoComplete="new-password" placeholder="Nouveau mot de passe" value={nextPassword} onChange={(event) => setNextPassword(event.target.value)} />
              {passwordError && <p className="form-error">{passwordError}</p>}
              <button className="secondary-button">Mettre à jour</button>
            </form>
          )}
        </section>

        <button type="button" className="logout-button" onClick={() => void onLogout()}><LogOut size={17} /> Se déconnecter</button>
        <button type="button" className="install-app-button" onClick={() => void onInstallApp()}>
          <Download size={17} /> {isInstalled ? "Application installée" : "Télécharger l’application"}
        </button>
      </section>
      {selectedWeek && <WeekRecap week={selectedWeek} onClose={() => setSelectedWeek(null)} onOpenWish={onOpenWish} />}
    </main>
  );
}

type LifeWeek = {
  start: Date;
  wishes: Wish[];
};

type LifeWeekPreview = LifeWeek & {
  index: number;
  x: number;
  y: number;
};

function formattedDate(date: Date) {
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

function formattedWeekRange(start: Date) {
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return `Du ${formattedDate(start)} au ${formattedDate(end)}`;
}

function LifeCalendar({
  birthDate,
  lifespanYears,
  wishes,
  onSelectWeek,
  onOpenWish,
}: {
  birthDate: string;
  lifespanYears: number;
  wishes: Wish[];
  onSelectWeek: (week: LifeWeek) => void;
  onOpenWish: (wish: Wish) => void;
}) {
  const [today, setToday] = useState(() => new Date());
  const [hoveredWeek, setHoveredWeek] = useState<LifeWeekPreview | null>(null);

  useEffect(() => {
    const nextDay = new Date();
    nextDay.setHours(24, 2, 0, 0);
    const timer = window.setTimeout(() => setToday(new Date()), nextDay.getTime() - Date.now());
    return () => window.clearTimeout(timer);
  }, [today]);

  const data = useMemo(() => {
    const birth = new Date(birthDate + "T12:00:00");
    if (!birthDate || Number.isNaN(birth.getTime())) return null;
    const age = today.getFullYear() - birth.getFullYear() - (
      today.getMonth() < birth.getMonth() ||
      (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate()) ? 1 : 0
    );
    const millisecondsPerWeek = 7 * 24 * 60 * 60 * 1000;
    const livedWeeks = Math.max(0, Math.floor((today.getTime() - birth.getTime()) / millisecondsPerWeek));
    const totalWeeks = Math.max(1, Math.round(Math.max(50, lifespanYears || 83) * 52.1775));
    const eventsByWeek = new Map<number, Wish[]>();
    for (const wish of wishes) {
      if (!wish.completedAt) continue;
      const completedAt = new Date(`${wish.completedAt}T12:00:00`);
      const weekIndex = Math.floor((completedAt.getTime() - birth.getTime()) / millisecondsPerWeek);
      if (Number.isNaN(completedAt.getTime()) || weekIndex < 0 || weekIndex >= totalWeeks) continue;
      eventsByWeek.set(weekIndex, [...(eventsByWeek.get(weekIndex) ?? []), wish]);
    }
    return { age, birth, millisecondsPerWeek, livedWeeks: Math.min(livedWeeks, totalWeeks), totalWeeks, eventsByWeek };
  }, [birthDate, lifespanYears, today, wishes]);

  if (!data) return null;
  const calendar = data;

  function findWeekIndex(target: EventTarget | null) {
    if (!(target instanceof Element)) return null;
    const value = target.closest<HTMLElement>("[data-life-week]")?.dataset.lifeWeek;
    const index = Number(value);
    return Number.isInteger(index) && index >= 0 && index < calendar.totalWeeks ? index : null;
  }

  function showWeekPreview(index: number, clientX: number, clientY: number) {
    const start = new Date(calendar.birth.getTime() + index * calendar.millisecondsPerWeek);
    const x = Math.max(12, Math.min(clientX + 16, window.innerWidth - 238));
    const y = Math.max(12, Math.min(clientY + 16, window.innerHeight - 230));
    setHoveredWeek({ index, start, wishes: calendar.eventsByWeek.get(index) ?? [], x, y });
  }

  return (
    <section className="life-calendar">
      <div className="life-calendar-heading">
        <div><span>Ta frise</span><strong>{data.age} ans</strong></div>
        <small>{data.livedWeeks.toLocaleString("fr-FR")} semaines</small>
      </div>
      <div
        className="life-grid"
        aria-label="Semaines vécues et à venir"
        onPointerOver={(event) => {
          if (event.pointerType && event.pointerType !== "mouse") return;
          const index = findWeekIndex(event.target);
          if (index !== null) showWeekPreview(index, event.clientX, event.clientY);
        }}
        onPointerOut={(event) => {
          const leaving = findWeekIndex(event.target);
          const entering = findWeekIndex(event.relatedTarget);
          if (leaving !== null && leaving !== entering) setHoveredWeek(null);
        }}
        onFocusCapture={(event) => {
          const index = findWeekIndex(event.target);
          if (index === null) return;
          const rect = (event.target as HTMLElement).getBoundingClientRect();
          showWeekPreview(index, rect.right, rect.bottom);
        }}
        onBlurCapture={() => setHoveredWeek(null)}
      >
        {Array.from({ length: data.totalWeeks }, (_, index) => {
          const weekWishes = data.eventsByWeek.get(index) ?? [];
          const weekStart = new Date(data.birth.getTime() + index * data.millisecondsPerWeek);
          const className = [
            "life-week",
            index < data.livedWeeks ? "lived" : "",
            index === data.livedWeeks ? "today" : "",
            weekWishes.length ? "event" : "",
            hoveredWeek?.index === index ? "previewed" : "",
          ].filter(Boolean).join(" ");
          if (!weekWishes.length) return <span key={index} data-life-week={index} className={className} aria-hidden="true" />;
          const colors = weekWishes.slice(0, 4).map((wish) => palette[wish.color]?.calendarColor ?? palette.terracotta.calendarColor);
          const background = colors.length === 1
            ? colors[0]
            : `linear-gradient(135deg, ${colors.map((color, colorIndex) => `${color} ${(colorIndex / colors.length) * 100}% ${((colorIndex + 1) / colors.length) * 100}%`).join(", ")})`;
          return (
            <button
              key={index}
              type="button"
              data-life-week={index}
              className={className}
              style={{ background }}
              onClick={() => {
                setHoveredWeek(null);
                if (weekWishes.length === 1) onOpenWish(weekWishes[0]);
                else onSelectWeek({ start: weekStart, wishes: weekWishes });
              }}
              aria-label={`Semaine du ${formattedDate(weekStart)} : ${weekWishes.map((wish) => wish.title).join(", ")}`}
            />
          );
        })}
      </div>
      {hoveredWeek && <CalendarWeekPreview week={hoveredWeek} />}
    </section>
  );
}

function CalendarWeekPreview({ week }: { week: LifeWeekPreview }) {
  const wish = week.wishes[0];
  const tone = wish ? palette[wish.color] ?? palette.terracotta : null;
  return (
    <div className={"life-week-preview " + (wish ? "has-event" : "")} style={{ left: week.x, top: week.y }}>
      <span className="life-week-preview-date">{formattedWeekRange(week.start)}</span>
      {wish && tone && (
        <div className="calendar-preview-stage">
          <MemoryStrip memories={wish.memories} />
          <div className={"calendar-preview-card " + tone.className}>
            <small>{wish.category}</small>
            <strong>{wish.title}</strong>
            {week.wishes.length > 1 && <em>+ {week.wishes.length - 1}</em>}
          </div>
        </div>
      )}
    </div>
  );
}

function WeekRecap({ week, onClose, onOpenWish }: { week: LifeWeek; onClose: () => void; onOpenWish: (wish: Wish) => void }) {
  return (
    <Modal onClose={onClose} className="week-modal">
      <div className="modal-head">
        <div>
          <p className="week-overline">Semaine vécue</p>
          <h2>{formattedDate(week.start)}<span className="accent-dot">.</span></h2>
        </div>
        <CloseButton onClick={onClose} />
      </div>
      <div className="week-recap-list">
        {week.wishes.map((wish) => (
          <button className="week-recap-card" type="button" key={wish.id} onClick={() => onOpenWish(wish)}>
            <span className="week-recap-color" style={{ background: palette[wish.color]?.calendarColor ?? palette.terracotta.calendarColor }} />
            <span className="week-recap-copy">
              <small>{wish.category}</small>
              <strong>{wish.title}</strong>
              <em>Réalisé le {wish.completedAt ? formattedDate(new Date(`${wish.completedAt}T12:00:00`)) : formattedDate(week.start)}</em>
            </span>
            {wish.memories.length > 0 && (
              <span className="week-memory-preview" aria-hidden="true">
                {wish.memories.slice(0, 3).map((memory) => memory.type === "video"
                  ? <video key={memory.id} src={memory.url} muted playsInline preload="metadata" />
                  : <img key={memory.id} src={memory.url} alt="" />,
                )}
              </span>
            )}
            <ArrowUpRight size={18} />
          </button>
        ))}
      </div>
    </Modal>
  );
}

function AuthScreen({ onAuthenticated }: { onAuthenticated: () => Promise<void> }) {
  const [mode, setMode] = useState<"login" | "register" | "reset">("register");
  const [form, setForm] = useState({
    displayName: "",
    email: "",
    password: "",
    birthDate: "",
    gender: "unspecified",
  });
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [resetStage, setResetStage] = useState<"request" | "confirm">("request");
  const [resetCode, setResetCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (mode === "register") {
        await api<{ profile: Profile }>("/api/auth/register", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(form),
        });
      } else if (mode === "login") {
        await api<{ profile: Profile }>("/api/auth/login", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email: form.email, password: form.password }),
        });
      } else {
        if (resetStage === "request") {
          await api<{ ok: boolean }>("/api/auth/request-reset", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ email: form.email }),
          });
          setResetStage("confirm");
          return;
        }
        if (form.password !== passwordConfirmation) {
          throw new Error("Les deux mots de passe ne correspondent pas.");
        }
        await api<{ profile: Profile }>("/api/auth/reset-password", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email: form.email, code: resetCode, nextPassword: form.password }),
        });
      }
      await onAuthenticated();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Impossible de te connecter.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="auth-screen">
      <div className="auth-sun" />
      <section className="auth-card">
        <div className="auth-brand"><span className="brand-mark"><Sparkles size={18} /></span>à vivre<span className="accent-dot">.</span></div>
        <div className="auth-title">
          <span className="auth-icon"><LockKeyhole size={19} /></span>
          <h1>{mode === "register" ? "Ton espace." : mode === "reset" ? resetStage === "request" ? "Récupérer l’accès." : "Nouveau mot de passe." : "Bienvenue."}</h1>
        </div>
        <form onSubmit={submit} className="auth-form">
          {mode === "register" && (
            <>
              <label><span>Prénom ou pseudo</span><input autoComplete="nickname" placeholder="Facultatif" value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} /></label>
              <div className="auth-two-columns">
                <label><span>Je suis</span><select value={form.gender} onChange={(event) => setForm({ ...form, gender: event.target.value })}><option value="female">Une femme</option><option value="male">Un homme</option><option value="other">Autre</option><option value="unspecified">Je ne précise pas</option></select></label>
                <label><span>Naissance</span><input required type="date" value={form.birthDate} onChange={(event) => setForm({ ...form, birthDate: event.target.value })} /></label>
              </div>
            </>
          )}
          <label><span>E-mail</span><input required type="email" autoComplete="email" placeholder="toi@exemple.com" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
          {(mode !== "reset" || resetStage === "confirm") && <label><span>{mode === "reset" ? "Nouveau mot de passe" : "Mot de passe"}</span><input required minLength={8} type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label>}
          {mode === "reset" && resetStage === "confirm" && <label><span>Code reçu</span><input required inputMode="numeric" maxLength={6} placeholder="000000" value={resetCode} onChange={(event) => setResetCode(event.target.value.replace(/\D/g, "").slice(0, 6))} /></label>}
          {mode === "reset" && resetStage === "confirm" && <label><span>Confirmer le mot de passe</span><input required minLength={8} type="password" autoComplete="new-password" value={passwordConfirmation} onChange={(event) => setPasswordConfirmation(event.target.value)} /></label>}
          {error && <p className="form-error">{error}</p>}
          <button className="primary-button auth-submit" disabled={saving}>{saving ? "Patiente…" : mode === "register" ? "Créer mon espace" : mode === "reset" ? resetStage === "request" ? "Recevoir un code" : "Réinitialiser" : "Se connecter"}</button>
        </form>
        {mode === "login" && <button type="button" className="auth-forgot" onClick={() => { setMode("reset"); setResetStage("request"); setResetCode(""); setError(""); setPasswordConfirmation(""); }}>Mot de passe oublié ?</button>}
        <button type="button" className="auth-switch" onClick={() => { setMode(mode === "login" ? "register" : "login"); setResetStage("request"); setResetCode(""); setError(""); setPasswordConfirmation(""); }}>
          {mode === "register" ? "J’ai déjà un espace" : mode === "reset" ? "Retour à la connexion" : "Créer mon espace"}
        </button>
      </section>
    </main>
  );
}

function Modal({ children, onClose, className = "" }: { children: ReactNode; onClose: () => void; className?: string }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className={"modal-panel " + className} role="dialog" aria-modal="true">{children}</section>
    </div>
  );
}

function CloseButton({ onClick, label = "Fermer" }: { onClick: () => void; label?: string }) {
  return <button type="button" className="close-button" onClick={onClick} aria-label={label}><X size={19} /></button>;
}

function LoadingCanvas() {
  return (
    <main className="loading-canvas">
      <div className="loading-brand"><span className="brand-mark"><Sparkles size={17} /></span> à vivre<span className="accent-dot">.</span></div>
      <div className="loading-line short" />
      <div className="loading-line" />
      <div className="loading-card" />
    </main>
  );
}
