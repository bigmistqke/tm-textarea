import { createSignal, For, type Component } from 'solid-js'
import { render } from 'solid-js/web'
import 'tm-textarea'
import { TmTextarea } from 'tm-textarea/solid'
import { Grammar, grammars, Theme, themes } from 'tm-textarea/tm'
import './index.css'
import test from './test?raw'

const App: Component = () => {
  const [theme, setCurrentThemeName] = createSignal<Theme>('light-plus')
  const [grammar, setCurrentLanguageName] = createSignal<Grammar>('tsx')

  const [fontSize, setFontSize] = createSignal(10)
  const [padding, setPadding] = createSignal(20)
  const [editable, setEditable] = createSignal(true)
  const [lineNumbers, setLineNumbers] = createSignal(false)

  const value = () => loopLines(test, LOC())

  const [LOC, setLOC] = createSignal(10_000)

  function loopLines(input: string, lineCount: number): string {
    const lines = input.split('\n')
    const totalLines = lines.length
    let result = ''

    for (let i = 0; i < lineCount; i++) {
      result += lines[i % totalLines] + '\n'
    }

    return result.trim() // Trim to remove the trailing newline
  }

  return (
    <div class="app">
      <div class="side-panel">
        <h1>Solid Textmate Textarea</h1>
        <footer>
          <div>
            <label for="theme">themes</label>
            <select
              id="theme"
              value={theme()}
              onInput={e => setCurrentThemeName(e.currentTarget.value as Theme)}
            >
              <For each={themes}>{theme => <option>{theme}</option>}</For>
            </select>
          </div>
          <div>
            <label for="lang">languages</label>
            <select
              id="lang"
              value={grammar()}
              onInput={e => setCurrentLanguageName(e.currentTarget.value as Grammar)}
            >
              <For each={grammars}>{grammar => <option>{grammar}</option>}</For>
            </select>
          </div>
          <br />
          <div>
            <label for="LOC">LOC</label>
            <input
              id="LOC"
              type="number"
              value={LOC()}
              onInput={e => setLOC(+e.currentTarget.value)}
            />
          </div>

          <div>
            <label for="padding">padding</label>
            <input
              id="padding"
              type="number"
              onInput={e => setPadding(+e.currentTarget.value)}
              value={padding()}
            />
          </div>
          <div>
            <label for="font-size">font-size</label>
            <input
              id="font-size"
              type="number"
              onInput={e => setFontSize(+e.currentTarget.value)}
              value={fontSize()}
            />
          </div>
          <div>
            <label for="line-numbers">Line Numbers</label>
            <button
              id="line-numbers"
              onClick={e => {
                setLineNumbers(bool => !bool)
              }}
            >
              {lineNumbers() ? 'enabled' : 'disabled'}
            </button>
          </div>
          <div>
            <label for="editable">editable</label>
            <button
              id="editable"
              onClick={e => {
                setEditable(bool => !bool)
              }}
            >
              {editable() ? 'enabled' : 'disabled'}
            </button>
          </div>
        </footer>
      </div>
      <main>
        <div
          class="resize-container"
          onMouseDown={e => e.target === e.currentTarget && e.stopPropagation()}
        >
          <TmTextarea
            lineHeight={16}
            value={value()}
            grammar={grammar()}
            theme={theme()}
            style={{ height: '100%', width: '100%', padding: `${padding()}px` }}
            class={lineNumbers() ? 'line-numbers' : undefined}
          />
        </div>
      </main>
    </div>
  )
}

export default App

render(() => <App />, document.getElementById('root')!)
