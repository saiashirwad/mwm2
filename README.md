# mwm2

<p align="center">
  <img src="docs/demo.svg" width="640" alt="Holding Left Option, the cursor drags a window to move it live, then right-drags its corner: an outline grows and the window takes the new size on release." />
</p>

Tiny macOS window mover/resizer (Swift, no dependencies). Background app with no Dock or menu bar icon, requires macOS 14+.

## Usage

- Left Option + left-drag anywhere on a window: move it live.
- Left Option + right-drag: show an outline overlay; resize once on mouse-up. Grabbing the outer third picks that edge (corners from two edges); grabbing the center picks the nearest corner. Minimum size 160x90.
- Clicks with Command or Control held pass through untouched.

## Why it's smooth

- Resizing via an outline drawn in its own process so it never waits on the target app re-rendering at 4K/5K.
- Live moves are coalesced latest-wins on a background queue so slow apps never build a backlog.
- The event tap runs on its own thread.
- Window under the cursor is found via CGWindowList rather than querying apps.
- AXEnhancedUserInterface (which makes Chrome/Electron animate frame changes) is turned off during a drag and restored after.
- AX calls time out after 0.5s so a hung app can't stall it.

## Install from source

```sh
make install
```

Builds, installs to `~/Applications/mwm2.app`, and starts it now and at every login (via a LaunchAgent). Then:

**Enable mwm2 in System Settings > Privacy & Security > Accessibility.** macOS asks on first launch; mwm2 does nothing until this is granted and starts working as soon as it is, no relaunch needed.

Remove it with `make uninstall`.

## Install from a zip

`make dist` produces `dist/mwm2-<version>.zip` for sharing. mwm2 is not notarized, so after unzipping and moving `mwm2.app` to Applications:

1. Open it. macOS will refuse; go to System Settings > Privacy & Security and click **Open Anyway**.
2. Enable mwm2 under Privacy & Security > Accessibility.
3. Optionally add it to System Settings > General > Login Items.

## Signing

macOS ties the Accessibility grant to the app's signature, so every build must be signed by the same certificate. The Makefile uses your Developer ID Application or Apple Development certificate if you have one (override with `CODESIGN_IDENTITY=<sha1 or name>`). Without one it signs ad-hoc, which works but means re-granting Accessibility after each rebuild.

## Control

```sh
pkill mwm2                                            # stop until next login
launchctl kickstart gui/$(id -u)/dev.texoport.mwm2    # start again
```
