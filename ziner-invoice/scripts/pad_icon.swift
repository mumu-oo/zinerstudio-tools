import AppKit

let args = CommandLine.arguments
guard args.count == 4 else {
    fputs("Usage: pad_icon.swift <input> <output> <scale>\n", stderr)
    exit(1)
}

let inputPath = NSString(string: args[1]).expandingTildeInPath
let outputPath = NSString(string: args[2]).expandingTildeInPath
guard let scale = Double(args[3]), scale > 0, scale <= 1 else {
    fputs("Scale must be between 0 and 1.\n", stderr)
    exit(1)
}

guard let source = NSImage(contentsOfFile: inputPath) else {
    fputs("Failed to load image at \(inputPath)\n", stderr)
    exit(1)
}

let canvasSize = CGSize(width: 1024, height: 1024)
let targetWidth = CGFloat(scale) * canvasSize.width
let targetHeight = CGFloat(scale) * canvasSize.height
let targetRect = CGRect(
    x: (canvasSize.width - targetWidth) / 2,
    y: (canvasSize.height - targetHeight) / 2,
    width: targetWidth,
    height: targetHeight
)

let image = NSImage(size: canvasSize)
image.lockFocus()

NSColor.clear.setFill()
NSBezierPath(rect: CGRect(origin: .zero, size: canvasSize)).fill()
NSGraphicsContext.current?.imageInterpolation = .none
source.draw(in: targetRect, from: .zero, operation: .sourceOver, fraction: 1)

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
