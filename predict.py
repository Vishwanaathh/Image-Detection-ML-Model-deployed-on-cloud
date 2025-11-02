import sys
import json
from ultralytics import YOLO

# --- Ensure an image path was passed ---
if len(sys.argv) < 2:
    print(json.dumps({"label": "error", "confidence": 0}))
    sys.exit(1)

image_path = sys.argv[1]

# --- Load your YOLO model ---
model = YOLO("best.pt")  # make sure best.pt is in the same folder

# --- Run prediction ---
results = model.predict(image_path, verbose=False)

# --- Default values ---
label = "unknown"
confidence = 0.0

# --- Extract prediction safely ---
if results and len(results[0].boxes.cls) > 0:
    boxes = results[0].boxes
    names = model.names
    # pick the highest-confidence detection
    top_idx = boxes.conf.argmax().item()
    label = names[int(boxes.cls[top_idx])]
    confidence = float(boxes.conf[top_idx])

# --- Output ONLY JSON ---
print(json.dumps({"label": label, "confidence": confidence}))

