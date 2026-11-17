import { render } from "svjeez";
import { Script, Stage, css, editor, notes, screen, terminal } from "./parts";

const left = screen(20, 20, 340, 220);
const right = screen(360, 20, 340, 220);
const s = new Script(
  [left, right],
  [
    { id: "code", frame: { x: 40, y: 120, w: 190, h: 100 }, title: "Geometry.swift", body: editor(["func tile(at point: CGPoint)", "  -> CGRect? {", "  let margin = 3", "  guard left || right", "  …"]) },
    { id: "term", frame: { x: 140, y: 50, w: 190, h: 100 }, title: "zsh", body: terminal([["make install"], ["✓ installed mwm2.app", "ok"], ["git status"], ["nothing to commit", ""], [""]]) },
  ],
  { x: 620, y: 200 },
);

s.wait(0.4)
  .go({ x: 240, y: 110 }, 0.8, 20)
  .say("Drag between displays. The edge they share doesn't tile.")
  .down("opt").wait(0.2).down("left").wait(0.1)
  .go({ x: 360, y: 104 }, 0.8)
  .wait(0.6)
  .go({ x: 520, y: 120 }, 0.8)
  .say("Outer edges do.")
  .go({ x: 699, y: 130 }, 0.7)
  .wait(0.5).up("left").up("opt").wait(0.6)
  .say("Resizes stop at their own display.")
  .go({ x: 180, y: 190 }, 0.9, 30)
  .down("opt").wait(0.2).down("right").wait(0.1)
  .go({ x: 470, y: 225 }, 1.2)
  .wait(0.5).up("right").up("opt").wait(0.6)
  .go({ x: 620, y: 200 }, 0.8).wait(0.4).hush();

export const duration = Math.ceil((s.t + 0.6) * 2) / 2;

export default () =>
  render(
    { width: 720, height: 324, duration, title: "mwm2: two displays", desc: "Two displays side by side. Holding Left Option, a terminal is dragged across the edge the displays share without tiling, then dropped on the right display's outer edge to tile to its right half. A resize dragged toward the other display stops at the window's own display.", css, reducedMotion: { at: 3 } },
    <Stage s={s} duration={duration} width={720} />,
  );
