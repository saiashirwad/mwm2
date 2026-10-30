import CoreGraphics

/// Which window edges a resize drags.
struct Edges: Equatable {
    var left = false, right = false, top = false, bottom = false

    /// Pointer travel before an axis picks its edge, so a slightly unsteady press doesn't.
    static let latchDistance: CGFloat = 4

    /// An axis joins the resize once the pointer has moved along it, and drags the edge on
    /// the half of the window that was grabbed: grab the right half and the right edge
    /// follows the pointer (drag right to widen, left to narrow), grab the left half and the
    /// left edge does. Same for top and bottom; grab near a corner and drag diagonally to
    /// move both.
    func latching(dx: CGFloat, dy: CGFloat, grab: CGPoint, in frame: CGRect) -> Edges {
        var edges = self
        if !left, !right, abs(dx) >= Self.latchDistance {
            edges.right = grab.x >= frame.midX
            edges.left = !edges.right
        }
        if !top, !bottom, abs(dy) >= Self.latchDistance {
            edges.bottom = grab.y >= frame.midY
            edges.top = !edges.bottom
        }
        return edges
    }
}

/// Pure frame math, in global top-left-origin coordinates.
enum Geometry {
    static let minimumSize = CGSize(width: 160, height: 90)
    static let snapDistance: CGFloat = 10

    /// The screen showing most of `frame`.
    static func screen(for frame: CGRect, in screens: [Screen]) -> Screen? {
        screens.max { area($0.frame.intersection(frame)) < area($1.frame.intersection(frame)) }
            .flatMap { area($0.frame.intersection(frame)) > 0 ? $0 : nil }
    }

    /// Moves the dragged edges by the pointer delta. Dragged edges stop at `bounds` (the
    /// window's screen), unless the window already started outside it, and never shrink
    /// the window below `minimumSize`.
    static func resized(_ start: CGRect, edges: Edges, dx: CGFloat, dy: CGFloat, within bounds: CGRect) -> CGRect {
        var minX = start.minX, maxX = start.maxX, minY = start.minY, maxY = start.maxY
        if edges.left {
            minX = max(min(start.minX + dx, maxX - minimumSize.width), min(bounds.minX, start.minX))
        }
        if edges.right {
            maxX = min(max(start.maxX + dx, minX + minimumSize.width), max(bounds.maxX, start.maxX))
        }
        if edges.top {
            minY = max(min(start.minY + dy, maxY - minimumSize.height), min(bounds.minY, start.minY))
        }
        if edges.bottom {
            maxY = min(max(start.maxY + dy, minY + minimumSize.height), max(bounds.maxY, start.maxY))
        }
        return CGRect(x: minX, y: minY, width: maxX - minX, height: maxY - minY)
    }

    /// Shifts `frame` so an edge within `snapDistance` lines up with an edge of one of
    /// `targets` (screen areas and other windows). A target only attracts on one axis when
    /// the two overlap on the other, so distant windows don't pull.
    static func snapped(_ frame: CGRect, to targets: [CGRect]) -> CGRect {
        var dx = CGFloat.infinity, dy = CGFloat.infinity
        let reach = snapDistance
        for target in targets {
            if frame.minY < target.maxY + reach, frame.maxY > target.minY - reach {
                for edge in [frame.minX, frame.maxX] {
                    for line in [target.minX, target.maxX] where abs(line - edge) < abs(dx) { dx = line - edge }
                }
            }
            if frame.minX < target.maxX + reach, frame.maxX > target.minX - reach {
                for edge in [frame.minY, frame.maxY] {
                    for line in [target.minY, target.maxY] where abs(line - edge) < abs(dy) { dy = line - edge }
                }
            }
        }
        return frame.offsetBy(dx: abs(dx) <= reach ? dx : 0, dy: abs(dy) <= reach ? dy : 0)
    }

    /// The frame a window takes when dropped with the pointer at `point`: a half against a
    /// left or right screen edge, a quarter near a corner, the whole screen at the top edge.
    /// Only outer edges count; an edge shared with another display is not a target.
    static func tile(at point: CGPoint, in screens: [Screen]) -> CGRect? {
        guard let screen = screens.first(where: { $0.frame.contains(point) }) else { return nil }
        let f = screen.frame, v = screen.visible
        let margin: CGFloat = 3
        func outer(_ dx: CGFloat, _ dy: CGFloat) -> Bool {
            let beyond = CGPoint(x: point.x + dx, y: point.y + dy)
            return !screens.contains { $0.frame.contains(beyond) }
        }
        let left = point.x < f.minX + margin && outer(-margin, 0)
        let right = point.x >= f.maxX - margin && outer(margin, 0)
        let top = point.y < f.minY + margin && outer(0, -margin)
        let bottom = point.y >= f.maxY - margin && outer(0, margin)
        guard left || right || top || bottom else { return nil }

        let nearLeft = point.x < f.minX + f.width / 5, nearRight = point.x >= f.maxX - f.width / 5
        let nearTop = point.y < f.minY + f.height / 5, nearBottom = point.y >= f.maxY - f.height / 5

        let halfWidth = (v.width / 2).rounded(), halfHeight = (v.height / 2).rounded()
        let leftColumn = CGRect(x: v.minX, y: v.minY, width: halfWidth, height: v.height)
        let rightColumn = CGRect(x: v.minX + halfWidth, y: v.minY, width: v.width - halfWidth, height: v.height)
        func topHalf(_ column: CGRect) -> CGRect { CGRect(x: column.minX, y: v.minY, width: column.width, height: halfHeight) }
        func bottomHalf(_ column: CGRect) -> CGRect {
            CGRect(x: column.minX, y: v.minY + halfHeight, width: column.width, height: v.height - halfHeight)
        }

        if (left && nearTop) || (top && nearLeft) { return topHalf(leftColumn) }
        if (right && nearTop) || (top && nearRight) { return topHalf(rightColumn) }
        if (left && nearBottom) || (bottom && nearLeft) { return bottomHalf(leftColumn) }
        if (right && nearBottom) || (bottom && nearRight) { return bottomHalf(rightColumn) }
        if left { return leftColumn }
        if right { return rightColumn }
        if top { return v }
        return nil
    }

    /// True when every edge of `a` is within `tolerance` of `b`'s. Apps that size in steps
    /// (terminals) land a little short of the frame they were asked for.
    static func isClose(_ a: CGRect, _ b: CGRect, tolerance: CGFloat = 40) -> Bool {
        abs(a.minX - b.minX) <= tolerance && abs(a.minY - b.minY) <= tolerance
            && abs(a.maxX - b.maxX) <= tolerance && abs(a.maxY - b.maxY) <= tolerance
    }

    private static func area(_ rect: CGRect) -> CGFloat {
        rect.isNull ? 0 : rect.width * rect.height
    }
}
