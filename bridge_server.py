"""
bridge_server.py  —  Kinetic Sentinel Integration Bridge  (FIXED)
=================================================================
Changes from original:
  1. Parses 6 values from ESP: x y theta frontDist sideFrontDist sideBackDist
  2. Exposes sensor distances via /sensordata so React can display them.
  3. Fixes false-positive concave detection on straight-line paths.
     The original `or` check only caught perfectly axis-aligned paths.
     A diagonal straight line (x varies slightly) bypassed the guard and
     hit is_concave_polygon(), which ALWAYS returns True for collinear
     points (midpoint has the minimum centroid distance → local minimum).
     Fix: added a proper linearity test using the cross-product area method.
"""

import sys, time, threading, math, csv, os, socket
import numpy as np
import requests
from flask import Flask, jsonify
from flask_cors import CORS

# ── Config ──────────────────────────────────────────────────────────────────
ESP_IP          = sys.argv[1] if len(sys.argv) > 1 else "172.20.10.6"
PORT            = int(sys.argv[2]) if len(sys.argv) > 2 else 5001
POLL_INTERVAL   = 0.5
MAX_PATH_POINTS = 300
WRITE_CSV       = True
CSV_PATH        = "positions.csv"

# ── Shared state ─────────────────────────────────────────────────────────────
state = {
    "x":              0,
    "y":              0,
    "theta":          0.0,
    "shape":          "INITIALIZING...",
    "path":           [],
    "is_complete":    False,
    "connected":      False,
    "error":          None,
    # ↓ NEW — sensor distances now included
    "front_dist":     0.0,
    "side_front_dist": 0.0,
    "side_back_dist":  0.0,
}
state_lock = threading.Lock()


# ── Shape detection — FIXED ──────────────────────────────────────────────────

def _polygon_area(vertices):
    """Signed area via the shoelace formula."""
    n = len(vertices)
    area = 0.0
    for i in range(n):
        x0, y0 = vertices[i]
        x1, y1 = vertices[(i + 1) % n]
        area += x0 * y1 - x1 * y0
    return abs(area) / 2.0


def _path_length(vertices):
    total = 0.0
    for i in range(1, len(vertices)):
        dx = vertices[i][0] - vertices[i - 1][0]
        dy = vertices[i][1] - vertices[i - 1][1]
        total += math.sqrt(dx * dx + dy * dy)
    return total


def is_roughly_linear(vertices, area_ratio_threshold=0.04):
    """
    True when the sampled path is roughly a straight line.

    Method: compute the polygon area (shoelace) and compare it to the square
    of the path length.  A genuine closed shape has area ~ length²/4π,
    while a nearly-straight path has area ≈ 0.  The ratio area / length²
    is essentially zero for collinear or near-collinear point sets.

    area_ratio_threshold=0.04 means: if the enclosed area is less than
    4 % of length², call it a straight line.  Tune upward if short curved
    segments are being missed; tune downward if gentle curves are mislabelled.
    """
    if len(vertices) < 3:
        return True
    length = _path_length(vertices)
    if length < 1.0:
        return True
    area = _polygon_area(vertices)
    return (area / (length * length)) < area_ratio_threshold


def is_concave_polygon(vertices):
    """
    Original centroid-distance algorithm — unchanged, but now only called
    AFTER is_roughly_linear() has confirmed the path is not a straight line.
    """
    if len(vertices) < 4:
        return False
    xs  = [v[0] for v in vertices]
    ys  = [v[1] for v in vertices]
    cx  = sum(xs) / len(vertices)
    cy  = sum(ys) / len(vertices)
    distances = [math.sqrt((x - cx) ** 2 + (y - cy) ** 2) for x, y in vertices]
    n = len(distances)
    for i in range(n):
        prev_d = distances[(i - 1) % n]
        curr_d = distances[i]
        next_d = distances[(i + 1) % n]
        if curr_d < prev_d and curr_d < next_d:
            return True
    return False


