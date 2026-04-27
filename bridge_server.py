"""
bridge_server.py  —  Kinetic Sentinel Integration Bridge
=========================================================
Sits between the ESP32 robot (172.20.10.6) and the React web app.
  • Polls the ESP32 for (x, y, theta)
  • Accumulates the robot's path
  • Runs real-time concave-shape detection
  • Serves a JSON API at http://localhost:5001/sensordata for the React app
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

# ── Config ────────────────────────────────────────────────────────────
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
    "shape":      "INITIALIZING...",
    "path":       [],
    "is_complete": False,
    "connected":  False,
    "error":      None,
}
state_lock = threading.Lock()

# ── Concave detection ────────────────────────────────────────────────────────
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

# ── CSV helpers ──────────────────────────────────────────────────────────
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
            # Parse floats first, then int, since Arduino String(float) outputs decimals like "0.00"
            x     = int(float(parts[0]))
            y     = int(float(parts[1]))
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
        except Exception as e:
            with state_lock:
                state["connected"] = False
                state["error"]     = str(e)

        time.sleep(POLL_INTERVAL)

# ── Flask API ──────────────────────────────────────────────────────────
app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

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
