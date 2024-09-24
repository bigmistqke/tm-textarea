function _mergeNamespaces(n, m) {
    for (var i = 0; i < m.length; i++) {
        const e = m[i];
        if (typeof e !== 'string' && !Array.isArray(e)) { for (const k in e) {
            if (k !== 'default' && !(k in n)) {
                const d = Object.getOwnPropertyDescriptor(e, k);
                if (d) {
                    Object.defineProperty(n, k, d.get ? d : {
                        enumerable: true,
                        get: () => e[k]
                    });
                }
            }
        } }
    }
    return Object.freeze(Object.defineProperty(n, Symbol.toStringTag, { value: 'Module' }));
}

true&&(function polyfill() {
    const relList = document.createElement('link').relList;
    if (relList && relList.supports && relList.supports('modulepreload')) {
        return;
    }
    for (const link of document.querySelectorAll('link[rel="modulepreload"]')) {
        processPreload(link);
    }
    new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            if (mutation.type !== 'childList') {
                continue;
            }
            for (const node of mutation.addedNodes) {
                if (node.tagName === 'LINK' && node.rel === 'modulepreload')
                    processPreload(node);
            }
        }
    }).observe(document, { childList: true, subtree: true });
    function getFetchOpts(link) {
        const fetchOpts = {};
        if (link.integrity)
            fetchOpts.integrity = link.integrity;
        if (link.referrerPolicy)
            fetchOpts.referrerPolicy = link.referrerPolicy;
        if (link.crossOrigin === 'use-credentials')
            fetchOpts.credentials = 'include';
        else if (link.crossOrigin === 'anonymous')
            fetchOpts.credentials = 'omit';
        else
            fetchOpts.credentials = 'same-origin';
        return fetchOpts;
    }
    function processPreload(link) {
        if (link.ep)
            // ep marker = processed
            return;
        link.ep = true;
        // prepopulate the load record
        const fetchOpts = getFetchOpts(link);
        fetch(link.href, fetchOpts);
    }
}());

const equalFn = (a, b) => a === b;
const $PROXY = Symbol("solid-proxy");
const $TRACK = Symbol("solid-track");
const signalOptions = {
  equals: equalFn
};
let runEffects = runQueue;
const STALE = 1;
const PENDING = 2;
const UNOWNED = {
  owned: null,
  cleanups: null,
  context: null,
  owner: null
};
const NO_INIT = {};
var Owner = null;
let Transition = null;
let ExternalSourceConfig = null;
let Listener = null;
let Updates = null;
let Effects = null;
let ExecCount = 0;
function createRoot(fn, detachedOwner) {
  const listener = Listener,
    owner = Owner,
    unowned = fn.length === 0,
    current = detachedOwner === undefined ? owner : detachedOwner,
    root = unowned
      ? UNOWNED
      : {
          owned: null,
          cleanups: null,
          context: current ? current.context : null,
          owner: current
        },
    updateFn = unowned ? fn : () => fn(() => untrack(() => cleanNode(root)));
  Owner = root;
  Listener = null;
  try {
    return runUpdates(updateFn, true);
  } finally {
    Listener = listener;
    Owner = owner;
  }
}
function createSignal(value, options) {
  options = options ? Object.assign({}, signalOptions, options) : signalOptions;
  const s = {
    value,
    observers: null,
    observerSlots: null,
    comparator: options.equals || undefined
  };
  const setter = value => {
    if (typeof value === "function") {
      value = value(s.value);
    }
    return writeSignal(s, value);
  };
  return [readSignal.bind(s), setter];
}
function createComputed(fn, value, options) {
  const c = createComputation(fn, value, true, STALE);
  updateComputation(c);
}
function createRenderEffect(fn, value, options) {
  const c = createComputation(fn, value, false, STALE);
  updateComputation(c);
}
function createEffect(fn, value, options) {
  runEffects = runUserEffects;
  const c = createComputation(fn, value, false, STALE);
  c.user = true;
  Effects ? Effects.push(c) : updateComputation(c);
}
function createMemo(fn, value, options) {
  options = options ? Object.assign({}, signalOptions, options) : signalOptions;
  const c = createComputation(fn, value, true, 0);
  c.observers = null;
  c.observerSlots = null;
  c.comparator = options.equals || undefined;
  updateComputation(c);
  return readSignal.bind(c);
}
function isPromise(v) {
  return v && typeof v === "object" && "then" in v;
}
function createResource(pSource, pFetcher, pOptions) {
  let source;
  let fetcher;
  let options;
  if ((arguments.length === 2 && typeof pFetcher === "object") || arguments.length === 1) {
    source = true;
    fetcher = pSource;
    options = pFetcher || {};
  } else {
    source = pSource;
    fetcher = pFetcher;
    options = {};
  }
  let pr = null,
    initP = NO_INIT,
    scheduled = false,
    resolved = "initialValue" in options,
    dynamic = typeof source === "function" && createMemo(source);
  const contexts = new Set(),
    [value, setValue] = (options.storage || createSignal)(options.initialValue),
    [error, setError] = createSignal(undefined),
    [track, trigger] = createSignal(undefined, {
      equals: false
    }),
    [state, setState] = createSignal(resolved ? "ready" : "unresolved");
  function loadEnd(p, v, error, key) {
    if (pr === p) {
      pr = null;
      key !== undefined && (resolved = true);
      if ((p === initP || v === initP) && options.onHydrated)
        queueMicrotask(() =>
          options.onHydrated(key, {
            value: v
          })
        );
      initP = NO_INIT;
      completeLoad(v, error);
    }
    return v;
  }
  function completeLoad(v, err) {
    runUpdates(() => {
      if (err === undefined) setValue(() => v);
      setState(err !== undefined ? "errored" : resolved ? "ready" : "unresolved");
      setError(err);
      for (const c of contexts.keys()) c.decrement();
      contexts.clear();
    }, false);
  }
  function read() {
    const c = SuspenseContext ,
      v = value(),
      err = error();
    if (err !== undefined && !pr) throw err;
    if (Listener && !Listener.user && c) {
      createComputed(() => {
        track();
        if (pr) {
          if (c.resolved  ) ;
          else if (!contexts.has(c)) {
            c.increment();
            contexts.add(c);
          }
        }
      });
    }
    return v;
  }
  function load(refetching = true) {
    if (refetching !== false && scheduled) return;
    scheduled = false;
    const lookup = dynamic ? dynamic() : source;
    if (lookup == null || lookup === false) {
      loadEnd(pr, untrack(value));
      return;
    }
    const p =
      initP !== NO_INIT
        ? initP
        : untrack(() =>
            fetcher(lookup, {
              value: value(),
              refetching
            })
          );
    if (!isPromise(p)) {
      loadEnd(pr, p, undefined, lookup);
      return p;
    }
    pr = p;
    if ("value" in p) {
      if (p.status === "success") loadEnd(pr, p.value, undefined, lookup);
      else loadEnd(pr, undefined, undefined, lookup);
      return p;
    }
    scheduled = true;
    queueMicrotask(() => (scheduled = false));
    runUpdates(() => {
      setState(resolved ? "refreshing" : "pending");
      trigger();
    }, false);
    return p.then(
      v => loadEnd(p, v, undefined, lookup),
      e => loadEnd(p, undefined, castError(e), lookup)
    );
  }
  Object.defineProperties(read, {
    state: {
      get: () => state()
    },
    error: {
      get: () => error()
    },
    loading: {
      get() {
        const s = state();
        return s === "pending" || s === "refreshing";
      }
    },
    latest: {
      get() {
        if (!resolved) return read();
        const err = error();
        if (err && !pr) throw err;
        return value();
      }
    }
  });
  if (dynamic) createComputed(() => load(false));
  else load(false);
  return [
    read,
    {
      refetch: load,
      mutate: setValue
    }
  ];
}
function createSelector(source, fn = equalFn, options) {
  const subs = new Map();
  const node = createComputation(
    p => {
      const v = source();
      for (const [key, val] of subs.entries())
        if (fn(key, v) !== fn(key, p)) {
          for (const c of val.values()) {
            c.state = STALE;
            if (c.pure) Updates.push(c);
            else Effects.push(c);
          }
        }
      return v;
    },
    undefined,
    true,
    STALE
  );
  updateComputation(node);
  return key => {
    const listener = Listener;
    if (listener) {
      let l;
      if ((l = subs.get(key))) l.add(listener);
      else subs.set(key, (l = new Set([listener])));
      onCleanup(() => {
        l.delete(listener);
        !l.size && subs.delete(key);
      });
    }
    return fn(
      key,
      node.value
    );
  };
}
function untrack(fn) {
  if (Listener === null) return fn();
  const listener = Listener;
  Listener = null;
  try {
    if (ExternalSourceConfig) ;
    return fn();
  } finally {
    Listener = listener;
  }
}
function onMount(fn) {
  createEffect(() => untrack(fn));
}
function onCleanup(fn) {
  if (Owner === null);
  else if (Owner.cleanups === null) Owner.cleanups = [fn];
  else Owner.cleanups.push(fn);
  return fn;
}
function getListener() {
  return Listener;
}
function getOwner() {
  return Owner;
}
function runWithOwner(o, fn) {
  const prev = Owner;
  const prevListener = Listener;
  Owner = o;
  Listener = null;
  try {
    return runUpdates(fn, true);
  } catch (err) {
    handleError(err);
  } finally {
    Owner = prev;
    Listener = prevListener;
  }
}
let SuspenseContext;
function readSignal() {
  if (this.sources && (this.state)) {
    if ((this.state) === STALE) updateComputation(this);
    else {
      const updates = Updates;
      Updates = null;
      runUpdates(() => lookUpstream(this), false);
      Updates = updates;
    }
  }
  if (Listener) {
    const sSlot = this.observers ? this.observers.length : 0;
    if (!Listener.sources) {
      Listener.sources = [this];
      Listener.sourceSlots = [sSlot];
    } else {
      Listener.sources.push(this);
      Listener.sourceSlots.push(sSlot);
    }
    if (!this.observers) {
      this.observers = [Listener];
      this.observerSlots = [Listener.sources.length - 1];
    } else {
      this.observers.push(Listener);
      this.observerSlots.push(Listener.sources.length - 1);
    }
  }
  return this.value;
}
function writeSignal(node, value, isComp) {
  let current =
    node.value;
  if (!node.comparator || !node.comparator(current, value)) {
    node.value = value;
    if (node.observers && node.observers.length) {
      runUpdates(() => {
        for (let i = 0; i < node.observers.length; i += 1) {
          const o = node.observers[i];
          const TransitionRunning = Transition && Transition.running;
          if (TransitionRunning && Transition.disposed.has(o)) ;
          if (TransitionRunning ? !o.tState : !o.state) {
            if (o.pure) Updates.push(o);
            else Effects.push(o);
            if (o.observers) markDownstream(o);
          }
          if (!TransitionRunning) o.state = STALE;
        }
        if (Updates.length > 10e5) {
          Updates = [];
          if (false);
          throw new Error();
        }
      }, false);
    }
  }
  return value;
}
function updateComputation(node) {
  if (!node.fn) return;
  cleanNode(node);
  const time = ExecCount;
  runComputation(
    node,
    node.value,
    time
  );
}
function runComputation(node, value, time) {
  let nextValue;
  const owner = Owner,
    listener = Listener;
  Listener = Owner = node;
  try {
    nextValue = node.fn(value);
  } catch (err) {
    if (node.pure) {
      {
        node.state = STALE;
        node.owned && node.owned.forEach(cleanNode);
        node.owned = null;
      }
    }
    node.updatedAt = time + 1;
    return handleError(err);
  } finally {
    Listener = listener;
    Owner = owner;
  }
  if (!node.updatedAt || node.updatedAt <= time) {
    if (node.updatedAt != null && "observers" in node) {
      writeSignal(node, nextValue);
    } else node.value = nextValue;
    node.updatedAt = time;
  }
}
function createComputation(fn, init, pure, state = STALE, options) {
  const c = {
    fn,
    state: state,
    updatedAt: null,
    owned: null,
    sources: null,
    sourceSlots: null,
    cleanups: null,
    value: init,
    owner: Owner,
    context: Owner ? Owner.context : null,
    pure
  };
  if (Owner === null);
  else if (Owner !== UNOWNED) {
    {
      if (!Owner.owned) Owner.owned = [c];
      else Owner.owned.push(c);
    }
  }
  return c;
}
function runTop(node) {
  if ((node.state) === 0) return;
  if ((node.state) === PENDING) return lookUpstream(node);
  if (node.suspense && untrack(node.suspense.inFallback)) return node.suspense.effects.push(node);
  const ancestors = [node];
  while ((node = node.owner) && (!node.updatedAt || node.updatedAt < ExecCount)) {
    if (node.state) ancestors.push(node);
  }
  for (let i = ancestors.length - 1; i >= 0; i--) {
    node = ancestors[i];
    if ((node.state) === STALE) {
      updateComputation(node);
    } else if ((node.state) === PENDING) {
      const updates = Updates;
      Updates = null;
      runUpdates(() => lookUpstream(node, ancestors[0]), false);
      Updates = updates;
    }
  }
}
function runUpdates(fn, init) {
  if (Updates) return fn();
  let wait = false;
  if (!init) Updates = [];
  if (Effects) wait = true;
  else Effects = [];
  ExecCount++;
  try {
    const res = fn();
    completeUpdates(wait);
    return res;
  } catch (err) {
    if (!wait) Effects = null;
    Updates = null;
    handleError(err);
  }
}
function completeUpdates(wait) {
  if (Updates) {
    runQueue(Updates);
    Updates = null;
  }
  if (wait) return;
  const e = Effects;
  Effects = null;
  if (e.length) runUpdates(() => runEffects(e), false);
}
function runQueue(queue) {
  for (let i = 0; i < queue.length; i++) runTop(queue[i]);
}
function runUserEffects(queue) {
  let i,
    userLength = 0;
  for (i = 0; i < queue.length; i++) {
    const e = queue[i];
    if (!e.user) runTop(e);
    else queue[userLength++] = e;
  }
  for (i = 0; i < userLength; i++) runTop(queue[i]);
}
function lookUpstream(node, ignore) {
  node.state = 0;
  for (let i = 0; i < node.sources.length; i += 1) {
    const source = node.sources[i];
    if (source.sources) {
      const state = source.state;
      if (state === STALE) {
        if (source !== ignore && (!source.updatedAt || source.updatedAt < ExecCount))
          runTop(source);
      } else if (state === PENDING) lookUpstream(source, ignore);
    }
  }
}
function markDownstream(node) {
  for (let i = 0; i < node.observers.length; i += 1) {
    const o = node.observers[i];
    if (!o.state) {
      o.state = PENDING;
      if (o.pure) Updates.push(o);
      else Effects.push(o);
      o.observers && markDownstream(o);
    }
  }
}
function cleanNode(node) {
  let i;
  if (node.sources) {
    while (node.sources.length) {
      const source = node.sources.pop(),
        index = node.sourceSlots.pop(),
        obs = source.observers;
      if (obs && obs.length) {
        const n = obs.pop(),
          s = source.observerSlots.pop();
        if (index < obs.length) {
          n.sourceSlots[s] = index;
          obs[index] = n;
          source.observerSlots[index] = s;
        }
      }
    }
  }
  if (node.owned) {
    for (i = node.owned.length - 1; i >= 0; i--) cleanNode(node.owned[i]);
    node.owned = null;
  }
  if (node.cleanups) {
    for (i = node.cleanups.length - 1; i >= 0; i--) node.cleanups[i]();
    node.cleanups = null;
  }
  node.state = 0;
}
function castError(err) {
  if (err instanceof Error) return err;
  return new Error(typeof err === "string" ? err : "Unknown error", {
    cause: err
  });
}
function handleError(err, owner = Owner) {
  const error = castError(err);
  throw error;
}

const FALLBACK = Symbol("fallback");
function dispose(d) {
  for (let i = 0; i < d.length; i++) d[i]();
}
function mapArray(list, mapFn, options = {}) {
  let items = [],
    mapped = [],
    disposers = [],
    len = 0,
    indexes = mapFn.length > 1 ? [] : null;
  onCleanup(() => dispose(disposers));
  return () => {
    let newItems = list() || [],
      i,
      j;
    newItems[$TRACK];
    return untrack(() => {
      let newLen = newItems.length,
        newIndices,
        newIndicesNext,
        temp,
        tempdisposers,
        tempIndexes,
        start,
        end,
        newEnd,
        item;
      if (newLen === 0) {
        if (len !== 0) {
          dispose(disposers);
          disposers = [];
          items = [];
          mapped = [];
          len = 0;
          indexes && (indexes = []);
        }
        if (options.fallback) {
          items = [FALLBACK];
          mapped[0] = createRoot(disposer => {
            disposers[0] = disposer;
            return options.fallback();
          });
          len = 1;
        }
      } else if (len === 0) {
        mapped = new Array(newLen);
        for (j = 0; j < newLen; j++) {
          items[j] = newItems[j];
          mapped[j] = createRoot(mapper);
        }
        len = newLen;
      } else {
        temp = new Array(newLen);
        tempdisposers = new Array(newLen);
        indexes && (tempIndexes = new Array(newLen));
        for (
          start = 0, end = Math.min(len, newLen);
          start < end && items[start] === newItems[start];
          start++
        );
        for (
          end = len - 1, newEnd = newLen - 1;
          end >= start && newEnd >= start && items[end] === newItems[newEnd];
          end--, newEnd--
        ) {
          temp[newEnd] = mapped[end];
          tempdisposers[newEnd] = disposers[end];
          indexes && (tempIndexes[newEnd] = indexes[end]);
        }
        newIndices = new Map();
        newIndicesNext = new Array(newEnd + 1);
        for (j = newEnd; j >= start; j--) {
          item = newItems[j];
          i = newIndices.get(item);
          newIndicesNext[j] = i === undefined ? -1 : i;
          newIndices.set(item, j);
        }
        for (i = start; i <= end; i++) {
          item = items[i];
          j = newIndices.get(item);
          if (j !== undefined && j !== -1) {
            temp[j] = mapped[i];
            tempdisposers[j] = disposers[i];
            indexes && (tempIndexes[j] = indexes[i]);
            j = newIndicesNext[j];
            newIndices.set(item, j);
          } else disposers[i]();
        }
        for (j = start; j < newLen; j++) {
          if (j in temp) {
            mapped[j] = temp[j];
            disposers[j] = tempdisposers[j];
            if (indexes) {
              indexes[j] = tempIndexes[j];
              indexes[j](j);
            }
          } else mapped[j] = createRoot(mapper);
        }
        mapped = mapped.slice(0, (len = newLen));
        items = newItems.slice(0);
      }
      return mapped;
    });
    function mapper(disposer) {
      disposers[j] = disposer;
      if (indexes) {
        const [s, set] = createSignal(j);
        indexes[j] = set;
        return mapFn(newItems[j], s);
      }
      return mapFn(newItems[j]);
    }
  };
}
function indexArray(list, mapFn, options = {}) {
  let items = [],
    mapped = [],
    disposers = [],
    signals = [],
    len = 0,
    i;
  onCleanup(() => dispose(disposers));
  return () => {
    const newItems = list() || [];
    newItems[$TRACK];
    return untrack(() => {
      if (newItems.length === 0) {
        if (len !== 0) {
          dispose(disposers);
          disposers = [];
          items = [];
          mapped = [];
          len = 0;
          signals = [];
        }
        if (options.fallback) {
          items = [FALLBACK];
          mapped[0] = createRoot(disposer => {
            disposers[0] = disposer;
            return options.fallback();
          });
          len = 1;
        }
        return mapped;
      }
      if (items[0] === FALLBACK) {
        disposers[0]();
        disposers = [];
        items = [];
        mapped = [];
        len = 0;
      }
      for (i = 0; i < newItems.length; i++) {
        if (i < items.length && items[i] !== newItems[i]) {
          signals[i](() => newItems[i]);
        } else if (i >= items.length) {
          mapped[i] = createRoot(mapper);
        }
      }
      for (; i < items.length; i++) {
        disposers[i]();
      }
      len = signals.length = disposers.length = newItems.length;
      items = newItems.slice(0);
      return (mapped = mapped.slice(0, len));
    });
    function mapper(disposer) {
      disposers[i] = disposer;
      const [s, set] = createSignal(newItems[i]);
      signals[i] = set;
      return mapFn(s, i);
    }
  };
}
function createComponent(Comp, props) {
  return untrack(() => Comp(props || {}));
}
function trueFn() {
  return true;
}
const propTraps = {
  get(_, property, receiver) {
    if (property === $PROXY) return receiver;
    return _.get(property);
  },
  has(_, property) {
    if (property === $PROXY) return true;
    return _.has(property);
  },
  set: trueFn,
  deleteProperty: trueFn,
  getOwnPropertyDescriptor(_, property) {
    return {
      configurable: true,
      enumerable: true,
      get() {
        return _.get(property);
      },
      set: trueFn,
      deleteProperty: trueFn
    };
  },
  ownKeys(_) {
    return _.keys();
  }
};
function resolveSource(s) {
  return !(s = typeof s === "function" ? s() : s) ? {} : s;
}
function resolveSources() {
  for (let i = 0, length = this.length; i < length; ++i) {
    const v = this[i]();
    if (v !== undefined) return v;
  }
}
function mergeProps(...sources) {
  let proxy = false;
  for (let i = 0; i < sources.length; i++) {
    const s = sources[i];
    proxy = proxy || (!!s && $PROXY in s);
    sources[i] = typeof s === "function" ? ((proxy = true), createMemo(s)) : s;
  }
  if (proxy) {
    return new Proxy(
      {
        get(property) {
          for (let i = sources.length - 1; i >= 0; i--) {
            const v = resolveSource(sources[i])[property];
            if (v !== undefined) return v;
          }
        },
        has(property) {
          for (let i = sources.length - 1; i >= 0; i--) {
            if (property in resolveSource(sources[i])) return true;
          }
          return false;
        },
        keys() {
          const keys = [];
          for (let i = 0; i < sources.length; i++)
            keys.push(...Object.keys(resolveSource(sources[i])));
          return [...new Set(keys)];
        }
      },
      propTraps
    );
  }
  const sourcesMap = {};
  const defined = Object.create(null);
  for (let i = sources.length - 1; i >= 0; i--) {
    const source = sources[i];
    if (!source) continue;
    const sourceKeys = Object.getOwnPropertyNames(source);
    for (let i = sourceKeys.length - 1; i >= 0; i--) {
      const key = sourceKeys[i];
      if (key === "__proto__" || key === "constructor") continue;
      const desc = Object.getOwnPropertyDescriptor(source, key);
      if (!defined[key]) {
        defined[key] = desc.get
          ? {
              enumerable: true,
              configurable: true,
              get: resolveSources.bind((sourcesMap[key] = [desc.get.bind(source)]))
            }
          : desc.value !== undefined
          ? desc
          : undefined;
      } else {
        const sources = sourcesMap[key];
        if (sources) {
          if (desc.get) sources.push(desc.get.bind(source));
          else if (desc.value !== undefined) sources.push(() => desc.value);
        }
      }
    }
  }
  const target = {};
  const definedKeys = Object.keys(defined);
  for (let i = definedKeys.length - 1; i >= 0; i--) {
    const key = definedKeys[i],
      desc = defined[key];
    if (desc && desc.get) Object.defineProperty(target, key, desc);
    else target[key] = desc ? desc.value : undefined;
  }
  return target;
}
function splitProps(props, ...keys) {
  if ($PROXY in props) {
    const blocked = new Set(keys.length > 1 ? keys.flat() : keys[0]);
    const res = keys.map(k => {
      return new Proxy(
        {
          get(property) {
            return k.includes(property) ? props[property] : undefined;
          },
          has(property) {
            return k.includes(property) && property in props;
          },
          keys() {
            return k.filter(property => property in props);
          }
        },
        propTraps
      );
    });
    res.push(
      new Proxy(
        {
          get(property) {
            return blocked.has(property) ? undefined : props[property];
          },
          has(property) {
            return blocked.has(property) ? false : property in props;
          },
          keys() {
            return Object.keys(props).filter(k => !blocked.has(k));
          }
        },
        propTraps
      )
    );
    return res;
  }
  const otherObject = {};
  const objects = keys.map(() => ({}));
  for (const propName of Object.getOwnPropertyNames(props)) {
    const desc = Object.getOwnPropertyDescriptor(props, propName);
    const isDefaultDesc =
      !desc.get && !desc.set && desc.enumerable && desc.writable && desc.configurable;
    let blocked = false;
    let objectIndex = 0;
    for (const k of keys) {
      if (k.includes(propName)) {
        blocked = true;
        isDefaultDesc
          ? (objects[objectIndex][propName] = desc.value)
          : Object.defineProperty(objects[objectIndex], propName, desc);
      }
      ++objectIndex;
    }
    if (!blocked) {
      isDefaultDesc
        ? (otherObject[propName] = desc.value)
        : Object.defineProperty(otherObject, propName, desc);
    }
  }
  return [...objects, otherObject];
}

const narrowedError = name => `Stale read from <${name}>.`;
function For(props) {
  const fallback = "fallback" in props && {
    fallback: () => props.fallback
  };
  return createMemo(mapArray(() => props.each, props.children, fallback || undefined));
}
function Index(props) {
  const fallback = "fallback" in props && {
    fallback: () => props.fallback
  };
  return createMemo(indexArray(() => props.each, props.children, fallback || undefined));
}
function Show(props) {
  const keyed = props.keyed;
  const condition = createMemo(() => props.when, undefined, {
    equals: (a, b) => (keyed ? a === b : !a === !b)
  });
  return createMemo(
    () => {
      const c = condition();
      if (c) {
        const child = props.children;
        const fn = typeof child === "function" && child.length > 0;
        return fn
          ? untrack(() =>
              child(
                keyed
                  ? c
                  : () => {
                      if (!untrack(condition)) throw narrowedError("Show");
                      return props.when;
                    }
              )
            )
          : child;
      }
      return props.fallback;
    },
    undefined,
    undefined
  );
}

const booleans = [
  "allowfullscreen",
  "async",
  "autofocus",
  "autoplay",
  "checked",
  "controls",
  "default",
  "disabled",
  "formnovalidate",
  "hidden",
  "indeterminate",
  "inert",
  "ismap",
  "loop",
  "multiple",
  "muted",
  "nomodule",
  "novalidate",
  "open",
  "playsinline",
  "readonly",
  "required",
  "reversed",
  "seamless",
  "selected"
];
const Properties = /*#__PURE__*/ new Set([
  "className",
  "value",
  "readOnly",
  "formNoValidate",
  "isMap",
  "noModule",
  "playsInline",
  ...booleans
]);
const ChildProperties = /*#__PURE__*/ new Set([
  "innerHTML",
  "textContent",
  "innerText",
  "children"
]);
const Aliases = /*#__PURE__*/ Object.assign(Object.create(null), {
  className: "class",
  htmlFor: "for"
});
const PropAliases = /*#__PURE__*/ Object.assign(Object.create(null), {
  class: "className",
  formnovalidate: {
    $: "formNoValidate",
    BUTTON: 1,
    INPUT: 1
  },
  ismap: {
    $: "isMap",
    IMG: 1
  },
  nomodule: {
    $: "noModule",
    SCRIPT: 1
  },
  playsinline: {
    $: "playsInline",
    VIDEO: 1
  },
  readonly: {
    $: "readOnly",
    INPUT: 1,
    TEXTAREA: 1
  }
});
function getPropAlias(prop, tagName) {
  const a = PropAliases[prop];
  return typeof a === "object" ? (a[tagName] ? a["$"] : undefined) : a;
}
const DelegatedEvents = /*#__PURE__*/ new Set([
  "beforeinput",
  "click",
  "dblclick",
  "contextmenu",
  "focusin",
  "focusout",
  "input",
  "keydown",
  "keyup",
  "mousedown",
  "mousemove",
  "mouseout",
  "mouseover",
  "mouseup",
  "pointerdown",
  "pointermove",
  "pointerout",
  "pointerover",
  "pointerup",
  "touchend",
  "touchmove",
  "touchstart"
]);

function reconcileArrays(parentNode, a, b) {
  let bLength = b.length,
    aEnd = a.length,
    bEnd = bLength,
    aStart = 0,
    bStart = 0,
    after = a[aEnd - 1].nextSibling,
    map = null;
  while (aStart < aEnd || bStart < bEnd) {
    if (a[aStart] === b[bStart]) {
      aStart++;
      bStart++;
      continue;
    }
    while (a[aEnd - 1] === b[bEnd - 1]) {
      aEnd--;
      bEnd--;
    }
    if (aEnd === aStart) {
      const node = bEnd < bLength ? (bStart ? b[bStart - 1].nextSibling : b[bEnd - bStart]) : after;
      while (bStart < bEnd) parentNode.insertBefore(b[bStart++], node);
    } else if (bEnd === bStart) {
      while (aStart < aEnd) {
        if (!map || !map.has(a[aStart])) a[aStart].remove();
        aStart++;
      }
    } else if (a[aStart] === b[bEnd - 1] && b[bStart] === a[aEnd - 1]) {
      const node = a[--aEnd].nextSibling;
      parentNode.insertBefore(b[bStart++], a[aStart++].nextSibling);
      parentNode.insertBefore(b[--bEnd], node);
      a[aEnd] = b[bEnd];
    } else {
      if (!map) {
        map = new Map();
        let i = bStart;
        while (i < bEnd) map.set(b[i], i++);
      }
      const index = map.get(a[aStart]);
      if (index != null) {
        if (bStart < index && index < bEnd) {
          let i = aStart,
            sequence = 1,
            t;
          while (++i < aEnd && i < bEnd) {
            if ((t = map.get(a[i])) == null || t !== index + sequence) break;
            sequence++;
          }
          if (sequence > index - bStart) {
            const node = a[aStart];
            while (bStart < index) parentNode.insertBefore(b[bStart++], node);
          } else parentNode.replaceChild(b[bStart++], a[aStart++]);
        } else aStart++;
      } else a[aStart++].remove();
    }
  }
}

