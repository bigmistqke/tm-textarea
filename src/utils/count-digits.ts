export function countDigits(value: number) {
  // Handle zero case
  if (value === 0) return 1

  // Use absolute value for negative numbers
  return Math.floor(Math.log10(Math.abs(value))) + 1
}
