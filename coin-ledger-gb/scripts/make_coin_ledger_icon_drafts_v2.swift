import AppKit

struct PixelCanvas {
    let width: Int
    let height: Int
    private(set) var pixels: [Bool]

    init(width: Int, height: Int) {
        self.width = width
        self.height = height
        self.pixels = Array(repeating: false, count: width * height)
    }

    mutating func set(_ x: Int, _ y: Int, _ value: Bool = true) {
        guard x >= 0, y >= 0, x < width, y < height else { return }
        pixels[y * width + x] = value
    }

    mutating func fillRect(x: Int, y: Int, w: Int, h: Int, value: Bool = true) {
        guard w > 0, h > 0 else { return }
        for yy in y..<(y + h) {
            for xx in x..<(x + w) {
                set(xx, yy, value)
            }
        }
    }

    mutating func frameRect(x: Int, y: Int, w: Int, h: Int, t: Int = 1) {
        fillRect(x: x, y: y, w: w, h: t)
        fillRect(x: x, y: y + h - t, w: w, h: t)
        fillRect(x: x, y: y, w: t, h: h)
        fillRect(x: x + w - t, y: y, w: t, h: h)
    }

    mutating func hLine(x: Int, y: Int, length: Int, t: Int = 1, value: Bool = true) {
        fillRect(x: x, y: y, w: length, h: t, value: value)
    }

    mutating func vLine(x: Int, y: Int, length: Int, t: Int = 1, value: Bool = true) {
        fillRect(x: x, y: y, w: t, h: length, value: value)
    }

    mutating func fillCircle(cx: Int, cy: Int, radius: Int, value: Bool = true) {
        let r2 = radius * radius
        for y in (cy - radius)...(cy + radius) {
            for x in (cx - radius)...(cx + radius) {
                let dx = x - cx
                let dy = y - cy
                if dx * dx + dy * dy <= r2 {
                    set(x, y, value)
                }
            }
        }
    }

    mutating func ring(cx: Int, cy: Int, outer: Int, inner: Int) {
        fillCircle(cx: cx, cy: cy, radius: outer)
        fillCircle(cx: cx, cy: cy, radius: inner, value: false)
    }

    mutating func ditherRect(x: Int, y: Int, w: Int, h: Int, phase: Int = 0) {
        guard w > 0, h > 0 else { return }
        for yy in y..<(y + h) {
            for xx in x..<(x + w) {
                if (xx + yy + phase) % 2 == 0 {
                    set(xx, yy)
                }
            }
        }
    }

    mutating func clearDiamond(cx: Int, cy: Int, radius: Int) {
        for yy in -radius...radius {
            let span = radius - abs(yy)
            for xx in -span...span {
                set(cx + xx, cy + yy, false)
            }
        }
    }

    mutating func sparkle(cx: Int, cy: Int, size: Int) {
        for i in -size...size {
            set(cx + i, cy)
            set(cx, cy + i)
        }
        for i in -(size - 1)...(size - 1) {
            set(cx + i, cy + i)
            set(cx + i, cy - i)
        }
        clearDiamond(cx: cx, cy: cy, radius: max(1, size / 3))
    }

    mutating func cutCornerFrame() {
        let cutPairs = [
            (4, 4), (5, 4), (4, 5), (6, 4), (4, 6),
            (59, 4), (58, 4), (59, 5), (57, 4), (59, 6),
            (4, 59), (4, 58), (5, 59), (4, 57), (6, 59),
            (59, 59), (58, 59), (59, 58), (57, 59), (59, 57)
        ]
        cutPairs.forEach { set($0.0, $0.1, false) }
    }
}

extension Int {
    var cg: CGFloat { CGFloat(self) / 255.0 }
}

let dark = NSColor(calibratedRed: 0x1d.cg, green: 0x24.cg, blue: 0x14.cg, alpha: 1)
let light = NSColor(calibratedRed: 0xc9.cg, green: 0xd1.cg, blue: 0x8d.cg, alpha: 1)

func draw(canvas: PixelCanvas, to path: String, scale: Int = 10) throws {
    let size = NSSize(width: canvas.width * scale, height: canvas.height * scale)
    let image = NSImage(size: size)
    image.lockFocus()

    dark.setFill()
    NSBezierPath(rect: CGRect(origin: .zero, size: size)).fill()

    light.setFill()
    for y in 0..<canvas.height {
        for x in 0..<canvas.width where canvas.pixels[y * canvas.width + x] {
            let rect = CGRect(
                x: x * scale,
                y: (canvas.height - 1 - y) * scale,
                width: scale,
                height: scale
            )
            NSBezierPath(rect: rect).fill()
        }
    }

    image.unlockFocus()

    guard
        let tiff = image.tiffRepresentation,
        let rep = NSBitmapImageRep(data: tiff),
        let png = rep.representation(using: .png, properties: [:])
    else {
        throw NSError(domain: "coin-ledger-v2", code: 1)
    }

    try png.write(to: URL(fileURLWithPath: path))
}

func baseIcon() -> PixelCanvas {
    var c = PixelCanvas(width: 64, height: 64)
    c.frameRect(x: 4, y: 4, w: 56, h: 56, t: 3)
    c.cutCornerFrame()
    c.ditherRect(x: 8, y: 8, w: 10, h: 10)
    c.ditherRect(x: 46, y: 8, w: 10, h: 10, phase: 1)
    c.ditherRect(x: 8, y: 46, w: 10, h: 10, phase: 1)
    c.ditherRect(x: 46, y: 46, w: 10, h: 10)
    return c
}