const $$EVENTS = "_$DX_DELEGATE";
function render(code, element, init, options = {}) {
  let disposer;
  createRoot(dispose => {
    disposer = dispose;
    element === document
      ? code()
      : insert(element, code(), element.firstChild ? null : undefined, init);
  }, options.owner);
  return () => {
    disposer();
    element.textContent = "";
  };
}
function template(html, isCE, isSVG) {
  let node;
  const create = () => {
    const t = document.createElement("template");
    t.innerHTML = html;
    return isSVG ? t.content.firstChild.firstChild : t.content.firstChild;
  };
  const fn = isCE
    ? () => untrack(() => document.importNode(node || (node = create()), true))
    : () => (node || (node = create())).cloneNode(true);
  fn.cloneNode = fn;
  return fn;
}
function delegateEvents(eventNames, document = window.document) {
  const e = document[$$EVENTS] || (document[$$EVENTS] = new Set());
  for (let i = 0, l = eventNames.length; i < l; i++) {
    const name = eventNames[i];
    if (!e.has(name)) {
      e.add(name);
      document.addEventListener(name, eventHandler);
    }
  }
}
function setAttribute(node, name, value) {
  if (value == null) node.removeAttribute(name);
  else node.setAttribute(name, value);
}
function className(node, value) {
  if (value == null) node.removeAttribute("class");
  else node.className = value;
}
function addEventListener(node, name, handler, delegate) {
  if (delegate) {
    if (Array.isArray(handler)) {
      node[`$$${name}`] = handler[0];
      node[`$$${name}Data`] = handler[1];
    } else node[`$$${name}`] = handler;
  } else if (Array.isArray(handler)) {
    const handlerFn = handler[0];
    node.addEventListener(name, (handler[0] = e => handlerFn.call(node, handler[1], e)));
  } else node.addEventListener(name, handler);
}
function classList(node, value, prev = {}) {
  const classKeys = Object.keys(value || {}),
    prevKeys = Object.keys(prev);
  let i, len;
  for (i = 0, len = prevKeys.length; i < len; i++) {
    const key = prevKeys[i];
    if (!key || key === "undefined" || value[key]) continue;
    toggleClassKey(node, key, false);
    delete prev[key];
  }
  for (i = 0, len = classKeys.length; i < len; i++) {
    const key = classKeys[i],
      classValue = !!value[key];
    if (!key || key === "undefined" || prev[key] === classValue || !classValue) continue;
    toggleClassKey(node, key, true);
    prev[key] = classValue;
  }
  return prev;
}
function style(node, value, prev) {
  if (!value) return prev ? setAttribute(node, "style") : value;
  const nodeStyle = node.style;
  if (typeof value === "string") return (nodeStyle.cssText = value);
  typeof prev === "string" && (nodeStyle.cssText = prev = undefined);
  prev || (prev = {});
  value || (value = {});
  let v, s;
  for (s in prev) {
    value[s] == null && nodeStyle.removeProperty(s);
    delete prev[s];
  }
  for (s in value) {
    v = value[s];
    if (v !== prev[s]) {
      nodeStyle.setProperty(s, v);
      prev[s] = v;
    }
  }
  return prev;
}
function spread(node, props = {}, isSVG, skipChildren) {
  const prevProps = {};
  createRenderEffect(() =>
    typeof props.ref === "function" ? use(props.ref, node) : (props.ref = node)
  );
  createRenderEffect(() => assign(node, props, isSVG, true, prevProps, true));
  return prevProps;
}
function use(fn, element, arg) {
  return untrack(() => fn(element, arg));
}
function insert(parent, accessor, marker, initial) {
  if (marker !== undefined && !initial) initial = [];
  if (typeof accessor !== "function") return insertExpression(parent, accessor, initial, marker);
  createRenderEffect(current => insertExpression(parent, accessor(), current, marker), initial);
}
function assign(node, props, isSVG, skipChildren, prevProps = {}, skipRef = false) {
  props || (props = {});
  for (const prop in prevProps) {
    if (!(prop in props)) {
      if (prop === "children") continue;
      prevProps[prop] = assignProp(node, prop, null, prevProps[prop], isSVG, skipRef);
    }
  }
  for (const prop in props) {
    if (prop === "children") {
      continue;
    }
    const value = props[prop];
    prevProps[prop] = assignProp(node, prop, value, prevProps[prop], isSVG, skipRef);
  }
}
function toPropertyName(name) {
  return name.toLowerCase().replace(/-([a-z])/g, (_, w) => w.toUpperCase());
}
function toggleClassKey(node, key, value) {
  const classNames = key.trim().split(/\s+/);
  for (let i = 0, nameLen = classNames.length; i < nameLen; i++)
    node.classList.toggle(classNames[i], value);
}
function assignProp(node, prop, value, prev, isSVG, skipRef) {
  let isCE, isProp, isChildProp, propAlias, forceProp;
  if (prop === "style") return style(node, value, prev);
  if (prop === "classList") return classList(node, value, prev);
  if (value === prev) return prev;
  if (prop === "ref") {
    if (!skipRef) value(node);
  } else if (prop.slice(0, 3) === "on:") {
    const e = prop.slice(3);
    prev && node.removeEventListener(e, prev);
    value && node.addEventListener(e, value);
  } else if (prop.slice(0, 10) === "oncapture:") {
    const e = prop.slice(10);
    prev && node.removeEventListener(e, prev, true);
    value && node.addEventListener(e, value, true);
  } else if (prop.slice(0, 2) === "on") {
    const name = prop.slice(2).toLowerCase();
    const delegate = DelegatedEvents.has(name);
    if (!delegate && prev) {
      const h = Array.isArray(prev) ? prev[0] : prev;
      node.removeEventListener(name, h);
    }
    if (delegate || value) {
      addEventListener(node, name, value, delegate);
      delegate && delegateEvents([name]);
    }
  } else if (prop.slice(0, 5) === "attr:") {
    setAttribute(node, prop.slice(5), value);
  } else if (
    (forceProp = prop.slice(0, 5) === "prop:") ||
    (isChildProp = ChildProperties.has(prop)) ||
    (((propAlias = getPropAlias(prop, node.tagName)) || (isProp = Properties.has(prop)))) ||
    (isCE = node.nodeName.includes("-"))
  ) {
    if (forceProp) {
      prop = prop.slice(5);
      isProp = true;
    }
    if (prop === "class" || prop === "className") className(node, value);
    else if (isCE && !isProp && !isChildProp) node[toPropertyName(prop)] = value;
    else node[propAlias || prop] = value;
  } else {
    setAttribute(node, Aliases[prop] || prop, value);
  }
  return value;
}
function eventHandler(e) {
  const key = `$$${e.type}`;
  let node = (e.composedPath && e.composedPath()[0]) || e.target;
  if (e.target !== node) {
    Object.defineProperty(e, "target", {
      configurable: true,
      value: node
    });
  }
  Object.defineProperty(e, "currentTarget", {
    configurable: true,
    get() {
      return node || document;
    }
  });
  while (node) {
    const handler = node[key];
    if (handler && !node.disabled) {
      const data = node[`${key}Data`];
      data !== undefined ? handler.call(node, data, e) : handler.call(node, e);
      if (e.cancelBubble) return;
    }
    node = node._$host || node.parentNode || node.host;
  }
}
function insertExpression(parent, value, current, marker, unwrapArray) {
  while (typeof current === "function") current = current();
  if (value === current) return current;
  const t = typeof value,
    multi = marker !== undefined;
  parent = (multi && current[0] && current[0].parentNode) || parent;
  if (t === "string" || t === "number") {
    if (t === "number") value = value.toString();
    if (multi) {
      let node = current[0];
      if (node && node.nodeType === 3) {
        node.data !== value && (node.data = value);
      } else node = document.createTextNode(value);
      current = cleanChildren(parent, current, marker, node);
    } else {
      if (current !== "" && typeof current === "string") {
        current = parent.firstChild.data = value;
      } else current = parent.textContent = value;
    }
  } else if (value == null || t === "boolean") {
    current = cleanChildren(parent, current, marker);
  } else if (t === "function") {
    createRenderEffect(() => {
      let v = value();
      while (typeof v === "function") v = v();
      current = insertExpression(parent, v, current, marker);
    });
    return () => current;
  } else if (Array.isArray(value)) {
    const array = [];
    const currentArray = current && Array.isArray(current);
    if (normalizeIncomingArray(array, value, current, unwrapArray)) {
      createRenderEffect(() => (current = insertExpression(parent, array, current, marker, true)));
      return () => current;
    }
    if (array.length === 0) {
      current = cleanChildren(parent, current, marker);
      if (multi) return current;
    } else if (currentArray) {
      if (current.length === 0) {
        appendNodes(parent, array, marker);
      } else reconcileArrays(parent, current, array);
    } else {
      current && cleanChildren(parent);
      appendNodes(parent, array);
    }
    current = array;
  } else if (value.nodeType) {
    if (Array.isArray(current)) {
      if (multi) return (current = cleanChildren(parent, current, marker, value));
      cleanChildren(parent, current, null, value);
    } else if (current == null || current === "" || !parent.firstChild) {
      parent.appendChild(value);
    } else parent.replaceChild(value, parent.firstChild);
    current = value;
  } else;
  return current;
}
function normalizeIncomingArray(normalized, array, current, unwrap) {
  let dynamic = false;
  for (let i = 0, len = array.length; i < len; i++) {
    let item = array[i],
      prev = current && current[normalized.length],
      t;
    if (item == null || item === true || item === false);
    else if ((t = typeof item) === "object" && item.nodeType) {
      normalized.push(item);
    } else if (Array.isArray(item)) {
      dynamic = normalizeIncomingArray(normalized, item, prev) || dynamic;
    } else if (t === "function") {
      if (unwrap) {
        while (typeof item === "function") item = item();
        dynamic =
          normalizeIncomingArray(
            normalized,
            Array.isArray(item) ? item : [item],
            Array.isArray(prev) ? prev : [prev]
          ) || dynamic;
      } else {
        normalized.push(item);
        dynamic = true;
      }
    } else {
      const value = String(item);
      if (prev && prev.nodeType === 3 && prev.data === value) normalized.push(prev);
      else normalized.push(document.createTextNode(value));
    }
  }
  return dynamic;
}
function appendNodes(parent, array, marker = null) {
  for (let i = 0, len = array.length; i < len; i++) parent.insertBefore(array[i], marker);
}
function cleanChildren(parent, current, marker, replacement) {
  if (marker === undefined) return (parent.textContent = "");
  const node = replacement || document.createTextNode("");
  if (current.length) {
    let inserted = false;
    for (let i = current.length - 1; i >= 0; i--) {
      const el = current[i];
      if (node !== el) {
        const isParent = el.parentNode === parent;
        if (!inserted && !i)
          isParent ? parent.replaceChild(node, el) : parent.insertBefore(node, marker);
        else isParent && el.remove();
      } else inserted = true;
    }
  } else parent.insertBefore(node, marker);
  return [node];
}

const test = `import test from '.?raw'
import { createRenderEffect, createSignal, For, Show, type Component } from 'solid-js'
import { render } from 'solid-js/web'
import 'tm-textarea'
import { setCDN } from 'tm-textarea/cdn'
import { TmTextarea } from 'tm-textarea/solid'
import { Grammar, grammars, Theme, themes } from 'tm-textarea/tm'
import './index.css'
import tsx from './tsx.json?url'

setCDN((type, id) => {
  switch (type) {
    case 'theme':
      return \`https://esm.sh/tm-themes/themes/\${id}.json\`
    case 'grammar':
      return id === 'tsx' ? tsx : \`https://esm.sh/tm-grammars/grammars/\${id}.json\`
    case 'oniguruma':
      return \`https://esm.sh/vscode-oniguruma/release/onig.wasm\`
  }
})

const App: Component = () => {
  const [mode, setMode] = createSignal<'custom-element' | 'solid'>('custom-element')
  const [theme, setCurrentThemeName] = createSignal<Theme>('light-plus')
  const [grammar, setCurrentLanguageName] = createSignal<Grammar>('tsx')

  const [fontSize, setFontSize] = createSignal(10)
  const [padding, setPadding] = createSignal(20)
  const [editable, setEditable] = createSignal(true)
  const [lineNumbers, setLineNumbers] = createSignal(true)

  const [LOC, setLOC] = createSignal(10_000)
  const [value, setValue] = createSignal<string>(null!)

  createRenderEffect(() => {
    setValue(loopLines(test, LOC()))
  })

  function loopLines(input: string, lineCount: number): string {
    const lines = input.split('\\n')
    const totalLines = lines.length
    let result = ''

    for (let i = 0; i < lineCount; i++) {
      result += lines[i % totalLines] + '\\n'
    }

    return result.trim() // Trim to remove the trailing newline
  }

  return (
    <div class="app">
      <div class="side-panel">
        <h1>Tm Textarea</h1>
        <footer>
          <div>
            <label for="mode">mode</label>
            <button
              id="mode"
              onClick={e => {
                setMode(mode => (mode === 'custom-element' ? 'solid' : 'custom-element'))
              }}
            >
              {mode()}
            </button>
          </div>
          <br />
          <div>
            <label for="theme">themes</label>
            <select
              id="theme"
              value={theme()}
              onInput={e => setCurrentThemeName(e.currentTarget.value as Theme)}
            >
              <For each={themes}>{theme => <option>{theme}</option>}</For>
            </select>
          </div>
          <div>
            <label for="lang">languages</label>
            <select
              id="lang"
              value={grammar()}
              onInput={e => setCurrentLanguageName(e.currentTarget.value as Grammar)}
            >
              <For each={grammars}>{grammar => <option>{grammar}</option>}</For>
            </select>
          </div>
          <br />
          <div>
            <label for="LOC">LOC</label>
            <input
              id="LOC"
              type="number"
              value={LOC()}
              onInput={e => setLOC(+e.currentTarget.value)}
            />
          </div>

          <div>
            <label for="padding">padding</label>
            <input
              id="padding"
              type="number"
              onInput={e => setPadding(+e.currentTarget.value)}
              value={padding()}
            />
          </div>
          <div>
            <label for="font-size">font-size</label>
            <input
              id="font-size"
              type="number"
              onInput={e => setFontSize(+e.currentTarget.value)}
              value={fontSize()}
            />
          </div>
          <div>
            <label for="line-numbers">Line Numbers</label>
            <button
              id="line-numbers"
              onClick={e => {
                setLineNumbers(bool => !bool)
              }}
            >
              {lineNumbers() ? 'enabled' : 'disabled'}
            </button>
          </div>
          <div>
            <label for="editable">editable</label>
            <button
              id="editable"
              onClick={e => {
                setEditable(bool => !bool)
              }}
            >
              {editable() ? 'enabled' : 'disabled'}
            </button>
          </div>
        </footer>
      </div>
      <main>
        <Show
          when={mode() === 'custom-element'}
          fallback={
            <TmTextarea
              value={value()}
              grammar={grammar()}
              theme={theme()}
              editable={editable()}
              style={{
                padding: \`\${padding()}px\`,
              }}
              class={lineNumbers() ? 'line-numbers tm-textarea' : 'tm-textarea'}
              onInput={e => setValue(e.currentTarget.value)}
            />
          }
        >
          <tm-textarea
            value={value()}
            grammar={grammar()}
            theme={theme()}
            editable={editable()}
            style={{
              padding: \`\${padding()}px\`,
            }}
            class={lineNumbers() ? 'line-numbers tm-textarea' : 'tm-textarea'}
            onInput={e => setValue(e.currentTarget.value)}
          />
        </Show>
      </main>
    </div>
  )
}

export default App

render(() => <App />, document.getElementById('root')!)
`;

/**
 * NOTE: Experimental
 *
 * Create a stoppable effect.
 *
 * ```js
 * const effect = createStoppableEffect(() => {...})
 *
 * // ...later, stop the effect from running again.
 * effect.stop()
 * ```
 *
 * Note, this is experimental because when inside of a parent reactive context
 * that is long-lived (f.e. for life time of the app), each new effect created
 * with this and subsequently stopped will stick around and not be GC'd until
 * the parent context is cleaned up (which could be never).
 *
 * Stopped effects will currently only be GC'd freely when they are created
 * outside of a reactive context.
 */
function createStoppableEffect(fn) {
  const [running, setRunning] = createSignal(true);
  createEffect(() => running() && fn());
  return {
    stop: () => setRunning(false),
    resume: () => setRunning(true)
  };
}

/**
 * @class Effectful -
 *
 * `mixin`
 *
 * Create Solid.js effects using `this.createEffect(fn)` and easily stop them
 * all by calling `this.stopEffects()`.
 *
 * Example:
 *
 * ```js
 * import {reactive, signal} from 'classy-solid'
 * import {foo} from 'somewhere'
 * import {bar} from 'elsewhere'
 *
 * class MyClass extends Effectful(BaseClass) {
 *   constructor() {
 *     super()
 *
 *     // Log `foo` and `bar` any time either of them change.
 *     this.createEffect(() => {
 *       console.log('foo, bar:', foo(), bar())
 *     })
 *
 *     // Log only `bar` any time it changes.
 *     this.createEffect(() => {
 *       console.log('bar:', bar())
 *     })
 *   }
 *
 *   dispose() {
 *     // Later, stop both of the effects.
 *     this.stopEffects()
 *   }
 * }
 * ```
 */
