<p>
  <img width="100%" src="https://assets.solidjs.com/banner?type=solid-tm-textarea&background=tiles&project=%20" alt="solid-tm-textarea">
</p>

# 📄 solid-tm-textarea

[![pnpm](https://img.shields.io/badge/maintained%20with-pnpm-cc00ff.svg?style=for-the-badge&logo=pnpm)](https://pnpm.io/)

Textarea with syntax highlighting powered by [solid-js](https://github.com/solidjs/solid) and
[vscode-oniguruma](https://github.com/microsoft/vscode-oniguruma).

https://github.com/bigmistqke/solid-tm-textarea/assets/10504064/7bb4a2e1-a2c4-460d-b782-fe9bf7cac43a

## Installation

```bash
npm i tm solid-tm-textarea
# or
yarn add tm solid-tm-textarea
# or
pnpm add tm solid-tm-textarea
```

## Solid Component

The main export of `solid-tm-textarea` is a solid component.

<details>
<summary>Prop Types</summary>

```ts
import type { LanguageRegistration, ThemeRegistration } from 'tm'
import type { Language, Theme } from 'tm-textarea/tm'

type LanguageProps = Language | LanguageRegistration[] | Promise<LanguageRegistration[]>

type ThemeProps = Theme | ThemeRegistration | Promise<ThemeRegistration>

interface tmTextareaProps extends Omit<ComponentProps<'div'>, 'style'> {
  language: LanguageProps
  theme: ThemeProps
  code: string
  editable?: boolean
  style?: JSX.CSSProperties
  onInput?: (event: InputEvent & { currentTarget: HTMLTextAreaElement }) => void
}
```

</details>

### Usage

**Static import of `theme/language`**

```tsx
import { tmTextarea } from 'solid-tm-textarea'
import minLight from 'tm/themes/min-light.mjs'
import tsx from 'tm/langs/tsx.mjs'

export default () => (
  <tmTextarea
    language={tsx}
    theme={minLight}
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

**Dynamic import of `theme/language`**

```tsx
import { tmTextarea } from 'solid-tm-textarea'

export default () => (
  <tmTextarea
    language={import('https://esm.sh/tm/langs/tsx.mjs')}
    theme={import('https://esm.sh/tm/themes/min-light.mjs')}
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

## Custom Element

We also export a custom-element wrapper `<tm-textarea/>` powered by
[@lume/element](https://github.com/lume/element)

<details>
<summary>Attribute Types</summary>

```ts
import { LanguageProps, ThemeProps } from 'tm-textarea'

interface tmTextareaAttributes extends ComponentProps<'div'> {
  language?: LanguageProps
  theme?: ThemeProps
  code?: string
  editable?: boolean
  stylesheet?: string | CSSStyleSheet
  onInput?: (event: InputEvent & { currentTarget: tmTextareaElement }) => void
}
```

</details>

### Usage

```tsx
import { setCDN } from 'solid-tm-textarea'
import 'solid-tm-textarea/custom-element'

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

- `root` can be used to override the `background`, set a `padding` or change `font-size` and
  `line-height`.
- `textarea` can be used to change the selection color.
- `code` can be used to change the `code` tag.

```css
tm-textarea::part(root) {
  padding: 20px;
  background: transparent;
  font-size: 18px;
  line-height: 1.25;
}

tm-textarea::part(textarea)::selection {
  background: deepskyblue;
}

/* to size it to the container, will remove dead-zones */
tm-textarea {
  min-height: 100%;
  min-width: 100%;
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
  editable={true}
  style={{
    '--padding': '10px',
    'font-size': '16pt',
  }}
  stylesheet="code, code * { font-style:normal; }"
  onInput={e => console.log(e.target.value)}
/>
```

## CDN

```tsx
// from solid component
import { setCDN } from 'solid-tm-textarea'

// Set base-url of CDN directly (defaults to https://esm.sh)
setCDN('https://unpkg.com')

// relative to the root
setCDN('/assets/tm')

// Or use the callback-form
setCDN((type, id) => `./tm/${type}/${id}.json`)
```

## Themes & Languages

Both, the languages and themes list are exported as `string[]`.

```tsx
import type { Theme, Language } from 'solid-tm-textarea/tm'

import { themes, languages } from 'solid-tm-textarea/tm'
```
