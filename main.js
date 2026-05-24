var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.js
var main_exports = {};
__export(main_exports, {
  default: () => AlsoLikedPlugin
});
module.exports = __toCommonJS(main_exports);

// node_modules/@impro.social/impro-plugin/main.js
var SimpleUUID = class {
  constructor() {
    this._id = 0;
  }
  create() {
    return this._id++;
  }
};
var uuid = new SimpleUUID();
var callHandlers = /* @__PURE__ */ new Map();
var pendingHostCalls = /* @__PURE__ */ new Map();
function hostCall(method, ...args) {
  const hostCallId = uuid.create();
  return new Promise((resolve, reject) => {
    pendingHostCalls.set(hostCallId, { resolve, reject });
    self.postMessage({ type: "hostCall", method, hostCallId, args });
  });
}
var eventListeners = /* @__PURE__ */ new Map();
function addEventListener(event, listener) {
  let listeners = eventListeners.get(event);
  if (!listeners) {
    listeners = /* @__PURE__ */ new Set();
    eventListeners.set(event, listeners);
    const handlerId = uuid.create();
    callHandlers.set(handlerId, async (...args) => {
      const menu = new Menu();
      for (const eventListener of listeners) {
        try {
          await eventListener(menu, ...args);
        } catch (error) {
          console.error(`"${event}" listener threw:`, error);
        }
      }
      return menu._serialize();
    });
    self.postMessage({
      type: "register",
      target: "eventListener",
      event,
      handlerId
    });
  }
  listeners.add(listener);
}
var MenuItem = class {
  constructor() {
    this.title = "";
    this.icon = null;
    this._callback = () => {
    };
  }
  setTitle(title) {
    this.title = title;
    return this;
  }
  setIcon(icon) {
    this.icon = icon;
    return this;
  }
  onClick(callback) {
    this._callback = callback;
    return this;
  }
};
var Menu = class {
  constructor() {
    this.items = [];
  }
  addItem(builder) {
    const item = new MenuItem();
    builder(item);
    this.items.push(item);
    return this;
  }
  _serialize() {
    return this.items.map((item) => {
      const handlerId = uuid.create();
      callHandlers.set(handlerId, item._callback);
      return { title: item.title, icon: item.icon, handlerId };
    });
  }
};
var PluginData = class {
  getPost(uri) {
    return hostCall("getPost", { uri });
  }
  getProfile(did) {
    return hostCall("getProfile", { did });
  }
};
var App = class {
  constructor() {
    this.currentUser = null;
    this.data = new PluginData();
  }
  on(event, listener) {
    addEventListener(event, listener);
  }
  refreshFeedFilters(feedURI = null) {
    return hostCall("refreshFeedFilters", feedURI);
  }
};
async function fetch(url, init = {}) {
  const result = await hostCall("fetch", {
    url,
    init: serializeFetchInit(init)
  });
  return new PluginResponse(result);
}
function serializeFetchInit(init) {
  const serialized = {};
  if (init.method != null) serialized.method = String(init.method);
  if (init.headers != null) {
    const headers = {};
    if (typeof init.headers.forEach === "function") {
      init.headers.forEach((value, name) => {
        headers[name] = value;
      });
    } else if (typeof init.headers[Symbol.iterator] === "function") {
      for (const [name, value] of init.headers) headers[name] = value;
    } else {
      Object.assign(headers, init.headers);
    }
    serialized.headers = headers;
  }
  if (init.body != null) serialized.body = init.body;
  return serialized;
}
var PluginResponse = class {
  constructor({ status, ok, headers, body }) {
    this.status = status;
    this.ok = ok;
    this.headers = new Map(Object.entries(headers ?? {}));
    this._body = body;
  }
  async text() {
    return this._body;
  }
  async json() {
    return JSON.parse(this._body);
  }
};
var registered = false;
var Plugin = class {
  constructor() {
    this.app = new App();
  }
  addSidebarItem(icon, title, callback = () => {
  }) {
    const handlerId = uuid.create();
    callHandlers.set(handlerId, callback);
    self.postMessage({
      type: "register",
      target: "sidebarItem",
      icon,
      title,
      handlerId
    });
  }
  async loadData() {
    return hostCall("loadData");
  }
  async saveData(data) {
    await hostCall("saveData", { data });
  }
  addSettingTab(tab) {
    tab.plugin = this;
    const displayHandlerId = uuid.create();
    callHandlers.set(displayHandlerId, () => {
      tab.containerEl = new VirtualEl("div");
      tab.display();
      return tab.containerEl._serialize();
    });
    self.postMessage({
      type: "register",
      target: "settingTab",
      name: tab.name ?? null,
      displayHandlerId
    });
    this._settingTab = tab;
  }
  addFeedFilter(callback = () => {
  }) {
    const handlerId = uuid.create();
    callHandlers.set(handlerId, callback);
    self.postMessage({
      type: "register",
      target: "feedFilter",
      handlerId
    });
  }
  registerSlot(name, callback = () => null) {
    const handlerId = uuid.create();
    callHandlers.set(handlerId, async (context) => {
      const result = await callback(context);
      if (result == null) return null;
      if (!(result instanceof VirtualEl)) {
        const description = result?.constructor?.name ?? typeof result;
        throw new Error(
          `Slot "${name}" must return a VirtualEl (or null), got ${description}`
        );
      }
      return result._serialize();
    });
    self.postMessage({
      type: "register",
      target: "slot",
      name,
      handlerId
    });
  }
  onload() {
  }
  onunload() {
  }
  static register() {
    if (registered) return;
    registered = true;
    const instance = new this();
    hostCall("getCurrentUser").then((user) => {
      instance.app.currentUser = user;
      return instance.onload();
    }).then(
      () => self.postMessage({ type: "ready" }),
      (error) => self.postMessage({
        type: "ready",
        error: error?.message ?? String(error)
      })
    );
  }
};
var openModals = /* @__PURE__ */ new Map();
var IconComponent = class {
  constructor(containerEl) {
    this.el = containerEl.createEl("plugin-icon");
  }
  setIcon(name) {
    this.el.setAttr("icon", name);
    return this;
  }
};
var ProfilesListComponent = class {
  constructor(containerEl) {
    this.el = containerEl.createEl("plugin-profiles-list");
  }
  setDids(dids) {
    const value = Array.isArray(dids) ? dids.join(",") : String(dids ?? "");
    this.el.setAttr("dids", value);
    return this;
  }
  setEmptyMessage(message) {
    this.el.setAttr("empty-message", message);
    return this;
  }
};
var PostsFeedComponent = class {
  constructor(containerEl) {
    this.el = containerEl.createEl("plugin-posts-feed");
  }
  setUris(uris) {
    const value = Array.isArray(uris) ? uris.join(",") : String(uris ?? "");
    this.el.setAttr("uris", value);
    return this;
  }
  setEmptyMessage(message) {
    this.el.setAttr("empty-message", message);
    return this;
  }
};
var VirtualEl = class _VirtualEl {
  constructor(tag) {
    this.tag = tag;
    this.attrs = {};
    this.text = null;
    this.children = [];
    this.events = {};
  }
  onClick(fn) {
    const handlerId = uuid.create();
    callHandlers.set(handlerId, fn);
    this.events.click = handlerId;
    return this;
  }
  onChange(fn) {
    const handlerId = uuid.create();
    callHandlers.set(handlerId, fn);
    this.events.change = handlerId;
    return this;
  }
  onInput(fn) {
    const handlerId = uuid.create();
    callHandlers.set(handlerId, fn);
    this.events.input = handlerId;
    return this;
  }
  setText(text) {
    this.text = text;
    this.children = [];
    return this;
  }
  empty() {
    this.text = null;
    this.children = [];
    return this;
  }
  addClass(cls) {
    this.attrs.class = this.attrs.class ? `${this.attrs.class} ${cls}` : cls;
    return this;
  }
  setAttr(name, value) {
    this.attrs[name] = value === void 0 ? "" : value;
    return this;
  }
  createEl(tag, options = {}, callback) {
    const child = new _VirtualEl(tag);
    if (options.text != null) child.text = options.text;
    if (options.cls) {
      child.attrs.class = Array.isArray(options.cls) ? options.cls.join(" ") : options.cls;
    }
    if (options.attr) Object.assign(child.attrs, options.attr);
    this.children.push(child);
    if (typeof callback === "function") callback(child);
    return child;
  }
  createDiv(options = {}, callback) {
    return this.createEl("div", options, callback);
  }
  createSpan(options = {}, callback) {
    return this.createEl("span", options, callback);
  }
  createProfilesList(callback) {
    const component = new ProfilesListComponent(this);
    if (typeof callback === "function") callback(component);
    return component;
  }
  createPostsFeed(callback) {
    const component = new PostsFeedComponent(this);
    if (typeof callback === "function") callback(component);
    return component;
  }
  createIcon(callback) {
    const component = new IconComponent(this);
    if (typeof callback === "function") callback(component);
    return component;
  }
  _serialize() {
    return {
      tag: this.tag,
      attrs: this.attrs,
      text: this.text,
      children: this.children.map((child) => child._serialize()),
      events: this.events
    };
  }
};
self.onmessage = async (event) => {
  const message = event.data;
  if (!message || typeof message !== "object") return;
  if (message.type === "call") {
    const fn = callHandlers.get(message.handlerId);
    if (!fn) {
      self.postMessage({
        type: "result",
        callId: message.callId,
        error: `unknown handler ${message.handlerId}`
      });
      return;
    }
    try {
      const value = await fn(...message.args);
      self.postMessage({ type: "result", callId: message.callId, value });
    } catch (error) {
      self.postMessage({
        type: "result",
        callId: message.callId,
        error: error.message ?? String(error)
      });
    }
    return;
  }
  if (message.type === "hostResult") {
    const pending = pendingHostCalls.get(message.hostCallId);
    if (!pending) return;
    pendingHostCalls.delete(message.hostCallId);
    if (message.error) pending.reject(new Error(message.error));
    else pending.resolve(message.value);
    return;
  }
  if (message.type === "event") {
    switch (message.event) {
      case "modalDismissed": {
        const modal = openModals.get(message.data.modalId);
        if (modal) {
          openModals.delete(message.data.modalId);
          modal.onClose();
        }
        return;
      }
    }
    return;
  }
};

