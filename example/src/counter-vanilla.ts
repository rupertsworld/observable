export class VanillaCounter extends HTMLElement {
  static observedAttributes = ["count", "disabled"];

  get count(): number | null {
    const raw = this.getAttribute("count");
    return raw === null ? null : Number(raw);
  }

  set count(value: number | null) {
    if (value == null) {
      this.removeAttribute("count");
      return;
    }
    this.setAttribute("count", String(value));
  }

  get disabled(): boolean | null {
    const raw = this.getAttribute("disabled");
    return raw === null ? null : raw !== "false";
  }

  set disabled(value: boolean | null) {
    if (value == null) {
      this.removeAttribute("disabled");
      return;
    }
    value ? this.setAttribute("disabled", "") : this.removeAttribute("disabled");
  }

  connectedCallback() {
    if (this.count === null) this.count = 0;
    if (this.disabled === null) this.disabled = false;
    this.#render();
    this.addEventListener("click", this.#handleClick);
  }

  disconnectedCallback() {
    this.removeEventListener("click", this.#handleClick);
  }

  attributeChangedCallback() {
    this.#render();
  }

  #handleClick = () => {
    if (this.disabled) return;
    this.count = (this.count ?? 0) + 1;
  };

  #render() {
    const count = this.count ?? 0;
    const disabled = this.disabled ?? false;
    this.innerHTML = `
      <button type="button" ${disabled ? "disabled" : ""}>
        Count: ${count}
      </button>
    `;
  }
}

customElements.define("vanilla-counter", VanillaCounter);
