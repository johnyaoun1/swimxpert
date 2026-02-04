# Three.js Setup Instructions

The 3D Swimming Strokes visualization requires Three.js to be installed.

## Installation

Run the following command in your project directory:

```bash
npm install three @types/three
```

## What's Included

The 3D visualization component (`strokes-3d.component.ts`) includes:

- **Interactive 3D swimmer model** with animated body parts
- **Water simulation** with wave effects
- **Four swimming strokes**:
  - Freestyle (Front Crawl)
  - Backstroke
  - Breaststroke
  - Butterfly
- **Dynamic camera** that rotates around the swimmer
- **Real-time animations** showing proper stroke techniques

## Features

- Click on different stroke buttons to see different animations
- The 3D model demonstrates proper body positioning and movement
- Water effects create a realistic swimming environment
- Educational information about each stroke technique

## Note

If Three.js is not installed, the component will display a helpful message instead of the 3D visualization.
