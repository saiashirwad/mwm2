import {
  adaptive,
  def,
  ease,
  easeAt,
  fx,
  motion,
  sampled,
  show,
  span,
  systemDark,
  systemLight,
  type Color,
  type Ease,
  type Spanned,
  type SvgNode,
} from "svjeez";

// The scenes simulate mwm2 rather than animate it: a script of cursor moves and key presses is replayed
// through a port of DragController and Geometry, and every window, outline and tile preview is sampled from
// that replay. So nothing moves that mwm2 would not move, and nothing glides that mwm2 sets in one step.

export const { theme: T, css: themeCss } = adaptive({ dark: systemDark, light: systemLight });

export type Frame = { x: number; y: number; w: number; h: number };
export type Point = { x: number; y: number };
export type Screen = { frame: Frame; visible: Frame };
type Key = "opt" | "left" | "right" | "esc";
type Edges = { left: boolean; right: boolean; top: boolean; bottom: boolean };

// Geometry.swift and DragController.swift, at half scale where a constant is a size.
const SNAP = 10;
const MARGIN = 3;
const LATCH = 4;
const MIN = { w: 80, h: 45 };
const DOUBLE_TIME = 0.5;
const DOUBLE_DISTANCE = 5;
const MENU_BAR = 14;

export const screen = (x: number, y: number, w: number, h: number): Screen => ({
  frame: { x, y, w, h },
  visible: { x, y: y + MENU_BAR, w, h: h - MENU_BAR },
});

const maxX = (f: Frame) => f.x + f.w;
const maxY = (f: Frame) => f.y + f.h;
const contains = (f: Frame, p: Point) => p.x >= f.x && p.x < maxX(f) && p.y >= f.y && p.y < maxY(f);
const same = (a: Frame, b: Frame) => a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;
const area = (a: Frame, b: Frame) =>
  Math.max(0, Math.min(maxX(a), maxX(b)) - Math.max(a.x, b.x)) *
  Math.max(0, Math.min(maxY(a), maxY(b)) - Math.max(a.y, b.y));

const screenFor = (f: Frame, screens: Screen[]): Screen | undefined => {
  const best = [...screens].sort((a, b) => area(b.frame, f) - area(a.frame, f))[0];
  return best && area(best.frame, f) > 0 ? best : undefined;
};

const snapped = (f: Frame, targets: Frame[]): Frame => {
  let dx = Infinity;
  let dy = Infinity;
  for (const t of targets) {
    if (f.y < maxY(t) + SNAP && maxY(f) > t.y - SNAP)
      for (const edge of [f.x, maxX(f)])
        for (const line of [t.x, maxX(t)]) if (Math.abs(line - edge) < Math.abs(dx)) dx = line - edge;
    if (f.x < maxX(t) + SNAP && maxX(f) > t.x - SNAP)
      for (const edge of [f.y, maxY(f)])
        for (const line of [t.y, maxY(t)]) if (Math.abs(line - edge) < Math.abs(dy)) dy = line - edge;
  }
  return { ...f, x: f.x + (Math.abs(dx) <= SNAP ? dx : 0), y: f.y + (Math.abs(dy) <= SNAP ? dy : 0) };
};

