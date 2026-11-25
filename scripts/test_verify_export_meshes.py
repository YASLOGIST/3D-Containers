"""Regression for articulated GLB bounds; run with Python's standard library."""
import json
import math
import pathlib
import struct
import tempfile
import unittest

from verify_export_meshes import glb


class GlbBoundsTest(unittest.TestCase):
    def test_rotated_triangle_uses_vertices_not_local_box_corners(self):
        # The triangle's local AABB includes (1,1,0), which is not a vertex.
        # After a 45-degree rotation its true Y extent is sqrt(0.5), not sqrt(2).
        vertices = struct.pack("<9f", 0, 0, 0, 1, 0, 0, 0, 1, 0)
        angle = math.pi / 4
        meta = {
            "asset": {"version": "2.0"},
            "buffers": [{"byteLength": len(vertices)}],
            "bufferViews": [{"buffer": 0, "byteLength": len(vertices)}],
            "accessors": [{"bufferView": 0, "componentType": 5126, "count": 3,
                           "type": "VEC3", "min": [0, 0, 0], "max": [1, 1, 0]}],
            "meshes": [{"primitives": [{"attributes": {"POSITION": 0}}]}],
            "nodes": [{"mesh": 0, "rotation": [0, 0, math.sin(angle / 2), math.cos(angle / 2)]}
                      for _ in range(11)],
            "scenes": [{"nodes": list(range(11))}], "scene": 0,
        }
        raw = json.dumps(meta).encode()
        raw += b" " * ((-len(raw)) % 4)
        payload = (struct.pack("<I4s", len(raw), b"JSON") + raw
                   + struct.pack("<I4s", len(vertices), b"BIN\x00") + vertices)
        data = struct.pack("<III", 0x46546C67, 2, 12 + len(payload)) + payload
        with tempfile.TemporaryDirectory() as directory:
            path = pathlib.Path(directory) / "rotated.glb"
            path.write_bytes(data)
            dims = glb(path)["dim"]
        self.assertEqual(dims, [1.4142, 0.7071, 0.0])


if __name__ == "__main__":
    unittest.main()
