"""Generate the PWA / Apple touch icons with the Python standard library only.

Red (#DC2626) square with a white ball and thin red seams. Run: python3 scripts/make-icons.py
"""
import math
import struct
import zlib
from pathlib import Path

RED = (0xDC, 0x26, 0x26)
WHITE = (0xFF, 0xFF, 0xFF)


def png_bytes(size: int) -> bytes:
    cx = cy = size / 2
    ball_r = size * 0.33
    seam_w = max(1.5, size * 0.02)
    rows = []
    for y in range(size):
        row = bytearray([0])  # filter type 0
        for x in range(size):
            dx, dy = x + 0.5 - cx, y + 0.5 - cy
            d = math.hypot(dx, dy)
            color = RED
            if d <= ball_r:
                color = WHITE
                # two curved seams + one horizontal seam, drawn as thin red bands
                for sx in (-1, 1):
                    arc_cx = cx + sx * ball_r * 1.15
                    if abs(math.hypot(x + 0.5 - arc_cx, dy) - ball_r * 0.95) < seam_w:
                        color = RED
                if abs(dy) < seam_w * 0.6:
                    color = RED
            row += bytes(color)
        rows.append(bytes(row))
    raw = b"".join(rows)

    def chunk(tag: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    ihdr = struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")


if __name__ == "__main__":
    out = Path(__file__).resolve().parent.parent / "public"
    for name, size in (("apple-touch-icon.png", 180), ("icon-192.png", 192), ("icon-512.png", 512)):
        (out / name).write_bytes(png_bytes(size))
        print("wrote", out / name)
