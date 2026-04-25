import numpy as np

def is_concave_polygon(vertices):
    # Step 1: Find the center (centroid) of the polygon
    x_coords = [v[0] for v in vertices]
    y_coords = [v[1] for v in vertices]
    
    centroid_x = sum(x_coords) / len(vertices)
    centroid_y = sum(y_coords) / len(vertices)

    # Step 2: Calculate the Euclidean distance from the center to every vertex
    distances = []
    for x, y in vertices:
        dist = np.sqrt((x - centroid_x)**2 + (y - centroid_y)**2)
        distances.append(dist)

    # Step 3: Loop through to see if any point is smaller than the ones before and after it
    n = len(distances)
    for i in range(n):
        # We use modulo (%) to wrap around the list (so the last point checks against the first point)
        prev_dist = distances[(i - 1) % n]
        curr_dist = distances[i]
        next_dist = distances[(i + 1) % n]

        # The core logic you were given:
        if curr_dist < prev_dist and curr_dist < next_dist:
            print(f"Dent detected at vertex {vertices[i]}! Distance: {curr_dist:.2f}")
            return True  # It's a concave shape

    return False # No dents found

if __name__ == '__main__':
    # A test set of vertices that forms an arrow/chevron (concave)
    vertices = [[600, 203], [595, 383], [450, 300], [280, 306], [417, 136]]
    result = is_concave_polygon(vertices)
    print("Is the polygon concave?", result)