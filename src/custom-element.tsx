import {
  booleanAttribute,
  element,
  Element,
  eventAttribute,
  stringAttribute,
  type ElementAttributes,
  type EventListener,
} from '@lume/element'
import { signal } from 'classy-solid'
import { Patch } from './contenteditable'
import { createTmTextarea } from './core'
import styles from './custom-element.module.css'
import css from './custom-element.module.css?inline'
import { Grammar, Theme } from './tm'

/**********************************************************************************/
/*                                                                                */
/*                                 Custom Element                                 */
/*                                                                                */
/**********************************************************************************/

const TmTextarea = createTmTextarea(styles)

export class ValueEvent extends Event {
  constructor(public value: string) {
    super('value')
  }
}

export type TmTextareaAttributes =
  | 'editable'
  | 'grammar'
  | 'stylesheet'
  | 'theme'
  | 'value'
  | 'bindings'
  | 'onvalue'

@element('tm-textarea')
export class TmTextareaElement extends Element {
  hasShadow = false

  @booleanAttribute editable = true
  @stringAttribute grammar: Grammar = 'tsx'
  @stringAttribute stylesheet = ''
  @stringAttribute theme: Theme = 'dark-plus'
  @stringAttribute value = ''
  @signal bindings: Record<
    string,
    (event: KeyboardEvent & { currentTarget: HTMLElement }) => Patch | null
  > = {}

  @eventAttribute onvalue: EventListener<ValueEvent & { currentTarget: TmTextareaElement }> | null =
    null

  static css = css

  template = () => (
    <TmTextarea
      grammar={this.grammar}
      theme={this.theme}
      value={this.value}
      editable={this.editable}
      onValue={value => {
        this.value = value
        this.dispatchEvent(new ValueEvent(value))
      }}
      bindings={this.bindings}
    />
  )
}

// NOTE:  <tm-textarea/> is already defined with lume's @element() decorator.
//        register is a NOOP, but is needed for rollup not to treeshake
//        the custom-element declaration out of the bundle.
export function register() {
  if (!customElements.get('tm-textarea')) {
    customElements.define('tm-textarea', TmTextareaElement)
  }
}

/**********************************************************************************/
/*                                                                                */
/*                                      Types                                     */
/*                                                                                */
/**********************************************************************************/

declare module 'solid-js/jsx-runtime' {
  namespace JSX {
    interface IntrinsicElements {
      'tm-textarea': ElementAttributes<TmTextareaElement, TmTextareaAttributes>
    }
  }
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'tm-textarea': ElementAttributes<TmTextareaElement, TmTextareaAttributes>
    }
  }
}

// Hook up the type for use in DOM APIs
declare global {
  interface HTMLElementTagNameMap {
    'tm-textarea': TmTextareaElement
  }
}
