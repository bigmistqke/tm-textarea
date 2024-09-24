import {
  booleanAttribute,
  element,
  Element,
  ElementAttributes,
  stringAttribute,
} from '@lume/element'
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
class TmTextareaElement extends Element {
  @booleanAttribute editable = true
  @stringAttribute grammar: Grammar = 'tsx'
  @stringAttribute stylesheet = ''
  @stringAttribute theme: Theme = 'dark-plus'
  @stringAttribute value = ''

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
        grammar={this.grammar}
        theme={this.theme}
        value={this.value}
        editable={this.editable}
        onInput={e => (this.value = e.currentTarget.value)}
      />
    )
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
