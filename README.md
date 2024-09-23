<p>
  <img width="100%" src="https://assets.solidjs.com/banner?type=tm-textarea&background=tiles&project=%20" alt="tm-textarea">
</p>

# 📄 tm-textarea

[![pnpm](https://img.shields.io/badge/maintained%20with-pnpm-cc00ff.svg?style=for-the-badge&logo=pnpm)](https://pnpm.io/)

Textarea with syntax highlighting powered by [solid-js](https://github.com/solidjs/solid), [@lume/element](https://github.com/lume/element) and
[vscode-oniguruma](https://github.com/microsoft/vscode-oniguruma).



https://github.com/user-attachments/assets/6e785c75-75ae-4274-a904-5e1004153b76



## Table of Contents

- [Installation](#installation)
- [Custom Element (`tm-textarea`)](#custom-element-tm-textarea)
  - [Usage](#usage)
  - [Styling The Custom Element](#styling-the-custom-element)
- [Solid Component (`tm-textarea/solid`)](#solid-component-tm-textareasolid)
  - [Usage](#usage-1)
- [CDN (`tm-textarea/cdn`)](#cdn-tm-textareacdn)
- [Themes & Grammars (`tm-textarea/tm`)](#themes--grammars-tm-textareatm)

## Installation

```bash
npm i tm tm-textarea
# or
yarn add tm tm-textarea
# or
pnpm add tm tm-textarea
```

## Custom Element (`tm-textarea`)

The main export is a custom-element `<tm-textarea/>` powered by
[@lume/element](https://github.com/lume/element)

<details>
<summary>Attribute/Property Types</summary>

```ts
import type { Language, Theme } from 'tm-textarea/tm'

interface tmTextareaAttributes extends ComponentProps<'div'> {
  language?: Language
  theme?: Theme
  code?: string
  editable?: boolean
  stylesheet?: string | CSSStyleSheet
  onInput?: (event: InputEvent & { currentTarget: tmTextareaElement }) => void
}
```

</details>

### Usage

```tsx
import { setCDN } from 'tm-textarea/cdn'
import 'tm-textarea'

setCDN('/tm')

export default () => (
  <tm-textarea
    language="tsx"
    theme="andromeeda"
    code="const sum = (a: string, b: string) => a + b"
    editable={true}
    style={{
      padding: '10px',
      'font-size': '16pt',
    }}
    stylesheet="code, code * { font-style:normal; }"
    onInput={e => console.log(e.currentTarget.value)}
  />
)
```

### Styling The Custom Element

Some DOM [`::part()`](https://developer.mozilla.org/en-US/docs/Web/CSS/::part) are exported.

- `textarea` can be used to change the selection color.
- `code` can be used to change the `code` tag.

```css
tm-textarea {
  min-height: 100%;
  min-width: 100%;
  padding: 10px;
  line-height: 16pt;
}

tm-textarea::part(textarea)::selection {
  background: deepskyblue;
}

/* add line-numbers */
tm-textarea::part(line)::before {
  display: inline-block;
  counter-reset: variable calc(var(--line-number) + 1);
  min-width: 7ch;
  content: counter(variable);
}

tm-textarea::part(textarea) {
  margin-left: 7ch;
}
```

The attribute `stylesheet` could be used as a last resort to customize the theme. In the following
example we avoid italics in the rendered coded. The stylesheet is created, cached and reused on the
different `tm-textarea` instances.

```tsx
<tm-textarea
  language="tsx"
  theme="andromeeda"
  code="const sum = (a: string, b: string) => a + b"
  stylesheet="code, code * { font-style: normal; }"
/>
```

## Solid Component (`tm-textarea/solid`)

A solid component of `tm-textarea` is available at `tm-textarea/solid`

<details>
<summary>Prop Types</summary>

```ts
import { Language, Theme } from "tm-textarea/tm"

interface tmTextareaProps extends Omit<ComponentProps<'div'>, 'style'> {
  language: Language
  theme: Theme
  code: string
  editable?: boolean
  style?: JSX.CSSProperties
  onInput?: (event: InputEvent & { currentTarget: HTMLTextAreaElement }) => void
}
```

</details>

### Usage

```tsx
import { TmTextarea } from 'tm-textarea/solid'

export default () => (
  <TmTextarea
    language="tsx"
    theme="min-light"
    code="const sum = (a: string, b: string) => a + b"
    editable={true}
    style={{
      padding: '10px',
      'font-size': '16pt',
    }}
    onInput={e => console.log(e.currentTarget.value)}
  />
)
```

## CDN (`tm-textarea/cdn`)

To ease development we provide a way to set themes/grammars by setting the `theme` or `grammar` property with a string. Without configuration these are resolved to [`tm-themes`](https://github.com/shikijs/textmate-grammars-themes/tree/main/packages/tm-themes) and [`tm-grammars`](https://github.com/shikijs/textmate-grammars-themes/tree/main/packages/tm-grammars) hosted on [`esm.sh`](esm.sh).

To provide a way to customize how these keys are resolved we provide a global function `setCDN`, exported from `tm-textarea`. This function accepts as arguments either a base-url or a callback-function.

When given a base-url, this will be used to fetch
- `${cdn}/tm-themes/themes/${theme}.json` for the `themes`
- `${cdn}/tm-grammars/grammars/${grammar}.json` for the `grammars`
- `${cdn}/vscode-oniguruma/release/onig.wasm` for the `oniguruma` wasm-file

When given a callback, the returned string will be used to fetch instead.

### Usage

```tsx
import { setCDN } from 'tm-textarea/cdn'

// Set absolute base-url
setCDN('https://unpkg.com')

// Set relative base-url (for local hosting)
setCDN('/assets/tm')

// Use the callback-form
setCDN((type, id) => type === 'oniguruma' ? `./oniguruma.wasm` : `./${type}/${id}.json`)
```

## Themes & Grammars (`tm-textarea/tm`)

We export a list of textmate grammars and themes that are hosted on [`tm-grammars`](https://github.com/shikijs/textmate-grammars-themes/tree/main/packages/tm-grammars) and [`tm-themes`](https://github.com/shikijs/textmate-grammars-themes/tree/main/packages/tm-themes). These are used internally and maintained by [`shiki`](https://github.com/shikijs/shiki).

```tsx
import type { Theme, Grammar } from 'tm-textarea/tm'
import { themes, grammars } from 'tm-textarea/tm'
```
