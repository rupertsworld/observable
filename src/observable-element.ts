import type { EventForType, EventNames } from "@rupertsworld/event-target";

type NativeHTMLElement = InstanceType<typeof globalThis.HTMLElement>;
type ReducedHTMLElement = Omit<
  NativeHTMLElement,
  "addEventListener" | "removeEventListener" | "dispatchEvent"
>;

type AnyRecord = Record<string, unknown>;

type ObservedType =
  | StringConstructor
  | NumberConstructor
  | BooleanConstructor
  | ObjectConstructor;

export type ObservablePropertyConfig = {
  type?: ObservedType;
  attribute?: string | false;
};

export type ObservablePropertyMap = Record<string, ObservablePropertyConfig>;
export type ObservedProperties = string[] | ObservablePropertyMap;

type NormalizedPropertyConfig = {
  type?: ObservedType;
  attribute: string | false;
};

type ObservableInstance = {
  propertyChangedCallback(name: string, oldValue: unknown, newValue: unknown): void;
};

export type ObservableElementConstructor = Function & {
  observedProperties?: ObservedProperties;
  prototype: ObservableInstance;
};

type ElementReactiveState = {
  constructing: boolean;
  syncingFromAttribute: string | null;
  syncingToAttribute: string | null;
  values: Map<string, unknown>;
};

const stateByInstance = new WeakMap<object, ElementReactiveState>();
const setupByConstructor = new WeakSet<Function>();
const managedProps = new WeakMap<Function, Set<string>>();
const normalizedConfigsByConstructor = new WeakMap<Function, Map<string, NormalizedPropertyConfig>>();
const userAttributeCallbackWrapped = new WeakSet<Function>();

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

function normalizeObservedProperties(observed: ObservedProperties | undefined): Map<string, NormalizedPropertyConfig> {
  const normalized = new Map<string, NormalizedPropertyConfig>();

  if (!observed) return normalized;

  if (Array.isArray(observed)) {
    for (const prop of observed) {
      normalized.set(prop, { attribute: false });
    }
    return normalized;
  }

  for (const [prop, config] of Object.entries(observed)) {
    normalized.set(prop, {
      type: config.type,
      attribute: config.attribute ?? false,
    });
  }

  return normalized;
}

