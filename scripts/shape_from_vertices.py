import cv2
import is_concave

def detect(contours):
    shape_dict = {
        3 : 'triangle',
        4 : 'quadrilateral',
        5 : 'pentagon',
        6 : 'hexagon',
        7 : 'heptagon',
        8 : 'octagon',
        9 : 'nonagon',
        10: 'decagon'
    }
    
    # The epsilon value will specify the precision in which we approximate our shape.
    epsilon = 0.02 * cv2.arcLength(contours, True)
    approx = cv2.approxPolyDP(contours, epsilon, True) 
    
    # Flip the logic here: Check if it is concave first.
    if is_concave.is_concave_polygon([i[0] for i in approx]):
        polytype = 'concave'
    else:
        polytype = 'convex'

    return polytype + ' ' + shape_dict.get(len(approx), 'Elliptical'), approx