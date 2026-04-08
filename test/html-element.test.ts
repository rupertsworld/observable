import { describe, expect, test } from "vitest";
import { HTMLElement } from "../src/index";

describe("HTMLElement", () => {
  test("does not fire propertyChangedCallback for field initializers", async () => {
    class InitEl extends HTMLElement<Event> {
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
    class PropWriteEl extends HTMLElement<Event> {
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
    class AttrSyncEl extends HTMLElement<Event> {
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
    class UnobservedEl extends HTMLElement<Event> {
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
    class DataEl extends HTMLElement<Event> {
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
    class BoolEl extends HTMLElement<Event> {
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
    class CustomAccessorEl extends HTMLElement<Event> {
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
    class MixedEl extends HTMLElement<Event> {
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
