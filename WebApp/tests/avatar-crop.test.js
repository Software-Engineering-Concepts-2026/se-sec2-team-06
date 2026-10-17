import { describe, expect, it } from 'vitest';

import { calculateCropFrame } from '../src/components/avatar-crop.js';

describe('avatar crop framing', () => {
  it('covers a square crop window and clamps dragged offsets to avoid empty edges', () => {
    expect(calculateCropFrame({
      imageWidth: 1200,
      imageHeight: 800,
      viewportSize: 300,
      zoom: 2,
      offsetX: 500,
      offsetY: -500,
    })).toEqual({ width: 900, height: 600, left: 0, top: -300 });
  });
});
