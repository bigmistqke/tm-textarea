import { createEffect, createResource, createRoot, splitProps, type JSX } from 'solid-js'
import * as oniguruma from 'vscode-oniguruma'
import * as textmate from 'vscode-textmate'
import { fetchFromCDN, urlFromCDN } from './cdn'
import { ContentEditable, type ContentEditableProps } from './contenteditable'
import { cn } from './utils/cn'
import { every, when } from './utils/conditionals'
import { createWritable } from './utils/create-writable'
import { endsWithSingleNewline } from './utils/ends-with-single-line'

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

/** Theme class for resolving styles and colors */
export class ThemeManager {
  private themeData: ThemeData

  constructor(themeData: ThemeData) {
    this.themeData = themeData
  }

  #scopes: Record<string, string> = {}

  // TODO:  Pretty sure this is an incomplete implementation.
  //        Should either re-factor to use REGISTRY.getColorMap() and tokenizer.tokenizeLine2()
  //        or complete the implementation.
  resolveScope(scope: string[]): string {
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

    const serializedStyle = Object.entries(finalStyle)
      .map(([key, value]) => `${key === 'foreground' ? 'color' : key}: ${value};`)
      .join('\n')

    return (this.#scopes[id] = serializedStyle)
  }

  getBackgroundColor() {
    return this.themeData.colors?.['editor.background'] || undefined
  }

  getForegroundColor() {
    return this.themeData.colors?.['editor.foreground'] || undefined
  }
}

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
const TOKENIZER_CACHE: Record<string, textmate.IGrammar | null> = {}

const HIGHLIGHTS = new Map<string, Highlight>()
let HIGHLIGHTER_COUNTER = 0
function addHighlight(css: string) {
  const id = `tm-highlight-${HIGHLIGHTER_COUNTER}`
  const highlight = new Highlight()
  HIGHLIGHTS.set(css, highlight)
  CSS.highlights.set(id, highlight)
  const style = document.createElement('style')
  style.textContent = `::highlight(${id}) {${css}}`
  // Have to timeout, mb a solid-playground thingy.
  setTimeout(() => document.head.appendChild(style), 0)
  HIGHLIGHTER_COUNTER++
}

export interface TmTextareaProps extends Omit<ContentEditableProps, 'style'> {
  grammar: string
  theme: string
  style?: JSX.CSSProperties
  editable?: boolean
}

export function createTmTextarea(styles: Record<string, string>) {
  return function TmTextarea(props: TmTextareaProps) {
    const [config, rest] = splitProps(props, ['style', 'value', 'theme', 'grammar', 'class'])
    const [value, setValue] = createWritable(() => {
      if (!endsWithSingleNewline(props.value)) {
        return `${props.value}\n`
      }
      return props.value
    })

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

    return (
      <ContentEditable
        ref={(element: HTMLElement) => {
          createEffect(
            when(every(tokenizer, theme), ([tokenizer, theme]) => {
              const lines = value().split('\n')

              // Have to wait a frame to ensure that the value has been rendered in the container.
              requestAnimationFrame(() => {
                const clearedHighlights = new Set()

                let offset = 0
                let currentStack = textmate.INITIAL

                for (const line of lines) {
                  const { ruleStack, tokens } = tokenizer.tokenizeLine(line, currentStack)

                  currentStack = ruleStack

                  for (const token of tokens) {
                    const style = theme.resolveScope(token.scopes)

                    if (!HIGHLIGHTS.has(style)) {
                      addHighlight(style)
                    }

                    const highlight = HIGHLIGHTS.get(style)!

                    if (!clearedHighlights.has(highlight)) {
                      highlight.clear()
                      clearedHighlights.add(highlight)
                    }

                    const range = new Range()
                    const firstChild = element.firstChild!
                    const max = firstChild.textContent?.length || 0

                    range.setStart(firstChild!, Math.min(max, token.startIndex + offset))
                    range.setEnd(firstChild!, Math.min(max, token.endIndex + offset))
                    highlight.add(range)
                  }

                  offset += line.length + 1
                }
              })
            }),
          )
        }}
        value={value()}
        onValue={setValue}
        class={cn(styles.container, config.class)}
        style={{
          background: theme()?.getBackgroundColor(),
          ...props.style,
        }}
        {...rest}
      />
    )
  }
}
