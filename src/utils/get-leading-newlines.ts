export const getLeadingNewlines = (source: string) => source.match(/^\n+/)?.[0].length || 0
