"""
bridge_server.py  —  G26 | TELEMETRY ROBOT DASHBOARD Integration Bridge  (ESP32-FIXED)
=======================================================================
Key fixes vs. original:
  1. Polls /data (JSON) instead of / (HTML page) on the ESP32.
  2. Maps ESP fields correctly:
       f  → front_dist       (front ultrasonic)
       fr → side_front_dist  (front-right ultrasonic)
       mr → side_back_dist   (mid-right ultrasonic)
  3. Derives shape label directly from the ESP's statusMsg field.
  4. Sets is_complete when ESP has finished detection (msg CONVEX / CONCAVE).
  5. x / y remain 0 — the ESP32 has no odometry; path visualizer will
     show an empty state which is correct behaviour.
  6. Guards against non-JSON / HTML responses from captive portals.
"""

import sys, time, threading, math, csv, os, socket
import requests
from flask import Flask, jsonify
from flask_cors import CORS

# ── Config ──────────────────────────────────────────────────────────────────
ESP_IP        = sys.argv[1] if len(sys.argv) > 1 else "172.20.10.6"
PORT          = int(sys.argv[2]) if len(sys.argv) > 2 else 5001
POLL_INTERVAL = 0.5
WRITE_CSV     = True
CSV_PATH      = "positions.csv"

# ── Shared state ─────────────────────────────────────────────────────────────
state = {
    "x":               0,
    "y":               0,
    "theta":           0.0,
    "shape":           "INITIALIZING...",
    "path":            [],          # stays empty — no odometry on ESP32
    "is_complete":     False,
    "connected":       False,
    "error":           None,
    "front_dist":      0.0,
    "side_front_dist": 0.0,
    "side_back_dist":  0.0,
    "esp_msg":         "",          # raw ESP statusMsg for debugging
}
state_lock = threading.Lock()


# ── ESP msg → dashboard shape label ──────────────────────────────────────────
def _shape_from_msg(msg: str) -> str:
    """
    Map the ESP's statusMsg to the shape string the dashboard displays.

    ESP statusMsg values (see ESPCode.ino):
        IDLE | RUNNING | FOLLOW | TURN | TOO CLOSE | STOPPED
        CONCAVE | CONCAVE LOCKED | CONVEX
    """
    upper = msg.upper()
    if "CONCAVE" in upper:
        return "CONCAVE SHAPE DETECTED"
    if "CONVEX" in upper:
        return "CONVEX SHAPE DETECTED"
    if upper in ("FOLLOW", "TURN", "TOO CLOSE", "RUNNING"):
        return "SCANNING..."
    return "INITIALIZING..."


def _is_complete_from_msg(msg: str) -> bool:
    """Robot has finished its scan when it locks on a shape."""
    upper = msg.upper()
    return "CONCAVE" in upper or "CONVEX" in upper


# ── CSV helpers ───────────────────────────────────────────────────────────────
def csv_init():
    with open(CSV_PATH, "w", newline="") as f:
        csv.DictWriter(f, ["x", "y"]).writeheader()


# ── Background polling thread ─────────────────────────────────────────────────
def poll_esp():
    # The ESP32 exposes sensor data at /data as JSON.
    # The root / endpoint only serves the HTML admin page — do NOT poll that.
    data_url = f"http://{ESP_IP}/data"
    print(f"[bridge] Polling {data_url} every {POLL_INTERVAL}s")

    while True:
        try:
            r = requests.get(data_url, timeout=2)
            r.raise_for_status()

            raw = r.text.strip()

            # Guard: if a captive portal / router returns HTML instead of JSON
            if raw.lstrip().startswith("<"):
                raise requests.exceptions.ConnectionError(
                    f"ESP32 at {ESP_IP}/data returned HTML — captive portal or wrong IP"
                )

            # Parse JSON  {"msg":"FOLLOW","fr":8.3,"mr":9.1,"f":22.4,"theta":45.0}
            try:
                payload = r.json()
            except ValueError as e:
                raise ValueError(f"ESP32 /data did not return valid JSON: '{raw[:80]}' — {e}")

            # Extract fields (graceful fallback to 0 if key missing)
            msg            = payload.get("msg",   "IDLE")
            front_dist     = float(payload.get("f",  0.0))   # front sensor
            side_front_dist = float(payload.get("fr", 0.0))  # front-right sensor
            side_back_dist  = float(payload.get("mr", 0.0))  # mid-right sensor
            theta          = float(payload.get("theta", 0.0))

            shape       = _shape_from_msg(msg)
            is_complete = _is_complete_from_msg(msg)

            with state_lock:
                state["front_dist"]      = round(front_dist,      1)
                state["side_front_dist"] = round(side_front_dist, 1)
                state["side_back_dist"]  = round(side_back_dist,  1)
                state["theta"]           = round(theta,           1)
                state["shape"]           = shape
                state["is_complete"]     = is_complete
                state["esp_msg"]         = msg
                state["connected"]       = True
                state["error"]           = None
                # x / y stay 0 — the ESP has no wheel encoders / odometry

            if is_complete:
                print(f"[bridge] Detection complete. Shape: {shape}  (ESP msg: {msg})")

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
        state["path"]            = []
        state["shape"]           = "INITIALIZING..."
        state["is_complete"]     = False
        state["x"]               = 0
        state["y"]               = 0
        state["theta"]           = 0.0
        state["front_dist"]      = 0.0
        state["side_front_dist"] = 0.0
        state["side_back_dist"]  = 0.0
        state["esp_msg"]         = ""
    if WRITE_CSV:
        csv_init()
    print("[bridge] State reset.")
    return jsonify({"status": "reset"})


@app.route("/status")
def status():
    with state_lock:
        return jsonify({
            "connected":       state["connected"],
            "shape":           state["shape"],
            "esp_msg":         state["esp_msg"],
            "theta":           state["theta"],
            "error":           state["error"],
            "side_front_dist": state["side_front_dist"],
            "side_back_dist":  state["side_back_dist"],
            "front_dist":      state["front_dist"],
        })


@app.route("/health")
def health():
    return jsonify({"ok": True, "port": PORT, "esp_ip": ESP_IP,
                    "polling": f"http://{ESP_IP}/data"})


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

    print(f"[bridge] Flask API listening on http://0.0.0.0:{PORT}")
    print(f"[bridge] Endpoints: /sensordata  /status  /reset  /health")
    app.run(host="0.0.0.0", port=PORT, debug=False, use_reloader=False)