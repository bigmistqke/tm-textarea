import { Accessor, createRenderEffect, createSignal } from 'solid-js'

export function createWritable<T>(value: Accessor<T>) {
  const [signal, setSignal] = createSignal<T>(null!)
  createRenderEffect(() => setSignal(value() as any))
  return [signal, setSignal] as const
}
