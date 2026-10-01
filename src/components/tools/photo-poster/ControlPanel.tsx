"use client";

import type { ReactNode } from "react";
import { BRACKET_OPTIONS, FONT_OPTIONS, LAYOUT_OPTIONS, SHAPE_OPTIONS, STICKER_STYLE_OPTIONS, STYLE_PRESETS } from "./constants";
import type {
  BracketStyleId,
  CollageLayoutId,
  Cutout,
  FontOptionId,
  PosterLayoutId,
  ShapeId,
  StickerStyleId,
  StylePreset,
} from "./types";

export type TabId = "layout" | "style" | "effects" | "caption" | "shapes" | "text";

// 版型 leads -- it's where the photos themselves (how many, which way they
// split the canvas, and the upload slots) live, and that's the first
// decision a new poster needs, before style/effects/caption make sense.
// 效果 holds only the photo treatments (duotone, grain); zoom lives next to
// the photo slots in 版型 since it's about framing, not an effect.
const TOOLS: { id: TabId; label: string; title: string; icon: ReactNode }[] = [
  {
    id: "layout",
    label: "版型",
    title: "版型・照片",
    icon: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M3 12h18M12 12v9" />
      </>
    ),
  },
  {
    id: "style",
    label: "風格",
    title: "風格・一鍵套用",
    icon: <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16z" />,
  },
  {
    id: "effects",
    label: "效果",
    title: "效果・雙色調與顆粒",
    icon: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 3v18M12 3a9 9 0 010 18" fill="currentColor" />
      </>
    ),
  },
  {
    id: "caption",
    label: "文案",
    title: "文案內容",
    icon: <path d="M4 5h16v11H9l-5 4V5z" />,
  },
  {
    id: "shapes",
    label: "圖形",
    title: "圖形",
    icon: (
      <>
        <circle cx="8" cy="8" r="4" />
        <rect x="12" y="12" width="9" height="9" rx="1" />
      </>
    ),
  },
  {
    id: "text",
    label: "文字",
    title: "文字樣式",
    icon: <path d="M4 20l5-14 5 14M6 15h6M16 20l3-8 3 8M17.2 17.5h3.6" />,
  },
];

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}

export interface ToolRailProps {
  activeTab: TabId | null;
  onSelect: (tab: TabId | null) => void;
  sizeLabel: string;
  onChangeSize: () => void;
  onExport: () => void;
  exporting: boolean;
  /** Export is blocked until every photo slot the current layout needs is
   * filled -- clicking it then jumps to the 版型 tab (where the slots are)
   * instead of silently doing nothing. */
  missingPhotos: boolean;
}

/** The always-visible vertical toolbar down the left edge. Picking a tool
 * opens its adjustment panel under the canvas; picking it again closes the
 * panel so the canvas gets the whole height back. */
export function ToolRail({ activeTab, onSelect, sizeLabel, onChangeSize, onExport, exporting, missingPhotos }: ToolRailProps) {
  return (
    <nav className="flex w-14 shrink-0 flex-col items-center border-r border-line bg-surface py-2" aria-label="編輯工具">
      <div className="flex min-h-0 w-full flex-1 flex-col items-center gap-1 overflow-y-auto">
        {TOOLS.map((tool) => {
          const active = activeTab === tool.id;
          return (
            <button
              key={tool.id}
              type="button"
              title={tool.title}
              aria-pressed={active}
              onClick={() => onSelect(active ? null : tool.id)}
              className={`flex h-[52px] w-12 shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] font-medium transition ${
                active ? "accent-fill" : "text-ink-muted hover:bg-surface-2 hover:text-ink"
              }`}
            >
              <Icon>{tool.icon}</Icon>
              {tool.label}
            </button>
          );
        })}
      </div>

      <div className="flex w-full shrink-0 flex-col items-center gap-1 border-t border-line pt-2">
        <button
          type="button"
          onClick={onChangeSize}
          title={`${sizeLabel}・點擊變更尺寸`}
          className="flex h-[44px] w-12 flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] font-medium text-ink-muted transition hover:bg-surface-2 hover:text-ink"
        >
          <Icon>
            <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
          </Icon>
          尺寸
        </button>
        <button
          type="button"
          disabled={exporting}
          onClick={onExport}
          title={missingPhotos ? "還有照片尚未上傳" : "匯出 PNG"}
          className={`accent-shadow flex h-[52px] w-12 flex-col items-center justify-center gap-0.5 rounded-xl accent-fill text-[10px] font-semibold transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none ${
            missingPhotos ? "opacity-50" : ""
          }`}
        >
          <Icon>
            <path d="M12 4v11M7 11l5 5 5-5M5 20h14" />
          </Icon>
          {exporting ? "匯出中" : "匯出"}
        </button>
      </div>
    </nav>
  );
}

