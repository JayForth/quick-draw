"""
Cowboy Sprite Slicer for Skeletal Animation
============================================
Slices a full cowboy character PNG into separate body parts for skeletal animation.

Usage:
    python slice_cowboy.py [--preview] [--interactive]

Options:
    --preview      Show preview of bounding boxes without saving
    --interactive  Open interactive mode to adjust bounding boxes
"""

import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    print("PIL not found. Installing Pillow...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "Pillow"])
    from PIL import Image

# Configuration
INPUT_IMAGE = Path(r"C:\Users\jacob\Downloads\player full.png")
OUTPUT_DIR = Path(r"C:\Users\jacob\Coding\quick-draw\public\sprites\player")
PADDING = 4  # Extra pixels around each part

# Body part definitions: name -> (x, y, width, height)
# These are initial estimates - adjust based on your specific image
# Coordinates are relative to the image (top-left is 0,0)
BODY_PARTS = {
    # Head includes hat, face, and neck stub
    "head": {
        "box": (305, 18, 195, 195),  # x, y, w, h
        "pivot": (95, 185),  # Pivot point relative to the cut-out part (neck attachment)
    },

    # Torso - chest/vest area, no arms, from shoulders to hips
    "torso": {
        "box": (325, 195, 145, 175),
        "pivot": (72, 0),  # Top center where neck attaches
    },

    # Right upper arm (front arm - shoulder to elbow) - the gun arm
    "arm_upper_front": {
        "box": (220, 230, 95, 115),
        "pivot": (80, 15),  # Shoulder joint
    },

    # Right forearm + hand + gun (front)
    "arm_lower_front": {
        "box": (115, 305, 140, 180),
        "pivot": (115, 15),  # Elbow joint
    },

    # Left upper arm (back arm)
    "arm_upper_back": {
        "box": (455, 230, 80, 95),
        "pivot": (10, 15),  # Shoulder joint
    },

    # Left forearm + hand (back, no gun)
    "arm_lower_back": {
        "box": (490, 305, 75, 95),
        "pivot": (15, 10),  # Elbow joint
    },

    # Left thigh
    "leg_upper_left": {
        "box": (405, 365, 65, 130),
        "pivot": (30, 10),  # Hip joint
    },

    # Left shin + boot
    "leg_lower_left": {
        "box": (405, 480, 75, 145),
        "pivot": (35, 10),  # Knee joint
    },

    # Right thigh
    "leg_upper_right": {
        "box": (340, 365, 70, 130),
        "pivot": (40, 10),  # Hip joint
    },

    # Right shin + boot
    "leg_lower_right": {
        "box": (325, 480, 80, 145),
        "pivot": (45, 10),  # Knee joint
    },
}

def load_image(path):
    """Load image and ensure it has an alpha channel."""
    img = Image.open(path)
    if img.mode != 'RGBA':
        img = img.convert('RGBA')
    print(f"Loaded image: {path}")
    print(f"  Size: {img.width} x {img.height}")
    print(f"  Mode: {img.mode}")
    return img

def slice_part(img, name, config, padding=PADDING):
    """Extract a body part from the image with padding."""
    x, y, w, h = config["box"]

    # Apply padding
    x1 = max(0, x - padding)
    y1 = max(0, y - padding)
    x2 = min(img.width, x + w + padding)
    y2 = min(img.height, y + h + padding)

    # Crop the region
    part = img.crop((x1, y1, x2, y2))

    # Adjust pivot point for padding offset
    pivot_x = config["pivot"][0] + (x - x1)
    pivot_y = config["pivot"][1] + (y - y1)

    return part, (pivot_x, pivot_y), (x1, y1, x2 - x1, y2 - y1)

def auto_trim(img):
    """Trim transparent pixels from edges, returning new image and offset."""
    bbox = img.getbbox()
    if bbox:
        return img.crop(bbox), bbox
    return img, (0, 0, img.width, img.height)

def preview_boxes(img, parts):
    """Show a preview with bounding boxes drawn on the image."""
    try:
        from PIL import ImageDraw, ImageFont
    except ImportError:
        print("Cannot preview - PIL ImageDraw not available")
        return

    # Create a copy for drawing
    preview = img.copy()
    draw = ImageDraw.Draw(preview)

    colors = [
        (255, 0, 0, 180),    # Red
        (0, 255, 0, 180),    # Green
        (0, 0, 255, 180),    # Blue
        (255, 255, 0, 180),  # Yellow
        (255, 0, 255, 180),  # Magenta
        (0, 255, 255, 180),  # Cyan
        (255, 128, 0, 180),  # Orange
        (128, 0, 255, 180),  # Purple
        (0, 128, 255, 180),  # Sky blue
        (128, 255, 0, 180),  # Lime
    ]

    for i, (name, config) in enumerate(parts.items()):
        x, y, w, h = config["box"]
        color = colors[i % len(colors)]

        # Draw rectangle
        draw.rectangle([x, y, x + w, y + h], outline=color[:3], width=2)

        # Draw pivot point
        px, py = config["pivot"]
        pivot_x = x + px
        pivot_y = y + py
        draw.ellipse([pivot_x - 5, pivot_y - 5, pivot_x + 5, pivot_y + 5],
                     fill=(255, 255, 255, 200), outline=color[:3])

        # Label
        draw.text((x + 2, y + 2), name, fill=color[:3])

    # Save preview
    preview_path = OUTPUT_DIR / "_preview.png"
    preview.save(preview_path)
    print(f"\nPreview saved to: {preview_path}")
    return preview

def slice_all(img, parts, output_dir, padding=PADDING):
    """Slice all body parts and save them."""
    output_dir.mkdir(parents=True, exist_ok=True)

    results = {}

    print("\nSlicing body parts:")
    print("-" * 60)

    for name, config in parts.items():
        part_img, pivot, actual_box = slice_part(img, name, config, padding)

        # Optionally auto-trim (commented out - might want exact boxes)
        # part_img, trim_bbox = auto_trim(part_img)
        # pivot = (pivot[0] - trim_bbox[0], pivot[1] - trim_bbox[1])

        # Save the part
        output_path = output_dir / f"{name}.png"
        part_img.save(output_path, "PNG")

        results[name] = {
            "file": f"{name}.png",
            "size": (part_img.width, part_img.height),
            "pivot": pivot,
            "original_box": config["box"],
        }

        print(f"  {name}.png")
        print(f"    Size: {part_img.width} x {part_img.height}")
        print(f"    Pivot: ({pivot[0]}, {pivot[1]})")

    return results

def generate_manifest(results, output_dir):
    """Generate a JSON manifest with all part info for the game code."""
    import json

    manifest = {
        "parts": results,
        "hierarchy": {
            "torso": {
                "pivot": results["torso"]["pivot"],
                "children": {
                    "head": {
                        "attachPoint": (72, 0),  # Where head attaches to torso
                        "pivot": results["head"]["pivot"],
                    },
                    "arm_upper_front": {
                        "attachPoint": (10, 35),  # Front shoulder on torso
                        "pivot": results["arm_upper_front"]["pivot"],
                        "children": {
                            "arm_lower_front": {
                                "attachPoint": (15, 95),  # Elbow
                                "pivot": results["arm_lower_front"]["pivot"],
                            }
                        }
                    },
                    "arm_upper_back": {
                        "attachPoint": (135, 35),  # Back shoulder on torso
                        "pivot": results["arm_upper_back"]["pivot"],
                        "children": {
                            "arm_lower_back": {
                                "attachPoint": (65, 80),  # Elbow
                                "pivot": results["arm_lower_back"]["pivot"],
                            }
                        }
                    },
                    "leg_upper_right": {
                        "attachPoint": (45, 170),  # Right hip
                        "pivot": results["leg_upper_right"]["pivot"],
                        "children": {
                            "leg_lower_right": {
                                "attachPoint": (35, 120),  # Right knee
                                "pivot": results["leg_lower_right"]["pivot"],
                            }
                        }
                    },
                    "leg_upper_left": {
                        "attachPoint": (95, 170),  # Left hip
                        "pivot": results["leg_upper_left"]["pivot"],
                        "children": {
                            "leg_lower_left": {
                                "attachPoint": (30, 120),  # Left knee
                                "pivot": results["leg_lower_left"]["pivot"],
                            }
                        }
                    },
                }
            }
        }
    }

    manifest_path = output_dir / "manifest.json"
    with open(manifest_path, 'w') as f:
        json.dump(manifest, f, indent=2)

    print(f"\nManifest saved to: {manifest_path}")
    return manifest

def print_pivot_summary(results):
    """Print a summary of pivot points for easy copy-paste into game code."""
    print("\n" + "=" * 60)
    print("PIVOT POINTS (for game code)")
    print("=" * 60)
    print("// Pivot points are relative to each sprite's top-left corner")
    print("// Use these for skeletal animation attachment points\n")

    print("const SPRITE_PIVOTS = {")
    for name, data in results.items():
        px, py = data["pivot"]
        w, h = data["size"]
        print(f"  {name}: {{ x: {px}, y: {py}, width: {w}, height: {h} }},")
    print("};")

    print("\n// Attachment hierarchy:")
    print("// torso (root)")
    print("//   ├─ head (attaches at neck)")
    print("//   ├─ arm_upper_front (front shoulder)")
    print("//   │    └─ arm_lower_front (elbow)")
    print("//   ├─ arm_upper_back (back shoulder)")
    print("//   │    └─ arm_lower_back (elbow)")
    print("//   ├─ leg_upper_right (right hip)")
    print("//   │    └─ leg_lower_right (knee)")
    print("//   └─ leg_upper_left (left hip)")
    print("//        └─ leg_lower_left (knee)")

def interactive_mode(img, parts):
    """Interactive mode to adjust bounding boxes using matplotlib."""
    try:
        import matplotlib.pyplot as plt
        import matplotlib.patches as patches
        from matplotlib.widgets import RectangleSelector
    except ImportError:
        print("matplotlib not available for interactive mode")
        print("Install with: pip install matplotlib")
        return parts

    print("\nInteractive Mode:")
    print("  - Click and drag to adjust boxes")
    print("  - Close window when done")

    fig, ax = plt.subplots(1, figsize=(12, 12))
    ax.imshow(img)
    ax.set_title("Adjust bounding boxes (close window when done)")

    # Draw current boxes
    colors = plt.cm.tab10.colors
    for i, (name, config) in enumerate(parts.items()):
        x, y, w, h = config["box"]
        rect = patches.Rectangle((x, y), w, h,
                                  linewidth=2,
                                  edgecolor=colors[i % len(colors)],
                                  facecolor='none',
                                  label=name)
        ax.add_patch(rect)

        # Pivot point
        px, py = config["pivot"]
        ax.plot(x + px, y + py, 'o', color=colors[i % len(colors)], markersize=8)
        ax.text(x + 5, y + 15, name, color=colors[i % len(colors)], fontsize=8)

    ax.legend(loc='upper right')
    plt.tight_layout()
    plt.show()

    return parts

def main():
    args = sys.argv[1:]
    preview_only = "--preview" in args
    interactive = "--interactive" in args

    print("=" * 60)
    print("Cowboy Sprite Slicer")
    print("=" * 60)

    # Check input file
    if not INPUT_IMAGE.exists():
        print(f"ERROR: Input image not found: {INPUT_IMAGE}")
        print("\nMake sure the cowboy PNG is at the specified path.")
        sys.exit(1)

    # Load image
    img = load_image(INPUT_IMAGE)

    # Use defined body parts
    parts = BODY_PARTS.copy()

    # Interactive adjustment
    if interactive:
        parts = interactive_mode(img, parts)

    # Preview mode
    if preview_only:
        preview_boxes(img, parts)
        print("\nPreview mode - no files saved.")
        print("Run without --preview to slice and save parts.")
        return

    # Always save a preview
    preview_boxes(img, parts)

    # Slice all parts
    results = slice_all(img, parts, OUTPUT_DIR, PADDING)

    # Generate manifest
    generate_manifest(results, OUTPUT_DIR)

    # Print summary
    print_pivot_summary(results)

    print("\n" + "=" * 60)
    print("DONE! Files saved to:", OUTPUT_DIR)
    print("=" * 60)

if __name__ == "__main__":
    main()
