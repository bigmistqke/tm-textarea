import { createSignal, mergeProps, splitProps, type ComponentProps, type JSX } from 'solid-js'
import { createWritable } from './utils/create-writable'
import { isTabOrSpace } from './utils/is-tab-or-space'

/**********************************************************************************/
/*                                                                                */
/*                                  Get Selection                                 */
/*                                                                                */
/**********************************************************************************/

export function getSelection(element: HTMLElement): [number, number] {
  const selection = document.getSelection()

  if (selection && selection.rangeCount > 0) {
    const range = selection.getRangeAt(0)

    // Create a range that spans from the start of the contenteditable to the selection start
    const preSelectionRange = document.createRange()
    preSelectionRange.selectNodeContents(element)
    preSelectionRange.setEnd(range.startContainer, range.startOffset)

    // The length of the preSelectionRange gives the start offset relative to the whole content
    const start = preSelectionRange.toString().length
    const end = start + range.toString().length
    return [start, end]
  }

  return [0, 0]
}

/**********************************************************************************/
/*                                                                                */
/*                                 Create History                                 */
/*                                                                                */
/**********************************************************************************/

function createHistory() {
  const [past, setPast] = createSignal<Patch[]>([])
  const [future, setFuture] = createSignal<Patch[]>([])
  function clearFuture() {
    setFuture(future => (future.length > 0 ? [] : future))
  }
  function push(patch: Patch) {
    setPast(patches => [...patches, patch])
  }
  function pop() {
    const patch = past().pop()
    if (patch) {
      setFuture(patches => [...patches, patch])
    }
    return patch
  }
  return {
    get past() {
      return past()
    },
    get future() {
      return future()
    },
    clearFuture,
    push,
    pop,
  }
}

/**********************************************************************************/
/*                                                                                */
/*                                  Create Patch                                  */
/*                                                                                */
/**********************************************************************************/

export type Patch = [
  action: [
    range: [start: number, end: number],
    data?: string,
    selection?: [start: number, end?: number],
  ],
  undo?: [data: string, selection?: [start: number, end?: number]],
]

function createPatch(e: InputEvent & { currentTarget: HTMLElement }, source: string): Patch {
  console.log(e.inputType)

  const selection = getSelection(e.currentTarget)
  let [start, end] = selection

  const defaultUndo: [string, [number, number]] = [source.slice(start, end), selection]

  switch (e.inputType) {
    case 'insertText': {
      return [[selection, e.data || ''], defaultUndo]
    }
    case 'insertParagraph': {
      return [[selection, '\n'], defaultUndo]
    }
    case 'insertReplacementText':
    case 'insertFromPaste': {
      const data = e.dataTransfer?.getData('text')
      return [[selection, data], defaultUndo]
    }
    case 'deleteContentBackward': {
      const offset = start === end ? Math.max(0, start - 1) : start
      return [[[offset, end]], [source.slice(offset, end), selection]]
    }
    case 'deleteContentForward': {
      const offset = start === end ? Math.min(source.length - 1, end + 1) : end
      return [[[start, offset]], [source.slice(start, offset), selection]]
    }
    case 'deleteByCut': {
      return [[selection], defaultUndo]
    }
    case 'deleteWordBackward': {
      if (start === end) {
        // If we are next to a whitespace, increment to next non-whitespace character
        if (isTabOrSpace(source[start - 1])) {
          while (start > 0 && isTabOrSpace(source[start - 1])) {
            start--
          }
        }
        // Increment until first whitespace-character
        while (start > 0 && !isTabOrSpace(source[start - 1])) {
          start--
        }
      }
      return [[[start, end]], [source.slice(start, end), selection]]
    }
    case 'deleteWordForward': {
      if (start === end) {
        if (isTabOrSpace(source[start])) {
          while (end < source.length - 1 && isTabOrSpace(source[end])) {
            end++
          }
        }
        while (end < source.length - 1 && isTabOrSpace(source[end])) {
          end++
        }
      }
      return [[[start, end]], [source.slice(start, end), selection]]
    }
    case 'deleteSoftLineBackward': {
      if (start === end) {
        if (source[start - 1] === '\n') {
          start--
        } else {
          while (start > 0 && source[start - 1] !== '\n') {
            start--
          }
        }
      }
      return [[[start, end]], [source.slice(start, end), selection]]
    }
    default:
      throw `Unsupported inputType: ${e.inputType}`
  }
}

