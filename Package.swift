// swift-tools-version:6.0
import PackageDescription

let package = Package(
    name: "mwm2",
    platforms: [.macOS(.v14)],
    targets: [
        .executableTarget(name: "mwm2")
    ],
    swiftLanguageModes: [.v5]
)
