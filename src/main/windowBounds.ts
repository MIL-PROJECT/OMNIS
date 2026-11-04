type Rectangle = { x: number; y: number; width: number; height: number }

export function minimumWindowSize(workArea: Rectangle): [number, number] {
  return [Math.min(1366, workArea.width), Math.min(768, workArea.height)]
}

export function fitWindowBounds(bounds: Rectangle, workArea: Rectangle): Rectangle {
  const width = Math.min(bounds.width, workArea.width)
  const height = Math.min(bounds.height, workArea.height)
  return {
    x: Math.max(workArea.x, Math.min(bounds.x, workArea.x + workArea.width - width)),
    y: Math.max(workArea.y, Math.min(bounds.y, workArea.y + workArea.height - height)),
    width,
    height
  }
}

export function initialWindowBounds(workArea: Rectangle): Rectangle {
  return fitWindowBounds({
    x: workArea.x + Math.max(0, Math.floor((workArea.width - 1600) / 2)),
    y: workArea.y + Math.max(0, Math.floor((workArea.height - 950) / 2)),
    width: 1600,
    height: 950
  }, workArea)
}
