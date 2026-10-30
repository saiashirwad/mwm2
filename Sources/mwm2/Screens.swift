import AppKit

struct Screen: Equatable {
    /// The whole display, in global top-left-origin coordinates.
    let frame: CGRect
    /// The display minus the menu bar and Dock, in the same coordinates.
    let visible: CGRect
}

/// A snapshot of the displays. NSScreen is read on the main thread; the event tap reads
/// the snapshot from its own thread.
final class Screens {
    static let shared = Screens()

    private let lock = NSLock()
    private var snapshot: [Screen] = []

    var all: [Screen] {
        lock.lock()
        defer { lock.unlock() }
        return snapshot
    }

    /// Main thread only.
    func startObserving() {
        refresh()
        NotificationCenter.default.addObserver(
            forName: NSApplication.didChangeScreenParametersNotification, object: nil, queue: .main
        ) { [weak self] _ in self?.refresh() }
    }

    /// Main thread only. Also called at the start of each drag, since Dock auto-hide
    /// changes the visible frame without a notification.
    func refresh() {
        guard let primaryHeight = NSScreen.screens.first?.frame.height else { return }
        let flip = { (rect: NSRect) in
            CGRect(x: rect.minX, y: primaryHeight - rect.maxY, width: rect.width, height: rect.height)
        }
        let screens = NSScreen.screens.map { Screen(frame: flip($0.frame), visible: flip($0.visibleFrame)) }
        lock.lock()
        snapshot = screens
        lock.unlock()
    }
}
