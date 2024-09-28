import { TmTextareaElement } from 'src'

/**
 * Key-bindings for indentation with tab.
 * Supports single and multi-line indentation.
 *
 * @param event - The keyboard event triggered on tab press.
 *
 * @example
 * import { tabIndentation } from "tm-textarea/bindings"
 *
 * return <tm-textarea onInput={tabIndentation} />
 */
export function tabBindings(e: KeyboardEvent & { currentTarget: TmTextareaElement }) {
  if (e.key !== 'Tab') {
    return
  }

  e.preventDefault()

  const textarea = e.currentTarget as TmTextareaElement
  const { selectionStart, selectionEnd, value } = textarea
  const tabSize = +getComputedStyle(textarea).tabSize

  if (selectionStart !== selectionEnd) {
    const start = getLineStart(value, selectionStart)

    let newSelectionStart = selectionStart
    let newSelectionEnd = selectionEnd

    let result = value
      // Skip the leading newline.
      .slice(start === 0 ? 0 : start + 1, selectionEnd)
      .split('\n')
      .map((line, index) => {
        const initialLength = line.length
        const modifiedLine = e.shiftKey ? unindent(line, tabSize) : indent(line, tabSize)
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
    if (!e.shiftKey) {
      textarea.setRangeText('\t', selectionStart, selectionStart, 'end')
    } else {
      const isNewLine = value[selectionStart] === '\n'

      const start = getLineStart(
        value,
        // Skip the leading newline.
        isNewLine ? Math.max(0, selectionStart - 1) : selectionStart,
      )

      let result = unindent(value.slice(start, selectionEnd), tabSize)

      // Add the leading newline back.
      result = start === 0 ? result : `\n${result}`

      // unindent
      textarea.setRangeText(result, start, selectionEnd, 'end')
    }
  }
}

/**
 * Removes one level of indentation from the given source string.
 *
 * @param source - The text to be unindented.
 * @param tabSize - The size of a tab in number of spaces (used for space-based indentation).
 * @returns - The unindented text.
 */
function unindent(source: string, tabSize: number) {
  const leadingWhitespace = getLeadingWhitespace(source)
  if (leadingWhitespace.length === 0) return source
  const segments = getWhitespaceSegments(leadingWhitespace, tabSize)
  return source.replace(leadingWhitespace, segments.slice(0, -1).join(''))
}

/**
 * Adds one level of indentation to the given source string.
 *
 * @param source - The text to be indented.
 * @param tabSize - The size of a tab in number of spaces (used for space-based indentation).
 * @returns - The indented text.
 */
function indent(source: string, tabSize: number) {
  const leadingWhitespace = getLeadingWhitespace(source)
  const lastCharacter = leadingWhitespace[leadingWhitespace.length - 1]

  if (lastCharacter === ' ') {
    const segments = getWhitespaceSegments(leadingWhitespace, tabSize)
    const lastSegment = segments[segments.length - 1]
    if (lastSegment && lastSegment.length < tabSize) {
      segments[segments.length - 1] = `${lastSegment}\t`
    } else {
      segments.push('\t')
    }
    return source.replace(leadingWhitespace, segments.join(''))
  }

  return `\t${source}`
}
/**
 * Calculates the whitespace segments for a string of leading whitespace, merging certain segments for consistency.
 *
 * This function is designed to normalize the leading whitespace into consistent tab or space segments. It ensures that partial
 * tab-sized segments of spaces are merged into single tabs or combined to fit the defined tab size, aiding in consistent indentation handling.
 *
 * @param leadingWhitespace - The string of leading whitespace from a line of text.
 * @param tabSize - The number of spaces that constitute a tab segment.
 * @returns {string[]} - An array of strings, each representing a coherent segment of indentation.
 */
function getWhitespaceSegments(leadingWhitespace: string, tabSize: number) {
  const segments = (leadingWhitespace.match(/(\t| +)/g) || []).flatMap(segment =>
    segment === '\t'
      ? [segment]
      : Array.from({ length: Math.ceil(segment.length / tabSize) }, (_, i) =>
          segment.substr(i * tabSize, tabSize),
        ),
  )

  const result: string[] = []

  for (let i = 0; i < segments.length; i++) {
    const current = segments[i]!
    const next = segments[i + 1]
    if (current === '\t' || current.length >= tabSize || i === segments.length - 1) {
      result.push(current)
      continue
    }
    result.push(current + next)
    i++
  }

  return result
}

/**
 * Extracts the leading whitespace from the given string.
 *
 * @param value - The text from which to extract leading whitespace.
 * @returns - The leading whitespace of the text.
 */
function getLeadingWhitespace(source: string) {
  return source.match(/^\s*/)?.[0] || ''
}

/**
 * Finds the start position of the line for a given index in the text.
 *
 * @param value - The complete text of the textarea.
 * @param position - The current cursor position or the start of the selection.
 * @returns - The index of the start of the line.
 */
function getLineStart(value: string, position: number) {
  // Move start to start document or first newline.
  while (position > 0 && value[position] !== '\n') {
    position--
  }
  return position
}
