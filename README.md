# mwm2

<p align="center">
  <img src="docs/demo.svg" width="100%" alt="Two displays. Holding Left Option, a terminal is moved and snaps to the screen edge, an editor is tiled to the right half, the terminal is maximized and restored, resized while the outline stays on its screen, and a drag is cancelled with Escape." />
</p>

Smoother window moving and resizing for macOS 14+.

## Move

Edges snap to the screen and other windows.

<img src="docs/move.svg" width="520" alt="A terminal is dragged and snaps against an editor, then against the screen edge." />

## Tile

Drop on a screen edge: half, quarter in a corner, full at the top.

<img src="docs/tile.svg" width="520" alt="A window is dropped on the right edge, the top-left corner, then the top edge." />

## Maximize

<img src="docs/maximize.svg" width="520" alt="A double-click maximizes a window, another restores it." />

## Resize

The half you grab picks the edge. It stays on its screen.

<img src="docs/resize.svg" width="520" alt="The right half dragged right widens a window, the left half dragged right narrows it, and a corner dragged diagonally grows both ways." />

## Cancel

<img src="docs/cancel.svg" width="520" alt="Escape puts a dragged window back; pressing the other button drops a resize." />

## Install

```sh
make install
```

Then enable mwm2 in System Settings → Privacy & Security → Accessibility.

Uninstall with `make uninstall`.
