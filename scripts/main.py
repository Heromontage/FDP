import subprocess
import sys
import os

# Resolve the directory where this script lives (i.e. the scripts/ folder)
# so it works regardless of which directory you run it from.
SCRIPTS_DIR = os.path.dirname(os.path.abspath(__file__))

input_script      = os.path.join(SCRIPTS_DIR, 'input_data.py')
path_rtp_script   = os.path.join(SCRIPTS_DIR, 'dynamic_plot.py')
processing_script = os.path.join(SCRIPTS_DIR, 'detection.py')

if __name__ == "__main__":
    # Run input_data.py in a separate terminal window (background)
    print("Starting Data Collection (input_data.py) in background...")
    subprocess.Popen(
        ['start', 'cmd', '/k', sys.executable, input_script],
        shell=True
    )

    # Run the live plot and block until the window is closed
    print("Starting Live Plot. Close the plot window when the robot is done to proceed to detection...")
    b = subprocess.Popen([sys.executable, path_rtp_script])
    b.wait()

    # Once the plot window is closed, run shape detection
    print("Plot closed. Running shape detection...")
    c = subprocess.Popen([sys.executable, processing_script])
    c.wait()

    print("Detection complete.")