import { createLazyMemo } from '@solid-primitives/memo'
import clsx from 'clsx'
import {
  type Accessor,
  ComponentProps,
  createMemo,
  createRenderEffect,
  createResource,
  createRoot,
  createSelector,
  createSignal,
  getOwner,
  Index,
  type JSX,
  onMount,
  Ref,
  runWithOwner,
  type Setter,
  Show,
  splitProps,
} from 'solid-js'
import { createStore, type SetStoreFunction } from 'solid-js/store'
import * as oniguruma from 'vscode-oniguruma'
import * as textmate from 'vscode-textmate'
import { Grammar, Theme } from './tm'
import { hexToRgb, luminance } from './utils/colors'
import { every, when } from './utils/conditionals'
import { getLongestLineSize } from './utils/get-longest-linesize'

const DEBUG = false
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

    let finalStyle: { foreground?: string; fontStyle?: string } = {}

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

function escapeHTML(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// Segment class that tokenizes and renders lines
class Segment {
  #generated: Accessor<string[]>

  next: Segment | null = null

  stack: Accessor<textmate.StateStack>
  setStack: Setter<textmate.StateStack>

  constructor(
    public manager: SegmentManager,
    public previous: Segment | null,
    index: number,
  ) {
    const start = index * this.manager.segmentSize
    const end = start + this.manager.segmentSize

    ;[this.stack, this.setStack] = createSignal<any>(this.previous?.stack() || textmate.INITIAL, {
      equals: equalStack,
    })

    const lines = createLazyMemo(() => this.manager.lines().slice(start, end + 1))

    this.#generated = createLazyMemo(() => {
      let currentStack = this.previous?.stack() || textmate.INITIAL

      const result = lines().map(line => {
        const { ruleStack, tokens } = this.manager.tokenizer.tokenizeLine(line, currentStack)

        currentStack = ruleStack

        return tokens
          .map(token => {
            const style = this.manager.theme.resolveScope(token.scopes)
            const tokenValue = line.slice(token.startIndex, token.endIndex)
            return `<span style="${style.foreground ? `color:${style.foreground};` : ''}${
              style.fontStyle ? `text-decoration:${style.fontStyle}` : ''
            }">${escapeHTML(tokenValue)}</span>`
          })
          .join('')
      })

      this.setStack(currentStack)

      return result
    })
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
  lines: Accessor<string[]>

  constructor(
    public tokenizer: textmate.IGrammar,
    public theme: ThemeManager,
    public source: Accessor<string>,
  ) {
    ;[this.#segments, this.#setSegments] = createStore<Segment[]>([])
    const owner = getOwner()

    this.lines = createMemo(() => {
      const lines = source().split('\n')
      return lines
    })

    createRenderEffect(() =>
      runWithOwner(owner, () => {
        const newLineCount = this.lines().length
        const currentSegmentCount = this.#segments.length
        const newSegmentCount = Math.ceil(newLineCount / this.segmentSize)

        // Add new segments if needed
        if (newSegmentCount > currentSegmentCount) {
          let previousSegment = this.#segments[this.#segments.length - 1] || null

          for (let i = currentSegmentCount; i < newSegmentCount; i += 1) {
            const segment = new Segment(this, previousSegment, i)
            this.#setSegments(prev => [...prev, segment])
            previousSegment = segment
          }
        }

        // Remove segments if needed
        if (newSegmentCount < currentSegmentCount) {
          this.#setSegments(prev => prev.slice(0, newSegmentCount))
        }
      }),
    )
  }

  getSegment(index: number): Segment | null {
    return this.#segments[index] || null
  }

  getLine(globalOffset: number): string | null {
    const segmentIndex = Math.floor(globalOffset / this.segmentSize)
    const segment = this.#segments[segmentIndex]
    if (!segment) return null
    const localOffset = globalOffset % this.segmentSize
    return segment.getLine(localOffset) || null
  }
}

/**********************************************************************************/
/*                                                                                */
/*                                      Equals                                    */
/*                                                                                */
/**********************************************************************************/

function equalStack(stateA: any, stateB: any): boolean {
  let changed = false

  if (stateA === stateB) return true

  if (!stateA || !stateB) {
    DEBUG && console.info('One of the states is null or undefined')
    return false
  }

  // Compare relevant fields
  if (stateA.ruleId !== stateB.ruleId) {
    DEBUG && console.info(`ruleId changed: ${stateA.ruleId} -> ${stateB.ruleId}`)
    changed = true
  }

  if (stateA.depth !== stateB.depth) {
    DEBUG && console.info(`depth changed: ${stateA.depth} -> ${stateB.depth}`)
    changed = true
  }

  if (!equalScopes(stateA.nameScopesList, stateB.nameScopesList)) {
    DEBUG && console.info('nameScopesList changed')
    changed = true
  }

  if (!equalScopes(stateA.contentNameScopesList, stateB.contentNameScopesList)) {
    DEBUG && console.info('contentNameScopesList changed')
    changed = true
  }

  return !changed
}

function equalScopes(scopeA: any, scopeB: any): boolean {
  if (!scopeA && !scopeB) return true
  if (!scopeA || !scopeB) return false

  if (scopeA.scopePath === scopeB.scopePath) {
    DEBUG && console.info(`scopePath changed: ${scopeA.scopePath} -> ${scopeB.scopePath}`)
    return false
  }

  if (scopeA.tokenAttributes !== scopeB.tokenAttributes) {
    DEBUG &&
      console.info(
        `tokenAttributes changed: ${scopeA.tokenAttributes} -> ${scopeB.tokenAttributes}`,
      )
    return false
  }

  return true
}

/**********************************************************************************/
/*                                                                                */
/*                                     Set Cdn                                    */
/*                                                                                */
/**********************************************************************************/

type CdnAssetType = 'theme' | 'grammar' | 'oniguruma'

type Cdn = string | ((type: CdnAssetType, id: string) => string)

let CDN: Cdn = 'https://esm.sh'
const CACHE = {
  theme: {} as Record<string, Promise<any>>,
  grammar: {} as Record<string, Promise<any>>,
}

/**
 * Sets the CDN from which the theme/lang of <shiki-textarea/> is fetched.
 *
 * Accepts as arguments
 * - url: string
 * - callback: (type: 'lang' | 'theme' | 'oniguruma', id: string) => string
 *
 * When given an url, this will be used to fetch
 * - `${cdn}/tm-themes/themes/${theme}.json` for the `themes`
 * - `${cdn}/tm-grammars/grammars/${grammar}.json` for the `grammars`
 * - `${cdn}/vscode-oniguruma/release/onig.wasm` for the `oniguruma` wasm-file
 *
 * When given a callback, the returned string will be used to fetch.
 */
export function setCDN(cdn: Cdn) {
  CDN = cdn
}

function urlFromCDN(type: CdnAssetType, key: string) {
  if (typeof CDN === 'function') {
    return CDN(type, key)
  }
  switch (type) {
    case 'theme':
      return `${CDN}/tm-themes/themes/${key}.json`
    case 'grammar':
      return `${CDN}/tm-grammars/grammars/${key}.json`
    case 'oniguruma':
      return `${CDN}/vscode-oniguruma/release/onig.wasm`
  }
}

async function fetchFromCDN(type: 'theme' | 'grammar', key: string) {
  if (key in CACHE[type]) {
    return CACHE[type][key]
  }
  return (CACHE[type][key] = fetch(urlFromCDN(type, key))
    .then(response => (response.ok ? response.json() : null))
    .catch(console.error))
}

/**********************************************************************************/
/*                                                                                */
/*                             Create Segment Manager                             */
/*                                                                                */
/**********************************************************************************/

const TOKENIZER_CACHE: Record<string, textmate.IGrammar | null> = {}
const REGISTRY = new textmate.Registry({
  onigLib: oniguruma,
  loadGrammar: (grammar: string) =>
    fetchFromCDN('grammar', grammar).then(response => {
      response.scopeName = grammar
      return response
    }),
})
const [WASM_LOADED] = createRoot(() =>
  createResource(async () =>
    fetch(urlFromCDN('oniguruma', null!))
      .then(buffer => buffer.arrayBuffer())
      .then(buffer => oniguruma.loadWASM(buffer))
      .then(() => true),
  ),
)

function createManager(props: TextmateTextareaProps) {
  const [source, setSource] = createSignal(props.value)

  const [tokenizer] = createResource(
    every(() => props.grammar, WASM_LOADED),
    async ([grammar]) =>
      grammar in TOKENIZER_CACHE
        ? TOKENIZER_CACHE[grammar]
        : (TOKENIZER_CACHE[grammar] = await REGISTRY.loadGrammar(grammar)),
  )

  const [theme] = createResource(
    () => props.theme,
    theme => fetchFromCDN('theme', theme).then(theme => new ThemeManager(theme)),
  )

  const manager = createMemo(
    when(
      every(tokenizer, theme),
      ([tokenizer, theme]) => new SegmentManager(tokenizer, theme, source),
    ),
  )

  // NOTE:  Update to projection once this lands in solid 2.0
  //        Sync local source signal with config.source
  createRenderEffect(() => setSource(props.value))

  return [manager, setSource] as const
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

    const [dimensions, setDimensions] = createSignal<{ width: number; height: number }>()
    const [scrollTop, setScrollTop] = createSignal(0)
    const [manager, setSource] = createManager(props)
    const [charHeight, setCharHeight] = createSignal<string>()

    const lineSize = createMemo(() => getLongestLineSize(manager()?.lines() || []))

    const minLine = createMemo(() => Math.floor(scrollTop() / props.lineHeight))
    const maxLine = createMemo(() =>
      Math.floor((scrollTop() + (dimensions()?.height || 0)) / props.lineHeight),
    )

    const minSegment = createMemo(() => Math.floor(minLine() / SEGMENT_SIZE))
    const maxSegment = createMemo(() => Math.ceil(maxLine() / SEGMENT_SIZE))

    const isVisible = createSelector(
      () => [minLine(), maxLine()] as [number, number],
      (index: number, [viewportMin, viewportMax]) => {
        return index + WINDOW > viewportMin && index - WINDOW < viewportMax
      },
    )

    const isSegmentVisible = createSelector(
      () => [minSegment(), maxSegment()] as [number, number],
      (index: number, [viewportMin, viewportMax]) => {
        const segmentMin = Math.floor((index - WINDOW) / SEGMENT_SIZE)
        const segmentMax = Math.ceil((index + WINDOW) / SEGMENT_SIZE)
        return (
          (segmentMin <= viewportMin && segmentMax >= viewportMax) ||
          (segmentMin >= viewportMin && segmentMin <= viewportMax) ||
          (segmentMax >= viewportMin && segmentMax <= viewportMax)
        )
      },
    )

    onMount(() => {
      const observer = new ResizeObserver(([entry]) => setDimensions(entry?.contentRect))
      observer.observe(container)
    })

    const selectionColor = when(manager, manager => {
      const bg = manager.theme.getBackgroundColor()
      const commentLuminance = luminance(...hexToRgb(bg))
      const opacity = commentLuminance > 0.9 ? 0.1 : commentLuminance < 0.1 ? 0.25 : 0.175
      return `rgba(98, 114, 164, ${opacity})`
    })

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
          '--background-color': manager()?.theme.getBackgroundColor(),
          '--char-height': charHeight(),
          '--foreground-color': manager()?.theme.getForegroundColor(),
          '--line-count': manager()?.lines().length,
          '--line-height': `${props.lineHeight}px`,
          '--line-size': lineSize(),
          '--selection-color': selectionColor(),
          ...config.style,
        }}
        {...rest}
      >
        <code
          ref={element => {
            new ResizeObserver(() => {
              const { height } = getComputedStyle(element)
              setCharHeight(height)
            }).observe(element)
          }}
          aria-hidden
          class={styles.character}
        >
          &nbsp;
        </code>
        <Show when={manager()}>
          {manager => (
            <code class={styles.segments}>
              <Index
                each={Array.from({ length: Math.ceil(manager().lines().length / SEGMENT_SIZE) })}
              >
                {(_, segmentIndex) => (
                  <Show when={isSegmentVisible(segmentIndex * SEGMENT_SIZE)}>
                    <Index each={Array.from({ length: SEGMENT_SIZE })}>
                      {(_, index) => (
                        <Show when={isVisible(segmentIndex * SEGMENT_SIZE + index)}>
                          <pre
                            class={styles.segment}
                            innerHTML={manager().getLine(segmentIndex * SEGMENT_SIZE + index)}
                            style={{
                              '--line-number': segmentIndex * SEGMENT_SIZE + index,
                              // top: `${(segmentIndex * SEGMENT_SIZE + index) * props.lineHeight}px`,
                            }}
                          />
                        </Show>
                      )}
                    </Index>
                  </Show>
                )}
              </Index>
            </code>
          )}
        </Show>
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
