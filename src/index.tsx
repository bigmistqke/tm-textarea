import {
  booleanAttribute,
  element,
  Element,
  ElementAttributes,
  stringAttribute,
} from '@lume/element'
import { signal } from 'classy-solid'
import { JSXElement } from 'solid-js'
import { createTmTextarea, css } from './core'
import classnames from './index.module.css?classnames'
import { Grammar, Theme } from './tm'
import { sheet } from './utils/sheet'

/**********************************************************************************/
/*                                                                                */
/*                                      Types                                     */
/*                                                                                */
/**********************************************************************************/

interface TmTextareaAttributes
  extends Omit<
    ElementAttributes<TmTextareaElement, 'grammar' | 'theme' | 'editable'>,
    'onInput' | 'oninput'
  > {
  oninput?: (event: InputEvent & { currentTarget: TmTextareaElement }) => any
  onInput?: (event: InputEvent & { currentTarget: TmTextareaElement }) => any
  value: string
}
declare module 'solid-js/jsx-runtime' {
  namespace JSX {
    interface IntrinsicElements {
      'tm-textarea': TmTextareaAttributes
    }
  }
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'tm-textarea': TmTextareaAttributes
    }
  }
}

/**********************************************************************************/
/*                                                                                */
/*                                 Custom Element                                 */
/*                                                                                */
/**********************************************************************************/

const TmTextarea = createTmTextarea(Object.fromEntries(classnames.map(name => [name, name])))

const TmTextareaStyleSheet = sheet(css)

@element('tm-textarea')
export class TmTextareaElement extends Element {
  @booleanAttribute editable = true
  @stringAttribute grammar: Grammar = 'tsx'
  @stringAttribute stylesheet = ''
  @stringAttribute theme: Theme = 'dark-plus'
  @stringAttribute value = ''
  @signal textarea: HTMLTextAreaElement = null!
  @signal jsx: JSXElement | undefined
  @signal #finalize

  constructor() {
    super()

    // `self` is necessary otherwise, otherwise the solid-transform would place it before super()
    const self = this

    // Defining jsx in the constructor so TmTextareaElement.textarea is defined.
    // Otherwise methods relying on textarea will not work.
    this.jsx = (
      <TmTextarea
        textareaRef={element => {
          element.value = self.value
          self.textarea = element
        }}
        grammar={self.grammar}
        theme={self.theme}
        value={self.value}
        editable={self.editable}
        onInput={e => (self.value = e.currentTarget.value)}
      />
    )
  }

  template = () => {
    const adoptedStyleSheets = this.shadowRoot!.adoptedStyleSheets
    // local component stylesheet
    adoptedStyleSheets.push(TmTextareaStyleSheet)
    // user provided stylesheet
    if (this.stylesheet) {
      adoptedStyleSheets.push(sheet(this.stylesheet))
    }
    return this.jsx
  }

  get selectionStart() {
    return this.textarea.selectionStart
  }
  set selectionStart(start: number) {
    this.textarea.selectionStart = start
  }
  get selectionEnd() {
    return this.textarea.selectionEnd
  }
  set selectionEnd(end: number) {
    this.textarea.selectionEnd = end
  }

  setRangeText(
    replacement: string,
    start?: number,
    end?: number,
    selectMode?: 'select' | 'start' | 'end' | 'preserve',
  ) {
    // @ts-expect-error due to method overloads
    this.textarea.setRangeText(replacement, start, end, selectMode)
    this.value = this.textarea.value
  }

  setSelectionRange(
    selectionStart: number,
    selectionEnd: number,
    selectionDirection?: 'forward' | 'backward' | 'none',
  ) {
    this.textarea.setSelectionRange(selectionStart, selectionEnd, selectionDirection)
  }

  select() {
    this.textarea.select()
  }
}

// NOTE:  <tm-textarea/> is already defined with lume's @element() decorator.
//        register is a NOOP, but is needed for rollup not to treeshake
//        the custom-element declaration out of the bundle.
export function register() {
  if (!customElements.get('tm-textarea')) {
    customElements.define('tm-textarea', TmTextareaElement)
  }
}
