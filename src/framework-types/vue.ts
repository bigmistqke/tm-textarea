import { VueElementAttributes } from '@lume/element/dist/framework-types/vue.js'
import { TmTextareaAttributes, TmTextareaElement } from '../custom-element'

declare module 'vue' {
  interface GlobalComponents {
    'kitchen-sink': VueElementAttributes<TmTextareaElement, TmTextareaAttributes>
  }
}
