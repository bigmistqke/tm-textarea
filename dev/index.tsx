import test from '.?raw'
import { createRenderEffect, createSignal, For, onMount, Show, type Component } from 'solid-js'
import { render } from 'solid-js/web'
import 'tm-textarea'
import { tabBindings } from 'tm-textarea/bindings/tab-indentation'
import { setCDN } from 'tm-textarea/cdn'
import { TmTextarea } from 'tm-textarea/solid'
import { Grammar, grammars, Theme, themes } from 'tm-textarea/tm'
import './index.css'
import tsx from './tsx.json?url'

setCDN((type, id) => {
  switch (type) {
    case 'theme':
      return `https://esm.sh/tm-themes/themes/${id}.json`
    case 'grammar':
      return id === 'tsx' ? tsx : `https://esm.sh/tm-grammars/grammars/${id}.json`
    case 'oniguruma':
      return `https://esm.sh/vscode-oniguruma/release/onig.wasm`
  }
})

const App: Component = () => {
  const [mode, setMode] = createSignal<'custom-element' | 'solid'>('custom-element')
  const [theme, setCurrentThemeName] = createSignal<Theme>('light-plus')
  const [grammar, setCurrentLanguageName] = createSignal<Grammar>('tsx')

  const [fontSize, setFontSize] = createSignal(10)
  const [padding, setPadding] = createSignal(20)
  const [editable, setEditable] = createSignal(true)
  const [lineNumbers, setLineNumbers] = createSignal(true)

  const [LOC, setLOC] = createSignal(10_000)
  const [value, setValue] = createSignal<string>(null!)

  createRenderEffect(() => {
    setValue(loopLines(test, LOC()))
  })

  function loopLines(input: string, lineCount: number): string {
    const lines = input.split('\n')
    const totalLines = lines.length
    let result = ''

    for (let i = 0; i < lineCount; i++) {
      if (i === lineCount - 1) {
        result += lines[i % totalLines]
      } else {
        result += lines[i % totalLines] + '\n'
      }
    }

    return result
  }

  return (
    <div class="app">
      <div class="side-panel">
        <h1>Tm Textarea</h1>
        <footer>
          <div>
            <label for="mode">mode</label>
            <button
              id="mode"
              onClick={e => {
                setMode(mode => (mode === 'custom-element' ? 'solid' : 'custom-element'))
              }}
            >
              {mode()}
            </button>
          </div>
          <br />
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
        <Show
          when={mode() === 'custom-element'}
          fallback={
            <TmTextarea
              value={value()}
              grammar={grammar()}
              theme={theme()}
              editable={editable()}
              style={{
                padding: `${padding()}px`,
              }}
              class={lineNumbers() ? 'line-numbers tm-textarea' : 'tm-textarea'}
              onInput={e => setValue(e.currentTarget.value)}
            />
          }
        >
          <tm-textarea
            value={value()}
            grammar={grammar()}
            theme={theme()}
            editable={editable()}
            style={{
              padding: `${padding()}px`,
              'tab-size': 3,
            }}
            class={lineNumbers() ? 'line-numbers tm-textarea' : 'tm-textarea'}
            onInput={e => setValue(e.currentTarget.value)}
            ref={element => {
              // element.setRangeText('import ', 0, 0)
              onMount(() => {
                setTimeout(() => {}, 1000)
              })
            }}
            /* @ts-ignore */
            on:keydown={e => {
              tabBindings(e)
              // local
              setValue(e.currentTarget.value)
            }}
          />
        </Show>
      </main>
    </div>
  )
}

export default App

render(() => <App />, document.getElementById('root')!)
