import { StencilElementAttributes } from '@lume/element/dist/framework-types/stencil.js'
import { TmTextareaAttributes, TmTextareaElement } from '../custom-element'

// @ts-expect-error module not found when inside the tm-textarea package, due to using jsxImportSource.
// However, Stencil users will be using jsxFactoroy instead of jsxImportSource, and this will work for them.
// This issue will fix the problem for projects using jsxImportSource: https://github.com/stenciljs/core/issues/6180
declare module '@stencil/core' {
  export namespace JSX {
    interface IntrinsicElements {
      'tm-textarea': StencilElementAttributes<TmTextareaElement, TmTextareaAttributes>
    }
  }
}
