import { render } from "svjeez";
import { Script, Stage, css, editor, notes, screen, terminal } from "./parts";

const desk = screen(20, 20, 480, 270);
const s = new Script(
  [desk],
  [{ id: "code", frame: { x: 150, y: 80, w: 210, h: 140 }, title: "Geometry.swift", body: editor(["func tile(at point: CGPoint)", "  -> CGRect? {", "  let margin = 3", "  guard left || right", "  …"]) }],
  { x: 440, y: 260 },
);

const pull = (from: { x: number; y: number }, to: { x: number; y: number }) =>
  s.go(from, 0.7, 20).down("opt").wait(0.2).down("right").wait(0.1).go(to, 1).wait(0.45).up("right").up("opt").wait(0.5);

s.wait(0.4).say("Right-drag. Grab the right half to move the right edge…");
pull({ x: 320, y: 160 }, { x: 385, y: 160 });
s.say("…or the left half to move the left edge.");
pull({ x: 190, y: 160 }, { x: 245, y: 160 });
s.say("Corners move both. It stays on its screen.");
pull({ x: 395, y: 205 }, { x: 498, y: 288 });
s.go({ x: 440, y: 260 }, 0.6).wait(0.5).hush();

export const duration = Math.ceil((s.t + 0.6) * 2) / 2;

export default () =>
  render(
    { width: 520, height: 374, duration, title: "mwm2: resize", desc: "Holding Left Option, right-dragging the right half of a window moves its right edge, right-dragging the left half moves its left edge, and right-dragging near a corner moves both, stopping at the screen's edge. An outline follows and the window takes its size on release.", css, reducedMotion: { at: 3 } },
    <Stage s={s} duration={duration} width={520} />,
  );
