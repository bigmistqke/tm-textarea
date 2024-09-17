import clsx from 'clsx'
import {
  ComponentProps,
  createMemo,
  createRenderEffect,
  createResource,
  createSelector,
  createSignal,
  Index,
  onMount,
  Ref,
  Show,
  splitProps,
  type JSX,
} from 'solid-js'
import TextMateHighlighter from 'textmate-highlighter'
import { Grammar, GRAMMARS, ONIGURUMA, Theme, THEMES } from './tm'
import { getLeadingNewlines } from './utils/get-leading-newlines'
import { getLongestLineSize } from './utils/get-longest-linesize'

/**********************************************************************************/
/*                                                                                */
/*                                   Constants                                    */
/*                                                                                */
/**********************************************************************************/

const HIGHLIGHTER = new TextMateHighlighter<Grammar, Theme>({
  getGrammar: grammar => {
    return GRAMMARS[grammar]
  },
  getTheme: theme => {
    return THEMES[theme]
  },
  getOniguruma: () => {
    return ONIGURUMA
  },
})

const WINDOW = 10

/**********************************************************************************/
/*                                                                                */
/*                               Textmate Textarea                                */
/*                                                                                */
/**********************************************************************************/

export interface TextmateTextareaProps extends Omit<ComponentProps<'div'>, 'style' | 'onInput'> {
  /** If textarea is editable or not. */
  editable?: boolean
  /**
   * The grammar of the source code for syntax highlighting.
   */
  grammar: Grammar
  /** Custom CSS properties to apply to the editor. */
  style?: JSX.CSSProperties
  /** Ref to the internal html-textarea-element. */
  textareaRef?: Ref<HTMLTextAreaElement>
  /**
   * The theme to apply for syntax highlighting.
   */
  theme: Theme
  /** The source code to be displayed and edited. */
  value: string
  /** Callback function to handle updates to the source code. */
  onInput?: (event: InputEvent & { currentTarget: HTMLTextAreaElement }) => void
  lineHeight: number
}

export function createTmTextarea(styles: Record<string, string>) {
  return function TmTextarea(props: TextmateTextareaProps) {
    const [config, rest] = splitProps(props, [
      'class',
      'grammar',
      'onInput',
      'value',
      'style',
      'theme',
      'editable',
      'onScroll',
    ])
    let container: HTMLDivElement

    const [source, setSource] = createSignal(config.value)
    const [html] = createResource(
      source,
      async code =>
        `\n`.repeat(getLeadingNewlines(code)) +
        (await HIGHLIGHTER.highlightToHTML({
          code,
          grammar: props.grammar,
          theme: props.theme,
        })),
    )
    const segments = createMemo(
      () =>
        html()
          ?.replace(/<pre[^>]*>/, '')
          .replace(/<\/pre>/, '')
          .split('\n'),
    )
    const lineSize = createMemo(() => getLongestLineSize(source()))
    const lineCount = createMemo(() => source().split('\n').length)

    const [domRect, setDomRect] = createSignal<DOMRectReadOnly>()
    const [scrollTop, setScrollTop] = createSignal(0)
    const min = createMemo(() => Math.floor(scrollTop() / props.lineHeight))
    const max = createMemo(() =>
      Math.floor((scrollTop() + (domRect()?.height || 0)) / props.lineHeight),
    )
    const isVisible = createSelector(
      () => [min(), max()] as [number, number],
      (index: number, [start, end]) => index + WINDOW > start && index - WINDOW < end,
    )

    onMount(() => {
      const observer = new ResizeObserver(([entry]) => setDomRect(entry?.contentRect))
      observer.observe(container)
    })

    // NOTE:  Update to projection once this lands in solid 2.0
    //        Sync local source signal with config.source
    createRenderEffect(() => setSource(config.value))

    return (
      <div
        part="root"
        ref={container!}
        class={clsx(styles.container, config.class)}
        onScroll={e => {
          setScrollTop(e.currentTarget.scrollTop)
          props.onScroll?.(e)
        }}
        style={{
          background: 'white',
          'line-height': `${props.lineHeight}px`,
          '--line-size': lineSize(),
          '--line-count': lineCount(),
          ...config.style,
        }}
        {...rest}
      >
        <code class={styles.segments}>
          <Index each={segments()}>
            {(line, index) => (
              <Show when={line() && isVisible(index)}>
                <pre
                  class={styles.segment}
                  innerHTML={line()}
                  style={{ top: `${index * props.lineHeight}px` }}
                />
              </Show>
            )}
          </Index>
        </code>
        <textarea
          ref={props.textareaRef}
          part="textarea"
          autocomplete="off"
          class={styles.textarea}
          disabled={!config.editable}
          inputmode="none"
          spellcheck={false}
          value={config.value}
          onScroll={e => {
            e.preventDefault()
            e.stopPropagation()
          }}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault()

              // Get current scroll position
              const scrollTop = container.scrollTop

              // Get current cursor position (caret)
              const start = e.currentTarget.selectionStart
              const end = e.currentTarget.selectionEnd

              // Insert the new line at the cursor position
              const value = e.currentTarget.value
              e.currentTarget.value = setSource(
                value.substring(0, start) + '\n' + value.substring(end),
              )

              // Move the cursor to just after the inserted new line
              e.currentTarget.selectionStart = e.currentTarget.selectionEnd = start + 1

              // Restore the scroll position
              container.scrollTop = scrollTop
            }
          }}
          on:input={e => {
            const target = e.currentTarget
            const value = target.value

            // local
            setSource(value)

            // user provided callback
            config.onInput?.(e)
          }}
        />
      </div>
    )
  }
}
