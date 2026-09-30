"use client";

import { useState } from "react";
import { BRACKET_OPTIONS, COLLAGE_OPTIONS, FONT_OPTIONS, LAYOUT_OPTIONS, SHAPE_OPTIONS, STYLE_PRESETS } from "./constants";
import type { BracketStyleId, CanvasPreset, CollageLayoutId, Cutout, FontOptionId, PosterLayoutId, ShapeId, StylePreset } from "./types";

type TabId = "layout" | "style" | "photo" | "caption" | "shapes" | "text";
// 版型 leads -- it's where how-many-photos (拼貼方式) lives, and that's the
// first decision a new poster needs, before style/photo/caption make sense.
const TABS: { id: TabId; label: string }[] = [
  { id: "layout", label: "版型" },
  { id: "style", label: "風格" },
  { id: "photo", label: "照片" },
  { id: "caption", label: "文案" },
  { id: "shapes", label: "圖形" },
  { id: "text", label: "文字" },
];

/** A tiny two-tone swatch previewing what a style preset will actually
 * change -- the caption-band color as the ground, the photo/sticker color
 * as a shape chip clipped to the preset's own cutout shape -- so the list
 * reads as a gallery of looks rather than a wall of Chinese labels. */
function StylePresetSwatch({ preset }: { preset: StylePreset }) {
  const shape = SHAPE_OPTIONS.find((s) => s.id === preset.shapeId);
  return (
    <span className="flex h-10 w-12 shrink-0 overflow-hidden rounded-md border border-line">
      <span
        className="flex flex-1 items-center justify-center"
        style={{ backgroundColor: preset.topBgColor }}
      >
        <span className="h-4 w-4" style={{ backgroundColor: preset.textColor, clipPath: shape?.clipPath }} />
      </span>
      <span className="w-3" style={{ backgroundColor: preset.textColor }} />
    </span>
  );
}

const fieldClass = "rounded-md border border-line bg-surface-2 px-2 py-1.5 text-ink";

/** Small two-block diagram showing which arrangement a layout option is --
 * the accent block stands in for the caption zone, the dim block for the
 * photo zone, in the actual relative position/orientation they'll render. */
