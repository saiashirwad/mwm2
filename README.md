# mwm2

<p align="center">
  <img src="docs/demo.svg" width="640" alt="Holding Left Option, the cursor moves a terminal window, shrinks it from its corner with an outline, then grows and moves an editor window. Each resize applies on release." />
</p>

Smoother window moving and resizing for macOS 14+.

- **Left Option + drag** moves a window.
- **Left Option + right-drag** resizes it with an outline, applied on release.

```sh
make install
```

Then enable mwm2 in System Settings > Privacy & Security > Accessibility. Remove it with `make uninstall`.
