import AppKit

let args = CommandLine.arguments
guard args.count == 2 else {
    fputs("Usage: make_ledger_icon.swift <output>\n", stderr)
    exit(1)
}

let outputPath = NSString(string: args[1]).expandingTildeInPath
let canvasSize = CGSize(width: 1024, height: 1024)

func color(_ hex: UInt32) -> NSColor {
    NSColor(
        calibratedRed: CGFloat((hex >> 16) & 0xff) / 255,
        green: CGFloat((hex >> 8) & 0xff) / 255,
        blue: CGFloat(hex & 0xff) / 255,
        alpha: 1
    )
}

let image = NSImage(size: canvasSize)
image.lockFocus()

NSGraphicsContext.current?.imageInterpolation = .high

let outerRect = CGRect(x: 72, y: 72, width: 880, height: 880)
let outerPath = NSBezierPath(roundedRect: outerRect, xRadius: 120, yRadius: 120)
color(0x1C1E10).setFill()
outerPath.fill()

let outerStroke = NSBezierPath(roundedRect: outerRect, xRadius: 120, yRadius: 120)
outerStroke.lineWidth = 10
color(0x747858).setStroke()
outerStroke.stroke()

let innerRect = CGRect(x: 168, y: 230, width: 688, height: 520)
let innerPath = NSBezierPath(roundedRect: innerRect, xRadius: 44, yRadius: 44)
color(0xA8AE7A).setFill()
innerPath.fill()

let innerStroke = NSBezierPath(roundedRect: innerRect, xRadius: 44, yRadius: 44)
innerStroke.lineWidth = 8
color(0x484C30).setStroke()
innerStroke.stroke()

let titleAttrs: [NSAttributedString.Key: Any] = [
    .font: NSFont.monospacedSystemFont(ofSize: 80, weight: .bold),
    .foregroundColor: color(0x1C1E10)
]

let title = NSAttributedString(string: "LEDGER", attributes: titleAttrs)
title.draw(at: CGPoint(x: 280, y: 600))

let subtitleAttrs: [NSAttributedString.Key: Any] = [
    .font: NSFont.monospacedSystemFont(ofSize: 36, weight: .medium),
    .foregroundColor: color(0x484C30)
]

let subtitle = NSAttributedString(string: "RISO ACCOUNT BOOK", attributes: subtitleAttrs)
subtitle.draw(at: CGPoint(x: 262, y: 548))

let lineColor = color(0x484C30)
for idx in 0..<4 {
    let y = CGFloat(474 - idx * 70)
    let line = NSBezierPath()
    line.move(to: CGPoint(x: 238, y: y))
    line.line(to: CGPoint(x: 786, y: y))
    line.lineWidth = 10
    lineColor.setStroke()
    line.stroke()
}

for idx in 0..<3 {
    let x = CGFloat(286 + idx * 156)
    let line = NSBezierPath()
    line.move(to: CGPoint(x: x, y: 280))
    line.line(to: CGPoint(x: x, y: 510))
    line.lineWidth = 8
    color(0x747858).setStroke()
    line.stroke()
}

let accentRect = CGRect(x: 248, y: 820, width: 528, height: 26)
let accentPath = NSBezierPath(roundedRect: accentRect, xRadius: 13, yRadius: 13)
color(0xC8CC8C).setFill()
accentPath.fill()

let footerAttrs: [NSAttributedString.Key: Any] = [
    .font: NSFont.monospacedSystemFont(ofSize: 30, weight: .semibold),
    .foregroundColor: color(0xA8AE7A)
]
let footer = NSAttributedString(string: "RISO", attributes: footerAttrs)
footer.draw(at: CGPoint(x: 456, y: 128))

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
