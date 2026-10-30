import CoreGraphics
import Testing
@testable import mwm2

// Two side-by-side displays, top-left origin: a 1920x1080 primary with a 25pt menu bar
// and a 70pt Dock, and a 2304x1296 display to its right with only a menu bar.
private let primary = Screen(
    frame: CGRect(x: 0, y: 0, width: 1920, height: 1080),
    visible: CGRect(x: 0, y: 25, width: 1920, height: 985)
)
private let secondary = Screen(
    frame: CGRect(x: 1920, y: 0, width: 2304, height: 1296),
    visible: CGRect(x: 1920, y: 25, width: 2304, height: 1271)
)
private let screens = [primary, secondary]

@Suite struct Resize {
    @Test func stopsAtTheScreenEdge() {
        let start = CGRect(x: 1500, y: 600, width: 300, height: 300)
        let frame = Geometry.resized(start, edges: Edges(right: true, bottom: true), dx: 800, dy: 800, within: primary.visible)
        #expect(frame == CGRect(x: 1500, y: 600, width: 420, height: 410))
    }

    @Test func shrinksFromTheTopLeftDownToTheMinimum() {
        let start = CGRect(x: 100, y: 100, width: 400, height: 300)
        let frame = Geometry.resized(start, edges: Edges(left: true, top: true), dx: 1000, dy: 1000, within: primary.visible)
        #expect(frame == CGRect(x: 340, y: 310, width: 160, height: 90))
    }

    @Test func leavesAWindowThatStartedOffScreenWhereItIs() {
        let start = CGRect(x: -50, y: 100, width: 400, height: 300)
        let frame = Geometry.resized(start, edges: Edges(left: true), dx: -100, dy: 0, within: primary.visible)
        #expect(frame.minX == -50)
    }

    @Test func picksTheScreenShowingMostOfTheWindow() {
        let window = CGRect(x: 1800, y: 100, width: 400, height: 300)
        #expect(Geometry.screen(for: window, in: screens) == secondary)
    }
}

@Suite struct Direction {
    private let window = CGRect(x: 100, y: 100, width: 400, height: 300)
    private let rightHalf = CGPoint(x: 400, y: 200) // also the top half
    private let leftHalf = CGPoint(x: 200, y: 350) // also the bottom half

    private func resize(grab: CGPoint, dx: CGFloat, dy: CGFloat) -> CGRect {
        let edges = Edges().latching(dx: dx, dy: dy, grab: grab, in: window)
        return Geometry.resized(window, edges: edges, dx: dx, dy: dy, within: primary.visible)
    }

    @Test func theGrabbedHalfPicksTheEdge() {
        #expect(Edges().latching(dx: 30, dy: -12, grab: rightHalf, in: window) == Edges(right: true, top: true))
        #expect(Edges().latching(dx: 30, dy: -12, grab: leftHalf, in: window) == Edges(left: true, bottom: true))
    }

    @Test func rightHalfWidensToTheRightAndNarrowsToTheLeft() {
        #expect(resize(grab: rightHalf, dx: 50, dy: 0) == CGRect(x: 100, y: 100, width: 450, height: 300))
        #expect(resize(grab: rightHalf, dx: -50, dy: 0) == CGRect(x: 100, y: 100, width: 350, height: 300))
    }

    @Test func leftHalfNarrowsToTheRightAndWidensToTheLeft() {
        #expect(resize(grab: leftHalf, dx: 50, dy: 0) == CGRect(x: 150, y: 100, width: 350, height: 300))
        #expect(resize(grab: leftHalf, dx: -50, dy: 0) == CGRect(x: 50, y: 100, width: 450, height: 300))
    }

    @Test func topAndBottomHalvesMoveTheirOwnEdge() {
        #expect(resize(grab: rightHalf, dx: 0, dy: 50) == CGRect(x: 100, y: 150, width: 400, height: 250))
        #expect(resize(grab: leftHalf, dx: 0, dy: 50) == CGRect(x: 100, y: 100, width: 400, height: 350))
    }

    @Test func aStraightDragLeavesTheOtherAxisAlone() {
        #expect(Edges().latching(dx: 40, dy: 3, grab: rightHalf, in: window) == Edges(right: true))
        #expect(Edges().latching(dx: 3, dy: -2, grab: rightHalf, in: window) == Edges())
    }
}

@Suite struct Tiling {
    @Test func leftEdgeIsTheLeftHalf() {
        #expect(Geometry.tile(at: CGPoint(x: 0, y: 540), in: screens) == CGRect(x: 0, y: 25, width: 960, height: 985))
    }

    @Test func topEdgeIsTheWholeScreen() {
        #expect(Geometry.tile(at: CGPoint(x: 3000, y: 0), in: screens) == secondary.visible)
    }

    @Test func cornersAreQuarters() {
        #expect(Geometry.tile(at: CGPoint(x: 4223, y: 1290), in: screens) == CGRect(x: 3072, y: 661, width: 1152, height: 635))
        #expect(Geometry.tile(at: CGPoint(x: 100, y: 0), in: screens) == CGRect(x: 0, y: 25, width: 960, height: 493))
    }

    @Test func theEdgeSharedByTwoDisplaysIsNotATarget() {
        #expect(Geometry.tile(at: CGPoint(x: 1919, y: 540), in: screens) == nil)
        #expect(Geometry.tile(at: CGPoint(x: 1920, y: 540), in: screens) == nil)
    }

    @Test func theMiddleOfTheScreenIsNotATarget() {
        #expect(Geometry.tile(at: CGPoint(x: 960, y: 540), in: screens) == nil)
    }
}

@Suite struct Snapping {
    @Test func snapsToTheScreenEdge() {
        let frame = CGRect(x: 6, y: 300, width: 400, height: 300)
        #expect(Geometry.snapped(frame, to: [primary.visible]).minX == 0)
    }

    @Test func snapsBesideAnotherWindow() {
        let other = CGRect(x: 500, y: 200, width: 400, height: 400)
        let frame = CGRect(x: 92, y: 300, width: 400, height: 300)
        #expect(Geometry.snapped(frame, to: [other]).maxX == 500)
    }

    @Test func ignoresWindowsThatDoNotLineUp() {
        let other = CGRect(x: 500, y: 900, width: 400, height: 100)
        let frame = CGRect(x: 92, y: 100, width: 400, height: 300)
        #expect(Geometry.snapped(frame, to: [other]) == frame)
    }

    @Test func leavesFarEdgesAlone() {
        let frame = CGRect(x: 40, y: 300, width: 400, height: 300)
        #expect(Geometry.snapped(frame, to: [primary.visible]) == frame)
    }
}

@Suite struct Maximize {
    @Test func aTerminalShortOfTheScreenStillCountsAsMaximized() {
        let terminal = CGRect(x: 0, y: 25, width: 1912, height: 977)
        #expect(Geometry.isClose(terminal, primary.visible))
        #expect(!Geometry.isClose(CGRect(x: 200, y: 200, width: 800, height: 600), primary.visible))
    }
}
