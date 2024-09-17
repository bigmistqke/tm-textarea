import self from '.?raw'
import { createEffect, createSignal, For, type Component } from 'solid-js'
import { render } from 'solid-js/web'
import { TmTextarea } from 'solid-tm-textarea'
import { Grammar, GRAMMARS, Theme, THEMES } from 'solid-tm-textarea/tm'
import './index.css'

const sources = {
  large: Array.from({ length: 10 })
    .map(() => self)
    .join('\n'),
  small: `const sum = (a: number, b: number) => a + b`,
}
type Source = keyof typeof sources

const App: Component = () => {
  // Config
  const [theme, setCurrentThemeName] = createSignal<Theme>('light-plus')
  const [grammar, setCurrentLanguageName] = createSignal<Grammar>('source.tsx')

  const [fontSize, setFontSize] = createSignal(10)
  const [padding, setPadding] = createSignal(5)
  const [sourceType, setSourceType] = createSignal<Source>('large')
  const [editable, setEditable] = createSignal(true)

  const [value, setValue] = createSignal(sources[sourceType()])

  createEffect(() => setValue(sources[sourceType()]))

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
              <For each={Object.keys(THEMES)}>{theme => <option>{theme}</option>}</For>
            </select>
          </div>
          <div>
            <label for="lang">languages</label>
            <select
              id="lang"
              value={grammar()}
              onInput={e => setCurrentLanguageName(e.currentTarget.value as Grammar)}
            >
              <For each={Object.keys(GRAMMARS)}>{language => <option>{language}</option>}</For>
            </select>
          </div>
          <br />
          <div>
            <label for="source">source</label>
            <select
              id="source"
              value={sourceType()}
              onInput={e => setSourceType(e.currentTarget.value as Source)}
            >
              <For each={Object.keys(sources)}>{source => <option>{source}</option>}</For>
            </select>
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
          editable={editable()}
          value={value()}
          grammar={grammar()}
          theme={theme()}
          style={{
            padding: `${padding()}px`,
            'box-sizing': 'border-box',
            resize: 'both',
            width: '100%',
            height: '100%',
          }}
          onInput={e => setValue(e.currentTarget.value)}
        />
        </div>
      </main>
    </div>
  )
}

export default App

render(() => <App />, document.getElementById('root')!)
