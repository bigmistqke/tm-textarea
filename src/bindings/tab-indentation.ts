import { TmTextareaElement } from 'src'

/**
 * Provides key bindings for tab-based indentation in textareas. This includes both single line and multi-line indentation.
 * The function adds event listeners to the passed element for handling 'keydown' and 'input' events specific to indentation.
 *
 * @param element - The textarea element to which indentation functionality will be applied.
 *
 * @example
 * import { TabIndentation } from "tm-textarea/bindings"
 *
 * return <tm-textarea ref={TabIndentation} />
 */
export function tabIndentation(element: HTMLTextAreaElement | TmTextareaElement) {
  element.addEventListener('keydown', tabIndentation.onKeyDown as any)
  element.addEventListener('input', tabIndentation.onInput as any)

  return function dispose() {
    element.removeEventListener('keydown', tabIndentation.onKeyDown as any)
    element.addEventListener('input', tabIndentation.onInput as any)
  }
}

/**
 * Handles keydown events for indenting and outdenting lines in a textarea.
 * It triggers an 'input' event with types 'formatIndent' or 'formatOutdent'
 * based on whether the tab was pressed with the shift key.
 *
 * @param event - The keyboard event triggered when a key is pressed.
 */
tabIndentation.onKeyDown = (
  event: KeyboardEvent & { currentTarget: TmTextareaElement | HTMLTextAreaElement },
) => {
  if (event.key === 'Tab') {
    event.preventDefault()
    const inputEvent = new InputEvent('input', {
      inputType: event.shiftKey ? 'formatOutdent' : 'formatIndent',
      bubbles: true,
      cancelable: true,
    })
    event.currentTarget!.dispatchEvent(inputEvent)
  }
}

/**
 * Handles 'input' events specifically for processing 'formatIndent' and 'formatOutdent' input types.
 * Modifies the textarea's content based on the type of indentation required.
 *
 * @param e - The input event that was dispatched during indentation handling.
 */
tabIndentation.onInput = (
  event: InputEvent & { currentTarget: TmTextareaElement | HTMLTextAreaElement },
) => {
  if (event.inputType !== 'formatIndent' && event.inputType !== 'formatOutdent') {
    return
  }

  event.preventDefault()

  const textarea = event.currentTarget
  const { selectionStart, selectionEnd, value } = textarea
  const tabSize = +getComputedStyle(textarea).tabSize

  if (selectionStart !== selectionEnd) {
    const start = tabIndentation.getLineStart(value, selectionStart)

    let newSelectionStart = selectionStart
    let newSelectionEnd = selectionEnd

    let result = value
      // Skip the leading newline.
      .slice(start === 0 ? 0 : start + 1, selectionEnd)
      .split('\n')
      .map((line, index) => {
        const initialLength = line.length
        const modifiedLine =
          event.inputType === 'formatOutdent'
            ? tabIndentation.outdent(line, tabSize)
            : tabIndentation.indent(line)
        const lengthChange = modifiedLine.length - initialLength

        if (index === 0) {
          // Only adjust the start position if it's the first line.
          newSelectionStart += lengthChange
        }
        newSelectionEnd += lengthChange

        return modifiedLine
      })
      .join('\n')

    // Add the leading newline back.
    result = start === 0 ? result : `\n${result}`

    textarea.setRangeText(result, start, selectionEnd)
    textarea.setSelectionRange(newSelectionStart, newSelectionEnd)
  } else {
    if (event.inputType === 'formatIndent') {
      textarea.setRangeText('\t', selectionStart, selectionStart, 'end')
    } else {
      const isNewLine = value[selectionStart] === '\n'

      const start = tabIndentation.getLineStart(
        value,
        // Skip the leading newline.
        isNewLine ? Math.max(0, selectionStart - 1) : selectionStart,
      )

      let result = tabIndentation.outdent(value.slice(start, selectionEnd), tabSize)

      // Add the leading newline back.
      result = start === 0 ? result : `\n${result}`

      // unindent
      textarea.setRangeText(result, start, selectionEnd, 'end')
    }
  }
}

tabIndentation.outdent = (source: string, tabSize: number) => {
  const leadingWhitespace = tabIndentation.getLeadingWhitespace(source)
  if (leadingWhitespace.length === 0) return source
  const segments = tabIndentation.getIndentationSegments(leadingWhitespace, tabSize)
  return source.replace(leadingWhitespace, segments.slice(0, -1).join(''))
}

tabIndentation.indent = (source: string) => {
  const leadingWhitespace = tabIndentation.getLeadingWhitespace(source)
  return source.replace(leadingWhitespace, leadingWhitespace + '\t')
}

tabIndentation.getLeadingWhitespace = (source: string) => {
  return source.match(/^\s*/)?.[0] || ''
}

tabIndentation.getLineStart = (value: string, position: number) => {
  // Move start to start document or first newline.
  while (position > 0 && value[position] !== '\n') {
    position--
  }
  return position
}

/**
 * Calculates the whitespace segments for a string of leading whitespace, merging certain segments for visual consistency.
 *
 * This function is designed to normalize the leading whitespace into consistent tab or space segments. It ensures that partial
 * tab-sized segments of spaces are merged into single tabs or combined to fit the defined tab size, aiding in consistent indentation handling.
 *
 * @param leadingWhitespace - The string of leading whitespace from a line of text.
 * @param tabSize - The number of spaces that constitute a tab segment.
 * @returns {string[]} - An array of strings, each representing a coherent segment of indentation.
 */
tabIndentation.getIndentationSegments = (leadingWhitespace: string, tabSize: number) => {
  const unmergedSegments = (leadingWhitespace.match(/(\t| +)/g) || []).flatMap(segment => {
    if (segment === '\t') {
      return [segment]
    }
    return Array.from({ length: Math.ceil(segment.length / tabSize) }, (_, i) =>
      segment.substr(i * tabSize, tabSize),
    )
  })

  const segments: string[] = []

  for (let i = 0; i < unmergedSegments.length; i++) {
    const current = unmergedSegments[i]!
    const next = unmergedSegments[i + 1]
    if (current === '\t' || current.length >= tabSize || i === unmergedSegments.length - 1) {
      segments.push(current)
      continue
    }
    // Merge current segment with next.
    segments.push(current + next)
    i++
  }

  return segments
}

/**
 * Formats the indentation of each line in a given source string using tabs.
 * It calculates the amount of leading whitespace in each line and replaces it with tabs based on the specified tab size.
 *
 * @param source - The string of text to format.
 * @param tabSize - The number of spaces that represent a single tabulation in the context of the source text.
 * @returns The source text with spaces replaced by tabs as per the calculated indentation levels.
 */
tabIndentation.format = (source: string, tabSize: number) => {
  return source
    .split('\n')
    .map(line => {
      const whitespace = tabIndentation.getLeadingWhitespace(line)
      const segments = tabIndentation.getIndentationSegments(whitespace, tabSize)
      return line.replace(whitespace, '\t'.repeat(segments.length))
    })
    .join('\n')
}
