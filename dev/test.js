/**
 * @template const T
 * @param {T} value
 * @returns SignalObject<T>
 */
function signal(value) {
  return [value]
}

const [big] = signal('mistqke')