const tile = (p: Point, screens: Screen[]): Frame | undefined => {
  const s = screens.find((s) => contains(s.frame, p));
  if (!s) return undefined;
  const f = s.frame;
  const v = s.visible;
  const outer = (dx: number, dy: number) => !screens.some((o) => contains(o.frame, { x: p.x + dx, y: p.y + dy }));
  const left = p.x < f.x + MARGIN && outer(-MARGIN, 0);
  const right = p.x >= maxX(f) - MARGIN && outer(MARGIN, 0);
  const top = p.y < f.y + MARGIN && outer(0, -MARGIN);
  const bottom = p.y >= maxY(f) - MARGIN && outer(0, MARGIN);
  if (!(left || right || top || bottom)) return undefined;
  const nearLeft = p.x < f.x + f.w / 5;
  const nearRight = p.x >= maxX(f) - f.w / 5;
  const nearTop = p.y < f.y + f.h / 5;
  const nearBottom = p.y >= maxY(f) - f.h / 5;
  const hw = Math.round(v.w / 2);
  const hh = Math.round(v.h / 2);
  const leftCol = { x: v.x, y: v.y, w: hw, h: v.h };
  const rightCol = { x: v.x + hw, y: v.y, w: v.w - hw, h: v.h };
  const topHalf = (c: Frame) => ({ x: c.x, y: v.y, w: c.w, h: hh });
  const bottomHalf = (c: Frame) => ({ x: c.x, y: v.y + hh, w: c.w, h: v.h - hh });
  if ((left && nearTop) || (top && nearLeft)) return topHalf(leftCol);
  if ((right && nearTop) || (top && nearRight)) return topHalf(rightCol);
  if ((left && nearBottom) || (bottom && nearLeft)) return bottomHalf(leftCol);
  if ((right && nearBottom) || (bottom && nearRight)) return bottomHalf(rightCol);
  if (left) return leftCol;
  if (right) return rightCol;
  if (top) return v;
  return undefined;
};

const resized = (s: Frame, e: Edges, dx: number, dy: number, b: Frame): Frame => {
  let x0 = s.x;
  let x1 = maxX(s);
  let y0 = s.y;
  let y1 = maxY(s);
  if (e.left) x0 = Math.max(Math.min(s.x + dx, x1 - MIN.w), Math.min(b.x, s.x));
  if (e.right) x1 = Math.min(Math.max(maxX(s) + dx, x0 + MIN.w), Math.max(maxX(b), maxX(s)));
  if (e.top) y0 = Math.max(Math.min(s.y + dy, y1 - MIN.h), Math.min(b.y, s.y));
  if (e.bottom) y1 = Math.min(Math.max(maxY(s) + dy, y0 + MIN.h), Math.max(maxY(b), maxY(s)));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
};

const snappedEdges = (f: Frame, e: Edges, targets: Frame[], b: Frame): Frame => {
  const nearest = (edge: number, lines: number[]) =>
    lines.filter((l) => Math.abs(l - edge) <= SNAP).sort((p, q) => Math.abs(p - edge) - Math.abs(q - edge))[0];
  const columns = targets.filter((t) => f.y < maxY(t) + SNAP && maxY(f) > t.y - SNAP).flatMap((t) => [t.x, maxX(t)]);
  const rows = targets.filter((t) => f.x < maxX(t) + SNAP && maxX(f) > t.x - SNAP).flatMap((t) => [t.y, maxY(t)]);
  let x0 = f.x;
  let x1 = maxX(f);
  let y0 = f.y;
  let y1 = maxY(f);
  const l = e.left ? nearest(x0, columns) : undefined;
  if (l !== undefined && l <= x1 - MIN.w && l >= Math.min(b.x, x0)) x0 = l;
  const r = e.right ? nearest(x1, columns) : undefined;
  if (r !== undefined && r >= x0 + MIN.w && r <= Math.max(maxX(b), x1)) x1 = r;
  const t = e.top ? nearest(y0, rows) : undefined;
  if (t !== undefined && t <= y1 - MIN.h && t >= Math.min(b.y, y0)) y0 = t;
  const d = e.bottom ? nearest(y1, rows) : undefined;
  if (d !== undefined && d >= y0 + MIN.h && d <= Math.max(maxY(b), y1)) y1 = d;
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
};

const restored = (w: number, h: number, f: Frame, grab: Point): Frame => {
  const u = (grab.x - f.x) / f.w;
  const v = (grab.y - f.y) / f.h;
  return { x: Math.round(grab.x - u * w), y: Math.round(grab.y - v * h), w, h };
};

const isClose = (a: Frame, b: Frame, tolerance = 10) =>
  Math.abs(a.x - b.x) <= tolerance &&
  Math.abs(a.y - b.y) <= tolerance &&
  Math.abs(maxX(a) - maxX(b)) <= tolerance &&
  Math.abs(maxY(a) - maxY(b)) <= tolerance;