const fieldClass = "rounded-md border border-line bg-surface-2 px-2 py-1.5 text-ink";

function SectionTitle({ children }: { children: ReactNode }) {
  return <h3 className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">{children}</h3>;
}

function ColorField({ label, hint, value, onChange }: { label: string; hint?: string; value: string; onChange: (hex: string) => void }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-ink-muted">
      {label}
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 w-full rounded-md border border-line bg-surface-2"
      />
      {hint && <span className="text-[11px] text-ink-faint">{hint}</span>}
    </label>
  );
}

function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { id: T; label: string; icon?: ReactNode }[];
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className={`grid gap-2 ${options.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => onChange(opt.id)}
          className={`flex items-center justify-center gap-2 rounded-md border px-2 py-2 text-xs font-medium transition ${
            value === opt.id ? "border-accent bg-accent-soft text-accent" : "border-line bg-surface-2 text-ink-muted"
          }`}
        >
          {opt.icon}
          {opt.label}
        </button>
      ))}
    </div>
  );
}

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
        style={{ backgroundColor: preset.captionBgColor }}
      >
        <span className="h-4 w-4" style={{ backgroundColor: preset.textColor, clipPath: shape?.clipPath }} />
      </span>
      <span className="w-3" style={{ backgroundColor: preset.textColor }} />
    </span>
  );
}

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

/** Mini diagram of how two photos split the canvas. */
function SplitIcon({ dir }: { dir: "h" | "v" }) {
  return (
    <span className={`flex h-4 w-5 gap-px overflow-hidden rounded-[2px] ${dir === "h" ? "flex-row" : "flex-col"}`}>
      <span className="flex-1 bg-current opacity-60" />
      <span className="flex-1 bg-current opacity-60" />
    </span>
  );
}

/** One photo slot: thumbnail, state, and the upload/replace button -- the
 * single place to put a photo in, so 版型 owns both "how many photos" and
 * "which photos". */
function PhotoSlot({
  label,
  url,
  error,
  onUpload,
}: {
  label: string;
  url: string | null;
  error: string | null;
  onUpload: () => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-3 rounded-md border border-line bg-surface-2 p-2">
        <span
          className="h-11 w-11 shrink-0 rounded bg-surface bg-cover bg-center"
          style={url ? { backgroundImage: `url(${url})` } : { border: "1px dashed var(--color-ink-faint)" }}
        />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-xs font-medium text-ink">{label}</span>
          <span className="text-[11px] text-ink-faint">{url ? "已上傳" : "尚未上傳"}</span>
        </span>
        <button
          type="button"
          onClick={onUpload}
          className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-medium transition ${
            url ? "border border-line bg-surface text-ink-muted hover:border-accent hover:text-accent" : "accent-fill"
          }`}
        >
          {url ? "更換" : "上傳"}
        </button>
      </div>
      {error && <p className="text-xs text-red-300">{error}</p>}
    </div>
  );
}

