// this file is under GPL-3. see LICENSE
class TodoEntries extends WitchElement {
    static MODE_ALL = 0;
    static MODE_ACTIVE = 1;
    static MODE_COMPLETED = 2;
    
    constructor() {
        super("div", {
            class: "rounded-box",
            id: "todo-entries"
        });
        this.entries = new WitchCollection();
        this.displayMode = TodoEntries.MODE_ALL;
        this.defaultCheckbox = null;
        this.dragging = null;
        this.mobileQuery = matchMedia("only screen and (max-width: 375px)");
        this.controls = this.add(new WitchElement("div", {
            id: "controls",
            class: "list-style"
        }));
        this.controls.isControls = true;
        this.counter = this.controls.add(new WitchElement("span", {
            id: "todo-left-display",
            text: "" // force a text node to be created
        }));
        this.controlButtons = new WitchElement("div", {
            id: "todo-display-selection" });
        this.controlButtons.add(new WitchElement("button", {
            class: "control-button active",
            id: "display-all",
            text: "All",
            on_click: e => this.#control(e.target, TodoEntries.MODE_ALL)
        }));
        this.controlButtons.add(new WitchElement("button", {
            class: "control-button",
            id: "display-incomplete",
            text: "Active",
            on_click: e => this.#control(e.target, TodoEntries.MODE_ACTIVE)
        }));
        this.controlButtons.add(new WitchElement("button", {
            class: "control-button",
            id: "display-complete",
            text: "Completed",
            on_click: e => this.#control(e.target, TodoEntries.MODE_COMPLETED)
        }));
        if (!this.mobileQuery.matches)
            this.controls.add(this.controlButtons);
        this.controls.clearCompleted = this.controls.add(new WitchElement("button", {
            id: "todo-clear-completed",
            text: "Clear Completed",
            on_click: e => {
                this.#byStatus(true).forEach(n => this.#removeEntry(n));
            }
        }));
        this.mobileQuery.addEventListener("change", e => {
            if (e.matches) {
                this.controlButtons.unrender();
                this.parent.add(this.controls.delete(this.controlButtons),
                    this.parent.last);
                this.phonifyControls(true);
                this.controlButtons.render();
                return;
            }
            this.controlButtons.unrender();
            this.controls.add(this.parent.delete(this.controlButtons),
                this.controls.clearCompleted);
            this.phonifyControls(false);
            this.controlButtons.render();
        });
    }

    attachCheckbox(cb) {
        this.defaultCheckbox = cb;
    }

    phonifyControls(s) {
        this.controlButtons.dom.classList.toggle("rounded-box", s);
        this.controlButtons.dom.classList.toggle("list-style", s);
    }

