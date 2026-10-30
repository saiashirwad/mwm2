import ApplicationServices
import Foundation

// Private but long-stable HIServices call (used by Rectangle, yabai, AltTab) that maps
// an AX window to its CGWindowID, so we can match AX windows to CGWindowList entries.
@_silgen_name("_AXUIElementGetWindow")
private func _AXUIElementGetWindow(_ element: AXUIElement, _ id: UnsafeMutablePointer<CGWindowID>) -> AXError

private let enhancedUserInterfaceAttribute = "AXEnhancedUserInterface"

extension AXUIElement {
    var windowID: CGWindowID? {
        var id: CGWindowID = 0
        return _AXUIElementGetWindow(self, &id) == .success ? id : nil
    }

    var windows: [AXUIElement] {
        var raw: CFTypeRef?
        guard AXUIElementCopyAttributeValue(self, kAXWindowsAttribute as CFString, &raw) == .success else { return [] }
        return raw as? [AXUIElement] ?? []
    }

    var frame: CGRect? {
        guard let origin = value(kAXPositionAttribute, .cgPoint, CGPoint.zero),
              let size = value(kAXSizeAttribute, .cgSize, CGSize.zero) else { return nil }
        return CGRect(origin: origin, size: size)
    }

    var isMovable: Bool {
        var settable = DarwinBoolean(false)
        return AXUIElementIsAttributeSettable(self, kAXPositionAttribute as CFString, &settable) == .success && settable.boolValue
    }

    func setPosition(_ point: CGPoint) {
        var point = point
        if let value = AXValueCreate(.cgPoint, &point) {
            AXUIElementSetAttributeValue(self, kAXPositionAttribute as CFString, value)
        }
    }

    func setSize(_ size: CGSize) {
        var size = size
        if let value = AXValueCreate(.cgSize, &size) {
            AXUIElementSetAttributeValue(self, kAXSizeAttribute as CFString, value)
        }
    }

    /// Size, then position, then size again: the first resize can be clamped by the
    /// screen edge at the old position, so it is repeated once the window has moved.
    func setFrame(_ frame: CGRect) {
        setSize(frame.size)
        setPosition(frame.origin)
        setSize(frame.size)
    }

    /// Chrome, Electron and friends animate every frame change while this app-level flag
    /// is on (it is set by assistive tools). Returns true if it was on and is now off.
    func disableEnhancedUserInterface() -> Bool {
        var raw: CFTypeRef?
        guard AXUIElementCopyAttributeValue(self, enhancedUserInterfaceAttribute as CFString, &raw) == .success,
              (raw as? Bool) == true else { return false }
        AXUIElementSetAttributeValue(self, enhancedUserInterfaceAttribute as CFString, kCFBooleanFalse)
        return true
    }

    func enableEnhancedUserInterface() {
        AXUIElementSetAttributeValue(self, enhancedUserInterfaceAttribute as CFString, kCFBooleanTrue)
    }

    private func value<T: BitwiseCopyable>(_ attribute: String, _ type: AXValueType, _ initial: T) -> T? {
        var raw: CFTypeRef?
        guard AXUIElementCopyAttributeValue(self, attribute as CFString, &raw) == .success,
              let raw, CFGetTypeID(raw) == AXValueGetTypeID() else { return nil }
        var result = initial
        return AXValueGetValue(raw as! AXValue, type, &result) ? result : nil
    }
}
