import { describe, expect, test } from "vitest";

describe("example integration", () => {
  test("registers and instantiates my-counter element", async () => {
    await import("../example/src/counter.ts");
    const el = document.createElement("my-counter");
    document.body.appendChild(el);
    await Promise.resolve();
    expect(el).toBeInstanceOf(HTMLElement);
    expect(el.tagName.toLowerCase()).toBe("my-counter");
    el.remove();
  });
});