    // true = complete
    #byStatus(s) {
        return this.entries.filter(c => c.completed === s);
    }

    #displayCounts() {
        var c;
        switch (this.displayMode) {
            case TodoEntries.MODE_ALL:
            case TodoEntries.MODE_ACTIVE:
                c = this.#byStatus(false).length; break;
            case TodoEntries.MODE_COMPLETED:
                c = this.#byStatus(true).length;
        }
        this.counter.textNode.data = String(c) + " items left";
    }

    #updateDisplay() {
        switch (this.displayMode) {
            case TodoEntries.MODE_ALL:
                this.entries.forEach(e => e.render()); break;
            case TodoEntries.MODE_ACTIVE:
                this.entries.forEach(e =>
                    e.completed ? e.unrender() : e.render()); break;
            case TodoEntries.MODE_COMPLETED:
                this.entries.forEach(e =>
                    e.completed ? e.render() : e.unrender());
        }
    }

    #control(b, mode) {
        this.displayMode = mode;
        this.controlButtons.nodes.forEach(cb => 
            cb.dom.classList.toggle("active", false));
        b.classList.toggle("active", true);
        this.#updateDisplay();
        this.#displayCounts();
    }

    #removeEntry(e) {
        e.destroy();
        this.nodes.delete(e);
        this.entries.delete(e);
        this.#displayCounts(); // render() doesn't handle this
    }

    #reloadEntry(e) {
        e.unrender();
        e.render();
    }

    render() {
        super.render();
        this.#displayCounts();
    }

    #findMostAdjacent(e, dir = "next") {
        var p = e[dir];
        while (p !== null && !p.rendered)
            p = p[dir];
        return p;
    }

    addEntry(content, render = false) {
        const entry = new WitchElement("div", {
            class: "todo-entry list-style",
            draggable: true,
            on_dragstart: e => {
                e.dataTransfer.effectAllowed = "move";
                this.dragging = entry;
                return false;
            },
            on_dragover: e => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                const top = this.dom.getBoundingClientRect().y,
                    bottom = top + this.dom.getBoundingClientRect().height;
                const next = this.#findMostAdjacent(this.dragging),
                    previous = this.#findMostAdjacent(this.dragging, "previous");
                const nbr = next?.dom.getBoundingClientRect();
                const pbr = previous?.dom.getBoundingClientRect();
                const nc = (nbr?.y || bottom) - top + (nbr?.height || 0) / 2,
                    pc = (pbr?.y || top) - top + (pbr?.height || 0) / 2,
                    my = e.clientY - top;
                if (my < pc && previous !== null) {
                    this.nodes.move(previous, this.dragging);
                    this.#reloadEntry(this.dragging);
                } else if (my > nc && next !== null) {
                    // for the final entry, "next.next" points to the control
                    // element
                    this.nodes.move(next.next, this.dragging);
                    this.#reloadEntry(this.dragging);
                }
            }
        });
        entry.checkbox = entry.add(new StylableCheckbox({
            class: "checkbox",
            checked: this.defaultCheckbox.checked, // this changes via event
            checkbox_event: (c, _) => {
                entry.span.dom.classList.toggle("crossed", c.checked);
                entry.completed = c.checked;
                this.#displayCounts();
            }
        }));
        entry.completed = entry.checkbox.checked;
        entry.span = entry.add(new WitchElement("span", {
            class: "todo-entry-text" + (entry.completed ? " crossed" : ""),
            text: content,
            on_click: e => this.#removeEntry(entry)
        }));
        entry.add(new WitchElement("img", {
            class: "todo-delete-hint",
            src: "./images/icon-cross.svg",
            on_click: e => this.#removeEntry(entry)
        }));
        this.entries.push(entry);
        this.add(entry, this.controls);
        if (render) {
            entry.render();
            this.#displayCounts();
        }
    }
}

function renderMain() {
    const entries = new TodoEntries();
    const p = WitchElement.fromDOM(document.getElementById("container"));
    p.add(new WitchElement("div", { id: "heading-container" }));
    p.last.add(new WitchElement("header", {
        id: "todo-heading", text: "T O D O"
    }));
    p.last.add(new WitchElement("button", {
        id: "theme-toggle",
        on_click: _ => {
            var els = [document.getElementsByTagName("body")[0]];
            els.push(...els[0].getElementsByTagName("*"));
            els.forEach(e => {
                if (e.classList === undefined) {
                    e.className = "light";
                    return;
                }
                e.classList.toggle("light");
            });
        }
    }));
    p.add(new WitchElement("div", {
        class: "rounded-box list-style",
        id: "todo-input-container"
    }));
    const cd = p.last.add(new StylableCheckbox({ class: "checkbox" }));
    p.last.add(new TextInput({
        id: "todo-input",
        placeholder: "Create a new todo...",
        spellcheck: false,
        text_event: (i, _) => { entries.addEntry(i.value, true); }
    }));
    entries.attachCheckbox(cd);
    p.add(entries);
    if (entries.mobileQuery.matches) {
        entries.phonifyControls(true);
        p.add(entries.controlButtons);
    }
    p.add(new WitchElement("span", {
        id: "drag-hint",
        text: "Drag and drop to reorder list"
    }));
    cd.check(true);
    entries.addEntry("Practice that move I copied");
    cd.check(false);
    entries.addEntry("Get something for Reimu");
    entries.addEntry("Forage useful stuff from the forest");
    entries.addEntry("Read for 5 hours (chemistry)");
    entries.addEntry("Ask Alice for a practice doll");
    entries.addEntry("Study the mini-hakkero's components");
    p.render();
}

window.onload = renderMain;