function Effectful(Base) {
  return class Effectful extends Base {
    #effects = new Set();

    /**
     * Create a Solid.js effect. The difference from regular
     * `createEffect()` is that `this` tracks the effects created, so that
     * they can all be stopped with `this.stopEffects()`.
     *
     * Effects can also be stopped or resumed individually:
     *
     * ```js
     * const effect1 = this.createEffect(() => {...})
     * const effect2 = this.createEffect(() => {...})
     *
     * // ...later
     * effect1.stop()
     *
     * // ...later
     * effect1.resume()
     * ```
     */
    createEffect(fn) {
      this.#createEffect2(fn); // works with nesting, without leaks
    }

    /**
     * Stop all of the effects that were created.
     */
    stopEffects() {
      this.#stopEffects2();
    }

    // Method 1 //////////////////////////////////////////
    // Works fine when not in a parent context, or else currently leaks or has the above mentioned bug while a parent exists.

    #createEffect1(fn) {
      let effect = null;
      effect = createStoppableEffect(() => {
        if (effect) this.#effects.add(effect);
        // nest the user's effect so that if it re-runs a lot it is not deleting/adding from/to our #effects Set a lot.
        createEffect(fn);
        onCleanup(() => this.#effects.delete(effect));
      });
      this.#effects.add(effect);
    }
    #stopEffects1() {
      for (const effect of this.#effects) effect.stop();
    }

    // Method 2 //////////////////////////////////////////
    // Works, with nesting, no leaks.

    #owner = null;
    #dispose = null;
    #createEffect2(fn) {
      if (!this.#owner) {
        createRoot(dispose => {
          this.#owner = getOwner();
          this.#dispose = dispose;
          this.#createEffect2(fn);
        });
      } else {
        let owner = getOwner();
        while (owner && owner !== this.#owner) owner = owner?.owner ?? null;

        // this.#owner found in the parents of current owner therefore,
        // run with current nested owner like a regular solid
        // createEffect()
        if (owner === this.#owner) return createEffect(fn);

        // this.#owner wasn't found on the parent owners
        // run with this.#owner
        runWithOwner(this.#owner, () => createEffect(fn));
      }
    }
    #stopEffects2() {
      this.#dispose?.();
    }
  };
}

/** Like Object.getOwnPropertyDescriptor, but looks up the prototype chain for the descriptor. */
function getInheritedDescriptor(obj, key) {
    let currentProto = obj;
    let descriptor;
    while (currentProto) {
        descriptor = Object.getOwnPropertyDescriptor(currentProto, key);
        if (descriptor) {
            descriptor.owner = currentProto;
            return descriptor;
        }
        currentProto = currentProto.__proto__;
    }
    return void 0;
}

const signalifiedProps = new WeakMap();

/**
 * Convert properties on an object into Solid signal-backed properties.
 *
 * There are two ways to use this: either by defining which properties to
 * convert to signal-backed properties by providing an array as property names
 * in the second arg, which is useful on plain objects, or by passing in `this`
 * and `this.constructor` within the `constructor` of a class that has
 * properties decorated with `@signal`.
 *
 * Example with a class:
 *
 * ```js
 * import {signalify} from 'classy-solid'
 * import {createEffect} from 'solid-js'
 *
 * class Counter {
 *   count = 0
 *
 *   constructor() {
 *     signalify(this, 'count')
 *     setInterval(() => this.count++, 1000)
 *   }
 * }
 *
 * const counter = new Counter
 *
 * createEffect(() => {
 *   console.log('count:', counter.count)
 * })
 * ```
 *
 * Example with a plain object:
 *
 * ```js
 * import {signalify} from 'classy-solid'
 * import {createEffect} from 'solid-js'
 *
 * const counter = {
 *   count: 0
 * }
 *
 * signalify(counter, 'count')
 * setInterval(() => counter.count++, 1000)
 *
 * createEffect(() => {
 *   console.log('count:', counter.count)
 * })
 * ```
 */

function signalify(obj, ...props) {
  // We cast from PropertyKey[] to PropKey[] because numbers can't actually be keys, only string | symbol.
  const _props = props.length ? props : Object.keys(obj).concat(Object.getOwnPropertySymbols(obj));
  for (const prop of _props) createSignalAccessor$1(obj, prop);
  return obj;
}
let gotCreateSignalAccessor = false;

/**
 * This ensures that `createSignalAccessor` is kept internal to classy-solid only.
 */
function getCreateSignalAccessor() {
  if (gotCreateSignalAccessor) throw new Error('Export "createSignalAccessor" is internal to classy-solid only.');
  gotCreateSignalAccessor = true;
  return createSignalAccessor$1;
}

// propsSetAtLeastOnce is a Set that tracks which reactive properties have been
// set at least once.
const propsSetAtLeastOnce = new WeakMap();

// @lume/element uses this to detect if a reactive prop has been set, and if so
// will not overwrite the value with any pre-existing value from custom element
// pre-upgrade.
function __isPropSetAtLeastOnce(instance, prop) {
  return !!propsSetAtLeastOnce.get(instance)?.has(prop);
}
function trackPropSetAtLeastOnce(instance, prop) {
  if (!propsSetAtLeastOnce.has(instance)) propsSetAtLeastOnce.set(instance, new Set());
  propsSetAtLeastOnce.get(instance).add(prop);
}
const isSignalGetter = new WeakSet();
function createSignalAccessor$1(obj, prop,
// Untrack here to be extra safe this doesn't count as a dependency and
// cause a reactivity loop.
initialVal = untrack(() => obj[prop]),
// If an object already has a particular signalified property, override it
// with a new one anyway (useful for maintaining consistency with class
// inheritance where class fields always override fields from base classes
// due to their [[Define]] semantics). False is a good default for signalify()
// usage where someone is augmenting an existing object, but true is more
// useful with usage of @signal on class fields.
//
// Note that if @signal were to specify this as false, it would cause
// @signal-decorated subclass fields to override base class
// @signal-decorated fields with a new value descriptor but without
// signalifiying the field, effectively disabling reactivity, which is a bug
// (a field decorated with @signal *must* be reactive). The test named
// "maintains reactivity in subclass overridden fields" was added to ensure
// that the subclass use case works.
override = false) {
  if (!override && signalifiedProps.get(obj)?.has(prop)) return;

  // Special case for Solid proxies: if the object is already a solid proxy,
  // all properties are already reactive, no need to signalify.
  // @ts-expect-error special indexed access
  const proxy = obj[$PROXY];
  if (proxy) return;
  let descriptor = getInheritedDescriptor(obj, prop);
  let originalGet;
  let originalSet;
  if (descriptor) {
    originalGet = descriptor.get;
    originalSet = descriptor.set;

    // Even if override is true, if we have a signal accessor, there's no
    // need to replace it with another signal accessor. We only need to
    // override when the current descriptor is not a signal accessor.
    // TODO this needs tests.
    if (originalGet && isSignalGetter.has(originalGet)) return;
    if (originalGet || originalSet) {
      // reactivity requires both
      if (!originalGet || !originalSet) {
        console.warn(`The \`@signal\` decorator was used on an accessor named "${prop.toString()}" which had a getter or a setter, but not both. Reactivity on accessors works only when accessors have both get and set. In this case the decorator does not do anything.`);
        return;
      }
      delete descriptor.get;
      delete descriptor.set;
    } else {
      // If there was a value descriptor, trust it as the source of truth
      // for initialVal. For example, if the user class modifies the value
      // after the initializer, it will have a different value than what
      // we tracked from the initializer.
      initialVal = descriptor.value;

      // if it isn't writable, we don't need to make a reactive variable because
      // the value won't change
      if (!descriptor.writable) {
        console.warn(`The \`@signal\` decorator was used on a property named "${prop.toString()}" that is not writable. Reactivity is not enabled for non-writable properties.`);
        return;
      }
      delete descriptor.value;
      delete descriptor.writable;
    }
  }
  const s = createSignal(initialVal, {
    equals: false
  });
  descriptor = {
    configurable: true,
    enumerable: true,
    ...descriptor,
    get: originalGet ? function () {
      s[0](); // read
      return originalGet.call(this);
    } : function () {
      return s[0](); // read
    },

    set: originalSet ? function (newValue) {
      originalSet.call(this, newValue);
      trackPropSetAtLeastOnce(this, prop);

      // write
      if (typeof newValue === 'function') s[1](() => newValue);else s[1](newValue);
    } : function (newValue) {
      trackPropSetAtLeastOnce(this, prop);

      // write
      if (typeof newValue === 'function') s[1](() => newValue);else s[1](newValue);
    }
  };
  isSignalGetter.add(descriptor.get);
  Object.defineProperty(obj, prop, descriptor);
  if (!signalifiedProps.has(obj)) signalifiedProps.set(obj, new Set());
  signalifiedProps.get(obj).add(prop);
}

let propsToSignalify = new Map();
let accessKey$1 = null;

/**
 * Provides a key for accessing internal APIs. If any other module tries to get
 * this, an error will be thrown, and signal and reactive decorators will not
 * work.
 */
function getKey() {
  if (accessKey$1) throw new Error('Attempted use of classy-solid internals.');
  accessKey$1 = Symbol();
  return accessKey$1;
}

/**
 * This function provides propsToSignalify to only one external module
 * (reactive.ts). The purpose of this is to keep the API private for reactive.ts
 * only, otherwise an error will be thrown that breaks signal/reactive
 * functionality.
 */
function getPropsToSignalify(key) {
  if (key !== accessKey$1) throw new Error('Attempted use of classy-solid internals.');
  return propsToSignalify;
}

/**
 * Only the module that first gets the key can call this function (it should be
 * reactive.ts)
 */
function resetPropsToSignalify(key) {
  if (key !== accessKey$1) throw new Error('Attempted use of classy-solid internals.');
  propsToSignalify = new Map();
}
function isMemberDecorator(context) {
  return !!('private' in context);
}

/**
 * @decorator
 * Decorate properties of a class with `@signal` to back them with Solid
 * signals, making them reactive. Don't forget that the class in which `@signal`
 * is used must be decorated with `@reactive`.
 *
 * Related: See the Solid.js `createSignal` API for creating signals.
 *
 * Example:
 *
 * ```js
 * import {reactive, signal} from 'classy-solid'
 * import {createEffect} from 'solid-js'
 *
 * ⁣@reactive
 * class Counter {
 *   ⁣@signal count = 0
 *
 *   constructor() {
 *     setInterval(() => this.count++, 1000)
 *   }
 * }
 *
 * const counter = new Counter
 *
 * createEffect(() => {
 *   console.log('count:', counter.count)
 * })
 * ```
 */
function signal(_, context) {
  const {
    kind,
    name
  } = context;
  const props = propsToSignalify;
  if (isMemberDecorator(context)) {
    if (context.private) throw new Error('@signal is not supported on private fields yet.');
    if (context.static) throw new Error('@signal is not supported on static fields yet.');
  }
  if (kind === 'field') {
    props.set(name, {
      initialValue: undefined
    });
    return function (initialValue) {
      props.get(name).initialValue = initialValue;
      return initialValue;
    };
  } else if (kind === 'getter' || kind === 'setter') {
    props.set(name, {
      initialValue: undefined
    });
  } else {
    throw new Error('The @signal decorator is only for use on fields, getters, and setters. Auto accessor support is coming next if there is demand for it.');
  }

  // @prod-prune
  queueReactiveDecoratorChecker(props);
}
let checkerQueued = false;

/**
 * This throws an error in some cases of an end dev forgetting to decorate a
 * class with `@reactive` if they used `@signal` on that class's fields.
 *
 * This doesn't work all the time, only when the very last class decorated is
 * missing @reactive, but something is better than nothing. There's another
 * similar check performed in the `@reactive` decorator.
 */
function queueReactiveDecoratorChecker(props) {
  if (checkerQueued) return;
  checkerQueued = true;
  queueMicrotask(() => {
    checkerQueued = false;

    // If the refs are still equal, it means @reactive did not run (forgot
    // to decorate a class that uses @signal with @reactive).
    if (props === propsToSignalify) {
      throw new Error(
      // Array.from(map.keys()) instead of [...map.keys()] because it breaks in Oculus browser.
      `Stray @signal-decorated properties detected: ${Array.from(props.keys()).join(', ')}. Did you forget to use the \`@reactive\` decorator on a class that has properties decorated with \`@signal\`?`);
    }
  });
}

/**
 * Access key for classy-solid private internal APIs.
 */
const accessKey = getKey();
const createSignalAccessor = getCreateSignalAccessor();
const hasOwnProperty = Object.prototype.hasOwnProperty;

/**
 * A decorator that makes a class reactive, allowing it have properties
 * decorated with `@signal` to make those properties reactive Solid signals.
 *
 * Example:
 *
 * ```js
 * import {reactive, signal} from 'classy-solid'
 * import {createEffect} from 'solid-js'
 *
 * ⁣@reactive
 * class Counter {
 *   ⁣@signal count = 0
 *
 *   constructor() {
 *     setInterval(() => this.count++, 1000)
 *   }
 * }
 *
 * const counter = new Counter
 *
 * createEffect(() => {
 *   console.log('count:', counter.count)
 * })
 * ```
 */
function reactive(value, context) {
  // context may be undefined when unsing reactive() without decorators
  if (typeof value !== 'function' || context && context.kind !== 'class') throw new TypeError('The @reactive decorator is only for use on classes.');
  const Class = value;
  const signalProps = getPropsToSignalify(accessKey);

  // For the current class decorated with @reactive, we reset the map, so that
  // for the next class decorated with @reactive we track only that next
  // class's properties that were decorated with @signal. We do this because
  // field decorators do not have access to the class or its prototype.
  //
  // In the future maybe we can use decorator metadata for this
  // (https://github.com/tc39/proposal-decorator-metadata)?
  resetPropsToSignalify(accessKey);
  class ReactiveDecorator extends Class {
    constructor(...args) {
      let instance;

      // Ensure that if we're in an effect that `new`ing a class does not
      // track signal reads, otherwise we'll get into an infinite loop. If
      // someone want to trigger an effect based on properties of the
      // `new`ed instance, they can explicitly read the properties
      // themselves in the effect, making their intent clear.
      if (getListener()) untrack(() => instance = Reflect.construct(Class, args, new.target)); // super()
      else super(...args), instance = this;
      for (const [prop, {
        initialValue
      }] of signalProps) {
        // @prod-prune
        if (!(hasOwnProperty.call(instance, prop) || hasOwnProperty.call(Class.prototype, prop))) {
          throw new Error(`Property "${prop.toString()}" not found on instance of class decorated with \`@reactive\`. Did you forget to use the \`@reactive\` decorator on one of your classes that has a "${prop.toString()}" property decorated with \`@signal\`?`);
        }

        // For now at least, we always override like class fields with
        // [[Define]] semantics. Perhaps when @signal is used on a
        // getter/setter, we should not override in that case, but patch
        // the prototype getter/setter (that'll be a bit of work to
        // implement though).
        const override = true;
        createSignalAccessor(instance, prop, initialValue, override);
      }
      return instance;
    }
  }
  return ReactiveDecorator;
}

var _a;
// TODO `templateMode: 'append' | 'replace'`, which allows a subclass to specify
// if template content replaces the content of `root`, or is appended to `root`.
let ctor;
const HTMLElement = globalThis.HTMLElement ??
    class HTMLElement {
        constructor() {
            throw new Error("@lume/element needs a DOM to operate with! If this code is running during server-side rendering, it means your app is trying to instantiate elements when it shouldn't be, and should be refactored to avoid doing that when no DOM is present.");
        }
    };
// TODO Make LumeElement `abstract`
class LumeElement extends Effectful(HTMLElement) {
    /**
     * The default tag name of the elements this class instantiates. When using
     * the `@element` decorator, this property will be set to the value defined
     * by the decorator.
     */
    static elementName = '';
    /**
     * Define this class for the given element `name`, or using its default name
     * (`elementName`) if no `name` given. Defaults to using the global
     * `customElements` registry unless another registry is provided (for
     * example a ShadowRoot-scoped registry).
     *
     * If a `name` is given, then the class will be extended with an empty
     * subclass so that a new class is used for each new name, because otherwise
     * a CustomElementRegistry does not allow the same exact class to be used
     * more than once regardless of the name.
     *
     * @returns Returns the defined element class, which is only going to be a
     * different subclass of the class this is called on if passing in a custom
     * `name`, otherwise returns the same class this is called on.
     */
    static defineElement(name, registry = customElements) {
        if (!name) {
            name = this.elementName;
            if (registry.get(name)) {
                console.warn(`defineElement(): An element class was already defined for tag name ${name}.`);
                return this;
            }
            registry.define(name, this);
            return this;
        }
        else {
            if (registry.get(name)) {
                console.warn(`defineElement(): An element class was already defined for tag name ${name}.`);
                return this;
            }
            else {
                // Allow the same element to be defined more than once using
                // alternative names.
                const Class = class extends this {
                };
                Class.elementName = name;
                registry.define(name, Class);
                return Class;
            }
        }
    }
    /** Non-decorator users can use this to specify attributes, which automatically map to reactive properties. */
    static observedAttributes;
    #handleInitialPropertyValuesIfAny() {
        // We need to delete initial value-descriptor properties (if they exist)
        // and store the initial values in the storage for our @signal property
        // accessors.
        //
        // If we don't do this, then DOM APIs like cloneNode will create our
        // node without first upgrading it, and then if someone sets a property
        // (while our reactive accessors are not yet present in the class
        // prototype) it means those values will be set as value descriptor
        // properties on the instance instead of interacting with our accessors
        // (i.e. the new properties will override our accessors that the
        // instance will gain on its prototype chain once the upgrade process
        // places our class prototype in the instance's prototype chain).
        //
        // This can also happen if we set properties on an element that isn't
        // upgraded into a custom element yet, and thus will not yet have our
        // accessors.
        //
        // Assumption: any enumerable own props must've been set on the
        // element before it was upgraded. Builtin DOM properties are
        // not enumerable.
        const preUpgradeKeys = Object.keys(this);
        this._preUpgradeValues = new Map();
        for (const propName of preUpgradeKeys) {
            const descriptor = Object.getOwnPropertyDescriptor(this, propName);
            // Handle only value descriptors.
            if ('value' in descriptor) {
                // Delete the pre-upgrade value descriptor (1/2)...
                delete this[propName];
                // The @element decorator reads this, and the class finisher
                // will set pre-upgrade values.
                this._preUpgradeValues.set(propName, descriptor.value);
                // NOTE, for classes not decorated with @element, deferring
                // allows preexisting preupgrade values to be handled *after*
                // class fields have been set during Custom Element upgrade
                // construction (otherwise those class fields would override the
                // preupgrade values we're trying to assign here).
                // TODO Once decorators are out everywhere, deprecate
                // non-decorator usage, and eventually remove code intended for
                // non-decorator usage such as this.
                queueMicrotask(() => {
                    const propSetAtLeastOnce = __isPropSetAtLeastOnce(this, propName);
                    // ... (2/2) and re-assign the value so that it goes through
                    // a @signal accessor that got defined, or through an
                    // inherited accessor that the preupgrade value shadowed.
                    //
                    // If the property has been set between the time LumeElement
                    // constructor ran and the deferred microtask, then we don't
                    // overwrite the property's value with the pre-upgrade value
                    // because it has already been intentionally set to a
                    // desired value post-construction.
                    // (NOTE: Avoid setting properties in constructors because
                    // that will set the signals at least once. Instead,
                    // override with a new @attribute or @signal class field.)
                    //
                    // AND we handle inherited props or signal props only
                    // (because that means there may be an accessor that needs
                    // the value to be passed in). The @element decorator otherwise
                    // handles non-inherited props before construction
                    // finishes. {{
                    if (propSetAtLeastOnce)
                        return;
                    const inheritsProperty = propName in this.__proto__;
                    if (inheritsProperty)
                        this[propName] = descriptor.value;
                    // }}
                });
            }
        }
    }
    // This property MUST be defined before any other non-static non-declared
    // class properties so that the initializer runs before any other properties
    // are defined, in order to detect and handle instance properties that
    // already pre-exist from custom element pre-upgrade time.
    // TODO Should we handle initial attributes too?
    // @ts-expect-error unused
    #___init___ = this.#handleInitialPropertyValuesIfAny();
    /**
     * When `true`, the custom element will have a `ShadowRoot`. Set to `false`
     * to not use a `ShadowRoot`. When `false`, styles will not be scoped via
     * the built-in `ShadowRoot` scoping mechanism, but by a much more simple
     * shared style sheet placed at the nearest root node, with `:host`
     * selectors converted to tag names.
     */
    hasShadow = true;
    __root = null;
    /**
     * Subclasses can override this to provide an alternate Node to render into
     * (f.e. a subclass can `return this` to render into itself instead of
     * making a root) regardless of the value of `hasShadow`.
     */
    get root() {
        if (!this.hasShadow)
            return this;
        if (this.__root)
            return this.__root;
        if (this.shadowRoot)
            return (this.__root = this.shadowRoot);
        // TODO use `this.attachInternals()` (ElementInternals API) to get the root instead.
        return (this.__root = this.attachShadow({ mode: 'open' }));
    }
    set root(v) {
        if (!this.hasShadow)
            throw new Error('Can not set root, element.hasShadow is false.');
        // @prod-prune
        if (this.__root || this.shadowRoot)
            throw new Error('Element root can only be set once if there is no ShadowRoot.');
        this.__root = v;
    }
    /**
     * Define which `Node` to append style sheets to when `hasShadow` is `true`.
     * Defaults to the `this.root`, which in turn defaults to the element's
     * `ShadowRoot`.  When `hasShadow` is `true`, an alternate `styleRoot` is
     * sometimes needed for styles to be appended elsewhere than the root. For
     * example, return some other `Node` within the root to append styles to.
     * This is ignored if `hasShadow` is `false`.
     *
     * This can be useful for fixing issues where the default append of a style
     * sheet into the `ShadowRoot` conflicts with how DOM is created in
     * `template` (f.e.  if the user's DOM creation in `template` clears the
     * `ShadowRoot` content, or etc, then we want to place the stylesheet
     * somewhere else).
     */
    get styleRoot() {
        return this.root;
    }
    attachShadow(options) {
        if (this.__root)
            console.warn('Element already has a root defined.');
        return (this.__root = super.attachShadow(options));
    }
    #disposeTemplate;
    connectedCallback() {
        const template = this.template;
        if (template)
            this.#disposeTemplate = render(typeof template === 'function' ? template.bind(this) : () => template, this.root);
        this.#setStyle();
    }
    disconnectedCallback() {
        this.stopEffects();
        this.#disposeTemplate?.();
        this.#cleanupStyle();
    }
    static __styleRootNodeRefCountPerTagName = new WeakMap();
    #styleRootNode = null;
    #defaultHostStyle = (hostSelector) => /*css*/ `${hostSelector} {
		display: block;
	}`;
    static __elementId = 0;
    #id = _a.__elementId++;
    #dynamicStyle = null;
    #setStyle() {
        ctor = this.constructor;
        const staticCSS = typeof ctor.css === 'function' ? (ctor.css = ctor.css()) : ctor.css || '';
        const instanceCSS = typeof this.css === 'function' ? this.css() : this.css || '';
        if (this.hasShadow) {
            const hostSelector = ':host';
            const staticStyle = document.createElement('style');
            staticStyle.innerHTML = `
				${this.#defaultHostStyle(hostSelector)}
				${staticCSS}
				${instanceCSS}
			`;
            // If this element has a shadow root, put the style there. This is the
            // standard way to scope styles to a component.
            this.styleRoot.appendChild(staticStyle);
            // TODO use adoptedStyleSheets when that is supported by FF and Safari
        }
        else {
            // When this element doesn't have a shadow root, then we want to append the
            // style only once to the rootNode where it lives (a ShadoowRoot or
            // Document). If there are multiple of this same element in the rootNode,
            // then the style will be added only once and will style all the elements
            // in the same rootNode.
            // Because we're connected, getRootNode will return either the
            // Document, or a ShadowRoot.
            const rootNode = this.getRootNode();
            this.#styleRootNode = rootNode === document ? document.head : rootNode;
            let refCountPerTagName = _a.__styleRootNodeRefCountPerTagName.get(this.#styleRootNode);
            if (!refCountPerTagName)
                _a.__styleRootNodeRefCountPerTagName.set(this.#styleRootNode, (refCountPerTagName = {}));
            const refCount = refCountPerTagName[this.tagName] || 0;
            refCountPerTagName[this.tagName] = refCount + 1;
            if (refCount === 0) {
                const hostSelector = this.tagName.toLowerCase();
                const staticStyle = document.createElement('style');
                staticStyle.innerHTML = `
					${this.#defaultHostStyle(hostSelector)}
					${staticCSS ? staticCSS.replaceAll(':host', hostSelector) : staticCSS}
				`;
                staticStyle.id = this.tagName.toLowerCase();
                this.#styleRootNode.appendChild(staticStyle);
            }
            if (instanceCSS) {
                // For dynamic per-instance styles, make one style element per
                // element instance so it contains that element's unique styles,
                // associated to a unique attribute selector.
                const id = this.tagName.toLowerCase() + '-' + this.#id;
                // Add the unique attribute that the style selector will target.
                this.setAttribute(id, '');
                // TODO Instead of creating one style element per custom
                // element, we can add the styles to a single style element. We
                // can use the CSS OM instead of innerHTML to make it faster
                // (but innerHTML is nice for dev mode because it shows the
                // content in the DOM when looking in element inspector, so
                // allow option for both).
                const instanceStyle = (this.#dynamicStyle = document.createElement('style'));
                instanceStyle.id = id;
                instanceStyle.innerHTML = instanceCSS.replaceAll(':host', `[${id}]`);
                const rootNode = this.getRootNode();
                this.#styleRootNode = rootNode === document ? document.head : rootNode;
                this.#styleRootNode.appendChild(instanceStyle);
            }
        }
    }
    #cleanupStyle() {
        do {
            if (this.hasShadow)
                break;
            const refCountPerTagName = _a.__styleRootNodeRefCountPerTagName.get(this.#styleRootNode);
            if (!refCountPerTagName)
                break;
            let refCount = refCountPerTagName[this.tagName];
            if (refCount === undefined)
                break;
            refCountPerTagName[this.tagName] = --refCount;
            if (refCount === 0) {
                delete refCountPerTagName[this.tagName];
                // TODO PERF Improve performance by saving the style
                // instance on a static var, instead of querying for it.
                const style = this.#styleRootNode.querySelector('#' + this.tagName);
                style?.remove();
            }
        } while (false);
        if (this.#dynamicStyle)
            this.#dynamicStyle.remove();
    }
    // not used currently, but we'll leave this here so that child classes can
    // call super, and that way we can add an implementation later when needed.
    adoptedCallback() { }
}
_a = LumeElement;

// Until decorators land natively, we need this shim so that we can use
// decorator metadata. https://github.com/microsoft/TypeScript/issues/53461
// @ts-expect-error readonly
Symbol.metadata ??= Symbol.for('Symbol.metadata');

/**
 * This is an identity "template string tag function", which when applied to a
 * template string returns the equivalent of not having used a template tag on
 * a template string to begin with.
 *
 * For example, The following two strings are equivalent:
 *
 * ```js
 * const number = 42
 * const string1 = `meaning of life: ${number}`
 * const string2 = identityTemplateTag`meaning of life: ${number}`
 * ```
 *
 * This can be useful when assigning it to variables like `css` or `html` in
 * order to trigger syntax checking and highlighting inside template strings
 * without actually doing anything to the string (a no-op).
 */
function camelCaseToDash(str) {
    return str.replace(/([a-zA-Z])(?=[A-Z])/g, '$1-').toLowerCase();
}
function defineProp(obj, prop, value) {
    Object.defineProperty(obj, prop, {
        value,
        writable: true,
        configurable: true,
        enumerable: true,
    });
}
// EXAMPLES
// type foo0 = JoinToCamelCase<'fooBarBaz'> // Becomes "foobabaz"
// type foo3 = JoinToCamelCase<'foo-bar-baz'> // Becomes "fooBarBaz"
// type foo5 = JoinToCamelCase<'foo bar baz', ' '> // Becomes "fooBarBaz"
// type foo6 = JoinToCamelCase<'foo_bar_baz', '_'> // Becomes "fooBarBaz"
// type foo14 = JoinToCamelCase<'foo:bar:baz', ':'> // Becomes "fooBarBaz"
// type foo4 = JoinToCamelCase<'foobarbaz'> // the same
// type foo7 = SplitCamelCase<'fooBar'> // Becomes "foo-bar"
// type foo12 = SplitCamelCase<'fooBar', '_'> // Becomes "foo_bar"
// type foo13 = SplitCamelCase<'fooBar', ' '> // Becomes "foo bar"
// type foo11 = SplitCamelCase<'foo-bar'> // the same
// type foo8 = SplitCamelCase<'foo bar'> // the same
// type foo9 = SplitCamelCase<'foo_bar'> // the same
// type foo10 = SplitCamelCase<'foobar'> // the same
// type t = Join<['foo', 'bar'], ':'> // Becomes "foo:bar"
//
// interface KebabCased {
//     "foo-bar": string;
//     foo: number;
// }
// type CamelCased = CamelCasedProps<KebabCased>;
// Becomes
// {
//    fooBar: string;
//    foo: number;
// }

const __classFinishers = [];
function attribute(handlerOrValue, context) {
    // if used as a decorator directly with no options
    if (arguments.length === 2)
        return handleAttributeDecoration(handlerOrValue, context, undefined);
    // otherwise used as a decorator factory, possibly being passed options, like `@attribute({...})`
    const handler = handlerOrValue;
    return (value, context) => handleAttributeDecoration(value, context, handler);
    // TODO throw an error for cases when @element is not used on a class with @attribute decorations, similar to classy-solid @signal/@reactive.
}
function handleAttributeDecoration(value, context, attributeHandler = {}) {
    const { kind, name, private: isPrivate, static: isStatic, metadata } = context;
    // Check only own metadata.noSignal, we don't want to use the one inherited from a base class.
    const noSignal = (Object.hasOwn(metadata, 'noSignal') && metadata.noSignal) || undefined;
    const useSignal = !noSignal?.has(name);
    if (typeof name === 'symbol')
        throw new Error('@attribute is not supported on symbol fields yet.');
    if (isPrivate)
        throw new Error('@attribute is not supported on private fields yet.');
    if (isStatic)
        throw new Error('@attribute is not supported on static fields.');
    // TODO decorate on prototype? Or decorate on instance?
    __classFinishers.push((Class) => __setUpAttribute(Class, name, attributeHandler));
    if (kind === 'field') {
        const signalInitializer = useSignal ? signal(value, context) : (v) => v;
        return function (initialValue) {
            initialValue = signalInitializer(initialValue);
            // Typically the first initializer to run for a class field (on
            // instantiation of the first instance of its class) will be our
            // source of truth for our default attribute value, but we check for
            // 'default' in attributeHandler just in case that a an attribute
            // decorator was passed an explicit default, f.e.
            // `@attribute({default: 123})`.
            if (!('default' in attributeHandler))
                attributeHandler.default = initialValue;
            return initialValue;
        };
    }
    else if (kind === 'getter' || kind === 'setter') {
        if (useSignal)
            signal(value, context);
    }
    else {
        throw new Error('@attribute is only for use on fields, getters, and setters. Auto accessor support is coming next if there is demand for it.');
    }
    return undefined; // shush TS
}
// TODO Do similar as with the following attributeChangedCallback prototype
// patch, but also with (dis)connected callbacks which can call an instance's
// template method, so users don't have to extend from the LumeElement base class.
// Extending from the LumeElement base class will be the method that non-decorator
// users must use.
function __setUpAttribute(ctor, propName, attributeHandler) {
    if (
    //
    !ctor.observedAttributes ||
        !ctor.hasOwnProperty('observedAttributes')) {
        const inheritedAttrs = ctor.__proto__.observedAttributes;
        // @prod-prune
        if (inheritedAttrs && !Array.isArray(inheritedAttrs)) {
            throw new TypeError('observedAttributes is in the wrong format. Did you forget to decorate your custom element class with the `@element` decorator?');
        }
        defineProp(ctor, 'observedAttributes', [...(inheritedAttrs || [])]);
    }
    // @prod-prune
    if (!Array.isArray(ctor.observedAttributes)) {
        throw new TypeError('observedAttributes is in the wrong format. Maybe you forgot to decorate your custom element class with the `@element` decorator.');
    }
    const attrName = camelCaseToDash(propName);
    if (!ctor.observedAttributes.includes(attrName))
        ctor.observedAttributes.push(attrName);
    mapAttributeToProp(ctor.prototype, attrName, propName, attributeHandler);
}
// TODO this stores attributes as an inheritance chain on the constructor. It'd
// be more fool-proof (not publicly exposed) to store attribute-prop mappings in
// WeakMaps, but then we'd need to implement our own inheritance
// (prototype-like) lookup for the attributes.
function mapAttributeToProp(prototype, attr, prop, attributeHandler) {
    // Only define attributeChangedCallback once.
    if (!prototype.__hasAttributeChangedCallback) {
        prototype.__hasAttributeChangedCallback = true;
        const originalAttrChanged = prototype.attributeChangedCallback;
        prototype.attributeChangedCallback = function (attr, oldVal, newVal) {
            // If the class already has an attributeChangedCallback, let is run,
            // and let it call or not call super.attributeChangedCallback.
            if (originalAttrChanged) {
                originalAttrChanged.call(this, attr, oldVal, newVal);
            }
            // Otherwise, let's not intentionally break inheritance and be sure
            // we call the super method (if it exists).
            else {
                // This is equivalent to `super.attributeChangedCallback?()`
                prototype.__proto__?.attributeChangedCallback?.call(this, attr, oldVal, newVal);
            }
            // map from attribute to property
            const prop = this.__attributesToProps && this.__attributesToProps[attr];
            if (prop) {
                const handler = prop.attributeHandler;
                // prettier-ignore
                this[prop.name] = !handler
                    ? newVal
                    : newVal === null // attribute removed
                        ? 'default' in handler
                            ? handler.default
                            : null
                        : handler.from
                            ? handler.from(newVal)
                            : newVal;
            }
        };
    }
    // Extend the current prototype's __attributesToProps object from the super
    // prototype's __attributesToProps object.
    //
    // We use inheritance here or else all classes would pile their
    // attribute-prop definitions on a shared base class (they can clash,
    // override each other willy nilly and seemingly randomly).
    if (!prototype.hasOwnProperty('__attributesToProps')) {
        // using defineProperty so that it is non-writable, non-enumerable, non-configurable
        Object.defineProperty(prototype, '__attributesToProps', {
            value: {
                __proto__: prototype.__attributesToProps || Object.prototype,
            },
        });
    }
    prototype.__attributesToProps[attr] = { name: prop, attributeHandler };
}
const toString = (str) => str;
/**
 * An attribute type for use in the object form of `static observedAttributes`
 * when not using decorators.
 *
 * Example usage without decorators:
 *
 * ```js
 * element('my-el')(
 *   class MyEl extends LumeElement {
 *     static observedAttributes = {
 *       name: attribute.string()
 *     }
 *
 *     name = "honeybun" // default value when attribute removed
 *   }
 * )
 * ```
 */
attribute.string = (() => ({ from: toString }));
/**
 * This is essentially an alias for `@attribute`. You can just use `@attribute`
 * if you want a more concise definition.
 *
 * A decorator for mapping a string-valued attribute to a JS property. All
 * attribute values get passed as-is, except for `null` (i.e. when an attribute
 * is removed) which gets converted into an empty string or the default value of
 * the class field. The handling of `null` (on attribute removed) is the only
 * difference between this and plain `@attribute`, where `@attribute` will pass
 * along `null`.
 *
 * Example decorator usage:
 *
 * ```js
 * ⁣@element('my-el')
 * class MyEl extends LumeElement {
 *   ⁣@stringAttribute color = "skyblue"
 * }
 * ```
 *
 * Example HTML attribute usage:
 *
 * ```html
 * <!-- el.color === "", because an attribute without a written value has an empty string value. -->
 * <my-el color></my-el>
 *
 * <!-- el.color === "skyblue", based on the default value defined on the class field. -->
 * <my-el></my-el>
 *
 * <!-- el.color === "deeppink" -->
 * <my-el color="deeppink"></my-el>
 *
 * <!-- el.color === "4.5" -->
 * <my-el color="4.5"></my-el>
 *
 * <!-- el.color === "any string in here" -->
 * <my-el color="any string in here"></my-el>
 * ```
 */
function stringAttribute(value, context) {
    return attribute(attribute.string())(value, context);
}
const toNumber = (str) => +str;
/**
 * An attribute type for use in the object form of `static observedAttributes`
 * when not using decorators.
 *
 * Example usage without decorators:
 *
 * ```js
 * element('my-el')(
 *   class MyEl extends LumeElement {
 *     static observedAttributes = {
 *       money: attribute.number()
 *     }
 *
 *     money = 1000 // default value when attribute removed
 *   }
 * )
 * ```
 */
attribute.number = (() => ({ from: toNumber }));
const toBoolean = (str) => str !== 'false';
/**
 * An attribute type for use in the object form of `static observedAttributes`
 * when not using decorators.
 *
 * Example usage without decorators:
 *
 * ```js
 * element('my-el')(
 *   class MyEl extends LumeElement {
 *     static observedAttributes = {
 *       hasCash: attribute.boolean()
 *     }
 *
 *     hasCash = true // default value when attribute removed
 *   }
 * )
 * ```
 */
attribute.boolean = (() => ({ from: toBoolean }));
/**
 * A decorator for mapping a boolean attribute to a JS property. The string
 * value of the attribute will be converted into a boolean value on the JS
 * property. A string value of `"false"` and a value of `null` (attribute
 * removed) will be converted into a `false` value on the JS property. All other
 * attribute values (strings) will be converted into `true`.
 *
 * Example decorator usage:
 *
 * ```js
 * ⁣@element('my-el')
 * class MyEl extends LumeElement {
 *   ⁣@booleanAttribute hasMoney = true
 *   ⁣@booleanAttribute excited = false
 * }
 * ```
 *
 * Example HTML attribute usage:
 *
 * ```html
 * <!-- el.hasMoney === true, el.excited === true -->
 * <my-el has-money excited></my-el>
 *
 * <!-- el.hasMoney === true, el.excited === false, based on the default values defined
 * on the class fields. Start the a class field with a value of `false` to have
 * behavior similar to traditional DOM boolean attributes where the presence of
 * the attribute determines the boolean value of its respective JS property. -->
 * <my-el></my-el>
 *
 * <!-- el.hasMoney === false, el.excited === true -->
 * <my-el has-money="false"></my-el>
 *
 * <!-- el.hasMoney === true, el.excited === true -->
 * <my-el has-money="true"></my-el>
 *
 * <!-- el.hasMoney === true, el.excited === true -->
 * <my-el has-money=""></my-el>
 *
 * <!-- el.hasMoney === true, el.excited === true -->
 * <my-el has-money="blahblah"></my-el>
 * ```
 */
function booleanAttribute(value, context) {
    return attribute(attribute.boolean())(value, context);
}

function element(tagNameOrClass, autoDefineOrContext) {
    let tagName = '';
    let autoDefine = !!(true);
    // when called as a decorator factory, f.e. `@element('foo-bar') class MyEl ...` or `element('my-el')(class MyEl ...)`
    {
        tagName = tagNameOrClass;
        return (Class, context) => {
            return applyElementDecoration(Class, context, tagName, autoDefine);
        };
    }
}
function applyElementDecoration(Class, context, tagName, autoDefine) {
    if (typeof Class !== 'function' || (context && context.kind !== 'class'))
        throw new Error('@element is only for use on classes.');
    const { metadata = {} } = context ?? {}; // context may be undefined with plain-JS element() usage.
    // Check only own metadata.noSignal, we don't want to use the one inherited from a base class.
    const noSignal = (Object.hasOwn(metadata, 'noSignal') && metadata.noSignal) || undefined;
    let Ctor = Class;
    const attrs = Ctor.observedAttributes;
    if (Ctor.hasOwnProperty('elementName'))
        tagName = Ctor.elementName || tagName;
    else
        Ctor.elementName = tagName;
    if (Array.isArray(attrs)) ;
    else if (attrs && typeof attrs === 'object') {
        // When we're not using decorators, our users have the option to
        // provide an observedAttributes object (instead of the usual
        // array) to specify attribute types. In this case, we need to
        // track the types, and convert observedAttributes to an array so
        // the browser will understand it like usual.
        // Delete it, so that it will be re-created as an array by the
        // following _setUpAttribute calls.
        Ctor.observedAttributes = undefined;
        for (const prop in attrs)
            __setUpAttribute(Ctor, prop, attrs[prop]);
    }
    // We need to compose with @reactive so that it will signalify any @signal properties.
    Ctor = reactive(Ctor, context);
    class ElementDecorator extends Ctor {
        constructor(...args) {
            // @ts-expect-error we don't know what the user's args will be, just pass them all.
            super(...args);
            // Untrack to be sure we don't cause dependencies during creation of
            // objects (super() is already untracked by the reactive decorator).
            untrack(() => {
                handlePreUpgradeValues(this);
                const propsToSignalify = [];
                const attrsToProps = 
                // @ts-expect-error private access
                ElementDecorator.prototype.__attributesToProps ?? {};
                for (const propSpec of Object.values(attrsToProps)) {
                    const prop = propSpec.name;
                    const useSignal = !noSignal?.has(prop);
                    if (useSignal)
                        propsToSignalify.push(prop);
                    const handler = propSpec.attributeHandler;
                    // Default values for fields are handled in their initializer,
                    // and this catches default values for getters/setters.
                    if (handler && !('default' in handler))
                        handler.default = this[prop];
                }
                // This is signalifying any attribute props that may have been
                // defined in `static observedAttribute` rather than with @attribute
                // decorator (which composes @signal), so that we also cover
                // non-decorator usage until native decorators are out.
                //
                // Note, `signalify()` returns early if a property was already
                // signalified by @attribute (@signal), so this isn't going to
                // double-signalify.
                //
                // TODO: Once native decorators are out, remove this, and remove
                // non-decorator usage because everyone will be able to use
                // decorators. We can also then delete `noSignal` from `metadata`
                // here in the class as it is no longer needed at class
                // instantiation time.
                //
                // Having to duplicate keys in observedAttributes as well as class
                // fields is more room for human error, so it'll be nice to remove
                // non-decorator usage.
                if (propsToSignalify.length)
                    signalify(this, ...propsToSignalify);
            });
        }
    }
    const classFinishers = [...__classFinishers];
    __classFinishers.length = 0;
    function finishClass() {
        for (const finisher of classFinishers)
            finisher(ElementDecorator);
        if (tagName && autoDefine)
            // guard against missing DOM API (f.e. SSR)
            globalThis.window?.customElements?.define(tagName, ElementDecorator);
    }
    if (context?.addInitializer) {
        // Use addInitializer to run logic after the class is fully defined
        // (after class static initializers have ran, otherwise the class
        // decorator runs before any static members are initialized)
        context.addInitializer(finishClass);
    }
    else {
        // For JS without decorator support fall back manually running the
        // initializer because `context` will be `undefined` in that scenario,
        // so there won't be a `context.addInitializer` function to call.
        // In this case all static members are already initialized too.
        //
        // TODO: Once decorators are out natively, deprecate and remove this
        // non-decorator support
        finishClass();
    }
    return ElementDecorator;
}
function handlePreUpgradeValues(self) {
    if (!(self instanceof LumeElement))
        return;
    // @ts-expect-error, protected access is ok
    for (const [key, value] of self._preUpgradeValues) {
        // If the key is missing, it has already been handled, continue.
        if (!(key in self))
            continue;
        // Untrack the pre-upgrade value so that a subclass
        // of this class won't re-run this same logic again.
        // TODO needs testing.
        // @ts-expect-error, protected access is ok
        self._preUpgradeValues.delete(key);
        // Unshadow any possible inherited accessor only if
        // there is not an accessor. If there is an accessor it
        // handles inheritance its own way.
        const desc = Object.getOwnPropertyDescriptor(self, key);
        if (desc && 'value' in desc) {
            // @ts-expect-error dynamic decorator stuff, has no impact on user types.
            delete self[key];
        }
        // Set the pre-upgrade value (allowing any inherited
        // accessor to operate on it).
        // @ts-expect-error dynamic decorator stuff, has no impact on user types.
        self[key] = value;
    }
}

var EQUALS_FALSE_OPTIONS = { equals: false };

function createLazyMemo(calc, value, options) {
  let isReading = false, isStale = true;
  const [track, trigger] = createSignal(void 0, EQUALS_FALSE_OPTIONS), memo = createMemo(
    (p) => isReading ? calc(p) : (isStale = !track(), p),
    value,
    EQUALS_FALSE_OPTIONS
  );
  return () => {
    isReading = true;
    if (isStale)
      isStale = trigger();
    const v = memo();
    isReading = false;
    return v;
  };
}

function r(e){var t,f,n="";if("string"==typeof e||"number"==typeof e)n+=e;else if("object"==typeof e)if(Array.isArray(e)){var o=e.length;for(t=0;t<o;t++)e[t]&&(f=r(e[t]))&&(n&&(n+=" "),n+=f);}else for(f in e)e[f]&&(n&&(n+=" "),n+=f);return n}function clsx(){for(var e,t,f=0,n="",o=arguments.length;f<o;f++)(e=arguments[f])&&(t=r(e))&&(n&&(n+=" "),n+=t);return n}

var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

function getDefaultExportFromCjs (x) {
	return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
}

var main$2 = {exports: {}};

(function (module, exports) {
	!function(e,t){module.exports=t();}(commonjsGlobal,(()=>{return e={770:function(e,t,n){var r=this&&this.__importDefault||function(e){return e&&e.__esModule?e:{default:e}};Object.defineProperty(t,"__esModule",{value:!0}),t.setDefaultDebugCall=t.createOnigScanner=t.createOnigString=t.loadWASM=t.OnigScanner=t.OnigString=void 0;const i=r(n(418));let o=null,a=!1;class s{static _utf8ByteLength(e){let t=0;for(let n=0,r=e.length;n<r;n++){const i=e.charCodeAt(n);let o=i,a=!1;if(i>=55296&&i<=56319&&n+1<r){const t=e.charCodeAt(n+1);t>=56320&&t<=57343&&(o=65536+(i-55296<<10)|t-56320,a=!0);}t+=o<=127?1:o<=2047?2:o<=65535?3:4,a&&n++;}return t}constructor(e){const t=e.length,n=s._utf8ByteLength(e),r=n!==t,i=r?new Uint32Array(t+1):null;r&&(i[t]=n);const o=r?new Uint32Array(n+1):null;r&&(o[n]=t);const a=new Uint8Array(n);let f=0;for(let n=0;n<t;n++){const s=e.charCodeAt(n);let u=s,c=!1;if(s>=55296&&s<=56319&&n+1<t){const t=e.charCodeAt(n+1);t>=56320&&t<=57343&&(u=65536+(s-55296<<10)|t-56320,c=!0);}r&&(i[n]=f,c&&(i[n+1]=f),u<=127?o[f+0]=n:u<=2047?(o[f+0]=n,o[f+1]=n):u<=65535?(o[f+0]=n,o[f+1]=n,o[f+2]=n):(o[f+0]=n,o[f+1]=n,o[f+2]=n,o[f+3]=n)),u<=127?a[f++]=u:u<=2047?(a[f++]=192|(1984&u)>>>6,a[f++]=128|(63&u)>>>0):u<=65535?(a[f++]=224|(61440&u)>>>12,a[f++]=128|(4032&u)>>>6,a[f++]=128|(63&u)>>>0):(a[f++]=240|(1835008&u)>>>18,a[f++]=128|(258048&u)>>>12,a[f++]=128|(4032&u)>>>6,a[f++]=128|(63&u)>>>0),c&&n++;}this.utf16Length=t,this.utf8Length=n,this.utf16Value=e,this.utf8Value=a,this.utf16OffsetToUtf8=i,this.utf8OffsetToUtf16=o;}createString(e){const t=e._omalloc(this.utf8Length);return e.HEAPU8.set(this.utf8Value,t),t}}class f{constructor(e){if(this.id=++f.LAST_ID,!o)throw new Error("Must invoke loadWASM first.");this._onigBinding=o,this.content=e;const t=new s(e);this.utf16Length=t.utf16Length,this.utf8Length=t.utf8Length,this.utf16OffsetToUtf8=t.utf16OffsetToUtf8,this.utf8OffsetToUtf16=t.utf8OffsetToUtf16,this.utf8Length<1e4&&!f._sharedPtrInUse?(f._sharedPtr||(f._sharedPtr=o._omalloc(1e4)),f._sharedPtrInUse=!0,o.HEAPU8.set(t.utf8Value,f._sharedPtr),this.ptr=f._sharedPtr):this.ptr=t.createString(o);}convertUtf8OffsetToUtf16(e){return this.utf8OffsetToUtf16?e<0?0:e>this.utf8Length?this.utf16Length:this.utf8OffsetToUtf16[e]:e}convertUtf16OffsetToUtf8(e){return this.utf16OffsetToUtf8?e<0?0:e>this.utf16Length?this.utf8Length:this.utf16OffsetToUtf8[e]:e}dispose(){this.ptr===f._sharedPtr?f._sharedPtrInUse=!1:this._onigBinding._ofree(this.ptr);}}t.OnigString=f,f.LAST_ID=0,f._sharedPtr=0,f._sharedPtrInUse=!1;class u{constructor(e,t){var n,r;if(!o)throw new Error("Must invoke loadWASM first.");const i=[],a=[];for(let t=0,n=e.length;t<n;t++){const n=new s(e[t]);i[t]=n.createString(o),a[t]=n.utf8Length;}const f=o._omalloc(4*e.length);o.HEAPU32.set(i,f/4);const u=o._omalloc(4*e.length);o.HEAPU32.set(a,u/4),this._onigBinding=o,this._options=null!==(n=null==t?void 0:t.options)&&void 0!==n?n:[10];const c=this.onigOptions(this._options),_=this.onigSyntax(null!==(r=null==t?void 0:t.syntax)&&void 0!==r?r:0),d=o._createOnigScanner(f,u,e.length,c,_);this._ptr=d;for(let t=0,n=e.length;t<n;t++)o._ofree(i[t]);o._ofree(u),o._ofree(f),0===d&&function(e){throw new Error(e.UTF8ToString(e._getLastOnigError()))}(o);}dispose(){this._onigBinding._freeOnigScanner(this._ptr);}findNextMatchSync(e,t,n){let r=a,i=this._options;if(Array.isArray(n)?(n.includes(25)&&(r=!0),i=i.concat(n)):"boolean"==typeof n&&(r=n),"string"==typeof e){e=new f(e);const n=this._findNextMatchSync(e,t,r,i);return e.dispose(),n}return this._findNextMatchSync(e,t,r,i)}_findNextMatchSync(e,t,n,r){const i=this._onigBinding,o=this.onigOptions(r);let a;if(a=n?i._findNextOnigScannerMatchDbg(this._ptr,e.id,e.ptr,e.utf8Length,e.convertUtf16OffsetToUtf8(t),o):i._findNextOnigScannerMatch(this._ptr,e.id,e.ptr,e.utf8Length,e.convertUtf16OffsetToUtf8(t),o),0===a)return null;const s=i.HEAPU32;let f=a/4;const u=s[f++],c=s[f++];let _=[];for(let t=0;t<c;t++){const n=e.convertUtf8OffsetToUtf16(s[f++]),r=e.convertUtf8OffsetToUtf16(s[f++]);_[t]={start:n,end:r,length:r-n};}return {index:u,captureIndices:_}}onigOptions(e){return e.map((e=>this.onigOption(e))).reduce(((e,t)=>e|t),this._onigBinding.ONIG_OPTION_NONE)}onigSyntax(e){switch(e){case 0:return this._onigBinding.ONIG_SYNTAX_DEFAULT;case 1:return this._onigBinding.ONIG_SYNTAX_ASIS;case 2:return this._onigBinding.ONIG_SYNTAX_POSIX_BASIC;case 3:return this._onigBinding.ONIG_SYNTAX_POSIX_EXTENDED;case 4:return this._onigBinding.ONIG_SYNTAX_EMACS;case 5:return this._onigBinding.ONIG_SYNTAX_GREP;case 6:return this._onigBinding.ONIG_SYNTAX_GNU_REGEX;case 7:return this._onigBinding.ONIG_SYNTAX_JAVA;case 8:return this._onigBinding.ONIG_SYNTAX_PERL;case 9:return this._onigBinding.ONIG_SYNTAX_PERL_NG;case 10:return this._onigBinding.ONIG_SYNTAX_RUBY;case 11:return this._onigBinding.ONIG_SYNTAX_PYTHON;case 12:return this._onigBinding.ONIG_SYNTAX_ONIGURUMA}}onigOption(e){switch(e){case 1:return this._onigBinding.ONIG_OPTION_NONE;case 0:case 25:return this._onigBinding.ONIG_OPTION_DEFAULT;case 2:return this._onigBinding.ONIG_OPTION_IGNORECASE;case 3:return this._onigBinding.ONIG_OPTION_EXTEND;case 4:return this._onigBinding.ONIG_OPTION_MULTILINE;case 5:return this._onigBinding.ONIG_OPTION_SINGLELINE;case 6:return this._onigBinding.ONIG_OPTION_FIND_LONGEST;case 7:return this._onigBinding.ONIG_OPTION_FIND_NOT_EMPTY;case 8:return this._onigBinding.ONIG_OPTION_NEGATE_SINGLELINE;case 9:return this._onigBinding.ONIG_OPTION_DONT_CAPTURE_GROUP;case 10:return this._onigBinding.ONIG_OPTION_CAPTURE_GROUP;case 11:return this._onigBinding.ONIG_OPTION_NOTBOL;case 12:return this._onigBinding.ONIG_OPTION_NOTEOL;case 13:return this._onigBinding.ONIG_OPTION_CHECK_VALIDITY_OF_STRING;case 14:return this._onigBinding.ONIG_OPTION_IGNORECASE_IS_ASCII;case 15:return this._onigBinding.ONIG_OPTION_WORD_IS_ASCII;case 16:return this._onigBinding.ONIG_OPTION_DIGIT_IS_ASCII;case 17:return this._onigBinding.ONIG_OPTION_SPACE_IS_ASCII;case 18:return this._onigBinding.ONIG_OPTION_POSIX_IS_ASCII;case 19:return this._onigBinding.ONIG_OPTION_TEXT_SEGMENT_EXTENDED_GRAPHEME_CLUSTER;case 20:return this._onigBinding.ONIG_OPTION_TEXT_SEGMENT_WORD;case 21:return this._onigBinding.ONIG_OPTION_NOT_BEGIN_STRING;case 22:return this._onigBinding.ONIG_OPTION_NOT_END_STRING;case 23:return this._onigBinding.ONIG_OPTION_NOT_BEGIN_POSITION;case 24:return this._onigBinding.ONIG_OPTION_CALLBACK_EACH_MATCH}}}t.OnigScanner=u;let c=!1,_=null;t.loadWASM=function(e){if(c)return _;let t,n,r,a;if(c=!0,function(e){return "function"==typeof e.instantiator}(e))t=e.instantiator,n=e.print;else {let r;!function(e){return void 0!==e.data}(e)?r=e:(r=e.data,n=e.print),t=function(e){return "undefined"!=typeof Response&&e instanceof Response}(r)?"function"==typeof WebAssembly.instantiateStreaming?function(e){return t=>WebAssembly.instantiateStreaming(e,t)}(r):function(e){return async t=>{const n=await e.arrayBuffer();return WebAssembly.instantiate(n,t)}}(r):function(e){return t=>WebAssembly.instantiate(e,t)}(r);}return _=new Promise(((e,t)=>{r=e,a=t;})),function(e,t,n,r){(0, i.default)({print:t,instantiateWasm:(t,n)=>{if("undefined"==typeof performance){const e=()=>Date.now();t.env.emscripten_get_now=e,t.wasi_snapshot_preview1.emscripten_get_now=e;}return e(t).then((e=>n(e.instance)),r),{}}}).then((e=>{o=e,n();}));}(t,n,r,a),_},t.createOnigString=function(e){return new f(e)},t.createOnigScanner=function(e){return new u(e)},t.setDefaultDebugCall=function(e){a=e;};},418:e=>{var t=("undefined"!=typeof document&&document.currentScript&&document.currentScript.src,function(e={}){var t,n,r=e;r.ready=new Promise(((e,r)=>{t=e,n=r;}));var i,o=Object.assign({},r);"undefined"!=typeof read&&read,i=e=>{if("function"==typeof readbuffer)return new Uint8Array(readbuffer(e));let t=read(e,"binary");return "object"==typeof t||P(n),t;var n;},"undefined"==typeof clearTimeout&&(globalThis.clearTimeout=e=>{}),"undefined"==typeof setTimeout&&(globalThis.setTimeout=e=>"function"==typeof e?e():P()),"undefined"!=typeof scriptArgs&&scriptArgs,"undefined"!=typeof onig_print&&("undefined"==typeof console&&(console={}),console.log=onig_print,console.warn=console.error="undefined"!=typeof printErr?printErr:onig_print);var a,s,f=r.print||console.log.bind(console),u=r.printErr||console.error.bind(console);Object.assign(r,o),o=null,r.arguments&&r.arguments,r.thisProgram&&r.thisProgram,r.quit&&r.quit,r.wasmBinary&&(a=r.wasmBinary),r.noExitRuntime,"object"!=typeof WebAssembly&&P("no native wasm support detected");var c,_,d,g,l,h,p,O,v=!1;function m(){var e=s.buffer;r.HEAP8=c=new Int8Array(e),r.HEAP16=d=new Int16Array(e),r.HEAPU8=_=new Uint8Array(e),r.HEAPU16=g=new Uint16Array(e),r.HEAP32=l=new Int32Array(e),r.HEAPU32=h=new Uint32Array(e),r.HEAPF32=p=new Float32Array(e),r.HEAPF64=O=new Float64Array(e);}var y=[],I=[],T=[];var N=0,S=null;function P(e){r.onAbort&&r.onAbort(e),u(e="Aborted("+e+")"),v=!0,e+=". Build with -sASSERTIONS for more info.";var t=new WebAssembly.RuntimeError(e);throw n(t),t}var E,w;function b(e){return e.startsWith("data:application/octet-stream;base64,")}function C(e){if(e==E&&a)return new Uint8Array(a);if(i)return i(e);throw "both async and sync fetching of the wasm failed"}function U(e,t,n){return function(e){return Promise.resolve().then((()=>C(e)))}(e).then((e=>WebAssembly.instantiate(e,t))).then((e=>e)).then(n,(e=>{u(`failed to asynchronously prepare wasm: ${e}`),P(e);}))}b(E="onig.wasm")||(w=E,E=r.locateFile?r.locateFile(w,""):""+w);var G=e=>{for(;e.length>0;)e.shift()(r);},B=void 0,R=e=>{for(var t="",n=e;_[n];)t+=B[_[n++]];return t},W={},L={},D={},x=void 0,M=e=>{throw new x(e)},F=void 0,X=(e,t,n)=>{function r(t){var r=n(t);r.length!==e.length&&(e=>{throw new F(e)})("Mismatched type converter count");for(var i=0;i<e.length;++i)k(e[i],r[i]);}e.forEach((function(e){D[e]=t;}));var i=new Array(t.length),o=[],a=0;t.forEach(((e,t)=>{L.hasOwnProperty(e)?i[t]=L[e]:(o.push(e),W.hasOwnProperty(e)||(W[e]=[]),W[e].push((()=>{i[t]=L[e],++a===o.length&&r(i);})));})),0===o.length&&r(i);};function k(e,t,n={}){if(!("argPackAdvance"in t))throw new TypeError("registerType registeredInstance requires argPackAdvance");return function(e,t,n={}){var r=t.name;if(e||M(`type "${r}" must have a positive integer typeid pointer`),L.hasOwnProperty(e)){if(n.ignoreDuplicateRegistrations)return;M(`Cannot register type '${r}' twice`);}if(L[e]=t,delete D[e],W.hasOwnProperty(e)){var i=W[e];delete W[e],i.forEach((e=>e()));}}(e,t,n)}function H(){this.allocated=[void 0],this.freelist=[];}var Y=new H,j=()=>{for(var e=0,t=Y.reserved;t<Y.allocated.length;++t)void 0!==Y.allocated[t]&&++e;return e},V=e=>(e||M("Cannot use deleted val. handle = "+e),Y.get(e).value),$=e=>{switch(e){case void 0:return 1;case null:return 2;case!0:return 3;case!1:return 4;default:return Y.allocate({refcount:1,value:e})}};function z(e){return this.fromWireType(l[e>>2])}var q=(e,t)=>{switch(t){case 4:return function(e){return this.fromWireType(p[e>>2])};case 8:return function(e){return this.fromWireType(O[e>>3])};default:throw new TypeError(`invalid float width (${t}): ${e}`)}},K=(e,t,n)=>{switch(t){case 1:return n?e=>c[e>>0]:e=>_[e>>0];case 2:return n?e=>d[e>>1]:e=>g[e>>1];case 4:return n?e=>l[e>>2]:e=>h[e>>2];default:throw new TypeError(`invalid integer width (${t}): ${e}`)}};function J(e){return this.fromWireType(h[e>>2])}var Q,Z="undefined"!=typeof TextDecoder?new TextDecoder("utf8"):void 0,ee=(e,t,n)=>{for(var r=t+n,i=t;e[i]&&!(i>=r);)++i;if(i-t>16&&e.buffer&&Z)return Z.decode(e.subarray(t,i));for(var o="";t<i;){var a=e[t++];if(128&a){var s=63&e[t++];if(192!=(224&a)){var f=63&e[t++];if((a=224==(240&a)?(15&a)<<12|s<<6|f:(7&a)<<18|s<<12|f<<6|63&e[t++])<65536)o+=String.fromCharCode(a);else {var u=a-65536;o+=String.fromCharCode(55296|u>>10,56320|1023&u);}}else o+=String.fromCharCode((31&a)<<6|s);}else o+=String.fromCharCode(a);}return o},te=(e,t)=>e?ee(_,e,t):"",ne="undefined"!=typeof TextDecoder?new TextDecoder("utf-16le"):void 0,re=(e,t)=>{for(var n=e,r=n>>1,i=r+t/2;!(r>=i)&&g[r];)++r;if((n=r<<1)-e>32&&ne)return ne.decode(_.subarray(e,n));for(var o="",a=0;!(a>=t/2);++a){var s=d[e+2*a>>1];if(0==s)break;o+=String.fromCharCode(s);}return o},ie=(e,t,n)=>{if(void 0===n&&(n=2147483647),n<2)return 0;for(var r=t,i=(n-=2)<2*e.length?n/2:e.length,o=0;o<i;++o){var a=e.charCodeAt(o);d[t>>1]=a,t+=2;}return d[t>>1]=0,t-r},oe=e=>2*e.length,ae=(e,t)=>{for(var n=0,r="";!(n>=t/4);){var i=l[e+4*n>>2];if(0==i)break;if(++n,i>=65536){var o=i-65536;r+=String.fromCharCode(55296|o>>10,56320|1023&o);}else r+=String.fromCharCode(i);}return r},se=(e,t,n)=>{if(void 0===n&&(n=2147483647),n<4)return 0;for(var r=t,i=r+n-4,o=0;o<e.length;++o){var a=e.charCodeAt(o);if(a>=55296&&a<=57343&&(a=65536+((1023&a)<<10)|1023&e.charCodeAt(++o)),l[t>>2]=a,(t+=4)+4>i)break}return l[t>>2]=0,t-r},fe=e=>{for(var t=0,n=0;n<e.length;++n){var r=e.charCodeAt(n);r>=55296&&r<=57343&&++n,t+=4;}return t};Q=()=>performance.now();var ue=e=>{var t=(e-s.buffer.byteLength+65535)/65536;try{return s.grow(t),m(),1}catch(e){}},ce=[null,[],[]];(()=>{for(var e=new Array(256),t=0;t<256;++t)e[t]=String.fromCharCode(t);B=e;})(),x=r.BindingError=class extends Error{constructor(e){super(e),this.name="BindingError";}},F=r.InternalError=class extends Error{constructor(e){super(e),this.name="InternalError";}},Object.assign(H.prototype,{get(e){return this.allocated[e]},has(e){return void 0!==this.allocated[e]},allocate(e){var t=this.freelist.pop()||this.allocated.length;return this.allocated[t]=e,t},free(e){this.allocated[e]=void 0,this.freelist.push(e);}}),Y.allocated.push({value:void 0},{value:null},{value:!0},{value:!1}),Y.reserved=Y.allocated.length,r.count_emval_handles=j;var _e,de={_embind_register_bigint:(e,t,n,r,i)=>{},_embind_register_bool:(e,t,n,r)=>{k(e,{name:t=R(t),fromWireType:function(e){return !!e},toWireType:function(e,t){return t?n:r},argPackAdvance:8,readValueFromPointer:function(e){return this.fromWireType(_[e])},destructorFunction:null});},_embind_register_constant:(e,t,n)=>{e=R(e),X([],[t],(function(t){return t=t[0],r[e]=t.fromWireType(n),[]}));},_embind_register_emval:(e,t)=>{k(e,{name:t=R(t),fromWireType:e=>{var t=V(e);return (e=>{e>=Y.reserved&&0==--Y.get(e).refcount&&Y.free(e);})(e),t},toWireType:(e,t)=>$(t),argPackAdvance:8,readValueFromPointer:z,destructorFunction:null});},_embind_register_float:(e,t,n)=>{k(e,{name:t=R(t),fromWireType:e=>e,toWireType:(e,t)=>t,argPackAdvance:8,readValueFromPointer:q(t,n),destructorFunction:null});},_embind_register_integer:(e,t,n,r,i)=>{t=R(t);var o=e=>e;if(0===r){var a=32-8*n;o=e=>e<<a>>>a;}var s=t.includes("unsigned");k(e,{name:t,fromWireType:o,toWireType:s?function(e,t){return this.name,t>>>0}:function(e,t){return this.name,t},argPackAdvance:8,readValueFromPointer:K(t,n,0!==r),destructorFunction:null});},_embind_register_memory_view:(e,t,n)=>{var r=[Int8Array,Uint8Array,Int16Array,Uint16Array,Int32Array,Uint32Array,Float32Array,Float64Array][t];function i(e){var t=h[e>>2],n=h[e+4>>2];return new r(c.buffer,n,t)}k(e,{name:n=R(n),fromWireType:i,argPackAdvance:8,readValueFromPointer:i},{ignoreDuplicateRegistrations:!0});},_embind_register_std_string:(e,t)=>{var n="std::string"===(t=R(t));k(e,{name:t,fromWireType:e=>{var t,r=h[e>>2],i=e+4;if(n)for(var o=i,a=0;a<=r;++a){var s=i+a;if(a==r||0==_[s]){var f=te(o,s-o);void 0===t?t=f:(t+=String.fromCharCode(0),t+=f),o=s+1;}}else {var u=new Array(r);for(a=0;a<r;++a)u[a]=String.fromCharCode(_[i+a]);t=u.join("");}return he(e),t},toWireType:(e,t)=>{var r;t instanceof ArrayBuffer&&(t=new Uint8Array(t));var i="string"==typeof t;i||t instanceof Uint8Array||t instanceof Uint8ClampedArray||t instanceof Int8Array||M("Cannot pass non-string to std::string"),r=n&&i?(e=>{for(var t=0,n=0;n<e.length;++n){var r=e.charCodeAt(n);r<=127?t++:r<=2047?t+=2:r>=55296&&r<=57343?(t+=4,++n):t+=3;}return t})(t):t.length;var o=le(4+r+1),a=o+4;if(h[o>>2]=r,n&&i)((e,t,n,r)=>{if(!(r>0))return 0;for(var i=n,o=n+r-1,a=0;a<e.length;++a){var s=e.charCodeAt(a);if(s>=55296&&s<=57343&&(s=65536+((1023&s)<<10)|1023&e.charCodeAt(++a)),s<=127){if(n>=o)break;t[n++]=s;}else if(s<=2047){if(n+1>=o)break;t[n++]=192|s>>6,t[n++]=128|63&s;}else if(s<=65535){if(n+2>=o)break;t[n++]=224|s>>12,t[n++]=128|s>>6&63,t[n++]=128|63&s;}else {if(n+3>=o)break;t[n++]=240|s>>18,t[n++]=128|s>>12&63,t[n++]=128|s>>6&63,t[n++]=128|63&s;}}t[n]=0;})(t,_,a,r+1);else if(i)for(var s=0;s<r;++s){var f=t.charCodeAt(s);f>255&&(he(a),M("String has UTF-16 code units that do not fit in 8 bits")),_[a+s]=f;}else for(s=0;s<r;++s)_[a+s]=t[s];return null!==e&&e.push(he,o),o},argPackAdvance:8,readValueFromPointer:J,destructorFunction:e=>he(e)});},_embind_register_std_wstring:(e,t,n)=>{var r,i,o,a,s;n=R(n),2===t?(r=re,i=ie,a=oe,o=()=>g,s=1):4===t&&(r=ae,i=se,a=fe,o=()=>h,s=2),k(e,{name:n,fromWireType:e=>{for(var n,i=h[e>>2],a=o(),f=e+4,u=0;u<=i;++u){var c=e+4+u*t;if(u==i||0==a[c>>s]){var _=r(f,c-f);void 0===n?n=_:(n+=String.fromCharCode(0),n+=_),f=c+t;}}return he(e),n},toWireType:(e,r)=>{"string"!=typeof r&&M(`Cannot pass non-string to C++ string type ${n}`);var o=a(r),f=le(4+o+t);return h[f>>2]=o>>s,i(r,f+4,o+t),null!==e&&e.push(he,f),f},argPackAdvance:8,readValueFromPointer:z,destructorFunction:e=>he(e)});},_embind_register_void:(e,t)=>{k(e,{isVoid:!0,name:t=R(t),argPackAdvance:0,fromWireType:()=>{},toWireType:(e,t)=>{}});},emscripten_get_now:Q,emscripten_memcpy_big:(e,t,n)=>_.copyWithin(e,t,t+n),emscripten_resize_heap:e=>{var t=_.length,n=2147483648;if((e>>>=0)>n)return !1;for(var r,i=1;i<=4;i*=2){var o=t*(1+.2/i);o=Math.min(o,e+100663296);var a=Math.min(n,(r=Math.max(e,o))+(65536-r%65536)%65536);if(ue(a))return !0}return !1},fd_write:(e,t,n,r)=>{for(var i=0,o=0;o<n;o++){var a=h[t>>2],s=h[t+4>>2];t+=8;for(var c=0;c<s;c++)d=e,g=_[a+c],l=void 0,l=ce[d],0===g||10===g?((1===d?f:u)(ee(l,0)),l.length=0):l.push(g);i+=s;}var d,g,l;return h[r>>2]=i,0}},ge=function(){var e,t,i,o,f={env:de,wasi_snapshot_preview1:de};function c(e,t){var n,i=e.exports;return s=(ge=i).memory,m(),ge.__indirect_function_table,n=ge.__wasm_call_ctors,I.unshift(n),function(e){if(N--,r.monitorRunDependencies&&r.monitorRunDependencies(N),0==N&&(S)){var t=S;S=null,t();}}(),i}if(N++,r.monitorRunDependencies&&r.monitorRunDependencies(N),r.instantiateWasm)try{return r.instantiateWasm(f,c)}catch(e){u(`Module.instantiateWasm callback failed with error: ${e}`),n(e);}return (e=a,t=E,i=f,o=function(e){c(e.instance);},e||"function"!=typeof WebAssembly.instantiateStreaming||b(t)||"function"!=typeof fetch?U(t,i,o):fetch(t,{credentials:"same-origin"}).then((e=>WebAssembly.instantiateStreaming(e,i).then(o,(function(e){return u(`wasm streaming compile failed: ${e}`),u("falling back to ArrayBuffer instantiation"),U(t,i,o)}))))).catch(n),{}}(),le=e=>(le=ge.malloc)(e),he=e=>(he=ge.free)(e);function pe(){function e(){_e||(_e=!0,r.calledRun=!0,v||(G(I),t(r),r.onRuntimeInitialized&&r.onRuntimeInitialized(),function(){if(r.postRun)for("function"==typeof r.postRun&&(r.postRun=[r.postRun]);r.postRun.length;)e=r.postRun.shift(),T.unshift(e);var e;G(T);}()));}N>0||(function(){if(r.preRun)for("function"==typeof r.preRun&&(r.preRun=[r.preRun]);r.preRun.length;)e=r.preRun.shift(),y.unshift(e);var e;G(y);}(),N>0||(r.setStatus?(r.setStatus("Running..."),setTimeout((function(){setTimeout((function(){r.setStatus("");}),1),e();}),1)):e()));}if(r._omalloc=e=>(r._omalloc=ge.omalloc)(e),r._ofree=e=>(r._ofree=ge.ofree)(e),r._getLastOnigError=()=>(r._getLastOnigError=ge.getLastOnigError)(),r._createOnigScanner=(e,t,n,i,o)=>(r._createOnigScanner=ge.createOnigScanner)(e,t,n,i,o),r._freeOnigScanner=e=>(r._freeOnigScanner=ge.freeOnigScanner)(e),r._findNextOnigScannerMatch=(e,t,n,i,o,a)=>(r._findNextOnigScannerMatch=ge.findNextOnigScannerMatch)(e,t,n,i,o,a),r._findNextOnigScannerMatchDbg=(e,t,n,i,o,a)=>(r._findNextOnigScannerMatchDbg=ge.findNextOnigScannerMatchDbg)(e,t,n,i,o,a),r.__embind_initialize_bindings=()=>(r.__embind_initialize_bindings=ge._embind_initialize_bindings)(),r.dynCall_jiji=(e,t,n,i,o)=>(r.dynCall_jiji=ge.dynCall_jiji)(e,t,n,i,o),r.UTF8ToString=te,S=function e(){_e||pe(),_e||(S=e);},r.preInit)for("function"==typeof r.preInit&&(r.preInit=[r.preInit]);r.preInit.length>0;)r.preInit.pop()();return pe(),e.ready});e.exports=t;}},t={},function n(r){var i=t[r];if(void 0!==i)return i.exports;var o=t[r]={exports:{}};return e[r].call(o.exports,o,o.exports,n),o.exports}(770);var e,t;})); 
} (main$2));

var mainExports$1 = main$2.exports;
const main$1 = /*@__PURE__*/getDefaultExportFromCjs(mainExports$1);

const oniguruma = /*#__PURE__*/_mergeNamespaces({
    __proto__: null,
    default: main$1
}, [mainExports$1]);

var main = {exports: {}};

(function (module, exports) {
	var define_process_env_default = {};
	!function(e, t) {
	  module.exports = t() ;
	}(commonjsGlobal, () => (() => {
	  var e = { 350: (e2, t2) => {
	    Object.defineProperty(t2, "__esModule", { value: true }), t2.UseOnigurumaFindOptions = t2.DebugFlags = void 0, t2.DebugFlags = { InDebugMode: "undefined" != typeof process && !!define_process_env_default.VSCODE_TEXTMATE_DEBUG }, t2.UseOnigurumaFindOptions = false;
	  }, 442: (e2, t2, n) => {
	    Object.defineProperty(t2, "__esModule", { value: true }), t2.applyStateStackDiff = t2.diffStateStacksRefEq = void 0;
	    const s = n(391);
	    t2.diffStateStacksRefEq = function(e3, t3) {
	      let n2 = 0;
	      const s2 = [];
	      let r = e3, i = t3;
	      for (; r !== i; )
	        r && (!i || r.depth >= i.depth) ? (n2++, r = r.parent) : (s2.push(i.toStateStackFrame()), i = i.parent);
	      return { pops: n2, newFrames: s2.reverse() };
	    }, t2.applyStateStackDiff = function(e3, t3) {
	      let n2 = e3;
	      for (let e4 = 0; e4 < t3.pops; e4++)
	        n2 = n2.parent;
	      for (const e4 of t3.newFrames)
	        n2 = s.StateStackImpl.pushFrame(n2, e4);
	      return n2;
	    };
	  }, 36: (e2, t2) => {
	    var n;
	    Object.defineProperty(t2, "__esModule", { value: true }), t2.toOptionalTokenType = t2.EncodedTokenAttributes = void 0, (n = t2.EncodedTokenAttributes || (t2.EncodedTokenAttributes = {})).toBinaryStr = function(e3) {
	      return e3.toString(2).padStart(32, "0");
	    }, n.print = function(e3) {
	      const t3 = n.getLanguageId(e3), s = n.getTokenType(e3), r = n.getFontStyle(e3), i = n.getForeground(e3), o = n.getBackground(e3);
	      console.log({ languageId: t3, tokenType: s, fontStyle: r, foreground: i, background: o });
	    }, n.getLanguageId = function(e3) {
	      return (255 & e3) >>> 0;
	    }, n.getTokenType = function(e3) {
	      return (768 & e3) >>> 8;
	    }, n.containsBalancedBrackets = function(e3) {
	      return 0 != (1024 & e3);
	    }, n.getFontStyle = function(e3) {
	      return (30720 & e3) >>> 11;
	    }, n.getForeground = function(e3) {
	      return (16744448 & e3) >>> 15;
	    }, n.getBackground = function(e3) {
	      return (4278190080 & e3) >>> 24;
	    }, n.set = function(e3, t3, s, r, i, o, a) {
	      let c = n.getLanguageId(e3), l = n.getTokenType(e3), u = n.containsBalancedBrackets(e3) ? 1 : 0, h = n.getFontStyle(e3), p = n.getForeground(e3), d = n.getBackground(e3);
	      return 0 !== t3 && (c = t3), 8 !== s && (l = s), null !== r && (u = r ? 1 : 0), -1 !== i && (h = i), 0 !== o && (p = o), 0 !== a && (d = a), (c << 0 | l << 8 | u << 10 | h << 11 | p << 15 | d << 24) >>> 0;
	    }, t2.toOptionalTokenType = function(e3) {
	      return e3;
	    };
	  }, 996: (e2, t2, n) => {
	    Object.defineProperty(t2, "__esModule", { value: true }), t2.BasicScopeAttributesProvider = t2.BasicScopeAttributes = void 0;
	    const s = n(878);
	    class r {
	      constructor(e3, t3) {
	        this.languageId = e3, this.tokenType = t3;
	      }
	    }
	    t2.BasicScopeAttributes = r;
	    class i {
	      constructor(e3, t3) {
	        this._getBasicScopeAttributes = new s.CachedFn((e4) => {
	          const t4 = this._scopeToLanguage(e4), n2 = this._toStandardTokenType(e4);
	          return new r(t4, n2);
	        }), this._defaultAttributes = new r(e3, 8), this._embeddedLanguagesMatcher = new o(Object.entries(t3 || {}));
	      }
	      getDefaultAttributes() {
	        return this._defaultAttributes;
	      }
	      getBasicScopeAttributes(e3) {
	        return null === e3 ? i._NULL_SCOPE_METADATA : this._getBasicScopeAttributes.get(e3);
	      }
	      _scopeToLanguage(e3) {
	        return this._embeddedLanguagesMatcher.match(e3) || 0;
	      }
	      _toStandardTokenType(e3) {
	        const t3 = e3.match(i.STANDARD_TOKEN_TYPE_REGEXP);
	        if (!t3)
	          return 8;
	        switch (t3[1]) {
	          case "comment":
	            return 1;
	          case "string":
	            return 2;
	          case "regex":
	            return 3;
	          case "meta.embedded":
	            return 0;
	        }
	        throw new Error("Unexpected match for standard token type!");
	      }
	    }
	    t2.BasicScopeAttributesProvider = i, i._NULL_SCOPE_METADATA = new r(0, 0), i.STANDARD_TOKEN_TYPE_REGEXP = /\b(comment|string|regex|meta\.embedded)\b/;
	    class o {
	      constructor(e3) {
	        if (0 === e3.length)
	          this.values = null, this.scopesRegExp = null;
	        else {
	          this.values = new Map(e3);
	          const t3 = e3.map(([e4, t4]) => s.escapeRegExpCharacters(e4));
	          t3.sort(), t3.reverse(), this.scopesRegExp = new RegExp(`^((${t3.join(")|(")}))($|\\.)`, "");
	        }
	      }
	      match(e3) {
	        if (!this.scopesRegExp)
	          return;
	        const t3 = e3.match(this.scopesRegExp);
	        return t3 ? this.values.get(t3[1]) : void 0;
	      }
	    }
	  }, 947: (e2, t2, n) => {
	    Object.defineProperty(t2, "__esModule", { value: true }), t2.LineTokens = t2.BalancedBracketSelectors = t2.StateStackImpl = t2.AttributedScopeStack = t2.Grammar = t2.createGrammar = void 0;
	    const s = n(350), r = n(36), i = n(736), o = n(44), a = n(792), c = n(583), l = n(878), u = n(996), h = n(47);
	    function p(e3, t3, n2, s2, r2) {
	      const o2 = i.createMatchers(t3, d), c2 = a.RuleFactory.getCompiledRuleId(n2, s2, r2.repository);
	      for (const n3 of o2)
	        e3.push({ debugSelector: t3, matcher: n3.matcher, ruleId: c2, grammar: r2, priority: n3.priority });
	    }
	    function d(e3, t3) {
	      if (t3.length < e3.length)
	        return false;
	      let n2 = 0;
	      return e3.every((e4) => {
	        for (let s2 = n2; s2 < t3.length; s2++)
	          if (f(t3[s2], e4))
	            return n2 = s2 + 1, true;
	        return false;
	      });
	    }
	    function f(e3, t3) {
	      if (!e3)
	        return false;
	      if (e3 === t3)
	        return true;
	      const n2 = t3.length;
	      return e3.length > n2 && e3.substr(0, n2) === t3 && "." === e3[n2];
	    }
	    t2.createGrammar = function(e3, t3, n2, s2, r2, i2, o2, a2) {
	      return new m(e3, t3, n2, s2, r2, i2, o2, a2);
	    };
	    class m {
	      constructor(e3, t3, n2, s2, r2, o2, a2, c2) {
	        if (this._rootScopeName = e3, this.balancedBracketSelectors = o2, this._onigLib = c2, this._basicScopeAttributesProvider = new u.BasicScopeAttributesProvider(n2, s2), this._rootId = -1, this._lastRuleId = 0, this._ruleId2desc = [null], this._includedGrammars = {}, this._grammarRepository = a2, this._grammar = g(t3, null), this._injections = null, this._tokenTypeMatchers = [], r2)
	          for (const e4 of Object.keys(r2)) {
	            const t4 = i.createMatchers(e4, d);
	            for (const n3 of t4)
	              this._tokenTypeMatchers.push({ matcher: n3.matcher, type: r2[e4] });
	          }
	      }
	      get themeProvider() {
	        return this._grammarRepository;
	      }
	      dispose() {
	        for (const e3 of this._ruleId2desc)
	          e3 && e3.dispose();
	      }
	      createOnigScanner(e3) {
	        return this._onigLib.createOnigScanner(e3);
	      }
	      createOnigString(e3) {
	        return this._onigLib.createOnigString(e3);
	      }
	      getMetadataForScope(e3) {
	        return this._basicScopeAttributesProvider.getBasicScopeAttributes(e3);
	      }
	      _collectInjections() {
	        const e3 = [], t3 = this._rootScopeName, n2 = ((e4) => e4 === this._rootScopeName ? this._grammar : this.getExternalGrammar(e4))(t3);
	        if (n2) {
	          const s2 = n2.injections;
	          if (s2)
	            for (let t4 in s2)
	              p(e3, t4, s2[t4], this, n2);
	          const r2 = this._grammarRepository.injections(t3);
	          r2 && r2.forEach((t4) => {
	            const n3 = this.getExternalGrammar(t4);
	            if (n3) {
	              const t5 = n3.injectionSelector;
	              t5 && p(e3, t5, n3, this, n3);
	            }
	          });
	        }
	        return e3.sort((e4, t4) => e4.priority - t4.priority), e3;
	      }
	      getInjections() {
	        if (null === this._injections && (this._injections = this._collectInjections(), s.DebugFlags.InDebugMode && this._injections.length > 0)) {
	          console.log(`Grammar ${this._rootScopeName} contains the following injections:`);
	          for (const e3 of this._injections)
	            console.log(`  - ${e3.debugSelector}`);
	        }
	        return this._injections;
	      }
	      registerRule(e3) {
	        const t3 = ++this._lastRuleId, n2 = e3(a.ruleIdFromNumber(t3));
	        return this._ruleId2desc[t3] = n2, n2;
	      }
	      getRule(e3) {
	        return this._ruleId2desc[a.ruleIdToNumber(e3)];
	      }
	      getExternalGrammar(e3, t3) {
	        if (this._includedGrammars[e3])
	          return this._includedGrammars[e3];
	        if (this._grammarRepository) {
	          const n2 = this._grammarRepository.lookup(e3);
	          if (n2)
	            return this._includedGrammars[e3] = g(n2, t3 && t3.$base), this._includedGrammars[e3];
	        }
	      }
	      tokenizeLine(e3, t3, n2 = 0) {
	        const s2 = this._tokenize(e3, t3, false, n2);
	        return { tokens: s2.lineTokens.getResult(s2.ruleStack, s2.lineLength), ruleStack: s2.ruleStack, stoppedEarly: s2.stoppedEarly };
	      }
	      tokenizeLine2(e3, t3, n2 = 0) {
	        const s2 = this._tokenize(e3, t3, true, n2);
	        return { tokens: s2.lineTokens.getBinaryResult(s2.ruleStack, s2.lineLength), ruleStack: s2.ruleStack, stoppedEarly: s2.stoppedEarly };
	      }
	      _tokenize(e3, t3, n2, s2) {
	        let i2;
	        if (-1 === this._rootId && (this._rootId = a.RuleFactory.getCompiledRuleId(this._grammar.repository.$self, this, this._grammar.repository), this.getInjections()), t3 && t3 !== b.NULL)
	          i2 = false, t3.reset();
	        else {
	          i2 = true;
	          const e4 = this._basicScopeAttributesProvider.getDefaultAttributes(), n3 = this.themeProvider.getDefaults(), s3 = r.EncodedTokenAttributes.set(0, e4.languageId, e4.tokenType, null, n3.fontStyle, n3.foregroundId, n3.backgroundId), o2 = this.getRule(this._rootId).getName(null, null);
	          let a2;
	          a2 = o2 ? _.createRootAndLookUpScopeName(o2, s3, this) : _.createRoot("unknown", s3), t3 = new b(null, this._rootId, -1, -1, false, null, a2, a2);
	        }
	        e3 += "\n";
	        const c2 = this.createOnigString(e3), l2 = c2.content.length, u2 = new y(n2, e3, this._tokenTypeMatchers, this.balancedBracketSelectors), p2 = h._tokenizeString(this, c2, i2, 0, t3, u2, true, s2);
	        return o.disposeOnigString(c2), { lineLength: l2, lineTokens: u2, ruleStack: p2.stack, stoppedEarly: p2.stoppedEarly };
	      }
	    }
	    function g(e3, t3) {
	      return (e3 = l.clone(e3)).repository = e3.repository || {}, e3.repository.$self = { $vscodeTextmateLocation: e3.$vscodeTextmateLocation, patterns: e3.patterns, name: e3.scopeName }, e3.repository.$base = t3 || e3.repository.$self, e3;
	    }
	    t2.Grammar = m;
	    class _ {
	      constructor(e3, t3, n2) {
	        this.parent = e3, this.scopePath = t3, this.tokenAttributes = n2;
	      }
	      static fromExtension(e3, t3) {
	        let n2 = e3, s2 = e3?.scopePath ?? null;
	        for (const e4 of t3)
	          s2 = c.ScopeStack.push(s2, e4.scopeNames), n2 = new _(n2, s2, e4.encodedTokenAttributes);
	        return n2;
	      }
	      static createRoot(e3, t3) {
	        return new _(null, new c.ScopeStack(null, e3), t3);
	      }
	      static createRootAndLookUpScopeName(e3, t3, n2) {
	        const s2 = n2.getMetadataForScope(e3), r2 = new c.ScopeStack(null, e3), i2 = n2.themeProvider.themeMatch(r2), o2 = _.mergeAttributes(t3, s2, i2);
	        return new _(null, r2, o2);
	      }
	      get scopeName() {
	        return this.scopePath.scopeName;
	      }
	      toString() {
	        return this.getScopeNames().join(" ");
	      }
	      equals(e3) {
	        return _.equals(this, e3);
	      }
	      static equals(e3, t3) {
	        for (; ; ) {
	          if (e3 === t3)
	            return true;
	          if (!e3 && !t3)
	            return true;
	          if (!e3 || !t3)
	            return false;
	          if (e3.scopeName !== t3.scopeName || e3.tokenAttributes !== t3.tokenAttributes)
	            return false;
	          e3 = e3.parent, t3 = t3.parent;
	        }
	      }
	      static mergeAttributes(e3, t3, n2) {
	        let s2 = -1, i2 = 0, o2 = 0;
	        return null !== n2 && (s2 = n2.fontStyle, i2 = n2.foregroundId, o2 = n2.backgroundId), r.EncodedTokenAttributes.set(e3, t3.languageId, t3.tokenType, null, s2, i2, o2);
	      }
	      pushAttributed(e3, t3) {
	        if (null === e3)
	          return this;
	        if (-1 === e3.indexOf(" "))
	          return _._pushAttributed(this, e3, t3);
	        const n2 = e3.split(/ /g);
	        let s2 = this;
	        for (const e4 of n2)
	          s2 = _._pushAttributed(s2, e4, t3);
	        return s2;
	      }
	      static _pushAttributed(e3, t3, n2) {
	        const s2 = n2.getMetadataForScope(t3), r2 = e3.scopePath.push(t3), i2 = n2.themeProvider.themeMatch(r2), o2 = _.mergeAttributes(e3.tokenAttributes, s2, i2);
	        return new _(e3, r2, o2);
	      }
	      getScopeNames() {
	        return this.scopePath.getSegments();
	      }
	      getExtensionIfDefined(e3) {
	        const t3 = [];
	        let n2 = this;
	        for (; n2 && n2 !== e3; )
	          t3.push({ encodedTokenAttributes: n2.tokenAttributes, scopeNames: n2.scopePath.getExtensionIfDefined(n2.parent?.scopePath ?? null) }), n2 = n2.parent;
	        return n2 === e3 ? t3.reverse() : void 0;
	      }
	    }
	    t2.AttributedScopeStack = _;
	    class b {
	      constructor(e3, t3, n2, s2, r2, i2, o2, a2) {
	        this.parent = e3, this.ruleId = t3, this.beginRuleCapturedEOL = r2, this.endRule = i2, this.nameScopesList = o2, this.contentNameScopesList = a2, this._stackElementBrand = void 0, this.depth = this.parent ? this.parent.depth + 1 : 1, this._enterPos = n2, this._anchorPos = s2;
	      }
	      equals(e3) {
	        return null !== e3 && b._equals(this, e3);
	      }
	      static _equals(e3, t3) {
	        return e3 === t3 || !!this._structuralEquals(e3, t3) && _.equals(e3.contentNameScopesList, t3.contentNameScopesList);
	      }
	      static _structuralEquals(e3, t3) {
	        for (; ; ) {
	          if (e3 === t3)
	            return true;
	          if (!e3 && !t3)
	            return true;
	          if (!e3 || !t3)
	            return false;
	          if (e3.depth !== t3.depth || e3.ruleId !== t3.ruleId || e3.endRule !== t3.endRule)
	            return false;
	          e3 = e3.parent, t3 = t3.parent;
	        }
	      }
	      clone() {
	        return this;
	      }
	      static _reset(e3) {
	        for (; e3; )
	          e3._enterPos = -1, e3._anchorPos = -1, e3 = e3.parent;
	      }
	      reset() {
	        b._reset(this);
	      }
	      pop() {
	        return this.parent;
	      }
	      safePop() {
	        return this.parent ? this.parent : this;
	      }
	      push(e3, t3, n2, s2, r2, i2, o2) {
	        return new b(this, e3, t3, n2, s2, r2, i2, o2);
	      }
	      getEnterPos() {
	        return this._enterPos;
	      }
	      getAnchorPos() {
	        return this._anchorPos;
	      }
	      getRule(e3) {
	        return e3.getRule(this.ruleId);
	      }
	      toString() {
	        const e3 = [];
	        return this._writeString(e3, 0), "[" + e3.join(",") + "]";
	      }
	      _writeString(e3, t3) {
	        return this.parent && (t3 = this.parent._writeString(e3, t3)), e3[t3++] = `(${this.ruleId}, ${this.nameScopesList?.toString()}, ${this.contentNameScopesList?.toString()})`, t3;
	      }
	      withContentNameScopesList(e3) {
	        return this.contentNameScopesList === e3 ? this : this.parent.push(this.ruleId, this._enterPos, this._anchorPos, this.beginRuleCapturedEOL, this.endRule, this.nameScopesList, e3);
	      }
	      withEndRule(e3) {
	        return this.endRule === e3 ? this : new b(this.parent, this.ruleId, this._enterPos, this._anchorPos, this.beginRuleCapturedEOL, e3, this.nameScopesList, this.contentNameScopesList);
	      }
	      hasSameRuleAs(e3) {
	        let t3 = this;
	        for (; t3 && t3._enterPos === e3._enterPos; ) {
	          if (t3.ruleId === e3.ruleId)
	            return true;
	          t3 = t3.parent;
	        }
	        return false;
	      }
	      toStateStackFrame() {
	        return { ruleId: a.ruleIdToNumber(this.ruleId), beginRuleCapturedEOL: this.beginRuleCapturedEOL, endRule: this.endRule, nameScopesList: this.nameScopesList?.getExtensionIfDefined(this.parent?.nameScopesList ?? null) ?? [], contentNameScopesList: this.contentNameScopesList?.getExtensionIfDefined(this.nameScopesList) ?? [] };
	      }
	      static pushFrame(e3, t3) {
	        const n2 = _.fromExtension(e3?.nameScopesList ?? null, t3.nameScopesList);
	        return new b(e3, a.ruleIdFromNumber(t3.ruleId), t3.enterPos ?? -1, t3.anchorPos ?? -1, t3.beginRuleCapturedEOL, t3.endRule, n2, _.fromExtension(n2, t3.contentNameScopesList));
	      }
	    }
	    t2.StateStackImpl = b, b.NULL = new b(null, 0, 0, 0, false, null, null, null), t2.BalancedBracketSelectors = class {
	      constructor(e3, t3) {
	        this.allowAny = false, this.balancedBracketScopes = e3.flatMap((e4) => "*" === e4 ? (this.allowAny = true, []) : i.createMatchers(e4, d).map((e5) => e5.matcher)), this.unbalancedBracketScopes = t3.flatMap((e4) => i.createMatchers(e4, d).map((e5) => e5.matcher));
	      }
	      get matchesAlways() {
	        return this.allowAny && 0 === this.unbalancedBracketScopes.length;
	      }
	      get matchesNever() {
	        return 0 === this.balancedBracketScopes.length && !this.allowAny;
	      }
	      match(e3) {
	        for (const t3 of this.unbalancedBracketScopes)
	          if (t3(e3))
	            return false;
	        for (const t3 of this.balancedBracketScopes)
	          if (t3(e3))
	            return true;
	        return this.allowAny;
	      }
	    };
	    class y {
	      constructor(e3, t3, n2, r2) {
	        this.balancedBracketSelectors = r2, this._emitBinaryTokens = e3, this._tokenTypeOverrides = n2, s.DebugFlags.InDebugMode ? this._lineText = t3 : this._lineText = null, this._tokens = [], this._binaryTokens = [], this._lastTokenEndIndex = 0;
	      }
	      produce(e3, t3) {
	        this.produceFromScopes(e3.contentNameScopesList, t3);
	      }
	      produceFromScopes(e3, t3) {
	        if (this._lastTokenEndIndex >= t3)
	          return;
	        if (this._emitBinaryTokens) {
	          let n3 = e3?.tokenAttributes ?? 0, i2 = false;
	          if (this.balancedBracketSelectors?.matchesAlways && (i2 = true), this._tokenTypeOverrides.length > 0 || this.balancedBracketSelectors && !this.balancedBracketSelectors.matchesAlways && !this.balancedBracketSelectors.matchesNever) {
	            const t4 = e3?.getScopeNames() ?? [];
	            for (const e4 of this._tokenTypeOverrides)
	              e4.matcher(t4) && (n3 = r.EncodedTokenAttributes.set(n3, 0, r.toOptionalTokenType(e4.type), null, -1, 0, 0));
	            this.balancedBracketSelectors && (i2 = this.balancedBracketSelectors.match(t4));
	          }
	          if (i2 && (n3 = r.EncodedTokenAttributes.set(n3, 0, 8, i2, -1, 0, 0)), this._binaryTokens.length > 0 && this._binaryTokens[this._binaryTokens.length - 1] === n3)
	            return void (this._lastTokenEndIndex = t3);
	          if (s.DebugFlags.InDebugMode) {
	            const n4 = e3?.getScopeNames() ?? [];
	            console.log("  token: |" + this._lineText.substring(this._lastTokenEndIndex, t3).replace(/\n$/, "\\n") + "|");
	            for (let e4 = 0; e4 < n4.length; e4++)
	              console.log("      * " + n4[e4]);
	          }
	          return this._binaryTokens.push(this._lastTokenEndIndex), this._binaryTokens.push(n3), void (this._lastTokenEndIndex = t3);
	        }
	        const n2 = e3?.getScopeNames() ?? [];
	        if (s.DebugFlags.InDebugMode) {
	          console.log("  token: |" + this._lineText.substring(this._lastTokenEndIndex, t3).replace(/\n$/, "\\n") + "|");
	          for (let e4 = 0; e4 < n2.length; e4++)
	            console.log("      * " + n2[e4]);
	        }
	        this._tokens.push({ startIndex: this._lastTokenEndIndex, endIndex: t3, scopes: n2 }), this._lastTokenEndIndex = t3;
	      }
	      getResult(e3, t3) {
	        return this._tokens.length > 0 && this._tokens[this._tokens.length - 1].startIndex === t3 - 1 && this._tokens.pop(), 0 === this._tokens.length && (this._lastTokenEndIndex = -1, this.produce(e3, t3), this._tokens[this._tokens.length - 1].startIndex = 0), this._tokens;
	      }
	      getBinaryResult(e3, t3) {
	        this._binaryTokens.length > 0 && this._binaryTokens[this._binaryTokens.length - 2] === t3 - 1 && (this._binaryTokens.pop(), this._binaryTokens.pop()), 0 === this._binaryTokens.length && (this._lastTokenEndIndex = -1, this.produce(e3, t3), this._binaryTokens[this._binaryTokens.length - 2] = 0);
	        const n2 = new Uint32Array(this._binaryTokens.length);
	        for (let e4 = 0, t4 = this._binaryTokens.length; e4 < t4; e4++)
	          n2[e4] = this._binaryTokens[e4];
	        return n2;
	      }
	    }
	    t2.LineTokens = y;
	  }, 965: (e2, t2, n) => {
	    Object.defineProperty(t2, "__esModule", { value: true }), t2.parseInclude = t2.TopLevelRepositoryReference = t2.TopLevelReference = t2.RelativeReference = t2.SelfReference = t2.BaseReference = t2.ScopeDependencyProcessor = t2.ExternalReferenceCollector = t2.TopLevelRepositoryRuleReference = t2.TopLevelRuleReference = void 0;
	    const s = n(878);
	    class r {
	      constructor(e3) {
	        this.scopeName = e3;
	      }
	      toKey() {
	        return this.scopeName;
	      }
	    }
	    t2.TopLevelRuleReference = r;
	    class i {
	      constructor(e3, t3) {
	        this.scopeName = e3, this.ruleName = t3;
	      }
	      toKey() {
	        return `${this.scopeName}#${this.ruleName}`;
	      }
	    }
	    t2.TopLevelRepositoryRuleReference = i;
	    class o {
	      constructor() {
	        this._references = [], this._seenReferenceKeys = /* @__PURE__ */ new Set(), this.visitedRule = /* @__PURE__ */ new Set();
	      }
	      get references() {
	        return this._references;
	      }
	      add(e3) {
	        const t3 = e3.toKey();
	        this._seenReferenceKeys.has(t3) || (this._seenReferenceKeys.add(t3), this._references.push(e3));
	      }
	    }
	    function a(e3, t3, n2, s2) {
	      const i2 = n2.lookup(e3.scopeName);
	      if (!i2) {
	        if (e3.scopeName === t3)
	          throw new Error(`No grammar provided for <${t3}>`);
	        return;
	      }
	      const o2 = n2.lookup(t3);
	      e3 instanceof r ? l({ baseGrammar: o2, selfGrammar: i2 }, s2) : c(e3.ruleName, { baseGrammar: o2, selfGrammar: i2, repository: i2.repository }, s2);
	      const a2 = n2.injections(e3.scopeName);
	      if (a2)
	        for (const e4 of a2)
	          s2.add(new r(e4));
	    }
	    function c(e3, t3, n2) {
	      t3.repository && t3.repository[e3] && u([t3.repository[e3]], t3, n2);
	    }
	    function l(e3, t3) {
	      e3.selfGrammar.patterns && Array.isArray(e3.selfGrammar.patterns) && u(e3.selfGrammar.patterns, { ...e3, repository: e3.selfGrammar.repository }, t3), e3.selfGrammar.injections && u(Object.values(e3.selfGrammar.injections), { ...e3, repository: e3.selfGrammar.repository }, t3);
	    }
	    function u(e3, t3, n2) {
	      for (const o2 of e3) {
	        if (n2.visitedRule.has(o2))
	          continue;
	        n2.visitedRule.add(o2);
	        const e4 = o2.repository ? s.mergeObjects({}, t3.repository, o2.repository) : t3.repository;
	        Array.isArray(o2.patterns) && u(o2.patterns, { ...t3, repository: e4 }, n2);
	        const a2 = o2.include;
	        if (!a2)
	          continue;
	        const h2 = g(a2);
	        switch (h2.kind) {
	          case 0:
	            l({ ...t3, selfGrammar: t3.baseGrammar }, n2);
	            break;
	          case 1:
	            l(t3, n2);
	            break;
	          case 2:
	            c(h2.ruleName, { ...t3, repository: e4 }, n2);
	            break;
	          case 3:
	          case 4:
	            const s2 = h2.scopeName === t3.selfGrammar.scopeName ? t3.selfGrammar : h2.scopeName === t3.baseGrammar.scopeName ? t3.baseGrammar : void 0;
	            if (s2) {
	              const r2 = { baseGrammar: t3.baseGrammar, selfGrammar: s2, repository: e4 };
	              4 === h2.kind ? c(h2.ruleName, r2, n2) : l(r2, n2);
	            } else
	              4 === h2.kind ? n2.add(new i(h2.scopeName, h2.ruleName)) : n2.add(new r(h2.scopeName));
	        }
	      }
	    }
	    t2.ExternalReferenceCollector = o, t2.ScopeDependencyProcessor = class {
	      constructor(e3, t3) {
	        this.repo = e3, this.initialScopeName = t3, this.seenFullScopeRequests = /* @__PURE__ */ new Set(), this.seenPartialScopeRequests = /* @__PURE__ */ new Set(), this.seenFullScopeRequests.add(this.initialScopeName), this.Q = [new r(this.initialScopeName)];
	      }
	      processQueue() {
	        const e3 = this.Q;
	        this.Q = [];
	        const t3 = new o();
	        for (const n2 of e3)
	          a(n2, this.initialScopeName, this.repo, t3);
	        for (const e4 of t3.references)
	          if (e4 instanceof r) {
	            if (this.seenFullScopeRequests.has(e4.scopeName))
	              continue;
	            this.seenFullScopeRequests.add(e4.scopeName), this.Q.push(e4);
	          } else {
	            if (this.seenFullScopeRequests.has(e4.scopeName))
	              continue;
	            if (this.seenPartialScopeRequests.has(e4.toKey()))
	              continue;
	            this.seenPartialScopeRequests.add(e4.toKey()), this.Q.push(e4);
	          }
	      }
	    };
	    class h {
	      constructor() {
	        this.kind = 0;
	      }
	    }
	    t2.BaseReference = h;
	    class p {
	      constructor() {
	        this.kind = 1;
	      }
	    }
	    t2.SelfReference = p;
	    class d {
	      constructor(e3) {
	        this.ruleName = e3, this.kind = 2;
	      }
	    }
	    t2.RelativeReference = d;
	    class f {
	      constructor(e3) {
	        this.scopeName = e3, this.kind = 3;
	      }
	    }
	    t2.TopLevelReference = f;
	    class m {
	      constructor(e3, t3) {
	        this.scopeName = e3, this.ruleName = t3, this.kind = 4;
	      }
	    }
	    function g(e3) {
	      if ("$base" === e3)
	        return new h();
	      if ("$self" === e3)
	        return new p();
	      const t3 = e3.indexOf("#");
	      if (-1 === t3)
	        return new f(e3);
	      if (0 === t3)
	        return new d(e3.substring(1));
	      {
	        const n2 = e3.substring(0, t3), s2 = e3.substring(t3 + 1);
	        return new m(n2, s2);
	      }
	    }
	    t2.TopLevelRepositoryReference = m, t2.parseInclude = g;
	  }, 391: function(e2, t2, n) {
	    var s = this && this.__createBinding || (Object.create ? function(e3, t3, n2, s2) {
	      void 0 === s2 && (s2 = n2), Object.defineProperty(e3, s2, { enumerable: true, get: function() {
	        return t3[n2];
	      } });
	    } : function(e3, t3, n2, s2) {
	      void 0 === s2 && (s2 = n2), e3[s2] = t3[n2];
	    }), r = this && this.__exportStar || function(e3, t3) {
	      for (var n2 in e3)
	        "default" === n2 || Object.prototype.hasOwnProperty.call(t3, n2) || s(t3, e3, n2);
	    };
	    Object.defineProperty(t2, "__esModule", { value: true }), r(n(947), t2);
	  }, 47: (e2, t2, n) => {
	    Object.defineProperty(t2, "__esModule", { value: true }), t2.LocalStackElement = t2._tokenizeString = void 0;
	    const s = n(350), r = n(44), i = n(792), o = n(878);
	    class a {
	      constructor(e3, t3) {
	        this.stack = e3, this.stoppedEarly = t3;
	      }
	    }
	    function c(e3, t3, n2, r2, c2, h2, d2, f) {
	      const m = t3.content.length;
	      let g = false, _ = -1;
	      if (d2) {
	        const o2 = function(e4, t4, n3, r3, o3, a2) {
	          let c3 = o3.beginRuleCapturedEOL ? 0 : -1;
	          const l2 = [];
	          for (let t5 = o3; t5; t5 = t5.pop()) {
	            const n4 = t5.getRule(e4);
	            n4 instanceof i.BeginWhileRule && l2.push({ rule: n4, stack: t5 });
	          }
	          for (let h3 = l2.pop(); h3; h3 = l2.pop()) {
	            const { ruleScanner: l3, findOptions: d3 } = u(h3.rule, e4, h3.stack.endRule, n3, r3 === c3), f2 = l3.findNextMatchSync(t4, r3, d3);
	            if (s.DebugFlags.InDebugMode && (console.log("  scanning for while rule"), console.log(l3.toString())), !f2) {
	              s.DebugFlags.InDebugMode && console.log("  popping " + h3.rule.debugName + " - " + h3.rule.debugWhileRegExp), o3 = h3.stack.pop();
	              break;
	            }
	            if (f2.ruleId !== i.whileRuleId) {
	              o3 = h3.stack.pop();
	              break;
	            }
	            f2.captureIndices && f2.captureIndices.length && (a2.produce(h3.stack, f2.captureIndices[0].start), p(e4, t4, n3, h3.stack, a2, h3.rule.whileCaptures, f2.captureIndices), a2.produce(h3.stack, f2.captureIndices[0].end), c3 = f2.captureIndices[0].end, f2.captureIndices[0].end > r3 && (r3 = f2.captureIndices[0].end, n3 = false));
	          }
	          return { stack: o3, linePos: r3, anchorPosition: c3, isFirstLine: n3 };
	        }(e3, t3, n2, r2, c2, h2);
	        c2 = o2.stack, r2 = o2.linePos, n2 = o2.isFirstLine, _ = o2.anchorPosition;
	      }
	      const b = Date.now();
	      for (; !g; ) {
	        if (0 !== f && Date.now() - b > f)
	          return new a(c2, true);
	        y();
	      }
	      return new a(c2, false);
	      function y() {
	        s.DebugFlags.InDebugMode && (console.log(""), console.log(`@@scanNext ${r2}: |${t3.content.substr(r2).replace(/\n$/, "\\n")}|`));
	        const a2 = function(e4, t4, n3, r3, i2, a3) {
	          const c3 = function(e5, t5, n4, r4, i3, a4) {
	            const c4 = i3.getRule(e5), { ruleScanner: u4, findOptions: h4 } = l(c4, e5, i3.endRule, n4, r4 === a4);
	            let p3 = 0;
	            s.DebugFlags.InDebugMode && (p3 = o.performanceNow());
	            const d5 = u4.findNextMatchSync(t5, r4, h4);
	            if (s.DebugFlags.InDebugMode) {
	              const e6 = o.performanceNow() - p3;
	              e6 > 5 && console.warn(`Rule ${c4.debugName} (${c4.id}) matching took ${e6} against '${t5}'`), console.log(`  scanning for (linePos: ${r4}, anchorPosition: ${a4})`), console.log(u4.toString()), d5 && console.log(`matched rule id: ${d5.ruleId} from ${d5.captureIndices[0].start} to ${d5.captureIndices[0].end}`);
	            }
	            return d5 ? { captureIndices: d5.captureIndices, matchedRuleId: d5.ruleId } : null;
	          }(e4, t4, n3, r3, i2, a3), u3 = e4.getInjections();
	          if (0 === u3.length)
	            return c3;
	          const h3 = function(e5, t5, n4, r4, i3, o2, a4) {
	            let c4, u4 = Number.MAX_VALUE, h4 = null, p3 = 0;
	            const d5 = o2.contentNameScopesList.getScopeNames();
	            for (let o3 = 0, f3 = e5.length; o3 < f3; o3++) {
	              const f4 = e5[o3];
	              if (!f4.matcher(d5))
	                continue;
	              const m2 = t5.getRule(f4.ruleId), { ruleScanner: g2, findOptions: _2 } = l(m2, t5, null, r4, i3 === a4), b2 = g2.findNextMatchSync(n4, i3, _2);
	              if (!b2)
	                continue;
	              s.DebugFlags.InDebugMode && (console.log(`  matched injection: ${f4.debugSelector}`), console.log(g2.toString()));
	              const y2 = b2.captureIndices[0].start;
	              if (!(y2 >= u4) && (u4 = y2, h4 = b2.captureIndices, c4 = b2.ruleId, p3 = f4.priority, u4 === i3))
	                break;
	            }
	            return h4 ? { priorityMatch: -1 === p3, captureIndices: h4, matchedRuleId: c4 } : null;
	          }(u3, e4, t4, n3, r3, i2, a3);
	          if (!h3)
	            return c3;
	          if (!c3)
	            return h3;
	          const p2 = c3.captureIndices[0].start, d4 = h3.captureIndices[0].start;
	          return d4 < p2 || h3.priorityMatch && d4 === p2 ? h3 : c3;
	        }(e3, t3, n2, r2, c2, _);
	        if (!a2)
	          return s.DebugFlags.InDebugMode && console.log("  no more matches."), h2.produce(c2, m), void (g = true);
	        const u2 = a2.captureIndices, d3 = a2.matchedRuleId, f2 = !!(u2 && u2.length > 0) && u2[0].end > r2;
	        if (d3 === i.endRuleId) {
	          const i2 = c2.getRule(e3);
	          s.DebugFlags.InDebugMode && console.log("  popping " + i2.debugName + " - " + i2.debugEndRegExp), h2.produce(c2, u2[0].start), c2 = c2.withContentNameScopesList(c2.nameScopesList), p(e3, t3, n2, c2, h2, i2.endCaptures, u2), h2.produce(c2, u2[0].end);
	          const o2 = c2;
	          if (c2 = c2.parent, _ = o2.getAnchorPos(), !f2 && o2.getEnterPos() === r2)
	            return s.DebugFlags.InDebugMode && console.error("[1] - Grammar is in an endless loop - Grammar pushed & popped a rule without advancing"), c2 = o2, h2.produce(c2, m), void (g = true);
	        } else {
	          const o2 = e3.getRule(d3);
	          h2.produce(c2, u2[0].start);
	          const a3 = c2, l2 = o2.getName(t3.content, u2), b2 = c2.contentNameScopesList.pushAttributed(l2, e3);
	          if (c2 = c2.push(d3, r2, _, u2[0].end === m, null, b2, b2), o2 instanceof i.BeginEndRule) {
	            const r3 = o2;
	            s.DebugFlags.InDebugMode && console.log("  pushing " + r3.debugName + " - " + r3.debugBeginRegExp), p(e3, t3, n2, c2, h2, r3.beginCaptures, u2), h2.produce(c2, u2[0].end), _ = u2[0].end;
	            const i2 = r3.getContentName(t3.content, u2), l3 = b2.pushAttributed(i2, e3);
	            if (c2 = c2.withContentNameScopesList(l3), r3.endHasBackReferences && (c2 = c2.withEndRule(r3.getEndWithResolvedBackReferences(t3.content, u2))), !f2 && a3.hasSameRuleAs(c2))
	              return s.DebugFlags.InDebugMode && console.error("[2] - Grammar is in an endless loop - Grammar pushed the same rule without advancing"), c2 = c2.pop(), h2.produce(c2, m), void (g = true);
	          } else if (o2 instanceof i.BeginWhileRule) {
	            const r3 = o2;
	            s.DebugFlags.InDebugMode && console.log("  pushing " + r3.debugName), p(e3, t3, n2, c2, h2, r3.beginCaptures, u2), h2.produce(c2, u2[0].end), _ = u2[0].end;
	            const i2 = r3.getContentName(t3.content, u2), l3 = b2.pushAttributed(i2, e3);
	            if (c2 = c2.withContentNameScopesList(l3), r3.whileHasBackReferences && (c2 = c2.withEndRule(r3.getWhileWithResolvedBackReferences(t3.content, u2))), !f2 && a3.hasSameRuleAs(c2))
	              return s.DebugFlags.InDebugMode && console.error("[3] - Grammar is in an endless loop - Grammar pushed the same rule without advancing"), c2 = c2.pop(), h2.produce(c2, m), void (g = true);
	          } else {
	            const r3 = o2;
	            if (s.DebugFlags.InDebugMode && console.log("  matched " + r3.debugName + " - " + r3.debugMatchRegExp), p(e3, t3, n2, c2, h2, r3.captures, u2), h2.produce(c2, u2[0].end), c2 = c2.pop(), !f2)
	              return s.DebugFlags.InDebugMode && console.error("[4] - Grammar is in an endless loop - Grammar is not advancing, nor is it pushing/popping"), c2 = c2.safePop(), h2.produce(c2, m), void (g = true);
	          }
	        }
	        u2[0].end > r2 && (r2 = u2[0].end, n2 = false);
	      }
	    }
	    function l(e3, t3, n2, r2, i2) {
	      return s.UseOnigurumaFindOptions ? { ruleScanner: e3.compile(t3, n2), findOptions: h(r2, i2) } : { ruleScanner: e3.compileAG(t3, n2, r2, i2), findOptions: 0 };
	    }
	    function u(e3, t3, n2, r2, i2) {
	      return s.UseOnigurumaFindOptions ? { ruleScanner: e3.compileWhile(t3, n2), findOptions: h(r2, i2) } : { ruleScanner: e3.compileWhileAG(t3, n2, r2, i2), findOptions: 0 };
	    }
	    function h(e3, t3) {
	      let n2 = 0;
	      return e3 || (n2 |= 1), t3 || (n2 |= 4), n2;
	    }
	    function p(e3, t3, n2, s2, i2, o2, a2) {
	      if (0 === o2.length)
	        return;
	      const l2 = t3.content, u2 = Math.min(o2.length, a2.length), h2 = [], p2 = a2[0].end;
	      for (let t4 = 0; t4 < u2; t4++) {
	        const u3 = o2[t4];
	        if (null === u3)
	          continue;
	        const f = a2[t4];
	        if (0 === f.length)
	          continue;
	        if (f.start > p2)
	          break;
	        for (; h2.length > 0 && h2[h2.length - 1].endPos <= f.start; )
	          i2.produceFromScopes(h2[h2.length - 1].scopes, h2[h2.length - 1].endPos), h2.pop();
	        if (h2.length > 0 ? i2.produceFromScopes(h2[h2.length - 1].scopes, f.start) : i2.produce(s2, f.start), u3.retokenizeCapturedWithRuleId) {
	          const t5 = u3.getName(l2, a2), o3 = s2.contentNameScopesList.pushAttributed(t5, e3), h3 = u3.getContentName(l2, a2), p3 = o3.pushAttributed(h3, e3), d2 = s2.push(u3.retokenizeCapturedWithRuleId, f.start, -1, false, null, o3, p3), m2 = e3.createOnigString(l2.substring(0, f.end));
	          c(e3, m2, n2 && 0 === f.start, f.start, d2, i2, false, 0), r.disposeOnigString(m2);
	          continue;
	        }
	        const m = u3.getName(l2, a2);
	        if (null !== m) {
	          const t5 = (h2.length > 0 ? h2[h2.length - 1].scopes : s2.contentNameScopesList).pushAttributed(m, e3);
	          h2.push(new d(t5, f.end));
	        }
	      }
	      for (; h2.length > 0; )
	        i2.produceFromScopes(h2[h2.length - 1].scopes, h2[h2.length - 1].endPos), h2.pop();
	    }
	    t2._tokenizeString = c;
	    class d {
	      constructor(e3, t3) {
	        this.scopes = e3, this.endPos = t3;
	      }
	    }
	    t2.LocalStackElement = d;
	  }, 974: (e2, t2) => {
	    function n(e3, t3) {
	      throw new Error("Near offset " + e3.pos + ": " + t3 + " ~~~" + e3.source.substr(e3.pos, 50) + "~~~");
	    }
	    Object.defineProperty(t2, "__esModule", { value: true }), t2.parseJSON = void 0, t2.parseJSON = function(e3, t3, o) {
	      let a = new s(e3), c = new r(), l = 0, u = null, h = [], p = [];
	      function d() {
	        h.push(l), p.push(u);
	      }
	      function f() {
	        l = h.pop(), u = p.pop();
	      }
	      function m(e4) {
	        n(a, e4);
	      }
	      for (; i(a, c); ) {
	        if (0 === l) {
	          if (null !== u && m("too many constructs in root"), 3 === c.type) {
	            u = {}, o && (u.$vscodeTextmateLocation = c.toLocation(t3)), d(), l = 1;
	            continue;
	          }
	          if (2 === c.type) {
	            u = [], d(), l = 4;
	            continue;
	          }
	          m("unexpected token in root");
	        }
	        if (2 === l) {
	          if (5 === c.type) {
	            f();
	            continue;
	          }
	          if (7 === c.type) {
	            l = 3;
	            continue;
	          }
	          m("expected , or }");
	        }
	        if (1 === l || 3 === l) {
	          if (1 === l && 5 === c.type) {
	            f();
	            continue;
	          }
	          if (1 === c.type) {
	            let e4 = c.value;
	            if (i(a, c) && 6 === c.type || m("expected colon"), i(a, c) || m("expected value"), l = 2, 1 === c.type) {
	              u[e4] = c.value;
	              continue;
	            }
	            if (8 === c.type) {
	              u[e4] = null;
	              continue;
	            }
	            if (9 === c.type) {
	              u[e4] = true;
	              continue;
	            }
	            if (10 === c.type) {
	              u[e4] = false;
	              continue;
	            }
	            if (11 === c.type) {
	              u[e4] = parseFloat(c.value);
	              continue;
	            }
	            if (2 === c.type) {
	              let t4 = [];
	              u[e4] = t4, d(), l = 4, u = t4;
	              continue;
	            }
	            if (3 === c.type) {
	              let n2 = {};
	              o && (n2.$vscodeTextmateLocation = c.toLocation(t3)), u[e4] = n2, d(), l = 1, u = n2;
	              continue;
	            }
	          }
	          m("unexpected token in dict");
	        }
	        if (5 === l) {
	          if (4 === c.type) {
	            f();
	            continue;
	          }
	          if (7 === c.type) {
	            l = 6;
	            continue;
	          }
	          m("expected , or ]");
	        }
	        if (4 === l || 6 === l) {
	          if (4 === l && 4 === c.type) {
	            f();
	            continue;
	          }
	          if (l = 5, 1 === c.type) {
	            u.push(c.value);
	            continue;
	          }
	          if (8 === c.type) {
	            u.push(null);
	            continue;
	          }
	          if (9 === c.type) {
	            u.push(true);
	            continue;
	          }
	          if (10 === c.type) {
	            u.push(false);
	            continue;
	          }
	          if (11 === c.type) {
	            u.push(parseFloat(c.value));
	            continue;
	          }
	          if (2 === c.type) {
	            let e4 = [];
	            u.push(e4), d(), l = 4, u = e4;
	            continue;
	          }
	          if (3 === c.type) {
	            let e4 = {};
	            o && (e4.$vscodeTextmateLocation = c.toLocation(t3)), u.push(e4), d(), l = 1, u = e4;
	            continue;
	          }
	          m("unexpected token in array");
	        }
	        m("unknown state");
	      }
	      return 0 !== p.length && m("unclosed constructs"), u;
	    };
	    class s {
	      constructor(e3) {
	        this.source = e3, this.pos = 0, this.len = e3.length, this.line = 1, this.char = 0;
	      }
	    }
	    class r {
	      constructor() {
	        this.value = null, this.type = 0, this.offset = -1, this.len = -1, this.line = -1, this.char = -1;
	      }
	      toLocation(e3) {
	        return { filename: e3, line: this.line, char: this.char };
	      }
	    }
	    function i(e3, t3) {
	      t3.value = null, t3.type = 0, t3.offset = -1, t3.len = -1, t3.line = -1, t3.char = -1;
	      let s2, r2 = e3.source, i2 = e3.pos, o = e3.len, a = e3.line, c = e3.char;
	      for (; ; ) {
	        if (i2 >= o)
	          return false;
	        if (s2 = r2.charCodeAt(i2), 32 !== s2 && 9 !== s2 && 13 !== s2) {
	          if (10 !== s2)
	            break;
	          i2++, a++, c = 0;
	        } else
	          i2++, c++;
	      }
	      if (t3.offset = i2, t3.line = a, t3.char = c, 34 === s2) {
	        for (t3.type = 1, i2++, c++; ; ) {
	          if (i2 >= o)
	            return false;
	          if (s2 = r2.charCodeAt(i2), i2++, c++, 92 !== s2) {
	            if (34 === s2)
	              break;
	          } else
	            i2++, c++;
	        }
	        t3.value = r2.substring(t3.offset + 1, i2 - 1).replace(/\\u([0-9A-Fa-f]{4})/g, (e4, t4) => String.fromCodePoint(parseInt(t4, 16))).replace(/\\(.)/g, (t4, s3) => {
	          switch (s3) {
	            case '"':
	              return '"';
	            case "\\":
	              return "\\";
	            case "/":
	              return "/";
	            case "b":
	              return "\b";
	            case "f":
	              return "\f";
	            case "n":
	              return "\n";
	            case "r":
	              return "\r";
	            case "t":
	              return "	";
	            default:
	              n(e3, "invalid escape sequence");
	          }
	          throw new Error("unreachable");
	        });
	      } else if (91 === s2)
	        t3.type = 2, i2++, c++;
	      else if (123 === s2)
	        t3.type = 3, i2++, c++;
	      else if (93 === s2)
	        t3.type = 4, i2++, c++;
	      else if (125 === s2)
	        t3.type = 5, i2++, c++;
	      else if (58 === s2)
	        t3.type = 6, i2++, c++;
	      else if (44 === s2)
	        t3.type = 7, i2++, c++;
	      else if (110 === s2) {
	        if (t3.type = 8, i2++, c++, s2 = r2.charCodeAt(i2), 117 !== s2)
	          return false;
	        if (i2++, c++, s2 = r2.charCodeAt(i2), 108 !== s2)
	          return false;
	        if (i2++, c++, s2 = r2.charCodeAt(i2), 108 !== s2)
	          return false;
	        i2++, c++;
	      } else if (116 === s2) {
	        if (t3.type = 9, i2++, c++, s2 = r2.charCodeAt(i2), 114 !== s2)
	          return false;
	        if (i2++, c++, s2 = r2.charCodeAt(i2), 117 !== s2)
	          return false;
	        if (i2++, c++, s2 = r2.charCodeAt(i2), 101 !== s2)
	          return false;
	        i2++, c++;
	      } else if (102 === s2) {
	        if (t3.type = 10, i2++, c++, s2 = r2.charCodeAt(i2), 97 !== s2)
	          return false;
	        if (i2++, c++, s2 = r2.charCodeAt(i2), 108 !== s2)
	          return false;
	        if (i2++, c++, s2 = r2.charCodeAt(i2), 115 !== s2)
	          return false;
	        if (i2++, c++, s2 = r2.charCodeAt(i2), 101 !== s2)
	          return false;
	        i2++, c++;
	      } else
	        for (t3.type = 11; ; ) {
	          if (i2 >= o)
	            return false;
	          if (s2 = r2.charCodeAt(i2), !(46 === s2 || s2 >= 48 && s2 <= 57 || 101 === s2 || 69 === s2 || 45 === s2 || 43 === s2))
	            break;
	          i2++, c++;
	        }
	      return t3.len = i2 - t3.offset, null === t3.value && (t3.value = r2.substr(t3.offset, t3.len)), e3.pos = i2, e3.line = a, e3.char = c, true;
	    }
	  }, 787: function(e2, t2, n) {
	    var s = this && this.__createBinding || (Object.create ? function(e3, t3, n2, s2) {
	      void 0 === s2 && (s2 = n2), Object.defineProperty(e3, s2, { enumerable: true, get: function() {
	        return t3[n2];
	      } });
	    } : function(e3, t3, n2, s2) {
	      void 0 === s2 && (s2 = n2), e3[s2] = t3[n2];
	    }), r = this && this.__exportStar || function(e3, t3) {
	      for (var n2 in e3)
	        "default" === n2 || Object.prototype.hasOwnProperty.call(t3, n2) || s(t3, e3, n2);
	    };
	    Object.defineProperty(t2, "__esModule", { value: true }), t2.applyStateStackDiff = t2.diffStateStacksRefEq = t2.parseRawGrammar = t2.INITIAL = t2.Registry = void 0;
	    const i = n(391), o = n(50), a = n(652), c = n(583), l = n(965), u = n(442);
	    Object.defineProperty(t2, "applyStateStackDiff", { enumerable: true, get: function() {
	      return u.applyStateStackDiff;
	    } }), Object.defineProperty(t2, "diffStateStacksRefEq", { enumerable: true, get: function() {
	      return u.diffStateStacksRefEq;
	    } }), r(n(44), t2), t2.Registry = class {
	      constructor(e3) {
	        this._options = e3, this._syncRegistry = new a.SyncRegistry(c.Theme.createFromRawTheme(e3.theme, e3.colorMap), e3.onigLib), this._ensureGrammarCache = /* @__PURE__ */ new Map();
	      }
	      dispose() {
	        this._syncRegistry.dispose();
	      }
	      setTheme(e3, t3) {
	        this._syncRegistry.setTheme(c.Theme.createFromRawTheme(e3, t3));
	      }
	      getColorMap() {
	        return this._syncRegistry.getColorMap();
	      }
	      loadGrammarWithEmbeddedLanguages(e3, t3, n2) {
	        return this.loadGrammarWithConfiguration(e3, t3, { embeddedLanguages: n2 });
	      }
	      loadGrammarWithConfiguration(e3, t3, n2) {
	        return this._loadGrammar(e3, t3, n2.embeddedLanguages, n2.tokenTypes, new i.BalancedBracketSelectors(n2.balancedBracketSelectors || [], n2.unbalancedBracketSelectors || []));
	      }
	      loadGrammar(e3) {
	        return this._loadGrammar(e3, 0, null, null, null);
	      }
	      async _loadGrammar(e3, t3, n2, s2, r2) {
	        const i2 = new l.ScopeDependencyProcessor(this._syncRegistry, e3);
	        for (; i2.Q.length > 0; )
	          await Promise.all(i2.Q.map((e4) => this._loadSingleGrammar(e4.scopeName))), i2.processQueue();
	        return this._grammarForScopeName(e3, t3, n2, s2, r2);
	      }
	      async _loadSingleGrammar(e3) {
	        return this._ensureGrammarCache.has(e3) || this._ensureGrammarCache.set(e3, this._doLoadSingleGrammar(e3)), this._ensureGrammarCache.get(e3);
	      }
	      async _doLoadSingleGrammar(e3) {
	        const t3 = await this._options.loadGrammar(e3);
	        if (t3) {
	          const n2 = "function" == typeof this._options.getInjections ? this._options.getInjections(e3) : void 0;
	          this._syncRegistry.addGrammar(t3, n2);
	        }
	      }
	      async addGrammar(e3, t3 = [], n2 = 0, s2 = null) {
	        return this._syncRegistry.addGrammar(e3, t3), await this._grammarForScopeName(e3.scopeName, n2, s2);
	      }
	      _grammarForScopeName(e3, t3 = 0, n2 = null, s2 = null, r2 = null) {
	        return this._syncRegistry.grammarForScopeName(e3, t3, n2, s2, r2);
	      }
	    }, t2.INITIAL = i.StateStackImpl.NULL, t2.parseRawGrammar = o.parseRawGrammar;
	  }, 736: (e2, t2) => {
	    function n(e3) {
	      return !!e3 && !!e3.match(/[\w\.:]+/);
	    }
	    Object.defineProperty(t2, "__esModule", { value: true }), t2.createMatchers = void 0, t2.createMatchers = function(e3, t3) {
	      const s = [], r = function(e4) {
	        let t4 = /([LR]:|[\w\.:][\w\.:\-]*|[\,\|\-\(\)])/g, n2 = t4.exec(e4);
	        return { next: () => {
	          if (!n2)
	            return null;
	          const s2 = n2[0];
	          return n2 = t4.exec(e4), s2;
	        } };
	      }(e3);
	      let i = r.next();
	      for (; null !== i; ) {
	        let e4 = 0;
	        if (2 === i.length && ":" === i.charAt(1)) {
	          switch (i.charAt(0)) {
	            case "R":
	              e4 = 1;
	              break;
	            case "L":
	              e4 = -1;
	              break;
	            default:
	              console.log(`Unknown priority ${i} in scope selector`);
	          }
	          i = r.next();
	        }
	        let t4 = a();
	        if (s.push({ matcher: t4, priority: e4 }), "," !== i)
	          break;
	        i = r.next();
	      }
	      return s;
	      function o() {
	        if ("-" === i) {
	          i = r.next();
	          const e4 = o();
	          return (t4) => !!e4 && !e4(t4);
	        }
	        if ("(" === i) {
	          i = r.next();
	          const e4 = function() {
	            const e5 = [];
	            let t4 = a();
	            for (; t4 && (e5.push(t4), "|" === i || "," === i); ) {
	              do {
	                i = r.next();
	              } while ("|" === i || "," === i);
	              t4 = a();
	            }
	            return (t5) => e5.some((e6) => e6(t5));
	          }();
	          return ")" === i && (i = r.next()), e4;
	        }
	        if (n(i)) {
	          const e4 = [];
	          do {
	            e4.push(i), i = r.next();
	          } while (n(i));
	          return (n2) => t3(e4, n2);
	        }
	        return null;
	      }
	      function a() {
	        const e4 = [];
	        let t4 = o();
	        for (; t4; )
	          e4.push(t4), t4 = o();
	        return (t5) => e4.every((e5) => e5(t5));
	      }
	    };
	  }, 44: (e2, t2) => {
	    Object.defineProperty(t2, "__esModule", { value: true }), t2.disposeOnigString = void 0, t2.disposeOnigString = function(e3) {
	      "function" == typeof e3.dispose && e3.dispose();
	    };
	  }, 50: (e2, t2, n) => {
	    Object.defineProperty(t2, "__esModule", { value: true }), t2.parseRawGrammar = void 0;
	    const s = n(69), r = n(350), i = n(974);
	    t2.parseRawGrammar = function(e3, t3 = null) {
	      return null !== t3 && /\.json$/.test(t3) ? (n2 = e3, o = t3, r.DebugFlags.InDebugMode ? i.parseJSON(n2, o, true) : JSON.parse(n2)) : function(e4, t4) {
	        return r.DebugFlags.InDebugMode ? s.parseWithLocation(e4, t4, "$vscodeTextmateLocation") : s.parsePLIST(e4);
	      }(e3, t3);
	      var n2, o;
	    };
	  }, 69: (e2, t2) => {
	    function n(e3, t3, n2) {
	      const s = e3.length;
	      let r = 0, i = 1, o = 0;
	      function a(t4) {
	        if (null === n2)
	          r += t4;
	        else
	          for (; t4 > 0; )
	            10 === e3.charCodeAt(r) ? (r++, i++, o = 0) : (r++, o++), t4--;
	      }
	      function c(e4) {
	        null === n2 ? r = e4 : a(e4 - r);
	      }
	      function l() {
	        for (; r < s; ) {
	          let t4 = e3.charCodeAt(r);
	          if (32 !== t4 && 9 !== t4 && 13 !== t4 && 10 !== t4)
	            break;
	          a(1);
	        }
	      }
	      function u(t4) {
	        return e3.substr(r, t4.length) === t4 && (a(t4.length), true);
	      }
	      function h(t4) {
	        let n3 = e3.indexOf(t4, r);
	        c(-1 !== n3 ? n3 + t4.length : s);
	      }
	      function p(t4) {
	        let n3 = e3.indexOf(t4, r);
	        if (-1 !== n3) {
	          let s2 = e3.substring(r, n3);
	          return c(n3 + t4.length), s2;
	        }
	        {
	          let t5 = e3.substr(r);
	          return c(s), t5;
	        }
	      }
	      s > 0 && 65279 === e3.charCodeAt(0) && (r = 1);
	      let d = 0, f = null, m = [], g = [], _ = null;
	      function b(e4, t4) {
	        m.push(d), g.push(f), d = e4, f = t4;
	      }
	      function y() {
	        if (0 === m.length)
	          return S("illegal state stack");
	        d = m.pop(), f = g.pop();
	      }
	      function S(t4) {
	        throw new Error("Near offset " + r + ": " + t4 + " ~~~" + e3.substr(r, 50) + "~~~");
	      }
	      const k = function() {
	        if (null === _)
	          return S("missing <key>");
	        let e4 = {};
	        null !== n2 && (e4[n2] = { filename: t3, line: i, char: o }), f[_] = e4, _ = null, b(1, e4);
	      }, C = function() {
	        if (null === _)
	          return S("missing <key>");
	        let e4 = [];
	        f[_] = e4, _ = null, b(2, e4);
	      }, R = function() {
	        let e4 = {};
	        null !== n2 && (e4[n2] = { filename: t3, line: i, char: o }), f.push(e4), b(1, e4);
	      }, A = function() {
	        let e4 = [];
	        f.push(e4), b(2, e4);
	      };
	      function w() {
	        if (1 !== d)
	          return S("unexpected </dict>");
	        y();
	      }
	      function P() {
	        return 1 === d || 2 !== d ? S("unexpected </array>") : void y();
	      }
	      function I(e4) {
	        if (1 === d) {
	          if (null === _)
	            return S("missing <key>");
	          f[_] = e4, _ = null;
	        } else
	          2 === d ? f.push(e4) : f = e4;
	      }
	      function v(e4) {
	        if (isNaN(e4))
	          return S("cannot parse float");
	        if (1 === d) {
	          if (null === _)
	            return S("missing <key>");
	          f[_] = e4, _ = null;
	        } else
	          2 === d ? f.push(e4) : f = e4;
	      }
	      function N(e4) {
	        if (isNaN(e4))
	          return S("cannot parse integer");
	        if (1 === d) {
	          if (null === _)
	            return S("missing <key>");
	          f[_] = e4, _ = null;
	        } else
	          2 === d ? f.push(e4) : f = e4;
	      }
	      function x(e4) {
	        if (1 === d) {
	          if (null === _)
	            return S("missing <key>");
	          f[_] = e4, _ = null;
	        } else
	          2 === d ? f.push(e4) : f = e4;
	      }
	      function T(e4) {
	        if (1 === d) {
	          if (null === _)
	            return S("missing <key>");
	          f[_] = e4, _ = null;
	        } else
	          2 === d ? f.push(e4) : f = e4;
	      }
	      function G(e4) {
	        if (1 === d) {
	          if (null === _)
	            return S("missing <key>");
	          f[_] = e4, _ = null;
	        } else
	          2 === d ? f.push(e4) : f = e4;
	      }
	      function E() {
	        let e4 = p(">"), t4 = false;
	        return 47 === e4.charCodeAt(e4.length - 1) && (t4 = true, e4 = e4.substring(0, e4.length - 1)), { name: e4.trim(), isClosed: t4 };
	      }
	      function L(e4) {
	        if (e4.isClosed)
	          return "";
	        let t4 = p("</");
	        return h(">"), t4.replace(/&#([0-9]+);/g, function(e5, t5) {
	          return String.fromCodePoint(parseInt(t5, 10));
	        }).replace(/&#x([0-9a-f]+);/g, function(e5, t5) {
	          return String.fromCodePoint(parseInt(t5, 16));
	        }).replace(/&amp;|&lt;|&gt;|&quot;|&apos;/g, function(e5) {
	          switch (e5) {
	            case "&amp;":
	              return "&";
	            case "&lt;":
	              return "<";
	            case "&gt;":
	              return ">";
	            case "&quot;":
	              return '"';
	            case "&apos;":
	              return "'";
	          }
	          return e5;
	        });
	      }
	      for (; r < s && (l(), !(r >= s)); ) {
	        const c2 = e3.charCodeAt(r);
	        if (a(1), 60 !== c2)
	          return S("expected <");
	        if (r >= s)
	          return S("unexpected end of input");
	        const p2 = e3.charCodeAt(r);
	        if (63 === p2) {
	          a(1), h("?>");
	          continue;
	        }
	        if (33 === p2) {
	          if (a(1), u("--")) {
	            h("-->");
	            continue;
	          }
	          h(">");
	          continue;
	        }
	        if (47 === p2) {
	          if (a(1), l(), u("plist")) {
	            h(">");
	            continue;
	          }
	          if (u("dict")) {
	            h(">"), w();
	            continue;
	          }
	          if (u("array")) {
	            h(">"), P();
	            continue;
	          }
	          return S("unexpected closed tag");
	        }
	        let m2 = E();
	        switch (m2.name) {
	          case "dict":
	            1 === d ? k() : 2 === d ? R() : (f = {}, null !== n2 && (f[n2] = { filename: t3, line: i, char: o }), b(1, f)), m2.isClosed && w();
	            continue;
	          case "array":
	            1 === d ? C() : 2 === d ? A() : (f = [], b(2, f)), m2.isClosed && P();
	            continue;
	          case "key":
	            M = L(m2), 1 !== d ? S("unexpected <key>") : null !== _ ? S("too many <key>") : _ = M;
	            continue;
	          case "string":
	            I(L(m2));
	            continue;
	          case "real":
	            v(parseFloat(L(m2)));
	            continue;
	          case "integer":
	            N(parseInt(L(m2), 10));
	            continue;
	          case "date":
	            x(new Date(L(m2)));
	            continue;
	          case "data":
	            T(L(m2));
	            continue;
	          case "true":
	            L(m2), G(true);
	            continue;
	          case "false":
	            L(m2), G(false);
	            continue;
	        }
	        if (!/^plist/.test(m2.name))
	          return S("unexpected opened tag " + m2.name);
	      }
	      var M;
	      return f;
	    }
	    Object.defineProperty(t2, "__esModule", { value: true }), t2.parsePLIST = t2.parseWithLocation = void 0, t2.parseWithLocation = function(e3, t3, s) {
	      return n(e3, t3, s);
	    }, t2.parsePLIST = function(e3) {
	      return n(e3, null, null);
	    };
	  }, 652: (e2, t2, n) => {
	    Object.defineProperty(t2, "__esModule", { value: true }), t2.SyncRegistry = void 0;
	    const s = n(391);
	    t2.SyncRegistry = class {
	      constructor(e3, t3) {
	        this._onigLibPromise = t3, this._grammars = /* @__PURE__ */ new Map(), this._rawGrammars = /* @__PURE__ */ new Map(), this._injectionGrammars = /* @__PURE__ */ new Map(), this._theme = e3;
	      }
	      dispose() {
	        for (const e3 of this._grammars.values())
	          e3.dispose();
	      }
	      setTheme(e3) {
	        this._theme = e3;
	      }
	      getColorMap() {
	        return this._theme.getColorMap();
	      }
	      addGrammar(e3, t3) {
	        this._rawGrammars.set(e3.scopeName, e3), t3 && this._injectionGrammars.set(e3.scopeName, t3);
	      }
	      lookup(e3) {
	        return this._rawGrammars.get(e3);
	      }
	      injections(e3) {
	        return this._injectionGrammars.get(e3);
	      }
	      getDefaults() {
	        return this._theme.getDefaults();
	      }
	      themeMatch(e3) {
	        return this._theme.match(e3);
	      }
	      async grammarForScopeName(e3, t3, n2, r, i) {
	        if (!this._grammars.has(e3)) {
	          let o = this._rawGrammars.get(e3);
	          if (!o)
	            return null;
	          this._grammars.set(e3, s.createGrammar(e3, o, t3, n2, r, i, this, await this._onigLibPromise));
	        }
	        return this._grammars.get(e3);
	      }
	    };
	  }, 792: (e2, t2, n) => {
	    Object.defineProperty(t2, "__esModule", { value: true }), t2.CompiledRule = t2.RegExpSourceList = t2.RegExpSource = t2.RuleFactory = t2.BeginWhileRule = t2.BeginEndRule = t2.IncludeOnlyRule = t2.MatchRule = t2.CaptureRule = t2.Rule = t2.ruleIdToNumber = t2.ruleIdFromNumber = t2.whileRuleId = t2.endRuleId = void 0;
	    const s = n(878), r = n(965), i = /\\(\d+)/, o = /\\(\d+)/g;
	    t2.endRuleId = -1, t2.whileRuleId = -2, t2.ruleIdFromNumber = function(e3) {
	      return e3;
	    }, t2.ruleIdToNumber = function(e3) {
	      return e3;
	    };
	    class a {
	      constructor(e3, t3, n2, r2) {
	        this.$location = e3, this.id = t3, this._name = n2 || null, this._nameIsCapturing = s.RegexSource.hasCaptures(this._name), this._contentName = r2 || null, this._contentNameIsCapturing = s.RegexSource.hasCaptures(this._contentName);
	      }
	      get debugName() {
	        const e3 = this.$location ? `${s.basename(this.$location.filename)}:${this.$location.line}` : "unknown";
	        return `${this.constructor.name}#${this.id} @ ${e3}`;
	      }
	      getName(e3, t3) {
	        return this._nameIsCapturing && null !== this._name && null !== e3 && null !== t3 ? s.RegexSource.replaceCaptures(this._name, e3, t3) : this._name;
	      }
	      getContentName(e3, t3) {
	        return this._contentNameIsCapturing && null !== this._contentName ? s.RegexSource.replaceCaptures(this._contentName, e3, t3) : this._contentName;
	      }
	    }
	    t2.Rule = a;
	    class c extends a {
	      constructor(e3, t3, n2, s2, r2) {
	        super(e3, t3, n2, s2), this.retokenizeCapturedWithRuleId = r2;
	      }
	      dispose() {
	      }
	      collectPatterns(e3, t3) {
	        throw new Error("Not supported!");
	      }
	      compile(e3, t3) {
	        throw new Error("Not supported!");
	      }
	      compileAG(e3, t3, n2, s2) {
	        throw new Error("Not supported!");
	      }
	    }
	    t2.CaptureRule = c;
	    class l extends a {
	      constructor(e3, t3, n2, s2, r2) {
	        super(e3, t3, n2, null), this._match = new f(s2, this.id), this.captures = r2, this._cachedCompiledPatterns = null;
	      }
	      dispose() {
	        this._cachedCompiledPatterns && (this._cachedCompiledPatterns.dispose(), this._cachedCompiledPatterns = null);
	      }
	      get debugMatchRegExp() {
	        return `${this._match.source}`;
	      }
	      collectPatterns(e3, t3) {
	        t3.push(this._match);
	      }
	      compile(e3, t3) {
	        return this._getCachedCompiledPatterns(e3).compile(e3);
	      }
	      compileAG(e3, t3, n2, s2) {
	        return this._getCachedCompiledPatterns(e3).compileAG(e3, n2, s2);
	      }
	      _getCachedCompiledPatterns(e3) {
	        return this._cachedCompiledPatterns || (this._cachedCompiledPatterns = new m(), this.collectPatterns(e3, this._cachedCompiledPatterns)), this._cachedCompiledPatterns;
	      }
	    }
	    t2.MatchRule = l;
	    class u extends a {
	      constructor(e3, t3, n2, s2, r2) {
	        super(e3, t3, n2, s2), this.patterns = r2.patterns, this.hasMissingPatterns = r2.hasMissingPatterns, this._cachedCompiledPatterns = null;
	      }
	      dispose() {
	        this._cachedCompiledPatterns && (this._cachedCompiledPatterns.dispose(), this._cachedCompiledPatterns = null);
	      }
	      collectPatterns(e3, t3) {
	        for (const n2 of this.patterns)
	          e3.getRule(n2).collectPatterns(e3, t3);
	      }
	      compile(e3, t3) {
	        return this._getCachedCompiledPatterns(e3).compile(e3);
	      }
	      compileAG(e3, t3, n2, s2) {
	        return this._getCachedCompiledPatterns(e3).compileAG(e3, n2, s2);
	      }
	      _getCachedCompiledPatterns(e3) {
	        return this._cachedCompiledPatterns || (this._cachedCompiledPatterns = new m(), this.collectPatterns(e3, this._cachedCompiledPatterns)), this._cachedCompiledPatterns;
	      }
	    }
	    t2.IncludeOnlyRule = u;
	    class h extends a {
	      constructor(e3, t3, n2, s2, r2, i2, o2, a2, c2, l2) {
	        super(e3, t3, n2, s2), this._begin = new f(r2, this.id), this.beginCaptures = i2, this._end = new f(o2 || "￿", -1), this.endHasBackReferences = this._end.hasBackReferences, this.endCaptures = a2, this.applyEndPatternLast = c2 || false, this.patterns = l2.patterns, this.hasMissingPatterns = l2.hasMissingPatterns, this._cachedCompiledPatterns = null;
	      }
	      dispose() {
	        this._cachedCompiledPatterns && (this._cachedCompiledPatterns.dispose(), this._cachedCompiledPatterns = null);
	      }
	      get debugBeginRegExp() {
	        return `${this._begin.source}`;
	      }
	      get debugEndRegExp() {
	        return `${this._end.source}`;
	      }
	      getEndWithResolvedBackReferences(e3, t3) {
	        return this._end.resolveBackReferences(e3, t3);
	      }
	      collectPatterns(e3, t3) {
	        t3.push(this._begin);
	      }
	      compile(e3, t3) {
	        return this._getCachedCompiledPatterns(e3, t3).compile(e3);
	      }
	      compileAG(e3, t3, n2, s2) {
	        return this._getCachedCompiledPatterns(e3, t3).compileAG(e3, n2, s2);
	      }
	      _getCachedCompiledPatterns(e3, t3) {
	        if (!this._cachedCompiledPatterns) {
	          this._cachedCompiledPatterns = new m();
	          for (const t4 of this.patterns)
	            e3.getRule(t4).collectPatterns(e3, this._cachedCompiledPatterns);
	          this.applyEndPatternLast ? this._cachedCompiledPatterns.push(this._end.hasBackReferences ? this._end.clone() : this._end) : this._cachedCompiledPatterns.unshift(this._end.hasBackReferences ? this._end.clone() : this._end);
	        }
	        return this._end.hasBackReferences && (this.applyEndPatternLast ? this._cachedCompiledPatterns.setSource(this._cachedCompiledPatterns.length() - 1, t3) : this._cachedCompiledPatterns.setSource(0, t3)), this._cachedCompiledPatterns;
	      }
	    }
	    t2.BeginEndRule = h;
	    class p extends a {
	      constructor(e3, n2, s2, r2, i2, o2, a2, c2, l2) {
	        super(e3, n2, s2, r2), this._begin = new f(i2, this.id), this.beginCaptures = o2, this.whileCaptures = c2, this._while = new f(a2, t2.whileRuleId), this.whileHasBackReferences = this._while.hasBackReferences, this.patterns = l2.patterns, this.hasMissingPatterns = l2.hasMissingPatterns, this._cachedCompiledPatterns = null, this._cachedCompiledWhilePatterns = null;
	      }
	      dispose() {
	        this._cachedCompiledPatterns && (this._cachedCompiledPatterns.dispose(), this._cachedCompiledPatterns = null), this._cachedCompiledWhilePatterns && (this._cachedCompiledWhilePatterns.dispose(), this._cachedCompiledWhilePatterns = null);
	      }
	      get debugBeginRegExp() {
	        return `${this._begin.source}`;
	      }
	      get debugWhileRegExp() {
	        return `${this._while.source}`;
	      }
	      getWhileWithResolvedBackReferences(e3, t3) {
	        return this._while.resolveBackReferences(e3, t3);
	      }
	      collectPatterns(e3, t3) {
	        t3.push(this._begin);
	      }
	      compile(e3, t3) {
	        return this._getCachedCompiledPatterns(e3).compile(e3);
	      }
	      compileAG(e3, t3, n2, s2) {
	        return this._getCachedCompiledPatterns(e3).compileAG(e3, n2, s2);
	      }
	      _getCachedCompiledPatterns(e3) {
	        if (!this._cachedCompiledPatterns) {
	          this._cachedCompiledPatterns = new m();
	          for (const t3 of this.patterns)
	            e3.getRule(t3).collectPatterns(e3, this._cachedCompiledPatterns);
	        }
	        return this._cachedCompiledPatterns;
	      }
	      compileWhile(e3, t3) {
	        return this._getCachedCompiledWhilePatterns(e3, t3).compile(e3);
	      }
	      compileWhileAG(e3, t3, n2, s2) {
	        return this._getCachedCompiledWhilePatterns(e3, t3).compileAG(e3, n2, s2);
	      }
	      _getCachedCompiledWhilePatterns(e3, t3) {
	        return this._cachedCompiledWhilePatterns || (this._cachedCompiledWhilePatterns = new m(), this._cachedCompiledWhilePatterns.push(this._while.hasBackReferences ? this._while.clone() : this._while)), this._while.hasBackReferences && this._cachedCompiledWhilePatterns.setSource(0, t3 || "￿"), this._cachedCompiledWhilePatterns;
	      }
	    }
	    t2.BeginWhileRule = p;
	    class d {
	      static createCaptureRule(e3, t3, n2, s2, r2) {
	        return e3.registerRule((e4) => new c(t3, e4, n2, s2, r2));
	      }
	      static getCompiledRuleId(e3, t3, n2) {
	        return e3.id || t3.registerRule((r2) => {
	          if (e3.id = r2, e3.match)
	            return new l(e3.$vscodeTextmateLocation, e3.id, e3.name, e3.match, d._compileCaptures(e3.captures, t3, n2));
	          if (void 0 === e3.begin) {
	            e3.repository && (n2 = s.mergeObjects({}, n2, e3.repository));
	            let r3 = e3.patterns;
	            return void 0 === r3 && e3.include && (r3 = [{ include: e3.include }]), new u(e3.$vscodeTextmateLocation, e3.id, e3.name, e3.contentName, d._compilePatterns(r3, t3, n2));
	          }
	          return e3.while ? new p(e3.$vscodeTextmateLocation, e3.id, e3.name, e3.contentName, e3.begin, d._compileCaptures(e3.beginCaptures || e3.captures, t3, n2), e3.while, d._compileCaptures(e3.whileCaptures || e3.captures, t3, n2), d._compilePatterns(e3.patterns, t3, n2)) : new h(e3.$vscodeTextmateLocation, e3.id, e3.name, e3.contentName, e3.begin, d._compileCaptures(e3.beginCaptures || e3.captures, t3, n2), e3.end, d._compileCaptures(e3.endCaptures || e3.captures, t3, n2), e3.applyEndPatternLast, d._compilePatterns(e3.patterns, t3, n2));
	        }), e3.id;
	      }
	      static _compileCaptures(e3, t3, n2) {
	        let s2 = [];
	        if (e3) {
	          let r2 = 0;
	          for (const t4 in e3) {
	            if ("$vscodeTextmateLocation" === t4)
	              continue;
	            const e4 = parseInt(t4, 10);
	            e4 > r2 && (r2 = e4);
	          }
	          for (let e4 = 0; e4 <= r2; e4++)
	            s2[e4] = null;
	          for (const r3 in e3) {
	            if ("$vscodeTextmateLocation" === r3)
	              continue;
	            const i2 = parseInt(r3, 10);
	            let o2 = 0;
	            e3[r3].patterns && (o2 = d.getCompiledRuleId(e3[r3], t3, n2)), s2[i2] = d.createCaptureRule(t3, e3[r3].$vscodeTextmateLocation, e3[r3].name, e3[r3].contentName, o2);
	          }
	        }
	        return s2;
	      }
	      static _compilePatterns(e3, t3, n2) {
	        let s2 = [];
	        if (e3)
	          for (let i2 = 0, o2 = e3.length; i2 < o2; i2++) {
	            const o3 = e3[i2];
	            let a2 = -1;
	            if (o3.include) {
	              const e4 = r.parseInclude(o3.include);
	              switch (e4.kind) {
	                case 0:
	                case 1:
	                  a2 = d.getCompiledRuleId(n2[o3.include], t3, n2);
	                  break;
	                case 2:
	                  let s3 = n2[e4.ruleName];
	                  s3 && (a2 = d.getCompiledRuleId(s3, t3, n2));
	                  break;
	                case 3:
	                case 4:
	                  const r2 = e4.scopeName, i3 = 4 === e4.kind ? e4.ruleName : null, c2 = t3.getExternalGrammar(r2, n2);
	                  if (c2)
	                    if (i3) {
	                      let e5 = c2.repository[i3];
	                      e5 && (a2 = d.getCompiledRuleId(e5, t3, c2.repository));
	                    } else
	                      a2 = d.getCompiledRuleId(c2.repository.$self, t3, c2.repository);
	              }
	            } else
	              a2 = d.getCompiledRuleId(o3, t3, n2);
	            if (-1 !== a2) {
	              const e4 = t3.getRule(a2);
	              let n3 = false;
	              if ((e4 instanceof u || e4 instanceof h || e4 instanceof p) && e4.hasMissingPatterns && 0 === e4.patterns.length && (n3 = true), n3)
	                continue;
	              s2.push(a2);
	            }
	          }
	        return { patterns: s2, hasMissingPatterns: (e3 ? e3.length : 0) !== s2.length };
	      }
	    }
	    t2.RuleFactory = d;
	    class f {
	      constructor(e3, t3) {
	        if (e3) {
	          const t4 = e3.length;
	          let n2 = 0, s2 = [], r2 = false;
	          for (let i2 = 0; i2 < t4; i2++)
	            if ("\\" === e3.charAt(i2) && i2 + 1 < t4) {
	              const t5 = e3.charAt(i2 + 1);
	              "z" === t5 ? (s2.push(e3.substring(n2, i2)), s2.push("$(?!\\n)(?<!\\n)"), n2 = i2 + 2) : "A" !== t5 && "G" !== t5 || (r2 = true), i2++;
	            }
	          this.hasAnchor = r2, 0 === n2 ? this.source = e3 : (s2.push(e3.substring(n2, t4)), this.source = s2.join(""));
	        } else
	          this.hasAnchor = false, this.source = e3;
	        this.hasAnchor ? this._anchorCache = this._buildAnchorCache() : this._anchorCache = null, this.ruleId = t3, this.hasBackReferences = i.test(this.source);
	      }
	      clone() {
	        return new f(this.source, this.ruleId);
	      }
	      setSource(e3) {
	        this.source !== e3 && (this.source = e3, this.hasAnchor && (this._anchorCache = this._buildAnchorCache()));
	      }
	      resolveBackReferences(e3, t3) {
	        let n2 = t3.map((t4) => e3.substring(t4.start, t4.end));
	        return o.lastIndex = 0, this.source.replace(o, (e4, t4) => s.escapeRegExpCharacters(n2[parseInt(t4, 10)] || ""));
	      }
	      _buildAnchorCache() {
	        let e3, t3, n2, s2, r2 = [], i2 = [], o2 = [], a2 = [];
	        for (e3 = 0, t3 = this.source.length; e3 < t3; e3++)
	          n2 = this.source.charAt(e3), r2[e3] = n2, i2[e3] = n2, o2[e3] = n2, a2[e3] = n2, "\\" === n2 && e3 + 1 < t3 && (s2 = this.source.charAt(e3 + 1), "A" === s2 ? (r2[e3 + 1] = "￿", i2[e3 + 1] = "￿", o2[e3 + 1] = "A", a2[e3 + 1] = "A") : "G" === s2 ? (r2[e3 + 1] = "￿", i2[e3 + 1] = "G", o2[e3 + 1] = "￿", a2[e3 + 1] = "G") : (r2[e3 + 1] = s2, i2[e3 + 1] = s2, o2[e3 + 1] = s2, a2[e3 + 1] = s2), e3++);
	        return { A0_G0: r2.join(""), A0_G1: i2.join(""), A1_G0: o2.join(""), A1_G1: a2.join("") };
	      }
	      resolveAnchors(e3, t3) {
	        return this.hasAnchor && this._anchorCache ? e3 ? t3 ? this._anchorCache.A1_G1 : this._anchorCache.A1_G0 : t3 ? this._anchorCache.A0_G1 : this._anchorCache.A0_G0 : this.source;
	      }
	    }
	    t2.RegExpSource = f;
	    class m {
	      constructor() {
	        this._items = [], this._hasAnchors = false, this._cached = null, this._anchorCache = { A0_G0: null, A0_G1: null, A1_G0: null, A1_G1: null };
	      }
	      dispose() {
	        this._disposeCaches();
	      }
	      _disposeCaches() {
	        this._cached && (this._cached.dispose(), this._cached = null), this._anchorCache.A0_G0 && (this._anchorCache.A0_G0.dispose(), this._anchorCache.A0_G0 = null), this._anchorCache.A0_G1 && (this._anchorCache.A0_G1.dispose(), this._anchorCache.A0_G1 = null), this._anchorCache.A1_G0 && (this._anchorCache.A1_G0.dispose(), this._anchorCache.A1_G0 = null), this._anchorCache.A1_G1 && (this._anchorCache.A1_G1.dispose(), this._anchorCache.A1_G1 = null);
	      }
	      push(e3) {
	        this._items.push(e3), this._hasAnchors = this._hasAnchors || e3.hasAnchor;
	      }
	      unshift(e3) {
	        this._items.unshift(e3), this._hasAnchors = this._hasAnchors || e3.hasAnchor;
	      }
	      length() {
	        return this._items.length;
	      }
	      setSource(e3, t3) {
	        this._items[e3].source !== t3 && (this._disposeCaches(), this._items[e3].setSource(t3));
	      }
	      compile(e3) {
	        if (!this._cached) {
	          let t3 = this._items.map((e4) => e4.source);
	          this._cached = new g(e3, t3, this._items.map((e4) => e4.ruleId));
	        }
	        return this._cached;
	      }
	      compileAG(e3, t3, n2) {
	        return this._hasAnchors ? t3 ? n2 ? (this._anchorCache.A1_G1 || (this._anchorCache.A1_G1 = this._resolveAnchors(e3, t3, n2)), this._anchorCache.A1_G1) : (this._anchorCache.A1_G0 || (this._anchorCache.A1_G0 = this._resolveAnchors(e3, t3, n2)), this._anchorCache.A1_G0) : n2 ? (this._anchorCache.A0_G1 || (this._anchorCache.A0_G1 = this._resolveAnchors(e3, t3, n2)), this._anchorCache.A0_G1) : (this._anchorCache.A0_G0 || (this._anchorCache.A0_G0 = this._resolveAnchors(e3, t3, n2)), this._anchorCache.A0_G0) : this.compile(e3);
	      }
	      _resolveAnchors(e3, t3, n2) {
	        let s2 = this._items.map((e4) => e4.resolveAnchors(t3, n2));
	        return new g(e3, s2, this._items.map((e4) => e4.ruleId));
	      }
	    }
	    t2.RegExpSourceList = m;
	    class g {
	      constructor(e3, t3, n2) {
	        this.regExps = t3, this.rules = n2, this.scanner = e3.createOnigScanner(t3);
	      }
	      dispose() {
	        "function" == typeof this.scanner.dispose && this.scanner.dispose();
	      }
	      toString() {
	        const e3 = [];
	        for (let t3 = 0, n2 = this.rules.length; t3 < n2; t3++)
	          e3.push("   - " + this.rules[t3] + ": " + this.regExps[t3]);
	        return e3.join("\n");
	      }
	      findNextMatchSync(e3, t3, n2) {
	        const s2 = this.scanner.findNextMatchSync(e3, t3, n2);
	        return s2 ? { ruleId: this.rules[s2.index], captureIndices: s2.captureIndices } : null;
	      }
	    }
	    t2.CompiledRule = g;
	  }, 583: (e2, t2, n) => {
	    Object.defineProperty(t2, "__esModule", { value: true }), t2.ThemeTrieElement = t2.ThemeTrieElementRule = t2.ColorMap = t2.fontStyleToString = t2.ParsedThemeRule = t2.parseTheme = t2.StyleAttributes = t2.ScopeStack = t2.Theme = void 0;
	    const s = n(878);
	    class r {
	      constructor(e3, t3, n2) {
	        this._colorMap = e3, this._defaults = t3, this._root = n2, this._cachedMatchRoot = new s.CachedFn((e4) => this._root.match(e4));
	      }
	      static createFromRawTheme(e3, t3) {
	        return this.createFromParsedTheme(c(e3), t3);
	      }
	      static createFromParsedTheme(e3, t3) {
	        return function(e4, t4) {
	          e4.sort((e5, t5) => {
	            let n3 = s.strcmp(e5.scope, t5.scope);
	            return 0 !== n3 ? n3 : (n3 = s.strArrCmp(e5.parentScopes, t5.parentScopes), 0 !== n3 ? n3 : e5.index - t5.index);
	          });
	          let n2 = 0, i2 = "#000000", o2 = "#ffffff";
	          for (; e4.length >= 1 && "" === e4[0].scope; ) {
	            let t5 = e4.shift();
	            -1 !== t5.fontStyle && (n2 = t5.fontStyle), null !== t5.foreground && (i2 = t5.foreground), null !== t5.background && (o2 = t5.background);
	          }
	          let c2 = new u(t4), l2 = new a(n2, c2.getId(i2), c2.getId(o2)), h2 = new d(new p(0, null, -1, 0, 0), []);
	          for (let t5 = 0, n3 = e4.length; t5 < n3; t5++) {
	            let n4 = e4[t5];
	            h2.insert(0, n4.scope, n4.parentScopes, n4.fontStyle, c2.getId(n4.foreground), c2.getId(n4.background));
	          }
	          return new r(c2, l2, h2);
	        }(e3, t3);
	      }
	      getColorMap() {
	        return this._colorMap.getColorMap();
	      }
	      getDefaults() {
	        return this._defaults;
	      }
	      match(e3) {
	        if (null === e3)
	          return this._defaults;
	        const t3 = e3.scopeName, n2 = this._cachedMatchRoot.get(t3).find((t4) => function(e4, t5) {
	          if (0 === t5.length)
	            return true;
	          for (let n3 = 0; n3 < t5.length; n3++) {
	            let s2 = t5[n3], r2 = false;
	            if (">" === s2) {
	              if (n3 === t5.length - 1)
	                return false;
	              s2 = t5[++n3], r2 = true;
	            }
	            for (; e4 && !o(e4.scopeName, s2); ) {
	              if (r2)
	                return false;
	              e4 = e4.parent;
	            }
	            if (!e4)
	              return false;
	            e4 = e4.parent;
	          }
	          return true;
	        }(e3.parent, t4.parentScopes));
	        return n2 ? new a(n2.fontStyle, n2.foreground, n2.background) : null;
	      }
	    }
	    t2.Theme = r;
	    class i {
	      constructor(e3, t3) {
	        this.parent = e3, this.scopeName = t3;
	      }
	      static push(e3, t3) {
	        for (const n2 of t3)
	          e3 = new i(e3, n2);
	        return e3;
	      }
	      static from(...e3) {
	        let t3 = null;
	        for (let n2 = 0; n2 < e3.length; n2++)
	          t3 = new i(t3, e3[n2]);
	        return t3;
	      }
	      push(e3) {
	        return new i(this, e3);
	      }
	      getSegments() {
	        let e3 = this;
	        const t3 = [];
	        for (; e3; )
	          t3.push(e3.scopeName), e3 = e3.parent;
	        return t3.reverse(), t3;
	      }
	      toString() {
	        return this.getSegments().join(" ");
	      }
	      extends(e3) {
	        return this === e3 || null !== this.parent && this.parent.extends(e3);
	      }
	      getExtensionIfDefined(e3) {
	        const t3 = [];
	        let n2 = this;
	        for (; n2 && n2 !== e3; )
	          t3.push(n2.scopeName), n2 = n2.parent;
	        return n2 === e3 ? t3.reverse() : void 0;
	      }
	    }
	    function o(e3, t3) {
	      return t3 === e3 || e3.startsWith(t3) && "." === e3[t3.length];
	    }
	    t2.ScopeStack = i;
	    class a {
	      constructor(e3, t3, n2) {
	        this.fontStyle = e3, this.foregroundId = t3, this.backgroundId = n2;
	      }
	    }
	    function c(e3) {
	      if (!e3)
	        return [];
	      if (!e3.settings || !Array.isArray(e3.settings))
	        return [];
	      let t3 = e3.settings, n2 = [], r2 = 0;
	      for (let e4 = 0, i2 = t3.length; e4 < i2; e4++) {
	        let i3, o2 = t3[e4];
	        if (!o2.settings)
	          continue;
	        if ("string" == typeof o2.scope) {
	          let e5 = o2.scope;
	          e5 = e5.replace(/^[,]+/, ""), e5 = e5.replace(/[,]+$/, ""), i3 = e5.split(",");
	        } else
	          i3 = Array.isArray(o2.scope) ? o2.scope : [""];
	        let a2 = -1;
	        if ("string" == typeof o2.settings.fontStyle) {
	          a2 = 0;
	          let e5 = o2.settings.fontStyle.split(" ");
	          for (let t4 = 0, n3 = e5.length; t4 < n3; t4++)
	            switch (e5[t4]) {
	              case "italic":
	                a2 |= 1;
	                break;
	              case "bold":
	                a2 |= 2;
	                break;
	              case "underline":
	                a2 |= 4;
	                break;
	              case "strikethrough":
	                a2 |= 8;
	            }
	        }
	        let c2 = null;
	        "string" == typeof o2.settings.foreground && s.isValidHexColor(o2.settings.foreground) && (c2 = o2.settings.foreground);
	        let u2 = null;
	        "string" == typeof o2.settings.background && s.isValidHexColor(o2.settings.background) && (u2 = o2.settings.background);
	        for (let t4 = 0, s2 = i3.length; t4 < s2; t4++) {
	          let s3 = i3[t4].trim().split(" "), o3 = s3[s3.length - 1], h2 = null;
	          s3.length > 1 && (h2 = s3.slice(0, s3.length - 1), h2.reverse()), n2[r2++] = new l(o3, h2, e4, a2, c2, u2);
	        }
	      }
	      return n2;
	    }
	    t2.StyleAttributes = a, t2.parseTheme = c;
	    class l {
	      constructor(e3, t3, n2, s2, r2, i2) {
	        this.scope = e3, this.parentScopes = t3, this.index = n2, this.fontStyle = s2, this.foreground = r2, this.background = i2;
	      }
	    }
	    t2.ParsedThemeRule = l, t2.fontStyleToString = function(e3) {
	      if (-1 === e3)
	        return "not set";
	      let t3 = "";
	      return 1 & e3 && (t3 += "italic "), 2 & e3 && (t3 += "bold "), 4 & e3 && (t3 += "underline "), 8 & e3 && (t3 += "strikethrough "), "" === t3 && (t3 = "none"), t3.trim();
	    };
	    class u {
	      constructor(e3) {
	        if (this._lastColorId = 0, this._id2color = [], this._color2id = /* @__PURE__ */ Object.create(null), Array.isArray(e3)) {
	          this._isFrozen = true;
	          for (let t3 = 0, n2 = e3.length; t3 < n2; t3++)
	            this._color2id[e3[t3]] = t3, this._id2color[t3] = e3[t3];
	        } else
	          this._isFrozen = false;
	      }
	      getId(e3) {
	        if (null === e3)
	          return 0;
	        e3 = e3.toUpperCase();
	        let t3 = this._color2id[e3];
	        if (t3)
	          return t3;
	        if (this._isFrozen)
	          throw new Error(`Missing color in color map - ${e3}`);
	        return t3 = ++this._lastColorId, this._color2id[e3] = t3, this._id2color[t3] = e3, t3;
	      }
	      getColorMap() {
	        return this._id2color.slice(0);
	      }
	    }
	    t2.ColorMap = u;
	    const h = Object.freeze([]);
	    class p {
	      constructor(e3, t3, n2, s2, r2) {
	        this.scopeDepth = e3, this.parentScopes = t3 || h, this.fontStyle = n2, this.foreground = s2, this.background = r2;
	      }
	      clone() {
	        return new p(this.scopeDepth, this.parentScopes, this.fontStyle, this.foreground, this.background);
	      }
	      static cloneArr(e3) {
	        let t3 = [];
	        for (let n2 = 0, s2 = e3.length; n2 < s2; n2++)
	          t3[n2] = e3[n2].clone();
	        return t3;
	      }
	      acceptOverwrite(e3, t3, n2, s2) {
	        this.scopeDepth > e3 ? console.log("how did this happen?") : this.scopeDepth = e3, -1 !== t3 && (this.fontStyle = t3), 0 !== n2 && (this.foreground = n2), 0 !== s2 && (this.background = s2);
	      }
	    }
	    t2.ThemeTrieElementRule = p;
	    class d {
	      constructor(e3, t3 = [], n2 = {}) {
	        this._mainRule = e3, this._children = n2, this._rulesWithParentScopes = t3;
	      }
	      static _cmpBySpecificity(e3, t3) {
	        if (e3.scopeDepth !== t3.scopeDepth)
	          return t3.scopeDepth - e3.scopeDepth;
	        let n2 = 0, s2 = 0;
	        for (; ">" === e3.parentScopes[n2] && n2++, ">" === t3.parentScopes[s2] && s2++, !(n2 >= e3.parentScopes.length || s2 >= t3.parentScopes.length); ) {
	          const r2 = t3.parentScopes[s2].length - e3.parentScopes[n2].length;
	          if (0 !== r2)
	            return r2;
	          n2++, s2++;
	        }
	        return t3.parentScopes.length - e3.parentScopes.length;
	      }
	      match(e3) {
	        if ("" !== e3) {
	          let t4, n2, s2 = e3.indexOf(".");
	          if (-1 === s2 ? (t4 = e3, n2 = "") : (t4 = e3.substring(0, s2), n2 = e3.substring(s2 + 1)), this._children.hasOwnProperty(t4))
	            return this._children[t4].match(n2);
	        }
	        const t3 = this._rulesWithParentScopes.concat(this._mainRule);
	        return t3.sort(d._cmpBySpecificity), t3;
	      }
	      insert(e3, t3, n2, s2, r2, i2) {
	        if ("" === t3)
	          return void this._doInsertHere(e3, n2, s2, r2, i2);
	        let o2, a2, c2, l2 = t3.indexOf(".");
	        -1 === l2 ? (o2 = t3, a2 = "") : (o2 = t3.substring(0, l2), a2 = t3.substring(l2 + 1)), this._children.hasOwnProperty(o2) ? c2 = this._children[o2] : (c2 = new d(this._mainRule.clone(), p.cloneArr(this._rulesWithParentScopes)), this._children[o2] = c2), c2.insert(e3 + 1, a2, n2, s2, r2, i2);
	      }
	      _doInsertHere(e3, t3, n2, r2, i2) {
	        if (null !== t3) {
	          for (let o2 = 0, a2 = this._rulesWithParentScopes.length; o2 < a2; o2++) {
	            let a3 = this._rulesWithParentScopes[o2];
	            if (0 === s.strArrCmp(a3.parentScopes, t3))
	              return void a3.acceptOverwrite(e3, n2, r2, i2);
	          }
	          -1 === n2 && (n2 = this._mainRule.fontStyle), 0 === r2 && (r2 = this._mainRule.foreground), 0 === i2 && (i2 = this._mainRule.background), this._rulesWithParentScopes.push(new p(e3, t3, n2, r2, i2));
	        } else
	          this._mainRule.acceptOverwrite(e3, n2, r2, i2);
	      }
	    }
	    t2.ThemeTrieElement = d;
	  }, 878: (e2, t2) => {
	    function n(e3) {
	      return Array.isArray(e3) ? function(e4) {
	        let t3 = [];
	        for (let s2 = 0, r2 = e4.length; s2 < r2; s2++)
	          t3[s2] = n(e4[s2]);
	        return t3;
	      }(e3) : "object" == typeof e3 ? function(e4) {
	        let t3 = {};
	        for (let s2 in e4)
	          t3[s2] = n(e4[s2]);
	        return t3;
	      }(e3) : e3;
	    }
	    Object.defineProperty(t2, "__esModule", { value: true }), t2.performanceNow = t2.CachedFn = t2.escapeRegExpCharacters = t2.isValidHexColor = t2.strArrCmp = t2.strcmp = t2.RegexSource = t2.basename = t2.mergeObjects = t2.clone = void 0, t2.clone = function(e3) {
	      return n(e3);
	    }, t2.mergeObjects = function(e3, ...t3) {
	      return t3.forEach((t4) => {
	        for (let n2 in t4)
	          e3[n2] = t4[n2];
	      }), e3;
	    }, t2.basename = function e3(t3) {
	      const n2 = ~t3.lastIndexOf("/") || ~t3.lastIndexOf("\\");
	      return 0 === n2 ? t3 : ~n2 == t3.length - 1 ? e3(t3.substring(0, t3.length - 1)) : t3.substr(1 + ~n2);
	    };
	    let s = /\$(\d+)|\${(\d+):\/(downcase|upcase)}/g;
	    function r(e3, t3) {
	      return e3 < t3 ? -1 : e3 > t3 ? 1 : 0;
	    }
	    t2.RegexSource = class {
	      static hasCaptures(e3) {
	        return null !== e3 && (s.lastIndex = 0, s.test(e3));
	      }
	      static replaceCaptures(e3, t3, n2) {
	        return e3.replace(s, (e4, s2, r2, i) => {
	          let o = n2[parseInt(s2 || r2, 10)];
	          if (!o)
	            return e4;
	          {
	            let e5 = t3.substring(o.start, o.end);
	            for (; "." === e5[0]; )
	              e5 = e5.substring(1);
	            switch (i) {
	              case "downcase":
	                return e5.toLowerCase();
	              case "upcase":
	                return e5.toUpperCase();
	              default:
	                return e5;
	            }
	          }
	        });
	      }
	    }, t2.strcmp = r, t2.strArrCmp = function(e3, t3) {
	      if (null === e3 && null === t3)
	        return 0;
	      if (!e3)
	        return -1;
	      if (!t3)
	        return 1;
	      let n2 = e3.length, s2 = t3.length;
	      if (n2 === s2) {
	        for (let s3 = 0; s3 < n2; s3++) {
	          let n3 = r(e3[s3], t3[s3]);
	          if (0 !== n3)
	            return n3;
	        }
	        return 0;
	      }
	      return n2 - s2;
	    }, t2.isValidHexColor = function(e3) {
	      return !!(/^#[0-9a-f]{6}$/i.test(e3) || /^#[0-9a-f]{8}$/i.test(e3) || /^#[0-9a-f]{3}$/i.test(e3) || /^#[0-9a-f]{4}$/i.test(e3));
	    }, t2.escapeRegExpCharacters = function(e3) {
	      return e3.replace(/[\-\\\{\}\*\+\?\|\^\$\.\,\[\]\(\)\#\s]/g, "\\$&");
	    }, t2.CachedFn = class {
	      constructor(e3) {
	        this.fn = e3, this.cache = /* @__PURE__ */ new Map();
	      }
	      get(e3) {
	        if (this.cache.has(e3))
	          return this.cache.get(e3);
	        const t3 = this.fn(e3);
	        return this.cache.set(e3, t3), t3;
	      }
	    }, t2.performanceNow = "undefined" == typeof performance ? function() {
	      return Date.now();
	    } : function() {
	      return performance.now();
	    };
	  } }, t = {};
	  return function n(s) {
	    var r = t[s];
	    if (void 0 !== r)
	      return r.exports;
	    var i = t[s] = { exports: {} };
	    return e[s].call(i.exports, i, i.exports, n), i.exports;
	  }(787);
	})()); 
} (main));

