import AppKit

let args = CommandLine.arguments
guard args.count == 3 else {
    fputs("Usage: make_icon.swift <input> <output>\n", stderr)
    exit(1)
}

let inputPath = NSString(string: args[1]).expandingTildeInPath
let outputPath = NSString(string: args[2]).expandingTildeInPath
let canvasSize = CGSize(width: 1024, height: 1024)
let circleInset: CGFloat = 84
let artworkInset: CGFloat = 126

guard let source = NSImage(contentsOfFile: inputPath) else {
    fputs("Failed to load image at \(inputPath)\n", stderr)
    exit(1)
}

let image = NSImage(size: canvasSize)
image.lockFocus()

NSGraphicsContext.current?.imageInterpolation = .high

let circleRect = CGRect(
    x: circleInset,
    y: circleInset,
    width: canvasSize.width - circleInset * 2,
    height: canvasSize.height - circleInset * 2
)

let shadow = NSShadow()
shadow.shadowBlurRadius = 22
shadow.shadowOffset = CGSize(width: 0, height: -4)
shadow.shadowColor = NSColor(calibratedWhite: 0, alpha: 0.10)
shadow.set()

let circlePath = NSBezierPath(ovalIn: circleRect)
NSColor.white.setFill()
circlePath.fill()

NSGraphicsContext.current?.saveGraphicsState()
circlePath.addClip()

let artRect = CGRect(
    x: artworkInset,
    y: artworkInset,
    width: canvasSize.width - artworkInset * 2,
    height: canvasSize.height - artworkInset * 2
)

source.draw(in: artRect, from: .zero, operation: .sourceOver, fraction: 1)
NSGraphicsContext.current?.restoreGraphicsState()

NSColor(calibratedWhite: 0.0, alpha: 0.07).setStroke()
circlePath.lineWidth = 2
circlePath.stroke()

image.unlockFocus()

guard
    let tiff = image.tiffRepresentation,
    let rep = NSBitmapImageRep(data: tiff),
    let png = rep.representation(using: .png, properties: [:])
else {
    fputs("Failed to render PNG output\n", stderr)
    exit(1)
}

do {
    try png.write(to: URL(fileURLWithPath: outputPath))
} catch {
    fputs("Failed to write PNG: \(error)\n", stderr)
    exit(1)
}
