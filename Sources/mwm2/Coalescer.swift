import Foundation

/// Delivers only the most recent submitted value to `apply` on `queue`.
/// Values submitted while `apply` is busy replace each other, so a slow consumer
/// (an app answering AX calls, the window server) never builds up a backlog.
final class Coalescer<Value> {
    private let queue: DispatchQueue
    private let apply: (Value) -> Void
    private let lock = NSLock()
    private var pending: Value?
    private var scheduled = false

    init(queue: DispatchQueue, apply: @escaping (Value) -> Void) {
        self.queue = queue
        self.apply = apply
    }

    func submit(_ value: Value) {
        lock.lock()
        pending = value
        let needsDrain = !scheduled
        scheduled = true
        lock.unlock()
        if needsDrain { queue.async(execute: drain) }
    }

    private func drain() {
        lock.lock()
        let value = pending
        pending = nil
        scheduled = false
        lock.unlock()
        if let value { apply(value) }
    }
}
