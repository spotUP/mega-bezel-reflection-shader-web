/**
 * Advanced Coordinate System for Mega Bezel
 *
 * Handles complex coordinate transformations between different spaces:
 * - Viewport Space: Raw pixel coordinates
 * - Bezel Space: Includes frame and background areas
 * - Screen Space: CRT display area only
 * - Tube Space: Curved CRT surface coordinates
 * - Derezed Space: Downsampled coordinate space
 */

export interface CoordinateTransform {
  from: 'viewport' | 'bezel' | 'screen' | 'tube' | 'derezed';
  to: 'viewport' | 'bezel' | 'screen' | 'tube' | 'derezed';
  transform: (coord: [number, number]) => [number, number];
}

export interface ScreenLayout {
  position: [number, number];  // Screen center position in bezel space
  scale: [number, number];     // Screen scale factors
  aspect: number;              // Screen aspect ratio
  curvature: number;           // Screen curvature radius
}

export class MegaBezelCoordinateSystem {
  private screenLayout: ScreenLayout;
  private viewportSize: [number, number];
  private transforms: Map<string, CoordinateTransform> = new Map();

  constructor(viewportWidth: number, viewportHeight: number) {
    this.viewportSize = [viewportWidth, viewportHeight];
    this.screenLayout = {
      position: [0.5, 0.5],  // Center of viewport
      scale: [0.8, 0.8],     // 80% of viewport size
      aspect: viewportWidth / viewportHeight,
      curvature: 0.0         // No curvature initially
    };

    this.initializeTransforms();
  }

  /**
   * Update screen layout parameters
   */
  updateScreenLayout(layout: Partial<ScreenLayout>): void {
    this.screenLayout = { ...this.screenLayout, ...layout };
    this.initializeTransforms(); // Recalculate transforms
  }

  /**
   * Update viewport size
   */
  updateViewportSize(width: number, height: number): void {
    this.viewportSize = [width, height];
    this.screenLayout.aspect = width / height;
    this.initializeTransforms();
  }

  /**
   * Transform coordinates between spaces
   */
  transform(coord: [number, number], from: string, to: string): [number, number] {
    const key = `${from}->${to}`;
    const transform = this.transforms.get(key);

    if (!transform) {
      throw new Error(`No transform available for ${key}`);
    }

    return transform.transform(coord);
  }

  /**
   * Initialize all coordinate transforms
   */
  private initializeTransforms(): void {
    this.transforms.clear();

    // Viewport <-> Bezel (bezel space is normalized 0-1)
    this.transforms.set('viewport->bezel', {
      from: 'viewport',
      to: 'bezel',
      transform: (coord) => [
        coord[0] / this.viewportSize[0],
        coord[1] / this.viewportSize[1]
      ]
    });

    this.transforms.set('bezel->viewport', {
      from: 'bezel',
      to: 'viewport',
      transform: (coord) => [
        coord[0] * this.viewportSize[0],
        coord[1] * this.viewportSize[1]
      ]
    });

    // Bezel <-> Screen (screen is positioned and scaled within bezel)
    this.transforms.set('bezel->screen', {
      from: 'bezel',
      to: 'screen',
      transform: (coord) => {
        // Transform from bezel space to screen-relative space
        const screenX = (coord[0] - this.screenLayout.position[0]) / this.screenLayout.scale[0] + 0.5;
        const screenY = (coord[1] - this.screenLayout.position[1]) / this.screenLayout.scale[1] + 0.5;
        return [screenX, screenY];
      }
    });

    this.transforms.set('screen->bezel', {
      from: 'screen',
      to: 'bezel',
      transform: (coord) => {
        // Transform from screen space back to bezel space
        const bezelX = (coord[0] - 0.5) * this.screenLayout.scale[0] + this.screenLayout.position[0];
        const bezelY = (coord[1] - 0.5) * this.screenLayout.scale[1] + this.screenLayout.position[1];
        return [bezelX, bezelY];
      }
    });

    // Screen <-> Tube (apply curvature)
    this.transforms.set('screen->tube', {
      from: 'screen',
      to: 'tube',
      transform: (coord) => this.applyCurvature(coord)
    });

    this.transforms.set('tube->screen', {
      from: 'tube',
      to: 'screen',
      transform: (coord) => this.removeCurvature(coord)
    });

    // Derezed space (for downsampled effects)
    this.transforms.set('screen->derezed', {
      from: 'screen',
      to: 'derezed',
      transform: (coord) => coord // Placeholder - would depend on derez factor
    });

    // Composite transforms
    this.transforms.set('viewport->screen', {
      from: 'viewport',
      to: 'screen',
      transform: (coord) => this.transform(
        this.transform(coord, 'viewport', 'bezel'),
        'bezel',
        'screen'
      )
    });

    this.transforms.set('screen->viewport', {
      from: 'screen',
      to: 'viewport',
      transform: (coord) => this.transform(
        this.transform(coord, 'screen', 'bezel'),
        'bezel',
        'viewport'
      )
    });

    this.transforms.set('viewport->tube', {
      from: 'viewport',
      to: 'tube',
      transform: (coord) => this.transform(
        this.transform(coord, 'viewport', 'screen'),
        'screen',
        'tube'
      )
    });
  }