// The script.

type Leg = { at: number; over: number; from: Point; to: Point; bend: number; ease: Ease };
type Press = { t: number; key: Key; down: boolean };
type Session = {
  id: string;
  mode: "move" | "resize" | "inert";
  button: "left" | "right";
  start: Point;
  startT: number;
  frame: Frame;
  targets: Frame[];
  bounds: Frame;
  restore?: Frame;
};
type View = { frames: Record<string, Frame>; overlay?: Frame };

export type WindowSpec = { id: string; frame: Frame; title: string; body: (w: number) => SvgNode };

const glide = ease.bezier(0.5, 0, 0.2, 1);

export class Script {
  t = 0;
  readonly legs: Leg[] = [];
  readonly presses: Press[] = [];
  readonly captions: { text: string; at: number; end: number }[] = [];
  private cursor: Point;

  constructor(
    readonly screens: Screen[],
    readonly windows: WindowSpec[],
    readonly home: Point,
  ) {
    this.cursor = home;
  }

  wait(seconds: number): this {
    this.t += seconds;
    return this;
  }

  /** Moves the cursor in an arc; `bend` pushes the middle of the path sideways, in px. */
  go(to: Point, over = 0.7, bend = 0, curve: Ease = glide): this {
    this.legs.push({ at: this.t, over, from: this.cursor, to, bend, ease: curve });
    this.cursor = to;
    this.t += over;
    return this;
  }

  down(key: Key): this {
    this.presses.push({ t: this.t, key, down: true });
    return this;
  }

  up(key: Key): this {
    this.presses.push({ t: this.t, key, down: false });
    return this;
  }

  tap(key: Key, hold = 0.12): this {
    return this.down(key).wait(hold).up(key);
  }

  say(text: string): this {
    const last = this.captions.at(-1);
    if (last && last.end === Infinity) last.end = this.t;
    this.captions.push({ text, at: this.t, end: Infinity });
    return this;
  }

  hush(): this {
    const last = this.captions.at(-1);
    if (last && last.end === Infinity) last.end = this.t;
    return this;
  }

  cursorAt(t: number): Point {
    let p = this.home;
    for (const leg of this.legs) {
      if (t < leg.at) break;
      const u = easeAt(leg.ease, (t - leg.at) / leg.over);
      const dx = leg.to.x - leg.from.x;
      const dy = leg.to.y - leg.from.y;
      const len = Math.hypot(dx, dy) || 1;
      const arc = 4 * u * (1 - u) * leg.bend;
      p = { x: leg.from.x + dx * u - (dy / len) * arc, y: leg.from.y + dy * u + (dx / len) * arc };
    }
    return p;
  }

  held(key: Key): Spanned[] {
    const spans: Spanned[] = [];
    let start: number | undefined;
    for (const p of this.presses.filter((p) => p.key === key)) {
      if (p.down) start = p.t;
      else if (start !== undefined) {
        spans.push(span(start, Math.max(p.t - start, 0.01)));
        start = undefined;
      }
    }
    return spans;
  }

