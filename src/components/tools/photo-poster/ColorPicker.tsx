"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { hexToHsv, hsvToHex, normalizeHex } from "./colorUtils";

// The user's favourite colours: one list shared by every picker, kept in
// this browser's localStorage (so it survives reloads, but doesn't follow
// the person to another device).
const SAVED_KEY = "photo-poster.savedColors";
const SAVED_MAX = 20;
const NO_COLORS: string[] = [];
let savedCache: string[] | null = null;
const savedListeners = new Set<() => void>();

function readSaved(): string[] {
  if (savedCache) return savedCache;
  try {
    const raw = JSON.parse(window.localStorage.getItem(SAVED_KEY) ?? "[]");
    savedCache = Array.isArray(raw) ? raw.filter((c): c is string => typeof c === "string" && !!normalizeHex(c)) : [];
  } catch {
    savedCache = [];
  }
  return savedCache;
}

function writeSaved(next: string[]) {
  savedCache = next;
  try {
    window.localStorage.setItem(SAVED_KEY, JSON.stringify(next));
  } catch {
    // storage blocked: the list still works until the page closes
  }
  savedListeners.forEach((l) => l());
}

function subscribeSaved(cb: () => void) {
  savedListeners.add(cb);
  return () => {
    savedListeners.delete(cb);
  };
}

interface EyeDropperResult {
  sRGBHex: string;
}
type EyeDropperCtor = new () => { open: () => Promise<EyeDropperResult> };

/** A colour picker that opens on the hex code (the browser's own picker
 * remembers whatever format was used last, often RGB): a saturation/value
 * square, a hue slider, a hex field, and the eyedropper where the browser
 * has one. The trigger is whatever `children`/`className`/`style` make it. */
