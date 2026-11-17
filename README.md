# mwm2

<p align="center">
  <img src="docs/demo.svg" width="100%" alt="Two displays. Holding Left Option, a terminal is dragged and snaps to an editor, a notes window is tiled to the right half of the right display, the terminal is maximized and restored, resized while the outline stays on its screen, and a drag is cancelled with Escape." />
</p>

Smoother window moving and resizing for macOS 14+.

## Move

Hold left ⌥ and drag from anywhere in a window. Edges snap to the screen and other windows.

<img src="docs/move.svg" width="520" alt="A terminal is dragged by its contents and snaps against an editor, then against the screen edge." />

## Tile

Drop on a screen edge: half, quarter in a corner, full at the top.

<img src="docs/tile.svg" width="520" alt="A window is dropped on the right edge, the top-left corner, the bottom-right corner, then the top edge. An outline previews each tile." />

## Maximize

Double-click to fill the screen, again to put it back.

<img src="docs/maximize.svg" width="520" alt="A double-click maximizes a window, another restores it." />

## Resize

Right-drag. The half you grab picks the edge. It stays on its screen.

<img src="docs/resize.svg" width="520" alt="The right half dragged right widens a window, the left half dragged right narrows it, and a corner dragged diagonally grows both ways until the screen edge." />

## Two displays

The edge between displays doesn't tile, so windows cross it freely.

<img src="docs/displays.svg" width="720" alt="A terminal is dragged across the edge two displays share without tiling, then tiled on the right display's outer edge. A resize toward the other display stops at the window's own display." />

## Cancel

<img src="docs/cancel.svg" width="520" alt="Escape puts a dragged window back; pressing the other button drops a resize." />

## Demos

The animations are built from `docs/scenes` with [svjeez](https://github.com/saiashirwad/svjeez). They replay a script of cursor moves and key presses through a port of mwm2's drag logic, so they only show what mwm2 does. Rebuild with `make demos`.

## Install

```sh
make install
```

Then enable mwm2 in System Settings → Privacy & Security → Accessibility.

Uninstall with `make uninstall`.
