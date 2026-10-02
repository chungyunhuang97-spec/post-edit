"use client";

import { useState, type ReactNode } from "react";
import { defaultLayoutForCount, layoutsForCount, paneFracs, photoCountOf } from "./collage";
import { BRACKET_OPTIONS, COLLAGE_OPTIONS, FONT_OPTIONS, LAYOUT_OPTIONS, SHAPE_OPTIONS, STICKER_STYLE_OPTIONS } from "./constants";
import { STYLE_PRESETS } from "./stylePresets";
import { DEFAULT_DECOR } from "./types";
import type {
  BracketStyleId,
  CaptionMode,
  CollageLayoutId,
  Cutout,
  DecorState,
  Doodle,
  Dot,
  FontOptionId,
  PosterLayoutId,
  ShapeId,
  StickerStyleId,
  StyleFeatures,
  StylePreset,
  Tile,
} from "./types";

export type TabId = "layout" | "style" | "caption";

// 版型 leads -- it's where the photos themselves (how many, which way they
// split the canvas, and the upload slots) live, and that's the first
// decision a new poster needs, before style/effects/caption make sense.
// 效果 holds only the photo treatments (grain); zoom lives next to
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
    id: "caption",
    label: "文案",
    title: "文案・文字",
    icon: <path d="M4 5h16v11H9l-5 4V5z" />,
  },
];

const LOCK_PATH = (
  <>
    <rect x="5" y="11" width="14" height="9" rx="2" />
    <path d="M8 11V8a4 4 0 018 0v3" />
  </>
);
const UNLOCK_PATH = (
  <>
    <rect x="5" y="11" width="14" height="9" rx="2" />
    <path d="M8 11V8a4 4 0 017.4-2" />
  </>
);

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
  /** Tabs to list (a style can leave a tab with nothing to adjust). */
  visibleTabs: TabId[];
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
  locked: boolean;
  onToggleLocked: () => void;
}

/** The vertical toolbar down the left edge. Picking a tool opens its panel
 * (under the canvas on a phone, where the toolbar steps aside until the
 * panel's back button is used; as a side column on wider screens, where the
 * toolbar stays so tools can be switched directly). Picking the open tool
 * again closes it. */
