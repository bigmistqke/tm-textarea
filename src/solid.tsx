import { createTmTextarea } from './core'
import styles from './index.module.css'

/**
 * A textarea with syntax highlighting capabilities powered by [textmate-highlighter](https://github.com/fabiospampinato/textmate-highlighter).
 */
export const TmTextarea = createTmTextarea(styles)
