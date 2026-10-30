import AppKit

enum DragControllerError: Error, CustomStringConvertible {
    case eventTapUnavailable

    var description: String {
        "Could not create the mouse event tap. Enable mwm2 in System Settings > Privacy & Security > Accessibility."
    }
}

/// Left Option + left-drag moves the window under the cursor live; left Option + right-drag
/// shows an outline and resizes the window once on release.
///
/// Threads: the event tap runs on its own thread so nothing (including AppKit) can delay
/// input. AX calls into the target app run on `axQueue`; the outline is drawn on main.
final class DragController {
    private struct Edges {
        var left = false, right = false, top = false, bottom = false

        /// Outer thirds of the window grab an edge; the center grabs the nearest corner.
        init(grabbing point: CGPoint, in frame: CGRect) {
            let x = (point.x - frame.minX) / frame.width
            let y = (point.y - frame.minY) / frame.height
            left = x < 1 / 3
            right = x > 2 / 3
            top = y < 1 / 3
            bottom = y > 2 / 3
            if !(left || right || top || bottom) {
                left = x < 0.5
                right = !left
                top = y < 0.5
                bottom = !top
            }
        }
    }

    private enum Mode {
        case move
        case resize(Edges)
    }

    private struct Session {
        let target: WindowTarget
        let mode: Mode
        let button: CGMouseButton
        let startPointer: CGPoint
        var frame: CGRect
    }

    private struct Move {
        let window: AXUIElement
        let origin: CGPoint
    }

    private static let minimumSize = CGSize(width: 160, height: 90)
    private static let leftOptionMask: UInt64 = 0x20 // NX_DEVICELALTKEYMASK
    private static let eventMask: CGEventMask = [
        CGEventType.leftMouseDown, .leftMouseUp, .leftMouseDragged,
        .rightMouseDown, .rightMouseUp, .rightMouseDragged,
    ].reduce(0) { $0 | (1 << $1.rawValue) }

    private let axQueue = DispatchQueue(label: "dev.texoport.mwm2.ax", qos: .userInteractive)
    private let moves: Coalescer<Move>
    private let overlayUpdates: Coalescer<Overlay.Update>
    private var tap: CFMachPort?
    // Tap thread only.
    private var session: Session?
    // axQueue only.
    private var enhancedUIApp: AXUIElement?

    init(overlay: Overlay) {
        moves = Coalescer(queue: axQueue) { $0.window.setPosition($0.origin) }
        overlayUpdates = Coalescer(queue: .main) { overlay.apply($0) }
    }

    func start() throws {
        guard let tap = CGEvent.tapCreate(
            tap: .cgSessionEventTap,
            place: .headInsertEventTap,
            options: .defaultTap,
            eventsOfInterest: Self.eventMask,
            callback: { _, type, event, userInfo in
                Unmanaged<DragController>.fromOpaque(userInfo!).takeUnretainedValue().handle(type, event)
            },
            userInfo: Unmanaged.passUnretained(self).toOpaque()
        ) else { throw DragControllerError.eventTapUnavailable }
        self.tap = tap

        let thread = Thread {
            let source = CFMachPortCreateRunLoopSource(nil, tap, 0)
            CFRunLoopAddSource(CFRunLoopGetCurrent(), source, .commonModes)
            CGEvent.tapEnable(tap: tap, enable: true)
            CFRunLoopRun()
        }
        thread.name = "dev.texoport.mwm2.event-tap"
        thread.qualityOfService = .userInteractive
        thread.start()
    }

    private func handle(_ type: CGEventType, _ event: CGEvent) -> Unmanaged<CGEvent>? {
        let passThrough = Unmanaged.passUnretained(event)
        switch type {
        case .tapDisabledByTimeout, .tapDisabledByUserInput:
            if let tap { CGEvent.tapEnable(tap: tap, enable: true) }
            return passThrough
        case .leftMouseDown, .rightMouseDown:
            // A session still open here lost its mouse-up (e.g. while the tap was disabled).
            if session != nil { finish() }
            return begin(button: type == .leftMouseDown ? .left : .right, event: event) ? nil : passThrough
        case .leftMouseDragged, .rightMouseDragged:
            guard session != nil else { return passThrough }
            update(to: event.location)
            return nil
        case .leftMouseUp, .rightMouseUp:
            guard let session else { return passThrough }
            if session.button == (type == .leftMouseUp ? .left : .right) {
                update(to: event.location)
                finish()
            }
            return nil
        default:
            return passThrough
        }
    }

    private func begin(button: CGMouseButton, event: CGEvent) -> Bool {
        let flags = event.flags
        guard flags.rawValue & Self.leftOptionMask != 0,
              flags.isDisjoint(with: [.maskCommand, .maskControl]),
              let target = WindowFinder.window(at: event.location) else { return false }

        let mode: Mode = button == .left ? .move : .resize(Edges(grabbing: event.location, in: target.frame))
        session = Session(target: target, mode: mode, button: button, startPointer: event.location, frame: target.frame)

        axQueue.async { [self] in
            enhancedUIApp = target.app.disableEnhancedUserInterface() ? target.app : nil
        }
        if case .resize = mode { overlayUpdates.submit(.show(target.frame)) }
        return true
    }

    private func update(to pointer: CGPoint) {
        guard var session else { return }
        let dx = (pointer.x - session.startPointer.x).rounded()
        let dy = (pointer.y - session.startPointer.y).rounded()

        let frame: CGRect
        switch session.mode {
        case .move:
            frame = session.target.frame.offsetBy(dx: dx, dy: dy)
        case .resize(let edges):
            frame = Self.resized(session.target.frame, edges: edges, dx: dx, dy: dy)
        }
        guard frame != session.frame else { return }
        session.frame = frame
        self.session = session

        switch session.mode {
        case .move:
            moves.submit(Move(window: session.target.window, origin: frame.origin))
        case .resize:
            overlayUpdates.submit(.show(frame))
        }
    }

    private func finish() {
        guard let session else { return }
        self.session = nil

        // Queued behind any pending move, so the final position lands before the restore.
        axQueue.async { [self] in
            if case .resize = session.mode {
                if session.frame != session.target.frame { session.target.window.setFrame(session.frame) }
                // Hide only after the window has its new size, so nothing flickers in between.
                overlayUpdates.submit(.hide)
            }
            enhancedUIApp?.enableEnhancedUserInterface()
            enhancedUIApp = nil
        }
    }

    private static func resized(_ start: CGRect, edges: Edges, dx: CGFloat, dy: CGFloat) -> CGRect {
        var minX = start.minX, maxX = start.maxX, minY = start.minY, maxY = start.maxY
        if edges.left { minX = min(start.minX + dx, maxX - minimumSize.width) }
        if edges.right { maxX = max(start.maxX + dx, minX + minimumSize.width) }
        if edges.top { minY = min(start.minY + dy, maxY - minimumSize.height) }
        if edges.bottom { maxY = max(start.maxY + dy, minY + minimumSize.height) }
        return CGRect(x: minX, y: minY, width: maxX - minX, height: maxY - minY)
    }
}
