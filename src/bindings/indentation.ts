import { type Patch } from '../contenteditable'

/**
 * Provides bindings for indentation.
 * This includes support for both single line and multi-line indentation.
 * - `Key` mapped to indent
 * - `Shift+Key` mapped to outdent.
 *
 * @example
 *
 * import { Indentation } from "tm-textarea/bindings/indentation"
 * return <ContentEditable bindings={{Tab: Indentation}} />
 */
export function Indentation(
  event: KeyboardEvent & { currentTarget: HTMLElement },
  getSelection: (element: HTMLElement) => [start: number, end: number],
): Patch | null {
  event.preventDefault()
  const outdent = event.shiftKey

  const element = event.currentTarget

  const [start, end] = getSelection(element)
  const value = element.innerText
  const tabSize = +getComputedStyle(element).tabSize

  if (start !== end) {
    const lineStart = Indentation.getLineStart(value, start)
    const lineEnd = Indentation.getLineEnd(value, end - 1)
    const original = value.slice(lineStart, lineEnd)
    const originalLines = original.split('\n')

    // Process each line for indentation/outdentation
    const processedLines = originalLines.map(line => {
      return outdent ? Indentation.outdentLine(line, tabSize) : Indentation.indentLine(line)
    })
    const processed = processedLines.join('\n')

    if (processed.length === original.length) {
      return null
    }

    // Calculate the new start of selection.
    let newStart = start
    {
      const originalFirstLine = originalLines[0]!
      const originalLeadingWhitespaceCount =
        Indentation.getLeadingWhitespace(originalFirstLine).length

      // We adjust the start of selection if first line has whitespace to be indented
      if (originalLeadingWhitespaceCount > 0) {
        const processedFirstLine = processed.split('\n')[0]!
        const relativeStart = start - lineStart
        const offset = processedFirstLine.length - originalFirstLine.length

        // Start of selection is currently after leading whitespace
        if (originalLeadingWhitespaceCount <= relativeStart) {
          // We move the start of selection in sync with the first line
          newStart += offset
        }
        // Start of selection is after first non-whitespace character
        else {
          // If indenting we can safely ignore
          // because indentation will not cause start of selection
          // to end after first non-whitespace character
          if (outdent) {
            const processedLeadingWhitespaceCount =
              Indentation.getLeadingWhitespace(processedFirstLine).length
            // The start of selection is after first non-whitespace character
            if (processedLeadingWhitespaceCount < relativeStart) {
              newStart += offset + 1
            }
          }
        }
      } else if (!outdent) {
        newStart += 1
      }
    }

    // Calculate the new end of selection.
    let newEnd = end
    {
      const originalLeadingWhitespaceCount = Indentation.getLeadingWhitespace(
        originalLines[originalLines.length - 1],
      ).length
      const originalLastLineStart = lineStart + originalLines.slice(0, -1).join('\n').length + 1

      const relativeEnd = end - originalLastLineStart

      // End of selection is in the leading whitespace of the last line
      if (relativeEnd < originalLeadingWhitespaceCount) {
        const processedLeadingWhitespaceCount = Indentation.getLeadingWhitespace(
          processedLines[processedLines.length - 1],
        ).length
        const processedLastLineStart = lineStart + processedLines.slice(0, -1).join('\n').length + 1

        // After indenting/outdenting the end of selection is after
        // the first non-whitespace character of the last line
        if (relativeEnd > processedLeadingWhitespaceCount) {
          // Set selection end to the start of the first non-whitespace character
          newEnd = processedLastLineStart + processedLeadingWhitespaceCount
        } else {
          // Keep the selection end to same relative position
          newEnd = processedLastLineStart + relativeEnd
        }
      }
      // End of selection is after the first non-whitespace character of the last line
      else {
        // Move the selection end along with the line
        newEnd += processed.length - original.length
      }
    }

    return [
      [[lineStart, lineEnd], processed, [newStart, newEnd]],
      [value.slice(lineStart, lineEnd), [start, end]],
    ]
  }
  // Single Line
  else {
    if (!outdent) {
      return [[[start, start], '\t', [start + 1]]]
    } else {
      const lineStart = Indentation.getLineStart(value, start)
      const original = value.slice(lineStart, end)
      const processed = Indentation.outdentLine(value.slice(lineStart, end), tabSize)

      if (processed.length === original.length) {
        return null
      }

      return [
        [[lineStart, end], processed, [lineStart + processed.length]],
        [value.slice(lineStart, end)],
      ]
    }
  }
}

