export const endsWithSingleNewline = (str: string) => /(?<!\n)\n$/.test(str)
