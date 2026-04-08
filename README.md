# @rupertsworld/observable

Observable properties for classes and custom elements.

## Why?

Reacting to property changes typically means writing boilerplate getters/setters or remembering to call update functions. This library provides a declarative `observedProperties` pattern that works on any class — and extends naturally to custom elements with attribute reflection.

## Install

```bash
npm install @rupertsworld/observable
```

## Quick Examples

### Any class with `observable(Base)`

```ts
import { observable } from "@rupertsworld/observable";

class Model extends observable(Object) {
  static observedProperties = ["data"];

  data = null;

  propertyChangedCallback(name: string, oldValue: unknown, newValue: unknown) {
    console.log(`${name} changed from`, oldValue, "to", newValue);
  }
}

const model = new Model();
model.data = { foo: 1 }; // logs: "data changed from null to { foo: 1 }"
```

### `Observable` with typed events

`Observable` is a default observable class you can inherit from, that also supports a typed EventTarget API out of the box.

```ts
import { Observable } from "@rupertsworld/observable";

class ChangeEvent extends Event {
  type = "change";
}

class Counter extends Observable<ChangeEvent> {
  static observedProperties = ["count"];

  count: number = 0;

  propertyChangedCallback() {
    this.dispatchEvent(new ChangeEvent('change'));
  }
}

const counter = new Counter();
counter.addEventListener("change", (e) => {
  console.log('Counter changed!');
});
counter.count = 5; // logs: 'Counter changed!'
```

### Custom elements with `ObservableElement`

```ts
import { ObservableElement } from "@rupertsworld/observable";

class MyCounter extends ObservableElement {
  static observedProperties = {
    count: { type: Number, attribute: "count" },
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

class MyCounter extends ObservableElement<CountChangeEvent> {
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

- **Works on any class** — `observable(Base)` mixin works with `Object`, `EventTarget`, or any base
- **Reactive properties** — declare once, get automatic getters/setters
- **Attribute sync** — `ObservableElement` keeps properties and attributes in sync
- **Type coercion** — `Number`, `Boolean`, `String`, `Object` built-in
- **Typed events** — optional strong typing for `addEventListener`/`dispatchEvent`
- **Drop-in replacement** — `ObservableElement` behaves exactly like native `HTMLElement`

## Documentation

See [docs/SPEC.md](docs/SPEC.md) for the full API reference.

## License

MIT
