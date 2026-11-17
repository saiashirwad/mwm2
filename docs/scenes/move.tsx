import { render } from "svjeez";
import { Script, Stage, css, editor, screen, terminal } from "./parts";

const desk = screen(20, 20, 480, 270);
const s = new Script(
  [desk],
  [
    {
      id: "editor",
      frame: { x: 300, y: 70, w: 172, h: 140 },
      title: "Geometry.swift",
      body: editor(["func snapped(", "  _ frame: CGRect,", "  to targets: [CGRect]", ") -> CGRect {", "  let reach = 10", "  …"]),
    },
    {
      id: "term",
      frame: { x: 64, y: 150, w: 214, h: 112 },
      title: "zsh",
      body: terminal([["make install"], ["✓ installed mwm2.app", "ok"], ["git status"], ["nothing to commit", ""], [""]]),
    },
  ],
  { x: 430, y: 250 },
);

s.wait(0.4)
  .go({ x: 150, y: 222 }, 0.8, 30)
  .say("Hold left ⌥ and drag from anywhere in a window.")
  .down("opt").wait(0.3)
  .down("left").wait(0.15)
  .go({ x: 166, y: 214 }, 0.9)
  .say("Edges snap to other windows…")
  .wait(0.25)
  .go({ x: 170, y: 212 }, 0.3)
  .wait(0.3)
  .go({ x: 112, y: 192 }, 1.1, -10)
  .say("…and to the screen.")
  .wait(0.35)
  .up("left").wait(0.1)
  .up("opt")
  .wait(0.4)
  .go({ x: 430, y: 250 }, 0.9, 20)
  .wait(0.6)
  .hush();


export const duration = Math.ceil((s.t + 0.6) * 2) / 2;

export default () =>
  render(
    { width: 520, height: 374, duration, title: "mwm2: move", desc: "Holding Left Option, the cursor drags a terminal by its contents toward an editor. It snaps flush against the editor's edge, then against the screen's left edge.", css, reducedMotion: { at: 3 } },
    <Stage s={s} duration={duration} width={520} />,
  );