// src/main.js
var ENDPOINT = "https://foryou.club/also-liked";
var FETCH_LIMIT = 50;
var DISPLAY_LIMIT = 3;
async function fetchAlsoLikedUris(postUri) {
  const url = `${ENDPOINT}?format=json&post=${encodeURIComponent(
    postUri
  )}&limit=${FETCH_LIMIT}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`also-liked request failed: ${response.status}`);
  }
  const body = await response.json();
  return (body.feed ?? []).map((entry) => entry.post).filter((uri) => typeof uri === "string");
}
function getQuotedRecord(post) {
  const embed = post?.embed;
  if (!embed) return null;
  if (embed.record?.author) return embed.record;
  if (embed.record?.record?.author) return embed.record.record;
  return null;
}
function collectExcludedDids(post) {
  const dids = /* @__PURE__ */ new Set();
  if (post?.author?.did) dids.add(post.author.did);
  const quoted = getQuotedRecord(post);
  if (quoted?.author?.did) dids.add(quoted.author.did);
  for (const nestedEmbed of quoted?.embeds ?? []) {
    const nested = nestedEmbed?.record?.author != null ? nestedEmbed.record : nestedEmbed?.record?.record?.author != null ? nestedEmbed.record.record : null;
    if (nested?.author?.did) dids.add(nested.author.did);
  }
  return dids;
}
var AlsoLikedPlugin = class extends Plugin {
  onload() {
    this.registerSlot("post-thread-view:after-replies", async (context) => {
      if (!context.uri) return null;
      const sourcePost = await this.app.data.getPost(context.uri);
      const excludedDids = collectExcludedDids(sourcePost);
      let candidateUris;
      try {
        candidateUris = await fetchAlsoLikedUris(context.uri);
      } catch (error) {
        console.error("[also-liked]", error);
        return null;
      }
      if (candidateUris.length === 0) return null;
      const candidatePosts = await Promise.all(
        candidateUris.map(
          (uri) => this.app.data.getPost(uri).catch(() => null)
        )
      );
      const uris = [];
      for (let index = 0; index < candidatePosts.length; index++) {
        const candidate = candidatePosts[index];
        if (!candidate?.author?.did) continue;
        if (excludedDids.has(candidate.author.did)) continue;
        if (candidate.viewer?.like) continue;
        if (candidate.viewer?.repost) continue;
        if (candidate.viewer?.bookmarked) continue;
        uris.push(candidateUris[index]);
        if (uris.length >= DISPLAY_LIMIT) break;
      }
      if (uris.length === 0) return null;
      const section = new VirtualEl("div");
      section.addClass("also-liked-section");
      const header = section.createEl("div", { cls: "also-liked-header" });
      header.createEl("h3", { cls: "also-liked-heading" }).setText("Also liked");
      header.createEl("p", { cls: "also-liked-subheading" }).setText("Posts liked by who people who liked this post");
      section.createPostsFeed(
        (feed) => feed.setUris(uris).setEmptyMessage("No related posts.")
      );
      return section;
    });
  }
};
