import { describe, expect, test } from "vitest";
import { ObservableElement } from "../src/index";

describe("ObservableElement", () => {
  test("multiple component classes with different properties do not interfere", async () => {
    class ComponentA extends ObservableElement<Event> {
      static observedProperties = {
        foo: { type: String, attribute: "foo" },
        shared: { type: Number, attribute: "shared" },
      };

      foo = "default-a";
      shared = 1;
      callsA: Array<[string, unknown, unknown]> = [];

      propertyChangedCallback(name: string, oldValue: unknown, newValue: unknown) {
        this.callsA.push([name, oldValue, newValue]);
      }
    }

    class ComponentB extends ObservableElement<Event> {
      static observedProperties = {
        bar: { type: String, attribute: "bar" },
        shared: { type: String, attribute: "shared" }, // same name, different type!
      };

      bar = "default-b";
      shared = "one";
      callsB: Array<[string, unknown, unknown]> = [];

      propertyChangedCallback(name: string, oldValue: unknown, newValue: unknown) {
        this.callsB.push([name, oldValue, newValue]);
      }
    }

    customElements.define("x-isolation-a", ComponentA);
    customElements.define("x-isolation-b", ComponentB);

    const elA = document.createElement("x-isolation-a") as ComponentA;
    const elB = document.createElement("x-isolation-b") as ComponentB;
    await Promise.resolve();

    // Verify initial values are isolated
    expect(elA.foo).toBe("default-a");
    expect(elA.shared).toBe(1);
    expect(elB.bar).toBe("default-b");
    expect(elB.shared).toBe("one");

    // Mutate A's properties
    elA.foo = "changed-a";
    elA.shared = 42;

    // Mutate B's properties
    elB.bar = "changed-b";
    elB.shared = "forty-two";

    // Verify A's state is correct
    expect(elA.foo).toBe("changed-a");
    expect(elA.shared).toBe(42);
    expect(elA.getAttribute("foo")).toBe("changed-a");
    expect(elA.getAttribute("shared")).toBe("42"); // coerced as Number

    // Verify B's state is correct and unaffected by A
    expect(elB.bar).toBe("changed-b");
    expect(elB.shared).toBe("forty-two");
    expect(elB.getAttribute("bar")).toBe("changed-b");
    expect(elB.getAttribute("shared")).toBe("forty-two"); // coerced as String

    // Verify callbacks fired correctly for each
    expect(elA.callsA).toEqual([
      ["foo", "default-a", "changed-a"],
      ["shared", 1, 42],
    ]);
    expect(elB.callsB).toEqual([
      ["bar", "default-b", "changed-b"],
      ["shared", "one", "forty-two"],
    ]);

    // Verify attribute changes are isolated
    elA.setAttribute("shared", "100");
    elB.setAttribute("shared", "hundred");

    expect(elA.shared).toBe(100); // coerced to Number
    expect(elB.shared).toBe("hundred"); // stays String
  });

  test("multiple instances of same component have isolated state", async () => {
    class MultiInstance extends ObservableElement<Event> {
      static observedProperties = {
        value: { type: Number, attribute: "value" },
      };

      value = 0;
      calls: Array<[string, unknown, unknown]> = [];

      propertyChangedCallback(name: string, oldValue: unknown, newValue: unknown) {
        this.calls.push([name, oldValue, newValue]);
      }
    }

    customElements.define("x-multi-instance", MultiInstance);

    const el1 = document.createElement("x-multi-instance") as MultiInstance;
    const el2 = document.createElement("x-multi-instance") as MultiInstance;
    const el3 = document.createElement("x-multi-instance") as MultiInstance;
    await Promise.resolve();

    // Set different values on each
    el1.value = 10;
    el2.value = 20;
    el3.value = 30;

    // Verify each instance has its own state
    expect(el1.value).toBe(10);
    expect(el2.value).toBe(20);
    expect(el3.value).toBe(30);

    expect(el1.getAttribute("value")).toBe("10");
    expect(el2.getAttribute("value")).toBe("20");
    expect(el3.getAttribute("value")).toBe("30");

    // Verify callbacks are instance-specific
    expect(el1.calls).toEqual([["value", 0, 10]]);
    expect(el2.calls).toEqual([["value", 0, 20]]);
    expect(el3.calls).toEqual([["value", 0, 30]]);

    // Mutate one, verify others unchanged
    el2.value = 200;
    expect(el1.value).toBe(10);
    expect(el2.value).toBe(200);
    expect(el3.value).toBe(30);
  });

  test("does not fire propertyChangedCallback for field initializers", async () => {
    class InitEl extends ObservableElement<Event> {
      static observedProperties = {
        count: { type: Number, attribute: "count" },
      };

      count = 0;
      calls: Array<[string, unknown, unknown]> = [];

      propertyChangedCallback(name: string, oldValue: unknown, newValue: unknown) {
        this.calls.push([name, oldValue, newValue]);
      }
    }
    customElements.define("x-reactive-init-el", InitEl);

    const el = document.createElement("x-reactive-init-el") as InitEl;
    await Promise.resolve();
    expect(el.calls).toEqual([]);
  });

  test("fires propertyChangedCallback for observed property writes", async () => {
    class PropWriteEl extends ObservableElement<Event> {
      static observedProperties = {
        count: { type: Number, attribute: "count" },
      };

      count = 0;
      calls: Array<[string, unknown, unknown]> = [];

      propertyChangedCallback(name: string, oldValue: unknown, newValue: unknown) {
        this.calls.push([name, oldValue, newValue]);
      }
    }
    customElements.define("x-reactive-write-el", PropWriteEl);

    const el = document.createElement("x-reactive-write-el") as PropWriteEl;
    await Promise.resolve();
    el.count = 3;

    expect(el.getAttribute("count")).toBe("3");
    expect(el.calls).toEqual([["count", 0, 3]]);
  });

  test("syncs attribute changes back to property and fires callback once", async () => {
    class AttrSyncEl extends ObservableElement<Event> {
      static observedProperties = {
        count: { type: Number, attribute: "count" },
      };

      count = 0;
      calls: Array<[string, unknown, unknown]> = [];

      propertyChangedCallback(name: string, oldValue: unknown, newValue: unknown) {
        this.calls.push([name, oldValue, newValue]);
      }
    }
    customElements.define("x-reactive-attr-el", AttrSyncEl);

    const el = document.createElement("x-reactive-attr-el") as AttrSyncEl;
    await Promise.resolve();
    el.setAttribute("count", "7");

    expect(el.count).toBe(7);
    expect(el.calls).toEqual([["count", 0, 7]]);
  });

  test("does not fire for unobserved property writes", async () => {
    class UnobservedEl extends ObservableElement<Event> {
      static observedProperties = {
        count: { type: Number, attribute: "count" },
      };

      count = 0;
      label = "a";
      calls: Array<[string, unknown, unknown]> = [];

      propertyChangedCallback(name: string, oldValue: unknown, newValue: unknown) {
        this.calls.push([name, oldValue, newValue]);
      }
    }
    customElements.define("x-reactive-unobserved-el", UnobservedEl);

    const el = document.createElement("x-reactive-unobserved-el") as UnobservedEl;
    await Promise.resolve();
    el.label = "b";

    expect(el.calls).toEqual([]);
  });

  test("supports non-attribute observed properties", async () => {
    class DataEl extends ObservableElement<Event> {
      static observedProperties = {
        data: { type: Object },
      };

      data: Record<string, unknown> = {};
      calls: Array<[string, unknown, unknown]> = [];

      propertyChangedCallback(name: string, oldValue: unknown, newValue: unknown) {
        this.calls.push([name, oldValue, newValue]);
      }
    }
    customElements.define("x-reactive-data-el", DataEl);

    const el = document.createElement("x-reactive-data-el") as DataEl;
    await Promise.resolve();
    el.data = { ok: true };

    expect(el.calls).toEqual([["data", {}, { ok: true }]]);
  });

  test("coerces booleans through attribute bridge", async () => {
    class BoolEl extends ObservableElement<Event> {
      static observedProperties = {
        disabled: { type: Boolean, attribute: "disabled" },
      };

      disabled = false;
      calls: Array<[string, unknown, unknown]> = [];

      propertyChangedCallback(name: string, oldValue: unknown, newValue: unknown) {
        this.calls.push([name, oldValue, newValue]);
      }
    }
    customElements.define("x-reactive-bool-el", BoolEl);

    const el = document.createElement("x-reactive-bool-el") as BoolEl;
    await Promise.resolve();
    el.disabled = true;
    expect(el.getAttribute("disabled")).toBe("");

    el.setAttribute("disabled", "false");
    expect(el.disabled).toBe(false);
    expect(el.calls).toEqual([
      ["disabled", false, true],
      ["disabled", true, false],
    ]);
  });

  test("throws when observed property defines a custom accessor", () => {
    class CustomAccessorEl extends ObservableElement<Event> {
      static observedProperties = {
        value: { type: String, attribute: "value" },
      };

      #value = "";
      get value(): string {
        return this.#value;
      }
      set value(next: string) {
        this.#value = next;
      }
    }

    expect(() => {
      customElements.define("x-reactive-custom-accessor-throws-el", CustomAccessorEl);
    }).toThrow('Observed property "value" cannot define a custom getter/setter.');
  });

  test("supports non-overlapping custom property + attributeChangedCallback with observed properties", async () => {
    class MixedEl extends ObservableElement<Event> {
      static observedProperties = {
        count: { type: Number, attribute: "count" },
      };

      static get observedAttributes(): string[] {
        return [...super.observedAttributes, "mode"];
      }

      count = 0;
      #mode = "a";
      modeSetterCalls = 0;
      snapshots: Array<{ name: string; count: number; mode: string }> = [];

      get mode(): string {
        return this.#mode;
      }

      set mode(next: string) {
        this.modeSetterCalls++;
        this.#mode = next;
      }

      attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null) {
        if (name === "mode") {
          this.mode = newValue ?? "";
        }
        this.snapshots.push({ name, count: this.count, mode: this.mode });
      }
    }
    customElements.define("x-reactive-mixed-el", MixedEl);

    const el = document.createElement("x-reactive-mixed-el") as MixedEl;
    await Promise.resolve();
    el.snapshots = [];

    el.setAttribute("count", "7");
    expect(el.count).toBe(7);
    expect(el.snapshots[0]).toEqual({ name: "count", count: 7, mode: "a" });

    el.setAttribute("mode", "b");
    expect(el.mode).toBe("b");
    expect(el.modeSetterCalls).toBe(1);
    expect(el.snapshots[1]).toEqual({ name: "mode", count: 7, mode: "b" });
  });
});
