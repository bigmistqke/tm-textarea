import { createEffect, createResource, createRoot, For, splitProps, type JSX } from 'solid-js'
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

/**********************************************************************************/
/*                                                                                */
/*                                     Constants                                    */
/*                                                                                */
/**********************************************************************************/

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

/**********************************************************************************/
/*                                                                                */
/*                                  Theme Manager                                 */
/*                                                                                */
/**********************************************************************************/

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

/**********************************************************************************/
/*                                                                                */
/*                                 Node Traversal                                 */
/*                                                                                */
/**********************************************************************************/

/** Helper to traverse nodes in the DOM */
function traverseNodes(
  node: Node,
  callbacks: {
    onNodeEnter?: (currentNode: Node) => boolean | void
    onNodeExit?: (currentNode: Node) => boolean | void
  },
): void {
  function recurse(currentNode: Node): boolean {
    if (callbacks.onNodeEnter) {
      if (callbacks.onNodeEnter(currentNode)) {
        return true // Stop recursion if the callback returns true
      }
    }

    if (currentNode.nodeType === Node.ELEMENT_NODE) {
      for (const child of currentNode.childNodes) {
        if (recurse(child)) return true // Recursively check child nodes
      }
    }

    if (callbacks.onNodeExit) {
      if (callbacks.onNodeExit(currentNode)) {
        return true // Stop recursion if the callback returns true
      }
    }

    return false
  }

  recurse(node)
}

/** Helper to flatten text nodes and compute cumulative text lengths */
function flattenTextNodes(node: Node): { nodes: Text[]; lengths: number[]; totalLength: number } {
  const nodes: Text[] = []
  const lengths: number[] = []
  let totalLength = 0

  traverseNodes(node, {
    onNodeEnter: (currentNode: Node) => {
      if (currentNode.nodeType === Node.TEXT_NODE) {
        nodes.push(currentNode as Text)
        lengths.push(totalLength)
        totalLength += currentNode.textContent?.length || 0
      }
    },
    onNodeExit: (currentNode: Node) => {
      if (currentNode.nodeType === Node.ELEMENT_NODE) {
        if (isBlockElement(currentNode as HTMLElement) || currentNode.nodeName === 'BR') {
          totalLength++ // Add one for the newline represented by block elements or line breaks
        }
      }
    },
  })

  return { nodes, lengths, totalLength }
}

function isBlockElement(node: HTMLElement): boolean {
  // prettier-ignore
  return ['DIV','P','H1','H2','H3','H4','H5','H6','LI','BLOCKQUOTE','HR','TABLE'].includes(node.nodeName)
}

function findNodeAtPosition(
  nodes: Text[],
  lengths: number[],
  index: number,
): { node: Text; offset: number } {
  let nodeIndex = lengths.findIndex(length => index < length)
  if (nodeIndex === -1) {
    nodeIndex = nodes.length - 1
  } else if (nodeIndex > 0) {
    // Adjust to get the correct node because findIndex gives us the next node
    nodeIndex--
  }

  const node = nodes[nodeIndex]!
  const nodeStart = lengths[nodeIndex]!
  // Adjust offset not to exceed node length
  const offset = Math.min(index - nodeStart, node.textContent!.length)

  return { node, offset: offset }
}

/** Factory-function to create a function that creates a range from indices. */
function createRangeFactory(container: HTMLElement): (start: number, end: number) => Range {
  const { nodes, lengths } = flattenTextNodes(container)

  return (start: number, end: number): Range => {
    const startNode = findNodeAtPosition(nodes, lengths, start)
    const endNode = findNodeAtPosition(nodes, lengths, end)

    const range = document.createRange()
    range.setStart(startNode.node, startNode.offset)
    range.setEnd(endNode.node, endNode.offset)
    return range
  }
}

function createRange(container: HTMLElement, start: number, end: number) {
  return createRangeFactory(container)(start, end)
}

function getOffset(parent: HTMLElement, child: Node, localOffset: number): number {
  let globalOffset = 0

  traverseNodes(parent, {
    onNodeEnter: (currentNode: Node) => {
      if (currentNode === child) {
        globalOffset += localOffset
        return true // Stop recursion once the target node and offset are found
      }

      if (currentNode.nodeType === Node.TEXT_NODE) {
        globalOffset += currentNode.textContent?.length || 0
      }
    },
    onNodeExit: (currentNode: Node) => {
      if (currentNode.nodeType === Node.ELEMENT_NODE && currentNode.nextSibling) {
        if (currentNode.nextSibling.nodeName === 'BR') {
          globalOffset++ // Account for the newline character represented by BR
        }
      }
    },
  })

  return globalOffset
}

/**********************************************************************************/
/*                                                                                */
/*                                Create Tm Textarea                              */
/*                                                                                */
/**********************************************************************************/

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
                const createRange = createRangeFactory(element)

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

                    highlight.add(createRange(token.startIndex + offset, token.endIndex + offset))
                  }

                  offset += line.length + 1
                }
              })
            }),
          )
        }}
        class={cn(styles.container, config.class)}
        value={value()}
        onValue={setValue}
        transform={{
          getOffset,
          createRange,
          template: value => (
            <For each={value().split('\n')}>
              {(line, index) => (
                <>
                  <span style={{ '--line-number': index() }}>{line}</span>
                  <br />
                </>
              )}
            </For>
          ),
        }}
        style={{
          background: theme()?.getBackgroundColor(),
          ...props.style,
        }}
        {...rest}
      />
    )
  }
}