func optionA() -> PixelCanvas {
    var c = baseIcon()

    c.fillRect(x: 14, y: 12, w: 24, h: 34)
    c.fillRect(x: 30, y: 12, w: 8, h: 8, value: false)
    c.fillRect(x: 31, y: 13, w: 6, h: 6)
    c.fillRect(x: 15, y: 24, w: 22, h: 3, value: false)
    c.fillRect(x: 15, y: 31, w: 19, h: 3, value: false)
    c.fillRect(x: 15, y: 38, w: 21, h: 3, value: false)
    c.fillRect(x: 14, y: 47, w: 18, h: 3)

    c.fillCircle(cx: 42, cy: 40, radius: 11)
    c.fillCircle(cx: 42, cy: 40, radius: 8, value: false)
    c.fillCircle(cx: 42, cy: 40, radius: 7)
    c.clearDiamond(cx: 39, cy: 37, radius: 2)
    c.sparkle(cx: 49, cy: 31, size: 3)
    c.sparkle(cx: 34, cy: 49, size: 2)
    c.hLine(x: 36, y: 51, length: 12)
    return c
}

func optionB() -> PixelCanvas {
    var c = baseIcon()

    c.ring(cx: 32, cy: 30, outer: 16, inner: 12)
    c.fillCircle(cx: 32, cy: 30, radius: 11)
    c.clearDiamond(cx: 27, cy: 25, radius: 3)
    c.sparkle(cx: 44, cy: 18, size: 4)
    c.sparkle(cx: 19, cy: 41, size: 3)

    c.fillRect(x: 22, y: 45, w: 20, h: 4)
    c.fillRect(x: 22, y: 51, w: 20, h: 3)
    c.vLine(x: 28, y: 44, length: 11, t: 3, value: false)
    c.vLine(x: 36, y: 44, length: 11, t: 3, value: false)

    c.fillRect(x: 26, y: 27, w: 12, h: 3, value: false)
    c.fillRect(x: 30, y: 23, w: 3, h: 14, value: false)
    return c
}

func optionC() -> PixelCanvas {
    var c = baseIcon()

    c.fillRect(x: 14, y: 11, w: 34, h: 40)
    c.fillRect(x: 20, y: 11, w: 3, h: 40, value: false)
    c.fillRect(x: 24, y: 17, w: 18, h: 3, value: false)
    c.fillRect(x: 24, y: 25, w: 16, h: 3, value: false)
    c.fillRect(x: 24, y: 33, w: 18, h: 3, value: false)
    c.fillRect(x: 24, y: 41, w: 12, h: 3, value: false)

    c.fillRect(x: 42, y: 14, w: 6, h: 10, value: false)
    c.fillRect(x: 43, y: 15, w: 4, h: 8)

    c.fillCircle(cx: 42, cy: 42, radius: 9)
    c.fillCircle(cx: 42, cy: 42, radius: 6, value: false)
    c.fillCircle(cx: 42, cy: 42, radius: 5)
    c.clearDiamond(cx: 39, cy: 39, radius: 2)
    c.sparkle(cx: 48, cy: 34, size: 3)

    c.hLine(x: 15, y: 52, length: 29)
    return c
}

func makeSheet(paths: [String], output: String) throws {
    let cardWidth: CGFloat = 350
    let margin: CGFloat = 26
    let size = CGSize(
        width: margin + CGFloat(paths.count) * cardWidth + CGFloat(paths.count - 1) * margin + margin,
        height: 520
    )

    let image = NSImage(size: size)
    image.lockFocus()
    dark.setFill()
    NSBezierPath(rect: CGRect(origin: .zero, size: size)).fill()

    let labels = ["A", "B", "C"]
    let captions = [
        "ledger + coin",
        "hero coin",
        "book + coin seal"
    ]

    let titleAttrs: [NSAttributedString.Key: Any] = [
        .font: NSFont.monospacedSystemFont(ofSize: 34, weight: .bold),
        .foregroundColor: light
    ]
    let captionAttrs: [NSAttributedString.Key: Any] = [
        .font: NSFont.monospacedSystemFont(ofSize: 20, weight: .medium),
        .foregroundColor: light.withAlphaComponent(0.8)
    ]

    for (index, path) in paths.enumerated() {
        let originX = margin + CGFloat(index) * (cardWidth + margin)
        let rect = CGRect(x: originX, y: 120, width: cardWidth, height: cardWidth)
        if let icon = NSImage(contentsOfFile: path) {
            icon.draw(in: rect)
        }

        let title = NSAttributedString(string: "OPTION \(labels[index])", attributes: titleAttrs)
        title.draw(at: CGPoint(x: originX + 56, y: 60))

        let caption = NSAttributedString(string: captions[index], attributes: captionAttrs)
        caption.draw(at: CGPoint(x: originX + 60, y: 28))
    }

    image.unlockFocus()

    guard
        let tiff = image.tiffRepresentation,
        let rep = NSBitmapImageRep(data: tiff),
        let png = rep.representation(using: .png, properties: [:])
    else {
        throw NSError(domain: "coin-ledger-v2", code: 2)
    }

    try png.write(to: URL(fileURLWithPath: output))
}

let root = FileManager.default.currentDirectoryPath
let outputDir = "\(root)/assets/icon-drafts-v2"
try FileManager.default.createDirectory(atPath: outputDir, withIntermediateDirectories: true)

let pathA = "\(outputDir)/coin-ledger-v2-option-a.png"
let pathB = "\(outputDir)/coin-ledger-v2-option-b.png"
let pathC = "\(outputDir)/coin-ledger-v2-option-c.png"
let sheet = "\(outputDir)/coin-ledger-v2-options-sheet.png"

try draw(canvas: optionA(), to: pathA)
try draw(canvas: optionB(), to: pathB)
try draw(canvas: optionC(), to: pathC)
try makeSheet(paths: [pathA, pathB, pathC], output: sheet)
