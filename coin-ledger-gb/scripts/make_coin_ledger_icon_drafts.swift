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
        guard radius >= 0 else { return }
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

    mutating func ditherRect(x: Int, y: Int, w: Int, h: Int, offset: Int = 0) {
        guard w > 0, h > 0 else { return }
        for yy in y..<(y + h) {
            for xx in x..<(x + w) {
                if (xx + yy + offset) % 2 == 0 {
                    set(xx, yy, true)
                }
            }
        }
    }

    mutating func cutCornerFrame() {
        let cuts = [
            (2, 2), (3, 2), (2, 3),
            (29, 2), (28, 2), (29, 3),
            (2, 29), (2, 28), (3, 29),
            (29, 29), (28, 29), (29, 28)
        ]
        cuts.forEach { set($0.0, $0.1, false) }
    }
}

let dark = NSColor(calibratedRed: 0x1d.cg, green: 0x24.cg, blue: 0x14.cg, alpha: 1)
let light = NSColor(calibratedRed: 0xc9.cg, green: 0xd1.cg, blue: 0x8d.cg, alpha: 1)

extension Int {
    var cg: CGFloat { CGFloat(self) / 255.0 }
}

func draw(canvas: PixelCanvas, to path: String, scale: Int = 16) throws {
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
        throw NSError(domain: "coin-ledger", code: 1)
    }

    try png.write(to: URL(fileURLWithPath: path))
}

func makeOptionA() -> PixelCanvas {
    var c = PixelCanvas(width: 32, height: 32)
    c.frameRect(x: 2, y: 2, w: 28, h: 28, t: 2)
    c.cutCornerFrame()

    c.fillRect(x: 7, y: 5, w: 14, h: 18)
    c.fillRect(x: 18, y: 5, w: 3, h: 3, value: false)
    c.set(20, 6)
    c.set(19, 7)
    c.set(18, 8)

    c.fillRect(x: 9, y: 10, w: 8, h: 1, value: false)
    c.fillRect(x: 9, y: 13, w: 9, h: 1, value: false)
    c.fillRect(x: 9, y: 16, w: 7, h: 1, value: false)
    c.fillRect(x: 9, y: 19, w: 8, h: 1, value: false)

    c.fillCircle(cx: 22, cy: 22, radius: 5)
    c.fillCircle(cx: 22, cy: 22, radius: 3, value: false)
    c.hLine(x: 20, y: 22, length: 5, value: false)
    c.vLine(x: 22, y: 20, length: 5, value: false)

    c.hLine(x: 18, y: 27, length: 8)
    return c
}

func makeOptionB() -> PixelCanvas {
    var c = PixelCanvas(width: 32, height: 32)
    c.frameRect(x: 2, y: 2, w: 28, h: 28, t: 2)
    c.cutCornerFrame()
    c.frameRect(x: 6, y: 6, w: 20, h: 20, t: 1)
    c.ditherRect(x: 8, y: 8, w: 16, h: 16, offset: 1)

    c.fillCircle(cx: 16, cy: 15, radius: 6)
    c.fillCircle(cx: 16, cy: 15, radius: 3, value: false)
    c.fillRect(x: 14, y: 9, w: 4, h: 12, value: false)
    c.fillRect(x: 11, y: 13, w: 10, h: 4, value: false)

    c.hLine(x: 10, y: 24, length: 12)
    c.hLine(x: 9, y: 27, length: 14)
    c.vLine(x: 13, y: 23, length: 5)
    c.vLine(x: 18, y: 23, length: 5)
    return c
}

func makeOptionC() -> PixelCanvas {
    var c = PixelCanvas(width: 32, height: 32)
    c.frameRect(x: 2, y: 2, w: 28, h: 28, t: 2)
    c.cutCornerFrame()

    c.fillRect(x: 8, y: 5, w: 16, h: 22)
    c.fillRect(x: 11, y: 5, w: 1, h: 22, value: false)
    c.fillRect(x: 8, y: 8, w: 16, h: 1, value: false)
    c.fillRect(x: 8, y: 23, w: 16, h: 1, value: false)
    c.fillRect(x: 18, y: 11, w: 3, h: 10, value: false)

    c.fillCircle(cx: 17, cy: 17, radius: 4)
    c.fillCircle(cx: 17, cy: 17, radius: 2, value: false)
    c.vLine(x: 17, y: 14, length: 7, value: false)
    c.hLine(x: 14, y: 17, length: 7, value: false)

    c.fillRect(x: 21, y: 6, w: 3, h: 6, value: false)
    c.fillRect(x: 21, y: 7, w: 1, h: 4)
    return c
}

func makeSheet(paths: [String], output: String) throws {
    let cardSize = CGSize(width: 300, height: 360)
    let margin: CGFloat = 28
    let size = CGSize(
        width: margin + CGFloat(paths.count) * cardSize.width + CGFloat(paths.count - 1) * margin + margin,
        height: 420
    )

    let image = NSImage(size: size)
    image.lockFocus()
    dark.setFill()
    NSBezierPath(rect: CGRect(origin: .zero, size: size)).fill()

    let labels = ["A", "B", "C"]
    let labelAttrs: [NSAttributedString.Key: Any] = [
        .font: NSFont.monospacedSystemFont(ofSize: 32, weight: .bold),
        .foregroundColor: light
    ]

    for (index, path) in paths.enumerated() {
        let originX = margin + CGFloat(index) * (cardSize.width + margin)
        let rect = CGRect(x: originX, y: 70, width: cardSize.width, height: cardSize.width)
        if let icon = NSImage(contentsOfFile: path) {
            icon.draw(in: rect)
        }
        let label = NSAttributedString(string: "OPTION \(labels[index])", attributes: labelAttrs)
        label.draw(at: CGPoint(x: originX + 66, y: 26))
    }

    image.unlockFocus()

    guard
        let tiff = image.tiffRepresentation,
        let rep = NSBitmapImageRep(data: tiff),
        let png = rep.representation(using: .png, properties: [:])
    else {
        throw NSError(domain: "coin-ledger", code: 2)
    }

    try png.write(to: URL(fileURLWithPath: output))
}

let root = FileManager.default.currentDirectoryPath
let outputDir = "\(root)/assets/icon-drafts"
try FileManager.default.createDirectory(atPath: outputDir, withIntermediateDirectories: true)

let optionAPath = "\(outputDir)/coin-ledger-option-a.png"
let optionBPath = "\(outputDir)/coin-ledger-option-b.png"
let optionCPath = "\(outputDir)/coin-ledger-option-c.png"
let sheetPath = "\(outputDir)/coin-ledger-options-sheet.png"

try draw(canvas: makeOptionA(), to: optionAPath)
try draw(canvas: makeOptionB(), to: optionBPath)
try draw(canvas: makeOptionC(), to: optionCPath)
try makeSheet(paths: [optionAPath, optionBPath, optionCPath], output: sheetPath)
