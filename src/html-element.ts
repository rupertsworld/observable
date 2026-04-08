import type { EventNames, EventForType } from "@rupertsworld/event-target";

type NativeHTMLElement = InstanceType<typeof globalThis.HTMLElement>;

type ReducedHTMLElement = Omit<
  NativeHTMLElement,
  "addEventListener" | "removeEventListener" | "dispatchEvent"
>;

/** Supported type constructors for property coercion. */
type ObservedType =
  | StringConstructor
  | NumberConstructor
  | BooleanConstructor
  | ObjectConstructor;

/** Configuration for a single observed property. */
export type ObservedPropertyConfig = {
  type: ObservedType;
  /** If set, syncs this property to/from the named attribute. */
  attribute?: string;
};

/** Map of property names to their observation config. */
export type ObservedPropertyMap = Record<string, ObservedPropertyConfig>;

type BaseElementConstructor = typeof BaseElement & {
  observedProperties?: ObservedPropertyMap;
};

type ReactiveState = {
  constructing: boolean;
  syncingFromAttribute: string | null;
  syncingToAttribute: string | null;
  values: Map<string, unknown>;
};

type AnyRecord = Record<string, unknown>;

const stateByInstance = new WeakMap<globalThis.HTMLElement, ReactiveState>();
const setupByConstructor = new WeakSet<Function>();
const managedProps = new WeakMap<Function, Set<string>>();

const asRecord = (obj: unknown): AnyRecord => obj as AnyRecord;

function coerceFromAttribute(type: ObservedType, value: string | null): unknown {
  if (type === Boolean) {
    if (value === null) return false;
    return value !== "false";
  }

  if (value === null) return null;
  if (type === Number) return Number(value);
  if (type === Object) return JSON.parse(value);

  return value;
}

function serializeToAttribute(type: ObservedType, value: unknown): string | null {
  if (value == null) return null;
  if (type === Boolean) return value ? "" : "false";
  if (type === Object) return JSON.stringify(value);

  return String(value);
}

function configForAttribute(
  ctor: BaseElementConstructor,
  attr: string
): { prop: string; config: ObservedPropertyConfig } | null {
  for (const [prop, config] of Object.entries(ctor.observedProperties ?? {})) {
    if (config.attribute === attr) return { prop, config };
  }
  return null;
}

function getState(instance: globalThis.HTMLElement): ReactiveState {
  let state = stateByInstance.get(instance);

  if (!state) {
    state = {
      constructing: true,
      syncingFromAttribute: null,
      syncingToAttribute: null,
      values: new Map(),
    };
    stateByInstance.set(instance, state);
  }

  return state;
}

function isManaged(ctor: BaseElementConstructor, prop: string): boolean {
  return managedProps.get(ctor)?.has(prop) ?? false;
}

function wrapUserAttributeCallback(ctor: BaseElementConstructor): void {
  const desc = Object.getOwnPropertyDescriptor(ctor.prototype, "attributeChangedCallback");
  if (!desc || typeof desc.value !== "function") return;

  const userFn = desc.value as (n: string, o: string | null, v: string | null) => void;
  if (userFn === BaseElement.prototype.attributeChangedCallback) return;

  Object.defineProperty(ctor.prototype, "attributeChangedCallback", {
    configurable: true,
    writable: true,
    value(this: BaseElement, name: string, oldVal: string | null, newVal: string | null) {
      BaseElement.prototype.attributeChangedCallback.call(this, name, oldVal, newVal);
      userFn.call(this, name, oldVal, newVal);
    },
  });
}

function setup(ctor: BaseElementConstructor): void {
  wrapUserAttributeCallback(ctor);

  const observed = ctor.observedProperties ?? {};
  const managed = new Set<string>();
  managedProps.set(ctor, managed);

  for (const [prop, config] of Object.entries(observed)) {
    const existing = Object.getOwnPropertyDescriptor(ctor.prototype, prop);

    if (existing?.get || existing?.set) {
      throw new Error(
        `Observed property "${prop}" cannot define a custom getter/setter. ` +
          `Use propertyChangedCallback for side effects instead.`
      );
    }

    if (existing) continue;

    managed.add(prop);
    const attr = config.attribute;

    Object.defineProperty(ctor.prototype, prop, {
      enumerable: true,
      configurable: true,

      get(this: BaseElement) {
        return getState(this).values.get(prop);
      },

      set(this: BaseElement, next: unknown) {
        const state = getState(this);
        const prev = state.values.get(prop);

        if (Object.is(prev, next)) return;

        state.values.set(prop, next);

        if (attr && state.syncingFromAttribute !== attr && state.syncingToAttribute !== attr) {
          const serialized = serializeToAttribute(config.type, next);
          state.syncingToAttribute = attr;

          try {
            serialized === null ? this.removeAttribute(attr) : this.setAttribute(attr, serialized);
          } finally {
            state.syncingToAttribute = null;
          }
        }

        if (!state.constructing || state.syncingFromAttribute !== null) {
          this.propertyChangedCallback(prop, prev, next);
        }
      },
    });
  }
}

