import self from '.?raw'
import { createSignal, For, type Component } from 'solid-js'
import { render } from 'solid-js/web'
import 'solid-tm-textarea/custom-element'
// import { Textarea } from 'solid-tm-textarea/oniguruma'
import { TmTextarea } from 'solid-tm-textarea'
import { Grammar, grammars, Theme, themes } from 'solid-tm-textarea/tm'
import './index.css'

const App: Component = () => {
  // Config
  const [mode, setMode] = createSignal<'custom-element' | 'solid'>('solid')

  const [theme, setCurrentThemeName] = createSignal<Theme>('light-plus')
  const [grammar, setCurrentLanguageName] = createSignal<Grammar>('source.tsx')

  const [fontSize, setFontSize] = createSignal(10)
  const [padding, setPadding] = createSignal(5)
  const [editable, setEditable] = createSignal(true)

  const [_value, setValue] = createSignal(self)

  const value = () => loopLines(_value(), LOC())

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
          {/* <div>
            <label for="mode">mode</label>
            <button
              id="mode"
              onClick={() =>
                setMode(type => (type === 'custom-element' ? 'solid' : 'custom-element'))
              }
            >
              {mode()}
            </button>
          </div>
          <br /> */}
          <div>
            <label for="theme">themes</label>
            <select
              id="theme"
              value={theme()}
              onInput={e => setCurrentThemeName(e.currentTarget.value as Theme)}
            >
              <For each={Object.keys(themes)}>{theme => <option>{theme}</option>}</For>
            </select>
          </div>
          <div>
            <label for="lang">languages</label>
            <select
              id="lang"
              value={grammar()}
              onInput={e => setCurrentLanguageName(e.currentTarget.value as Grammar)}
            >
              <For each={Object.keys(grammars)}>{language => <option>{language}</option>}</For>
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
            <label for="editable">editable</label>
            <button
              id="editable"
              onClick={e => {
                setEditable(editable => !editable)
              }}
            >
              {editable() ? 'enabled' : 'disabled'}
            </button>
          </div>
        </footer>
      </div>
      <main>
        <div style={{ resize: 'both', height: '100px', width: '100px', overflow: 'hidden' }}>
          <TmTextarea
            lineHeight={16}
            value={value()}
            grammar="tsx"
            theme="dark-plus"
            style={{ height: '100%', width: '100%', padding: '20px' }}
          />
        </div>
      </main>
    </div>
  )
}

export default App

render(() => <App />, document.getElementById('root')!)
