
(function(l, r) { if (!l || l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (self.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(self.document);
var app = (function () {
	'use strict';

	/** @returns {void} */
	function noop() {}

	const identity = (x) => x;

	/**
	 * @template T
	 * @template S
	 * @param {T} tar
	 * @param {S} src
	 * @returns {T & S}
	 */
	function assign(tar, src) {
		// @ts-ignore
		for (const k in src) tar[k] = src[k];
		return /** @type {T & S} */ (tar);
	}

	/** @returns {void} */
	function add_location(element, file, line, column, char) {
		element.__svelte_meta = {
			loc: { file, line, column, char }
		};
	}

	function run(fn) {
		return fn();
	}

	function blank_object() {
		return Object.create(null);
	}

	/**
	 * @param {Function[]} fns
	 * @returns {void}
	 */
	function run_all(fns) {
		fns.forEach(run);
	}

	/**
	 * @param {any} thing
	 * @returns {thing is Function}
	 */
	function is_function(thing) {
		return typeof thing === 'function';
	}

	/** @returns {boolean} */
	function safe_not_equal(a, b) {
		return a != a ? b == b : a !== b || (a && typeof a === 'object') || typeof a === 'function';
	}

	let src_url_equal_anchor;

	/**
	 * @param {string} element_src
	 * @param {string} url
	 * @returns {boolean}
	 */
	function src_url_equal(element_src, url) {
		if (element_src === url) return true;
		if (!src_url_equal_anchor) {
			src_url_equal_anchor = document.createElement('a');
		}
		// This is actually faster than doing URL(..).href
		src_url_equal_anchor.href = url;
		return element_src === src_url_equal_anchor.href;
	}

	/** @returns {boolean} */
	function is_empty(obj) {
		return Object.keys(obj).length === 0;
	}

	function create_slot(definition, ctx, $$scope, fn) {
		if (definition) {
			const slot_ctx = get_slot_context(definition, ctx, $$scope, fn);
			return definition[0](slot_ctx);
		}
	}

	function get_slot_context(definition, ctx, $$scope, fn) {
		return definition[1] && fn ? assign($$scope.ctx.slice(), definition[1](fn(ctx))) : $$scope.ctx;
	}

	function get_slot_changes(definition, $$scope, dirty, fn) {
		if (definition[2] && fn) {
			const lets = definition[2](fn(dirty));
			if ($$scope.dirty === undefined) {
				return lets;
			}
			if (typeof lets === 'object') {
				const merged = [];
				const len = Math.max($$scope.dirty.length, lets.length);
				for (let i = 0; i < len; i += 1) {
					merged[i] = $$scope.dirty[i] | lets[i];
				}
				return merged;
			}
			return $$scope.dirty | lets;
		}
		return $$scope.dirty;
	}

	/** @returns {void} */
	function update_slot_base(
		slot,
		slot_definition,
		ctx,
		$$scope,
		slot_changes,
		get_slot_context_fn
	) {
		if (slot_changes) {
			const slot_context = get_slot_context(slot_definition, ctx, $$scope, get_slot_context_fn);
			slot.p(slot_context, slot_changes);
		}
	}

	/** @returns {any[] | -1} */
	function get_all_dirty_from_scope($$scope) {
		if ($$scope.ctx.length > 32) {
			const dirty = [];
			const length = $$scope.ctx.length / 32;
			for (let i = 0; i < length; i++) {
				dirty[i] = -1;
			}
			return dirty;
		}
		return -1;
	}

	/** @returns {{}} */
	function compute_slots(slots) {
		const result = {};
		for (const key in slots) {
			result[key] = true;
		}
		return result;
	}

	const is_client = typeof window !== 'undefined';

	/** @type {() => number} */
	let now = is_client ? () => window.performance.now() : () => Date.now();

	let raf = is_client ? (cb) => requestAnimationFrame(cb) : noop;

	const tasks = new Set();

	/**
	 * @param {number} now
	 * @returns {void}
	 */
	function run_tasks(now) {
		tasks.forEach((task) => {
			if (!task.c(now)) {
				tasks.delete(task);
				task.f();
			}
		});
		if (tasks.size !== 0) raf(run_tasks);
	}

	/**
	 * Creates a new task that runs on each raf frame
	 * until it returns a falsy value or is aborted
	 * @param {import('./private.js').TaskCallback} callback
	 * @returns {import('./private.js').Task}
	 */
	function loop(callback) {
		/** @type {import('./private.js').TaskEntry} */
		let task;
		if (tasks.size === 0) raf(run_tasks);
		return {
			promise: new Promise((fulfill) => {
				tasks.add((task = { c: callback, f: fulfill }));
			}),
			abort() {
				tasks.delete(task);
			}
		};
	}

	/** @type {typeof globalThis} */
	const globals =
		typeof window !== 'undefined'
			? window
			: typeof globalThis !== 'undefined'
			? globalThis
			: // @ts-ignore Node typings have this
			  global;

	/**
	 * @param {Node} target
	 * @param {Node} node
	 * @returns {void}
	 */
	function append(target, node) {
		target.appendChild(node);
	}

	/**
	 * @param {Node} node
	 * @returns {ShadowRoot | Document}
	 */
	function get_root_for_style(node) {
		if (!node) return document;
		const root = node.getRootNode ? node.getRootNode() : node.ownerDocument;
		if (root && /** @type {ShadowRoot} */ (root).host) {
			return /** @type {ShadowRoot} */ (root);
		}
		return node.ownerDocument;
	}

	/**
	 * @param {Node} node
	 * @returns {CSSStyleSheet}
	 */
	function append_empty_stylesheet(node) {
		const style_element = element('style');
		// For transitions to work without 'style-src: unsafe-inline' Content Security Policy,
		// these empty tags need to be allowed with a hash as a workaround until we move to the Web Animations API.
		// Using the hash for the empty string (for an empty tag) works in all browsers except Safari.
		// So as a workaround for the workaround, when we append empty style tags we set their content to /* empty */.
		// The hash 'sha256-9OlNO0DNEeaVzHL4RZwCLsBHA8WBQ8toBp/4F5XV2nc=' will then work even in Safari.
		style_element.textContent = '/* empty */';
		append_stylesheet(get_root_for_style(node), style_element);
		return style_element.sheet;
	}

	/**
	 * @param {ShadowRoot | Document} node
	 * @param {HTMLStyleElement} style
	 * @returns {CSSStyleSheet}
	 */
	function append_stylesheet(node, style) {
		append(/** @type {Document} */ (node).head || node, style);
		return style.sheet;
	}

	/**
	 * @param {Node} target
	 * @param {Node} node
	 * @param {Node} [anchor]
	 * @returns {void}
	 */
	function insert(target, node, anchor) {
		target.insertBefore(node, anchor || null);
	}

	/**
	 * @param {Node} node
	 * @returns {void}
	 */
	function detach(node) {
		if (node.parentNode) {
			node.parentNode.removeChild(node);
		}
	}

	/**
	 * @returns {void} */
	function destroy_each(iterations, detaching) {
		for (let i = 0; i < iterations.length; i += 1) {
			if (iterations[i]) iterations[i].d(detaching);
		}
	}

	/**
	 * @template {keyof HTMLElementTagNameMap} K
	 * @param {K} name
	 * @returns {HTMLElementTagNameMap[K]}
	 */
	function element(name) {
		return document.createElement(name);
	}

	/**
	 * @template {keyof SVGElementTagNameMap} K
	 * @param {K} name
	 * @returns {SVGElement}
	 */
	function svg_element(name) {
		return document.createElementNS('http://www.w3.org/2000/svg', name);
	}

	/**
	 * @param {string} data
	 * @returns {Text}
	 */
	function text(data) {
		return document.createTextNode(data);
	}

	/**
	 * @returns {Text} */
	function space() {
		return text(' ');
	}

	/**
	 * @returns {Text} */
	function empty() {
		return text('');
	}

	/**
	 * @param {EventTarget} node
	 * @param {string} event
	 * @param {EventListenerOrEventListenerObject} handler
	 * @param {boolean | AddEventListenerOptions | EventListenerOptions} [options]
	 * @returns {() => void}
	 */
	function listen(node, event, handler, options) {
		node.addEventListener(event, handler, options);
		return () => node.removeEventListener(event, handler, options);
	}

	/**
	 * @param {Element} node
	 * @param {string} attribute
	 * @param {string} [value]
	 * @returns {void}
	 */
	function attr(node, attribute, value) {
		if (value == null) node.removeAttribute(attribute);
		else if (node.getAttribute(attribute) !== value) node.setAttribute(attribute, value);
	}

	/**
	 * @returns {unknown[]} */
	function get_binding_group_value(group, __value, checked) {
		const value = new Set();
		for (let i = 0; i < group.length; i += 1) {
			if (group[i].checked) value.add(group[i].__value);
		}
		if (!checked) {
			value.delete(__value);
		}
		return Array.from(value);
	}

	/**
	 * @param {HTMLInputElement[]} group
	 * @returns {{ p(...inputs: HTMLInputElement[]): void; r(): void; }}
	 */
	function init_binding_group(group) {
		/**
		 * @type {HTMLInputElement[]} */
		let _inputs;
		return {
			/* push */ p(...inputs) {
				_inputs = inputs;
				_inputs.forEach((input) => group.push(input));
			},
			/* remove */ r() {
				_inputs.forEach((input) => group.splice(group.indexOf(input), 1));
			}
		};
	}

	/**
	 * @param {Element} element
	 * @returns {ChildNode[]}
	 */
	function children(element) {
		return Array.from(element.childNodes);
	}

	/**
	 * @returns {void} */
	function set_input_value(input, value) {
		input.value = value == null ? '' : value;
	}

	/**
	 * @returns {void} */
	function set_style(node, key, value, important) {
		if (value == null) {
			node.style.removeProperty(key);
		} else {
			node.style.setProperty(key, value, important ? 'important' : '');
		}
	}

	/**
	 * @template T
	 * @param {string} type
	 * @param {T} [detail]
	 * @param {{ bubbles?: boolean, cancelable?: boolean }} [options]
	 * @returns {CustomEvent<T>}
	 */
	function custom_event(type, detail, { bubbles = false, cancelable = false } = {}) {
		return new CustomEvent(type, { detail, bubbles, cancelable });
	}

	/**
	 * @typedef {Node & {
	 * 	claim_order?: number;
	 * 	hydrate_init?: true;
	 * 	actual_end_child?: NodeEx;
	 * 	childNodes: NodeListOf<NodeEx>;
	 * }} NodeEx
	 */

	/** @typedef {ChildNode & NodeEx} ChildNodeEx */

	/** @typedef {NodeEx & { claim_order: number }} NodeEx2 */

	/**
	 * @typedef {ChildNodeEx[] & {
	 * 	claim_info?: {
	 * 		last_index: number;
	 * 		total_claimed: number;
	 * 	};
	 * }} ChildNodeArray
	 */

	// we need to store the information for multiple documents because a Svelte application could also contain iframes
	// https://github.com/sveltejs/svelte/issues/3624
	/** @type {Map<Document | ShadowRoot, import('./private.d.ts').StyleInformation>} */
	const managed_styles = new Map();

	let active = 0;

	// https://github.com/darkskyapp/string-hash/blob/master/index.js
	/**
	 * @param {string} str
	 * @returns {number}
	 */
	function hash(str) {
		let hash = 5381;
		let i = str.length;
		while (i--) hash = ((hash << 5) - hash) ^ str.charCodeAt(i);
		return hash >>> 0;
	}

	/**
	 * @param {Document | ShadowRoot} doc
	 * @param {Element & ElementCSSInlineStyle} node
	 * @returns {{ stylesheet: any; rules: {}; }}
	 */
	function create_style_information(doc, node) {
		const info = { stylesheet: append_empty_stylesheet(node), rules: {} };
		managed_styles.set(doc, info);
		return info;
	}

	/**
	 * @param {Element & ElementCSSInlineStyle} node
	 * @param {number} a
	 * @param {number} b
	 * @param {number} duration
	 * @param {number} delay
	 * @param {(t: number) => number} ease
	 * @param {(t: number, u: number) => string} fn
	 * @param {number} uid
	 * @returns {string}
	 */
	function create_rule(node, a, b, duration, delay, ease, fn, uid = 0) {
		const step = 16.666 / duration;
		let keyframes = '{\n';
		for (let p = 0; p <= 1; p += step) {
			const t = a + (b - a) * ease(p);
			keyframes += p * 100 + `%{${fn(t, 1 - t)}}\n`;
		}
		const rule = keyframes + `100% {${fn(b, 1 - b)}}\n}`;
		const name = `__svelte_${hash(rule)}_${uid}`;
		const doc = get_root_for_style(node);
		const { stylesheet, rules } = managed_styles.get(doc) || create_style_information(doc, node);
		if (!rules[name]) {
			rules[name] = true;
			stylesheet.insertRule(`@keyframes ${name} ${rule}`, stylesheet.cssRules.length);
		}
		const animation = node.style.animation || '';
		node.style.animation = `${
		animation ? `${animation}, ` : ''
	}${name} ${duration}ms linear ${delay}ms 1 both`;
		active += 1;
		return name;
	}

	/**
	 * @param {Element & ElementCSSInlineStyle} node
	 * @param {string} [name]
	 * @returns {void}
	 */
	function delete_rule(node, name) {
		const previous = (node.style.animation || '').split(', ');
		const next = previous.filter(
			name
				? (anim) => anim.indexOf(name) < 0 // remove specific animation
				: (anim) => anim.indexOf('__svelte') === -1 // remove all Svelte animations
		);
		const deleted = previous.length - next.length;
		if (deleted) {
			node.style.animation = next.join(', ');
			active -= deleted;
			if (!active) clear_rules();
		}
	}

	/** @returns {void} */
	function clear_rules() {
		raf(() => {
			if (active) return;
			managed_styles.forEach((info) => {
				const { ownerNode } = info.stylesheet;
				// there is no ownerNode if it runs on jsdom.
				if (ownerNode) detach(ownerNode);
			});
			managed_styles.clear();
		});
	}

	let current_component;

	/** @returns {void} */
	function set_current_component(component) {
		current_component = component;
	}

	function get_current_component() {
		if (!current_component) throw new Error('Function called outside component initialization');
		return current_component;
	}

	/**
	 * The `onMount` function schedules a callback to run as soon as the component has been mounted to the DOM.
	 * It must be called during the component's initialisation (but doesn't need to live *inside* the component;
	 * it can be called from an external module).
	 *
	 * If a function is returned _synchronously_ from `onMount`, it will be called when the component is unmounted.
	 *
	 * `onMount` does not run inside a [server-side component](/docs#run-time-server-side-component-api).
	 *
	 * https://svelte.dev/docs/svelte#onmount
	 * @template T
	 * @param {() => import('./private.js').NotFunction<T> | Promise<import('./private.js').NotFunction<T>> | (() => any)} fn
	 * @returns {void}
	 */
	function onMount(fn) {
		get_current_component().$$.on_mount.push(fn);
	}

	// TODO figure out if we still want to support
	// shorthand events, or if we want to implement
	// a real bubbling mechanism
	/**
	 * @param component
	 * @param event
	 * @returns {void}
	 */
	function bubble(component, event) {
		const callbacks = component.$$.callbacks[event.type];
		if (callbacks) {
			// @ts-ignore
			callbacks.slice().forEach((fn) => fn.call(this, event));
		}
	}

	const dirty_components = [];
	const binding_callbacks = [];

	let render_callbacks = [];

	const flush_callbacks = [];

	const resolved_promise = /* @__PURE__ */ Promise.resolve();

	let update_scheduled = false;

	/** @returns {void} */
	function schedule_update() {
		if (!update_scheduled) {
			update_scheduled = true;
			resolved_promise.then(flush);
		}
	}

	/** @returns {void} */
	function add_render_callback(fn) {
		render_callbacks.push(fn);
	}

	// flush() calls callbacks in this order:
	// 1. All beforeUpdate callbacks, in order: parents before children
	// 2. All bind:this callbacks, in reverse order: children before parents.
	// 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
	//    for afterUpdates called during the initial onMount, which are called in
	//    reverse order: children before parents.
	// Since callbacks might update component values, which could trigger another
	// call to flush(), the following steps guard against this:
	// 1. During beforeUpdate, any updated components will be added to the
	//    dirty_components array and will cause a reentrant call to flush(). Because
	//    the flush index is kept outside the function, the reentrant call will pick
	//    up where the earlier call left off and go through all dirty components. The
	//    current_component value is saved and restored so that the reentrant call will
	//    not interfere with the "parent" flush() call.
	// 2. bind:this callbacks cannot trigger new flush() calls.
	// 3. During afterUpdate, any updated components will NOT have their afterUpdate
	//    callback called a second time; the seen_callbacks set, outside the flush()
	//    function, guarantees this behavior.
	const seen_callbacks = new Set();

	let flushidx = 0; // Do *not* move this inside the flush() function

	/** @returns {void} */
	function flush() {
		// Do not reenter flush while dirty components are updated, as this can
		// result in an infinite loop. Instead, let the inner flush handle it.
		// Reentrancy is ok afterwards for bindings etc.
		if (flushidx !== 0) {
			return;
		}
		const saved_component = current_component;
		do {
			// first, call beforeUpdate functions
			// and update components
			try {
				while (flushidx < dirty_components.length) {
					const component = dirty_components[flushidx];
					flushidx++;
					set_current_component(component);
					update(component.$$);
				}
			} catch (e) {
				// reset dirty state to not end up in a deadlocked state and then rethrow
				dirty_components.length = 0;
				flushidx = 0;
				throw e;
			}
			set_current_component(null);
			dirty_components.length = 0;
			flushidx = 0;
			while (binding_callbacks.length) binding_callbacks.pop()();
			// then, once components are updated, call
			// afterUpdate functions. This may cause
			// subsequent updates...
			for (let i = 0; i < render_callbacks.length; i += 1) {
				const callback = render_callbacks[i];
				if (!seen_callbacks.has(callback)) {
					// ...so guard against infinite loops
					seen_callbacks.add(callback);
					callback();
				}
			}
			render_callbacks.length = 0;
		} while (dirty_components.length);
		while (flush_callbacks.length) {
			flush_callbacks.pop()();
		}
		update_scheduled = false;
		seen_callbacks.clear();
		set_current_component(saved_component);
	}

	/** @returns {void} */
	function update($$) {
		if ($$.fragment !== null) {
			$$.update();
			run_all($$.before_update);
			const dirty = $$.dirty;
			$$.dirty = [-1];
			$$.fragment && $$.fragment.p($$.ctx, dirty);
			$$.after_update.forEach(add_render_callback);
		}
	}

	/**
	 * Useful for example to execute remaining `afterUpdate` callbacks before executing `destroy`.
	 * @param {Function[]} fns
	 * @returns {void}
	 */
	function flush_render_callbacks(fns) {
		const filtered = [];
		const targets = [];
		render_callbacks.forEach((c) => (fns.indexOf(c) === -1 ? filtered.push(c) : targets.push(c)));
		targets.forEach((c) => c());
		render_callbacks = filtered;
	}

	/**
	 * @type {Promise<void> | null}
	 */
	let promise;

	/**
	 * @returns {Promise<void>}
	 */
	function wait() {
		if (!promise) {
			promise = Promise.resolve();
			promise.then(() => {
				promise = null;
			});
		}
		return promise;
	}

	/**
	 * @param {Element} node
	 * @param {INTRO | OUTRO | boolean} direction
	 * @param {'start' | 'end'} kind
	 * @returns {void}
	 */
	function dispatch(node, direction, kind) {
		node.dispatchEvent(custom_event(`${direction ? 'intro' : 'outro'}${kind}`));
	}

	const outroing = new Set();

	/**
	 * @type {Outro}
	 */
	let outros;

	/**
	 * @returns {void} */
	function group_outros() {
		outros = {
			r: 0,
			c: [],
			p: outros // parent group
		};
	}

	/**
	 * @returns {void} */
	function check_outros() {
		if (!outros.r) {
			run_all(outros.c);
		}
		outros = outros.p;
	}

	/**
	 * @param {import('./private.js').Fragment} block
	 * @param {0 | 1} [local]
	 * @returns {void}
	 */
	function transition_in(block, local) {
		if (block && block.i) {
			outroing.delete(block);
			block.i(local);
		}
	}

	/**
	 * @param {import('./private.js').Fragment} block
	 * @param {0 | 1} local
	 * @param {0 | 1} [detach]
	 * @param {() => void} [callback]
	 * @returns {void}
	 */
	function transition_out(block, local, detach, callback) {
		if (block && block.o) {
			if (outroing.has(block)) return;
			outroing.add(block);
			outros.c.push(() => {
				outroing.delete(block);
				if (callback) {
					if (detach) block.d(1);
					callback();
				}
			});
			block.o(local);
		} else if (callback) {
			callback();
		}
	}

	/**
	 * @type {import('../transition/public.js').TransitionConfig}
	 */
	const null_transition = { duration: 0 };

	/**
	 * @param {Element & ElementCSSInlineStyle} node
	 * @param {TransitionFn} fn
	 * @param {any} params
	 * @returns {{ start(): void; invalidate(): void; end(): void; }}
	 */
	function create_in_transition(node, fn, params) {
		/**
		 * @type {TransitionOptions} */
		const options = { direction: 'in' };
		let config = fn(node, params, options);
		let running = false;
		let animation_name;
		let task;
		let uid = 0;

		/**
		 * @returns {void} */
		function cleanup() {
			if (animation_name) delete_rule(node, animation_name);
		}

		/**
		 * @returns {void} */
		function go() {
			const {
				delay = 0,
				duration = 300,
				easing = identity,
				tick = noop,
				css
			} = config || null_transition;
			if (css) animation_name = create_rule(node, 0, 1, duration, delay, easing, css, uid++);
			tick(0, 1);
			const start_time = now() + delay;
			const end_time = start_time + duration;
			if (task) task.abort();
			running = true;
			add_render_callback(() => dispatch(node, true, 'start'));
			task = loop((now) => {
				if (running) {
					if (now >= end_time) {
						tick(1, 0);
						dispatch(node, true, 'end');
						cleanup();
						return (running = false);
					}
					if (now >= start_time) {
						const t = easing((now - start_time) / duration);
						tick(t, 1 - t);
					}
				}
				return running;
			});
		}
		let started = false;
		return {
			start() {
				if (started) return;
				started = true;
				delete_rule(node);
				if (is_function(config)) {
					config = config(options);
					wait().then(go);
				} else {
					go();
				}
			},
			invalidate() {
				started = false;
			},
			end() {
				if (running) {
					cleanup();
					running = false;
				}
			}
		};
	}

	/** @typedef {1} INTRO */
	/** @typedef {0} OUTRO */
	/** @typedef {{ direction: 'in' | 'out' | 'both' }} TransitionOptions */
	/** @typedef {(node: Element, params: any, options: TransitionOptions) => import('../transition/public.js').TransitionConfig} TransitionFn */

	/**
	 * @typedef {Object} Outro
	 * @property {number} r
	 * @property {Function[]} c
	 * @property {Object} p
	 */

	/**
	 * @typedef {Object} PendingProgram
	 * @property {number} start
	 * @property {INTRO|OUTRO} b
	 * @property {Outro} [group]
	 */

	/**
	 * @typedef {Object} Program
	 * @property {number} a
	 * @property {INTRO|OUTRO} b
	 * @property {1|-1} d
	 * @property {number} duration
	 * @property {number} start
	 * @property {number} end
	 * @property {Outro} [group]
	 */

	// general each functions:

	function ensure_array_like(array_like_or_iterator) {
		return array_like_or_iterator?.length !== undefined
			? array_like_or_iterator
			: Array.from(array_like_or_iterator);
	}

	/** @returns {void} */
	function outro_and_destroy_block(block, lookup) {
		transition_out(block, 1, 1, () => {
			lookup.delete(block.key);
		});
	}

	/** @returns {any[]} */
	function update_keyed_each(
		old_blocks,
		dirty,
		get_key,
		dynamic,
		ctx,
		list,
		lookup,
		node,
		destroy,
		create_each_block,
		next,
		get_context
	) {
		let o = old_blocks.length;
		let n = list.length;
		let i = o;
		const old_indexes = {};
		while (i--) old_indexes[old_blocks[i].key] = i;
		const new_blocks = [];
		const new_lookup = new Map();
		const deltas = new Map();
		const updates = [];
		i = n;
		while (i--) {
			const child_ctx = get_context(ctx, list, i);
			const key = get_key(child_ctx);
			let block = lookup.get(key);
			if (!block) {
				block = create_each_block(key, child_ctx);
				block.c();
			} else if (dynamic) {
				// defer updates until all the DOM shuffling is done
				updates.push(() => block.p(child_ctx, dirty));
			}
			new_lookup.set(key, (new_blocks[i] = block));
			if (key in old_indexes) deltas.set(key, Math.abs(i - old_indexes[key]));
		}
		const will_move = new Set();
		const did_move = new Set();
		/** @returns {void} */
		function insert(block) {
			transition_in(block, 1);
			block.m(node, next);
			lookup.set(block.key, block);
			next = block.first;
			n--;
		}
		while (o && n) {
			const new_block = new_blocks[n - 1];
			const old_block = old_blocks[o - 1];
			const new_key = new_block.key;
			const old_key = old_block.key;
			if (new_block === old_block) {
				// do nothing
				next = new_block.first;
				o--;
				n--;
			} else if (!new_lookup.has(old_key)) {
				// remove old block
				destroy(old_block, lookup);
				o--;
			} else if (!lookup.has(new_key) || will_move.has(new_key)) {
				insert(new_block);
			} else if (did_move.has(old_key)) {
				o--;
			} else if (deltas.get(new_key) > deltas.get(old_key)) {
				did_move.add(new_key);
				insert(new_block);
			} else {
				will_move.add(old_key);
				o--;
			}
		}
		while (o--) {
			const old_block = old_blocks[o];
			if (!new_lookup.has(old_block.key)) destroy(old_block, lookup);
		}
		while (n) insert(new_blocks[n - 1]);
		run_all(updates);
		return new_blocks;
	}

	/** @returns {void} */
	function validate_each_keys(ctx, list, get_context, get_key) {
		const keys = new Map();
		for (let i = 0; i < list.length; i++) {
			const key = get_key(get_context(ctx, list, i));
			if (keys.has(key)) {
				let value = '';
				try {
					value = `with value '${String(key)}' `;
				} catch (e) {
					// can't stringify
				}
				throw new Error(
					`Cannot have duplicate keys in a keyed each: Keys at index ${keys.get(
					key
				)} and ${i} ${value}are duplicates`
				);
			}
			keys.set(key, i);
		}
	}

	/** @returns {void} */
	function create_component(block) {
		block && block.c();
	}

	/** @returns {void} */
	function mount_component(component, target, anchor) {
		const { fragment, after_update } = component.$$;
		fragment && fragment.m(target, anchor);
		// onMount happens before the initial afterUpdate
		add_render_callback(() => {
			const new_on_destroy = component.$$.on_mount.map(run).filter(is_function);
			// if the component was destroyed immediately
			// it will update the `$$.on_destroy` reference to `null`.
			// the destructured on_destroy may still reference to the old array
			if (component.$$.on_destroy) {
				component.$$.on_destroy.push(...new_on_destroy);
			} else {
				// Edge case - component was destroyed immediately,
				// most likely as a result of a binding initialising
				run_all(new_on_destroy);
			}
			component.$$.on_mount = [];
		});
		after_update.forEach(add_render_callback);
	}

	/** @returns {void} */
	function destroy_component(component, detaching) {
		const $$ = component.$$;
		if ($$.fragment !== null) {
			flush_render_callbacks($$.after_update);
			run_all($$.on_destroy);
			$$.fragment && $$.fragment.d(detaching);
			// TODO null out other refs, including component.$$ (but need to
			// preserve final state?)
			$$.on_destroy = $$.fragment = null;
			$$.ctx = [];
		}
	}

	/** @returns {void} */
	function make_dirty(component, i) {
		if (component.$$.dirty[0] === -1) {
			dirty_components.push(component);
			schedule_update();
			component.$$.dirty.fill(0);
		}
		component.$$.dirty[(i / 31) | 0] |= 1 << i % 31;
	}

	// TODO: Document the other params
	/**
	 * @param {SvelteComponent} component
	 * @param {import('./public.js').ComponentConstructorOptions} options
	 *
	 * @param {import('./utils.js')['not_equal']} not_equal Used to compare props and state values.
	 * @param {(target: Element | ShadowRoot) => void} [append_styles] Function that appends styles to the DOM when the component is first initialised.
	 * This will be the `add_css` function from the compiled component.
	 *
	 * @returns {void}
	 */
	function init(
		component,
		options,
		instance,
		create_fragment,
		not_equal,
		props,
		append_styles = null,
		dirty = [-1]
	) {
		const parent_component = current_component;
		set_current_component(component);
		/** @type {import('./private.js').T$$} */
		const $$ = (component.$$ = {
			fragment: null,
			ctx: [],
			// state
			props,
			update: noop,
			not_equal,
			bound: blank_object(),
			// lifecycle
			on_mount: [],
			on_destroy: [],
			on_disconnect: [],
			before_update: [],
			after_update: [],
			context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
			// everything else
			callbacks: blank_object(),
			dirty,
			skip_bound: false,
			root: options.target || parent_component.$$.root
		});
		append_styles && append_styles($$.root);
		let ready = false;
		$$.ctx = instance
			? instance(component, options.props || {}, (i, ret, ...rest) => {
					const value = rest.length ? rest[0] : ret;
					if ($$.ctx && not_equal($$.ctx[i], ($$.ctx[i] = value))) {
						if (!$$.skip_bound && $$.bound[i]) $$.bound[i](value);
						if (ready) make_dirty(component, i);
					}
					return ret;
			  })
			: [];
		$$.update();
		ready = true;
		run_all($$.before_update);
		// `false` as a special case of no DOM component
		$$.fragment = create_fragment ? create_fragment($$.ctx) : false;
		if (options.target) {
			if (options.hydrate) {
				// TODO: what is the correct type here?
				// @ts-expect-error
				const nodes = children(options.target);
				$$.fragment && $$.fragment.l(nodes);
				nodes.forEach(detach);
			} else {
				// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
				$$.fragment && $$.fragment.c();
			}
			if (options.intro) transition_in(component.$$.fragment);
			mount_component(component, options.target, options.anchor);
			flush();
		}
		set_current_component(parent_component);
	}

	/**
	 * Base class for Svelte components. Used when dev=false.
	 *
	 * @template {Record<string, any>} [Props=any]
	 * @template {Record<string, any>} [Events=any]
	 */
	class SvelteComponent {
		/**
		 * ### PRIVATE API
		 *
		 * Do not use, may change at any time
		 *
		 * @type {any}
		 */
		$$ = undefined;
		/**
		 * ### PRIVATE API
		 *
		 * Do not use, may change at any time
		 *
		 * @type {any}
		 */
		$$set = undefined;

		/** @returns {void} */
		$destroy() {
			destroy_component(this, 1);
			this.$destroy = noop;
		}

		/**
		 * @template {Extract<keyof Events, string>} K
		 * @param {K} type
		 * @param {((e: Events[K]) => void) | null | undefined} callback
		 * @returns {() => void}
		 */
		$on(type, callback) {
			if (!is_function(callback)) {
				return noop;
			}
			const callbacks = this.$$.callbacks[type] || (this.$$.callbacks[type] = []);
			callbacks.push(callback);
			return () => {
				const index = callbacks.indexOf(callback);
				if (index !== -1) callbacks.splice(index, 1);
			};
		}

		/**
		 * @param {Partial<Props>} props
		 * @returns {void}
		 */
		$set(props) {
			if (this.$$set && !is_empty(props)) {
				this.$$.skip_bound = true;
				this.$$set(props);
				this.$$.skip_bound = false;
			}
		}
	}

	/**
	 * @typedef {Object} CustomElementPropDefinition
	 * @property {string} [attribute]
	 * @property {boolean} [reflect]
	 * @property {'String'|'Boolean'|'Number'|'Array'|'Object'} [type]
	 */

	// generated during release, do not modify

	/**
	 * The current version, as set in package.json.
	 *
	 * https://svelte.dev/docs/svelte-compiler#svelte-version
	 * @type {string}
	 */
	const VERSION = '4.2.8';
	const PUBLIC_VERSION = '4';

	/**
	 * @template T
	 * @param {string} type
	 * @param {T} [detail]
	 * @returns {void}
	 */
	function dispatch_dev(type, detail) {
		document.dispatchEvent(custom_event(type, { version: VERSION, ...detail }, { bubbles: true }));
	}

	/**
	 * @param {Node} target
	 * @param {Node} node
	 * @returns {void}
	 */
	function append_dev(target, node) {
		dispatch_dev('SvelteDOMInsert', { target, node });
		append(target, node);
	}

	/**
	 * @param {Node} target
	 * @param {Node} node
	 * @param {Node} [anchor]
	 * @returns {void}
	 */
	function insert_dev(target, node, anchor) {
		dispatch_dev('SvelteDOMInsert', { target, node, anchor });
		insert(target, node, anchor);
	}

	/**
	 * @param {Node} node
	 * @returns {void}
	 */
	function detach_dev(node) {
		dispatch_dev('SvelteDOMRemove', { node });
		detach(node);
	}

	/**
	 * @param {Node} node
	 * @param {string} event
	 * @param {EventListenerOrEventListenerObject} handler
	 * @param {boolean | AddEventListenerOptions | EventListenerOptions} [options]
	 * @param {boolean} [has_prevent_default]
	 * @param {boolean} [has_stop_propagation]
	 * @param {boolean} [has_stop_immediate_propagation]
	 * @returns {() => void}
	 */
	function listen_dev(
		node,
		event,
		handler,
		options,
		has_prevent_default,
		has_stop_propagation,
		has_stop_immediate_propagation
	) {
		const modifiers =
			options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
		if (has_prevent_default) modifiers.push('preventDefault');
		if (has_stop_propagation) modifiers.push('stopPropagation');
		if (has_stop_immediate_propagation) modifiers.push('stopImmediatePropagation');
		dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
		const dispose = listen(node, event, handler, options);
		return () => {
			dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
			dispose();
		};
	}

	/**
	 * @param {Element} node
	 * @param {string} attribute
	 * @param {string} [value]
	 * @returns {void}
	 */
	function attr_dev(node, attribute, value) {
		attr(node, attribute, value);
		if (value == null) dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
		else dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
	}

	/**
	 * @param {Text} text
	 * @param {unknown} data
	 * @returns {void}
	 */
	function set_data_dev(text, data) {
		data = '' + data;
		if (text.data === data) return;
		dispatch_dev('SvelteDOMSetData', { node: text, data });
		text.data = /** @type {string} */ (data);
	}

	function ensure_array_like_dev(arg) {
		if (
			typeof arg !== 'string' &&
			!(arg && typeof arg === 'object' && 'length' in arg) &&
			!(typeof Symbol === 'function' && arg && Symbol.iterator in arg)
		) {
			throw new Error('{#each} only works with iterable values.');
		}
		return ensure_array_like(arg);
	}

	/**
	 * @returns {void} */
	function validate_slots(name, slot, keys) {
		for (const slot_key of Object.keys(slot)) {
			if (!~keys.indexOf(slot_key)) {
				console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
			}
		}
	}

	/**
	 * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
	 *
	 * Can be used to create strongly typed Svelte components.
	 *
	 * #### Example:
	 *
	 * You have component library on npm called `component-library`, from which
	 * you export a component called `MyComponent`. For Svelte+TypeScript users,
	 * you want to provide typings. Therefore you create a `index.d.ts`:
	 * ```ts
	 * import { SvelteComponent } from "svelte";
	 * export class MyComponent extends SvelteComponent<{foo: string}> {}
	 * ```
	 * Typing this makes it possible for IDEs like VS Code with the Svelte extension
	 * to provide intellisense and to use the component like this in a Svelte file
	 * with TypeScript:
	 * ```svelte
	 * <script lang="ts">
	 * 	import { MyComponent } from "component-library";
	 * </script>
	 * <MyComponent foo={'bar'} />
	 * ```
	 * @template {Record<string, any>} [Props=any]
	 * @template {Record<string, any>} [Events=any]
	 * @template {Record<string, any>} [Slots=any]
	 * @extends {SvelteComponent<Props, Events>}
	 */
	class SvelteComponentDev extends SvelteComponent {
		/**
		 * For type checking capabilities only.
		 * Does not exist at runtime.
		 * ### DO NOT USE!
		 *
		 * @type {Props}
		 */
		$$prop_def;
		/**
		 * For type checking capabilities only.
		 * Does not exist at runtime.
		 * ### DO NOT USE!
		 *
		 * @type {Events}
		 */
		$$events_def;
		/**
		 * For type checking capabilities only.
		 * Does not exist at runtime.
		 * ### DO NOT USE!
		 *
		 * @type {Slots}
		 */
		$$slot_def;

		/** @param {import('./public.js').ComponentConstructorOptions<Props>} options */
		constructor(options) {
			if (!options || (!options.target && !options.$$inline)) {
				throw new Error("'target' is a required option");
			}
			super();
		}

		/** @returns {void} */
		$destroy() {
			super.$destroy();
			this.$destroy = () => {
				console.warn('Component was already destroyed'); // eslint-disable-line no-console
			};
		}

		/** @returns {void} */
		$capture_state() {}

		/** @returns {void} */
		$inject_state() {}
	}

	if (typeof window !== 'undefined')
		// @ts-ignore
		(window.__svelte || (window.__svelte = { v: new Set() })).v.add(PUBLIC_VERSION);

	function getDefaultExportFromCjs (x) {
		return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
	}

	var lzString = {exports: {}};

	lzString.exports;

	(function (module) {
		// Copyright (c) 2013 Pieroxy <pieroxy@pieroxy.net>
		// This work is free. You can redistribute it and/or modify it
		// under the terms of the WTFPL, Version 2
		// For more information see LICENSE.txt or http://www.wtfpl.net/
		//
		// For more information, the home page:
		// http://pieroxy.net/blog/pages/lz-string/testing.html
		//
		// LZ-based compression algorithm, version 1.4.5
		var LZString = (function() {

		// private property
		var f = String.fromCharCode;
		var keyStrBase64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
		var keyStrUriSafe = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+-$";
		var baseReverseDic = {};

		function getBaseValue(alphabet, character) {
		  if (!baseReverseDic[alphabet]) {
		    baseReverseDic[alphabet] = {};
		    for (var i=0 ; i<alphabet.length ; i++) {
		      baseReverseDic[alphabet][alphabet.charAt(i)] = i;
		    }
		  }
		  return baseReverseDic[alphabet][character];
		}

		var LZString = {
		  compressToBase64 : function (input) {
		    if (input == null) return "";
		    var res = LZString._compress(input, 6, function(a){return keyStrBase64.charAt(a);});
		    switch (res.length % 4) { // To produce valid Base64
		    default: // When could this happen ?
		    case 0 : return res;
		    case 1 : return res+"===";
		    case 2 : return res+"==";
		    case 3 : return res+"=";
		    }
		  },

		  decompressFromBase64 : function (input) {
		    if (input == null) return "";
		    if (input == "") return null;
		    return LZString._decompress(input.length, 32, function(index) { return getBaseValue(keyStrBase64, input.charAt(index)); });
		  },

		  compressToUTF16 : function (input) {
		    if (input == null) return "";
		    return LZString._compress(input, 15, function(a){return f(a+32);}) + " ";
		  },

		  decompressFromUTF16: function (compressed) {
		    if (compressed == null) return "";
		    if (compressed == "") return null;
		    return LZString._decompress(compressed.length, 16384, function(index) { return compressed.charCodeAt(index) - 32; });
		  },

		  //compress into uint8array (UCS-2 big endian format)
		  compressToUint8Array: function (uncompressed) {
		    var compressed = LZString.compress(uncompressed);
		    var buf=new Uint8Array(compressed.length*2); // 2 bytes per character

		    for (var i=0, TotalLen=compressed.length; i<TotalLen; i++) {
		      var current_value = compressed.charCodeAt(i);
		      buf[i*2] = current_value >>> 8;
		      buf[i*2+1] = current_value % 256;
		    }
		    return buf;
		  },

		  //decompress from uint8array (UCS-2 big endian format)
		  decompressFromUint8Array:function (compressed) {
		    if (compressed===null || compressed===undefined){
		        return LZString.decompress(compressed);
		    } else {
		        var buf=new Array(compressed.length/2); // 2 bytes per character
		        for (var i=0, TotalLen=buf.length; i<TotalLen; i++) {
		          buf[i]=compressed[i*2]*256+compressed[i*2+1];
		        }

		        var result = [];
		        buf.forEach(function (c) {
		          result.push(f(c));
		        });
		        return LZString.decompress(result.join(''));

		    }

		  },


		  //compress into a string that is already URI encoded
		  compressToEncodedURIComponent: function (input) {
		    if (input == null) return "";
		    return LZString._compress(input, 6, function(a){return keyStrUriSafe.charAt(a);});
		  },

		  //decompress from an output of compressToEncodedURIComponent
		  decompressFromEncodedURIComponent:function (input) {
		    if (input == null) return "";
		    if (input == "") return null;
		    input = input.replace(/ /g, "+");
		    return LZString._decompress(input.length, 32, function(index) { return getBaseValue(keyStrUriSafe, input.charAt(index)); });
		  },

		  compress: function (uncompressed) {
		    return LZString._compress(uncompressed, 16, function(a){return f(a);});
		  },
		  _compress: function (uncompressed, bitsPerChar, getCharFromInt) {
		    if (uncompressed == null) return "";
		    var i, value,
		        context_dictionary= {},
		        context_dictionaryToCreate= {},
		        context_c="",
		        context_wc="",
		        context_w="",
		        context_enlargeIn= 2, // Compensate for the first entry which should not count
		        context_dictSize= 3,
		        context_numBits= 2,
		        context_data=[],
		        context_data_val=0,
		        context_data_position=0,
		        ii;

		    for (ii = 0; ii < uncompressed.length; ii += 1) {
		      context_c = uncompressed.charAt(ii);
		      if (!Object.prototype.hasOwnProperty.call(context_dictionary,context_c)) {
		        context_dictionary[context_c] = context_dictSize++;
		        context_dictionaryToCreate[context_c] = true;
		      }

		      context_wc = context_w + context_c;
		      if (Object.prototype.hasOwnProperty.call(context_dictionary,context_wc)) {
		        context_w = context_wc;
		      } else {
		        if (Object.prototype.hasOwnProperty.call(context_dictionaryToCreate,context_w)) {
		          if (context_w.charCodeAt(0)<256) {
		            for (i=0 ; i<context_numBits ; i++) {
		              context_data_val = (context_data_val << 1);
		              if (context_data_position == bitsPerChar-1) {
		                context_data_position = 0;
		                context_data.push(getCharFromInt(context_data_val));
		                context_data_val = 0;
		              } else {
		                context_data_position++;
		              }
		            }
		            value = context_w.charCodeAt(0);
		            for (i=0 ; i<8 ; i++) {
		              context_data_val = (context_data_val << 1) | (value&1);
		              if (context_data_position == bitsPerChar-1) {
		                context_data_position = 0;
		                context_data.push(getCharFromInt(context_data_val));
		                context_data_val = 0;
		              } else {
		                context_data_position++;
		              }
		              value = value >> 1;
		            }
		          } else {
		            value = 1;
		            for (i=0 ; i<context_numBits ; i++) {
		              context_data_val = (context_data_val << 1) | value;
		              if (context_data_position ==bitsPerChar-1) {
		                context_data_position = 0;
		                context_data.push(getCharFromInt(context_data_val));
		                context_data_val = 0;
		              } else {
		                context_data_position++;
		              }
		              value = 0;
		            }
		            value = context_w.charCodeAt(0);
		            for (i=0 ; i<16 ; i++) {
		              context_data_val = (context_data_val << 1) | (value&1);
		              if (context_data_position == bitsPerChar-1) {
		                context_data_position = 0;
		                context_data.push(getCharFromInt(context_data_val));
		                context_data_val = 0;
		              } else {
		                context_data_position++;
		              }
		              value = value >> 1;
		            }
		          }
		          context_enlargeIn--;
		          if (context_enlargeIn == 0) {
		            context_enlargeIn = Math.pow(2, context_numBits);
		            context_numBits++;
		          }
		          delete context_dictionaryToCreate[context_w];
		        } else {
		          value = context_dictionary[context_w];
		          for (i=0 ; i<context_numBits ; i++) {
		            context_data_val = (context_data_val << 1) | (value&1);
		            if (context_data_position == bitsPerChar-1) {
		              context_data_position = 0;
		              context_data.push(getCharFromInt(context_data_val));
		              context_data_val = 0;
		            } else {
		              context_data_position++;
		            }
		            value = value >> 1;
		          }


		        }
		        context_enlargeIn--;
		        if (context_enlargeIn == 0) {
		          context_enlargeIn = Math.pow(2, context_numBits);
		          context_numBits++;
		        }
		        // Add wc to the dictionary.
		        context_dictionary[context_wc] = context_dictSize++;
		        context_w = String(context_c);
		      }
		    }

		    // Output the code for w.
		    if (context_w !== "") {
		      if (Object.prototype.hasOwnProperty.call(context_dictionaryToCreate,context_w)) {
		        if (context_w.charCodeAt(0)<256) {
		          for (i=0 ; i<context_numBits ; i++) {
		            context_data_val = (context_data_val << 1);
		            if (context_data_position == bitsPerChar-1) {
		              context_data_position = 0;
		              context_data.push(getCharFromInt(context_data_val));
		              context_data_val = 0;
		            } else {
		              context_data_position++;
		            }
		          }
		          value = context_w.charCodeAt(0);
		          for (i=0 ; i<8 ; i++) {
		            context_data_val = (context_data_val << 1) | (value&1);
		            if (context_data_position == bitsPerChar-1) {
		              context_data_position = 0;
		              context_data.push(getCharFromInt(context_data_val));
		              context_data_val = 0;
		            } else {
		              context_data_position++;
		            }
		            value = value >> 1;
		          }
		        } else {
		          value = 1;
		          for (i=0 ; i<context_numBits ; i++) {
		            context_data_val = (context_data_val << 1) | value;
		            if (context_data_position == bitsPerChar-1) {
		              context_data_position = 0;
		              context_data.push(getCharFromInt(context_data_val));
		              context_data_val = 0;
		            } else {
		              context_data_position++;
		            }
		            value = 0;
		          }
		          value = context_w.charCodeAt(0);
		          for (i=0 ; i<16 ; i++) {
		            context_data_val = (context_data_val << 1) | (value&1);
		            if (context_data_position == bitsPerChar-1) {
		              context_data_position = 0;
		              context_data.push(getCharFromInt(context_data_val));
		              context_data_val = 0;
		            } else {
		              context_data_position++;
		            }
		            value = value >> 1;
		          }
		        }
		        context_enlargeIn--;
		        if (context_enlargeIn == 0) {
		          context_enlargeIn = Math.pow(2, context_numBits);
		          context_numBits++;
		        }
		        delete context_dictionaryToCreate[context_w];
		      } else {
		        value = context_dictionary[context_w];
		        for (i=0 ; i<context_numBits ; i++) {
		          context_data_val = (context_data_val << 1) | (value&1);
		          if (context_data_position == bitsPerChar-1) {
		            context_data_position = 0;
		            context_data.push(getCharFromInt(context_data_val));
		            context_data_val = 0;
		          } else {
		            context_data_position++;
		          }
		          value = value >> 1;
		        }


		      }
		      context_enlargeIn--;
		      if (context_enlargeIn == 0) {
		        context_enlargeIn = Math.pow(2, context_numBits);
		        context_numBits++;
		      }
		    }

		    // Mark the end of the stream
		    value = 2;
		    for (i=0 ; i<context_numBits ; i++) {
		      context_data_val = (context_data_val << 1) | (value&1);
		      if (context_data_position == bitsPerChar-1) {
		        context_data_position = 0;
		        context_data.push(getCharFromInt(context_data_val));
		        context_data_val = 0;
		      } else {
		        context_data_position++;
		      }
		      value = value >> 1;
		    }

		    // Flush the last char
		    while (true) {
		      context_data_val = (context_data_val << 1);
		      if (context_data_position == bitsPerChar-1) {
		        context_data.push(getCharFromInt(context_data_val));
		        break;
		      }
		      else context_data_position++;
		    }
		    return context_data.join('');
		  },

		  decompress: function (compressed) {
		    if (compressed == null) return "";
		    if (compressed == "") return null;
		    return LZString._decompress(compressed.length, 32768, function(index) { return compressed.charCodeAt(index); });
		  },

		  _decompress: function (length, resetValue, getNextValue) {
		    var dictionary = [],
		        enlargeIn = 4,
		        dictSize = 4,
		        numBits = 3,
		        entry = "",
		        result = [],
		        i,
		        w,
		        bits, resb, maxpower, power,
		        c,
		        data = {val:getNextValue(0), position:resetValue, index:1};

		    for (i = 0; i < 3; i += 1) {
		      dictionary[i] = i;
		    }

		    bits = 0;
		    maxpower = Math.pow(2,2);
		    power=1;
		    while (power!=maxpower) {
		      resb = data.val & data.position;
		      data.position >>= 1;
		      if (data.position == 0) {
		        data.position = resetValue;
		        data.val = getNextValue(data.index++);
		      }
		      bits |= (resb>0 ? 1 : 0) * power;
		      power <<= 1;
		    }

		    switch (bits) {
		      case 0:
		          bits = 0;
		          maxpower = Math.pow(2,8);
		          power=1;
		          while (power!=maxpower) {
		            resb = data.val & data.position;
		            data.position >>= 1;
		            if (data.position == 0) {
		              data.position = resetValue;
		              data.val = getNextValue(data.index++);
		            }
		            bits |= (resb>0 ? 1 : 0) * power;
		            power <<= 1;
		          }
		        c = f(bits);
		        break;
		      case 1:
		          bits = 0;
		          maxpower = Math.pow(2,16);
		          power=1;
		          while (power!=maxpower) {
		            resb = data.val & data.position;
		            data.position >>= 1;
		            if (data.position == 0) {
		              data.position = resetValue;
		              data.val = getNextValue(data.index++);
		            }
		            bits |= (resb>0 ? 1 : 0) * power;
		            power <<= 1;
		          }
		        c = f(bits);
		        break;
		      case 2:
		        return "";
		    }
		    dictionary[3] = c;
		    w = c;
		    result.push(c);
		    while (true) {
		      if (data.index > length) {
		        return "";
		      }

		      bits = 0;
		      maxpower = Math.pow(2,numBits);
		      power=1;
		      while (power!=maxpower) {
		        resb = data.val & data.position;
		        data.position >>= 1;
		        if (data.position == 0) {
		          data.position = resetValue;
		          data.val = getNextValue(data.index++);
		        }
		        bits |= (resb>0 ? 1 : 0) * power;
		        power <<= 1;
		      }

		      switch (c = bits) {
		        case 0:
		          bits = 0;
		          maxpower = Math.pow(2,8);
		          power=1;
		          while (power!=maxpower) {
		            resb = data.val & data.position;
		            data.position >>= 1;
		            if (data.position == 0) {
		              data.position = resetValue;
		              data.val = getNextValue(data.index++);
		            }
		            bits |= (resb>0 ? 1 : 0) * power;
		            power <<= 1;
		          }

		          dictionary[dictSize++] = f(bits);
		          c = dictSize-1;
		          enlargeIn--;
		          break;
		        case 1:
		          bits = 0;
		          maxpower = Math.pow(2,16);
		          power=1;
		          while (power!=maxpower) {
		            resb = data.val & data.position;
		            data.position >>= 1;
		            if (data.position == 0) {
		              data.position = resetValue;
		              data.val = getNextValue(data.index++);
		            }
		            bits |= (resb>0 ? 1 : 0) * power;
		            power <<= 1;
		          }
		          dictionary[dictSize++] = f(bits);
		          c = dictSize-1;
		          enlargeIn--;
		          break;
		        case 2:
		          return result.join('');
		      }

		      if (enlargeIn == 0) {
		        enlargeIn = Math.pow(2, numBits);
		        numBits++;
		      }

		      if (dictionary[c]) {
		        entry = dictionary[c];
		      } else {
		        if (c === dictSize) {
		          entry = w + w.charAt(0);
		        } else {
		          return null;
		        }
		      }
		      result.push(entry);

		      // Add w+entry[0] to the dictionary.
		      dictionary[dictSize++] = w + entry.charAt(0);
		      enlargeIn--;

		      w = entry;

		      if (enlargeIn == 0) {
		        enlargeIn = Math.pow(2, numBits);
		        numBits++;
		      }

		    }
		  }
		};
		  return LZString;
		})();

		if( module != null ) {
		  module.exports = LZString;
		} else if( typeof angular !== 'undefined' && angular != null ) {
		  angular.module('LZString', [])
		  .factory('LZString', function () {
		    return LZString;
		  });
		} 
	} (lzString));

	var lzStringExports = lzString.exports;
	var lz = /*@__PURE__*/getDefaultExportFromCjs(lzStringExports);

	/* node_modules/svelte-youtube-embed/Button.svelte generated by Svelte v4.2.8 */
	const file$4 = "node_modules/svelte-youtube-embed/Button.svelte";

	// (9:0) {:else}
	function create_else_block$2(ctx) {
		let button;
		let svg;
		let path;
		let mounted;
		let dispose;

		const block = {
			c: function create() {
				button = element("button");
				svg = svg_element("svg");
				path = svg_element("path");
				attr_dev(path, "fill", "#ff4e45");
				attr_dev(path, "d", "m10 15 5.19-3L10 9v6m11.56-7.83c.13.47.22 1.1.28 1.9.07.8.1 1.49.1 2.09L22 12c0 2.19-.16 3.8-.44 4.83-.25.9-.83 1.48-1.73 1.73-.47.13-1.33.22-2.65.28-1.3.07-2.49.1-3.59.1L12 19c-4.19 0-6.8-.16-7.83-.44-.9-.25-1.48-.83-1.73-1.73-.13-.47-.22-1.1-.28-1.9-.07-.8-.1-1.49-.1-2.09L2 12c0-2.19.16-3.8.44-4.83.25-.9.83-1.48 1.73-1.73.47-.13 1.33-.22 2.65-.28 1.3-.07 2.49-.1 3.59-.1L12 5c4.19 0 6.8.16 7.83.44.9.25 1.48.83 1.73 1.73Z");
				add_location(path, file$4, 16, 6, 407);
				attr_dev(svg, "xmlns", "http://www.w3.org/2000/svg");
				attr_dev(svg, "aria-hidden", "true");
				attr_dev(svg, "class", "iconify iconify--mdi");
				attr_dev(svg, "viewBox", "0 0 24 24");
				add_location(svg, file$4, 10, 5, 263);
				attr_dev(button, "class", "play__btn svelte-1srk8gt");
				attr_dev(button, "aria-label", "Play YouTube video");
				add_location(button, file$4, 9, 2, 191);
			},
			m: function mount(target, anchor) {
				insert_dev(target, button, anchor);
				append_dev(button, svg);
				append_dev(svg, path);

				if (!mounted) {
					dispose = listen_dev(button, "click", /*click_handler_1*/ ctx[4], false, false, false, false);
					mounted = true;
				}
			},
			p: noop,
			i: noop,
			o: noop,
			d: function destroy(detaching) {
				if (detaching) {
					detach_dev(button);
				}

				mounted = false;
				dispose();
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_else_block$2.name,
			type: "else",
			source: "(9:0) {:else}",
			ctx
		});

		return block;
	}

	// (5:0) {#if isCustomPlayButton}
	function create_if_block$2(ctx) {
		let button;
		let current;
		let mounted;
		let dispose;
		const default_slot_template = /*#slots*/ ctx[2].default;
		const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[1], null);

		const block = {
			c: function create() {
				button = element("button");
				if (default_slot) default_slot.c();
				attr_dev(button, "class", "custom__play__btn svelte-1srk8gt");
				attr_dev(button, "aria-label", "Play YouTube video");
				add_location(button, file$4, 5, 2, 80);
			},
			m: function mount(target, anchor) {
				insert_dev(target, button, anchor);

				if (default_slot) {
					default_slot.m(button, null);
				}

				current = true;

				if (!mounted) {
					dispose = listen_dev(button, "click", /*click_handler*/ ctx[3], false, false, false, false);
					mounted = true;
				}
			},
			p: function update(ctx, dirty) {
				if (default_slot) {
					if (default_slot.p && (!current || dirty & /*$$scope*/ 2)) {
						update_slot_base(
							default_slot,
							default_slot_template,
							ctx,
							/*$$scope*/ ctx[1],
							!current
							? get_all_dirty_from_scope(/*$$scope*/ ctx[1])
							: get_slot_changes(default_slot_template, /*$$scope*/ ctx[1], dirty, null),
							null
						);
					}
				}
			},
			i: function intro(local) {
				if (current) return;
				transition_in(default_slot, local);
				current = true;
			},
			o: function outro(local) {
				transition_out(default_slot, local);
				current = false;
			},
			d: function destroy(detaching) {
				if (detaching) {
					detach_dev(button);
				}

				if (default_slot) default_slot.d(detaching);
				mounted = false;
				dispose();
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_if_block$2.name,
			type: "if",
			source: "(5:0) {#if isCustomPlayButton}",
			ctx
		});

		return block;
	}

	function create_fragment$4(ctx) {
		let current_block_type_index;
		let if_block;
		let if_block_anchor;
		let current;
		const if_block_creators = [create_if_block$2, create_else_block$2];
		const if_blocks = [];

		function select_block_type(ctx, dirty) {
			if (/*isCustomPlayButton*/ ctx[0]) return 0;
			return 1;
		}

		current_block_type_index = select_block_type(ctx);
		if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

		const block = {
			c: function create() {
				if_block.c();
				if_block_anchor = empty();
			},
			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},
			m: function mount(target, anchor) {
				if_blocks[current_block_type_index].m(target, anchor);
				insert_dev(target, if_block_anchor, anchor);
				current = true;
			},
			p: function update(ctx, [dirty]) {
				let previous_block_index = current_block_type_index;
				current_block_type_index = select_block_type(ctx);

				if (current_block_type_index === previous_block_index) {
					if_blocks[current_block_type_index].p(ctx, dirty);
				} else {
					group_outros();

					transition_out(if_blocks[previous_block_index], 1, 1, () => {
						if_blocks[previous_block_index] = null;
					});

					check_outros();
					if_block = if_blocks[current_block_type_index];

					if (!if_block) {
						if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
						if_block.c();
					} else {
						if_block.p(ctx, dirty);
					}

					transition_in(if_block, 1);
					if_block.m(if_block_anchor.parentNode, if_block_anchor);
				}
			},
			i: function intro(local) {
				if (current) return;
				transition_in(if_block);
				current = true;
			},
			o: function outro(local) {
				transition_out(if_block);
				current = false;
			},
			d: function destroy(detaching) {
				if (detaching) {
					detach_dev(if_block_anchor);
				}

				if_blocks[current_block_type_index].d(detaching);
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_fragment$4.name,
			type: "component",
			source: "",
			ctx
		});

		return block;
	}

	function instance$4($$self, $$props, $$invalidate) {
		let { $$slots: slots = {}, $$scope } = $$props;
		validate_slots('Button', slots, ['default']);
		let { isCustomPlayButton } = $$props;

		$$self.$$.on_mount.push(function () {
			if (isCustomPlayButton === undefined && !('isCustomPlayButton' in $$props || $$self.$$.bound[$$self.$$.props['isCustomPlayButton']])) {
				console.warn("<Button> was created without expected prop 'isCustomPlayButton'");
			}
		});

		const writable_props = ['isCustomPlayButton'];

		Object.keys($$props).forEach(key => {
			if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Button> was created with unknown prop '${key}'`);
		});

		function click_handler(event) {
			bubble.call(this, $$self, event);
		}

		function click_handler_1(event) {
			bubble.call(this, $$self, event);
		}

		$$self.$$set = $$props => {
			if ('isCustomPlayButton' in $$props) $$invalidate(0, isCustomPlayButton = $$props.isCustomPlayButton);
			if ('$$scope' in $$props) $$invalidate(1, $$scope = $$props.$$scope);
		};

		$$self.$capture_state = () => ({ isCustomPlayButton });

		$$self.$inject_state = $$props => {
			if ('isCustomPlayButton' in $$props) $$invalidate(0, isCustomPlayButton = $$props.isCustomPlayButton);
		};

		if ($$props && "$$inject" in $$props) {
			$$self.$inject_state($$props.$$inject);
		}

		return [isCustomPlayButton, $$scope, slots, click_handler, click_handler_1];
	}

	class Button extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, instance$4, create_fragment$4, safe_not_equal, { isCustomPlayButton: 0 });

			dispatch_dev("SvelteRegisterComponent", {
				component: this,
				tagName: "Button",
				options,
				id: create_fragment$4.name
			});
		}

		get isCustomPlayButton() {
			throw new Error("<Button>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set isCustomPlayButton(value) {
			throw new Error("<Button>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}
	}

	/*
	Adapted from https://github.com/mattdesl
	Distributed under MIT License https://github.com/mattdesl/eases/blob/master/LICENSE.md
	*/

	/**
	 * https://svelte.dev/docs/svelte-easing
	 * @param {number} t
	 * @returns {number}
	 */
	function cubicOut(t) {
		const f = t - 1.0;
		return f * f * f + 1.0;
	}

	/**
	 * Animates the opacity and scale of an element. `in` transitions animate from an element's current (default) values to the provided values, passed as parameters. `out` transitions animate from the provided values to an element's default values.
	 *
	 * https://svelte.dev/docs/svelte-transition#scale
	 * @param {Element} node
	 * @param {import('./public').ScaleParams} [params]
	 * @returns {import('./public').TransitionConfig}
	 */
	function scale(
		node,
		{ delay = 0, duration = 400, easing = cubicOut, start = 0, opacity = 0 } = {}
	) {
		const style = getComputedStyle(node);
		const target_opacity = +style.opacity;
		const transform = style.transform === 'none' ? '' : style.transform;
		const sd = 1 - start;
		const od = target_opacity * (1 - opacity);
		return {
			delay,
			duration,
			easing,
			css: (_t, u) => `
			transform: ${transform} scale(${1 - sd * u});
			opacity: ${target_opacity - od * u}
		`
		};
	}

	/* node_modules/svelte-youtube-embed/Iframe.svelte generated by Svelte v4.2.8 */
	const file$3 = "node_modules/svelte-youtube-embed/Iframe.svelte";

	function create_fragment$3(ctx) {
		let iframe;
		let iframe_src_value;
		let iframe_intro;

		const block = {
			c: function create() {
				iframe = element("iframe");
				if (!src_url_equal(iframe.src, iframe_src_value = "https://www.youtube.com/embed/" + /*id*/ ctx[1] + "?autoplay=1&rel=0")) attr_dev(iframe, "src", iframe_src_value);
				attr_dev(iframe, "title", /*title*/ ctx[0]);
				attr_dev(iframe, "frameborder", "0");
				attr_dev(iframe, "allow", "autoplay; picture-in-picture; clipboard-write");
				iframe.allowFullscreen = true;
				attr_dev(iframe, "class", "svelte-11gebsu");
				add_location(iframe, file$3, 7, 0, 137);
			},
			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},
			m: function mount(target, anchor) {
				insert_dev(target, iframe, anchor);
			},
			p: function update(new_ctx, [dirty]) {
				ctx = new_ctx;

				if (dirty & /*id*/ 2 && !src_url_equal(iframe.src, iframe_src_value = "https://www.youtube.com/embed/" + /*id*/ ctx[1] + "?autoplay=1&rel=0")) {
					attr_dev(iframe, "src", iframe_src_value);
				}

				if (dirty & /*title*/ 1) {
					attr_dev(iframe, "title", /*title*/ ctx[0]);
				}
			},
			i: function intro(local) {
				if (local) {
					if (!iframe_intro) {
						add_render_callback(() => {
							iframe_intro = create_in_transition(iframe, scale, /*animations*/ ctx[2]
							? { delay: 500, duration: 800 }
							: {});

							iframe_intro.start();
						});
					}
				}
			},
			o: noop,
			d: function destroy(detaching) {
				if (detaching) {
					detach_dev(iframe);
				}
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_fragment$3.name,
			type: "component",
			source: "",
			ctx
		});

		return block;
	}

	function instance$3($$self, $$props, $$invalidate) {
		let { $$slots: slots = {}, $$scope } = $$props;
		validate_slots('Iframe', slots, []);
		let { title = "" } = $$props;
		let { id = "" } = $$props;
		let { animations } = $$props;

		$$self.$$.on_mount.push(function () {
			if (animations === undefined && !('animations' in $$props || $$self.$$.bound[$$self.$$.props['animations']])) {
				console.warn("<Iframe> was created without expected prop 'animations'");
			}
		});

		const writable_props = ['title', 'id', 'animations'];

		Object.keys($$props).forEach(key => {
			if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Iframe> was created with unknown prop '${key}'`);
		});

		$$self.$$set = $$props => {
			if ('title' in $$props) $$invalidate(0, title = $$props.title);
			if ('id' in $$props) $$invalidate(1, id = $$props.id);
			if ('animations' in $$props) $$invalidate(2, animations = $$props.animations);
		};

		$$self.$capture_state = () => ({ scale, title, id, animations });

		$$self.$inject_state = $$props => {
			if ('title' in $$props) $$invalidate(0, title = $$props.title);
			if ('id' in $$props) $$invalidate(1, id = $$props.id);
			if ('animations' in $$props) $$invalidate(2, animations = $$props.animations);
		};

		if ($$props && "$$inject" in $$props) {
			$$self.$inject_state($$props.$$inject);
		}

		return [title, id, animations];
	}

	class Iframe extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, instance$3, create_fragment$3, safe_not_equal, { title: 0, id: 1, animations: 2 });

			dispatch_dev("SvelteRegisterComponent", {
				component: this,
				tagName: "Iframe",
				options,
				id: create_fragment$3.name
			});
		}

		get title() {
			throw new Error("<Iframe>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set title(value) {
			throw new Error("<Iframe>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get id() {
			throw new Error("<Iframe>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set id(value) {
			throw new Error("<Iframe>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get animations() {
			throw new Error("<Iframe>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set animations(value) {
			throw new Error("<Iframe>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}
	}

	/* node_modules/svelte-youtube-embed/Image.svelte generated by Svelte v4.2.8 */
	const file$2 = "node_modules/svelte-youtube-embed/Image.svelte";

	// (8:0) {#key play}
	function create_key_block(ctx) {
		let img;
		let img_src_value;
		let img_alt_value;

		const block = {
			c: function create() {
				img = element("img");
				if (!src_url_equal(img.src, img_src_value = "https://i.ytimg.com/vi/" + /*id*/ ctx[0] + "/" + (/*altThumb*/ ctx[2] ? 'hqdefault' : 'maxresdefault') + ".jpg")) attr_dev(img, "src", img_src_value);
				attr_dev(img, "title", /*title*/ ctx[1]);
				attr_dev(img, "alt", img_alt_value = "Youtube video: " + /*title*/ ctx[1]);
				attr_dev(img, "referrerpolicy", "no-referrer");
				attr_dev(img, "class", "svelte-hw9fhp");
				add_location(img, file$2, 8, 2, 136);
			},
			m: function mount(target, anchor) {
				insert_dev(target, img, anchor);
			},
			p: function update(ctx, dirty) {
				if (dirty & /*id, altThumb*/ 5 && !src_url_equal(img.src, img_src_value = "https://i.ytimg.com/vi/" + /*id*/ ctx[0] + "/" + (/*altThumb*/ ctx[2] ? 'hqdefault' : 'maxresdefault') + ".jpg")) {
					attr_dev(img, "src", img_src_value);
				}

				if (dirty & /*title*/ 2) {
					attr_dev(img, "title", /*title*/ ctx[1]);
				}

				if (dirty & /*title*/ 2 && img_alt_value !== (img_alt_value = "Youtube video: " + /*title*/ ctx[1])) {
					attr_dev(img, "alt", img_alt_value);
				}
			},
			d: function destroy(detaching) {
				if (detaching) {
					detach_dev(img);
				}
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_key_block.name,
			type: "key",
			source: "(8:0) {#key play}",
			ctx
		});

		return block;
	}

	function create_fragment$2(ctx) {
		let previous_key = /*play*/ ctx[3];
		let key_block_anchor;
		let key_block = create_key_block(ctx);

		const block = {
			c: function create() {
				key_block.c();
				key_block_anchor = empty();
			},
			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},
			m: function mount(target, anchor) {
				key_block.m(target, anchor);
				insert_dev(target, key_block_anchor, anchor);
			},
			p: function update(ctx, [dirty]) {
				if (dirty & /*play*/ 8 && safe_not_equal(previous_key, previous_key = /*play*/ ctx[3])) {
					key_block.d(1);
					key_block = create_key_block(ctx);
					key_block.c();
					key_block.m(key_block_anchor.parentNode, key_block_anchor);
				} else {
					key_block.p(ctx, dirty);
				}
			},
			i: noop,
			o: noop,
			d: function destroy(detaching) {
				if (detaching) {
					detach_dev(key_block_anchor);
				}

				key_block.d(detaching);
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_fragment$2.name,
			type: "component",
			source: "",
			ctx
		});

		return block;
	}

	function instance$2($$self, $$props, $$invalidate) {
		let { $$slots: slots = {}, $$scope } = $$props;
		validate_slots('Image', slots, []);
		let { id = "" } = $$props;
		let { title = "" } = $$props;
		let { altThumb = "" } = $$props;
		let { play = false } = $$props;
		const writable_props = ['id', 'title', 'altThumb', 'play'];

		Object.keys($$props).forEach(key => {
			if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Image> was created with unknown prop '${key}'`);
		});

		$$self.$$set = $$props => {
			if ('id' in $$props) $$invalidate(0, id = $$props.id);
			if ('title' in $$props) $$invalidate(1, title = $$props.title);
			if ('altThumb' in $$props) $$invalidate(2, altThumb = $$props.altThumb);
			if ('play' in $$props) $$invalidate(3, play = $$props.play);
		};

		$$self.$capture_state = () => ({ id, title, altThumb, play });

		$$self.$inject_state = $$props => {
			if ('id' in $$props) $$invalidate(0, id = $$props.id);
			if ('title' in $$props) $$invalidate(1, title = $$props.title);
			if ('altThumb' in $$props) $$invalidate(2, altThumb = $$props.altThumb);
			if ('play' in $$props) $$invalidate(3, play = $$props.play);
		};

		if ($$props && "$$inject" in $$props) {
			$$self.$inject_state($$props.$$inject);
		}

		return [id, title, altThumb, play];
	}

	class Image extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, instance$2, create_fragment$2, safe_not_equal, { id: 0, title: 1, altThumb: 2, play: 3 });

			dispatch_dev("SvelteRegisterComponent", {
				component: this,
				tagName: "Image",
				options,
				id: create_fragment$2.name
			});
		}

		get id() {
			throw new Error("<Image>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set id(value) {
			throw new Error("<Image>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get title() {
			throw new Error("<Image>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set title(value) {
			throw new Error("<Image>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get altThumb() {
			throw new Error("<Image>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set altThumb(value) {
			throw new Error("<Image>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get play() {
			throw new Error("<Image>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set play(value) {
			throw new Error("<Image>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}
	}

	/* node_modules/svelte-youtube-embed/Youtube.svelte generated by Svelte v4.2.8 */
	const file$1 = "node_modules/svelte-youtube-embed/Youtube.svelte";
	const get_thumbnail_slot_changes = dirty => ({});
	const get_thumbnail_slot_context = ctx => ({});

	// (38:2) {:else}
	function create_else_block$1(ctx) {
		let current_block_type_index;
		let if_block;
		let t0;
		let div0;
		let t1;
		let div1;
		let h3;
		let t2;
		let current;
		let mounted;
		let dispose;
		const if_block_creators = [create_if_block_2, create_else_block_1$1];
		const if_blocks = [];

		function select_block_type_1(ctx, dirty) {
			if (/*isCustomThumbnail*/ ctx[8]) return 0;
			return 1;
		}

		current_block_type_index = select_block_type_1(ctx);
		if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

		const block = {
			c: function create() {
				if_block.c();
				t0 = space();
				div0 = element("div");
				t1 = space();
				div1 = element("div");
				h3 = element("h3");
				t2 = text(/*title*/ ctx[3]);
				attr_dev(div0, "class", "b__overlay svelte-w0t24e");
				add_location(div0, file$1, 43, 4, 1025);
				attr_dev(h3, "class", "svelte-w0t24e");
				add_location(h3, file$1, 44, 26, 1143);
				attr_dev(div1, "class", "v__title svelte-w0t24e");
				add_location(div1, file$1, 44, 4, 1121);
			},
			m: function mount(target, anchor) {
				if_blocks[current_block_type_index].m(target, anchor);
				insert_dev(target, t0, anchor);
				insert_dev(target, div0, anchor);
				insert_dev(target, t1, anchor);
				insert_dev(target, div1, anchor);
				append_dev(div1, h3);
				append_dev(h3, t2);
				current = true;

				if (!mounted) {
					dispose = [
						listen_dev(div0, "click", /*click_handler*/ ctx[10], false, false, false, false),
						listen_dev(div0, "keypress", /*keypress_handler*/ ctx[11], false, false, false, false)
					];

					mounted = true;
				}
			},
			p: function update(ctx, dirty) {
				if_block.p(ctx, dirty);
				if (!current || dirty & /*title*/ 8) set_data_dev(t2, /*title*/ ctx[3]);
			},
			i: function intro(local) {
				if (current) return;
				transition_in(if_block);
				current = true;
			},
			o: function outro(local) {
				transition_out(if_block);
				current = false;
			},
			d: function destroy(detaching) {
				if (detaching) {
					detach_dev(t0);
					detach_dev(div0);
					detach_dev(t1);
					detach_dev(div1);
				}

				if_blocks[current_block_type_index].d(detaching);
				mounted = false;
				run_all(dispose);
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_else_block$1.name,
			type: "else",
			source: "(38:2) {:else}",
			ctx
		});

		return block;
	}

	// (36:2) {#if play}
	function create_if_block_1$1(ctx) {
		let iframe;
		let current;

		iframe = new Iframe({
				props: {
					play: /*play*/ ctx[6],
					id: /*id*/ ctx[0],
					title: /*title*/ ctx[3],
					animations: /*animations*/ ctx[2]
				},
				$$inline: true
			});

		const block = {
			c: function create() {
				create_component(iframe.$$.fragment);
			},
			m: function mount(target, anchor) {
				mount_component(iframe, target, anchor);
				current = true;
			},
			p: function update(ctx, dirty) {
				const iframe_changes = {};
				if (dirty & /*play*/ 64) iframe_changes.play = /*play*/ ctx[6];
				if (dirty & /*id*/ 1) iframe_changes.id = /*id*/ ctx[0];
				if (dirty & /*title*/ 8) iframe_changes.title = /*title*/ ctx[3];
				if (dirty & /*animations*/ 4) iframe_changes.animations = /*animations*/ ctx[2];
				iframe.$set(iframe_changes);
			},
			i: function intro(local) {
				if (current) return;
				transition_in(iframe.$$.fragment, local);
				current = true;
			},
			o: function outro(local) {
				transition_out(iframe.$$.fragment, local);
				current = false;
			},
			d: function destroy(detaching) {
				destroy_component(iframe, detaching);
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_if_block_1$1.name,
			type: "if",
			source: "(36:2) {#if play}",
			ctx
		});

		return block;
	}

	// (41:4) {:else}
	function create_else_block_1$1(ctx) {
		let image;
		let current;

		image = new Image({
				props: {
					id: /*id*/ ctx[0],
					title: /*title*/ ctx[3],
					altThumb: /*altThumb*/ ctx[1],
					play: /*play*/ ctx[6]
				},
				$$inline: true
			});

		const block = {
			c: function create() {
				create_component(image.$$.fragment);
			},
			m: function mount(target, anchor) {
				mount_component(image, target, anchor);
				current = true;
			},
			p: function update(ctx, dirty) {
				const image_changes = {};
				if (dirty & /*id*/ 1) image_changes.id = /*id*/ ctx[0];
				if (dirty & /*title*/ 8) image_changes.title = /*title*/ ctx[3];
				if (dirty & /*altThumb*/ 2) image_changes.altThumb = /*altThumb*/ ctx[1];
				if (dirty & /*play*/ 64) image_changes.play = /*play*/ ctx[6];
				image.$set(image_changes);
			},
			i: function intro(local) {
				if (current) return;
				transition_in(image.$$.fragment, local);
				current = true;
			},
			o: function outro(local) {
				transition_out(image.$$.fragment, local);
				current = false;
			},
			d: function destroy(detaching) {
				destroy_component(image, detaching);
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_else_block_1$1.name,
			type: "else",
			source: "(41:4) {:else}",
			ctx
		});

		return block;
	}

	// (39:4) {#if isCustomThumbnail}
	function create_if_block_2(ctx) {
		let current;
		const thumbnail_slot_template = /*#slots*/ ctx[9].thumbnail;
		const thumbnail_slot = create_slot(thumbnail_slot_template, ctx, /*$$scope*/ ctx[13], get_thumbnail_slot_context);

		const block = {
			c: function create() {
				if (thumbnail_slot) thumbnail_slot.c();
			},
			m: function mount(target, anchor) {
				if (thumbnail_slot) {
					thumbnail_slot.m(target, anchor);
				}

				current = true;
			},
			p: function update(ctx, dirty) {
				if (thumbnail_slot) {
					if (thumbnail_slot.p && (!current || dirty & /*$$scope*/ 8192)) {
						update_slot_base(
							thumbnail_slot,
							thumbnail_slot_template,
							ctx,
							/*$$scope*/ ctx[13],
							!current
							? get_all_dirty_from_scope(/*$$scope*/ ctx[13])
							: get_slot_changes(thumbnail_slot_template, /*$$scope*/ ctx[13], dirty, get_thumbnail_slot_changes),
							get_thumbnail_slot_context
						);
					}
				}
			},
			i: function intro(local) {
				if (current) return;
				transition_in(thumbnail_slot, local);
				current = true;
			},
			o: function outro(local) {
				transition_out(thumbnail_slot, local);
				current = false;
			},
			d: function destroy(detaching) {
				if (thumbnail_slot) thumbnail_slot.d(detaching);
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_if_block_2.name,
			type: "if",
			source: "(39:4) {#if isCustomThumbnail}",
			ctx
		});

		return block;
	}

	// (47:2) {#if !play}
	function create_if_block$1(ctx) {
		let button;
		let current;

		button = new Button({
				props: {
					isCustomPlayButton: /*isCustomPlayButton*/ ctx[7],
					$$slots: { default: [create_default_slot] },
					$$scope: { ctx }
				},
				$$inline: true
			});

		button.$on("click", /*click_handler_1*/ ctx[12]);

		const block = {
			c: function create() {
				create_component(button.$$.fragment);
			},
			m: function mount(target, anchor) {
				mount_component(button, target, anchor);
				current = true;
			},
			p: function update(ctx, dirty) {
				const button_changes = {};

				if (dirty & /*$$scope*/ 8192) {
					button_changes.$$scope = { dirty, ctx };
				}

				button.$set(button_changes);
			},
			i: function intro(local) {
				if (current) return;
				transition_in(button.$$.fragment, local);
				current = true;
			},
			o: function outro(local) {
				transition_out(button.$$.fragment, local);
				current = false;
			},
			d: function destroy(detaching) {
				destroy_component(button, detaching);
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_if_block$1.name,
			type: "if",
			source: "(47:2) {#if !play}",
			ctx
		});

		return block;
	}

	// (48:4) <Button on:click={() => (play = true)} {isCustomPlayButton}>
	function create_default_slot(ctx) {
		let current;
		const default_slot_template = /*#slots*/ ctx[9].default;
		const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[13], null);

		const block = {
			c: function create() {
				if (default_slot) default_slot.c();
			},
			m: function mount(target, anchor) {
				if (default_slot) {
					default_slot.m(target, anchor);
				}

				current = true;
			},
			p: function update(ctx, dirty) {
				if (default_slot) {
					if (default_slot.p && (!current || dirty & /*$$scope*/ 8192)) {
						update_slot_base(
							default_slot,
							default_slot_template,
							ctx,
							/*$$scope*/ ctx[13],
							!current
							? get_all_dirty_from_scope(/*$$scope*/ ctx[13])
							: get_slot_changes(default_slot_template, /*$$scope*/ ctx[13], dirty, null),
							null
						);
					}
				}
			},
			i: function intro(local) {
				if (current) return;
				transition_in(default_slot, local);
				current = true;
			},
			o: function outro(local) {
				transition_out(default_slot, local);
				current = false;
			},
			d: function destroy(detaching) {
				if (default_slot) default_slot.d(detaching);
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_default_slot.name,
			type: "slot",
			source: "(48:4) <Button on:click={() => (play = true)} {isCustomPlayButton}>",
			ctx
		});

		return block;
	}

	function create_fragment$1(ctx) {
		let div;
		let current_block_type_index;
		let if_block0;
		let t;
		let current;
		const if_block_creators = [create_if_block_1$1, create_else_block$1];
		const if_blocks = [];

		function select_block_type(ctx, dirty) {
			if (/*play*/ ctx[6]) return 0;
			return 1;
		}

		current_block_type_index = select_block_type(ctx);
		if_block0 = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
		let if_block1 = !/*play*/ ctx[6] && create_if_block$1(ctx);

		const block = {
			c: function create() {
				div = element("div");
				if_block0.c();
				t = space();
				if (if_block1) if_block1.c();
				attr_dev(div, "class", "you__tube svelte-w0t24e");
				set_style(div, "--aspect-ratio", /*width*/ ctx[4] / /*height*/ ctx[5] || '16/9');
				attr_dev(div, "title", /*title*/ ctx[3]);
				add_location(div, file$1, 30, 0, 732);
			},
			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},
			m: function mount(target, anchor) {
				insert_dev(target, div, anchor);
				if_blocks[current_block_type_index].m(div, null);
				append_dev(div, t);
				if (if_block1) if_block1.m(div, null);
				current = true;
			},
			p: function update(ctx, [dirty]) {
				let previous_block_index = current_block_type_index;
				current_block_type_index = select_block_type(ctx);

				if (current_block_type_index === previous_block_index) {
					if_blocks[current_block_type_index].p(ctx, dirty);
				} else {
					group_outros();

					transition_out(if_blocks[previous_block_index], 1, 1, () => {
						if_blocks[previous_block_index] = null;
					});

					check_outros();
					if_block0 = if_blocks[current_block_type_index];

					if (!if_block0) {
						if_block0 = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
						if_block0.c();
					} else {
						if_block0.p(ctx, dirty);
					}

					transition_in(if_block0, 1);
					if_block0.m(div, t);
				}

				if (!/*play*/ ctx[6]) {
					if (if_block1) {
						if_block1.p(ctx, dirty);

						if (dirty & /*play*/ 64) {
							transition_in(if_block1, 1);
						}
					} else {
						if_block1 = create_if_block$1(ctx);
						if_block1.c();
						transition_in(if_block1, 1);
						if_block1.m(div, null);
					}
				} else if (if_block1) {
					group_outros();

					transition_out(if_block1, 1, 1, () => {
						if_block1 = null;
					});

					check_outros();
				}

				if (!current || dirty & /*width, height*/ 48) {
					set_style(div, "--aspect-ratio", /*width*/ ctx[4] / /*height*/ ctx[5] || '16/9');
				}

				if (!current || dirty & /*title*/ 8) {
					attr_dev(div, "title", /*title*/ ctx[3]);
				}
			},
			i: function intro(local) {
				if (current) return;
				transition_in(if_block0);
				transition_in(if_block1);
				current = true;
			},
			o: function outro(local) {
				transition_out(if_block0);
				transition_out(if_block1);
				current = false;
			},
			d: function destroy(detaching) {
				if (detaching) {
					detach_dev(div);
				}

				if_blocks[current_block_type_index].d();
				if (if_block1) if_block1.d();
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_fragment$1.name,
			type: "component",
			source: "",
			ctx
		});

		return block;
	}

	function instance$1($$self, $$props, $$invalidate) {
		let { $$slots: slots = {}, $$scope } = $$props;
		validate_slots('Youtube', slots, ['thumbnail','default']);
		const $$slots = compute_slots(slots);
		let { id = null } = $$props;
		let { altThumb = false } = $$props;
		let { animations = true } = $$props;
		let title = "";
		let width = 0;
		let height = 0;
		let videoInfo = {};

		onMount(async () => {
			const res = await fetch(`//www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}&format=json`);
			videoInfo = await res.json();
			$$invalidate(3, title = videoInfo?.title);
			$$invalidate(4, width = videoInfo?.width);
			$$invalidate(5, height = videoInfo?.height);
		});

		let play = false;
		const isCustomPlayButton = $$slots.default;
		const isCustomThumbnail = $$slots.thumbnail;
		const writable_props = ['id', 'altThumb', 'animations'];

		Object.keys($$props).forEach(key => {
			if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Youtube> was created with unknown prop '${key}'`);
		});

		const click_handler = () => $$invalidate(6, play = true);
		const keypress_handler = () => $$invalidate(6, play = true);
		const click_handler_1 = () => $$invalidate(6, play = true);

		$$self.$$set = $$props => {
			if ('id' in $$props) $$invalidate(0, id = $$props.id);
			if ('altThumb' in $$props) $$invalidate(1, altThumb = $$props.altThumb);
			if ('animations' in $$props) $$invalidate(2, animations = $$props.animations);
			if ('$$scope' in $$props) $$invalidate(13, $$scope = $$props.$$scope);
		};

		$$self.$capture_state = () => ({
			onMount,
			Button,
			Iframe,
			Image,
			id,
			altThumb,
			animations,
			title,
			width,
			height,
			videoInfo,
			play,
			isCustomPlayButton,
			isCustomThumbnail
		});

		$$self.$inject_state = $$props => {
			if ('id' in $$props) $$invalidate(0, id = $$props.id);
			if ('altThumb' in $$props) $$invalidate(1, altThumb = $$props.altThumb);
			if ('animations' in $$props) $$invalidate(2, animations = $$props.animations);
			if ('title' in $$props) $$invalidate(3, title = $$props.title);
			if ('width' in $$props) $$invalidate(4, width = $$props.width);
			if ('height' in $$props) $$invalidate(5, height = $$props.height);
			if ('videoInfo' in $$props) videoInfo = $$props.videoInfo;
			if ('play' in $$props) $$invalidate(6, play = $$props.play);
		};

		if ($$props && "$$inject" in $$props) {
			$$self.$inject_state($$props.$$inject);
		}

		return [
			id,
			altThumb,
			animations,
			title,
			width,
			height,
			play,
			isCustomPlayButton,
			isCustomThumbnail,
			slots,
			click_handler,
			keypress_handler,
			click_handler_1,
			$$scope
		];
	}

	class Youtube extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, instance$1, create_fragment$1, safe_not_equal, { id: 0, altThumb: 1, animations: 2 });

			dispatch_dev("SvelteRegisterComponent", {
				component: this,
				tagName: "Youtube",
				options,
				id: create_fragment$1.name
			});
		}

		get id() {
			throw new Error("<Youtube>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set id(value) {
			throw new Error("<Youtube>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get altThumb() {
			throw new Error("<Youtube>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set altThumb(value) {
			throw new Error("<Youtube>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get animations() {
			throw new Error("<Youtube>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set animations(value) {
			throw new Error("<Youtube>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}
	}

	var videos = [
		{
			title: "AWS re:Invent 2023 - Build without limits: The next-generation developer experience at AWS (DOP225)",
			url: "https://www.youtube.com/watch?v=8mUosAh3gLc"
		},
		{
			title: "AWS re:Invent 2023 - From hype to impact: Building a generative AI architecture (ARC217)",
			url: "https://www.youtube.com/watch?v=1Lat8dP7Eq0"
		},
		{
			title: "AWS re:Invent 2023 - Refactoring to serverless (SVS305)",
			url: "https://www.youtube.com/watch?v=bIu8XZZROw4"
		},
		{
			title: "AWS re:Invent 2023 - Keynote with Dr. Werner Vogels",
			url: "https://www.youtube.com/watch?v=UTRBVPvzt9w"
		},
		{
			title: "AWS re:Invent 2023 - Dive deep on Amazon S3 (STG314)",
			url: "https://www.youtube.com/watch?v=sYDJYqvNeXU"
		},
		{
			title: "AWS re:Invent 2023 - Move fast, stay secure: Strategies for the future of security (SEC237)",
			url: "https://www.youtube.com/watch?v=T-LwDlZbbU4"
		},
		{
			title: "AWS re:Invent 2023 - Build and run it: Streamline DevOps with machine learning on AWS (DOP207)",
			url: "https://www.youtube.com/watch?v=kZ3BZ0DhwHA"
		},
		{
			title: "AWS re:Invent 2023 - The power of cloud network innovation (NET208)",
			url: "https://www.youtube.com/watch?v=rwmAXlcHAvk"
		},
		{
			title: "AWS re:Invent 2023 - Overspending on laptops? Introducing Amazon WorkSpaces Thin Client (EUC215)",
			url: "https://www.youtube.com/watch?v=Viurp8p34Eo"
		},
		{
			title: "AWS re:Invent 2023 - Building high-performance gaming applications with Redis (BOA320)",
			url: "https://www.youtube.com/watch?v=jyikCMVzc-w"
		},
		{
			title: "AWS re:Invent 2023 - Innovate faster with generative AI (AIM245)",
			url: "https://www.youtube.com/watch?v=edPF6ItZsnE"
		},
		{
			title: "AWS re:Invent 2023 - Getting started building serverless SaaS architectures (SEG206)",
			url: "https://www.youtube.com/watch?v=Cag8cDbi-sk"
		},
		{
			title: "AWS re:Invent 2023 - CEO Keynote with Adam Selipsky",
			url: "https://www.youtube.com/watch?v=PMfn9_nTDbM"
		},
		{
			title: "AWS re:Invent 2023 - Best practices for Amazon CodeWhisperer (DOP201)",
			url: "https://www.youtube.com/watch?v=F_dSkRHCXBc"
		},
		{
			title: "AWS re:Invent 2023 - Innovation talk: Emerging tech | HYB207-INT",
			url: "https://www.youtube.com/watch?v=iEV3H_IV-ag"
		},
		{
			title: "AWS re:Invent 2023 - AWS networking foundations (NTA307)",
			url: "https://www.youtube.com/watch?v=8nNurTFy-h4"
		},
		{
			title: "AWS re:Invent 2023 - Cloud operations for today, tomorrow, and beyond (COP227)",
			url: "https://www.youtube.com/watch?v=3dF9cdkZ8kI"
		},
		{
			title: "AWS re:Invent 2023 - Empowering citizens through digital innovation (WPS213)",
			url: "https://www.youtube.com/watch?v=TOb8Ret33bY"
		},
		{
			title: "AWS re:Invent 2023 - Data patterns: Get the big picture for data applications (PEX309)",
			url: "https://www.youtube.com/watch?v=0u2WBYdFuog"
		},
		{
			title: "AWS re:Invent 2023 - How Scuderia Ferrari and Dynata improved engagement with ML (BIZ209)",
			url: "https://www.youtube.com/watch?v=o_B5hjE1EJQ"
		},
		{
			title: "AWS re:Invent 2023 - My pods aren’t responding! A Kubernetes troubleshooting journey (BOA205)",
			url: "https://www.youtube.com/watch?v=_wwzCvTNZx0"
		},
		{
			title: "AWS re:Invent 2023 - How to customize AWS compliance and auditing services (COP209)",
			url: "https://www.youtube.com/watch?v=1OChlDQIKqA"
		},
		{
			title: "AWS re:Invent 2023 - Driving innovation through mainframe modernization with Kyndryl & AWS (ENT327)",
			url: "https://www.youtube.com/watch?v=1618QyNBZZg"
		},
		{
			title: "AWS re:Invent 2023 - A deep dive on AWS infrastructure powering the generative AI boom (CMP201)",
			url: "https://www.youtube.com/watch?v=VPvguzeWlbU"
		},
		{
			title: "AWS re:Invent 2023 - Automating a 20 TB file server migration (COM303)",
			url: "https://www.youtube.com/watch?v=o1r4-tJ7Ezk"
		},
		{
			title: "AWS re:Invent 2023 - Unlocking serverless web applications with AWS Lambda Web Adapter (BOA311)",
			url: "https://www.youtube.com/watch?v=0nXfWIY2PhA"
		},
		{
			title: "AWS re:Invent 2023 - How the Bundesliga adopts an agile and cross-functional data strategy (SPT203)",
			url: "https://www.youtube.com/watch?v=0CzgTyXvcqo"
		},
		{
			title: "AWS re:Invent 2023 - Secure remote connectivity to AWS (NET202)",
			url: "https://www.youtube.com/watch?v=yHEhrkGdnj0"
		},
		{
			title: "AWS re:Invent 2023 - Unlock supplier diversity: Scaling diverse-owned businesses (IDE203)",
			url: "https://www.youtube.com/watch?v=BEIG4umhNSE"
		},
		{
			title: "AWS re:Invent 2023 - AWS product innovation approach: Bring your best ideas to life faster (INO109)",
			url: "https://www.youtube.com/watch?v=vMMn9B4PDqE"
		},
		{
			title: "AWS re:Invent 2023 - AWS European Sovereign Cloud: A closer look (SEC216)",
			url: "https://www.youtube.com/watch?v=qNHWeDf-fTQ"
		},
		{
			title: "AWS re:Invent 2023 - The future of Amazon EKS (CON203)",
			url: "https://www.youtube.com/watch?v=c9NJ6GSeNDM"
		},
		{
			title: "AWS re:Invent 2023 - Building an AI comic video generator with Amazon Bedrock (COM202)",
			url: "https://www.youtube.com/watch?v=Sljz2fV558A"
		},
		{
			title: "AWS re:Invent 2023 - A Go developer's guide to building on AWS (BOA201)",
			url: "https://www.youtube.com/watch?v=W9bNN7etyKw"
		},
		{
			title: "AWS re:Invent 2023 - The real-time database to build your AI future (DAT206)",
			url: "https://www.youtube.com/watch?v=NJ47ZoDYSjs"
		},
		{
			title: "AWS re:Invent 2023 - Your journey with AWS: Executive lens into your organization journey (NTA101)",
			url: "https://www.youtube.com/watch?v=zKLpUWu_N74"
		},
		{
			title: "AWS re:Invent 2023 - Using AI for ESG reporting and data-driven decision-making (SUS204)",
			url: "https://www.youtube.com/watch?v=LPdd6kqzEBM"
		},
		{
			title: "AWS re:Invent 2023 - Evaluate and select the best FM for your use case in Amazon Bedrock (AIM373)",
			url: "https://www.youtube.com/watch?v=AEK1kVZMIvM"
		},
		{
			title: "AWS re:Invent 2023 - Optimizing TCO for business-critical analytics (ANT209)",
			url: "https://www.youtube.com/watch?v=DMW31AttLd4"
		},
		{
			title: "AWS re:Invent 2023 - How Lockheed Martin builds software faster, powered by DevSecOps (DOP323)",
			url: "https://www.youtube.com/watch?v=Q1OSyxYkl5w"
		},
		{
			title: "AWS re:Invent 2023 - Better together: Using encryption & authorization for data protection (SEC333)",
			url: "https://www.youtube.com/watch?v=T4_rqwfngfU"
		},
		{
			title: "AWS re:Invent 2023 - Unpack the Aviatrix Distributed Cloud Firewall for AWS (HYB102)",
			url: "https://www.youtube.com/watch?v=WM_ci6xbJ8U"
		},
		{
			title: "AWS re:Invent 2023 - Gen AI & the SDLC: Changing the way we bring digital products to life (AIM243)",
			url: "https://www.youtube.com/watch?v=xYxceIDCnaI"
		},
		{
			title: "AWS re:Invent 2023 - Real-life automation and security best practices from the field (COP228)",
			url: "https://www.youtube.com/watch?v=tzf8TFaVQUc"
		},
		{
			title: "AWS re:Invent 2023 - Evolution from migration to modernization using modernization pathways (PEX305)",
			url: "https://www.youtube.com/watch?v=wKiLUvoHPQk"
		},
		{
			title: "AWS re:Invent 2023 - Implementing generative AI responsibly: A talk with Dr. Mitchell (IMP213)",
			url: "https://www.youtube.com/watch?v=w1FaBEy7Gk8"
		},
		{
			title: "AWS re:Invent 2023 - Practical implementations of quantum communication networks (QTC204)",
			url: "https://www.youtube.com/watch?v=4ScolUaikME"
		},
		{
			title: "AWS re:Invent 2023 - Next-gen trucking: How Iveco Group uses AWS to harness generative AI (PRO301)",
			url: "https://www.youtube.com/watch?v=Mk9LaHd_TUs"
		},
		{
			title: "AWS re:Invent 2023 - SaaS meets AI/ML & generative AI: Multi-tenant patterns & strategies (SAS306)",
			url: "https://www.youtube.com/watch?v=oBhP44wowoY"
		},
		{
			title: "AWS re:Invent 2023 - Using AI to power a circular economy for aerospace (AIM235)",
			url: "https://www.youtube.com/watch?v=-kYOA_HBwKo"
		},
		{
			title: "AWS re:Invent 2023 - Scaling ops: Embracing platform engineering’s potential (DOP213)",
			url: "https://www.youtube.com/watch?v=Tcu8GDmSFbo"
		},
		{
			title: "AWS re:Invent 2023 - Mental health crisis intervention based on analytics and ML (IMP204)",
			url: "https://www.youtube.com/watch?v=iC_vO1R4RH0"
		},
		{
			title: "AWS re:Invent 2023 - Driving profitable growth with innovative products (SEG105)",
			url: "https://www.youtube.com/watch?v=4BMdlzfWtYE"
		},
		{
			title: "AWS re:Invent 2023 - How Aflac built a cloud-fluent culture to speed up migration (ENT238)",
			url: "https://www.youtube.com/watch?v=aXRmROUdzJ4"
		},
		{
			title: "AWS re:Invent 2023 - Multi-data warehouse writes through Amazon Redshift data sharing (ANT351)",
			url: "https://www.youtube.com/watch?v=z9XPLOc-wg0"
		},
		{
			title: "AWS re:Invent 2023 - Transform your contact center using generative AI in Amazon Connect (BIZ222)",
			url: "https://www.youtube.com/watch?v=ftF2s8Gz5U0"
		},
		{
			title: "AWS re:Invent 2023 - Enhance your app’s security & availability with Elastic Load Balancing (NET318)",
			url: "https://www.youtube.com/watch?v=6iO6wtDOKGM"
		},
		{
			title: "AWS re:Invent 2023 - Amazon Q: Your new assistant and expert guide for building with AWS (DOP228)",
			url: "https://www.youtube.com/watch?v=lBJHJmkotcI"
		},
		{
			title: "AWS re:Invent 2023 - Netflix’s journey to an Apache Iceberg–only data lake (NFX306)",
			url: "https://www.youtube.com/watch?v=jMFMEk8jFu8"
		},
		{
			title: "AWS re:Invent 2023 - Live video streaming with Amazon CloudFront and Peacock (NET328)",
			url: "https://www.youtube.com/watch?v=mttGiB6AEDg"
		},
		{
			title: "AWS re:Invent 2023 - Must-have network diagnostics and troubleshooting tools (NET204)",
			url: "https://www.youtube.com/watch?v=bFgzkNU5P24"
		},
		{
			title: "AWS re:Invent 2023 - From factory to cloud: Enhancing operations & sustainability with IoT (PRO203)",
			url: "https://www.youtube.com/watch?v=CvbpPizsqT0"
		},
		{
			title: "AWS re:Invent 2023 - Lifesaving early warning systems and mitigation for climate disasters (WPS103)",
			url: "https://www.youtube.com/watch?v=PqeVPXAEX1U"
		},
		{
			title: "AWS re:Invent 2023 - Are you well-architected? (TNC216)",
			url: "https://www.youtube.com/watch?v=uopHk4whfiE"
		},
		{
			title: "AWS re:Invent 2023 - New LLM capabilities in Amazon SageMaker Canvas, with Bain & Company (AIM363)",
			url: "https://www.youtube.com/watch?v=BkBD9JtRR1U"
		},
		{
			title: "AWS re:Invent 2023 - [LAUNCH] Introducing Amazon SageMaker HyperPod (AIM362)",
			url: "https://www.youtube.com/watch?v=1vlcD07bMlA"
		},
		{
			title: "AWS re:Invent 2023 - How Better Mortgage worked with Amazon and AWS to grow their business (SEG103)",
			url: "https://www.youtube.com/watch?v=6_6fccX60ms"
		},
		{
			title: "AWS re:Invent 2023 - Succeeding in economies of speed: Rethinking your levers (SEG102)",
			url: "https://www.youtube.com/watch?v=vTHateiFJrA"
		},
		{
			title: "AWS re:Invent 2023 - How AI is reshaping the travel experience from planning to landing (TRV202)",
			url: "https://www.youtube.com/watch?v=T83aTmVpfzQ"
		},
		{
			title: "AWS re:Invent 2023 - Innovating for health equity to drive social impact with generative AI (IMP202)",
			url: "https://www.youtube.com/watch?v=qQKziEUei_c"
		},
		{
			title: "AWS re:Invent 2023 - Sustainable architecture: Past, present, and future (SUS302)",
			url: "https://www.youtube.com/watch?v=2xpUQ-Q4QcM"
		},
		{
			title: "AWS re:Invent 2023 - Sustainability innovation in AWS Global Infrastructure (SUS101)",
			url: "https://www.youtube.com/watch?v=0EkcwLKeOQA"
		},
		{
			title: "AWS re:Invent 2023 - What's new with AWS Backup (STG203)",
			url: "https://www.youtube.com/watch?v=QIffkOyTf7I"
		},
		{
			title: "AWS re:Invent 2023 - FSx for ONTAP: Enterprise-grade unified storage for any application (STG220)",
			url: "https://www.youtube.com/watch?v=jf3zmY-X4KA"
		},
		{
			title: "AWS re:Invent 2023 - Preparing for next-generation challenges with Kyndryl and AWS (SEC213)",
			url: "https://www.youtube.com/watch?v=gSN1Sn6xvU8"
		},
		{
			title: "AWS re:Invent 2023 - The evolution of user logins (SEC102)",
			url: "https://www.youtube.com/watch?v=a7go--z7a70"
		},
		{
			title: "AWS re:Invent 2023 - Secure access to AWS with ZTNA 2.0 (HYB204)",
			url: "https://www.youtube.com/watch?v=opAf7C_3g6c"
		},
		{
			title: "AWS re:Invent 2023 - Schema design for fast applications (DAT347)",
			url: "https://www.youtube.com/watch?v=IYlWOk9Hu5g"
		},
		{
			title: "AWS re:Invent 2023 - AI amplified: Blueprint for elevating enterprise competitiveness (CEN401)",
			url: "https://www.youtube.com/watch?v=RAq9xweMLlA"
		},
		{
			title: "AWS re:Invent 2023 - Catalyzing success: Max Life’s digital insurance revolution with PwC (AIM249)",
			url: "https://www.youtube.com/watch?v=ykBWNZQvyUQ"
		},
		{
			title: "AWS re:Invent 2023 - Intelligent airport operations powered by generative AI with United (AIM242)",
			url: "https://www.youtube.com/watch?v=hx5_cUXztrw"
		},
		{
			title: "AWS re:Invent 2023 - LLM inference and fine-tuning on secure enterprise data (AIM208)",
			url: "https://www.youtube.com/watch?v=qp8MjyIK3E4"
		},
		{
			title: "AWS re:Invent 2023 - Clearwater Analytics delivers innovation & growth by migrating to AWS (SMB213)",
			url: "https://www.youtube.com/watch?v=wMStowWhDgw"
		},
		{
			title: "AWS re:Invent 2023 - Migrate your data to AWS seamlessly with Amazon FSx for NetApp ONTAP (SMB210)",
			url: "https://www.youtube.com/watch?v=r12yJ5jkZi4"
		},
		{
			title: "AWS re:Invent 2023 - Getting started building serverless event-driven applications (SVS205)",
			url: "https://www.youtube.com/watch?v=1aTQI-Kqs2U"
		},
		{
			title: "AWS re:Invent 2023 - Improving security through modern application development (SEC227)",
			url: "https://www.youtube.com/watch?v=0TCPR8cT3M8"
		},
		{
			title: "AWS re:Invent 2023 - Bridging research and computing to tackle the world's grand challenges (WPS207)",
			url: "https://www.youtube.com/watch?v=WHRt54RmEms"
		},
		{
			title: "AWS re:Invent 2023 - Establishing a modernization CCoE (PEX304)",
			url: "https://www.youtube.com/watch?v=kIbv2byjmtA"
		},
		{
			title: "AWS re:Invent 2023 - Accelerate wins with co-sell in AWS Partner Central (PEX211)",
			url: "https://www.youtube.com/watch?v=pgEEtGyIjVc"
		},
		{
			title: "AWS re:Invent 2023 - Automate and accelerate your sales motion with AWS Marketplace (PEX201)",
			url: "https://www.youtube.com/watch?v=tAUrUBcRSlk"
		},
		{
			title: "AWS re:Invent 2023 - A leader’s guide on low-effort ways to adopt generative AI (NTA216)",
			url: "https://www.youtube.com/watch?v=XwSyuFo7sx0"
		},
		{
			title: "AWS re:Invent 2023 - Build responsible AI applications with Guardrails for Amazon Bedrock (AIM361)",
			url: "https://www.youtube.com/watch?v=-osfvAqydt0"
		},
		{
			title: "AWS re:Invent 2023 - Accelerate generative AI application development with Amazon Bedrock (AIM337)",
			url: "https://www.youtube.com/watch?v=vleGSQ_mIvc"
		},
		{
			title: "AWS re:Invent 2023 - Accelerate business and mission outcomes with AWS Government Regions (WPS203)",
			url: "https://www.youtube.com/watch?v=DZEdWOToXTQ"
		},
		{
			title: "AWS re:Invent 2023 - [LAUNCH] AWS Clean Rooms ML and AWS Clean Rooms Differential Privacy (AIM241)",
			url: "https://www.youtube.com/watch?v=KaBlf6CyoIk"
		},
		{
			title: "AWS re:Invent 2023 - Innovating in Korean manufactures’ businesses using AWS AI/ML services (GBL206)",
			url: "https://www.youtube.com/watch?v=WdG5TuDAZMU"
		},
		{
			title: "AWS re:Invent 2023 - Understanding the measurable value of the cloud (GDS103)",
			url: "https://www.youtube.com/watch?v=CEnWS6gwrPM"
		},
		{
			title: "AWS re:Invent 2023 - The next-generation application-building experience from AWS Amplify (FWM203)",
			url: "https://www.youtube.com/watch?v=UfYWGYbmV3s"
		},
		{
			title: "AWS re:Invent 2023 - How Samsung Electronics scales SAP systems for Black Friday (ENT223)",
			url: "https://www.youtube.com/watch?v=1ycQnhxVlKM"
		},
		{
			title: "AWS re:Invent 2023 - Drive innovation with AWS Mainframe Modernization Data Replication (ENT204)",
			url: "https://www.youtube.com/watch?v=Qvm9lhzuH8U"
		},
		{
			title: "AWS re:Invent 2023-Deep dive into Amazon Neptune Analytics & its generative AI capabilities (DAT325)",
			url: "https://www.youtube.com/watch?v=hGg7gKLHVnY"
		},
		{
			title: "AWS re:Invent 2023 - Inner workings of Amazon EKS (CON327)",
			url: "https://www.youtube.com/watch?v=I0hi6UiA7Ts"
		},
		{
			title: "AWS re:Invent 2023 - Data processing at massive scale on Amazon EKS (CON309)",
			url: "https://www.youtube.com/watch?v=G9aNXEu_a8k"
		},
		{
			title: "AWS re:Invent 2023 - Behind-the-scenes look at generative AI infrastructure at Amazon (CMP206)",
			url: "https://www.youtube.com/watch?v=fDk09hms8s8"
		},
		{
			title: "AWS re:Invent 2023 - Enhancing SaaS application productivity with generative AI (BIZ212)",
			url: "https://www.youtube.com/watch?v=RPep0WvE-70"
		},
		{
			title: "AWS re:Invent 2023 - How BMW and Qualcomm built an automated driving platform on AWS (AUT202)",
			url: "https://www.youtube.com/watch?v=mP9KYtkjyC0"
		},
		{
			title: "AWS re:Invent 2023 - Train and tune state-of-the-art ML models on Amazon SageMaker (AIM335)",
			url: "https://www.youtube.com/watch?v=i2-M7x9dJXQ"
		},
		{
			title: "AWS re:Invent 2023 - Improve application resilience with AWS Fault Injection Service (ARC317)",
			url: "https://www.youtube.com/watch?v=N0aZZVVZiUw"
		},
		{
			title: "AWS re:Invent 2023 - Scale interactive data analysis with Step Functions Distributed Map (API310)",
			url: "https://www.youtube.com/watch?v=JHW8ZSYXsXU"
		},
		{
			title: "AWS re:Invent 2023 - What’s new with AWS data integration (ANT220)",
			url: "https://www.youtube.com/watch?v=5gWTBuZWUbI"
		},
		{
			title: "AWS re:Invent 2023 - Curate your data at scale (ANT205)",
			url: "https://www.youtube.com/watch?v=-3sMHQIwKG0"
		},
		{
			title: "AWS re:Invent 2023 - Scale analytics and SaaS applications with serverless elastic storage (STG338)",
			url: "https://www.youtube.com/watch?v=mUl9bdzOeX0"
		},
		{
			title: "AWS re:Invent 2023 - Generative AI: Cyber resiliency and risk (AIM202)",
			url: "https://www.youtube.com/watch?v=6UYqKUuijlA"
		},
		{
			title: "AWS re:Invent 2023 - Building a comprehensive security solution with AWS security services (SEC226)",
			url: "https://www.youtube.com/watch?v=_1KwSIPMV80"
		},
		{
			title: "AWS re:Invent 2023 - Build secure applications on AWS the well-architected way (SEC219)",
			url: "https://www.youtube.com/watch?v=sopvoguWHOg"
		},
		{
			title: "AWS re:Invent 2023 - Operating autonomous cleaning robots at scale with AWS IoT (ROB203)",
			url: "https://www.youtube.com/watch?v=GPUS7WVOqYo"
		},
		{
			title: "AWS re:Invent 2023 - 0 to 25 PB in one year (NTA213)",
			url: "https://www.youtube.com/watch?v=IPEsJ5UtwS8"
		},
		{
			title: "AWS re:Invent 2023 - [LAUNCH] Application monitoring for modern workloads (COP351)",
			url: "https://www.youtube.com/watch?v=T2TovTLje8w"
		},
		{
			title: "AWS re:Invent 2023-Vector database and zero-ETL capabilities for Amazon OpenSearch Service (ANT353)",
			url: "https://www.youtube.com/watch?v=ol-UBfYcKUI"
		},
		{
			title: "AWS re:Invent 2023 - Powering high-speed workloads with Amazon MemoryDB for Redis (DAT332)",
			url: "https://www.youtube.com/watch?v=Grb6Z_RZ9PU"
		},
		{
			title: "AWS re:Invent 2023 - What's new with Amazon RDS? (DAT326)",
			url: "https://www.youtube.com/watch?v=IFg8EZGtLsM"
		},
		{
			title: "AWS re:Invent 2023 - Harness the power of Karpenter to scale, optimize & upgrade Kubernetes (CON331)",
			url: "https://www.youtube.com/watch?v=lkg_9ETHeks"
		},
		{
			title: "AWS re:Invent 2023 - Transform self-service experiences with AI and Amazon Connect (BIZ226)",
			url: "https://www.youtube.com/watch?v=gXY-kIL6Fqw"
		},
		{
			title: "AWS re:Invent 2023 - Navigating the journey to serverless event-driven architecture (API303)",
			url: "https://www.youtube.com/watch?v=hvGuqHp051c"
		},
		{
			title: "AWS re:Invent 2023 - Set up a zero-ETL-based analytics architecture for your organizations (ANT326)",
			url: "https://www.youtube.com/watch?v=BB06-pcAPqI"
		},
		{
			title: "AWS re:Invent 2023 - Unlocking SaaS backup data’s transformative potential (ANT104)",
			url: "https://www.youtube.com/watch?v=XWBiGtB1NYs"
		},
		{
			title: "AWS re:Invent 2023 - Launch and progress your AWS offering: 5 tips from APN Sales (PEX120)",
			url: "https://www.youtube.com/watch?v=jtqBwepLwCY"
		},
		{
			title: "AWS re:Invent 2023 - A “better together” story: AWS Partners and AWS Distribution Partners (PEX110)",
			url: "https://www.youtube.com/watch?v=papEPsCLvkE"
		},
		{
			title: "AWS re:Invent 2023 - We don’t rap or play sports: Using tech to break generational curses (IDE104)",
			url: "https://www.youtube.com/watch?v=AFS5rGPtJs0"
		},
		{
			title: "AWS re:Invent 2023- Collaborate within your company and with AWS using AWS re:Post Private (SUP205)",
			url: "https://www.youtube.com/watch?v=HNq_kU2QJLU"
		},
		{
			title: "AWS re:Invent 2023-Enhance workload security with agentless scanning and CI/CD integration (SEC243)",
			url: "https://www.youtube.com/watch?v=5ngtzZHSwqU"
		},
		{
			title: "AWS re:Invent 2023 -Automate app upgrades & maintenance using Amazon Q Code Transformation (DOP229)",
			url: "https://www.youtube.com/watch?v=LY76tak6Z1E"
		},
		{
			title: "AWS re:Invent 2023 - AWS Graviton: The best price performance for your AWS workloads (CMP334)",
			url: "https://www.youtube.com/watch?v=T_hMIjKtSr4"
		},
		{
			title: "AWS re:Invent 2023 - New Amazon EC2 generative AI capabilities in AWS Management Console (CMP222)",
			url: "https://www.youtube.com/watch?v=sSpJ8tWCEiA"
		},
		{
			title: "AWS re:Invent 2023 - A dynamic opportunity: Understand AWS China and grow your business (ENT201-EN)",
			url: "https://www.youtube.com/watch?v=3QgWGXjXwMs"
		},
		{
			title: "AWS re:Invent 2023 - Using federated GraphQL APIs for backend-for-frontend architectures (FWM313)",
			url: "https://www.youtube.com/watch?v=2bVlgO_TTzc"
		},
		{
			title: "AWS re:Invent 2023 - Amazon CodeCatalyst in real time: Deploying to production in minutes (DOP221)",
			url: "https://www.youtube.com/watch?v=cRZ4kwF9qR0"
		},
		{
			title: "AWS re:Invent 2023 - Introducing Amazon CodeCatalyst Enterprise (DOP210)",
			url: "https://www.youtube.com/watch?v=mS2m5X7QZ2E"
		},
		{
			title: "AWS re:Invent 2023 - Dive deep into Amazon ECR (CON405)",
			url: "https://www.youtube.com/watch?v=PHuKrcsAaDw"
		},
		{
			title: "AWS re:Invent 2023 - Transforming the consumer packaged goods industry with generative AI (CPG203)",
			url: "https://www.youtube.com/watch?v=UCsUw4J7_E4"
		},
		{
			title: "AWS re:Invent 2023 - Migrating critical business applications to AWS Graviton with ease (CMP315)",
			url: "https://www.youtube.com/watch?v=9W0j__k5afg"
		},
		{
			title: "AWS re:Invent 2023 - AWS Graviton: The best price performance for your AWS workloads (CMP313)",
			url: "https://www.youtube.com/watch?v=DY9ENcGQRto"
		},
		{
			title: "AWS re:Invent 2023 - What’s new with AWS observability and operations (COP339)",
			url: "https://www.youtube.com/watch?v=E8qQBMDJjso"
		},
		{
			title: "AWS re:Invent 2023 - How to build generative AI–powered American Sign Language avatars (BOA305)",
			url: "https://www.youtube.com/watch?v=LZgZ4K3OL80"
		},
		{
			title: "AWS re:Invent 2023 - Using AI and serverless to automate video production (BOA304)",
			url: "https://www.youtube.com/watch?v=C-I9F2FgAf0"
		},
		{
			title: "AWS re:Invent 2023 - Simplify generative AI app development with Agents for Amazon Bedrock (AIM353)",
			url: "https://www.youtube.com/watch?v=JNZPW82uv7w"
		},
		{
			title: "AWS re:Invent 2023 - Improve FMs with Amazon SageMaker human-in-the-loop capabilities (AIM334)",
			url: "https://www.youtube.com/watch?v=9T775vCL-ak"
		},
		{
			title: "AWS re:Invent 2023 - Explore image generation and search with FMs on Amazon Bedrock (AIM332)",
			url: "https://www.youtube.com/watch?v=ZW_z5o_gWhQ"
		},
		{
			title: "AWS re:Invent 2023 - Explore Amazon Titan for language tasks (AIM331)",
			url: "https://www.youtube.com/watch?v=SdbfLgqc7is"
		},
		{
			title: "AWS re:Invent 2023 - Practice like you play: How Amazon scales resilience to new heights (ARC316)",
			url: "https://www.youtube.com/watch?v=r3J0fEgNCLQ"
		},
		{
			title: "AWS re:Invent 2023 - Advanced serverless workflow patterns and best practices (API401)",
			url: "https://www.youtube.com/watch?v=Fp-F8ehBUFY"
		},
		{
			title: "AWS re:Invent 2023 - Building next-generation applications with event-driven architecture (API302)",
			url: "https://www.youtube.com/watch?v=KXR17uwLEC8"
		},
		{
			title: "AWS re:Invent 2023 - What’s new in Amazon OpenSearch Service (ANT301)",
			url: "https://www.youtube.com/watch?v=CKYCxw0mMiE"
		},
		{
			title: "AWS re:Invent 2023 - Unified and integrated near real-time analytics with zero-ETL (ANT218)",
			url: "https://www.youtube.com/watch?v=U74b98ijMuk"
		},
		{
			title: "AWS re:Invent 2023 - Amazon MGM Studios: Building a next-generation studio (AMZ203)",
			url: "https://www.youtube.com/watch?v=3v5aU9TPWfY"
		},
		{
			title: "AWS re:Invent 2023 - ULA transforms rocket development efforts with AWS (AES205)",
			url: "https://www.youtube.com/watch?v=_DBd0ZhyRUU"
		},
		{
			title: "AWS re:Invent 2023 - How Viasat uses AWS AI to customize algorithms for satellite customers (AES203)",
			url: "https://www.youtube.com/watch?v=xljEU1UIq7M"
		},
		{
			title: "AWS re:Invent 2023 - Modernize .NET apps at scale: DraftKings principles for success (XNT307)",
			url: "https://www.youtube.com/watch?v=l_jIG6TlcoQ"
		},
		{
			title: "AWS re:Invent 2023 - Amazon Lex reshapes CX with conversational workflows and generative AI (AIM222)",
			url: "https://www.youtube.com/watch?v=WsOH3NS_1EQ"
		},
		{
			title: "AWS re:Invent 2023 - Realizing value and business outcomes with AI (AIM206)",
			url: "https://www.youtube.com/watch?v=vIG1RHlj4S0"
		},
		{
			title: "AWS re:Invent 2023 - What’s new with AWS file storage (STG219)",
			url: "https://www.youtube.com/watch?v=yXIeIKlTFV0"
		},
		{
			title: "AWS re:Invent 2023 - Cloud security, data responsibility, and recovery: 10 key strategies (ENT319)",
			url: "https://www.youtube.com/watch?v=EyWK7AXM5LI"
		},
		{
			title: "AWS re:Invent 2023 - High availability with CloudBees CI on AWS Graviton3 and Amazon EKS (DOP216)",
			url: "https://www.youtube.com/watch?v=26Nj23bHgyE"
		},
		{
			title: "AWS re:Invent 2023 - How REI built a DevSecOps culture from the start (DOP103)",
			url: "https://www.youtube.com/watch?v=l11vH8urn-A"
		},
		{
			title: "AWS re:Invent 2023 - Revolutionizing API development: Collaborative workflows with Postman (DOP101)",
			url: "https://www.youtube.com/watch?v=WBGXZessbZM"
		},
		{
			title: "AWS re:Invent 2023 - Postgres for the modern enterprise (DAT102)",
			url: "https://www.youtube.com/watch?v=nRUTE4GN5Iw"
		},
		{
			title: "AWS re:Invent 2023 - Cognizant Intelligent Interactions: Elevating your customer experience (AIM113)",
			url: "https://www.youtube.com/watch?v=z_E5APnbnO0"
		},
		{
			title: "AWS re:Invent 2023 - I didn’t know Amazon API Gateway did that (SVS323)",
			url: "https://www.youtube.com/watch?v=SlWJCTrMLOA"
		},
		{
			title: "AWS re:Invent 2023 - Co-market generative AI with AWS: CMO storytelling that drives growth (PEX114)",
			url: "https://www.youtube.com/watch?v=BwAlxaO6THI"
		},
		{
			title: "AWS re:Invent 2023 - Netflix Maestro: Orchestrating scaled data & ML workflows in the cloud (NFX308)",
			url: "https://www.youtube.com/watch?v=kPYPgR0Gzrs"
		},
		{
			title: "AWS re:Invent 2023 - CBS Sports Digital: Innovation in the cloud with the Golazo Network (MAE202)",
			url: "https://www.youtube.com/watch?v=dVG1Pj_kLto"
		},
		{
			title: "AWS re:Invent 2023 - Scaling connected products and solutions with AWS IoT (IOT213)",
			url: "https://www.youtube.com/watch?v=eeZKPtrjy3w"
		},
		{
			title: "AWS re:Invent 2023-AWS Resilience Partners: Best practices to create a resilient organization-PEX210",
			url: "https://www.youtube.com/watch?v=o5oE1oPAopU"
		},
		{
			title: "AWS re:Invent 2023-Use new IAM Access Analyzer features on your journey to least privilege (SEC238)",
			url: "https://www.youtube.com/watch?v=JpemUkU8INA"
		},
		{
			title: "AWS re:Invent 2023 - Customize FMs for generative AI applications with Amazon Bedrock (AIM247)",
			url: "https://www.youtube.com/watch?v=YY9N7sDoP30"
		},
		{
			title: "AWS re:Invent 2023 - Reimagining healthcare delivery by migrating critical workloads to AWS (HLC202)",
			url: "https://www.youtube.com/watch?v=RvUIYCG0agg"
		},
		{
			title: "AWS re:Invent 2023 - Driving health breakthroughs with integrated data strategies & gen AI (HLC101)",
			url: "https://www.youtube.com/watch?v=-XJ2jVGMbnY"
		},
		{
			title: "AWS re:Invent 2023 - Lessons learned using generative AI in banking and shopping services (GBL209)",
			url: "https://www.youtube.com/watch?v=Tag_Ykuv5sw"
		},
		{
			title: "AWS re:Invent 2023 - How AWS supports luxury customer experiences [French] (GBL204)",
			url: "https://www.youtube.com/watch?v=ldsFPHZIO3Q"
		},
		{
			title: "AWS re:Invent 2023 - Implement real-time event patterns with WebSockets and AWS AppSync (FWM204)",
			url: "https://www.youtube.com/watch?v=Goj7yBmSkSc"
		},
		{
			title: "AWS re:Invent 2023 - How Carrier Global is saving 40% with Windows containers on AWS (ENT212)",
			url: "https://www.youtube.com/watch?v=JUkJ2HQBBT8"
		},
		{
			title: "AWS re:Invent 2023 - Modernizing large-scale mainframes with AWS Mainframe Modernization (ENT203)",
			url: "https://www.youtube.com/watch?v=qj2kqKyZk-4"
		},
		{
			title: "AWS re:Invent 2023 - AWS infrastructure as code: A year in review (DOP206)",
			url: "https://www.youtube.com/watch?v=fROlLTMRi0Y"
		},
		{
			title: "AWS re:Invent 2023 - Ultra-low latency vector search for Amazon MemoryDB for Redis (DAT346)",
			url: "https://www.youtube.com/watch?v=AaMh3rdu-p0"
		},
		{
			title: "AWS re:Invent 2023 -Amazon Neptune Analytics: New capabilities for graph analytics & gen AI (DAT208)",
			url: "https://www.youtube.com/watch?v=c3TT6NTxqM4"
		},
		{
			title: "AWS re:Invent 2023-Seamless scaling:Amazon Aurora sharding & traffic management on Kubernetes-COM204",
			url: "https://www.youtube.com/watch?v=VcTPmEJeKM4"
		},
		{
			title: "AWS re:Invent 2023 - Demonstration of what’s new with AWS observability and operations (COP349)",
			url: "https://www.youtube.com/watch?v=YX670OrdwcY"
		},
		{
			title: "AWS re:Invent 2023 - Best practices for cloud governance (COP318)",
			url: "https://www.youtube.com/watch?v=U0y9l5V3mMQ"
		},
		{
			title: "AWS re:Invent 2023 - Use RAG to improve responses in generative AI applications (AIM336)",
			url: "https://www.youtube.com/watch?v=N0tlOXZwrSs"
		},
		{
			title: "AWS re:Invent 2023 - Scaling FM inference to hundreds of models with Amazon SageMaker (AIM327)",
			url: "https://www.youtube.com/watch?v=6xENDvgnMCs"
		},
		{
			title: "AWS re:Invent 2023 - Resilience lifecycle: A mental model for resilience on AWS (ARC312)",
			url: "https://www.youtube.com/watch?v=i-0XJZLvq6U"
		},
		{
			title: "AWS re:Invent 2023 - Easily and securely prepare, share, and query data (ANT324)",
			url: "https://www.youtube.com/watch?v=CvQ3Onz5CMA"
		},
		{
			title: "AWS re:Invent 2023 - Running sustainable real-time advertising workloads in the cloud (ADM302)",
			url: "https://www.youtube.com/watch?v=hYg5FxPu3PE"
		},
		{
			title: "AWS re:Invent 2023 - A generative AI–enabled enterprise: Transformative AI/ML on AWS (AIM205)",
			url: "https://www.youtube.com/watch?v=hr3EEWaoIxc"
		},
		{
			title: "AWS re:Invent 2023 - Introduction to MLOps engineering on AWS (TNC215)",
			url: "https://www.youtube.com/watch?v=2kzJPhgDkDE"
		},
		{
			title: "AWS re:Invent 2023 - Optimize costs by going serverless (IMP212)",
			url: "https://www.youtube.com/watch?v=pjzluTJVEQM"
		},
		{
			title: "AWS re:Invent 2023 - Modern digital experiences to accelerate mission impact (IMP205)",
			url: "https://www.youtube.com/watch?v=v7pDaFrfeoU"
		},
		{
			title: "AWS re:Invent 2023 - Enabling financial freedom with generative AI (IMP106)",
			url: "https://www.youtube.com/watch?v=GJUjLzo56mI"
		},
		{
			title: "AWS re:Invent 2023 - Building and optimizing a data lake on Amazon S3 (STG313)",
			url: "https://www.youtube.com/watch?v=mpQa_Zm1xW8"
		},
		{
			title: "AWS re:Invent 2023 - Accelerate secure data migrations at scale with AWS DataSync (STG222)",
			url: "https://www.youtube.com/watch?v=UBTcPSboMfk"
		},
		{
			title: "AWS re:Invent 2023 - Achieving Amazon S3 data lake resilience at LexisNexis (STG101)",
			url: "https://www.youtube.com/watch?v=Sx20jRaZ1tk"
		},
		{
			title: "AWS re:Invent 2023 - Sheer driving pleasure: Automated driving for BMW’s Neue Klasse (PRT202)",
			url: "https://www.youtube.com/watch?v=RzCp7HnC5Xs"
		},
		{
			title: "AWS re:Invent 2023 - How to use generative AI to deliver self-service data products (HYB105)",
			url: "https://www.youtube.com/watch?v=0VBGiVLOC50"
		},
		{
			title: "AWS re:Invent 2023 - Rethinking your data stack: The future of AI apps and vector databases (DAT103)",
			url: "https://www.youtube.com/watch?v=7duT5-hPL5A"
		},
		{
			title: "AWS re:Invent 2023 - Building your green future today: Unlocking secrets to sustainability (COP229)",
			url: "https://www.youtube.com/watch?v=75eE93l25iw"
		},
		{
			title: "AWS re:Invent 2023 - Secure Kubernetes data management and scaling with Kasten K10 (CON204)",
			url: "https://www.youtube.com/watch?v=6UOXXMd_U6Y"
		},
		{
			title: "AWS re:Invent 2023 - Deploy new workloads efficiently without additional investments (BIZ210)",
			url: "https://www.youtube.com/watch?v=wNiI_VCcvvs"
		},
		{
			title: "AWS re:Invent 2023 - Digitizing energy management for a sustainable future with Iberdrola (BIZ107)",
			url: "https://www.youtube.com/watch?v=ctXYN9zFVkY"
		},
		{
			title: "AWS re:Invent 2023 - How to build a platform for AI and analytics based on Apache Iceberg (ANT101)",
			url: "https://www.youtube.com/watch?v=rWGHG2PwgXU"
		},
		{
			title: "AWS re:Invent 2023 - Netflix's success: Combining collaboration, hardware monitoring & AI (AIM315)",
			url: "https://www.youtube.com/watch?v=4EOL8W0aEAo"
		},
		{
			title: "AWS re:Invent 2023 - DISH’s Smart 5G network: Cloud-native data streaming (AIM314)",
			url: "https://www.youtube.com/watch?v=zI5Ob2GuSb0"
		},
		{
			title: "AWS re:Invent 2023 - AI acceleration at the edge (AIM311)",
			url: "https://www.youtube.com/watch?v=N5t4_t4RprY"
		},
		{
			title: "AWS re:Invent 2023 - Transform customer experience with an array of AI agents (AIM254)",
			url: "https://www.youtube.com/watch?v=hfjSPr2Mj34"
		},
		{
			title: "AWS re:Invent 2023 - Accelerate generative AI development with integrated data platforms (AIM210)",
			url: "https://www.youtube.com/watch?v=eb6WlHaOCtI"
		},
		{
			title: "AWS re:Invent 2023 - Generative AI’s impact on software engineering team productivity (AIM207)",
			url: "https://www.youtube.com/watch?v=NKA1Gy2JlMQ"
		},
		{
			title: "AWS re:Invent 2023 - Implementing your AI strategy with PyTorch Lightning in the cloud (AIM112)",
			url: "https://www.youtube.com/watch?v=Zusnh2gnrro"
		},
		{
			title: "AWS re:Invent 2023 - Humans & AI: How builders can architect the future of work (AIM111)",
			url: "https://www.youtube.com/watch?v=XenrBrFz57A"
		},
		{
			title: "AWS re:Invent 2023 - Unlocking the power of AWS AI and data with Salesforce (AIM110)",
			url: "https://www.youtube.com/watch?v=E4FL67NMqjU"
		},
		{
			title: "AWS re:Invent 2023 - Scale and accelerate the impact of generative AI with watsonx (AIM108)",
			url: "https://www.youtube.com/watch?v=7aGK4puGEBA"
		},
		{
			title: "AWS re:Invent 2023 - How the NY Giants use Teradata to personalize fan experiences (AIM106)",
			url: "https://www.youtube.com/watch?v=bq79X0H0c48"
		},
		{
			title: "AWS re:Invent 2023 - Best practices for serverless developers (SVS401)",
			url: "https://www.youtube.com/watch?v=sdCA0Y7QDrM"
		},
		{
			title: "AWS re:Invent 2023 - Advancing equity: The intersection of government, enterprise, and tech (WPS101)",
			url: "https://www.youtube.com/watch?v=5kpU5fhGGv0"
		},
		{
			title: "AWS re:Invent 2023 - Benchmarking your SaaS business on AWS (PEX205)",
			url: "https://www.youtube.com/watch?v=iaIvn2bn_Ak"
		},
		{
			title: "AWS re:Invent 2023 - Scale faster with AWS Specialization Partners (PEX125)",
			url: "https://www.youtube.com/watch?v=97PvIOsPLWA"
		},
		{
			title: "AWS re:Invent 2023 - Learn how to grow your AWS business through AWS Partner Funding (PEX122)",
			url: "https://www.youtube.com/watch?v=fP6vC9pMyws"
		},
		{
			title: "AWS re:Invent 2023 - Co-selling with AWS and the APN Customer Engagements (ACE) program (PEX117)",
			url: "https://www.youtube.com/watch?v=echIX-J6pFE"
		},
		{
			title: "AWS re:Invent 2023 - Accelerate the AWS Partner journey with self-guided experience (PEX111)",
			url: "https://www.youtube.com/watch?v=W7_J_WrpByA"
		},
		{
			title: "AWS re:Invent 2023 - Amazon VPC Lattice architecture patterns and best practices (NET326)",
			url: "https://www.youtube.com/watch?v=zQk9AIPVdXs"
		},
		{
			title: "AWS re:Invent 2023 - Discord communities: Empowering growth through engagement (IDE206)",
			url: "https://www.youtube.com/watch?v=eHa3GiI73Uk"
		},
		{
			title: "AWS re:Invent 2023 - TimeGPT: Generative AI for time series (IDE204)",
			url: "https://www.youtube.com/watch?v=5pYkT0rTCfE"
		},
		{
			title: "AWS re:Invent 2023 - Inclusive design thinking in tech: Fostering innovation for all (IDE202)",
			url: "https://www.youtube.com/watch?v=ROmpPl28vw8"
		},
		{
			title: "AWS re:Invent 2023 - Plug and play with AI sign language recognition (IDE105)",
			url: "https://www.youtube.com/watch?v=A8O8GZxWRyw"
		},
		{
			title: "AWS re:Invent 2023 - Breaking barriers: A Latina founder’s story (IDE103)",
			url: "https://www.youtube.com/watch?v=VG6oUlP-kJY"
		},
		{
			title: "AWS re:Invent 2023 - [LAUNCH] Deep dive on Amazon S3 Express One Zone storage class (STG230)",
			url: "https://www.youtube.com/watch?v=TJp4ayDC8m0"
		},
		{
			title: "AWS re:Invent 2023 - Managing your commercial Linux workloads on Amazon EC2 (ENT218)",
			url: "https://www.youtube.com/watch?v=GTxVq9InK7w"
		},
		{
			title: "AWS re:Invent 2023 - Simplify building applications with AWS SDKs (DOP220)",
			url: "https://www.youtube.com/watch?v=7J0UMAGgAdw"
		},
		{
			title: "AWS re:Invent 2023 - Advanced data modeling with Amazon DynamoDB (DAT410)",
			url: "https://www.youtube.com/watch?v=PVUofrFiS_A"
		},
		{
			title: "AWS re:Invent 2023 - Deep dive into Amazon Aurora and its innovations (DAT408)",
			url: "https://www.youtube.com/watch?v=je6GCOZ22lI"
		},
		{
			title: "AWS re:Invent 2023 - Improving user experience at Epic Games using Amazon Timestream (DAT334)",
			url: "https://www.youtube.com/watch?v=atzJdwPdU5I"
		},
		{
			title: "AWS re:Invent 2023 - Building highly resilient applications with Amazon DynamoDB (DAT333)",
			url: "https://www.youtube.com/watch?v=ZrFb4PMNGjM"
		},
		{
			title: "AWS re:Invent 2023 - Securing Kubernetes workloads in Amazon EKS (CON335)",
			url: "https://www.youtube.com/watch?v=iyMcOpXRVWk"
		},
		{
			title: "AWS re:Invent 2023 - Securing containerized workloads on Amazon ECS and AWS Fargate (CON325)",
			url: "https://www.youtube.com/watch?v=RLWuoAHSdis"
		},
		{
			title: "AWS re:Invent 2023 - Reducing TCO and downtime by migrating to AWS Fargate (CON322)",
			url: "https://www.youtube.com/watch?v=XzX1LJZWtbc"
		},
		{
			title: "AWS re:Invent 2023 - Building for the future with AWS serverless services (CON320)",
			url: "https://www.youtube.com/watch?v=kxvVDFFiXj8"
		},
		{
			title: "AWS re:Invent 2023 - Best practices for container observability (COP319)",
			url: "https://www.youtube.com/watch?v=obvOzws2EOE"
		},
		{
			title: "AWS re:Invent 2023 - Buy with Prime: Exploring possibilities with Amazon Bedrock (BWP303)",
			url: "https://www.youtube.com/watch?v=_ELK0JxDw5A"
		},
		{
			title: "AWS re:Invent 2023 - Uncover insights & optimize workforce performance with Amazon Connect (BIZ219)",
			url: "https://www.youtube.com/watch?v=8ntdM9MlQLw"
		},
		{
			title: "AWS re:Invent 2023 - SaaS application innovation using AI to improve employee productivity (BIZ109)",
			url: "https://www.youtube.com/watch?v=vOppG7II5S0"
		},
		{
			title: "AWS re:Invent 2023 - Generative AI: Architectures and applications in depth (BOA308)",
			url: "https://www.youtube.com/watch?v=aEA6X_IElpc"
		},
		{
			title: "AWS re:Invent 2023 - Unlocking scalable digital asset custody applications on AWS (BLC103)",
			url: "https://www.youtube.com/watch?v=QH21ZrXX51c"
		},
		{
			title: "AWS re:Invent 2023 - Find, try, configure, and launch SaaS applications in AWS Marketplace (MKT205)",
			url: "https://www.youtube.com/watch?v=nCbSAWKkKwM"
		},
		{
			title: "AWS re:Invent 2023 - Assess vendor risk in AWS Marketplace for SaaS-based solutions (MKT204)",
			url: "https://www.youtube.com/watch?v=cXRjX7NPfj4"
		},
		{
			title: "AWS re:Invent 2023 - Expand your customer engagement with new Amazon Connect channels (BIZ223)",
			url: "https://www.youtube.com/watch?v=7Jl01ChVlEk"
		},
		{
			title: "AWS re:Invent 2023 - How organizations secure applications with AWS & Palo Alto Networks (HYB205)",
			url: "https://www.youtube.com/watch?v=71rCge6our8"
		},
		{
			title: "AWS re:Invent 2023 - Using technology to turn micro-volunteering into a macro impact (IDE109)",
			url: "https://www.youtube.com/watch?v=M8U43bDt4t0"
		},
		{
			title: "AWS re:Invent 2023 - Building a precision medicine platform using AWS HealthOmics (HLC305)",
			url: "https://www.youtube.com/watch?v=-DMYmdYCfGw"
		},
		{
			title: "AWS re:Invent 2023 - Enabling hypergrowth in your business (SMB212)",
			url: "https://www.youtube.com/watch?v=mrKv2b6jxa0"
		},
		{
			title: "AWS re:Invent 2023 - Production RAG apps made easier with Astra (AIM405)",
			url: "https://www.youtube.com/watch?v=AlZ8w3yYbRA"
		},
		{
			title: "AWS re:Invent 2023 - Building hybrid network connectivity with AWS (TNC217)",
			url: "https://www.youtube.com/watch?v=Fi4me2vPwrQ"
		},
		{
			title: "AWS re:Invent 2023 - The healthcare evolution: Modernize systems for operational excellence (ANT107)",
			url: "https://www.youtube.com/watch?v=qL6jkU9_wyU"
		},
		{
			title: "AWS re:Invent 2023 - The common denominator of successful transformation (INO107)",
			url: "https://www.youtube.com/watch?v=TB_cuwfGDzI"
		},
		{
			title: "AWS re:Invent 2023 - Building digital resilience with unified security and observability (COP215)",
			url: "https://www.youtube.com/watch?v=BcVGXMUzZ90"
		},
		{
			title: "AWS re:Invent 2023 - Architecting a security data lake at enterprise scale (SEC228)",
			url: "https://www.youtube.com/watch?v=g_zbRDK5zbs"
		},
		{
			title: "AWS re:Invent 2023 - Generative AI: From individual use to enterprise application [German] (GBL201)",
			url: "https://www.youtube.com/watch?v=VU1k9T-PtL4"
		},
		{
			title: "AWS re:Invent 2023 - What’s new with AWS cost optimization (COP204)",
			url: "https://www.youtube.com/watch?v=EOUTf2Dxo0Y"
		},
		{
			title: "AWS re:Invent 2023 - How to scale at speed on AWS while addressing security and compliance (GBL205)",
			url: "https://www.youtube.com/watch?v=WljJ-sBQLS8"
		},
		{
			title: "AWS re:Invent 2023 - How to use Amazon Verified Permissions for authorization inside apps (SEC241)",
			url: "https://www.youtube.com/watch?v=ptzb-oBwjxM"
		},
		{
			title: "AWS re:Invent 2023 - Supercharge your business applications with Amazon ECS (CON205)",
			url: "https://www.youtube.com/watch?v=EqE9LXE3_L0"
		},
		{
			title: "AWS re:Invent 2023 - Accelerate your Kubernetes journey with Amazon EKS (CON206)",
			url: "https://www.youtube.com/watch?v=HYG3B0Hw1sQ"
		},
		{
			title: "AWS re:Invent 2023 - NextEra Energy & AWS: Renewable energy innovation & grid modernization (ENU203)",
			url: "https://www.youtube.com/watch?v=hRBv7SkKfQE"
		},
		{
			title: "AWS re:Invent 2023 - Building mission-critical applications with CockroachDB (ARC101)",
			url: "https://www.youtube.com/watch?v=xUHwdYErPRw"
		},
		{
			title: "AWS re:Invent 2023 - Protect critical data with ease using Amazon EBS snapshots (STG205)",
			url: "https://www.youtube.com/watch?v=8MHVBzli0Lg"
		},
		{
			title: "AWS re:Invent 2023 - Advanced AWS CDK: Lessons learned from 4 years of use  (COM302)",
			url: "https://www.youtube.com/watch?v=Wzawix9bMAE"
		},
		{
			title: "AWS re:Invent 2023 - Centralizing automation to drive business value: A real-world story (COP102)",
			url: "https://www.youtube.com/watch?v=nII-I7XS-sA"
		},
		{
			title: "AWS re:Invent 2023 - Accelerating the migration of large-scale SAP systems to AWS (ENT210)",
			url: "https://www.youtube.com/watch?v=bKjNjL0ZKJg"
		},
		{
			title: "AWS re:Invent 2023 - Experience a simulated ransomware event: Learn now to prevail later (SEC104)",
			url: "https://www.youtube.com/watch?v=wVq8ICIPv7M"
		},
		{
			title: "AWS re:Invent 2023 - Accelerate innovation with AWS and AWS Partner solutions for telcos (TLC202)",
			url: "https://www.youtube.com/watch?v=hbWiHEp5vdU"
		},
		{
			title: "AWS re:Invent 2023 - Amazon Linux 2023 and beyond (CMP336)",
			url: "https://www.youtube.com/watch?v=VRqazCsTbZk"
		},
		{
			title: "AWS re:Invent 2023 - Interactive cost reporting with Amazon QuickSight (BSI207)",
			url: "https://www.youtube.com/watch?v=Z8T149nP5cg"
		},
		{
			title: "AWS re:Invent 2023 - Northvolt’s software-defined factories (MFG202)",
			url: "https://www.youtube.com/watch?v=ojHIYr9EAxk"
		},
		{
			title: "AWS re:Invent 2023 - How to build a responsible and sustainable generative AI chatbot (IMP103)",
			url: "https://www.youtube.com/watch?v=85smQWgPaKc"
		},
		{
			title: "AWS re:Invent 2023 - Democratize ML with no code/low code using Amazon SageMaker Canvas (AIM217)",
			url: "https://www.youtube.com/watch?v=GBIkeMemh2E"
		},
		{
			title: "AWS re:Invent 2023 - Using zonal autoshift to automatically recover from an AZ impairment (ARC309)",
			url: "https://www.youtube.com/watch?v=_0F-wdwiqZo"
		},
		{
			title: "AWS re:Invent 2023 - Best practices for creating multi-Region architectures on AWS (ARC308)",
			url: "https://www.youtube.com/watch?v=_vGlnzPZigU"
		},
		{
			title: "AWS re:Invent 2023 - Do modern cloud applications lock you in? (ARC307)",
			url: "https://www.youtube.com/watch?v=jykSBmnAM2I"
		},
		{
			title: "AWS re:Invent 2023 - Advanced integration patterns & trade-offs for loosely coupled systems (API309)",
			url: "https://www.youtube.com/watch?v=FGKGdUiZKto"
		},
		{
			title: "AWS re:Invent 2023 - How Rivian builds real-time analytics from electric vehicles (ANT317)",
			url: "https://www.youtube.com/watch?v=io5w08-WKHI"
		},
		{
			title: "AWS re:Invent 2023 - What’s new with Amazon EMR and Amazon Athena (ANT204)",
			url: "https://www.youtube.com/watch?v=Fn6MJBlSGr8"
		},
		{
			title: "AWS re:Invent 2023 - What’s new in Amazon Redshift (ANT203)",
			url: "https://www.youtube.com/watch?v=9ICZiI6xOCo"
		},
		{
			title: "AWS re:Invent 2023 - What’s new in Amazon DataZone (ANT202)",
			url: "https://www.youtube.com/watch?v=B-zZLWQcMek"
		},
		{
			title: "AWS re:Invent 2023 - Test automation for .NET applications running on AWS (XNT308)",
			url: "https://www.youtube.com/watch?v=-apwtOMItZ4"
		},
		{
			title: "AWS re:Invent 2023 - What’s new for web & mobile app developers with AWS Amplify (FWM306)",
			url: "https://www.youtube.com/watch?v=xf8cuOC-Sv4"
		},
		{
			title: "AWS re:Invent 2023 - How Fetch built world-class ML models to power their business (SEG301)",
			url: "https://www.youtube.com/watch?v=S0rltBHGMjw"
		},
		{
			title: "AWS re:Invent 2023 - Modernize application workloads using Red Hat OpenShift Service on AWS (BIZ208)",
			url: "https://www.youtube.com/watch?v=6FMLy17mauA"
		},
		{
			title: "AWS re:Invent 2023 - What developers want from internal developer portals (DOP215)",
			url: "https://www.youtube.com/watch?v=8okUksfbBN0"
		},
		{
			title: "AWS re:Invent 2023 - Accelerate experiment design with Amazon Bedrock (DOP217)",
			url: "https://www.youtube.com/watch?v=We8RdqOwubM"
		},
		{
			title: "AWS re:Invent 2023 - Feature management: De-risking migrations and releases for PowerSchool (ENT106)",
			url: "https://www.youtube.com/watch?v=uVemIQFPtvA"
		},
		{
			title: "AWS re:Invent 2023 - Cyber risk management: Bringing security to the boardroom (SEC204)",
			url: "https://www.youtube.com/watch?v=M-5ggg69Uf8"
		},
		{
			title: "AWS re:Invent 2023 - Zero Trust access with zero waiting, zero pain, and zero compromises (SEC329)",
			url: "https://www.youtube.com/watch?v=0fkFj5XVnpY"
		},
		{
			title: "AWS re:Invent 2023 - Creating new analytics in sports (SPT201)",
			url: "https://www.youtube.com/watch?v=NyvDuuT7CvQ"
		},
		{
			title: "AWS re:Invent 2023 - Best practices for moving data to AWS using online and offline methods (STG206)",
			url: "https://www.youtube.com/watch?v=2gShOOk9WJ4"
		},
		{
			title: "AWS re:Invent 2023 - Network-attached storage in the cloud with Amazon FSx (STG209)",
			url: "https://www.youtube.com/watch?v=y442aGhtkxg"
		},
		{
			title: "AWS re:Invent 2023 - Accelerate generative AI and ML workloads with AWS storage (STG212)",
			url: "https://www.youtube.com/watch?v=QOeYpSFJf7s"
		},
		{
			title: "AWS re:Invent 2023 - Accelerate ML and HPC with high performance file storage (STG340)",
			url: "https://www.youtube.com/watch?v=HobhSjs3zbw"
		},
		{
			title: "AWS re:Invent 2023 - Putting your data to work with generative AI | AIM250-INT",
			url: "https://www.youtube.com/watch?v=9pXpoxf_los"
		},
		{
			title: "AWS re:Invent 2023 - Using data to prevent heart disease and sudden cardiac death (IMP208)",
			url: "https://www.youtube.com/watch?v=HiCPFEDWqUk"
		},
		{
			title: "AWS re:Invent 2023 - Analyzing streaming data with Apache Druid (ANT213)",
			url: "https://www.youtube.com/watch?v=JA0Kv34QkkU"
		},
		{
			title: "AWS re:Invent 2023 - Transform data investigation via Elasticsearch Query Language (ES|QL) (AIM233)",
			url: "https://www.youtube.com/watch?v=BYyiSjG_a6c"
		},
		{
			title: "AWS re:Invent 2023 - How a 0-day event galvanized a developer-led security mindset at DISH (AIM237)",
			url: "https://www.youtube.com/watch?v=s6IDa1z36mw"
		},
		{
			title: "AWS re:Invent 2023 - Avoiding 5 missteps that undermine your AI readiness and success (AIM231)",
			url: "https://www.youtube.com/watch?v=Ak3muiIeIuw"
		},
		{
			title: "AWS re:Invent 2023 - Data readiness for deriving business insight with analytics and AI/ML (SMB206)",
			url: "https://www.youtube.com/watch?v=iRgtxePTZek"
		},
		{
			title: "AWS re:Invent 2023 - SaaS anywhere: Designing distributed multi-tenant architectures (SAS308)",
			url: "https://www.youtube.com/watch?v=jwWku2TAtvg"
		},
		{
			title: "AWS re:Invent 2023 - Scaling the platform that issues 70% of US mortgage securities (WPS210)",
			url: "https://www.youtube.com/watch?v=epJ1FgOPT2E"
		},
		{
			title: "AWS re:Invent 2023 - Accelerate your AWS growth with small and medium business customers (PEX112)",
			url: "https://www.youtube.com/watch?v=4t6xAEizLrw"
		},
		{
			title: "AWS re:Invent 2023 - Migration and modernization: Become your customer’s strategic partner (PEX101)",
			url: "https://www.youtube.com/watch?v=AVb7pY_LFJk"
		},
		{
			title: "AWS re:Invent 2023 - What can networking do for your application? (NET203)",
			url: "https://www.youtube.com/watch?v=tUh26i8uY9Q"
		},
		{
			title: "AWS re:Invent 2023 - Reimagining live, in-person experiences with the cloud (MAE102)",
			url: "https://www.youtube.com/watch?v=alAMPJUUzE4"
		},
		{
			title: "AWS re:Invent 2023 - Product innovation and customer engagement with Ferrari and Autodesk (MFG106)",
			url: "https://www.youtube.com/watch?v=p_JNYhQ3IkM"
		},
		{
			title: "AWS re:Invent 2023 - Accelerating life sciences innovation with generative AI on AWS (LFS202)",
			url: "https://www.youtube.com/watch?v=ItkLK2Ki-So"
		},
		{
			title: "AWS re:Invent 2023 - Innovate and modernize connected vehicle platforms with AWS IoT (IOT204)",
			url: "https://www.youtube.com/watch?v=WAL_AIkj-NY"
		},
		{
			title: "AWS re:Invent 2023 - Building AI for all: LGBTQIA+ perspectives (IDE205)",
			url: "https://www.youtube.com/watch?v=FXKtWBWufSA"
		},
		{
			title: "AWS re:Invent 2023 - Accelerate shop floor digitization with edge-to-cloud data integration (IOT215)",
			url: "https://www.youtube.com/watch?v=cJ4dSAUsTKg"
		},
		{
			title: "AWS re:Invent 2023 - Bring the power of generative AI to your employees with Amazon Q (AIM240)",
			url: "https://www.youtube.com/watch?v=VVz6tNUYInY"
		},
		{
			title: "AWS re:Invent 2023 - Save money & increase value using the CFM Capability Assessment (GDS102)",
			url: "https://www.youtube.com/watch?v=jHmAhMeHnXQ"
		},
		{
			title: "AWS re:Invent 2023 - Scaling a multiplayer game into the millions with Mortal Kombat 1 (GAM307)",
			url: "https://www.youtube.com/watch?v=d1YqINr8s2o"
		},
		{
			title: "AWS re:Invent 2023 - Exiting the data center: A League of Legends and VALORANT story (GAM304)",
			url: "https://www.youtube.com/watch?v=8nX5bRsAYv0"
		},
		{
			title: "AWS re:Invent 2023 - What’s new with AWS AppSync for enterprise API developers (FWM201)",
			url: "https://www.youtube.com/watch?v=-v-R9xP9aRQ"
		},
		{
			title: "AWS re:Invent 2023 - JPMorgan Chase: One data platform for reporting, analytics, and ML (FSI317)",
			url: "https://www.youtube.com/watch?v=_DVah7lhyHA"
		},
		{
			title: "AWS re:Invent 2023 - Why industry leaders choose AWS for RISE with SAP (ENT225)",
			url: "https://www.youtube.com/watch?v=Vtu7qrTwy2U"
		},
		{
			title: "AWS re:Invent 2023 - Use AWS data lakes and RISE with SAP to transform business processes (ENT224)",
			url: "https://www.youtube.com/watch?v=ElB9Ey3deUU"
		},
		{
			title: "AWS re:Invent 2023 - From hydrocarbons to green molecules: Cepsa’s transformation using AWS (ENU309)",
			url: "https://www.youtube.com/watch?v=ZGcb4vQxKA8"
		},
		{
			title: "AWS re:Invent 2023 - Governance and security with infrastructure as code (DOP209)",
			url: "https://www.youtube.com/watch?v=8dT7F7tS2rQ"
		},
		{
			title: "AWS re:Invent 2023 - Migrating to AWS Graviton with AWS container services (CMP404)",
			url: "https://www.youtube.com/watch?v=9JZVomrx6uQ"
		},
		{
			title: "AWS re:Invent 2023 - Operating with AWS open source observability (COP332)",
			url: "https://www.youtube.com/watch?v=ziyTvW_jkxI"
		},
		{
			title: "AWS re:Invent 2023 - How to manage applications at scale and innovate faster with AWS (COP328)",
			url: "https://www.youtube.com/watch?v=E7h62PdfNGc"
		},
		{
			title: "AWS re:Invent 2023 - Get actionable insights from Amazon CloudWatch Logs (COP326)",
			url: "https://www.youtube.com/watch?v=aB5mGbiV_Kk"
		},
		{
			title: "AWS re:Invent 2023 - Centralize hybrid & multicloud management with AWS (COP324)",
			url: "https://www.youtube.com/watch?v=D90CbElOQ5g"
		},
		{
			title: "AWS re:Invent 2023 - Implementing application observability (COP322)",
			url: "https://www.youtube.com/watch?v=IcTcwUSwIs4"
		},
		{
			title: "AWS re:Invent 2023 - Centralize your operations (COP320)",
			url: "https://www.youtube.com/watch?v=9-RBjmhDdaM"
		},
		{
			title: "AWS re:Invent 2023 - Construct your constructs: Use AWS CDK to create architecture at scale (BWP302)",
			url: "https://www.youtube.com/watch?v=ugtsm3Z3VgU"
		},
		{
			title: "AWS re:Invent 2023 - SaaS operations in action: Buy with Prime (BWP301)",
			url: "https://www.youtube.com/watch?v=ZMdw6DLIWtE"
		},
		{
			title: "AWS re:Invent 2023 - Enhance your applications with Amazon QuickSight embedded analytics (BSI203)",
			url: "https://www.youtube.com/watch?v=URbOcuLNh8c"
		},
		{
			title: "AWS re:Invent 2023 - Generative BI in Amazon QuickSight (BSI101)",
			url: "https://www.youtube.com/watch?v=y4Fp18lK-bU"
		},
		{
			title: "AWS re:Invent 2023 - How DISH scaled contact center and agent success with Amazon Connect (BIZ217)",
			url: "https://www.youtube.com/watch?v=IqabsxHV7BU"
		},
		{
			title: "AWS re:Invent 2023 - What’s next in contact centers with Amazon Connect and generative AI (BIZ216)",
			url: "https://www.youtube.com/watch?v=QRLFwTNS4DY"
		},
		{
			title: "AWS re:Invent 2023 - How generative AI features of AWS AppFabric help SaaS app developers (BIZ112)",
			url: "https://www.youtube.com/watch?v=7xV-OIO_RCE"
		},
		{
			title: "AWS re:Invent 2023 - How the U.S. Army uses AWS Wickr to deliver lifesaving telemedicine (BIZ103)",
			url: "https://www.youtube.com/watch?v=yYCTLr9YqO8"
		},
		{
			title: "AWS re:Invent 2023 - Implementing distributed design patterns on AWS (BOA309)",
			url: "https://www.youtube.com/watch?v=pfAlmkzyaJQ"
		},
		{
			title: "AWS re:Invent 2023 - McDonald’s path to secure operational excellence on AWS (SUP203)",
			url: "https://www.youtube.com/watch?v=-0SlmCSNYCs"
		},
		{
			title: "AWS re:Invent 2023 - AWS solutions to accelerate customer-led migrations (SUP202)",
			url: "https://www.youtube.com/watch?v=4MaRtcpDTSk"
		},
		{
			title: "AWS re:Invent 2023 - AWS Marketplace helps government agencies meet accessibility mandates (MKT203)",
			url: "https://www.youtube.com/watch?v=9sSHczHYsa4"
		},
		{
			title: "AWS re:Invent 2023 - Deploy FMs on Amazon SageMaker for price performance (AIM330)",
			url: "https://www.youtube.com/watch?v=T2c7RaWVBJg"
		},
		{
			title: "AWS re:Invent 2023 - Large model training on AWS Deep Learning AMIs & PyTorch, ft. Pinterest -AIM326",
			url: "https://www.youtube.com/watch?v=wM0iSWAzyhI"
		},
		{
			title: "AWS re:Invent 2023 - Resilient architectures at scale: Real-world use cases from Amazon.com (ARC305)",
			url: "https://www.youtube.com/watch?v=fQgaR-iQrTY"
		},
		{
			title: "AWS re:Invent 2023 - Bringing workloads together with event-driven architecture (API206)",
			url: "https://www.youtube.com/watch?v=NOlz2jlOVBo"
		},
		{
			title: "AWS re:Invent 2023 - Smarter, faster analytics with generative AI & ML (ANT323)",
			url: "https://www.youtube.com/watch?v=3WiSgXshOc4"
		},
		{
			title: "AWS re:Invent 2023 - Accelerate innovation with end-to-end serverless data architecture (ANT318)",
			url: "https://www.youtube.com/watch?v=da17LS31Yj0"
		},
		{
			title: "AWS re:Invent 2023 - How Amazon.com enhanced shopping with gen AI and foundation models (AMZ301)",
			url: "https://www.youtube.com/watch?v=BNHa1LrXhPM"
		},
		{
			title: "AWS re:Invent 2023 - Use edge computing to easily manage software on aircraft fleets (AES207)",
			url: "https://www.youtube.com/watch?v=H7eUtukGVNg"
		},
		{
			title: "AWS re:Invent 2023 - Delivering EO data at scale with AWS serverless & edge compute (AES204)",
			url: "https://www.youtube.com/watch?v=I9zll-ixWjU"
		},
		{
			title: "AWS re:Invent 2023 - Alteia, World Bank, and AWS assess road infrastructure at scale (AES202)",
			url: "https://www.youtube.com/watch?v=jmX--puCJXU"
		},
		{
			title: "AWS re:Invent 2023 - Use AWS generative AI and machine learning with Salesforce Data Cloud (ADM202)",
			url: "https://www.youtube.com/watch?v=FEOnOM1eq6g"
		},
		{
			title: "AWS re:Invent 2023 - Elevate your data and AI governance with Databricks Data Intelligence Platform",
			url: "https://www.youtube.com/watch?v=OPCg9C6Rdyw"
		},
		{
			title: "AWS re:Invent 2023 - Evolve your web application delivery with Amazon CloudFront (NET322)",
			url: "https://www.youtube.com/watch?v=iarHEfav9NM"
		},
		{
			title: "AWS re:Invent 2023 - Unlock insights on Amazon RDS data with zero-ETL to Amazon Redshift (DAT341)",
			url: "https://www.youtube.com/watch?v=cGyRuUnPzFI"
		},
		{
			title: "AWS re:Invent 2023 - How to choose the right block storage for your workload (CMP202)",
			url: "https://www.youtube.com/watch?v=ge44Wqb1HEY"
		},
		{
			title: "AWS re:Invent 2023 - How regulated financial institutions drive adoption of digital assets (BLC102)",
			url: "https://www.youtube.com/watch?v=lDZ9Be2J8NI"
		},
		{
			title: "AWS re:Invent 2023 - Choosing the right generative AI use case (AIM212)",
			url: "https://www.youtube.com/watch?v=b5k0YkQwV90"
		},
		{
			title: "AWS re:Invent 2023 - Infuse customer obsession into your business strategy: Client panel (CEN201)",
			url: "https://www.youtube.com/watch?v=p09Nus6aJH8"
		},
		{
			title: "AWS re:Invent 2023 - Building observability to increase resiliency (COP343)",
			url: "https://www.youtube.com/watch?v=6bJkYtrMMPI"
		},
		{
			title: "AWS re:Invent 2023 - Scalable load balancing and security on AWS with HAProxy Fusion (SEC225)",
			url: "https://www.youtube.com/watch?v=qs1C-fiXiog"
		},
		{
			title: "AWS re:Invent 2023 - Working globally to build tech skills and talent pipelines (WPS104)",
			url: "https://www.youtube.com/watch?v=RNau04dLkIQ"
		},
		{
			title: "AWS re:Invent 2023 - Realizing value with hybrid by design at USAA (HYB103)",
			url: "https://www.youtube.com/watch?v=UNfueCIlP7o"
		},
		{
			title: "AWS re:Invent 2023 - McDonald’s & AWS ProServe implement reusable & observable pipelines (PRO201)",
			url: "https://www.youtube.com/watch?v=V5LXtLGvo-8"
		},
		{
			title: "AWS re:Invent 2023 - Accelerate EDI data integration at scale with AWS B2B Data Interchange (STG216)",
			url: "https://www.youtube.com/watch?v=mAEDCV8FRL8"
		},
		{
			title: "AWS re:Invent 2023 - Accelerate innovation with real-time data (ANT201)",
			url: "https://www.youtube.com/watch?v=yqpFRWjilrU"
		},
		{
			title: "AWS re:Invent 2023 - The next generation of smart home solutions powered by AWS IoT (IOT207)",
			url: "https://www.youtube.com/watch?v=z0uqt0PgqNk"
		},
		{
			title: "AWS re:Invent 2023 - Navigating the growth frontiers of generative AI (AIM372)",
			url: "https://www.youtube.com/watch?v=nsJAXFQjgbk"
		},
		{
			title: "AWS re:Invent 2023 - Securely configure your AWS environments with CIS & Qualys (SEC229)",
			url: "https://www.youtube.com/watch?v=19_s7Z9I7zQ"
		},
		{
			title: "AWS re:Invent 2023 - S&P Global’s enterprise network exchange powered by Alkira’s NaaS (NET103)",
			url: "https://www.youtube.com/watch?v=Z0IbMlp5f9Y"
		},
		{
			title: "AWS re:Invent 2023 - Increasing mission impact with generative AI (IMP211)",
			url: "https://www.youtube.com/watch?v=o35ZQ-2cj5M"
		},
		{
			title: "AWS re:Invent 2023 - How to accelerate Apache Spark pipelines on Amazon EMR with RAPIDS (AIM313)",
			url: "https://www.youtube.com/watch?v=9zjusZ9dBCE"
		},
		{
			title: "AWS re:Invent 2023 - Securing the software supply chain with Docker Scout and Amazon ECR (SEC105)",
			url: "https://www.youtube.com/watch?v=VWNu7pvjG-c"
		},
		{
			title: "AWS re:Invent 2023 - The Frontend Cloud: Crafting superior web experiences (DOP218)",
			url: "https://www.youtube.com/watch?v=zdPVq4um0dE"
		},
		{
			title: "AWS re:Invent 2023 - Splunk Edge Hub for OT/IIoT data collection and edge computing (AIM230)",
			url: "https://www.youtube.com/watch?v=H6Qtyvey93k"
		},
		{
			title: "AWS re:Invent 2023 - Automate the modernization of legacy ETL to AWS Glue using LeapLogic (ENT328)",
			url: "https://www.youtube.com/watch?v=d3ASKKjNJD8"
		},
		{
			title: "AWS re:Invent 2023 - Power accessible solutions with gen AI & eye gaze direction detection (IDE207)",
			url: "https://www.youtube.com/watch?v=U29cRMZHRrY"
		},
		{
			title: "AWS re:Invent 2023 - Ericsson and HCLTech: Powering cloud transformation at speed and scale (COP216)",
			url: "https://www.youtube.com/watch?v=JPp6S8YGUC4"
		},
		{
			title: "AWS re:Invent 2023 - Reinventing energy and unlocking innovation through inclusion (ENU101)",
			url: "https://www.youtube.com/watch?v=HHrCpmXtNC4"
		},
		{
			title: "AWS re:Invent 2023 - Reducing EO data volume to optimize satellite operations (AES206)",
			url: "https://www.youtube.com/watch?v=kNTFzewB8GE"
		},
		{
			title: "AWS re:Invent 2023 - Accelerating innovation with high performance computing on AWS (MFG105)",
			url: "https://www.youtube.com/watch?v=JK5_s71zgN0"
		},
		{
			title: "AWS re:Invent 2023 - Discover how to amplify your AWS re:Invent experience (GBL202-CMN)",
			url: "https://www.youtube.com/watch?v=3ncm1F6VkZA"
		},
		{
			title: "AWS re:Invent 2023 - Compute innovations enabled by the AWS Nitro System (CMP309)",
			url: "https://www.youtube.com/watch?v=E4Oxx5J3FT8"
		},
		{
			title: "AWS re:Invent 2023 - Accelerating industrial transformation with IoT on AWS (IOT206)",
			url: "https://www.youtube.com/watch?v=BN_r2o-I5qY"
		},
		{
			title: "AWS re:Invent 2023 - Boost your productivity with AWS Toolkits and Amazon CodeWhisperer (XNT304)",
			url: "https://www.youtube.com/watch?v=23xghoCEe6M"
		},
		{
			title: "AWS re:Invent 2023 - Build verifiable and effective application authorization in 40 minutes (BOA209)",
			url: "https://www.youtube.com/watch?v=QowiJZk_I30"
		},
		{
			title: "AWS re:Invent 2023 - Getting the most performance for your .NET apps from AWS SDK for .NET (XNT401)",
			url: "https://www.youtube.com/watch?v=t3swORUjuBk"
		},
		{
			title: "AWS re:Invent 2023 - Improving your AWS cost reporting (COP203)",
			url: "https://www.youtube.com/watch?v=0aYZUqpwJKE"
		},
		{
			title: "AWS re:Invent 2023 - AWS Supply Chain: Helping Woodside Energy optimize their supply chain (BIZ105)",
			url: "https://www.youtube.com/watch?v=NQvYnUcTOdg"
		},
		{
			title: "AWS re:Invent 2023 - Reinvent your cloud strategy: Optimize performance & cut cloud costs (CON326)",
			url: "https://www.youtube.com/watch?v=LsQZsDWOaps"
		},
		{
			title: "AWS re:Invent 2023 - At the cutting edge: AI-driven sustainable digital telco & 5G networks (TLC302)",
			url: "https://www.youtube.com/watch?v=uG70n3vJLzc"
		},
		{
			title: "AWS re:Invent 2023 - Optimize SAP-based supply chains and improve sustainability with AI/ML (ENT226)",
			url: "https://www.youtube.com/watch?v=3Qowi4jAG2k"
		},
		{
			title: "AWS re:Invent 2023 - Responsible AI in the generative era: Science and practice (AIM220)",
			url: "https://www.youtube.com/watch?v=uRI0dllESko"
		},
		{
			title: "AWS re:Invent 2023 - NFL Next Gen Stats: Using AI/ML to transform fan engagement (PRO304)",
			url: "https://www.youtube.com/watch?v=HSAJ6kAVzXY"
		},
		{
			title: "AWS re:Invent 2023 - Introducing GuardDuty ECS Runtime Monitoring, including AWS Fargate (SEC239)",
			url: "https://www.youtube.com/watch?v=nuMOaQctNgE"
		},
		{
			title: "AWS re:Invent 2023 - Explore what’s possible with new AWS generative AI services (AIM101)",
			url: "https://www.youtube.com/watch?v=ukrqHEqwmTA"
		},
		{
			title: "AWS re:Invent 2023 - Accelerate data-driven circular economy initiatives with AWS (SUS202)",
			url: "https://www.youtube.com/watch?v=ivTJorpUTo0"
		},
		{
			title: "AWS re:Invent 2023 - What’s new with Amazon EC2 (CMP102)",
			url: "https://www.youtube.com/watch?v=mjHw_wgJJ5g"
		},
		{
			title: "AWS re:Invent 2023 - Topgolf mitigated migration risk & elevated uptime with LogicMonitor (COP221)",
			url: "https://www.youtube.com/watch?v=JWBIVbId9Cw"
		},
		{
			title: "AWS re:Invent 2023 - Transforming deployment: Deep dive into Backstage on AWS (OPN404)",
			url: "https://www.youtube.com/watch?v=fH6-iDtPrz8"
		},
		{
			title: "AWS re:Invent 2023 - Eni works with AWS to develop its collaborative geoscience platform (ENU202)",
			url: "https://www.youtube.com/watch?v=3E1S9wGFkmE"
		},
		{
			title: "AWS re:Invent 2023 - FinOps tips for optimizing your cloud infrastructure and data costs (COP224)",
			url: "https://www.youtube.com/watch?v=u_tHthuyQ-Q"
		},
		{
			title: "AWS re:Invent 2023 - CFM (FinOps) assessment: Building a roadmap for financial success (GDS104)",
			url: "https://www.youtube.com/watch?v=hViP_AODwgU"
		},
		{
			title: "AWS re:Invent 2023 - Saving on AWS? If not, what are you waiting for? (COP218)",
			url: "https://www.youtube.com/watch?v=XmqFfJrm4Mk"
		},
		{
			title: "AWS re:Invent 2023 - Fully managed Kong Gateway SaaS on Konnect and AWS, with live demo (DOP222)",
			url: "https://www.youtube.com/watch?v=NDvA0cfkEOs"
		},
		{
			title: "AWS re:Invent 2023 - Unify cloud security from code to runtime with CrowdStrike and Bionic (SEC212)",
			url: "https://www.youtube.com/watch?v=lFTIx-4OtkY"
		},
		{
			title: "AWS re:Invent 2023 - Self-service infrastructure is no longer a dream (DOP315)",
			url: "https://www.youtube.com/watch?v=ihm4YPg6lEM"
		},
		{
			title: "AWS re:Invent 2023 - Extending ThousandEyes visibility to the AWS network (NET102)",
			url: "https://www.youtube.com/watch?v=HKSwuOKpCy0"
		},
		{
			title: "AWS re:Invent 2023 - FinOps on AWS: Accelerated outcomes to maximize ROI (PRT201)",
			url: "https://www.youtube.com/watch?v=MSPhn3QD-ug"
		},
		{
			title: "AWS re:Invent 2023 - Get started with checksums in Amazon S3 for data integrity checking (STG350)",
			url: "https://www.youtube.com/watch?v=NNx9eZcbLnU"
		},
		{
			title: "AWS re:Invent 2023 - SMB financial services landscape: Top projects for impact (SMB207)",
			url: "https://www.youtube.com/watch?v=-dgTM-1LTkw"
		},
		{
			title: "AWS re:Invent 2023 - Using the AWS Generative AI Center of Excellence (COE) (PEX123)",
			url: "https://www.youtube.com/watch?v=Go2mtZ_mjUU"
		},
		{
			title: "AWS re:Invent 2023 - Drive efficiency at scale by choosing the right CloudOps partner (PEX108)",
			url: "https://www.youtube.com/watch?v=yMpN085Suwo"
		},
		{
			title: "AWS re:Invent 2023 - Digital transformation for FinServ organizations with Smarsh and AWS (PEN101)",
			url: "https://www.youtube.com/watch?v=6fe8agWnLJE"
		},
		{
			title: "AWS re:Invent 2023 - Public sector actionable insights: Grow through AWS Partner Programs (PEX124)",
			url: "https://www.youtube.com/watch?v=RNaWKTizAeA"
		},
		{
			title: "AWS re:Invent 2023 - Carrier case study: Abound, a connected building platform (IOT102)",
			url: "https://www.youtube.com/watch?v=d-kLMXhsGXY"
		},
		{
			title: "AWS re:Invent 2023 - Accelerating ISV growth in the AWS Partner Network (PEN103)",
			url: "https://www.youtube.com/watch?v=8Djlg6Dad2U"
		},
		{
			title: "AWS re:Invent 2023 - Migrations in action with VMware Cloud on AWS (ENT235)",
			url: "https://www.youtube.com/watch?v=ArqMqJrQBY4"
		},
		{
			title: "AWS re:Invent 2023 - Disruption demands democratization: Is your iPaaS ready? (HYB104)",
			url: "https://www.youtube.com/watch?v=KFhaouzZVp8"
		},
		{
			title: "AWS re:Invent 2023 - Generative BI in Amazon QuickSight (BSI103)",
			url: "https://www.youtube.com/watch?v=GolPlpZ3-kI"
		},
		{
			title: "AWS re:Invent 2023 - Simplifying cost-optimized cyber response & recovery at massive scale (STG104)",
			url: "https://www.youtube.com/watch?v=jGL5Jk-gZj0"
		},
		{
			title: "AWS re:Invent 2023 - Improve outreach with cost-effective contact center solutions (IMP104)",
			url: "https://www.youtube.com/watch?v=CJBM4284Qbg"
		},
		{
			title: "AWS re:Invent 2023 - Building scalable IoT systems with MQTT and AWS (IOT214)",
			url: "https://www.youtube.com/watch?v=KT3UQYVfbVE"
		},
		{
			title: "AWS re:Invent 2023 - Delivering ML-driven campaigns with RudderStack and Amazon Redshift (ANT221)",
			url: "https://www.youtube.com/watch?v=0hU29yujW9s"
		},
		{
			title: "AWS re:Invent 2023 - Learn about AWS Cyber Insurance Partners (PEX121)",
			url: "https://www.youtube.com/watch?v=lPyV8kTpBjk"
		},
		{
			title: "AWS re:Invent 2023 - Accelerating end-to-end supply chain transparency with AI/ML (SUS203)",
			url: "https://www.youtube.com/watch?v=TQ8ms2LcDg0"
		},
		{
			title: "AWS re:Invent 2023 - Designing & migrating an AWS-native mobility solution in an M&A setup (ENT104)",
			url: "https://www.youtube.com/watch?v=o8-J7HeghSQ"
		},
		{
			title: "AWS re:Invent 2023 - Simplify, optimize, and enhance AWS network management (COP220)",
			url: "https://www.youtube.com/watch?v=oAPiPmmwo4E"
		},
		{
			title: "AWS re:Invent 2023 - Streamlining security investigations with Amazon Security Lake (SEC234)",
			url: "https://www.youtube.com/watch?v=g5uIrAod910"
		},
		{
			title: "AWS re:Invent 2023 - Strategies for automated scaling, remediation, and smart self-healing (ENT107)",
			url: "https://www.youtube.com/watch?v=nlGyIa3UQYU"
		},
		{
			title: "AWS re:Invent 2023 - How Santander built a cloud-native trading platform at scale (FSI311)",
			url: "https://www.youtube.com/watch?v=2ROSAZ2ieoc"
		},
		{
			title: "AWS re:Invent 2023 - Get the most out of Splunk Security, OCSF, and Amazon Security Lake (ANT212)",
			url: "https://www.youtube.com/watch?v=APB48LOyTHA"
		},
		{
			title: "AWS re:Invent 2023 - Seamless observability with AWS Distro for OpenTelemetry (COM307)",
			url: "https://www.youtube.com/watch?v=S4GfA2R0N_A"
		},
		{
			title: "AWS re:Invent 2023 - How to create a serverless center of excellence (SVS214)",
			url: "https://www.youtube.com/watch?v=arPaSGXV0v4"
		},
		{
			title: "AWS re:Invent 2023 - Building a machine learning team and platform at Cash App (AIM228)",
			url: "https://www.youtube.com/watch?v=ZviVO81U_g4"
		},
		{
			title: "AWS re:Invent 2023 - Improve productivity by shifting more responsibility to developers (SVS309)",
			url: "https://www.youtube.com/watch?v=qlz15v-gHFI"
		},
		{
			title: "AWS re:Invent 2023 - Boost developer productivity with Amazon CodeWhisperer (DOP211)",
			url: "https://www.youtube.com/watch?v=Kvx3ksVFB-E"
		},
		{
			title: "AWS re:Invent 2023 - Manage resource lifecycle events at scale with AWS Health (SUP309)",
			url: "https://www.youtube.com/watch?v=VoLLNL5j9NA"
		},
		{
			title: "AWS re:Invent 2023 - Safeguarding infrastructure from DDoS attacks with AWS edge services (NET201)",
			url: "https://www.youtube.com/watch?v=KpAao6ox-cM"
		},
		{
			title: "AWS re:Invent 2023 - Optimize cost and performance and track progress toward mitigation (ARC319)",
			url: "https://www.youtube.com/watch?v=keAfy8f84E0"
		},
		{
			title: "AWS re:Invent 2023 - Ready for what’s next? Designing networks for growth and flexibility (NET310)",
			url: "https://www.youtube.com/watch?v=FkWOhTZSfdA"
		},
		{
			title: "AWS re:Invent 2023 - Customer Keynote Anthropic",
			url: "https://www.youtube.com/watch?v=YKMDw7ERxZ4"
		},
		{
			title: "AWS re:Invent 2023 - Deep dive into Amazon RDS and RDS Custom for Oracle and SQL Server (DAT345)",
			url: "https://www.youtube.com/watch?v=-LqCFL2zvEw"
		},
		{
			title: "AWS re:Invent 2023 - A new era: The path to generative AI in public sector (WPS206)",
			url: "https://www.youtube.com/watch?v=UPvJuNudICU"
		},
		{
			title: "AWS re:Invent 2023 - Generative AI: Asking for a friend (BOA210)",
			url: "https://www.youtube.com/watch?v=jbTOnOZkCA4"
		},
		{
			title: "AWS re:Invent 2023 - Improve web application performance using AWS Global Accelerator (NET327)",
			url: "https://www.youtube.com/watch?v=ecNDlRNWW3w"
		},
		{
			title: "AWS re:Invent 2023 - Atria Senior Living is empowering older adults with the power of voice (ALX101)",
			url: "https://www.youtube.com/watch?v=eMr3IG3u6Vg"
		},
		{
			title: "AWS re:Invent 2023 - Cognizant cognitive architecture for generative AI: The path to MVP (AIM102)",
			url: "https://www.youtube.com/watch?v=JSrfHsLPfnk"
		},
		{
			title: "AWS re:Invent 2023 - Strategies for navigating multicloud decisions and difficulties (ENT217)",
			url: "https://www.youtube.com/watch?v=Hu3HeUIQTFg"
		},
		{
			title: "AWS re:Invent 2023 - Zero to machine learning: Jump-start your data-driven journey (SMB204)",
			url: "https://www.youtube.com/watch?v=-CSrOKo8Qgs"
		},
		{
			title: "AWS re:Invent 2023 - How Siemens & Petco drive enterprise transformation with data & AI (ANT105)",
			url: "https://www.youtube.com/watch?v=QOqimElwlAU"
		},
		{
			title: "AWS re:Invent 2023 - Building generative AI–enriched applications with AWS & MongoDB Atlas (AIM221)",
			url: "https://www.youtube.com/watch?v=IEWXrv94InI"
		},
		{
			title: "AWS re:Invent 2023 - Scale your business and simplify operations with AWS Marketplace (PEX106)",
			url: "https://www.youtube.com/watch?v=Boz2Wlc7SGY"
		},
		{
			title: "AWS re:Invent 2023 - Conquer cloud challenges with a competitive edge for less with AMD (CMP104)",
			url: "https://www.youtube.com/watch?v=a3pT8BwSRbE"
		},
		{
			title: "AWS re:Invent 2023 - Amazon DynamoDB zero-ETL integration with Amazon OpenSearch Service (DAT339)",
			url: "https://www.youtube.com/watch?v=DOsQojGHXPo"
		},
		{
			title: "AWS re:Invent 2023 - Best practices for optimizing Kubernetes applications on AWS (DOP214)",
			url: "https://www.youtube.com/watch?v=QC10wATRJNo"
		},
		{
			title: "AWS re:Invent 2023 - Building a sustainable, competitive, and smart telco with AWS (TLC203)",
			url: "https://www.youtube.com/watch?v=CAsR-xQ1jHk"
		},
		{
			title: "AWS re:Invent 2023 - [LAUNCH]  Achieving scale with Amazon Aurora Limitless Database (DAT344)",
			url: "https://www.youtube.com/watch?v=a9FfjuVJ9d8"
		},
		{
			title: "AWS re:Invent 2023 - Magellan’s strategic cloud journey to drive operational insights (NTA209)",
			url: "https://www.youtube.com/watch?v=yY5yk91UFrk"
		},
		{
			title: "AWS re:Invent 2023 - Managing database roles with Active Directory and Heimdall Data (DAT205)",
			url: "https://www.youtube.com/watch?v=Lkh5bTWukWg"
		},
		{
			title: "AWS re:Invent 2023 - Solving large-scale data access challenges with Amazon S3 (STG337)",
			url: "https://www.youtube.com/watch?v=Ts-ZMBzGeh0"
		},
		{
			title: "AWS re:Invent 2023 - How the PGA Tour works with AWS to enhance fan engagement (SPT206)",
			url: "https://www.youtube.com/watch?v=0f8bbdR-icE"
		},
		{
			title: "AWS re:Invent 2023 - Unlock the power of IoT: Intro to NTT’s edge analytics platform (IOT104)",
			url: "https://www.youtube.com/watch?v=J4mM64OTQ8A"
		},
		{
			title: "AWS re:Invent 2023 - Collaborate across the cloud, Amazon Bedrock, gen AI, AWS DeepRacer (AIM359)",
			url: "https://www.youtube.com/watch?v=Q37bq0hk0cs"
		},
		{
			title: "AWS re:Invent 2023 - Teradata secures 100s of AWS workloads with Cisco Multicloud Defense (COP226)",
			url: "https://www.youtube.com/watch?v=URgIvQWAaHA"
		},
		{
			title: "AWS re:Invent 2023 - Building a life science data strategy for accelerating insights (LFS203)",
			url: "https://www.youtube.com/watch?v=z0V-gxk2vDQ"
		},
		{
			title: "AWS re:Invent 2023 - How to drive growth and create differentiated customer experiences (INO108)",
			url: "https://www.youtube.com/watch?v=w1rPJ94nQHM"
		},
		{
			title: "AWS re:Invent 2023 - Accelerate foundation model evaluation with Amazon SageMaker Clarify (AIM367)",
			url: "https://www.youtube.com/watch?v=9X2oDkOBYyA"
		},
		{
			title: "AWS re:Invent 2023 - Unleash your selling potential with AWS Marketplace (MKT104)",
			url: "https://www.youtube.com/watch?v=nrtpPG72o18"
		},
		{
			title: "AWS re:Invent 2023 - Explore text-generation FMs for top use cases with Amazon Bedrock (AIM333)",
			url: "https://www.youtube.com/watch?v=QoaFYmpXvak"
		},
		{
			title: "AWS re:Invent 2023 - A consistent approach to resilience analysis for critical workloads (ARC313)",
			url: "https://www.youtube.com/watch?v=fEOeP08cQdk"
		},
		{
			title: "AWS re:Invent 2023 - Schedule work with Amazon EventBridge Scheduler (API208)",
			url: "https://www.youtube.com/watch?v=ROEdJxToS9E"
		},
		{
			title: "AWS re:Invent 2023 - Enrich your .NET applications with AI capabilities (XNT305)",
			url: "https://www.youtube.com/watch?v=I5qdrbi72ho"
		},
		{
			title: "AWS re:Invent 2023 - Partner Keynote with Dr. Ruba Borno",
			url: "https://www.youtube.com/watch?v=mM2HMK3ufTo"
		},
		{
			title: "AWS re:Invent 2023 - [LAUNCH] Reserve GPU capacity with Amazon EC2 Capacity Blocks for ML (CMP105)",
			url: "https://www.youtube.com/watch?v=nyts2w90_6A"
		},
		{
			title: "AWS re:Invent 2023 - Generative AI for images with SageMaker JumpStart and AWS Marketplace (MKT308)",
			url: "https://www.youtube.com/watch?v=jOejhgr1_zM"
		},
		{
			title: "AWS re:Invent 2023 - Effective data monetization using modern data architecture (IMP210)",
			url: "https://www.youtube.com/watch?v=hnM_gAu5rl0"
		},
		{
			title: "AWS re:Invent 2023 - Hack your SaaS growth with AWS SaaS Factory (PEX118)",
			url: "https://www.youtube.com/watch?v=sS3b3hsgW9I"
		},
		{
			title: "AWS re:Invent 2023 - AI-powered scaling and optimization for Amazon Redshift Serverless (ANT354)",
			url: "https://www.youtube.com/watch?v=U3f2FObbvKc"
		},
		{
			title: "AWS re:Invent 2023 - Accelerate mission outcomes with no-code and low-code machine learning (IMP209)",
			url: "https://www.youtube.com/watch?v=gTh9Zf-iaNM"
		},
		{
			title: "AWS re:Invent 2023 - Live events: Moving on-premises broadcast workloads to the cloud (HYB106)",
			url: "https://www.youtube.com/watch?v=xXWAsg8iYO8"
		},
		{
			title: "AWS re:Invent 2023 - Building a multi-account, multi-runtime service-oriented architecture (DOP316)",
			url: "https://www.youtube.com/watch?v=nSFHlcWj8TY"
		},
		{
			title: "AWS re:Invent 2023 - How to make smarter connections to AWS & improve multicloud networking (HYB202)",
			url: "https://www.youtube.com/watch?v=cSDD_1mXu_A"
		},
		{
			title: "AWS re:Invent 2023 - Modernize your web applications and API services using AWS App Runner (NTA305)",
			url: "https://www.youtube.com/watch?v=4-zqJA3Akx8"
		},
		{
			title: "AWS re:Invent 2023 - Utilizing machine learning & vector databases for advanced AI search (BOA312)",
			url: "https://www.youtube.com/watch?v=CDFA2IXsodo"
		},
		{
			title: "AWS re:Invent 2023 - Sustainable security culture: Empower builders for success (SEC211)",
			url: "https://www.youtube.com/watch?v=FqJlomvyaFo"
		},
		{
			title: "AWS re:Invent 2023 - Deploying multi-tenant SaaS applications on Amazon ECS and AWS Fargate (CON313)",
			url: "https://www.youtube.com/watch?v=6a8SfEhyFyk"
		},
		{
			title: "AWS re:Invent 2023 - Modernize business reporting with Amazon QuickSight (BSI204)",
			url: "https://www.youtube.com/watch?v=RAyFwhk2VTs"
		},
		{
			title: "AWS re:Invent 2023 - Top cost optimization recommendations for Microsoft workloads on AWS (ENT211)",
			url: "https://www.youtube.com/watch?v=9G8jo4SeKmw"
		},
		{
			title: "AWS re:Invent 2023 - Build an end-to-end data strategy for analytics and generative AI (ANT331)",
			url: "https://www.youtube.com/watch?v=-SLnInVafho"
		},
		{
			title: "AWS re:Invent 2023 - Scaling Warhammer 40,000: Darktide from 0 to 100,000 players in 1 hour (GAM305)",
			url: "https://www.youtube.com/watch?v=ZgGYtuNSX4M"
		},
		{
			title: "AWS re:Invent 2023 - Building Falcon LLM: A top-ranked open source language model (WPS209)",
			url: "https://www.youtube.com/watch?v=zzRsRi2hDsQ"
		},
		{
			title: "AWS re:Invent 2023 - How to find and realize real-world business value in the cloud (ENT216)",
			url: "https://www.youtube.com/watch?v=YR4epXueCMk"
		},
		{
			title: "AWS re:Invent 2023 - Improve resilience of SAP workloads with AWS Support (SUP312)",
			url: "https://www.youtube.com/watch?v=PL4eZ3Mkhc8"
		},
		{
			title: "AWS re:Invent 2023 - Data drives transformation: Data foundations with AWS analytics (ANT219-INT)",
			url: "https://www.youtube.com/watch?v=KW132Nh2ggY"
		},
		{
			title: "AWS re:Invent 2023 - Explore geocoded datasets with PwC’s innovative data platform (AIM244)",
			url: "https://www.youtube.com/watch?v=NCsMOcyvLzQ"
		},
		{
			title: "AWS re:Invent 2023 - How not to practice observability (DOP404)",
			url: "https://www.youtube.com/watch?v=-sw6YYFjAME"
		},
		{
			title: "AWS re:Invent 2023 - Is your data stack usable? Why self-service analytics drives high ROI (ANT102)",
			url: "https://www.youtube.com/watch?v=NLNbEXi02bw"
		},
		{
			title: "AWS re:Invent 2023 - Centralize user activity from external sources in AWS CloudTrail Lake (COP341)",
			url: "https://www.youtube.com/watch?v=5CaJ_dTgTMU"
		},
		{
			title: "AWS re:Invent 2023 - How adidas revolutionizes digital systems to fuel a thriving business (CPG101)",
			url: "https://www.youtube.com/watch?v=q8F10xB_4gY"
		},
		{
			title: "AWS re:Invent 2023 - A cloud cost savings spectacular (COP219)",
			url: "https://www.youtube.com/watch?v=d8BNb7ZfuUo"
		},
		{
			title: "AWS re:Invent 2023 - Dive deep into Amazon DynamoDB (DAT330)",
			url: "https://www.youtube.com/watch?v=ld-xoehkJuU"
		},
		{
			title: "AWS re:Invent 2023 - Reducing AWS Fargate startup times by lazy loading container images (CON307)",
			url: "https://www.youtube.com/watch?v=5yskgXizYig"
		},
		{
			title: "AWS re:Invent 2023 - Trust Bank: Building for scale while enhancing the customer experience (FSI315)",
			url: "https://www.youtube.com/watch?v=0oI40t1y4nk"
		},
		{
			title: "AWS re:Invent 2023 - Amazon Redshift: A decade of innovation in cloud data warehousing (ANT325)",
			url: "https://www.youtube.com/watch?v=1tWwkmWOyZc"
		},
		{
			title: "AWS re:Invent 2023 - AWS wherever you need it (HYB201)",
			url: "https://www.youtube.com/watch?v=p9iG35xulZ4"
		},
		{
			title: "AWS re:Invent 2023 - Improving patient outcomes using generative AI in healthcare (HLC204)",
			url: "https://www.youtube.com/watch?v=ezfytvSRrQk"
		},
		{
			title: "AWS re:Invent 2023 - Building next-generation sustainability workloads with open data (SUS304)",
			url: "https://www.youtube.com/watch?v=UFtgaDwEefo"
		},
		{
			title: "AWS re:Invent 2023 - 5 things you should know about resilience at scale (ARC327)",
			url: "https://www.youtube.com/watch?v=CowAYv3qNCs"
		},
		{
			title: "AWS re:Invent 2023 - Deep dive on Amazon FSx for NetApp ONTAP scale-out file systems (STG229)",
			url: "https://www.youtube.com/watch?v=FiSjlvn1B8s"
		},
		{
			title: "AWS re:Invent 2023 - Scaling FinOps with a holistic approach to resource optimization (COP214)",
			url: "https://www.youtube.com/watch?v=G8m2qctcXAY"
		},
		{
			title: "AWS re:Invent 2023 - Optimize costs in your multi-account environments (COP333)",
			url: "https://www.youtube.com/watch?v=ie_Mqb-eC4A"
		},
		{
			title: "AWS re:Invent 2023 - Building an AWS solutions architect agent with Amazon Bedrock (BOA306)",
			url: "https://www.youtube.com/watch?v=kzzlchi0DzU"
		},
		{
			title: "AWS re:Invent 2023 - What’s new in the AWS modernization tool set for Microsoft workloads (ENT316)",
			url: "https://www.youtube.com/watch?v=OCnRGxI2WrQ"
		},
		{
			title: "AWS re:Invent 2023 - Bringing AWS to remote edge locations (HYB306)",
			url: "https://www.youtube.com/watch?v=siCrNpYYryI"
		},
		{
			title: "AWS re:Invent 2023 - Building an open source data strategy on AWS (ANT319)",
			url: "https://www.youtube.com/watch?v=MI7AawcX9ac"
		},
		{
			title: "AWS re:Invent 2023 - Ericsson into the cloud (TLC201)",
			url: "https://www.youtube.com/watch?v=rLM2_5GdAp8"
		},
		{
			title: "AWS re:Invent 2023 - What’s new in AWS Lake Formation (ANT303)",
			url: "https://www.youtube.com/watch?v=cK6uw5vptFU"
		},
		{
			title: "AWS re:Invent 2023 - What’s new with Amazon S3 (STG204)",
			url: "https://www.youtube.com/watch?v=idz2SvBHK-s"
		},
		{
			title: "AWS re:Invent 2023 - Automating AWS WAF: Pioneering future security (SEC206)",
			url: "https://www.youtube.com/watch?v=GqAh2EfMqPU"
		},
		{
			title: "AWS re:Invent 2023 - Developing serverless solutions (TNC218)",
			url: "https://www.youtube.com/watch?v=bazASUNxw2w"
		},
		{
			title: "AWS re:Invent 2023 - Integration of telecommunications APIs with AWS (TLC204)",
			url: "https://www.youtube.com/watch?v=6_ZQGJDOslQ"
		},
		{
			title: "AWS re:Invent 2023 - Amazon S3 security and access control best practices (STG315)",
			url: "https://www.youtube.com/watch?v=WZGG8RkvApY"
		},
		{
			title: "AWS re:Invent 2023 - Cloud-powered security with Amazon Security Lake & PwC’s fusion center (SEC246)",
			url: "https://www.youtube.com/watch?v=jw3Ox01YZK0"
		},
		{
			title: "AWS re:Invent 2023 - The origin of cloud security challenges and a revolutionary solution (SEC231)",
			url: "https://www.youtube.com/watch?v=8brmuYSYSM4"
		},
		{
			title: "AWS re:Invent 2023 - Think like a CIO: Cyber resiliency starts and ends with your data (HYB101)",
			url: "https://www.youtube.com/watch?v=jZqFmVoreGk"
		},
		{
			title: "AWS re:Invent 2023 - Real-time RAG: How to augment LLMs with Redis and Amazon Bedrock (DAT101)",
			url: "https://www.youtube.com/watch?v=_EUhk49t2lw"
		},
		{
			title: "AWS re:Invent 2023 - Shift left, shield right: Code-to-cloud strategy for securing apps (COP222)",
			url: "https://www.youtube.com/watch?v=0pYdiOi92_g"
		},
		{
			title: "AWS re:Invent 2023 - Reimagining the client experience in banking (CEN102)",
			url: "https://www.youtube.com/watch?v=2y58oLbUO5M"
		},
		{
			title: "AWS re:Invent 2023 - How John Hancock revolutionized its mainframe insurance admin on AWS (BIZ220)",
			url: "https://www.youtube.com/watch?v=yhsLkDUmeGQ"
		},
		{
			title: "AWS re:Invent 2023 - Migration madness: The dos and don’ts of a self-run migration to AWS (SMB211)",
			url: "https://www.youtube.com/watch?v=uhq84VL-FBA"
		},
		{
			title: "AWS re:Invent 2023 - AWS Cloud Quest: Ignite growth with hands-on skill building (PEX113)",
			url: "https://www.youtube.com/watch?v=JmqGMLEpntg"
		},
		{
			title: "AWS re:Invent 2023 - How GitHub operationalizes AI for team collaboration and productivity (AIM203)",
			url: "https://www.youtube.com/watch?v=cOVvGaiusOI"
		},
		{
			title: "AWS re:Invent 2023 - Modernize document workflows with intelligent processing (AIM103)",
			url: "https://www.youtube.com/watch?v=Ql6ShkQlIww"
		},
		{
			title: "AWS re:Invent 2023 - Navigating data residency and protecting sensitive data (HYB309)",
			url: "https://www.youtube.com/watch?v=q-1zA-ovZ6w"
		},
		{
			title: "AWS re:Invent 2023 - [LAUNCH] Introducing Amazon RDS for Db2 (DAT210)",
			url: "https://www.youtube.com/watch?v=47AV8KM4Z0g"
		},
		{
			title: "AWS re:Invent 2023 - AWS Mainframe Modernization Automated Refactor Transformation Center (ENT234)",
			url: "https://www.youtube.com/watch?v=uSWy3d4aaMg"
		},
		{
			title: "AWS re:Invent 2023 - Hyperscaling databases on Amazon Aurora (DAT409)",
			url: "https://www.youtube.com/watch?v=YPH2qfcSuBs"
		},
		{
			title: "AWS re:Invent 2023 - Introducing Amazon ElastiCache Serverless: Get started in minutes (DAT209)",
			url: "https://www.youtube.com/watch?v=IvkHRizfXok"
		},
		{
			title: "AWS re:Invent 2023 - Using AWS solutions to accelerate customer-led migration journeys (SUP313)",
			url: "https://www.youtube.com/watch?v=VA8krzHJBsA"
		},
		{
			title: "AWS re:Invent 2023 - Application modernization: Overcome Day 2 challenges with containers (SMB209)",
			url: "https://www.youtube.com/watch?v=xpFI6Jkdnhc"
		},
		{
			title: "AWS re:Invent 2023 - Intelligence in AppSec: Use AI to supercharge DevSecOps (AIM239)",
			url: "https://www.youtube.com/watch?v=BXd7tGfnwBY"
		},
		{
			title: "AWS re:Invent 2023 - Implement proactive data protection using Amazon EBS snapshots (STG226)",
			url: "https://www.youtube.com/watch?v=d7C6XsUnmHc"
		},
		{
			title: "AWS re:Invent 2023 - Reducing your area of impact and surviving difficult days (ARC306)",
			url: "https://www.youtube.com/watch?v=iXypbv5_dP8"
		},
		{
			title: "AWS re:Invent 2023 - Centralize cost, performance, and security optimization (COP223)",
			url: "https://www.youtube.com/watch?v=aGoiXJ74aSg"
		},
		{
			title: "AWS re:Invent 2023 - Prudential: Modernizing a mainframe to improve customer experience (FSI312)",
			url: "https://www.youtube.com/watch?v=BuwYoWAubJo"
		},
		{
			title: "AWS re:Invent 2023 - Augment creative thinking & boost productivity with AWS generative AI (AIM211)",
			url: "https://www.youtube.com/watch?v=ibq8redraiU"
		},
		{
			title: "AWS re:Invent 2023 - Immersive shopping experience with Amazon Anywhere (AMZ201)",
			url: "https://www.youtube.com/watch?v=sOy-6fXHU8s"
		},
		{
			title: "AWS re:Invent 2023 - The antidote for doubt: Forging your voice and building your community (IDE111)",
			url: "https://www.youtube.com/watch?v=3gs-Lomlk6c"
		},
		{
			title: "AWS re:Invent 2023 - Modernizing applications and eliminating 200M+ lines of legacy code (ENT232)",
			url: "https://www.youtube.com/watch?v=ljIMN41F6n8"
		},
		{
			title: "AWS re:Invent 2023 - Northwestern Mutual shifts left & shields right to stay secure on AWS (SEC207)",
			url: "https://www.youtube.com/watch?v=2bwuB153q30"
		},
		{
			title: "AWS re:Invent 2023 - Simplifying the adoption of generative AI for enterprises (AIM209)",
			url: "https://www.youtube.com/watch?v=HwiYghpxHo4"
		},
		{
			title: "AWS re:Invent 2023 - Unlock data insights with Amazon SageMaker and Amazon CodeWhisperer (BOA303)",
			url: "https://www.youtube.com/watch?v=ZdjFqPwlmLU"
		},
		{
			title: "AWS re:Invent 2023 - What’s new with Amazon QuickSight (BSI205)",
			url: "https://www.youtube.com/watch?v=ZBMBHI7M_uA"
		},
		{
			title: "AWS re:Invent 2023 - Partnering to transform industries: Addressing customers’ top needs (PEX105)",
			url: "https://www.youtube.com/watch?v=8vEidM9i-uQ"
		},
		{
			title: "AWS re:Invent 2023 - Personalize omnichannel customer experience with Amazon Connect (BIZ218)",
			url: "https://www.youtube.com/watch?v=B5p8xb5n8-0"
		},
		{
			title: "AWS re:Invent 2023-Defense in depth: Securely building a multi-tenant generative AI service(SEC334)",
			url: "https://www.youtube.com/watch?v=O1jFXK_KWC8"
		},
		{
			title: "AWS re:Invent 2023 - Optimizing performance for machine learning training on Amazon S3 (STG358)",
			url: "https://www.youtube.com/watch?v=VGrgPu03oBs"
		},
		{
			title: "AWS re:Invent 2023 - Fueling resilience: Phillips 66’s journey with VMware Cloud on AWS (ENT102)",
			url: "https://www.youtube.com/watch?v=5dDcs2aQTM8"
		},
		{
			title: "AWS re:Invent 2023 - Deep dive into Amazon ECS resilience and availability (CON401)",
			url: "https://www.youtube.com/watch?v=C7HUkG_tu90"
		},
		{
			title: "AWS re:Invent 2023 - Safely migrate databases that serve millions of requests per second (NFX307)",
			url: "https://www.youtube.com/watch?v=3bjnm1SXLlo"
		},
		{
			title: "AWS re:Invent 2023 - Modernization of Nintendo eShop: Microservice and platform engineering (GAM306)",
			url: "https://www.youtube.com/watch?v=grdawJ3icdA"
		},
		{
			title: "AWS re:Invent 2023 - FINRA CAT: Overcoming challenges when big data becomes massive (FSI316)",
			url: "https://www.youtube.com/watch?v=NUnqEW5sRWc"
		},
		{
			title: "AWS re:Invent 2023 - Accelerate secure and reliable AWS deployments with Dynatrace (ENT230)",
			url: "https://www.youtube.com/watch?v=5dX4CXp6M8w"
		},
		{
			title: "AWS re:Invent 2023 - FinOps and GreenOps successes on AWS: A customer story (COP217)",
			url: "https://www.youtube.com/watch?v=NKgmzK7dKjk"
		},
		{
			title: "AWS re:Invent 2023 - Visualize and design your architecture with AWS Application Composer (SVS213)",
			url: "https://www.youtube.com/watch?v=NcJegNwEfLA"
		},
		{
			title: "AWS re:Invent 2023 - Future-proofing your applications with AWS databases | DAT212-INT",
			url: "https://www.youtube.com/watch?v=fZLcv7rwj7Y"
		},
		{
			title: "AWS re:Invent 2023 - Expect the unexpected and build resilience with AWS (PEX116)",
			url: "https://www.youtube.com/watch?v=DD-7hPzesrk"
		},
		{
			title: "AWS re:Invent 2023 - Using serverless for event-driven architecture & domain-driven design (NTA203)",
			url: "https://www.youtube.com/watch?v=3foMZJSPMI4"
		},
		{
			title: "AWS re:Invent 2023 - Integrated data, generative AI, and a new era of health breakthroughs (LFS101)",
			url: "https://www.youtube.com/watch?v=55HbQideq3s"
		},
		{
			title: "AWS re:Invent 2023 - Best practices for operating on AWS (COP321)",
			url: "https://www.youtube.com/watch?v=XBKq2JXWsS4"
		},
		{
			title: "AWS re:Invent 2023 - Backup and disaster recovery strategies for increased resilience (ARC208)",
			url: "https://www.youtube.com/watch?v=E073XISxrSU"
		},
		{
			title: "AWS re:Invent 2023 - From humans to machines: Mitigate risk for all identities in the cloud (SEC248)",
			url: "https://www.youtube.com/watch?v=ugYvLtjsbWU"
		},
		{
			title: "AWS re:Invent 2023 - Use generative AI to name your pet after your favorite song (BOA208)",
			url: "https://www.youtube.com/watch?v=z4N96PEFnds"
		},
		{
			title: "AWS re:Invent 2023 - Discover seamless observability with eBPF (DOP226)",
			url: "https://www.youtube.com/watch?v=XvYZUGAQS4k"
		},
		{
			title: "AWS re:Invent 2023 -Analyze Amazon Aurora PostgreSQL data in Amazon Redshift with zero-ETL (DAT343)",
			url: "https://www.youtube.com/watch?v=EsakQCP9wUk"
		},
		{
			title: "AWS re:Invent 2023 - Deep dive into the AWS Nitro System (CMP306)",
			url: "https://www.youtube.com/watch?v=Cxie0FgLogg"
		},
		{
			title: "AWS re:Invent 2023 - Enhance your AWS re:Invent experience: 2023 updates to explore (GBL208-JA)",
			url: "https://www.youtube.com/watch?v=XTfvk_2vjcM"
		},
		{
			title: "AWS re:Invent 2023 - Accelerate DevOps with generative AI and Amazon CodeCatalyst (DOP205)",
			url: "https://www.youtube.com/watch?v=SUqap3JZYmc"
		},
		{
			title: "AWS re:Invent 2023 - Unraveling AI terminology (AIM107)",
			url: "https://www.youtube.com/watch?v=9oVn3obFY6U"
		},
		{
			title: "AWS re:Invent 2023 - Powering nonprofit purpose in the cloud (IMP101)",
			url: "https://www.youtube.com/watch?v=97WCIB7ovTU"
		},
		{
			title: "AWS re:Invent 2023 - Unlocking potential: Fair chance hiring for a more just future (IDE108)",
			url: "https://www.youtube.com/watch?v=HU5XmpmvDf8"
		},
		{
			title: "AWS re:Invent 2023 - Iterating faster on stateful services in the cloud (NFX305)",
			url: "https://www.youtube.com/watch?v=v4nLdCHk9ag"
		},
		{
			title: "AWS re:Invent 2023 - Scale your software company with AWS growth programs (SEG104)",
			url: "https://www.youtube.com/watch?v=_IikEw6mCUE"
		},
		{
			title: "AWS re:Invent 2023 - Omics innovation with AWS HealthOmics: Amgen’s path to faster results (AIM215)",
			url: "https://www.youtube.com/watch?v=Cwo83c4xvPQ"
		},
		{
			title: "AWS re:Invent 2023 - Future-proofing cloud security: A new operating model (SEC208)",
			url: "https://www.youtube.com/watch?v=GFcKCz1VO2I"
		},
		{
			title: "AWS re:Invent 2023 - Run modern PKI workflows with HCP Vault on AWS (SEC201)",
			url: "https://www.youtube.com/watch?v=kiBQpuEEka8"
		},
		{
			title: "AWS re:Invent 2023 - How AWS and BMW Group team up to accelerate data-driven innovation (PRO204)",
			url: "https://www.youtube.com/watch?v=BJWtBFZYo28"
		},
		{
			title: "AWS re:Invent 2023 - Customer Keynote Fireside Chat with NVIDIA",
			url: "https://www.youtube.com/watch?v=QnVT-bZQcWA"
		},
		{
			title: "AWS re:Invent 2023 - [LAUNCH] Customize and contextualize security with AWS Security Hub (SEC242)",
			url: "https://www.youtube.com/watch?v=nghb507nVtM"
		},
		{
			title: "AWS re:Invent 2023 - Building operational resilience through AI and automation (AIM310)",
			url: "https://www.youtube.com/watch?v=LhofcYSx0So"
		},
		{
			title: "AWS re:Invent 2023 - Improve your mobile and web app quality using AWS Device Farm (FWM202)",
			url: "https://www.youtube.com/watch?v=__93Tm0YCRg"
		},
		{
			title: "AWS re:Invent 2023 - Completing a large-scale migration and modernization with AWS (ENT215)",
			url: "https://www.youtube.com/watch?v=iL5FJ_1vKik"
		},
		{
			title: "AWS re:Invent 2023 - Sustained business growth with high-velocity decision-making (INO201)",
			url: "https://www.youtube.com/watch?v=-1GYc11fdqw"
		},
		{
			title: "AWS re:Invent 2023 - Behind the scenes of Amazon EBS innovation and operational excellence (STG210)",
			url: "https://www.youtube.com/watch?v=1EWh2aDvHzY"
		},
		{
			title: "AWS re:Invent 2023 - Lead with AI/ML to innovate, reduce tech debt, and boost productivity (SEG205)",
			url: "https://www.youtube.com/watch?v=xd58FbLPTnY"
		},
		{
			title: "AWS re:Invent 2023 - Spur productivity with options for identity and access (SEC336)",
			url: "https://www.youtube.com/watch?v=9ex4bEHKOng"
		},
		{
			title: "AWS re:Invent 2023 - Boosting efficiency: How to realize 70% cost reduction with AWS Fargate -CON318",
			url: "https://www.youtube.com/watch?v=WVGxnUEr1OU"
		},
		{
			title: "AWS re:Invent 2023 - Drive personalized CX using generative AI and Amazon Personalize (AIM225)",
			url: "https://www.youtube.com/watch?v=qwwLhbwS-rs"
		},
		{
			title: "AWS re:Invent 2023 - Revolutionize businesses and elevate customer experiences with AWS IoT (IOT211)",
			url: "https://www.youtube.com/watch?v=hsEUEj4bA8I"
		},
		{
			title: "AWS re:Invent 2023 - Achieve high performance consistency using Amazon EBS (STG331)",
			url: "https://www.youtube.com/watch?v=nguQGNSJf3I"
		},
		{
			title: "AWS re:Invent 2023 - Threat modeling your generative AI workload to evaluate security risk (SEC214)",
			url: "https://www.youtube.com/watch?v=TtRFQPlRYK4"
		},
		{
			title: "AWS re:Invent 2023 - Maximize the value of cold data with Amazon S3 Glacier (STG201)",
			url: "https://www.youtube.com/watch?v=rcBVKZN-uUE"
		},
		{
			title: "AWS re:Invent 2023 - How to optimize continuous compliance processes in your deployments (SEC101)",
			url: "https://www.youtube.com/watch?v=jpJ7H9ohPFg"
		},
		{
			title: "AWS re:Invent 2023 - Meet performance demands for your business-critical applications (STG341)",
			url: "https://www.youtube.com/watch?v=QDuM9hGx72U"
		},
		{
			title: "AWS re:Invent 2023 - How commercial companies are migrating and modernizing for rapid scale (SMB208)",
			url: "https://www.youtube.com/watch?v=V4tWLoAYh0c"
		},
		{
			title: "AWS re:Invent 2023 - Understand your data with business context (ANT207)",
			url: "https://www.youtube.com/watch?v=iG8yJN9WNPQ"
		},
		{
			title: "AWS re:Invent 2023 - Driving advertising and marketing innovation with generative AI (ADM303)",
			url: "https://www.youtube.com/watch?v=hpipo-u0ajY"
		},
		{
			title: "AWS re:Invent 2023 - Cutting-edge AI with AWS and NVIDIA (CMP208)",
			url: "https://www.youtube.com/watch?v=ud4-z_sb_ps"
		},
		{
			title: "AWS re:Invent 2023 - Ground station digitalization with SDRs in the cloud (AES303)",
			url: "https://www.youtube.com/watch?v=EthDSOaF9rE"
		},
		{
			title: "AWS re:Invent 2023 - How United Airlines accelerates innovation with Amazon DocumentDB (DAT337)",
			url: "https://www.youtube.com/watch?v=0b17HAcJ71Q"
		},
		{
			title: "AWS re:Invent 2023 - Enhance your document workflows with generative AI (AIM213)",
			url: "https://www.youtube.com/watch?v=b3Swj1hc5rY"
		},
		{
			title: "AWS re:Invent 2023 - How BMW uses analytics for supply chains during semiconductor shortage (PRO206)",
			url: "https://www.youtube.com/watch?v=B9dhLQZFTlw"
		},
		{
			title: "AWS re:Invent 2023 - Running AWS Device Farm tests from Amazon CodeCatalyst (FWM208)",
			url: "https://www.youtube.com/watch?v=BqlekBinWuA"
		},
		{
			title: "AWS re:Invent 2023 - How to build a business catalog with Amazon DataZone (ANT217)",
			url: "https://www.youtube.com/watch?v=__2f3YVCRn0"
		},
		{
			title: "AWS re:Invent 2023 - Security analytics and observability with Amazon OpenSearch Service (ANT350)",
			url: "https://www.youtube.com/watch?v=Xw9XV497JuY"
		},
		{
			title: "AWS re:Invent 2023 - Amazon Aurora HA and DR design patterns for global resilience (DAT324)",
			url: "https://www.youtube.com/watch?v=4NM9EB0IqEs"
		},
		{
			title: "AWS re:Invent 2023 - Intersection of culture, CX & generative AI in innovative businesses (INO105)",
			url: "https://www.youtube.com/watch?v=qvjA4dD_N8Y"
		},
		{
			title: "AWS re:Invent 2023 - SaaS deep dive: Inside a scalable, efficient multi-tenant architecture (SAS304)",
			url: "https://www.youtube.com/watch?v=qySi057gXuo"
		},
		{
			title: "AWS re:Invent 2023 - AWS storage cost-optimization best practices (STG202)",
			url: "https://www.youtube.com/watch?v=8LVKNHcA6RY"
		},
		{
			title: "AWS re:Invent 2023 - Lessons in modernizing monolithic .NET applications to microservices (XNT306)",
			url: "https://www.youtube.com/watch?v=yWYzPhuFY8k"
		},
		{
			title: "AWS re:Invent 2023 - Platform engineering with Amazon EKS (CON311)",
			url: "https://www.youtube.com/watch?v=eLxBnGoBltc"
		},
		{
			title: "AWS re:Invent 2023 - Ready, set, data: Perfecting the art of talent matching with AI (AIM309)",
			url: "https://www.youtube.com/watch?v=slCCkGXoTZ0"
		},
		{
			title: "AWS re:Invent 2023 - Implementing end-to-end compliance on AWS, featuring BMW (COP331)",
			url: "https://www.youtube.com/watch?v=nu69JLkc0G8"
		},
		{
			title: "AWS re:Invent 2023 - Detecting and mitigating gray failures (ARC310)",
			url: "https://www.youtube.com/watch?v=LzIZ-dEzgEw"
		},
		{
			title: "AWS re:Invent 2023 - Sony Interactive Entertainment: Generative and predictive AI on AWS (AIM226)",
			url: "https://www.youtube.com/watch?v=8pqBGEUgyKI"
		},
		{
			title: "AWS re:Invent 2023 - Smart savings: Amazon EC2 cost-optimization strategies (CMP211)",
			url: "https://www.youtube.com/watch?v=_AHPbxzIGV0"
		},
		{
			title: "AWS re:Invent 2023 - Help secure your AWS workloads with CrowdStrike, feat. Roper Tech (SEC205)",
			url: "https://www.youtube.com/watch?v=c5shfpasT4Q"
		},
		{
			title: "AWS re:Invent 2023 - Navigating the future of AI: Deploying generative models on Amazon EKS (CON312)",
			url: "https://www.youtube.com/watch?v=I22pIUSgseA"
		},
		{
			title: "AWS re:Invent 2023 - Innovating with quantum computing to reduce risk in financial services (QTC202)",
			url: "https://www.youtube.com/watch?v=7qdY-v75y2M"
		},
		{
			title: "AWS re:Invent 2023 - How NETGEAR, Techcombank & World Kinect Corp. transformed Oracle apps (ENT103)",
			url: "https://www.youtube.com/watch?v=RcsMSKdeIEE"
		},
		{
			title: "AWS re:Invent 2023 - Driving community impact with employee-led micro-grants (IDE102)",
			url: "https://www.youtube.com/watch?v=CRfNBhkWAC8"
		},
		{
			title: "AWS re:Invent 2023 - Building APIs: Choosing the best API solution & strategy for workloads (SVS301)",
			url: "https://www.youtube.com/watch?v=U6Zz_Bj6yEY"
		},
		{
			title: "AWS re:Invent 2023 - Empower your commercial business with data replication and resiliency (SMB214)",
			url: "https://www.youtube.com/watch?v=F4irut0cDWM"
		},
		{
			title: "AWS re:Invent 2023 - Powerful machine learning data strategies from The Very Group (RET201)",
			url: "https://www.youtube.com/watch?v=s2BxGtEbqqg"
		},
		{
			title: "AWS re:Invent 2023 - Boost agent productivity with real-time transcription and insights (AIM224)",
			url: "https://www.youtube.com/watch?v=xxKGNhNkSzI"
		},
		{
			title: "AWS re:Invent 2023 - Modernize managed file transfer with SFTP (STG322)",
			url: "https://www.youtube.com/watch?v=jlpMl4VqIhM"
		},
		{
			title: "AWS re:Invent 2023 - The challenge of AI in cloud security (SEC235)",
			url: "https://www.youtube.com/watch?v=yptN4Ws31U0"
		},
		{
			title: "AWS re:Invent 2023 - How security teams can strengthen security using generative AI (SEC210)",
			url: "https://www.youtube.com/watch?v=iiBUiC-2nPM"
		},
		{
			title: "AWS re:Invent 2023 - How to build a platform that developers love (DOP219)",
			url: "https://www.youtube.com/watch?v=6kK27w0xPMQ"
		},
		{
			title: "AWS re:Invent 2023 - Accelerate application delivery with VMware Tanzu and AWS (CON102)",
			url: "https://www.youtube.com/watch?v=08KRa8tIjAI"
		},
		{
			title: "AWS re:Invent 2023 - Driving efficiency and sustainability with AWS innovation mechanisms (INO106)",
			url: "https://www.youtube.com/watch?v=4QxNCkbT-0Y"
		},
		{
			title: "AWS re:Invent 2023 - Air Canada’s journey with Red Hat OpenShift Service on AWS (ROSA) (CON101)",
			url: "https://www.youtube.com/watch?v=bYxo7mJdD4M"
		},
		{
			title: "AWS re:Invent 2023 - Driving down the cost of observability (DOP224)",
			url: "https://www.youtube.com/watch?v=AjcN0LhzyFA"
		},
		{
			title: "AWS re:Invent 2023 - Slowing down deforestation by using AI, ML, and open source data (SUS205)",
			url: "https://www.youtube.com/watch?v=7MhCBam6pA8"
		},
		{
			title: "AWS re:Invent 2023 - Scale enterprise BI securely with Amazon QuickSight (BSI206)",
			url: "https://www.youtube.com/watch?v=JsUAkNH2p80"
		},
		{
			title: "AWS re:Invent 2023 - Modernize analytics by moving your data warehouse to Amazon Redshift (ANT322)",
			url: "https://www.youtube.com/watch?v=iOaLuF6KyLk"
		},
		{
			title: "AWS re:Invent 2023 - Unlocking the industry potential of generative AI (AIM248)",
			url: "https://www.youtube.com/watch?v=gSOwrpPpt88"
		},
		{
			title: "AWS re:Invent 2023 - Beyond 11 9s of durability: Data protection with Amazon S3 (STG319)",
			url: "https://www.youtube.com/watch?v=YsIjt88E6iw"
		},
		{
			title: "AWS re:Invent 2023 - Mercedes-Benz Aftersales: A cloud-first transformation (ARC329)",
			url: "https://www.youtube.com/watch?v=heiRs1_x_kc"
		},
		{
			title: "AWS re:Invent 2023 - Best practices for analytics and generative AI on AWS (ANT329)",
			url: "https://www.youtube.com/watch?v=0ixjc4QrnTs"
		},
		{
			title: "AWS re:Invent 2023 - Confidently run your production HPC workloads on AWS (CMP213)",
			url: "https://www.youtube.com/watch?v=nEfMyazR1Mc"
		},
		{
			title: "AWS re:Invent 2023 - Shipping securely: How strong security can be your strategic advantage (SEG203)",
			url: "https://www.youtube.com/watch?v=Q0Gn9X9wQ7Q"
		},
		{
			title: "AWS re:Invent 2023 - Driving social impact through AWS builders and initiatives (IMP102)",
			url: "https://www.youtube.com/watch?v=LDCPDlS-Xlc"
		},
		{
			title: "AWS re:Invent 2023 - Migrating 80K SQL Server databases to AWS: A strategic ISV journey (ENT219)",
			url: "https://www.youtube.com/watch?v=9XRfGzvrPOo"
		},
		{
			title: "AWS re:Invent 2023 - Deploying a global robot workforce for industrial inspections (ROB202)",
			url: "https://www.youtube.com/watch?v=n4CVqVvwtO4"
		},
		{
			title: "AWS re:Invent 2023 - From modernization to innovation: The tales of two hospitality leaders (TRV201)",
			url: "https://www.youtube.com/watch?v=QOHKEpG8bDA"
		},
		{
			title: "AWS re:Invent 2023 - Understanding the gender gap in technology with Girls Who Code (IDE110)",
			url: "https://www.youtube.com/watch?v=0ImiUGzJ2fs"
		},
		{
			title: "AWS re:Invent 2023 - Modernize authorization: Lessons from cryptography and authentication (SEC209)",
			url: "https://www.youtube.com/watch?v=WjCWrVnDmrM"
		},
		{
			title: "AWS re:Invent 2023 - Why AWS is the place to build and grow your MySQL workloads (DAT327)",
			url: "https://www.youtube.com/watch?v=0GBUSL8cDwo"
		},
		{
			title: "AWS re:Invent 2023 - AWS open source strategy and contributions for PostgreSQL (OPN302)",
			url: "https://www.youtube.com/watch?v=kfJKR54arl0"
		},
		{
			title: "AWS re:Invent 2023 - Disrupting your thinking on end user computing (EUC205)",
			url: "https://www.youtube.com/watch?v=yj2NajzB24A"
		},
		{
			title: "AWS re:Invent 2023 - Goldman Sachs: The journey to zero downtime (FSI310)",
			url: "https://www.youtube.com/watch?v=Y170dGDlpM8"
		},
		{
			title: "AWS re:Invent 2023 - Making dollars and sense out of FinOps (SEG202)",
			url: "https://www.youtube.com/watch?v=hI9Jg6n_Ku0"
		},
		{
			title: "AWS re:Invent 2023 - Making semantic search & RAG real:  How to build a prod-ready app (AIM201)",
			url: "https://www.youtube.com/watch?v=XRB6IYvoJeY"
		},
		{
			title: "AWS re:Invent 2023 - Observability best practices for hybrid environments (BIZ211)",
			url: "https://www.youtube.com/watch?v=qufTkqH_fEE"
		},
		{
			title: "AWS re:Invent 2023 - Build & deploy generative AI apps in days with Databricks Lakehouse AI (AIM236)",
			url: "https://www.youtube.com/watch?v=8lZfvGMmZew"
		},
		{
			title: "AWS re:Invent 2023 - Driving precision: Creating a tech revolution at PGA Tour events (NET101)",
			url: "https://www.youtube.com/watch?v=BHwvO8ZA-mU"
		},
		{
			title: "AWS re:Invent 2023 - Composable architecture using Amazon DynamoDB and domain-driven design (COM304)",
			url: "https://www.youtube.com/watch?v=DpafYmI3NQc"
		},
		{
			title: "AWS re:Invent 2023 - How Granite Construction is modernizing their Oracle ERP application (ENT221)",
			url: "https://www.youtube.com/watch?v=UBD64e-PPYM"
		},
		{
			title: "AWS re:Invent 2023 - AWS MAP: A proven methodology for cloud migration and modernization (ENT220)",
			url: "https://www.youtube.com/watch?v=_MTDN2r5-oI"
		},
		{
			title: "AWS re:Invent 2023 - From promise to impact with gen AI in healthcare & life sciences (AIM308)",
			url: "https://www.youtube.com/watch?v=pfwPcevtTRY"
		},
		{
			title: "AWS re:Invent 2023 - The making of “Race to the Cloud” (MAE204)",
			url: "https://www.youtube.com/watch?v=kNCWezaXFWw"
		},
		{
			title: "AWS re:Invent 2023 - How Choice Hotels is unifying guest profiles to drive personalization (TRV203)",
			url: "https://www.youtube.com/watch?v=NaeBNvZnWjY"
		},
		{
			title: "AWS re:Invent 2023 - Building NFT experiences on AWS (BLC203)",
			url: "https://www.youtube.com/watch?v=sDn1Xg4CJp4"
		},
		{
			title: "AWS re:Invent 2023 - Maximizing personalization and AI models with quality customer data (AIM238)",
			url: "https://www.youtube.com/watch?v=7eyiarheA5g"
		},
		{
			title: "AWS re:Invent 2023 - OCSF for security at the edge with AWS AppFabric and Barracuda XDR (SEC103)",
			url: "https://www.youtube.com/watch?v=QQVyFdTsZWM"
		},
		{
			title: "AWS re:Invent 2023 - The secret path to practical generative AI in the enterprise (AIM360)",
			url: "https://www.youtube.com/watch?v=FHWc6e_SeRY"
		},
		{
			title: "AWS re:Invent 2023 - Upgrading from the modern data stack to the modern data lake (ANT103)",
			url: "https://www.youtube.com/watch?v=bvmfjXaU4Kc"
		},
		{
			title: "AWS re:Invent 2023 - Power Amazon Bedrock applications with Neo4j knowledge graph (DAT203)",
			url: "https://www.youtube.com/watch?v=V4erJ_0r8s8"
		},
		{
			title: "AWS re:Invent 2023 - How to accelerate business model transformation with generative AI (ENT237)",
			url: "https://www.youtube.com/watch?v=VGvRhi6qgDQ"
		},
		{
			title: "AWS re:Invent 2023 - Elevate your AWS experience with Dell’s enterprise storage software (COP103)",
			url: "https://www.youtube.com/watch?v=Q8b0EfasHCQ"
		},
		{
			title: "AWS re:Invent 2023 - Generative AI: Keeping it real (AIM255)",
			url: "https://www.youtube.com/watch?v=97Ktrel_SVs"
		},
		{
			title: "AWS re:Invent 2023 - Considerations for using an AWS Enterprise Discount Program (ENT231)",
			url: "https://www.youtube.com/watch?v=hcE4EUlBmRo"
		},
		{
			title: "AWS re:Invent 2023 - 3-phased approach to delivering a lakehouse with data mesh (ANT106)",
			url: "https://www.youtube.com/watch?v=WTI2xfIQaKU"
		},
		{
			title: "AWS re:Invent 2023 - Accelerate your cloud business with AWS built-in partner solutions (PEX107)",
			url: "https://www.youtube.com/watch?v=JQ7Xegw9Yjg"
		},
		{
			title: "AWS re:Invent 2023 - Preventing student debt using predictive data at scale (IDE106)",
			url: "https://www.youtube.com/watch?v=aEYgBtFNRvY"
		},
		{
			title: "AWS re:Invent 2023 - Accelerate automotive cockpit development with Panasonic SkipGen & AWS (AUT103)",
			url: "https://www.youtube.com/watch?v=wEK5MzHkXiw"
		},
		{
			title: "AWS re:Invent 2023 - Democratizing the digital twin for small and medium businesses (BIZ106)",
			url: "https://www.youtube.com/watch?v=zljy8gx_gFE"
		},
		{
			title: "AWS re:Invent 2023 - Reduce risk & accelerate your SAP journey with Red Hat and EPI-USE (COP101)",
			url: "https://www.youtube.com/watch?v=82Ut-IbqSNA"
		},
		{
			title: "AWS re:Invent 2023 - Fidelity Investments: Building a scalable security monitoring tool (FSI202)",
			url: "https://www.youtube.com/watch?v=lEVXE9CCNC4"
		},
		{
			title: "AWS re:Invent 2023 - Composable commerce promotes business agility (RET102)",
			url: "https://www.youtube.com/watch?v=PyEsOrkbseU"
		},
		{
			title: "AWS re:Invent 2023 - Maximize customer value through AWS Marketplace private offers (PEN102)",
			url: "https://www.youtube.com/watch?v=qUj-Z86QZUM"
		},
		{
			title: "AWS re:Invent 2023 - Breaking the data pipeline bottleneck with zero-ETL (ANT348)",
			url: "https://www.youtube.com/watch?v=WVtPhh3VkSQ"
		},
		{
			title: "AWS re:Invent 2023 - Break through the complexity limit with platform engineering (DOP102)",
			url: "https://www.youtube.com/watch?v=PlPAldLJivM"
		},
		{
			title: "AWS re:Invent 2023 - Customer Keynote BMW Group | AWS Events",
			url: "https://www.youtube.com/watch?v=YFBM950_lx4"
		},
		{
			title: "AWS re:Invent 2023 - The impact of access: Women technologists driving innovation in cloud (IDE112)",
			url: "https://www.youtube.com/watch?v=SGbHYwqHYpc"
		},
		{
			title: "AWS re:Invent 2023 - Improve operational efficiency and resilience with AWS Support (SUP310)",
			url: "https://www.youtube.com/watch?v=jaehZYBNG0Y"
		},
		{
			title: "AWS re:Invent 2023 - How Rocket Companies run their data science platform on AWS (ANT321)",
			url: "https://www.youtube.com/watch?v=T_fN14nikho"
		},
		{
			title: "AWS re:Invent 2023 - Rocket science: Process, store, and analyze engine test data on AWS (AES304)",
			url: "https://www.youtube.com/watch?v=QoalHiflJLQ"
		},
		{
			title: "AWS re:Invent 2023 - The U.S. Air Force’s journey through the clouds, to the cloud (WPS102)",
			url: "https://www.youtube.com/watch?v=5g1JFXHSL1o"
		},
		{
			title: "AWS re:Invent 2023 - Jupyter AI: Open source brings LLMs to your notebooks (OPN203)",
			url: "https://www.youtube.com/watch?v=nDoojNaRhPE"
		},
		{
			title: "AWS re:Invent 2023 - Inspire the next on AWS through hybrid cloud and data technologies (HYB107)",
			url: "https://www.youtube.com/watch?v=n13L1DRwxE8"
		},
		{
			title: "AWS re:Invent 2023 - Build cloud data management across analytics, ML & gen AI applications (ANT208)",
			url: "https://www.youtube.com/watch?v=nIrPj2CbTZg"
		},
		{
			title: "AWS re:Invent 2023 - Performance & efficiency at Pinterest: Optimizing the latest instances (COP352)",
			url: "https://www.youtube.com/watch?v=QSudpowE_Hs"
		},
		{
			title: "AWS re:Invent 2023 - Scaling serverless data processing with Amazon Kinesis and Apache Kafka(SVS307)",
			url: "https://www.youtube.com/watch?v=ZYSOwyCxqJ8"
		},
		{
			title: "AWS re:Invent 2023 - Hybrid cloud storage and edge compute (STG224)",
			url: "https://www.youtube.com/watch?v=qMoU3TU5uu8"
		},
		{
			title: "AWS re:Invent 2023 - Enable generative AI trust and safety with Amazon Comprehend (AIM214)",
			url: "https://www.youtube.com/watch?v=Nhl4JlQjc7U"
		},
		{
			title: "AWS re:Invent 2023 - Migration with zero downtime: Toyota Drivelink Safety Connect Platform (AUT205)",
			url: "https://www.youtube.com/watch?v=IkC-jI78H_Y"
		},
		{
			title: "AWS re:Invent 2023 - Adding AWS (backbone) to your network (NET319)",
			url: "https://www.youtube.com/watch?v=GrsWSMiE264"
		},
		{
			title: "AWS re:Invent 2023 - Defend your data at scale: 3 steps to increase cyber security (STG348)",
			url: "https://www.youtube.com/watch?v=dPQFVEtksNs"
		},
		{
			title: "AWS re:Invent 2023 - Implement, scale, operate & innovate: TennCare’s cloud strategy (AIM312)",
			url: "https://www.youtube.com/watch?v=StpAGsUAR1o"
		},
		{
			title: "AWS re:Invent 2023 - How Amazon MGM Studios protects its most important data (STG225)",
			url: "https://www.youtube.com/watch?v=_vi4odUAWTc"
		},
		{
			title: "AWS re:Invent 2023 - Boost performance & save money using ElastiCache with Aurora & RDS (DAT335)",
			url: "https://www.youtube.com/watch?v=jdBabfFSiWE"
		},
		{
			title: "AWS re:Invent 2023 - Belden: Digitizing operations with network and data solutions (IOT103)",
			url: "https://www.youtube.com/watch?v=dN8jKbpy6B0"
		},
		{
			title: "AWS re:Invent 2023 - Serving marginalized populations through research and data science (IDE107)",
			url: "https://www.youtube.com/watch?v=3-az561GnZk"
		},
		{
			title: "AWS re:Invent 2023 - Create your AWS GTM framework by Working Backwards (PEX115)",
			url: "https://www.youtube.com/watch?v=TvQyRZQkwPk"
		},
		{
			title: "AWS re:Invent 2023 - Build with the efficiency, agility & innovation of the cloud with AWS (STG103)",
			url: "https://www.youtube.com/watch?v=AMrXMfYYVXs"
		},
		{
			title: "AWS re:Invent 2023 - Powering self-service & near real-time analytics with Amazon Redshift (ANT211)",
			url: "https://www.youtube.com/watch?v=NVDP4UTjxgM"
		},
		{
			title: "AWS re:Invent 2023 - Automating reporting on compliance controls at cloud scale (SEC232)",
			url: "https://www.youtube.com/watch?v=7g4aCuWYE1k"
		},
		{
			title: "AWS re:Invent 2023 - Building neuroinclusive cloud experiences (IDE201)",
			url: "https://www.youtube.com/watch?v=EW74ZI1NRc8"
		},
		{
			title: "AWS re:Invent 2023 - How automating cloud operations accelerated time to market at NU (COP344)",
			url: "https://www.youtube.com/watch?v=4Fby5EuWxN8"
		},
		{
			title: "AWS re:Invent 2023 - APN technical validations to grow your practice & delight customers (PEX204)",
			url: "https://www.youtube.com/watch?v=JXuPCDWnOIs"
		},
		{
			title: "AWS re:Invent 2023 - What is the path to becoming a cloud solutions architect? (ARC211)",
			url: "https://www.youtube.com/watch?v=bviIa28UUiE"
		},
		{
			title: "AWS re:Invent 2023 - How to deliver business value in financial services with generative AI (FSI201)",
			url: "https://www.youtube.com/watch?v=W4Xd8mPqqKU"
		},
		{
			title: "AWS re:Invent 2023 - How to GTM with the AWS Global Startup Program (PEX119)",
			url: "https://www.youtube.com/watch?v=yr8r6KWS5Yw"
		},
		{
			title: "AWS re:Invent 2023 - Building an effective observability strategy (COP325)",
			url: "https://www.youtube.com/watch?v=7PQv9eYCJW8"
		},
		{
			title: "AWS re:Invent 2023 - Continuous integration and delivery for AWS (DOP208)",
			url: "https://www.youtube.com/watch?v=25w9uJPt0SA"
		},
		{
			title: "AWS re:Invent 2023 - Improving manufacturing at Panasonic Energy (MFG101)",
			url: "https://www.youtube.com/watch?v=r8nsY0N5wi4"
		},
		{
			title: "AWS re:Invent 2023 - Automate intelligent cloud operations with Slack and AWS (AIM234)",
			url: "https://www.youtube.com/watch?v=85_KLwWFioc"
		},
		{
			title: "AWS re:Invent 2023 - [LAUNCH] Introducing Amazon ElastiCache Serverless (DAT342)",
			url: "https://www.youtube.com/watch?v=YYStP97pbXo"
		},
		{
			title: "AWS re:Invent 2023 - A leader’s guide to generative AI: Using history to shape the future (SEG204)",
			url: "https://www.youtube.com/watch?v=e3snrDsct1o"
		},
		{
			title: "AWS re:Invent 2023 - SnapLogic and Amazon Redshift transform insights at Lumeris (ANT214)",
			url: "https://www.youtube.com/watch?v=DYCptZI0DL0"
		},
		{
			title: "AWS re:Invent 2023 - Building state machines with AWS Step Functions Workflow Studio (API209)",
			url: "https://www.youtube.com/watch?v=wyeEWt5mFPI"
		},
		{
			title: "AWS re:Invent 2023 - Resilient SAP side-by-side shop floor integration at Volkswagen (BIZ227)",
			url: "https://www.youtube.com/watch?v=XM9Sb0zk_WI"
		},
		{
			title: "AWS re:Invent 2023 - Engineer your company’s future with AI: Use open source tools on AWS (AIM229)",
			url: "https://www.youtube.com/watch?v=Pp-sbsSA4rY"
		},
		{
			title: "AWS re:Invent 2023 - Scale organizational cloud knowledge & improve builder productivity (ARC207)",
			url: "https://www.youtube.com/watch?v=rcRz6BOyTZY"
		},
		{
			title: "AWS re:Invent 2023 - Secure, private LLMs in your cloud with Anyscale Endpoints (AIM251)",
			url: "https://www.youtube.com/watch?v=6-FG4Ba7ywU"
		},
		{
			title: "AWS re:Invent 2023 - Accelerate insights using Amazon CloudWatch Logs ML-powered analytics (COP350)",
			url: "https://www.youtube.com/watch?v=UY4YYoPnMfg"
		},
		{
			title: "AWS re:Invent 2023 - Fast forward: Building the future of financial services today (FSI203)",
			url: "https://www.youtube.com/watch?v=C4Ua9w67068"
		},
		{
			title: "AWS re:Invent 2023 - New trends in data modernization: Catalysts for AI/ML analytics on AWS (ANT215)",
			url: "https://www.youtube.com/watch?v=Rk7SvmmrGM0"
		},
		{
			title: "AWS re:Invent 2023 - Surviving overloads: How Amazon Prime Day avoids congestion collapse (NET402)",
			url: "https://www.youtube.com/watch?v=fOYOvp6X10g"
		},
		{
			title: "AWS re:Invent 2023 - Transform your customer service organization with AI and automation (BIZ224)",
			url: "https://www.youtube.com/watch?v=q4m3vuodJXc"
		},
		{
			title: "AWS re:Invent 2023 - Principal Financial enhances CX using call analytics and generative AI (AIM223)",
			url: "https://www.youtube.com/watch?v=3BCa37587A0"
		},
		{
			title: "AWS re:Invent 2023 - Customer insights: Apple app development with Amazon EC2 Mac instances (CMP218)",
			url: "https://www.youtube.com/watch?v=vXJsU1b_JQs"
		},
		{
			title: "AWS re:Invent 2023 - What’s new with AWS governance and compliance (COP340)",
			url: "https://www.youtube.com/watch?v=O_r3-thv0pA"
		},
		{
			title: "AWS re:Invent 2023 - Take a load off: Diagnose & resolve performance issues with Amazon RDS (DAT202)",
			url: "https://www.youtube.com/watch?v=Ulj88e5Aqzg"
		},
		{
			title: "AWS re:Invent 2023 - Capital One: Achieving resiliency to run mission-critical applications (FSI314)",
			url: "https://www.youtube.com/watch?v=hgIqWCRKA2k"
		},
		{
			title: "AWS re:Invent 2023 - Improve SaaS application security observability with AWS AppFabric (BIZ213)",
			url: "https://www.youtube.com/watch?v=FRuaiED0n3g"
		},
		{
			title: "AWS re:Invent 2023 - Building inventive customer experiences with data, AI, and serverless (SMB301)",
			url: "https://www.youtube.com/watch?v=CT6N5tb9ubo"
		},
		{
			title: "AWS re:Invent 2023 - Data patterns for generative AI applications (DAT338)",
			url: "https://www.youtube.com/watch?v=7NBQ8Mwko54"
		},
		{
			title: "AWS re:Invent 2023 - The pragmatic serverless Python developer (OPN305)",
			url: "https://www.youtube.com/watch?v=52W3Qyg242Y"
		},
		{
			title: "AWS re:Invent 2023 - [LAUNCH] Elevate your security investigations using generative AI (SEC244)",
			url: "https://www.youtube.com/watch?v=Vf-s3ZQmJhc"
		},
		{
			title: "AWS re:Invent 2023 - Seamless modernization and migration of media services with LG U+ (PRO101)",
			url: "https://www.youtube.com/watch?v=b4xW_miQmXo"
		},
		{
			title: "AWS re:Invent 2023 - Strengthen your cyber resilience and secure cloud data with Veritas (SEC230)",
			url: "https://www.youtube.com/watch?v=LPP01i0-TEg"
		},
		{
			title: "AWS re:Invent 2023 - Generative AI security: Innovate faster with AI using AWS Partners (PEX109)",
			url: "https://www.youtube.com/watch?v=aFuTHt5WHuw"
		},
		{
			title: "AWS re:Invent 2023 - “Rustifying” serverless: Boost AWS Lambda performance with Rust (COM306)",
			url: "https://www.youtube.com/watch?v=Mdh_2PXe9i8"
		},
		{
			title: "AWS re:Invent 2023 - Using AWS Lambda to process Amazon SQS and Amazon SNS messages (SVS212)",
			url: "https://www.youtube.com/watch?v=GWa2N3xe73M"
		},
		{
			title: "AWS re:Invent 2023 - Unlock and accelerate growth with AWS Partner Training (PEX103)",
			url: "https://www.youtube.com/watch?v=2SyqgBkbtMo"
		},
		{
			title: "AWS re:Invent 2023 - A career journey for serverless and container cloud developers (GBL207)",
			url: "https://www.youtube.com/watch?v=gdqgk17T2Xw"
		},
		{
			title: "AWS re:Invent 2023 - 10 ways to modernize, optimize & monetize on AWS as business grows (SMB205)",
			url: "https://www.youtube.com/watch?v=4PMR6UrVl7U"
		},
		{
			title: "AWS re:Invent 2023 - Lessons from the SOC: Analyzing and remediating cloud attack paths (SEC315)",
			url: "https://www.youtube.com/watch?v=KZVMCHsBUy0"
		},
		{
			title: "AWS re:Invent 2023 - AI made just for you: The power of hyper-contextualization (AIM253)",
			url: "https://www.youtube.com/watch?v=V_hFiqUCCWw"
		},
		{
			title: "AWS re:Invent 2023 - Mining real-time data in financial services and travel & hospitality (CEN301)",
			url: "https://www.youtube.com/watch?v=JNS58eExA9M"
		},
		{
			title: "AWS re:Invent 2023 - Speed, scale & stealth: Securing against ATO events (SEC233)",
			url: "https://www.youtube.com/watch?v=cNAb1tKDLyM"
		},
		{
			title: "AWS re:Invent 2023 - Workday Extend: Build people and money apps with low-code tooling (BIZ108)",
			url: "https://www.youtube.com/watch?v=t4x7OpqqAgQ"
		},
		{
			title: "AWS re:Invent 2023 - Okta Privileged Access: Zero standing privilege is no longer a myth (SEC106)",
			url: "https://www.youtube.com/watch?v=_pyjuIFH7tk"
		},
		{
			title: "AWS re:Invent 2023 - Build your first generative AI application with Amazon Bedrock (AIM218)",
			url: "https://www.youtube.com/watch?v=jzIZcgaTruA"
		},
		{
			title: "AWS re:Invent 2023 - Coinbase: Building an ultra-low-latency crypto exchange on AWS (FSI309)",
			url: "https://www.youtube.com/watch?v=iB78FrFWrLE"
		},
		{
			title: "AWS re:Invent 2023 - Building a cloud-backed generative AI game in 60 minutes (COM201)",
			url: "https://www.youtube.com/watch?v=9UGfVeIQc-s"
		},
		{
			title: "AWS re:Invent 2023 - Secure your cloud in real time (SEC107)",
			url: "https://www.youtube.com/watch?v=FMrcFnn_Uq8"
		},
		{
			title: "AWS re:Invent 2023 - Unlocking your full potential with the power of generative AI on AWS (COM203)",
			url: "https://www.youtube.com/watch?v=R5P6kwvZLok"
		},
		{
			title: "AWS re:Invent 2023 - Scale public sector partner business with AI, cybersecurity, and more (PEX102)",
			url: "https://www.youtube.com/watch?v=PP5cwtaST6E"
		},
		{
			title: "AWS re:Invent 2023 - How Electronic Arts modernized its data platform with Amazon EMR (ANT320)",
			url: "https://www.youtube.com/watch?v=JYCa9TbGLEw"
		},
		{
			title: "AWS re:Invent 2023 - Kick-start your inclusive journey: Inclusion Powered by AWS Playbook (IDE101)",
			url: "https://www.youtube.com/watch?v=fRy-weRsB-I"
		},
		{
			title: "AWS re:Invent 2023 - Accelerate FM development with Amazon SageMaker JumpStart (AIM328)",
			url: "https://www.youtube.com/watch?v=cTyXDhiltXw"
		},
		{
			title: "AWS re:Invent 2023 - HPC on AWS for semiconductors and healthcare life sciences (CMP214)",
			url: "https://www.youtube.com/watch?v=K-2d-pqe5nU"
		},
		{
			title: "AWS re:Invent 2023 - Simplify and improve access control for your AWS analytics services (SEC245)",
			url: "https://www.youtube.com/watch?v=Iwr0JihOevs"
		},
		{
			title: "AWS re:Invent 2023 - Drive innovation and accelerate business outcomes with benchmarking (GDS101)",
			url: "https://www.youtube.com/watch?v=T9Tr3MGiBzU"
		},
		{
			title: "AWS re:Invent 2023 - Modern data governance customer panel (ANT206)",
			url: "https://www.youtube.com/watch?v=AJe5tpZXtL0"
		},
		{
			title: "AWS re:Invent 2023 - Cloud-first intelligent code pipelines with Volvo Cars and TRATON (AUT102)",
			url: "https://www.youtube.com/watch?v=NOTSwr4wQw8"
		},
		{
			title: "AWS re:Invent 2023 - Simplify governance & third-party assessments using AWS Marketplace (MKT201)",
			url: "https://www.youtube.com/watch?v=agOoEBmupDI"
		},
		{
			title: "AWS re:Invent 2023 - Enable better performance and reduce storage cost with InfluxDB 3.0 (STG102-S)",
			url: "https://www.youtube.com/watch?v=Kw12_9AoZgs"
		},
		{
			title: "AWS re:Invent 2023 - Beyond the EHR: Delivering timely, accessible care with One Medical (AMZ204)",
			url: "https://www.youtube.com/watch?v=ETMamkvIVCM"
		},
		{
			title: "AWS re:Invent 2023 - Streamlining migration of virtual desktop infrastructure to AWS (EUC207)",
			url: "https://www.youtube.com/watch?v=AVKRQh_h0gs"
		},
		{
			title: "AWS re:Invent 2023 - Customer Keynote Pfizer",
			url: "https://www.youtube.com/watch?v=DdvBB8-Pq-k"
		},
		{
			title: "AWS re:Invent 2023 - Compute innovation for any application, anywhere (CMP219)",
			url: "https://www.youtube.com/watch?v=dxm93_qgRzk"
		},
		{
			title: "AWS re:Invent 2023 - C-suite leaders talk generative AI and applications (BIZ225-INT)",
			url: "https://www.youtube.com/watch?v=S235BAmQGCg"
		},
		{
			title: "AWS re:Invent 2023 - NBCUniversal drives media effectiveness through modernized TV (MAE205)",
			url: "https://www.youtube.com/watch?v=MGRxs2V82Jk"
		},
		{
			title: "AWS re:Invent 2023 - Data modeling core concepts for Amazon DynamoDB (DAT329)",
			url: "https://www.youtube.com/watch?v=l-Urbf4BaWg"
		},
		{
			title: "AWS re:Invent 2023 - Build production-ready serverless .NET apps with AWS Lambda (XNT301)",
			url: "https://www.youtube.com/watch?v=OWBazBRsF2A"
		},
		{
			title: "AWS re:Invent 2023 - How are EDF (UK) and World Kinect Corporation automating Oracle apps? (ENT222)",
			url: "https://www.youtube.com/watch?v=vT_8V7XTAr8"
		},
		{
			title: "AWS re:Invent 2023 - Serverless data streaming: Amazon Kinesis Data Streams and AWS Lambda (COM308)",
			url: "https://www.youtube.com/watch?v=HjoQllOWRmM"
		},
		{
			title: "AWS re:Invent 2023 - Protect sensitive data in use with AWS confidential computing (CMP307)",
			url: "https://www.youtube.com/watch?v=lgjNWVppsgw"
		},
		{
			title: "AWS re:Invent 2023 - Optimizing customer experiences using location-based services (IOT208)",
			url: "https://www.youtube.com/watch?v=CmJHOz7Peuw"
		},
		{
			title: "AWS re:Invent 2023 - ALDO Group finds the best pairing to optimize their order management (RET101)",
			url: "https://www.youtube.com/watch?v=a20M44pvSl0"
		},
		{
			title: "AWS re:Invent 2023 - A migration strategy for edge and on-premises workloads (HYB203)",
			url: "https://www.youtube.com/watch?v=4wUXzYNLvTw"
		},
		{
			title: "AWS re:Invent 2023 - Building observability to increase resiliency (COP343)",
			url: "https://www.youtube.com/watch?v=MARiKxvrdmc"
		},
		{
			title: "AWS re:Invent 2023 - Capacity, availability, cost efficiency: Pick three (CMP207)",
			url: "https://www.youtube.com/watch?v=E0dYLPXrX_w"
		},
		{
			title: "AWS re:Invent 2023 - Building interoperability and data collaboration workloads with AWS (ADM201)",
			url: "https://www.youtube.com/watch?v=-QLY-2uftio"
		},
		{
			title: "AWS re:Invent 2023 - Scaling on AWS for the first 10 million users (ARC206)",
			url: "https://www.youtube.com/watch?v=JzuNJ8OUht0"
		},
		{
			title: "AWS re:Invent 2023 - Running OpenShift on AWS using Red Hat OpenShift Service on AWS (ROSA) (CON207)",
			url: "https://www.youtube.com/watch?v=4s0w5uu-LYk"
		},
		{
			title: "AWS re:Invent 2023 - Predictive maintenance at scale: KAES’s journey with Amazon Monitron (AIM216)",
			url: "https://www.youtube.com/watch?v=FYfXj_rcVzs"
		},
		{
			title: "AWS re:Invent 2023 - Reskilling at the speed of cloud: Turning employees into entrepreneurs (SEG101)",
			url: "https://www.youtube.com/watch?v=Ax7JqIDIXEY"
		},
		{
			title: "AWS re:Invent 2023 - Building cost-optimized multi-tenant SaaS architectures (ARC311)",
			url: "https://www.youtube.com/watch?v=jF2uUdUcfSU"
		},
		{
			title: "AWS re:Invent 2023 - AWS storage: The backbone for your data-driven business (STG227)",
			url: "https://www.youtube.com/watch?v=Alxig9GFIE4"
		},
		{
			title: "AWS re:Invent 2023 - Delivering low-latency applications at the edge (HYB305)",
			url: "https://www.youtube.com/watch?v=isYOTxCm5w4"
		},
		{
			title: "AWS re:Invent 2023 - Understand your customers better with a modern data strategy (TNC219)",
			url: "https://www.youtube.com/watch?v=ciP7LMTQXAE"
		},
		{
			title: "AWS re:Invent 2023 - SaaS DevOps deep dive: Automating multi-tenant deployments (SAS406)",
			url: "https://www.youtube.com/watch?v=QVEZgegld0w"
		},
		{
			title: "AWS re:Invent 2023 - AWS journey toward intent-driven network infrastructure (NET401)",
			url: "https://www.youtube.com/watch?v=B3dtiSYriZc"
		},
		{
			title: "AWS re:Invent 2023 - Gain confidence in system correctness & resilience with formal methods (ARC315)",
			url: "https://www.youtube.com/watch?v=FdXZXnkMDxs"
		},
		{
			title: "AWS re:Invent 2023 - Architecture-led portfolio migration and modernization (ENT236)",
			url: "https://www.youtube.com/watch?v=FhHE0RcZGRY"
		},
		{
			title: "AWS re:Invent 2023 - Using Aurora Serverless to simplify manageability and improve costs (DAT331)",
			url: "https://www.youtube.com/watch?v=ecRje2wFO14"
		},
		{
			title: "AWS re:Invent 2023 - Cloud migration strategy (NTA102)",
			url: "https://www.youtube.com/watch?v=9ziB82V7qVM"
		},
		{
			title: "AWS re:Invent 2023 - Building an NFT drops platform and marketplace on AWS (BLC101)",
			url: "https://www.youtube.com/watch?v=e_f9s6GaSMQ"
		},
		{
			title: "AWS re:Invent 2023 - Simplifying modern data pipelines with zero-ETL architectures on AWS (PEX203)",
			url: "https://www.youtube.com/watch?v=g2dJAuRRDIo"
		},
		{
			title: "AWS re:Invent 2023 - Stripe: Architecting for observability at massive scale (FSI319)",
			url: "https://www.youtube.com/watch?v=gNCKJUg8qEo"
		},
		{
			title: "AWS re:Invent 2023 - Manufacturing and mobility innovation in the cloud (AUT207)",
			url: "https://www.youtube.com/watch?v=eS2yqxDE-08"
		},
		{
			title: "AWS re:Invent 2023 - AWS Amplify: Scale your web and mobile app development and delivery (FWM205)",
			url: "https://www.youtube.com/watch?v=ihEZmQsz8zE"
		},
		{
			title: "AWS re:Invent 2023 - The innovator’s mindset: Building adaptable & resilient organizations (INO103)",
			url: "https://www.youtube.com/watch?v=MqKkQYPafOo"
		},
		{
			title: "AWS re:Invent 2023 - Accelerate cloud operations at scale with a robust cloud foundation (NTA204)",
			url: "https://www.youtube.com/watch?v=sFhxjHt61G8"
		},
		{
			title: "AWS re:Invent 2023 - Application modernization, microservices & the strangler fig pattern (ENT321-R)",
			url: "https://www.youtube.com/watch?v=ml1Yb-ddGt0"
		},
		{
			title: "AWS re:Invent 2023 - Building Serverlesspresso: Creating event-driven architectures (SVS204)",
			url: "https://www.youtube.com/watch?v=cOQClEYryvU"
		},
		{
			title: "AWS re:Invent 2023 - New era of IaC: Effective Kubernetes management with cdk8s (BOA310)",
			url: "https://www.youtube.com/watch?v=qwt-qxX48T8"
		},
		{
			title: "AWS re:Invent 2023 - Harness AI/ML to drive innovation and unlock new opportunities (SMB202)",
			url: "https://www.youtube.com/watch?v=Ddb8CYx-WR8"
		},
		{
			title: "AWS re:Invent 2023 - Data protection and resilience with AWS storage (STG215-R)",
			url: "https://www.youtube.com/watch?v=rdG8JV3Fhk4"
		},
		{
			title: "AWS re:Invent 2023 - Building a practice to optimize your customer’s resilience journey (PEX208)",
			url: "https://www.youtube.com/watch?v=OPEQcRAMs0U"
		},
		{
			title: "AWS re:Invent 2023 - How to not sabotage your transformation (SEG201)",
			url: "https://www.youtube.com/watch?v=heLvxK5N8Aw"
		},
		{
			title: "AWS re:Invent 2023 - How ELF reduced their carbon footprint by broadcasting on AWS (MAE203)",
			url: "https://www.youtube.com/watch?v=5slS62EQsJ4"
		},
		{
			title: "AWS re:Invent 2023 - Dive deep into different AWS DMS migration options (DAT328)",
			url: "https://www.youtube.com/watch?v=82c8TXSVf7E"
		},
		{
			title: "AWS re:Invent 2023 - Generative AI for decision-makers (TNC214)",
			url: "https://www.youtube.com/watch?v=aRUoIUhjBHI"
		},
		{
			title: "AWS re:Invent 2023 - How Oaktree Capital saved 50% by modernizing its Microsoft workloads (ENT318)",
			url: "https://www.youtube.com/watch?v=WS13FvDxcjs"
		},
		{
			title: "AWS re:Invent 2023 - [LAUNCH] Lower costs by up to 97% with Amazon EFS Archive (STG228)",
			url: "https://www.youtube.com/watch?v=u0M1SYmC2_A"
		},
		{
			title: "AWS re:Invent 2023 - AWS storage for serverless application development (STG311-R)",
			url: "https://www.youtube.com/watch?v=9IygDiPoR34"
		},
		{
			title: "AWS re:Invent 2023 - Deploy gen AI apps efficiently at scale with serverless containers (CON303)",
			url: "https://www.youtube.com/watch?v=CbFuso1OscA"
		},
		{
			title: "AWS re:Invent 2023 - A developer’s guide to cloud networking (BOA207)",
			url: "https://www.youtube.com/watch?v=i77D556lrgY"
		},
		{
			title: "AWS re:Invent 2023 - Customer Keynote Riot Games",
			url: "https://www.youtube.com/watch?v=vlidizRzzWQ"
		},
		{
			title: "AWS re:Invent 2023 - Advanced event-driven patterns with Amazon EventBridge (COM301-R)",
			url: "https://www.youtube.com/watch?v=6X4lSPkn4ps"
		},
		{
			title: "AWS re:Invent 2023 - How to control bots and help prevent account fraud using AWS WAF (NET321)",
			url: "https://www.youtube.com/watch?v=AD2PBzhzIv8"
		},
		{
			title: "AWS re:Invent 2023 - The shortest path to Red Hat Enterprise Linux on AWS (ENT105-S)",
			url: "https://www.youtube.com/watch?v=4-pyPt-jFZM"
		},
		{
			title: "AWS re:Invent 2023 - Siemens Healthineers: How to achieve citizen integration at scale (BIZ215-S)",
			url: "https://www.youtube.com/watch?v=GeG7zdhwDhQ"
		},
		{
			title: "AWS re:Invent 2023 - Amazon Neptune architectures for scale, availability, and insight (DAT406)",
			url: "https://www.youtube.com/watch?v=xAdWa0Ahiok"
		},
		{
			title: "AWS re:Invent 2023 - Best practices for querying vector data for gen AI apps in PostgreSQL (DAT407)",
			url: "https://www.youtube.com/watch?v=PhIC4JlYg7A"
		},
		{
			title: "AWS re:Invent 2023 - From machine to digital services: Equipment as a service (MFG104)",
			url: "https://www.youtube.com/watch?v=mdP3LoYuW5Q"
		},
		{
			title: "AWS re:Invent 2023 - Monday Night Live Keynote with Peter DeSantis",
			url: "https://www.youtube.com/watch?v=pJG6nmR7XxI"
		}
	];

	/* src/App.svelte generated by Svelte v4.2.8 */

	const { console: console_1 } = globals;
	const file = "src/App.svelte";

	function get_each_context(ctx, list, i) {
		const child_ctx = ctx.slice();
		child_ctx[22] = list[i];
		return child_ctx;
	}

	function get_each_context_1(ctx, list, i) {
		const child_ctx = ctx.slice();
		child_ctx[25] = list[i];
		return child_ctx;
	}

	function get_each_context_2(ctx, list, i) {
		const child_ctx = ctx.slice();
		child_ctx[28] = list[i];
		return child_ctx;
	}

	// (213:16) {:else}
	function create_else_block_1(ctx) {
		let t0;
		let t1_value = /*bookmarks*/ ctx[4].length + "";
		let t1;
		let t2;

		const block = {
			c: function create() {
				t0 = text("Favorites (");
				t1 = text(t1_value);
				t2 = text(")");
			},
			m: function mount(target, anchor) {
				insert_dev(target, t0, anchor);
				insert_dev(target, t1, anchor);
				insert_dev(target, t2, anchor);
			},
			p: function update(ctx, dirty) {
				if (dirty & /*bookmarks*/ 16 && t1_value !== (t1_value = /*bookmarks*/ ctx[4].length + "")) set_data_dev(t1, t1_value);
			},
			d: function destroy(detaching) {
				if (detaching) {
					detach_dev(t0);
					detach_dev(t1);
					detach_dev(t2);
				}
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_else_block_1.name,
			type: "else",
			source: "(213:16) {:else}",
			ctx
		});

		return block;
	}

	// (211:16) {#if showBookmarked}
	function create_if_block_1(ctx) {
		let t;

		const block = {
			c: function create() {
				t = text("Show All");
			},
			m: function mount(target, anchor) {
				insert_dev(target, t, anchor);
			},
			p: noop,
			d: function destroy(detaching) {
				if (detaching) {
					detach_dev(t);
				}
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_if_block_1.name,
			type: "if",
			source: "(211:16) {#if showBookmarked}",
			ctx
		});

		return block;
	}

	// (224:12) {#each [100, 200, 300, 400] as level}
	function create_each_block_2(ctx) {
		let label;
		let input;
		let t0;
		let t1;
		let binding_group;
		let mounted;
		let dispose;
		binding_group = init_binding_group(/*$$binding_groups*/ ctx[14][1]);

		const block = {
			c: function create() {
				label = element("label");
				input = element("input");
				t0 = space();
				t1 = text(/*level*/ ctx[28]);
				attr_dev(input, "type", "checkbox");
				input.__value = /*level*/ ctx[28];
				set_input_value(input, input.__value);
				attr_dev(input, "class", "svelte-178chk5");
				add_location(input, file, 225, 20, 6209);
				attr_dev(label, "class", "svelte-178chk5");
				add_location(label, file, 224, 16, 6181);
				binding_group.p(input);
			},
			m: function mount(target, anchor) {
				insert_dev(target, label, anchor);
				append_dev(label, input);
				input.checked = ~(/*selectedLevels*/ ctx[3] || []).indexOf(input.__value);
				append_dev(label, t0);
				append_dev(label, t1);

				if (!mounted) {
					dispose = [
						listen_dev(input, "change", /*input_change_handler*/ ctx[13]),
						listen_dev(input, "change", /*filterVideos*/ ctx[7], false, false, false, false)
					];

					mounted = true;
				}
			},
			p: function update(ctx, dirty) {
				if (dirty & /*selectedLevels*/ 8) {
					input.checked = ~(/*selectedLevels*/ ctx[3] || []).indexOf(input.__value);
				}
			},
			d: function destroy(detaching) {
				if (detaching) {
					detach_dev(label);
				}

				binding_group.r();
				mounted = false;
				run_all(dispose);
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_each_block_2.name,
			type: "each",
			source: "(224:12) {#each [100, 200, 300, 400] as level}",
			ctx
		});

		return block;
	}

	// (231:12) {#each topics as topic}
	function create_each_block_1(ctx) {
		let label;
		let input;
		let t0;
		let t1_value = /*topic*/ ctx[25] + "";
		let t1;
		let t2;
		let binding_group;
		let mounted;
		let dispose;
		binding_group = init_binding_group(/*$$binding_groups*/ ctx[14][0]);

		const block = {
			c: function create() {
				label = element("label");
				input = element("input");
				t0 = space();
				t1 = text(t1_value);
				t2 = space();
				attr_dev(input, "type", "checkbox");
				input.__value = /*topic*/ ctx[25];
				set_input_value(input, input.__value);
				attr_dev(input, "class", "svelte-178chk5");
				add_location(input, file, 232, 20, 6491);
				attr_dev(label, "class", "svelte-178chk5");
				add_location(label, file, 231, 16, 6463);
				binding_group.p(input);
			},
			m: function mount(target, anchor) {
				insert_dev(target, label, anchor);
				append_dev(label, input);
				input.checked = ~(/*selectedTopics*/ ctx[2] || []).indexOf(input.__value);
				append_dev(label, t0);
				append_dev(label, t1);
				append_dev(label, t2);

				if (!mounted) {
					dispose = [
						listen_dev(input, "change", /*input_change_handler_1*/ ctx[15]),
						listen_dev(input, "change", /*filterVideos*/ ctx[7], false, false, false, false)
					];

					mounted = true;
				}
			},
			p: function update(ctx, dirty) {
				if (dirty & /*selectedTopics*/ 4) {
					input.checked = ~(/*selectedTopics*/ ctx[2] || []).indexOf(input.__value);
				}
			},
			d: function destroy(detaching) {
				if (detaching) {
					detach_dev(label);
				}

				binding_group.r();
				mounted = false;
				run_all(dispose);
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_each_block_1.name,
			type: "each",
			source: "(231:12) {#each topics as topic}",
			ctx
		});

		return block;
	}

	// (251:12) {:else}
	function create_else_block(ctx) {
		let p;

		const block = {
			c: function create() {
				p = element("p");
				p.textContent = "No videos found.";
				add_location(p, file, 251, 16, 7373);
			},
			m: function mount(target, anchor) {
				insert_dev(target, p, anchor);
			},
			p: noop,
			i: noop,
			o: noop,
			d: function destroy(detaching) {
				if (detaching) {
					detach_dev(p);
				}
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_else_block.name,
			type: "else",
			source: "(251:12) {:else}",
			ctx
		});

		return block;
	}

	// (239:12) {#if filteredVideos.length > 0}
	function create_if_block(ctx) {
		let each_blocks = [];
		let each_1_lookup = new Map();
		let each_1_anchor;
		let current;
		let each_value = ensure_array_like_dev(/*filteredVideos*/ ctx[0]);
		const get_key = ctx => /*video*/ ctx[22].url;
		validate_each_keys(ctx, each_value, get_each_context, get_key);

		for (let i = 0; i < each_value.length; i += 1) {
			let child_ctx = get_each_context(ctx, each_value, i);
			let key = get_key(child_ctx);
			each_1_lookup.set(key, each_blocks[i] = create_each_block(key, child_ctx));
		}

		const block = {
			c: function create() {
				for (let i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].c();
				}

				each_1_anchor = empty();
			},
			m: function mount(target, anchor) {
				for (let i = 0; i < each_blocks.length; i += 1) {
					if (each_blocks[i]) {
						each_blocks[i].m(target, anchor);
					}
				}

				insert_dev(target, each_1_anchor, anchor);
				current = true;
			},
			p: function update(ctx, dirty) {
				if (dirty & /*toggleBookmark, filteredVideos, bookmarks, getYoutubeVideoId*/ 1553) {
					each_value = ensure_array_like_dev(/*filteredVideos*/ ctx[0]);
					group_outros();
					validate_each_keys(ctx, each_value, get_each_context, get_key);
					each_blocks = update_keyed_each(each_blocks, dirty, get_key, 1, ctx, each_value, each_1_lookup, each_1_anchor.parentNode, outro_and_destroy_block, create_each_block, each_1_anchor, get_each_context);
					check_outros();
				}
			},
			i: function intro(local) {
				if (current) return;

				for (let i = 0; i < each_value.length; i += 1) {
					transition_in(each_blocks[i]);
				}

				current = true;
			},
			o: function outro(local) {
				for (let i = 0; i < each_blocks.length; i += 1) {
					transition_out(each_blocks[i]);
				}

				current = false;
			},
			d: function destroy(detaching) {
				if (detaching) {
					detach_dev(each_1_anchor);
				}

				for (let i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].d(detaching);
				}
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_if_block.name,
			type: "if",
			source: "(239:12) {#if filteredVideos.length > 0}",
			ctx
		});

		return block;
	}

	// (240:16) {#each filteredVideos as video (video.url)}
	function create_each_block(key_1, ctx) {
		let div1;
		let youtube;
		let t0;
		let div0;
		let h5;
		let t1_value = /*video*/ ctx[22].title + "";
		let t1;
		let t2;
		let span;
		let t3_value = (/*bookmarks*/ ctx[4].find(func) ? '🌟' : '☆') + "";
		let t3;
		let t4;
		let current;
		let mounted;
		let dispose;

		youtube = new Youtube({
				props: {
					id: /*getYoutubeVideoId*/ ctx[9](/*video*/ ctx[22].url)
				},
				$$inline: true
			});

		function func(...args) {
			return /*func*/ ctx[16](/*video*/ ctx[22], ...args);
		}

		function click_handler() {
			return /*click_handler*/ ctx[17](/*video*/ ctx[22]);
		}

		const block = {
			key: key_1,
			first: null,
			c: function create() {
				div1 = element("div");
				create_component(youtube.$$.fragment);
				t0 = space();
				div0 = element("div");
				h5 = element("h5");
				t1 = text(t1_value);
				t2 = space();
				span = element("span");
				t3 = text(t3_value);
				t4 = space();
				add_location(h5, file, 243, 28, 7012);
				attr_dev(span, "class", "bookmark-icon svelte-178chk5");
				add_location(span, file, 244, 28, 7063);
				attr_dev(div0, "class", "video-card-subtitle svelte-178chk5");
				add_location(div0, file, 242, 24, 6950);
				attr_dev(div1, "class", "video-card svelte-178chk5");
				add_location(div1, file, 240, 20, 6830);
				this.first = div1;
			},
			m: function mount(target, anchor) {
				insert_dev(target, div1, anchor);
				mount_component(youtube, div1, null);
				append_dev(div1, t0);
				append_dev(div1, div0);
				append_dev(div0, h5);
				append_dev(h5, t1);
				append_dev(div0, t2);
				append_dev(div0, span);
				append_dev(span, t3);
				append_dev(div1, t4);
				current = true;

				if (!mounted) {
					dispose = listen_dev(span, "click", click_handler, false, false, false, false);
					mounted = true;
				}
			},
			p: function update(new_ctx, dirty) {
				ctx = new_ctx;
				const youtube_changes = {};
				if (dirty & /*filteredVideos*/ 1) youtube_changes.id = /*getYoutubeVideoId*/ ctx[9](/*video*/ ctx[22].url);
				youtube.$set(youtube_changes);
				if ((!current || dirty & /*filteredVideos*/ 1) && t1_value !== (t1_value = /*video*/ ctx[22].title + "")) set_data_dev(t1, t1_value);
				if ((!current || dirty & /*bookmarks, filteredVideos*/ 17) && t3_value !== (t3_value = (/*bookmarks*/ ctx[4].find(func) ? '🌟' : '☆') + "")) set_data_dev(t3, t3_value);
			},
			i: function intro(local) {
				if (current) return;
				transition_in(youtube.$$.fragment, local);
				current = true;
			},
			o: function outro(local) {
				transition_out(youtube.$$.fragment, local);
				current = false;
			},
			d: function destroy(detaching) {
				if (detaching) {
					detach_dev(div1);
				}

				destroy_component(youtube);
				mounted = false;
				dispose();
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_each_block.name,
			type: "each",
			source: "(240:16) {#each filteredVideos as video (video.url)}",
			ctx
		});

		return block;
	}

	function create_fragment(ctx) {
		let main;
		let div1;
		let input;
		let t0;
		let div0;
		let button0;
		let t1;
		let button1;
		let t3;
		let div4;
		let div2;
		let h30;
		let t5;
		let t6;
		let h31;
		let t8;
		let t9;
		let div3;
		let current_block_type_index;
		let if_block1;
		let current;
		let mounted;
		let dispose;

		function select_block_type(ctx, dirty) {
			if (/*showBookmarked*/ ctx[5]) return create_if_block_1;
			return create_else_block_1;
		}

		let current_block_type = select_block_type(ctx);
		let if_block0 = current_block_type(ctx);
		let each_value_2 = ensure_array_like_dev([100, 200, 300, 400]);
		let each_blocks_1 = [];

		for (let i = 0; i < 4; i += 1) {
			each_blocks_1[i] = create_each_block_2(get_each_context_2(ctx, each_value_2, i));
		}

		let each_value_1 = ensure_array_like_dev(/*topics*/ ctx[6]);
		let each_blocks = [];

		for (let i = 0; i < each_value_1.length; i += 1) {
			each_blocks[i] = create_each_block_1(get_each_context_1(ctx, each_value_1, i));
		}

		const if_block_creators = [create_if_block, create_else_block];
		const if_blocks = [];

		function select_block_type_1(ctx, dirty) {
			if (/*filteredVideos*/ ctx[0].length > 0) return 0;
			return 1;
		}

		current_block_type_index = select_block_type_1(ctx);
		if_block1 = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

		const block = {
			c: function create() {
				main = element("main");
				div1 = element("div");
				input = element("input");
				t0 = space();
				div0 = element("div");
				button0 = element("button");
				if_block0.c();
				t1 = space();
				button1 = element("button");
				button1.textContent = "Clear Filters";
				t3 = space();
				div4 = element("div");
				div2 = element("div");
				h30 = element("h3");
				h30.textContent = "Filter by Level";
				t5 = space();

				for (let i = 0; i < 4; i += 1) {
					each_blocks_1[i].c();
				}

				t6 = space();
				h31 = element("h3");
				h31.textContent = "Filter by Topic";
				t8 = space();

				for (let i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].c();
				}

				t9 = space();
				div3 = element("div");
				if_block1.c();
				attr_dev(input, "placeholder", "Search for video titles");
				attr_dev(input, "class", "svelte-178chk5");
				add_location(input, file, 207, 8, 5576);
				attr_dev(button0, "class", "svelte-178chk5");
				add_location(button0, file, 209, 12, 5698);
				attr_dev(button1, "class", "svelte-178chk5");
				add_location(button1, file, 216, 12, 5938);
				add_location(div0, file, 208, 8, 5680);
				attr_dev(div1, "class", "top-bar svelte-178chk5");
				add_location(div1, file, 206, 4, 5546);
				attr_dev(h30, "class", "svelte-178chk5");
				add_location(h30, file, 222, 12, 6090);
				attr_dev(h31, "class", "svelte-178chk5");
				add_location(h31, file, 229, 12, 6386);
				attr_dev(div2, "class", "sidebar svelte-178chk5");
				add_location(div2, file, 221, 8, 6056);
				attr_dev(div3, "class", "main-content svelte-178chk5");
				add_location(div3, file, 237, 8, 6679);
				attr_dev(div4, "class", "container svelte-178chk5");
				add_location(div4, file, 220, 4, 6024);
				attr_dev(main, "class", "svelte-178chk5");
				add_location(main, file, 205, 0, 5535);
			},
			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},
			m: function mount(target, anchor) {
				insert_dev(target, main, anchor);
				append_dev(main, div1);
				append_dev(div1, input);
				set_input_value(input, /*searchInput*/ ctx[1]);
				append_dev(div1, t0);
				append_dev(div1, div0);
				append_dev(div0, button0);
				if_block0.m(button0, null);
				append_dev(div0, t1);
				append_dev(div0, button1);
				append_dev(main, t3);
				append_dev(main, div4);
				append_dev(div4, div2);
				append_dev(div2, h30);
				append_dev(div2, t5);

				for (let i = 0; i < 4; i += 1) {
					if (each_blocks_1[i]) {
						each_blocks_1[i].m(div2, null);
					}
				}

				append_dev(div2, t6);
				append_dev(div2, h31);
				append_dev(div2, t8);

				for (let i = 0; i < each_blocks.length; i += 1) {
					if (each_blocks[i]) {
						each_blocks[i].m(div2, null);
					}
				}

				append_dev(div4, t9);
				append_dev(div4, div3);
				if_blocks[current_block_type_index].m(div3, null);
				current = true;

				if (!mounted) {
					dispose = [
						listen_dev(input, "input", /*input_input_handler*/ ctx[12]),
						listen_dev(input, "input", /*filterVideos*/ ctx[7], false, false, false, false),
						listen_dev(button0, "click", /*filterBookmarkedVideos*/ ctx[11], false, false, false, false),
						listen_dev(button1, "click", /*clearFilters*/ ctx[8], false, false, false, false)
					];

					mounted = true;
				}
			},
			p: function update(ctx, [dirty]) {
				if (dirty & /*searchInput*/ 2 && input.value !== /*searchInput*/ ctx[1]) {
					set_input_value(input, /*searchInput*/ ctx[1]);
				}

				if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block0) {
					if_block0.p(ctx, dirty);
				} else {
					if_block0.d(1);
					if_block0 = current_block_type(ctx);

					if (if_block0) {
						if_block0.c();
						if_block0.m(button0, null);
					}
				}

				if (dirty & /*selectedLevels, filterVideos*/ 136) {
					each_value_2 = ensure_array_like_dev([100, 200, 300, 400]);
					let i;

					for (i = 0; i < 4; i += 1) {
						const child_ctx = get_each_context_2(ctx, each_value_2, i);

						if (each_blocks_1[i]) {
							each_blocks_1[i].p(child_ctx, dirty);
						} else {
							each_blocks_1[i] = create_each_block_2(child_ctx);
							each_blocks_1[i].c();
							each_blocks_1[i].m(div2, t6);
						}
					}

					for (; i < 4; i += 1) {
						each_blocks_1[i].d(1);
					}
				}

				if (dirty & /*topics, selectedTopics, filterVideos*/ 196) {
					each_value_1 = ensure_array_like_dev(/*topics*/ ctx[6]);
					let i;

					for (i = 0; i < each_value_1.length; i += 1) {
						const child_ctx = get_each_context_1(ctx, each_value_1, i);

						if (each_blocks[i]) {
							each_blocks[i].p(child_ctx, dirty);
						} else {
							each_blocks[i] = create_each_block_1(child_ctx);
							each_blocks[i].c();
							each_blocks[i].m(div2, null);
						}
					}

					for (; i < each_blocks.length; i += 1) {
						each_blocks[i].d(1);
					}

					each_blocks.length = each_value_1.length;
				}

				let previous_block_index = current_block_type_index;
				current_block_type_index = select_block_type_1(ctx);

				if (current_block_type_index === previous_block_index) {
					if_blocks[current_block_type_index].p(ctx, dirty);
				} else {
					group_outros();

					transition_out(if_blocks[previous_block_index], 1, 1, () => {
						if_blocks[previous_block_index] = null;
					});

					check_outros();
					if_block1 = if_blocks[current_block_type_index];

					if (!if_block1) {
						if_block1 = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
						if_block1.c();
					} else {
						if_block1.p(ctx, dirty);
					}

					transition_in(if_block1, 1);
					if_block1.m(div3, null);
				}
			},
			i: function intro(local) {
				if (current) return;
				transition_in(if_block1);
				current = true;
			},
			o: function outro(local) {
				transition_out(if_block1);
				current = false;
			},
			d: function destroy(detaching) {
				if (detaching) {
					detach_dev(main);
				}

				if_block0.d();
				destroy_each(each_blocks_1, detaching);
				destroy_each(each_blocks, detaching);
				if_blocks[current_block_type_index].d();
				mounted = false;
				run_all(dispose);
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_fragment.name,
			type: "component",
			source: "",
			ctx
		});

		return block;
	}

	function instance($$self, $$props, $$invalidate) {
		let { $$slots: slots = {}, $$scope } = $$props;
		validate_slots('App', slots, []);
		let filteredVideos = [...videos];
		let searchInput = "";
		let selectedTopics = [];
		let selectedLevels = [];
		let bookmarks = loadBookmarksFromUrl();
		let showBookmarked = false;

		let topics = [
			"DOP",
			"SEG",
			"BIZ",
			"ENT",
			"SEC",
			"SPT",
			"STG",
			"IMP",
			"ANT",
			"AIM",
			"SMB",
			"SAS",
			"WPS",
			"PEX",
			"NET",
			"MAE",
			"MFG",
			"LFS",
			"IOT",
			"IDE",
			"GDS",
			"GAM",
			"FWM",
			"FSI",
			"ENU",
			"CMP",
			"COM",
			"COP",
			"BWP",
			"BSI",
			"BOA",
			"SUP",
			"MKT",
			"ARC",
			"API",
			"AMZ",
			"AES",
			"ADM",
			"DAT",
			"BLC",
			"CEN",
			"HYB",
			"PRO",
			"XNT",
			"CON",
			"TLC",
			"SUS",
			"OPN",
			"PRT",
			"PEN",
			"NTA",
			"SVS",
			"ALX",
			"INO",
			"CPG",
			"HLC",
			"TNC",
			"NFX",
			"QTC",
			"RET",
			"ROB",
			"TRV",
			"EUC",
			"AUT",
			"GBL"
		];

		const filterVideos = () => {
			$$invalidate(0, filteredVideos = videos.filter(video => {
				const searchTerm = searchInput.toLowerCase();
				const title = video.title.toLowerCase();
				const topicMatch = selectedTopics.length === 0 || selectedTopics.includes(getTopicFromTitle(video.title));
				const levelMatch = selectedLevels.length === 0 || selectedLevels.map(level => `${level / 100}`).includes(getLevelFromTitle(video.title));
				return title.includes(searchTerm) && topicMatch && levelMatch;
			}));
		};

		const clearFilters = () => {
			$$invalidate(1, searchInput = "");
			$$invalidate(2, selectedTopics = []);
			$$invalidate(3, selectedLevels = []);
			$$invalidate(0, filteredVideos = [...videos]);
		};

		const getTopicFromTitle = title => {
			const match = title.match(/\((\w{3})\d{3}\)/);
			console.log(title);
			return match ? match[1] : "";
		};

		const getLevelFromTitle = title => {
			const match = title.match(/\((\w{3})(\d{3})\)/);
			return match ? match[2].substring(0, 1) : "";
		};

		const getYoutubeVideoId = url => {
			const match = url.match(/[?&]v=([^#&?]{11})/);
			return match ? match[1] : "";
		};

		function loadBookmarksFromUrl() {
			const urlParams = new URLSearchParams(window.location.search);
			const encodedBookmarks = urlParams.get('bookmarks');

			if (encodedBookmarks) {
				// Decode the URL-encoded and compressed string
				const compressedString = decodeURIComponent(encodedBookmarks);

				const decompressedString = lz.decompressFromEncodedURIComponent(compressedString);
				return JSON.parse(decompressedString);
			}

			return [];
		}

		function updateUrlWithBookmarks(bookmarks) {
			const jsonBookmarks = JSON.stringify(bookmarks);
			const compressedString = lz.compressToEncodedURIComponent(jsonBookmarks);
			const urlParams = new URLSearchParams();
			urlParams.set('bookmarks', compressedString);
			window.history.replaceState({}, document.title, `?${urlParams.toString()}`);
		}

		const toggleBookmark = video => {
			const index = bookmarks.findIndex(b => b.url === video.url);

			if (index === -1) {
				// Video not bookmarked, add it to bookmarks
				$$invalidate(4, bookmarks = [...bookmarks, video]);
			} else {
				// Video already bookmarked, remove it from bookmarks
				$$invalidate(4, bookmarks = bookmarks.filter((b, i) => i !== index));
			}

			localStorage.setItem('bookmarks', JSON.stringify(bookmarks));
			updateUrlWithBookmarks(bookmarks);
		};

		const filterBookmarkedVideos = () => {
			$$invalidate(5, showBookmarked = !showBookmarked);

			if (showBookmarked) {
				$$invalidate(0, filteredVideos = bookmarks);
			} else {
				filterVideos(); // Restore original filters
			}
		};

		onMount(() => {
			filterVideos();
		});

		const writable_props = [];

		Object.keys($$props).forEach(key => {
			if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1.warn(`<App> was created with unknown prop '${key}'`);
		});

		const $$binding_groups = [[], []];

		function input_input_handler() {
			searchInput = this.value;
			$$invalidate(1, searchInput);
		}

		function input_change_handler() {
			selectedLevels = get_binding_group_value($$binding_groups[1], this.__value, this.checked);
			$$invalidate(3, selectedLevels);
		}

		function input_change_handler_1() {
			selectedTopics = get_binding_group_value($$binding_groups[0], this.__value, this.checked);
			$$invalidate(2, selectedTopics);
		}

		const func = (video, b) => b.url === video.url;
		const click_handler = video => toggleBookmark(video);

		$$self.$capture_state = () => ({
			onMount,
			lz,
			Youtube,
			videos,
			filteredVideos,
			searchInput,
			selectedTopics,
			selectedLevels,
			bookmarks,
			showBookmarked,
			topics,
			filterVideos,
			clearFilters,
			getTopicFromTitle,
			getLevelFromTitle,
			getYoutubeVideoId,
			loadBookmarksFromUrl,
			updateUrlWithBookmarks,
			toggleBookmark,
			filterBookmarkedVideos
		});

		$$self.$inject_state = $$props => {
			if ('filteredVideos' in $$props) $$invalidate(0, filteredVideos = $$props.filteredVideos);
			if ('searchInput' in $$props) $$invalidate(1, searchInput = $$props.searchInput);
			if ('selectedTopics' in $$props) $$invalidate(2, selectedTopics = $$props.selectedTopics);
			if ('selectedLevels' in $$props) $$invalidate(3, selectedLevels = $$props.selectedLevels);
			if ('bookmarks' in $$props) $$invalidate(4, bookmarks = $$props.bookmarks);
			if ('showBookmarked' in $$props) $$invalidate(5, showBookmarked = $$props.showBookmarked);
			if ('topics' in $$props) $$invalidate(6, topics = $$props.topics);
		};

		if ($$props && "$$inject" in $$props) {
			$$self.$inject_state($$props.$$inject);
		}

		return [
			filteredVideos,
			searchInput,
			selectedTopics,
			selectedLevels,
			bookmarks,
			showBookmarked,
			topics,
			filterVideos,
			clearFilters,
			getYoutubeVideoId,
			toggleBookmark,
			filterBookmarkedVideos,
			input_input_handler,
			input_change_handler,
			$$binding_groups,
			input_change_handler_1,
			func,
			click_handler
		];
	}

	class App extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, instance, create_fragment, safe_not_equal, {});

			dispatch_dev("SvelteRegisterComponent", {
				component: this,
				tagName: "App",
				options,
				id: create_fragment.name
			});
		}
	}

	const app = new App({
		target: document.body,
		props: {
			name: 'world'
		}
	});

	return app;

})();
//# sourceMappingURL=bundle.js.map