export interface ToolPanelProps {
  activeTab: TabId;
  onClose: () => void;
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
  duotoneDark: string;
  onDuotoneDarkChange: (hex: string) => void;
  duotoneLight: string;
  onDuotoneLightChange: (hex: string) => void;
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
  stickerColor: string;
  onStickerColorChange: (hex: string) => void;
  shapeId: ShapeId;
  onShapeChange: (id: ShapeId) => void;
  stickerStyleId: StickerStyleId;
  onStickerStyleChange: (id: StickerStyleId) => void;
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
  captionBgColor: string;
  onCaptionBgColorChange: (hex: string) => void;
  textColor: string;
  onTextColorChange: (hex: string) => void;

  layout: PosterLayoutId;
  onLayoutChange: (id: PosterLayoutId) => void;
  collageLayoutId: CollageLayoutId;
  onCollageLayoutChange: (id: CollageLayoutId) => void;
  captionEnabled: boolean;
  onCaptionEnabledChange: (enabled: boolean) => void;
  subjectHalftoneEnabled: boolean;
  onSubjectHalftoneEnabledChange: (enabled: boolean) => void;
  subjectHalftoneStatus: "idle" | "loading" | "ready" | "unavailable";
}

const TAB_TITLES: Record<TabId, string> = {
  layout: "版型・照片",
  style: "風格",
  effects: "效果",
  caption: "文案",
  shapes: "圖形",
  text: "文字",
};

/** The adjustment panel for whichever tool is active -- rendered under the
 * canvas only while a tool is open. */