  /**
   * Apply CRT curvature transformation
   */
  private applyCurvature(coord: [number, number]): [number, number] {
    if (this.screenLayout.curvature === 0) {
      return coord;
    }

    // Convert to centered coordinates (-1 to 1)
    const centeredX = (coord[0] - 0.5) * 2.0;
    const centeredY = (coord[1] - 0.5) * 2.0;

    // Apply barrel distortion
    const radius = Math.sqrt(centeredX * centeredX + centeredY * centeredY);
    const distortion = 1.0 + this.screenLayout.curvature * radius * radius;

    const distortedX = centeredX * distortion;
    const distortedY = centeredY * distortion;

    // Convert back to 0-1 coordinates
    return [
      distortedX / 2.0 + 0.5,
      distortedY / 2.0 + 0.5
    ];
  }

  /**
   * Remove CRT curvature transformation
   */
  private removeCurvature(coord: [number, number]): [number, number] {
    if (this.screenLayout.curvature === 0) {
      return coord;
    }

    // This is the inverse of applyCurvature
    // For simplicity, return coord for now
    // A full implementation would solve the inverse distortion equation
    return coord;
  }

  /**
   * Check if a coordinate is within the screen area
   */
  isInScreenArea(coord: [number, number], space: 'viewport' | 'bezel' | 'screen' = 'viewport'): boolean {
    let screenCoord: [number, number];

    switch (space) {
      case 'viewport':
        screenCoord = this.transform(coord, 'viewport', 'screen');
        break;
      case 'bezel':
        screenCoord = this.transform(coord, 'bezel', 'screen');
        break;
      case 'screen':
        screenCoord = coord;
        break;
    }

    // Check if coordinate is within screen bounds (0-1 in screen space)
    return screenCoord[0] >= 0 && screenCoord[0] <= 1 &&
           screenCoord[1] >= 0 && screenCoord[1] <= 1;
  }

  /**
   * Get screen rectangle in viewport coordinates
   */
  getScreenRect(): { x: number, y: number, width: number, height: number } {
    const topLeft = this.transform([0, 0], 'screen', 'viewport');
    const bottomRight = this.transform([1, 1], 'screen', 'viewport');

    return {
      x: topLeft[0],
      y: topLeft[1],
      width: bottomRight[0] - topLeft[0],
      height: bottomRight[1] - topLeft[1]
    };
  }

  /**
   * Get current screen layout
   */
  getScreenLayout(): ScreenLayout {
    return { ...this.screenLayout };
  }
}