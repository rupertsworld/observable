# @rupertsworld/html-element

A drop-in `HTMLElement` base class with reactive properties and typed events.

## Why?

Writing custom elements involves boilerplate: manual getters/setters, attribute observation, type coercion, and keeping properties and attributes in sync. This library handles all of that automatically while staying close to the native API.

## Install

```bash
npm install @rupertsworld/html-element
```

## Quick Example

```ts
import { HTMLElement } from "@rupertsworld/html-element";

class MyCounter extends HTMLElement {
  static observedProperties = {
    count: { attribute: "count", type: Number },
  };

  count = 0;

  connectedCallback() {
    this.render();
    this.addEventListener("click", () => this.count++);
  }

  propertyChangedCallback() {
    this.render();
  }

  render() {
    this.innerHTML = `<button>Count: ${this.count}</button>`;
  }
}

customElements.define("my-counter", MyCounter);
```

```html
<my-counter count="5"></my-counter>
```

The `count` property:

- Syncs with the `count` attribute automatically
- Coerces strings to numbers
- Triggers `propertyChangedCallback` when changed

## Typed Events

You can add type safety for custom events by passing a generic parameter:

```ts
class CountChangeEvent extends Event {
  type = "count-change";
}

class MyCounter extends HTMLElement<CountChangeEvent> {
  // ...

  propertyChangedCallback(name: string) {
    if (name === "count") {
      this.dispatchEvent(new CountChangeEvent('count-change'));
    }
    this.render();
  }
}
```

```ts
const counter = document.querySelector("my-counter") as MyCounter;

counter.addEventListener("countchange", (e) => {
  console.log(e.count); // typed as number
});
```

## Features

- **Reactive properties** — declare once, get automatic getters/setters
- **Attribute sync** — properties and attributes stay in sync
- **Type coercion** — `Number`, `Boolean`, `String`, `Object` built-in
- **Typed events** — optional strong typing for `addEventListener`/`dispatchEvent`
- **Familiar API** — everything else works like native `HTMLElement`

## Documentation

See [docs/spec.md](docs/spec.md) for the full API reference.

## License

MIT
