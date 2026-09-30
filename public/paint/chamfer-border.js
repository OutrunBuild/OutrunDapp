// Paint Worklet：切角卡「裸切角」描边（v4）。
// 实测（v2/v3）：光栅器对水平条带可产出整行满强度、竖直条带不行——
// 故四条边全部用水平 1 物理像素条带构造：上下边各一条，左右边=逐行堆叠，四边共享同一光栅化路径。
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

      // 填充：切角多边形（对角=裸切）
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
      // 顶边（让开左上切角）：一条水平条带
      ctx.fillRect(q(chamfer), 0, q(w) - q(chamfer), g);
      // 底边（让开右下切角）：一条水平条带
      ctx.fillRect(0, q(h) - g, q(w - chamfer), g);
      // 左右边（让开各自的切角）：逐行水平条带堆叠
      for (let y = q(chamfer); y < q(h) - g / 2; y += g) {
        ctx.fillRect(0, y, g, g); // 左边：上让 TL 切角，下到盒底
      }
      for (let y = 0; y < q(h - chamfer) - g / 2; y += g) {
        ctx.fillRect(q(w) - g, y, g, g); // 右边：上到盒顶，下让 BR 切角
      }
    }
  },
);
