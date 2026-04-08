type Constructor<T = object> = abstract new (...args: any[]) => T;

type AnyRecord = Record<string, unknown>;

type ObservableInstance = {
  propertyChangedCallback(name: string, oldValue: unknown, newValue: unknown): void;
};

type ObservableMixinConstructor = Function & {
  observedProperties?: string[];
  prototype: ObservableInstance;
};

type ReactiveState = {
  constructing: boolean;
  values: Map<string, unknown>;
};

const stateByInstance = new WeakMap<object, ReactiveState>();
const setupByConstructor = new WeakSet<Function>();
const managedProps = new WeakMap<Function, Set<string>>();

const asRecord = (obj: unknown): AnyRecord => obj as AnyRecord;

function getState(instance: object): ReactiveState {
  let state = stateByInstance.get(instance);

  if (!state) {
    state = {
      constructing: true,
      values: new Map(),
    };
    stateByInstance.set(instance, state);
  }

  return state;
}

function ensureSetup(ctor: ObservableMixinConstructor): void {
  if (setupByConstructor.has(ctor)) return;

  const observed = ctor.observedProperties ?? [];
  const managed = new Set<string>();
  managedProps.set(ctor, managed);

  for (const prop of observed) {
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

        if (!state.constructing || prev !== undefined) {
          this.propertyChangedCallback(prop, prev, next);
        }
      },
    });
  }

  setupByConstructor.add(ctor);
}

function initializeProperties(instance: object, ctor: ObservableMixinConstructor): void {
  ensureSetup(ctor);

  const state = getState(instance);
  const rec = asRecord(instance);

  for (const prop of managedProps.get(ctor) ?? []) {
    const hasOwn = Object.prototype.hasOwnProperty.call(instance, prop);
    const ownValue = hasOwn ? rec[prop] : undefined;

    if (hasOwn) delete rec[prop];

    if (hasOwn) rec[prop] = ownValue;
  }

  state.constructing = false;
}

type ObservableClass<TBase extends Constructor> = TBase &
  Constructor<InstanceType<TBase> & ObservableInstance> & {
    observedProperties?: string[];
  };

export function observable<TBase extends Constructor>(Base: TBase): ObservableClass<TBase> {
  abstract class ObservableMixin extends Base {
    static observedProperties?: string[];

    constructor(...args: any[]) {
      super(...args);
      const ctor = this.constructor as ObservableMixinConstructor;
      ensureSetup(ctor);
      getState(this);
      queueMicrotask(() => initializeProperties(this, ctor));
    }

    propertyChangedCallback(_name: string, _oldValue: unknown, _newValue: unknown): void {}
  }

  return ObservableMixin as unknown as ObservableClass<TBase>;
}

export class Observable extends observable(EventTarget) {}
