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

    mutating func hLine(x: Int, y: Int, length: Int, t: Int = 1, value: Bool = true) {
        fillRect(x: x, y: y, w: length, h: t, value: value)
    }

    mutating func vLine(x: Int, y: Int, length: Int, t: Int = 1, value: Bool = true) {
        fillRect(x: x, y: y, w: t, h: length, value: value)
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

    mutating func clearCorner(_ x: Int, _ y: Int) {
        set(x, y, false)
        set(x + 1, y, false)
        set(x, y + 1, false)
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
        throw NSError(domain: "coin-ledger-v3", code: 1)
    }

    try png.write(to: URL(fileURLWithPath: path))
}

func base() -> PixelCanvas {
    var c = PixelCanvas(width: 64, height: 64)
    c.frameRect(x: 6, y: 6, w: 52, h: 52, t: 3)
    c.clearCorner(6, 6)
    c.clearCorner(55, 6)
    c.clearCorner(6, 55)
    c.clearCorner(55, 55)
    return c
}

func optionA() -> PixelCanvas {
    var c = base()

    // ledger sheet
    c.fillRect(x: 15, y: 13, w: 24, h: 34)
    c.fillRect(x: 31, y: 13, w: 8, h: 8, value: false)
    c.fillRect(x: 32, y: 14, w: 6, h: 6)
    c.fillRect(x: 19, y: 22, w: 14, h: 3, value: false)
    c.fillRect(x: 19, y: 29, w: 13, h: 3, value: false)
    c.fillRect(x: 19, y: 36, w: 14, h: 3, value: false)

    // coin
    c.ring(cx: 43, cy: 41, outer: 10, inner: 7)
    c.fillCircle(cx: 43, cy: 41, radius: 6)
    c.clearDiamond(cx: 40, cy: 38, radius: 2)
    c.sparkle(cx: 50, cy: 31, size: 3)

    c.hLine(x: 18, y: 49, length: 26)
    return c
}

func optionB() -> PixelCanvas {
    var c = base()

    // hero coin
    c.ring(cx: 32, cy: 28, outer: 15, inner: 11)
    c.fillCircle(cx: 32, cy: 28, radius: 10)
    c.clearDiamond(cx: 27, cy: 23, radius: 3)
    c.sparkle(cx: 45, cy: 17, size: 4)
    c.sparkle(cx: 19, cy: 39, size: 3)

    // small ledger below
    c.fillRect(x: 20, y: 42, w: 24, h: 11)
    c.vLine(x: 27, y: 42, length: 11, t: 2, value: false)
    c.hLine(x: 22, y: 46, length: 20, t: 2, value: false)
    return c
}

func optionC() -> PixelCanvas {
    var c = base()

    // little book
    c.fillRect(x: 14, y: 14, w: 34, h: 34)
    c.vLine(x: 22, y: 14, length: 34, t: 2, value: false)
    c.fillRect(x: 27, y: 22, w: 15, h: 3, value: false)
    c.fillRect(x: 27, y: 29, w: 13, h: 3, value: false)
    c.fillRect(x: 27, y: 36, w: 15, h: 3, value: false)

    // coin seal
    c.ring(cx: 43, cy: 43, outer: 8, inner: 5)
    c.fillCircle(cx: 43, cy: 43, radius: 4)
    c.clearDiamond(cx: 41, cy: 41, radius: 1)
    c.sparkle(cx: 49, cy: 35, size: 3)

    c.hLine(x: 16, y: 52, length: 30)
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
        "sheet + coin",
        "coin first",
        "book + seal"
    ]

    let titleAttrs: [NSAttributedString.Key: Any] = [
        .font: NSFont.monospacedSystemFont(ofSize: 34, weight: .bold),
        .foregroundColor: light
    ]
    let captionAttrs: [NSAttributedString.Key: Any] = [
        .font: NSFont.monospacedSystemFont(ofSize: 20, weight: .medium),
        .foregroundColor: light.withAlphaComponent(0.82)
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
        caption.draw(at: CGPoint(x: originX + 88, y: 28))
    }

    image.unlockFocus()

    guard
        let tiff = image.tiffRepresentation,
        let rep = NSBitmapImageRep(data: tiff),
        let png = rep.representation(using: .png, properties: [:])
    else {
        throw NSError(domain: "coin-ledger-v3", code: 2)
    }

    try png.write(to: URL(fileURLWithPath: output))
}

let root = FileManager.default.currentDirectoryPath
let outputDir = "\(root)/assets/icon-drafts-v3"
try FileManager.default.createDirectory(atPath: outputDir, withIntermediateDirectories: true)

let pathA = "\(outputDir)/coin-ledger-v3-option-a.png"
let pathB = "\(outputDir)/coin-ledger-v3-option-b.png"
let pathC = "\(outputDir)/coin-ledger-v3-option-c.png"
let sheet = "\(outputDir)/coin-ledger-v3-options-sheet.png"

try draw(canvas: optionA(), to: pathA)
try draw(canvas: optionB(), to: pathB)
try draw(canvas: optionC(), to: pathC)
try makeSheet(paths: [pathA, pathB, pathC], output: sheet)
