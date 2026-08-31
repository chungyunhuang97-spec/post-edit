"use client";

import { useEffect, useRef, useState } from "react";
import { BRACKET_OPTIONS, FONT_OPTIONS, SHAPE_OPTIONS } from "./constants";
import type { BracketStyleId, CanvasPreset, Cutout, FontOptionId, ShapeId } from "./types";

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

type TabId = "photo" | "caption" | "cutouts" | "text";
const TABS: { id: TabId; label: string }[] = [
  { id: "photo", label: "照片" },
  { id: "caption", label: "文案" },
  { id: "cutouts", label: "挖空" },
  { id: "text", label: "文字" },
];

const fieldClass = "rounded-md border border-line bg-surface-2 px-2 py-1.5 text-ink";

export interface ControlPanelProps {
  preset: CanvasPreset;
  onChangeSize: () => void;

  imageUrl: string | null;
  onImageChange: (dataUrl: string) => void;

  zoom: number;
  onZoomChange: (n: number) => void;

  caption: string;
  onCaptionChange: (text: string) => void;
  onRegenerateCaption: () => void;

  cutouts: Cutout[];
  onCutoutCountChange: (n: number) => void;
  onCutoutColorChange: (id: string, color: string) => void;
  onResetCutoutColors: () => void;
  shapeId: ShapeId;
  onShapeChange: (id: ShapeId) => void;
  scaleMultiplier: number;
  onScaleChange: (n: number) => void;
  locked: boolean;
  onToggleLocked: () => void;
  onRandomize: () => void;

  baseFontSizePx: number;
  onFontSizeChange: (n: number) => void;
  lineHeightMultiplier: number;
  onLineHeightChange: (n: number) => void;
  letterSpacingPx: number;
  onLetterSpacingChange: (n: number) => void;
  fontOptionId: FontOptionId;
  onFontOptionChange: (id: FontOptionId) => void;
  bracketId: BracketStyleId;
  onBracketChange: (id: BracketStyleId) => void;
  topBgColor: string;
  onTopBgColorChange: (hex: string) => void;
  textColor: string;
  onTextColorChange: (hex: string) => void;

  onExport: () => void;
  exporting: boolean;
}