var mainExports = main.exports;

let CDN = "https://esm.sh";
const CACHE = {
  theme: {},
  grammar: {}
};
function setCDN(cdn) {
  CDN = cdn;
}
function urlFromCDN(type, key) {
  if (typeof CDN === "function") {
    return CDN(type, key);
  }
  switch (type) {
    case "theme":
      return `${CDN}/tm-themes/themes/${key}.json`;
    case "grammar":
      return `${CDN}/tm-grammars/grammars/${key}.json`;
    case "oniguruma":
      return `${CDN}/vscode-oniguruma/release/onig.wasm`;
  }
}
async function fetchFromCDN(type, key) {
  if (key in CACHE[type]) {
    return CACHE[type][key];
  }
  const value = urlFromCDN(type, key);
  return CACHE[type][key] = typeof value !== "string" ? value : fetch(value).then((response) => response.ok ? response.json() : null).catch(console.error);
}

function applyStyle(element, props, key) {
  let previous;
  createRenderEffect(() => {
    const value = props.style?.[key];
    value !== previous && ((previous = value) != null ? element.style.setProperty(key, typeof value === "undefined" ? null : value.toString()) : element.style.removeProperty(key));
  });
}

function hexToRgb(hex) {
  let bigint = parseInt(hex.slice(1), 16);
  let r = bigint >> 16 & 255;
  let g = bigint >> 8 & 255;
  let b = bigint & 255;
  return [r, g, b];
}
function luminance(r, g, b) {
  const a = [r, g, b].map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}

