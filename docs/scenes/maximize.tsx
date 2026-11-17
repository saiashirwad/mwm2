import { render } from "svjeez";
import { Script, Stage, css, editor, notes, screen, terminal } from "./parts";

const desk = screen(20, 20, 480, 270);
const s = new Script(
  [desk],
  [
    { id: "term", frame: { x: 44, y: 150, w: 200, h: 112 }, title: "zsh", body: terminal([["make install"], ["✓ installed mwm2.app", "ok"], ["git status"], ["nothing to commit", ""], [""]]) },
    { id: "code", frame: { x: 200, y: 64, w: 210, h: 130 }, title: "Geometry.swift", body: editor(["func tile(at point: CGPoint)", "  -> CGRect? {", "  let margin = 3", "  guard left || right", "  …"]) },
  ],
  { x: 430, y: 250 },
);

s.wait(0.4)
  .go({ x: 310, y: 150 }, 0.8, 20)
  .say("Double-click to fill the screen.")
  .down("opt").wait(0.25)
  .tap("left", 0.1).wait(0.1).tap("left", 0.1)
  .wait(1.4)
  .say("Again to put it back.")
  .tap("left", 0.1).wait(0.1).tap("left", 0.1)
  .wait(0.4).up("opt")
  .wait(0.8)
  .go({ x: 430, y: 250 }, 0.8, -20)
  .wait(0.4).hush();

export const duration = Math.ceil((s.t + 0.6) * 2) / 2;

export default () =>
  render(
    { width: 520, height: 374, duration, title: "mwm2: maximize", desc: "Holding Left Option, a double-click anywhere in a window fills the screen below the menu bar, and another double-click puts it back where it was.", css, reducedMotion: { at: 3 } },
    <Stage s={s} duration={duration} width={520} />,
  );
