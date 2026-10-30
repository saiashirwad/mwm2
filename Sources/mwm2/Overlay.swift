import AppKit

/// The resize outline. It lives in our own process, so redrawing it never waits on the
/// target app, and the real resize happens once on mouse-up.
final class Overlay {
    enum Update {
        case show(CGRect)
        case hide
    }

    private let window: NSWindow

    init() {
        window = NSWindow(contentRect: .zero, styleMask: .borderless, backing: .buffered, defer: true)
        window.isOpaque = false
        window.backgroundColor = .clear
        window.hasShadow = false
        window.ignoresMouseEvents = true
        window.isReleasedWhenClosed = false
        window.animationBehavior = .none
        window.level = .statusBar
        window.collectionBehavior = [.canJoinAllSpaces, .transient, .ignoresCycle, .fullScreenAuxiliary]

        let view = NSView()
        view.wantsLayer = true
        view.layer?.borderWidth = 2
        view.layer?.cornerRadius = 10
        view.layer?.borderColor = NSColor.controlAccentColor.cgColor
        view.layer?.backgroundColor = NSColor.controlAccentColor.withAlphaComponent(0.12).cgColor
        window.contentView = view
    }

    func apply(_ update: Update) {
        switch update {
        case .show(let frame):
            window.setFrame(Self.appKitRect(frame), display: true)
            if !window.isVisible { window.orderFrontRegardless() }
        case .hide:
            window.orderOut(nil)
        }
    }

    /// Converts global top-left-origin coordinates to AppKit's bottom-left origin,
    /// which is anchored to the primary display.
    private static func appKitRect(_ rect: CGRect) -> NSRect {
        let primaryHeight = CGDisplayBounds(CGMainDisplayID()).height
        return NSRect(x: rect.minX, y: primaryHeight - rect.maxY, width: rect.width, height: rect.height)
    }
}