  /** Replays every press up to `t` through mwm2's drag logic. */
  view(t: number): View {
    const frames: Record<string, Frame> = Object.fromEntries(this.windows.map((w) => [w.id, w.frame]));
    const order = this.windows.map((w) => w.id);
    const held = new Set<Key>();
    const placements = new Map<string, { placed: Frame; restore: Frame }>();
    let lastClick: { t: number; p: Point } | undefined;
    let session: Session | undefined;

    const edgesAt = (s: Session, now: number): Edges => {
      const e: Edges = { left: false, right: false, top: false, bottom: false };
      for (let u = s.startT; u <= now + 1e-9; u += 1 / 240) {
        const p = this.cursorAt(Math.min(u, now));
        const dx = p.x - s.start.x;
        const dy = p.y - s.start.y;
        if (!e.left && !e.right && Math.abs(dx) >= LATCH) {
          e.right = s.start.x >= s.frame.x + s.frame.w / 2;
          e.left = !e.right;
        }
        if (!e.top && !e.bottom && Math.abs(dy) >= LATCH) {
          e.bottom = s.start.y >= s.frame.y + s.frame.h / 2;
          e.top = !e.bottom;
        }
      }
      return e;
    };

    // Whether the pointer has left the press point yet, which is when a placed window pulls free.
    const moved = (s: Session, now: number): boolean => {
      for (let u = s.startT; u <= now + 1e-9; u += 1 / 240) {
        const p = this.cursorAt(Math.min(u, now));
        if (Math.abs(p.x - s.start.x) >= 0.5 || Math.abs(p.y - s.start.y) >= 0.5) return true;
      }
      return false;
    };

    const live = (s: Session, now: number): Frame => {
      const p = this.cursorAt(now);
      const dx = p.x - s.start.x;
      const dy = p.y - s.start.y;
      if (s.mode === "move") {
        if (!moved(s, now)) return s.frame;
        const base = s.restore ? restored(s.restore.w, s.restore.h, s.frame, s.start) : s.frame;
        return snapped({ ...base, x: base.x + dx, y: base.y + dy }, s.targets);
      }
      if (s.mode === "resize") {
        const e = edgesAt(s, now);
        return snappedEdges(resized(s.frame, e, dx, dy, s.bounds), e, s.targets, s.bounds);
      }
      return s.frame;
    };

    const begin = (button: "left" | "right", now: number) => {
      const p = this.cursorAt(now);
      if (!held.has("opt")) return;
      const id = [...order].reverse().find((id) => contains(frames[id]!, p));
      if (!id) return;
      const frame = frames[id]!;
      const placement = placements.get(id);
      if (placement && !isClose(frame, placement.placed)) placements.delete(id);
      let mode: Session["mode"] = button === "left" ? "move" : "resize";
      if (button === "left") {
        const double =
          lastClick && now - lastClick.t <= DOUBLE_TIME && Math.hypot(p.x - lastClick.p.x, p.y - lastClick.p.y) <= DOUBLE_DISTANCE;
        lastClick = double ? undefined : { t: now, p };
        if (double) {
          const s = screenFor(frame, this.screens);
          if (s) {
            const previous = placements.get(id);
            if (previous && isClose(frame, s.visible)) {
              frames[id] = previous.restore;
              placements.delete(id);
            } else {
              placements.set(id, { placed: s.visible, restore: previous?.restore ?? frame });
              frames[id] = s.visible;
            }
          }
          mode = "inert";
        }
      }
      session = {
        id,
        mode,
        button,
        start: p,
        startT: now,
        frame: frames[id]!,
        targets: [...this.screens.map((s) => s.visible), ...order.filter((o) => o !== id).map((o) => frames[o]!)],
        bounds: screenFor(frame, this.screens)?.visible ?? { x: -1e6, y: -1e6, w: 2e6, h: 2e6 },
        restore: placements.get(id)?.restore,
      };
    };

    const finish = (now: number) => {
      const s = session!;
      session = undefined;
      const f = live(s, now);
      if (!same(f, s.frame)) lastClick = undefined;
      if (s.mode === "move") {
        const t = tile(this.cursorAt(now), this.screens);
        if (t) placements.set(s.id, { placed: t, restore: placements.get(s.id)?.restore ?? s.frame });
        else if (!same(f, s.frame)) placements.delete(s.id);
        frames[s.id] = t ?? f;
      }
      if (s.mode === "resize") {
        if (!same(f, s.frame)) placements.delete(s.id);
        frames[s.id] = f;
      }
    };

    const cancel = () => {
      if (session) session = { ...session, mode: "inert" };
    };

    for (const press of [...this.presses].sort((a, b) => a.t - b.t)) {
      if (press.t > t) break;
      const { key, down, t: now } = press;
      if (key === "opt" || key === "esc") {
        if (down) held.add(key);
        else held.delete(key);
        if (key === "esc" && down) cancel();
        continue;
      }
      if (down) {
        if (session && session.button !== key) cancel();
        else {
          if (session) finish(now);
          begin(key, now);
        }
      } else if (session && session.button === key) finish(now);
    }

    if (session && session.mode === "move") {
      frames[session.id] = live(session, t);
      return { frames, overlay: tile(this.cursorAt(t), this.screens) };
    }
    if (session && session.mode === "resize") return { frames, overlay: live(session, t) };
    return { frames };
  }
}

