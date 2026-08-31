"use client";

import { useState } from "react";
import { BRACKET_OPTIONS, FONT_OPTIONS, LAYOUT_OPTIONS, SHAPE_OPTIONS } from "./constants";
import type { BracketStyleId, CanvasPreset, Cutout, FontOptionId, LayoutModeId, PosterLayoutId, ShapeId } from "./types";

type TabId = "photo" | "caption" | "cutouts" | "layout" | "text";
const TABS: { id: TabId; label: string }[] = [
  { id: "photo", label: "照片" },
  { id: "caption", label: "文案" },
  { id: "cutouts", label: "挖空" },
  { id: "layout", label: "版型" },
  { id: "text", label: "文字" },
];

const fieldClass = "rounded-md border border-line bg-surface-2 px-2 py-1.5 text-ink";

/** Small two-block diagram showing which arrangement a layout option is --
 * the accent block stands in for the caption zone, the dim block for the
 * photo zone, in the actual relative position/orientation they'll render. */
function LayoutIcon({ id }: { id: PosterLayoutId | "random" }) {
  if (id === "random") {
    return (
      <div className="grid h-7 w-10 grid-cols-2 grid-rows-2 gap-0.5 overflow-hidden rounded-sm">
        <div className="bg-accent" />
        <div className="bg-line" />
        <div className="bg-line" />
        <div className="bg-accent" />
      </div>
    );
  }
  const isRow = id === "split-left" || id === "split-right";
  const textFirst = id === "text-top" || id === "split-left";
  const blocks = textFirst ? ["bg-accent", "bg-line"] : ["bg-line", "bg-accent"];
  return (
    <div className={`flex h-7 w-10 gap-0.5 overflow-hidden rounded-sm ${isRow ? "flex-row" : "flex-col"}`}>
      <div className={`flex-1 ${blocks[0]}`} />
      <div className={`flex-1 ${blocks[1]}`} />
    </div>
  );
}

export interface ControlPanelProps {
  preset: CanvasPreset;
  onChangeSize: () => void;

  imageUrl: string | null;
  onRequestUpload: () => void;

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

  layoutMode: LayoutModeId;
  onLayoutModeChange: (id: LayoutModeId) => void;

  onExport: () => void;
  exporting: boolean;
}

export function ControlPanel(props: ControlPanelProps) {
  const {
    preset,
    onChangeSize,
    imageUrl,
    onRequestUpload,
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
    layoutMode,
    onLayoutModeChange,
    onExport,
    exporting,
  } = props;

  const [activeTab, setActiveTab] = useState<TabId>("photo");

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
              activeTab === tab.id ? "accent-fill" : "text-ink-muted hover:bg-surface-2 hover:text-ink"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {activeTab === "photo" && (
          <div className="flex flex-col gap-4">
            {imageUrl ? (
              <>
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
                <button
                  type="button"
                  onClick={onRequestUpload}
                  className="rounded-md border border-line bg-surface-2 px-3 py-2 text-xs font-medium text-ink-muted transition hover:border-accent hover:text-accent"
                >
                  變更照片
                </button>
              </>
            ) : (
              <p className="text-xs text-ink-faint">請在上方預覽區塊點擊上傳照片，或直接拖曳、Ctrl/Cmd+V 貼上。</p>
            )}
          </div>
        )}

        {activeTab === "caption" && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-ink-muted">詩意描述</span>
              <button
                type="button"
                onClick={onRegenerateCaption}
                className="rounded-full bg-accent-soft px-2 py-1 text-xs font-medium text-accent hover:opacity-80"
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
                  locked ? "border-accent bg-accent-soft text-accent" : "border-line bg-surface-2 text-ink-muted"
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

        {activeTab === "layout" && (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-ink-muted">文字與照片的排版方式</p>
            <div className="grid grid-cols-2 gap-2">
              {LAYOUT_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onLayoutModeChange(opt.id)}
                  className={`flex items-center gap-2 rounded-md border px-3 py-2 text-left text-xs font-medium transition ${
                    layoutMode === opt.id ? "border-accent bg-accent-soft text-accent" : "border-line bg-surface-2 text-ink-muted"
                  }`}
                >
                  <LayoutIcon id={opt.id} />
                  {opt.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => onLayoutModeChange("random")}
                className={`flex items-center gap-2 rounded-md border px-3 py-2 text-left text-xs font-medium transition ${
                  layoutMode === "random" ? "border-accent bg-accent-soft text-accent" : "border-line bg-surface-2 text-ink-muted"
                }`}
              >
                <LayoutIcon id="random" />
                隨機
              </button>
            </div>
            {layoutMode === "random" && (
              <p className="text-xs text-ink-faint">每次按「隨機挖空」都會換一種排版方式。</p>
            )}
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
                min={12}
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
          className="accent-shadow w-full rounded-lg accent-fill px-4 py-2.5 font-semibold transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
        >
          {exporting ? "匯出中…" : "匯出 PNG"}
        </button>
      </div>
    </div>
  );
}
