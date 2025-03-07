import { SvelteElementAttributes } from '@lume/element/dist/framework-types/svelte.js'
import { TmTextareaAttributes, TmTextareaElement } from '../custom-element'

declare module 'svelte/elements' {
  interface SvelteHTMLElements {
    'kitchen-sink': SvelteElementAttributes<TmTextareaElement, TmTextareaAttributes>
  }
}
