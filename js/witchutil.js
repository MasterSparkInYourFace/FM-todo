// this file is under GPL-3. see LICENSE
class WitchUtil {
    static checkType(v, t) {
        if (v === undefined)
            return null;
        if (typeof(v) !== t) {
            console.error(`first argument must be a ${t}`);
            return null;
        }
        return v;
    }

    static checkElement(v) {
        const check = ["appendChild", "removeChild"];
        const c = WitchUtil.checkType(v, "object");
        if (c === null)
            return null;
        if (!check.every(k => typeof(c[k]) === "function")) {
            console.error("argument must implement " + check.join(", "));
            return null;
        }
        return c;
    }

    static extract(o, p, t) {
        const obj = WitchUtil.checkType(o[p], t);
        if (obj !== null)
            delete o[p];
        return obj;
    }

    static extractElement(o, p) {
        const obj = WitchUtil.checkElement(o[p]);
        if (obj !== null)
            delete o[p];
        return obj;
    }

    static sanitizeAttribute(a) {
        switch(typeof(a)) {
            case "boolean": return a.toString();
            case "object":
                if (typeof(a["join"]) === "function")
                    return a.join(" ");
                break;
        }
        return a;
    }

    static sanitizeNodeTarget(t) {
        if (t === null || typeof(t) !== "object")
            return null;
        if (t.dom !== undefined)
            return t.dom;
        return WitchUtil.checkElement(t);
    }

    static extractNodeTarget(o, p) {
        const e = WitchUtil.sanitizeNodeTarget(o[p]);
        if (e !== null)
            delete o[p];
        return e;
    }

    static setRootNode(inst, node) {
        if (node === null && inst.rootNode !== null)
            return true;
        if (!inst.attach(to)) {
            console.error("missing or invalid target");
            return false;
        }
        return true;
    }

    static randomUniqueID(prefix) {
        var id;
        do { // ideally only runs once
            id = `${prefix}-${Math.floor(Math.random() * 1000000)}`;
        } while (document.getElementById(id));
        return id;
    }
}

class WitchCollection extends Array {
    constructor() {
        super(...arguments);
    }

    flush() {
        this.splice(0, this.length);
    }

    add(e) {
        if (!e.witchy)
            return null;
        if (this.at(-1) !== undefined)
            this.at(-1).next = e;
        e.previous = this.at(-1);
        this.push(e);
        return e;
    }

    insert(b, e) {
        if (!e.witchy)
            return null;
        var i = this.indexOf(b);
        if (i < 0)
            i = this.length;
        this.splice(i, 0, e);
        if (this[i - 1] !== undefined) {
            this[i - 1].next = e;
            e.previous = this[i - 1];
        }
        if (this[i + 1] !== undefined) {
            e.next = this[i + 1];
            this[i + 1].previous = e;
        }
        return e;
    }

    delete(e) {
        const i = this.indexOf(e);
        if (i < 0)
            return undefined;
        const r = this.splice(i, 1)[0];
        if (this[i - 1] !== undefined)
            this[i - 1].next = this[i];
        if (this[i] !== undefined)
            this[i].previous = this[i - 1] === undefined ? null : this[i - 1];            
        r.next = null;
        r.previous = null;
        return r;
    }

    move(b, e) {
        return this.insert(b, this.delete(e));
    }
}

class WitchElement {
    // e MUST be a DOM element. don't call this if e is not a DOM element.
    static fromDOM(e) {
        const n = new WitchElement();
        n.dom = e;
        n.attributes = {};
        for (const a of e.attributes)
            n.attributes[a.name] = a.value;
        n.nodes = new WitchCollection();
        for (const el of n.dom.children)
            n.nodes.push(WitchElement.fromDOM(el));
        n.tag = n.dom.tagName.toLowerCase();
        n.rootNode = n.dom.parentNode;
        n.rendered = (n.rootNode !== null) ? true : false;
        return n;
    }

    constructor(e = null, attr = {}) {
        this.#initialize();
        if (e === null)
            return;
        this.attributes = attr;
        this.nodes = new WitchCollection();
        this.tag = e.toLowerCase();
        this.dom = document.createElement(this.tag);
        this.rootNode = WitchUtil.extractNodeTarget(this.attributes, "root");
        this.rendered = WitchUtil.extract(this.attributes, "render", "boolean") || false;
        this.renderOnAttach = false;
        Object.keys(this.attributes).forEach(k => {
            const sv = WitchUtil.sanitizeAttribute(this.attributes[k]);
            switch (true) {
                case (k === "text"):
                    this.dom.appendChild(document.createTextNode(sv));
                    break;
                case k.startsWith("on_"):
                    if (typeof(sv) !== "function") {
                        console.error(k + ": handler must be a function. ignoring event");
                        break;
                    }
                    this.dom.addEventListener(k.split("_")[1], sv);
                    break;
                default:
                    this.dom.setAttribute(k, sv);
            }
        });
        if (!this.rendered)
            return;
        if (this.rootNode !== null) {
            this.rendered = false; // hax
            this.render();
            return;
        }
        this.rendered = false;
        this.renderOnAttach = true;
    }

