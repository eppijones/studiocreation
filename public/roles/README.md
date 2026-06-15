# Role tile art

The "Pick a role" grid in **Create** wears each role's own work. Per tile, the
face is resolved in this order (see `RoleArt` in `app/create/page.tsx`):

1. **Live** — the studio's highest-scoring keeper rendered under that role
   (approved / delivered, or score ≥ 8). Accumulates automatically as you work;
   every render now tags itself with its role (`jobs.params->>'role'`).
2. **Curated** — a hand-picked still dropped here as `<role-id>.webp`
   (or `.jpg`). This is the seed face before the studio has a keeper.
3. **Mesh** — the per-role gradient fallback. Never broken, just generic.

## Drop a curated still

Name the file exactly after the role id, portrait-ish (4:5 crops best):

```
public/roles/concept-artist.webp
public/roles/graphic-designer.webp
public/roles/premium-motion-designer.webp
public/roles/product-photographer.webp
public/roles/keynote-designer.webp
public/roles/audio-engineer.webp
public/roles/some-strategist.webp
public/roles/video-editor.webp
public/roles/upscaler.webp
```

On-brand move: generate these once with the studio's own pipeline (a single
hero still per role at delivery quality) so the grid is a self-portrait, not
stock. Until then the mesh fallback carries the empty state.
