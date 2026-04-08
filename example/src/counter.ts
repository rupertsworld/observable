import { ObservableElement } from "../../src/index";

export class Counter extends ObservableElement {
  static observedProperties = {
    count: { type: Number, attribute: "count" },
    disabled: { type: Boolean, attribute: "disabled" },
  };

  count: number = 0;
  disabled: boolean = false;

  connectedCallback() {
    this.#render();
    this.addEventListener("click", this.#handleClick);
  }

  disconnectedCallback() {
    this.removeEventListener("click", this.#handleClick);
  }

  propertyChangedCallback() {
    this.#render();
  }

  #handleClick = () => {
    if (this.disabled) return;
    this.count += 1;
  };

  #render() {
    this.innerHTML = `
      <button type="button" ${this.disabled ? "disabled" : ""}>
        Count: ${this.count}
      </button>
    `;
  }
}

customElements.define("my-counter", Counter);
