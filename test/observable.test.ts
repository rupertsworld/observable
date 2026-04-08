import { describe, expect, test } from "vitest";
import { Observable, ObservableElement, observable } from "../src/index";

describe("observable mixin", () => {
  test("fires propertyChangedCallback for array-based observed properties", async () => {
    class Counter extends observable(EventTarget) {
      static observedProperties = ["count"];

      count = 0;
      calls: Array<[string, unknown, unknown]> = [];

      propertyChangedCallback(name: string, oldValue: unknown, newValue: unknown) {
        this.calls.push([name, oldValue, newValue]);
      }
    }

    const counter = new Counter();
    await Promise.resolve();
    counter.count = 2;

    expect(counter.calls).toEqual([["count", 0, 2]]);
  });

  test("does not fire callback for field initializers", () => {
    class InitCounter extends observable(EventTarget) {
      static observedProperties = ["count"];

      count = 0;
      calls: Array<[string, unknown, unknown]> = [];

      propertyChangedCallback(name: string, oldValue: unknown, newValue: unknown) {
        this.calls.push([name, oldValue, newValue]);
      }
    }

    const counter = new InitCounter();
    expect(counter.calls).toEqual([]);
  });

  test("does not fire callback when value is unchanged (Object.is)", async () => {
    class SameValue extends observable(Object) {
      static observedProperties = ["count"];

      count = 0;
      calls: Array<[string, unknown, unknown]> = [];

      propertyChangedCallback(name: string, oldValue: unknown, newValue: unknown) {
        this.calls.push([name, oldValue, newValue]);
      }
    }

    const obj = new SameValue();
    await Promise.resolve();

    obj.count = 0; // same value
    expect(obj.calls).toEqual([]);

    obj.count = 1;
    expect(obj.calls).toEqual([["count", 0, 1]]);

    obj.count = 1; // same again
    expect(obj.calls).toEqual([["count", 0, 1]]);
  });

  test("works with observable(Object) base class", async () => {
    class Model extends observable(Object) {
      static observedProperties = ["data"];

      data: unknown = null;
      calls: Array<[string, unknown, unknown]> = [];

      propertyChangedCallback(name: string, oldValue: unknown, newValue: unknown) {
        this.calls.push([name, oldValue, newValue]);
      }
    }

    const model = new Model();
    await Promise.resolve();

    model.data = { foo: 1 };
    expect(model.calls).toEqual([["data", null, { foo: 1 }]]);
  });
});

describe("Observable", () => {
  test("is an EventTarget-based convenience class", async () => {
    class Counter extends Observable {
      static observedProperties = ["count"];

      count = 0;

      propertyChangedCallback(name: string, oldValue: unknown, newValue: unknown) {
        this.dispatchEvent(
          new CustomEvent("change", { detail: { name, oldValue, newValue } })
        );
      }
    }

    const counter = new Counter();
    await Promise.resolve();
    const calls: Array<{ name: string; oldValue: unknown; newValue: unknown }> = [];

    counter.addEventListener("change", (event) => {
      calls.push((event as CustomEvent).detail);
    });

    counter.count = 7;

    expect(calls).toEqual([{ name: "count", oldValue: 0, newValue: 7 }]);
  });
});

describe("ObservableElement", () => {
  test("supports array observedProperties without attribute reflection", async () => {
    class ArrayObservedEl extends ObservableElement {
      static observedProperties = ["count"];

      count = 0;
      calls: Array<[string, unknown, unknown]> = [];

      propertyChangedCallback(name: string, oldValue: unknown, newValue: unknown) {
        this.calls.push([name, oldValue, newValue]);
      }
    }

    customElements.define("x-array-observed-el", ArrayObservedEl);

    const el = document.createElement("x-array-observed-el") as ArrayObservedEl;
    await Promise.resolve();

    el.count = 3;

    expect(el.calls).toEqual([["count", 0, 3]]);
    expect(el.getAttribute("count")).toBeNull();
  });

  test("supports attribute: false for observed-only properties", async () => {
    class NoAttrEl extends ObservableElement {
      static observedProperties = {
        data: { attribute: false },
      };

      data: Record<string, unknown> = {};
      calls: Array<[string, unknown, unknown]> = [];

      propertyChangedCallback(name: string, oldValue: unknown, newValue: unknown) {
        this.calls.push([name, oldValue, newValue]);
      }
    }

    customElements.define("x-no-attr-el", NoAttrEl);

    const el = document.createElement("x-no-attr-el") as NoAttrEl;
    await Promise.resolve();

    el.data = { ok: true };

    expect(el.calls).toEqual([["data", {}, { ok: true }]]);
    expect(el.getAttribute("data")).toBeNull();
  });

  test("behaves like native HTMLElement when no observedProperties are defined", () => {
    class PlainEl extends ObservableElement {
      connected = false;

      connectedCallback() {
        this.connected = true;
      }
    }

    customElements.define("x-plain-observable-el", PlainEl);

    const el = document.createElement("x-plain-observable-el") as PlainEl;
    document.body.appendChild(el);
    expect(el.connected).toBe(true);
    el.remove();
  });

  test("reflects markup attributes to properties on construction", async () => {
    class MarkupEl extends ObservableElement {
      static observedProperties = {
        count: { type: Number, attribute: "count" },
      };

      count = 0;
    }

    customElements.define("x-markup-el", MarkupEl);

    document.body.innerHTML = '<x-markup-el count="42"></x-markup-el>';
    const el = document.querySelector("x-markup-el") as MarkupEl;
    await Promise.resolve();

    expect(el.count).toBe(42);
    document.body.innerHTML = "";
  });

  test("throws when attribute is set without type", () => {
    class NoTypeEl extends ObservableElement {
      static observedProperties = {
        value: { attribute: "value" },
      };

      value = "";
    }

    expect(() => {
      customElements.define("x-no-type-el", NoTypeEl);
    }).toThrow('Observed property "value" requires a "type" when "attribute" is set.');
  });
});
