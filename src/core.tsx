import { createLazyMemo } from '@solid-primitives/memo'
import clsx from 'clsx'
import {
  ComponentProps,
  createContext,
  createMemo,
  createRenderEffect,
  createResource,
  createRoot,
  createSelector,
  createSignal,
  Index,
  type JSX,
  mergeProps,
  onCleanup,
  onMount,
  Ref,
  Show,
  splitProps,
  useContext,
} from 'solid-js'
import * as oniguruma from 'vscode-oniguruma'
import * as textmate from 'vscode-textmate'
import { fetchFromCDN, urlFromCDN } from './cdn'
import { Grammar, Theme } from './tm'
import { applyStyle } from './utils/apply-style'
import { hexToRgb, luminance } from './utils/colors'
import { every, when } from './utils/conditionals'
import { countDigits } from './utils/count-digits'
import { escapeHTML } from './utils/escape-html'
import { getLongestLineSize } from './utils/get-longest-linesize'
import { Stack } from './utils/stack'

export { css } from './css'

/**********************************************************************************/
/*                                                                                */
/*                                    Constants                                   */
/*                                                                                */
/**********************************************************************************/

const DEBUG = false
const SEGMENT_SIZE = 100
const WINDOW = 50
const TOKENIZER_CACHE: Record<string, textmate.IGrammar | null> = {}
const REGISTRY = new textmate.Registry({
  // @ts-ignore
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

/**********************************************************************************/
/*                                                                                */
/*                                     Types                                      */
/*                                                                                */
/**********************************************************************************/

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
interface Dimensions {
  height: number
  width: number
}
interface SegmentData {
  stack: textmate.StateStack
}
interface ScopeNode {
  scopeName?: string
  parent: ScopeNode
}
interface ScopesList {
  scopePath: ScopeNode
  tokenAttributes: number
}
interface StateStack extends textmate.StateStack {
  ruleId: number
  nameScopesList: ScopesList
  contentNameScopesList: ScopesList
}

/**********************************************************************************/
/*                                                                                */
/*                                      Theme                                     */
/*                                                                                */
/**********************************************************************************/

/** Theme class for resolving styles and colors */
class ThemeManager {
  private themeData: ThemeData

  constructor(themeData: ThemeData) {
    this.themeData = themeData
  }

  #scopes: Record<string, { foreground?: string; fontStyle?: string }> = {}

  // TODO:  Pretty sure this is an incomplete implementation.
  //        Should either re-factor to use REGISTRY.getColorMap() and tokenizer.tokenizeLine2()
  //        or complete the implementation.
  resolveScope(scope: string[]): { foreground?: string; fontStyle?: string } {
    const id = scope.join('-')

    if (this.#scopes[id]) return this.#scopes[id]!

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

  getBackgroundColor() {
    return this.themeData.colors?.['editor.background'] || undefined
  }

  getForegroundColor() {
    return this.themeData.colors?.['editor.foreground'] || undefined
  }
}

/**********************************************************************************/
/*                                                                                */
/*                                 Compare Stacks                                 */
/*                                                                                */
/**********************************************************************************/

/** Utility-function that comparse two textmate.StateStack */
function compareStacks(stateA: StateStack, stateB: StateStack): boolean {
  let changed = false

  if (stateA === stateB) return true

  if (!stateA || !stateB) {
    DEBUG && console.info('One of the states is null or undefined')
    return false
  }

  if (stateA.ruleId !== stateB.ruleId) {
    DEBUG && console.info(`ruleId changed: ${stateA.ruleId} -> ${stateB.ruleId}`)
    changed = true
  }

  if (stateA.depth !== stateB.depth) {
    DEBUG && console.info(`depth changed: ${stateA.depth} -> ${stateB.depth}`)
    changed = true
  }

  if (!compareScopes(stateA.nameScopesList, stateB.nameScopesList)) {
    DEBUG && console.info('nameScopesList changed')
    changed = true
  }

  if (!compareScopes(stateA.contentNameScopesList, stateB.contentNameScopesList)) {
    DEBUG && console.info('contentNameScopesList changed')
    changed = true
  }

  return !changed
}

function compareScopes(scopeA: ScopesList, scopeB: ScopesList): boolean {
  if (!scopeA && !scopeB) return true
  if (!scopeA || !scopeB) return false

  if (scopeA.scopePath?.scopeName !== scopeB.scopePath?.scopeName) {
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
/*                               Tm Textarea Context                              */
/*                                                                                */
/**********************************************************************************/

const TmTextareaContext = createContext<{
  viewport: Dimensions | undefined
  character: Dimensions | undefined
  scrollTop: number
  lines: string[]
  segments: Stack<SegmentData>
  tokenizer: textmate.IGrammar | null | undefined
  theme: ThemeManager | undefined
  isVisible: (index: number) => boolean
  isSegmentVisible: (index: number) => boolean
} | null>(null)

function useTmTextarea() {
  const context = useContext(TmTextareaContext)
  if (!context) {
    throw `useTextarea should be used in a descendant of TmTextarea`
  }
  return context
}

/**********************************************************************************/
/*                                                                                */
/*                              Create Tm Textarea                                */
/*                                                                                */
/**********************************************************************************/

export interface TmTextareaProps
  extends Omit<ComponentProps<'div'>, 'style' | 'onInput' | 'onScroll'> {
  /** If textarea is editable or not. */
  editable?: boolean
  /** The grammar of the source code for syntax highlighting. */
  grammar: Grammar
  /** Custom CSS properties to apply to the editor. */
  style?: JSX.CSSProperties
  /** Ref to the internal html-textarea-element. */
  textareaRef?: Ref<HTMLTextAreaElement>
  /** The theme to apply for syntax highlighting. */
  theme: Theme
  /** The source code to be displayed and edited. */
  value: string
  /** Callback function to handle input-event. */
  onInput?: (event: InputEvent & { currentTarget: HTMLTextAreaElement }) => void
  /** Callback function to handle scroll-event. */
  onScroll?: (event: Event & { currentTarget: HTMLDivElement }) => void
}

export function createTmTextarea(styles: Record<string, string>) {
  function Segment(props: { index: number }) {
    const context = useTmTextarea()
    const previous = context.segments.peek()

    const [stack, setStack] = createSignal<any>(previous?.stack || textmate.INITIAL, {
      equals: compareStacks,
    })

    const start = props.index * SEGMENT_SIZE
    const end = start + SEGMENT_SIZE

    const html = createLazyMemo(
      when(
        every(
          () => context.tokenizer,
          () => context.theme,
        ),
        ([tokenizer, theme]) => {
          let currentStack = previous?.stack || textmate.INITIAL

          const result = context.lines.slice(start, end).map(line => {
            const { ruleStack, tokens } = tokenizer.tokenizeLine(line, currentStack)

            currentStack = ruleStack

            return tokens
              .map(token => {
                const style = theme.resolveScope(token.scopes)
                const tokenValue = line.slice(token.startIndex, token.endIndex)
                return `<span style="${style.foreground ? `color:${style.foreground};` : ''}${
                  style.fontStyle ? `text-decoration:${style.fontStyle}` : ''
                }">${escapeHTML(tokenValue)}</span>`
              })
              .join('')
          })

          setStack(currentStack)

          return result
        },
        () => context.lines.slice(start, end).map(escapeHTML),
      ),
    )

    context.segments.push({
      get stack() {
        return stack()
      },
    })
    onCleanup(() => context.segments.pop())

    return (
      <Show when={context.isSegmentVisible(props.index * SEGMENT_SIZE)}>
        <Index each={Array.from({ length: SEGMENT_SIZE })}>
          {(_, index) => (
            <Show when={context.isVisible(props.index * SEGMENT_SIZE + index)}>
              <pre
                class={styles.line}
                part="line"
                innerHTML={html()?.[index]}
                style={{
                  '--tm-line-number': props.index * SEGMENT_SIZE + index,
                }}
              />
            </Show>
          )}
        </Index>
      </Show>
    )
  }

  return function TmTextarea(props: TmTextareaProps) {
    const [config, rest] = splitProps(mergeProps({ editable: true }, props), [
      'class',
      'grammar',
      'onInput',
      'value',
      'style',
      'theme',
      'editable',
      'onScroll',
      'textareaRef',
    ])

    let container: HTMLDivElement

    const [character, setCharacter] = createSignal<Dimensions>()
    const [viewport, setViewport] = createSignal<Dimensions>()
    const [scrollTop, setScrollTop] = createSignal(0)
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
      async theme => fetchFromCDN('theme', theme).then(theme => new ThemeManager(theme)),
    )

    const lines = createMemo(() => source().split('\n'))
    const lineSize = createMemo(() => getLongestLineSize(lines()))
    const minLine = createMemo(() => Math.floor(scrollTop() / (character()?.height || 1)))
    const maxLine = createMemo(() =>
      Math.floor((scrollTop() + (viewport()?.height || 0)) / (character()?.height || 1)),
    )
    const minSegment = createMemo(() => Math.floor(minLine() / SEGMENT_SIZE))
    const maxSegment = createMemo(() => Math.ceil(maxLine() / SEGMENT_SIZE))

    const selectionColor = when(theme, theme => {
      const bg = theme.getBackgroundColor()
      const commentLuminance = luminance(...hexToRgb(bg))
      const opacity = commentLuminance > 0.9 ? 0.1 : commentLuminance < 0.1 ? 0.25 : 0.175
      return `rgba(98, 114, 164, ${opacity})`
    })
    const style = when(
      () => config.style,
      style => splitProps(style, ['width', 'height'])[1],
    )

    onMount(() =>
      new ResizeObserver(([entry]) => setViewport(entry?.contentRect)).observe(container),
    )

    // NOTE:  Update to projection once this lands in solid 2.0
    //        Sync local source signal with config.source
    createRenderEffect(() => setSource(props.value))

    createRenderEffect(() => console.log(theme()?.getForegroundColor()))

    return (
      <TmTextareaContext.Provider
        value={{
          get viewport() {
            return viewport()
          },
          get character() {
            return character()
          },
          get scrollTop() {
            return scrollTop()
          },
          get lines() {
            return lines()
          },
          get theme() {
            return theme()
          },
          get tokenizer() {
            return tokenizer()
          },
          segments: new Stack<SegmentData>(),
          isVisible: createSelector(
            () => [minLine(), maxLine()] as [number, number],
            (index: number, [viewportMin, viewportMax]) => {
              if (index > lines().length - 1) {
                return false
              }
              return index + WINDOW > viewportMin && index - WINDOW < viewportMax
            },
          ),
          isSegmentVisible: createSelector(
            () => [minSegment(), maxSegment()],
            (index: number) => {
              const segmentMin = Math.floor((index - WINDOW) / SEGMENT_SIZE)
              const segmentMax = Math.ceil((index + WINDOW) / SEGMENT_SIZE)
              return (
                (segmentMin <= minSegment() && segmentMax >= maxSegment()) ||
                (segmentMin >= minSegment() && segmentMin <= maxSegment()) ||
                (segmentMax >= minSegment() && segmentMax <= maxSegment())
              )
            },
          ),
        }}
      >
        <div
          part="root"
          ref={element => {
            container = element
            applyStyle(element, props, 'width')
            applyStyle(element, props, 'height')
          }}
          class={clsx(styles.container, config.class)}
          onScroll={e => {
            setScrollTop(e.currentTarget.scrollTop)
            props.onScroll?.(e)
          }}
          style={{
            '--tm-background-color': theme()?.getBackgroundColor(),
            '--tm-char-height': `${character()?.height || 0}px`,
            '--tm-char-width': `${character()?.width || 0}px`,
            '--tm-foreground-color': theme()?.getForegroundColor(),
            '--tm-line-count': lines().length,
            '--tm-line-size': lineSize(),
            '--tm-selection-color': selectionColor(),
            '--tm-line-digits': countDigits(lines().length),
            ...style(),
          }}
          {...rest}
        >
          <code part="code" class={styles.code}>
            <Index each={Array.from({ length: Math.ceil(lines().length / SEGMENT_SIZE) })}>
              {(_, segmentIndex) => <Segment index={segmentIndex} />}
            </Index>
          </code>
          <textarea
            ref={config.textareaRef}
            part="textarea"
            autocomplete="off"
            class={styles.textarea}
            disabled={!config.editable}
            inputmode="none"
            spellcheck={false}
            value={config.value}
            rows={lines().length}
            onScroll={e => {
              e.preventDefault()
              e.stopPropagation()
            }}
            /* @ts-ignore */
            on:keydown={e => {
              const area = e.currentTarget
              const value = area.value

              if (e.key === 'Tab') {
                e.preventDefault()

                // fix me: it changes tabs for spaces
                let { tabSize } = getComputedStyle(area)

                let start = area.selectionStart
                const end = area.selectionEnd

                if (start !== end) {
                  // something is selected
                  // move "start" to previous `\n`
                  while (start > 0 && value[start] !== '\n') {
                    start--
                  }

                  let replacement

                  if (e.shiftKey) {
                    // unindent
                    replacement = value
                      .slice(start, end)
                      .replace(new RegExp('\n' + ' '.repeat(+tabSize), 'g'), '\n')
                  } else {
                    // indent
                    replacement = value
                      .slice(start, end)
                      .replace(/\n/g, '\n' + ' '.repeat(+tabSize))
                  }
                  area.setRangeText(replacement, start, end, 'select')
                } else {
                  area.setRangeText(' '.repeat(+tabSize), start, end, 'end')
                }

                // local
                setSource(area.value)
              }
            }}
            /* @ts-ignore */
            on:input={e => {
              const target = e.currentTarget

              const value = target.value

              // local
              setSource(value)

              // user provided callback
              config.onInput?.(e)
            }}
          />
          <code
            ref={element => {
              new ResizeObserver(([entry]) => {
                const { height, width } = getComputedStyle(entry!.target)
                setCharacter({
                  height: Number(height.replace('px', '')),
                  width: Number(width.replace('px', '')),
                })
              }).observe(element)
            }}
            aria-hidden
            class={styles.character}
          >
            &nbsp;
          </code>
        </div>
      </TmTextareaContext.Provider>
    )
  }
}
