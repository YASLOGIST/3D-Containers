#!/usr/bin/env python3
"""Inspect binary STL triangle topology without external dependencies.

Checks welded triangle edge incidence, winding and near-zero-area faces.
This is NOT a full manifold CAD certification: it cannot detect all
self-intersections, overlapping independent solids or physical tolerances.

Examples:
  python3 scripts/verify_stl_topology.py /tmp/uld360/ake.stl
  python3 scripts/verify_stl_topology.py --require-closed /tmp/uld360/*.stl
"""
import argparse
from collections import Counter
import json
import math
from pathlib import Path
import struct

# Compare float32 STL vertices to 0.1 micrometre; reported status is
# tolerance-dependent and should be reproduced with an independent tool.
WELD_DECIMALS = 7
NEAR_ZERO_AREA_M2 = 1e-10


def analyze(path: Path) -> dict:
    data = path.read_bytes()
    if len(data) < 84:
        raise ValueError(f"{path.name}: too short for binary STL")
    triangle_count = struct.unpack_from("<I", data, 80)[0]
    if len(data) != 84 + triangle_count * 50:
        raise ValueError(f"{path.name}: triangle count disagrees with file size")

    edges = Counter()
    orientations = Counter()
    near_zero = 0
    for offset in range(84, len(data), 50):
        points = [
            tuple(round(float(n), WELD_DECIMALS) for n in struct.unpack_from(
                "<fff", data, offset + 12 + 12 * i
            ))
            for i in range(3)
        ]
        if any(not math.isfinite(x) for p in points for x in p):
            raise ValueError(f"{path.name}: nonfinite vertex")
        a, b, c = points
        ab = [b[k] - a[k] for k in range(3)]
        ac = [c[k] - a[k] for k in range(3)]
        cross = [
            ab[1] * ac[2] - ab[2] * ac[1],
            ab[2] * ac[0] - ab[0] * ac[2],
            ab[0] * ac[1] - ab[1] * ac[0],
        ]
        area = math.sqrt(sum(x * x for x in cross)) / 2
        if area < NEAR_ZERO_AREA_M2:
            near_zero += 1

        for first, second in ((a, b), (b, c), (c, a)):
            edge = (first, second) if first <= second else (second, first)
            edges[edge] += 1
            orientations[edge] += 1 if first <= second else -1

    open_edges = sum(count == 1 for count in edges.values())
    nonmanifold = sum(count > 2 for count in edges.values())
    wrong_winding = sum(
        count == 2 and orientations[edge] != 0
        for edge, count in edges.items()
    )
    return {
        "file": path.name,
        "triangles": triangle_count,
        "boundary_edges": open_edges,
        "nonmanifold_edges": nonmanifold,
        "near_zero_area_triangles": near_zero,
        "winding_mismatch_edges": wrong_winding,
        "edge_closed": open_edges == 0 and nonmanifold == 0
        and near_zero == 0 and wrong_winding == 0,
        "weld_decimals_m": WELD_DECIMALS,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("files", nargs="+", type=Path, help="binary STL files")
    parser.add_argument(
        "--require-closed",
        action="store_true",
        help="nonzero exit if any mesh is not edge-closed/manifold",
    )
    args = parser.parse_args()
    all_closed = True
    for file in args.files:
        result = analyze(file)
        print(json.dumps(result, separators=(",", ":")))
        all_closed = all_closed and result["edge_closed"]
    return 0 if all_closed or not args.require_closed else 1


if __name__ == "__main__":
    raise SystemExit(main())
