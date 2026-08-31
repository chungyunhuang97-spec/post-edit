"use client";

import { useState } from "react";
import { CANVAS_PRESETS } from "./constants";
import type { CanvasPreset } from "./types";

export function CanvasSizeStep({ onSelect }: { onSelect: (preset: CanvasPreset) => void }) {
  const [customW, setCustomW] = useState(1080);
  const [customH, setCustomH] = useState(1350);

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6 py-16">
      <div>
        <h1 className="text-2xl font-semibold text-ink">相片海報產生器</h1>
        <p className="mt-2 text-sm text-ink-muted">先選一個畫布尺寸，之後隨時可以再回來這裡調整。</p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {CANVAS_PRESETS.filter((p) => p.id !== "custom").map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => onSelect(preset)}
            className="flex flex-col items-start gap-1 rounded-xl border border-line bg-white px-4 py-4 text-left transition hover:border-accent hover:shadow-sm"
          >
            <span
              className="mb-2 rounded-sm border border-line bg-bg"
              style={{
                width: 40,
                aspectRatio: `${preset.width} / ${preset.height}`,
              }}
            />
            <span className="font-medium text-ink">{preset.label}</span>
            <span className="text-xs text-ink-faint">{preset.sublabel}</span>
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-line bg-white px-4 py-4">
        <p className="mb-3 font-medium text-ink">自訂尺寸</p>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-ink-muted">
            寬
            <input
              type="number"
              min={200}
              max={4000}
              value={customW}
              onChange={(e) => setCustomW(Number(e.target.value))}
              className="w-20 rounded-md border border-line px-2 py-1 text-ink"
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
              className="w-20 rounded-md border border-line px-2 py-1 text-ink"
            />
          </label>
          <button
            type="button"
            onClick={() =>
              onSelect({ id: "custom", label: "自訂尺寸", sublabel: `${customW} × ${customH}`, width: customW, height: customH })
            }
            className="ml-auto rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
          >
            使用這個尺寸
          </button>
        </div>
      </div>
    </div>
  );
}
