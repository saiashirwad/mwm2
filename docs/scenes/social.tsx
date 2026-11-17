import { def, render } from "svjeez";
import { Script, Stage, T, css, editor, notes, screen, terminal } from "./parts";

// The GitHub social preview: one still from a drag, taken the moment a window reaches the
// screen's right edge and mwm2 previews the tile. Rendered to PNG by `make social`.
const desk = screen(20, 20, 480, 270);
const s = new Script(
  [desk],
  [
    {
      id: "code",
      frame: { x: 36, y: 46, w: 196, h: 124 },
      title: "Geometry.swift",
      body: editor(["func tile(at point: CGPoint)", "  -> CGRect? {", "  let margin = 3", "  guard left || right", "  …"]),
    },
    {
      id: "term",
      frame: { x: 36, y: 170, w: 214, h: 106 },
      title: "zsh",
      body: terminal([["make install"], ["✓ installed mwm2.app", "ok"], ["git status"], ["nothing to commit", ""], [""]]),
    },
    { id: "notes", frame: { x: 250, y: 70, w: 170, h: 116 }, title: "Notes", body: notes("Today", ["Ship mwm2", "Record demos", "Write README"]) },
  ],
  { x: 330, y: 130 },
);
s.down("opt").wait(0.1).down("left").wait(0.1).go({ x: 499, y: 150 }, 1).wait(0.5).up("left").up("opt").wait(0.4);

export const still = 1.6;
export const duration = Math.ceil(s.t * 2) / 2;

export default () => {
  const wash = def.radialGradient(
    { cx: 0.25, cy: 0.35, r: 0.9 },
    <>
      <stop offset={0} stopColor={T.base0D} stopOpacity={0.18} />
      <stop offset={1} stopColor={T.base0D} stopOpacity={0} />
    </>,
  );
  const sans = "-apple-system, 'SF Pro Display', system-ui, sans-serif";
  return render(
    {
      width: 1280,
      height: 640,
      duration,
      title: "mwm2",
      desc: "mwm2: smoother window moving and resizing for macOS. A window held with Left Option is dragged to the screen's edge, and an outline previews the half it will tile to.",
      css,
      reducedMotion: { at: still },
    },
    <>
      <rect width={1280} height={640} fill={T.base00} />
      <rect width={1280} height={640} fill={wash} />
      <g transform="translate(56 72) scale(1.4)">
        <Stage s={s} duration={duration} background={false} />
      </g>
      <text x={812} y={286} fontFamily={sans} fontSize={112} fontWeight={700} letterSpacing={-3} fill={T.base07}>
        mwm2
      </text>
      <text x={816} y={346} fontFamily={sans} fontSize={30} fontWeight={500} fill={T.base05}>
        <tspan x={816}>Smoother window moving</tspan>
        <tspan x={816} dy={40}>and resizing for macOS.</tspan>
      </text>
      <text x={816} y={448} fontFamily={sans} fontSize={22} fill={T.base04}>
        Hold left ⌥ and drag. Snap, tile, resize.
      </text>
    </>,
  );
};
