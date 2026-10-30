import AppKit

enum DragControllerError: Error, CustomStringConvertible {
    case eventTapUnavailable

    var description: String {
        "Could not create the mouse event tap. Enable mwm2 in System Settings > Privacy & Security > Accessibility."
    }
}

/// Left Option + gestures on the window under the cursor:
/// - left-drag moves it live, snapping to nearby edges; dropping with the cursor on a screen
///   edge tiles it (half, quarter, or full screen at the top edge)
/// - right-drag resizes from the edges on the grabbed half (right half: the right edge
///   follows the pointer), with an outline kept to the window's screen, applied on release
/// - double-click maximizes it, or restores it if it is already maximized
/// - Escape or the other mouse button cancels a drag in progress
///
/// Threads: the event tap runs on its own thread so nothing (including AppKit) can delay
/// input. AX calls into the target app run on `axQueue`; the outline is drawn on main.
final class DragController {
    private enum Mode {
        case move
        case resize(Edges, bounds: CGRect)
        /// Swallows the rest of the gesture: after a cancel, or on the second click of a double-click.
        case inert
    }

    private struct Session {
        let target: WindowTarget
        var mode: Mode
        let button: CGMouseButton
        let startPointer: CGPoint
        let screens: [Screen]
        /// Screen areas and other windows a move snaps to.
        let snapTargets: [CGRect]
        var frame: CGRect
        /// Where a move drops the window when the cursor rests on a screen edge.
        var tile: CGRect?
    }

    private struct Move {
        let window: AXUIElement
        let origin: CGPoint
    }

    private static let leftOptionMask: UInt64 = 0x20 // NX_DEVICELALTKEYMASK
    private static let escapeKeyCode: Int64 = 53
    private static let doubleClickDistance: CGFloat = 5
    private static let eventMask: CGEventMask = [
        CGEventType.leftMouseDown, .leftMouseUp, .leftMouseDragged,
        .rightMouseDown, .rightMouseUp, .rightMouseDragged,
        .keyDown,
    ].reduce(0) { $0 | (1 << $1.rawValue) }

    private let axQueue = DispatchQueue(label: "dev.texoport.mwm2.ax", qos: .userInteractive)
    private let moves: Coalescer<Move>
    private let overlayUpdates: Coalescer<Overlay.Update>
    private let doubleClickInterval = NSEvent.doubleClickInterval
    private var tap: CFMachPort?
    // Tap thread only.
    private var session: Session?
    private var swallowed: Set<CGMouseButton> = []
    private var lastClick: (time: TimeInterval, point: CGPoint)?
    private var unmaximizedFrames: [CGWindowID: CGRect] = [:]
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

        case .keyDown:
            guard session != nil, event.getIntegerValueField(.keyboardEventKeycode) == Self.escapeKeyCode else {
                return passThrough
            }
            cancel()
            return nil

        case .leftMouseDown, .rightMouseDown:
            let button: CGMouseButton = type == .leftMouseDown ? .left : .right
            if let session {
                if session.button != button {
                    cancel()
                    swallowed.insert(button)
                    return nil
                }
                // Same button down again: the session lost its mouse-up (e.g. while the tap was disabled).
                finish()
            }
            return begin(button: button, event: event) ? nil : passThrough

        case .leftMouseDragged, .rightMouseDragged:
            if session != nil {
                update(to: event.location)
                return nil
            }
            return swallowed.contains(type == .leftMouseDragged ? .left : .right) ? nil : passThrough

        case .leftMouseUp, .rightMouseUp:
            let button: CGMouseButton = type == .leftMouseUp ? .left : .right
            if let session, session.button == button {
                update(to: event.location)
                finish()
                return nil
            }
            return swallowed.remove(button) != nil || session != nil ? nil : passThrough

