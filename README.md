# mwm2

<p align="center">
  <img src="docs/demo.svg" width="100%" alt="Two displays. Holding Left Option, the cursor moves a terminal so it snaps to the screen edge, drags an editor to the outer edge to tile it to the right half, double-clicks the terminal to maximize and restore it, resizes it toward the other display while the outline stops at its own screen, then drags the editor and cancels with Escape." />
</p>

Smoother window moving and resizing for macOS 14+.

Hold **Left Option**, then:

- **drag** to move a window. Edges snap to the screen and other windows; drop on a screen edge to tile it to a half, a quarter in a corner, or the full screen at the top.
- **right-drag** to resize it with an outline, kept to its screen and applied on release.
- **double-click** to maximize it, and again to restore it.
- press **Escape** or the other mouse button mid-drag to cancel.

```sh
make install
```

Then enable mwm2 in System Settings > Privacy & Security > Accessibility. Remove it with `make uninstall`.