// Drawing.

const sans = "system-ui, -apple-system, sans-serif";
const mono = "ui-monospace, SFMono-Regular, Menlo, monospace";
const STEP = 1 / 60;
const BAR = 22;

const sample = <V extends Record<string, number>>(s: Script, duration: number, fn: (t: number) => V, tolerance: number) =>
  sampled({ at: 0, over: duration }, fn as unknown as (t: number) => { x: number }, {
    tolerance: { translate: tolerance, width: tolerance, height: tolerance, opacity: 0.4, scale: 0.01 },
    step: STEP,
    precision: 1,
  } as never);

const shadow = fx.shadow({ dy: 5, blur: 9, opacity: 0.35 });

function Desktop({ s }: { s: Screen }): SvgNode {
  const f = s.frame;
  const wall = def.linearGradient(
    { x1: 0, y1: 0, x2: 1, y2: 1 },
    <>
      <stop offset={0} stopColor={T.base0D} stopOpacity={0.16} />
      <stop offset={0.55} stopColor={T.base0E} stopOpacity={0.07} />
      <stop offset={1} stopColor={T.base0C} stopOpacity={0.12} />
    </>,
  );
  return (
    <g>
      <rect x={f.x} y={f.y} width={f.w} height={f.h} fill={T.base01} />
      <rect x={f.x} y={f.y} width={f.w} height={f.h} fill={wall} />
      <rect x={f.x} y={f.y} width={f.w} height={MENU_BAR} fill={T.base02} fillOpacity={0.55} />
      <circle cx={f.x + 11} cy={f.y + 7} r={2.6} fill={T.base04} />
      {[24, 50, 72, 94].map((dx, i) => (
        <rect x={f.x + dx} y={f.y + 5} width={i === 0 ? 18 : 14} height={4} rx={2} fill={T.base03} />
      ))}
      <rect x={f.x + f.w - 34} y={f.y + 5} width={24} height={4} rx={2} fill={T.base03} />
    </g>
  );
}

function Window({ s, spec, duration }: { s: Script; spec: WindowSpec; duration: number }): SvgNode {
  const at = (t: number) => s.view(t).frames[spec.id]!;
  const size = sample(s, duration, (t) => ({ width: at(t).w, height: at(t).h }), 0.5);
  const clip = def.clipPath({}, <rect width={spec.frame.w} height={spec.frame.h} rx={8} animation={size} />);
  return (
    <g animation={sample(s, duration, (t) => ({ x: at(t).x, y: at(t).y }), 0.5)}>
      <rect width={spec.frame.w} height={spec.frame.h} rx={8} fill={T.base00} filter={shadow} animation={size} />
      <g clipPath={clip}>
        <rect y={BAR} width={spec.frame.w} height={1} fill={T.base02} animation={sample(s, duration, (t) => ({ width: at(t).w }), 0.5)} />
        {[0, 1, 2].map((i) => (
          <circle cx={12 + i * 11} cy={BAR / 2} r={3.5} fill={(["#FF5F57", "#FEBC2E", "#28C840"] as const)[i]} />
        ))}
        <text x={50} y={BAR / 2 + 3.5} fontFamily={sans} fontSize={10} fill={T.base04}>
          {spec.title}
        </text>
        <g transform={`translate(0 ${BAR})`}>{spec.body(spec.frame.w)}</g>
      </g>
      <rect width={spec.frame.w} height={spec.frame.h} rx={8} fill="none" stroke={T.base03} strokeOpacity={0.45} animation={size} />
    </g>
  );
}