export function ToolPanel(props: ToolPanelProps) {
  const {
    activeTab,
    onClose,
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
    duotoneDark,
    onDuotoneDarkChange,
    duotoneLight,
    onDuotoneLightChange,
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
    stickerColor,
    onStickerColorChange,
    shapeId,
    onShapeChange,
    stickerStyleId,
    onStickerStyleChange,
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
    captionBgColor,
    onCaptionBgColorChange,
    textColor,
    onTextColorChange,
    layout,
    onLayoutChange,
    collageLayoutId,
    onCollageLayoutChange,
    captionEnabled,
    onCaptionEnabledChange,
    subjectHalftoneEnabled,
    onSubjectHalftoneEnabledChange,
    subjectHalftoneStatus,
  } = props;

  const isDuo = collageLayoutId !== "single";

  return (
    <div className="flex h-full min-h-0 flex-col text-sm">
      <div className="flex shrink-0 items-center justify-between border-b border-line px-4 py-1.5">
        <span className="text-xs font-semibold text-ink">{TAB_TITLES[activeTab]}</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="收合面板"
          className="flex h-8 w-8 items-center justify-center rounded-full text-ink-muted transition hover:bg-surface-2 hover:text-ink"
        >
          <Icon>
            <path d="M6 9l6 6 6-6" />
          </Icon>
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {activeTab === "layout" && (
          <div className="flex flex-col gap-5">
            <section className="flex flex-col gap-3">
              <SectionTitle>照片</SectionTitle>
              <Segmented
                options={[
                  { id: "single", label: "單張照片" },
                  { id: "pair", label: "雙張照片" },
                ]}
                value={isDuo ? "pair" : "single"}
                onChange={(id) => onCollageLayoutChange(id === "single" ? "single" : "duo-h")}
              />
              {isDuo && (
                <Segmented
                  options={[
                    { id: "duo-h", label: "左右並排", icon: <SplitIcon dir="h" /> },
                    { id: "duo-v", label: "上下並排", icon: <SplitIcon dir="v" /> },
                  ]}
                  value={collageLayoutId}
                  onChange={onCollageLayoutChange}
                />
              )}

              <PhotoSlot
                label={isDuo ? (collageLayoutId === "duo-h" ? "照片 1（左）" : "照片 1（上）") : "照片"}
                url={imageUrl}
                error={uploadError}
                onUpload={onRequestUpload}
              />
              {isDuo && (
                <PhotoSlot
                  label={collageLayoutId === "duo-h" ? "照片 2（右）" : "照片 2（下）"}
                  url={imageUrl2}
                  error={uploadError2}
                  onUpload={onRequestUpload2}
                />
              )}
              {isDuo && !imageUrl2 && <p className="text-[11px] text-ink-faint">兩張照片都上傳後才能匯出。</p>}

              {imageUrl && (
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
                  <span className="text-[11px] text-ink-faint">
                    {isDuo ? "雙張照片皆置中裁切，兩張共用同一個縮放" : "直接拖曳上方預覽的照片可調整顯示位置"}
                  </span>
                </label>
              )}
            </section>

            <section className="flex flex-col gap-3">
              <SectionTitle>文案</SectionTitle>
              <label className="flex items-center justify-between gap-3 rounded-md border border-line bg-surface-2 px-3 py-2 text-xs text-ink-muted">
                <span className="flex flex-col gap-0.5">
                  <span className="font-medium text-ink">顯示文案</span>
                  <span className="text-ink-faint">
                    {isDuo ? "雙張照片一律鋪滿畫布，文案是疊在照片上的色帶" : "關閉後照片鋪滿整張畫布，不顯示任何文字"}
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={captionEnabled}
                  onChange={(e) => onCaptionEnabledChange(e.target.checked)}
                  className="h-4 w-4 shrink-0 accent-accent"
                />
              </label>

              {captionEnabled && (
                <>
                  <div className="flex flex-col gap-2">
                    <p className="text-xs text-ink-muted">{isDuo ? "文案色帶方向" : "文案與照片的位置"}</p>
                    <div className="grid grid-cols-2 gap-2">
                      {(isDuo ? LAYOUT_OPTIONS.filter((o) => o.id === "overlay-h" || o.id === "overlay-v") : LAYOUT_OPTIONS).map((opt) => (
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

                  <ColorField label="文案底色" value={captionBgColor} onChange={onCaptionBgColorChange} />

                  <div className="flex flex-col gap-1.5 rounded-md border border-line bg-surface-2 px-3 py-2">
                    <label className="flex items-center justify-between gap-3 text-xs text-ink-muted">
                      <span className="flex flex-col gap-0.5">
                        <span className="font-medium text-ink">主體網點</span>
                        <span className="text-ink-faint">用網點畫出照片裡偵測到的主體（人物/動物等）輪廓，取代文案底色</span>
                      </span>
                      <input
                        type="checkbox"
                        checked={subjectHalftoneEnabled}
                        disabled={!imageUrl}
                        onChange={(e) => onSubjectHalftoneEnabledChange(e.target.checked)}
                        className="h-4 w-4 shrink-0 accent-accent disabled:opacity-40"
                      />
                    </label>
                    {subjectHalftoneEnabled && subjectHalftoneStatus === "loading" && (
                      <p className="text-[11px] text-ink-faint">偵測中，第一次使用需要下載辨識模型…</p>
                    )}
                    {subjectHalftoneEnabled && subjectHalftoneStatus === "unavailable" && (
                      <p className="text-[11px] text-ink-faint">這張照片沒有偵測到可辨識的主體，暫時不會顯示效果。</p>
                    )}
                  </div>
                </>
              )}
            </section>
          </div>
        )}

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

        {activeTab === "effects" && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 rounded-md border border-line bg-surface-2 px-3 py-2">
              <label className="flex items-center justify-between gap-3 text-xs text-ink-muted">
                <span className="flex flex-col gap-0.5">
                  <span className="font-medium text-ink">雙色調</span>
                  <span className="text-ink-faint">把照片重新上色成「暗部色＋亮部色」兩種顏色</span>
                </span>
                <input
                  type="checkbox"
                  checked={duotoneEnabled}
                  onChange={(e) => onDuotoneEnabledChange(e.target.checked)}
                  className="h-4 w-4 shrink-0 accent-accent"
                />
              </label>
              {duotoneEnabled && (
                <div className="grid grid-cols-2 gap-3">
                  <ColorField label="暗部色" value={duotoneDark} onChange={onDuotoneDarkChange} />
                  <ColorField label="亮部色" value={duotoneLight} onChange={onDuotoneLightChange} />
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2 rounded-md border border-line bg-surface-2 px-3 py-2">
              <label className="flex items-center justify-between gap-3 text-xs text-ink-muted">
                <span className="flex flex-col gap-0.5">
                  <span className="font-medium text-ink">顆粒質感</span>
                  <span className="text-ink-faint">整張海報疊加底片顆粒</span>
                </span>
                <input
                  type="checkbox"
                  checked={grainEnabled}
                  onChange={(e) => onGrainEnabledChange(e.target.checked)}
                  className="h-4 w-4 shrink-0 accent-accent"
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
          </div>
        )}

        {activeTab === "caption" && (
          <div className="flex flex-col gap-3">
            {!captionEnabled && (
              <p className="text-xs text-ink-faint">目前「版型」分頁的顯示文案是關閉的，海報不會顯示文字，但你仍可以先把文案寫好。</p>
            )}
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
          <div className="flex flex-col gap-4">
            {!imageUrl && <p className="text-xs text-ink-faint">上傳照片後，圖形才會出現在畫布上。</p>}
            <label className="flex flex-col gap-1">
              <span className="flex justify-between text-xs text-ink-muted">
                <span>圖形數量</span>
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
              <span className="flex justify-between text-xs text-ink-muted">
                <span>圖形大小</span>
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
            <div className="flex flex-col gap-2">
              <span className="text-xs text-ink-muted">圖形樣式</span>
              <div className="grid grid-cols-3 gap-2">
                {STICKER_STYLE_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => onStickerStyleChange(opt.id)}
                    className={`flex flex-col gap-0.5 rounded-md border px-2 py-1.5 text-left transition ${
                      stickerStyleId === opt.id ? "border-accent bg-accent-soft text-accent" : "border-line bg-surface-2 text-ink-muted"
                    }`}
                  >
                    <span className="text-xs font-medium">{opt.label}</span>
                    <span className="text-[10px] text-ink-faint">{opt.sublabel}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                aria-pressed={locked}
                onClick={onToggleLocked}
                className={`flex-1 rounded-md border px-3 py-1.5 text-xs font-medium ${
                  locked ? "border-accent bg-accent-soft text-accent" : "border-line bg-surface-2 text-ink-muted"
                }`}
              >
                {locked ? "位置已鎖定" : "鎖定位置"}
              </button>
              <button
                type="button"
                onClick={onRandomize}
                className="flex-1 rounded-md border border-line bg-surface-2 px-3 py-1.5 text-xs font-medium text-ink-muted hover:text-ink"
              >
                重新隨機排列
              </button>
            </div>
            <div className="flex flex-col gap-2">
              <ColorField
                label="圖形預設顏色"
                hint="沒有個別指定顏色的圖形，都會用這個顏色"
                value={stickerColor}
                onChange={onStickerColorChange}
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-ink-muted">個別圖形顏色</span>
                <button
                  type="button"
                  onClick={onResetCutoutColors}
                  className="text-xs font-medium text-accent-2 hover:underline"
                >
                  全部改回預設色
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {cutouts.map((cutout, i) => (
                  <label
                    key={cutout.id}
                    className="relative flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border border-line bg-surface-2 text-[10px] text-ink-faint"
                    style={{ backgroundColor: cutout.color ?? stickerColor, borderColor: cutout.color ?? undefined }}
                    title={`第 ${i + 1} 個圖形的顏色`}
                  >
                    <input
                      type="color"
                      value={cutout.color ?? stickerColor}
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
            {!captionEnabled && (
              <p className="text-xs text-ink-faint">目前「版型」分頁的顯示文案是關閉的，這裡的設定暫時不會顯示在海報上。</p>
            )}
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
                <span>字級</span>
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
            <ColorField label="文字顏色" value={textColor} onChange={onTextColorChange} />
          </div>
        )}
      </div>
    </div>
  );
}
