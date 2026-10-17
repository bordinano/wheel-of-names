"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  ArrowDown, ArrowUp, Check, ChevronDown, CircleHelp, Clock3, Crown, Download, GripVertical, History, ImagePlus,
  ListPlus, Maximize, Minimize, Palette, RotateCcw, Settings2, Shuffle,
  SlidersHorizontal, Sparkles, Trash2, Trophy, Users, X
} from "lucide-react";

type Entry = { id: string; label: string; color: string; image?: string; stock?: number }; // stock (empty = unlimited)
type Rule = { id: string; every: string; entryId: string }; // every = "every Nth spin"
type Result = { id: string; spin: number; winner: string; time: string; scheduled: boolean };
type BgMode = "preset" | "color" | "image";
type PickKind = "bg" | "center" | "entry" | "rim" | "face";

const palette = ["#8B5CF6", "#F59E0B", "#14B8A6", "#F472B6", "#60A5FA", "#FB7185", "#A3E635", "#818CF8", "#F97316", "#2DD4BF"];
const initialNames = ["Alex", "Jordan", "Taylor", "Morgan", "Casey", "Riley"];
const uid = () => Math.random().toString(36).slice(2, 10);
const pt = (n: number) => Number(n.toFixed(2));

const backgrounds: { id: string; name: string; style: CSSProperties; dark: boolean; dots?: boolean }[] = [
  { id: "classic", name: "Classic", style: { backgroundColor: "#ffffff" }, dark: false, dots: true },
  { id: "lavender", name: "Lavender", style: { background: "linear-gradient(135deg,#ede9fe,#fae8ff)" }, dark: false },
  { id: "mint", name: "Mint", style: { backgroundColor: "#ecfdf5" }, dark: false },
  { id: "sand", name: "Sand", style: { backgroundColor: "#fef3c7" }, dark: false },
  { id: "sunset", name: "Sunset", style: { background: "linear-gradient(135deg,#fb923c,#ec4899)" }, dark: true },
  { id: "ocean", name: "Ocean", style: { background: "linear-gradient(135deg,#0ea5e9,#6366f1)" }, dark: true },
  { id: "forest", name: "Forest", style: { background: "linear-gradient(135deg,#10b981,#065f46)" }, dark: true },
  { id: "midnight", name: "Midnight", style: { background: "radial-gradient(circle at 50% 40%,#312e81,#0f172a)" }, dark: true },
];

function isDarkColor(hex: string) {
  const h = hex.replace("#", "");
  if (h.length !== 6) return false;
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.55;
}

const drawerCard = "rounded-2xl border border-slate-100 bg-white p-4 shadow-sm";