function LayoutIcon({ id }: { id: PosterLayoutId }) {
  if (id === "overlay-h" || id === "overlay-v") {
    return (
      <div className="relative h-7 w-10 overflow-hidden rounded-sm bg-line">
        <div className={id === "overlay-h" ? "absolute inset-x-0 top-[33%] h-[34%] bg-accent" : "absolute inset-y-0 left-[33%] w-[34%] bg-accent"} />
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
  onApplyStylePreset: (preset: StylePreset) => void;

  imageUrl: string | null;
  uploadError: string | null;
  onRequestUpload: () => void;
  imageUrl2: string | null;
  uploadError2: string | null;
  onRequestUpload2: () => void;

  zoom: number;
  onZoomChange: (n: number) => void;
  duotoneEnabled: boolean;
  onDuotoneEnabledChange: (enabled: boolean) => void;
  grainEnabled: boolean;
  onGrainEnabledChange: (enabled: boolean) => void;
  grainIntensity: number;
  onGrainIntensityChange: (n: number) => void;

  caption: string;
  onCaptionChange: (text: string) => void;
  onRegenerateCaption: () => void;
  suggestingCaption: boolean;

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

  layout: PosterLayoutId;
  onLayoutChange: (id: PosterLayoutId) => void;
  collageLayoutId: CollageLayoutId;
  onCollageLayoutChange: (id: CollageLayoutId) => void;
  subjectHalftoneEnabled: boolean;
  onSubjectHalftoneEnabledChange: (enabled: boolean) => void;
  subjectHalftoneStatus: "idle" | "loading" | "ready" | "unavailable";

  onExport: () => void;
  exporting: boolean;
}

export function ControlPanel(props: ControlPanelProps) {
  const {
    preset,
    onChangeSize,
    onApplyStylePreset,
    imageUrl,
    uploadError,
    onRequestUpload,
    imageUrl2,
    uploadError2,
    onRequestUpload2,
    zoom,
    onZoomChange,
    duotoneEnabled,
    onDuotoneEnabledChange,
    grainEnabled,
    onGrainEnabledChange,
    grainIntensity,
    onGrainIntensityChange,
    caption,
    onCaptionChange,
    onRegenerateCaption,
    suggestingCaption,
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
    layout,
    onLayoutChange,
    collageLayoutId,
    onCollageLayoutChange,
    subjectHalftoneEnabled,
    onSubjectHalftoneEnabledChange,
    subjectHalftoneStatus,
    onExport,
    exporting,
  } = props;

  const [activeTab, setActiveTab] = useState<TabId>("layout");

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
        {activeTab === "style" && (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-ink-faint">
              一鍵套用一整組風格（字體、圖形、配色、顆粒／雙色調都會一起換），套用後仍可到其他分頁微調。
            </p>
            <div className="flex flex-col gap-2">
              {STYLE_PRESETS.map((sp) => (
                <button
                  key={sp.id}
                  type="button"
                  onClick={() => onApplyStylePreset(sp)}
                  className="flex items-center gap-3 rounded-md border border-line bg-surface-2 px-3 py-2 text-left transition hover:border-accent hover:accent-shadow"
                >
                  <StylePresetSwatch preset={sp} />
                  <span className="flex flex-col gap-0.5">
                    <span className="text-xs font-medium text-ink">{sp.label}</span>
                    <span className="text-[11px] text-ink-faint">{sp.sublabel}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {activeTab === "photo" && (
          <div className="flex flex-col gap-4">
            {collageLayoutId !== "single" && (
              <p className="text-xs text-ink-faint">
                目前是拼貼模式（{COLLAGE_OPTIONS.find((o) => o.id === collageLayoutId)?.label}），可到「版型」分頁改回單張照片。
              </p>
            )}

            {uploadError && (
              <p className="rounded-md border border-red-400/40 bg-red-400/10 px-3 py-2 text-xs text-red-300">
                {uploadError}
              </p>
            )}

            {collageLayoutId !== "single" && (
              <div className="flex flex-col gap-2 rounded-md border border-line bg-surface-2 px-3 py-2">
                <span className="text-xs font-medium text-ink">第二張照片</span>
                {uploadError2 && <p className="text-xs text-red-300">{uploadError2}</p>}
                <button
                  type="button"
                  onClick={onRequestUpload2}
                  className="rounded-md border border-line bg-surface px-3 py-2 text-xs font-medium text-ink-muted transition hover:border-accent hover:text-accent"
                >
                  {imageUrl2 ? "變更第二張照片" : "上傳第二張照片"}
                </button>
              </div>
            )}

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
                  <span className="text-xs text-ink-faint">
                    {collageLayoutId === "single" ? "直接拖曳上方預覽的照片可調整顯示位置" : "拼貼模式下兩張照片皆置中裁切，縮放仍共用這個滑桿"}
                  </span>
                </label>
                <button
                  type="button"
                  onClick={onRequestUpload}
                  className="rounded-md border border-line bg-surface-2 px-3 py-2 text-xs font-medium text-ink-muted transition hover:border-accent hover:text-accent"
                >
                  {collageLayoutId === "single" ? "變更照片" : "變更第一張照片"}
                </button>
                <label className="flex items-center justify-between rounded-md border border-line bg-surface-2 px-3 py-2 text-xs text-ink-muted">
                  <span className="flex flex-col gap-0.5">
                    <span className="font-medium text-ink">雙色調</span>
                    <span className="text-ink-faint">用文字色與上半部背景色重新上色照片</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={duotoneEnabled}
                    onChange={(e) => onDuotoneEnabledChange(e.target.checked)}
                    className="h-4 w-4 accent-accent"
                  />
                </label>
                <div className="flex flex-col gap-2 rounded-md border border-line bg-surface-2 px-3 py-2">
                  <label className="flex items-center justify-between text-xs text-ink-muted">
                    <span className="flex flex-col gap-0.5">
                      <span className="font-medium text-ink">顆粒質感</span>
                      <span className="text-ink-faint">整張海報疊加底片顆粒</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={grainEnabled}
                      onChange={(e) => onGrainEnabledChange(e.target.checked)}
                      className="h-4 w-4 accent-accent"
                    />
                  </label>
                  {grainEnabled && (
                    <label className="flex flex-col gap-1">
                      <span className="flex justify-between text-xs text-ink-muted">
                        <span>顆粒濃度</span>
                        <span>{grainIntensity}%</span>
                      </span>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={5}
                        value={grainIntensity}
                        onChange={(e) => onGrainIntensityChange(Number(e.target.value))}
                      />
                    </label>
                  )}
                </div>
              </>
            ) : (
              <p className="text-xs text-ink-faint">請在上方預覽區塊點擊上傳照片，或直接拖曳、Ctrl/Cmd+V 貼上。</p>
            )}
          </div>
        )}

        {activeTab === "caption" && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={onRegenerateCaption}
                disabled={suggestingCaption}
                className="rounded-full bg-accent-soft px-2 py-1 text-xs font-medium text-accent hover:opacity-80 disabled:opacity-50"
              >
                {suggestingCaption ? "分析照片中…" : "重新生成"}
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

        {activeTab === "shapes" && (
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
              <span className="text-xs text-ink-muted">圖形形狀</span>
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
                min={0.5}
                max={2}
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
                隨機圖形
              </button>
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-xs text-ink-muted">個別圖形顏色</span>
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
                    title={`第 ${i + 1} 個圖形的顏色`}
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
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <span className="text-xs text-ink-muted">拼貼方式（照片張數）</span>
              <div className="grid grid-cols-3 gap-2">
                {COLLAGE_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => onCollageLayoutChange(opt.id)}
                    className={`rounded-md border px-2 py-1.5 text-xs font-medium transition ${
                      collageLayoutId === opt.id ? "border-accent bg-accent-soft text-accent" : "border-line bg-surface-2 text-ink-muted"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {collageLayoutId !== "single" && (
                <p className="text-[11px] text-ink-faint">到「照片」分頁可以上傳第二張照片。</p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-xs text-ink-muted">文字與照片的排版方式</p>
              <div className="grid grid-cols-2 gap-2">
                {LAYOUT_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => onLayoutChange(opt.id)}
                    className={`flex items-center gap-2 rounded-md border px-3 py-2 text-left text-xs font-medium transition ${
                      layout === opt.id ? "border-accent bg-accent-soft text-accent" : "border-line bg-surface-2 text-ink-muted"
                    }`}
                  >
                    <LayoutIcon id={opt.id} />
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <label className="flex flex-col gap-1 text-xs text-ink-muted">
              上半部背景色
              <input
                type="color"
                value={topBgColor}
                onChange={(e) => onTopBgColorChange(e.target.value)}
                className="h-8 w-full rounded-md border border-line bg-surface-2"
              />
            </label>
            <div className="flex flex-col gap-1.5 rounded-md border border-line bg-surface-2 px-3 py-2">
              <label className="flex items-center justify-between text-xs text-ink-muted">
                <span className="flex flex-col gap-0.5">
                  <span className="font-medium text-ink">主體網點</span>
                  <span className="text-ink-faint">用網點畫出照片裡偵測到的主體（人物/動物等）輪廓，取代文案底色</span>
                </span>
                <input
                  type="checkbox"
                  checked={subjectHalftoneEnabled}
                  disabled={!imageUrl}
                  onChange={(e) => onSubjectHalftoneEnabledChange(e.target.checked)}
                  className="h-4 w-4 accent-accent disabled:opacity-40"
                />
              </label>
              {subjectHalftoneEnabled && subjectHalftoneStatus === "loading" && (
                <p className="text-[11px] text-ink-faint">偵測中，第一次使用需要下載辨識模型…</p>
              )}
              {subjectHalftoneEnabled && subjectHalftoneStatus === "unavailable" && (
                <p className="text-[11px] text-ink-faint">這張照片沒有偵測到可辨識的主體，暫時不會顯示效果。</p>
              )}
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
                min={12}
                max={28}
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