export function ColorPicker({
  value,
  onChange,
  className,
  style,
  title,
  children,
}: {
  value: string;
  onChange: (hex: string) => void;
  className?: string;
  style?: CSSProperties;
  title?: string;
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ left: 0, top: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const squareRef = useRef<HTMLDivElement>(null);
  const [hsv, setHsv] = useState<[number, number, number]>(() => hexToHsv(value));
  const [text, setText] = useState(value);
  const saved = useSyncExternalStore(subscribeSaved, readSaved, () => NO_COLORS);
  const current = normalizeHex(value) ?? value;
  const isSaved = saved.includes(current);
  const hasEyeDropper = typeof window !== "undefined" && "EyeDropper" in window;

  function openPicker() {
    const r = triggerRef.current?.getBoundingClientRect();
    if (r) {
      const w = 232;
      const h = 370;
      const left = Math.min(Math.max(8, r.left), window.innerWidth - w - 8);
      const below = r.bottom + 6;
      const top = below + h > window.innerHeight ? Math.max(8, r.top - h - 6) : below;
      setPos({ left, top });
    }
    setHsv(hexToHsv(value));
    setText(value);
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    function onDown(e: PointerEvent) {
      const t = e.target as Node;
      if (popRef.current?.contains(t) || triggerRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function apply(next: [number, number, number]) {
    setHsv(next);
    const hex = hsvToHex(next[0], next[1], next[2]);
    setText(hex);
    onChange(hex);
  }

  function dragSquare(e: React.PointerEvent<HTMLDivElement>) {
    const el = squareRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const s = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const v = Math.min(1, Math.max(0, 1 - (e.clientY - r.top) / r.height));
    apply([hsv[0], s, v]);
  }

  async function pickFromScreen() {
    try {
      const Dropper = (window as unknown as { EyeDropper: EyeDropperCtor }).EyeDropper;
      const res = await new Dropper().open();
      const hex = normalizeHex(res.sRGBHex);
      if (hex) {
        setHsv(hexToHsv(hex));
        setText(hex);
        onChange(hex);
      }
    } catch {
      // cancelled
    }
  }

  const hueColor = hsvToHex(hsv[0], 1, 1);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        title={title}
        onClick={() => (open ? setOpen(false) : openPicker())}
        className={className}
        style={style}
      >
        {children}
      </button>
      {open &&
        createPortal(
          <div
            ref={popRef}
            className="fixed z-50 flex w-[232px] flex-col gap-3 rounded-lg border border-line bg-surface p-3 shadow-xl"
            style={{ left: pos.left, top: pos.top }}
          >
            <div
              ref={squareRef}
              className="relative h-36 w-full cursor-crosshair touch-none rounded-md"
              style={{
                backgroundColor: hueColor,
                backgroundImage: "linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent)",
              }}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                dragSquare(e);
              }}
              onPointerMove={(e) => {
                if (e.buttons) dragSquare(e);
              }}
            >
              <span
                className="pointer-events-none absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
                style={{ left: `${hsv[1] * 100}%`, top: `${(1 - hsv[2]) * 100}%`, backgroundColor: value }}
              />
            </div>
            <div className="flex items-center gap-2">
              {hasEyeDropper && (
                <button
                  type="button"
                  onClick={() => void pickFromScreen()}
                  title="用滴管吸取畫面上的顏色"
                  aria-label="滴管"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-line bg-surface-2 text-ink-muted hover:text-ink"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 4l6 6M4 20l1-4 9-9 3 3-9 9-4 1zM12 6l-2 2" />
                  </svg>
                </button>
              )}
              <input
                type="range"
                min={0}
                max={360}
                value={Math.round(hsv[0])}
                onChange={(e) => apply([Number(e.target.value), hsv[1], hsv[2]])}
                className="h-3 flex-1 appearance-none rounded-full"
                style={{ background: "linear-gradient(to right,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)" }}
                aria-label="色相"
              />
            </div>
            <label className="flex items-center gap-2 text-xs text-ink-muted">
              <span className="h-8 w-8 shrink-0 rounded-md border border-line" style={{ backgroundColor: value }} />
              <input
                type="text"
                value={text}
                spellCheck={false}
                maxLength={7}
                onChange={(e) => {
                  setText(e.target.value);
                  const hex = normalizeHex(e.target.value);
                  if (hex) {
                    setHsv(hexToHsv(hex));
                    onChange(hex);
                  }
                }}
                onBlur={() => setText(value)}
                className="h-8 min-w-0 flex-1 rounded-md border border-line bg-surface-2 px-2 font-mono text-xs uppercase text-ink"
                aria-label="色碼"
              />
            </label>
            <div className="flex flex-col gap-2 border-t border-line pt-3">
              <div className="flex items-center justify-between text-[11px] text-ink-muted">
                <span>我的顏色</span>
                <button
                  type="button"
                  disabled={isSaved || saved.length >= SAVED_MAX}
                  onClick={() => writeSaved([current, ...saved].slice(0, SAVED_MAX))}
                  className="rounded-md border border-line bg-surface-2 px-2 py-0.5 font-medium text-ink hover:border-accent hover:text-accent disabled:opacity-40"
                >
                  {isSaved ? "已儲存" : "＋ 儲存目前顏色"}
                </button>
              </div>
              {saved.length === 0 ? (
                <p className="text-[11px] text-ink-faint">按「儲存目前顏色」，之後所有顏色欄位都能一鍵套用。</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {saved.map((c) => (
                    <span key={c} className="group relative">
                      <button
                        type="button"
                        title={c}
                        aria-label={`套用 ${c}`}
                        onClick={() => {
                          setHsv(hexToHsv(c));
                          setText(c);
                          onChange(c);
                        }}
                        className="h-6 w-6 rounded-full border border-line"
                        style={{ backgroundColor: c, outline: c === current ? "2px solid var(--color-accent)" : undefined, outlineOffset: 1 }}
                      />
                      <button
                        type="button"
                        aria-label={`移除 ${c}`}
                        onClick={() => writeSaved(saved.filter((x) => x !== c))}
                        className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-ink text-[9px] leading-none text-bg opacity-60 hover:opacity-100 group-hover:opacity-100"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
