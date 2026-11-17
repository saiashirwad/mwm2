import { render } from "svjeez";
import { Script, Stage, css, editor, notes, screen, terminal } from "./parts";

const desk = screen(20, 20, 480, 270);
const s = new Script(
  [desk],
  [{ id: "notes", frame: { x: 170, y: 100, w: 180, h: 120 }, title: "Notes", body: notes("Today", ["Ship mwm2", "Record demos", "Write README"]) }],
  { x: 430, y: 250 },
);

const drag = (from: { x: number; y: number }, to: { x: number; y: number }, bend = 0) =>
  s.go(from, 0.7, 20).down("opt").wait(0.2).down("left").wait(0.1).go(to, 1, bend).wait(0.55).up("left").up("opt").wait(0.5);

s.wait(0.4).say("Drop on a side for half the screen.");
drag({ x: 260, y: 180 }, { x: 499, y: 160 }, -20);
s.say("Near a corner for a quarter.");
drag({ x: 300, y: 80 }, { x: 20, y: 46 }, 30);
drag({ x: 220, y: 140 }, { x: 499, y: 285 }, -30);
s.say("On the top edge for all of it.");
drag({ x: 300, y: 185 }, { x: 260, y: 20 }, 20);
s.go({ x: 430, y: 250 }, 0.8, 20).wait(0.6).hush();

export const duration = Math.ceil((s.t + 0.6) * 2) / 2;

export default () =>
  render(
    { width: 520, height: 374, duration, title: "mwm2: tile", desc: "Holding Left Option, the cursor drags a window to the right screen edge and it tiles to the right half, then to the top-left corner for a quarter, the bottom-right corner for another, and the top edge for the whole screen. An outline previews each tile before the drop.", css, reducedMotion: { at: 3 } },
    <Stage s={s} duration={duration} width={520} />,
  );
