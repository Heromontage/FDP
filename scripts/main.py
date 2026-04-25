import subprocess
import sys

if __name__ == "__main__":
    input_script = 'input_data.py'
    path_rtp_script = 'dynamic_plot.py'
    processing_script = 'detection.py'

    # It's fine to keep input_data in a separate window so it runs infinitely in the background
    print("Starting Data Collection (input_data.py) in background...")
    a = subprocess.Popen(['start', 'cmd', '/k', 'python', input_script], shell=True)

    # Run the dynamic plot directly. The script will pause here until you close the plot window.
    print("Starting Live Plot. Close the plot window when the robot is done to proceed to detection...")
    b = subprocess.Popen([sys.executable, path_rtp_script])
    b.wait()  # This will now successfully block until dynamic_plot.py is closed!

    # Once the plot window is closed, run the shape detection.
    print("Plot closed. Running shape detection...")
    c = subprocess.Popen([sys.executable, processing_script])
    c.wait()
    print("Detection complete.")