function getState(instance: object): ElementReactiveState {
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

function getConfigs(ctor: ObservableElementConstructor): Map<string, NormalizedPropertyConfig> {
  return normalizedConfigsByConstructor.get(ctor) ?? new Map();
}

function isManaged(ctor: ObservableElementConstructor, prop: string): boolean {
  return managedProps.get(ctor)?.has(prop) ?? false;
}

function reflectedAttribute(config: NormalizedPropertyConfig): string | null {
  return typeof config.attribute === "string" ? config.attribute : null;
}

function configForAttribute(
  ctor: ObservableElementConstructor,
  attr: string
): { prop: string; config: NormalizedPropertyConfig } | null {
  for (const [prop, config] of getConfigs(ctor)) {
    if (reflectedAttribute(config) === attr) return { prop, config };
  }
  return null;
}

function ensureSetup(ctor: ObservableElementConstructor): void {
  if (setupByConstructor.has(ctor)) return;

  const normalized = normalizeObservedProperties(ctor.observedProperties);
  normalizedConfigsByConstructor.set(ctor, normalized);

  const managed = new Set<string>();
  managedProps.set(ctor, managed);

  for (const [prop, config] of normalized) {
    const attr = reflectedAttribute(config);
    if (attr && !config.type) {
      throw new Error(`Observed property "${prop}" requires a "type" when "attribute" is set.`);
    }

    const existing = Object.getOwnPropertyDescriptor(ctor.prototype, prop);
    if (existing?.get || existing?.set) {
      throw new Error(
        `Observed property "${prop}" cannot define a custom getter/setter. ` +
          `Use propertyChangedCallback for side effects instead.`
      );
    }

    if (existing) continue;

    managed.add(prop);

    Object.defineProperty(ctor.prototype, prop, {
      enumerable: true,
      configurable: true,
      get(this: ObservableInstance) {
        return getState(this).values.get(prop);
      },
      set(this: ObservableInstance, next: unknown) {
        const state = getState(this);
        const prev = state.values.get(prop);

        if (Object.is(prev, next)) return;

        state.values.set(prop, next);

        const attribute = reflectedAttribute(config);
        if (
          attribute &&
          state.syncingFromAttribute !== attribute &&
          state.syncingToAttribute !== attribute
        ) {
          const serialized = serializeToAttribute(config.type as ObservedType, next);
          state.syncingToAttribute = attribute;
          try {
            const el = this as unknown as globalThis.HTMLElement;
            serialized === null ? el.removeAttribute(attribute) : el.setAttribute(attribute, serialized);
          } finally {
            state.syncingToAttribute = null;
          }
        }

        if (!state.constructing || state.syncingFromAttribute !== null || prev !== undefined) {
          this.propertyChangedCallback(prop, prev, next);
        }
      },
    });
  }

  setupByConstructor.add(ctor);
}

function initializeProperties(instance: globalThis.HTMLElement, ctor: ObservableElementConstructor): void {
  ensureSetup(ctor);

  const state = getState(instance);
  const rec = asRecord(instance);
  const configs = getConfigs(ctor);

  for (const [prop, config] of configs) {
    if (!isManaged(ctor, prop)) continue;

    const hasOwn = Object.prototype.hasOwnProperty.call(instance, prop);
    const ownValue = hasOwn ? rec[prop] : undefined;

    if (hasOwn) delete rec[prop];

    const attr = reflectedAttribute(config);
    if (attr && instance.hasAttribute(attr)) {
      const coerced = coerceFromAttribute(config.type as ObservedType, instance.getAttribute(attr));
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

export interface ObservableElement<T extends Event = Event> extends ReducedHTMLElement {
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

export class ObservableElement<T extends Event = Event> extends globalThis.HTMLElement {
  static observedProperties?: ObservedProperties;

  static get observedAttributes(): string[] {
    const ctor = this as unknown as ObservableElementConstructor;
    ensureSetup(ctor);
    wrapUserAttributeCallback(ctor);
    return [...getConfigs(ctor).values()]
      .map((config) => reflectedAttribute(config))
      .filter((attr): attr is string => Boolean(attr));
  }

  constructor() {
    super();
    const ctor = this.constructor as ObservableElementConstructor;
    ensureSetup(ctor);
    getState(this);
    queueMicrotask(() => initializeProperties(this, ctor));
  }

  attributeChangedCallback(name: string, _oldValue: string | null, value: string | null): void {
    const ctor = this.constructor as ObservableElementConstructor;
    ensureSetup(ctor);

    const found = configForAttribute(ctor, name);
    if (!found || !isManaged(ctor, found.prop)) return;

    const state = getState(this);
    if (state.syncingToAttribute === name) return;

    const rec = asRecord(this);
    if (Object.prototype.hasOwnProperty.call(this, found.prop)) {
      delete rec[found.prop];
    }

    state.syncingFromAttribute = name;
    try {
      rec[found.prop] = coerceFromAttribute(found.config.type as ObservedType, value);
    } finally {
      state.syncingFromAttribute = null;
    }
  }

  propertyChangedCallback(_name: string, _oldValue: unknown, _newValue: unknown): void {}
}

function wrapUserAttributeCallback(ctor: ObservableElementConstructor): void {
  if (userAttributeCallbackWrapped.has(ctor)) return;

  const desc = Object.getOwnPropertyDescriptor(ctor.prototype, "attributeChangedCallback");
  if (!desc || typeof desc.value !== "function") {
    userAttributeCallbackWrapped.add(ctor);
    return;
  }

  const userFn = desc.value as (name: string, oldValue: string | null, newValue: string | null) => void;
  if (userFn === ObservableElement.prototype.attributeChangedCallback) {
    userAttributeCallbackWrapped.add(ctor);
    return;
  }

  Object.defineProperty(ctor.prototype, "attributeChangedCallback", {
    configurable: true,
    writable: true,
    value(this: ObservableElement, name: string, oldValue: string | null, newValue: string | null) {
      ObservableElement.prototype.attributeChangedCallback.call(this, name, oldValue, newValue);
      userFn.call(this, name, oldValue, newValue);
    },
  });

  userAttributeCallbackWrapped.add(ctor);
}
