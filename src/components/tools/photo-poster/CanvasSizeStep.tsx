"use client";

import { useState } from "react";
import { CANVAS_PRESETS } from "./constants";
import type { CanvasPreset } from "./types";

export function CanvasSizeStep({ onSelect }: { onSelect: (preset: CanvasPreset) => void }) {
  const [customW, setCustomW] = useState(1080);
  const [customH, setCustomH] = useState(1350);

  return (
    <div className="flex h-full min-h-0 flex-col items-center justify-center overflow-y-auto bg-bg px-4 py-8">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <div>
          <h1 className="text-2xl text-accent" style={{ fontFamily: "var(--font-brand)" }}>
            BE4 THE POST
          </h1>
          <p className="mt-2 text-sm text-ink-muted">先選一個畫布尺寸，之後隨時可以再回來這裡調整。</p>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {CANVAS_PRESETS.filter((p) => p.id !== "custom").map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => onSelect(preset)}
              className="flex flex-col items-start gap-1 rounded-xl border border-line bg-surface px-2.5 py-3 text-left transition hover:border-accent hover:accent-shadow sm:px-4 sm:py-4"
            >
              {/* Fixed-height slot so the icon's varying aspect ratio (a
                  9:16 story preset is much taller than a 1:1 square one)
                  never pushes the label down by a different amount from
                  card to card -- the swatch bottom-aligns within it, and
                  every card's label then starts at the same y position. */}
              <span className="mb-2 flex h-10 items-end sm:h-14">
                <span
                  className="rounded-sm border border-line bg-surface-2"
                  style={{
                    width: 32,
                    aspectRatio: `${preset.width} / ${preset.height}`,
                  }}
                />
              </span>
              <span className="text-xs font-medium text-ink sm:text-sm">{preset.label}</span>
              <span className="text-[10px] text-ink-faint sm:text-xs">{preset.sublabel}</span>
            </button>
          ))}
        </div>

        <div className="rounded-xl border border-line bg-surface px-4 py-4">
          <p className="mb-3 font-medium text-ink">自訂尺寸</p>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-ink-muted">
              寬
              <input
                type="number"
                min={200}
                max={4000}
                value={customW}
                onChange={(e) => setCustomW(Number(e.target.value))}
                className="w-20 rounded-md border border-line bg-surface-2 px-2 py-1 text-ink"
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-ink-muted">
              高
              <input
                type="number"
                min={200}
                max={4000}
                value={customH}
                onChange={(e) => setCustomH(Number(e.target.value))}
                className="w-20 rounded-md border border-line bg-surface-2 px-2 py-1 text-ink"
              />
            </label>
            <button
              type="button"
              onClick={() =>
                onSelect({ id: "custom", label: "自訂尺寸", sublabel: `${customW} × ${customH}`, width: customW, height: customH })
              }
              className="ml-auto rounded-md accent-fill px-4 py-2 text-sm font-semibold transition hover:opacity-90"
            >
              使用這個尺寸
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
