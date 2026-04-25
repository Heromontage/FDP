"""
bridge_server.py  —  Kinetic Sentinel Integration Bridge
=========================================================
Sits between the ESP32 robot (172.20.10.6) and the React web app.
  • Polls the ESP32 for (x, y, theta) + sensor distances
  • Accumulates the robot's path
  • Runs real-time concave-shape detection (same logic as is_concave.py)
  • Serves a JSON API at http://localhost:5000/sensordata for the React app
  • Optionally writes positions.csv (for compatibility with your Python scripts)

Usage:
    python bridge_server.py [ESP_IP]

    ESP_IP defaults to 172.20.10.6 — pass a different IP as CLI arg if needed.
"""

import sys
import time
import threading
import math
import csv
import os

import numpy as np
import requests
from flask import Flask, jsonify
from flask_cors import CORS

# ── Config ────────────────────────────────────────────────────────────────────
ESP_IP          = sys.argv[1] if len(sys.argv) > 1 else "172.20.10.6"
POLL_INTERVAL   = 0.5          # seconds between ESP32 polls
MAX_PATH_POINTS = 300          # keep last N path points in memory
WRITE_CSV       = True         # also write positions.csv for your Python scripts
CSV_PATH        = "positions.csv"

# ── Shared state (written by background thread, read by Flask) ────────────────
state = {
    "x":          0,
    "y":          0,
    "theta":      0.0,
    "front_dist": 0.0,   # cm – from ESP32 /sensors endpoint (if available)
    "side_dist":  0.0,   # cm
    "shape":      "INITIALIZING...",
    "path":       [],    # list of {"x": int, "y": int}
    "is_complete": False,
    "connected":  False,
    "error":      None,
}
state_lock = threading.Lock()

# ── Concave detection (mirrors is_concave.py) ─────────────────────────────────
def is_concave_polygon(vertices):
    """
    Returns True if the polygon formed by `vertices` has at least one
    'dent' (i.e., one vertex closer to the centroid than its neighbours).
    """
    if len(vertices) < 4:
        return False

    xs = [v[0] for v in vertices]
    ys = [v[1] for v in vertices]
    cx = sum(xs) / len(vertices)
    cy = sum(ys) / len(vertices)

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
    """
    Sample up to ~24 evenly-spaced points from the accumulated path
    and run concave detection.
    """
    if len(path) < 5:
        return "SCANNING..."

    step     = max(1, len(path) // 24)
    sampled  = [[p["x"], p["y"]] for p in path[::step]]

    if is_concave_polygon(sampled):
        return "CONCAVE SHAPE DETECTED"
    return "CONVEX SHAPE DETECTED"


# ── CSV helpers (keeps compatibility with your existing Python scripts) ────────
def csv_init():
    with open(CSV_PATH, "w", newline="") as f:
        csv.DictWriter(f, ["x", "y"]).writeheader()


def csv_append(x, y):
    with open(CSV_PATH, "a", newline="") as f:
        csv.DictWriter(f, ["x", "y"]).writerow({"x": x, "y": y})


# ── Background polling thread ─────────────────────────────────────────────────
def poll_esp():
    prev_x = prev_y = None

    while True:
        try:
            # ── Primary endpoint: x y theta (plain text) ──────────────────
            r = requests.get(f"http://{ESP_IP}/", timeout=2)
            r.raise_for_status()

            parts = r.text.strip().split()
            x     = int(parts[0])
            y     = int(parts[1])
            theta = float(parts[2])

            with state_lock:
                state["x"]         = x
                state["y"]         = y
                state["theta"]     = theta
                state["connected"] = True
                state["error"]     = None

                # Append new position if it moved
                if x != prev_x or y != prev_y:
                    state["path"].append({"x": x, "y": y})
                    if len(state["path"]) > MAX_PATH_POINTS:
                        state["path"].pop(0)
                    if WRITE_CSV and prev_x is not None:
                        csv_append(x, y)
                    prev_x, prev_y = x, y

                # Real-time shape detection
                if len(state["path"]) >= 5:
                    state["shape"] = detect_shape_from_path(state["path"])

                # Robot completed a full 360° rotation → finalize
                if theta >= 360 and not state["is_complete"]:
                    state["is_complete"] = True
                    state["shape"]       = detect_shape_from_path(state["path"])
                    print(f"[bridge] Robot completed rotation. Shape: {state['shape']}")

        except requests.exceptions.ConnectionError:
            with state_lock:
                state["connected"] = False
                state["error"]     = "ESP32 unreachable"
        except Exception as e:
            with state_lock:
                state["connected"] = False
                state["error"]     = str(e)

        # ── Optional: fetch sensor distances from /sensors ────────────────
        # (only available if you add that route to the updated ESPCode.ino)
        try:
            rs = requests.get(f"http://{ESP_IP}/sensors", timeout=1)
            if rs.status_code == 200:
                d = rs.json()
                with state_lock:
                    state["front_dist"] = d.get("front_dist", 0.0)
                    state["side_dist"]  = d.get("side_dist",  0.0)
        except Exception:
            pass  # /sensors is optional — no crash if not available

        time.sleep(POLL_INTERVAL)


# ── Flask API ─────────────────────────────────────────────────────────────────
app = Flask(__name__)
CORS(app)   # allow React dev server (localhost:5173) to fetch


@app.route("/sensordata")
def sensordata():
    """
    JSON consumed by the React web app.
    Shape:
    {
      x, y, theta,          — robot position & heading
      front_dist,           — front ultrasonic (cm)
      side_dist,            — side ultrasonic (cm)
      shape,                — "CONCAVE SHAPE DETECTED" | "CONVEX SHAPE DETECTED" | ...
      path: [{x,y}, ...],   — accumulated positions
      is_complete,          — true once robot finished 360° sweep
      connected,            — ESP32 reachable?
      error                 — last error string | null
    }
    """
    with state_lock:
        return jsonify(dict(state))


@app.route("/reset", methods=["GET", "POST"])
def reset():
    """Clear accumulated path and restart detection."""
    with state_lock:
        state["path"]        = []
        state["shape"]       = "INITIALIZING..."
        state["is_complete"] = False
        state["x"]           = 0
        state["y"]           = 0
        state["theta"]       = 0.0
    if WRITE_CSV:
        csv_init()
    print("[bridge] State reset.")
    return jsonify({"status": "reset"})


@app.route("/status")
def status():
    with state_lock:
        return jsonify({
            "connected":   state["connected"],
            "path_length": len(state["path"]),
            "shape":       state["shape"],
            "error":       state["error"],
        })


# ── Entry point ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    if WRITE_CSV:
        csv_init()

    print(f"[bridge] Polling ESP32 at  http://{ESP_IP}/")
    print(f"[bridge] Serving React app at  http://localhost:5000/sensordata")

    t = threading.Thread(target=poll_esp, daemon=True)
    t.start()

    app.run(host="0.0.0.0", port=5000, debug=False)
