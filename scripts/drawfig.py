import pandas as pd
import numpy as np
import cv2

def draw_path(SIZE=1000, ipath='positions.csv', opath='path_traced.png'):
    data = pd.read_csv(ipath)
    x = data['x']
    y = data['y']
    points = np.array(list(zip(x, y)), dtype=np.int32)  # ← must be int32 for OpenCV

    img = np.full((SIZE, SIZE), fill_value=255, dtype=np.uint8)

    cv2.polylines(img, [points], isClosed=True, color=0, thickness=4)
    cv2.fillPoly(img, [points], color=50)
    cv2.imwrite(opath, img)


if __name__ == '__main__':
    draw_path(ipath='project_ps5_g5/positions.csv')