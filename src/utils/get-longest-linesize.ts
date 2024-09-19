export function getLongestLineSize(lines: string[]): number {
  let maxLength = 0

  for (const line of lines) {
    if (line.length > maxLength) {
      maxLength = line.length
    }
  }

  return maxLength
}
