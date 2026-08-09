import AppKit
import AVFoundation
import CoreVideo
import Foundation

let arguments = CommandLine.arguments
guard arguments.count >= 4 else {
  fputs("Usage: swift create-product-film.swift <input.png> <output.mp4> <motion>\n", stderr)
  exit(2)
}

let inputPath = arguments[1]
let outputPath = arguments[2]
let motion = arguments[3]
let width = 1280
let height = 720
let fps: Int32 = 30
let frameCount = Int(fps) * 7

guard let sourceImage = NSImage(contentsOfFile: inputPath) else {
  fputs("Unable to read source image: \(inputPath)\n", stderr)
  exit(3)
}

var sourceRect = NSRect(origin: .zero, size: sourceImage.size)
guard let cgImage = sourceImage.cgImage(forProposedRect: &sourceRect, context: nil, hints: nil) else {
  fputs("Unable to decode source image.\n", stderr)
  exit(4)
}

let outputURL = URL(fileURLWithPath: outputPath)
try? FileManager.default.removeItem(at: outputURL)
let writer = try AVAssetWriter(outputURL: outputURL, fileType: .mp4)
let input = AVAssetWriterInput(
  mediaType: .video,
  outputSettings: [
    AVVideoCodecKey: AVVideoCodecType.h264,
    AVVideoWidthKey: width,
    AVVideoHeightKey: height,
    AVVideoCompressionPropertiesKey: [
      AVVideoAverageBitRateKey: 3_600_000,
      AVVideoExpectedSourceFrameRateKey: fps,
      AVVideoMaxKeyFrameIntervalKey: fps * 2,
      AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel,
    ],
  ]
)
input.expectsMediaDataInRealTime = false

let adaptor = AVAssetWriterInputPixelBufferAdaptor(
  assetWriterInput: input,
  sourcePixelBufferAttributes: [
    kCVPixelBufferPixelFormatTypeKey as String: Int(kCVPixelFormatType_32BGRA),
    kCVPixelBufferWidthKey as String: width,
    kCVPixelBufferHeightKey as String: height,
    kCVPixelBufferCGImageCompatibilityKey as String: true,
    kCVPixelBufferCGBitmapContextCompatibilityKey as String: true,
  ]
)

guard writer.canAdd(input) else {
  fputs("Video writer cannot accept input settings.\n", stderr)
  exit(5)
}
writer.add(input)
guard writer.startWriting() else {
  fputs("Unable to start video writer: \(writer.error?.localizedDescription ?? "unknown error")\n", stderr)
  exit(6)
}
writer.startSession(atSourceTime: .zero)

func smoothstep(_ value: CGFloat) -> CGFloat {
  let clamped = min(max(value, 0), 1)
  return clamped * clamped * (3 - 2 * clamped)
}

for frame in 0..<frameCount {
  while !input.isReadyForMoreMediaData {
    Thread.sleep(forTimeInterval: 0.004)
  }

  guard let pool = adaptor.pixelBufferPool else {
    fputs("Pixel-buffer pool unavailable.\n", stderr)
    exit(7)
  }
  var optionalBuffer: CVPixelBuffer?
  guard CVPixelBufferPoolCreatePixelBuffer(nil, pool, &optionalBuffer) == kCVReturnSuccess,
        let buffer = optionalBuffer else {
    fputs("Unable to create a video frame.\n", stderr)
    exit(8)
  }

  CVPixelBufferLockBaseAddress(buffer, [])
  defer { CVPixelBufferUnlockBaseAddress(buffer, []) }
  guard let baseAddress = CVPixelBufferGetBaseAddress(buffer),
        let context = CGContext(
          data: baseAddress,
          width: width,
          height: height,
          bitsPerComponent: 8,
          bytesPerRow: CVPixelBufferGetBytesPerRow(buffer),
          space: CGColorSpaceCreateDeviceRGB(),
          bitmapInfo: CGImageAlphaInfo.premultipliedFirst.rawValue | CGBitmapInfo.byteOrder32Little.rawValue
        ) else {
    fputs("Unable to create frame canvas.\n", stderr)
    exit(9)
  }

  let rawProgress = CGFloat(frame) / CGFloat(max(frameCount - 1, 1))
  let progress = smoothstep(rawProgress)
  let zoom = 1.015 + 0.085 * progress
  let sourceWidth = CGFloat(cgImage.width)
  let sourceHeight = CGFloat(cgImage.height)
  let baseScale = max(CGFloat(width) / sourceWidth, CGFloat(height) / sourceHeight)
  let drawWidth = sourceWidth * baseScale * zoom
  let drawHeight = sourceHeight * baseScale * zoom
  let overflowX = max(drawWidth - CGFloat(width), 0)
  let overflowY = max(drawHeight - CGFloat(height), 0)

  var panX: CGFloat = 0
  var panY: CGFloat = 0
  switch motion {
  case "left":
    panX = overflowX * (0.42 - progress * 0.84)
    panY = overflowY * 0.12
  case "rise":
    panX = overflowX * -0.2
    panY = overflowY * (-0.36 + progress * 0.72)
  default:
    panX = overflowX * (-0.38 + progress * 0.76)
    panY = overflowY * -0.08
  }

  context.setFillColor(CGColor(gray: 0.03, alpha: 1))
  context.fill(CGRect(x: 0, y: 0, width: width, height: height))
  context.interpolationQuality = .high
  context.draw(
    cgImage,
    in: CGRect(
      x: (CGFloat(width) - drawWidth) / 2 + panX,
      y: (CGFloat(height) - drawHeight) / 2 + panY,
      width: drawWidth,
      height: drawHeight
    )
  )

  let time = CMTime(value: CMTimeValue(frame), timescale: fps)
  guard adaptor.append(buffer, withPresentationTime: time) else {
    fputs("Unable to append frame \(frame): \(writer.error?.localizedDescription ?? "unknown error")\n", stderr)
    exit(10)
  }
}

input.markAsFinished()
let semaphore = DispatchSemaphore(value: 0)
writer.finishWriting { semaphore.signal() }
semaphore.wait()

guard writer.status == .completed else {
  fputs("Video encoding failed: \(writer.error?.localizedDescription ?? "unknown error")\n", stderr)
  exit(11)
}

print("Created \(outputPath)")
