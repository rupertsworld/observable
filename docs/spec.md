# HTMLElement

Property-first `HTMLElement` with typed events and reactive property observation.

## Install

```bash
npm install @rupertsworld/html-element
```

## Usage

```ts
import { HTMLElement } from "@rupertsworld/html-element";

class MyCounter extends HTMLElement<Event> {
  static observedProperties = {
    count: { type: Number, attribute: "count" },
    disabled: { type: Boolean, attribute: "disabled" },
    data: { type: Object },
  };

  count: number = 0;
  disabled: boolean = false;
  data: object | null = null;

  propertyChangedCallback(name: string, oldValue: unknown, newValue: unknown) {
    this.render();
  }

  connectedCallback() {
    this.render();
    this.addEventListener("click", this.handleClick);
  }

  handleClick = () => {
    if (this.disabled) return;
    this.count++;
  };

  render() {
    this.innerHTML = `
      <button ${this.disabled ? "disabled" : ""}>
        Count: ${this.count}
      </button>
    `;
  }
}

customElements.define("my-counter", MyCounter);
```

## API

### `HTMLElement<TEvents>`

A typed replacement for native `HTMLElement`.

- `addEventListener` and `removeEventListener` are typed by event `type`
- `dispatchEvent` only accepts events from the declared union
- Runtime behavior remains native `HTMLElement`

### `static observedProperties`

Declares which properties are observed for changes:

```ts
static observedProperties = {
  count: { type: Number, attribute: "count" },
  disabled: { type: Boolean, attribute: "disabled" },
  data: { type: Object },
};
```

Each entry is `{ type, attribute? }`.

#### Built-in coercion types

| Type | Getter behavior | Setter behavior |
|------|-----------------|-----------------|
| `String` | Returns raw attribute value | `setAttribute(attr, String(value))` |
| `Number` | Returns `Number(raw)` | `setAttribute(attr, String(value))` |
| `Boolean` | Returns `true` if present (except `"false"` → `false`) | `true` → `setAttribute(attr, "")`, `false` → `removeAttribute(attr)` |

### Property and attribute sync

When `attribute` is specified, property and attribute stay in sync:

- Markup `<my-el count="5">` sets `this.count = 5`
- `this.count = 10` updates `getAttribute("count")` to `"10"`
- `setAttribute("count", "15")` updates `this.count` to `15`
- Circular updates are guarded

```ts
el.count = 16;           // setAttribute('count', '16')
el.count;                // 16
el.setAttribute("count", "7");
el.count;                // 7
```

If you define your own getter/setter for a property, the automatic one is not created. Use this for custom serialization or complex logic:

```ts
class MyElement extends HTMLElement<MyEvents> {
  static observedAttributes = ["data"];

  get data(): Record<string, unknown> | null {
    const raw = this.getAttribute("data");
    return raw === null ? null : JSON.parse(raw);
  }

  set data(value: Record<string, unknown> | null) {
    value === null
      ? this.removeAttribute("data")
      : this.setAttribute("data", JSON.stringify(value));
  }
}
```

### Callback behavior

`propertyChangedCallback` fires for observed properties:

- Not for field initializers (`count: number = 0`)
- Yes for runtime property writes (`this.count = 10`)
- Yes for attribute-driven updates (`setAttribute("count", "10")`)

### Non-attribute observed properties

Properties without `attribute` are still observed and trigger `propertyChangedCallback`, but do not touch the DOM.

## TypeScript

Use normal class field syntax:

```ts
class MySlider extends HTMLElement<MyEvents> {
  static observedProperties = {
    count: { type: Number, attribute: "count" },
    data: { type: Object },
  };

  count: number = 0;
  data: object | null = null;
}
```

No `declare` needed.

## Event typing

The generic parameter accepts any union of `Event` types with a `type` literal:

```ts
interface ClickEvent extends Event {
  type: "click";
  x: number;
  y: number;
}

interface CloseEvent extends Event {
  type: "close";
}

type MyEvents = ClickEvent | CloseEvent;

class MyElement extends HTMLElement<MyEvents> {
  connectedCallback() {
    this.addEventListener("click", (e) => {
      console.log(e.x, e.y); // typed
    });

    this.addEventListener("close", () => {
      console.log("closed");
    });
  }
}
```

For convenience creating typed events, see [`@rupertsworld/event-target`](https://github.com/rupertsworld/event-target) and its `defineEvent` helper.

## Environment support

Works in browsers with native custom elements (all modern browsers).
