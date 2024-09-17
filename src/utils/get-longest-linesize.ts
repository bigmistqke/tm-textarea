export function getLongestLineSize(input: string): number {
  const lines = input.split('\n')
  let maxLength = 0

  for (const line of lines) {
    if (line.length > maxLength) {
      maxLength = line.length
    }
  }

  return maxLength
}
