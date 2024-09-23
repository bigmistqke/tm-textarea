import { createRenderEffect, type JSX } from 'solid-js'

export function applyStyle(
  element: HTMLElement,
  props: { style?: JSX.CSSProperties },
  key: keyof JSX.CSSProperties,
) {
  let previous: string | number | undefined
  createRenderEffect(() => {
    const value = props.style?.[key]
    value !== previous &&
      ((previous = value) != null
        ? element.style.setProperty(key, typeof value === 'undefined' ? null : value.toString())
        : element.style.removeProperty(key))
  })
}