export default function Home() {
  const [entries, setEntries] = useState<Entry[]>(initialNames.map((label, i) => ({ id: `starter-${i}`, label, color: palette[i] })));
  const [draft, setDraft] = useState("");
  const [bulk, setBulk] = useState("");
  const [bulkOpen, setBulkOpen] = useState(false);
  const [rules, setRules] = useState<Rule[]>([
    { id: "rule-1", every: "10", entryId: "" },
    { id: "rule-2", every: "20", entryId: "" },
    { id: "rule-3", every: "50", entryId: "" },
  ]);
  const [history, setHistory] = useState<Result[]>([]);
  const [spinCount, setSpinCount] = useState(0);
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner] = useState<Result | null>(null);
  const [showSchedule, setShowSchedule] = useState(true);
  const [removeWinner, setRemoveWinner] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  const [notice, setNotice] = useState("");

  // Drag & drop reordering of entries
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  // Drawer, fullscreen, background
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [nativeFull, setNativeFull] = useState(false);
  const [fakeFull, setFakeFull] = useState(false);
  const [bgMode, setBgMode] = useState<BgMode>("preset");
  const [bgPreset, setBgPreset] = useState("classic");
  const [bgColor, setBgColor] = useState("#8b5cf6");
  const [bgImage, setBgImage] = useState("");

  // Center image + "Add image" menu
  const [hubImage, setHubImage] = useState("");
  const [hubSize, setHubSize] = useState(28); // % of wheel width
  const [imgMenuOpen, setImgMenuOpen] = useState(false);

  // Outer ring (the circle around the wheel)
  const [rimImage, setRimImage] = useState("");
  const [rimSize, setRimSize] = useState(3); // ring thickness, % of wheel width

  // Whole wheel face image
  const [faceImage, setFaceImage] = useState("");
  const [sliceOpacity, setSliceOpacity] = useState(0.35); // 0 = image only, 1 = solid colors

  const wheelRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const anyFileRef = useRef<HTMLInputElement>(null);
  const pickKind = useRef<PickKind>("bg");

  const isFull = nativeFull || fakeFull;

  // Keep every rule pointing at a real entry
  useEffect(() => {
    setRules(prev => prev.map(r => ({
      ...r,
      entryId: (!r.entryId || !entries.some(e => e.id === r.entryId)) ? (entries[0]?.id ?? "") : r.entryId
    })));
  }, [entries]);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  // Restore saved background (image is not persisted: too large for localStorage)
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("spinstudio-bg") || "null");
      if (saved?.mode === "preset" && backgrounds.some(b => b.id === saved.preset)) { setBgMode("preset"); setBgPreset(saved.preset); }
      if (saved?.mode === "color" && typeof saved.color === "string") { setBgMode("color"); setBgColor(saved.color); }
    } catch { }
  }, []);

  useEffect(() => {
    try {
      if (bgMode !== "image") localStorage.setItem("spinstudio-bg", JSON.stringify({ mode: bgMode, preset: bgPreset, color: bgColor }));
    } catch { }
  }, [bgMode, bgPreset, bgColor]);

  // Track native fullscreen changes (including the user pressing Esc)
  useEffect(() => {
    const onChange = () => setNativeFull(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // Esc closes the winner popup, then the menu/drawer; also exits the fallback "fake" fullscreen
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (winner && !spinning) setWinner(null);
      else if (imgMenuOpen) setImgMenuOpen(false);
      else if (drawerOpen) setDrawerOpen(false);
      else if (fakeFull) setFakeFull(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen, fakeFull, imgMenuOpen, winner, spinning]);

  // Resolve the active stage background
  const stage = useMemo(() => {
    if (bgMode === "image" && bgImage) {
      return { style: { backgroundImage: `url(${bgImage})`, backgroundSize: "cover", backgroundPosition: "center" } as CSSProperties, dark: true, dots: false, overlay: true };
    }
    if (bgMode === "color") {
      return { style: { backgroundColor: bgColor } as CSSProperties, dark: isDarkColor(bgColor), dots: false, overlay: false };
    }
    const p = backgrounds.find(b => b.id === bgPreset) ?? backgrounds[0];
    return { style: p.style, dark: p.dark, dots: Boolean(p.dots), overlay: false };
  }, [bgMode, bgPreset, bgColor, bgImage]);

  async function toggleFullscreen() {
    const el = stageRef.current;
    if (!el) return;
    if (document.fullscreenElement) { await document.exitFullscreen().catch(() => { }); return; }
    if (fakeFull) { setFakeFull(false); return; }
    if (el.requestFullscreen) {
      try { await el.requestFullscreen(); return; } catch { }
    }
    // Fallback for browsers without the Fullscreen API (e.g. iPhone Safari)
    setFakeFull(true);
  }

  function onImagePicked(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setNotice("Please choose an image file."); return; }
    if (file.size > 5 * 1024 * 1024) { setNotice("Image is too large (max 5 MB)."); return; }
    const reader = new FileReader();
    reader.onload = () => { setBgImage(String(reader.result)); setBgMode("image"); };
    reader.readAsDataURL(file);
  }

  // Opens the file picker for one of the "Add image" options
  function chooseImage(kind: PickKind) {
    pickKind.current = kind;
    setImgMenuOpen(false);
    anyFileRef.current?.click();
  }

  function onAnyImagePicked(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setNotice("Please choose an image file."); return; }
    if (file.size > 5 * 1024 * 1024) { setNotice("Image is too large (max 5 MB)."); return; }
    const kind = pickKind.current;
    const reader = new FileReader();
    reader.onload = () => {
      const src = String(reader.result);
      if (kind === "bg") { setBgImage(src); setBgMode("image"); }
      else if (kind === "center") { setHubImage(src); }
      else if (kind === "rim") { setRimImage(src); }
      else if (kind === "face") { setFaceImage(src); }
      else {
        const label = file.name.replace(/\.[^.]+$/, "").slice(0, 20) || "Image";
        setEntries(prev => [...prev, { id: uid(), label, color: palette[prev.length % palette.length], image: src }]);
        setNotice("Image added as entry");
      }
    };
    reader.readAsDataURL(file);
  }

  // Deleting an entry also deletes its prize rules, so a spin can never get stuck on a missing entry.
  function removeEntry(id: string) {
    setEntries(prev => prev.filter(e => e.id !== id));
    setRules(prev => prev.filter(r => r.entryId !== id));
  }

  function addRule() {
    setRules(prev => [...prev, { id: uid(), every: "", entryId: entries[0]?.id ?? "" }]);
  }

  function addEntry() {
    const label = draft.trim();
    if (!label) return;
    setEntries(prev => [...prev, { id: uid(), label, color: palette[prev.length % palette.length] }]);
    setDraft("");
    setNotice("");
  }

  function addBulk() {
    const labels = bulk.split(/\n|,/).map(s => s.trim()).filter(Boolean);
    if (!labels.length) return;
    setEntries(prev => [...prev, ...labels.map((label, i) => ({ id: uid(), label, color: palette[(prev.length + i) % palette.length] }))]);
    setBulk("");
    setBulkOpen(false);
    setNotice(`${labels.length} entries added`);
  }

  function shuffleEntries() {
    if (spinning || entries.length < 2) return;
    setEntries(prev => {
      const arr = [...prev];
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    });
    setNotice("Entries shuffled");
  }

  function moveEntry(fromId: string, toId: string) {
    if (fromId === toId) return;
    setEntries(prev => {
      const arr = [...prev];
      const from = arr.findIndex(e => e.id === fromId);
      const to = arr.findIndex(e => e.id === toId);
      if (from < 0 || to < 0) return prev;
      const [item] = arr.splice(from, 1);
      arr.splice(to, 0, item);
      return arr;
    });
  }

  function nudgeEntry(id: string, dir: -1 | 1) {
    setEntries(prev => {
      const i = prev.findIndex(e => e.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const arr = [...prev];
      [arr[i], arr[j]] = [arr[j], arr[i]];
      return arr;
    });
  }

  function spinWheel() {
    if (spinning || entries.length < 2) return;
    const targetSpin = spinCount + 1;

    // An entry is available only if it has unlimited stock or stock left
    const inStock = (e: Entry) => e.stock === undefined || e.stock > 0;

    // Valid rules only
    const validRules = rules
      .map(r => ({ ...r, n: Number(r.every) }))
      .filter(r => Number.isInteger(r.n) && r.n >= 1 && entries.some(e => e.id === r.entryId));

    // Rules that hit this spin, rarest (biggest N) first
    const hits = validRules.filter(r => targetSpin % r.n === 0).sort((a, b) => b.n - a.n);

    // First hit whose prize is still in stock
    let scheduledEntry: Entry | undefined;
    for (const r of hits) {
      const e = entries.find(x => x.id === r.entryId && inStock(x));
      if (e) { scheduledEntry = e; break; }
    }

    // Prize entries are never picked randomly
    const reservedIds = new Set(validRules.map(r => r.entryId));
    const randomPool = entries.filter(e => inStock(e) && !reservedIds.has(e.id));

    if (!scheduledEntry && randomPool.length === 0) {
      setNotice(entries.some(inStock)
        ? "Only prize entries are left, so there is nothing to pick randomly on this spin."
        : "Everything is out of stock.");
      return;
    }

    const winnerEntry = scheduledEntry ?? randomPool[Math.floor(Math.random() * randomPool.length)];
    if (!winnerEntry) return;

    const index = entries.findIndex(e => e.id === winnerEntry.id);
    const segment = 360 / entries.length;
    // Land somewhere inside the winning slice, not always dead center.
    // 0.4 keeps the pointer safely away from the slice edges (max 0.45).
    const jitter = (Math.random() * 2 - 1) * segment * 0.4;
    const desired = -(index * segment + segment / 2 + jitter);
    const currentNormalized = ((rotation % 360) + 360) % 360;
    const delta = ((desired - currentNormalized) % 360 + 360) % 360;
    const nextRotation = rotation + 360 * (5 + Math.floor(Math.random() * 3)) + delta;
    setRotation(nextRotation);
    setSpinning(true);
    setWinner(null);
    setNotice("");
    timerRef.current = setTimeout(() => {
      const result: Result = {
        id: uid(),
        spin: targetSpin,
        winner: winnerEntry.label,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        scheduled: Boolean(scheduledEntry)
      };
      setSpinCount(targetSpin);
      setWinner(result);
      setHistory(prev => [result, ...prev]);
      setSpinning(false);

      // Take 1 off the winner's stock (unlimited items are left alone)
      setEntries(prev => prev.map(e =>
        e.id === winnerEntry.id && e.stock !== undefined ? { ...e, stock: Math.max(0, e.stock - 1) } : e
      ));

      if (soundOn) {
        try {
          const ctx = new AudioContext();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain); gain.connect(ctx.destination);
          osc.frequency.value = 660; gain.gain.value = 0.08;
          osc.start(); osc.stop(ctx.currentTime + 0.16);
          osc.onended = () => void ctx.close();
        } catch { }
      }
      if (removeWinner) removeEntry(winnerEntry.id);
    }, 4700);
  }

  function resetAll() {
    if (spinning) return;
    setEntries(initialNames.map((label, i) => ({ id: `starter-${i}`, label, color: palette[i] })));
    setRules([]);
    setHistory([]);
    setSpinCount(0);
    setRotation(0);
    setWinner(null);
    setNotice("Wheel reset");
  }

  function exportHistory() {
    const csv = ["Spin,Winner,Time,Result type", ...history.slice().reverse().map(r => `${r.spin},"${r.winner.replaceAll('"', '""')}",${r.time},${r.scheduled ? "Prize" : "Random"}`)].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "spin-history.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="min-h-screen pb-12">
      <header className="sticky top-0 z-20 border-b border-black/[0.06] bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <a href="#" className="flex items-center gap-3">
            <span><span className="block text-[15px] font-extrabold tracking-tight text-blue-600"><span className="text-violet-600">CRYPTITA PLAYS </span><span className="text-neutral-600">X</span>  Blockchain4Youth</span><span className="block text-[10px] font-semibold uppercase tracking-[.2em] text-slate-400">Random picker</span></span>
          </a>
          <div className="hidden items-center gap-2 sm:flex">
            <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700"><span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />Ready to spin</span>
            <button onClick={() => setDrawerOpen(true)} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-violet-700"><SlidersHorizontal size={15} /> Settings</button>
            <button onClick={resetAll} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"><RotateCcw size={15} /> Reset</button>
          </div>
          <div className="flex gap-2 sm:hidden">
            <button onClick={() => setDrawerOpen(true)} className="rounded-xl bg-violet-600 p-2 text-white" aria-label="Open settings"><SlidersHorizontal size={17} /></button>
            <button onClick={resetAll} className="rounded-xl border border-slate-200 p-2 text-slate-600" aria-label="Reset wheel"><RotateCcw size={17} /></button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1440px] px-4 pt-7 sm:px-6 lg:px-8">
        <div className="mb-7 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
          </div>
          <div className="flex gap-3">
            <div className="rounded-2xl border border-white bg-white px-4 py-3 shadow-sm"><div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total entries</div><div className="mt-1 text-xl font-extrabold text-slate-900">{entries.length}</div></div>
            <div className="rounded-2xl border border-white bg-white px-4 py-3 shadow-sm"><div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Spins completed</div><div className="mt-1 text-xl font-extrabold text-slate-900">{spinCount}</div></div>
          </div>
        </div>

        {/* The whole section (wheel + drawer + toast) is what goes fullscreen, so the drawer still works there. */}
        <section
          ref={stageRef}
          className={`flex flex-col overflow-hidden border border-white bg-white shadow-soft ${isFull ? "fixed inset-0 z-[60] rounded-none" : "rounded-[28px]"}`}
        >
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-100 bg-white px-5 py-4 sm:px-7">

            <div className="flex items-center gap-2">

              {/* ---------- Add image menu ---------- */}
              <div className="relative">
                <button
                  onClick={() => setImgMenuOpen(v => !v)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-100"
                  aria-label="Add image"
                >
                  <ImagePlus size={14} /> <span className="hidden sm:inline">Add image</span> <ChevronDown size={13} />
                </button>

                {imgMenuOpen && <>
                  <div className="fixed inset-0 z-30" onClick={() => setImgMenuOpen(false)} />
                  <div className="absolute right-0 top-full z-40 mt-2 w-72 rounded-2xl bg-[#1f1f1f] p-2 shadow-2xl">
                    <button onClick={() => chooseImage("bg")} className="flex w-full items-center gap-4 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-white hover:bg-white/10">
                      <span className="h-11 w-11 shrink-0 rounded-full bg-yellow-400" />
                      Add background image
                    </button>

                    <button onClick={() => chooseImage("center")} className="flex w-full items-center gap-4 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-white hover:bg-white/10">
                      <span className="relative h-11 w-11 shrink-0 rounded-full" style={{ background: "conic-gradient(#6b7280 0 60deg,#9ca3af 60deg 120deg,#6b7280 120deg 180deg,#9ca3af 180deg 240deg,#6b7280 240deg 300deg,#9ca3af 300deg 360deg)" }}>
                        <span className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-yellow-400" />
                      </span>
                      Add center image
                    </button>

                    <button onClick={() => chooseImage("rim")} className="flex w-full items-center gap-4 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-white hover:bg-white/10">
                      <span className="relative h-11 w-11 shrink-0 rounded-full bg-yellow-400">
                        <span className="absolute inset-[7px] rounded-full bg-[#6b7280]" />
                      </span>
                      Add outer ring image
                    </button>

                    <button onClick={() => chooseImage("face")} className="flex w-full items-center gap-4 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-white hover:bg-white/10">
                      <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-fuchsia-500 to-amber-400" />
                      Add whole wheel image
                    </button>

                    <button onClick={() => chooseImage("entry")} className="flex w-full items-center gap-4 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-white hover:bg-white/10">
                      <span className="relative h-11 w-11 shrink-0 rounded-full" style={{ background: "conic-gradient(#6b7280 0 60deg,#9ca3af 60deg 120deg,#6b7280 120deg 180deg,#9ca3af 180deg 240deg,#facc15 240deg 300deg,#9ca3af 300deg 360deg)" }}>
                        <span className="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white" />
                      </span>
                      Add image as entry
                    </button>
                  </div>
                </>}

                <input ref={anyFileRef} type="file" accept="image/*" className="hidden" onChange={e => { onAnyImagePicked(e.target.files?.[0]); e.target.value = ""; }} />
              </div>

              <button onClick={() => setSoundOn(v => !v)} className={`rounded-xl px-3 py-2 text-xs font-bold transition ${soundOn ? "bg-violet-50 text-violet-700" : "bg-slate-50 text-slate-500 hover:bg-slate-100"}`}>{soundOn ? "Sound on" : "Sound off"}</button>
              <button onClick={shuffleEntries} disabled={spinning || entries.length < 2} className="inline-flex items-center gap-1.5 rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50" aria-label="Shuffle entries"><Shuffle size={14} /> <span className="hidden sm:inline">Shuffle</span></button>
              <button onClick={() => setDrawerOpen(true)} className="inline-flex items-center gap-1.5 rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-100" aria-label="Open settings"><SlidersHorizontal size={14} /> <span className="hidden sm:inline">Settings</span></button>
              <button onClick={toggleFullscreen} className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-violet-700" aria-label={isFull ? "Exit full screen" : "Enter full screen"}>
                {isFull ? <Minimize size={14} /> : <Maximize size={14} />} <span className="hidden sm:inline">{isFull ? "Exit full screen" : "Full screen"}</span>
              </button>
            </div>
          </div>

          <div className={`wheel-stage relative flex flex-1 flex-col items-center justify-center overflow-hidden px-3 py-8 sm:px-8 ${isFull ? "" : "min-h-[420px] sm:min-h-[560px]"}`} style={stage.style}>
            {stage.dots && <div className="pointer-events-none absolute inset-0 opacity-70" style={{ backgroundImage: "radial-gradient(#e7e4f4 1px, transparent 1px)", backgroundSize: "22px 22px" }} />}
            {stage.overlay && <div className="pointer-events-none absolute inset-0 bg-black/25" />}
            <div className={`relative z-10 w-full ${isFull ? "" : "max-w-[560px]"}`} style={isFull ? { width: "min(66vh, 90vw)" } : undefined}>
              <div className="pointer-events-none absolute left-1/2 top-[-9px] z-20 -translate-x-1/2 drop-shadow-md">
                <div className="h-0 w-0 border-x-[15px] border-t-[29px] border-x-transparent border-t-slate-900" />
              </div>
              <div
                className="relative aspect-square rounded-full bg-white shadow-[0_18px_50px_rgba(36,25,80,.18)]"
                style={{
                  padding: `${rimSize}%`,
                  ...(rimImage ? { backgroundImage: `url(${rimImage})`, backgroundSize: "cover", backgroundPosition: "center" } : {})
                }}
              >
                <div ref={wheelRef} className="relative h-full w-full overflow-hidden rounded-full border-[5px] border-white bg-slate-100 transition-transform [transition-timing-function:cubic-bezier(.12,.72,.12,1)]" style={{ transform: `rotate(${rotation}deg)`, transitionDuration: spinning ? "4.7s" : "0s" }}>

                  {/* Whole wheel image (spins with the wheel) */}
                  {faceImage && (
                    <img src={faceImage} alt="" className="absolute inset-0 h-full w-full object-cover" />
                  )}

                  <svg viewBox="0 0 400 400" className="absolute inset-0 h-full w-full" aria-label="Spinning wheel">
                    {entries.map((entry, i) => {
                      const angle = 360 / entries.length;
                      const start = (i * angle - 90) * Math.PI / 180;
                      const end = ((i + 1) * angle - 90) * Math.PI / 180;
                      // Round trig results: server and browser can differ in the last digits, which causes hydration mismatches.
                      const x1 = pt(200 + 194 * Math.cos(start)), y1 = pt(200 + 194 * Math.sin(start));
                      const x2 = pt(200 + 194 * Math.cos(end)), y2 = pt(200 + 194 * Math.sin(end));
                      const large = angle > 180 ? 1 : 0;
                      const mid = pt((i + .5) * angle - 90);
                      const rad = mid * Math.PI / 180;
                      const tx = pt(200 + 126 * Math.cos(rad)), ty = pt(200 + 126 * Math.sin(rad));
                      const slicePath = `M 200 200 L ${x1} ${y1} A 194 194 0 ${large} 1 ${x2} ${y2} Z`;
                      const s = entries.length <= 4 ? 300 : 200;

                      // Text runs along the slice (rim → center), sized to fit inside it
                      const textR = 184;                                          // text ends here, near the rim
                      const hubReach = hubSize * 2 + 10;                          // approx. space taken by the center logo
                      const room = textR - hubReach;                              // length available for text
                      const chord = 2 * 150 * Math.sin((angle * Math.PI) / 360);  // slice width around the middle
                      const fs = Math.max(7, Math.min(18, chord * 0.55));         // font size that fits the slice width
                      const maxChars = Math.max(3, Math.floor(room / (fs * 0.6)));
                      const shown = entry.label.length > maxChars ? entry.label.slice(0, maxChars - 1) + "…" : entry.label;

                      return <g key={entry.id}>
                        {/* fillOpacity makes slices see-through when a whole wheel image is set */}
                        {entries.length === 1
                          ? <circle cx="200" cy="200" r="194" fill={entry.color} fillOpacity={faceImage ? sliceOpacity : 1} stroke="white" strokeWidth="2" />
                          : <path d={slicePath} fill={entry.color} fillOpacity={faceImage ? sliceOpacity : 1} stroke="white" strokeWidth="2" />}

                        {entry.image && <>
                          <clipPath id={`clip-${entry.id}`}>
                            {entries.length === 1 ? <circle cx="200" cy="200" r="194" /> : <path d={slicePath} />}
                          </clipPath>
                          <g clipPath={`url(#clip-${entry.id})`}>
                            <image href={entry.image} x={tx - s / 2} y={ty - s / 2} width={s} height={s}
                              preserveAspectRatio="xMidYMid slice" transform={`rotate(${mid + 90}, ${tx}, ${ty})`} />
                          </g>
                          {entries.length > 1 && <path d={slicePath} fill="none" stroke="white" strokeWidth="2" />}
                        </>}

                        <text x={200 + textR} y={200} fill="#fff" fontSize={pt(fs)} fontWeight="700" textAnchor="end" dominantBaseline="middle" transform={`rotate(${mid}, 200, 200)`} style={{ textShadow: "0 1px 3px rgba(0,0,0,.6)", paintOrder: "stroke", stroke: entry.image ? "rgba(0,0,0,.45)" : "none", strokeWidth: 3 }}>{shown}</text>
                      </g>;
                    })}
                  </svg>
                </div>

                {/* Center hub: shows your image if uploaded, otherwise the text */}
                <div
                  className="absolute left-1/2 top-1/2 z-10 flex aspect-square -translate-x-1/2 -translate-y-1/2 items-center justify-center overflow-hidden rounded-full border-[5px] border-white bg-slate-900 text-white shadow-xl"
                  style={{ width: `${hubSize}%` }}
                >
                  {hubImage ? (
                    <img src={hubImage} alt="Wheel center" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-center text-[10px] font-black uppercase leading-tight tracking-[.12em] sm:text-sm md:text-base">
                      Cryptita Plays<br />X<br />B4Y
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="relative z-10 mt-7 flex flex-col items-center gap-3">
              <button onClick={spinWheel} disabled={spinning || entries.length < 2} className="group inline-flex min-w-[210px] items-center justify-center gap-3 rounded-2xl bg-violet-600 px-8 py-4 text-base font-extrabold text-white shadow-lg shadow-violet-200 transition hover:-translate-y-0.5 hover:bg-violet-700 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0">
                {spinning ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> Spinning...</> : <><Shuffle size={18} /> SPIN THE WHEEL</>}
              </button>

            </div>
          </div>

          {/* ---------- Winner popup ---------- */}
          {winner && !spinning && (
            <div
              className="fixed inset-0 z-[75] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
              onClick={() => setWinner(null)}
            >
              <div
                className="relative w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-2xl"
                onClick={e => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-label="Winner"
              >
                <button onClick={() => setWinner(null)} className="absolute right-4 top-4 rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close"><X size={20} /></button>
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-violet-100 to-fuchsia-100 text-violet-600"><Trophy size={38} /></div>
                <div className="mt-5 text-xs font-bold uppercase tracking-[.2em] text-violet-600">{winner.scheduled ? "Prize winner" : "We have a winner"}</div>
                <div className="mt-3 break-words text-4xl font-black tracking-tight text-slate-900">{winner.winner}</div>
                <div className="mt-2 text-sm text-slate-400">Spin #{winner.spin}</div>
                <button onClick={() => setWinner(null)} className="mt-7 w-full rounded-2xl bg-violet-600 px-6 py-3.5 text-base font-extrabold text-white transition hover:bg-violet-700">Continue</button>
              </div>
            </div>
          )}

          {/* ---------- Settings drawer ---------- */}
          <div
            onClick={() => setDrawerOpen(false)}
            className={`fixed inset-0 z-[65] bg-slate-900/40 backdrop-blur-[2px] transition-opacity duration-300 ${drawerOpen ? "opacity-100" : "pointer-events-none opacity-0"}`}
            aria-hidden="true"
          />
          <aside
            aria-label="Settings"
            aria-hidden={!drawerOpen}
            className={`fixed right-0 top-0 z-[70] flex h-full w-full max-w-[440px] flex-col bg-slate-50 shadow-2xl transition-all duration-300 ${drawerOpen ? "translate-x-0" : "invisible translate-x-full"}`}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
              <div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50 text-violet-600"><SlidersHorizontal size={18} /></span><div><h2 className="font-extrabold text-slate-900">Settings</h2><p className="text-xs text-slate-400">Entries, prizes, look &amp; history</p></div></div>
              <button onClick={() => setDrawerOpen(false)} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close settings"><X size={20} /></button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-4">
              {/* Appearance */}
              <div className={drawerCard}>
                <div className="mb-4 flex items-center gap-2"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-pink-50 text-pink-600"><Palette size={18} /></span><div><h3 className="font-extrabold text-slate-900">Wheel background</h3><p className="text-xs text-slate-500">Pick a style, color, or your own image</p></div></div>
                <div className="grid grid-cols-4 gap-2">
                  {backgrounds.map(b => {
                    const active = bgMode === "preset" && bgPreset === b.id;
                    return <button key={b.id} onClick={() => { setBgMode("preset"); setBgPreset(b.id); }} className="group text-center" aria-label={`${b.name} background`} aria-pressed={active}>
                      <span className={`block h-12 rounded-xl border-2 transition ${active ? "border-violet-600 ring-2 ring-violet-200" : "border-slate-200 group-hover:border-slate-300"}`} style={b.style} />
                      <span className={`mt-1 block text-[10px] font-bold ${active ? "text-violet-700" : "text-slate-500"}`}>{b.name}</span>
                    </button>;
                  })}
                </div>
                <div className="mt-4 flex items-center gap-3">
                  <label className={`flex flex-1 cursor-pointer items-center gap-3 rounded-xl border-2 px-3 py-2 transition ${bgMode === "color" ? "border-violet-600 bg-violet-50" : "border-slate-200 bg-slate-50 hover:border-slate-300"}`}>
                    <input type="color" value={bgColor} onChange={e => { setBgColor(e.target.value); setBgMode("color"); }} className="h-8 w-8 cursor-pointer rounded-lg border-0 bg-transparent p-0" />
                    <span className="text-xs font-bold text-slate-700">Custom color<span className="block font-mono text-[10px] font-medium uppercase text-slate-400">{bgColor}</span></span>
                  </label>
                  <button onClick={() => fileRef.current?.click()} className={`flex flex-1 items-center gap-2 rounded-xl border-2 px-3 py-3 text-xs font-bold transition ${bgMode === "image" ? "border-violet-600 bg-violet-50 text-violet-700" : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300"}`}><ImagePlus size={16} /> Upload image</button>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => { onImagePicked(e.target.files?.[0]); e.target.value = ""; }} />
                </div>
                {bgImage && <button onClick={() => { setBgImage(""); if (bgMode === "image") { setBgMode("preset"); setBgPreset("classic"); } }} className="mt-3 text-xs font-bold text-rose-500 hover:text-rose-700">Remove uploaded image</button>}
              </div>

              {/* Center logo */}
              <div className={drawerCard}>
                <div className="mb-4 flex items-center gap-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-700"><ImagePlus size={18} /></span>
                  <div>
                    <h3 className="font-extrabold text-slate-900">Center logo</h3>
                    <p className="text-xs text-slate-500">Replace the circle in the middle of the wheel</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full border-2 border-slate-200 bg-slate-900">
                    {hubImage && <img src={hubImage} alt="" className="h-full w-full object-cover" />}
                  </div>
                  <div className="flex flex-1 flex-col gap-2">
                    <button onClick={() => chooseImage("center")} className="rounded-xl bg-violet-600 px-3 py-2 text-xs font-bold text-white hover:bg-violet-700">
                      {hubImage ? "Change image" : "Upload image"}
                    </button>
                    {hubImage && <button onClick={() => setHubImage("")} className="text-xs font-bold text-rose-500 hover:text-rose-700">Remove (use default text)</button>}
                  </div>
                </div>

                <label className="mt-4 block">
                  <span className="flex justify-between text-xs font-bold text-slate-600">Size <span className="text-slate-400">{hubSize}%</span></span>
                  <input type="range" min={15} max={40} value={hubSize} onChange={e => setHubSize(Number(e.target.value))} className="mt-2 w-full accent-violet-600" />
                </label>
              </div>

              {/* Outer ring */}
              <div className={drawerCard}>
                <div className="mb-4 flex items-center gap-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-700"><ImagePlus size={18} /></span>
                  <div>
                    <h3 className="font-extrabold text-slate-900">Outer ring</h3>
                    <p className="text-xs text-slate-500">Replace the circle around the wheel</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full border-2 border-slate-200 bg-white" style={rimImage ? { backgroundImage: `url(${rimImage})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined} />
                  <div className="flex flex-1 flex-col gap-2">
                    <button onClick={() => chooseImage("rim")} className="rounded-xl bg-violet-600 px-3 py-2 text-xs font-bold text-white hover:bg-violet-700">
                      {rimImage ? "Change image" : "Upload image"}
                    </button>
                    {rimImage && <button onClick={() => setRimImage("")} className="text-xs font-bold text-rose-500 hover:text-rose-700">Remove (use white ring)</button>}
                  </div>
                </div>

                <label className="mt-4 block">
                  <span className="flex justify-between text-xs font-bold text-slate-600">Ring thickness <span className="text-slate-400">{rimSize}%</span></span>
                  <input type="range" min={1} max={10} step={0.5} value={rimSize} onChange={e => setRimSize(Number(e.target.value))} className="mt-2 w-full accent-violet-600" />
                </label>
              </div>

              {/* Whole wheel image card */}
              <div className={drawerCard}>
                <div className="mb-4 flex items-center gap-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-700"><ImagePlus size={18} /></span>
                  <div>
                    <h3 className="font-extrabold text-slate-900">Whole wheel image</h3>
                    <p className="text-xs text-slate-500">Fill the entire circle with your image</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full border-2 border-slate-200 bg-slate-100">
                    {faceImage && <img src={faceImage} alt="" className="h-full w-full object-cover" />}
                  </div>
                  <div className="flex flex-1 flex-col gap-2">
                    <button onClick={() => chooseImage("face")} className="rounded-xl bg-violet-600 px-3 py-2 text-xs font-bold text-white hover:bg-violet-700">
                      {faceImage ? "Change image" : "Upload image"}
                    </button>
                    {faceImage && <button onClick={() => setFaceImage("")} className="text-xs font-bold text-rose-500 hover:text-rose-700">Remove (use slice colors)</button>}
                  </div>
                </div>

                {faceImage && (
                  <label className="mt-4 block">
                    <span className="flex justify-between text-xs font-bold text-slate-600">Slice color strength <span className="text-slate-400">{Math.round(sliceOpacity * 100)}%</span></span>
                    <input type="range" min={0} max={1} step={0.05} value={sliceOpacity} onChange={e => setSliceOpacity(Number(e.target.value))} className="mt-2 w-full accent-violet-600" />
                  </label>
                )}
              </div>

              {/* Entries */}
              <div className={drawerCard}>
                <div className="mb-4 flex items-start justify-between">
                  <div><div className="flex items-center gap-2"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50 text-violet-600"><Users size={18} /></span><h3 className="font-extrabold text-slate-900">Wheel entries</h3></div><p className="mt-2 text-sm text-slate-500">Who or what are we picking?</p></div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-500">{entries.length} items</span>
                </div>
                <form onSubmit={e => { e.preventDefault(); addEntry(); }} className="flex gap-2">
                  <input value={draft} onChange={e => setDraft(e.target.value)} placeholder="Add a name or prize..." className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-violet-300 focus:bg-white focus:ring-4 focus:ring-violet-50" />
                  <button type="submit" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white transition hover:bg-violet-700" aria-label="Add entry"><ListPlus size={19} /></button>
                </form>
                <button onClick={() => setBulkOpen(v => !v)} className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-violet-600 hover:text-violet-800">{bulkOpen ? "Hide bulk add" : "＋ Add multiple entries"} <ChevronDown size={13} className={bulkOpen ? "rotate-180" : ""} /></button>
                {bulkOpen && <div className="mt-3 space-y-2"><textarea value={bulk} onChange={e => setBulk(e.target.value)} placeholder={"Paste names, one per line\nAlex\nJordan\nTaylor"} rows={4} className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:border-violet-300 focus:bg-white" /><button onClick={addBulk} className="w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-700">Add entries</button></div>}
                <div className="mt-4 max-h-[260px] space-y-1.5 overflow-y-auto pr-1">
                  {entries.map((entry, idx) => <div
                    key={entry.id}
                    data-row
                    onDragOver={e => { if (dragId) { e.preventDefault(); setOverId(entry.id); } }}
                    onDrop={e => { e.preventDefault(); if (dragId) moveEntry(dragId, entry.id); setDragId(null); setOverId(null); }}
                    className={`group flex items-center gap-2 rounded-xl px-2 py-2 transition hover:bg-slate-50 ${dragId === entry.id ? "opacity-40" : ""} ${overId === entry.id && dragId && dragId !== entry.id ? "ring-2 ring-violet-300" : ""}`}
                  >
                    <span
                      draggable={!spinning}
                      onDragStart={e => {
                        setDragId(entry.id);
                        e.dataTransfer.effectAllowed = "move";
                        const row = e.currentTarget.closest("[data-row]") as HTMLElement | null;
                        if (row) e.dataTransfer.setDragImage(row, 20, 20);
                      }}
                      onDragEnd={() => { setDragId(null); setOverId(null); }}
                      className="shrink-0 cursor-grab touch-none text-slate-300 hover:text-slate-500 active:cursor-grabbing"
                      title="Drag to reorder"
                      aria-label={`Drag ${entry.label} to reorder`}
                    ><GripVertical size={16} /></span>

                    {entry.image
                      ? <img src={entry.image} alt="" className="h-6 w-6 shrink-0 rounded-full object-cover" />
                      : <span className="h-3 w-3 shrink-0 rounded-full ring-4 ring-white" style={{ background: entry.color, boxShadow: `0 0 0 1px ${entry.color}33` }} />}
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-700">{entry.label}</span>

                    {entry.stock === 0 && <span className="rounded-md bg-rose-50 px-1.5 py-1 text-[10px] font-bold text-rose-600">OUT</span>}
                    <input
                      type="number"
                      min={0}
                      value={entry.stock ?? ""}
                      placeholder="∞"
                      title="Stock (leave empty for unlimited)"
                      onChange={e => {
                        const v = e.target.value;
                        setEntries(prev => prev.map(x => x.id === entry.id ? { ...x, stock: v === "" ? undefined : Math.max(0, Math.floor(Number(v))) } : x));
                      }}
                      className="w-14 shrink-0 rounded-lg border border-slate-200 bg-white px-2 py-1 text-center text-xs font-bold text-slate-700 outline-none focus:border-violet-300"
                    />

                    <span className="flex shrink-0 flex-col opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                      <button onClick={() => nudgeEntry(entry.id, -1)} disabled={spinning || idx === 0} className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-20" aria-label={`Move ${entry.label} up`}><ArrowUp size={12} /></button>
                      <button onClick={() => nudgeEntry(entry.id, 1)} disabled={spinning || idx === entries.length - 1} className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-20" aria-label={`Move ${entry.label} down`}><ArrowDown size={12} /></button>
                    </span>

                    <button onClick={() => removeEntry(entry.id)} disabled={spinning} className="rounded-lg p-1.5 text-slate-300 opacity-0 transition hover:bg-rose-50 hover:text-rose-500 group-hover:opacity-100 focus:opacity-100 disabled:cursor-not-allowed" aria-label={`Remove ${entry.label}`}><Trash2 size={15} /></button>
                  </div>)}
                  {entries.length === 0 && <div className="rounded-xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-400">Add at least two entries to spin.</div>}
                </div>
                <div className="mt-4 border-t border-slate-100 pt-4">
                  <label className="flex cursor-pointer items-center justify-between gap-3"><span><span className="block text-sm font-bold text-slate-700">Remove winner after spin</span><span className="mt-1 block text-xs text-slate-400">Winner can't be picked again</span></span><button type="button" role="switch" aria-checked={removeWinner} onClick={() => setRemoveWinner(v => !v)} className={`relative h-6 w-11 rounded-full transition ${removeWinner ? "bg-violet-600" : "bg-slate-200"}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-all ${removeWinner ? "left-6" : "left-1"}`} /></button></label>
                </div>
              </div>

              {/* Prize rules */}
              <div className={drawerCard}>
                <button onClick={() => setShowSchedule(v => !v)} className="flex w-full items-center justify-between text-left">
                  <div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600"><Crown size={18} /></span><div><h3 className="font-extrabold text-slate-900">Prize rules</h3><p className="mt-1 text-xs text-slate-500">Repeat a prize every Nth spin</p></div></div>
                  <ChevronDown size={18} className={`text-slate-400 transition ${showSchedule ? "rotate-180" : ""}`} />
                </button>
                {showSchedule && <div className="mt-5">
                  <div className="rounded-2xl border border-amber-100 bg-amber-50/70 p-3.5"><div className="flex gap-2"><CircleHelp size={16} className="mt-0.5 shrink-0 text-amber-700" /><p className="text-xs leading-5 text-amber-900">Example: every 10 → Good prize, every 20 → Better prize, every 50 → Grand prize. If rules overlap, the biggest number wins. Prize entries are never picked randomly.</p></div></div>

                  <div className="mt-4 flex items-center justify-between gap-2">
                    <div className="text-sm font-extrabold text-slate-800">Rules</div>
                    <button onClick={addRule} disabled={!entries.length} className="shrink-0 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-bold text-violet-700 transition hover:bg-violet-100 disabled:opacity-40">＋ Add rule</button>
                  </div>

                  <div className="mt-3 space-y-2">
                    {rules.map((row, index) => <div key={row.id} className="grid grid-cols-[.65fr_1.25fr_36px] items-end gap-2 rounded-xl border border-slate-100 bg-slate-50/70 p-2.5">
                      <label className="min-w-0"><span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Every Nth spin</span><input type="number" min="1" value={row.every} onChange={e => setRules(prev => prev.map(r => r.id === row.id ? { ...r, every: e.target.value } : r))} className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2.5 text-sm outline-none focus:border-violet-300" /></label>
                      <label className="min-w-0"><span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Prize entry</span><select value={row.entryId} onChange={e => setRules(prev => prev.map(r => r.id === row.id ? { ...r, entryId: e.target.value } : r))} className="w-full min-w-0 rounded-lg border border-slate-200 bg-white px-2 py-2.5 text-sm outline-none focus:border-violet-300">{entries.map(e => <option key={e.id} value={e.id}>{e.label}</option>)}</select></label>
                      <button onClick={() => setRules(prev => prev.filter(r => r.id !== row.id))} className="mb-0.5 flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-500" aria-label={`Remove rule ${index + 1}`}><X size={15} /></button>
                    </div>)}
                    {rules.length === 0 && <div className="rounded-xl border border-dashed border-slate-200 px-4 py-5 text-center"><Clock3 size={19} className="mx-auto text-slate-300" /><p className="mt-2 text-xs font-semibold text-slate-400">No prize rules yet</p></div>}
                  </div>
                </div>}
              </div>

              {/* History */}
              <div className={drawerCard}>
                <div className="mb-4 flex items-center justify-between"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-50 text-sky-600"><History size={18} /></span><div><h3 className="font-extrabold text-slate-900">Spin history</h3><p className="mt-1 text-xs text-slate-500">Your recent results</p></div></div><button onClick={exportHistory} disabled={!history.length} title="Export CSV" className="rounded-xl border border-slate-200 p-2.5 text-slate-500 transition hover:bg-slate-50 disabled:opacity-30"><Download size={16} /></button></div>
                {history.length ? <div className="space-y-1.5">{history.slice(0, 5).map((r, i) => <div key={r.id} className="flex items-center gap-3 rounded-xl px-2 py-2.5"><span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-black ${i === 0 ? "bg-violet-100 text-violet-700" : "bg-slate-100 text-slate-500"}`}>{r.spin}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold text-slate-700">{r.winner}</span><span className="mt-0.5 block text-[11px] text-slate-400">{r.time}</span></span>{r.scheduled && <span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-700">PRIZE</span>}</div>)}</div> : <div className="rounded-xl bg-slate-50 px-4 py-7 text-center"><History size={20} className="mx-auto text-slate-300" /><p className="mt-2 text-sm font-semibold text-slate-500">Nothing spun yet</p><p className="mt-1 text-xs text-slate-400">Your results will show up here.</p></div>}
                {history.length > 0 && <button onClick={() => { setHistory([]); setNotice("Spin history cleared"); }} className="mt-3 w-full rounded-xl py-2 text-xs font-bold text-slate-400 transition hover:bg-rose-50 hover:text-rose-500">Clear history</button>}
              </div>
            </div>
          </aside>

          {notice && <div className="fixed bottom-5 left-1/2 z-[80] -translate-x-1/2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-xl">{notice}<button onClick={() => setNotice("")} className="ml-4 text-slate-400 hover:text-white" aria-label="Dismiss notification">×</button></div>}
        </section>

        <footer className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-slate-200/70 pt-6 text-xs text-slate-400 sm:flex-row"><span>© {new Date().getFullYear()} WALA LNG TO</span><span className="flex items-center gap-1.5"><Settings2 size={13} /> Customizable · Responsive · Ready to spin</span></footer>
      </div>
    </main>
  );
}