Indentation.outdentLine = (source: string, tabSize: number) => {
  const leadingWhitespace = Indentation.getLeadingWhitespace(source)
  if (leadingWhitespace.length === 0) return source
  const blocks = Indentation.getTabBlocks(leadingWhitespace, tabSize)
  return source.replace(leadingWhitespace, blocks.slice(0, -1).join(''))
}

Indentation.indentLine = (source: string) => {
  const leadingWhitespace = Indentation.getLeadingWhitespace(source)
  return source.replace(leadingWhitespace, leadingWhitespace + '\t')
}

Indentation.getLeadingWhitespace = (source?: string) => {
  return source?.match(/^\s*/)?.[0] || ''
}

Indentation.getLineStart = (value: string, position: number) => {
  if (value[position] === '\n') {
    position = Math.max(0, position - 1)
  }
  // Move start to start document or first newline.
  while (position > 0 && value[position] !== '\n') {
    position--
  }
  return position === 0 ? 0 : position + 1
}

Indentation.getLineEnd = (value: string, position: number) => {
  // Move start to start document or first newline.
  while (position < value.length - 1 && value[position] !== '\n') {
    position++
  }
  return position
}

/**
 * Calculates the `tab-blocks` for a string: groups of characters that together form a single tab.
 *
 * p.ex with tab-size 3
 * - `\t..`: `['\t', '..']`
 * - `\t..\t.`: `['\t', '..\t', '.']`
 * - `..\t....\t`: `['..\t', '...', '.\t`]`
 *
 * This function is designed to normalize strings into consistent segments: `tab-blocks`.
 *
 * @param source - The string from a line of text.
 * @param tabSize - The number of spaces that constitute a tab block.
 * @returns {string[]} - An array of strings, each representing a coherent segment of indentation.
 */
Indentation.getTabBlocks = (source: string, tabSize: number) => {
  const unmergedTabBlocks = (source.match(/(\t| +)/g) || []).flatMap(segment => {
    if (segment === '\t') {
      return [segment]
    }
    return Array.from({ length: Math.ceil(segment.length / tabSize) }, (_, i) =>
      segment.substr(i * tabSize, tabSize),
    )
  })

  const tabBlocks: string[] = []

  for (let i = 0; i < unmergedTabBlocks.length; i++) {
    const current = unmergedTabBlocks[i]!
    const next = unmergedTabBlocks[i + 1]
    if (current === '\t' || current.length >= tabSize || i === unmergedTabBlocks.length - 1) {
      tabBlocks.push(current)
      continue
    }
    // Merge current segment with next.
    tabBlocks.push(current + next)
    i++
  }

  return tabBlocks
}

/**
 * Formats the indentation of each line in a given source string using tabs.
 * It calculates the amount of leading whitespace in each line and replaces it with tabs based on the specified tab size.
 *
 * @param source - The string of text to format.
 * @param tabSize - The number of spaces that represent a single tabulation in the context of the source text.
 * @returns The source text with spaces replaced by tabs as per the calculated indentation levels.
 */
Indentation.format = (source: string, tabSize: number) => {
  return source
    .split('\n')
    .map(line => {
      const whitespace = Indentation.getLeadingWhitespace(line)
      const segments = Indentation.getTabBlocks(whitespace, tabSize)
      return line.replace(whitespace, '\t'.repeat(segments.length))
    })
    .join('\n')
}
