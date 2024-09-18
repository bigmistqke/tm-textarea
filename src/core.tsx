import { createLazyMemo } from '@solid-primitives/memo'
import clsx from 'clsx'
import {
  ComponentProps,
  createMemo,
  createRenderEffect,
  createResource,
  createSelector,
  createSignal,
  Index,
  type JSX,
  onMount,
  Ref,
  Show,
  splitProps,
  untrack,
} from 'solid-js'
import { Grammar, Theme } from './tm'
import { getLongestLineSize } from './utils/get-longest-linesize'

import { type Accessor, getOwner, runWithOwner, type Setter } from 'solid-js'
import { createStore, type SetStoreFunction } from 'solid-js/store'
import * as oniguruma from 'vscode-oniguruma'
import * as textmate from 'vscode-textmate'
import { every, whenever } from './utils/conditionals'

const SEGMENT_SIZE = 100
const WINDOW = 100

interface ThemeData {
  name?: string
  type?: 'light' | 'dark'
  tokenColors: Array<{
    scope?: string | string[]
    settings: {
      foreground?: string
      background?: string
      fontStyle?: string
    }
  }>
  colors?: {
    'editor.background'?: string
    'editor.foreground'?: string
    [key: string]: string | undefined
  }
}

const registry = new textmate.Registry({
  onigLib: oniguruma,
  loadGrammar: async () => {
    try {
      const response = await fetch('https://unpkg.com/shiki@^0.14.5/languages/tsx.tmLanguage.json')
      if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`)
      const grammar = await response.json()
      return grammar
    } catch (error) {
      console.error('Failed to load grammar:', error)
      return null // Handle errors appropriately
    }
  },
})

const [loadWasm] = createResource(async () => {
  const buffer = await fetch('https://unpkg.com/vscode-oniguruma/release/onig.wasm').then(buffer =>
    buffer.arrayBuffer(),
  )
  await oniguruma.loadWASM(buffer)
  return true
})

/**********************************************************************************/
/*                                                                                */
/*                                      Theme                                     */
/*                                                                                */
/**********************************************************************************/

// Theme class for resolving styles and colors
class ThemeManager {
  private themeData: ThemeData

  constructor(themeData: ThemeData) {
    this.themeData = themeData
  }

  #scopes: Record<string, { foreground?: string; fontStyle?: string }> = {}

  // Resolve styles for a given scope
  resolveScope(scope: string[]): { foreground?: string; fontStyle?: string } {
    const id = scope.join('-')

    if (this.#scopes[id]) return this.#scopes[id]

    let finalStyle: { foreground?: string; fontStyle?: string } = {
      foreground: undefined,
      fontStyle: undefined,
    }

    for (let i = 0; i < scope.length; i++) {
      const currentScope = scope[i]!
      for (const themeRule of this.themeData.tokenColors) {
        const themeScopes = Array.isArray(themeRule.scope) ? themeRule.scope : [themeRule.scope]

        for (const themeScope of themeScopes) {
          if (currentScope.startsWith(themeScope || '')) {
            finalStyle = { ...finalStyle, ...themeRule.settings }
          }
        }
      }
    }

    return (this.#scopes[id] = finalStyle)
  }

  // Get background color
  getBackgroundColor() {
    return this.themeData.colors?.['editor.background'] || '#FFFFFF'
  }

  // Get foreground color
  getForegroundColor() {
    return this.themeData.colors?.['editor.foreground'] || '#000000'
  }
}

/**********************************************************************************/
/*                                                                                */
/*                                     Segment                                    */
/*                                                                                */
/**********************************************************************************/

// Segment class that tokenizes and renders lines
class Segment {
  #generated: Accessor<string[]>

  next: Segment | null = null
  lines: Accessor<string[]>
  setLines: Setter<string[]>
  stateStack: Accessor<textmate.StateStack>
  setStateStack: Setter<textmate.StateStack>

  constructor(
    public manager: SegmentManager,
    public previous: Segment | null,
  ) {
    const previousStateStack = () => (this.previous ? this.previous.stateStack() : textmate.INITIAL)

    ;[this.lines, this.setLines] = createSignal<string[]>([])
    ;[this.stateStack, this.setStateStack] = createSignal<any>(previousStateStack())

    this.#generated = createLazyMemo(previous => {
      let stateStack = previousStateStack()

      const result = this.lines().map(line => {
        const { ruleStack, tokens } = this.manager.tokenizer.tokenizeLine(line, stateStack)
        stateStack = ruleStack
        return tokens
          .map(token => {
            const style = this.manager.theme.resolveScope(token.scopes)
            const tokenValue = line.slice(token.startIndex, token.endIndex)
            return `<span style="color:${style.foreground}; text-decoration:${style.fontStyle}">${tokenValue}</span>`
          })
          .join('')
      })

      if (!equalsRuleStack(stateStack, untrack(this.stateStack))) {
        console.log('set state stack')
        this.setStateStack(stateStack)
      }

      return result
    })
  }

  get html() {
    return this.#generated().join('\n')
  }

  getLine(localOffset: number): string | undefined {
    return this.#generated()[localOffset]
  }
}

/**********************************************************************************/
/*                                                                                */
/*                                 Segment Manager                                */
/*                                                                                */
/**********************************************************************************/

// SegmentManager class to manage multiple segments
class SegmentManager {
  #segments: Segment[]
  #setSegments: SetStoreFunction<Segment[]>
  segmentSize = SEGMENT_SIZE

  constructor(
    public tokenizer: textmate.IGrammar,
    public theme: ThemeManager,
  ) {
    ;[this.#segments, this.#setSegments] = createStore<Segment[]>([])
  }

  setSource(newSource: string) {
    const newLines = newSource.split('\n')

    const newLineCount = newLines.length
    const currentSegmentCount = this.#segments.length
    const newSegmentCount = Math.ceil(newLineCount / this.segmentSize)

    // Add new segments if needed
    if (newSegmentCount > currentSegmentCount) {
      let previousSegment = this.#segments[this.#segments.length - 1] || null

      for (let i = currentSegmentCount; i < newSegmentCount; i += 1) {
        const start = i * this.segmentSize
        const end = start + this.segmentSize
        const segmentLines = newLines.slice(start, end)
        const segment = new Segment(this, previousSegment)
        segment.setLines(segmentLines)
        this.#setSegments(prev => [...prev, segment])
        previousSegment = segment
      }
    }

    // Remove segments if needed
    if (newSegmentCount < currentSegmentCount) {
      this.#setSegments(prev => prev.slice(0, newSegmentCount))
    }

    // Update the remaining segments
    for (let i = 0; i < Math.min(newSegmentCount, currentSegmentCount); i++) {
      const start = i * this.segmentSize
      const end = start + this.segmentSize
      this.#segments[i]!.setLines(newLines.slice(start, end))
    }
  }

  getLine(globalOffset: number): string | null {
    const segmentIndex = Math.floor(globalOffset / this.segmentSize)
    const segment = this.#segments[segmentIndex]
    if (!segment) return null
    const localOffset = globalOffset % this.segmentSize
    return segment.getLine(localOffset) || null
  }

  getSegment(index: number): Segment | null {
    return this.#segments[index] || null
  }

  get html() {
    return this.#segments.map(segment => segment.html).join('\n')
  }
}

/**********************************************************************************/
/*                                                                                */
/*                                      Equals                                    */
/*                                                                                */
/**********************************************************************************/

const DEBUG = true

function equalsRuleStack(stateA: any, stateB: any): boolean {
  let changed = false

  if (stateA === stateB) return true

  if (!stateA || !stateB) {
    DEBUG && console.log('One of the states is null or undefined')
    return false
  }

  // Compare relevant fields
  if (stateA.ruleId !== stateB.ruleId) {
    DEBUG && console.log(`ruleId changed: ${stateA.ruleId} -> ${stateB.ruleId}`)
    changed = true
  }

  if (stateA.depth !== stateB.depth) {
    DEBUG && console.log(`depth changed: ${stateA.depth} -> ${stateB.depth}`)
    changed = true
  }

  if (!shallowEqualScopes(stateA.nameScopesList, stateB.nameScopesList)) {
    DEBUG && console.log('nameScopesList changed')
    changed = true
  }

  /* 

  if (!shallowEqualScopes(stateA.contentNameScopesList, stateB.contentNameScopesList)) {
    DEBUG && console.log('contentNameScopesList changed')
    changed = true
  } */

  return !changed
}

function shallowEqualScopes(scopeA: any, scopeB: any): boolean {
  if (!scopeA && !scopeB) return true
  if (!scopeA || !scopeB) return false

  if (scopeA.scopePath === scopeB.scopePath) {
    DEBUG && console.log(`scopePath changed: ${scopeA.scopePath} -> ${scopeB.scopePath}`)
    return false
  }

  if (scopeA.tokenAttributes !== scopeB.tokenAttributes) {
    DEBUG &&
      console.log(`tokenAttributes changed: ${scopeA.tokenAttributes} -> ${scopeB.tokenAttributes}`)
    return false
  }

  return true
}

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
      (index: number, [start, end]) => {
        return index + WINDOW > start && index - WINDOW < end
      },
    )

    const [tokenizer] = createResource(
      every(() => props.grammar, loadWasm),
      async ([grammar]) => registry.loadGrammar(grammar),
    )
    const [theme] = createResource(async () => {
      const response = await fetch(`https://unpkg.com/shiki@^0.14.5/themes/${props.theme}.json`)
      const themeData = await response.json()
      return new ThemeManager(themeData)
    })

    const manager = createMemo(
      whenever(every(tokenizer, theme), ([tokenizer, theme]) => {
        const manager = new SegmentManager(tokenizer, theme)

        const owner = getOwner()
        createRenderEffect(() => {
          const _source = source()
          runWithOwner(owner, () => manager.setSource(_source))
        })

        return manager
      }),
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
          <Index each={Array.from({ length: source().split('\n').length })}>
            {(_, index) => (
              <Show when={isVisible(index)}>
                <pre
                  class={styles.segment}
                  innerHTML={manager()?.getLine(index)}
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
          /* disabled={!config.editable} */
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
