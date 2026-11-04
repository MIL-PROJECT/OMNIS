import { describe, expect, it } from 'vitest'
import { fitWindowBounds, initialWindowBounds, minimumWindowSize } from '../../src/main/windowBounds'

describe('window placement in scaled Windows work areas', () => {
  it('preserves the standard desktop window on a full HD display', () => {
    expect(initialWindowBounds({ x: 0, y: 0, width: 1920, height: 1032 })).toEqual({ x: 160, y: 41, width: 1600, height: 950 })
  })
  it.each([
    { x: 0, y: 0, width: 1536, height: 826 },
    { x: 0, y: 0, width: 1280, height: 688 },
    { x: -1280, y: -72, width: 1280, height: 688 }
  ])('keeps the first window and its minimum within work area $width by $height', area => {
    const bounds = initialWindowBounds(area)
    const minimum = minimumWindowSize(area)
    expect(bounds.x).toBeGreaterThanOrEqual(area.x)
    expect(bounds.y).toBeGreaterThanOrEqual(area.y)
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(area.x + area.width)
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(area.y + area.height)
    expect(minimum[0]).toBeLessThanOrEqual(bounds.width)
    expect(minimum[1]).toBeLessThanOrEqual(bounds.height)
  })
  it('fits an oversized window when moved to a higher DPI monitor', () => {
    expect(fitWindowBounds({ x: 1910, y: 20, width: 1600, height: 950 }, { x: 1920, y: 0, width: 1280, height: 688 })).toEqual({ x: 1920, y: 0, width: 1280, height: 688 })
  })
})
