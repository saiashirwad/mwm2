import { render } from "svjeez";
import { Script, Stage, css, editor, notes, screen, terminal } from "./parts";

const left = screen(20, 20, 450, 280);
const right = screen(470, 20, 450, 280);
const s = new Script(
  [left, right],
  [
    { id: "code", frame: { x: 296, y: 64, w: 160, h: 130 }, title: "Geometry.swift", body: editor(["func tile(at point: CGPoint)", "  -> CGRect? {", "  let margin = 3", "  guard left || right", "  …"]) },
    { id: "notes", frame: { x: 580, y: 100, w: 190, h: 120 }, title: "Notes", body: notes("Today", ["Ship mwm2", "Record demos", "Write README"]) },
    { id: "term", frame: { x: 50, y: 160, w: 214, h: 112 }, title: "zsh", body: terminal([["make install"], ["✓ installed mwm2.app", "ok"], ["git status"], ["nothing to commit", ""], [""]]) },
  ],
  { x: 860, y: 260 },
);

const drag = (from: { x: number; y: number }, to: { x: number; y: number }, over = 1, bend = 0) =>
  s.go(from, 0.7, 25).down("opt").wait(0.18).down("left").wait(0.08).go(to, over, bend).wait(0.4).up("left").up("opt").wait(0.35);

s.wait(0.4).say("Hold left ⌥ and drag from anywhere. Edges snap.");
drag({ x: 150, y: 225 }, { x: 180, y: 195 }, 0.9, 10);
s.say("Drop on an outer edge to tile.");
drag({ x: 660, y: 170 }, { x: 919, y: 150 }, 0.9, -20);
s.say("Double-click to maximize, again to restore.")
  .go({ x: 160, y: 205 }, 0.7, 20)
  .down("opt").wait(0.2)
  .tap("left", 0.09).wait(0.09).tap("left", 0.09)
  .wait(1)
  .tap("left", 0.09).wait(0.09).tap("left", 0.09)
  .wait(0.3).up("opt").wait(0.3)
  .say("Right-drag to resize. It stays on its screen.")
  .go({ x: 230, y: 215 }, 0.5)
  .down("opt").wait(0.18).down("right").wait(0.08)
  .go({ x: 560, y: 262 }, 1.2)
  .wait(0.4).up("right").up("opt").wait(0.4)
  .say("Escape cancels.")
  .go({ x: 800, y: 160 }, 0.9, -20)
  .down("opt").wait(0.18).down("left").wait(0.08)
  .go({ x: 690, y: 230 }, 0.8)
  .wait(0.2).tap("esc", 0.14).wait(0.3)
  .up("left").up("opt").wait(0.4)
  .go({ x: 860, y: 260 }, 0.9, 30)
  .wait(0.4).hush();

export const duration = Math.ceil((s.t + 0.6) * 2) / 2;

export default () =>
  render(
    { width: 940, height: 384, duration, title: "mwm2", desc: "Two displays. Holding Left Option, a terminal is dragged by its contents and snaps to an editor, a notes window is dropped on the right display's outer edge and tiles to its right half, the terminal is maximized and restored with double-clicks, resized toward the other display while its outline stops at its own screen, and a drag of the notes window is cancelled with Escape.", css, reducedMotion: { at: 3 } },
    <Stage s={s} duration={duration} width={940} esc />,
  );