/** mwm2's overlay: an accent outline with a 12% fill, shown and hidden in one step. */
function Overlay({ s, duration }: { s: Script; duration: number }): SvgNode {
  let last: Frame = { x: 0, y: 0, w: 10, h: 10 };
  const frames = new Map<number, Frame | undefined>();
  const at = (t: number) => {
    const key = Math.round(t * 1000);
    if (!frames.has(key)) frames.set(key, s.view(t).overlay);
    return frames.get(key);
  };
  const steady = (t: number) => {
    const f = at(t);
    if (f) last = f;
    return last;
  };
  // Hidden frames hold the last shown frame, so the outline never flies between gestures.
  const held: Frame[] = [];
  for (let t = 0; t <= duration + 1e-9 && !at(t); t += STEP) last = at(t + STEP) ?? last;
  for (let t = 0; t <= duration + 1e-9; t += STEP) held.push(steady(t));
  const near = (t: number) => held[Math.min(held.length - 1, Math.round(t / STEP))]!;
  return (
    <g
      animation={[
        sample(s, duration, (t) => ({ opacity: at(t) ? 1 : 0 }), 0.5),
        sample(s, duration, (t) => ({ x: near(t).x, y: near(t).y }), 0.5),
      ]}
    >
      <rect
        width={10}
        height={10}
        rx={8}
        fill={T.base0D}
        fillOpacity={0.12}
        stroke={T.base0D}
        strokeWidth={2}
        animation={sample(s, duration, (t) => ({ width: near(t).w, height: near(t).h }), 0.5)}
      />
    </g>
  );
}

function Cursor({ s, duration }: { s: Script; duration: number }): SvgNode {
  const presses = [...s.presses].filter((p) => p.down && (p.key === "left" || p.key === "right"));
  const pressed: Spanned[] = [];
  for (const p of [...s.held("left"), ...s.held("right")].sort((a, b) => a.at - b.at)) {
    const last = pressed.at(-1);
    if (last && p.at <= last.end) pressed[pressed.length - 1] = last.until(Math.max(last.end, p.end));
    else pressed.push(p);
  }
  let squeeze = motion({ scale: 1 });
  pressed.forEach((p, i) => {
    const next = pressed[i + 1]?.at ?? Infinity;
    squeeze = squeeze
      .to({ scale: 0.86 }, span(p.at, Math.min(0.08, p.over)))
      .to({ scale: 1 }, span(p.end, Math.min(0.14, next - p.end - 0.001)));
  });
  return (
    <g animation={sample(s, duration, (t) => s.cursorAt(t), 0.6)}>
      {presses.map((p) => (
        <circle
          r={12}
          fill="none"
          stroke={p.key === "left" ? T.base0D : T.base0E}
          strokeWidth={2}
          animation={motion({ opacity: 0, scale: 0.4 })
            .set({ opacity: 0.9 }, p.t)
            .to({ opacity: 0, scale: 1.5 }, span(p.t, 0.5))}
        />
      ))}
      <g animation={squeeze}>
        <path d="M0 0V17l4.6-4.4 3.1 6.9 3-1.3-3-6.7h6.4z" fill="#111" stroke="#fff" strokeWidth={1.2} strokeLinejoin="round" />
      </g>
    </g>
  );
}

// The key and the mouse share one material: a soft top-lit face on a darker lip, 40px tall,
// lit with the accent while held. The lip shrinks when a key goes down.
const H = 40;
const LIP = 2.5;
const face = () =>
  def.linearGradient(
    { x1: 0, y1: 0, x2: 0, y2: 1 },
    <>
      <stop offset={0} stopColor={T.base02} />
      <stop offset={1} stopColor={T.base01} />
    </>,
  );
const glow = (color: Color, fade = 1) =>
  def.linearGradient(
    { x1: 0, y1: 0, x2: 0, y2: 1 },
    <>
      <stop offset={0} stopColor={color} />
      <stop offset={1} stopColor={color} stopOpacity={fade} />
    </>,
  );

