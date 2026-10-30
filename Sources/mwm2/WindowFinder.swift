import ApplicationServices
import Foundation

struct WindowTarget {
    let app: AXUIElement
    let window: AXUIElement
    /// Global coordinates, top-left origin (same space as CGEvent locations and AX).
    let frame: CGRect
}

enum WindowFinder {
    private static let ownPID = getpid()

    /// Finds the frontmost normal window under `point`. CGWindowList answers this from the
    /// window server without asking any app, so only the final AX lookup touches the target.
    static func window(at point: CGPoint) -> WindowTarget? {
        let options: CGWindowListOption = [.optionOnScreenOnly, .excludeDesktopElements]
        guard let entries = CGWindowListCopyWindowInfo(options, kCGNullWindowID) as? [[String: Any]] else { return nil }

        for entry in entries {
            guard (entry[kCGWindowLayer as String] as? Int) == 0,
                  (entry[kCGWindowAlpha as String] as? Double ?? 1) > 0,
                  let bounds = entry[kCGWindowBounds as String],
                  let frame = CGRect(dictionaryRepresentation: bounds as! CFDictionary),
                  frame.contains(point) else { continue }

            // The topmost window under the cursor is the one the user is pointing at;
            // never fall through to a window behind it.
            guard let pid = entry[kCGWindowOwnerPID as String] as? pid_t, pid != ownPID,
                  let id = entry[kCGWindowNumber as String] as? CGWindowID else { return nil }

            let app = AXUIElementCreateApplication(pid)
            let candidates = app.windows
            guard let window = candidates.first(where: { $0.windowID == id })
                    ?? candidates.first(where: { $0.frame == frame }),
                  window.isMovable else { return nil }
            return WindowTarget(app: app, window: window, frame: frame)
        }
        return nil
    }
}
