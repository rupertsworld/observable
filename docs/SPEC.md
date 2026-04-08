# HTMLElement

Property-first `HTMLElement` with typed events and reactive property observation.

## Install

```bash
npm install @rupertsworld/html-element
```

## Usage

```ts
import { HTMLElement } from "@rupertsworld/html-element";

class MyCounter extends HTMLElement {
  static observedProperties = {
    count: { type: Number, attribute: "count" },
    disabled: { type: Boolean, attribute: "disabled" },
    data: { type: Object },
  };

  count = 0;
  disabled = false;
  data: object | null = null;

  connectedCallback() {
    this.render();
    this.addEventListener("click", this.handleClick);
  }

  propertyChangedCallback(name: string, oldValue: unknown, newValue: unknown) {
    this.render();
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

- `type` — constructor used for coercion (`String`, `Number`, `Boolean`, `Object`)
- `attribute` — optional attribute name to sync with

### Built-in coercion types

| Type | From attribute | To attribute |
|------|----------------|--------------|
| `String` | Raw string value | `String(value)` |
| `Number` | `Number(raw)` | `String(value)` |
| `Boolean` | `true` if present (except `"false"` → `false`) | `true` → `""`, `false` → remove attribute |
| `Object` | `JSON.parse(raw)` | `JSON.stringify(value)` |

### Property and attribute sync

When `attribute` is specified, property and attribute stay in sync:

- Markup `<my-el count="5">` sets `this.count = 5`
- `this.count = 10` updates `getAttribute("count")` to `"10"`
- `setAttribute("count", "15")` updates `this.count` to `15`
- Circular updates are guarded internally

```ts
el.count = 16;
el.count;                    // 16
el.getAttribute("count");    // "16"

el.setAttribute("count", "7");
el.count;                    // 7
```

### `propertyChangedCallback`

```ts
propertyChangedCallback(name: string, oldValue: unknown, newValue: unknown): void
```

Called when an observed property changes.

**Fires:**
- On runtime property writes (`this.count = 10`)
- On attribute-driven updates (`setAttribute("count", "10")`)

**Does not fire:**
- For field initializers (`count = 0`)
- When the new value equals the old value (`Object.is` comparison)

### Non-attribute observed properties

Properties without `attribute` are still observed and trigger `propertyChangedCallback`, but do not sync with the DOM:

```ts
static observedProperties = {
  data: { type: Object },  // no attribute
};
```

### Custom accessors

If a property is in `observedProperties`, you **cannot** define a custom getter/setter for it. This will throw an error at registration time:

```ts
// ERROR: throws at customElements.define()
class Bad extends HTMLElement {
  static observedProperties = {
    value: { type: String, attribute: "value" },
  };

  get value() { return this.#value; }
  set value(v) { this.#value = v; }
}
```

Use `propertyChangedCallback` for side effects instead.

### Custom `attributeChangedCallback`

You can define your own `attributeChangedCallback` for attributes **not** managed by `observedProperties`. The library handles observed attributes first, then calls your callback:

```ts
class MyElement extends HTMLElement {
  static observedProperties = {
    count: { type: Number, attribute: "count" },
  };

  static get observedAttributes() {
    return [...super.observedAttributes, "mode"];
  }

  count = 0;
  #mode = "default";

  get mode() { return this.#mode; }
  set mode(v) { this.#mode = v; }

  attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null) {
    if (name === "mode") {
      this.mode = newValue ?? "default";
    }
  }
}
```

## TypeScript

Use normal class field syntax:

```ts
class MySlider extends HTMLElement {
  static observedProperties = {
    count: { type: Number, attribute: "count" },
    data: { type: Object },
  };

  count = 0;
  data: object | null = null;
}
```

No `declare` needed.

## Typed events

The generic parameter accepts any union of `Event` types with a `type` literal:

```ts
class CountChangeEvent extends Event {
  type = "count-change";
  constructor(public count: number) {
    super("count-change");
  }
}

class MyCounter extends HTMLElement<CountChangeEvent> {
  // ...

  propertyChangedCallback(name: string) {
    if (name === "count") {
      this.dispatchEvent(new CountChangeEvent(this.count));
    }
  }
}

const counter = document.querySelector("my-counter") as MyCounter;

counter.addEventListener("count-change", (e) => {
  console.log(e.count); // typed as number
});
```

For multiple event types, use a union:

```ts
type MyEvents = CountChangeEvent | ResetEvent;

class MyCounter extends HTMLElement<MyEvents> {
  // ...
}
```

For convenience creating typed events, see [`@rupertsworld/event-target`](https://github.com/rupertsworld/event-target) and its `defineEvent` helper.

## Environment support

Works in browsers with native custom elements (all modern browsers).
