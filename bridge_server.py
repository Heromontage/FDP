"""
bridge_server.py  —  Kinetic Sentinel Integration Bridge
=========================================================
Sits between the ESP32 robot (172.20.10.6) and the React web app.
  • Polls the ESP32 for (x, y, theta) + sensor distances
  • Accumulates the robot's path
  • Runs real-time concave-shape detection (same logic as is_concave.py)
  • Serves a JSON API at http://localhost:5001/sensordata for the React app
  • Optionally writes positions.csv (for compatibility with your Python scripts)

Usage:
    python bridge_server.py [ESP_IP] [PORT]

    ESP_IP defaults to 172.20.10.6
    PORT   defaults to 5001  (changed from 5000 to avoid macOS AirPlay conflict)
"""

import sys
import time
import threading
import math
import csv
import os
import socket

import numpy as np
import requests
from flask import Flask, jsonify
from flask_cors import CORS

# ── Config ────────────────────────────────────────────────────────────────────
ESP_IP          = sys.argv[1] if len(sys.argv) > 1 else "172.20.10.6"
PORT            = int(sys.argv[2]) if len(sys.argv) > 2 else 5001
POLL_INTERVAL   = 0.5          # seconds between ESP32 polls
MAX_PATH_POINTS = 300          # keep last N path points in memory
WRITE_CSV       = True         # also write positions.csv for your Python scripts
CSV_PATH        = "positions.csv"

# ── Shared state (written by background thread, read by Flask) ────────────────
state = {
    "x":          0,
    "y":          0,
    "theta":      0.0,
    "front_dist": 0.0,
    "side_dist":  0.0,
    "shape":      "INITIALIZING...",
    "path":       [],
    "is_complete": False,
    "connected":  False,
    "error":      None,
}
state_lock = threading.Lock()

# ── Concave detection ─────────────────────────────────────────────────────────
def is_concave_polygon(vertices):
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
    if len(path) < 5:
        return "SCANNING..."
    step    = max(1, len(path) // 24)
    sampled = [[p["x"], p["y"]] for p in path[::step]]
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
    print(f"[bridge] Polling thread started — targeting http://{ESP_IP}/")

    while True:
        try:
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

                if x != prev_x or y != prev_y:
                    state["path"].append({"x": x, "y": y})
                    if len(state["path"]) > MAX_PATH_POINTS:
                        state["path"].pop(0)
                    if WRITE_CSV and prev_x is not None:
                        csv_append(x, y)
                    prev_x, prev_y = x, y

                if len(state["path"]) >= 5:
                    state["shape"] = detect_shape_from_path(state["path"])

                if theta >= 360 and not state["is_complete"]:
                    state["is_complete"] = True
                    state["shape"]       = detect_shape_from_path(state["path"])
                    print(f"[bridge] Robot completed rotation. Shape: {state['shape']}")

        except requests.exceptions.ConnectionError:
            with state_lock:
                state["connected"] = False
                state["error"]     = "ESP32 unreachable"
            # Only print once every ~10 s to avoid log spam
        except Exception as e:
            with state_lock:
                state["connected"] = False
                state["error"]     = str(e)

        # Optional /sensors endpoint
        try:
            rs = requests.get(f"http://{ESP_IP}/sensors", timeout=1)
            if rs.status_code == 200:
                d = rs.json()
                with state_lock:
                    state["front_dist"] = d.get("front_dist", 0.0)
                    state["side_dist"]  = d.get("side_dist",  0.0)
        except Exception:
            pass

        time.sleep(POLL_INTERVAL)


# ── Flask API ─────────────────────────────────────────────────────────────────
app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})   # allow any dev-server origin


@app.route("/sensordata")
def sensordata():
    with state_lock:
        return jsonify(dict(state))


@app.route("/reset", methods=["GET", "POST"])
def reset():
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


@app.route("/health")
def health():
    """Simple health-check — visit http://localhost:5001/health in your browser."""
    return jsonify({"ok": True, "port": PORT, "esp_ip": ESP_IP})


# ── Port-availability check ───────────────────────────────────────────────────
def check_port(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        try:
            s.bind(("0.0.0.0", port))
            return True
        except OSError:
            return False


# ── Entry point ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    print("=" * 60)
    print("  KINETIC SENTINEL — Bridge Server")
    print("=" * 60)

    if not check_port(PORT):
        print(f"\n[ERROR] Port {PORT} is already in use!")
        print(f"        Try: python bridge_server.py {ESP_IP} {PORT + 1}\n")
        sys.exit(1)

    if WRITE_CSV:
        csv_init()

    print(f"\n  ESP32 target : http://{ESP_IP}/")
    print(f"  API endpoint : http://localhost:{PORT}/sensordata")
    print(f"  Health check : http://localhost:{PORT}/health")
    print(f"  Poll interval: {POLL_INTERVAL}s")
    print("\n  Open the health URL in your browser to confirm the server is up.")
    print("  Press Ctrl+C to stop.\n")
    print("=" * 60)

    t = threading.Thread(target=poll_esp, daemon=True)
    t.start()

    app.run(host="0.0.0.0", port=PORT, debug=False, use_reloader=False)