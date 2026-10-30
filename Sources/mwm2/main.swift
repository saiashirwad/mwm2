import AppKit

let application = NSApplication.shared
application.setActivationPolicy(.accessory)

// Global cap on how long any AX call may block, so a hung app can't stall a drag.
AXUIElementSetMessagingTimeout(AXUIElementCreateSystemWide(), 0.5)

var controller: DragController?

func start() {
    Screens.shared.startObserving()
    let dragController = DragController(overlay: Overlay())
    do {
        try dragController.start()
    } catch {
        fputs("\(error)\n", stderr)
        exit(1)
    }
    controller = dragController
    print("mwm2 running. Left Option + drag: move. + right-drag: resize. + double-click: maximize. Escape cancels.")
}

let prompt = [kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String: true] as CFDictionary
if AXIsProcessTrustedWithOptions(prompt) {
    start()
} else {
    print("Waiting for Accessibility permission (System Settings > Privacy & Security > Accessibility)...")
    Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { timer in
        guard AXIsProcessTrusted() else { return }
        timer.invalidate()
        start()
    }
}

application.run()
