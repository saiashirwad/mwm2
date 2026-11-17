import { render } from "svjeez";
import { Script, Stage, css, editor, notes, screen, terminal } from "./parts";

const desk = screen(20, 20, 480, 270);
const s = new Script(
  [desk],
  [{ id: "notes", frame: { x: 140, y: 90, w: 200, h: 130 }, title: "Notes", body: notes("Today", ["Ship mwm2", "Record demos", "Write README"]) }],
  { x: 440, y: 260 },
);

s.wait(0.4)
  .go({ x: 240, y: 170 }, 0.7, 20)
  .say("Escape puts a dragged window back.")
  .down("opt").wait(0.2).down("left").wait(0.1)
  .go({ x: 340, y: 230 }, 0.9, -15)
  .wait(0.3).tap("esc", 0.15).wait(0.3)
  .go({ x: 360, y: 240 }, 0.4)
  .up("left").up("opt").wait(0.6)
  .say("The other button drops a resize.")
  .go({ x: 300, y: 190 }, 0.5)
  .down("opt").wait(0.2).down("right").wait(0.1)
  .go({ x: 400, y: 260 }, 0.9)
  .wait(0.3).tap("left", 0.15).wait(0.3)
  .up("right").up("opt").wait(0.5)
  .go({ x: 440, y: 260 }, 0.6).wait(0.5).hush();

export const duration = Math.ceil((s.t + 0.6) * 2) / 2;

export default () =>
  render(
    { width: 520, height: 374, duration, title: "mwm2: cancel", desc: "Holding Left Option, the cursor drags a window and presses Escape, and the window goes back. Then it starts a resize and presses the left button, and the outline disappears with the window unchanged.", css, reducedMotion: { at: 3 } },
    <Stage s={s} duration={duration} width={520} esc />,
  );