function KeyCap({ x, y, w, label, glyph, spans }: { x: number; y: number; w: number; label: string; glyph?: string; spans: Spanned[] }): SvgNode {
  let press = motion({ y: 0 });
  for (const sp of spans) press = press.to({ y: LIP - 0.5 }, span(sp.at, 0.06)).to({ y: 0 }, span(sp.end, 0.1));
  const lit = show(spans, { fade: 0.06 });
  const legend = (color: Color) =>
    glyph ? (
      <>
        <text x={w / 2} y={17} textAnchor="middle" fontFamily={sans} fontSize={14} fontWeight={500} fill={color}>
          {glyph}
        </text>
        <text x={w / 2} y={30} textAnchor="middle" fontFamily={sans} fontSize={7.5} letterSpacing={0.4} fill={color}>
          {label}
        </text>
      </>
    ) : (
      <text x={w / 2} y={(H - LIP) / 2 + 3.5} textAnchor="middle" fontFamily={sans} fontSize={10} letterSpacing={0.3} fill={color}>
        {label}
      </text>
    );
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect y={LIP} width={w} height={H - LIP} rx={8} fill={T.base00} stroke={T.base03} strokeOpacity={0.5} />
      <g animation={press}>
        <rect width={w} height={H - LIP} rx={8} fill={face()} stroke={T.base03} strokeOpacity={0.5} />
        <rect width={w} height={H - LIP} rx={8} fill={glow(T.base0D, 0.8)} stroke={T.base0D} animation={lit} />
        <path d={`M8 1.2H${w - 8}`} stroke="#fff" strokeOpacity={0.1} strokeLinecap="round" />
        {legend(T.base04)}
        <g animation={lit}>{legend("#ffffff")}</g>
      </g>
    </g>
  );
}

function Mouse({ x, y, left, right }: { x: number; y: number; left: Spanned[]; right: Spanned[] }): SvgNode {
  const w = 28;
  const shape = def.clipPath({}, <rect width={w} height={H - LIP} rx={w / 2} />);
  const button = (dx: number, spans: Spanned[], color: Color) =>
    spans.length > 0 && <rect x={dx} width={w / 2} height={17} fill={glow(color, 0.75)} animation={show(spans, { fade: 0.05 })} />;
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect y={LIP} width={w} height={H - LIP} rx={w / 2} fill={T.base00} stroke={T.base03} strokeOpacity={0.5} />
      <rect width={w} height={H - LIP} rx={w / 2} fill={face()} />
      <g clipPath={shape}>
        {button(0, left, T.base0D)}
        {button(w / 2, right, T.base0E)}
        <path d={`M0 17H${w}`} stroke={T.base03} strokeOpacity={0.35} />
      </g>
      <path d={`M${w / 2} 0V17`} stroke={T.base03} strokeOpacity={0.6} />
      <path d={`M${w / 2 - 6} 1.2H${w / 2 + 6}`} stroke="#fff" strokeOpacity={0.1} strokeLinecap="round" />
      <rect width={w} height={H - LIP} rx={w / 2} fill="none" stroke={T.base03} strokeOpacity={0.5} />
    </g>
  );
}

function Captions({ s, x, y }: { s: Script; x: number; y: number }): SvgNode {
  return (
    <g>
      {s.captions.map((c) => (
        <text
          x={x}
          y={y}
          fontFamily={sans}
          fontSize={15}
          fill={T.base05}
          animation={[
            show(c.end === Infinity ? { at: c.at } : span(c.at, c.end - c.at), { fade: 0.25 }),
            motion({ x: -6 }).to({ x: 0 }, span(c.at, 0.4)),
          ]}
        >
          {c.text}
        </text>
      ))}
    </g>
  );
}