function once(accessor, callback, fallback) {
  const value = typeof accessor === "function" ? accessor() : accessor;
  return value ? callback(value) : fallback ? fallback() : void 0;
}
function when(accessor, callback, fallback) {
  return () => once(accessor, callback, fallback);
}
function every(...accessors) {
  function callback() {
    const values = new Array(accessors.length);
    for (let i = 0; i < accessors.length; i++) {
      const _value = typeof accessors[i] === "function" ? accessors[i]() : accessors[i];
      if (!_value)
        return void 0;
      values[i] = _value;
    }
    return values;
  }
  return callback;
}

function countDigits(value) {
  if (value === 0)
    return 1;
  return Math.floor(Math.log10(Math.abs(value))) + 1;
}

function getLongestLineSize(lines) {
  let maxLength = 0;
  for (const line of lines) {
    if (line.length > maxLength) {
      maxLength = line.length;
    }
  }
  return maxLength;
}

var _tmpl$$1 = /* @__PURE__ */ template(`<div part=root><textarea part=textarea autocomplete=off inputmode=none></textarea><code aria-hidden>&nbsp;`), _tmpl$2$1 = /* @__PURE__ */ template(`<code part=code>`), _tmpl$3$1 = /* @__PURE__ */ template(`<pre part=line>`);
const SEGMENT_SIZE = 100;
const WINDOW = 50;
class ThemeManager {
  themeData;
  constructor(themeData) {
    this.themeData = themeData;
  }
  #scopes = {};
  // Resolve styles for a given scope
  resolveScope(scope) {
    const id = scope.join("-");
    if (this.#scopes[id])
      return this.#scopes[id];
    let finalStyle = {};
    for (let i = 0; i < scope.length; i++) {
      const currentScope = scope[i];
      for (const themeRule of this.themeData.tokenColors) {
        const themeScopes = Array.isArray(themeRule.scope) ? themeRule.scope : [themeRule.scope];
        for (const themeScope of themeScopes) {
          if (currentScope.startsWith(themeScope || "")) {
            finalStyle = {
              ...finalStyle,
              ...themeRule.settings
            };
          }
        }
      }
    }
    return this.#scopes[id] = finalStyle;
  }
  // Get background color
  getBackgroundColor() {
    return this.themeData.colors?.["editor.background"] || "#FFFFFF";
  }
  // Get foreground color
  getForegroundColor() {
    return this.themeData.colors?.["editor.foreground"] || "#000000";
  }
}
function escapeHTML(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
class Segment {
  constructor(manager, previous, index) {
    this.manager = manager;
    this.previous = previous;
    const start = index * this.manager.segmentSize;
    const end = start + this.manager.segmentSize;
    [this.stack, this.setStack] = createSignal(this.previous?.stack() || mainExports.INITIAL, {
      equals: equalStack
    });
    const lines = createLazyMemo(() => this.manager.lines().slice(start, end));
    this.#generated = createLazyMemo(() => {
      let currentStack = this.previous?.stack() || mainExports.INITIAL;
      const result = lines().map((line) => {
        const {
          ruleStack,
          tokens
        } = this.manager.tokenizer.tokenizeLine(line, currentStack);
        currentStack = ruleStack;
        return tokens.map((token) => {
          const style = this.manager.theme.resolveScope(token.scopes);
          const tokenValue = line.slice(token.startIndex, token.endIndex);
          return `<span style="${style.foreground ? `color:${style.foreground};` : ""}${style.fontStyle ? `text-decoration:${style.fontStyle}` : ""}">${escapeHTML(tokenValue)}</span>`;
        }).join("");
      });
      this.setStack(currentStack);
      return result;
    });
  }
  #generated;
  next = null;
  stack;
  setStack;
  getLine(localOffset) {
    return this.#generated()[localOffset];
  }
}
class SegmentManager {
  constructor(tokenizer, theme, source) {
    this.tokenizer = tokenizer;
    this.theme = theme;
    this.source = source;
    this.lines = createMemo(() => source().split("\n"));
    this.#segments = createMemo(indexArray(() => {
      const newLineCount = this.lines().length;
      return Array.from({
        length: Math.ceil(newLineCount / this.segmentSize)
      });
    }, (_, index) => {
      let previousSegment = typeof this.#segments === "function" ? this.#segments()[this.#segments.length - 1] || null : null;
      return new Segment(this, previousSegment, index);
    }));
  }
  #segments;
  segmentSize = SEGMENT_SIZE;
  lines;
  getSegment(index) {
    return this.#segments()[index] || void 0;
  }
  getLine(globalOffset) {
    const segmentIndex = Math.floor(globalOffset / this.segmentSize);
    const segment = this.#segments()[segmentIndex];
    if (!segment) {
      return void 0;
    }
    const localOffset = globalOffset % this.segmentSize;
    return segment.getLine(localOffset) || void 0;
  }
}
function equalStack(stateA, stateB) {
  let changed = false;
  if (stateA === stateB)
    return true;
  if (!stateA || !stateB) {
    return false;
  }
  if (stateA.ruleId !== stateB.ruleId) {
    changed = true;
  }
  if (stateA.depth !== stateB.depth) {
    changed = true;
  }
  if (!equalScopes(stateA.nameScopesList, stateB.nameScopesList)) {
    changed = true;
  }
  if (!equalScopes(stateA.contentNameScopesList, stateB.contentNameScopesList)) {
    changed = true;
  }
  return !changed;
}
function equalScopes(scopeA, scopeB) {
  if (!scopeA && !scopeB)
    return true;
  if (!scopeA || !scopeB)
    return false;
  if (scopeA.scopePath === scopeB.scopePath) {
    return false;
  }
  if (scopeA.tokenAttributes !== scopeB.tokenAttributes) {
    return false;
  }
  return true;
}
const TOKENIZER_CACHE = {};
const REGISTRY = new mainExports.Registry({
  // @ts-ignore
  onigLib: oniguruma,
  loadGrammar: (grammar) => fetchFromCDN("grammar", grammar).then((response) => {
    response.scopeName = grammar;
    return response;
  })
});
const [WASM_LOADED] = createRoot(() => createResource(async () => fetch(urlFromCDN("oniguruma", null)).then((buffer) => buffer.arrayBuffer()).then((buffer) => mainExports$1.loadWASM(buffer)).then(() => true)));
function createManager(props) {
  const [source, setSource] = createSignal(props.value);
  const [tokenizer] = createResource(every(() => props.grammar, WASM_LOADED), async ([grammar]) => grammar in TOKENIZER_CACHE ? TOKENIZER_CACHE[grammar] : TOKENIZER_CACHE[grammar] = await REGISTRY.loadGrammar(grammar));
  const [theme] = createResource(() => props.theme, (theme2) => fetchFromCDN("theme", theme2).then((theme3) => new ThemeManager(theme3)));
  const manager = createMemo(when(every(tokenizer, theme), ([tokenizer2, theme2]) => new SegmentManager(tokenizer2, theme2, source)));
  createRenderEffect(() => setSource(props.value));
  return [manager, setSource];
}
function createTmTextarea(styles) {
  return function TmTextarea(props) {
    const [config, rest] = splitProps(mergeProps({
      editable: true
    }, props), ["class", "grammar", "onInput", "value", "style", "theme", "editable", "onScroll", "textareaRef"]);
    let container;
    const [charHeight, setCharHeight] = createSignal(0);
    const [dimensions, setDimensions] = createSignal();
    const [scrollTop, setScrollTop] = createSignal(0);
    const [manager, setSource] = createManager(props);
    const lineSize = createMemo(() => getLongestLineSize(manager()?.lines() || []));
    const lineCount = () => manager()?.lines().length || 0;
    const minLine = createMemo(() => Math.floor(scrollTop() / charHeight()));
    const maxLine = createMemo(() => Math.floor((scrollTop() + (dimensions()?.height || 0)) / charHeight()));
    const minSegment = createMemo(() => Math.floor(minLine() / SEGMENT_SIZE));
    const maxSegment = createMemo(() => Math.ceil(maxLine() / SEGMENT_SIZE));
    const isVisible = createSelector(() => [minLine(), maxLine()], (index, [viewportMin, viewportMax]) => {
      if (index > lineCount() - 1) {
        return false;
      }
      return index + WINDOW > viewportMin && index - WINDOW < viewportMax;
    });
    const isSegmentVisible = createSelector(() => [minSegment(), maxSegment()], (index, [viewportMin, viewportMax]) => {
      const segmentMin = Math.floor((index - WINDOW) / SEGMENT_SIZE);
      const segmentMax = Math.ceil((index + WINDOW) / SEGMENT_SIZE);
      return segmentMin <= viewportMin && segmentMax >= viewportMax || segmentMin >= viewportMin && segmentMin <= viewportMax || segmentMax >= viewportMin && segmentMax <= viewportMax;
    });
    onMount(() => new ResizeObserver(([entry]) => setDimensions(entry?.contentRect)).observe(container));
    const selectionColor = when(manager, (manager2) => {
      const bg = manager2.theme.getBackgroundColor();
      const commentLuminance = luminance(...hexToRgb(bg));
      const opacity = commentLuminance > 0.9 ? 0.1 : commentLuminance < 0.1 ? 0.25 : 0.175;
      return `rgba(98, 114, 164, ${opacity})`;
    });
    const style = () => {
      if (!config.style)
        return void 0;
      const [_, style2] = splitProps(config.style, ["width", "height"]);
      return style2;
    };
    return (() => {
      var _el$ = _tmpl$$1(), _el$2 = _el$.firstChild, _el$3 = _el$2.nextSibling;
      _el$.addEventListener("scroll", (e) => {
        setScrollTop(e.currentTarget.scrollTop);
        props.onScroll?.(e);
      });
      use((element) => {
        container = element;
        applyStyle(element, props, "width");
        applyStyle(element, props, "height");
      }, _el$);
      spread(_el$, mergeProps({
        get ["class"]() {
          return clsx(styles.container, config.class);
        },
        get style() {
          return {
            "--background-color": manager()?.theme.getBackgroundColor(),
            "--char-height": `${charHeight()}px`,
            "--foreground-color": manager()?.theme.getForegroundColor(),
            "--line-count": lineCount(),
            "--line-size": lineSize(),
            "--selection-color": selectionColor(),
            "--line-digits": countDigits(lineCount()),
            ...style()
          };
        }
      }, rest), false);
      insert(_el$, createComponent(Show, {
        get when() {
          return manager();
        },
        children: (manager2) => (() => {
          var _el$4 = _tmpl$2$1();
          insert(_el$4, createComponent(Index, {
            get each() {
              return Array.from({
                length: Math.ceil(manager2().lines().length / SEGMENT_SIZE)
              });
            },
            children: (_, segmentIndex) => createComponent(Show, {
              get when() {
                return isSegmentVisible(segmentIndex * SEGMENT_SIZE);
              },
              get children() {
                return createComponent(Index, {
                  get each() {
                    return Array.from({
                      length: SEGMENT_SIZE
                    });
                  },
                  children: (_2, index) => createComponent(Show, {
                    get when() {
                      return isVisible(segmentIndex * SEGMENT_SIZE + index);
                    },
                    get children() {
                      var _el$5 = _tmpl$3$1();
                      segmentIndex * SEGMENT_SIZE + index != null ? _el$5.style.setProperty("--line-number", segmentIndex * SEGMENT_SIZE + index) : _el$5.style.removeProperty("--line-number");
                      createRenderEffect((_p$) => {
                        var _v$5 = styles.line, _v$6 = manager2().getLine(segmentIndex * SEGMENT_SIZE + index);
                        _v$5 !== _p$.e && className(_el$5, _p$.e = _v$5);
                        _v$6 !== _p$.t && (_el$5.innerHTML = _p$.t = _v$6);
                        return _p$;
                      }, {
                        e: void 0,
                        t: void 0
                      });
                      return _el$5;
                    }
                  })
                });
              }
            })
          }));
          createRenderEffect(() => className(_el$4, styles.code));
          return _el$4;
        })()
      }), _el$2);
      _el$2.$$keydown = (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          const scrollTop2 = container.scrollTop;
          const start = e.currentTarget.selectionStart;
          const end = e.currentTarget.selectionEnd;
          const value = e.currentTarget.value;
          e.currentTarget.value = setSource(value.substring(0, start) + "\n" + value.substring(end));
          e.currentTarget.selectionStart = e.currentTarget.selectionEnd = start + 1;
          container.scrollTop = scrollTop2;
        }
      };
      _el$2.addEventListener("scroll", (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
      var _ref$ = config.textareaRef;
      typeof _ref$ === "function" ? use(_ref$, _el$2) : config.textareaRef = _el$2;
      setAttribute(_el$2, "spellcheck", false);
      _el$2.addEventListener("input", (e) => {
        const target = e.currentTarget;
        const value = target.value;
        setSource(value);
        config.onInput?.(e);
      });
      use((element) => {
        new ResizeObserver(() => {
          const {
            height
          } = getComputedStyle(element);
          setCharHeight(Number(height.replace("px", "")));
        }).observe(element);
      }, _el$3);
      createRenderEffect((_p$) => {
        var _v$ = styles.textarea, _v$2 = !config.editable, _v$3 = lineCount(), _v$4 = styles.character;
        _v$ !== _p$.e && className(_el$2, _p$.e = _v$);
        _v$2 !== _p$.t && (_el$2.disabled = _p$.t = _v$2);
        _v$3 !== _p$.a && setAttribute(_el$2, "rows", _p$.a = _v$3);
        _v$4 !== _p$.o && className(_el$3, _p$.o = _v$4);
        return _p$;
      }, {
        e: void 0,
        t: void 0,
        a: void 0,
        o: void 0
      });
      createRenderEffect(() => _el$2.value = config.value);
      return _el$;
    })();
  };
}
delegateEvents(["keydown"]);

const classnames = ["container","code","line","character","textarea"];

const css = ":host {\n  display: contents;\n\n  & .container {\n    all: inherit;\n    display: flex;\n    position: relative;\n    box-sizing: border-box;\n    background-color: var(--background-color);\n    overflow: auto;\n    color: var(--foreground-color);\n  }\n}\n\n.container {\n  --min-height: calc(var(--line-count) * var(--char-height));\n  --min-width: calc(var(--line-size) * 1ch);\n  display: flex;\n  position: relative;\n  box-sizing: border-box;\n  background-color: var(--background-color);\n  overflow: auto;\n  color: var(--foreground-color);\n  font-size: 13px;\n\n  & .code {\n    display: block;\n    position: absolute;\n    z-index: 1;\n    /* fixes color change when textarea is focused */\n    backface-visibility: hidden;\n    contain: layout;\n    pointer-events: none;\n    font-size: inherit;\n    line-height: inherit;\n    font-family: monospace;\n    white-space: pre;\n\n    & .line {\n      position: absolute;\n      top: calc(var(--line-number) * var(--char-height));\n      margin: 0px;\n\n      & span {\n        margin: 0px;\n        background: transparent !important;\n      }\n    }\n  }\n\n  & .character {\n    position: absolute;\n    align-self: start;\n    visibility: hidden;\n    pointer-events: none;\n    font-size: inherit;\n    line-height: inherit;\n  }\n\n  & .textarea {\n    transition: color 0.5s;\n    outline: none;\n    border: none;\n    background: transparent;\n    padding: 0px;\n    width: 100%;\n    min-width: var(--min-width);\n    height: 100%;\n    min-height: var(--min-height);\n    overflow: hidden;\n    resize: none;\n    color: transparent;\n    caret-color: var(--foreground-color);\n    font-size: inherit;\n    line-height: inherit;\n    font-family: monospace;\n    text-align: inherit;\n    white-space: pre;\n  }\n\n  & .textarea::selection {\n    background: var(--selection-color);\n  }\n}\n";

const cache = /* @__PURE__ */ new Map();
function sheet(text) {
  if (text instanceof CSSStyleSheet) {
    return text;
  }
  if (!cache.has(text)) {
    const stylesheet = new CSSStyleSheet();
    stylesheet.replace(text);
    cache.set(text, stylesheet);
  }
  return cache.get(text);
}

let _initClass, _classDecs, _grammarDecs, _init_grammar, _themeDecs, _init_theme, _init_stylesheet, _init_editable, _init__value;
function _applyDecs(e, t, r, n, o, a) {
  function i(e2, t2, r2) {
    return function(n2, o2) {
      return r2 && r2(n2), e2[t2].call(n2, o2);
    };
  }
  function c(e2, t2) {
    for (var r2 = 0; r2 < e2.length; r2++)
      e2[r2].call(t2);
    return t2;
  }
  function s(e2, t2, r2, n2) {
    if ("function" != typeof e2 && (n2 || void 0 !== e2))
      throw new TypeError(t2 + " must " + (r2 || "be") + " a function" + (n2 ? "" : " or undefined"));
    return e2;
  }
  function applyDec(e2, t2, r2, n2, o2, a2, c2, u2, l2, f2, p2, d, h) {
    function m(e3) {
      if (!h(e3))
        throw new TypeError("Attempted to access private element on non-instance");
    }
    var y, v = t2[0], g = t2[3], b = !u2;
    if (!b) {
      r2 || Array.isArray(v) || (v = [v]);
      var w = {}, S = [], A = 3 === o2 ? "get" : 4 === o2 || d ? "set" : "value";
      f2 ? (p2 || d ? w = { get: _setFunctionName(function() {
        return g(this);
      }, n2, "get"), set: function(e3) {
        t2[4](this, e3);
      } } : w[A] = g, p2 || _setFunctionName(w[A], n2, 2 === o2 ? "" : A)) : p2 || (w = Object.getOwnPropertyDescriptor(e2, n2));
    }
    for (var P = e2, j = v.length - 1; j >= 0; j -= r2 ? 2 : 1) {
      var D = v[j], E = r2 ? v[j - 1] : void 0, I = {}, O = { kind: ["field", "accessor", "method", "getter", "setter", "class"][o2], name: n2, metadata: a2, addInitializer: function(e3, t3) {
        if (e3.v)
          throw Error("attempted to call addInitializer after decoration was finished");
        s(t3, "An initializer", "be", true), c2.push(t3);
      }.bind(null, I) };
      try {
        if (b)
          (y = s(D.call(E, P, O), "class decorators", "return")) && (P = y);
        else {
          var k, F;
          O.static = l2, O.private = f2, f2 ? 2 === o2 ? k = function(e3) {
            return m(e3), w.value;
          } : (o2 < 4 && (k = i(w, "get", m)), 3 !== o2 && (F = i(w, "set", m))) : (k = function(e3) {
            return e3[n2];
          }, (o2 < 2 || 4 === o2) && (F = function(e3, t3) {
            e3[n2] = t3;
          }));
          var N = O.access = { has: f2 ? h.bind() : function(e3) {
            return n2 in e3;
          } };
          if (k && (N.get = k), F && (N.set = F), P = D.call(E, d ? { get: w.get, set: w.set } : w[A], O), d) {
            if ("object" == typeof P && P)
              (y = s(P.get, "accessor.get")) && (w.get = y), (y = s(P.set, "accessor.set")) && (w.set = y), (y = s(P.init, "accessor.init")) && S.push(y);
            else if (void 0 !== P)
              throw new TypeError("accessor decorators must return an object with get, set, or init properties or void 0");
          } else
            s(P, (p2 ? "field" : "method") + " decorators", "return") && (p2 ? S.push(P) : w[A] = P);
        }
      } finally {
        I.v = true;
      }
    }
    return (p2 || d) && u2.push(function(e3, t3) {
      for (var r3 = S.length - 1; r3 >= 0; r3--)
        t3 = S[r3].call(e3, t3);
      return t3;
    }), p2 || b || (f2 ? d ? u2.push(i(w, "get"), i(w, "set")) : u2.push(2 === o2 ? w[A] : i.call.bind(w[A])) : Object.defineProperty(e2, n2, w)), P;
  }
  function u(e2, t2) {
    return Object.defineProperty(e2, Symbol.metadata || Symbol.for("Symbol.metadata"), { configurable: true, enumerable: true, value: t2 });
  }
  if (arguments.length >= 6)
    var l = a[Symbol.metadata || Symbol.for("Symbol.metadata")];
  var f = Object.create(null == l ? null : l), p = function(e2, t2, r2, n2) {
    var o2, a2, i2 = [], s2 = function(t3) {
      return _checkInRHS(t3) === e2;
    }, u2 = /* @__PURE__ */ new Map();
    function l2(e3) {
      e3 && i2.push(c.bind(null, e3));
    }
    for (var f2 = 0; f2 < t2.length; f2++) {
      var p2 = t2[f2];
      if (Array.isArray(p2)) {
        var d = p2[1], h = p2[2], m = p2.length > 3, y = 16 & d, v = !!(8 & d), g = 0 == (d &= 7), b = h + "/" + v;
        if (!g && !m) {
          var w = u2.get(b);
          if (true === w || 3 === w && 4 !== d || 4 === w && 3 !== d)
            throw Error("Attempted to decorate a public method/accessor that has the same name as a previously decorated public method/accessor. This is not currently supported by the decorators plugin. Property name was: " + h);
          u2.set(b, !(d > 2) || d);
        }
        applyDec(v ? e2 : e2.prototype, p2, y, m ? "#" + h : _toPropertyKey(h), d, n2, v ? a2 = a2 || [] : o2 = o2 || [], i2, v, m, g, 1 === d, v && m ? s2 : r2);
      }
    }
    return l2(o2), l2(a2), i2;
  }(e, t, o, f);
  return r.length || u(e, f), { e: p, get c() {
    var t2 = [];
    return r.length && [u(applyDec(e, [r], n, e.name, 5, f, t2), f), c.bind(null, t2, e)];
  } };
}
function _toPropertyKey(t) {
  var i = _toPrimitive(t, "string");
  return "symbol" == typeof i ? i : i + "";
}
function _toPrimitive(t, r) {
  if ("object" != typeof t || !t)
    return t;
  var e = t[Symbol.toPrimitive];
  if (void 0 !== e) {
    var i = e.call(t, r );
    if ("object" != typeof i)
      return i;
    throw new TypeError("@@toPrimitive must return a primitive value.");
  }
  return (String )(t);
}
function _setFunctionName(e, t, n) {
  "symbol" == typeof t && (t = (t = t.description) ? "[" + t + "]" : "");
  try {
    Object.defineProperty(e, "name", { configurable: true, value: n ? n + " " + t : t });
  } catch (e2) {
  }
  return e;
}
function _checkInRHS(e) {
  if (Object(e) !== e)
    throw TypeError("right-hand side of 'in' should be an object, got " + (null !== e ? typeof e : "null"));
  return e;
}
const TmTextarea$1 = createTmTextarea(Object.fromEntries(classnames.map((name) => [name, name])));
const TmTextareaStyleSheet = sheet(css);
_classDecs = [element("tm-textarea")];
let _TmTextareaElement;
class TmTextareaElement extends LumeElement {
  static {
    ({
      e: [_init_grammar, _init_theme, _init_stylesheet, _init_editable, _init__value],
      c: [_TmTextareaElement, _initClass]
    } = _applyDecs(this, [[_grammarDecs, 0, "grammar"], [_themeDecs, 0, "theme"], [stringAttribute, 0, "stylesheet"], [booleanAttribute, 0, "editable"], [signal, 0, "_value"]], _classDecs, 0, void 0, LumeElement));
  }
  [(_grammarDecs = attribute(), _themeDecs = attribute(), "grammar")] = _init_grammar(this, "tsx");
  theme = _init_theme(this, "dark-plus");
  stylesheet = _init_stylesheet(this, "");
  editable = _init_editable(this, true);
  _value = _init__value(this, "");
  textarea = null;
  template = () => {
    const _self$ = this;
    const adoptedStyleSheets = this.shadowRoot.adoptedStyleSheets;
    adoptedStyleSheets.push(TmTextareaStyleSheet);
    if (this.stylesheet) {
      adoptedStyleSheets.push(sheet(this.stylesheet));
    }
    return createComponent(TmTextarea$1, {
      get grammar() {
        return _self$.grammar;
      },
      get theme() {
        return _self$.theme;
      },
      get value() {
        return _self$._value;
      },
      get editable() {
        return _self$.editable;
      },
      textareaRef: (textarea) => _self$.textarea = textarea
    });
  };
  get value() {
    return this.textarea.value;
  }
  set value(value) {
    this._value = value;
  }
  static {
    _initClass();
  }
}

const container = "_container_1s4r7_4";
const code = "_code_1s4r7_26";
const line = "_line_1s4r7_39";
const character = "_character_1s4r7_51";
const textarea = "_textarea_1s4r7_60";
const styles = {
	container: container,
	code: code,
	line: line,
	character: character,
	textarea: textarea
};

const TmTextarea = createTmTextarea(styles);

const grammars = [
  "abap",
  "actionscript-3",
  "ada",
  "angular-expression",
  "angular-html",
  "angular-inline-style",
  "angular-inline-template",
  "angular-let-declaration",
  "angular-template-blocks",
  "angular-template",
  "angular-ts",
  "apache",
  "apex",
  "apl",
  "applescript",
  "ara",
  "asciidoc",
  "asm",
  "astro",
  "awk",
  "ballerina",
  "bat",
  "beancount",
  "berry",
  "bibtex",
  "bicep",
  "blade",
  "c",
  "cadence",
  "clarity",
  "clojure",
  "cmake",
  "cobol",
  "codeowners",
  "codeql",
  "coffee",
  "common-lisp",
  "coq",
  "cpp-macro",
  "cpp",
  "crystal",
  "csharp",
  "css",
  "csv",
  "cue",
  "cypher",
  "d",
  "dart",
  "dax",
  "desktop",
  "diff",
  "docker",
  "dotenv",
  "dream-maker",
  "edge",
  "elixir",
  "elm",
  "emacs-lisp",
  "erb",
  "erlang",
  "es-tag-css",
  "es-tag-glsl",
  "es-tag-html",
  "es-tag-sql",
  "es-tag-xml",
  "fennel",
  "fish",
  "fluent",
  "fortran-fixed-form",
  "fortran-free-form",
  "fsharp",
  "gdresource",
  "gdscript",
  "gdshader",
  "genie",
  "gherkin",
  "git-commit",
  "git-rebase",
  "gleam",
  "glimmer-js",
  "glimmer-ts",
  "glsl",
  "gnuplot",
  "go",
  "graphql",
  "groovy",
  "hack",
  "haml",
  "handlebars",
  "haskell",
  "haxe",
  "hcl",
  "hjson",
  "hlsl",
  "html-derivative",
  "html",
  "http",
  "hxml",
  "hy",
  "imba",
  "ini",
  "java",
  "javascript",
  "jinja-html",
  "jinja",
  "jison",
  "json",
  "json5",
  "jsonc",
  "jsonl",
  "jsonnet",
  "jssm",
  "jsx",
  "julia",
  "kotlin",
  "kusto",
  "latex",
  "lean",
  "less",
  "liquid",
  "log",
  "logo",
  "lua",
  "luau",
  "make",
  "markdown-vue",
  "markdown",
  "marko",
  "matlab",
  "mdc",
  "mdx",
  "mermaid",
  "mojo",
  "move",
  "narrat",
  "nextflow",
  "nginx",
  "nim",
  "nix",
  "nushell",
  "objective-c",
  "objective-cpp",
  "ocaml",
  "pascal",
  "perl",
  "php",
  "plsql",
  "po",
  "postcss",
  "powerquery",
  "powershell",
  "prisma",
  "prolog",
  "proto",
  "pug",
  "puppet",
  "purescript",
  "python",
  "qml",
  "qmldir",
  "qss",
  "r",
  "racket",
  "raku",
  "razor",
  "reg",
  "regexp",
  "rel",
  "riscv",
  "rst",
  "ruby",
  "rust",
  "sas",
  "sass",
  "scala",
  "scheme",
  "scss",
  "shaderlab",
  "shellscript",
  "shellsession",
  "smalltalk",
  "solidity",
  "soy",
  "sparql",
  "splunk",
  "sql",
  "ssh-config",
  "stata",
  "stylus",
  "svelte",
  "swift",
  "system-verilog",
  "systemd",
  "tasl",
  "tcl",
  "templ",
  "terraform",
  "tex",
  "toml",
  "ts-tags",
  "tsv",
  "tsx",
  "turtle",
  "twig",
  "typescript",
  "typespec",
  "typst",
  "v",
  "vala",
  "vb",
  "verilog",
  "vhdl",
  "viml",
  "vue-directives",
  "vue-html",
  "vue-interpolations",
  "vue-sfc-style-variable-injection",
  "vue",
  "vyper",
  "wasm",
  "wenyan",
  "wgsl",
  "wikitext",
  "wolfram",
  "xml",
  "xsl",
  "yaml",
  "zenscript",
  "zig"
];

const themes = [
  "andromeeda",
  "aurora-x",
  "ayu-dark",
  "catppuccin-frappe",
  "catppuccin-latte",
  "catppuccin-macchiato",
  "catppuccin-mocha",
  "dark-plus",
  "dracula-soft",
  "dracula",
  "everforest-dark",
  "everforest-light",
  "github-dark-default",
  "github-dark-dimmed",
  "github-dark-high-contrast",
  "github-dark",
  "github-light-default",
  "github-light-high-contrast",
  "github-light",
  "houston",
  "laserwave",
  "light-plus",
  "material-theme-darker",
  "material-theme-lighter",
  "material-theme-ocean",
  "material-theme-palenight",
  "material-theme",
  "min-dark",
  "min-light",
  "monokai",
  "night-owl",
  "nord",
  "one-dark-pro",
  "one-light",
  "plastic",
  "poimandres",
  "red",
  "rose-pine-dawn",
  "rose-pine-moon",
  "rose-pine",
  "slack-dark",
  "slack-ochin",
  "snazzy-light",
  "solarized-dark",
  "solarized-light",
  "synthwave-84",
  "tokyo-night",
  "vesper",
  "vitesse-black",
  "vitesse-dark",
  "vitesse-light"
];

const tsx = ""+new URL('tsx-Da1Z4H1i.json', import.meta.url).href+"";

var _tmpl$ = /* @__PURE__ */ template(`<tm-textarea>`, true, false), _tmpl$2 = /* @__PURE__ */ template(`<div class=app><div class=side-panel><h1>Tm Textarea</h1><footer><div><label for=mode>mode</label><button id=mode></button></div><br><div><label for=theme>themes</label><select id=theme></select></div><div><label for=lang>languages</label><select id=lang></select></div><br><div><label for=LOC>LOC</label><input id=LOC type=number></div><div><label for=padding>padding</label><input id=padding type=number></div><div><label for=font-size>font-size</label><input id=font-size type=number></div><div><label for=line-numbers>Line Numbers</label><button id=line-numbers></button></div><div><label for=editable>editable</label><button id=editable></button></div></footer></div><main>`), _tmpl$3 = /* @__PURE__ */ template(`<option>`);
setCDN((type, id) => {
  switch (type) {
    case "theme":
      return `https://esm.sh/tm-themes/themes/${id}.json`;
    case "grammar":
      return id === "tsx" ? tsx : `https://esm.sh/tm-grammars/grammars/${id}.json`;
    case "oniguruma":
      return `https://esm.sh/vscode-oniguruma/release/onig.wasm`;
  }
});
const App = () => {
  const [mode, setMode] = createSignal("custom-element");
  const [theme, setCurrentThemeName] = createSignal("light-plus");
  const [grammar, setCurrentLanguageName] = createSignal("tsx");
  const [fontSize, setFontSize] = createSignal(10);
  const [padding, setPadding] = createSignal(20);
  const [editable, setEditable] = createSignal(true);
  const [lineNumbers, setLineNumbers] = createSignal(true);
  const [LOC, setLOC] = createSignal(1e4);
  const [value, setValue] = createSignal(null);
  createRenderEffect(() => {
    setValue(loopLines(test, LOC()));
  });
  function loopLines(input, lineCount) {
    const lines = input.split("\n");
    const totalLines = lines.length;
    let result = "";
    for (let i = 0; i < lineCount; i++) {
      result += lines[i % totalLines] + "\n";
    }
    return result.trim();
  }
  return (() => {
    var _el$ = _tmpl$2(), _el$2 = _el$.firstChild, _el$3 = _el$2.firstChild, _el$4 = _el$3.nextSibling, _el$5 = _el$4.firstChild, _el$6 = _el$5.firstChild, _el$7 = _el$6.nextSibling, _el$8 = _el$5.nextSibling, _el$9 = _el$8.nextSibling, _el$10 = _el$9.firstChild, _el$11 = _el$10.nextSibling, _el$12 = _el$9.nextSibling, _el$13 = _el$12.firstChild, _el$14 = _el$13.nextSibling, _el$15 = _el$12.nextSibling, _el$16 = _el$15.nextSibling, _el$17 = _el$16.firstChild, _el$18 = _el$17.nextSibling, _el$19 = _el$16.nextSibling, _el$20 = _el$19.firstChild, _el$21 = _el$20.nextSibling, _el$22 = _el$19.nextSibling, _el$23 = _el$22.firstChild, _el$24 = _el$23.nextSibling, _el$25 = _el$22.nextSibling, _el$26 = _el$25.firstChild, _el$27 = _el$26.nextSibling, _el$28 = _el$25.nextSibling, _el$29 = _el$28.firstChild, _el$30 = _el$29.nextSibling, _el$31 = _el$2.nextSibling;
    _el$7.$$click = (e) => {
      setMode((mode2) => mode2 === "custom-element" ? "solid" : "custom-element");
    };
    insert(_el$7, mode);
    _el$11.$$input = (e) => setCurrentThemeName(e.currentTarget.value);
    insert(_el$11, createComponent(For, {
      each: themes,
      children: (theme2) => (() => {
        var _el$33 = _tmpl$3();
        insert(_el$33, theme2);
        return _el$33;
      })()
    }));
    _el$14.$$input = (e) => setCurrentLanguageName(e.currentTarget.value);
    insert(_el$14, createComponent(For, {
      each: grammars,
      children: (grammar2) => (() => {
        var _el$34 = _tmpl$3();
        insert(_el$34, grammar2);
        return _el$34;
      })()
    }));
    _el$18.$$input = (e) => setLOC(+e.currentTarget.value);
    _el$21.$$input = (e) => setPadding(+e.currentTarget.value);
    _el$24.$$input = (e) => setFontSize(+e.currentTarget.value);
    _el$27.$$click = (e) => {
      setLineNumbers((bool) => !bool);
    };
    insert(_el$27, () => lineNumbers() ? "enabled" : "disabled");
    _el$30.$$click = (e) => {
      setEditable((bool) => !bool);
    };
    insert(_el$30, () => editable() ? "enabled" : "disabled");
    insert(_el$31, createComponent(Show, {
      get when() {
        return mode() === "custom-element";
      },
      get fallback() {
        return createComponent(TmTextarea, {
          get value() {
            return value();
          },
          get grammar() {
            return grammar();
          },
          get theme() {
            return theme();
          },
          get editable() {
            return editable();
          },
          get style() {
            return {
              padding: `${padding()}px`
            };
          },
          get ["class"]() {
            return lineNumbers() ? "line-numbers tm-textarea" : "tm-textarea";
          },
          onInput: (e) => setValue(e.currentTarget.value)
        });
      },
      get children() {
        var _el$32 = _tmpl$();
        _el$32.$$input = (e) => setValue(e.currentTarget.value);
        _el$32._$owner = getOwner();
        createRenderEffect((_p$) => {
          var _v$ = grammar(), _v$2 = theme(), _v$3 = editable(), _v$4 = `${padding()}px`, _v$5 = lineNumbers() ? "line-numbers tm-textarea" : "tm-textarea";
          _v$ !== _p$.e && (_el$32.grammar = _p$.e = _v$);
          _v$2 !== _p$.t && (_el$32.theme = _p$.t = _v$2);
          _v$3 !== _p$.a && (_el$32.editable = _p$.a = _v$3);
          _v$4 !== _p$.o && ((_p$.o = _v$4) != null ? _el$32.style.setProperty("padding", _v$4) : _el$32.style.removeProperty("padding"));
          _v$5 !== _p$.i && className(_el$32, _p$.i = _v$5);
          return _p$;
        }, {
          e: void 0,
          t: void 0,
          a: void 0,
          o: void 0,
          i: void 0
        });
        createRenderEffect(() => _el$32.value = value());
        return _el$32;
      }
    }));
    createRenderEffect(() => _el$11.value = theme());
    createRenderEffect(() => _el$14.value = grammar());
    createRenderEffect(() => _el$18.value = LOC());
    createRenderEffect(() => _el$21.value = padding());
    createRenderEffect(() => _el$24.value = fontSize());
    return _el$;
  })();
};
render(() => createComponent(App, {}), document.getElementById("root"));
delegateEvents(["click", "input"]);