        default:
            return passThrough
        }
    }

    private func begin(button: CGMouseButton, event: CGEvent) -> Bool {
        let flags = event.flags
        guard flags.rawValue & Self.leftOptionMask != 0,
              flags.isDisjoint(with: [.maskCommand, .maskControl]),
              let (target, others) = WindowFinder.window(at: event.location) else { return false }

        let screens = Screens.shared.all
        DispatchQueue.main.async { Screens.shared.refresh() }

        let mode: Mode
        if button == .left, isDoubleClick(at: event.location) {
            toggleMaximized(target, screens: screens)
            mode = .inert
        } else if button == .left {
            mode = .move
        } else {
            let bounds = Geometry.screen(for: target.frame, in: screens)?.visible ?? .infinite
            mode = .resize(Edges(), bounds: bounds)
        }

        session = Session(
            target: target, mode: mode, button: button, startPointer: event.location,
            screens: screens, snapTargets: screens.map(\.visible) + others, frame: target.frame
        )
        if case .inert = mode { return true }

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

        switch session.mode {
        case .inert:
            return
        case .move:
            let tile = Geometry.tile(at: pointer, in: session.screens)
            if tile != session.tile {
                session.tile = tile
                overlayUpdates.submit(tile.map { .show($0) } ?? .hide)
            }
            // A click without movement (half of a double-click) must leave the window alone.
            let frame = dx == 0 && dy == 0
                ? session.target.frame
                : Geometry.snapped(session.target.frame.offsetBy(dx: dx, dy: dy), to: session.snapTargets)
            if frame != session.frame {
                session.frame = frame
                moves.submit(Move(window: session.target.window, origin: frame.origin))
            }
        case .resize(let latched, let bounds):
            let edges = latched.latching(dx: dx, dy: dy, grab: session.startPointer, in: session.target.frame)
            session.mode = .resize(edges, bounds: bounds)
            let frame = Geometry.resized(session.target.frame, edges: edges, dx: dx, dy: dy, within: bounds)
            if frame != session.frame {
                session.frame = frame
                overlayUpdates.submit(.show(frame))
            }
        }
        self.session = session
    }

    private func finish() {
        guard let session else { return }
        self.session = nil
        if session.frame != session.target.frame { lastClick = nil }

        let window = session.target.window
        switch session.mode {
        case .inert:
            return
        case .move:
            // Queued behind any pending move, so the final position lands first.
            axQueue.async { [self] in
                if let tile = session.tile {
                    window.setFrame(tile)
                    overlayUpdates.submit(.hide)
                }
                restoreEnhancedUserInterface()
            }
        case .resize:
            axQueue.async { [self] in
                if session.frame != session.target.frame { window.setFrame(session.frame) }
                // Hide only after the window has its new size, so nothing flickers in between.
                overlayUpdates.submit(.hide)
                restoreEnhancedUserInterface()
            }
        }
    }

    /// Puts the window back where the drag found it and ignores the rest of the gesture.
    private func cancel() {
        guard var session else { return }
        switch session.mode {
        case .inert:
            return
        case .move:
            moves.submit(Move(window: session.target.window, origin: session.target.frame.origin))
        case .resize:
            break
        }
        overlayUpdates.submit(.hide)
        axQueue.async { [self] in restoreEnhancedUserInterface() }
        session.mode = .inert
        session.frame = session.target.frame
        self.session = session
    }

    private func isDoubleClick(at point: CGPoint) -> Bool {
        let now = ProcessInfo.processInfo.systemUptime
        if let last = lastClick, now - last.time <= doubleClickInterval,
           hypot(point.x - last.point.x, point.y - last.point.y) <= Self.doubleClickDistance {
            lastClick = nil
            return true
        }
        lastClick = (now, point)
        return false
    }

    /// Fills the window's screen (minus menu bar and Dock), or restores the frame it had
    /// before if it is still maximized.
    private func toggleMaximized(_ target: WindowTarget, screens: [Screen]) {
        guard let screen = Geometry.screen(for: target.frame, in: screens) else { return }
        let frame: CGRect
        if let previous = unmaximizedFrames[target.id], Geometry.isClose(target.frame, screen.visible) {
            frame = previous
            unmaximizedFrames[target.id] = nil
        } else {
            unmaximizedFrames[target.id] = target.frame
            frame = screen.visible
        }
        axQueue.async {
            let enhancedUI = target.app.disableEnhancedUserInterface()
            target.window.setFrame(frame)
            if enhancedUI { target.app.enableEnhancedUserInterface() }
        }
    }

    // axQueue only.
    private func restoreEnhancedUserInterface() {
        enhancedUIApp?.enableEnhancedUserInterface()
        enhancedUIApp = nil
    }
}