    #initialize() {
        this.witchy = true;
        this.attributes = {};
        this.nodes = new WitchCollection();
        this.tag = null;
        this.dom = null;
        this.next = null;
        this.previous = null;
        this.rootNode = null;
        this.rendered = false;
        this.renderOnAttach = false;
        this.parent = null;
    }

    get last() {
        return this.nodes.at(-1);
    }

    get textNode() {
        if (this.attributes.text !== undefined)
            return this.dom.childNodes[0]; // the text node is always first
        return null;
    }

    attach(node) {
        this.rootNode = WitchUtil.sanitizeNodeTarget(node);
        if (this.rootNode === null)
            return false;
        if (node.witchy)
            this.parent = node;
        if (this.renderOnAttach) {
            this.render();
            this.renderOnAttach = false;
        }
        return true;
    }

    // kumputer injiner
    add(e, b = null) {
        if (!e.witchy) {
            console.error("element must inherit WitchElement");
            return null;
        }
        e.attach(this);
        if (b !== null)
            this.nodes.insert(b, e);
        else
            this.nodes.add(e);
        return e;
    }

    delete(e) {
        if (!this.nodes.includes(e))
            return null;
        return this.nodes.delete(e);
    }

    render() {
        this.nodes.forEach(e => e.render());
        if (this.rendered)
            return;
        if (this.next === null)
            this.rootNode.appendChild(this.dom);
        else if (this.next.witchy) { // garbage order sync
            const tgt = this.parent.nodes.find((e, i) =>
                (i > this.parent.nodes.indexOf(this) && e.rendered));
            if (tgt === undefined)
                this.rootNode.appendChild(this.dom);
            else
                this.rootNode.insertBefore(this.dom, tgt.dom);
        } else
            this.next = null; // destroyed node
        this.rendered = true;
    }

    unrender() {
        this.nodes.forEach(e => e.unrender());
        if (!this.rendered)
            return;
        this.rootNode.removeChild(this.dom);
        this.rendered = false;
    }

    destroy() {
        this.nodes.forEach(e => e.destroy());
        if (this.rendered)
            this.unrender();
        this.nodes.flush();
        this.witchy = false;
    }
}

class Checkbox extends WitchElement {
    constructor(attr) {
        // this needs to be done before the constructor
        const clickHandler = WitchUtil.extract(attr, "checkbox_event", "function");
        const doRender = WitchUtil.extract(attr, "render", "boolean");
        const checkedDefault = WitchUtil.extract(attr, "checked", "boolean");
        const defaults = {
            type: "checkbox",
            // why does this act as if it's true even if it's set to false
            // even though other boolean attributes don't do that
            ...( checkedDefault && {checked: true}),
            on_click: e => {
                this.check(e.target.checked);
                if (clickHandler)
                    clickHandler(this, e);
            }
        };
        super("input", { ...defaults, ...attr });
        this.check(this.dom.checked);
        if (doRender)
            this.render();
    }

    check(s) {
        if (typeof(s) !== "boolean") {
            console.error(`state must be a boolean, got ${typeof(s)}`);
            return null;
        }
        this.checked = s;
        this.dom.classList.toggle("checked", this.checked);
        this.dom.checked = this.checked;
        return s;
    }
}

class StylableCheckbox extends WitchElement {
    constructor(attr) {
        const clazz = WitchUtil.extract(attr, "class", "string") || "checkbox",
            clickHandler = WitchUtil.extract(attr, "checkbox_event", "function"),
            doRender = WitchUtil.extract(attr, "render", "boolean"),
            checkedDefault = WitchUtil.extract(attr, "checked", "boolean") || false,
            inputID = WitchUtil.randomUniqueID(`${clazz}-input`);
        super("div", { class: clazz, ...attr });
        this.checkbox = new Checkbox({
            root: this,
            checked: checkedDefault,
            id: inputID,
            style: "display: none",
            checkbox_event: (_, e) => {
                this.check(e.target.checked);
                if (clickHandler)
                    clickHandler(this, e);
            }
        });
        this.check(this.checkbox.checked);
        this.label = new WitchElement("label", {
            render: true,
            root: this,
            class: "cb-label",
            for: inputID
        });
        this.checkbox.render();
        if (doRender)
            this.render();
    }

    check(s) {
        this.checked = this.checkbox.check(s);
        this.dom.classList.toggle("checked", this.checked);
        return s;
    }
}

class TextInput extends WitchElement {
    constructor(attr) {
        const inputHandler = WitchUtil.extract(attr, "text_event", "function");
        const doRender = WitchUtil.extract(attr, "render", "boolean");
        const defaults = {
            type: "text",
            on_keydown: e => {
                if (e.key !== "Enter")
                    return;
                this.value = e.target.value;
                e.target.value = "";
                if (inputHandler)
                    inputHandler(this, e);
            }
        };
        super("input", {...defaults, ...attr});
        this.value = null;
        if (doRender)
            this.render();
    }
}