export function ToolRail({ visibleTabs, activeTab, onSelect, sizeLabel, onChangeSize, onExport, exporting, missingPhotos, locked, onToggleLocked }: ToolRailProps) {
  return (
    <nav
      className={`${activeTab ? "hidden md:flex" : "flex"} w-12 shrink-0 flex-col items-center border-r border-line bg-surface py-2`}
      aria-label="編輯工具"
    >
      <div className="flex min-h-0 w-full flex-1 flex-col items-center gap-1 overflow-y-auto">
        {TOOLS.filter((tool) => visibleTabs.includes(tool.id)).map((tool) => {
          const active = activeTab === tool.id;
          return (
            <button
              key={tool.id}
              type="button"
              title={tool.title}
              aria-pressed={active}
              onClick={() => onSelect(active ? null : tool.id)}
              className={`flex h-[52px] w-11 shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] font-medium transition ${
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
          aria-pressed={locked}
          onClick={onToggleLocked}
          title={locked ? "已鎖定：點一下解除" : "鎖定畫面上的東西，避免不小心拖動"}
          className={`flex h-[44px] w-11 flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] font-medium transition ${
            locked ? "bg-accent-soft text-accent" : "text-ink-muted hover:bg-surface-2 hover:text-ink"
          }`}
        >
          <Icon>{locked ? LOCK_PATH : UNLOCK_PATH}</Icon>
          {locked ? "已鎖定" : "鎖定"}
        </button>
        <button
          type="button"
          onClick={onChangeSize}
          title={`${sizeLabel}・點擊變更尺寸`}
          className="flex h-[44px] w-11 flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] font-medium text-ink-muted transition hover:bg-surface-2 hover:text-ink"
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
          className={`accent-shadow flex h-[52px] w-11 flex-col items-center justify-center gap-0.5 rounded-xl accent-fill text-[10px] font-semibold transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none ${
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

// Quick sizes for the caption block (share of the poster it covers).
const CAPTION_SIZES = [
  { label: "小", value: 0.28 },
  { label: "中", value: 0.4 },
  { label: "大", value: 0.55 },
];

const fieldClass = "rounded-md border border-line bg-surface-2 px-2 py-1.5 text-ink";

/** Secondary explanation under a control. On a phone it shows one line to
 * keep the panel compact; tapping it expands the full text. On wider
 * screens there is room, so it is always shown in full. */
function Desc({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <span
      className={`text-ink-faint md:cursor-default ${open ? "" : "max-md:line-clamp-1"}`}
      onClick={(e) => {
        // Inside a toggle's <label>: expand without flipping the checkbox.
        e.preventDefault();
        setOpen((o) => !o);
      }}
    >
      {children}
    </span>
  );
}

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
    <div className={`grid gap-2 ${options.length === 2 ? "grid-cols-2" : options.length === 4 ? "grid-cols-4" : "grid-cols-3"}`}>
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

/** Mini diagram of how the photos split the canvas. */
function CollageIcon({ id }: { id: CollageLayoutId }) {
  return (
    <span className="relative block h-4 w-5 overflow-hidden rounded-[2px]">
      {paneFracs(id).map((f, i) => (
        <span
          key={i}
          className="absolute bg-current opacity-60"
          style={{ left: `calc(${f.x * 100}% + 0.5px)`, top: `calc(${f.y * 100}% + 0.5px)`, width: `calc(${f.w * 100}% - 1px)`, height: `calc(${f.h * 100}% - 1px)` }}
        />
      ))}
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
  zoom,
  onZoomChange,
}: {
  label: string;
  url: string | null;
  error: string | null;
  onUpload: () => void;
  zoom: number;
  onZoomChange: (n: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
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
      {url && (
        <label className="grid grid-cols-[5.5rem_1fr_3rem] items-center gap-2 px-1 text-xs text-ink-muted">
          <span>縮放</span>
          <input type="range" min={1} max={3} step={0.1} value={zoom} onChange={(e) => onZoomChange(Number(e.target.value))} />
          <span className="text-right tabular-nums">{zoom.toFixed(1)}x</span>
        </label>
      )}
      {error && <p className="text-xs text-red-300">{error}</p>}
    </div>
  );
}

export interface ToolPanelProps {
  activeTab: TabId;
  onClose: () => void;
  onApplyStylePreset: (preset: StylePreset) => void;
  /** Thumbnail data URLs by style id (rendered lazily; may be incomplete). */
  styleThumbs: Record<string, string>;
  activeStyleId: string | null;

  decor: DecorState;
  onDecorChange: (patch: Partial<DecorState>) => void;
  tiles: Tile[];
  onTilesEnabledChange: (enabled: boolean) => void;
  onTileCountChange: (n: number) => void;
  onTileZoomChange: (k: number) => void;
  onTileChange: (id: string, patch: Partial<Tile>) => void;
  onShuffleTiles: () => void;
  dots: Dot[];
  onDotsEnabledChange: (enabled: boolean) => void;
  onDotCountChange: (n: number) => void;
  onShuffleDots: () => void;
  doodles: Doodle[];
  onDoodlesEnabledChange: (enabled: boolean) => void;
  onDoodleCountChange: (n: number) => void;
  onShuffleDoodles: () => void;
  onDotColorChange: (id: string, color: string) => void;
  onShuffleWords: () => void;
  /** Controls the active style uses (everything when none / "show all"). */
  features: StyleFeatures;
  onExport: () => void;
  exporting: boolean;
  missingPhotos: boolean;
  showAllFeatures: boolean;
  onShowAllFeaturesChange: (on: boolean) => void;
  /** 剪影填色 keeps frame, silhouette and caption block on one color. */
  linkedColor: boolean;
  /** 挖空色塊: the shapes always match the colour block. */
  stickerLinked: boolean;
  /** The applied style has been tweaked since it was applied. */
  styleDirty: boolean;
  onRestoreStyle: () => void;

  /** One entry per photo slot (see collage.ts). */
  imageUrls: (string | null)[];
  uploadErrors: (string | null)[];
  onRequestUpload: (slot: number) => void;

  zooms: number[];
  onZoomChange: (slot: number, n: number) => void;
  grainEnabled: boolean;
  onGrainEnabledChange: (enabled: boolean) => void;
  grainIntensity: number;
  onGrainIntensityChange: (n: number) => void;

  caption: string;
  onCaptionChange: (text: string) => void;
  onRegenerateCaption: () => void;
  suggestingCaption: boolean;

  cutouts: Cutout[];
  shapesEnabled: boolean;
  onShapesEnabledChange: (enabled: boolean) => void;
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
  maskStatus: "idle" | "loading" | "ready" | "unavailable";
}

const TAB_TITLES: Record<TabId, string> = {
  layout: "版型・照片",
  style: "風格",
  caption: "文案・文字",
};

/** The adjustment panel for whichever tool is active -- rendered under the
 * canvas only while a tool is open. */
export function ToolPanel(props: ToolPanelProps) {
  const {
    activeTab,
    onClose,
    onApplyStylePreset,
    styleThumbs,
    activeStyleId,
    decor,
    onDecorChange,
    tiles,
    onTilesEnabledChange,
    onTileCountChange,
    onTileZoomChange,
    onTileChange,
    onShuffleTiles,
    dots,
    onDotsEnabledChange,
    onDotCountChange,
    onShuffleDots,
    doodles,
    onDoodlesEnabledChange,
    onDoodleCountChange,
    onShuffleDoodles,
    onDotColorChange,
    onShuffleWords,
    onExport,
    exporting,
    missingPhotos,
    features,
    showAllFeatures,
    onShowAllFeaturesChange,
    linkedColor,
    stickerLinked,
    styleDirty,
    onRestoreStyle,
    imageUrls,
    uploadErrors,
    onRequestUpload,
    zooms,
    onZoomChange,
    grainEnabled,
    onGrainEnabledChange,
    grainIntensity,
    onGrainIntensityChange,
    caption,
    onCaptionChange,
    onRegenerateCaption,
    suggestingCaption,
    cutouts,
    shapesEnabled,
    onShapesEnabledChange,
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
    maskStatus,
  } = props;

  const photoN = photoCountOf(collageLayoutId);
  const isDuo = photoN > 1;
  const imageUrl = imageUrls[0];
  const currentStyle = STYLE_PRESETS.find((p) => p.id === activeStyleId) ?? null;
  // With a style applied, its picker folds away to a one-line header.
  const [pickerOpen, setPickerOpen] = useState(() => activeStyleId === null);
  const hasPalette = cutouts.length > 0 && cutouts.every((c) => c.color);
  // The bracket style only matters when photo windows sit between the words.
  const showBrackets = decor.captionMode === "flow" && decor.inlineWindows && shapesEnabled;
  // Tiles show a crop `s` wide; zoom is how much tighter than half the photo.
  const tileZoom = tiles.length ? Math.min(4, Math.max(0.6, 0.5 / (tiles.reduce((a, t) => a + t.s, 0) / tiles.length))) : 1;
  const captionFractionValue = decor.captionFraction ?? (layout === "overlay-h" || layout === "overlay-v" ? 0.34 : 0.5);

  return (
    <div className="flex h-full min-h-0 flex-col text-sm">
      <div className="flex shrink-0 items-center gap-2 border-b border-line px-2 py-1.5">
        <button
          type="button"
          onClick={onClose}
          aria-label="返回主選單"
          className="flex h-8 md:hidden items-center gap-0.5 rounded-full pl-1 pr-3 text-xs font-medium text-ink-muted transition hover:bg-surface-2 hover:text-ink"
        >
          <Icon>
            <path d="M15 6l-6 6 6 6" />
          </Icon>
          返回
        </button>
        <span className="min-w-0 flex-1 truncate text-xs font-semibold text-ink">{TAB_TITLES[activeTab]}</span>
        <button
          type="button"
          aria-pressed={locked}
          onClick={onToggleLocked}
          title={locked ? "已鎖定：畫面上的東西不會被拖動，點一下解除" : "鎖定：避免不小心拖動畫面上的東西"}
          className={`flex h-8 shrink-0 items-center gap-1 rounded-full px-2.5 text-xs font-medium transition ${
            locked ? "bg-accent-soft text-accent" : "text-ink-muted hover:bg-surface-2 hover:text-ink"
          }`}
        >
          <Icon>{locked ? LOCK_PATH : UNLOCK_PATH}</Icon>
          {locked ? "已鎖定" : "鎖定"}
        </button>
        <button
          type="button"
          disabled={exporting}
          onClick={onExport}
          title={missingPhotos ? "還有照片尚未上傳" : "匯出 PNG"}
          className={`flex h-8 shrink-0 items-center gap-1 rounded-full accent-fill px-3 text-xs font-semibold transition hover:opacity-90 disabled:opacity-40 md:hidden ${
            missingPhotos ? "opacity-50" : ""
          }`}
        >
          {exporting ? "匯出中" : "匯出"}
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 md:py-4">
        {activeTab === "layout" && (
          <div className="flex flex-col gap-5">
            <section className="flex flex-col gap-3">
              <SectionTitle>照片</SectionTitle>
              <Segmented<"1" | "2" | "3" | "4">
                options={[
                  { id: "1", label: "單張" },
                  { id: "2", label: "2 張" },
                  { id: "3", label: "3 張" },
                  { id: "4", label: "4 張" },
                ]}
                value={String(photoN) as "1" | "2" | "3" | "4"}
                onChange={(id) => onCollageLayoutChange(defaultLayoutForCount(Number(id)))}
              />
              {isDuo && (
                <Segmented
                  options={layoutsForCount(photoN).map((id) => ({
                    id,
                    label: COLLAGE_OPTIONS.find((o) => o.id === id)!.label.split("・")[1],
                    icon: <CollageIcon id={id} />,
                  }))}
                  value={collageLayoutId}
                  onChange={onCollageLayoutChange}
                />
              )}

              {Array.from({ length: photoN }, (_, slot) => (
                <PhotoSlot
                  key={slot}
                  label={isDuo ? `照片 ${slot + 1}` : "照片"}
                  url={imageUrls[slot] ?? null}
                  error={uploadErrors[slot] ?? null}
                  onUpload={() => onRequestUpload(slot)}
                  zoom={zooms[slot] ?? 1}
                  onZoomChange={(n) => onZoomChange(slot, n)}
                />
              ))}
              {isDuo && imageUrls.slice(0, photoN).some((u) => !u) && (
                <p className="text-[11px] text-ink-faint">所有照片都上傳後才能匯出。</p>
              )}

              {imageUrl && (
                <Desc>{isDuo ? "每張照片各自縮放，也可以在畫布上各自拖曳調整位置" : "直接拖曳上方預覽的照片可調整顯示位置"}</Desc>
              )}
            </section>

            {features.captionBg && !linkedColor && captionEnabled && (
              <section className="flex flex-col gap-3 border-t border-line pt-3">
                <SectionTitle>底色</SectionTitle>
                {(layout === "overlay-h" || layout === "overlay-v") && (
                  <label className="flex items-center justify-between gap-3 text-xs text-ink-muted">
                    <span>透明（文字直接壓在照片上）</span>
                    <input
                      type="checkbox"
                      checked={decor.captionBgTransparent}
                      onChange={(e) => onDecorChange({ captionBgTransparent: e.target.checked })}
                      className="h-4 w-4 shrink-0 accent-accent"
                    />
                  </label>
                )}
                {!(decor.captionBgTransparent && (layout === "overlay-h" || layout === "overlay-v")) && (
                  <ColorField label="文案區塊底色" value={captionBgColor} onChange={onCaptionBgColorChange} />
                )}
                <Desc>文案區塊（文字所在的色塊）的顏色</Desc>
              </section>
            )}
          </div>
        )}

        {activeTab === "style" && (
          <div className="flex flex-col gap-4">
            {currentStyle && !pickerOpen ? (
              <div className="flex items-center gap-3 rounded-md border border-line bg-surface-2 p-2">
                <span className="block h-14 w-11 shrink-0 overflow-hidden rounded border border-accent bg-surface">
                  {styleThumbs[currentStyle.id] && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={styleThumbs[currentStyle.id]} alt="" className="h-full w-full object-cover" draggable={false} />
                  )}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-accent">{currentStyle.label}</span>
                    {styleDirty && (
                      <span className="rounded-full bg-accent-soft px-1.5 py-0.5 text-[10px] font-medium text-accent">已調整</span>
                    )}
                  </span>
                  <span className="truncate text-[10px] text-ink-faint">{currentStyle.sublabel}</span>
                </span>
                <span className="flex shrink-0 flex-col gap-1">
                  <button
                    type="button"
                    onClick={() => setPickerOpen(true)}
                    className="rounded-md border border-line bg-surface px-2.5 py-1 text-[11px] font-medium text-ink-muted hover:border-accent hover:text-accent"
                  >
                    更換風格
                  </button>
                  {styleDirty && (
                    <button
                      type="button"
                      onClick={onRestoreStyle}
                      className="rounded-md border border-line bg-surface px-2.5 py-1 text-[11px] font-medium text-ink-muted hover:border-accent hover:text-accent"
                    >
                      還原成此風格
                    </button>
                  )}
                </span>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <p className="text-xs text-ink-faint">
                  <span className="md:hidden">左右滑動挑選，</span>一鍵套用整組風格，選好後下方會出現這個風格的設定。
                </p>
            <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:flex-col md:gap-2 md:overflow-visible md:px-0 md:pb-0">
              {STYLE_PRESETS.map((sp) => {
                const thumb = styleThumbs[sp.id];
                const active = activeStyleId === sp.id;
                return (
                  <button
                    key={sp.id}
                    type="button"
                    onClick={() => {
                      onApplyStylePreset(sp);
                      setPickerOpen(false);
                    }}
                    className={`flex w-[104px] shrink-0 snap-start flex-col gap-1.5 text-left transition md:w-full md:flex-row md:items-center md:gap-3 ${active ? "" : "opacity-90 hover:opacity-100"}`}
                  >
                    <span
                      className={`block aspect-[4/5] w-full overflow-hidden rounded-md border-2 bg-surface-2 md:w-20 md:shrink-0 ${
                        active ? "border-accent" : "border-line"
                      }`}
                    >
                      {thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={thumb} alt={sp.label} className="h-full w-full object-cover" draggable={false} />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-[10px] text-ink-faint">載入中…</span>
                      )}
                    </span>
                    <span className="flex flex-col gap-0.5">
                      <span className={`text-xs font-medium ${active ? "text-accent" : "text-ink"}`}>{sp.label}</span>
                      <span className="text-[10px] leading-tight text-ink-faint">{sp.sublabel}</span>
                    </span>
                  </button>
                );
              })}
            </div>
              </div>
            )}

            {currentStyle && !pickerOpen && (
              <div className="flex flex-col gap-4">
                <SectionTitle>{`${currentStyle.label}・專屬設定`}</SectionTitle>
            {features.frame && (
            <section className="flex flex-col gap-3">
              <SectionTitle>外框</SectionTitle>
              <label className="grid grid-cols-[5.5rem_1fr_3rem] items-center gap-2 text-xs text-ink-muted"><span>外框粗細</span><input
                  type="range"
                  min={0}
                  max={10}
                  step={0.5}
                  value={decor.frameInsetPct}
                  onChange={(e) => onDecorChange({ frameInsetPct: Number(e.target.value) })}
                /><span className="text-right tabular-nums">{decor.frameInsetPct === 0 ? "無" : `${decor.frameInsetPct}%`}</span></label>
              {decor.frameInsetPct > 0 && (
                <ColorField
                  label={linkedColor ? "主色（外框、剪影、文案底色一起變）" : "外框顏色"}
                  value={decor.frameColor}
                  onChange={(hex) => onDecorChange({ frameColor: hex })}
                />
              )}
            </section>
            )}
            {features.shapes && (
            <>
            <label className="flex items-center justify-between gap-3 rounded-md border border-line bg-surface-2 px-3 py-1.5 text-xs text-ink-muted md:py-2">
              <span className="flex flex-col gap-0.5">
                <span className="font-medium text-ink">顯示圖形</span>
                <Desc>關閉後畫布與文案裡都不會出現圖形，設定仍會保留</Desc>
              </span>
              <input
                type="checkbox"
                checked={shapesEnabled}
                onChange={(e) => onShapesEnabledChange(e.target.checked)}
                className="h-4 w-4 shrink-0 accent-accent"
              />
            </label>
            {shapesEnabled && (
              <>
            {!imageUrl && <p className="text-xs text-ink-faint">上傳照片後，圖形才會出現在畫布上。</p>}
            <label className="grid grid-cols-[5.5rem_1fr_3rem] items-center gap-2 text-xs text-ink-muted"><span>圖形數量</span><input
                type="range"
                min={1}
                max={14}
                value={cutouts.length}
                onChange={(e) => onCutoutCountChange(Number(e.target.value))}
              /><span className="text-right tabular-nums">{cutouts.length}</span></label>
            <label className="grid grid-cols-[5.5rem_1fr_3rem] items-center gap-2 text-xs text-ink-muted"><span>圖形大小</span><input
                type="range"
                min={0.5}
                max={4}
                step={0.1}
                value={scaleMultiplier}
                onChange={(e) => onScaleChange(Number(e.target.value))}
              /><span className="text-right tabular-nums">{scaleMultiplier.toFixed(1)}x</span></label>
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
            <button
              type="button"
              onClick={onRandomize}
              className="rounded-md border border-line bg-surface-2 px-3 py-1.5 text-xs font-medium text-ink-muted hover:text-ink"
            >
              重新隨機排列
            </button>
            <div className="flex flex-col gap-2">
              {!hasPalette && !stickerLinked && (
                <ColorField
                  label="圖形顏色"
                  hint="沒有個別指定顏色的圖形，都會用這個顏色"
                  value={stickerColor}
                  onChange={onStickerColorChange}
                />
              )}
              {stickerLinked && <Desc>圖形顏色跟著文案底色走（改文案底色，圖形一起變）</Desc>}
              {!stickerLinked && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-ink-muted">{hasPalette ? "圖形配色（點色塊更換）" : "個別圖形顏色"}</span>
                <button
                  type="button"
                  onClick={onResetCutoutColors}
                  className="text-xs font-medium text-accent-2 hover:underline"
                >
                  {hasPalette ? "改成單一顏色" : "全部改回預設色"}
                </button>
              </div>
              )}
              {!stickerLinked && (
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
              )}
            </div>
              </>
            )}
            </>
            )}

            {features.tiles && (
            <>
            <div className="border-t border-line" />
            <label className="flex items-center justify-between gap-3 rounded-md border border-line bg-surface-2 px-3 py-1.5 text-xs text-ink-muted md:py-2">
              <span className="flex flex-col gap-0.5">
                <span className="font-medium text-ink">顯示小照片</span>
                <Desc>把照片的不同局部裁成幾張小照片，擺在畫面上（可拖曳）</Desc>
              </span>
              <input
                type="checkbox"
                checked={decor.tilesEnabled}
                onChange={(e) => onTilesEnabledChange(e.target.checked)}
                className="h-4 w-4 shrink-0 accent-accent"
              />
            </label>
            {decor.tilesEnabled && (
              <>
                <label className="grid grid-cols-[5.5rem_1fr_3rem] items-center gap-2 text-xs text-ink-muted"><span>小照片數量</span><input type="range" min={1} max={8} value={tiles.length} onChange={(e) => onTileCountChange(Number(e.target.value))} /><span className="text-right tabular-nums">{tiles.length}</span></label>
                <div className="flex flex-col gap-2">
                  <span className="text-xs text-ink-muted">在畫布上拖曳小照片時</span>
                  <Segmented<"move" | "crop">
                    options={[
                      { id: "move", label: "移動位置" },
                      { id: "crop", label: "調整顯示區塊" },
                    ]}
                    value={decor.tileDragMode}
                    onChange={(id) => onDecorChange({ tileDragMode: id })}
                  />
                  {decor.tileDragMode === "crop" && (
                    <span className="text-[11px] text-ink-faint">小照片會出現綠色外框，拖曳它可以移動裡面顯示的照片區塊</span>
                  )}
                </div>
                <label className="grid grid-cols-[5.5rem_1fr_3rem] items-center gap-2 text-xs text-ink-muted"><span>全部放大</span><input
                    type="range"
                    min={0.6}
                    max={4}
                    step={0.1}
                    value={tileZoom}
                    onChange={(e) => onTileZoomChange(Number(e.target.value))}
                  /><span className="text-right tabular-nums">{tileZoom.toFixed(1)}x</span></label>
                <div className="flex flex-col gap-2">
                  <span className="text-xs text-ink-muted">個別調整</span>
                  {tiles.map((t, i) => {
                    const z = Math.min(4, Math.max(0.6, 0.5 / t.s));
                    return (
                      <div key={t.id} className="flex flex-col gap-1.5 rounded-md border border-line bg-surface-2 px-3 py-2">
                        <span className="text-[11px] font-medium text-ink">小照片 ({i + 1})</span>
                        <label className="grid grid-cols-[3.5rem_1fr_3rem] items-center gap-2 text-xs text-ink-muted"><span>大小</span><input
                            type="range"
                            min={8}
                            max={50}
                            step={1}
                            value={Math.round(t.wPct)}
                            onChange={(e) => onTileChange(t.id, { wPct: Number(e.target.value) })}
                          /><span className="text-right tabular-nums">{Math.round(t.wPct)}%</span></label>
                        <label className="grid grid-cols-[3.5rem_1fr_3rem] items-center gap-2 text-xs text-ink-muted"><span>放大</span><input
                            type="range"
                            min={0.6}
                            max={4}
                            step={0.1}
                            value={z}
                            onChange={(e) => onTileChange(t.id, { s: Math.min(0.95, 0.5 / Number(e.target.value)) })}
                          /><span className="text-right tabular-nums">{z.toFixed(1)}x</span></label>
                      </div>
                    );
                  })}
                </div>
                <label className="flex items-center justify-between gap-3 text-xs text-ink-muted">
                  <span>顯示編號 (1)(2)…</span>
                  <input
                    type="checkbox"
                    checked={decor.tileNumbered}
                    onChange={(e) => onDecorChange({ tileNumbered: e.target.checked })}
                    className="h-4 w-4 shrink-0 accent-accent"
                  />
                </label>
                <button
                  type="button"
                  onClick={onShuffleTiles}
                  className="rounded-md border border-line bg-surface-2 px-3 py-1.5 text-xs font-medium text-ink-muted hover:text-ink"
                >
                  重新排列小照片
                </button>
              </>
            )}
            </>
            )}

            {features.doodles && (
            <>
            <div className="border-t border-line" />
            <label className="flex items-center justify-between gap-3 rounded-md border border-line bg-surface-2 px-3 py-1.5 text-xs text-ink-muted md:py-2">
              <span className="flex flex-col gap-0.5">
                <span className="font-medium text-ink">顯示手繪塗鴉</span>
                <Desc>麥克筆風格的星星、音符、愛心…（可拖曳到畫布任何地方）</Desc>
              </span>
              <input
                type="checkbox"
                checked={decor.doodlesEnabled}
                onChange={(e) => onDoodlesEnabledChange(e.target.checked)}
                className="h-4 w-4 shrink-0 accent-accent"
              />
            </label>
            {decor.doodlesEnabled && (
              <>
                <label className="grid grid-cols-[5.5rem_1fr_3rem] items-center gap-2 text-xs text-ink-muted"><span>塗鴉數量</span><input type="range" min={1} max={14} value={doodles.length} onChange={(e) => onDoodleCountChange(Number(e.target.value))} /><span className="text-right tabular-nums">{doodles.length}</span></label>
                <label className="grid grid-cols-[5.5rem_1fr_3rem] items-center gap-2 text-xs text-ink-muted"><span>塗鴉大小</span><input
                    type="range"
                    min={6}
                    max={40}
                    value={decor.doodleSizePct}
                    onChange={(e) => onDecorChange({ doodleSizePct: Number(e.target.value) })}
                  /><span className="text-right tabular-nums">{decor.doodleSizePct}%</span></label>
                <ColorField label="筆色" value={decor.doodleColor} onChange={(hex) => onDecorChange({ doodleColor: hex })} />
                <label className="flex items-center justify-between gap-3 text-xs text-ink-muted">
                  <span className="flex flex-col gap-0.5">
                    <span>塗鴉沿著人物外圍排列</span>
                    <Desc>自動偵測照片裡的人物或動物，塗鴉貼著他的外圍（拖曳某個塗鴉後，它就改成自由位置）</Desc>
                  </span>
                  <input
                    type="checkbox"
                    checked={decor.doodleAround}
                    onChange={(e) => onDecorChange({ doodleAround: e.target.checked })}
                    className="h-4 w-4 shrink-0 accent-accent"
                  />
                </label>
                <label className="flex items-center justify-between gap-3 text-xs text-ink-muted">
                  <span className="flex flex-col gap-0.5">
                    <span>手繪描邊人物</span>
                    <Desc>用麥克筆沿著人物外圍畫一圈</Desc>
                  </span>
                  <input
                    type="checkbox"
                    checked={decor.doodleOutline}
                    onChange={(e) => onDecorChange({ doodleOutline: e.target.checked })}
                    className="h-4 w-4 shrink-0 accent-accent"
                  />
                </label>
                {(decor.doodleAround || decor.doodleOutline) && maskStatus === "loading" && (
                  <p className="text-[11px] text-ink-faint">偵測人物中，第一次使用需要下載辨識模型…</p>
                )}
                {(decor.doodleAround || decor.doodleOutline) && maskStatus === "unavailable" && (
                  <p className="text-[11px] text-ink-faint">這張照片沒有偵測到人物或動物，塗鴉會改為隨機分布。</p>
                )}
                <Desc>每個塗鴉都是不同的圖案，最多 14 種</Desc>
                <button
                  type="button"
                  onClick={onShuffleDoodles}
                  className="rounded-md border border-line bg-surface-2 px-3 py-1.5 text-xs font-medium text-ink-muted hover:text-ink"
                >
                  重新畫過
                </button>
              </>
            )}
            </>
            )}

            {features.dots && (
            <>
            <div className="border-t border-line" />
            <label className="flex items-center justify-between gap-3 rounded-md border border-line bg-surface-2 px-3 py-1.5 text-xs text-ink-muted md:py-2">
              <span className="flex flex-col gap-0.5">
                <span className="font-medium text-ink">顯示圓點</span>
                <Desc>散落在畫面上的純色圓點（可拖曳）</Desc>
              </span>
              <input
                type="checkbox"
                checked={decor.dotsEnabled}
                onChange={(e) => onDotsEnabledChange(e.target.checked)}
                className="h-4 w-4 shrink-0 accent-accent"
              />
            </label>
            {decor.dotsEnabled && (
              <>
                <label className="grid grid-cols-[5.5rem_1fr_3rem] items-center gap-2 text-xs text-ink-muted"><span>圓點數量</span><input type="range" min={1} max={12} value={dots.length} onChange={(e) => onDotCountChange(Number(e.target.value))} /><span className="text-right tabular-nums">{dots.length}</span></label>
                <label className="grid grid-cols-[5.5rem_1fr_3rem] items-center gap-2 text-xs text-ink-muted"><span>圓點大小</span><input
                    type="range"
                    min={6}
                    max={48}
                    value={decor.dotSizePx}
                    onChange={(e) => onDecorChange({ dotSizePx: Number(e.target.value) })}
                  /><span className="text-right tabular-nums">{decor.dotSizePx}px</span></label>
                <div className="flex flex-wrap gap-2">
                  {dots.map((dot, i) => (
                    <label
                      key={dot.id}
                      className="relative h-8 w-8 cursor-pointer rounded-full border border-line"
                      style={{ backgroundColor: dot.color }}
                      title={`第 ${i + 1} 個圓點的顏色`}
                    >
                      <input
                        type="color"
                        value={dot.color}
                        onChange={(e) => onDotColorChange(dot.id, e.target.value)}
                        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                      />
                    </label>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={onShuffleDots}
                  className="rounded-md border border-line bg-surface-2 px-3 py-1.5 text-xs font-medium text-ink-muted hover:text-ink"
                >
                  重新排列圓點
                </button>
              </>
            )}
            </>
            )}

            {features.silhouette && (
            <>
            <div className="border-t border-line" />
            <div className="flex flex-col gap-2 rounded-md border border-line bg-surface-2 px-3 py-2">
              <label className="flex items-center justify-between gap-3 text-xs text-ink-muted">
                <span className="flex flex-col gap-0.5">
                  <span className="font-medium text-ink">主體填成純色剪影</span>
                  <Desc>偵測照片裡的人物/動物（雙張照片兩張各自偵測），把輪廓填成單一顏色</Desc>
                </span>
                <input
                  type="checkbox"
                  checked={decor.silhouetteEnabled}
                  disabled={!imageUrl}
                  onChange={(e) => onDecorChange({ silhouetteEnabled: e.target.checked })}
                  className="h-4 w-4 shrink-0 accent-accent disabled:opacity-40"
                />
              </label>
              {decor.silhouetteEnabled && !linkedColor && (
                <ColorField label="剪影顏色" value={decor.silhouetteColor} onChange={(hex) => onDecorChange({ silhouetteColor: hex })} />
              )}
              {decor.silhouetteEnabled && (
                <div className="flex flex-col gap-2 border-t border-line pt-2">
                  <label className="flex items-center justify-between gap-3 text-xs text-ink-muted">
                    <span className="flex flex-col gap-0.5">
                      <span className="font-medium text-ink">把剪下的主體貼到別處</span>
                      <Desc>主體會剪下來、加白色粗邊貼在畫面上（可拖曳），原位置留下剪影</Desc>
                    </span>
                    <input
                      type="checkbox"
                      checked={decor.subjectPaste}
                      onChange={(e) => onDecorChange({ subjectPaste: e.target.checked })}
                      className="h-4 w-4 shrink-0 accent-accent"
                    />
                  </label>
                  {decor.subjectPaste && (
                    <>
                      <label className="grid grid-cols-[5.5rem_1fr_3rem] items-center gap-2 text-xs text-ink-muted">
                        <span>貼上大小</span>
                        <input
                          type="range"
                          min={12}
                          max={80}
                          value={decor.subjectPasteW}
                          onChange={(e) => onDecorChange({ subjectPasteW: Number(e.target.value) })}
                        />
                        <span className="text-right tabular-nums">{decor.subjectPasteW}%</span>
                      </label>
                      {isDuo && (
                        <Segmented<string>
                          options={Array.from({ length: photoN }, (_, k) => ({ id: String(k), label: `照片 ${k + 1}` }))}
                          value={String(Math.min(decor.subjectPastePhoto, photoN - 1))}
                          onChange={(id) => onDecorChange({ subjectPastePhoto: Number(id) })}
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => onDecorChange({ subjectPasteX: DEFAULT_DECOR.subjectPasteX, subjectPasteY: DEFAULT_DECOR.subjectPasteY })}
                        className="rounded-md border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink-muted hover:text-ink"
                      >
                        重新放置
                      </button>
                    </>
                  )}
                </div>
              )}
              {decor.silhouetteEnabled && maskStatus === "loading" && (
                <p className="text-[11px] text-ink-faint">偵測中，第一次使用需要下載辨識模型…</p>
              )}
              {decor.silhouetteEnabled && maskStatus === "unavailable" && (
                <p className="text-[11px] text-ink-faint">這張照片沒有偵測到可辨識的主體，暫時不會顯示效果。</p>
              )}
            </div>
            </>
            )}
              </div>
            )}

            {currentStyle && !pickerOpen && (
              <section className="flex flex-col gap-3 border-t border-line pt-3">
                <SectionTitle>顆粒質感</SectionTitle>
<div className="flex flex-col gap-2 rounded-md border border-line bg-surface-2 px-3 py-2">
              <label className="flex items-center justify-between gap-3 text-xs text-ink-muted">
                <span className="flex flex-col gap-0.5">
                  <span className="font-medium text-ink">顆粒質感</span>
                  <Desc>整張海報疊加底片顆粒</Desc>
                </span>
                <input
                  type="checkbox"
                  checked={grainEnabled}
                  onChange={(e) => onGrainEnabledChange(e.target.checked)}
                  className="h-4 w-4 shrink-0 accent-accent"
                />
              </label>
              {grainEnabled && (
                <label className="grid grid-cols-[5.5rem_1fr_3rem] items-center gap-2 text-xs text-ink-muted"><span>顆粒濃度</span><input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={grainIntensity}
                    onChange={(e) => onGrainIntensityChange(Number(e.target.value))}
                  /><span className="text-right tabular-nums">{grainIntensity}%</span></label>
              )}
            </div>
              </section>
            )}

            {currentStyle && (
              <label className="flex items-center justify-between gap-3 border-t border-line pt-3 text-xs text-ink-muted">
                <span>顯示所有功能（進階）</span>
                <input
                  type="checkbox"
                  checked={showAllFeatures}
                  onChange={(e) => onShowAllFeaturesChange(e.target.checked)}
                  className="h-4 w-4 shrink-0 accent-accent"
                />
              </label>
            )}
          </div>
        )}

        {activeTab === "caption" && (
          <div className="flex flex-col gap-3">
            <label className="flex items-center justify-between gap-3 rounded-md border border-line bg-surface-2 px-3 py-1.5 text-xs text-ink-muted md:py-2">
                <span className="flex flex-col gap-0.5">
                  <span className="font-medium text-ink">顯示文案區塊</span>
                  <Desc>關閉後色塊和文字都不顯示，照片鋪滿整張畫布，只剩拼貼編輯</Desc>
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
            {(features.captionPosition || features.captionSize) && (
            <section className="flex flex-col gap-3">
              <SectionTitle>文案區塊</SectionTitle>
              {features.captionPosition && (
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
              )}
              {features.captionSize && (
                <div className="flex flex-col gap-2">
                  <span className="flex justify-between text-xs text-ink-muted">
                    <span>文案區塊大小</span>
                    <span>{Math.round(captionFractionValue * 100)}%</span>
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    {CAPTION_SIZES.map((opt) => (
                      <button
                        key={opt.label}
                        type="button"
                        onClick={() => onDecorChange({ captionFraction: opt.value })}
                        className={`rounded-md border px-2 py-1.5 text-xs font-medium transition ${
                          Math.abs(captionFractionValue - opt.value) < 0.02
                            ? "border-accent bg-accent-soft text-accent"
                            : "border-line bg-surface-2 text-ink-muted"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <input
                    type="range"
                    min={20}
                    max={100}
                    step={5}
                    value={Math.round(captionFractionValue * 100)}
                    onChange={(e) => onDecorChange({ captionFraction: Number(e.target.value) / 100 })}
                  />
                  <span className="text-[11px] text-ink-faint">色塊太高壓到照片時，選「小」；拉到 100% 整張都是紙</span>
                </div>
              )}
            </section>
            )}
                {features.captionMode && (
                <div className="flex flex-col gap-2">
                  <span className="text-xs text-ink-muted">文字排法</span>
                  <Segmented<CaptionMode>
                    options={[
                      { id: "flow", label: "一般排列" },
                      { id: "corner", label: "角落小字" },
                      { id: "scatter", label: "散落單字" },
                    ]}
                    value={decor.captionMode}
                    onChange={(id) => onDecorChange({ captionMode: id })}
                  />
                  {decor.captionMode === "scatter" && (
                    <button
                      type="button"
                      onClick={onShuffleWords}
                      className="rounded-md border border-line bg-surface-2 px-3 py-1.5 text-xs font-medium text-ink-muted hover:text-ink"
                    >
                      重新散落（也可以直接在畫布上拖曳單字）
                    </button>
                  )}
                  {decor.captionMode === "scatter" && (
                    <label className="flex items-center justify-between gap-3 text-xs text-ink-muted">
                      <span>文字轉 90° 直排（圓點在前）</span>
                      <input
                        type="checkbox"
                        checked={decor.scatterVertical}
                        onChange={(e) => onDecorChange({ scatterVertical: e.target.checked })}
                        className="h-4 w-4 shrink-0 accent-accent"
                      />
                    </label>
                  )}
                </div>
                )}

                {(
                <label className="flex items-center justify-between gap-3 rounded-md border border-line bg-surface-2 px-3 py-1.5 text-xs text-ink-muted md:py-2">
                  <span className="flex flex-col gap-0.5">
                    <span className="font-medium text-ink">顯示文字</span>
                    <Desc>關閉後只藏起文字，色塊和圖形都還在</Desc>
                  </span>
                  <input
                    type="checkbox"
                    checked={decor.showCaptionText}
                    onChange={(e) => onDecorChange({ showCaptionText: e.target.checked })}
                    className="h-4 w-4 shrink-0 accent-accent"
                  />
                </label>
                )}

                {features.windows && decor.captionMode === "flow" && (
                <label className="flex items-center justify-between gap-3 rounded-md border border-line bg-surface-2 px-3 py-1.5 text-xs text-ink-muted md:py-2">
                  <span className="flex flex-col gap-0.5">
                    <span className="font-medium text-ink">文字旁顯示圖形窗口</span>
                    <Desc>
                      {shapesEnabled ? "圖形會以小照片窗口的樣子穿插在文字之間" : "需要先到「圖形」分頁開啟「顯示圖形」"}
                    </Desc>
                  </span>
                  <input
                    type="checkbox"
                    checked={decor.inlineWindows}
                    disabled={!shapesEnabled}
                    onChange={(e) => onDecorChange({ inlineWindows: e.target.checked })}
                    className="h-4 w-4 shrink-0 accent-accent disabled:opacity-40"
                  />
                </label>
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
                  rows={4}
                  className={`w-full resize-none ${fieldClass}`}
                />

                <section className="flex flex-col gap-3 border-t border-line pt-3">
                  <SectionTitle>文字樣式</SectionTitle>
            <div className={`grid gap-3 ${showBrackets ? "grid-cols-2" : "grid-cols-1"}`}>
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
              {showBrackets && (
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
              )}
            </div>
            <label className="grid grid-cols-[5.5rem_1fr_3rem] items-center gap-2 text-xs text-ink-muted"><span>字級</span><input
                type="range"
                min={12}
                max={28}
                value={baseFontSizePx}
                onChange={(e) => onFontSizeChange(Number(e.target.value))}
              /><span className="text-right tabular-nums">{baseFontSizePx}px</span></label>
            {decor.captionMode === "flow" && (
            <>
            <label className="grid grid-cols-[5.5rem_1fr_3rem] items-center gap-2 text-xs text-ink-muted"><span>行距</span><input
                type="range"
                min={1}
                max={2.2}
                step={0.1}
                value={lineHeightMultiplier}
                onChange={(e) => onLineHeightChange(Number(e.target.value))}
              /><span className="text-right tabular-nums">{lineHeightMultiplier.toFixed(1)}</span></label>
            <label className="grid grid-cols-[5.5rem_1fr_3rem] items-center gap-2 text-xs text-ink-muted"><span>字距</span><input
                type="range"
                min={-2}
                max={10}
                value={letterSpacingPx}
                onChange={(e) => onLetterSpacingChange(Number(e.target.value))}
              /><span className="text-right tabular-nums">{letterSpacingPx}px</span></label>
            </>
            )}
            <ColorField label="文字顏色" value={textColor} onChange={onTextColorChange} />
                </section>
              </>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
