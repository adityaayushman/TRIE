"""Geospatial primitives for black-spot aggregation.

Deliberately dependency-free: no GIS stack, no map-matching. Indian near-miss
telemetry arrives as bare GPS fixes, and the aggregation below needs only
distance and a stable spatial bin.
"""
from __future__ import annotations

import math
from dataclasses import dataclass

EARTH_RADIUS_M = 6_371_000.0

# A black spot on a National Highway is officially a 500m stretch (MoRTH/iRAD).
# Matching that unit keeps our nominations directly comparable to the official
# list rather than to an invented geometry.
DEFAULT_CELL_SIZE_M = 500.0


def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance in metres between two WGS84 points."""
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (
        math.sin(delta_phi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2
    )
    return 2 * EARTH_RADIUS_M * math.asin(math.sqrt(a))


@dataclass(frozen=True)
class MetricGrid:
    """Bins GPS fixes into fixed-size cells via a sinusoidal projection.

    Longitude is scaled by cos(latitude) so a cell is the requested size in
    metres rather than in degrees — 500m of longitude is ~0.0045° at Kanyakumari
    but ~0.0057° at Srinagar, and ignoring that would silently stretch cells
    across India.

    Caveat worth stating in any write-up: this is areal binning, while black
    spots are *linear* features along a carriageway. A cell can therefore merge
    two carriageways of a divided highway, or split a hotspot across a boundary
    (the modifiable areal unit problem). Map-matching to road geometry is the
    principled fix; this is the honest approximation until then.
    """

    cell_size_m: float = DEFAULT_CELL_SIZE_M

    def __post_init__(self) -> None:
        if self.cell_size_m <= 0:
            raise ValueError(f"cell_size_m must be positive, got {self.cell_size_m}")

    def cell_of(self, latitude: float, longitude: float) -> tuple[int, int]:
        """The grid cell containing a point. Deterministic and stateless."""
        latitude_rad = math.radians(latitude)
        northing_m = latitude_rad * EARTH_RADIUS_M
        easting_m = math.radians(longitude) * EARTH_RADIUS_M * math.cos(latitude_rad)
        return (
            math.floor(easting_m / self.cell_size_m),
            math.floor(northing_m / self.cell_size_m),
        )


def centroid(points: list[tuple[float, float]]) -> tuple[float, float]:
    """Mean latitude/longitude of a cluster.

    Adequate because callers only ever pass points already inside one cell,
    where the wrap-around and projection distortions a global centroid would
    suffer from cannot arise.
    """
    if not points:
        raise ValueError("centroid of no points")
    return (
        sum(latitude for latitude, _ in points) / len(points),
        sum(longitude for _, longitude in points) / len(points),
    )
