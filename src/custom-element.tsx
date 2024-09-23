import {
  attribute,
  booleanAttribute,
  element,
  Element,
  ElementAttributes,
  numberAttribute,
  stringAttribute,
} from '@lume/element'
import { signal } from 'classy-solid'
import { createTmTextarea } from './core'
import classnames from './index.module.css?classnames'
import css from './index.module.css?raw'
import { Grammar, Theme } from './tm'
import { sheet } from './utils/sheet.js'

/**********************************************************************************/
/*                                                                                */
/*                                      Types                                     */
/*                                                                                */
/**********************************************************************************/

interface TmTextareaAttributes
  extends Omit<
    ElementAttributes<TmTextareaElement, 'grammar' | 'theme' | 'editable' | 'lineHeight'>,
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
class TmTextareaElement extends Element {
  @attribute() grammar: Grammar = 'tsx'
  @attribute() theme: Theme = 'dark-plus'
  @stringAttribute stylesheet = ''
  @numberAttribute lineHeight = 16
  @booleanAttribute editable = true
  @signal private _value = ''

  textarea: HTMLTextAreaElement = null!

  template = () => {
    const adoptedStyleSheets = this.shadowRoot!.adoptedStyleSheets

    // local component stylesheet
    adoptedStyleSheets.push(TmTextareaStyleSheet)

    // user provided stylesheet
    if (this.stylesheet) {
      adoptedStyleSheets.push(sheet(this.stylesheet))
    }

    return (
      <TmTextarea
        lineHeight={this.lineHeight}
        grammar={this.grammar}
        theme={this.theme}
        value={this._value}
        editable={this.editable}
        textareaRef={textarea => (this.textarea = textarea)}
      />
    )
  }

  get value() {
    return this.textarea.value
  }

  set value(value) {
    this._value = value
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
