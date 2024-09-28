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
export function tabIndentation(
  e: KeyboardEvent & { currentTarget: TmTextareaElement | HTMLTextAreaElement },
) {
  if (e.key !== 'Tab') {
    return
  }

  e.preventDefault()

  const textarea = e.currentTarget
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
        const modifiedLine = e.shiftKey ? unindent(line, tabSize) : indent(line)
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

function unindent(source: string, tabSize: number) {
  const leadingWhitespace = getLeadingWhitespace(source)
  if (leadingWhitespace.length === 0) return source
  const segments = getIndentationSegments(leadingWhitespace, tabSize)
  return source.replace(leadingWhitespace, segments.slice(0, -1).join(''))
}

function indent(source: string) {
  const leadingWhitespace = getLeadingWhitespace(source)
  return source.replace(leadingWhitespace, leadingWhitespace + '\t')
}

function getLeadingWhitespace(source: string) {
  return source.match(/^\s*/)?.[0] || ''
}

function getLineStart(value: string, position: number) {
  // Move start to start document or first newline.
  while (position > 0 && value[position] !== '\n') {
    position--
  }
  return position
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
function getIndentationSegments(leadingWhitespace: string, tabSize: number) {
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