/**********************************************************************************/
/*                                                                                */
/*                                Content Editable                                */
/*                                                                                */
/**********************************************************************************/

export interface ContentEditableProps
  extends Omit<ComponentProps<'div'>, 'onInput' | 'children' | 'contenteditable' | 'style'> {
  value: string
  onValue?: (value: string) => void
  bindings: Record<string, (event: KeyboardEvent & { currentTarget: HTMLElement }) => Patch | null>
  style?: JSX.CSSProperties
  editable?: boolean
}

export function ContentEditable(props: ContentEditableProps) {
  const [config, rest] = splitProps(mergeProps({ spellcheck: false, editable: true }, props), [
    'onValue',
    'value',
    'bindings',
    'style',
    'editable',
  ])
  const [element, setElement] = createSignal<HTMLDivElement>()
  const [value, setValue] = createWritable(() => props.value)
  const history = createHistory()

  function applyPatch(patch: Patch) {
    history.push(patch)

    const [[[start, end], data]] = patch
    setValue(value => `${value.slice(0, start)}${data || ''}${value.slice(end)}`)

    props.onValue?.(value())
  }

  function select(start: number, end?: number) {
    const node = element()?.firstChild
    if (!(node instanceof Node)) {
      console.error('node is not an instance of Node', node)
      return
    }

    const selection = document.getSelection()!
    const range = document.createRange()
    selection.removeAllRanges()
    selection.addRange(range)
    range.setStart(node, start)
    if (end) {
      range.setEnd(node, end)
    } else {
      range.setEnd(node, start)
    }
  }

  function onInput(event: InputEvent & { currentTarget: HTMLDivElement }) {
    event.preventDefault()

    switch (event.inputType) {
      case 'historyUndo': {
        const patch = history.pop()
        if (!patch) return

        const [[[start], data = ''], undo] = patch
        const [reverse = '', selection] = undo ?? []

        setValue(value => `${value.slice(0, start)}${reverse}${value.slice(start + data.length)}`)
        if (selection) {
          select(...selection)
        } else {
          select(start + reverse.length)
        }
        props.onValue?.(value())

        break
      }
      case 'historyRedo': {
        const patch = history.future.pop()
        if (!patch) return

        applyPatch(patch)
        const [[[start], data = '', selection]] = patch
        if (selection) {
          select(...selection)
        } else {
          select(start + data.length)
        }
        break
      }
      default: {
        history.clearFuture()

        const text = event.currentTarget.innerText
        const patch = createPatch(event, text)
        applyPatch(patch)
        const [[[start], data = '', selection]] = patch
        if (selection) {
          select(...selection)
        } else {
          select(start + data.length)
        }
        break
      }
    }
  }

  function onKeyDown(event: KeyboardEvent & { currentTarget: HTMLElement }) {
    if (event.key in props.bindings) {
      const patch = props.bindings[event.key]!(event)
      if (patch) {
        applyPatch(patch)
        const [[range, data, selection]] = patch
        if (selection) {
          select(...selection)
        }
      }
    }

    if (event.ctrlKey || event.metaKey) {
      switch (event.key) {
        // Undo: ctrl+z
        case 'z': {
          event.preventDefault()
          event.currentTarget.dispatchEvent(
            new InputEvent('input', {
              inputType: 'historyUndo',
              bubbles: true,
              cancelable: true,
            }),
          )
          break
        }
        // Redo: ctrl+shift+z
        case 'Z': {
          event.preventDefault()
          event.currentTarget.dispatchEvent(
            new InputEvent('input', {
              inputType: 'historyRedo',
              bubbles: true,
              cancelable: true,
            }),
          )
        }
      }
    }
  }

  return (
    <div
      ref={setElement}
      style={config.style}
      contenteditable={config.editable}
      onBeforeInput={onInput}
      on:keydown={onKeyDown}
      on:input={onInput}
      {...rest}
    >
      {value()}
    </div>
  )
}