def detect_shape_from_path(path):
    if len(path) < 10:
        return "SCANNING..."

    xs = [p["x"] for p in path]
    ys = [p["y"] for p in path]

    x_range = max(xs) - min(xs)
    y_range = max(ys) - min(ys)
    total_displacement = math.sqrt(x_range ** 2 + y_range ** 2)

    # Robot has barely moved — keep scanning
    if total_displacement < 8:
        return "SCANNING..."

    # ── FIX: robust straight-line guard ──────────────────────────────────────
    # Original code:  if (x_range < 5) or (y_range < 5): → only catches
    # perfectly vertical / horizontal motion. A diagonal path where both
    # x_range and y_range exceed 5 (e.g., robot drifts slightly while
    # going "straight") falls through to is_concave_polygon() and always
    # gets flagged concave.
    #
    # New approach: sample the path, then measure how much enclosed area
    # the sampled polygon has relative to its perimeter.  A straight line
    # has area ≈ 0; a real shape has area > 0.
    # ─────────────────────────────────────────────────────────────────────────
    step    = max(1, len(path) // 24)
    sampled = [[p["x"], p["y"]] for p in path[::step]]

    if is_roughly_linear(sampled):
        return "MOVING IN STRAIGHT LINE..."

    if is_concave_polygon(sampled):
        return "CONCAVE SHAPE DETECTED"
    return "CONVEX SHAPE DETECTED"


# ── CSV helpers ───────────────────────────────────────────────────────────────
def csv_init():
    with open(CSV_PATH, "w", newline="") as f:
        csv.DictWriter(f, ["x", "y"]).writeheader()

def csv_append(x, y):
    with open(CSV_PATH, "a", newline="") as f:
        csv.DictWriter(f, ["x", "y"]).writerow({"x": x, "y": y})


# ── Background polling thread ─────────────────────────────────────────────────
def poll_esp():
    prev_x = prev_y = None
    print(f"[bridge] Polling http://{ESP_IP}/ every {POLL_INTERVAL}s")

    while True:
        try:
            r = requests.get(f"http://{ESP_IP}/", timeout=2)
            r.raise_for_status()

            parts = r.text.strip().split()

            # Expect at least 3 values: x y theta
            # Now also accept 6: x y theta frontDist sideFrontDist sideBackDist
            if len(parts) < 3:
                raise ValueError(f"Unexpected ESP response: '{r.text.strip()}'")

            x     = int(float(parts[0]))
            y     = int(float(parts[1]))
            theta = float(parts[2])

            # ── NEW: parse sensor distances if present ─────────────────────
            front_dist      = float(parts[3]) if len(parts) > 3 else 0.0
            side_front_dist = float(parts[4]) if len(parts) > 4 else 0.0
            side_back_dist  = float(parts[5]) if len(parts) > 5 else 0.0

            with state_lock:
                state["x"]              = x
                state["y"]              = y
                state["theta"]          = theta
                state["front_dist"]     = round(front_dist, 1)
                state["side_front_dist"] = round(side_front_dist, 1)
                state["side_back_dist"]  = round(side_back_dist, 1)
                state["connected"]      = True
                state["error"]          = None

                if x != prev_x or y != prev_y:
                    state["path"].append({"x": x, "y": y})
                    if len(state["path"]) > MAX_PATH_POINTS:
                        state["path"].pop(0)
                    if WRITE_CSV and prev_x is not None:
                        csv_append(x, y)
                    prev_x, prev_y = x, y

                if len(state["path"]) >= 10:
                    state["shape"] = detect_shape_from_path(state["path"])

                if theta >= 360 and not state["is_complete"]:
                    state["is_complete"] = True
                    state["shape"]       = detect_shape_from_path(state["path"])
                    print(f"[bridge] Rotation complete. Shape: {state['shape']}")

        except requests.exceptions.ConnectionError:
            with state_lock:
                state["connected"] = False
                state["error"]     = "ESP32 unreachable"
        except Exception as e:
            with state_lock:
                state["connected"] = False
                state["error"]     = str(e)

        time.sleep(POLL_INTERVAL)


# ── Flask API ─────────────────────────────────────────────────────────────────
app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

@app.route("/sensordata")
def sensordata():
    with state_lock:
        return jsonify(dict(state))

@app.route("/reset", methods=["GET", "POST"])
def reset():
    with state_lock:
        state["path"]           = []
        state["shape"]          = "INITIALIZING..."
        state["is_complete"]    = False
        state["x"]              = 0
        state["y"]              = 0
        state["theta"]          = 0.0
        state["front_dist"]     = 0.0
        state["side_front_dist"] = 0.0
        state["side_back_dist"]  = 0.0
    if WRITE_CSV:
        csv_init()
    print("[bridge] State reset.")
    return jsonify({"status": "reset"})

@app.route("/status")
def status():
    with state_lock:
        return jsonify({
            "connected":      state["connected"],
            "path_length":    len(state["path"]),
            "shape":          state["shape"],
            "error":          state["error"],
            "side_front_dist": state["side_front_dist"],
            "side_back_dist":  state["side_back_dist"],
        })

@app.route("/health")
def health():
    return jsonify({"ok": True, "port": PORT, "esp_ip": ESP_IP})


def check_port(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        try:
            s.bind(("0.0.0.0", port))
            return True
        except OSError:
            return False


if __name__ == "__main__":
    if not check_port(PORT):
        print(f"\n[ERROR] Port {PORT} is already in use!")
        sys.exit(1)
    if WRITE_CSV:
        csv_init()

    t = threading.Thread(target=poll_esp, daemon=True)
    t.start()

    app.run(host="0.0.0.0", port=PORT, debug=False, use_reloader=False)