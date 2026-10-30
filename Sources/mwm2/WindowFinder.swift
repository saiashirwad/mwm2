import ApplicationServices
import Foundation

struct WindowTarget {
    let id: CGWindowID
    let app: AXUIElement
    let window: AXUIElement
    /// Global coordinates, top-left origin (same space as CGEvent locations and AX).
    let frame: CGRect
}

enum WindowFinder {
    private static let ownPID = getpid()

    /// Finds the frontmost normal window under `point`, plus the frames of the other
    /// on-screen windows (for snapping). CGWindowList answers this from the window server
    /// without asking any app, so only the final AX lookup touches the target.
    static func window(at point: CGPoint) -> (target: WindowTarget, others: [CGRect])? {
        let options: CGWindowListOption = [.optionOnScreenOnly, .excludeDesktopElements]
        guard let entries = CGWindowListCopyWindowInfo(options, kCGNullWindowID) as? [[String: Any]] else { return nil }

        let windows = entries.compactMap { entry -> (id: CGWindowID, pid: pid_t, frame: CGRect)? in
            guard (entry[kCGWindowLayer as String] as? Int) == 0,
                  (entry[kCGWindowAlpha as String] as? Double ?? 1) > 0,
                  let pid = entry[kCGWindowOwnerPID as String] as? pid_t,
                  let id = entry[kCGWindowNumber as String] as? CGWindowID,
                  let bounds = entry[kCGWindowBounds as String],
                  let frame = CGRect(dictionaryRepresentation: bounds as! CFDictionary) else { return nil }
            return (id, pid, frame)
        }

        // The topmost window under the cursor is the one the user is pointing at;
        // never fall through to a window behind it.
        guard let hit = windows.first(where: { $0.frame.contains(point) }), hit.pid != ownPID else { return nil }

        let app = AXUIElementCreateApplication(hit.pid)
        let candidates = app.windows
        guard let window = candidates.first(where: { $0.windowID == hit.id })
                ?? candidates.first(where: { $0.frame == hit.frame }),
              window.isMovable else { return nil }

        let others = windows.filter { $0.id != hit.id && $0.pid != ownPID }.map(\.frame)
        return (WindowTarget(id: hit.id, app: app, window: window, frame: hit.frame), others)
    }
}
