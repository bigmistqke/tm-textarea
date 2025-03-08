import { ReactElementAttributes } from '@lume/element/dist/framework-types/react.js'
import { TmTextareaAttributes, TmTextareaElement } from '../custom-element'

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'tm-textarea': ReactElementAttributes<TmTextareaElement, TmTextareaAttributes>
    }
  }
}