export function ControlPanel(props: ControlPanelProps) {
  const {
    preset,
    onChangeSize,
    imageUrl,
    onImageChange,
    zoom,
    onZoomChange,
    caption,
    onCaptionChange,
    onRegenerateCaption,
    cutouts,
    onCutoutCountChange,
    onCutoutColorChange,
    onResetCutoutColors,
    shapeId,
    onShapeChange,
    scaleMultiplier,
    onScaleChange,
    locked,
    onToggleLocked,
    onRandomize,
    baseFontSizePx,
    onFontSizeChange,
    lineHeightMultiplier,
    onLineHeightChange,
    letterSpacingPx,
    onLetterSpacingChange,
    fontOptionId,
    onFontOptionChange,
    bracketId,
    onBracketChange,
    topBgColor,
    onTopBgColorChange,
    textColor,
    onTextColorChange,
    onExport,
    exporting,
  } = props;

  const [activeTab, setActiveTab] = useState<TabId>("photo");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const item = Array.from(e.clipboardData?.items ?? []).find((i) => i.type.startsWith("image/"));
      const file = item?.getAsFile();
      if (file) readFileAsDataUrl(file).then(onImageChange);
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [onImageChange]);

  async function handleFileList(files: FileList | null) {
    const file = files?.[0];
    if (file && file.type.startsWith("image/")) {
      onImageChange(await readFileAsDataUrl(file));
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col text-sm">
      <div className="flex shrink-0 items-center justify-between border-b border-line px-4 py-2">
        <div>
          <p className="text-xs font-medium text-ink">{preset.label}</p>
          <p className="text-[11px] text-ink-faint">
            {preset.width} × {preset.height}
          </p>
        </div>
        <button type="button" onClick={onChangeSize} className="text-xs font-medium text-accent-2 hover:underline">
          變更尺寸
        </button>
      </div>

      <div className="flex shrink-0 gap-1 border-b border-line px-3 py-2">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 rounded-full px-3 py-1.5 text-xs font-medium transition ${
              activeTab === tab.id ? "y2k-gradient text-white" : "text-ink-muted hover:bg-surface-2 hover:text-ink"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {activeTab === "photo" && (
          <div className="flex flex-col gap-4">
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                void handleFileList(e.dataTransfer.files);
              }}
              className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-line bg-surface-2 px-4 py-6 text-center text-ink-muted transition hover:border-accent-2"
            >
              {imageUrl ? (
                <span className="text-xs">已上傳，點擊或拖曳可更換圖片</span>
              ) : (
                <span className="text-xs">點擊上傳、拖曳圖片到此處，或直接 Ctrl/Cmd+V 貼上</span>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => void handleFileList(e.target.files)}
            />
            <label className="flex flex-col gap-1">
              <span className="flex justify-between text-xs text-ink-muted">
                <span>照片縮放</span>
                <span>{zoom.toFixed(1)}x</span>
              </span>
              <input
                type="range"
                min={1}
                max={3}
                step={0.1}
                value={zoom}
                onChange={(e) => onZoomChange(Number(e.target.value))}
              />
              <span className="text-xs text-ink-faint">直接拖曳上方預覽的照片可調整顯示位置</span>
            </label>
          </div>
        )}

        {activeTab === "caption" && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-ink-muted">詩意描述</span>
              <button
                type="button"
                onClick={onRegenerateCaption}
                className="rounded-full bg-accent-soft px-2 py-1 text-xs font-medium text-accent-2 hover:opacity-80"
              >
                重新生成
              </button>
            </div>
            <textarea
              value={caption}
              onChange={(e) => onCaptionChange(e.target.value)}
              rows={5}
              className={`w-full resize-none ${fieldClass}`}
            />
          </div>
        )}

        {activeTab === "cutouts" && (
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1">
              <span className="flex justify-between text-xs text-ink-muted">
                <span>摳圖數量 (N)</span>
                <span>{cutouts.length}</span>
              </span>
              <input
                type="range"
                min={1}
                max={14}
                value={cutouts.length}
                onChange={(e) => onCutoutCountChange(Number(e.target.value))}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-ink-muted">挖空形狀</span>
              <select value={shapeId} onChange={(e) => onShapeChange(e.target.value as ShapeId)} className={fieldClass}>
                {SHAPE_OPTIONS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="flex justify-between text-xs text-ink-muted">
                <span>小圖統一縮放倍數</span>
                <span>{scaleMultiplier.toFixed(1)}x</span>
              </span>
              <input
                type="range"
                min={1}
                max={4}
                step={0.1}
                value={scaleMultiplier}
                onChange={(e) => onScaleChange(Number(e.target.value))}
              />
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onToggleLocked}
                className={`flex-1 rounded-md border px-3 py-1.5 text-xs font-medium ${
                  locked ? "border-accent-2 bg-accent-soft text-accent-2" : "border-line bg-surface-2 text-ink-muted"
                }`}
              >
                {locked ? "已鎖定" : "可拖曳"}
              </button>
              <button
                type="button"
                onClick={onRandomize}
                className="flex-1 rounded-md border border-line bg-surface-2 px-3 py-1.5 text-xs font-medium text-ink-muted hover:text-ink"
              >
                隨機挖空
              </button>
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-xs text-ink-muted">個別挖空顏色</span>
                <button
                  type="button"
                  onClick={onResetCutoutColors}
                  className="text-xs font-medium text-accent-2 hover:underline"
                >
                  重設全部
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {cutouts.map((cutout, i) => (
                  <label
                    key={cutout.id}
                    className="relative flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border border-line bg-surface-2 text-[10px] text-ink-faint"
                    style={cutout.color ? { backgroundColor: cutout.color, borderColor: cutout.color } : undefined}
                    title={`第 ${i + 1} 個挖空的顏色`}
                  >
                    {!cutout.color && i + 1}
                    <input
                      type="color"
                      value={cutout.color ?? topBgColor}
                      onChange={(e) => onCutoutColorChange(cutout.id, e.target.value)}
                      className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    />
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "text" && (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-xs text-ink-muted">
                字體風格
                <select
                  value={fontOptionId}
                  onChange={(e) => onFontOptionChange(e.target.value as FontOptionId)}
                  className={fieldClass}
                >
                  {FONT_OPTIONS.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-ink-muted">
                括號樣式
                <select
                  value={bracketId}
                  onChange={(e) => onBracketChange(e.target.value as BracketStyleId)}
                  className={fieldClass}
                >
                  {BRACKET_OPTIONS.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="flex flex-col gap-1">
              <span className="flex justify-between text-xs text-ink-muted">
                <span>文字基礎字號</span>
                <span>{baseFontSizePx}px</span>
              </span>
              <input
                type="range"
                min={16}
                max={64}
                value={baseFontSizePx}
                onChange={(e) => onFontSizeChange(Number(e.target.value))}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="flex justify-between text-xs text-ink-muted">
                <span>行距</span>
                <span>{lineHeightMultiplier.toFixed(1)}</span>
              </span>
              <input
                type="range"
                min={1}
                max={2.2}
                step={0.1}
                value={lineHeightMultiplier}
                onChange={(e) => onLineHeightChange(Number(e.target.value))}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="flex justify-between text-xs text-ink-muted">
                <span>字距</span>
                <span>{letterSpacingPx}px</span>
              </span>
              <input
                type="range"
                min={-2}
                max={10}
                value={letterSpacingPx}
                onChange={(e) => onLetterSpacingChange(Number(e.target.value))}
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-xs text-ink-muted">
                上半部背景色
                <input
                  type="color"
                  value={topBgColor}
                  onChange={(e) => onTopBgColorChange(e.target.value)}
                  className="h-8 w-full rounded-md border border-line bg-surface-2"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-ink-muted">
                文字顏色
                <input
                  type="color"
                  value={textColor}
                  onChange={(e) => onTextColorChange(e.target.value)}
                  className="h-8 w-full rounded-md border border-line bg-surface-2"
                />
              </label>
            </div>
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-line px-4 py-3">
        <button
          type="button"
          disabled={!imageUrl || exporting}
          onClick={onExport}
          className="y2k-glow w-full rounded-lg y2k-gradient px-4 py-2.5 font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
        >
          {exporting ? "匯出中…" : "匯出 PNG"}
        </button>
      </div>
    </div>
  );
}
