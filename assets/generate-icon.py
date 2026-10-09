"""Render the code-native Subloom flower into a store-sized PNG. Python stdlib only."""
import math
import struct
import zlib
from pathlib import Path

size = 1024
background = (225, 243, 234)
flower = (32, 91, 65)
rows = bytearray()
directions = [(math.cos(i * math.pi / 4), math.sin(i * math.pi / 4)) for i in range(8)]
for y in range(size):
    rows.append(0)
    for x in range(size):
        px, py = x - size / 2, y - size / 2
        inside = any(((px * c + py * s - 145) / 188) ** 2 + ((-px * s + py * c) / 93) ** 2 <= 1 for c, s in directions)
        rows.extend(flower if inside else background)

def chunk(kind, data):
    return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data))

png = b"\x89PNG\r\n\x1a\n"
png += chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0))
png += chunk(b"IDAT", zlib.compress(bytes(rows), 9)) + chunk(b"IEND", b"")
Path(__file__).with_name("icon.png").write_bytes(png)