function initializeProperties(el: BaseElement, ctor: BaseElementConstructor): void {
  const state = getState(el);
  const observed = ctor.observedProperties ?? {};
  const rec = asRecord(el);

  for (const [prop, config] of Object.entries(observed)) {
    if (!isManaged(ctor, prop)) continue;

    const hasOwn = Object.prototype.hasOwnProperty.call(el, prop);
    const ownValue = hasOwn ? rec[prop] : undefined;

    if (hasOwn) delete rec[prop];

    const attr = config.attribute;

    if (attr && el.hasAttribute(attr)) {
      const coerced = coerceFromAttribute(config.type, el.getAttribute(attr));
      state.syncingFromAttribute = attr;

      try {
        rec[prop] = coerced;
      } finally {
        state.syncingFromAttribute = null;
      }

      continue;
    }

    if (hasOwn) rec[prop] = ownValue;
  }

  state.constructing = false;
}

export interface BaseElement<T extends Event = Event> extends ReducedHTMLElement {
  addEventListener<K extends EventNames<T>>(
    type: K,
    listener: ((ev: EventForType<T, K>) => void) | null,
    options?: boolean | AddEventListenerOptions
  ): void;

  addEventListener<K extends EventNames<T>>(
    type: K,
    listener: EventListener | EventListenerObject | null,
    options?: boolean | AddEventListenerOptions
  ): void;

  removeEventListener<K extends EventNames<T>>(
    type: K,
    listener: ((ev: EventForType<T, K>) => void) | null,
    options?: boolean | EventListenerOptions
  ): void;

  removeEventListener<K extends EventNames<T>>(
    type: K,
    listener: EventListener | EventListenerObject | null,
    options?: boolean | EventListenerOptions
  ): void;

  dispatchEvent(event: T): boolean;
}

/**
 * Base class for custom elements with reactive observed properties.
 *
 * Define `static observedProperties` to automatically sync properties with
 * attributes and receive `propertyChangedCallback` notifications.
 */
export class BaseElement<T extends Event = Event> extends globalThis.HTMLElement {
  static observedProperties?: ObservedPropertyMap;

  static get observedAttributes(): string[] {
    const ctor = this as unknown as BaseElementConstructor;

    if (!setupByConstructor.has(ctor)) {
      setup(ctor);
      setupByConstructor.add(ctor);
    }

    return Object.values(this.observedProperties ?? {})
      .map((c) => c.attribute)
      .filter((a): a is string => Boolean(a));
  }

  constructor() {
    super();

    const ctor = this.constructor as BaseElementConstructor;

    if (!setupByConstructor.has(ctor)) {
      setup(ctor);
      setupByConstructor.add(ctor);
    }

    getState(this);
    queueMicrotask(() => initializeProperties(this, ctor));
  }

  attributeChangedCallback(name: string, _old: string | null, value: string | null): void {
    const ctor = this.constructor as BaseElementConstructor;
    const found = configForAttribute(ctor, name);

    if (!found || !isManaged(ctor, found.prop)) return;

    const state = getState(this);

    if (state.syncingToAttribute === name) return;

    const coerced = coerceFromAttribute(found.config.type, value);
    const rec = asRecord(this);

    if (Object.prototype.hasOwnProperty.call(this, found.prop)) {
      delete rec[found.prop];
    }

    state.syncingFromAttribute = name;

    try {
      rec[found.prop] = coerced;
    } finally {
      state.syncingFromAttribute = null;
    }
  }

  /** Override to react to observed property changes. */
  propertyChangedCallback(_name: string, _oldValue: unknown, _newValue: unknown): void {}
}
