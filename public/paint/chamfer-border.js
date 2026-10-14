// Paint Worklet: "bare chamfer" border for chamfered cards (v4).
// Measured (v2/v3): the rasterizer can produce full-intensity full rows for horizontal strips but
// not for vertical strips — so all four edges are built from horizontal 1-physical-pixel strips:
// one each for top and bottom, left/right = row-by-row stacking; all four edges share the same
// rasterization path.
registerPaint(
  'chamfer-border',
  class {
    static get inputProperties() {
      return ['--chamfer', '--cb-bg', '--cb-border', '--dpr'];
    }

    static get contextOptions() {
      return { alpha: true };
    }

    paint(ctx, geometry, props) {
      const num = (name, fallback) => {
        const v = props.get(name);
        if (!v) return fallback;
        const n = parseFloat(v.toString());
        return Number.isFinite(n) ? n : fallback;
      };
      const dpr = Math.max(1, num('--dpr', 1));
      const chamfer = num('--chamfer', 8);
      const bg = (props.get('--cb-bg')?.toString() || 'transparent').trim();
      const borderColor = (props.get('--cb-border')?.toString() || 'transparent').trim();
      const w = geometry.width;
      const h = geometry.height;

      const g = 1 / dpr;
      const q = (v) => Math.round(v / g) * g;

      // Fill: chamfered polygon (diagonal = bare chamfer)
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.moveTo(q(chamfer), 0);
      ctx.lineTo(q(w), 0);
      ctx.lineTo(q(w), q(h - chamfer));
      ctx.lineTo(q(w - chamfer), q(h));
      ctx.lineTo(0, q(h));
      ctx.lineTo(0, q(chamfer));
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = borderColor;
      // Top edge (clearing the TL chamfer): one horizontal strip
      ctx.fillRect(q(chamfer), 0, q(w) - q(chamfer), g);
      // Bottom edge (clearing the BR chamfer): one horizontal strip
      ctx.fillRect(0, q(h) - g, q(w - chamfer), g);
      // Left/right edges (clearing their chamfers): row-by-row horizontal strip stacking
      for (let y = q(chamfer); y < q(h) - g / 2; y += g) {
        ctx.fillRect(0, y, g, g); // Left edge: clears the TL chamfer at top, runs to the box bottom
      }
      for (let y = 0; y < q(h - chamfer) - g / 2; y += g) {
        ctx.fillRect(q(w) - g, y, g, g); // Right edge: runs from the box top, clears the BR chamfer at bottom
      }
    }
  },
);
