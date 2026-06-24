import { type Asset, type ReviewState } from "../lib";

/* Shared wiring passed from the page to each view so they can render AssetCards
   without threading a dozen callbacks individually. */
export interface CardCtx {
  stateMeta: (key: string | null) => ReviewState | null;
  isSelected: (id: number) => boolean;
  isInspected: (id: number) => boolean;
  selectMode: boolean;
  onInspect: (a: Asset) => void;
  onOpen: (a: Asset) => void;
  onToggleSelect: (a: Asset, shift: boolean) => void;
  onContextMenu: (e: React.MouseEvent, a: Asset) => void;
  onDragStart: (e: React.DragEvent, a: Asset) => void;
}

export function cardProps(a: Asset, ctx: CardCtx) {
  return {
    asset: a,
    state: ctx.stateMeta(a.review_state),
    inspected: ctx.isInspected(a.id),
    selected: ctx.isSelected(a.id),
    selectMode: ctx.selectMode,
    onInspect: () => ctx.onInspect(a),
    onOpen: () => ctx.onOpen(a),
    onToggleSelect: (shift: boolean) => ctx.onToggleSelect(a, shift),
    onContextMenu: (e: React.MouseEvent) => ctx.onContextMenu(e, a),
    onDragStart: (e: React.DragEvent) => ctx.onDragStart(e, a),
  };
}
