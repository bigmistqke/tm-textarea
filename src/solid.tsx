import { createTmTextarea } from './core'
import styles from './solid.module.css'
export type { TmTextareaProps } from './core'
/**
 * A textarea with syntax highlighting capabilities powered by [textmate-highlighter](https://github.com/fabiospampinato/textmate-highlighter).
 */
export const TmTextarea = createTmTextarea(styles)