/** The whole picture: displays, windows, overlay and cursor, and a row of keys and captions under them. */
export function Stage({ s, duration, esc = false, background = true }: { s: Script; duration: number; width?: number; esc?: boolean; background?: boolean }): SvgNode {
  const bottom = Math.max(...s.screens.map((sc) => maxY(sc.frame)));
  const left = Math.min(...s.screens.map((sc) => sc.frame.x));
  const right = Math.max(...s.screens.map((sc) => maxX(sc.frame)));
  const top = Math.min(...s.screens.map((sc) => sc.frame.y));
  const room = def.clipPath({}, <rect x={left} y={top} width={right - left} height={bottom - top} rx={6} />);
  const row = bottom + 26;
  const fade = show(span(0, duration), { fade: 0.35 });
  let overlay = false;
  for (let t = 0; t < duration && !overlay; t += 1 / 30) overlay = !!s.view(t).overlay;
  return (
    <>
      {background && <rect width="100%" height="100%" fill={T.base00} />}
      <g clipPath={room}>
        {s.screens.map((sc) => (
          <Desktop s={sc} />
        ))}
        <g animation={fade}>
          {s.windows.map((w) => (
            <Window s={s} spec={w} duration={duration} />
          ))}
          {overlay && <Overlay s={s} duration={duration} />}
        </g>
      </g>
      {s.screens.slice(1).map((sc) => (
        <rect x={sc.frame.x - 1} y={sc.frame.y} width={2} height={sc.frame.h} fill={T.base00} />
      ))}
      <rect x={left} y={top} width={right - left} height={bottom - top} rx={6} fill="none" stroke={T.base02} strokeWidth={2} />
      <g animation={fade}>
        <Cursor s={s} duration={duration} />
      </g>
      <KeyCap x={left} y={row} w={48} label="option" glyph="⌥" spans={s.held("opt")} />
      <Mouse x={left + 56} y={row} left={s.held("left")} right={s.held("right")} />
      {esc && <KeyCap x={left + 92} y={row} w={40} label="esc" spans={s.held("esc")} />}
      <Captions s={s} x={left + (esc ? 148 : 102)} y={row + 24} />
    </>
  );
}

// Window contents.

export const terminal = (lines: [string, string?][]) => (): SvgNode => (
  <text x={12} y={20} fontFamily={mono} fontSize={10} fill={T.base05} style="white-space: pre">
    {lines.map(([cmd, out], i) =>
      out === undefined ? (
        <tspan x={12} dy={i === 0 ? 0 : 15}>
          <tspan fill={T.base0D}>~/code/mwm2</tspan>
          <tspan fill={T.base0B}> ❯ </tspan>
          {cmd}
        </tspan>
      ) : (
        <tspan x={12} dy={i === 0 ? 0 : 15} fill={out === "ok" ? T.base0B : T.base04}>
          {cmd}
        </tspan>
      ),
    )}
  </text>
);

export const editor = (lines: string[]) => (): SvgNode => (
  <g>
    {lines.map((_, i) => (
      <text x={10} y={20 + i * 14.25} fontFamily={mono} fontSize={8.5} fill={T.base03}>
        {i + 1}
      </text>
    ))}
    <text x={26} y={20} fontFamily={mono} fontSize={9.5} fill={T.base05} style="white-space: pre">
      {lines.map((line, i) => {
        const m = /^(\s*)(func |let |var |return |guard |if )?(.*)$/.exec(line)!;
        return (
          <tspan x={26} dy={i === 0 ? 0 : 14.25}>
            {m[1]}
            {m[2] && <tspan fill={T.base0E}>{m[2]}</tspan>}
            {m[3]}
          </tspan>
        );
      })}
    </text>
  </g>
);

export const notes = (title: string, items: string[]) => (): SvgNode => (
  <g>
    <text x={12} y={22} fontFamily={sans} fontSize={12} fontWeight={600} fill={T.base05}>
      {title}
    </text>
    {items.map((item, i) => (
      <g>
        <circle cx={17} cy={39 + i * 16} r={4} fill="none" stroke={i === 0 ? T.base0B : T.base03} />
        <text x={27} y={42 + i * 16} fontFamily={sans} fontSize={10} fill={T.base04}>
          {item}
        </text>
      </g>
    ))}
  </g>
);

export { themeCss as css };
