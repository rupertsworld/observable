# @rupertsworld/observable

A minimal library for observable properties with change callbacks.

## Overview

Three layers:

1. **`observable(Base)`** — Mixin that adds property interception and `propertyChangedCallback` to any class
2. **`Observable`** — `observable(EventTarget)` for convenience
3. **`ObservableElement`** — `observable(HTMLElement)` with attribute reflection

## Layer 1: `observable(Base)`

The mixin intercepts property setters for properties listed in `static observedProperties` and calls `propertyChangedCallback(name, oldValue, newValue)` on change.

```typescript
import { observable } from "@rupertsworld/observable";

class Counter extends observable(Object) {
  static observedProperties = ["count"];

  count = 0;

  propertyChangedCallback(name: string, oldValue: unknown, newValue: unknown) {
    console.log(`${name} changed from ${oldValue} to ${newValue}`);
  }
}

const c = new Counter();
c.count = 5; // logs: "count changed from 0 to 5"
```

### Behavior

- Only fires callback when value actually changes (`Object.is` comparison)
- Does not fire for initial field initializer values
- Callback receives property name, old value, and new value

### Config

`static observedProperties` is an array of property names:

```typescript
static observedProperties = ["count", "name", "data"];
```

## Layer 2: `Observable`

Convenience class: `observable(EventTarget)`.

```typescript
import { Observable } from "@rupertsworld/observable";

class Counter extends Observable {
  static observedProperties = ["count"];

  count = 0;

  propertyChangedCallback(name: string, oldValue: unknown, newValue: unknown) {
    this.dispatchEvent(new CustomEvent("change", {
      detail: { property: name, oldValue, newValue }
    }));
  }
}

const c = new Counter();
c.addEventListener("change", (e) => console.log(e.detail));
c.count = 5; // fires change event
```

## Layer 3: `ObservableElement`

Extends `observable(HTMLElement)` with attribute reflection.

```typescript
import { ObservableElement } from "@rupertsworld/observable";

class CounterElement extends ObservableElement {
  static observedProperties = {
    count: { type: Number, attribute: "count" },
    data: { attribute: false }, // observed but no reflection
  };

  count = 0;
  data = {};

  propertyChangedCallback(name: string, oldValue: unknown, newValue: unknown) {
    this.render();
  }
}

customElements.define("x-counter", CounterElement);
```

### Config

`static observedProperties` is an object mapping property names to config:

```typescript
static observedProperties = {
  count: { type: Number, attribute: "count" },
  name: { type: String, attribute: "name" },
  disabled: { type: Boolean, attribute: "disabled" },
  data: { attribute: false }, // no attribute reflection
};
```

Array form also supported (equivalent to `{ attribute: false }` for each):

```typescript
static observedProperties = ["data", "loading"];
```

### Property Config

| Key | Type | Description |
|-----|------|-------------|
| `type` | `String \| Number \| Boolean \| Object` | Constructor for attribute coercion. Required if `attribute` is set. |
| `attribute` | `string \| false` | Attribute name to sync with, or `false` for no reflection. |

### Attribute Reflection

When `attribute` is set:

- Property changes sync to the attribute (serialized via `type`)
- Attribute changes sync to the property (coerced via `type`)
- Callback fires once per change, not twice

### Type Coercion

| Type | Attribute → Property | Property → Attribute |
|------|---------------------|---------------------|
| `String` | as-is | `String(value)` |
| `Number` | `Number(value)` | `String(value)` |
| `Boolean` | `true` if present and not `"false"` | `""` if true, `"false"` if false |
| `Object` | `JSON.parse(value)` | `JSON.stringify(value)` |

## Exports

```typescript
// Mixin
export function observable<T extends Constructor>(Base: T): T & ObservableMixin;

// Convenience classes
export class Observable extends observable(EventTarget) {}
export class ObservableElement extends observable(globalThis.HTMLElement) {}

// Types
export type ObservablePropertyConfig = { /* ... */ };
export type ObservablePropertyMap = Record<string, ObservablePropertyConfig>;
export type ObservedProperties = string[] | ObservablePropertyMap;
```

## Invariants

### All layers

- Only fires callback when value actually changes (`Object.is` comparison)
- Does not fire callback for field initializers
- Observed properties cannot define custom getters/setters (throws at class definition time)

### `ObservableElement`

`ObservableElement` is a drop-in replacement for `HTMLElement`. If you don't use `observedProperties`, it behaves identically to native `HTMLElement`.

- User-defined `attributeChangedCallback` is preserved and called after internal attribute handling
- User-defined `static get observedAttributes()` works normally — extend via `[...super.observedAttributes, "my-attr"]`
- All native `HTMLElement` lifecycle callbacks work unchanged (`connectedCallback`, `disconnectedCallback`, etc.)
- Circular attribute/property updates are guarded internally — changing a property updates the attribute without re-triggering the property setter, and vice versa
- Markup attributes are reflected to properties on construction: `<my-el count="5">` sets `this.count = 5`

### Typed events (`ObservableElement<TEvents>`)

The generic parameter accepts a union of `Event` types with a `type` literal. This provides type-safe `addEventListener`, `removeEventListener`, and `dispatchEvent`:

```typescript
class CountChangeEvent extends Event {
  type = "count-change" as const;
  constructor(public count: number) {
    super("count-change");
  }
}

class MyCounter extends ObservableElement<CountChangeEvent> {
  static observedProperties = {
    count: { type: Number, attribute: "count" },
  };

  count = 0;

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
