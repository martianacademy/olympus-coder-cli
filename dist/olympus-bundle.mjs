import { execFile, spawn, spawnSync } from "node:child_process";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { createInterface } from "node:readline/promises";
import { Readable, Writable } from "node:stream";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
// ../code-for-antigravity/node_modules/@agentclientprotocol/sdk/dist/v1/unstable/schema/index.js
var AGENT_METHODS = {
	initialize: "initialize",
	authenticate: "authenticate",
	providers_list: "providers/list",
	providers_set: "providers/set",
	providers_disable: "providers/disable",
	session_new: "session/new",
	session_load: "session/load",
	session_set_mode: "session/set_mode",
	session_set_config_option: "session/set_config_option",
	session_prompt: "session/prompt",
	session_cancel: "session/cancel",
	mcp_message: "mcp/message",
	session_list: "session/list",
	session_delete: "session/delete",
	session_fork: "session/fork",
	session_archive: "session/archive",
	session_unarchive: "session/unarchive",
	session_status: "session/status",
	session_options: "session/options",
	session_set_title: "session/set_title",
	session_resume: "session/resume",
	session_close: "session/close",
	logout: "logout",
	auth_status: "auth/status"
};
var CLIENT_METHODS = {
	session_request_permission: "session/request_permission",
	session_update: "session/update",
	fs_write_text_file: "fs/write_text_file",
	fs_read_text_file: "fs/read_text_file",
	terminal_create: "terminal/create",
	terminal_output: "terminal/output",
	terminal_release: "terminal/release",
	terminal_wait_for_exit: "terminal/wait_for_exit",
	terminal_kill: "terminal/kill",
	mcp_message: "mcp/message",
	elicitation_create: "elicitation/create",
	elicitation_complete: "elicitation/complete",
	auth_status_update: "auth/status_update"
};
var PROTOCOL_METHODS = { cancel_request: "$/cancel_request" };
// ../code-for-antigravity/node_modules/zod/v4/core/util.js
function getEnumValues(entries) {
	const numericValues = Object.values(entries).filter((v) => typeof v === "number");
	return Object.entries(entries).filter(([k, _]) => numericValues.indexOf(+k) === -1).map(([_, v]) => v);
}
function joinValues(array, separator = "|") {
	return array.map((val) => stringifyPrimitive(val)).join(separator);
}
function jsonStringifyReplacer(_, value) {
	if (typeof value === "bigint") return value.toString();
	return value;
}
var Cached = class {
	constructor(getter) {
		this._getter = getter;
		this._value = void 0;
	}
	get value() {
		const getter = this._getter;
		if (getter !== void 0) {
			this._value = getter();
			this._getter = void 0;
		}
		return this._value;
	}
};
function cached(getter) {
	return new Cached(getter);
}
function nullish(input) {
	return input === null || input === void 0;
}
function cleanRegex(source) {
	const start = source.startsWith("^") ? 1 : 0;
	const end = source.endsWith("$") ? source.length - 1 : source.length;
	return source.slice(start, end);
}
function floatSafeRemainder(val, step) {
	const ratio = val / step;
	const roundedRatio = Math.round(ratio);
	const tolerance = 4 * Number.EPSILON * Math.max(Math.abs(ratio), 1);
	if (Math.abs(ratio - roundedRatio) < tolerance) return 0;
	return ratio - roundedRatio;
}
function assignProp(target, prop, value) {
	Object.defineProperty(target, prop, {
		value,
		writable: true,
		enumerable: true,
		configurable: true
	});
}
/**
* Whichever object a def's `shape` currently answers from: the one the caller passed until the first read, the frozen copy after it.
*
* Its keys and descriptors read without invoking anything, which is what lets a discriminated union check its discriminator, and the cycle walk read a shape, without resolving a getter that references the schema being constructed. A def that answers `shape` from an accessor of its own has none.
*/
function rawShape(def) {
	const desc = Object.getOwnPropertyDescriptor(def, "shape");
	return desc?.get ? desc.get.raw : desc?.value;
}
function sourceShape(schema) {
	return rawShape(schema._zod.def) ?? schema._zod.def.shape;
}
function deferProp(target, key, getter) {
	Object.defineProperty(target, key, {
		get() {
			const value = getter();
			assignProp(this, key, value);
			return value;
		},
		enumerable: true,
		configurable: true
	});
}
function putProp(target, key, value) {
	if (key in target) assignProp(target, key, value);
	else target[key] = value;
}
/**
* Copies `keys` of `source`'s shape onto `target`, each value passed through `wrap`.
*
* A key the source has resolved is copied through now, so the derived shape states it outright and nothing has to resolve it to learn what it holds. A key the source still defers stays deferred, and reads back through the source's own `shape`, so it resolves once and both shapes get that one schema.
*/
function mirrorShape(target, source, keys, wrap) {
	const raw = sourceShape(source);
	for (const key of keys) {
		const desc = Object.getOwnPropertyDescriptor(raw, key);
		if (!desc.enumerable) continue;
		if (desc.get) deferProp(target, key, () => {
			const value = source._zod.def.shape[key];
			return wrap ? wrap(value, key) : value;
		});
		else putProp(target, key, wrap ? wrap(desc.value, key) : desc.value);
	}
}
function mirrorProps(target, source) {
	for (const key of Reflect.ownKeys(source)) {
		const desc = Object.getOwnPropertyDescriptor(source, key);
		if (!desc.enumerable) continue;
		if (desc.get) deferProp(target, key, () => source[key]);
		else putProp(target, key, desc.value);
	}
}
function mergeDefs(...defs) {
	const mergedDescriptors = {};
	for (const def of defs) {
		const descriptors = Object.getOwnPropertyDescriptors(def);
		Object.assign(mergedDescriptors, descriptors);
	}
	return Object.defineProperties({}, mergedDescriptors);
}
function esc(str) {
	return JSON.stringify(str);
}
function slugify(input) {
	return input.toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/[\s_-]+/g, "-").replace(/^-+|-+$/g, "");
}
var captureStackTrace = "captureStackTrace" in Error ? Error.captureStackTrace : (..._args) => {};
function isObject(data) {
	return typeof data === "object" && data !== null && !Array.isArray(data);
}
var allowsEval = /* @__PURE__*/ cached(() => {
	if (globalConfig.jitless) return false;
	if (typeof navigator !== "undefined" && navigator?.userAgent?.includes("Cloudflare")) return false;
	try {
		new Function("");
		return true;
	} catch (_) {
		return false;
	}
});
function isPlainObject(o) {
	if (isObject(o) === false) return false;
	const ctor = o.constructor;
	if (ctor === void 0) return true;
	if (typeof ctor !== "function") return true;
	const prot = ctor.prototype;
	if (isObject(prot) === false) return false;
	if (Object.prototype.hasOwnProperty.call(prot, "isPrototypeOf") === false) return false;
	return true;
}
function shallowClone(o) {
	if (isPlainObject(o)) return { ...o };
	if (Array.isArray(o)) return [...o];
	if (o instanceof Map) return new Map(o);
	if (o instanceof Set) return new Set(o);
	return o;
}
var propertyKeyTypes = /* @__PURE__*/ new Set([
	"string",
	"number",
	"symbol"
]);
function escapeRegex(str) {
	return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function clone(inst, def, params) {
	const cl = new inst._zod.constr(def ?? inst._zod.def);
	if (!def || params?.parent) cl._zod.parent = inst;
	return cl;
}
function normalizeParams(_params) {
	const params = _params;
	if (!params) return {};
	if (typeof params === "string") return { error: () => params };
	if (params?.message !== void 0) {
		if (params?.error !== void 0) throw new Error("Cannot specify both `message` and `error` params");
		params.error = params.message;
	}
	delete params.message;
	if (typeof params.error === "string") return {
		...params,
		error: () => params.error
	};
	return params;
}
function stringifyPrimitive(value) {
	if (typeof value === "bigint") return value.toString() + "n";
	if (typeof value === "string") return `"${value}"`;
	return `${value}`;
}
function optionalKeys(shape) {
	return Object.keys(shape).filter((k) => {
		return shape[k]._zod.optin !== void 0 && shape[k]._zod.optout === "optional";
	});
}
var NUMBER_FORMAT_RANGES = /*@__PURE__*/ (() => ({
	safeint: [Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER],
	int32: [-2147483648, 2147483647],
	uint32: [0, 4294967295],
	float32: [-34028234663852886e22, 34028234663852886e22],
	float64: [-Number.MAX_VALUE, Number.MAX_VALUE]
}))();
var BIGINT_FORMAT_RANGES = {
	int64: [/* @__PURE__*/ BigInt("-9223372036854775808"), /* @__PURE__*/ BigInt("9223372036854775807")],
	uint64: [/* @__PURE__*/ BigInt(0), /* @__PURE__*/ BigInt("18446744073709551615")]
};
function pick(schema, mask) {
	const currDef = schema._zod.def;
	const checks = currDef.checks;
	if (checks && checks.length > 0) throw new Error(".pick() cannot be used on object schemas containing refinements");
	const newShape = {};
	mirrorShape(newShape, schema, maskedKeys(schema, mask));
	return clone(schema, mergeDefs(currDef, {
		shape: newShape,
		checks: []
	}));
}
function maskedKeys(schema, mask) {
	const raw = sourceShape(schema);
	const keys = [];
	for (const key of Reflect.ownKeys(mask)) {
		if (!Object.getOwnPropertyDescriptor(raw, key)?.enumerable) throw new Error(`Unrecognized key: "${String(key)}"`);
		if (mask[key]) keys.push(key);
	}
	return keys;
}
function omit(schema, mask) {
	const currDef = schema._zod.def;
	const checks = currDef.checks;
	if (checks && checks.length > 0) throw new Error(".omit() cannot be used on object schemas containing refinements");
	const omitted = new Set(maskedKeys(schema, mask));
	const newShape = {};
	mirrorShape(newShape, schema, Reflect.ownKeys(sourceShape(schema)).filter((key) => !omitted.has(key)));
	return clone(schema, mergeDefs(currDef, {
		shape: newShape,
		checks: []
	}));
}
function extend(schema, shape) {
	if (!isPlainObject(shape)) throw new Error("Invalid input to extend: expected a plain object");
	const checks = schema._zod.def.checks;
	if (checks && checks.length > 0) {
		const existingShape = sourceShape(schema);
		for (const key of Reflect.ownKeys(shape)) if (Object.getOwnPropertyDescriptor(existingShape, key) !== void 0) throw new Error("Cannot overwrite keys on object schemas containing refinements. Use `.safeExtend()` instead.");
	}
	return clone(schema, mergeDefs(schema._zod.def, { shape: extended(schema, shape) }));
}
function extended(schema, shape) {
	const newShape = {};
	mirrorShape(newShape, schema, Reflect.ownKeys(sourceShape(schema)));
	mirrorProps(newShape, shape);
	return newShape;
}
function safeExtend(schema, shape) {
	if (!isPlainObject(shape)) throw new Error("Invalid input to safeExtend: expected a plain object");
	return clone(schema, mergeDefs(schema._zod.def, { shape: extended(schema, shape) }));
}
function merge(a, b) {
	if (!b?._zod?.def) throw new Error("Invalid input to merge: expected an object schema. To merge a plain shape, use `.extend()`.");
	if (a._zod.def.checks?.length) throw new Error(".merge() cannot be used on object schemas containing refinements. Use .safeExtend() instead.");
	const newShape = {};
	mirrorShape(newShape, a, Reflect.ownKeys(sourceShape(a)));
	mirrorShape(newShape, b, Reflect.ownKeys(sourceShape(b)));
	return clone(a, mergeDefs(a._zod.def, {
		shape: newShape,
		get catchall() {
			return b._zod.def.catchall;
		},
		checks: b._zod.def.checks ?? []
	}));
}
function partial(Class, schema, mask, name = "partial") {
	const checks = schema._zod.def.checks;
	if (checks && checks.length > 0) throw new Error(`.${name}() cannot be used on object schemas containing refinements`);
	const selected = mask ? new Set(maskedKeys(schema, mask)) : void 0;
	const newShape = {};
	mirrorShape(newShape, schema, Reflect.ownKeys(sourceShape(schema)), Class && ((value, key) => selected && !selected.has(key) ? value : new Class({
		type: "optional",
		innerType: value
	})));
	return clone(schema, mergeDefs(schema._zod.def, {
		shape: newShape,
		checks: []
	}));
}
function required(Class, schema, mask) {
	const selected = mask ? new Set(maskedKeys(schema, mask)) : void 0;
	const newShape = {};
	mirrorShape(newShape, schema, Reflect.ownKeys(sourceShape(schema)), (value, key) => selected && !selected.has(key) ? value : new Class({
		type: "nonoptional",
		innerType: value
	}));
	return clone(schema, mergeDefs(schema._zod.def, { shape: newShape }));
}
function aborted(x, startIndex = 0) {
	if (x.aborted === true) return true;
	for (let i = startIndex; i < x.issues.length; i++) if (x.issues[i]?.continue !== true) return true;
	return false;
}
function explicitlyAborted(x, startIndex = 0) {
	if (x.aborted === true) return true;
	for (let i = startIndex; i < x.issues.length; i++) if (x.issues[i]?.continue === false) return true;
	return false;
}
function prefixIssues(path, issues) {
	return issues.map((iss) => {
		var _a;
		(_a = iss).path ?? (_a.path = []);
		iss.path.unshift(path);
		return iss;
	});
}
function unwrapMessage(message) {
	return typeof message === "string" ? message : message?.message;
}
/** The leading size checks of `defChecks` that set an upper bound, each paired with it. */
function sizeCaps(defChecks) {
	const caps = [];
	for (const ch of defChecks ?? []) {
		const d = ch._zod.def;
		if (!/_(length|size)$|_equals$/.test(d.check)) break;
		const max = d.maximum ?? d.length ?? d.size;
		if (max >= 0) caps.push([max, ch]);
	}
	return caps;
}
function attachSchema(issues, start, inst) {
	var _a;
	for (let i = start; i < issues.length; i++) (_a = issues[i]).schema ?? (_a.schema = inst);
}
function finalizeIssue(iss, ctx, config) {
	var _a;
	const traits = iss.inst?._zod?.traits;
	if (traits?.has("$ZodType")) {
		if (traits.has("$ZodCheck")) (_a = iss).schema ?? (_a.schema = iss.inst);
		else iss.schema = iss.inst;
	}
	const schemaError = iss.schema !== iss.inst ? iss.schema?._zod.def?.error : void 0;
	const message = iss.message ? iss.message : unwrapMessage(iss.inst?._zod.def?.error?.(iss)) ?? unwrapMessage(schemaError?.(iss)) ?? unwrapMessage(ctx?.error?.(iss)) ?? unwrapMessage(config.customError?.(iss)) ?? unwrapMessage(config.localeError?.(iss)) ?? "Invalid input";
	const full = {};
	for (const k of Object.keys(iss)) {
		if (k === "inst" || k === "schema" || k === "continue" || k === "input" || k === "__proto__") continue;
		full[k] = iss[k];
	}
	full.path ?? (full.path = []);
	full.message = message;
	if (ctx?.reportInput) full.input = iss.input;
	return full;
}
var highSurrogate = /[\uD800-\uDBFF]/;
function codePointLength(str) {
	const units = str.length;
	if (!highSurrogate.test(str)) return units;
	let count = units;
	for (let i = 0; i < units - 1; i++) if ((str.charCodeAt(i) & 64512) === 55296 && (str.charCodeAt(i + 1) & 64512) === 56320) {
		count--;
		i++;
	}
	return count;
}
function getLengthableOrigin(input) {
	if (Array.isArray(input)) return "array";
	if (typeof input === "string") return "string";
	return "unknown";
}
function parsedType(data) {
	const t = typeof data;
	switch (t) {
		case "number": return Number.isNaN(data) ? "nan" : "number";
		case "object": {
			if (data === null) return "null";
			if (Array.isArray(data)) return "array";
			const obj = data;
			if (obj && Object.getPrototypeOf(obj) !== Object.prototype && "constructor" in obj && obj.constructor) return obj.constructor.name;
		}
	}
	return t;
}
function issue(...args) {
	const [iss, input, inst] = args;
	if (typeof iss === "string") return {
		message: iss,
		code: "custom",
		input,
		inst
	};
	return { ...iss };
}
/**
* Installs a trait's members on its prototype. Each value builds that member for the instance on first read; the built value shadows the accessor as an own property, so a detached `const { parse } = schema` keeps working.
*
* Call this from a `proto` initializer, which runs once per prototype — never per instance.
*/
function members(proto, table) {
	for (const key in table) {
		const desc = Object.getOwnPropertyDescriptor(table, key);
		if (desc.get) Object.defineProperty(proto, key, {
			...desc,
			enumerable: false
		});
		else defineBound(proto, key, desc.value);
	}
}
/** Shadows a prototype member with an own value, so a getter that builds from the instance runs once. */
function own(inst, key, value, enumerable = true) {
	Object.defineProperty(inst, key, {
		configurable: true,
		writable: true,
		enumerable,
		value
	});
	return value;
}
/** Like {@link own}, for a member that was never an own data property and has to stay out of `Object.keys`. */
function hide(inst, key, value) {
	return own(inst, key, value, false);
}
/** Adds members a table derives from the instance: each builds on first read and shadows as own data, and assignment shadows the same way, as when these were own properties. */
/* @__NO_SIDE_EFFECTS__ */
function derived(computes, table) {
	for (const key in computes) {
		const compute = computes[key];
		Object.defineProperty(table, key, {
			configurable: true,
			enumerable: true,
			get() {
				return own(this, key, compute(this));
			},
			set(value) {
				own(this, key, value);
			}
		});
	}
	return table;
}
function defineBound(proto, key, fn) {
	Object.defineProperty(proto, key, {
		configurable: true,
		get() {
			return this == null ? fn : own(this, key, fn.bind(this));
		},
		set(value) {
			own(this, key, value);
		}
	});
}
/** Returns the prototype to install on, or `undefined` if this group is already installed on it. */
function claim(inst, sentinel) {
	const proto = Object.getPrototypeOf(inst);
	return sentinel in proto ? void 0 : proto;
}
var installing;
var broke = false;
var breaker = {
	configurable: true,
	get() {
		broke = true;
	}
};
/**
* Installs a lazily-derived internal on the `_zod` prototype of `inst`'s
* constructor, computed from the internals object itself and cached there on
* first read. One accessor per constructor rather than one per instance.
*/
function defineLazyInternal(inst, key, compute) {
	const proto = Object.getPrototypeOf(inst._zod);
	if (key in proto && installing !== inst._zod) {
		installing = void 0;
		return;
	}
	installing = inst._zod;
	Object.defineProperty(proto, key, {
		configurable: true,
		get() {
			Object.defineProperty(this, key, breaker);
			const outer = broke;
			broke = false;
			try {
				const value = compute(this);
				if (broke) delete this[key];
				else Object.defineProperty(this, key, {
					configurable: true,
					writable: true,
					value
				});
				broke = broke || outer;
				return value;
			} catch (err) {
				delete this[key];
				broke = broke || outer;
				throw err;
			}
		},
		set(value) {
			Object.defineProperty(this, key, {
				configurable: true,
				writable: true,
				value
			});
		}
	});
}
/**
* Installs `key` on `inst`'s prototype, computed by `make` on first read and cached there as an own
* data property. One accessor per constructor rather than one per instance, because an own accessor
* puts every instance after the first into v8 dictionary mode. The key doubles as the sentinel.
*/
function installLazyProp(inst, key, make, enumerable) {
	const proto = claim(inst, key);
	if (!proto) return;
	Object.defineProperty(proto, key, {
		configurable: true,
		get() {
			const desc = {
				configurable: true,
				writable: true,
				enumerable,
				value: void 0
			};
			Object.defineProperty(this, key, desc);
			desc.value = make(this);
			Object.defineProperty(this, key, desc);
			return desc.value;
		},
		set(value) {
			Object.defineProperty(this, key, {
				configurable: true,
				writable: true,
				enumerable,
				value
			});
		}
	});
}
/** Marks the thunk `_catch` synthesises for a constant catch value. `Function.length` cannot tell that thunk from a user callback — rest and defaulted parameters both report arity 0 — and a user callback reads `ctx.error`, whose issues only finalize correctly against the caller's per-parse error map. Provenance can say what arity cannot. A plain string key rather than `Symbol.for`, whose call at module scope no bundler can prove pure — the same shape that anchored `urlCanParse` into every build. */
var CONSTANT_CATCH = "~constantCatch";
/** Wraps a constant catch value in a thunk tagged with {@link CONSTANT_CATCH}. */
function constantCatch(value) {
	const fn = () => value;
	fn[CONSTANT_CATCH] = true;
	return fn;
}
// ../code-for-antigravity/node_modules/zod/v4/core/core.js
var _a$1;
/** A special constant with type `never` */
var NEVER = /*@__PURE__*/ Object.freeze({ status: "aborted" });
var _zodDesc = {
	value: void 0,
	enumerable: false
};
var _E = "captureStackTrace" in Error ? Error : null;
function newError(Definition) {
	const E = _E;
	if (E) {
		const saved = E.stackTraceLimit;
		if (typeof saved === "number") {
			try {
				E.stackTraceLimit = 0;
			} catch {
				_E = null;
				return new Definition();
			}
			try {
				return new Definition();
			} finally {
				E.stackTraceLimit = saved;
			}
		}
	}
	return new Definition();
}
/* @__NO_SIDE_EFFECTS__ */
function $constructor(name, initializer, proto, params) {
	const zodProto = {};
	function Internals(def) {
		this.def = def;
		this.constr = _;
		this.traits = /* @__PURE__ */ new Set();
	}
	Internals.prototype = zodProto;
	const protoMembers = proto;
	const initialized = protoMembers && /* @__PURE__ */ new WeakSet();
	function init(inst, def) {
		if (!inst._zod) {
			_zodDesc.value = new Internals(def);
			try {
				Object.defineProperty(inst, "_zod", _zodDesc);
			} finally {
				_zodDesc.value = void 0;
			}
		} else if (inst._zod.traits.has(name)) return;
		inst._zod.traits.add(name);
		initializer(inst, def);
		if (initialized) {
			const own = Object.getPrototypeOf(inst);
			const ctorProto = inst._zod.constr.prototype;
			let up = own;
			while (up && up !== ctorProto) up = Object.getPrototypeOf(up);
			const target = up ?? own;
			if (!initialized.has(target)) {
				initialized.add(target);
				members(target, protoMembers);
			}
		}
		const proto = _.prototype;
		for (const k in proto) {
			if (!Object.prototype.hasOwnProperty.call(proto, k)) continue;
			if (!(k in inst)) inst[k] = proto[k].bind(inst);
		}
	}
	const Parent = params?.Parent ?? Object;
	class Definition extends Parent {}
	Object.defineProperty(Definition, "name", { value: name });
	function _(def) {
		const inst = params?.Parent ? newError(Definition) : this;
		init(inst, def);
		const deferred = inst._zod.deferred;
		if (deferred) {
			for (const fn of deferred) fn();
			inst._zod.deferred = void 0;
		}
		const pp = globalThis.__zod_globalConfig?.postProcessor;
		if (pp) pp(inst);
		return inst;
	}
	Object.defineProperty(_, "init", { value: init });
	Object.defineProperty(_, Symbol.hasInstance, { value: (inst) => {
		if (params?.Parent && inst instanceof params.Parent) return true;
		return inst?._zod?.traits?.has(name);
	} });
	Object.defineProperty(_, "name", { value: name });
	return _;
}
var $ZodAsyncError = class extends Error {
	constructor() {
		super(`Encountered Promise during synchronous parse. Use .parseAsync() instead.`);
	}
};
var $ZodEncodeError = class extends Error {
	constructor(name) {
		super(`Encountered unidirectional transform during encode: ${name}`);
		this.name = "ZodEncodeError";
	}
};
(_a$1 = globalThis).__zod_globalConfig ?? (_a$1.__zod_globalConfig = {});
var globalConfig = globalThis.__zod_globalConfig;
function config(newConfig) {
	if (newConfig) Object.assign(globalConfig, newConfig);
	return globalConfig;
}
// ../code-for-antigravity/node_modules/zod/v4/core/errors.js
function _getMessage() {
	const internals = this._zod;
	internals.message ?? (internals.message = JSON.stringify(internals.def, jsonStringifyReplacer, 2));
	return internals.message;
}
function _setMessage(value) {
	this._zod.message = value;
}
var _messageDesc = {
	get: _getMessage,
	set: _setMessage,
	enumerable: true,
	configurable: true
};
var _issuesDesc = {
	value: void 0,
	enumerable: false
};
var _installedToString = /* @__PURE__ */ new WeakSet([Object.prototype, Error.prototype]);
var initializer$1 = (inst, def) => {
	inst.name = "$ZodError";
	_issuesDesc.value = def;
	Object.defineProperty(inst, "issues", _issuesDesc);
	_issuesDesc.value = void 0;
	Object.defineProperty(inst, "message", _messageDesc);
	const proto = Object.getPrototypeOf(inst);
	if (!_installedToString.has(proto)) {
		_installedToString.add(proto);
		Object.defineProperty(proto, "toString", {
			configurable: true,
			enumerable: false,
			get() {
				const value = () => this.message;
				Object.defineProperty(this, "toString", {
					value,
					configurable: true,
					writable: true
				});
				return value;
			},
			set(value) {
				Object.defineProperty(this, "toString", {
					value,
					configurable: true,
					writable: true
				});
			}
		});
	}
};
var $ZodError = /* @__PURE__ */ $constructor("$ZodError", initializer$1);
/** Get-or-create `obj[key]` as an own data property. A path segment naming an inherited member
* ("toString", "constructor") would otherwise read through to the prototype, and assigning
* "__proto__" would hit the setter instead of creating a key. */
function node(obj, key, make) {
	if (!Object.prototype.hasOwnProperty.call(obj, key)) {
		if (key === "__proto__") Object.defineProperty(obj, key, {
			value: make(),
			writable: true,
			enumerable: true,
			configurable: true
		});
		else obj[key] = make();
	}
	return obj[key];
}
function flattenError(error, mapper = (issue) => issue.message) {
	const fieldErrors = {};
	const formErrors = [];
	for (const sub of error.issues) if (sub.path.length > 0) node(fieldErrors, sub.path[0], () => []).push(mapper(sub));
	else formErrors.push(mapper(sub));
	return {
		formErrors,
		fieldErrors
	};
}
function formatError(error, mapper = (issue) => issue.message) {
	const fieldErrors = { _errors: [] };
	const processError = (error, path = []) => {
		for (const issue of error.issues) if (issue.code === "invalid_union" && issue.errors.length) issue.errors.map((issues) => processError({ issues }, [...path, ...issue.path]));
		else if (issue.code === "invalid_key") processError({ issues: issue.issues }, [...path, ...issue.path]);
		else if (issue.code === "invalid_element") processError({ issues: issue.issues }, [...path, ...issue.path]);
		else {
			const fullpath = [...path, ...issue.path];
			if (fullpath.length === 0) fieldErrors._errors.push(mapper(issue));
			else {
				let curr = fieldErrors;
				let i = 0;
				while (i < fullpath.length) {
					const el = fullpath[i];
					const terminal = i === fullpath.length - 1;
					if (el === "_errors") {
						if (terminal) curr._errors.push(mapper(issue));
						i++;
						continue;
					}
					if (!Object.prototype.hasOwnProperty.call(curr, el)) Object.defineProperty(curr, el, {
						value: { _errors: [] },
						enumerable: true,
						writable: true,
						configurable: true
					});
					const node = curr[el];
					if (terminal) node._errors.push(mapper(issue));
					curr = node;
					i++;
				}
			}
		}
	};
	processError(error);
	return fieldErrors;
}
// ../code-for-antigravity/node_modules/zod/v4/core/parse.js
function finalizeParams(callee, params) {
	return {
		callee: params?.callee ?? callee,
		Err: params?.Err
	};
}
var _parse = (_Err) => {
	const fn = (schema, value, _ctx, _params) => {
		const ctx = _ctx ? {
			..._ctx,
			async: false
		} : { async: false };
		const result = schema._zod.run({
			value,
			issues: []
		}, ctx);
		if (result instanceof Promise) throw new $ZodAsyncError();
		if (result.issues.length) {
			const e = new ((_params?.Err) ?? _Err)(result.issues.map((iss) => finalizeIssue(iss, ctx, config())));
			captureStackTrace(e, _params?.callee ?? fn);
			throw e;
		}
		return result.value;
	};
	return fn;
};
var _parseAsync = (_Err) => {
	const fn = async (schema, value, _ctx, params) => {
		const ctx = _ctx ? {
			..._ctx,
			async: true
		} : { async: true };
		let result = schema._zod.run({
			value,
			issues: []
		}, ctx);
		if (result instanceof Promise) result = await result;
		if (result.issues.length) {
			const e = new ((params?.Err) ?? _Err)(result.issues.map((iss) => finalizeIssue(iss, ctx, config())));
			captureStackTrace(e, params?.callee ?? fn);
			throw e;
		}
		return result.value;
	};
	return fn;
};
var _safeParse = (_Err) => (schema, value, _ctx) => {
	const ctx = _ctx ? {
		..._ctx,
		async: false
	} : { async: false };
	const result = schema._zod.run({
		value,
		issues: []
	}, ctx);
	if (result instanceof Promise) throw new $ZodAsyncError();
	return result.issues.length ? failure(_Err, result.issues, ctx) : {
		success: true,
		data: result.value
	};
};
function failure(Err, issues, ctx) {
	let error;
	return {
		success: false,
		get error() {
			if (!error) {
				error = new Err(issues.map((iss) => finalizeIssue(iss, ctx, config())));
				issues = void 0;
				ctx = void 0;
			}
			return error;
		},
		set error(e) {
			error = e;
			issues = void 0;
			ctx = void 0;
		}
	};
}
var _safeParseAsync = (_Err) => async (schema, value, _ctx) => {
	const ctx = _ctx ? {
		..._ctx,
		async: true
	} : { async: true };
	let result = schema._zod.run({
		value,
		issues: []
	}, ctx);
	if (result instanceof Promise) result = await result;
	return result.issues.length ? failure(_Err, result.issues, ctx) : {
		success: true,
		data: result.value
	};
};
var COMPILE_INVALID = /* @__PURE__ */ Symbol.for("zod.compile.invalid");
var COMPILE_FALLBACK = /* @__PURE__ */ Symbol.for("zod.compile.fallback");
var validate = ((schema, value, _ctx) => {
	const validator = schema._zod.bag.validator;
	if (validator !== void 0) {
		if (validator(value) !== COMPILE_INVALID) return true;
		if (validator.definite === true && _ctx === void 0) return false;
	}
	return validateFallback(schema, value, _ctx);
});
function validateFallback(schema, value, _ctx) {
	const ctx = _ctx ? {
		..._ctx,
		async: false,
		abortEarly: true
	} : {
		async: false,
		abortEarly: true
	};
	const fallbackRun = schema._zod.bag.fallbackRun;
	let result;
	if (fallbackRun) {
		ctx[COMPILE_FALLBACK] = true;
		result = fallbackRun({
			value,
			issues: []
		}, ctx);
	} else result = schema._zod.run({
		value,
		issues: []
	}, ctx);
	if (result instanceof Promise) throw new $ZodAsyncError();
	return result.issues.length === 0;
}
var validateAsync$1 = async (schema, value, _ctx) => {
	const ctx = _ctx ? {
		..._ctx,
		async: true,
		abortEarly: true
	} : {
		async: true,
		abortEarly: true
	};
	let result = schema._zod.run({
		value,
		issues: []
	}, ctx);
	if (result instanceof Promise) result = await result;
	return result.issues.length === 0;
};
var _encode = (_Err) => {
	const parse = _parse(_Err);
	const fn = (schema, value, _ctx, _params) => {
		const ctx = _ctx ? {
			..._ctx,
			direction: "backward"
		} : { direction: "backward" };
		return parse(schema, value, ctx, finalizeParams(fn, _params));
	};
	return fn;
};
var _decode = (_Err) => {
	const parse = _parse(_Err);
	const fn = (schema, value, _ctx, _params) => {
		return parse(schema, value, _ctx, finalizeParams(fn, _params));
	};
	return fn;
};
var _encodeAsync = (_Err) => {
	const parseAsync = _parseAsync(_Err);
	const fn = async (schema, value, _ctx, _params) => {
		const ctx = _ctx ? {
			..._ctx,
			direction: "backward"
		} : { direction: "backward" };
		return await parseAsync(schema, value, ctx, finalizeParams(fn, _params));
	};
	return fn;
};
var _decodeAsync = (_Err) => {
	const parseAsync = _parseAsync(_Err);
	const fn = async (schema, value, _ctx, _params) => {
		return await parseAsync(schema, value, _ctx, finalizeParams(fn, _params));
	};
	return fn;
};
var _safeEncode = (_Err) => (schema, value, _ctx) => {
	const ctx = _ctx ? {
		..._ctx,
		direction: "backward"
	} : { direction: "backward" };
	return _safeParse(_Err)(schema, value, ctx);
};
var _safeDecode = (_Err) => (schema, value, _ctx) => {
	return _safeParse(_Err)(schema, value, _ctx);
};
var _safeEncodeAsync = (_Err) => async (schema, value, _ctx) => {
	const ctx = _ctx ? {
		..._ctx,
		direction: "backward"
	} : { direction: "backward" };
	return _safeParseAsync(_Err)(schema, value, ctx);
};
var _safeDecodeAsync = (_Err) => async (schema, value, _ctx) => {
	return _safeParseAsync(_Err)(schema, value, _ctx);
};
// ../code-for-antigravity/node_modules/zod/v4/core/regexes.js
/**
* @deprecated CUID v1 is deprecated by its authors due to information leakage
* (timestamps embedded in the id). Use {@link cuid2} instead.
* See https://github.com/paralleldrive/cuid.
*/
var cuid = /^[cC][0-9a-z]{6,}$/;
var cuid2 = /^[0-9a-z]+$/;
var ulid = /^[0-7][0-9A-HJKMNP-TV-Za-hjkmnp-tv-z]{25}$/;
var xid = /^[0-9a-vA-V]{20}$/;
var ksuid = /^[A-Za-z0-9]{27}$/;
var nanoid = /^[a-zA-Z0-9_-]{21}$/;
function nanoidOfLength(length) {
	return new RegExp(`^[a-zA-Z0-9_-]{${length}}$`);
}
/** ISO 8601-1 duration regex. Does not support the 8601-2 extensions like negative durations or fractional/negative components. */
var duration = /^P(?:(\d+W)|(?!.*W)(?=\d|T\d)(\d+Y)?(\d+M)?(\d+D)?(T(?=\d)(\d+H)?(\d+M)?(\d+([.,]\d+)?S)?)?)$/;
/** A regex for any UUID-like identifier: 8-4-4-4-12 hex pattern */
var guid = /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$/;
/** Returns a regex for validating an RFC 9562/4122 UUID.
*
* @param version Optionally specify a version 1-8. If no version is specified, all versions are supported. */
var uuid = (version) => {
	if (!version) return /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$/;
	return new RegExp(`^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-${version}[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12})$`);
};
/** Practical email validation */
var email = /^(?:[A-Za-z0-9_'+\-]+\.)*[A-Za-z0-9_'+\-]*[A-Za-z0-9_+-]@(?:[A-Za-z0-9][A-Za-z0-9\-]*\.)+[A-Za-z]{2,}$/;
var _emoji$1 = `^(?=[\\s\\S]*[\\p{Extended_Pictographic}\\p{Regional_Indicator}\\u20E3])[\\p{Extended_Pictographic}\\p{Emoji_Component}]+$`;
function emoji() {
	return new RegExp(_emoji$1, "u");
}
var ipv4 = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/;
var ipv6 = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:))$/;
var cidrv4 = /^((25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/([0-9]|[1-2][0-9]|3[0-2])$/;
var cidrv6 = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:))\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/;
var base64 = /^$|^(?:[0-9a-zA-Z+/]{4})*(?:(?:[0-9a-zA-Z+/]{2}==)|(?:[0-9a-zA-Z+/]{3}=))?$/;
var base64url = /^(?:[A-Za-z0-9_-]{4})*(?:[A-Za-z0-9_-]{2,3})?$/;
var httpProtocol = /^https?$/;
var e164 = /^\+[1-9]\d{6,14}$/;
var dateSource = `(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))`;
/** Anchors a pattern source. The interpolation lives here rather than at the call site because
* esbuild will not drop a `@__PURE__` call whose own argument interpolates a variable, but it
* will drop `anchor(dateSource)`. Keeping it inline pinned `date` into every bundle. */
function anchor(source) {
	return new RegExp(`^${source}$`);
}
var date = /*@__PURE__*/ anchor(dateSource);
function timeSource(args) {
	const hhmm = `(?:[01]\\d|2[0-3]):[0-5]\\d`;
	return typeof args.precision === "number" ? args.precision === -1 ? `${hhmm}` : args.precision === 0 ? `${hhmm}:[0-5]\\d` : `${hhmm}:[0-5]\\d\\.\\d{${args.precision}}` : args.seconds ? `${hhmm}:[0-5]\\d(?:\\.\\d+)?` : `${hhmm}(?::[0-5]\\d(?:\\.\\d+)?)?`;
}
function time(args) {
	return new RegExp(`^${timeSource(args)}$`);
}
function datetime(args) {
	const opts = ["Z"];
	if (args.offset) opts.push(`([+-](?:[01]\\d|2[0-3]):[0-5]\\d)`);
	const qualified = `${timeSource({
		precision: args.precision,
		seconds: true
	})}(?:${opts.join("|")})`;
	const timeRegex = args.local ? `${qualified}|${timeSource({ precision: args.precision })}` : qualified;
	return new RegExp(`^${dateSource}T(?:${timeRegex})$`);
}
var anyString = /^[\s\S]{0,}$/;
var integer = /^-?\d+$/;
var number$1 = /^-?\d+(?:\.\d+)?$/;
var boolean$1 = /^(?:true|false)$/i;
var _null$2 = /^null$/i;
var lowercase = /^[^A-Z]*$/;
var uppercase = /^[^a-z]*$/;
// ../code-for-antigravity/node_modules/zod/v4/core/checks.js
var $ZodCheck = /*@__PURE__*/ $constructor("$ZodCheck", (inst, def) => {
	var _a;
	inst._zod ?? (inst._zod = {});
	inst._zod.def = def;
	(_a = inst._zod).onattach ?? (_a.onattach = []);
});
/** Default `when` for length-based checks: run only on non-nullish values with a `length`. */
var _whenHasLength = (payload) => {
	const val = payload.value;
	return !nullish(val) && val.length !== void 0;
};
var numericOriginMap = {
	number: "number",
	bigint: "bigint",
	object: "date"
};
var $ZodCheckLessThan = /*@__PURE__*/ $constructor("$ZodCheckLessThan", (inst, def) => {
	$ZodCheck.init(inst, def);
	const origin = numericOriginMap[typeof def.value];
	inst._zod.check = (payload) => {
		if (def.inclusive ? payload.value <= def.value : payload.value < def.value) return;
		payload.issues.push({
			origin: numericOriginMap[typeof payload.value] ?? origin,
			code: "too_big",
			maximum: typeof def.value === "object" ? def.value.getTime() : def.value,
			input: payload.value,
			inclusive: def.inclusive,
			inst,
			continue: !def.abort
		});
	};
});
var $ZodCheckGreaterThan = /*@__PURE__*/ $constructor("$ZodCheckGreaterThan", (inst, def) => {
	$ZodCheck.init(inst, def);
	const origin = numericOriginMap[typeof def.value];
	inst._zod.check = (payload) => {
		if (def.inclusive ? payload.value >= def.value : payload.value > def.value) return;
		payload.issues.push({
			origin: numericOriginMap[typeof payload.value] ?? origin,
			code: "too_small",
			minimum: typeof def.value === "object" ? def.value.getTime() : def.value,
			input: payload.value,
			inclusive: def.inclusive,
			inst,
			continue: !def.abort
		});
	};
});
var $ZodCheckMultipleOf = /*@__PURE__*/ $constructor("$ZodCheckMultipleOf", (inst, def) => {
	$ZodCheck.init(inst, def);
	inst._zod.check = (payload) => {
		if (typeof payload.value !== typeof def.value) throw new Error("Cannot mix number and bigint in multiple_of check.");
		if (typeof payload.value === "bigint" ? def.value !== BigInt(0) && payload.value % def.value === BigInt(0) : floatSafeRemainder(payload.value, def.value) === 0) return;
		payload.issues.push({
			origin: typeof payload.value,
			code: "not_multiple_of",
			divisor: def.value,
			input: payload.value,
			inst,
			continue: !def.abort
		});
	};
});
var $ZodCheckNumberFormat = /*@__PURE__*/ $constructor("$ZodCheckNumberFormat", (inst, def) => {
	$ZodCheck.init(inst, def);
	def.format = def.format || "float64";
	const isInt = def.format?.includes("int");
	const origin = isInt ? "int" : "number";
	const [minimum, maximum] = NUMBER_FORMAT_RANGES[def.format];
	inst._zod.check = (payload) => {
		const input = payload.value;
		if (isInt) {
			if (!Number.isInteger(input)) {
				payload.issues.push({
					expected: origin,
					format: def.format,
					code: "invalid_type",
					continue: false,
					input,
					inst
				});
				return;
			}
			if (!Number.isSafeInteger(input)) {
				if (input > 0) payload.issues.push({
					input,
					code: "too_big",
					maximum: Number.MAX_SAFE_INTEGER,
					note: "Integers must be within the safe integer range.",
					inst,
					origin,
					inclusive: true,
					continue: !def.abort
				});
				else payload.issues.push({
					input,
					code: "too_small",
					minimum: Number.MIN_SAFE_INTEGER,
					note: "Integers must be within the safe integer range.",
					inst,
					origin,
					inclusive: true,
					continue: !def.abort
				});
				return;
			}
		}
		if (input < minimum) payload.issues.push({
			origin: "number",
			input,
			code: "too_small",
			minimum,
			inclusive: true,
			inst,
			continue: !def.abort
		});
		if (input > maximum) payload.issues.push({
			origin: "number",
			input,
			code: "too_big",
			maximum,
			inclusive: true,
			inst,
			continue: !def.abort
		});
	};
});
var $ZodCheckMaxLength = /*@__PURE__*/ $constructor("$ZodCheckMaxLength", (inst, def) => {
	var _a;
	$ZodCheck.init(inst, def);
	(_a = inst._zod.def).when ?? (_a.when = _whenHasLength);
	inst._zod.check = (payload) => {
		const input = payload.value;
		const units = input.length;
		if ((typeof input === "string" && units > def.maximum ? codePointLength(input) : units) <= def.maximum) return;
		const origin = getLengthableOrigin(input);
		payload.issues.push({
			origin,
			code: "too_big",
			maximum: def.maximum,
			inclusive: true,
			input,
			inst,
			continue: !def.abort
		});
	};
});
var $ZodCheckMinLength = /*@__PURE__*/ $constructor("$ZodCheckMinLength", (inst, def) => {
	var _a;
	$ZodCheck.init(inst, def);
	(_a = inst._zod.def).when ?? (_a.when = _whenHasLength);
	inst._zod.check = (payload) => {
		const input = payload.value;
		const units = input.length;
		if ((typeof input === "string" && units >= def.minimum && units < def.minimum * 2 ? codePointLength(input) : units) >= def.minimum) return;
		const origin = getLengthableOrigin(input);
		payload.issues.push({
			origin,
			code: "too_small",
			minimum: def.minimum,
			inclusive: true,
			input,
			inst,
			continue: !def.abort
		});
	};
});
var $ZodCheckLengthEquals = /*@__PURE__*/ $constructor("$ZodCheckLengthEquals", (inst, def) => {
	var _a;
	$ZodCheck.init(inst, def);
	(_a = inst._zod.def).when ?? (_a.when = _whenHasLength);
	inst._zod.check = (payload) => {
		const input = payload.value;
		const units = input.length;
		const length = typeof input === "string" && units >= def.length && units <= def.length * 2 ? codePointLength(input) : units;
		if (length === def.length) return;
		const origin = getLengthableOrigin(input);
		const tooBig = length > def.length;
		payload.issues.push({
			origin,
			...tooBig ? {
				code: "too_big",
				maximum: def.length
			} : {
				code: "too_small",
				minimum: def.length
			},
			inclusive: true,
			exact: true,
			input: payload.value,
			inst,
			continue: !def.abort
		});
	};
});
var $ZodCheckStringFormat = /*@__PURE__*/ $constructor("$ZodCheckStringFormat", (inst, def) => {
	var _a, _b;
	$ZodCheck.init(inst, def);
	if (def.pattern) (_a = inst._zod).check ?? (_a.check = (payload) => {
		def.pattern.lastIndex = 0;
		if (def.pattern.test(payload.value)) return;
		payload.issues.push({
			origin: "string",
			code: "invalid_format",
			format: def.format,
			input: payload.value,
			...def.pattern ? { pattern: def.pattern.toString() } : {},
			inst,
			continue: !def.abort
		});
	});
	else (_b = inst._zod).check ?? (_b.check = () => {});
});
var $ZodCheckRegex = /*@__PURE__*/ $constructor("$ZodCheckRegex", (inst, def) => {
	$ZodCheckStringFormat.init(inst, def);
	inst._zod.check = (payload) => {
		def.pattern.lastIndex = 0;
		if (def.pattern.test(payload.value)) return;
		payload.issues.push({
			origin: "string",
			code: "invalid_format",
			format: "regex",
			input: payload.value,
			pattern: def.pattern.toString(),
			inst,
			continue: !def.abort
		});
	};
});
var $ZodCheckLowerCase = /*@__PURE__*/ $constructor("$ZodCheckLowerCase", (inst, def) => {
	def.pattern ?? (def.pattern = lowercase);
	$ZodCheckStringFormat.init(inst, def);
});
var $ZodCheckUpperCase = /*@__PURE__*/ $constructor("$ZodCheckUpperCase", (inst, def) => {
	def.pattern ?? (def.pattern = uppercase);
	$ZodCheckStringFormat.init(inst, def);
});
var $ZodCheckIncludes = /*@__PURE__*/ $constructor("$ZodCheckIncludes", (inst, def) => {
	$ZodCheck.init(inst, def);
	const escapedRegex = escapeRegex(def.includes);
	def.pattern = new RegExp(typeof def.position === "number" ? `^.{${def.position},}${escapedRegex}` : escapedRegex);
	inst._zod.check = (payload) => {
		if (payload.value.includes(def.includes, def.position)) return;
		payload.issues.push({
			origin: "string",
			code: "invalid_format",
			format: "includes",
			includes: def.includes,
			input: payload.value,
			inst,
			continue: !def.abort
		});
	};
});
var $ZodCheckStartsWith = /*@__PURE__*/ $constructor("$ZodCheckStartsWith", (inst, def) => {
	$ZodCheck.init(inst, def);
	const pattern = new RegExp(`^${escapeRegex(def.prefix)}.*`);
	def.pattern ?? (def.pattern = pattern);
	inst._zod.check = (payload) => {
		if (payload.value.startsWith(def.prefix)) return;
		payload.issues.push({
			origin: "string",
			code: "invalid_format",
			format: "starts_with",
			prefix: def.prefix,
			input: payload.value,
			inst,
			continue: !def.abort
		});
	};
});
var $ZodCheckEndsWith = /*@__PURE__*/ $constructor("$ZodCheckEndsWith", (inst, def) => {
	$ZodCheck.init(inst, def);
	const pattern = new RegExp(`.*${escapeRegex(def.suffix)}$`);
	def.pattern ?? (def.pattern = pattern);
	inst._zod.check = (payload) => {
		if (payload.value.endsWith(def.suffix)) return;
		payload.issues.push({
			origin: "string",
			code: "invalid_format",
			format: "ends_with",
			suffix: def.suffix,
			input: payload.value,
			inst,
			continue: !def.abort
		});
	};
});
var $ZodCheckOverwrite = /*@__PURE__*/ $constructor("$ZodCheckOverwrite", (inst, def) => {
	$ZodCheck.init(inst, def);
	inst._zod.check = (payload) => {
		payload.value = def.tx(payload.value);
	};
});
// ../code-for-antigravity/node_modules/zod/v4/core/doc.js
var Doc = class {
	constructor(args = [], closed = {}) {
		this.content = [];
		this.indent = 0;
		this.args = args;
		this.closed = closed;
	}
	indented(fn) {
		this.indent += 1;
		try {
			fn(this);
		} finally {
			this.indent -= 1;
		}
	}
	write(arg) {
		if (typeof arg === "function") {
			arg(this, { execution: "sync" });
			arg(this, { execution: "async" });
			return;
		}
		const lines = arg.split("\n").filter((x) => x);
		const minIndent = Math.min(...lines.map((x) => x.length - x.trimStart().length));
		const dedented = lines.map((x) => x.slice(minIndent)).map((x) => " ".repeat(this.indent * 2) + x);
		for (const line of dedented) this.content.push(line);
	}
	compile() {
		const F = Function;
		const content = this?.content ?? [``];
		return new F(...Object.keys(this.closed), `return function (${this.args.join(", ")}) {\n${content.join("\n")}\n};`)(...Object.values(this.closed));
	}
};
// ../code-for-antigravity/node_modules/zod/v4/core/versions.js
var version = {
	major: 4,
	minor: 6,
	patch: 7
};
// ../code-for-antigravity/node_modules/zod/v4/core/schemas.js
var $ZodType = /*@__PURE__*/ $constructor("$ZodType", (inst, def) => {
	var _a;
	inst ?? (inst = {});
	inst._zod.def = def;
	inst._zod.bag = inst._zod.bag || {};
	inst._zod.version = version;
	const defChecks = inst._zod.def.checks;
	const checks = inst._zod.traits.has("$ZodCheck") ? [inst, ...defChecks ?? []] : defChecks?.length ? [...defChecks] : [];
	for (const ch of checks) for (const fn of ch._zod.onattach) fn(inst);
	if (checks.length === 0) {
		(_a = inst._zod).deferred ?? (_a.deferred = []);
		inst._zod.deferred?.push(() => {
			inst._zod.run = inst._zod.parse;
		});
	} else {
		const runChecks = (payload, checks, ctx) => {
			if (payload.memo) return payload;
			let isAborted = aborted(payload);
			let asyncResult;
			for (const ch of checks) {
				if (ch._zod.def.when) {
					if (explicitlyAborted(payload)) continue;
					if (!ch._zod.def.when(payload)) continue;
				} else if (isAborted) continue;
				const currLen = payload.issues.length;
				const _ = ch._zod.check(payload);
				if (_ instanceof Promise && ctx?.async === false) throw new $ZodAsyncError();
				if (asyncResult || _ instanceof Promise) asyncResult = (asyncResult ?? Promise.resolve()).then(async () => {
					await _;
					if (payload.issues.length === currLen) return;
					attachSchema(payload.issues, currLen, inst);
					if (!isAborted) isAborted = aborted(payload, currLen);
				});
				else {
					if (payload.issues.length === currLen) continue;
					attachSchema(payload.issues, currLen, inst);
					if (!isAborted) isAborted = aborted(payload, currLen);
				}
			}
			if (asyncResult) return asyncResult.then(() => {
				return payload;
			});
			return payload;
		};
		const handleCanaryResult = (canary, payload, ctx) => {
			if (aborted(canary)) {
				canary.aborted = true;
				return canary;
			}
			const checkResult = runChecks(payload, checks, ctx);
			if (checkResult instanceof Promise) {
				if (ctx.async === false) throw new $ZodAsyncError();
				return checkResult.then((checkResult) => inst._zod.parse(checkResult, ctx));
			}
			return inst._zod.parse(checkResult, ctx);
		};
		inst._zod.run = (payload, ctx) => {
			if (ctx.skipChecks) return inst._zod.parse(payload, ctx);
			if (ctx.direction === "backward") {
				const canary = inst._zod.parse({
					value: payload.value,
					issues: []
				}, {
					...ctx,
					skipChecks: true
				});
				if (canary instanceof Promise) return canary.then((canary) => {
					return handleCanaryResult(canary, payload, ctx);
				});
				return handleCanaryResult(canary, payload, ctx);
			}
			const result = inst._zod.parse(payload, ctx);
			if (result instanceof Promise) {
				if (ctx.async === false) throw new $ZodAsyncError();
				return result.then((result) => runChecks(result, checks, ctx));
			}
			return runChecks(result, checks, ctx);
		};
	}
}, {
	get "~standard"() {
		return hide(this, "~standard", standardProps(this));
	},
	set "~standard"(value) {
		own(this, "~standard", value);
	}
});
/** The Standard Schema surface for `inst`. Shared so wrappers can extend it without forcing it. */
var toStandardResult = (r, ctx) => r.issues.length ? { issues: r.issues.map((iss) => finalizeIssue(iss, ctx, config())) } : { value: r.value };
async function validateAsync(inst, value) {
	const ctx = { async: true };
	return toStandardResult(await inst._zod.run({
		value,
		issues: []
	}, ctx), ctx);
}
function standardProps(inst) {
	return {
		validate: (value) => {
			const ctx = { async: false };
			try {
				const r = inst._zod.run({
					value,
					issues: []
				}, ctx);
				if (!(r instanceof Promise)) return toStandardResult(r, ctx);
			} catch (_) {}
			return validateAsync(inst, value);
		},
		vendor: "zod",
		version: 1
	};
}
var $ZodString = /*@__PURE__*/ $constructor("$ZodString", (inst, def) => {
	$ZodType.init(inst, def);
	inst._zod.pattern = def.pattern ?? anyString;
	inst._zod.parse = (payload, _) => {
		if (def.coerce) try {
			payload.value = String(payload.value);
		} catch (_) {}
		if (typeof payload.value === "string") return payload;
		payload.issues.push({
			expected: "string",
			code: "invalid_type",
			input: payload.value,
			inst
		});
		return payload;
	};
});
var $ZodStringFormat = /*@__PURE__*/ $constructor("$ZodStringFormat", (inst, def) => {
	$ZodCheckStringFormat.init(inst, def);
	$ZodString.init(inst, def);
});
var $ZodGUID = /*@__PURE__*/ $constructor("$ZodGUID", (inst, def) => {
	def.pattern ?? (def.pattern = guid);
	$ZodStringFormat.init(inst, def);
});
var $ZodUUID = /*@__PURE__*/ $constructor("$ZodUUID", (inst, def) => {
	if (def.version) {
		const v = {
			v1: 1,
			v2: 2,
			v3: 3,
			v4: 4,
			v5: 5,
			v6: 6,
			v7: 7,
			v8: 8
		}[def.version];
		if (v === void 0) throw new Error(`Invalid UUID version: "${def.version}"`);
		def.pattern ?? (def.pattern = uuid(v));
	} else def.pattern ?? (def.pattern = uuid());
	$ZodStringFormat.init(inst, def);
});
var $ZodEmail = /*@__PURE__*/ $constructor("$ZodEmail", (inst, def) => {
	def.pattern ?? (def.pattern = email);
	$ZodStringFormat.init(inst, def);
});
function canParseURL(input) {
	try {
		if (typeof URL !== "undefined" && typeof URL.canParse === "function") return URL.canParse(input);
		new URL(input);
		return true;
	} catch {
		return false;
	}
}
function validateURL(trimmed, def) {
	if (!("normalize" in def) && !("hostname" in def) && !("protocol" in def)) return canParseURL(trimmed) || 2;
	return parseURLObject(trimmed, def);
}
/** Parses a URL while preserving the non-normalizing HTTP guard. */
function parseURLObject(trimmed, def) {
	if (!def.normalize && def.protocol?.source === httpProtocol.source && !/^https?:\/\//i.test(trimmed)) return 1;
	try {
		if (typeof URL !== "undefined") {
			const URLStatic = URL;
			if (typeof URLStatic.parse === "function") return URLStatic.parse(trimmed) ?? 2;
		}
		return new URL(trimmed);
	} catch {
		return 2;
	}
}
var asciiTabOrNewline = /[\t\n\r]/g;
/** The URL parser deletes every ASCII tab, LF and CR from its input before it parses, so `new URL("https://exa\nmple.com")` reports on `example.com`. Applying the same deletion to the returned value closes the half of that divergence which can move the host; the parser's other rewrite, stripping C0 controls at the edges, cannot. */
function stripTabAndNewline(value) {
	return value.replace(asciiTabOrNewline, "");
}
function urlHostnameOk(url, hostname) {
	hostname.lastIndex = 0;
	return hostname.test(url.hostname);
}
function urlProtocolOk(url, protocol) {
	protocol.lastIndex = 0;
	return protocol.test(url.protocol.endsWith(":") ? url.protocol.slice(0, -1) : url.protocol);
}
var $ZodURL = /*@__PURE__*/ $constructor("$ZodURL", (inst, def) => {
	$ZodStringFormat.init(inst, def);
	inst._zod.check = (payload) => {
		try {
			const trimmed = payload.value.trim();
			const url = validateURL(trimmed, def);
			if (url === 1) {
				payload.issues.push({
					code: "invalid_format",
					format: "url",
					note: "Invalid URL format",
					input: payload.value,
					inst,
					continue: !def.abort
				});
				return;
			}
			if (url === 2) {
				payload.issues.push({
					code: "invalid_format",
					format: "url",
					input: payload.value,
					inst,
					continue: !def.abort
				});
				return;
			}
			if (url === true) {
				payload.value = stripTabAndNewline(trimmed);
				return;
			}
			if (def.hostname && !urlHostnameOk(url, def.hostname)) payload.issues.push({
				code: "invalid_format",
				format: "url",
				note: "Invalid hostname",
				pattern: def.hostname.source,
				input: payload.value,
				inst,
				continue: !def.abort
			});
			if (def.protocol && !urlProtocolOk(url, def.protocol)) payload.issues.push({
				code: "invalid_format",
				format: "url",
				note: "Invalid protocol",
				pattern: def.protocol.source,
				input: payload.value,
				inst,
				continue: !def.abort
			});
			payload.value = def.normalize ? url.href : stripTabAndNewline(trimmed);
			return;
		} catch (_) {
			payload.issues.push({
				code: "invalid_format",
				format: "url",
				input: payload.value,
				inst,
				continue: !def.abort
			});
		}
	};
});
var $ZodEmoji = /*@__PURE__*/ $constructor("$ZodEmoji", (inst, def) => {
	def.pattern ?? (def.pattern = emoji());
	$ZodStringFormat.init(inst, def);
});
var $ZodNanoID = /*@__PURE__*/ $constructor("$ZodNanoID", (inst, def) => {
	if (def.length !== void 0 && (!Number.isInteger(def.length) || def.length < 1)) throw new Error(`Invalid nanoid length: ${def.length}`);
	def.pattern ?? (def.pattern = def.length === void 0 ? nanoid : nanoidOfLength(def.length));
	$ZodStringFormat.init(inst, def);
});
/**
* @deprecated CUID v1 is deprecated by its authors due to information leakage
* (timestamps embedded in the id). Use {@link $ZodCUID2} instead.
* See https://github.com/paralleldrive/cuid.
*/
var $ZodCUID = /*@__PURE__*/ $constructor("$ZodCUID", (inst, def) => {
	def.pattern ?? (def.pattern = cuid);
	$ZodStringFormat.init(inst, def);
});
var $ZodCUID2 = /*@__PURE__*/ $constructor("$ZodCUID2", (inst, def) => {
	def.pattern ?? (def.pattern = cuid2);
	$ZodStringFormat.init(inst, def);
});
var $ZodULID = /*@__PURE__*/ $constructor("$ZodULID", (inst, def) => {
	def.pattern ?? (def.pattern = ulid);
	$ZodStringFormat.init(inst, def);
});
var $ZodXID = /*@__PURE__*/ $constructor("$ZodXID", (inst, def) => {
	def.pattern ?? (def.pattern = xid);
	$ZodStringFormat.init(inst, def);
});
var $ZodKSUID = /*@__PURE__*/ $constructor("$ZodKSUID", (inst, def) => {
	def.pattern ?? (def.pattern = ksuid);
	$ZodStringFormat.init(inst, def);
});
var $ZodISODateTime = /*@__PURE__*/ $constructor("$ZodISODateTime", (inst, def) => {
	def.pattern ?? (def.pattern = datetime(def));
	$ZodStringFormat.init(inst, def);
});
var $ZodISODate = /*@__PURE__*/ $constructor("$ZodISODate", (inst, def) => {
	def.pattern ?? (def.pattern = date);
	$ZodStringFormat.init(inst, def);
});
var $ZodISOTime = /*@__PURE__*/ $constructor("$ZodISOTime", (inst, def) => {
	def.pattern ?? (def.pattern = time(def));
	$ZodStringFormat.init(inst, def);
});
var $ZodISODuration = /*@__PURE__*/ $constructor("$ZodISODuration", (inst, def) => {
	def.pattern ?? (def.pattern = duration);
	$ZodStringFormat.init(inst, def);
});
var $ZodIPv4 = /*@__PURE__*/ $constructor("$ZodIPv4", (inst, def) => {
	def.pattern ?? (def.pattern = ipv4);
	$ZodStringFormat.init(inst, def);
});
/** An IPv6 address is written with hex digits, colons and dots, and nothing else. The guard is what makes the check below an IPv6 check: `new URL("http://[...]")` parses an authority, not an address, so `@` and `\` re-delimit it and `"::@1\\"` validates against the host `0.0.0.1`. The URL parser also deletes ASCII tab, LF and CR rather than failing, which is how `"::1\n"` validated as `::1`. */
var ipv6Alphabet = /^[0-9a-fA-F:.]+$/;
function isValidIPv6(value) {
	if (!ipv6Alphabet.test(value)) return false;
	return canParseURL(`http://[${value}]`);
}
var $ZodIPv6 = /*@__PURE__*/ $constructor("$ZodIPv6", (inst, def) => {
	def.pattern ?? (def.pattern = ipv6);
	$ZodStringFormat.init(inst, def);
	inst._zod.check = (payload) => {
		if (!isValidIPv6(payload.value)) payload.issues.push({
			code: "invalid_format",
			format: "ipv6",
			input: payload.value,
			inst,
			continue: !def.abort
		});
	};
});
var $ZodCIDRv4 = /*@__PURE__*/ $constructor("$ZodCIDRv4", (inst, def) => {
	def.pattern ?? (def.pattern = cidrv4);
	$ZodStringFormat.init(inst, def);
});
function isValidCIDRv6(value) {
	const parts = value.split("/");
	if (parts.length !== 2) return false;
	const [address, prefix] = parts;
	if (!prefix) return false;
	const prefixNum = Number(prefix);
	if (`${prefixNum}` !== prefix) return false;
	if (prefixNum < 0 || prefixNum > 128) return false;
	return isValidIPv6(address);
}
var $ZodCIDRv6 = /*@__PURE__*/ $constructor("$ZodCIDRv6", (inst, def) => {
	def.pattern ?? (def.pattern = cidrv6);
	$ZodStringFormat.init(inst, def);
	inst._zod.check = (payload) => {
		if (!isValidCIDRv6(payload.value)) payload.issues.push({
			code: "invalid_format",
			format: "cidrv6",
			input: payload.value,
			inst,
			continue: !def.abort
		});
	};
});
function isValidBase64(data) {
	if (data === "") return true;
	if (/\s/.test(data)) return false;
	if (data.length % 4 !== 0) return false;
	try {
		atob(data);
		return true;
	} catch {
		return false;
	}
}
var base64Charset = /^[0-9a-zA-Z+/]*={0,2}$/;
var $ZodBase64 = /*@__PURE__*/ $constructor("$ZodBase64", (inst, def) => {
	def.pattern ?? (def.pattern = base64Charset);
	$ZodStringFormat.init(inst, def);
	inst._zod.check = (payload) => {
		if (isValidBase64(payload.value)) return;
		payload.issues.push({
			code: "invalid_format",
			format: "base64",
			input: payload.value,
			inst,
			continue: !def.abort
		});
	};
});
var base64urlCharset = /^[A-Za-z0-9_-]*$/;
function isValidBase64URL(data) {
	if (!base64urlCharset.test(data)) return false;
	const base64 = data.replace(/[-_]/g, (c) => c === "-" ? "+" : "/");
	return isValidBase64(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
}
var $ZodBase64URL = /*@__PURE__*/ $constructor("$ZodBase64URL", (inst, def) => {
	def.pattern ?? (def.pattern = base64urlCharset);
	$ZodStringFormat.init(inst, def);
	inst._zod.check = (payload) => {
		if (isValidBase64URL(payload.value)) return;
		payload.issues.push({
			code: "invalid_format",
			format: "base64url",
			input: payload.value,
			inst,
			continue: !def.abort
		});
	};
});
var $ZodE164 = /*@__PURE__*/ $constructor("$ZodE164", (inst, def) => {
	def.pattern ?? (def.pattern = e164);
	$ZodStringFormat.init(inst, def);
});
function isValidJWT(token, algorithm = null) {
	try {
		const tokensParts = token.split(".");
		if (tokensParts.length !== 3) return false;
		const [header] = tokensParts;
		if (!header) return false;
		const parsedHeader = JSON.parse(atob(header));
		if ("typ" in parsedHeader && parsedHeader?.typ !== "JWT") return false;
		if (!parsedHeader.alg) return false;
		if (algorithm && (!("alg" in parsedHeader) || parsedHeader.alg !== algorithm)) return false;
		return true;
	} catch {
		return false;
	}
}
var $ZodJWT = /*@__PURE__*/ $constructor("$ZodJWT", (inst, def) => {
	$ZodStringFormat.init(inst, def);
	inst._zod.check = (payload) => {
		if (isValidJWT(payload.value, def.alg)) return;
		payload.issues.push({
			code: "invalid_format",
			format: "jwt",
			input: payload.value,
			inst,
			continue: !def.abort
		});
	};
});
var $ZodNumber = /*@__PURE__*/ $constructor("$ZodNumber", (inst, def) => {
	$ZodType.init(inst, def);
	inst._zod.pattern = number$1;
	inst._zod.parse = (payload, _ctx) => {
		if (def.coerce) try {
			payload.value = Number(payload.value);
		} catch (_) {}
		const input = payload.value;
		if (typeof input === "number" && !Number.isNaN(input) && Number.isFinite(input)) return payload;
		const received = typeof input === "number" ? Number.isNaN(input) ? "NaN" : !Number.isFinite(input) ? String(input) : void 0 : void 0;
		payload.issues.push({
			expected: "number",
			code: "invalid_type",
			input,
			inst,
			...received ? { received } : {}
		});
		return payload;
	};
});
var $ZodNumberFormat = /*@__PURE__*/ $constructor("$ZodNumberFormat", (inst, def) => {
	$ZodCheckNumberFormat.init(inst, def);
	$ZodNumber.init(inst, def);
});
var $ZodBoolean = /*@__PURE__*/ $constructor("$ZodBoolean", (inst, def) => {
	$ZodType.init(inst, def);
	inst._zod.pattern = boolean$1;
	inst._zod.parse = (payload, _ctx) => {
		if (def.coerce) try {
			payload.value = Boolean(payload.value);
		} catch (_) {}
		const input = payload.value;
		if (typeof input === "boolean") return payload;
		payload.issues.push({
			expected: "boolean",
			code: "invalid_type",
			input,
			inst
		});
		return payload;
	};
});
var $ZodNull = /*@__PURE__*/ $constructor("$ZodNull", (inst, def) => {
	$ZodType.init(inst, def);
	inst._zod.pattern = _null$2;
	inst._zod.values = /* @__PURE__ */ new Set([null]);
	inst._zod.parse = (payload, _ctx) => {
		const input = payload.value;
		if (input === null) return payload;
		payload.issues.push({
			expected: "null",
			code: "invalid_type",
			input,
			inst
		});
		return payload;
	};
});
var $ZodUnknown = /*@__PURE__*/ $constructor("$ZodUnknown", (inst, def) => {
	$ZodType.init(inst, def);
	inst._zod.parse = (payload) => payload;
});
var $ZodNever = /*@__PURE__*/ $constructor("$ZodNever", (inst, def) => {
	$ZodType.init(inst, def);
	inst._zod.parse = (payload, _ctx) => {
		payload.issues.push({
			expected: "never",
			code: "invalid_type",
			input: payload.value,
			inst
		});
		return payload;
	};
});
function capSize(inst, size) {
	const caps = sizeCaps(inst._zod.def.checks);
	if (!caps.length) return;
	const cap = Math.min(...caps.map((c) => c[0]));
	const parse = inst._zod.parse;
	inst._zod.parse = (payload, ctx) => {
		const n = size(payload.value);
		if (n > cap && !ctx?.skipChecks && ctx?.direction !== "backward") {
			for (const [max, ch] of sizeCaps(inst._zod.def.checks)) if (n > max && ch._zod.def.when(payload)) {
				const start = payload.issues.length;
				ch._zod.check(payload);
				payload.issues[start].continue = false;
				attachSchema(payload.issues, start, inst);
				return payload;
			}
		}
		return parse(payload, ctx);
	};
}
var arraySize = (input) => Array.isArray(input) ? input.length : -1;
function handleArrayResult(result, final, index) {
	if (result.issues.length) final.issues.push(...prefixIssues(index, result.issues));
	final.value[index] = result.value;
}
var $ZodArray = /*@__PURE__*/ $constructor("$ZodArray", (inst, def) => {
	$ZodType.init(inst, def);
	const memo = globalConfig.memoizer;
	memo?.attach(inst);
	inst._zod.parse = (payload, ctx) => {
		const input = payload.value;
		if (!Array.isArray(input)) {
			payload.issues.push({
				expected: "array",
				code: "invalid_type",
				input,
				inst
			});
			return payload;
		}
		payload.value = memo ? memo.alloc(inst, payload, Array(input.length), ctx) : Array(input.length);
		const proms = [];
		const abortEarly = ctx?.abortEarly;
		for (let i = 0; i < input.length; i++) {
			const item = input[i];
			const result = def.element._zod.run({
				value: item,
				issues: []
			}, ctx);
			if (result instanceof Promise) proms.push(result.then((result) => handleArrayResult(result, payload, i)));
			else {
				handleArrayResult(result, payload, i);
				if (abortEarly && result.issues.length !== 0 && aborted(result)) break;
			}
		}
		if (proms.length) return Promise.all(proms).then(() => payload);
		return payload;
	};
	capSize(inst, arraySize);
});
function handlePropertyResult(result, final, key, input, optin, optout) {
	const isPresent = key in input;
	const isOptionalOut = optout === "optional";
	if (!isPresent && isOptionalOut && optin === "optional") return;
	if (result.issues.length) {
		if (optin !== void 0 && isOptionalOut && !isPresent) return;
		final.issues.push(...prefixIssues(key, result.issues));
	}
	if (!isPresent && optin === void 0) {
		if (!result.issues.length) final.issues.push({
			code: "invalid_type",
			expected: "nonoptional",
			input: void 0,
			path: [key]
		});
		return;
	}
	if (result.value === void 0) {
		if (isPresent || optin === "defaulted" && !isOptionalOut) final.value[key] = void 0;
	} else final.value[key] = result.value;
}
var NO_SYMBOL_KEYS = [];
function normalizeDef(def) {
	const keys = Object.keys(def.shape);
	const ownSymbols = Object.getOwnPropertySymbols(def.shape);
	const symbolKeys = ownSymbols.length ? ownSymbols : NO_SYMBOL_KEYS;
	const allKeys = symbolKeys.length ? [...keys, ...symbolKeys] : keys;
	for (const k of allKeys) if (!def.shape?.[k]?._zod?.traits?.has("$ZodType")) throw new Error(`Invalid element at key "${String(k)}": expected a Zod schema`);
	const okeys = optionalKeys(def.shape);
	return {
		...def,
		allKeys,
		symbolKeys,
		keySet: new Set(keys),
		numKeys: keys.length,
		optionalKeys: new Set(okeys)
	};
}
function handleCatchall(proms, input, payload, ctx, def, inst, abortEarly) {
	const unrecognized = [];
	const keySet = def.keySet;
	const _catchall = def.catchall._zod;
	const t = _catchall.def.type;
	const optin = _catchall.optin;
	const optout = _catchall.optout;
	let seen = 0;
	for (const key in input) {
		if (abortEarly && payload.issues.length !== seen) {
			if (aborted(payload, seen)) break;
			seen = payload.issues.length;
		}
		if (keySet.has(key)) continue;
		if (key === "__proto__") {
			if (t === "never") unrecognized.push(key);
			continue;
		}
		if (t === "never") {
			unrecognized.push(key);
			continue;
		}
		const r = _catchall.run({
			value: input[key],
			issues: []
		}, ctx);
		if (r instanceof Promise) proms.push(r.then((r) => handlePropertyResult(r, payload, key, input, optin, optout)));
		else handlePropertyResult(r, payload, key, input, optin, optout);
	}
	if (unrecognized.length) payload.issues.push({
		code: "unrecognized_keys",
		keys: unrecognized,
		input,
		inst,
		continue: true
	});
	if (!proms.length) return payload;
	return Promise.all(proms).then(() => {
		return payload;
	});
}
var $ZodObject = /*@__PURE__*/ $constructor("$ZodObject", (inst, def) => {
	$ZodType.init(inst, def);
	const desc = Object.getOwnPropertyDescriptor(def, "shape");
	const sh = desc?.get ? desc.get.raw : def.shape ?? {};
	if (sh) {
		const get = () => {
			const newSh = { ...sh };
			Object.defineProperty(def, "shape", { value: newSh });
			get.raw = newSh;
			return newSh;
		};
		get.raw = sh;
		Object.defineProperty(def, "shape", { get });
	}
	const _normalized = cached(() => normalizeDef(def));
	defineLazyInternal(inst, "propValues", (zod) => {
		const shape = zod.def.shape;
		const propValues = {};
		for (const key in shape) {
			const field = shape[key]._zod;
			if (field.values) {
				if (!Object.prototype.hasOwnProperty.call(propValues, key)) assignProp(propValues, key, /* @__PURE__ */ new Set());
				for (const v of field.values) propValues[key].add(v);
				if (field.optin !== void 0) propValues[key].add(void 0);
			}
		}
		return propValues;
	});
	const isObject$1 = isObject;
	const catchall = def.catchall;
	let value;
	const memo = globalConfig.memoizer;
	memo?.attach(inst);
	inst._zod.parse = (payload, ctx) => {
		value ?? (value = _normalized.value);
		const input = payload.value;
		if (!isObject$1(input)) {
			payload.issues.push({
				expected: "object",
				code: "invalid_type",
				input,
				inst
			});
			return payload;
		}
		payload.value = memo ? memo.alloc(inst, payload, {}, ctx) : {};
		const proms = [];
		const shape = value.shape;
		const abortEarly = ctx?.abortEarly;
		let seen = payload.issues.length;
		for (const key of value.allKeys) {
			if (abortEarly && payload.issues.length !== seen) {
				if (aborted(payload, seen)) break;
				seen = payload.issues.length;
			}
			if (key === "__proto__") continue;
			const el = shape[key];
			const optin = el._zod.optin;
			const optout = el._zod.optout;
			const r = el._zod.run({
				value: input[key],
				issues: []
			}, ctx);
			if (r instanceof Promise) proms.push(r.then((r) => handlePropertyResult(r, payload, key, input, optin, optout)));
			else handlePropertyResult(r, payload, key, input, optin, optout);
		}
		if (!catchall) return proms.length ? Promise.all(proms).then(() => payload) : payload;
		return handleCatchall(proms, input, payload, ctx, _normalized.value, inst, abortEarly === true);
	};
});
var $ZodObjectJIT = /*@__PURE__*/ $constructor("$ZodObjectJIT", (inst, def) => {
	$ZodObject.init(inst, def);
	const superParse = inst._zod.parse;
	const _normalized = cached(() => normalizeDef(def));
	const memo = globalConfig.memoizer;
	const generateFastpass = (shape) => {
		const normalized = _normalized.value;
		const syms = normalized.symbolKeys;
		const doc = new Doc(["payload", "ctx"], {
			shape,
			inst,
			memo,
			syms
		});
		const parseStr = (k) => `shape[${k}]._zod.run({ value: input[${k}], issues: [] }, ctx)`;
		const prefixStr = (id, k) => `
          let ${id}_ab = false;
          for (let i = 0; i < ${id}.issues.length; i++) {
            const iss = ${id}.issues[i];
            iss.path = iss.path ? [${k}, ...iss.path] : [${k}];
            payload.issues.push(iss);
            if (iss.continue !== true) ${id}_ab = true;
          }
          if (${id}_ab && ctx && ctx.abortEarly) {
            payload.value = newResult;
            return payload;
          }`;
		doc.write(`const input = payload.value;`);
		const ids = Object.create(null);
		let counter = 0;
		for (const key of normalized.allKeys) ids[key] = `key_${counter++}`;
		doc.write(memo ? `const newResult = memo.alloc(inst, payload, {}, ctx);` : `const newResult = {};`);
		for (const key of normalized.allKeys) {
			if (key === "__proto__") continue;
			const id = ids[key];
			const k = typeof key === "symbol" ? `syms[${syms.indexOf(key)}]` : esc(key);
			const isPresent = `${k} in input`;
			const schema = shape[key];
			const optin = schema?._zod?.optin;
			const isOptionalIn = optin !== void 0;
			const isOptionalOut = schema?._zod?.optout === "optional";
			doc.write(`const ${id} = ${parseStr(k)};`);
			if (isOptionalIn && isOptionalOut) {
				const assign = optin === "optional" ? `${id}_present` : `${id}.value !== undefined || ${id}_present`;
				doc.write(`
        const ${id}_present = ${isPresent};
        if (!${id}.issues.length || ${id}_present) {
          if (${id}.issues.length) {${prefixStr(id, k)}
          }

          if (${assign}) {
            newResult[${k}] = ${id}.value;
          }
        }

      `);
			} else if (!isOptionalIn) doc.write(`
        const ${id}_present = ${isPresent};
        if (${id}.issues.length) {${prefixStr(id, k)}
        }
        if (!${id}_present && !${id}.issues.length) {
          payload.issues.push({
            code: "invalid_type",
            expected: "nonoptional",
            input: undefined,
            path: [${k}]
          });
          if (ctx && ctx.abortEarly) {
            payload.value = newResult;
            return payload;
          }
        }

        if (${id}_present) {
          newResult[${k}] = ${id}.value;
        }

      `);
			else {
				doc.write(`
        if (${id}.issues.length) {${prefixStr(id, k)}
        }
      `);
				if (optin === "defaulted") doc.write(`newResult[${k}] = ${id}.value;`);
				else doc.write(`
        if (${id}.value !== undefined || ${isPresent}) {
          newResult[${k}] = ${id}.value;
        }
      `);
			}
		}
		doc.write(`payload.value = newResult;`);
		doc.write(`return payload;`);
		return doc.compile();
	};
	let fastpass;
	const isObject$2 = isObject;
	const jit = !globalConfig.jitless;
	const fastEnabled = jit && allowsEval.value;
	const catchall = def.catchall;
	let value;
	inst._zod.parse = (payload, ctx) => {
		value ?? (value = _normalized.value);
		const input = payload.value;
		if (!isObject$2(input)) {
			payload.issues.push({
				expected: "object",
				code: "invalid_type",
				input,
				inst
			});
			return payload;
		}
		if (jit && fastEnabled && ctx?.async === false && ctx.jitless !== true) {
			if (!fastpass) fastpass = generateFastpass(def.shape);
			payload = fastpass(payload, ctx);
			if (!catchall) return payload;
			return handleCatchall([], input, payload, ctx, value, inst, ctx?.abortEarly === true);
		}
		return superParse(payload, ctx);
	};
});
function handleUnionResults(results, final, inst, ctx) {
	for (const result of results) if (result.issues.length === 0) {
		final.value = result.value;
		return final;
	}
	const nonaborted = results.filter((r) => !aborted(r));
	if (nonaborted.length === 1) {
		final.value = nonaborted[0].value;
		return nonaborted[0];
	}
	final.issues.push({
		code: "invalid_union",
		input: final.value,
		inst,
		errors: results.map((result) => result.issues.map((iss) => finalizeIssue(iss, ctx, config())))
	});
	return final;
}
var $ZodUnion = /*@__PURE__*/ $constructor("$ZodUnion", (inst, def) => {
	$ZodType.init(inst, def);
	defineLazyInternal(inst, "optin", (zod) => zod.def.options.some((o) => o._zod.optin === "defaulted") ? "defaulted" : zod.def.options.some((o) => o._zod.optin !== void 0) ? "optional" : void 0);
	defineLazyInternal(inst, "optout", (zod) => zod.def.options.some((o) => o._zod.optout === "optional") ? "optional" : void 0);
	defineLazyInternal(inst, "values", (zod) => {
		if (zod.def.options.every((o) => o._zod.values)) return new Set(zod.def.options.flatMap((option) => Array.from(option._zod.values)));
	});
	defineLazyInternal(inst, "pattern", (zod) => {
		if (zod.def.options.every((o) => o._zod.pattern)) {
			const patterns = zod.def.options.map((o) => o._zod.pattern);
			return new RegExp(`^(${patterns.map((p) => cleanRegex(p.source)).join("|")})$`);
		}
	});
	const first = def.options.length === 1 ? def.options[0]._zod.run : null;
	inst._zod.parse = (payload, ctx) => {
		if (first) return first(payload, ctx);
		let async = false;
		const results = [];
		for (const option of def.options) {
			const result = option._zod.run({
				value: payload.value,
				issues: []
			}, ctx);
			if (result instanceof Promise) {
				results.push(result);
				async = true;
			} else {
				if (result.issues.length === 0) return result;
				results.push(result);
			}
		}
		if (!async) return handleUnionResults(results, payload, inst, ctx);
		return Promise.all(results).then((results) => {
			return handleUnionResults(results, payload, inst, ctx);
		});
	};
});
var $ZodIntersection = /*@__PURE__*/ $constructor("$ZodIntersection", (inst, def) => {
	$ZodType.init(inst, def);
	inst._zod.parse = (payload, ctx) => {
		const input = payload.value;
		const left = def.left._zod.run({
			value: input,
			issues: []
		}, ctx);
		const right = def.right._zod.run({
			value: input,
			issues: []
		}, ctx);
		if (left instanceof Promise || right instanceof Promise) return Promise.all([left, right]).then(([left, right]) => {
			return handleIntersectionResults(payload, left, right);
		});
		return handleIntersectionResults(payload, left, right);
	};
});
function mergeValues(a, b) {
	if (a === b) return {
		valid: true,
		data: a
	};
	if (a instanceof Date && b instanceof Date && +a === +b) return {
		valid: true,
		data: a
	};
	if (isPlainObject(a) && isPlainObject(b)) {
		const bKeys = Object.keys(b);
		const sharedKeys = Object.keys(a).filter((key) => bKeys.indexOf(key) !== -1);
		const newObj = {
			...a,
			...b
		};
		if (Object.prototype.hasOwnProperty.call(newObj, "__proto__")) delete newObj.__proto__;
		for (const key of sharedKeys) {
			if (key === "__proto__") continue;
			const sharedValue = mergeValues(a[key], b[key]);
			if (!sharedValue.valid) return {
				valid: false,
				mergeErrorPath: [key, ...sharedValue.mergeErrorPath]
			};
			newObj[key] = sharedValue.data;
		}
		return {
			valid: true,
			data: newObj
		};
	}
	if (Array.isArray(a) && Array.isArray(b)) {
		if (a.length !== b.length) return {
			valid: false,
			mergeErrorPath: []
		};
		const newArray = [];
		for (let index = 0; index < a.length; index++) {
			const itemA = a[index];
			const itemB = b[index];
			const sharedValue = mergeValues(itemA, itemB);
			if (!sharedValue.valid) return {
				valid: false,
				mergeErrorPath: [index, ...sharedValue.mergeErrorPath]
			};
			newArray.push(sharedValue.data);
		}
		return {
			valid: true,
			data: newArray
		};
	}
	return {
		valid: false,
		mergeErrorPath: []
	};
}
function handleIntersectionResults(result, left, right) {
	const unrecKeys = /* @__PURE__ */ new Map();
	let unrecIssue;
	const keyIssues = /* @__PURE__ */ new Map();
	const collect = (iss, side) => {
		let keys;
		if (iss.code === "unrecognized_keys" && !iss.path?.length) {
			unrecIssue ?? (unrecIssue = iss);
			keys = iss.keys;
		} else if (iss.code === "invalid_key" && iss.origin === "record" && iss.path?.length === 1) {
			const k = String(iss.path[0]);
			if (!keyIssues.has(k)) keyIssues.set(k, iss);
			keys = [k];
		} else return false;
		for (const k of keys) {
			if (!unrecKeys.has(k)) unrecKeys.set(k, {});
			unrecKeys.get(k)[side] = true;
		}
		return true;
	};
	for (const iss of left.issues) if (!collect(iss, "l")) result.issues.push(iss);
	for (const iss of right.issues) if (!collect(iss, "r")) result.issues.push(iss);
	const bothKeys = [...unrecKeys].filter(([, f]) => f.l && f.r).map(([k]) => k);
	if (bothKeys.length) {
		const aggregated = unrecIssue ? bothKeys.filter((k) => unrecIssue.keys.includes(k)) : [];
		if (aggregated.length) result.issues.push({
			...unrecIssue,
			keys: aggregated
		});
		for (const k of bothKeys) if (!aggregated.includes(k) && keyIssues.has(k)) result.issues.push(keyIssues.get(k));
	}
	const merged = mergeValues(left.value, right.value);
	if (!merged.valid) {
		if (aborted(result)) return result;
		throw new Error(`Unmergable intersection. Error path: ${JSON.stringify(merged.mergeErrorPath)}`);
	}
	result.value = merged.data;
	return result;
}
var $ZodRecord = /*@__PURE__*/ $constructor("$ZodRecord", (inst, def) => {
	$ZodType.init(inst, def);
	const memo = globalConfig.memoizer;
	memo?.attach(inst);
	inst._zod.parse = (payload, ctx) => {
		const input = payload.value;
		if (!isPlainObject(input)) {
			payload.issues.push({
				expected: "record",
				code: "invalid_type",
				input,
				inst
			});
			return payload;
		}
		const proms = [];
		const values = def.keyType._zod.values;
		if (values && !def.partial) {
			payload.value = memo ? memo.alloc(inst, payload, {}, ctx) : {};
			const recordKeys = /* @__PURE__ */ new Set();
			for (const key of values) if (typeof key === "string" || typeof key === "number" || typeof key === "symbol") {
				recordKeys.add(typeof key === "number" ? key.toString() : key);
				if (key === "__proto__") continue;
				const keyResult = def.keyType._zod.run({
					value: key,
					issues: []
				}, ctx);
				if (keyResult instanceof Promise) throw new Error("Async schemas not supported in object keys currently");
				if (keyResult.issues.length) {
					payload.issues.push({
						code: "invalid_key",
						origin: "record",
						issues: keyResult.issues.map((iss) => finalizeIssue(iss, ctx, config())),
						input: key,
						path: [key],
						inst
					});
					continue;
				}
				const outKey = keyResult.value;
				if (outKey === "__proto__") continue;
				const result = def.valueType._zod.run({
					value: input[key],
					issues: []
				}, ctx);
				if (result instanceof Promise) proms.push(result.then((result) => {
					if (result.issues.length) payload.issues.push(...prefixIssues(key, result.issues));
					payload.value[outKey] = result.value;
				}));
				else {
					if (result.issues.length) payload.issues.push(...prefixIssues(key, result.issues));
					payload.value[outKey] = result.value;
				}
			}
			let unrecognized;
			for (const key in input) if (!recordKeys.has(key)) {
				if (def.mode === "loose") {
					if (key === "__proto__") continue;
					payload.value[key] = input[key];
				} else {
					unrecognized = unrecognized ?? [];
					unrecognized.push(key);
				}
			}
			if (unrecognized && unrecognized.length > 0) payload.issues.push({
				code: "unrecognized_keys",
				input,
				inst,
				keys: unrecognized,
				continue: true
			});
		} else {
			payload.value = memo ? memo.alloc(inst, payload, {}, ctx) : {};
			let unrecognized;
			for (const key of Reflect.ownKeys(input)) {
				if (key === "__proto__") continue;
				if (!Object.prototype.propertyIsEnumerable.call(input, key)) continue;
				let keyResult = def.keyType._zod.run({
					value: key,
					issues: []
				}, ctx);
				if (keyResult instanceof Promise) throw new Error("Async schemas not supported in object keys currently");
				if (typeof key === "string" && number$1.test(key) && keyResult.issues.length) {
					const retryResult = def.keyType._zod.run({
						value: Number(key),
						issues: []
					}, ctx);
					if (retryResult instanceof Promise) throw new Error("Async schemas not supported in object keys currently");
					if (retryResult.issues.length === 0) keyResult = retryResult;
				}
				if (keyResult.issues.length) {
					if (def.mode === "loose") payload.value[key] = input[key];
					else if (values) {
						unrecognized = unrecognized ?? [];
						unrecognized.push(key);
					} else payload.issues.push({
						code: "invalid_key",
						origin: "record",
						issues: keyResult.issues.map((iss) => finalizeIssue(iss, ctx, config())),
						input: key,
						path: [key],
						inst
					});
					continue;
				}
				const outKey = keyResult.value;
				if (outKey === "__proto__") continue;
				const result = def.valueType._zod.run({
					value: input[key],
					issues: []
				}, ctx);
				if (result instanceof Promise) proms.push(result.then((result) => {
					if (result.issues.length) payload.issues.push(...prefixIssues(key, result.issues));
					payload.value[outKey] = result.value;
				}));
				else {
					if (result.issues.length) payload.issues.push(...prefixIssues(key, result.issues));
					payload.value[outKey] = result.value;
				}
			}
			if (unrecognized && unrecognized.length > 0) payload.issues.push({
				code: "unrecognized_keys",
				input,
				inst,
				keys: unrecognized,
				continue: true
			});
		}
		if (proms.length) return Promise.all(proms).then(() => payload);
		return payload;
	};
});
var $ZodEnum = /*@__PURE__*/ $constructor("$ZodEnum", (inst, def) => {
	$ZodType.init(inst, def);
	const values = getEnumValues(def.entries);
	const valuesSet = new Set(values);
	inst._zod.values = valuesSet;
	defineLazyInternal(inst, "pattern", (zod) => {
		const patternValues = getEnumValues(zod.def.entries).filter((k) => propertyKeyTypes.has(typeof k));
		return new RegExp(patternValues.length ? `^(${patternValues.map((o) => escapeRegex(o.toString())).join("|")})$` : "^[^\\s\\S]$");
	});
	inst._zod.parse = (payload, _ctx) => {
		const input = payload.value;
		if (valuesSet.has(input)) return payload;
		payload.issues.push({
			code: "invalid_value",
			values,
			input,
			inst
		});
		return payload;
	};
});
var $ZodLiteral = /*@__PURE__*/ $constructor("$ZodLiteral", (inst, def) => {
	$ZodType.init(inst, def);
	const values = new Set(def.values);
	inst._zod.values = values;
	defineLazyInternal(inst, "pattern", (zod) => {
		const vals = zod.def.values;
		return new RegExp(vals.length ? `^(${vals.map((o) => typeof o === "string" ? escapeRegex(o) : o ? escapeRegex(o.toString()) : String(o)).join("|")})$` : "^[^\\s\\S]$");
	});
	inst._zod.parse = (payload, _ctx) => {
		const input = payload.value;
		if (values.has(input)) return payload;
		payload.issues.push({
			code: "invalid_value",
			values: def.values,
			input,
			inst
		});
		return payload;
	};
});
var $ZodTransform = /*@__PURE__*/ $constructor("$ZodTransform", (inst, def) => {
	$ZodType.init(inst, def);
	inst._zod.optin = "optional";
	globalConfig.memoizer?.guard(inst);
	inst._zod.parse = (payload, ctx) => {
		if (ctx.direction === "backward") throw new $ZodEncodeError(inst.constructor.name);
		const _out = def.transform(payload.value, payload);
		if (ctx.async) return (_out instanceof Promise ? _out : Promise.resolve(_out)).then((output) => {
			payload.value = output;
			return payload;
		});
		if (_out instanceof Promise) throw new $ZodAsyncError();
		payload.value = _out;
		return payload;
	};
});
function handleOptionalResult(payload, result) {
	payload.value = result.issues.length ? void 0 : result.value;
	return payload;
}
var $ZodOptional = /*@__PURE__*/ $constructor("$ZodOptional", (inst, def) => {
	$ZodType.init(inst, def);
	defineLazyInternal(inst, "optin", (zod) => zod.def.innerType._zod.optin === "defaulted" ? "defaulted" : "optional");
	inst._zod.optout = "optional";
	defineLazyInternal(inst, "values", (zod) => {
		const values = zod.def.innerType._zod.values;
		return values ? /* @__PURE__ */ new Set([...values, void 0]) : void 0;
	});
	defineLazyInternal(inst, "pattern", (zod) => {
		const pattern = zod.def.innerType._zod.pattern;
		return pattern ? new RegExp(`^(${cleanRegex(pattern.source)})?$`) : void 0;
	});
	inst._zod.parse = (payload, ctx) => {
		if (payload.value === void 0) {
			if (def.innerType._zod.optin !== "defaulted") return payload;
			const result = def.innerType._zod.run({
				value: payload.value,
				issues: []
			}, ctx);
			if (result instanceof Promise) return result.then((result) => handleOptionalResult(payload, result));
			return handleOptionalResult(payload, result);
		}
		return def.innerType._zod.run(payload, ctx);
	};
});
var $ZodExactOptional = /*@__PURE__*/ $constructor("$ZodExactOptional", (inst, def) => {
	$ZodOptional.init(inst, def);
	defineLazyInternal(inst, "values", (zod) => zod.def.innerType._zod.values);
	defineLazyInternal(inst, "pattern", (zod) => zod.def.innerType._zod.pattern);
	inst._zod.parse = (payload, ctx) => {
		return def.innerType._zod.run(payload, ctx);
	};
});
var $ZodNullable = /*@__PURE__*/ $constructor("$ZodNullable", (inst, def) => {
	$ZodType.init(inst, def);
	defineLazyInternal(inst, "optin", (zod) => zod.def.innerType._zod.optin);
	defineLazyInternal(inst, "optout", (zod) => zod.def.innerType._zod.optout);
	defineLazyInternal(inst, "pattern", (zod) => {
		const pattern = zod.def.innerType._zod.pattern;
		return pattern ? new RegExp(`^(${cleanRegex(pattern.source)}|null)$`) : void 0;
	});
	defineLazyInternal(inst, "values", (zod) => {
		return zod.def.innerType._zod.values ? /* @__PURE__ */ new Set([...zod.def.innerType._zod.values, null]) : void 0;
	});
	inst._zod.parse = (payload, ctx) => {
		if (payload.value === null) return payload;
		return def.innerType._zod.run(payload, ctx);
	};
});
var $ZodDefault = /*@__PURE__*/ $constructor("$ZodDefault", (inst, def) => {
	$ZodType.init(inst, def);
	inst._zod.optin = "defaulted";
	defineLazyInternal(inst, "values", (zod) => zod.def.innerType._zod.values);
	inst._zod.parse = (payload, ctx) => {
		if (ctx.direction === "backward") return def.innerType._zod.run(payload, ctx);
		if (payload.value === void 0) {
			payload.value = def.defaultValue;
			/**
			* $ZodDefault returns the default value immediately in forward direction.
			* It doesn't pass the default value into the validator ("prefault"). There's no reason to pass the default value through validation. The validity of the default is enforced by TypeScript statically. Otherwise, it's the responsibility of the user to ensure the default is valid. In the case of pipes with divergent in/out types, you can specify the default on the `in` schema of your ZodPipe to set a "prefault" for the pipe.   */
			return payload;
		}
		const result = def.innerType._zod.run(payload, ctx);
		if (result instanceof Promise) return result.then((result) => handleDefaultResult(result, def));
		return handleDefaultResult(result, def);
	};
});
function handleDefaultResult(payload, def) {
	if (payload.value === void 0) payload.value = def.defaultValue;
	return payload;
}
var $ZodPrefault = /*@__PURE__*/ $constructor("$ZodPrefault", (inst, def) => {
	$ZodType.init(inst, def);
	inst._zod.optin = "defaulted";
	defineLazyInternal(inst, "values", (zod) => zod.def.innerType._zod.values);
	inst._zod.parse = (payload, ctx) => {
		if (ctx.direction === "backward") return def.innerType._zod.run(payload, ctx);
		if (payload.value === void 0) payload.value = def.defaultValue;
		return def.innerType._zod.run(payload, ctx);
	};
});
var $ZodNonOptional = /*@__PURE__*/ $constructor("$ZodNonOptional", (inst, def) => {
	$ZodType.init(inst, def);
	defineLazyInternal(inst, "values", (zod) => {
		const v = zod.def.innerType._zod.values;
		return v ? new Set([...v].filter((x) => x !== void 0)) : void 0;
	});
	inst._zod.parse = (payload, ctx) => {
		const result = def.innerType._zod.run(payload, ctx);
		if (result instanceof Promise) return result.then((result) => handleNonOptionalResult(result, inst));
		return handleNonOptionalResult(result, inst);
	};
});
function handleNonOptionalResult(payload, inst) {
	if (!payload.issues.length && payload.value === void 0) payload.issues.push({
		code: "invalid_type",
		expected: "nonoptional",
		input: payload.value,
		inst
	});
	return payload;
}
function handleCatchResult(payload, result, def, ctx) {
	if (!result.issues.length) {
		payload.value = result.value;
		if (result.memo) payload.memo = true;
		return payload;
	}
	payload.value = def.catchValue({
		...result,
		value: payload.value,
		error: { issues: result.issues.map((iss) => finalizeIssue(iss, ctx, config())) },
		input: payload.value
	});
	return payload;
}
var $ZodCatch = /*@__PURE__*/ $constructor("$ZodCatch", (inst, def) => {
	$ZodType.init(inst, def);
	defineLazyInternal(inst, "optin", (zod) => zod.def.innerType._zod.optin === "defaulted" ? "defaulted" : "optional");
	defineLazyInternal(inst, "optout", (zod) => zod.def.innerType._zod.optout);
	defineLazyInternal(inst, "values", (zod) => zod.def.innerType._zod.values);
	inst._zod.parse = (payload, ctx) => {
		if (ctx.direction === "backward") return def.innerType._zod.run(payload, ctx);
		const result = def.innerType._zod.run({
			value: payload.value,
			issues: []
		}, ctx);
		if (result instanceof Promise) return result.then((result) => handleCatchResult(payload, result, def, ctx));
		return handleCatchResult(payload, result, def, ctx);
	};
});
var $ZodPipe = /*@__PURE__*/ $constructor("$ZodPipe", (inst, def) => {
	$ZodType.init(inst, def);
	defineLazyInternal(inst, "values", (zod) => zod.def.in._zod.values);
	defineLazyInternal(inst, "optin", (zod) => zod.def.in._zod.optin);
	defineLazyInternal(inst, "optout", (zod) => zod.def.out._zod.optout);
	defineLazyInternal(inst, "propValues", (zod) => zod.def.in._zod.propValues);
	inst._zod.parse = (payload, ctx) => {
		if (ctx.direction === "backward") {
			const right = def.out._zod.run(payload, ctx);
			if (right instanceof Promise) return right.then((right) => handlePipeResult(right, def.in, ctx));
			return handlePipeResult(right, def.in, ctx);
		}
		const left = def.in._zod.run(payload, ctx);
		if (left instanceof Promise) return left.then((left) => handlePipeResult(left, def.out, ctx));
		return handlePipeResult(left, def.out, ctx);
	};
});
function handlePipeResult(left, next, ctx) {
	if (left.issues.some((iss) => iss.code !== "unrecognized_keys")) {
		left.aborted = true;
		return left;
	}
	return next._zod.run({
		value: left.value,
		issues: left.issues
	}, ctx);
}
var $ZodPreprocess = /*@__PURE__*/ $constructor("$ZodPreprocess", (inst, def) => {
	$ZodPipe.init(inst, def);
});
var $ZodReadonly = /*@__PURE__*/ $constructor("$ZodReadonly", (inst, def) => {
	$ZodType.init(inst, def);
	defineLazyInternal(inst, "propValues", (zod) => zod.def.innerType._zod.propValues);
	defineLazyInternal(inst, "values", (zod) => zod.def.innerType._zod.values);
	defineLazyInternal(inst, "optin", (zod) => zod.def.innerType?._zod?.optin);
	defineLazyInternal(inst, "optout", (zod) => zod.def.innerType?._zod?.optout);
	inst._zod.parse = (payload, ctx) => {
		if (ctx.direction === "backward") return def.innerType._zod.run(payload, ctx);
		const result = def.innerType._zod.run(payload, ctx);
		if (result instanceof Promise) return result.then(handleReadonlyResult);
		return handleReadonlyResult(result);
	};
});
function handleReadonlyResult(payload) {
	if (!payload.memo) payload.value = Object.freeze(payload.value);
	return payload;
}
var $ZodCustom = /*@__PURE__*/ $constructor("$ZodCustom", (inst, def) => {
	$ZodCheck.init(inst, def);
	$ZodType.init(inst, def);
	inst._zod.parse = (payload, _) => {
		return payload;
	};
	inst._zod.check = (payload) => {
		const input = payload.value;
		const r = def.fn(input);
		if (r instanceof Promise) return r.then((r) => handleRefineResult(r, payload, input, inst));
		handleRefineResult(r, payload, input, inst);
	};
});
function handleRefineResult(result, payload, input, inst) {
	if (!result) {
		const _iss = {
			code: "custom",
			input,
			inst,
			path: [...inst._zod.def.path ?? []],
			continue: !inst._zod.def.abort
		};
		if (inst._zod.def.params) _iss.params = inst._zod.def.params;
		payload.issues.push(issue(_iss));
	}
}
// ../code-for-antigravity/node_modules/zod/v4/core/memoizer.js
var $ZodCyclicError = class extends Error {
	constructor() {
		super(`Cannot parse a reference cycle that closes through a transform`);
		this.name = "ZodCyclicError";
	}
};
/** Keyed off the context object every schema in one parse call already shares. */
var STATE = "~memo";
var NO_ISSUES = [];
function isRef(value) {
	return value !== null && typeof value === "object";
}
function cloneIssues(issues) {
	return issues.map((iss) => iss.path ? {
		...iss,
		path: iss.path.slice()
	} : { ...iss });
}
var recursive = /*@__PURE__*/ new WeakMap();
/** What the walk established, in order of certainty: ordered so the strongest answer among children wins. */
var NONE = 0;
var ASSUMED = 1;
var PROVEN = 2;
/** Whether this schema's subtree contains a cycle, so one parse can re-enter it. */
function isRecursive(inst, stack, resolve) {
	const cached = recursive.get(inst);
	if (cached !== void 0) return cached ? PROVEN : NONE;
	if (stack.has(inst)) return PROVEN;
	stack.add(inst);
	let result = NONE;
	const check = (child) => {
		if (result !== PROVEN && child?._zod) {
			const answer = isRecursive(child, stack, resolve);
			if (answer > result) result = answer;
		}
	};
	const shape = (sh, spread) => {
		let answer = NONE;
		for (const key of Reflect.ownKeys(sh)) {
			const desc = Object.getOwnPropertyDescriptor(sh, key);
			if (spread && !desc.enumerable) continue;
			const child = desc.get ? ASSUMED : desc.value?._zod ? isRecursive(desc.value, stack, resolve) : NONE;
			if (child > answer) answer = child;
		}
		return answer;
	};
	const merge = (answer) => {
		if (answer > result) result = answer;
	};
	const def = inst._zod.def;
	switch (def.type) {
		case "object": {
			const raw = rawShape(def);
			merge(raw ? shape(raw, true) : ASSUMED);
			check(def.catchall);
			break;
		}
		case "array":
			check(def.element);
			break;
		case "tuple":
			for (const el of def.items) check(el);
			check(def.rest);
			break;
		case "record":
		case "map":
			check(def.keyType);
			check(def.valueType);
			break;
		case "set":
			check(def.valueType);
			break;
		case "union":
			for (const el of def.options) check(el);
			break;
		case "intersection":
			check(def.left);
			check(def.right);
			break;
		case "optional":
		case "nullable":
		case "default":
		case "prefault":
		case "catch":
		case "readonly":
		case "nonoptional":
		case "promise":
		case "success":
			check(def.innerType);
			break;
		case "pipe":
			check(def.in);
			check(def.out);
			break;
		case "function":
			check(def.input);
			check(def.output);
			break;
		case "lazy": {
			const inner = def._cachedInner ?? (resolve ? inst._zod.innerType : void 0);
			merge(inner ? isRecursive(inner, stack, false) : ASSUMED);
			break;
		}
		case "template_literal":
		case "string":
		case "number":
		case "int":
		case "boolean":
		case "bigint":
		case "symbol":
		case "undefined":
		case "null":
		case "void":
		case "never":
		case "any":
		case "unknown":
		case "date":
		case "nan":
		case "enum":
		case "literal":
		case "file":
		case "transform":
		case "custom": break;
		default: for (const key in def) {
			const desc = Object.getOwnPropertyDescriptor(def, key);
			if (!desc || desc.get) continue;
			const value = desc.value;
			if (!value || typeof value !== "object") continue;
			if (value._zod) check(value);
			else if (Array.isArray(value)) for (const el of value) check(el);
		}
	}
	stack.delete(inst);
	return settle(inst, result);
}
/** An assumed answer must not outlive the resolution that settles it, so only a certain one is cached. */
function settle(inst, answer) {
	if (answer !== ASSUMED) recursive.set(inst, answer === PROVEN);
	return answer;
}
function bucketFor(state, inst) {
	let bucket = state.buckets.get(inst);
	if (!bucket) {
		bucket = /* @__PURE__ */ new WeakMap();
		state.buckets.set(inst, bucket);
	}
	return bucket;
}
var handoff;
var open = [];
var memo = {
	alloc(_inst, payload, empty) {
		const bucket = handoff;
		if (!bucket) return empty;
		handoff = void 0;
		const entry = {
			value: empty,
			issues: null
		};
		bucket.set(payload.value, entry);
		open.push(entry);
		return empty;
	},
	guard(inst) {
		var _a;
		(_a = inst._zod).deferred ?? (_a.deferred = []);
		inst._zod.deferred.push(() => {
			const base = inst._zod.parse;
			const wrapped = (payload, ctx) => {
				if (ctx.direction !== "backward" && isBackEdge(ctx, payload.value)) throw new $ZodCyclicError();
				return base(payload, ctx);
			};
			inst._zod.parse = wrapped;
			if (inst._zod.run === base) inst._zod.run = wrapped;
		});
	},
	attach(inst) {
		var _a;
		let isRecursiveInst;
		let rechecked = false;
		let lastCtx;
		let lastBucket;
		(_a = inst._zod).deferred ?? (_a.deferred = []);
		inst._zod.deferred.push(() => {
			const base = inst._zod.parse;
			const wrapped = (payload, ctx) => {
				if (isRecursiveInst === void 0) {
					const walked = isRecursive(inst, /* @__PURE__ */ new Set(), false);
					if (walked === NONE) {
						inst._zod.parse = base;
						if (inst._zod.run === wrapped) inst._zod.run = base;
						return base(payload, ctx);
					}
					if (walked === PROVEN || rechecked) isRecursiveInst = true;
					else rechecked = true;
				}
				const input = payload.value;
				if (!isRef(input)) return base(payload, ctx);
				let state = ctx[STATE];
				if (!state) {
					state = {
						buckets: /* @__PURE__ */ new WeakMap(),
						backEdges: void 0
					};
					ctx[STATE] = state;
				}
				let bucket;
				if (lastCtx === ctx) bucket = lastBucket;
				else {
					bucket = bucketFor(state, inst);
					lastCtx = ctx;
					lastBucket = bucket;
				}
				const hit = bucket.get(input);
				if (hit) {
					payload.value = hit.value;
					if (hit.issues) {
						if (hit.issues.length) payload.issues.push(...cloneIssues(hit.issues));
					} else {
						payload.memo = true;
						state.backEdges ?? (state.backEdges = /* @__PURE__ */ new WeakSet());
						state.backEdges.add(hit.value);
					}
					return payload;
				}
				handoff = bucket;
				const depth = open.length;
				const result = base(payload, ctx);
				handoff = void 0;
				const entry = open.length > depth ? open.pop() : void 0;
				if (result instanceof Promise) return result.then((r) => {
					if (entry) entry.issues = r.issues.length ? cloneIssues(r.issues) : NO_ISSUES;
					return r;
				});
				if (entry) entry.issues = result.issues.length ? cloneIssues(result.issues) : NO_ISSUES;
				return result;
			};
			inst._zod.parse = wrapped;
			if (inst._zod.run === base) inst._zod.run = wrapped;
		});
	}
};
/** The memoizer that gives containers cycle support. `zod` installs it by default; `zod/mini` opts in with `config({ memoizer: memoizer() })`. */
function memoizer() {
	return memo;
}
/** Whether this value is a node a back-edge resolved to before it finished. */
function isBackEdge(ctx, value) {
	const backEdges = ctx[STATE]?.backEdges;
	return backEdges !== void 0 && isRef(value) && backEdges.has(value);
}
// ../code-for-antigravity/node_modules/zod/v4/locales/en.js
var error = () => {
	const Sizable = {
		string: {
			unit: "characters",
			verb: "to have"
		},
		file: {
			unit: "bytes",
			verb: "to have"
		},
		array: {
			unit: "items",
			verb: "to have"
		},
		set: {
			unit: "items",
			verb: "to have"
		},
		map: {
			unit: "entries",
			verb: "to have"
		}
	};
	function getSizing(origin) {
		return Sizable[origin] ?? null;
	}
	const FormatDictionary = {
		regex: "input",
		email: "email address",
		url: "URL",
		emoji: "emoji",
		uuid: "UUID",
		uuidv4: "UUIDv4",
		uuidv6: "UUIDv6",
		nanoid: "nanoid",
		guid: "GUID",
		cuid: "cuid",
		cuid2: "cuid2",
		ulid: "ULID",
		xid: "XID",
		ksuid: "KSUID",
		datetime: "ISO datetime",
		date: "ISO date",
		time: "ISO time",
		duration: "ISO duration",
		ipv4: "IPv4 address",
		ipv6: "IPv6 address",
		mac: "MAC address",
		cidrv4: "IPv4 range",
		cidrv6: "IPv6 range",
		base64: "base64-encoded string",
		base64url: "base64url-encoded string",
		json_string: "JSON string",
		e164: "E.164 number",
		currency_code: "currency code",
		credit_card: "credit card number",
		iban: "IBAN",
		jwt: "JWT",
		template_literal: "input"
	};
	const TypeDictionary = { nan: "NaN" };
	function getTypeName(type, input) {
		if (type === "number" && typeof input === "number" && !Number.isFinite(input)) return String(input);
		return TypeDictionary[type] ?? type;
	}
	return (issue) => {
		switch (issue.code) {
			case "invalid_type": return `Invalid input: expected ${getTypeName(issue.expected)}, received ${getTypeName(parsedType(issue.input), issue.input)}`;
			case "invalid_value":
				if (issue.values.length === 1) return `Invalid input: expected ${stringifyPrimitive(issue.values[0])}`;
				return `Invalid option: expected one of ${joinValues(issue.values, "|")}`;
			case "too_big": {
				const adj = issue.exact ? "exactly " : issue.inclusive ? "<=" : "<";
				const sizing = getSizing(issue.origin);
				if (sizing) return `Too big: expected ${issue.origin ?? "value"} to have ${adj}${issue.maximum.toString()} ${sizing.unit ?? "elements"}`;
				return `Too big: expected ${issue.origin ?? "value"} to be ${adj}${issue.maximum.toString()}`;
			}
			case "too_small": {
				const adj = issue.exact ? "exactly " : issue.inclusive ? ">=" : ">";
				const sizing = getSizing(issue.origin);
				if (sizing) return `Too small: expected ${issue.origin} to have ${adj}${issue.minimum.toString()} ${sizing.unit}`;
				return `Too small: expected ${issue.origin} to be ${adj}${issue.minimum.toString()}`;
			}
			case "invalid_format": {
				const _issue = issue;
				if (_issue.format === "starts_with") return `Invalid string: must start with "${_issue.prefix}"`;
				if (_issue.format === "ends_with") return `Invalid string: must end with "${_issue.suffix}"`;
				if (_issue.format === "includes") return `Invalid string: must include "${_issue.includes}"`;
				if (_issue.format === "regex") return `Invalid string: must match pattern ${_issue.pattern}`;
				return `Invalid ${FormatDictionary[_issue.format] ?? issue.format}`;
			}
			case "not_multiple_of": return `Invalid number: must be a multiple of ${issue.divisor}`;
			case "unrecognized_keys": return `Unrecognized key${issue.keys.length > 1 ? "s" : ""}: ${joinValues(issue.keys, ", ")}`;
			case "invalid_key": return `Invalid key in ${issue.origin}`;
			case "invalid_union":
				if (issue.options && Array.isArray(issue.options) && issue.options.length > 0) return `Invalid discriminator value. Expected ${issue.options.map((o) => `'${o}'`).join(" | ")}`;
				if (issue.inclusive === false) return "Invalid input: more than one option matched";
				return "Invalid input";
			case "invalid_element": return `Invalid value in ${issue.origin}`;
			default: return `Invalid input`;
		}
	};
};
function en_default() {
	return { localeError: error() };
}
// ../code-for-antigravity/node_modules/zod/v4/core/registries.js
var _a;
var $ZodRegistry = class {
	constructor() {
		this._map = /* @__PURE__ */ new WeakMap();
		this._idmap = /* @__PURE__ */ new Map();
	}
	add(schema, ..._meta) {
		const meta = _meta[0];
		this._map.set(schema, meta);
		if (meta && typeof meta === "object" && "id" in meta) this._idmap.set(meta.id, schema);
		return this;
	}
	clear() {
		this._map = /* @__PURE__ */ new WeakMap();
		this._idmap = /* @__PURE__ */ new Map();
		return this;
	}
	remove(schema) {
		const meta = this._map.get(schema);
		if (meta && typeof meta === "object" && "id" in meta) this._idmap.delete(meta.id);
		this._map.delete(schema);
		return this;
	}
	get(schema) {
		const p = schema._zod.parent;
		if (p) {
			const pm = { ...this.get(p) ?? {} };
			delete pm.id;
			const f = {
				...pm,
				...this._map.get(schema)
			};
			return Object.keys(f).length ? f : void 0;
		}
		return this._map.get(schema);
	}
	has(schema) {
		return this._map.has(schema);
	}
};
function registry() {
	return new $ZodRegistry();
}
(_a = globalThis).__zod_globalRegistry ?? (_a.__zod_globalRegistry = registry());
var globalRegistry = globalThis.__zod_globalRegistry;
// ../code-for-antigravity/node_modules/zod/v4/core/api.js
function snapshotChecks(def) {
	if (def.checks) def.checks = [...def.checks];
	return def;
}
// @__NO_SIDE_EFFECTS__
function _string(Class, params) {
	return new Class(snapshotChecks({
		type: "string",
		...normalizeParams(params)
	}));
}
// @__NO_SIDE_EFFECTS__
function _email(Class, params) {
	return new Class({
		type: "string",
		format: "email",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _guid(Class, params) {
	return new Class({
		type: "string",
		format: "guid",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _uuid(Class, params) {
	return new Class({
		type: "string",
		format: "uuid",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _uuidv4(Class, params) {
	return new Class({
		type: "string",
		format: "uuid",
		check: "string_format",
		abort: false,
		version: "v4",
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _uuidv6(Class, params) {
	return new Class({
		type: "string",
		format: "uuid",
		check: "string_format",
		abort: false,
		version: "v6",
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _uuidv7(Class, params) {
	return new Class({
		type: "string",
		format: "uuid",
		check: "string_format",
		abort: false,
		version: "v7",
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _url(Class, params) {
	return new Class({
		type: "string",
		format: "url",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _emoji(Class, params) {
	return new Class({
		type: "string",
		format: "emoji",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _nanoid(Class, params) {
	return new Class({
		type: "string",
		format: "nanoid",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
/**
* @deprecated CUID v1 is deprecated by its authors due to information leakage
* (timestamps embedded in the id). Use {@link _cuid2} instead.
* See https://github.com/paralleldrive/cuid.
*/
// @__NO_SIDE_EFFECTS__
function _cuid(Class, params) {
	return new Class({
		type: "string",
		format: "cuid",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _cuid2(Class, params) {
	return new Class({
		type: "string",
		format: "cuid2",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _ulid(Class, params) {
	return new Class({
		type: "string",
		format: "ulid",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _xid(Class, params) {
	return new Class({
		type: "string",
		format: "xid",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _ksuid(Class, params) {
	return new Class({
		type: "string",
		format: "ksuid",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _ipv4(Class, params) {
	return new Class({
		type: "string",
		format: "ipv4",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _ipv6(Class, params) {
	return new Class({
		type: "string",
		format: "ipv6",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _cidrv4(Class, params) {
	return new Class({
		type: "string",
		format: "cidrv4",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _cidrv6(Class, params) {
	return new Class({
		type: "string",
		format: "cidrv6",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _base64(Class, params) {
	return new Class({
		type: "string",
		format: "base64",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _base64url(Class, params) {
	return new Class({
		type: "string",
		format: "base64url",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _e164(Class, params) {
	return new Class({
		type: "string",
		format: "e164",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _jwt(Class, params) {
	return new Class({
		type: "string",
		format: "jwt",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _isoDateTime(Class, params) {
	return new Class({
		type: "string",
		format: "datetime",
		check: "string_format",
		offset: false,
		local: false,
		precision: null,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _isoDate(Class, params) {
	return new Class({
		type: "string",
		format: "date",
		check: "string_format",
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _isoTime(Class, params) {
	return new Class({
		type: "string",
		format: "time",
		check: "string_format",
		precision: null,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _isoDuration(Class, params) {
	return new Class({
		type: "string",
		format: "duration",
		check: "string_format",
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _number(Class, params) {
	return new Class(snapshotChecks({
		type: "number",
		checks: [],
		...normalizeParams(params)
	}));
}
// @__NO_SIDE_EFFECTS__
function _int(Class, params) {
	return new Class({
		type: "number",
		check: "number_format",
		abort: false,
		format: "safeint",
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _boolean(Class, params) {
	return new Class({
		type: "boolean",
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _null$1(Class, params) {
	return new Class({
		type: "null",
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _unknown(Class) {
	return new Class({ type: "unknown" });
}
// @__NO_SIDE_EFFECTS__
function _never(Class, params) {
	return new Class({
		type: "never",
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _lt(value, params) {
	return new $ZodCheckLessThan({
		check: "less_than",
		...normalizeParams(params),
		value,
		inclusive: false
	});
}
// @__NO_SIDE_EFFECTS__
function _lte(value, params) {
	return new $ZodCheckLessThan({
		check: "less_than",
		...normalizeParams(params),
		value,
		inclusive: true
	});
}
// @__NO_SIDE_EFFECTS__
function _gt(value, params) {
	return new $ZodCheckGreaterThan({
		check: "greater_than",
		...normalizeParams(params),
		value,
		inclusive: false
	});
}
// @__NO_SIDE_EFFECTS__
function _gte(value, params) {
	return new $ZodCheckGreaterThan({
		check: "greater_than",
		...normalizeParams(params),
		value,
		inclusive: true
	});
}
// @__NO_SIDE_EFFECTS__
function _multipleOf(value, params) {
	return new $ZodCheckMultipleOf({
		check: "multiple_of",
		...normalizeParams(params),
		value
	});
}
// @__NO_SIDE_EFFECTS__
function _maxLength(maximum, params) {
	return new $ZodCheckMaxLength({
		check: "max_length",
		...normalizeParams(params),
		maximum
	});
}
// @__NO_SIDE_EFFECTS__
function _minLength(minimum, params) {
	return new $ZodCheckMinLength({
		check: "min_length",
		...normalizeParams(params),
		minimum
	});
}
// @__NO_SIDE_EFFECTS__
function _length(length, params) {
	return new $ZodCheckLengthEquals({
		check: "length_equals",
		...normalizeParams(params),
		length
	});
}
// @__NO_SIDE_EFFECTS__
function _regex(pattern, params) {
	return new $ZodCheckRegex({
		check: "string_format",
		format: "regex",
		...normalizeParams(params),
		pattern
	});
}
// @__NO_SIDE_EFFECTS__
function _lowercase(params) {
	return new $ZodCheckLowerCase({
		check: "string_format",
		format: "lowercase",
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _uppercase(params) {
	return new $ZodCheckUpperCase({
		check: "string_format",
		format: "uppercase",
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _includes(includes, params) {
	return new $ZodCheckIncludes({
		check: "string_format",
		format: "includes",
		...normalizeParams(params),
		includes
	});
}
// @__NO_SIDE_EFFECTS__
function _startsWith(prefix, params) {
	return new $ZodCheckStartsWith({
		check: "string_format",
		format: "starts_with",
		...normalizeParams(params),
		prefix
	});
}
// @__NO_SIDE_EFFECTS__
function _endsWith(suffix, params) {
	return new $ZodCheckEndsWith({
		check: "string_format",
		format: "ends_with",
		...normalizeParams(params),
		suffix
	});
}
// @__NO_SIDE_EFFECTS__
function _overwrite(tx) {
	return new $ZodCheckOverwrite({
		check: "overwrite",
		tx
	});
}
// @__NO_SIDE_EFFECTS__
function _normalize(form) {
	return /* @__PURE__ */ _overwrite((input) => input.normalize(form));
}
// @__NO_SIDE_EFFECTS__
function _trim() {
	return /* @__PURE__ */ _overwrite((input) => input.trim());
}
// @__NO_SIDE_EFFECTS__
function _toLowerCase() {
	return /* @__PURE__ */ _overwrite((input) => input.toLowerCase());
}
// @__NO_SIDE_EFFECTS__
function _toUpperCase() {
	return /* @__PURE__ */ _overwrite((input) => input.toUpperCase());
}
// @__NO_SIDE_EFFECTS__
function _slugify() {
	return /* @__PURE__ */ _overwrite((input) => slugify(input));
}
// @__NO_SIDE_EFFECTS__
function _array(Class, element, params) {
	return new Class({
		type: "array",
		element,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _refine(Class, fn, _params) {
	return new Class({
		type: "custom",
		check: "custom",
		fn,
		...normalizeParams(_params)
	});
}
// @__NO_SIDE_EFFECTS__
function _superRefine(fn, params) {
	const ch = /* @__PURE__ */ _check((payload) => {
		payload.addIssue = (issue$2) => {
			if (typeof issue$2 === "string") payload.issues.push(issue(issue$2, payload.value, ch._zod.def));
			else {
				const _issue = issue$2;
				if (_issue.fatal) _issue.continue = false;
				_issue.code ?? (_issue.code = "custom");
				if (!("input" in _issue)) _issue.input = payload.value;
				_issue.inst ?? (_issue.inst = ch);
				_issue.continue ?? (_issue.continue = !ch._zod.def.abort);
				payload.issues.push(issue(_issue));
			}
		};
		return fn(payload.value, payload);
	}, params);
	return ch;
}
// @__NO_SIDE_EFFECTS__
function _check(fn, params) {
	const ch = new $ZodCheck({
		check: "custom",
		...normalizeParams(params)
	});
	ch._zod.check = fn;
	return ch;
}
// ../code-for-antigravity/node_modules/zod/v4/core/to-json-schema.js
function assignProps(target, ...sources) {
	for (const source of sources) for (const key of Reflect.ownKeys(source)) if (Object.prototype.propertyIsEnumerable.call(source, key)) assignProp(target, key, source[key]);
	return target;
}
function initializeContext(params) {
	let target = params?.target ?? "draft-2020-12";
	if (target === "draft-4") target = "draft-04";
	if (target === "draft-7") target = "draft-07";
	return {
		processors: params.processors ?? {},
		metadataRegistry: params?.metadata ?? globalRegistry,
		target,
		unrepresentable: params?.unrepresentable ?? "throw",
		override: params?.override ?? (() => {}),
		io: params?.io ?? "output",
		counter: 0,
		seen: /* @__PURE__ */ new Map(),
		sharedDefsExtractedFor: void 0,
		sharedEmitDoneFor: void 0,
		cycles: params?.cycles ?? "ref",
		reused: params?.reused ?? "inline",
		intersections: [],
		deferred: [],
		external: params?.external ?? void 0
	};
}
/**
* Applies the `unrepresentable` setting at a site that has no JSON Schema equivalent. Throws
* `message` unless the setting (or the handler's return value) says otherwise. Returns `true` if a
* custom JSON Schema was written into `json`, in which case the caller must not write its own.
*/
function handleUnrepresentable(schema, ctx, json, params, message) {
	const result = typeof ctx.unrepresentable === "function" ? ctx.unrepresentable({
		zodSchema: schema,
		path: params.path,
		message
	}) : ctx.unrepresentable;
	if (result === "any") return false;
	if (result === void 0 || result === "throw") throw new Error(message);
	Object.assign(json, result);
	return true;
}
function processSchema(schema, ctx, _params = {
	path: [],
	schemaPath: []
}) {
	var _a;
	const def = schema._zod.def;
	const seen = ctx.seen.get(schema);
	if (seen) {
		seen.count++;
		if (_params.schemaPath.includes(schema)) seen.cycle = _params.path;
		return seen.schema;
	}
	const result = {
		schema: {},
		count: 1,
		cycle: void 0,
		path: _params.path
	};
	ctx.seen.set(schema, result);
	ctx.sharedDefsExtractedFor = void 0;
	ctx.sharedEmitDoneFor = void 0;
	const overrideSchema = schema._zod.toJSONSchema?.();
	if (overrideSchema) result.schema = overrideSchema;
	else {
		const params = {
			..._params,
			schemaPath: [..._params.schemaPath, schema],
			path: _params.path
		};
		if (schema._zod.processJSONSchema) schema._zod.processJSONSchema(ctx, result.schema, params);
		else {
			const _json = result.schema;
			const processor = ctx.processors[def.type];
			if (!processor) throw new Error(`[toJSONSchema]: Non-representable type encountered: ${def.type}`);
			processor(schema, ctx, _json, params);
		}
		const parent = schema._zod.parent;
		if (parent) {
			if (!result.ref) result.ref = parent;
			processSchema(parent, ctx, params);
			ctx.seen.get(parent).isParent = true;
		}
	}
	const meta = ctx.metadataRegistry.get(schema);
	if (meta) assignProps(result.schema, meta);
	if (ctx.io === "input" && isTransforming(schema)) {
		delete result.schema.examples;
		delete result.schema.default;
	}
	if (ctx.io === "input" && "_prefault" in result.schema) (_a = result.schema).default ?? (_a.default = result.schema._prefault);
	delete result.schema._prefault;
	return ctx.seen.get(schema).schema;
}
function encodeJSONPointerSegment(segment) {
	return segment.replace(/~/g, "~0").replace(/\//g, "~1");
}
function extractDefs(ctx, schema) {
	const root = ctx.seen.get(schema);
	if (!root) throw new Error("Unprocessed schema. This is a bug in Zod.");
	if (ctx.external && ctx.sharedDefsExtractedFor === ctx.external) return;
	const idToSchema = /* @__PURE__ */ new Map();
	for (const entry of ctx.seen.entries()) {
		const id = ctx.metadataRegistry.get(entry[0])?.id;
		if (id) {
			const existing = idToSchema.get(id);
			if (existing && existing !== entry[0]) throw new Error(`Duplicate schema id "${id}" detected during JSON Schema conversion. Two different schemas cannot share the same id when converted together.`);
			idToSchema.set(id, entry[0]);
		}
	}
	const makeURI = (entry) => {
		const defsSegment = ctx.target === "draft-2020-12" ? "$defs" : "definitions";
		if (ctx.external) {
			const externalId = ctx.external.registry.get(entry[0])?.id;
			const uriGenerator = ctx.external.uri ?? ((id) => id);
			if (externalId) return { ref: uriGenerator(externalId) };
			const id = entry[1].defId ?? entry[1].schema.id ?? `schema${ctx.counter++}`;
			entry[1].defId = id;
			return {
				defId: id,
				ref: `${uriGenerator("__shared")}#/${defsSegment}/${encodeJSONPointerSegment(id)}`
			};
		}
		const uriPrefix = `#`;
		const defUriPrefix = `${uriPrefix}/${defsSegment}/`;
		if (entry[1] === root && !entry[1].schema.id) return { ref: uriPrefix };
		const defId = entry[1].schema.id ?? `__schema${ctx.counter++}`;
		return {
			defId,
			ref: defUriPrefix + encodeJSONPointerSegment(defId)
		};
	};
	const extractToDef = (entry) => {
		if (entry[1].schema.$ref) return;
		const seen = entry[1];
		const { ref, defId } = makeURI(entry);
		seen.def = { ...seen.schema };
		if (defId) seen.defId = defId;
		const schema = seen.schema;
		for (const key in schema) delete schema[key];
		schema.$ref = ref;
	};
	if (ctx.cycles === "throw") for (const entry of ctx.seen.entries()) {
		const seen = entry[1];
		if (seen.cycle) throw new Error(`Cycle detected: #/${seen.cycle?.join("/")}/<root>

Set the \`cycles\` parameter to \`"ref"\` to resolve cyclical schemas with defs.`);
	}
	for (const entry of ctx.seen.entries()) {
		const seen = entry[1];
		if (schema === entry[0]) {
			extractToDef(entry);
			continue;
		}
		if (ctx.external) {
			const ext = ctx.external.registry.get(entry[0])?.id;
			if (schema !== entry[0] && ext) {
				extractToDef(entry);
				continue;
			}
		}
		if (ctx.metadataRegistry.get(entry[0])?.id) {
			extractToDef(entry);
			continue;
		}
		if (seen.cycle) {
			extractToDef(entry);
			continue;
		}
		if (seen.count > 1) {
			if (ctx.reused === "ref") extractToDef(entry);
		}
	}
	if (ctx.external) ctx.sharedDefsExtractedFor = ctx.external;
}
/** Rewrites `anyOf: [{type: "a"}, {type: "b"}]` to `type: ["a", "b"]`, which every JSON Schema draft treats as equivalent and most consumers render far better for the nullable case. Only branches that are a bare type assertion qualify — anything carrying a constraint, `$ref`, `const` or metadata is left alone. Runs after `flattenRef`, so a branch an override decorated or `$defs` extraction turned into a `$ref` is no longer bare and correctly stays in `anyOf`. `oneOf` is excluded: `integer` and `number` overlap, so "exactly one" and "at least one" are not the same there. OpenAPI 3.0 is excluded: its `type` must be a single string. */
function compactTypeUnion(schema) {
	const options = schema.anyOf;
	if (!Array.isArray(options) || options.length === 0 || schema.type !== void 0) return;
	const types = [];
	for (const option of options) {
		if (!option || typeof option !== "object") return;
		compactTypeUnion(option);
		const keys = Object.keys(option);
		if (keys.length !== 1 || keys[0] !== "type") return;
		const type = option.type;
		for (const member of Array.isArray(type) ? type : [type]) {
			if (typeof member !== "string") return;
			if (!types.includes(member)) types.push(member);
		}
	}
	delete schema.anyOf;
	schema.type = types.length === 1 ? types[0] : types;
}
/** Keywords `foldIntersection` knows how to combine. Anything else — `$ref`, `patternProperties`,
* an annotation like `description` — makes a member unfoldable, so a constraint this does not
* understand leaves the `allOf` alone instead of being silently dropped or misattributed. */
var FOLDABLE_KEYS = /* @__PURE__ */ new Set([
	"type",
	"properties",
	"required",
	"additionalProperties"
]);
var UNION_KEYS = ["oneOf", "anyOf"];
/** A member's constraint on a key it does not declare itself. A `catchall` states one; `false`, an absent `additionalProperties`, and the empty schema a loose object emits state nothing. */
function undeclaredConstraint(member) {
	const extra = member.additionalProperties;
	if (extra === void 0 || extra === false || typeof extra !== "object" || extra === null) return null;
	return Object.keys(extra).length ? extra : null;
}
/** Combines object members into the single object they describe together, or returns `null` if any of them carries a keyword outside {@link FOLDABLE_KEYS}. */
function foldObjects(members) {
	const objects = [];
	for (const member of members) {
		if (typeof member !== "object" || member.type !== "object") return null;
		for (const key in member) if (!FOLDABLE_KEYS.has(key)) return null;
		objects.push(member);
	}
	const properties = {};
	const required = /* @__PURE__ */ new Set();
	for (const object of objects) {
		for (const key in object.properties) {
			if (Object.prototype.hasOwnProperty.call(properties, key)) continue;
			const parts = [];
			for (const other of objects) {
				const part = other.properties?.[key] ?? undeclaredConstraint(other);
				if (part === null || part === void 0) continue;
				if (!parts.some((seen) => JSON.stringify(seen) === JSON.stringify(part))) parts.push(part);
			}
			assignProp(properties, key, parts.length === 1 ? parts[0] : foldObjects(parts) ?? { allOf: parts });
		}
		for (const key of object.required ?? []) required.add(key);
	}
	const folded = {
		type: "object",
		properties
	};
	if (required.size) folded.required = [...required];
	if (objects.every((object) => object.additionalProperties === false)) folded.additionalProperties = false;
	else {
		const constraints = [];
		for (const object of objects) {
			const constraint = undeclaredConstraint(object);
			if (constraint && !constraints.some((seen) => JSON.stringify(seen) === JSON.stringify(constraint))) constraints.push(constraint);
		}
		if (constraints.length === 1) folded.additionalProperties = constraints[0];
		else if (constraints.length > 1) folded.additionalProperties = { allOf: constraints };
	}
	return folded;
}
/** `additionalProperties` in an `allOf` member sees only that member's own `properties`, so two
* closed object members reject each other's keys and the schema validates nothing. Zod's parser
* pools the key sets instead — `handleIntersectionResults` reports a key as unrecognized only when
* *every* side rejects it — so the emitted schema has to pool them too, and folding the members
* into one object is the encoding that says so on every target.
*
* This runs from `finalize`, after `extractDefs`, which is what keeps it clear of the `$ref`
* machinery: a member extracted into `$defs` is already a `$ref` by now and declines to fold, so it
* keeps its reference and its own closedness rather than being inlined as a stale copy. */
function foldIntersection(json) {
	const allOf = json.allOf;
	if (!Array.isArray(allOf) || allOf.length < 2) return;
	for (const key of FOLDABLE_KEYS) if (key in json) return;
	const unions = allOf.filter((m) => UNION_KEYS.some((k) => Array.isArray(m[k])));
	let folded = null;
	if (!unions.length) folded = foldObjects(allOf);
	else {
		const union = unions[0];
		const keyword = UNION_KEYS.find((k) => Array.isArray(union[k]));
		if (Object.keys(union).length !== 1) return;
		const rest = allOf.filter((m) => m !== union);
		const branches = union[keyword].map((branch) => foldObjects([...rest, branch]));
		if (branches.some((b) => !b)) return;
		folded = { [keyword]: branches };
	}
	if (!folded) return;
	delete json.allOf;
	assignProps(json, folded);
}
function finalize(ctx, schema) {
	const root = ctx.seen.get(schema);
	if (!root) throw new Error("Unprocessed schema. This is a bug in Zod.");
	const flattenRef = (zodSchema) => {
		const seen = ctx.seen.get(zodSchema);
		if (seen.ref === null) return;
		const schema = seen.def ?? seen.schema;
		const _cached = { ...schema };
		const ref = seen.ref;
		seen.ref = null;
		if (ref) {
			flattenRef(ref);
			const refSeen = ctx.seen.get(ref);
			const refSchema = refSeen.schema;
			if (refSchema.$ref && (ctx.target === "draft-07" || ctx.target === "draft-04" || ctx.target === "openapi-3.0")) {
				schema.allOf = schema.allOf ?? [];
				schema.allOf.push(refSchema);
			} else assignProps(schema, refSchema);
			assignProps(schema, _cached);
			if (zodSchema._zod.parent === ref) for (const key in schema) {
				if (key === "$ref" || key === "allOf") continue;
				if (!(key in _cached)) delete schema[key];
			}
			if (refSchema.$ref && refSeen.def) for (const key in schema) {
				if (key === "$ref" || key === "allOf") continue;
				if (key in refSeen.def && JSON.stringify(schema[key]) === JSON.stringify(refSeen.def[key])) delete schema[key];
			}
		}
		const parent = zodSchema._zod.parent;
		if (parent && parent !== ref) {
			flattenRef(parent);
			const parentSeen = ctx.seen.get(parent);
			if (parentSeen?.schema.$ref) {
				schema.$ref = parentSeen.schema.$ref;
				if (parentSeen.def) for (const key in schema) {
					if (key === "$ref" || key === "allOf") continue;
					if (key in parentSeen.def && JSON.stringify(schema[key]) === JSON.stringify(parentSeen.def[key])) delete schema[key];
				}
			}
		}
		ctx.override({
			zodSchema,
			jsonSchema: schema,
			path: seen.path ?? []
		});
	};
	if (!ctx.external || ctx.sharedEmitDoneFor !== ctx.external) {
		for (const entry of [...ctx.seen.entries()].reverse()) flattenRef(entry[0]);
		if (ctx.target !== "openapi-3.0") for (const entry of ctx.seen.entries()) compactTypeUnion(entry[1].def ?? entry[1].schema);
		for (const rewrite of ctx.deferred) rewrite();
		if (ctx.intersections.length) {
			const carriers = /* @__PURE__ */ new Map();
			for (const seen of ctx.seen.values()) for (const json of [seen.schema, seen.def]) {
				const allOf = json?.allOf;
				if (!Array.isArray(allOf)) continue;
				const existing = carriers.get(allOf);
				if (existing) existing.push(json);
				else carriers.set(allOf, [json]);
			}
			for (const allOf of ctx.intersections) for (const json of carriers.get(allOf) ?? []) foldIntersection(json);
		}
	}
	const result = {};
	if (ctx.target === "draft-2020-12") result.$schema = "https://json-schema.org/draft/2020-12/schema";
	else if (ctx.target === "draft-07") result.$schema = "http://json-schema.org/draft-07/schema#";
	else if (ctx.target === "draft-04") result.$schema = "http://json-schema.org/draft-04/schema#";
	else if (ctx.target === "openapi-3.0") {}
	if (ctx.external?.uri) {
		const id = ctx.external.registry.get(schema)?.id;
		if (!id) throw new Error("Schema is missing an `id` property");
		result.$id = ctx.external.uri(id);
	}
	assignProps(result, root.defId ? root.schema : root.def ?? root.schema);
	const rootMetaId = ctx.metadataRegistry.get(schema)?.id;
	if (rootMetaId !== void 0 && result.id === rootMetaId) delete result.id;
	const defs = ctx.external?.defs ?? {};
	if (!ctx.external || ctx.sharedEmitDoneFor !== ctx.external) for (const entry of ctx.seen.entries()) {
		const seen = entry[1];
		if (seen.def && seen.defId) {
			if (seen.def.id === seen.defId) delete seen.def.id;
			assignProp(defs, seen.defId, seen.def);
		}
	}
	if (ctx.external) ctx.sharedEmitDoneFor = ctx.external;
	if (ctx.external) {} else if (Object.keys(defs).length > 0) {
		if (ctx.target === "draft-2020-12") result.$defs = defs;
		else result.definitions = defs;
	}
	try {
		const finalized = JSON.parse(JSON.stringify(result));
		Object.defineProperty(finalized, "~standard", {
			value: {
				...schema["~standard"],
				jsonSchema: {
					input: createStandardJSONSchemaMethod(schema, "input", ctx.processors),
					output: createStandardJSONSchemaMethod(schema, "output", ctx.processors)
				}
			},
			enumerable: false,
			writable: false
		});
		return finalized;
	} catch (_err) {
		throw new Error("Error converting schema to JSON.");
	}
}
function isTransforming(_schema, _ctx) {
	const ctx = _ctx ?? { seen: /* @__PURE__ */ new Set() };
	if (ctx.seen.has(_schema)) return false;
	ctx.seen.add(_schema);
	const def = _schema._zod.def;
	if (def.type === "transform") return true;
	if (def.type === "array") return isTransforming(def.element, ctx);
	if (def.type === "set") return isTransforming(def.valueType, ctx);
	if (def.type === "lazy") return isTransforming(def.getter(), ctx);
	if (def.type === "promise" || def.type === "optional" || def.type === "nonoptional" || def.type === "nullable" || def.type === "readonly" || def.type === "default" || def.type === "prefault" || def.type === "catch") return isTransforming(def.innerType, ctx);
	if (def.type === "intersection") return isTransforming(def.left, ctx) || isTransforming(def.right, ctx);
	if (def.type === "record" || def.type === "map") return isTransforming(def.keyType, ctx) || isTransforming(def.valueType, ctx);
	if (def.type === "pipe") {
		if (_schema._zod.traits.has("$ZodCodec")) return true;
		return isTransforming(def.in, ctx) || isTransforming(def.out, ctx);
	}
	if (def.type === "object") {
		for (const key in def.shape) if (isTransforming(def.shape[key], ctx)) return true;
		return false;
	}
	if (def.type === "union") {
		for (const option of def.options) if (isTransforming(option, ctx)) return true;
		return false;
	}
	if (def.type === "tuple") {
		for (const item of def.items) if (isTransforming(item, ctx)) return true;
		if (def.rest && isTransforming(def.rest, ctx)) return true;
		return false;
	}
	return false;
}
/**
* Creates a toJSONSchema method for a schema instance.
* This encapsulates the logic of initializing context, processing, extracting defs, and finalizing.
*/
var createToJSONSchemaMethod = (schema, processors = {}) => (params) => {
	const ctx = initializeContext({
		...params,
		processors
	});
	processSchema(schema, ctx);
	extractDefs(ctx, schema);
	return finalize(ctx, schema);
};
var createStandardJSONSchemaMethod = (schema, io, processors = {}) => (params) => {
	const { libraryOptions, target } = params ?? {};
	const ctx = initializeContext({
		...libraryOptions ?? {},
		target,
		io,
		processors
	});
	processSchema(schema, ctx);
	extractDefs(ctx, schema);
	return finalize(ctx, schema);
};
// ../code-for-antigravity/node_modules/zod/v4/core/json-schema-processors.js
var narrowMin = (agg, key, value) => {
	if (agg[key] === void 0 || value > agg[key]) agg[key] = value;
};
var narrowMax = (agg, key, value) => {
	if (agg[key] === void 0 || value < agg[key]) agg[key] = value;
};
var narrowBoth = (agg, value) => {
	narrowMin(agg, "minimum", value);
	narrowMax(agg, "maximum", value);
};
var addDivisor = (agg, value) => {
	agg.multipleOf ?? (agg.multipleOf = []);
	if (!agg.multipleOf.includes(value)) agg.multipleOf.push(value);
};
var addPattern = (agg, pattern) => {
	agg.patterns ?? (agg.patterns = /* @__PURE__ */ new Set());
	agg.patterns.add(pattern);
};
var intersectMime = (agg, mime) => {
	agg.mime = agg.mime ? agg.mime.filter((m) => mime.includes(m)) : [...mime];
};
var setFormat = (agg, format) => {
	agg.format = format;
	if (format.includes("int")) agg.isInt = true;
};
var minContributor = (agg, def) => narrowMin(agg, "minimum", def.minimum);
var maxContributor = (agg, def) => narrowMax(agg, "maximum", def.maximum);
var formatContributor = (ranges) => (agg, def) => {
	setFormat(agg, def.format);
	const [minimum, maximum] = ranges[def.format];
	narrowMin(agg, "minimum", minimum);
	narrowMax(agg, "maximum", maximum);
};
var contributors = {
	greater_than: (agg, def) => narrowMin(agg, def.inclusive ? "minimum" : "exclusiveMinimum", def.value),
	less_than: (agg, def) => narrowMax(agg, def.inclusive ? "maximum" : "exclusiveMaximum", def.value),
	multiple_of: (agg, def) => addDivisor(agg, def.value),
	number_format: formatContributor(NUMBER_FORMAT_RANGES),
	bigint_format: formatContributor(BIGINT_FORMAT_RANGES),
	min_length: minContributor,
	max_length: maxContributor,
	length_equals: (agg, def) => narrowBoth(agg, def.length),
	min_size: minContributor,
	max_size: maxContributor,
	size_equals: (agg, def) => narrowBoth(agg, def.size),
	string_format: (agg, def) => {
		setFormat(agg, def.format);
		if (def.pattern) addPattern(agg, def.pattern);
		if (def.format === "base64" || def.format === "base64url") agg.contentEncoding = def.format;
		if (def.local || def.precision === -1) agg.laxFormat = true;
	},
	mime_type: (agg, def) => intersectMime(agg, def.mime)
};
function aggregateChecks(schema) {
	const agg = {};
	const def = schema._zod.def;
	const list = schema._zod.traits.has("$ZodCheck") ? [schema, ...def.checks ?? []] : def.checks ?? [];
	for (const ch of list) contributors[ch._zod.def.check]?.(agg, ch._zod.def);
	const bag = schema._zod.bag;
	if (bag.minimum !== void 0) narrowMin(agg, "minimum", bag.minimum);
	if (bag.exclusiveMinimum !== void 0) narrowMin(agg, "exclusiveMinimum", bag.exclusiveMinimum);
	if (bag.maximum !== void 0) narrowMax(agg, "maximum", bag.maximum);
	if (bag.exclusiveMaximum !== void 0) narrowMax(agg, "exclusiveMaximum", bag.exclusiveMaximum);
	if (bag.multipleOf !== void 0) addDivisor(agg, bag.multipleOf);
	if (bag.format !== void 0) {
		agg.format ?? (agg.format = bag.format);
		if (bag.format.includes("int")) agg.isInt = true;
	}
	if (bag.mime) intersectMime(agg, bag.mime);
	for (const pattern of bag.patterns ?? []) addPattern(agg, pattern);
	return agg;
}
var formatMap = {
	guid: "uuid",
	url: "uri",
	datetime: "date-time",
	json_string: "json-string",
	regex: ""
};
var exactPatterns = /* @__PURE__ */ new Map([[base64Charset, base64], [base64urlCharset, base64url]]);
var exactPattern = (p) => exactPatterns.get(p) ?? p;
var stringProcessor = (schema, ctx, _json, _params) => {
	const json = _json;
	json.type = "string";
	const { minimum, maximum, format, patterns, contentEncoding, laxFormat } = aggregateChecks(schema);
	if (typeof minimum === "number") json.minLength = minimum;
	if (typeof maximum === "number") json.maxLength = maximum;
	if (format) {
		json.format = formatMap[format] ?? format;
		if (json.format === "") delete json.format;
		if (format === "time" || laxFormat) delete json.format;
	}
	if (contentEncoding) json.contentEncoding = contentEncoding;
	if (patterns && patterns.size > 0) {
		const patternList = [...patterns].map(exactPattern);
		if (patternList.length === 1) json.pattern = patternList[0].source;
		else if (patternList.length > 1) json.allOf = [...patternList.map((regex) => ({
			...ctx.target === "draft-07" || ctx.target === "draft-04" || ctx.target === "openapi-3.0" ? { type: "string" } : {},
			pattern: regex.source
		}))];
	}
};
var numberProcessor = (schema, ctx, _json, params) => {
	const json = _json;
	const { minimum, maximum, multipleOf, exclusiveMaximum, exclusiveMinimum, isInt } = aggregateChecks(schema);
	json.type = isInt ? "integer" : "number";
	const exMin = typeof exclusiveMinimum === "number" && exclusiveMinimum >= (minimum ?? Number.NEGATIVE_INFINITY);
	const exMax = typeof exclusiveMaximum === "number" && exclusiveMaximum <= (maximum ?? Number.POSITIVE_INFINITY);
	const legacy = ctx.target === "draft-04" || ctx.target === "openapi-3.0";
	if (exMin) {
		if (legacy) {
			json.minimum = exclusiveMinimum;
			json.exclusiveMinimum = true;
		} else json.exclusiveMinimum = exclusiveMinimum;
	} else if (typeof minimum === "number") json.minimum = minimum;
	if (exMax) {
		if (legacy) {
			json.maximum = exclusiveMaximum;
			json.exclusiveMaximum = true;
		} else json.exclusiveMaximum = exclusiveMaximum;
	} else if (typeof maximum === "number") json.maximum = maximum;
	if (multipleOf) {
		const divisors = /* @__PURE__ */ new Set();
		for (const divisor of multipleOf) if (Number.isFinite(divisor) && divisor !== 0) divisors.add(Math.abs(divisor));
		else handleUnrepresentable(schema, ctx, json, params, `A multipleOf divisor of ${divisor} cannot be represented in JSON Schema`);
		const [first, ...rest] = divisors;
		if (first !== void 0) json.multipleOf = first;
		if (rest.length) json.allOf = [...json.allOf ?? [], ...rest.map((m) => ({ multipleOf: m }))];
	}
};
var booleanProcessor = (_schema, _ctx, json, _params) => {
	json.type = "boolean";
};
var nullProcessor = (_schema, ctx, json, _params) => {
	if (ctx.target === "openapi-3.0") {
		json.type = "string";
		json.nullable = true;
		json.enum = [null];
	} else json.type = "null";
};
var neverProcessor = (_schema, _ctx, json, _params) => {
	json.not = {};
};
var enumProcessor = (schema, _ctx, json, _params) => {
	const def = schema._zod.def;
	const values = getEnumValues(def.entries);
	if (values.length === 0) {
		json.not = {};
		return;
	}
	if (values.every((v) => typeof v === "number")) json.type = "number";
	if (values.every((v) => typeof v === "string")) json.type = "string";
	json.enum = values;
};
var literalProcessor = (schema, ctx, json, params) => {
	const def = schema._zod.def;
	if (def.values.length === 0) {
		json.not = {};
		return;
	}
	const vals = [];
	for (const val of def.values) if (val === void 0) {
		if (handleUnrepresentable(schema, ctx, json, params, "Literal `undefined` cannot be represented in JSON Schema")) return;
	} else if (typeof val === "bigint") {
		if (handleUnrepresentable(schema, ctx, json, params, "BigInt literals cannot be represented in JSON Schema")) return;
		vals.push(Number(val));
	} else vals.push(val);
	if (vals.length === 0) {} else if (vals.length === 1) {
		const val = vals[0];
		json.type = val === null ? "null" : typeof val;
		if (ctx.target === "draft-04" || ctx.target === "openapi-3.0") json.enum = [val];
		else json.const = val;
	} else {
		if (vals.every((v) => typeof v === "number")) json.type = "number";
		if (vals.every((v) => typeof v === "string")) json.type = "string";
		if (vals.every((v) => typeof v === "boolean")) json.type = "boolean";
		if (vals.every((v) => v === null)) json.type = "null";
		json.enum = vals;
	}
};
var customProcessor = (schema, ctx, json, params) => {
	handleUnrepresentable(schema, ctx, json, params, "Custom types cannot be represented in JSON Schema");
};
var transformProcessor = (schema, ctx, json, params) => {
	handleUnrepresentable(schema, ctx, json, params, "Transforms cannot be represented in JSON Schema");
};
var arrayProcessor = (schema, ctx, _json, params) => {
	const json = _json;
	const def = schema._zod.def;
	const { minimum, maximum } = aggregateChecks(schema);
	if (typeof minimum === "number") json.minItems = minimum;
	if (typeof maximum === "number") json.maxItems = maximum;
	json.type = "array";
	json.items = processSchema(def.element, ctx, {
		...params,
		path: [...params.path, "items"]
	});
};
function inputOptin(schema) {
	const def = schema._zod.def;
	if (def.type === "pipe" && def.in._zod.traits.has("$ZodTransform")) return inputOptin(def.out);
	if (def.type === "catch") return inputOptin(def.innerType);
	return schema._zod.optin;
}
var objectProcessor = (schema, ctx, _json, params) => {
	const json = _json;
	const def = schema._zod.def;
	const shape = def.shape;
	if (Object.getOwnPropertySymbols(shape).length && handleUnrepresentable(schema, ctx, json, params, "Symbol keys cannot be represented in JSON Schema")) return;
	json.type = "object";
	json.properties = {};
	for (const key in shape) assignProp(json.properties, key, processSchema(shape[key], ctx, {
		...params,
		path: [
			...params.path,
			"properties",
			key
		]
	}));
	const requiredKeys = [];
	for (const key of Object.keys(shape)) {
		const field = def.shape[key];
		if (ctx.io === "input" ? inputOptin(field) === void 0 : field._zod.optout === void 0) requiredKeys.push(key);
	}
	if (requiredKeys.length > 0) json.required = requiredKeys;
	if (def.catchall?._zod.def.type === "never") json.additionalProperties = false;
	else if (!def.catchall) {
		if (ctx.io === "output") json.additionalProperties = false;
	} else if (def.catchall) json.additionalProperties = processSchema(def.catchall, ctx, {
		...params,
		path: [...params.path, "additionalProperties"]
	});
};
var unionProcessor = (schema, ctx, json, params) => {
	const def = schema._zod.def;
	const isExclusive = def.inclusive === false;
	const options = def.options.map((x, i) => processSchema(x, ctx, {
		...params,
		path: [
			...params.path,
			isExclusive ? "oneOf" : "anyOf",
			i
		]
	}));
	if (isExclusive) json.oneOf = options;
	else json.anyOf = options;
};
var intersectionProcessor = (schema, ctx, json, params) => {
	const def = schema._zod.def;
	const a = processSchema(def.left, ctx, {
		...params,
		path: [
			...params.path,
			"allOf",
			0
		]
	});
	const b = processSchema(def.right, ctx, {
		...params,
		path: [
			...params.path,
			"allOf",
			1
		]
	});
	const isSimpleIntersection = (val) => "allOf" in val && Object.keys(val).length === 1;
	const allOf = [...isSimpleIntersection(a) ? a.allOf : [a], ...isSimpleIntersection(b) ? b.allOf : [b]];
	json.allOf = allOf;
	ctx.intersections.push(allOf);
};
/** JSON object keys are always strings, so a numeric record key schema is re-expressed over the
* numeric-string form the record parser matches. Deferred to `finalize`, after the flatten: a key
* behind a wrapper only carries its own `type` before then, and a union key only has its branches.
*
* A numeric bound cannot apply to a property name, so `minimum` and its siblings are dropped rather
* than carried over: keeping them beside `type: "string"` reproduces the match-nothing schema this
* exists to fix. A key that carries one therefore emits wider than the record parses — `z.record(z.number().min(5), V)`
* accepts `"3"` — which is the deliberate trade, since throwing on it would reject an ordinary schema
* outright. */
function stringifyKeyNames(bySchema, json, visited) {
	if (json.$ref) {
		if (visited.has(json)) return json;
		visited.add(json);
		const def = bySchema.get(json)?.def;
		if (!def) return json;
		const inlined = stringifyKeyNames(bySchema, def, visited);
		return inlined === def ? json : inlined;
	}
	for (const keyword of ["anyOf", "oneOf"]) {
		const branches = json[keyword];
		if (!Array.isArray(branches)) continue;
		const mapped = branches.map((branch) => stringifyKeyNames(bySchema, branch, visited));
		if (mapped.some((branch, i) => branch !== branches[i])) json = {
			...json,
			[keyword]: mapped
		};
	}
	const types = Array.isArray(json.type) ? json.type : [json.type];
	const numericType = !types.includes("string") && types.some((t) => t === "number" || t === "integer");
	const values = json.enum ?? (json.const !== void 0 ? [json.const] : void 0);
	if (!numericType && !values?.some((v) => typeof v === "number")) return json;
	const { minimum, maximum, exclusiveMinimum, exclusiveMaximum, multipleOf, format, id, ...rest } = json;
	if (rest.enum) rest.enum = rest.enum.map((v) => typeof v === "number" ? String(v) : v);
	else if (typeof rest.const === "number") rest.const = String(rest.const);
	if (!numericType) return rest;
	rest.type = "string";
	if (!values) rest.pattern = (types.includes("number") ? number$1 : integer).source;
	return rest;
}
/** Every record of one conversion, so the carriers are found in a single pass rather than once per record. */
var pendingRecords = /* @__PURE__ */ new WeakMap();
function rewriteKeyNames(ctx) {
	const bySchema = /* @__PURE__ */ new Map();
	for (const entry of ctx.seen.values()) if (entry.def && !bySchema.has(entry.schema)) bySchema.set(entry.schema, entry);
	const rewrites = /* @__PURE__ */ new Map();
	for (const record of pendingRecords.get(ctx) ?? []) {
		const seen = ctx.seen.get(record);
		const names = (seen?.def ?? seen?.schema)?.propertyNames;
		if (!names || names === true || rewrites.has(names)) continue;
		const rewritten = stringifyKeyNames(bySchema, names, /* @__PURE__ */ new Set());
		if (rewritten !== names) rewrites.set(names, rewritten);
	}
	if (!rewrites.size) return;
	for (const entry of ctx.seen.values()) for (const carrier of [entry.schema, entry.def]) {
		const rewritten = carrier && rewrites.get(carrier.propertyNames);
		if (rewritten) carrier.propertyNames = rewritten;
	}
}
var recordProcessor = (schema, ctx, _json, params) => {
	const json = _json;
	const def = schema._zod.def;
	json.type = "object";
	const keyType = def.keyType;
	const patterns = aggregateChecks(keyType).patterns;
	if (def.mode === "loose" && patterns && patterns.size > 0) {
		const valueSchema = processSchema(def.valueType, ctx, {
			...params,
			path: [
				...params.path,
				"patternProperties",
				"*"
			]
		});
		json.patternProperties = {};
		for (const pattern of patterns) assignProp(json.patternProperties, exactPattern(pattern).source, valueSchema);
	} else {
		if (ctx.target === "draft-07" || ctx.target === "draft-2020-12") {
			json.propertyNames = processSchema(def.keyType, ctx, {
				...params,
				path: [...params.path, "propertyNames"]
			});
			let pending = pendingRecords.get(ctx);
			if (!pending) {
				pending = [];
				pendingRecords.set(ctx, pending);
				ctx.deferred.push(() => rewriteKeyNames(ctx));
			}
			pending.push(schema);
		}
		json.additionalProperties = processSchema(def.valueType, ctx, {
			...params,
			path: [...params.path, "additionalProperties"]
		});
	}
	const keyValues = keyType._zod.values;
	const omittableOnInput = ctx.io === "input" && inputOptin(def.valueType) !== void 0;
	if (keyValues && !def.partial && !omittableOnInput) {
		const validKeyValues = [...keyValues].filter((v) => typeof v === "string" || typeof v === "number");
		if (validKeyValues.length > 0) json.required = validKeyValues.map(String);
	}
};
var nullableProcessor = (schema, ctx, json, params) => {
	const def = schema._zod.def;
	const inner = processSchema(def.innerType, ctx, params);
	const seen = ctx.seen.get(schema);
	if (ctx.target === "openapi-3.0") {
		seen.ref = def.innerType;
		json.nullable = true;
	} else json.anyOf = [inner, { type: "null" }];
};
var nonoptionalProcessor = (schema, ctx, _json, params) => {
	const def = schema._zod.def;
	processSchema(def.innerType, ctx, params);
	const seen = ctx.seen.get(schema);
	seen.ref = def.innerType;
};
/** Round-trips a default value through JSON so the emitted schema is guaranteed to be valid JSON.
* A BigInt has no reliable encoding, so it goes through `unrepresentable` like any other
* unrepresentable value. Returns a sentinel when the caller must not write a default of its own. */
var UNREPRESENTABLE_DEFAULT = Symbol();
function serializeDefaultValue(value, schema, ctx, json, params) {
	let unrepresentable = false;
	const serialized = JSON.stringify(value, (_, val) => {
		if (typeof val !== "bigint") return val;
		unrepresentable = true;
		return null;
	});
	if (!unrepresentable) return JSON.parse(serialized);
	handleUnrepresentable(schema, ctx, json, params, "BigInt defaults cannot be represented in JSON Schema");
	return UNREPRESENTABLE_DEFAULT;
}
var defaultProcessor = (schema, ctx, json, params) => {
	const def = schema._zod.def;
	processSchema(def.innerType, ctx, params);
	const seen = ctx.seen.get(schema);
	seen.ref = def.innerType;
	const value = serializeDefaultValue(def.defaultValue, schema, ctx, json, params);
	if (value !== UNREPRESENTABLE_DEFAULT) json.default = value;
};
var prefaultProcessor = (schema, ctx, json, params) => {
	const def = schema._zod.def;
	processSchema(def.innerType, ctx, params);
	const seen = ctx.seen.get(schema);
	seen.ref = def.innerType;
	if (ctx.io !== "input") return;
	const value = serializeDefaultValue(def.defaultValue, schema, ctx, json, params);
	if (value !== UNREPRESENTABLE_DEFAULT) json._prefault = value;
};
var catchProcessor = (schema, ctx, json, params) => {
	const def = schema._zod.def;
	processSchema(def.innerType, ctx, params);
	const seen = ctx.seen.get(schema);
	seen.ref = def.innerType;
	let catchValue;
	try {
		catchValue = def.catchValue(void 0);
	} catch {
		handleUnrepresentable(schema, ctx, json, params, "Dynamic catch values are not supported in JSON Schema");
		return;
	}
	json.default = catchValue;
};
var pipeProcessor = (schema, ctx, _json, params) => {
	const def = schema._zod.def;
	const inIsTransform = def.in._zod.traits.has("$ZodTransform");
	const innerType = ctx.io === "input" ? inIsTransform ? def.out : def.in : def.out;
	processSchema(innerType, ctx, params);
	const seen = ctx.seen.get(schema);
	seen.ref = innerType;
};
var readonlyProcessor = (schema, ctx, json, params) => {
	const def = schema._zod.def;
	processSchema(def.innerType, ctx, params);
	const seen = ctx.seen.get(schema);
	seen.ref = def.innerType;
	json.readOnly = true;
};
var optionalProcessor = (schema, ctx, _json, params) => {
	const def = schema._zod.def;
	processSchema(def.innerType, ctx, params);
	const seen = ctx.seen.get(schema);
	seen.ref = def.innerType;
};
// ../code-for-antigravity/node_modules/zod/v4/classic/errors.js
var _installedErrorProtos = /* @__PURE__ */ new WeakSet([Object.prototype, Error.prototype]);
function _lazyMethod(proto, key, make) {
	Object.defineProperty(proto, key, {
		configurable: true,
		enumerable: false,
		get() {
			const value = make(this);
			Object.defineProperty(this, key, {
				value,
				configurable: true,
				writable: true
			});
			return value;
		},
		set(value) {
			Object.defineProperty(this, key, {
				value,
				configurable: true,
				writable: true
			});
		}
	});
}
var initializer = (inst, issues) => {
	$ZodError.init(inst, issues);
	inst.name = "ZodError";
	const proto = Object.getPrototypeOf(inst);
	if (_installedErrorProtos.has(proto)) return;
	_installedErrorProtos.add(proto);
	_lazyMethod(proto, "format", (self) => (mapper) => formatError(self, mapper));
	_lazyMethod(proto, "flatten", (self) => (mapper) => flattenError(self, mapper));
	_lazyMethod(proto, "addIssue", (self) => (issue) => {
		self.issues.push(issue);
		self.message = JSON.stringify(self.issues, jsonStringifyReplacer, 2);
	});
	_lazyMethod(proto, "addIssues", (self) => (issues) => {
		self.issues.push(...issues);
		self.message = JSON.stringify(self.issues, jsonStringifyReplacer, 2);
	});
	Object.defineProperty(proto, "isEmpty", {
		configurable: true,
		enumerable: false,
		get() {
			return this.issues.length === 0;
		}
	});
};
var ZodRealError = /*@__PURE__*/ $constructor("ZodError", initializer, void 0, { Parent: Error });
// ../code-for-antigravity/node_modules/zod/v4/classic/parse.js
var parse = /* @__PURE__ */ _parse(ZodRealError);
var parseAsync = /* @__PURE__ */ _parseAsync(ZodRealError);
var safeParse = /* @__PURE__ */ _safeParse(ZodRealError);
var safeParseAsync = /* @__PURE__ */ _safeParseAsync(ZodRealError);
var encode = /* @__PURE__ */ _encode(ZodRealError);
var decode = /* @__PURE__ */ _decode(ZodRealError);
var encodeAsync = /* @__PURE__ */ _encodeAsync(ZodRealError);
var decodeAsync = /* @__PURE__ */ _decodeAsync(ZodRealError);
var safeEncode = /* @__PURE__ */ _safeEncode(ZodRealError);
var safeDecode = /* @__PURE__ */ _safeDecode(ZodRealError);
var safeEncodeAsync = /* @__PURE__ */ _safeEncodeAsync(ZodRealError);
var safeDecodeAsync = /* @__PURE__ */ _safeDecodeAsync(ZodRealError);
// ../code-for-antigravity/node_modules/zod/v4/classic/schemas.js
function _ensureDefaultLocale() {
	if (!globalConfig.localeError) config(en_default());
}
function _ensureDefaultMemoizer() {
	if (!globalConfig.memoizer) config({ memoizer: memoizer() });
}
var ZodType = /*@__PURE__*/ $constructor("ZodType", (inst, def) => {
	_ensureDefaultLocale();
	$ZodType.init(inst, def);
	inst.def = def;
	inst.type = def.type;
	return inst;
}, {
	check(...chks) {
		const def = this.def;
		return this.clone(mergeDefs(def, { checks: [...def.checks ?? [], ...chks.map((ch) => typeof ch === "function" ? { _zod: {
			check: ch,
			def: { check: "custom" },
			onattach: []
		} } : ch)] }), { parent: true });
	},
	with(...chks) {
		return this.check(...chks);
	},
	clone(def, params) {
		return clone(this, def, params);
	},
	brand() {
		return this;
	},
	register(reg, meta) {
		reg.add(this, meta);
		return this;
	},
	refine(check, params) {
		return this.check(refine(check, params));
	},
	superRefine(refinement, params) {
		return this.check(superRefine(refinement, params));
	},
	overwrite(fn) {
		return this.check(/* @__PURE__ */ _overwrite(fn));
	},
	optional() {
		return optional(this);
	},
	exactOptional() {
		return exactOptional(this);
	},
	nullable() {
		return nullable(this);
	},
	nullish() {
		return optional(nullable(this));
	},
	nonoptional(params) {
		return nonoptional(this, params);
	},
	array() {
		return array(this);
	},
	or(arg) {
		return union([this, arg]);
	},
	and(arg) {
		return intersection(this, arg);
	},
	transform(tx) {
		return pipe(this, transform(tx));
	},
	default(d) {
		return _default(this, d);
	},
	prefault(d) {
		return prefault(this, d);
	},
	catch(params) {
		return _catch(this, params);
	},
	pipe(target) {
		return pipe(this, target);
	},
	readonly() {
		return readonly(this);
	},
	describe(description) {
		const cl = this.clone();
		globalRegistry.add(cl, { description });
		return cl;
	},
	meta(...args) {
		if (args.length === 0) return globalRegistry.get(this);
		const cl = this.clone();
		globalRegistry.add(cl, args[0]);
		return cl;
	},
	isOptional() {
		return this.safeParse(void 0).success;
	},
	isNullable() {
		return this.safeParse(null).success;
	},
	apply(fn, ...args) {
		return args.length === 0 ? fn(this) : fn(this, ...args);
	},
	get "~standard"() {
		return hide(this, "~standard", {
			...standardProps(this),
			jsonSchema: {
				input: createStandardJSONSchemaMethod(this, "input"),
				output: createStandardJSONSchemaMethod(this, "output")
			}
		});
	},
	set "~standard"(value) {
		own(this, "~standard", value);
	},
	parse: function _parse(data, params) {
		return parse(this, data, params, { callee: _parse });
	},
	parseAsync: async function _parseAsync(data, params) {
		return await parseAsync(this, data, params, { callee: _parseAsync });
	},
	safeParse(data, params) {
		return safeParse(this, data, params);
	},
	async safeParseAsync(data, params) {
		return safeParseAsync(this, data, params);
	},
	get spa() {
		return this?.safeParseAsync;
	},
	set spa(value) {
		own(this, "spa", value);
	},
	validate(data, params) {
		return validate(this, data, params);
	},
	validateAsync(data, params) {
		return validateAsync$1(this, data, params);
	},
	encode: function _encode(data, params) {
		return encode(this, data, params, { callee: _encode });
	},
	decode: function _decode(data, params) {
		return decode(this, data, params, { callee: _decode });
	},
	encodeAsync: async function _encodeAsync(data, params) {
		return await encodeAsync(this, data, params, { callee: _encodeAsync });
	},
	decodeAsync: async function _decodeAsync(data, params) {
		return await decodeAsync(this, data, params, { callee: _decodeAsync });
	},
	safeEncode(data, params) {
		return safeEncode(this, data, params);
	},
	safeDecode(data, params) {
		return safeDecode(this, data, params);
	},
	async safeEncodeAsync(data, params) {
		return safeEncodeAsync(this, data, params);
	},
	async safeDecodeAsync(data, params) {
		return safeDecodeAsync(this, data, params);
	},
	toJSONSchema(params) {
		return createToJSONSchemaMethod(this, {})(params);
	},
	get description() {
		return globalRegistry.get(this)?.description;
	},
	get _def() {
		return this._zod.def;
	}
});
/** @internal */
var _ZodString = /*@__PURE__*/ $constructor("_ZodString", (inst, def) => {
	$ZodString.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => stringProcessor(inst, ctx, json, params);
}, /*@__PURE__*/ derived({
	format: (inst) => aggregateChecks(inst).format ?? null,
	minLength: (inst) => aggregateChecks(inst).minimum ?? null,
	maxLength: (inst) => aggregateChecks(inst).maximum ?? null
}, {
	regex(...args) {
		return this.check(/* @__PURE__ */ _regex(...args));
	},
	includes(...args) {
		return this.check(/* @__PURE__ */ _includes(...args));
	},
	startsWith(...args) {
		return this.check(/* @__PURE__ */ _startsWith(...args));
	},
	endsWith(...args) {
		return this.check(/* @__PURE__ */ _endsWith(...args));
	},
	min(...args) {
		return this.check(/* @__PURE__ */ _minLength(...args));
	},
	max(...args) {
		return this.check(/* @__PURE__ */ _maxLength(...args));
	},
	length(...args) {
		return this.check(/* @__PURE__ */ _length(...args));
	},
	nonempty(...args) {
		return this.check(/* @__PURE__ */ _minLength(1, ...args));
	},
	lowercase(params) {
		return this.check(/* @__PURE__ */ _lowercase(params));
	},
	uppercase(params) {
		return this.check(/* @__PURE__ */ _uppercase(params));
	},
	trim() {
		return this.check(/* @__PURE__ */ _trim());
	},
	normalize(...args) {
		return this.check(/* @__PURE__ */ _normalize(...args));
	},
	toLowerCase() {
		return this.check(/* @__PURE__ */ _toLowerCase());
	},
	toUpperCase() {
		return this.check(/* @__PURE__ */ _toUpperCase());
	},
	slugify() {
		return this.check(/* @__PURE__ */ _slugify());
	}
}));
var ZodString = /*@__PURE__*/ $constructor("ZodString", (inst, def) => {
	$ZodString.init(inst, def);
	_ZodString.init(inst, def);
}, {
	email(params) {
		return this.check(/* @__PURE__ */ _email(ZodEmail, params));
	},
	url(params) {
		return this.check(/* @__PURE__ */ _url(ZodURL, params));
	},
	jwt(params) {
		return this.check(/* @__PURE__ */ _jwt(ZodJWT, params));
	},
	emoji(params) {
		return this.check(/* @__PURE__ */ _emoji(ZodEmoji, params));
	},
	guid(params) {
		return this.check(/* @__PURE__ */ _guid(ZodGUID, params));
	},
	uuid(params) {
		return this.check(/* @__PURE__ */ _uuid(ZodUUID, params));
	},
	uuidv4(params) {
		return this.check(/* @__PURE__ */ _uuidv4(ZodUUID, params));
	},
	uuidv6(params) {
		return this.check(/* @__PURE__ */ _uuidv6(ZodUUID, params));
	},
	uuidv7(params) {
		return this.check(/* @__PURE__ */ _uuidv7(ZodUUID, params));
	},
	nanoid(params) {
		return this.check(/* @__PURE__ */ _nanoid(ZodNanoID, params));
	},
	cuid(params) {
		return this.check(/* @__PURE__ */ _cuid(ZodCUID, params));
	},
	cuid2(params) {
		return this.check(/* @__PURE__ */ _cuid2(ZodCUID2, params));
	},
	ulid(params) {
		return this.check(/* @__PURE__ */ _ulid(ZodULID, params));
	},
	base64(params) {
		return this.check(/* @__PURE__ */ _base64(ZodBase64, params));
	},
	base64url(params) {
		return this.check(/* @__PURE__ */ _base64url(ZodBase64URL, params));
	},
	xid(params) {
		return this.check(/* @__PURE__ */ _xid(ZodXID, params));
	},
	ksuid(params) {
		return this.check(/* @__PURE__ */ _ksuid(ZodKSUID, params));
	},
	ipv4(params) {
		return this.check(/* @__PURE__ */ _ipv4(ZodIPv4, params));
	},
	ipv6(params) {
		return this.check(/* @__PURE__ */ _ipv6(ZodIPv6, params));
	},
	cidrv4(params) {
		return this.check(/* @__PURE__ */ _cidrv4(ZodCIDRv4, params));
	},
	cidrv6(params) {
		return this.check(/* @__PURE__ */ _cidrv6(ZodCIDRv6, params));
	},
	e164(params) {
		return this.check(/* @__PURE__ */ _e164(ZodE164, params));
	},
	datetime(params) {
		return this.check(/* @__PURE__ */ _isoDateTime(ZodISODateTime, params));
	},
	date(params) {
		return this.check(/* @__PURE__ */ _isoDate(ZodISODate, params));
	},
	time(params) {
		return this.check(/* @__PURE__ */ _isoTime(ZodISOTime, params));
	},
	duration(params) {
		return this.check(/* @__PURE__ */ _isoDuration(ZodISODuration, params));
	}
});
function string(params) {
	return /* @__PURE__ */ _string(ZodString, params);
}
var ZodStringFormat = /*@__PURE__*/ $constructor("ZodStringFormat", (inst, def) => {
	$ZodStringFormat.init(inst, def);
	_ZodString.init(inst, def);
});
var ZodISODateTime = /*@__PURE__*/ $constructor("ZodISODateTime", (inst, def) => {
	$ZodISODateTime.init(inst, def);
	ZodStringFormat.init(inst, def);
});
var ZodISODate = /*@__PURE__*/ $constructor("ZodISODate", (inst, def) => {
	$ZodISODate.init(inst, def);
	ZodStringFormat.init(inst, def);
});
var ZodISOTime = /*@__PURE__*/ $constructor("ZodISOTime", (inst, def) => {
	$ZodISOTime.init(inst, def);
	ZodStringFormat.init(inst, def);
});
var ZodISODuration = /*@__PURE__*/ $constructor("ZodISODuration", (inst, def) => {
	$ZodISODuration.init(inst, def);
	ZodStringFormat.init(inst, def);
});
var ZodEmail = /*@__PURE__*/ $constructor("ZodEmail", (inst, def) => {
	$ZodEmail.init(inst, def);
	ZodStringFormat.init(inst, def);
});
var ZodGUID = /*@__PURE__*/ $constructor("ZodGUID", (inst, def) => {
	$ZodGUID.init(inst, def);
	ZodStringFormat.init(inst, def);
});
var ZodUUID = /*@__PURE__*/ $constructor("ZodUUID", (inst, def) => {
	$ZodUUID.init(inst, def);
	ZodStringFormat.init(inst, def);
});
var ZodURL = /*@__PURE__*/ $constructor("ZodURL", (inst, def) => {
	$ZodURL.init(inst, def);
	ZodStringFormat.init(inst, def);
});
function url(params) {
	return /* @__PURE__ */ _url(ZodURL, params);
}
var ZodEmoji = /*@__PURE__*/ $constructor("ZodEmoji", (inst, def) => {
	$ZodEmoji.init(inst, def);
	ZodStringFormat.init(inst, def);
});
var ZodNanoID = /*@__PURE__*/ $constructor("ZodNanoID", (inst, def) => {
	$ZodNanoID.init(inst, def);
	ZodStringFormat.init(inst, def);
});
/**
* @deprecated CUID v1 is deprecated by its authors due to information leakage
* (timestamps embedded in the id). Use {@link ZodCUID2} instead.
* See https://github.com/paralleldrive/cuid.
*/
var ZodCUID = /*@__PURE__*/ $constructor("ZodCUID", (inst, def) => {
	$ZodCUID.init(inst, def);
	ZodStringFormat.init(inst, def);
});
var ZodCUID2 = /*@__PURE__*/ $constructor("ZodCUID2", (inst, def) => {
	$ZodCUID2.init(inst, def);
	ZodStringFormat.init(inst, def);
});
var ZodULID = /*@__PURE__*/ $constructor("ZodULID", (inst, def) => {
	$ZodULID.init(inst, def);
	ZodStringFormat.init(inst, def);
});
var ZodXID = /*@__PURE__*/ $constructor("ZodXID", (inst, def) => {
	$ZodXID.init(inst, def);
	ZodStringFormat.init(inst, def);
});
var ZodKSUID = /*@__PURE__*/ $constructor("ZodKSUID", (inst, def) => {
	$ZodKSUID.init(inst, def);
	ZodStringFormat.init(inst, def);
});
var ZodIPv4 = /*@__PURE__*/ $constructor("ZodIPv4", (inst, def) => {
	$ZodIPv4.init(inst, def);
	ZodStringFormat.init(inst, def);
});
var ZodIPv6 = /*@__PURE__*/ $constructor("ZodIPv6", (inst, def) => {
	$ZodIPv6.init(inst, def);
	ZodStringFormat.init(inst, def);
});
var ZodCIDRv4 = /*@__PURE__*/ $constructor("ZodCIDRv4", (inst, def) => {
	$ZodCIDRv4.init(inst, def);
	ZodStringFormat.init(inst, def);
});
var ZodCIDRv6 = /*@__PURE__*/ $constructor("ZodCIDRv6", (inst, def) => {
	$ZodCIDRv6.init(inst, def);
	ZodStringFormat.init(inst, def);
});
var ZodBase64 = /*@__PURE__*/ $constructor("ZodBase64", (inst, def) => {
	$ZodBase64.init(inst, def);
	ZodStringFormat.init(inst, def);
});
var ZodBase64URL = /*@__PURE__*/ $constructor("ZodBase64URL", (inst, def) => {
	$ZodBase64URL.init(inst, def);
	ZodStringFormat.init(inst, def);
});
var ZodE164 = /*@__PURE__*/ $constructor("ZodE164", (inst, def) => {
	$ZodE164.init(inst, def);
	ZodStringFormat.init(inst, def);
});
var ZodJWT = /*@__PURE__*/ $constructor("ZodJWT", (inst, def) => {
	$ZodJWT.init(inst, def);
	ZodStringFormat.init(inst, def);
});
var ZodNumber = /*@__PURE__*/ $constructor("ZodNumber", (inst, def) => {
	$ZodNumber.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => numberProcessor(inst, ctx, json, params);
	inst.isFinite = true;
}, /*@__PURE__*/ derived({
	minValue: (inst) => {
		const { minimum, exclusiveMinimum } = aggregateChecks(inst);
		return Math.max(minimum ?? Number.NEGATIVE_INFINITY, exclusiveMinimum ?? Number.NEGATIVE_INFINITY);
	},
	maxValue: (inst) => {
		const { maximum, exclusiveMaximum } = aggregateChecks(inst);
		return Math.min(maximum ?? Number.POSITIVE_INFINITY, exclusiveMaximum ?? Number.POSITIVE_INFINITY);
	},
	isInt: (inst) => {
		const { isInt, multipleOf } = aggregateChecks(inst);
		return !!isInt || !!multipleOf?.some(Number.isSafeInteger);
	},
	format: (inst) => aggregateChecks(inst).format ?? null
}, {
	gt(value, params) {
		return this.check(/* @__PURE__ */ _gt(value, params));
	},
	gte(value, params) {
		return this.check(/* @__PURE__ */ _gte(value, params));
	},
	min(value, params) {
		return this.check(/* @__PURE__ */ _gte(value, params));
	},
	lt(value, params) {
		return this.check(/* @__PURE__ */ _lt(value, params));
	},
	lte(value, params) {
		return this.check(/* @__PURE__ */ _lte(value, params));
	},
	max(value, params) {
		return this.check(/* @__PURE__ */ _lte(value, params));
	},
	int(params) {
		return this.check(int(params));
	},
	safe(params) {
		return this.check(int(params));
	},
	positive(params) {
		return this.check(/* @__PURE__ */ _gt(0, params));
	},
	nonnegative(params) {
		return this.check(/* @__PURE__ */ _gte(0, params));
	},
	negative(params) {
		return this.check(/* @__PURE__ */ _lt(0, params));
	},
	nonpositive(params) {
		return this.check(/* @__PURE__ */ _lte(0, params));
	},
	multipleOf(value, params) {
		return this.check(/* @__PURE__ */ _multipleOf(value, params));
	},
	step(value, params) {
		return this.check(/* @__PURE__ */ _multipleOf(value, params));
	},
	finite() {
		return this;
	}
}));
function number(params) {
	return /* @__PURE__ */ _number(ZodNumber, params);
}
var ZodNumberFormat = /*@__PURE__*/ $constructor("ZodNumberFormat", (inst, def) => {
	$ZodNumberFormat.init(inst, def);
	ZodNumber.init(inst, def);
});
function int(params) {
	return /* @__PURE__ */ _int(ZodNumberFormat, params);
}
var ZodBoolean = /*@__PURE__*/ $constructor("ZodBoolean", (inst, def) => {
	$ZodBoolean.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => booleanProcessor(inst, ctx, json, params);
});
function boolean(params) {
	return /* @__PURE__ */ _boolean(ZodBoolean, params);
}
var ZodNull = /*@__PURE__*/ $constructor("ZodNull", (inst, def) => {
	$ZodNull.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => nullProcessor(inst, ctx, json, params);
});
function _null(params) {
	return /* @__PURE__ */ _null$1(ZodNull, params);
}
var ZodUnknown = /*@__PURE__*/ $constructor("ZodUnknown", (inst, def) => {
	$ZodUnknown.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => void 0;
});
function unknown() {
	return /* @__PURE__ */ _unknown(ZodUnknown);
}
var ZodNever = /*@__PURE__*/ $constructor("ZodNever", (inst, def) => {
	$ZodNever.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => neverProcessor(inst, ctx, json, params);
});
function never(params) {
	return /* @__PURE__ */ _never(ZodNever, params);
}
var ZodArray = /*@__PURE__*/ $constructor("ZodArray", (inst, def) => {
	_ensureDefaultMemoizer();
	$ZodArray.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => arrayProcessor(inst, ctx, json, params);
	inst.element = def.element;
}, {
	min(n, params) {
		return this.check(/* @__PURE__ */ _minLength(n, params));
	},
	nonempty(params) {
		return this.check(/* @__PURE__ */ _minLength(1, params));
	},
	max(n, params) {
		return this.check(/* @__PURE__ */ _maxLength(n, params));
	},
	length(n, params) {
		return this.check(/* @__PURE__ */ _length(n, params));
	},
	unwrap() {
		return this.element;
	}
});
function array(element, params) {
	return /* @__PURE__ */ _array(ZodArray, element, params);
}
var ZodObject = /*@__PURE__*/ $constructor("ZodObject", (inst, def) => {
	_ensureDefaultMemoizer();
	$ZodObjectJIT.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => objectProcessor(inst, ctx, json, params);
	installLazyProp(inst, "shape", (self) => self._zod.def.shape, false);
}, {
	keyof() {
		return _enum(Object.keys(this._zod.def.shape));
	},
	catchall(catchall) {
		return this.clone(mergeDefs(this._zod.def, { catchall }));
	},
	passthrough() {
		return this.clone(mergeDefs(this._zod.def, { catchall: unknown() }));
	},
	loose() {
		return this.clone(mergeDefs(this._zod.def, { catchall: unknown() }));
	},
	strict() {
		return this.clone(mergeDefs(this._zod.def, { catchall: never() }));
	},
	strip() {
		return this.clone(mergeDefs(this._zod.def, { catchall: void 0 }));
	},
	extend(incoming) {
		return extend(this, incoming);
	},
	safeExtend(incoming) {
		return safeExtend(this, incoming);
	},
	merge(other) {
		return merge(this, other);
	},
	pick(mask) {
		return pick(this, mask);
	},
	omit(mask) {
		return omit(this, mask);
	},
	partial(...args) {
		return partial(ZodOptional, this, args[0]);
	},
	exactPartial(...args) {
		return partial(ZodExactOptional, this, args[0], "exactPartial");
	},
	required(...args) {
		return required(ZodNonOptional, this, args[0]);
	}
});
function object(shape, params) {
	return new ZodObject({
		type: "object",
		shape: shape ?? {},
		...normalizeParams(params)
	});
}
function looseObject(shape, params) {
	return new ZodObject({
		type: "object",
		shape,
		catchall: unknown(),
		...normalizeParams(params)
	});
}
var ZodUnion = /*@__PURE__*/ $constructor("ZodUnion", (inst, def) => {
	$ZodUnion.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => unionProcessor(inst, ctx, json, params);
	inst.options = def.options;
});
function union(options, params) {
	return new ZodUnion({
		type: "union",
		options,
		...normalizeParams(params)
	});
}
var ZodIntersection = /*@__PURE__*/ $constructor("ZodIntersection", (inst, def) => {
	$ZodIntersection.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => intersectionProcessor(inst, ctx, json, params);
});
function intersection(left, right) {
	return new ZodIntersection({
		type: "intersection",
		left,
		right
	});
}
var ZodRecord = /*@__PURE__*/ $constructor("ZodRecord", (inst, def) => {
	_ensureDefaultMemoizer();
	$ZodRecord.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => recordProcessor(inst, ctx, json, params);
	inst.keyType = def.keyType;
	inst.valueType = def.valueType;
});
function record(keyType, valueType, params) {
	if (!valueType || !valueType._zod) return new ZodRecord({
		type: "record",
		keyType: string(),
		valueType: keyType,
		...normalizeParams(valueType)
	});
	return new ZodRecord({
		type: "record",
		keyType,
		valueType,
		...normalizeParams(params)
	});
}
var ZodEnum = /*@__PURE__*/ $constructor("ZodEnum", (inst, def) => {
	$ZodEnum.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => enumProcessor(inst, ctx, json, params);
	inst.enum = def.entries;
	inst.options = [...inst._zod.values];
	const keys = new Set(Object.keys(def.entries));
	inst.extract = (values, params) => {
		const newEntries = {};
		for (const value of values) if (keys.has(value)) newEntries[value] = def.entries[value];
		else throw new Error(`Key ${value} not found in enum`);
		return new ZodEnum({
			...def,
			checks: [],
			...normalizeParams(params),
			entries: newEntries
		});
	};
	inst.exclude = (values, params) => {
		const newEntries = { ...def.entries };
		for (const value of values) if (keys.has(value)) delete newEntries[value];
		else throw new Error(`Key ${value} not found in enum`);
		return new ZodEnum({
			...def,
			checks: [],
			...normalizeParams(params),
			entries: newEntries
		});
	};
});
function _enum(values, params) {
	return new ZodEnum({
		type: "enum",
		entries: Array.isArray(values) ? Object.fromEntries(values.map((v) => [v, v])) : values,
		...normalizeParams(params)
	});
}
var ZodLiteral = /*@__PURE__*/ $constructor("ZodLiteral", (inst, def) => {
	$ZodLiteral.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => literalProcessor(inst, ctx, json, params);
	inst.values = new Set(def.values);
	Object.defineProperty(inst, "value", { get() {
		if (def.values.length > 1) throw new Error("This schema contains multiple valid literal values. Use `.values` instead.");
		return def.values[0];
	} });
});
function literal(value, params) {
	return new ZodLiteral({
		type: "literal",
		values: Array.isArray(value) ? value : [value],
		...normalizeParams(params)
	});
}
var ZodTransform = /*@__PURE__*/ $constructor("ZodTransform", (inst, def) => {
	_ensureDefaultMemoizer();
	$ZodTransform.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => transformProcessor(inst, ctx, json, params);
	inst._zod.parse = (payload, _ctx) => {
		if (_ctx.direction === "backward") throw new $ZodEncodeError(inst.constructor.name);
		payload.addIssue = (issue$1) => {
			if (typeof issue$1 === "string") payload.issues.push(issue(issue$1, payload.value, def));
			else {
				const _issue = issue$1;
				if (_issue.fatal) _issue.continue = false;
				_issue.code ?? (_issue.code = "custom");
				if (!("input" in _issue)) _issue.input = payload.value;
				_issue.inst ?? (_issue.inst = inst);
				payload.issues.push(issue(_issue));
			}
		};
		const output = def.transform(payload.value, payload);
		if (output instanceof Promise) return output.then((output) => {
			payload.value = output;
			return payload;
		});
		payload.value = output;
		return payload;
	};
});
function transform(fn) {
	return new ZodTransform({
		type: "transform",
		transform: fn
	});
}
var ZodOptional = /*@__PURE__*/ $constructor("ZodOptional", (inst, def) => {
	$ZodOptional.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => optionalProcessor(inst, ctx, json, params);
	inst.unwrap = () => inst._zod.def.innerType;
});
function optional(innerType) {
	return new ZodOptional({
		type: "optional",
		innerType
	});
}
var ZodExactOptional = /*@__PURE__*/ $constructor("ZodExactOptional", (inst, def) => {
	$ZodExactOptional.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => optionalProcessor(inst, ctx, json, params);
	inst.unwrap = () => inst._zod.def.innerType;
});
function exactOptional(innerType) {
	return new ZodExactOptional({
		type: "optional",
		innerType
	});
}
var ZodNullable = /*@__PURE__*/ $constructor("ZodNullable", (inst, def) => {
	$ZodNullable.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => nullableProcessor(inst, ctx, json, params);
	inst.unwrap = () => inst._zod.def.innerType;
});
function nullable(innerType) {
	return new ZodNullable({
		type: "nullable",
		innerType
	});
}
var ZodDefault = /*@__PURE__*/ $constructor("ZodDefault", (inst, def) => {
	$ZodDefault.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => defaultProcessor(inst, ctx, json, params);
	inst.unwrap = () => inst._zod.def.innerType;
	inst.removeDefault = inst.unwrap;
});
function _default(innerType, defaultValue) {
	return new ZodDefault({
		type: "default",
		innerType,
		get defaultValue() {
			return typeof defaultValue === "function" ? defaultValue() : shallowClone(defaultValue);
		}
	});
}
var ZodPrefault = /*@__PURE__*/ $constructor("ZodPrefault", (inst, def) => {
	$ZodPrefault.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => prefaultProcessor(inst, ctx, json, params);
	inst.unwrap = () => inst._zod.def.innerType;
});
function prefault(innerType, defaultValue) {
	return new ZodPrefault({
		type: "prefault",
		innerType,
		get defaultValue() {
			return typeof defaultValue === "function" ? defaultValue() : shallowClone(defaultValue);
		}
	});
}
var ZodNonOptional = /*@__PURE__*/ $constructor("ZodNonOptional", (inst, def) => {
	$ZodNonOptional.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => nonoptionalProcessor(inst, ctx, json, params);
	inst.unwrap = () => inst._zod.def.innerType;
});
function nonoptional(innerType, params) {
	return new ZodNonOptional({
		type: "nonoptional",
		innerType,
		...normalizeParams(params)
	});
}
var ZodCatch = /*@__PURE__*/ $constructor("ZodCatch", (inst, def) => {
	$ZodCatch.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => catchProcessor(inst, ctx, json, params);
	inst.unwrap = () => inst._zod.def.innerType;
	inst.removeCatch = inst.unwrap;
});
function _catch(innerType, catchValue) {
	return new ZodCatch({
		type: "catch",
		innerType,
		catchValue: typeof catchValue === "function" ? catchValue : constantCatch(catchValue)
	});
}
var ZodPipe = /*@__PURE__*/ $constructor("ZodPipe", (inst, def) => {
	$ZodPipe.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => pipeProcessor(inst, ctx, json, params);
	inst.in = def.in;
	inst.out = def.out;
});
function pipe(in_, out) {
	return new ZodPipe({
		type: "pipe",
		in: in_,
		out
	});
}
var ZodPreprocess = /*@__PURE__*/ $constructor("ZodPreprocess", (inst, def) => {
	ZodPipe.init(inst, def);
	$ZodPreprocess.init(inst, def);
});
var ZodReadonly = /*@__PURE__*/ $constructor("ZodReadonly", (inst, def) => {
	$ZodReadonly.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => readonlyProcessor(inst, ctx, json, params);
	inst.unwrap = () => inst._zod.def.innerType;
});
function readonly(innerType) {
	return new ZodReadonly({
		type: "readonly",
		innerType
	});
}
var ZodCustom = /*@__PURE__*/ $constructor("ZodCustom", (inst, def) => {
	$ZodCustom.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => customProcessor(inst, ctx, json, params);
});
function refine(fn, _params = {}) {
	return /* @__PURE__ */ _refine(ZodCustom, fn, _params);
}
function superRefine(fn, params) {
	return /* @__PURE__ */ _superRefine(fn, params);
}
function preprocess(fn, schema) {
	return new ZodPreprocess({
		type: "pipe",
		in: transform(fn),
		out: schema
	});
}
// ../code-for-antigravity/node_modules/@agentclientprotocol/sdk/dist/core/schema-deserialize.js
var skippedItem = Symbol("skippedItem");
function defaultOnError(schema, fallback) {
	return schema.catch(fallback);
}
function requiredDefaultOnError(schema, fallback) {
	const schemaWithCatch = schema.catch(fallback);
	return unknown().transform((value, context) => {
		if (value !== void 0) return schemaWithCatch.parse(value);
		context.addIssue({
			code: "custom",
			message: "Required value is missing"
		});
		return NEVER;
	});
}
/**
* A wire value's discriminant tag, when present as a string. excludeKnownTags
* and preserveCustomPayload are always applied as a pair, so what counts as
* "the tag" is single-sourced here.
*/
function stringTag(value, key) {
	if (value === null || typeof value !== "object" || Array.isArray(value)) return;
	const tag = value[key];
	return typeof tag === "string" ? tag : void 0;
}
/**
* Restores the JSON Schema `not` semantics of an extensible union's catch-all
* variant, which the code generator drops: the catch-all formally excludes the
* known variants' discriminant tags, so a malformed known variant (right tag,
* wrong payload) must fail validation instead of parsing as a custom variant.
*
* When this fires inside a union, zod surfaces only this issue (the catch-all
* is the closest match), so the message names the offending tag; the known
* variant's own field-level issues are not available here.
* TODO: re-run the matching known variant's schema and forward its issues so
* consumers can see which field actually failed.
*/
function excludeKnownTags(schema, key, knownTags) {
	return schema.superRefine((value, context) => {
		const tag = stringTag(value, key);
		if (tag !== void 0 && knownTags.includes(tag)) context.addIssue({
			code: "custom",
			path: [key],
			message: `${key} ${JSON.stringify(tag)} is reserved by a known variant, but the value does not match that variant's schema`
		});
	});
}
/**
* Restores the `unevaluatedProperties`/`additionalProperties: true` semantics
* of an extensible union's custom catch-all variant, which the generated
* object schemas drop: a custom variant's extra properties are its payload,
* so after a normal (stripping) parse the raw keys the subschemas didn't
* produce are re-attached. Keys the winning variant evaluated — including
* invalid values salvaged to defaults — keep their parsed results; keys it
* did NOT evaluate arrive raw, even ones a losing variant would have salvaged
* (e.g. a malformed `_meta` on a custom multi-select item).
*/
function preserveCustomPayload(schema, key, knownTags) {
	return unknown().transform((value, context) => {
		const result = schema.safeParse(value);
		if (!result.success) {
			for (const issue of result.error.issues) context.addIssue({
				...issue,
				input: value
			});
			return NEVER;
		}
		const output = result.data;
		const tag = stringTag(value, key);
		if (tag !== void 0 && !knownTags.includes(tag)) {
			const raw = value;
			for (const [property, rawValue] of Object.entries(raw)) {
				if (property === "__proto__") continue;
				if (!Object.hasOwn(output, property)) output[property] = rawValue;
			}
		}
		return output;
	});
}
function defaultOnErrorOptionalStringTag(schema, key) {
	return preprocess((value) => {
		if (value === null || typeof value !== "object" || Array.isArray(value)) return value;
		const record = value;
		const tag = record[key];
		if (tag === void 0 || tag === null || typeof tag === "string") return value;
		const normalized = { ...record };
		delete normalized[key];
		return normalized;
	}, schema);
}
function vecSkipError(itemSchema) {
	return array(itemSchema.catch(skippedItem)).transform((items) => items.filter((item) => item !== skippedItem));
}
/**
* Mirrors serde_with's `DefaultOnNull`: an explicit `null` deserializes as the
* field's empty value, while every other input — including a missing key — is
* validated by `schema` unchanged, so a required field still rejects an
* omitted key.
*/
function defaultOnNull(schema, empty) {
	return preprocess((value) => value === null ? empty() : value, schema);
}
/**
* A JSON integer for an `i64`/`u64` wire field. Fractions are rejected, but
* unlike `z.int()` there is no safe-integer bound: a 64-bit peer may send
* values beyond `Number.MAX_SAFE_INTEGER` (already rounded by `JSON.parse`),
* and those were accepted before integer checks were emitted.
*/
function wideInt() {
	return number().refine(Number.isInteger, { error: "Invalid input: expected int, received number" });
}
// ../code-for-antigravity/node_modules/@agentclientprotocol/sdk/dist/v1/unstable/schema/zod.gen.js
/**
* JSON RPC Request Id
*
* An identifier established by the Client that MUST contain a String, Number, or NULL value if included. If it is not included it is assumed to be a notification. The value SHOULD normally not be Null \[1\] and Numbers SHOULD NOT contain fractional parts \[2\]
*
* The Server MUST reply with the same value in the Response object if included. This member is used to correlate the context between the two objects.
*
* \[1\] The use of Null as a value for the id member in a Request object is discouraged, because this specification uses a value of Null for Responses with an unknown id. Also, because JSON-RPC 1.0 uses an id value of Null for Notifications this could cause confusion in handling.
*
* \[2\] Fractional parts may be problematic, since many decimal fractions cannot be represented exactly as binary fractions.
*/
var zRequestId = union([wideInt(), string()]).nullable();
/**
* A unique identifier for a conversation session between a client and agent.
*
* Each session has its own context, conversation history, and state, so one
* agent can run several independent sessions.
*
* See protocol docs: [Session ID](https://agentclientprotocol.com/protocol/v1/draft/session-setup#session-id)
*/
var zSessionId = string();
/**
* Request to write content to a text file.
*
* Only available if the client supports the `fs.writeTextFile` capability.
*/
var zWriteTextFileRequest = object({
	sessionId: zSessionId,
	path: string(),
	content: string(),
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
});
/**
* Request to read content from a text file.
*
* Only available if the client supports the `fs.readTextFile` capability.
*/
var zReadTextFileRequest = object({
	sessionId: zSessionId,
	path: string(),
	line: int().gte(0).max(4294967295, { error: "Invalid value: Expected uint32 to be <= 4294967295" }).nullish(),
	limit: int().gte(0).max(4294967295, { error: "Invalid value: Expected uint32 to be <= 4294967295" }).nullish(),
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
});
/**
* Unique identifier for a tool call within a session.
*/
var zToolCallId = string();
/**
* Categories of tools that can be invoked.
*
* Tool kinds help clients choose appropriate icons and optimize how they
* display tool execution progress.
*
* See protocol docs: [Creating](https://agentclientprotocol.com/protocol/v1/draft/tool-calls#creating)
*/
var zToolKind = union([
	literal("read"),
	literal("edit"),
	literal("delete"),
	literal("move"),
	literal("search"),
	literal("execute"),
	literal("think"),
	literal("fetch"),
	literal("switch_mode"),
	literal("other")
]);
/**
* Execution status of a tool call.
*
* Tool calls progress through different statuses during their lifecycle.
*
* See protocol docs: [Status](https://agentclientprotocol.com/protocol/v1/draft/tool-calls#status)
*/
var zToolCallStatus = union([
	literal("pending"),
	literal("in_progress"),
	literal("completed"),
	literal("failed")
]);
/**
* Optional annotations for the client. The client can use annotations to inform how objects are used or displayed
*/
var zAnnotations = object({
	audience: defaultOnError(vecSkipError(union([literal("assistant"), literal("user")])).nullish(), () => void 0),
	lastModified: defaultOnError(string().nullish(), () => void 0),
	priority: defaultOnError(number().nullish(), () => void 0),
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
});
/**
* Text provided to or from an LLM.
*/
var zTextContent = object({
	annotations: defaultOnError(zAnnotations.nullish(), () => void 0),
	text: string(),
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
});
/**
* An image provided to or from an LLM.
*/
var zImageContent = object({
	annotations: defaultOnError(zAnnotations.nullish(), () => void 0),
	data: string(),
	mimeType: string(),
	uri: defaultOnError(string().nullish(), () => void 0),
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
});
/**
* Audio provided to or from an LLM.
*/
var zAudioContent = object({
	annotations: defaultOnError(zAnnotations.nullish(), () => void 0),
	data: string(),
	mimeType: string(),
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
});
/**
* A resource that the server is capable of reading, included in a prompt or tool call result.
*/
var zResourceLink = object({
	annotations: defaultOnError(zAnnotations.nullish(), () => void 0),
	description: defaultOnError(string().nullish(), () => void 0),
	mimeType: defaultOnError(string().nullish(), () => void 0),
	name: string(),
	size: defaultOnError(wideInt().nullish(), () => void 0),
	title: defaultOnError(string().nullish(), () => void 0),
	uri: string(),
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
});
/**
* Resource content that can be embedded in a message.
*/
var zEmbeddedResourceResource = union([object({
	mimeType: defaultOnError(string().nullish(), () => void 0),
	text: string(),
	uri: string(),
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
}), object({
	blob: string(),
	mimeType: defaultOnError(string().nullish(), () => void 0),
	uri: string(),
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
})]);
/**
* The contents of a resource, embedded into a prompt or tool call result.
*/
var zEmbeddedResource = object({
	annotations: defaultOnError(zAnnotations.nullish(), () => void 0),
	resource: zEmbeddedResourceResource,
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
});
/**
* Content blocks represent displayable information in the Agent Client Protocol.
*
* Content blocks appear in:
* - User prompts sent via `session/prompt`
* - Language model output streamed through `session/update` notifications
* - Progress updates and results from tool calls
*
* This structure is compatible with the Model Context Protocol (MCP), so agents can
* forward content from MCP tool outputs without transformation.
*
* See protocol docs: [Content](https://agentclientprotocol.com/protocol/v1/draft/content)
*/
var zContentBlock = union([
	zTextContent.and(object({ type: literal("text") })),
	zImageContent.and(object({ type: literal("image") })),
	zAudioContent.and(object({ type: literal("audio") })),
	zResourceLink.and(object({ type: literal("resource_link") })),
	zEmbeddedResource.and(object({ type: literal("resource") }))
]);
/**
* Standard content block (text, images, resources).
*/
var zContent = object({
	content: zContentBlock,
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
});
/**
* A diff representing file modifications.
*
* Shows changes to files in a format suitable for display in the client UI.
*
* See protocol docs: [Content](https://agentclientprotocol.com/protocol/v1/draft/tool-calls#content)
*/
var zDiff = object({
	path: string(),
	oldText: defaultOnError(string().nullish(), () => void 0),
	newText: string(),
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
});
/**
* Typed identifier used for terminal values on the wire.
*/
var zTerminalId = string();
/**
* Embed a terminal created with `terminal/create` by its id.
*
* The terminal must be added before calling `terminal/release`.
*
* See protocol docs: [Terminal](https://agentclientprotocol.com/protocol/v1/draft/terminals)
*/
var zTerminal = object({
	terminalId: zTerminalId,
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
});
/**
* **UNSTABLE**
*
* This capability is not part of the spec yet, and may be removed or changed at any point.
*
* A display-only reference to another session that this tool call operates on,
* such as a subagent it created, delegated to, or is waiting on.
*
* The referenced session must already be known to the Client through ordinary
* session setup or a `subagent_update` announcement. The reference does not
* establish ownership, grant any Client-initiated controls, or report that the
* referenced session received or finished any work.
*
* @experimental
*/
var zSessionReference = object({
	sessionId: zSessionId,
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
});
/**
* Content produced by a tool call.
*
* Tool calls can produce different types of content including
* standard content blocks (text, images) or file diffs.
*
* See protocol docs: [Content](https://agentclientprotocol.com/protocol/v1/draft/tool-calls#content)
*/
var zToolCallContent = union([
	zContent.and(object({ type: literal("content") })),
	zDiff.and(object({ type: literal("diff") })),
	zTerminal.and(object({ type: literal("terminal") })),
	zSessionReference.and(object({ type: literal("session") }))
]);
/**
* A file location being accessed or modified by a tool.
*
* Enables clients to implement "follow-along" features that track
* which files the agent is working with in real-time.
*
* See protocol docs: [Following the Agent](https://agentclientprotocol.com/protocol/v1/draft/tool-calls#following-the-agent)
*/
var zToolCallLocation = object({
	path: string(),
	line: defaultOnError(int().gte(0).max(4294967295, { error: "Invalid value: Expected uint32 to be <= 4294967295" }).nullish(), () => void 0),
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
});
/**
* An update to an existing tool call.
*
* Used to report progress and results as tools execute. All fields except
* the tool call ID are optional - only changed fields need to be included.
*
* See protocol docs: [Updating](https://agentclientprotocol.com/protocol/v1/draft/tool-calls#updating)
*/
var zToolCallUpdate = object({
	toolCallId: zToolCallId,
	kind: defaultOnError(zToolKind.nullish(), () => void 0),
	status: defaultOnError(zToolCallStatus.nullish(), () => void 0),
	title: defaultOnError(string().nullish(), () => void 0),
	name: defaultOnError(string().nullish(), () => void 0),
	content: defaultOnError(vecSkipError(zToolCallContent).nullish(), () => void 0),
	locations: defaultOnError(vecSkipError(zToolCallLocation).nullish(), () => void 0),
	rawInput: defaultOnError(unknown().optional(), () => void 0),
	rawOutput: defaultOnError(unknown().optional(), () => void 0),
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
});
/**
* Unique identifier for a permission option.
*/
var zPermissionOptionId = string();
/**
* The type of permission option being presented to the user.
*
* Helps clients choose appropriate icons and UI treatment.
*/
var zPermissionOptionKind = union([
	literal("allow_once"),
	literal("allow_always"),
	literal("reject_once"),
	literal("reject_always")
]);
/**
* Request for user permission to execute a tool call.
*
* Sent when the agent needs authorization before performing a sensitive operation.
*
* See protocol docs: [Requesting Permission](https://agentclientprotocol.com/protocol/v1/draft/tool-calls#requesting-permission)
*/
var zRequestPermissionRequest = object({
	sessionId: zSessionId,
	toolCall: zToolCallUpdate,
	options: array(object({
		optionId: zPermissionOptionId,
		name: string(),
		kind: zPermissionOptionKind,
		_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
	})),
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
});
/**
* An environment variable to set when launching an MCP server.
*/
var zEnvVariable = object({
	name: string(),
	value: string(),
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
});
/**
* Request to create a new terminal and execute a command.
*/
var zCreateTerminalRequest = object({
	sessionId: zSessionId,
	command: string(),
	args: defaultOnNull(array(string()), () => []).optional(),
	env: defaultOnNull(array(zEnvVariable), () => []).optional(),
	cwd: string().nullish(),
	outputByteLimit: wideInt().gte(0).nullish(),
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
});
/**
* Request to get the current output and status of a terminal.
*/
var zTerminalOutputRequest = object({
	sessionId: zSessionId,
	terminalId: zTerminalId,
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
});
/**
* Request to release a terminal and free its resources.
*/
var zReleaseTerminalRequest = object({
	sessionId: zSessionId,
	terminalId: zTerminalId,
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
});
/**
* Request to wait for a terminal command to exit.
*/
var zWaitForTerminalExitRequest = object({
	sessionId: zSessionId,
	terminalId: zTerminalId,
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
});
/**
* Request to kill a terminal without releasing it.
*/
var zKillTerminalRequest = object({
	sessionId: zSessionId,
	terminalId: zTerminalId,
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
});
/**
* Session-scoped elicitation, optionally tied to a specific tool call.
*
* When `toolCallId` is set, the elicitation is tied to a specific tool call.
* This is useful when an agent receives an elicitation from an MCP server
* during a tool call and needs to redirect it to the user.
*/
var zElicitationSessionScope = object({
	sessionId: zSessionId,
	toolCallId: defaultOnError(zToolCallId.nullish(), () => void 0)
});
/**
* Request-scoped elicitation, tied to a specific JSON-RPC request outside of a session
* (e.g., during auth/configuration phases before any session is started).
*/
var zElicitationRequestScope = object({ requestId: zRequestId });
/**
* Object schema type.
*/
var zElicitationSchemaType = literal("object");
/**
* String format types for string properties in elicitation schemas.
*/
var zStringFormat = union([
	literal("email"),
	literal("uri"),
	literal("date"),
	literal("date-time")
]);
/**
* A titled enum option with a const value, human-readable title, and optional description.
*/
var zEnumOption = object({
	const: string(),
	title: string(),
	description: defaultOnError(string().nullish(), () => void 0),
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
});
/**
* Schema for string properties in an elicitation form.
*
* When `enum` or `oneOf` is set, this represents a single-select enum
* with `"type": "string"`.
*/
var zStringPropertySchema = object({
	title: defaultOnError(string().nullish(), () => void 0),
	description: defaultOnError(string().nullish(), () => void 0),
	minLength: int().gte(0).max(4294967295, { error: "Invalid value: Expected uint32 to be <= 4294967295" }).nullish(),
	maxLength: int().gte(0).max(4294967295, { error: "Invalid value: Expected uint32 to be <= 4294967295" }).nullish(),
	pattern: string().nullish(),
	format: zStringFormat.nullish(),
	default: defaultOnError(string().nullish(), () => void 0),
	enum: array(string()).nullish(),
	oneOf: array(zEnumOption).nullish(),
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
});
/**
* Schema for number (floating-point) properties in an elicitation form.
*/
var zNumberPropertySchema = object({
	title: defaultOnError(string().nullish(), () => void 0),
	description: defaultOnError(string().nullish(), () => void 0),
	minimum: number().nullish(),
	maximum: number().nullish(),
	default: defaultOnError(number().nullish(), () => void 0),
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
});
/**
* Schema for integer properties in an elicitation form.
*/
var zIntegerPropertySchema = object({
	title: defaultOnError(string().nullish(), () => void 0),
	description: defaultOnError(string().nullish(), () => void 0),
	minimum: wideInt().nullish(),
	maximum: wideInt().nullish(),
	default: defaultOnError(wideInt().nullish(), () => void 0),
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
});
/**
* Schema for boolean properties in an elicitation form.
*/
var zBooleanPropertySchema = object({
	title: defaultOnError(string().nullish(), () => void 0),
	description: defaultOnError(string().nullish(), () => void 0),
	default: defaultOnError(boolean().nullish(), () => void 0),
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
});
/**
* String item schema for multi-select enum properties.
*/
var zStringMultiSelectItems = object({
	enum: array(string()),
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
});
/**
* Items definition for titled multi-select enum properties.
*/
var zTitledMultiSelectItems = object({
	anyOf: array(zEnumOption),
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
});
/**
* Items for a multi-select (array) property schema.
*
* Custom variants (unknown `type` values) keep their extra
* properties exactly as received; unlike known variants, those keys
* bypass lenient-field salvage and arrive unvalidated.
*/
var zMultiSelectItems = preserveCustomPayload(union([
	zStringMultiSelectItems.and(object({ type: literal("string") })),
	excludeKnownTags(object({ type: string() }), "type", ["string"]),
	zTitledMultiSelectItems
]), "type", ["string"]);
/**
* Schema for multi-select (array) properties in an elicitation form.
*/
var zMultiSelectPropertySchema = object({
	title: defaultOnError(string().nullish(), () => void 0),
	description: defaultOnError(string().nullish(), () => void 0),
	minItems: wideInt().gte(0).nullish(),
	maxItems: wideInt().gte(0).nullish(),
	items: zMultiSelectItems,
	default: defaultOnError(vecSkipError(string()).nullish(), () => void 0),
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
});
/**
* Property schema for elicitation form fields.
*
* Each variant corresponds to a JSON Schema `"type"` value.
* Single-select enums use `type: "string"` with `enum` or `oneOf` set.
* Multi-select enums use `type: "array"`.
*
* Custom variants (unknown `type` values) keep their extra
* properties exactly as received; unlike known variants, those keys
* bypass lenient-field salvage and arrive unvalidated.
*/
var zElicitationPropertySchema = preserveCustomPayload(union([
	zStringPropertySchema.and(object({ type: literal("string") })),
	zNumberPropertySchema.and(object({ type: literal("number") })),
	zIntegerPropertySchema.and(object({ type: literal("integer") })),
	zBooleanPropertySchema.and(object({ type: literal("boolean") })),
	zMultiSelectPropertySchema.and(object({ type: literal("array") })),
	excludeKnownTags(object({ type: string() }), "type", [
		"array",
		"boolean",
		"integer",
		"number",
		"string"
	])
]), "type", [
	"array",
	"boolean",
	"integer",
	"number",
	"string"
]);
/**
* Type-safe elicitation schema for requesting structured user input.
*
* This represents a JSON Schema object with primitive-typed properties,
* as required by the elicitation specification.
*/
var zElicitationSchema = object({
	type: defaultOnError(zElicitationSchemaType.optional().default("object"), () => "object"),
	title: defaultOnError(string().nullish(), () => void 0),
	properties: record(string(), zElicitationPropertySchema).optional().default({}),
	required: array(string()).nullish(),
	description: defaultOnError(string().nullish(), () => void 0),
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
});
/**
* Form-based elicitation mode where the client renders a form from the provided schema.
*/
var zElicitationFormMode = intersection(union([zElicitationSessionScope, zElicitationRequestScope]), object({ requestedSchema: zElicitationSchema }));
/**
* Unique identifier for an elicitation.
*/
var zElicitationId = string();
/**
* URL-based elicitation mode where the client directs the user to a URL.
*/
var zElicitationUrlMode = intersection(union([zElicitationSessionScope, zElicitationRequestScope]), object({
	elicitationId: zElicitationId,
	url: url()
}));
/**
* Request from the agent to elicit structured user input.
*
* The agent sends this to the client to request information from the user,
* either via a form or by directing them to a URL.
* Elicitations are tied to a session (optionally a tool call) or a request.
*
* Custom variants (unknown `mode` values) keep their extra
* properties exactly as received; unlike known variants, those keys
* bypass lenient-field salvage and arrive unvalidated.
*/
var zCreateElicitationRequest = preserveCustomPayload(intersection(union([
	zElicitationFormMode.and(object({ mode: literal("form") })),
	zElicitationUrlMode.and(object({ mode: literal("url") })),
	excludeKnownTags(intersection(union([zElicitationSessionScope, zElicitationRequestScope]), object({ mode: string() })), "mode", ["form", "url"])
]), object({
	message: string(),
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
})), "mode", ["form", "url"]);
/**
* **UNSTABLE**
*
* This capability is not part of the spec yet, and may be removed or changed at any point.
*
* Unique identifier for an MCP server using the ACP transport.
*
* The value is opaque and generated by the ACP component providing the MCP server. It is
* used by `mcp/message` to route requests to the component that declared the server.
*
* @experimental
*/
var zMcpServerAcpId = string();
/**
* **UNSTABLE**
*
* This capability is not part of the spec yet, and may be removed or changed at any point.
*
* Identifies an inner MCP request active against a server on this ACP connection.
*
* Generated by the caller and preserved unchanged by proxies. This is distinct
* from the outer ACP JSON-RPC request ID.
*
* @experimental
*/
var zMcpRequestId = string();
/**
* **UNSTABLE**
*
* This capability is not part of the spec yet, and may be removed or changed at any point.
*
* Request parameters for `mcp/message`.
*
* @experimental
*/
var zMessageMcpRequest = object({
	serverId: zMcpServerAcpId,
	requestId: zMcpRequestId,
	method: string(),
	params: record(string(), unknown()).nullish(),
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
});
/**
* Allows for sending an arbitrary request that is not part of the ACP spec.
* Extension methods provide a way to add custom functionality while maintaining
* protocol compatibility.
*
* See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/v1/draft/extensibility)
*/
var zExtRequest = unknown();
object({
	id: zRequestId,
	method: string(),
	params: union([
		zWriteTextFileRequest,
		zReadTextFileRequest,
		zRequestPermissionRequest,
		zCreateTerminalRequest,
		zTerminalOutputRequest,
		zReleaseTerminalRequest,
		zWaitForTerminalExitRequest,
		zKillTerminalRequest,
		zCreateElicitationRequest,
		zMessageMcpRequest,
		zExtRequest
	]).nullish()
});
/**
* Protocol version identifier.
*
* This version is only bumped for breaking changes.
* Non-breaking changes should be introduced via capabilities.
*/
var zProtocolVersion = int().gte(0).lte(65535);
/**
* Prompt capabilities supported by the agent in `session/prompt` requests.
*
* Baseline agent functionality requires support for `text`
* and `resource_link` content blocks in prompt requests.
*
* Other variants must be explicitly opted in to.
* Capabilities for different types of content in prompt requests.
*
* Indicates which content types beyond the baseline (text and resource links)
* the agent can process.
*
* See protocol docs: [Prompt Capabilities](https://agentclientprotocol.com/protocol/v1/draft/initialization#prompt-capabilities)
*/
var zPromptCapabilities = object({
	image: defaultOnError(boolean().optional().default(false), () => false),
	audio: defaultOnError(boolean().optional().default(false), () => false),
	embeddedContext: defaultOnError(boolean().optional().default(false), () => false),
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
});
/**
* MCP capabilities supported by the agent
*/
var zMcpCapabilities = object({
	http: defaultOnError(boolean().optional().default(false), () => false),
	sse: defaultOnError(boolean().optional().default(false), () => false),
	acp: defaultOnError(boolean().optional().default(false), () => false),
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
});
/**
* Capabilities for the `session/list` method.
*
* Supplying `{}` means the agent supports listing sessions.
*/
var zSessionListCapabilities = object({ _meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0) });
/**
* Capabilities for the `session/delete` method.
*
* Supplying `{}` means the agent supports deleting sessions from `session/list`.
*/
var zSessionDeleteCapabilities = object({ _meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0) });
/**
* Capabilities for additional session directories support.
*
* Supplying `{}` means the agent supports the `additionalDirectories` field on
* supported session lifecycle requests. Agents that also support
* `session/list` may return `SessionInfo.additionalDirectories` to report the
* complete ordered additional-root list associated with a listed session.
*/
var zSessionAdditionalDirectoriesCapabilities = object({ _meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0) });
/**
* Capabilities for client-provided system prompts.
*
* Supplying `{}` means the agent supports `systemPrompt` on session lifecycle
* requests in `append` mode.
*/
var zSessionSystemPromptCapabilities = object({
	mode: defaultOnError(object({
		override: defaultOnError(object({ _meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0) }).nullish(), () => void 0),
		_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
	}).nullish(), () => void 0),
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
});
/**
* **UNSTABLE**
*
* This capability is not part of the spec yet, and may be removed or changed at any point.
*
* Capabilities for the `session/fork` method.
*
* Supplying `{}` means the agent supports forking sessions.
*
* @experimental
*/
var zSessionForkCapabilities = object({ _meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0) });
/**
* **UNSTABLE**
*
* This capability is not part of the spec yet, and may be removed or changed at any point.
*
* Capabilities for `session/archive` and `session/unarchive`.
*
* Supplying `{}` means the agent supports both methods, the `archived` filter on
* `session/list`, and `SessionInfo.archived`.
*
* @experimental
*/
var zSessionArchiveCapabilities = object({ _meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0) });
/**
* **UNSTABLE**
*
* This capability is not part of the spec yet, and may be removed or changed at any point.
*
* Capabilities for the `session/status` method.
*
* Supplying `{}` means the agent supports checking session status.
*
* @experimental
*/
var zSessionStatusCapabilities = object({ _meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0) });
/**
* **UNSTABLE**
*
* This capability is not part of the spec yet, and may be removed or changed at any point.
*
* Capabilities for the `session/options` method.
*
* Supplying `{}` means the agent supports `session/options` and accepts initial config
* option values on session setup requests.
*
* @experimental
*/
var zSessionOptionsCapabilities = object({ _meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0) });
/**
* **UNSTABLE**
*
* This capability is not part of the spec yet, and may be removed or changed at any point.
*
* Capabilities for Client-set session titles.
*
* Supplying `{}` means the agent supports `session/set_title`. Agents report titles
* through `session/list` and `session_info_update` without this capability.
*
* @experimental
*/
var zSessionTitleCapabilities = object({ _meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0) });
/**
* Capabilities for the `session/resume` method.
*
* Supplying `{}` means the agent supports resuming sessions.
*/
var zSessionResumeCapabilities = object({ _meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0) });
/**
* Capabilities for the `session/close` method.
*
* Supplying `{}` means the agent supports closing sessions.
*/
var zSessionCloseCapabilities = object({ _meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0) });
/**
* Session capabilities supported by the agent.
*
* As a baseline, all Agents **MUST** support `session/new`, `session/prompt`, `session/cancel`, and `session/update`.
*
* Optionally, they **MAY** support other session methods and notifications by specifying additional capabilities.
*
* Note: `session/load` is still handled by the top-level `loadSession` capability. This will be unified in future versions of the protocol.
*
* See protocol docs: [Session Capabilities](https://agentclientprotocol.com/protocol/v1/draft/initialization#session-capabilities)
*/
var zSessionCapabilities = object({
	list: defaultOnError(zSessionListCapabilities.nullish(), () => void 0),
	delete: defaultOnError(zSessionDeleteCapabilities.nullish(), () => void 0),
	additionalDirectories: defaultOnError(zSessionAdditionalDirectoriesCapabilities.nullish(), () => void 0),
	systemPrompt: defaultOnError(zSessionSystemPromptCapabilities.nullish(), () => void 0),
	fork: defaultOnError(zSessionForkCapabilities.nullish(), () => void 0),
	archive: defaultOnError(zSessionArchiveCapabilities.nullish(), () => void 0),
	status: defaultOnError(zSessionStatusCapabilities.nullish(), () => void 0),
	options: defaultOnError(zSessionOptionsCapabilities.nullish(), () => void 0),
	title: defaultOnError(zSessionTitleCapabilities.nullish(), () => void 0),
	resume: defaultOnError(zSessionResumeCapabilities.nullish(), () => void 0),
	close: defaultOnError(zSessionCloseCapabilities.nullish(), () => void 0),
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
});
/**
* **UNSTABLE**
*
* This capability is not part of the spec yet, and may be removed or changed at any point.
*
* Auth status capabilities supported by the agent.
*
* Supplying `{}` means the agent supports the `auth/status` method.
*
* @experimental
*/
var zAuthStatusCapabilities = object({ _meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0) });
/**
* Logout capabilities supported by the agent.
*
* Supplying `{}` means the agent supports the logout method.
*/
var zLogoutCapabilities = object({ _meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0) });
/**
* Authentication-related capabilities supported by the agent.
*/
var zAgentAuthCapabilities = object({
	status: defaultOnError(zAuthStatusCapabilities.nullish(), () => void 0),
	logout: defaultOnError(zLogoutCapabilities.nullish(), () => void 0),
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
});
/**
* **UNSTABLE**
*
* This capability is not part of the spec yet, and may be removed or changed at any point.
*
* Provider configuration capabilities supported by the agent.
*
* Supplying `{}` means the agent supports provider configuration methods.
*
* @experimental
*/
var zProvidersCapabilities = object({ _meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0) });
/**
* Capabilities supported by the agent.
*
* Advertised during initialization to inform the client about
* available features and content types.
*
* See protocol docs: [Agent Capabilities](https://agentclientprotocol.com/protocol/v1/draft/initialization#agent-capabilities)
*/
var zAgentCapabilities = object({
	loadSession: defaultOnError(boolean().optional().default(false), () => false),
	promptCapabilities: defaultOnError(zPromptCapabilities.optional().default({
		image: false,
		audio: false,
		embeddedContext: false
	}), () => ({
		image: false,
		audio: false,
		embeddedContext: false
	})),
	mcpCapabilities: defaultOnError(zMcpCapabilities.optional().default({
		http: false,
		sse: false,
		acp: false
	}), () => ({
		http: false,
		sse: false,
		acp: false
	})),
	sessionCapabilities: defaultOnError(zSessionCapabilities.optional().default({}), () => ({})),
	auth: defaultOnError(zAgentAuthCapabilities.optional().default({}), () => ({})),
	providers: defaultOnError(zProvidersCapabilities.nullish(), () => void 0),
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
});
/**
* Typed identifier used for auth method values on the wire.
*/
var zAuthMethodId = string();
/**
* Terminal-based authentication method.
*
* The client runs the configured agent program as a separate interactive
* process for the user to authenticate via a TUI. Agents MUST advertise this
* method only when the client enabled its terminal authentication capability.
* A zero exit status signals success. Any other termination signals failure.
* The client MUST NOT pass this method to `authenticate`.
*/
var zAuthMethodTerminal = object({
	id: zAuthMethodId,
	name: string(),
	description: defaultOnError(string().nullish(), () => void 0),
	args: defaultOnNull(array(string()), () => []).optional(),
	env: defaultOnNull(record(string(), string()), () => ({})).optional(),
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
});
/**
* Agent handles authentication itself through `authenticate`.
*
* This is the default authentication method type.
*/
var zAuthMethodAgent = object({
	id: zAuthMethodId,
	name: string(),
	description: defaultOnError(string().nullish(), () => void 0),
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
});
/**
* Describes an available authentication method.
*
* The `type` field acts as the discriminator in the serialized JSON form.
* When no `type` is present, the method is treated as `agent`.
*/
var zAuthMethod = union([zAuthMethodTerminal.and(object({ type: literal("terminal") })), zAuthMethodAgent]);
/**
* Metadata about the implementation of the client or agent.
* Describes the name and version of an ACP implementation, with an optional
* title for UI representation.
*/
var zImplementation = object({
	name: string(),
	title: defaultOnError(string().nullish(), () => void 0),
	version: string(),
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
});
/**
* Response to the `initialize` method.
*
* Contains the negotiated protocol version and agent capabilities.
*
* See protocol docs: [Initialization](https://agentclientprotocol.com/protocol/v1/draft/initialization)
*/
var zInitializeResponse = object({
	protocolVersion: zProtocolVersion,
	agentCapabilities: defaultOnError(zAgentCapabilities.optional().default({
		loadSession: false,
		promptCapabilities: {
			image: false,
			audio: false,
			embeddedContext: false
		},
		mcpCapabilities: {
			http: false,
			sse: false,
			acp: false
		},
		sessionCapabilities: {},
		auth: {}
	}), () => ({
		loadSession: false,
		promptCapabilities: {
			image: false,
			audio: false,
			embeddedContext: false
		},
		mcpCapabilities: {
			http: false,
			sse: false,
			acp: false
		},
		sessionCapabilities: {},
		auth: {}
	})),
	authMethods: defaultOnError(vecSkipError(zAuthMethod).optional().default([]), () => []),
	agentInfo: defaultOnError(zImplementation.nullish(), () => void 0),
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
});
/**
* Response to the `authenticate` method.
*/
var zAuthenticateResponse = object({ _meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0) });
/**
* **UNSTABLE**
*
* This capability is not part of the spec yet, and may be removed or changed at any point.
*
* Unique identifier for a configurable LLM provider.
*
* @experimental
*/
var zProviderId = string();
/**
* **UNSTABLE**
*
* This capability is not part of the spec yet, and may be removed or changed at any point.
*
* Well-known API protocol identifiers for LLM providers.
*
* Agents and clients MUST handle unknown protocol identifiers gracefully.
*
* Protocol names beginning with `_` are free for custom use, like other ACP extension methods.
* Protocol names that do not begin with `_` are reserved for the ACP spec.
*
* @experimental
*/
var zLlmProtocol = union([
	literal("anthropic"),
	literal("openai"),
	literal("azure"),
	literal("vertex"),
	literal("bedrock"),
	string()
]);
/**
* **UNSTABLE**
*
* This capability is not part of the spec yet, and may be removed or changed at any point.
*
* Current effective non-secret routing configuration for a provider.
*
* @experimental
*/
var zProviderCurrentConfig = object({
	apiType: zLlmProtocol,
	baseUrl: string(),
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
});
/**
* **UNSTABLE**
*
* This capability is not part of the spec yet, and may be removed or changed at any point.
*
* Response to `providers/list`.
*
* @experimental
*/
var zListProvidersResponse = object({
	providers: array(object({
		providerId: zProviderId,
		supported: requiredDefaultOnError(vecSkipError(zLlmProtocol), () => []),
		required: boolean(),
		current: zProviderCurrentConfig.nullish(),
		_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
	})),
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
});
/**
* **UNSTABLE**
*
* This capability is not part of the spec yet, and may be removed or changed at any point.
*
* Response to `providers/set`.
*
* @experimental
*/
var zSetProviderResponse = object({ _meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0) });
/**
* **UNSTABLE**
*
* This capability is not part of the spec yet, and may be removed or changed at any point.
*
* Response to `providers/disable`.
*
* @experimental
*/
var zDisableProviderResponse = object({ _meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0) });
/**
* Response to the `logout` method.
*/
var zLogoutResponse = object({ _meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0) });
/**
* **UNSTABLE**
*
* This capability is not part of the spec yet, and may be removed or changed at any point.
*
* The agent's overall authentication state.
*
* @experimental
*/
var zAuthState = union([
	literal("authenticated"),
	literal("unauthenticated"),
	literal("not_required"),
	literal("unknown"),
	string()
]);
/**
* **UNSTABLE**
*
* This capability is not part of the spec yet, and may be removed or changed at any point.
*
* An account or credential the agent has configured, such as a signed-in user
* account or an API key.
*
* All fields are display information only. Clients MUST NOT use them as stable
* account identifiers, and SHOULD NOT log them or send them elsewhere, such as to
* telemetry.
*
* @experimental
*/
var zAuthAccount = object({
	label: string(),
	description: defaultOnError(string().nullish(), () => void 0),
	active: defaultOnError(boolean().nullish(), () => void 0),
	name: defaultOnError(string().nullish(), () => void 0),
	email: defaultOnError(string().nullish(), () => void 0),
	organization: defaultOnError(string().nullish(), () => void 0),
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
});
/**
* **UNSTABLE**
*
* This capability is not part of the spec yet, and may be removed or changed at any point.
*
* Response to the `auth/status` method.
*
* @experimental
*/
var zAuthStatusResponse = object({
	state: zAuthState,
	accounts: defaultOnError(vecSkipError(zAuthAccount).optional(), () => []),
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
});
/**
* Unique identifier for a Session Mode.
*/
var zSessionModeId = string();
/**
* The set of modes and the one currently active.
*/
var zSessionModeState = object({
	currentModeId: zSessionModeId,
	availableModes: requiredDefaultOnError(vecSkipError(object({
		id: zSessionModeId,
		name: string(),
		description: defaultOnError(string().nullish(), () => void 0),
		_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
	})), () => []),
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
});
/**
* Unique identifier for a session configuration option.
*/
var zSessionConfigId = string();
/**
* Semantic category for a session configuration option.
*
* This is intended to help Clients distinguish broadly common selectors (e.g. model selector vs
* session mode selector vs thought/reasoning level) for UX purposes (keyboard shortcuts, icons,
* placement). It MUST NOT be required for correctness. Clients MUST handle missing or unknown
* categories gracefully.
*
* Category names beginning with `_` are free for custom use, like other ACP extension methods.
* Category names that do not begin with `_` are reserved for the ACP spec.
*/
var zSessionConfigOptionCategory = union([
	literal("mode"),
	literal("model"),
	literal("model_config"),
	literal("thought_level"),
	string()
]);
/**
* Unique identifier for a session configuration option value.
*/
var zSessionConfigValueId = string();
/**
* A possible value for a session configuration option.
*/
var zSessionConfigSelectOption = object({
	value: zSessionConfigValueId,
	name: string(),
	description: defaultOnError(string().nullish(), () => void 0),
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
});
/**
* A group of possible values for a session configuration option.
*/
var zSessionConfigSelectGroup = object({
	group: string(),
	name: string(),
	options: requiredDefaultOnError(vecSkipError(zSessionConfigSelectOption), () => []),
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
});
/**
* A single-value selector (dropdown) session configuration option payload.
*/
var zSessionConfigSelect = object({
	currentValue: zSessionConfigValueId,
	options: union([array(zSessionConfigSelectOption), array(zSessionConfigSelectGroup)])
});
/**
* A boolean on/off toggle session configuration option payload.
*/
var zSessionConfigBoolean = object({ currentValue: boolean() });
/**
* A session configuration option selector and its current state.
*/
var zSessionConfigOption = intersection(union([zSessionConfigSelect.and(object({ type: literal("select") })), zSessionConfigBoolean.and(object({ type: literal("boolean") }))]), object({
	id: zSessionConfigId,
	name: string(),
	description: defaultOnError(string().nullish(), () => void 0),
	category: defaultOnError(zSessionConfigOptionCategory.nullish(), () => void 0),
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
}));
/**
* Response from creating a new session.
*
* See protocol docs: [Creating a Session](https://agentclientprotocol.com/protocol/v1/draft/session-setup#creating-a-session)
*/
var zNewSessionResponse = object({
	sessionId: zSessionId,
	modes: defaultOnError(zSessionModeState.nullish(), () => void 0),
	configOptions: defaultOnError(vecSkipError(zSessionConfigOption).nullish(), () => void 0),
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
});
/**
* Response from loading an existing session.
*/
var zLoadSessionResponse = object({
	modes: defaultOnError(zSessionModeState.nullish(), () => void 0),
	configOptions: defaultOnError(vecSkipError(zSessionConfigOption).nullish(), () => void 0),
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
});
/**
* Response from listing sessions.
*/
var zListSessionsResponse = object({
	sessions: requiredDefaultOnError(vecSkipError(object({
		sessionId: zSessionId,
		cwd: string(),
		additionalDirectories: defaultOnError(vecSkipError(string()).optional(), () => []),
		title: defaultOnError(string().nullish(), () => void 0),
		updatedAt: defaultOnError(string().nullish(), () => void 0),
		archived: defaultOnError(boolean().nullish(), () => void 0),
		_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
	})), () => []),
	nextCursor: defaultOnError(string().nullish(), () => void 0),
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
});
/**
* Response from deleting a session.
*/
var zDeleteSessionResponse = object({ _meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0) });
/**
* **UNSTABLE**
*
* This capability is not part of the spec yet, and may be removed or changed at any point.
*
* Response from forking an existing session.
*
* @experimental
*/
var zForkSessionResponse = object({
	sessionId: zSessionId,
	modes: defaultOnError(zSessionModeState.nullish(), () => void 0),
	configOptions: defaultOnError(vecSkipError(zSessionConfigOption).nullish(), () => void 0),
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
});
/**
* **UNSTABLE**
*
* This capability is not part of the spec yet, and may be removed or changed at any point.
*
* Response from archiving a session.
*
* @experimental
*/
var zArchiveSessionResponse = object({ _meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0) });
/**
* **UNSTABLE**
*
* This capability is not part of the spec yet, and may be removed or changed at any point.
*
* Response from unarchiving a session.
*
* @experimental
*/
var zUnarchiveSessionResponse = object({ _meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0) });
/**
* **UNSTABLE**
*
* This capability is not part of the spec yet, and may be removed or changed at any point.
*
* Response from checking the status of a session.
*
* The result is a snapshot. A session reported `open` may be closed or evicted before
* the Client's next request.
*
* @experimental
*/
var zSessionStatusResponse = object({
	status: union([
		literal("open"),
		literal("saved"),
		string()
	]),
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
});
/**
* **UNSTABLE**
*
* This capability is not part of the spec yet, and may be removed or changed at any point.
*
* Response from `session/options`.
*
* The result is a snapshot. The options a session actually starts with are the ones in
* the session setup response.
*
* Agents only return `type: "boolean"` options when the Client advertises
* `sessionCapabilities.configOptions.boolean`.
*
* @experimental
*/
var zSessionOptionsResponse = object({
	modes: defaultOnError(zSessionModeState.nullish(), () => void 0),
	configOptions: defaultOnError(vecSkipError(zSessionConfigOption).nullish(), () => void 0),
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
});
/**
* **UNSTABLE**
*
* This capability is not part of the spec yet, and may be removed or changed at any point.
*
* Response from setting the title of a session.
*
* @experimental
*/
var zSetSessionTitleResponse = object({
	title: string(),
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
});
/**
* Response from resuming an existing session.
*/
var zResumeSessionResponse = object({
	modes: defaultOnError(zSessionModeState.nullish(), () => void 0),
	configOptions: defaultOnError(vecSkipError(zSessionConfigOption).nullish(), () => void 0),
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
});
/**
* Response from closing a session.
*/
var zCloseSessionResponse = object({ _meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0) });
/**
* Response to `session/set_mode` method.
*/
var zSetSessionModeResponse = object({ _meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0) });
/**
* Response to `session/set_config_option` method.
*/
var zSetSessionConfigOptionResponse = object({
	configOptions: requiredDefaultOnError(vecSkipError(zSessionConfigOption), () => []),
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
});
/**
* Reasons why an agent stops processing a prompt turn.
*
* See protocol docs: [Stop Reasons](https://agentclientprotocol.com/protocol/v1/draft/prompt-turn#stop-reasons)
*/
var zStopReason = union([
	literal("end_turn"),
	literal("max_tokens"),
	literal("max_turn_requests"),
	literal("refusal"),
	literal("cancelled")
]);
/**
* **UNSTABLE**
*
* This capability is not part of the spec yet, and may be removed or changed at any point.
*
* Token usage information for a prompt turn.
*
* @experimental
*/
var zUsage = object({
	totalTokens: wideInt().gte(0),
	inputTokens: wideInt().gte(0),
	outputTokens: wideInt().gte(0),
	thoughtTokens: defaultOnError(wideInt().gte(0).nullish(), () => void 0),
	cachedReadTokens: defaultOnError(wideInt().gte(0).nullish(), () => void 0),
	cachedWriteTokens: defaultOnError(wideInt().gte(0).nullish(), () => void 0),
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
});
/**
* Response from processing a user prompt.
*
* See protocol docs: [Check for Completion](https://agentclientprotocol.com/protocol/v1/draft/prompt-turn#4-check-for-completion)
*/
var zPromptResponse = object({
	stopReason: zStopReason,
	usage: defaultOnError(zUsage.nullish(), () => void 0),
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
});
/**
* Allows for sending an arbitrary response to an extension request that is not part of the ACP spec.
* Extension methods provide a way to add custom functionality while maintaining
* protocol compatibility.
*
* See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/v1/draft/extensibility)
*/
var zExtResponse = unknown();
/**
* JSON-RPC error object.
*
* Represents an error that occurred during method execution, following the
* JSON-RPC 2.0 error object specification with optional additional data.
*
* See protocol docs: [JSON-RPC Error Object](https://www.jsonrpc.org/specification#error_object)
*/
var zError = object({
	code: union([
		literal(-32700),
		literal(-32600),
		literal(-32601),
		literal(-32602),
		literal(-32603),
		literal(-32800),
		literal(-32e3),
		literal(-32002),
		int().min(-2147483648, { error: "Invalid value: Expected int32 to be >= -2147483648" }).max(2147483647, { error: "Invalid value: Expected int32 to be <= 2147483647" })
	]),
	message: string(),
	data: defaultOnError(unknown().optional(), () => void 0)
});
union([object({
	id: zRequestId,
	result: union([
		zInitializeResponse,
		zAuthenticateResponse,
		zListProvidersResponse,
		zSetProviderResponse,
		zDisableProviderResponse,
		zLogoutResponse,
		zAuthStatusResponse,
		zNewSessionResponse,
		zLoadSessionResponse,
		zListSessionsResponse,
		zDeleteSessionResponse,
		zForkSessionResponse,
		zArchiveSessionResponse,
		zUnarchiveSessionResponse,
		zSessionStatusResponse,
		zSessionOptionsResponse,
		zSetSessionTitleResponse,
		zResumeSessionResponse,
		zCloseSessionResponse,
		zSetSessionModeResponse,
		zSetSessionConfigOptionResponse,
		zPromptResponse,
		zExtResponse
	])
}), object({
	id: zRequestId,
	error: zError
})]);
/**
* Unique identifier for a message within a session.
*/
var zMessageId = string();
/**
* A streamed item of content
*/
var zContentChunk = object({
	content: zContentBlock,
	messageId: defaultOnError(zMessageId.nullish(), () => void 0),
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
});
/**
* Represents a tool call that the language model has requested.
*
* Tool calls are actions that the agent executes on behalf of the language model,
* such as reading files, executing code, or fetching data from external sources.
*
* See protocol docs: [Tool Calls](https://agentclientprotocol.com/protocol/v1/draft/tool-calls)
*/
var zToolCall = object({
	toolCallId: zToolCallId,
	title: string(),
	name: defaultOnError(string().nullish(), () => void 0),
	kind: defaultOnError(zToolKind.optional(), () => void 0),
	status: defaultOnError(zToolCallStatus.optional(), () => void 0),
	content: defaultOnError(vecSkipError(zToolCallContent).optional(), () => []),
	locations: defaultOnError(vecSkipError(zToolCallLocation).optional(), () => []),
	rawInput: defaultOnError(unknown().optional(), () => void 0),
	rawOutput: defaultOnError(unknown().optional(), () => void 0),
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
});
/**
* Priority levels for plan entries.
*
* Used to indicate the relative importance or urgency of different
* tasks in the execution plan.
* See protocol docs: [Plan Entries](https://agentclientprotocol.com/protocol/v1/draft/agent-plan#plan-entries)
*/
var zPlanEntryPriority = union([
	literal("high"),
	literal("medium"),
	literal("low")
]);
/**
* Status of a plan entry in the execution flow.
*
* Tracks the lifecycle of each task from planning through completion.
* See protocol docs: [Plan Entries](https://agentclientprotocol.com/protocol/v1/draft/agent-plan#plan-entries)
*/
var zPlanEntryStatus = union([
	literal("pending"),
	literal("in_progress"),
	literal("completed")
]);
/**
* A single entry in the execution plan.
*
* Represents a task or goal that the assistant intends to accomplish
* as part of fulfilling the user's request.
* See protocol docs: [Plan Entries](https://agentclientprotocol.com/protocol/v1/draft/agent-plan#plan-entries)
*/
var zPlanEntry = object({
	content: string(),
	priority: zPlanEntryPriority,
	status: zPlanEntryStatus,
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
});
/**
* An execution plan for accomplishing complex tasks.
*
* Plans consist of multiple entries representing individual tasks or goals.
* Agents report plans to clients to provide visibility into their execution strategy.
* Plans can evolve during execution as the agent discovers new requirements or completes tasks.
*
* See protocol docs: [Agent Plan](https://agentclientprotocol.com/protocol/v1/draft/agent-plan)
*/
var zPlan = object({
	entries: requiredDefaultOnError(vecSkipError(zPlanEntry), () => []),
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
});
/**
* **UNSTABLE**
*
* This capability is not part of the spec yet, and may be removed or changed at any point.
*
* Unique identifier for a plan within a session.
*
* @experimental
*/
var zPlanId = string();
/**
* **UNSTABLE**
*
* This capability is not part of the spec yet, and may be removed or changed at any point.
*
* A plan represented as structured entries.
*
* @experimental
*/
var zPlanItems = object({
	planId: zPlanId,
	entries: requiredDefaultOnError(vecSkipError(zPlanEntry), () => []),
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
});
/**
* **UNSTABLE**
*
* This capability is not part of the spec yet, and may be removed or changed at any point.
*
* A plan represented by a file URI.
*
* @experimental
*/
var zPlanFile = object({
	planId: zPlanId,
	uri: string(),
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
});
/**
* **UNSTABLE**
*
* This capability is not part of the spec yet, and may be removed or changed at any point.
*
* A plan represented as raw markdown content.
*
* @experimental
*/
var zPlanMarkdown = object({
	planId: zPlanId,
	content: string(),
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
});
/**
* **UNSTABLE**
*
* This capability is not part of the spec yet, and may be removed or changed at any point.
*
* A content update for a plan identified by ID.
*
* @experimental
*/
var zPlanUpdate = object({
	plan: union([
		zPlanItems.and(object({ type: literal("items") })),
		zPlanFile.and(object({ type: literal("file") })),
		zPlanMarkdown.and(object({ type: literal("markdown") }))
	]),
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
});
/**
* **UNSTABLE**
*
* This capability is not part of the spec yet, and may be removed or changed at any point.
*
* Removal notice for a plan identified by ID.
*
* @experimental
*/
var zPlanRemoved = object({
	planId: zPlanId,
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
});
/**
* unstructured
*
* All text that was typed after the command name is provided as input.
*/
var zAvailableCommandInput = object({
	hint: string(),
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
});
/**
* Available commands are ready or have changed
*/
var zAvailableCommandsUpdate = object({
	availableCommands: requiredDefaultOnError(vecSkipError(object({
		name: string(),
		description: string(),
		input: defaultOnError(zAvailableCommandInput.nullish(), () => void 0),
		_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
	})), () => []),
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
});
/**
* The current mode of the session has changed
*
* See protocol docs: [Session Modes](https://agentclientprotocol.com/protocol/v1/draft/session-modes)
*/
var zCurrentModeUpdate = object({
	currentModeId: zSessionModeId,
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
});
/**
* Session configuration options have been updated.
*/
var zConfigOptionUpdate = object({
	configOptions: requiredDefaultOnError(vecSkipError(zSessionConfigOption), () => []),
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
});
/**
* Update to session metadata. All fields are optional to support partial updates.
*
* Agents send this notification to update session information like title or custom metadata.
* Clients can use it to keep session titles and state current.
*/
var zSessionInfoUpdate = object({
	title: defaultOnError(string().nullish(), () => void 0),
	updatedAt: defaultOnError(string().nullish(), () => void 0),
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
});
/**
* Cost information for a session.
*/
var zCost = object({
	amount: number(),
	currency: string(),
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
});
/**
* Context window and cost update for a session.
*/
var zUsageUpdate = object({
	used: wideInt().gte(0),
	size: wideInt().gte(0),
	cost: defaultOnError(zCost.nullish(), () => void 0),
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
});
/**
* Fire-and-forget information for the user.
*
* Notices are live events rather than session history. Agents must not rely on
* a notice being received, displayed, or seen by the user.
* Agents MUST only send notices when the Client advertised
* the `session.notices` Client capability. Otherwise, Agents may use an agent
* message when the information should still be surfaced to the user.
*
* See RFD: [Session Notices](https://agentclientprotocol.com/rfds/session-notices)
*/
var zNotice = object({
	severity: union([
		literal("info"),
		literal("warning"),
		literal("error"),
		string()
	]),
	title: string().min(1),
	description: defaultOnError(string().nullish(), () => void 0),
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
});
/**
* Unique identifier for a context compaction within a session.
*/
var zCompactionId = string();
/**
* A context compaction upsert. The first notification fixes the compaction's
* timeline position. Later updates with the same ID patch that entity in place.
* Agents MUST only send this update when the Client advertised
* the `session.compaction` Client capability.
*
* `summary`, `error`, and `_meta` have patch semantics: omission leaves the
* stored value unchanged, `null` clears it, and a concrete value replaces it.
* `summary: []` also clears the summary.
*/
var zCompactionUpdate = object({
	compactionId: zCompactionId,
	status: union([
		literal("in_progress"),
		literal("completed"),
		literal("failed"),
		literal("cancelled"),
		string()
	]),
	summary: defaultOnError(vecSkipError(zContentBlock).nullish(), () => void 0),
	error: defaultOnError(string().nullish(), () => void 0),
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
});
/**
* A content block appended to a compaction's summary. A first-seen ID creates
* an in-progress compaction. Chunks append in receive order.
* Agents MUST only send this update when the Client advertised
* the `session.compaction` Client capability.
*/
var zCompactionSummaryChunk = object({
	compactionId: zCompactionId,
	content: zContentBlock,
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
});
/**
* **UNSTABLE**
*
* This capability is not part of the spec yet, and may be removed or changed at any point.
*
* Client-initiated session mutations permitted for a specific subagent session.
*
* A mutation requires an explicit per-child capability. Support for the method
* on ordinary sessions does not grant support on a child.
*
* @experimental
*/
var zSubagentSessionCapabilities = object({
	cancel: defaultOnError(object({ _meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0) }).nullish(), () => void 0),
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
});
/**
* Foreground work is in progress.
*/
var zRunningStateUpdate = object({ _meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0) });
/**
* **UNSTABLE**
*
* This capability is not part of the spec yet, and may be removed or changed at any point.
*
* Details of a failure that ended a child's foreground work.
*
* @experimental
*/
var zErrorStopReason = object({ error: defaultOnError(zError.nullish(), () => void 0) });
/**
* The child is ready to process another prompt.
*
* An omitted, `null`, or malformed `stopReason` means not reported.
*
* Custom variants (unknown `stopReason` values) keep their extra
* properties exactly as received; unlike known variants, those keys
* bypass lenient-field salvage and arrive unvalidated.
*/
var zIdleStateUpdate = defaultOnErrorOptionalStringTag(preserveCustomPayload(intersection(union([
	object({ stopReason: literal("end_turn") }),
	object({ stopReason: literal("max_tokens") }),
	object({ stopReason: literal("max_turn_requests") }),
	object({ stopReason: literal("refusal") }),
	object({ stopReason: literal("cancelled") }),
	zErrorStopReason.and(object({ stopReason: literal("error") })),
	excludeKnownTags(object({ stopReason: string() }), "stopReason", [
		"cancelled",
		"end_turn",
		"error",
		"max_tokens",
		"max_turn_requests",
		"refusal"
	]),
	object({ stopReason: _null().optional() })
]), object({
	usage: defaultOnError(zUsage.nullish(), () => void 0),
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0),
	stopReason: defaultOnError(string().nullish(), () => void 0)
})), "stopReason", [
	"cancelled",
	"end_turn",
	"error",
	"max_tokens",
	"max_turn_requests",
	"refusal"
]), "stopReason");
/**
* Foreground work is blocked on user action.
*/
var zRequiresActionStateUpdate = object({ _meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0) });
/**
* **UNSTABLE**
*
* This capability is not part of the spec yet, and may be removed or changed at any point.
*
* The Agent cannot currently determine foreground activity.
*
* Report this when activity becomes unobservable, not merely because the child
* has been quiet. The Client MUST stop presenting the previous state as confirmed
* current activity, but may retain it as last known. A later state replaces this
* snapshot normally.
*
* This is not a task outcome or session closure. It does not cancel work, resolve
* pending requests, or revoke capabilities. Capabilities are updated separately.
*
* @experimental
*/
var zUnknownStateUpdate = object({ _meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0) });
/**
* **UNSTABLE**
*
* This capability is not part of the spec yet, and may be removed or changed at any point.
*
* Current foreground-work state of a reusable child session.
*
* Each update is a whole-object snapshot. Idle does not terminate the child.
* The parent can message it again, transitioning it back to running.
* Background activity may still emit other session updates while idle.
*
* @experimental
*
* Custom variants (unknown `state` values) keep their extra
* properties exactly as received; unlike known variants, those keys
* bypass lenient-field salvage and arrive unvalidated.
*/
var zStateUpdate = preserveCustomPayload(union([
	zRunningStateUpdate.and(object({ state: literal("running") })),
	zIdleStateUpdate.and(object({ state: literal("idle") })),
	zRequiresActionStateUpdate.and(object({ state: literal("requires_action") })),
	zUnknownStateUpdate.and(object({ state: literal("unknown") })),
	excludeKnownTags(object({ state: string() }), "state", [
		"idle",
		"requires_action",
		"running",
		"unknown"
	])
]), "state", [
	"idle",
	"requires_action",
	"running",
	"unknown"
]);
/**
* **UNSTABLE**
*
* This capability is not part of the spec yet, and may be removed or changed at any point.
*
* Notification that the enclosing parent session created and owns a child session.
*
* Later updates modify the existing association's metadata, not its ownership.
*
* Sent on the immediate parent session. The first update for an unknown
* `sessionId` announces the child and MUST be sent
* before any live child traffic or live message naming the child as sender
* or recipient. Parents may message and reuse an announced child across
* multiple operations.
* Child events are delivered automatically on the same connection. No child
* load, resume, or subscription is needed.
*
* Only the subagent session ID is required. Omitted patch fields keep their
* previous values. `null` clears them. Clearing capabilities disables child
* mutations. Clearing state leaves current activity unset/unconfirmed: it does
* not imply idle, stop work, or create an `unknown` state snapshot. A concrete
* state replaces the entire previous state object, not the session.
* The title and description provide the parent's display metadata for the
* child. They do not replace the content of individual messages or operations.
* `cwd` and `additionalDirectories` report where the Agent placed the child.
* While unset, each inherits the immediate parent's effective value.
*
* @experimental
*/
var zSubagentUpdate = object({
	sessionId: zSessionId,
	title: defaultOnError(string().nullish(), () => void 0),
	description: defaultOnError(string().nullish(), () => void 0),
	capabilities: defaultOnError(zSubagentSessionCapabilities.nullish(), () => void 0),
	state: defaultOnError(zStateUpdate.nullish(), () => void 0),
	cwd: string().nullish(),
	additionalDirectories: array(string()).nullish(),
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
});
/**
* **UNSTABLE**
*
* This capability is not part of the spec yet, and may be removed or changed at any point.
*
* An upsert for an inter-session message.
*
* @experimental
*/
var zSessionMessage = object({
	messageId: zMessageId,
	senderSessionId: defaultOnError(zSessionId.nullish(), () => void 0),
	recipientSessionId: defaultOnError(zSessionId.nullish(), () => void 0),
	senderMessageId: defaultOnError(zMessageId.nullish(), () => void 0),
	recipientMessageId: defaultOnError(zMessageId.nullish(), () => void 0),
	content: defaultOnError(vecSkipError(zContentBlock).nullish(), () => void 0),
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
});
/**
* **UNSTABLE**
*
* This capability is not part of the spec yet, and may be removed or changed at any point.
*
* A streamed content block of an inter-session message.
*
* A chunk carries only content. The message's participants and references come from
* `session_message` upserts, which can arrive before, between, or after its chunks.
*
* @experimental
*/
var zSessionMessageChunk = object({
	messageId: zMessageId,
	content: zContentBlock,
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
});
/**
* Notification containing a session update from the agent.
*
* Used to stream real-time progress and results during prompt processing.
*
* See protocol docs: [Agent Reports Output](https://agentclientprotocol.com/protocol/v1/draft/prompt-turn#3-agent-reports-output)
*/
var zSessionNotification = object({
	sessionId: zSessionId,
	update: union([
		zContentChunk.and(object({ sessionUpdate: literal("user_message_chunk") })),
		zContentChunk.and(object({ sessionUpdate: literal("agent_message_chunk") })),
		zContentChunk.and(object({ sessionUpdate: literal("agent_thought_chunk") })),
		zToolCall.and(object({ sessionUpdate: literal("tool_call") })),
		zToolCallUpdate.and(object({ sessionUpdate: literal("tool_call_update") })),
		zPlan.and(object({ sessionUpdate: literal("plan") })),
		zPlanUpdate.and(object({ sessionUpdate: literal("plan_update") })),
		zPlanRemoved.and(object({ sessionUpdate: literal("plan_removed") })),
		zAvailableCommandsUpdate.and(object({ sessionUpdate: literal("available_commands_update") })),
		zCurrentModeUpdate.and(object({ sessionUpdate: literal("current_mode_update") })),
		zConfigOptionUpdate.and(object({ sessionUpdate: literal("config_option_update") })),
		zSessionInfoUpdate.and(object({ sessionUpdate: literal("session_info_update") })),
		zUsageUpdate.and(object({ sessionUpdate: literal("usage_update") })),
		zNotice.and(object({ sessionUpdate: literal("notice") })),
		zCompactionUpdate.and(object({ sessionUpdate: literal("compaction_update") })),
		zCompactionSummaryChunk.and(object({ sessionUpdate: literal("compaction_summary_chunk") })),
		zSubagentUpdate.and(object({ sessionUpdate: literal("subagent_update") })),
		zSessionMessage.and(object({ sessionUpdate: literal("session_message") })),
		zSessionMessageChunk.and(object({ sessionUpdate: literal("session_message_chunk") }))
	]),
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
});
/**
* Notification sent by the agent when a URL-based elicitation is complete.
*/
var zCompleteElicitationNotification = object({
	elicitationId: zElicitationId,
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
});
/**
* **UNSTABLE**
*
* This capability is not part of the spec yet, and may be removed or changed at any point.
*
* Notification sent by the agent when its authentication status changes.
*
* Carries the same fields as the `auth/status` response. Agents that advertise the
* `auth.status` capability MAY send it at any time after `initialize`, and SHOULD only
* send it when the reported status differs from the last one sent on the connection.
*
* @experimental
*/
var zAuthStatusUpdateNotification = object({
	state: zAuthState,
	accounts: defaultOnError(vecSkipError(zAuthAccount).optional(), () => []),
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
});
/**
* Allows either side to send an arbitrary notification that is not part of the ACP spec.
* Extension notifications provide a way to send one-way messages for custom functionality
* while maintaining protocol compatibility.
*
* See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/v1/draft/extensibility)
*/
var zExtNotification = unknown();
object({
	method: string(),
	params: union([
		zSessionNotification,
		zCompleteElicitationNotification,
		zAuthStatusUpdateNotification,
		zExtNotification
	]).nullish()
});
/**
* File system capabilities that a client may support.
*
* See protocol docs: [FileSystem](https://agentclientprotocol.com/protocol/v1/draft/initialization#filesystem)
*/
var zFileSystemCapabilities = object({
	readTextFile: defaultOnError(boolean().optional().default(false), () => false),
	writeTextFile: defaultOnError(boolean().optional().default(false), () => false),
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
});
/**
* Client support for ID-addressed context compaction updates.
*/
var zCompactionCapabilities = record(string(), unknown());
/**
* Session configuration option capabilities supported by the client.
*/
var zSessionConfigOptionsCapabilities = object({
	boolean: defaultOnError(object({ _meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0) }).nullish(), () => void 0),
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
});
/**
* Client support for presenting live notices to the user.
*/
var zNoticeCapabilities = record(string(), unknown());
/**
* Session-related capabilities supported by the client.
*/
var zClientSessionCapabilities = object({
	compaction: defaultOnError(zCompactionCapabilities.nullish(), () => void 0),
	configOptions: defaultOnError(zSessionConfigOptionsCapabilities.nullish(), () => void 0),
	notices: defaultOnError(zNoticeCapabilities.nullish(), () => void 0),
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
});
/**
* **UNSTABLE**
*
* This capability is not part of the spec yet, and may be removed or changed at any point.
*
* Capability marker for exposing reusable child sessions as restricted ACP sessions.
*
* Supplying `{}` advertises support for child association and state updates,
* session-directed messages, and restricted-session semantics. The client
* must advertise this capability before the agent sends subagent updates or
* session-directed messages.
*
* @experimental
*/
var zSubagentCapabilities = object({ _meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0) });
/**
* **UNSTABLE**
*
* This capability is not part of the spec yet, and may be removed or changed at any point.
*
* Capabilities for receiving `plan_update` and `plan_removed` session updates.
*
* @experimental
*/
var zPlanCapabilities = object({ _meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0) });
/**
* Authentication capabilities supported by the client.
*
* Advertised during initialization to inform the agent which authentication
* method types the client can handle. This governs opt-in types that require
* additional client-side support.
*/
var zAuthCapabilities = object({
	terminal: defaultOnError(boolean().optional().default(false), () => false),
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
});
/**
* Form-based elicitation capabilities.
*
* Supplying `{}` means the client supports form-based elicitation.
*/
var zElicitationFormCapabilities = object({ _meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0) });
/**
* URL-based elicitation capabilities.
*
* Supplying `{}` means the client supports URL-based elicitation.
*/
var zElicitationUrlCapabilities = object({ _meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0) });
/**
* Elicitation capabilities supported by the client.
*/
var zElicitationCapabilities = object({
	form: defaultOnError(zElicitationFormCapabilities.nullish(), () => void 0),
	url: defaultOnError(zElicitationUrlCapabilities.nullish(), () => void 0),
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
});
/**
* Request parameters for the initialize method.
*
* Sent by the client to establish connection and negotiate capabilities.
*
* See protocol docs: [Initialization](https://agentclientprotocol.com/protocol/v1/draft/initialization)
*/
var zInitializeRequest = object({
	protocolVersion: zProtocolVersion,
	clientCapabilities: defaultOnError(object({
		fs: defaultOnError(zFileSystemCapabilities.optional().default({
			readTextFile: false,
			writeTextFile: false
		}), () => ({
			readTextFile: false,
			writeTextFile: false
		})),
		terminal: defaultOnError(boolean().optional().default(false), () => false),
		session: defaultOnError(zClientSessionCapabilities.nullish(), () => void 0),
		subagents: defaultOnError(zSubagentCapabilities.nullish(), () => void 0),
		plan: defaultOnError(zPlanCapabilities.nullish(), () => void 0),
		auth: defaultOnError(zAuthCapabilities.optional().default({ terminal: false }), () => ({ terminal: false })),
		elicitation: defaultOnError(zElicitationCapabilities.nullish(), () => void 0),
		_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
	}).optional().default({
		fs: {
			readTextFile: false,
			writeTextFile: false
		},
		terminal: false,
		auth: { terminal: false }
	}), () => ({
		fs: {
			readTextFile: false,
			writeTextFile: false
		},
		terminal: false,
		auth: { terminal: false }
	})),
	clientInfo: defaultOnError(zImplementation.nullish(), () => void 0),
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
});
/**
* Request parameters for the authenticate method.
*
* Specifies which authentication method to use.
*/
var zAuthenticateRequest = object({
	methodId: zAuthMethodId,
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
});
/**
* **UNSTABLE**
*
* This capability is not part of the spec yet, and may be removed or changed at any point.
*
* Request parameters for `providers/list`.
*
* @experimental
*/
var zListProvidersRequest = object({ _meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0) });
/**
* **UNSTABLE**
*
* This capability is not part of the spec yet, and may be removed or changed at any point.
*
* Request parameters for `providers/set`.
*
* Replaces the full configuration for one provider ID.
*
* @experimental
*/
var zSetProviderRequest = object({
	providerId: zProviderId,
	apiType: zLlmProtocol,
	baseUrl: string(),
	headers: record(string(), string()).optional(),
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
});
/**
* **UNSTABLE**
*
* This capability is not part of the spec yet, and may be removed or changed at any point.
*
* Request parameters for `providers/disable`.
*
* @experimental
*/
var zDisableProviderRequest = object({
	providerId: zProviderId,
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
});
/**
* Request parameters for the logout method.
*
* Terminates the current authenticated session.
*/
var zLogoutRequest = object({ _meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0) });
/**
* **UNSTABLE**
*
* This capability is not part of the spec yet, and may be removed or changed at any point.
*
* Request parameters for the `auth/status` method.
*
* Queries the agent's current authentication state without changing it.
*
* Agents MUST NOT reject it with `auth_required` (`-32000`), since Clients call it to learn
* whether authentication is required.
*
* @experimental
*/
var zAuthStatusRequest = object({ _meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0) });
/**
* An HTTP header to set when making requests to the MCP server.
*/
var zHttpHeader = object({
	name: string(),
	value: string(),
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
});
/**
* HTTP transport configuration for MCP.
*/
var zMcpServerHttp = object({
	name: string(),
	url: string(),
	headers: defaultOnNull(array(zHttpHeader), () => []),
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
});
/**
* SSE transport configuration for MCP.
*/
var zMcpServerSse = object({
	name: string(),
	url: string(),
	headers: defaultOnNull(array(zHttpHeader), () => []),
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
});
/**
* **UNSTABLE**
*
* This capability is not part of the spec yet, and may be removed or changed at any point.
*
* ACP transport configuration for MCP.
*
* The MCP server is provided by an ACP component and communicates over the ACP channel
* using `mcp/message`.
*
* @experimental
*/
var zMcpServerAcp = object({
	name: string(),
	serverId: zMcpServerAcpId,
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
});
/**
* Stdio transport configuration for MCP.
*/
var zMcpServerStdio = object({
	name: string(),
	command: string(),
	args: defaultOnNull(array(string()), () => []),
	env: defaultOnNull(array(zEnvVariable), () => []),
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
});
/**
* Configuration for connecting to an MCP (Model Context Protocol) server.
*
* MCP servers provide tools and context that the agent can use when
* processing prompts.
*
* See protocol docs: [MCP Servers](https://agentclientprotocol.com/protocol/v1/draft/session-setup#mcp-servers)
*/
var zMcpServer = union([
	zMcpServerHttp.and(object({ type: literal("http") })),
	zMcpServerSse.and(object({ type: literal("sse") })),
	zMcpServerAcp.and(object({ type: literal("acp") })),
	zMcpServerStdio
]);
/**
* Client-provided system-level instructions for a session.
*
* Clients MUST only send this when the Agent advertises
* `sessionCapabilities.systemPrompt`. Agents that cannot apply it, for example
* because of an unadvertised mode or an unsupported content block type, MUST
* return an error instead of creating, loading, or resuming the session.
*/
var zSystemPrompt = object({
	mode: union([
		literal("append"),
		literal("override"),
		string()
	]),
	content: array(zContentBlock),
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
});
/**
* **UNSTABLE**
*
* This capability is not part of the spec yet, and may be removed or changed at any point.
*
* An initial value for a config option, sent on session setup requests.
*
* Same shape as `session/set_config_option` without `sessionId`. Unlike
* `session/set_config_option`, an unknown `configId`, a `type` that does not match the
* option, or a value that is not allowed is ignored instead of rejected.
*
* Clients only send `type: "boolean"` entries when they advertise
* `sessionCapabilities.configOptions.boolean`.
*
* @experimental
*/
var zInitialSessionConfigOption = intersection(union([object({
	type: literal("boolean"),
	value: boolean()
}), object({ value: zSessionConfigValueId })]), object({
	configId: zSessionConfigId,
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
}));
/**
* Request parameters for creating a new session.
*
* See protocol docs: [Creating a Session](https://agentclientprotocol.com/protocol/v1/draft/session-setup#creating-a-session)
*/
var zNewSessionRequest = object({
	cwd: string(),
	additionalDirectories: defaultOnNull(array(string()), () => []).optional(),
	mcpServers: defaultOnNull(array(zMcpServer), () => []),
	systemPrompt: zSystemPrompt.nullish(),
	configOptions: defaultOnNull(array(zInitialSessionConfigOption), () => []).optional(),
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
});
/**
* Request parameters for loading an existing session.
*
* Only available if the Agent supports the `loadSession` capability.
*
* See protocol docs: [Loading Sessions](https://agentclientprotocol.com/protocol/v1/draft/session-setup#loading-sessions)
*/
var zLoadSessionRequest = object({
	mcpServers: defaultOnNull(array(zMcpServer), () => []),
	cwd: string(),
	additionalDirectories: defaultOnNull(array(string()), () => []).optional(),
	sessionId: zSessionId,
	systemPrompt: zSystemPrompt.nullish(),
	configOptions: defaultOnNull(array(zInitialSessionConfigOption), () => []).optional(),
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
});
/**
* **UNSTABLE**
*
* This capability is not part of the spec yet, and may be removed or changed at any point.
*
* Which sessions `session/list` returns based on their archive state.
*
* Unknown values are preserved so they can be stored, proxied, or forwarded. An Agent MUST
* return `-32602` for a value it does not support rather than treating it as `exclude`.
*
* @experimental
*/
var zSessionArchiveFilter = union([
	literal("exclude"),
	literal("include"),
	literal("only"),
	string()
]);
/**
* Request parameters for listing existing sessions.
*
* Only available if the Agent supports the `sessionCapabilities.list` capability.
*/
var zListSessionsRequest = object({
	cwd: string().nullish(),
	cursor: string().nullish(),
	archived: zSessionArchiveFilter.nullish(),
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
});
/**
* Request parameters for deleting an existing session from `session/list`.
*
* Only available if the Agent supports the `sessionCapabilities.delete` capability.
*/
var zDeleteSessionRequest = object({
	sessionId: zSessionId,
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
});
/**
* **UNSTABLE**
*
* This capability is not part of the spec yet, and may be removed or changed at any point.
*
* Request parameters for forking an existing session.
*
* Creates a new session based on the context of an existing one, allowing
* operations like generating summaries without affecting the original session's history.
*
* Only available if the Agent supports the `session.fork` capability.
*
* @experimental
*/
var zForkSessionRequest = object({
	sessionId: zSessionId,
	cwd: string(),
	additionalDirectories: defaultOnNull(array(string()), () => []).optional(),
	mcpServers: defaultOnNull(array(zMcpServer), () => []).optional(),
	systemPrompt: zSystemPrompt.nullish(),
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
});
/**
* **UNSTABLE**
*
* This capability is not part of the spec yet, and may be removed or changed at any point.
*
* Request parameters for archiving a session.
*
* Only available if the Agent supports the `sessionCapabilities.archive` capability.
*
* Archiving hides the session from default `session/list` results. It keeps the session ID
* and saved history. If the session is active, the Agent MUST cancel any ongoing work and
* free the session's resources as if `session/close` had been called, then archive it.
* Archiving an archived session succeeds. A session that does not exist gets `-32002`.
*
* @experimental
*/
var zArchiveSessionRequest = object({
	sessionId: zSessionId,
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
});
/**
* **UNSTABLE**
*
* This capability is not part of the spec yet, and may be removed or changed at any point.
*
* Request parameters for unarchiving a session.
*
* Only available if the Agent supports the `sessionCapabilities.archive` capability.
*
* Unarchiving returns the session to default `session/list` results with the same ID and
* saved history. It never loads or resumes the session. Clients that want to continue an
* archived session SHOULD unarchive it before calling `session/load` or `session/resume`.
* Unarchiving a session that is not archived succeeds. A session that does not exist
* gets `-32002`.
*
* @experimental
*/
var zUnarchiveSessionRequest = object({
	sessionId: zSessionId,
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
});
/**
* **UNSTABLE**
*
* This capability is not part of the spec yet, and may be removed or changed at any point.
*
* Request parameters for checking the status of a session.
*
* Only available if the Agent supports the `sessionCapabilities.status` capability.
*
* `session/status` MUST NOT have side effects. The Agent does not load, resume, create,
* close, or change the session, and does not attach the requesting connection to it.
* A session the Agent does not know gets `-32002` with the requested `sessionId` in `data`.
*
* @experimental
*/
var zSessionStatusRequest = object({
	sessionId: zSessionId,
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
});
/**
* **UNSTABLE**
*
* This capability is not part of the spec yet, and may be removed or changed at any point.
*
* Request parameters for `session/options`, which returns the config options a session
* would start with, without creating or resuming a session.
*
* Only available if the Agent supports the `sessionCapabilities.options` capability.
*
* `session/options` MUST NOT create or resume a session, send `session/update`
* notifications, add an entry to `session/list`, or change an existing session. Agents
* SHOULD NOT connect to MCP servers to answer it.
*
* @experimental
*/
var zSessionOptionsRequest = object({
	cwd: string(),
	additionalDirectories: defaultOnNull(array(string()), () => []).optional(),
	sessionId: zSessionId.nullish(),
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
});
/**
* **UNSTABLE**
*
* This capability is not part of the spec yet, and may be removed or changed at any point.
*
* Request parameters for setting the title of a session.
*
* Only available if the Agent supports the `sessionCapabilities.title` capability.
*
* The session does not need to be active on the connection. Any session the Agent would
* return from `session/list` can be retitled. A session that does not exist gets `-32002`.
*
* The Agent responds only after it has stored the title. After a successful response, the
* Agent SHOULD NOT replace the title with one it generates automatically.
*
* @experimental
*/
var zSetSessionTitleRequest = object({
	sessionId: zSessionId,
	title: string(),
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
});
/**
* Request parameters for resuming an existing session.
*
* Resumes an existing session without returning previous messages (unlike `session/load`).
* This is useful for agents that can resume sessions but don't implement full session loading.
*
* Only available if the Agent supports the `sessionCapabilities.resume` capability.
*/
var zResumeSessionRequest = object({
	sessionId: zSessionId,
	cwd: string(),
	additionalDirectories: defaultOnNull(array(string()), () => []).optional(),
	mcpServers: defaultOnNull(array(zMcpServer), () => []).optional(),
	systemPrompt: zSystemPrompt.nullish(),
	configOptions: defaultOnNull(array(zInitialSessionConfigOption), () => []).optional(),
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
});
/**
* Request parameters for closing an active session.
*
* If supported, the agent **must** cancel any ongoing work related to the session
* (treat it as if `session/cancel` was called) and then free up any resources
* associated with the session.
*
* Only available if the Agent supports the `sessionCapabilities.close` capability.
*/
var zCloseSessionRequest = object({
	sessionId: zSessionId,
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
});
/**
* Request parameters for setting a session mode.
*/
var zSetSessionModeRequest = object({
	sessionId: zSessionId,
	modeId: zSessionModeId,
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
});
/**
* Request parameters for setting a session configuration option.
*/
var zSetSessionConfigOptionRequest = intersection(union([object({
	type: literal("boolean"),
	value: boolean()
}), object({ value: zSessionConfigValueId })]), object({
	sessionId: zSessionId,
	configId: zSessionConfigId,
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
}));
/**
* Request parameters for sending a user prompt to the agent.
*
* Contains the user's message and any additional context.
*
* See protocol docs: [User Message](https://agentclientprotocol.com/protocol/v1/draft/prompt-turn#1-user-message)
*/
var zPromptRequest = object({
	sessionId: zSessionId,
	prompt: array(zContentBlock),
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
});
object({
	id: zRequestId,
	method: string(),
	params: union([
		zInitializeRequest,
		zAuthenticateRequest,
		zListProvidersRequest,
		zSetProviderRequest,
		zDisableProviderRequest,
		zLogoutRequest,
		zAuthStatusRequest,
		zNewSessionRequest,
		zLoadSessionRequest,
		zListSessionsRequest,
		zDeleteSessionRequest,
		zForkSessionRequest,
		zArchiveSessionRequest,
		zUnarchiveSessionRequest,
		zSessionStatusRequest,
		zSessionOptionsRequest,
		zSetSessionTitleRequest,
		zResumeSessionRequest,
		zCloseSessionRequest,
		zSetSessionModeRequest,
		zSetSessionConfigOptionRequest,
		zPromptRequest,
		zExtRequest
	]).nullish()
});
/**
* Response to `fs/write_text_file`
*/
var zWriteTextFileResponse = object({ _meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0) });
/**
* Response containing the contents of a text file.
*/
var zReadTextFileResponse = object({
	content: string(),
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
});
/**
* The user selected one of the provided options.
*/
var zSelectedPermissionOutcome = object({
	optionId: zPermissionOptionId,
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
});
/**
* Response to a permission request.
*/
var zRequestPermissionResponse = object({
	outcome: union([object({ outcome: literal("cancelled") }), zSelectedPermissionOutcome.and(object({ outcome: literal("selected") }))]),
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
});
/**
* Response containing the ID of the created terminal.
*/
var zCreateTerminalResponse = object({
	terminalId: zTerminalId,
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
});
/**
* Exit status of a terminal command.
*/
var zTerminalExitStatus = object({
	exitCode: defaultOnError(int().gte(0).max(4294967295, { error: "Invalid value: Expected uint32 to be <= 4294967295" }).nullish(), () => void 0),
	signal: defaultOnError(string().nullish(), () => void 0),
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
});
/**
* Response containing the terminal output and exit status.
*/
var zTerminalOutputResponse = object({
	output: string(),
	truncated: boolean(),
	exitStatus: defaultOnError(zTerminalExitStatus.nullish(), () => void 0),
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
});
/**
* Response to terminal/release method
*/
var zReleaseTerminalResponse = object({ _meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0) });
/**
* Response containing the exit status of a terminal command.
*/
var zWaitForTerminalExitResponse = object({
	exitCode: defaultOnError(int().gte(0).max(4294967295, { error: "Invalid value: Expected uint32 to be <= 4294967295" }).nullish(), () => void 0),
	signal: defaultOnError(string().nullish(), () => void 0),
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
});
/**
* Response to `terminal/kill` method
*/
var zKillTerminalResponse = object({ _meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0) });
/**
* Allowed wire representations for `ElicitationContentValue`.
*/
var zElicitationContentValue = union([
	string(),
	wideInt(),
	number(),
	boolean(),
	array(string())
]);
/**
* The user accepted the elicitation and provided content.
*/
var zElicitationAcceptAction = object({ content: record(string(), zElicitationContentValue).nullish() });
/**
* Response from the client to an elicitation request.
*
* Custom variants (unknown `action` values) keep their extra
* properties exactly as received; unlike known variants, those keys
* bypass lenient-field salvage and arrive unvalidated.
*/
var zCreateElicitationResponse = preserveCustomPayload(intersection(union([
	zElicitationAcceptAction.and(object({ action: literal("accept") })),
	object({ action: literal("decline") }),
	object({ action: literal("cancel") }),
	excludeKnownTags(object({ action: string() }), "action", [
		"accept",
		"cancel",
		"decline"
	])
]), object({ _meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0) })), "action", [
	"accept",
	"cancel",
	"decline"
]);
/**
* **UNSTABLE**
*
* An inner MCP error, distinct from an outer ACP binding or runtime error.
*
* `code` and `message` are required and non-null. `data` is optional.
* Explicit `null` is preserved separately from an omitted key.
*
* @experimental
*/
var zMcpError = looseObject({
	code: int().min(-2147483648, { error: "Invalid value: Expected int32 to be >= -2147483648" }).max(2147483647, { error: "Invalid value: Expected int32 to be <= 2147483647" }),
	message: string(),
	data: unknown().optional()
});
union([object({
	id: zRequestId,
	result: union([
		zWriteTextFileResponse,
		zReadTextFileResponse,
		zRequestPermissionResponse,
		zCreateTerminalResponse,
		zTerminalOutputResponse,
		zReleaseTerminalResponse,
		zWaitForTerminalExitResponse,
		zKillTerminalResponse,
		zCreateElicitationResponse,
		union([object({
			result: unknown(),
			_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
		}), object({
			error: zMcpError,
			_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
		})]),
		zExtResponse
	])
}), object({
	id: zRequestId,
	error: zError
})]);
/**
* Notification to cancel ongoing operations for a session.
*
* See protocol docs: [Cancellation](https://agentclientprotocol.com/protocol/v1/draft/prompt-turn#cancellation)
*/
var zCancelNotification = object({
	sessionId: zSessionId,
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
});
/**
* **UNSTABLE**
*
* This capability is not part of the spec yet, and may be removed or changed at any point.
*
* Notification parameters for `mcp/message`.
*
* Sent by the provider to the consumer for an active request (including
* subscription acknowledgements and updates). The outer envelope has no `id`.
*
* @experimental
*/
var zMessageMcpNotification = object({
	serverId: zMcpServerAcpId,
	requestId: zMcpRequestId,
	method: string(),
	params: record(string(), unknown()).nullish(),
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
});
object({
	method: string(),
	params: union([
		zCancelNotification,
		zMessageMcpNotification,
		zExtNotification
	]).nullish()
});
object({
	requestId: zRequestId,
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
});
/**
* **UNSTABLE**
*
* This capability is not part of the spec yet, and may be removed or changed at any point.
*
* Request parameters for `proxy/initialize`.
*
* A conductor sends `proxy/initialize` instead of `initialize` to every component that has a
* successor, which tells the component to run as a proxy. The params and the response are
* the same as for `initialize`. A conductor sends `initialize` to the final agent.
*
* The params carry the protocol version the conductor selected: the client's requested
* version, unless the conductor supports only a lower one. Before answering successfully,
* the proxy MUST forward an `initialize` request to its successor through `proxy/successor`.
*
* See the [Proxy Chains RFD](https://agentclientprotocol.com/rfds/proxy-chains).
*
* @experimental
*/
var zInitializeProxyRequest = zInitializeRequest;
/**
* **UNSTABLE**
*
* This capability is not part of the spec yet, and may be removed or changed at any point.
*
* Parameters of a `proxy/successor` request.
*
* A proxy sends it to forward a message to its successor, and the conductor sends it to
* deliver a message from the successor to the proxy. The envelope wraps one request: `method`
* and `params` are the wrapped request's method and params.
*
* The result or error of the wrapped request is returned unchanged, as the same JSON value,
* as the result or error of the `proxy/successor` request. Errors the conductor returns
* itself, for example because the successor has exited, are not wrapped results.
*
* To cancel it, the sender sends `$/cancel_request` with the ID of this `proxy/successor`
* request on the same connection. Cancellation is never forwarded to another hop.
*
* See the [Proxy Chains RFD](https://agentclientprotocol.com/rfds/proxy-chains).
*
* @experimental
*/
var zProxySuccessorRequest = object({
	method: string(),
	params: unknown().optional(),
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
});
object({
	id: zRequestId,
	method: string(),
	params: union([zInitializeProxyRequest, zProxySuccessorRequest]).nullish()
});
union([object({
	id: zRequestId,
	result: union([zInitializeResponse, unknown()])
}), object({
	id: zRequestId,
	error: zError
})]);
/**
* **UNSTABLE**
*
* This capability is not part of the spec yet, and may be removed or changed at any point.
*
* Parameters of a `proxy/successor` notification.
*
* A proxy sends it to forward a message to its successor, and the conductor sends it to
* deliver a message from the successor to the proxy. The envelope wraps one notification: `method`
* and `params` are the wrapped notification's method and params.
*
* See the [Proxy Chains RFD](https://agentclientprotocol.com/rfds/proxy-chains).
*
* @experimental
*/
var zProxySuccessorNotification = object({
	method: string(),
	params: unknown().optional(),
	_meta: defaultOnError(record(string(), unknown()).nullish(), () => void 0)
});
object({
	method: string(),
	params: zProxySuccessorNotification.nullish()
});
// ../code-for-antigravity/node_modules/@agentclientprotocol/sdk/dist/core/jsonrpc.js
var CANCEL_REQUEST_METHOD = "$/cancel_request";
/**
* Treats a `-32002` (Resource not found) response to `session/close` or
* `session/delete` as success, as ACP recommends: closing or deleting a
* session that does not exist or is not active leaves the same end state.
*
* @internal
*/
function treatSessionNotFoundAsSuccess(method, response, success) {
	if (method !== "session/close" && method !== "session/delete") return response;
	return response.catch((error) => {
		if (error instanceof RequestError && error.code === -32002) return success();
		throw error;
	});
}
function isRequestMessage(value) {
	return isJsonRpcEnvelope(value) && "id" in value && typeof value["method"] === "string" && isJsonRpcId(value["id"]);
}
function isResponseMessage(value) {
	if (!isJsonRpcEnvelope(value) || "method" in value) return false;
	if (!("id" in value) || !isJsonRpcId(value["id"])) return false;
	const hasResult = Object.hasOwn(value, "result");
	const hasError = Object.hasOwn(value, "error");
	if (hasResult === hasError) return false;
	return !hasError || isErrorResponse(value["error"]);
}
function isNotificationMessage(value) {
	return isJsonRpcEnvelope(value) && !("id" in value) && typeof value["method"] === "string";
}
function isRecord(value) {
	return typeof value === "object" && value !== null;
}
function isJsonRpcEnvelope(value) {
	return isRecord(value) && value["jsonrpc"] === "2.0";
}
function isJsonRpcId(value) {
	return value === null || typeof value === "string" || typeof value === "number" && Number.isFinite(value);
}
/**
* Detects response-shaped objects, including malformed responses, so they are
* never handled as calls that require a JSON-RPC response.
*
* @internal
*/
function isResponseShapedMessage(value) {
	return isRecord(value) && !("method" in value) && ("id" in value || "result" in value || "error" in value);
}
function cancelRequestId(params) {
	if (!isRecord(params) || !isJsonRpcId(params["requestId"])) return;
	return params["requestId"];
}
function isErrorResponse(value) {
	return isRecord(value) && typeof value["code"] === "number" && Number.isInteger(value["code"]) && typeof value["message"] === "string";
}
/**
* Helpers for constructing `HandleResult` values.
*/
var Handled = {
	/**
	* Marks a message as handled.
	*/
	yes() {
		return { handled: true };
	},
	/**
	* Leaves a message unhandled so later handlers can process it.
	*/
	no(message, retry = false) {
		return {
			handled: false,
			message,
			retry
		};
	}
};
function rejectedPromise(error) {
	const promise = Promise.reject(error);
	promise.catch(() => {});
	return promise;
}
function errorDetails(error) {
	if (error instanceof Error) return error.message;
	if (typeof error === "object" && error != null && "message" in error && typeof error.message === "string") return error.message;
}
function isZodError(error) {
	return typeof error === "object" && error !== null && "name" in error && error.name === "ZodError" && "issues" in error && Array.isArray(error.issues) && "format" in error && typeof error.format === "function";
}
/**
* Describe a message that is not valid JSON-RPC without echoing its values.
*
* Messages can carry credentials, such as MCP server `env` and `headers`
* values in `session/new`, so console output names only the value's type and
* top-level keys.
*/
function describeInvalidMessage(message) {
	if (Array.isArray(message)) return { type: "array" };
	if (isRecord(message)) return {
		type: "object",
		keys: Object.keys(message)
	};
	return { type: message === null ? "null" : typeof message };
}
function errorToResult(error) {
	if (error instanceof RequestError) return error.toResult();
	if (isZodError(error)) return RequestError.invalidParams(error.format()).toResult();
	const details = errorDetails(error);
	try {
		return RequestError.internalError(details ? JSON.parse(details) : {}).toResult();
	} catch {
		return RequestError.internalError({ details }).toResult();
	}
}
function requestCancelledError(reason) {
	if (reason instanceof RequestError && reason.code === -32800) return reason;
	return RequestError.requestCancelled(reason);
}
function errorToRequestResult(error, signal) {
	const requestCancelled = abortErrorToRequestCancelled(error, signal);
	return requestCancelled ? requestCancelled.toResult() : errorToResult(error);
}
function abortErrorToRequestCancelled(error, signal) {
	if (!signal.aborted || !isAbortError(error)) return;
	return requestCancelledError(signal.reason);
}
function isAbortError(error) {
	if (typeof error !== "object" || error === null) return false;
	const maybeAbortError = error;
	return maybeAbortError.name === "AbortError" || maybeAbortError.code === "ABORT_ERR";
}
/**
* Responder for one incoming JSON-RPC request.
*
* Handlers may use this when they need to decide exactly when or how the
* response is sent.
*/
var RequestResponder = class {
	id;
	sendResult;
	signal;
	finishRequest;
	didRespond = false;
	constructor(id, sendResult, signal = new AbortController().signal, finishRequest) {
		this.id = id;
		this.sendResult = sendResult;
		this.signal = signal;
		this.finishRequest = finishRequest;
	}
	/**
	* Whether this request has already received a response.
	*/
	get responded() {
		return this.didRespond;
	}
	/**
	* Sends a successful JSON-RPC response.
	*/
	respond(response) {
		return this.respondWithResult({ result: response ?? null });
	}
	/**
	* Sends an error JSON-RPC response.
	*/
	respondWithError(error) {
		const errorResponse = error instanceof RequestError ? error.toErrorResponse() : error;
		return this.respondWithResult({ error: errorResponse });
	}
	/**
	* Sends a complete JSON-RPC result payload.
	*/
	respondWithResult(result) {
		if (this.didRespond) return rejectedPromise(/* @__PURE__ */ new Error("JSON-RPC request already responded"));
		this.didRespond = true;
		return this.sendResult(result).finally(() => {
			this.finishRequest?.();
		});
	}
};
var nullIdResponders = /* @__PURE__ */ new WeakSet();
/**
* Disposable handle returned when a handler is registered dynamically.
*/
var HandlerRegistration = class {
	disposeHandler;
	active = true;
	constructor(disposeHandler) {
		this.disposeHandler = disposeHandler;
	}
	/**
	* Unregisters the associated handler.
	*/
	dispose() {
		if (!this.active) return;
		this.active = false;
		this.disposeHandler();
	}
	/**
	* Supports explicit resource management with `using`.
	*/
	[Symbol.dispose]() {
		this.dispose();
	}
	/**
	* Returns this registration for call sites that intentionally keep it active.
	*/
	runIndefinitely() {
		return this;
	}
};
/**
* Per-connection context passed to low-level JSON-RPC handlers.
*/
var ConnectionContext = class {
	connection;
	constructor(connection) {
		this.connection = connection;
	}
	/**
	* Sends a request over the connection.
	*/
	sendRequest(method, params, mapResponse, options) {
		return this.connection.sendRequest(method, params, mapResponse, options);
	}
	/**
	* Sends a notification over the connection.
	*/
	sendNotification(method, params) {
		return this.connection.sendNotification(method, params);
	}
	/**
	* Sends a protocol-level request cancellation notification.
	*/
	sendCancelRequest(requestId) {
		return this.connection.sendCancelRequest(requestId);
	}
	/**
	* Registers a handler that can be disposed independently.
	*/
	addDynamicHandler(handler) {
		return this.connection.addDynamicHandler(handler);
	}
	/**
	* AbortSignal that aborts when the connection closes.
	*/
	get signal() {
		return this.connection.signal;
	}
	/**
	* Promise that resolves when the connection closes.
	*/
	get closed() {
		return this.connection.closed;
	}
};
/**
* Lower-level JSON-RPC connection over an ACP `Stream`.
*
* Most ACP integrations should use `agent(...)` or `client(...)`. Use this
* class when building generic JSON-RPC middleware or custom dispatch behavior.
*/
var Connection = class {
	pendingResponses = /* @__PURE__ */ new Map();
	incomingRequests = /* @__PURE__ */ new Map();
	nextRequestId = 0;
	staticHandlers = [];
	dynamicHandlers = /* @__PURE__ */ new Set();
	fallbackHandlers = [];
	stream;
	writeQueue = Promise.resolve();
	abortController = new AbortController();
	closedPromise;
	retryQueue = [];
	context = new ConnectionContext(this);
	receiveReader;
	constructor(requestHandlerOrStream, notificationHandlerOrHandlers, streamOrOptions, options) {
		if (typeof requestHandlerOrStream === "function") {
			const requestHandler = requestHandlerOrStream;
			const notificationHandler = notificationHandlerOrHandlers;
			const stream = streamOrOptions;
			this.initialize(stream, [...options?.handlers ?? [], this.legacyHandler(requestHandler, notificationHandler)], options);
			return;
		}
		const stream = requestHandlerOrStream;
		const handlers = notificationHandlerOrHandlers;
		const connectionOptions = streamOrOptions;
		this.initialize(stream, [...connectionOptions?.handlers ?? [], ...handlers], connectionOptions);
	}
	/**
	* Creates a builder for configuring a handler-based connection.
	*/
	static builder() {
		return new ConnectionBuilder();
	}
	/**
	* Runs an operation while the connection is open, then closes the connection.
	*
	* If the stream closes before `op` settles, the returned promise rejects with
	* the connection close reason.
	*/
	runUntil(op) {
		let opSettled = false;
		const opPromise = Promise.resolve().then(() => op(this.context)).finally(() => {
			opSettled = true;
		});
		const closedPromise = this.closed.then(() => {
			if (opSettled) return new Promise(() => {});
			throw this.closedReason();
		});
		return Promise.race([opPromise, closedPromise]).finally(() => {
			opSettled = true;
			this.close();
		});
	}
	/**
	* Adds a handler after the connection has started.
	*
	* Any messages queued with `Handled.no(message, true)` are retried after the
	* handler is added.
	*/
	addDynamicHandler(handler) {
		this.dynamicHandlers.add(handler);
		if (this.retryQueue.length > 0) for (const message of this.retryQueue.splice(0)) this.processIncomingMessage(message).catch((error) => this.close(error));
		return new HandlerRegistration(() => {
			this.dynamicHandlers.delete(handler);
		});
	}
	/**
	* AbortSignal that aborts when the connection closes.
	*/
	get signal() {
		return this.abortController.signal;
	}
	/**
	* Promise that resolves when the connection closes.
	*/
	get closed() {
		return this.closedPromise;
	}
	/** @internal */
	getContext() {
		return this.context;
	}
	/**
	* Sends a JSON-RPC request.
	*
	* `mapResponse` can convert the raw result before the returned promise
	* resolves.
	*/
	sendRequest(method, params, mapResponse, options = {}) {
		if (this.abortController.signal.aborted) return rejectedPromise(this.closedReason());
		const request = this.prepareRequest(method, params, mapResponse, options);
		this.sendMessage(request.message).catch(() => {});
		if (options.cancellationSignal?.aborted) request.cancel();
		return request.response;
	}
	/**
	* Sends a protocol-level request cancellation notification.
	*/
	sendCancelRequest(requestId) {
		return this.sendNotification(CANCEL_REQUEST_METHOD, { requestId });
	}
	/**
	* Sends a JSON-RPC notification.
	*/
	sendNotification(method, params) {
		if (this.abortController.signal.aborted) return rejectedPromise(this.closedReason());
		return this.sendMessage({
			jsonrpc: "2.0",
			method,
			params
		});
	}
	prepareRequest(method, params, mapResponse, options = {}) {
		const id = this.nextRequestId++;
		let cancel = () => {};
		const response = new Promise((resolve, reject) => {
			const pendingResponse = {
				resolve: (value) => {
					try {
						resolve(mapResponse ? mapResponse(value) : value);
					} catch (error) {
						reject(error);
					}
				},
				reject
			};
			cancel = () => {
				if (pendingResponse.cancellationSent) return;
				pendingResponse.cancellationSent = true;
				pendingResponse.cleanup?.();
				this.sendCancelRequest(id).catch(() => {});
				if (options.stopWaitingOnCancel) {
					pendingResponse.abandoned = true;
					reject(requestCancelledError(options.cancellationSignal?.reason));
				}
			};
			options.cancellationSignal?.addEventListener("abort", cancel, { once: true });
			pendingResponse.cleanup = () => {
				options.cancellationSignal?.removeEventListener("abort", cancel);
			};
			this.pendingResponses.set(id, pendingResponse);
		});
		response.catch(() => {});
		return {
			message: {
				jsonrpc: "2.0",
				id,
				method,
				params
			},
			response,
			cancel: () => cancel()
		};
	}
	/**
	* Closes the connection and rejects pending requests.
	*/
	close(error) {
		if (this.abortController.signal.aborted) return;
		const closeError = error ?? /* @__PURE__ */ new Error("ACP connection closed");
		this.abortController.abort(closeError);
		for (const pendingResponse of this.pendingResponses.values()) {
			pendingResponse.cleanup?.();
			pendingResponse.reject(closeError);
		}
		this.pendingResponses.clear();
		for (const controller of this.incomingRequests.values()) controller.abort(closeError);
		this.incomingRequests.clear();
		this.receiveReader?.cancel(closeError).catch(() => {});
	}
	initialize(stream, handlers, options) {
		this.stream = stream;
		this.staticHandlers = handlers;
		this.fallbackHandlers = [...options?.fallbackHandlers ?? []];
		this.closedPromise = new Promise((resolve) => {
			this.abortController.signal.addEventListener("abort", () => resolve());
		});
		this.receive();
	}
	legacyHandler(requestHandler, notificationHandler) {
		return { handleMessage: async (message, cx) => {
			if (message.kind === "request") {
				const result = await requestHandler(message.method, message.params, cx);
				await message.responder.respond(result);
			} else await notificationHandler(message.method, message.params, cx);
			return Handled.yes();
		} };
	}
	async receive() {
		let closeError = void 0;
		try {
			const reader = this.stream.readable.getReader();
			this.receiveReader = reader;
			try {
				while (!this.abortController.signal.aborted) {
					const { value: message, done } = await reader.read();
					if (this.abortController.signal.aborted) break;
					if (done) break;
					this.receiveUnvalidatedMessage(message);
				}
			} finally {
				if (this.receiveReader === reader) this.receiveReader = void 0;
				reader.releaseLock();
			}
		} catch (error) {
			closeError = error;
		} finally {
			this.close(closeError);
		}
	}
	receiveUnvalidatedMessage(message) {
		if (Array.isArray(message)) {
			this.sendMessage(protocolErrorResponse(RequestError.invalidRequest(void 0, "JSON-RPC batches are not supported"))).catch(() => {});
			return;
		}
		if (!isRequestMessage(message) && !isNotificationMessage(message) && !isResponseShapedMessage(message)) {
			this.sendMessage(protocolErrorResponse(RequestError.invalidRequest(message))).catch(() => {});
			return;
		}
		this.receiveMessage(message);
	}
	receiveMessage(message) {
		if (this.abortController.signal.aborted) return Promise.resolve();
		if (!isRecord(message)) {
			console.error("Invalid message", describeInvalidMessage(message));
			return Promise.resolve();
		}
		if ("method" in message) {
			if (!("id" in message)) this.handleProtocolNotification(message);
			return this.processIncomingMessage(this.toIncomingMessage(message)).catch((error) => this.close(error));
		} else if ("id" in message) this.handleResponse(message);
		else console.error("Invalid message", describeInvalidMessage(message));
		return Promise.resolve();
	}
	async processIncomingMessage(message) {
		if (this.abortController.signal.aborted) return;
		let current = message;
		let retry = false;
		try {
			for (const handler of [
				...this.staticHandlers,
				...this.dynamicHandlers.values(),
				...this.fallbackHandlers
			]) {
				if (this.abortController.signal.aborted) return;
				const result = await handler.handleMessage(current, this.context) ?? { handled: true };
				if (result.handled) return;
				current = result.message ?? current;
				retry = retry || Boolean(result.retry);
			}
			if (retry) this.retryQueue.push(current);
			else if (current.kind === "request") await current.responder.respondWithError(RequestError.methodNotFound(current.method));
		} catch (error) {
			if (this.abortController.signal.aborted) return;
			if (current.kind === "request" && !current.responder.responded) await current.responder.respondWithResult(errorToRequestResult(error, current.responder.signal));
			else {
				const response = errorToResult(error);
				if ("error" in response) console.error("Error handling notification", {
					method: message.method,
					code: response.error.code,
					message: response.error.message
				});
			}
		}
	}
	toIncomingMessage(message) {
		if ("id" in message) {
			const abortController = new AbortController();
			this.incomingRequests.set(message.id, abortController);
			const finishRequest = () => {
				if (this.incomingRequests.get(message.id) === abortController) this.incomingRequests.delete(message.id);
			};
			const responder = new RequestResponder(message.id, (result) => {
				const response = {
					jsonrpc: "2.0",
					id: nullIdResponders.has(responder) ? null : message.id,
					...result
				};
				return this.sendMessage(response);
			}, abortController.signal, finishRequest);
			return {
				kind: "request",
				method: message.method,
				params: message.params,
				raw: message,
				signal: abortController.signal,
				responder
			};
		}
		return {
			kind: "notification",
			method: message.method,
			params: message.params,
			raw: message
		};
	}
	handleResponse(response) {
		const pendingResponse = this.pendingResponses.get(response.id);
		if (pendingResponse) {
			this.pendingResponses.delete(response.id);
			pendingResponse.cleanup?.();
			if (pendingResponse.abandoned) return;
			if (!isResponseMessage(response)) pendingResponse.reject(RequestError.invalidRequest(response));
			else if ("result" in response) pendingResponse.resolve(response.result);
			else {
				const { code, message, data } = response.error;
				pendingResponse.reject(new RequestError(code, message, data));
			}
		} else console.error("Got response to unknown request", response.id);
	}
	handleProtocolNotification(message) {
		if (message.method !== CANCEL_REQUEST_METHOD) return;
		const requestId = cancelRequestId(message.params);
		if (requestId === void 0) return;
		const controller = this.incomingRequests.get(requestId);
		if (!controller || controller.signal.aborted) return;
		controller.abort(RequestError.requestCancelled({ requestId }));
	}
	closedReason() {
		return this.abortController.signal.reason ?? /* @__PURE__ */ new Error("ACP connection closed");
	}
	async sendMessage(message) {
		if (this.abortController.signal.aborted) return rejectedPromise(this.closedReason());
		this.writeQueue = this.writeQueue.then(async () => {
			if (this.abortController.signal.aborted) throw this.closedReason();
			const writer = this.stream.writable.getWriter();
			try {
				await writer.write(message);
			} finally {
				writer.releaseLock();
			}
		}).catch((error) => {
			this.close(error);
			throw error;
		});
		return this.writeQueue;
	}
};
/**
* Builder for a lower-level handler-based JSON-RPC connection.
*/
var ConnectionBuilder = class {
	handlers = [];
	fallbackHandlers = [];
	connectionName;
	/**
	* Sets a diagnostic name used by handlers created from this builder.
	*/
	name(name) {
		this.connectionName = name;
		return this;
	}
	/**
	* Adds a raw JSON-RPC handler to the handler chain.
	*/
	withHandler(handler) {
		this.handlers.push(handler);
		return this;
	}
	/**
	* Adds a fallback after static and dynamic handlers. Each connection snapshots
	* this registration alongside the builder's other handlers.
	*/
	withFallbackHandler(handler) {
		this.fallbackHandlers.push(handler);
		return this;
	}
	/**
	* Adds a handler that can inspect every incoming request or notification.
	*
	* Observer callbacks that return void pass the message through to later
	* handlers. Return `Handled.yes()` to stop dispatch explicitly.
	*/
	onReceiveMessage(handler) {
		return this.withHandler({
			handleMessage: async (message, cx) => await handler(message, cx) ?? Handled.no(message),
			describe: () => this.connectionName ?? "onReceiveMessage"
		});
	}
	/**
	* Adds a typed request handler for one method.
	*/
	onReceiveRequest(method, parse, handler) {
		return this.withHandler({
			handleMessage: async (message, cx) => {
				if (message.kind !== "request" || message.method !== method) return Handled.no(message);
				return await handler(parse(message.params), message.responder, cx) ?? Handled.yes();
			},
			describe: () => `${this.connectionName ?? "request"}:${method}`
		});
	}
	/**
	* Adds a typed notification handler for one method.
	*/
	onReceiveNotification(method, parse, handler) {
		return this.withHandler({
			handleMessage: async (message, cx) => {
				if (message.kind !== "notification" || message.method !== method) return Handled.no(message);
				return await handler(parse(message.params), cx) ?? Handled.yes();
			},
			describe: () => `${this.connectionName ?? "notification"}:${method}`
		});
	}
	/**
	* Connects the configured handlers to a stream.
	*/
	connect(stream, options) {
		return new Connection(stream, this.handlers, {
			...options,
			fallbackHandlers: [...options?.fallbackHandlers ?? [], ...this.fallbackHandlers]
		});
	}
	/**
	* Connects to a stream for the lifetime of `op`, then closes the connection.
	*/
	connectWith(stream, op, options) {
		return this.connect(stream, options).runUntil(op);
	}
};
/**
* JSON-RPC error object.
*
* Represents an error that occurred during method execution, following the
* JSON-RPC 2.0 error object specification with optional additional data.
*
* See protocol docs: [JSON-RPC Error Object](https://www.jsonrpc.org/specification#error_object)
*/
var RequestError = class RequestError extends Error {
	code;
	/**
	* Additional JSON-RPC error data.
	*/
	data;
	constructor(code, message, data) {
		super(message);
		this.code = code;
		this.name = "RequestError";
		this.data = data;
	}
	/**
	* Invalid JSON was received by the server. An error occurred on the server while parsing the JSON text.
	*/
	static parseError(data, additionalMessage) {
		return new RequestError(-32700, `Parse error${additionalMessage ? `: ${additionalMessage}` : ""}`, data);
	}
	/**
	* The JSON sent is not a valid Request object.
	*/
	static invalidRequest(data, additionalMessage) {
		return new RequestError(-32600, `Invalid request${additionalMessage ? `: ${additionalMessage}` : ""}`, data);
	}
	/**
	* The method does not exist / is not available.
	*/
	static methodNotFound(method) {
		return new RequestError(-32601, `"Method not found": ${method}`, { method });
	}
	/**
	* Invalid method parameter(s).
	*/
	static invalidParams(data, additionalMessage) {
		return new RequestError(-32602, `Invalid params${additionalMessage ? `: ${additionalMessage}` : ""}`, data);
	}
	/**
	* Internal JSON-RPC error.
	*/
	static internalError(data, additionalMessage) {
		return new RequestError(-32603, `Internal error${additionalMessage ? `: ${additionalMessage}` : ""}`, data);
	}
	/**
	* Execution of the request was aborted.
	*/
	static requestCancelled(data, additionalMessage) {
		return new RequestError(-32800, `Request cancelled${additionalMessage ? `: ${additionalMessage}` : ""}`, data);
	}
	/**
	* Authentication required.
	*/
	static authRequired(data, additionalMessage) {
		return new RequestError(-32e3, `Authentication required${additionalMessage ? `: ${additionalMessage}` : ""}`, data);
	}
	/**
	* A referenced resource, such as a session or file, does not exist.
	*
	* For an unknown or inactive session, prefer
	* {@link RequestError.sessionNotFound}, which sets `data.sessionId` as the
	* protocol expects.
	*/
	static resourceNotFound(uri) {
		return new RequestError(-32002, `Resource not found${uri ? `: ${uri}` : ""}`, uri && { uri });
	}
	/**
	* The session named by a session-scoped request does not exist or is not
	* active on this connection.
	*
	* Produces a `-32002` (Resource not found) error with `data.sessionId` set
	* to the requested session ID.
	*/
	static sessionNotFound(sessionId) {
		return new RequestError(-32002, "Resource not found", { sessionId });
	}
	/**
	* No supported protocol version is at or below the requested version.
	*
	* Produces a `-32022` error whose data lists the `requested` version and the
	* `supported` versions.
	*/
	static unsupportedProtocolVersion(requested, supported) {
		return new RequestError(-32022, "Unsupported protocol version", {
			requested,
			supported: [...supported]
		});
	}
	/**
	* Converts this error to a JSON-RPC result object.
	*/
	toResult() {
		return { error: {
			code: this.code,
			message: this.message,
			data: this.data
		} };
	}
	/**
	* Converts this error to a JSON-RPC error response payload.
	*/
	toErrorResponse() {
		return {
			code: this.code,
			message: this.message,
			data: this.data
		};
	}
};
/**
* Creates a JSON-RPC error response for a request whose ID cannot be known.
*
* @internal
*/
function protocolErrorResponse(error) {
	return {
		jsonrpc: "2.0",
		id: null,
		error: error.toErrorResponse()
	};
}
var MessageTooLargeError = class extends Error {
	maxMessageBytes;
	constructor(maxMessageBytes) {
		super(`Incoming ACP data exceeds the configured ${maxMessageBytes} byte limit`);
		this.maxMessageBytes = maxMessageBytes;
		this.name = "MessageTooLargeError";
	}
};
function resolveMaxMessageBytes(value) {
	const maxMessageBytes = value ?? 33554432;
	if (!Number.isSafeInteger(maxMessageBytes) || maxMessageBytes <= 0) throw new RangeError("maxMessageBytes must be a positive safe integer");
	return maxMessageBytes;
}
var MessageBuffer = class {
	#buffer = /* @__PURE__ */ new Uint8Array(0);
	#length = 0;
	#maxMessageBytes;
	constructor(maxMessageBytes) {
		this.#maxMessageBytes = resolveMaxMessageBytes(maxMessageBytes);
	}
	get byteLength() {
		return this.#length;
	}
	get lastByte() {
		return this.#buffer[this.#length - 1];
	}
	#checkAppend(byteLength) {
		if (byteLength > this.#maxMessageBytes - this.#length) {
			this.clear();
			throw new MessageTooLargeError(this.#maxMessageBytes);
		}
	}
	append(bytes) {
		this.#checkAppend(bytes.byteLength);
		const length = this.#length + bytes.byteLength;
		if (length > this.#buffer.byteLength) {
			const capacity = Math.min(this.#maxMessageBytes, Math.max(length, this.#buffer.byteLength * 2, 1024));
			const buffer = new Uint8Array(capacity);
			buffer.set(this.#buffer.subarray(0, this.#length));
			this.#buffer = buffer;
		}
		this.#buffer.set(bytes, this.#length);
		this.#length = length;
	}
	take() {
		const bytes = this.#buffer.subarray(0, this.#length);
		this.clear();
		return bytes;
	}
	clear() {
		this.#buffer = /* @__PURE__ */ new Uint8Array(0);
		this.#length = 0;
	}
};
// ../code-for-antigravity/node_modules/@agentclientprotocol/sdk/dist/core/line-buffer.js
var newline = 10;
var carriageReturn = 13;
/**
* Incrementally splits a byte stream into LF- or CRLF-terminated lines, and
* optionally CR-terminated lines.
*
* Only the newly pushed chunk is scanned for line endings, so splitting costs
* O(total bytes) no matter how many chunks a line spans.
*
* Chunks passed to {@link push} must not be mutated while its iterator is
* in use.
*/
var LineBuffer = class {
	/** Bytes of the current (incomplete) line, carried across chunks. */
	#pending;
	#maxMessageBytes;
	#splitOnCarriageReturn;
	/** Whether the last line ended at a CR whose LF may start the next chunk. */
	#afterCarriageReturn = false;
	constructor(maxMessageBytes, { splitOnCarriageReturn = false } = {}) {
		this.#maxMessageBytes = resolveMaxMessageBytes(maxMessageBytes);
		this.#pending = new MessageBuffer(Math.min(Number.MAX_SAFE_INTEGER, this.#maxMessageBytes + 1));
		this.#splitOnCarriageReturn = splitOnCarriageReturn;
	}
	/**
	* Consumes a chunk, yielding each complete line without its line ending.
	*/
	*push(chunk) {
		let start = 0;
		if (this.#afterCarriageReturn && chunk.byteLength > 0) {
			this.#afterCarriageReturn = false;
			if (chunk[0] === newline) start = 1;
		}
		let newlineIndex = chunk.indexOf(newline, start);
		let carriageReturnIndex = this.#splitOnCarriageReturn ? chunk.indexOf(carriageReturn, start) : -1;
		while (newlineIndex !== -1 || carriageReturnIndex !== -1) if (carriageReturnIndex === -1 || newlineIndex !== -1 && newlineIndex < carriageReturnIndex) {
			yield this.#takeLine(chunk.subarray(start, newlineIndex));
			start = newlineIndex + 1;
			newlineIndex = chunk.indexOf(newline, start);
		} else {
			yield this.#takeLine(chunk.subarray(start, carriageReturnIndex));
			start = carriageReturnIndex + 1;
			if (start === chunk.byteLength) this.#afterCarriageReturn = true;
			else if (chunk[start] === newline) {
				start++;
				newlineIndex = chunk.indexOf(newline, start);
			}
			carriageReturnIndex = chunk.indexOf(carriageReturn, start);
		}
		if (start < chunk.byteLength) {
			const tail = chunk.subarray(start);
			this.#checkLine(tail);
			this.#pending.append(tail);
		}
	}
	/**
	* Returns the trailing unterminated line and resets the buffer, or
	* undefined if no bytes are buffered.
	*/
	flush() {
		this.#afterCarriageReturn = false;
		if (this.#pending.byteLength === 0) return;
		return stripCarriageReturn(this.#pending.take());
	}
	clear() {
		this.#afterCarriageReturn = false;
		this.#pending.clear();
	}
	#takeLine(tail) {
		this.#checkLine(tail);
		if (this.#pending.byteLength === 0) return stripCarriageReturn(tail);
		this.#pending.append(tail);
		return stripCarriageReturn(this.#pending.take());
	}
	#checkLine(tail) {
		const lastByte = tail.byteLength > 0 ? tail[tail.byteLength - 1] : this.#pending.lastByte;
		if (this.#pending.byteLength + tail.byteLength - (lastByte === carriageReturn ? 1 : 0) > this.#maxMessageBytes) {
			this.clear();
			throw new MessageTooLargeError(this.#maxMessageBytes);
		}
	}
};
function stripCarriageReturn(line) {
	return line[line.byteLength - 1] === carriageReturn ? line.subarray(0, -1) : line;
}
// ../code-for-antigravity/node_modules/@agentclientprotocol/sdk/dist/core/stream.js
/**
* Creates an ACP Stream from a pair of newline-delimited JSON streams.
*
* This is the typical way to handle ACP connections over stdio, converting
* between AnyMessage objects and newline-delimited JSON.
*
* @param output - The writable stream to send encoded messages to
* @param input - The readable stream to receive encoded messages from
* @returns A Stream for bidirectional ACP communication
*/
function ndJsonStream$1(output, input, options = {}) {
	const maxMessageBytes = resolveMaxMessageBytes(options.maxMessageBytes);
	const textEncoder = new TextEncoder();
	const textDecoder = new TextDecoder();
	let cancelled = false;
	let inputReader;
	let outputWrite = Promise.resolve();
	const writeJson = (message) => {
		const content = JSON.stringify(message) + "\n";
		const write = outputWrite.then(async () => {
			const writer = output.getWriter();
			try {
				await writer.write(textEncoder.encode(content));
			} finally {
				writer.releaseLock();
			}
		});
		outputWrite = write.catch(() => {});
		return write;
	};
	return {
		readable: new ReadableStream({
			async start(controller) {
				const lines = new LineBuffer(maxMessageBytes);
				const enqueueLine = async (lineBytes) => {
					const trimmedLine = textDecoder.decode(lineBytes).trim();
					if (!trimmedLine) return;
					let message;
					try {
						message = JSON.parse(trimmedLine);
					} catch {
						await writeJson(protocolErrorResponse(RequestError.parseError()));
						return;
					}
					if (Array.isArray(message)) await writeJson(protocolErrorResponse(RequestError.invalidRequest(void 0, "JSON-RPC batches are not supported")));
					else if (isRecord(message)) controller.enqueue(message);
					else await writeJson(protocolErrorResponse(RequestError.invalidRequest(message)));
				};
				const reader = input.getReader();
				inputReader = reader;
				try {
					while (true) {
						const { value, done } = await reader.read();
						if (cancelled) return;
						if (done) break;
						if (!value) continue;
						for (const line of lines.push(value)) {
							await enqueueLine(line);
							if (cancelled) return;
						}
					}
					if (cancelled) return;
					const lastLine = lines.flush();
					if (lastLine) await enqueueLine(lastLine);
				} catch (err) {
					if (cancelled) return;
					controller.error(err);
					reader.cancel(err).catch(() => {});
					return;
				} finally {
					lines.clear();
					if (inputReader === reader) inputReader = void 0;
					reader.releaseLock();
				}
				if (cancelled) return;
				controller.close();
			},
			cancel(reason) {
				cancelled = true;
				return inputReader?.cancel(reason);
			}
		}),
		writable: new WritableStream({ write(message) {
			return writeJson(message);
		} })
	};
}
zElicitationFormMode.and(object({ mode: literal("form") })).and(object({ message: string() }));
zElicitationUrlMode.and(object({ mode: literal("url") })).and(object({ message: string() }));
union([zElicitationSessionScope, zElicitationRequestScope]).and(object({ message: string() }));
zStringPropertySchema.and(object({ type: literal("string") }));
zNumberPropertySchema.and(object({ type: literal("number") }));
zIntegerPropertySchema.and(object({ type: literal("integer") }));
zBooleanPropertySchema.and(object({ type: literal("boolean") }));
zMultiSelectPropertySchema.and(object({ type: literal("array") }));
zStringMultiSelectItems.and(object({ type: literal("string") }));
zRunningStateUpdate.and(object({ state: literal("running") }));
zIdleStateUpdate.and(object({ usage: zUsage.nullish() })).and(object({ state: literal("idle") }));
zRequiresActionStateUpdate.and(object({ state: literal("requires_action") }));
zUnknownStateUpdate.and(object({ state: literal("unknown") }));
object({ stopReason: literal("end_turn") });
object({ stopReason: literal("max_tokens") });
object({ stopReason: literal("max_turn_requests") });
object({ stopReason: literal("refusal") });
object({ stopReason: literal("cancelled") });
zErrorStopReason.and(object({ error: zError.nullish() })).and(object({ stopReason: literal("error") }));
object({ stopReason: _null().optional() });
zElicitationAcceptAction.and(object({ action: literal("accept") }));
object({ action: literal("decline") });
object({ action: literal("cancel") });
// ../code-for-antigravity/node_modules/@agentclientprotocol/sdk/dist/core/app-handlers.js
function parseParams(parser, params) {
	if (!parser) return params;
	if (typeof parser === "function") return parser(params);
	return parser.parse(params);
}
function registerAppRequest(builder, spec, context, handler, serializeResponse, lifecycle) {
	const handle = async (params, responder, cx, method) => {
		try {
			const response = await handler(context(params, cx, responder.signal, responder.id, method));
			const sentResponse = serializeResponse ? serializeResponse(response) : response;
			lifecycle?.beforeResponse(params, sentResponse, cx);
			await responder.respond(sentResponse);
		} catch (error) {
			lifecycle?.onError(cx, error);
			throw error;
		}
	};
	if (spec.method === "*") builder.withFallbackHandler({ handleMessage: async (message, cx) => {
		if (message.kind !== "request") return Handled.no(message);
		await handle(message.params, message.responder, cx, message.method);
		return Handled.yes();
	} });
	else builder.onReceiveRequest(spec.method, (params) => parseParams(spec.params, params), (params, responder, cx) => handle(params, responder, cx, spec.method));
}
function registerAppNotification(builder, spec, context, handler) {
	if (spec.method === "*") builder.withFallbackHandler({ handleMessage: async (message, cx) => {
		if (message.kind !== "notification") return Handled.no(message);
		await handler(context(message.params, cx, cx.signal, message.method));
		return Handled.yes();
	} });
	else builder.onReceiveNotification(spec.method, (params) => parseParams(spec.params, params), (params, cx) => handler(context(params, cx, cx.signal, spec.method)));
}
// ../code-for-antigravity/node_modules/@agentclientprotocol/sdk/dist/core/connection-access.js
/**
* Symbol used by protocol-agnostic helpers to reach the connection behind an
* ACP context. It must stay in the published declarations so that
* {@link HasConnectionContext} only accepts real ACP contexts.
*
* @hidden
*/
var connectionContextOf = Symbol("connectionContextOf");
/**
* Returns the connection behind an ACP context.
*
* @hidden
*/
function connectionOf(context) {
	return context[connectionContextOf]();
}
// ../code-for-antigravity/node_modules/@agentclientprotocol/sdk/dist/v1/acp.js
/**
* Creates a stable ACP v1 stream from newline-delimited JSON streams.
*
* @param output - The writable stream to send encoded messages to
* @param input - The readable stream to receive encoded messages from
* @returns A stream for bidirectional ACP v1 communication
*/
function ndJsonStream(output, input, options) {
	return ndJsonStream$1(output, input, options);
}
var initializedConnections = /* @__PURE__ */ new WeakSet();
/**
* Rejects requests other than `initialize` with `-32600` until an `initialize`
* request has been answered successfully. `initialize` itself may be sent
* again at any time, as before.
*/
function agentInitializationGate(enabled) {
	return {
		handleMessage(message, cx) {
			if (message.kind !== "request" || !enabled() || initializedConnections.has(cx)) return Handled.no(message);
			if (message.method !== AGENT_METHODS.initialize) return message.responder.respondWithError(RequestError.invalidRequest(void 0, `ACP connection must be initialized before '${message.method}'`)).then(() => Handled.yes());
			const { responder } = message;
			return Handled.no({
				...message,
				responder: new RequestResponder(responder.id, (result) => {
					if ("result" in result) initializedConnections.add(cx);
					return responder.respondWithResult(result);
				}, responder.signal)
			});
		},
		describe: () => "agent-initialization"
	};
}
function emptyObjectResponse(response) {
	return response ?? {};
}
function isStream(value) {
	return typeof value === "object" && value !== null && "readable" in value && "writable" in value;
}
function memoryStreamPair() {
	const leftToRight = new TransformStream();
	const rightToLeft = new TransformStream();
	return [{
		readable: rightToLeft.readable,
		writable: leftToRight.writable
	}, {
		readable: leftToRight.readable,
		writable: rightToLeft.writable
	}];
}
/**
* ACP method-name constants.
*
* Use these with `onRequest(...)`, `onNotification(...)`, `request(...)`, and
* `notify(...)` when you want literal-string type inference without spelling
* protocol strings inline.
*/
var methods = {
	agent: {
		initialize: AGENT_METHODS.initialize,
		authenticate: AGENT_METHODS.authenticate,
		logout: AGENT_METHODS.logout,
		auth: { status: AGENT_METHODS.auth_status },
		providers: {
			list: AGENT_METHODS.providers_list,
			set: AGENT_METHODS.providers_set,
			disable: AGENT_METHODS.providers_disable
		},
		session: {
			new: AGENT_METHODS.session_new,
			load: AGENT_METHODS.session_load,
			list: AGENT_METHODS.session_list,
			delete: AGENT_METHODS.session_delete,
			fork: AGENT_METHODS.session_fork,
			archive: AGENT_METHODS.session_archive,
			unarchive: AGENT_METHODS.session_unarchive,
			status: AGENT_METHODS.session_status,
			options: AGENT_METHODS.session_options,
			setTitle: AGENT_METHODS.session_set_title,
			resume: AGENT_METHODS.session_resume,
			close: AGENT_METHODS.session_close,
			setMode: AGENT_METHODS.session_set_mode,
			setConfigOption: AGENT_METHODS.session_set_config_option,
			prompt: AGENT_METHODS.session_prompt,
			cancel: AGENT_METHODS.session_cancel
		},
		mcp: { message: AGENT_METHODS.mcp_message }
	},
	client: {
		session: {
			requestPermission: CLIENT_METHODS.session_request_permission,
			update: CLIENT_METHODS.session_update
		},
		fs: {
			writeTextFile: CLIENT_METHODS.fs_write_text_file,
			readTextFile: CLIENT_METHODS.fs_read_text_file
		},
		terminal: {
			create: CLIENT_METHODS.terminal_create,
			output: CLIENT_METHODS.terminal_output,
			release: CLIENT_METHODS.terminal_release,
			waitForExit: CLIENT_METHODS.terminal_wait_for_exit,
			kill: CLIENT_METHODS.terminal_kill
		},
		mcp: { message: CLIENT_METHODS.mcp_message },
		elicitation: {
			create: CLIENT_METHODS.elicitation_create,
			complete: CLIENT_METHODS.elicitation_complete
		},
		auth: { statusUpdate: CLIENT_METHODS.auth_status_update }
	},
	protocol: { cancelRequest: PROTOCOL_METHODS.cancel_request }
};
var startActiveSession = Symbol("startActiveSession");
var AcpContext = class {
	cx;
	currentRequestId;
	/** @internal */
	constructor(cx, currentRequestId) {
		this.cx = cx;
		this.currentRequestId = currentRequestId;
	}
	/**
	* JSON-RPC id of the request currently being handled.
	*
	* This is `undefined` for notification handlers and for contexts created
	* outside an inbound request, such as `connect(...)` and `connectWith(...)`.
	*/
	get requestId() {
		return this.currentRequestId;
	}
	/** @internal */
	get connectionContext() {
		return this.cx;
	}
	/** @hidden SDK helpers use this to identify the connection. */
	[connectionContextOf]() {
		return this.cx;
	}
	/** @internal */
	sendRequest(method, params, mapResponse, options) {
		return this.cx.sendRequest(method, params, mapResponse, options);
	}
	/** @internal */
	sendNotification(method, params) {
		return this.cx.sendNotification(method, params);
	}
	/** @internal */
	addDynamicHandler(handler) {
		return this.cx.addDynamicHandler(handler);
	}
};
/**
* Context passed to agent-side handlers.
*
* Agents use this context to call client-side ACP methods while handling
* requests such as `session/prompt`.
*/
var AgentContext = class AgentContext extends AcpContext {
	constructor(cx, requestId) {
		super(cx, requestId);
	}
	/** @internal */
	static create(cx, requestId) {
		return new AgentContext(cx, requestId);
	}
	/**
	* Executes a command in a new client terminal.
	*
	* Returns a handle for reading output, waiting for exit, killing the command,
	* and releasing the terminal. Check the client's terminal capability first.
	* Use `await using` or call `release()` when finished.
	*/
	async createTerminal(params, options) {
		const response = await this.request(CLIENT_METHODS.terminal_create, params, options);
		return TerminalHandle.create(response.terminalId, params.sessionId, this.connectionContext);
	}
	request(method, params, options) {
		const spec = clientRequestSpecsByMethod[method];
		return this.sendRequest(method, params, spec?.mapResponse, options);
	}
	notify(method, params) {
		return this.sendNotification(method, params);
	}
};
/**
* Context used by clients to call agent-side ACP methods.
*
* `connectWith` passes a `ClientContext` to the callback. Client handlers also
* receive one as `ctx.agent` when they need to call back into the agent.
*/
var ClientContext = class ClientContext extends AcpContext {
	constructor(cx, requestId) {
		super(cx, requestId);
	}
	/** @internal */
	static create(cx, requestId) {
		return new ClientContext(cx, requestId);
	}
	/** @internal */
	[startActiveSession](params, options) {
		return this.sendRequest(AGENT_METHODS.session_new, params, (response) => this.attachSession(response), options);
	}
	buildSession(cwdOrRequest) {
		if (typeof cwdOrRequest === "string") return SessionBuilder.create(this, {
			cwd: cwdOrRequest,
			mcpServers: []
		});
		return SessionBuilder.create(this, cwdOrRequest);
	}
	/**
	* Builds active-session helpers around a `session/new` response.
	*/
	attachSession(response) {
		const updates = new AsyncQueue();
		const closeSignal = this.connectionContext.signal;
		const failUpdatesOnClose = () => {
			updates.fail(closeSignal.reason ?? /* @__PURE__ */ new Error("ACP connection closed"));
		};
		if (closeSignal.aborted) failUpdatesOnClose();
		else closeSignal.addEventListener("abort", failUpdatesOnClose);
		const sessionRegistration = sessionUpdateRouter(this.connectionContext).attach(response, updates);
		const closeRegistration = new HandlerRegistration(() => {
			closeSignal.removeEventListener("abort", failUpdatesOnClose);
		});
		return ActiveSession.create(this, response, updates, [sessionRegistration, closeRegistration]);
	}
	request(method, params, options) {
		const spec = agentRequestSpecsByMethod[method];
		return treatSessionNotFoundAsSuccess(method, this.sendRequest(method, params, spec?.mapResponse, options), () => spec?.mapResponse ? spec.mapResponse({}) : {});
	}
	notify(method, params) {
		return this.sendNotification(method, params);
	}
};
var AcpConnectionHandle = class {
	connection;
	constructor(connection) {
		this.connection = connection;
	}
	get signal() {
		return this.connection.signal;
	}
	get closed() {
		return this.connection.closed;
	}
	close(error) {
		this.connection.close(error);
	}
};
var AgentConnectionHandle = class extends AcpConnectionHandle {
	connectHandlers;
	client;
	didStartConnectHandlers = false;
	constructor(connection, connectHandlers = []) {
		super(connection);
		this.connectHandlers = connectHandlers;
		this.client = AgentContext.create(connection.getContext());
	}
	/** @internal */
	startConnectHandlers() {
		if (this.didStartConnectHandlers) return;
		this.didStartConnectHandlers = true;
		runConnectHandlers(this, this.connectHandlers);
	}
};
var ClientConnectionHandle = class extends AcpConnectionHandle {
	connectHandlers;
	agent;
	didStartConnectHandlers = false;
	constructor(connection, connectHandlers = []) {
		super(connection);
		this.connectHandlers = connectHandlers;
		this.agent = ClientContext.create(connection.getContext());
	}
	/** @internal */
	startConnectHandlers() {
		if (this.didStartConnectHandlers) return;
		this.didStartConnectHandlers = true;
		runConnectHandlers(this, this.connectHandlers);
	}
};
function agentConnection(connection, connectHandlers = []) {
	return new AgentConnectionHandle(connection, connectHandlers);
}
function clientConnection(connection, connectHandlers = []) {
	return new ClientConnectionHandle(connection, connectHandlers);
}
var AsyncQueue = class {
	values = [];
	waiters = [];
	failed = false;
	failure;
	enqueue(value) {
		if (this.failed) return;
		const waiter = this.waiters.shift();
		if (waiter) waiter.resolve(value);
		else this.values.push({
			kind: "value",
			value
		});
	}
	reject(error) {
		if (this.failed) return;
		if (this.waiters.length > 0) {
			for (const waiter of this.waiters.splice(0)) waiter.reject(error);
			return;
		}
		this.values.push({
			kind: "error",
			error
		});
	}
	clearErrors() {
		this.values = this.values.filter((entry) => entry.kind === "value");
	}
	fail(error) {
		if (this.failed) return;
		this.failed = true;
		this.failure = error;
		for (const waiter of this.waiters.splice(0)) waiter.reject(error);
	}
	next() {
		if (this.values.length > 0) {
			const entry = this.values.shift();
			if (entry.kind === "error") return Promise.reject(entry.error);
			return Promise.resolve(entry.value);
		}
		if (this.failed) return Promise.reject(this.failure);
		return new Promise((resolve, reject) => {
			this.waiters.push({
				resolve,
				reject
			});
		});
	}
};
function cloneNewSessionRequest(request) {
	return {
		...request,
		additionalDirectories: request.additionalDirectories ? [...request.additionalDirectories] : void 0,
		mcpServers: [...request.mcpServers]
	};
}
/**
* Builder for creating an `ActiveSession`.
*
* Start from `ctx.buildSession("/absolute/cwd")` for the common case, or
* pass a full `NewSessionRequest` to `ctx.buildSession(...)` when the session
* needs MCP servers, `_meta`, or additional request fields. All paths in ACP
* payloads should be absolute.
*/
var SessionBuilder = class SessionBuilder {
	cx;
	request;
	constructor(cx, request) {
		this.cx = cx;
		this.request = cloneNewSessionRequest(request);
	}
	/** @internal */
	static create(cx, request) {
		return new SessionBuilder(cx, request);
	}
	/**
	* Returns the `session/new` request that will be sent.
	*
	* The returned object is a defensive copy, so mutating it does not change the
	* builder.
	*/
	toRequest() {
		return cloneNewSessionRequest(this.request);
	}
	/**
	* Replaces the additional workspace roots for this session.
	*
	* `additionalDirectories` expand the session's file-system scope without
	* changing `cwd`. Each path should be absolute.
	*/
	withAdditionalDirectories(additionalDirectories) {
		this.request = {
			...this.request,
			additionalDirectories: [...additionalDirectories]
		};
		return this;
	}
	/**
	* Adds one MCP server to the `session/new` request.
	*/
	withMcpServer(mcpServer) {
		this.request = {
			...this.request,
			mcpServers: [...this.request.mcpServers, mcpServer]
		};
		return this;
	}
	/**
	* Starts the session and returns an `ActiveSession` for prompting and reading
	* updates.
	*
	* Call `dispose()` on the returned session when you no longer need update
	* routing, or use `withSession(...)` to scope disposal automatically.
	*/
	async start(options) {
		return this.cx[startActiveSession](this.toRequest(), options);
	}
	/**
	* Starts the session, runs `op`, and disposes the active-session update
	* routing when `op` finishes or throws.
	*/
	async withSession(op) {
		const session = await this.start();
		try {
			return await op(session);
		} finally {
			session.dispose();
		}
	}
};
/**
* Convenience wrapper for an active ACP session.
*
* An active session routes `session/update` notifications for one session ID
* into an async queue. Use `prompt(...)` to send user content, then read updates
* with `nextUpdate()` until a `stop` message is returned.
*/
var ActiveSession = class ActiveSession {
	cx;
	sessionResponse;
	updates;
	registrations;
	constructor(cx, sessionResponse, updates, registrations) {
		this.cx = cx;
		this.sessionResponse = sessionResponse;
		this.updates = updates;
		this.registrations = registrations;
	}
	/** @internal */
	static create(cx, sessionResponse, updates, registrations) {
		return new ActiveSession(cx, sessionResponse, updates, registrations);
	}
	/**
	* Session ID returned by `session/new`.
	*/
	get sessionId() {
		return this.sessionResponse.sessionId;
	}
	/**
	* Mode state returned when the session was created, if the agent provided it.
	*/
	get modes() {
		return this.sessionResponse.modes;
	}
	/**
	* Metadata returned when the session was created.
	*/
	get meta() {
		return this.sessionResponse._meta;
	}
	/**
	* Full response returned by `session/new`.
	*/
	get newSessionResponse() {
		return this.sessionResponse;
	}
	/**
	* Sends a prompt to this session.
	*
	* Strings are converted to one text content block. A single content block is
	* wrapped in an array. The returned promise resolves with the final
	* `PromptResponse`, and the same completion is also queued as a `stop`
	* message for `nextUpdate()`.
	*/
	prompt(prompt, options) {
		this.updates.clearErrors();
		const response = this.cx.request(AGENT_METHODS.session_prompt, {
			sessionId: this.sessionId,
			prompt: this.promptBlocks(prompt)
		}, options);
		response.then((value) => {
			this.updates.enqueue({
				kind: "stop",
				response: value,
				stopReason: value.stopReason
			});
		}, (error) => {
			this.updates.reject(error);
		});
		return response;
	}
	/**
	* Reads the next update or stop message for this session.
	*/
	nextUpdate() {
		return this.updates.next();
	}
	/**
	* Reads text chunks until the current prompt turn stops.
	*
	* Only `agent_message_chunk` updates with text content are appended. Other
	* update types are ignored by this helper; use `nextUpdate()` when you need
	* tool calls, plans, or the final `PromptResponse`.
	*/
	async readText() {
		let output = "";
		for (;;) {
			const message = await this.nextUpdate();
			if (message.kind === "stop") return output;
			const { update } = message;
			if (update.sessionUpdate === "agent_message_chunk" && update.content.type === "text") output += update.content.text;
		}
	}
	/**
	* Stops routing updates to this active-session helper.
	*
	* This does not close the ACP session on the agent. Use `ClientContext`
	* session lifecycle methods when the protocol session itself should be closed
	* or deleted.
	*/
	dispose() {
		for (const registration of this.registrations.splice(0)) registration.dispose();
		this.updates.fail(/* @__PURE__ */ new Error("Active session disposed"));
	}
	/**
	* Supports explicit resource management with `using`.
	*/
	[Symbol.dispose]() {
		this.dispose();
	}
	promptBlocks(prompt) {
		if (typeof prompt === "string") return [{
			type: "text",
			text: prompt
		}];
		if (Array.isArray(prompt)) return prompt;
		return [prompt];
	}
};
function requestSpec(method, params, mapResponse) {
	return {
		method,
		params: (value) => parseParams(params, value ?? {}),
		mapResponse
	};
}
function notificationSpec(method, params) {
	return {
		method,
		params
	};
}
function specsByMethod(specs) {
	const byMethod = {};
	for (const spec of Object.values(specs)) byMethod[spec.method] = spec;
	return byMethod;
}
var agentRequestSpecs = {
	initialize: requestSpec(AGENT_METHODS.initialize, zInitializeRequest),
	newSession: requestSpec(AGENT_METHODS.session_new, zNewSessionRequest),
	loadSession: requestSpec(AGENT_METHODS.session_load, zLoadSessionRequest, emptyObjectResponse),
	unstable_forkSession: requestSpec(AGENT_METHODS.session_fork, zForkSessionRequest),
	listSessions: requestSpec(AGENT_METHODS.session_list, zListSessionsRequest),
	deleteSession: requestSpec(AGENT_METHODS.session_delete, zDeleteSessionRequest, emptyObjectResponse),
	unstable_archiveSession: requestSpec(AGENT_METHODS.session_archive, zArchiveSessionRequest, emptyObjectResponse),
	unstable_unarchiveSession: requestSpec(AGENT_METHODS.session_unarchive, zUnarchiveSessionRequest, emptyObjectResponse),
	unstable_sessionStatus: requestSpec(AGENT_METHODS.session_status, zSessionStatusRequest),
	unstable_sessionOptions: requestSpec(AGENT_METHODS.session_options, zSessionOptionsRequest),
	unstable_setSessionTitle: requestSpec(AGENT_METHODS.session_set_title, zSetSessionTitleRequest),
	resumeSession: requestSpec(AGENT_METHODS.session_resume, zResumeSessionRequest),
	closeSession: requestSpec(AGENT_METHODS.session_close, zCloseSessionRequest, emptyObjectResponse),
	setSessionMode: requestSpec(AGENT_METHODS.session_set_mode, zSetSessionModeRequest, emptyObjectResponse),
	setSessionConfigOption: requestSpec(AGENT_METHODS.session_set_config_option, zSetSessionConfigOptionRequest),
	authenticate: requestSpec(AGENT_METHODS.authenticate, zAuthenticateRequest, emptyObjectResponse),
	unstable_listProviders: requestSpec(AGENT_METHODS.providers_list, zListProvidersRequest),
	unstable_setProvider: requestSpec(AGENT_METHODS.providers_set, zSetProviderRequest, emptyObjectResponse),
	unstable_disableProvider: requestSpec(AGENT_METHODS.providers_disable, zDisableProviderRequest, emptyObjectResponse),
	logout: requestSpec(AGENT_METHODS.logout, zLogoutRequest, emptyObjectResponse),
	unstable_authStatus: requestSpec(AGENT_METHODS.auth_status, zAuthStatusRequest),
	prompt: requestSpec(AGENT_METHODS.session_prompt, zPromptRequest)
};
var agentNotificationSpecs = {
	cancel: notificationSpec(AGENT_METHODS.session_cancel, zCancelNotification),
	unstable_messageMcp: notificationSpec(AGENT_METHODS.mcp_message, zMessageMcpNotification)
};
var clientRequestSpecs = {
	requestPermission: requestSpec(CLIENT_METHODS.session_request_permission, zRequestPermissionRequest),
	writeTextFile: requestSpec(CLIENT_METHODS.fs_write_text_file, zWriteTextFileRequest, emptyObjectResponse),
	readTextFile: requestSpec(CLIENT_METHODS.fs_read_text_file, zReadTextFileRequest),
	createTerminal: requestSpec(CLIENT_METHODS.terminal_create, zCreateTerminalRequest),
	terminalOutput: requestSpec(CLIENT_METHODS.terminal_output, zTerminalOutputRequest),
	releaseTerminal: requestSpec(CLIENT_METHODS.terminal_release, zReleaseTerminalRequest, emptyObjectResponse),
	waitForTerminalExit: requestSpec(CLIENT_METHODS.terminal_wait_for_exit, zWaitForTerminalExitRequest),
	killTerminal: requestSpec(CLIENT_METHODS.terminal_kill, zKillTerminalRequest, emptyObjectResponse),
	createElicitation: requestSpec(CLIENT_METHODS.elicitation_create, zCreateElicitationRequest),
	unstable_messageMcp: requestSpec(CLIENT_METHODS.mcp_message, zMessageMcpRequest)
};
var clientNotificationSpecs = {
	sessionUpdate: notificationSpec(CLIENT_METHODS.session_update, zSessionNotification),
	completeElicitation: notificationSpec(CLIENT_METHODS.elicitation_complete, zCompleteElicitationNotification),
	unstable_authStatusUpdate: notificationSpec(CLIENT_METHODS.auth_status_update, zAuthStatusUpdateNotification)
};
var agentRequestSpecsByMethod = specsByMethod(agentRequestSpecs);
var agentNotificationSpecsByMethod = specsByMethod(agentNotificationSpecs);
var clientRequestSpecsByMethod = specsByMethod(clientRequestSpecs);
specsByMethod(clientNotificationSpecs);
function agentRequestContext(params, client, signal, requestId, method) {
	return {
		method,
		params,
		requestId,
		signal,
		client
	};
}
function agentNotificationContext(params, client, signal, method) {
	return {
		method,
		params,
		signal,
		client
	};
}
var SessionUpdateRouter = class {
	activeSessions = /* @__PURE__ */ new Map();
	handleMessage(message) {
		if (message.kind !== "notification" || message.method !== CLIENT_METHODS.session_update) return Handled.no(message);
		const notification = zSessionNotification.parse(message.params);
		const update = {
			kind: "session_update",
			notification,
			update: notification.update
		};
		const activeSessions = this.activeSessions.get(notification.sessionId);
		if (activeSessions && activeSessions.size > 0) for (const session of activeSessions) session.enqueue(update);
		return Handled.no(message);
	}
	attach(response, updates) {
		const sessions = this.activeSessions.get(response.sessionId) ?? /* @__PURE__ */ new Set();
		sessions.add(updates);
		this.activeSessions.set(response.sessionId, sessions);
		return new HandlerRegistration(() => {
			sessions.delete(updates);
			if (sessions.size === 0) this.activeSessions.delete(response.sessionId);
		});
	}
};
var sessionUpdateRouters = /* @__PURE__ */ new WeakMap();
function sessionUpdateRouter(cx) {
	let router = sessionUpdateRouters.get(cx);
	if (!router) {
		router = new SessionUpdateRouter();
		sessionUpdateRouters.set(cx, router);
	}
	return router;
}
function runConnectHandlers(connection, handlers) {
	for (const handler of handlers) {
		let result;
		try {
			result = handler(connection);
		} catch (error) {
			connection.close(error);
			throw error;
		}
		Promise.resolve(result).catch((error) => {
			connection.close(error);
		});
	}
}
var appBuilder = Symbol("appBuilder");
var runAgentConnectHandlers = Symbol("runAgentConnectHandlers");
var runClientConnectHandlers = Symbol("runClientConnectHandlers");
/**
* Creates an agent-side app.
*
* Register request and notification handlers by ACP method name, then call
* `connect(stream)` to serve an ACP client.
*/
function agent(options) {
	return new AgentApp(options);
}
/**
* Agent-side app builder.
*
* Methods on this class register typed request or notification handlers and
* return `this`, so apps can be built with a fluent chain. Handler params are
* parsed with the generated ACP schemas before your handler runs, and thrown
* errors are converted to JSON-RPC errors by the connection layer.
*/
var AgentApp = class {
	builder = Connection.builder();
	connectHandlers = [];
	fallbackKinds = /* @__PURE__ */ new Set();
	hasInitializeHandler = false;
	constructor(options = {}) {
		this.builder.withHandler(agentInitializationGate(() => this.hasInitializeHandler));
		if (options.name) this.builder.name(options.name);
	}
	/** @internal */
	[appBuilder]() {
		return this.builder;
	}
	/** @internal */
	[runAgentConnectHandlers](connection) {
		runConnectHandlers(connection, this.connectHandlers);
	}
	connect(target, options = {}) {
		return this.connectConnection(target, options).connection;
	}
	/**
	* Connects this agent app to a stream or client app for the lifetime of `op`.
	*
	* The callback receives an `AgentContext` for calling client-side methods.
	* When `op` resolves or rejects, the connection is closed.
	*/
	connectWith(target, op) {
		const { rawConnection, connection } = this.connectConnection(target);
		return rawConnection.runUntil(() => op(connection.client));
	}
	/**
	* Registers a handler that runs when this agent app opens a connection.
	*
	* Use this for connection-scoped work that needs to call client-side ACP
	* methods outside an inbound request handler, or to set up per-connection
	* state that the request handlers use.
	*
	* Handlers are called synchronously in registration order and are not
	* awaited. A handler that throws or rejects closes the connection. When they
	* are called depends on who opens the connection:
	*
	* - `connect(...)` and `connectWith(...)` call them before the connection
	*   handles its first inbound message, and so does the experimental
	*   `AgentProtocolRouter`'s `connect(...)` when it routes to this app. Only
	*   the work a handler does before its first `await` is guaranteed to come
	*   first.
	* - The experimental `AcpServer` calls them after the client has completed
	*   `initialize`, so messages they send cannot replace the initialize
	*   response. Request handlers, including `initialize`, can run before them.
	*/
	onConnect(handler) {
		this.connectHandlers.push(handler);
		return this;
	}
	onRequest(method, handlerOrParams, handler) {
		if (method === "*") {
			if (handler) throw new Error("Wildcard handlers receive raw params; omit the parser.");
			if (this.fallbackKinds.has("request")) throw new Error("A request fallback is already registered.");
			this.fallbackKinds.add("request");
			return this.request({ method }, handlerOrParams);
		}
		if (handler) return this.request({
			method,
			params: handlerOrParams
		}, handler);
		const spec = agentRequestSpecsByMethod[method];
		if (!spec) throw new Error(`Unknown ACP request method '${method}'. Pass a params parser for custom methods.`);
		if (method === AGENT_METHODS.initialize) this.hasInitializeHandler = true;
		return this.request(spec, handlerOrParams);
	}
	onNotification(method, handlerOrParams, handler) {
		if (method === "*") {
			if (handler) throw new Error("Wildcard handlers receive raw params; omit the parser.");
			if (this.fallbackKinds.has("notification")) throw new Error("A notification fallback is already registered.");
			this.fallbackKinds.add("notification");
			return this.notification({ method }, handlerOrParams);
		}
		if (handler) return this.notification({
			method,
			params: handlerOrParams
		}, handler);
		const spec = agentNotificationSpecsByMethod[method];
		if (!spec) throw new Error(`Unknown ACP notification method '${method}'. Pass a params parser for custom methods.`);
		return this.notification(spec, handlerOrParams);
	}
	request(spec, handler) {
		registerAppRequest(this.builder, spec, (params, cx, signal, requestId, method) => agentRequestContext(params, AgentContext.create(cx, requestId), signal, requestId, method), handler, spec.mapResponse);
		return this;
	}
	notification(spec, handler) {
		registerAppNotification(this.builder, spec, (params, cx, signal, method) => agentNotificationContext(params, AgentContext.create(cx), signal, method), handler);
		return this;
	}
	connectConnection(target, options = {}) {
		if (isStream(target)) {
			const state = this.openStreamConnection(target);
			if (!options.deferConnectHandlers) this[runAgentConnectHandlers](state.connection);
			return state;
		}
		const [thisStream, peerStream] = memoryStreamPair();
		const peerRawConnection = target[appBuilder]().connect(peerStream);
		const peerConnection = clientConnection(peerRawConnection);
		const state = this.openStreamConnection(thisStream);
		state.rawConnection.closed.then(() => peerConnection.close());
		peerRawConnection.closed.then(() => state.connection.close());
		try {
			target[runClientConnectHandlers](peerConnection);
			this[runAgentConnectHandlers](state.connection);
		} catch (error) {
			peerConnection.close(error);
			state.connection.close(error);
			throw error;
		}
		return state;
	}
	openStreamConnection(stream) {
		const rawConnection = this.builder.connect(stream);
		return {
			rawConnection,
			connection: agentConnection(rawConnection, this.connectHandlers)
		};
	}
};
/**
* Handle for controlling and monitoring a terminal created via `createTerminal`.
*
* Provides methods to:
* - Get current output without waiting
* - Wait for command completion
* - Kill the running command
* - Release terminal resources
*
* **Important:** Always call `release()` when done with the terminal to free resources.

* The terminal supports async disposal via `Symbol.asyncDispose` for automatic cleanup.

* You can use `await using` to ensure the terminal is automatically released when it
* goes out of scope.
*/
var TerminalHandle = class TerminalHandle {
	/**
	* Terminal identifier returned by `terminal/create`.
	*/
	id;
	sessionId;
	connection;
	constructor(id, sessionId, conn) {
		this.id = id;
		this.sessionId = sessionId;
		this.connection = conn;
	}
	/** @internal */
	static create(id, sessionId, conn) {
		return new TerminalHandle(id, sessionId, conn);
	}
	/**
	* Gets the current terminal output without waiting for the command to exit.
	*/
	currentOutput() {
		return this.connection.sendRequest(CLIENT_METHODS.terminal_output, {
			sessionId: this.sessionId,
			terminalId: this.id
		});
	}
	/**
	* Waits for the terminal command to complete and returns its exit status.
	*/
	waitForExit() {
		return this.connection.sendRequest(CLIENT_METHODS.terminal_wait_for_exit, {
			sessionId: this.sessionId,
			terminalId: this.id
		});
	}
	/**
	* Kills the terminal command without releasing the terminal.
	*
	* The terminal remains valid after killing, allowing you to:
	* - Get the final output with `currentOutput()`
	* - Check the exit status
	* - Release the terminal when done
	*
	* Useful for implementing timeouts or cancellation.
	*/
	kill() {
		return this.connection.sendRequest(CLIENT_METHODS.terminal_kill, {
			sessionId: this.sessionId,
			terminalId: this.id
		}, emptyObjectResponse);
	}
	/**
	* Releases the terminal and frees all associated resources.
	*
	* If the command is still running, it will be killed.
	* After release, the terminal ID becomes invalid and cannot be used
	* with other terminal methods.
	*
	* Tool calls that already reference this terminal will continue to
	* display its output.
	*
	* **Important:** Always call this method when done with the terminal.
	*/
	release() {
		return this.connection.sendRequest(CLIENT_METHODS.terminal_release, {
			sessionId: this.sessionId,
			terminalId: this.id
		}, emptyObjectResponse);
	}
	/**
	* Releases the terminal when used with `await using`.
	*/
	async [Symbol.asyncDispose]() {
		await this.release();
	}
};
// ../code-for-antigravity/node_modules/@agentclientprotocol/sdk/dist/mcp/core.js
/**
* ACP method that carries MCP requests and request-scoped notifications.
*/
var MCP_MESSAGE_METHOD = "mcp/message";
/**
* The only MCP revision this binding supports.
*/
var MCP_PROTOCOL_VERSION = "2026-07-28";
/**
* Inner MCP `_meta` key carrying the request's MCP protocol version.
*/
var MCP_META_PROTOCOL_VERSION = "io.modelcontextprotocol/protocolVersion";
/**
* Inner MCP `_meta` key carrying the caller's MCP client capabilities.
*/
var MCP_META_CLIENT_CAPABILITIES = "io.modelcontextprotocol/clientCapabilities";
/**
* Inner MCP `_meta` key carrying the caller's MCP client info.
*/
var MCP_META_CLIENT_INFO = "io.modelcontextprotocol/clientInfo";
/**
* Outer ACP error codes reserved for failures of the MCP-over-ACP binding.
*
* These are never inner MCP error codes. An inner MCP error travels inside a
* successful ACP response's `error` carrier instead.
*/
var McpBindingErrorCode = {
	/** Malformed envelope, or a duplicate active `(serverId, requestId)`. */
	invalidParams: -32602,
	/** The ACP operation was cancelled. */
	requestCancelled: -32800,
	/** A binding resource limit was exceeded. */
	resourceLimitExceeded: -33e3,
	/** No registration is available for the requested server ID. */
	serverUnavailable: -33001,
	/** The backend or transport failed without a valid MCP outcome. */
	backendFailed: -33002
};
/** @hidden */
function generateId(prefix) {
	return `${prefix}:${globalThis.crypto.randomUUID()}`;
}
function routeKey(serverId, requestId) {
	return JSON.stringify([serverId, requestId]);
}
/**
* Like `isRecord` from the JSON-RPC core, but rejects arrays.
*
* @hidden
*/
function isJsonObject(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
function optionalObject(value) {
	if (value === void 0 || value === null) return void 0;
	return isJsonObject(value) ? value : false;
}
function envelopeOf(params) {
	return {
		serverId: params.serverId,
		requestId: params.requestId,
		method: params.method,
		params: params.params ?? void 0,
		meta: params._meta ?? void 0
	};
}
function isMcpErrorObject(value) {
	return isJsonObject(value) && Number.isInteger(value.code) && typeof value.message === "string";
}
/**
* Parses a received `mcp/message` response carrier.
*
* Returns `undefined` if the value is not a valid carrier. When both `result`
* and `error` are present, `result` wins.
*/
function parseMcpOutcome(value) {
	if (!isJsonObject(value)) return void 0;
	const meta = optionalObject(value._meta);
	const carrierMeta = meta === false || meta === void 0 ? {} : { _meta: meta };
	if (Object.hasOwn(value, "result")) return {
		result: value.result,
		...carrierMeta
	};
	if (isMcpErrorObject(value.error)) return {
		error: value.error,
		...carrierMeta
	};
}
/**
* Adds the per-request MCP metadata required by MCP 2026-07-28, without
* overriding values the caller already supplied.
*/
function withMcpRequestMeta(params, options = {}) {
	const base = params ?? {};
	const meta = { ...optionalObject(base._meta) || {} };
	if (!Object.hasOwn(meta, "io.modelcontextprotocol/protocolVersion")) meta[MCP_META_PROTOCOL_VERSION] = MCP_PROTOCOL_VERSION;
	if (!Object.hasOwn(meta, "io.modelcontextprotocol/clientCapabilities")) meta[MCP_META_CLIENT_CAPABILITIES] = options.clientCapabilities ?? {};
	if (options.clientInfo && !Object.hasOwn(meta, "io.modelcontextprotocol/clientInfo")) meta[MCP_META_CLIENT_INFO] = options.clientInfo;
	return {
		...base,
		_meta: meta
	};
}
/**
* Per-connection state, dropped when the connection is garbage collected.
*/
var ConnectionState = class {
	create;
	states = /* @__PURE__ */ new WeakMap();
	constructor(create) {
		this.create = create;
	}
	get(cx) {
		let state = this.states.get(cx);
		if (!state) {
			state = this.create();
			this.states.set(cx, state);
		}
		return state;
	}
	peek(cx) {
		return this.states.get(cx);
	}
};
/**
* Calls MCP servers that an ACP peer declared with `"type": "acp"`.
*
* Create one caller per app and register {@link handleNotification} for
* `mcp/message` notifications so progress and subscription events reach the
* request that owns them:
*
* ```ts
* const mcp = new McpOverAcpCaller({ clientInfo: { name: "my-agent", version: "1" } });
* agent()
*   .onNotification(methods.agent.mcp.message, mcp.handleNotification)
*   .onRequest(methods.agent.session.prompt, async ({ client }) => {
*     const outcome = await mcp.request(client, serverId, "tools/call", { name, arguments: {} });
*     // ...
*   });
* ```
*/
var McpOverAcpCaller = class {
	options;
	connections = new ConnectionState(() => /* @__PURE__ */ new Map());
	constructor(options = {}) {
		this.options = options;
	}
	/**
	* Sends one MCP request to a declared server over the connection behind
	* `context`, and returns its inner outcome.
	*
	* Required MCP 2026-07-28 metadata is added to `params._meta` unless already
	* present. Outer ACP failures, including cancellation and binding errors,
	* reject with a `RequestError`; inner MCP errors resolve as `{ error }`.
	*/
	async request(context, serverId, method, params, options = {}) {
		const cx = connectionOf(context);
		const routes = this.connections.get(cx);
		const requestId = options.requestId ?? generateId("mcp-request");
		const key = routeKey(serverId, requestId);
		if (routes.has(key)) throw new Error(`MCP request ${requestId} is already active for server ${serverId}`);
		routes.set(key, options.onNotification ?? (() => {}));
		try {
			const response = await cx.sendRequest(MCP_MESSAGE_METHOD, {
				serverId,
				requestId,
				method,
				params: withMcpRequestMeta(params, this.options),
				...options._meta ? { _meta: options._meta } : {}
			}, void 0, options.signal ? { cancellationSignal: options.signal } : void 0);
			const outcome = parseMcpOutcome(response);
			if (!outcome) throw new RequestError(McpBindingErrorCode.backendFailed, "Invalid MCP-over-ACP response carrier", { response });
			return outcome;
		} finally {
			routes.delete(key);
		}
	}
	/**
	* Handles an incoming `mcp/message` notification. Register it with
	* `onNotification(methods.agent.mcp.message, caller.handleNotification)`.
	*
	* Notifications for unknown or already completed requests are dropped.
	*/
	handleNotification = (context) => {
		const envelope = envelopeOf(context.params);
		const listener = this.connections.peek(connectionOf(context.client))?.get(routeKey(envelope.serverId, envelope.requestId));
		if (!listener) return;
		try {
			listener({
				method: envelope.method,
				...envelope.params === void 0 ? {} : { params: envelope.params },
				...envelope.meta === void 0 ? {} : { _meta: envelope.meta }
			});
		} catch (error) {
			console.error("MCP-over-ACP notification listener failed", error);
		}
	};
};
// src/sseStream.ts
/**
* Splits inline `<think>...</think>` blocks emitted by models like DeepSeek-R1, Qwen3, or Ollama reasoning
* variants into separate `'thought'` vs `'text'` chunks in real time across arbitrary SSE chunk boundaries.
*/
var ThinkTagSplitter = class {
	inThink = false;
	carry = "";
	sawLeadingContent = false;
	push(chunk) {
		if (!chunk) return [];
		const out = [];
		let buf = this.carry + chunk;
		this.carry = "";
		const emit = (type, text) => {
			if (!text) return;
			const prev = out[out.length - 1];
			if (prev && prev.type === type) prev.text += text;
			else out.push({
				type,
				text
			});
		};
		while (buf.length > 0) if (!this.inThink) {
			const openIdx = buf.indexOf("<think>");
			if (openIdx >= 0) {
				const before = buf.slice(0, openIdx);
				if (before.trim()) this.sawLeadingContent = true;
				if (before) emit("text", before);
				this.inThink = true;
				buf = buf.slice(openIdx + 7);
				continue;
			}
			const partial = partialSuffix(buf, "<think>");
			if (partial > 0 && (!this.sawLeadingContent || buf.endsWith("<") || buf.includes("<t"))) {
				const safe = buf.slice(0, buf.length - partial);
				if (safe.trim()) this.sawLeadingContent = true;
				if (safe) emit("text", safe);
				this.carry = buf.slice(buf.length - partial);
				break;
			}
			if (buf.trim()) this.sawLeadingContent = true;
			emit("text", buf);
			break;
		} else {
			const closeIdx = buf.indexOf("</think>");
			if (closeIdx >= 0) {
				const inside = buf.slice(0, closeIdx);
				if (inside) emit("thought", inside);
				this.inThink = false;
				buf = buf.slice(closeIdx + 8);
				if (buf.startsWith("\r\n")) buf = buf.slice(2);
				else if (buf.startsWith("\n")) buf = buf.slice(1);
				continue;
			}
			const partial = partialSuffix(buf, "</think>");
			if (partial > 0) {
				const safe = buf.slice(0, buf.length - partial);
				if (safe) emit("thought", safe);
				this.carry = buf.slice(buf.length - partial);
				break;
			}
			emit("thought", buf);
			break;
		}
		return out;
	}
	flush() {
		if (!this.carry) return [];
		const rem = this.carry;
		this.carry = "";
		return [{
			type: this.inThink ? "thought" : "text",
			text: rem
		}];
	}
};
function partialSuffix(text, tag) {
	const max = Math.min(text.length, tag.length - 1);
	for (let len = max; len >= 1; len--) if (tag.startsWith(text.slice(text.length - len))) return len;
	return 0;
}
function joinApiUrl(baseUrl, suffix) {
	return `${baseUrl.trim().replace(/\/+$/, "")}${suffix.startsWith("/") ? suffix : `/${suffix}`}`;
}
async function probeHttpOk(url, timeoutMs = 1200) {
	try {
		return (await fetch(url, { signal: AbortSignal.timeout(timeoutMs) })).ok;
	} catch {
		return false;
	}
}
async function fetchRemoteModels(baseUrl, headers, timeoutMs = 6e3) {
	const url = joinApiUrl(baseUrl, "/models");
	const res = await fetch(url, {
		method: "GET",
		headers: {
			Accept: "application/json",
			...headers
		},
		signal: AbortSignal.timeout(timeoutMs)
	});
	if (!res.ok) {
		const body = await res.text().catch(() => "");
		throw new Error(`GET ${url} failed (${res.status}): ${body.slice(0, 240)}`);
	}
	const json = await res.json();
	return (Array.isArray(json?.data) ? json.data : Array.isArray(json?.models) ? json.models : []).filter((m) => m && typeof m.id === "string" && m.id.trim()).map((m) => ({
		id: String(m.id).trim(),
		...typeof m.name === "string" && m.name.trim() ? { name: m.name.trim() } : {},
		...Number(m.context_length ?? m.max_input_tokens ?? 0) > 0 ? { contextLength: Number(m.context_length ?? m.max_input_tokens) } : {},
		...m.pricing?.prompt != null && !Number.isNaN(Number(m.pricing.prompt)) ? { pricingPromptPerToken: Number(m.pricing.prompt) } : {},
		...m.pricing?.completion != null && !Number.isNaN(Number(m.pricing.completion)) ? { pricingCompletionPerToken: Number(m.pricing.completion) } : {}
	}));
}
async function streamChatCompletion(opts) {
	const url = joinApiUrl(opts.baseUrl, "/chat/completions");
	const sanitizedMessages = opts.messages.map((m) => {
		const out = {
			role: m.role,
			content: m.content ?? ""
		};
		if (m.name) out.name = m.name;
		if (m.tool_call_id) out.tool_call_id = m.tool_call_id;
		if (m.tool_calls?.length) out.tool_calls = m.tool_calls;
		return out;
	});
	const buildBody = (compatLevel) => {
		const body = {
			model: opts.model,
			messages: sanitizedMessages,
			stream: true
		};
		if (opts.tools?.length) {
			body.tools = opts.tools;
			if (compatLevel === 0) body.tool_choice = "auto";
		}
		if (opts.maxTokens && opts.maxTokens > 0) body.max_tokens = opts.maxTokens;
		if (opts.temperature !== void 0) body.temperature = opts.temperature;
		if (compatLevel === 0) {
			body.stream_options = { include_usage: true };
			const eff = opts.reasoning;
			if (eff && eff !== "none") {
				if (opts.providerFlavor === "openrouter") body.reasoning = { effort: eff };
				else if (opts.providerFlavor !== "ollama") body.reasoning_effort = eff;
			}
		} else if (compatLevel === 1) {
			if (opts.providerFlavor !== "ollama") body.stream_options = { include_usage: true };
		}
		return body;
	};
	let res = null;
	let lastErrText = "";
	for (const level of [
		0,
		1,
		2
	]) {
		res = await fetch(url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Accept: "text/event-stream, application/json",
				...opts.headers
			},
			body: JSON.stringify(buildBody(level)),
			signal: opts.signal
		});
		if (res.ok) break;
		lastErrText = await res.text().catch(() => "");
		if (!(res.status === 400 && level < 2 && /reasoning|stream_options|tool_choice|unknown|unrecognized|extra_forbidden|unsupported|invalid/i.test(lastErrText))) throw new Error(formatApiError(res.status, lastErrText, url));
	}
	if (!res || !res.ok) throw new Error(formatApiError(res?.status ?? 500, lastErrText, url));
	const ctype = (res.headers.get("content-type") ?? "").toLowerCase();
	if (!ctype.includes("text/event-stream") && ctype.includes("application/json")) return parseNonStreamingResponse(await res.json(), opts.onDelta);
	if (!res.body) throw new Error("Empty response body from model endpoint.");
	const splitter = new ThinkTagSplitter();
	let fullText = "";
	let fullThought = "";
	let finishReason = "stop";
	let resolvedModel;
	const toolMap = /* @__PURE__ */ new Map();
	const usage = {
		inputTokens: 0,
		outputTokens: 0,
		thoughtTokens: 0,
		cachedReadTokens: 0,
		totalTokens: 0
	};
	const emitEvents = async (events) => {
		for (const ev of events) {
			if (!ev.text) continue;
			if (ev.type === "thought") fullThought += ev.text;
			else fullText += ev.text;
			await opts.onDelta?.(ev);
		}
	};
	const reader = res.body.getReader();
	const decoder = new TextDecoder();
	let buffer = "";
	const processLine = async (rawLine) => {
		const line = rawLine.trim();
		if (!line || line.startsWith(":")) return;
		if (!line.startsWith("data:")) return;
		const payload = line.slice(5).trim();
		if (!payload || payload === "[DONE]") return;
		let chunk;
		try {
			chunk = JSON.parse(payload);
		} catch {
			return;
		}
		if (chunk?.error) {
			const msg = typeof chunk.error === "string" ? chunk.error : chunk.error.message ?? JSON.stringify(chunk.error);
			throw new Error(String(msg));
		}
		if (typeof chunk?.model === "string" && chunk.model) resolvedModel = chunk.model;
		if (chunk?.usage) applyUsageObject(usage, chunk.usage);
		const choice = Array.isArray(chunk?.choices) ? chunk.choices[0] : void 0;
		if (!choice) return;
		if (typeof choice.finish_reason === "string" && choice.finish_reason) finishReason = choice.finish_reason;
		const delta = choice.delta ?? choice.message ?? {};
		const explicitThought = extractReasoningDelta(delta);
		if (explicitThought) await emitEvents([{
			type: "thought",
			text: explicitThought
		}]);
		if (typeof delta.content === "string" && delta.content) await emitEvents(splitter.push(delta.content));
		else if (Array.isArray(delta.content)) {
			for (const part of delta.content) if (part?.type === "thinking" || part?.type === "reasoning") {
				const t = String(part.thinking ?? part.text ?? "");
				if (t) await emitEvents([{
					type: "thought",
					text: t
				}]);
			} else if (typeof part?.text === "string" && part.text) await emitEvents(splitter.push(part.text));
		}
		if (Array.isArray(delta.tool_calls)) for (let i = 0; i < delta.tool_calls.length; i++) {
			const tc = delta.tool_calls[i];
			const idx = typeof tc?.index === "number" ? tc.index : i;
			let slot = toolMap.get(idx);
			if (!slot) {
				slot = {
					id: "",
					name: "",
					args: ""
				};
				toolMap.set(idx, slot);
			}
			if (typeof tc?.id === "string" && tc.id) slot.id = tc.id;
			if (typeof tc?.function?.name === "string" && tc.function.name) slot.name += tc.function.name;
			if (typeof tc?.function?.arguments === "string" && tc.function.arguments) slot.args += tc.function.arguments;
		}
	};
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		buffer += decoder.decode(value, { stream: true });
		let nl;
		while ((nl = buffer.indexOf("\n")) >= 0) {
			const line = buffer.slice(0, nl);
			buffer = buffer.slice(nl + 1);
			await processLine(line);
		}
	}
	buffer += decoder.decode();
	if (buffer.trim()) for (const rem of buffer.split("\n")) await processLine(rem);
	await emitEvents(splitter.flush());
	const toolCalls = [...toolMap.entries()].sort((a, b) => a[0] - b[0]).filter(([, v]) => v.name.trim().length > 0).map(([idx, v]) => ({
		id: v.id || `call_${idx + 1}_${Date.now()}`,
		type: "function",
		function: {
			name: v.name.trim(),
			arguments: v.args.trim() || "{}"
		}
	}));
	if (usage.totalTokens === 0 && (fullText || fullThought || toolCalls.length)) {
		usage.outputTokens = Math.max(1, Math.ceil((fullText.length + fullThought.length) / 4));
		usage.thoughtTokens = fullThought ? Math.ceil(fullThought.length / 4) : 0;
		usage.totalTokens = usage.inputTokens + usage.outputTokens;
	}
	return {
		content: fullText,
		thought: fullThought,
		toolCalls,
		finishReason: toolCalls.length && finishReason === "stop" ? "tool_calls" : finishReason,
		model: resolvedModel ?? opts.model,
		usage
	};
}
async function parseNonStreamingResponse(json, onDelta) {
	if (json?.error) {
		const msg = typeof json.error === "string" ? json.error : json.error.message ?? JSON.stringify(json.error);
		throw new Error(String(msg));
	}
	const choice = Array.isArray(json?.choices) ? json.choices[0] : void 0;
	const msg = choice?.message ?? {};
	const splitter = new ThinkTagSplitter();
	let content = "";
	let thought = "";
	const explicit = extractReasoningDelta(msg);
	if (explicit) {
		thought += explicit;
		await onDelta?.({
			type: "thought",
			text: explicit
		});
	}
	if (typeof msg.content === "string" && msg.content) for (const ev of [...splitter.push(msg.content), ...splitter.flush()]) {
		if (ev.type === "thought") thought += ev.text;
		else content += ev.text;
		await onDelta?.(ev);
	}
	const toolCalls = Array.isArray(msg.tool_calls) ? msg.tool_calls.filter((tc) => tc?.function?.name).map((tc, idx) => ({
		id: String(tc.id || `call_${idx + 1}_${Date.now()}`),
		type: "function",
		function: {
			name: String(tc.function.name),
			arguments: typeof tc.function.arguments === "string" ? tc.function.arguments : JSON.stringify(tc.function.arguments ?? {})
		}
	})) : [];
	const usage = {
		inputTokens: 0,
		outputTokens: 0,
		thoughtTokens: 0,
		cachedReadTokens: 0,
		totalTokens: 0
	};
	if (json?.usage) applyUsageObject(usage, json.usage);
	return {
		content,
		thought,
		toolCalls,
		finishReason: String(choice?.finish_reason ?? (toolCalls.length ? "tool_calls" : "stop")),
		model: typeof json?.model === "string" ? json.model : void 0,
		usage
	};
}
function extractReasoningDelta(delta) {
	if (!delta || typeof delta !== "object") return "";
	if (typeof delta.reasoning === "string" && delta.reasoning) return delta.reasoning;
	if (typeof delta.reasoning_content === "string" && delta.reasoning_content) return delta.reasoning_content;
	if (Array.isArray(delta.reasoning_details)) return delta.reasoning_details.map((d) => typeof d?.text === "string" ? d.text : typeof d?.summary === "string" ? d.summary : "").join("");
	return "";
}
function applyUsageObject(target, u) {
	const prompt = Number(u.prompt_tokens ?? u.input_tokens ?? 0);
	const completion = Number(u.completion_tokens ?? u.output_tokens ?? 0);
	const total = Number(u.total_tokens ?? prompt + completion);
	const reasoning = Number(u.completion_tokens_details?.reasoning_tokens ?? u.reasoning_tokens ?? 0);
	const cached = Number(u.prompt_tokens_details?.cached_tokens ?? u.cache_read_input_tokens ?? 0);
	if (prompt > 0) target.inputTokens = Math.max(0, prompt - cached);
	if (cached > 0) target.cachedReadTokens = cached;
	if (completion > 0) target.outputTokens = completion;
	if (reasoning > 0) target.thoughtTokens = reasoning;
	if (total > 0) target.totalTokens = total;
	const cost = u.cost ?? u.total_cost;
	if (typeof cost === "number" && Number.isFinite(cost) && cost >= 0) target.costUsd = cost;
}
function formatApiError(status, bodyText, url) {
	let detail = bodyText.trim();
	try {
		const parsed = JSON.parse(detail);
		const msg = parsed?.error?.message ?? parsed?.message ?? parsed?.error;
		if (msg) detail = typeof msg === "string" ? msg : JSON.stringify(msg);
	} catch {}
	return `${status === 401 || status === 403 ? "Authentication failed" : `Model API error (${status})`} at ${url}: ${detail.slice(0, 400) || `HTTP ${status}`}`;
}
// src/sessionStore.ts
var configuredSharedDir = "";
function setOlympusSharedDir(dir) {
	configuredSharedDir = dir.trim();
}
function olympusRootDir(sharedBase) {
	const base = sharedBase?.trim() || configuredSharedDir || ".olympus-state";
	const dir = join(base, "olympus-cli");
	mkdirSync(dir, { recursive: true });
	return dir;
}
var settingsFile = (sharedBase) => join(olympusRootDir(sharedBase), "settings.json");
function loadCliSettings(sharedBase) {
	const f = settingsFile(sharedBase);
	if (!existsSync(f)) return {};
	try {
		const parsed = JSON.parse(readFileSync(f, "utf8"));
		return parsed && typeof parsed === "object" ? parsed : {};
	} catch {
		return {};
	}
}
function saveCliSettings(patch, sharedBase) {
	const next = {
		...loadCliSettings(sharedBase),
		...patch
	};
	for (const k of Object.keys(next)) if (next[k] === void 0 || next[k] === "") delete next[k];
	writeFileSync(settingsFile(sharedBase), JSON.stringify(next, null, 2));
	return next;
}
function clearSavedCliSettingsKey(sharedBase) {
	const cur = loadCliSettings(sharedBase);
	delete cur.providerKey;
	writeFileSync(settingsFile(sharedBase), JSON.stringify(cur, null, 2));
}
function sessionsDir() {
	const d = join(olympusRootDir(), "sessions");
	mkdirSync(d, { recursive: true });
	return d;
}
var safeFileId = (id) => id.replace(/[^A-Za-z0-9_-]/g, "_");
var sessionFile = (id) => join(sessionsDir(), `${safeFileId(id)}.json`);
function createStoredSession(init) {
	const now = Date.now();
	const s = {
		sessionId: `oly_${randomUUID()}`,
		cwd: init.cwd,
		...init.additionalDirectories?.length ? { additionalDirectories: init.additionalDirectories } : {},
		createdAt: now,
		updatedAt: now,
		model: init.model,
		mode: init.mode ?? "code",
		reasoning: init.reasoning ?? "medium",
		...init.systemPrompt ? { systemPrompt: init.systemPrompt } : {},
		messages: [],
		updates: [],
		usage: {
			usedTokens: 0,
			contextSize: init.contextSize ?? 2e5,
			costUsd: 0
		},
		todos: []
	};
	saveStoredSession(s);
	return s;
}
function readStoredSession(sessionId) {
	const f = sessionFile(sessionId);
	if (!existsSync(f)) return null;
	try {
		const raw = JSON.parse(readFileSync(f, "utf8"));
		return raw && typeof raw.sessionId === "string" ? raw : null;
	} catch {
		return null;
	}
}
function saveStoredSession(s) {
	s.updatedAt = Date.now();
	writeFileSync(sessionFile(s.sessionId), JSON.stringify(s));
}
function deleteStoredSession(sessionId) {
	const f = sessionFile(sessionId);
	if (!existsSync(f)) return false;
	rmSync(f, { force: true });
	return true;
}
function forkStoredSession(source, overrides) {
	const now = Date.now();
	const copy = {
		...JSON.parse(JSON.stringify(source)),
		sessionId: `oly_${randomUUID()}`,
		cwd: overrides?.cwd ?? source.cwd,
		...overrides?.systemPrompt !== void 0 ? { systemPrompt: overrides.systemPrompt } : {},
		createdAt: now,
		updatedAt: now
	};
	saveStoredSession(copy);
	return copy;
}
function listStoredSessions(filter) {
	const dir = sessionsDir();
	const out = [];
	for (const name of readdirSync(dir)) {
		if (!name.endsWith(".json")) continue;
		try {
			const s = JSON.parse(readFileSync(join(dir, name), "utf8"));
			if (!s || typeof s.sessionId !== "string") continue;
			if (filter?.cwd && s.cwd !== filter.cwd) continue;
			const arch = Boolean(s.archived);
			if (filter?.archived === "only" && !arch) continue;
			if ((filter?.archived ?? "exclude") === "exclude" && arch) continue;
			out.push(s);
		} catch {}
	}
	return out.sort((a, b) => b.updatedAt - a.updatedAt);
}
// src/providers.ts
var SEP$1 = String.fromCharCode(47);
var slugId = (vendor, model) => `${vendor}${SEP$1}${model}`;
var LOOPBACK_HOST = [
	127,
	0,
	0,
	1
].join(".");
var GATEWAY_ENDPOINTS = {
	openrouter: `https:${SEP$1}${SEP$1}openrouter.ai${SEP$1}api${SEP$1}v1`,
	aiGateway: `https:${SEP$1}${SEP$1}ai-gateway.vercel.sh${SEP$1}v1`,
	ollama: `http:${SEP$1}${SEP$1}${LOOPBACK_HOST}:11434${SEP$1}v1`,
	openai: `https:${SEP$1}${SEP$1}api.openai.com${SEP$1}v1`
};
var FEATURED = "Featured Coding Models";
var OPEN_WEIGHTS = "Open-Weights & High Value";
var FREE_TIER = "Free Tier (OpenRouter)";
var CURATED_MODELS = [
	{
		id: slugId("anthropic", "claude-sonnet-4.5"),
		name: "Claude Sonnet 4.5",
		group: FEATURED,
		contextSize: 2e5,
		description: "Anthropic daily-driver coding & agentic tool-use model"
	},
	{
		id: slugId("anthropic", "claude-opus-4.5"),
		name: "Claude Opus 4.5",
		group: FEATURED,
		contextSize: 2e5,
		description: "Anthropic deepest reasoning & multi-file architecture model"
	},
	{
		id: slugId("openai", "gpt-5"),
		name: "GPT-5",
		group: FEATURED,
		contextSize: 4e5,
		description: "OpenAI frontier reasoning & software engineering model"
	},
	{
		id: slugId("openai", "gpt-5-mini"),
		name: "GPT-5 Mini",
		group: FEATURED,
		contextSize: 4e5,
		description: "Fast, low-cost OpenAI coding & tool-calling model"
	},
	{
		id: slugId("google", "gemini-2.5-pro"),
		name: "Gemini 2.5 Pro (1M)",
		group: FEATURED,
		contextSize: 1e6,
		description: "Google 1M-context reasoning & full-repo analysis model"
	},
	{
		id: slugId("google", "gemini-2.5-flash"),
		name: "Gemini 2.5 Flash (1M)",
		group: FEATURED,
		contextSize: 1e6,
		description: "High-speed, low-cost 1M-context multimodal coding model"
	},
	{
		id: slugId("deepseek", "deepseek-chat-v3-0324"),
		name: "DeepSeek V3 (0324)",
		group: OPEN_WEIGHTS,
		contextSize: 163840,
		description: "Strong open-weights coding model at ultra-low cost"
	},
	{
		id: slugId("deepseek", "deepseek-r1"),
		name: "DeepSeek R1",
		group: OPEN_WEIGHTS,
		contextSize: 163840,
		description: "Open-weights chain-of-thought reasoning model"
	},
	{
		id: slugId("qwen", "qwen3-coder"),
		name: "Qwen3 Coder",
		group: OPEN_WEIGHTS,
		contextSize: 262144,
		description: "Alibaba agentic coding specialist trained for multi-turn tool use"
	},
	{
		id: slugId("x-ai", "grok-code-fast-1"),
		name: "Grok Code Fast 1",
		group: OPEN_WEIGHTS,
		contextSize: 256e3,
		description: "xAI ultra-fast agentic coding model"
	},
	{
		id: slugId("mistralai", "codestral-2508"),
		name: "Codestral 2508",
		group: OPEN_WEIGHTS,
		contextSize: 256e3,
		description: "Mistral low-latency code generation & editing model"
	},
	{
		id: slugId("qwen", "qwen3-coder:free"),
		name: "Qwen3 Coder (Free)",
		group: FREE_TIER,
		contextSize: 131072,
		description: "Zero-cost OpenRouter tier for Qwen3 Coder"
	},
	{
		id: slugId("deepseek", "deepseek-chat-v3-0324:free"),
		name: "DeepSeek V3 (Free)",
		group: FREE_TIER,
		contextSize: 131072,
		description: "Zero-cost OpenRouter tier for DeepSeek V3"
	},
	{
		id: slugId("google", "gemini-2.0-flash-exp:free"),
		name: "Gemini 2.0 Flash Exp (Free)",
		group: FREE_TIER,
		contextSize: 1e6,
		description: "Zero-cost 1M-context experimental Flash model"
	}
];
function inferFlavorFromUrl(url) {
	const lc = url.toLowerCase();
	if (lc.includes("openrouter.ai")) return "openrouter";
	if (lc.includes("ai-gateway.vercel.sh")) return "ai-gateway";
	if (lc.includes(":11434") || lc.includes("ollama")) return "ollama";
	return "openai-compatible";
}
function defaultHeadersForFlavor(flavor) {
	if (flavor !== "openrouter") return {};
	return {
		"HTTP-Referer": `https:${SEP$1}${SEP$1}olympuscoder.app`,
		"X-Title": "Olympus Coder"
	};
}
function withToken(base, token) {
	if (!token?.trim()) return { ...base };
	return {
		...base,
		Authorization: `Bearer ${token.trim()}`
	};
}
function defaultModelForFlavor(flavor, preferred, cfgDefault) {
	if (preferred?.trim()) return preferred.trim();
	if (cfgDefault?.trim()) return cfgDefault.trim();
	if (flavor === "openrouter" || flavor === "ai-gateway") return slugId("anthropic", "claude-sonnet-4.5");
	if (flavor === "ollama") return "qwen2.5-coder:latest";
	return "gpt-4.1";
}
var trimTrailingSlashes = (u) => {
	let out = u.trim();
	while (out.endsWith(SEP$1)) out = out.slice(0, -1);
	return out;
};
function resolveEndpointConfig(inputs, override, ollamaDetected = false) {
	const cfg = loadCliSettings(inputs.sharedDir);
	if (override && override.baseUrl.trim()) {
		const baseUrl = trimTrailingSlashes(override.baseUrl);
		const flavor = inferFlavorFromUrl(baseUrl);
		return {
			configured: true,
			flavor,
			label: labelForFlavor(flavor, baseUrl),
			baseUrl,
			headers: {
				...defaultHeadersForFlavor(flavor),
				...override.headers
			},
			defaultModel: defaultModelForFlavor(flavor, inputs.defaultModel, cfg.defaultModel),
			accountHint: `${labelForFlavor(flavor, baseUrl)} (${safeHost(baseUrl)})`
		};
	}
	if (inputs.openRouterToken?.trim()) return {
		configured: true,
		flavor: "openrouter",
		label: "OpenRouter",
		baseUrl: trimTrailingSlashes(inputs.openRouterBaseUrl || GATEWAY_ENDPOINTS.openrouter),
		headers: withToken(defaultHeadersForFlavor("openrouter"), inputs.openRouterToken),
		defaultModel: defaultModelForFlavor("openrouter", inputs.defaultModel, cfg.defaultModel),
		accountHint: "OpenRouter (single key · 500+ models)"
	};
	if (inputs.aiGatewayToken?.trim()) return {
		configured: true,
		flavor: "ai-gateway",
		label: "Vercel AI Gateway",
		baseUrl: trimTrailingSlashes(inputs.aiGatewayBaseUrl || GATEWAY_ENDPOINTS.aiGateway),
		headers: withToken({}, inputs.aiGatewayToken),
		defaultModel: defaultModelForFlavor("ai-gateway", inputs.defaultModel, cfg.defaultModel),
		accountHint: "Vercel AI Gateway (0% markup · 400+ models)"
	};
	if (inputs.customToken?.trim() || inputs.customBaseUrl?.trim()) {
		const baseUrl = trimTrailingSlashes(inputs.customBaseUrl?.trim() || GATEWAY_ENDPOINTS.openai);
		const flavor = inferFlavorFromUrl(baseUrl);
		if (inputs.customToken?.trim() || isLoopbackUrl(baseUrl)) return {
			configured: true,
			flavor,
			label: labelForFlavor(flavor, baseUrl),
			baseUrl,
			headers: withToken(defaultHeadersForFlavor(flavor), inputs.customToken),
			defaultModel: defaultModelForFlavor(flavor, inputs.defaultModel, cfg.defaultModel),
			accountHint: `${labelForFlavor(flavor, baseUrl)} (${safeHost(baseUrl)})`
		};
	}
	if (inputs.useOllama || inputs.ollamaHost?.trim()) {
		const rawHost = trimTrailingSlashes(inputs.ollamaHost?.trim() || GATEWAY_ENDPOINTS.ollama);
		const baseUrl = rawHost.endsWith(`${SEP$1}v1`) ? rawHost : `${rawHost}${SEP$1}v1`;
		return {
			configured: true,
			flavor: "ollama",
			label: "Ollama (Local)",
			baseUrl,
			headers: {},
			defaultModel: defaultModelForFlavor("ollama", inputs.defaultModel, cfg.defaultModel),
			accountHint: `Local Ollama (${safeHost(baseUrl)})`
		};
	}
	if (cfg.baseUrl || cfg.providerKey) {
		const baseUrl = trimTrailingSlashes(cfg.baseUrl || GATEWAY_ENDPOINTS.openrouter);
		const flavor = cfg.providerFlavor ?? inferFlavorFromUrl(baseUrl);
		if (cfg.providerKey || isLoopbackUrl(baseUrl) || flavor === "ollama") return {
			configured: true,
			flavor,
			label: labelForFlavor(flavor, baseUrl),
			baseUrl,
			headers: withToken(defaultHeadersForFlavor(flavor), cfg.providerKey),
			defaultModel: defaultModelForFlavor(flavor, inputs.defaultModel, cfg.defaultModel),
			accountHint: `${labelForFlavor(flavor, baseUrl)} (${safeHost(baseUrl)})`
		};
	}
	if (ollamaDetected) return {
		configured: true,
		flavor: "ollama",
		label: "Ollama (Local)",
		baseUrl: GATEWAY_ENDPOINTS.ollama,
		headers: {},
		defaultModel: defaultModelForFlavor("ollama", inputs.defaultModel, cfg.defaultModel),
		accountHint: "Local Ollama (auto-detected)"
	};
	return {
		configured: false,
		flavor: "openrouter",
		label: "OpenRouter",
		baseUrl: GATEWAY_ENDPOINTS.openrouter,
		headers: defaultHeadersForFlavor("openrouter"),
		defaultModel: defaultModelForFlavor("openrouter", inputs.defaultModel, cfg.defaultModel)
	};
}
function labelForFlavor(flavor, baseUrl) {
	if (flavor === "openrouter") return "OpenRouter";
	if (flavor === "ai-gateway") return "Vercel AI Gateway";
	if (flavor === "ollama") return "Ollama (Local)";
	if (baseUrl.includes("api.openai.com")) return "OpenAI";
	return `OpenAI-Compatible (${safeHost(baseUrl)})`;
}
function safeHost(url) {
	try {
		return new URL(url).host;
	} catch {
		return url;
	}
}
function isLoopbackUrl(url) {
	try {
		const h = new URL(url).hostname;
		return h === LOOPBACK_HOST || h === "localhost" || h === "::1";
	} catch {
		return false;
	}
}
async function detectLocalOllama(ollamaHost, disabled) {
	if (disabled) return false;
	let base = trimTrailingSlashes(ollamaHost?.trim() || `http:${SEP$1}${SEP$1}${LOOPBACK_HOST}:11434`);
	if (base.endsWith(`${SEP$1}v1`)) base = base.slice(0, -3);
	return probeHttpOk(`${base}${SEP$1}api${SEP$1}tags`, 750);
}
var catalogCache = null;
function invalidateModelCache() {
	catalogCache = null;
}
async function listAvailableModels(endpoint, forceRefresh = false) {
	const hasCred = Boolean(endpoint.headers.Authorization);
	const cacheKey = `${endpoint.flavor}:${endpoint.baseUrl}:${hasCred}`;
	if (!forceRefresh && catalogCache && catalogCache.key === cacheKey && Date.now() - catalogCache.at < 3e5) return catalogCache.models;
	let remote = [];
	if (endpoint.configured) try {
		remote = await fetchRemoteModels(endpoint.baseUrl, endpoint.headers, 5e3);
	} catch {}
	const byId = /* @__PURE__ */ new Map();
	const remoteMap = new Map(remote.map((r) => [r.id, r]));
	if (endpoint.flavor === "openrouter" || endpoint.flavor === "ai-gateway") {
		for (const c of CURATED_MODELS) {
			if (endpoint.flavor === "ai-gateway" && c.id.endsWith(":free")) continue;
			const r = remoteMap.get(c.id);
			byId.set(c.id, {
				...c,
				contextSize: r?.contextLength ?? c.contextSize,
				promptPricePerToken: r?.pricingPromptPerToken,
				completionPricePerToken: r?.pricingCompletionPerToken
			});
		}
		let added = 0;
		for (const r of remote) {
			if (byId.has(r.id)) continue;
			if (added >= 80) break;
			const providerPrefix = r.id.includes(SEP$1) ? r.id.split(SEP$1)[0] : "Gateway";
			byId.set(r.id, {
				id: r.id,
				name: r.name && r.name !== r.id ? `${r.name} (${r.id})` : r.id,
				group: `More (${providerPrefix})`,
				contextSize: r.contextLength ?? 128e3,
				promptPricePerToken: r.pricingPromptPerToken,
				completionPricePerToken: r.pricingCompletionPerToken
			});
			added++;
		}
	} else {
		for (const r of remote.slice(0, 120)) byId.set(r.id, {
			id: r.id,
			name: r.name && r.name !== r.id ? `${r.name} (${r.id})` : r.id,
			group: endpoint.flavor === "ollama" ? "Local Ollama Models" : "Available Models",
			contextSize: r.contextLength ?? (endpoint.flavor === "ollama" ? 65536 : 128e3),
			promptPricePerToken: r.pricingPromptPerToken,
			completionPricePerToken: r.pricingCompletionPerToken
		});
		if (!byId.size) {
			const def = endpoint.defaultModel;
			byId.set(def, {
				id: def,
				name: def,
				group: endpoint.flavor === "ollama" ? "Local Ollama Models" : "Default Model",
				contextSize: endpoint.flavor === "ollama" ? 65536 : 128e3
			});
		}
	}
	if (!byId.has(endpoint.defaultModel)) byId.set(endpoint.defaultModel, {
		id: endpoint.defaultModel,
		name: endpoint.defaultModel,
		group: "Selected Model",
		contextSize: 128e3
	});
	const models = [...byId.values()];
	catalogCache = {
		key: cacheKey,
		at: Date.now(),
		models
	};
	return models;
}
function contextSizeForModel(modelId, models) {
	const hit = models.find((m) => m.id === modelId);
	if (hit?.contextSize) return hit.contextSize;
	const lc = modelId.toLowerCase();
	if (lc.includes("gemini")) return 1e6;
	if (lc.includes("gpt-5") || lc.includes("gpt-4.1")) return 4e5;
	if (lc.includes("claude")) return 2e5;
	if (lc.includes("qwen3") || lc.includes("codestral") || lc.includes("grok")) return 256e3;
	return 128e3;
}
function estimateCostUsd(usage, modelId, models) {
	if (usage.costUsd !== void 0) return usage.costUsd;
	const hit = models.find((m) => m.id === modelId);
	if (!hit || hit.promptPricePerToken === void 0 || hit.completionPricePerToken === void 0) return void 0;
	return (usage.inputTokens + usage.cachedReadTokens * .25) * hit.promptPricePerToken + usage.outputTokens * hit.completionPricePerToken;
}
// src/mcpClient.ts
var mcpOverAcpCaller = new McpOverAcpCaller({ clientInfo: {
	name: "olympus-cli",
	version: "0.1.0"
} });
var SessionMcpBridge = class {
	tools = /* @__PURE__ */ new Map();
	procs = [];
	async connectAll(servers, clientCtx) {
		if (!Array.isArray(servers) || !servers.length) return;
		await Promise.all(servers.map((s) => this.connectOne(s, clientCtx).catch(() => {})));
	}
	async connectOne(server, clientCtx) {
		const serverName = String(server?.name ?? "mcp").trim();
		if (!serverName) return;
		if (server?.type === "acp" && typeof server.serverId === "string" && clientCtx) {
			const listRes = await mcpOverAcpCaller.request(clientCtx, server.serverId, "tools/list", {});
			const list = Array.isArray(listRes?.result?.tools) ? listRes.result.tools : [];
			for (const t of list) this.registerTool(serverName, t, async (args) => {
				const r = await mcpOverAcpCaller.request(clientCtx, server.serverId, "tools/call", {
					name: t.name,
					arguments: args
				});
				if (r?.error) throw new Error(String(r.error.message ?? JSON.stringify(r.error)));
				return formatMcpResult(r?.result);
			});
			return;
		}
		if (server?.type === "http" && typeof server.url === "string") {
			const headers = {
				"Content-Type": "application/json",
				Accept: "application/json, text/event-stream"
			};
			if (Array.isArray(server.headers)) {
				for (const h of server.headers) if (h?.name && typeof h.value === "string") headers[String(h.name)] = h.value;
			}
			let rpcId = 1;
			const rpc = async (method, params) => {
				const res = await fetch(server.url, {
					method: "POST",
					headers,
					body: JSON.stringify({
						jsonrpc: "2.0",
						id: rpcId++,
						method,
						params
					}),
					signal: AbortSignal.timeout(3e4)
				});
				if (!res.ok) throw new Error(`MCP HTTP ${res.status}`);
				const text = await res.text();
				const dataLine = text.split("\n").map((l) => l.trim()).find((l) => l.startsWith("data:"));
				const json = JSON.parse(dataLine ? dataLine.slice(5).trim() : text);
				if (json?.error) throw new Error(String(json.error.message ?? JSON.stringify(json.error)));
				return json?.result;
			};
			await rpc("initialize", {
				protocolVersion: "2025-03-26",
				capabilities: {},
				clientInfo: {
					name: "olympus-cli",
					version: "0.1.0"
				}
			}).catch(() => {});
			const listRes = await rpc("tools/list", {});
			for (const t of Array.isArray(listRes?.tools) ? listRes.tools : []) this.registerTool(serverName, t, async (args) => formatMcpResult(await rpc("tools/call", {
				name: t.name,
				arguments: args
			})));
			return;
		}
		if (typeof server?.command === "string" && server.command) {
			const env = { ...process.env };
			if (Array.isArray(server.env)) {
				for (const e of server.env) if (e?.name && typeof e.value === "string") env[String(e.name)] = e.value;
			}
			const proc = spawn(server.command, Array.isArray(server.args) ? server.args.map(String) : [], {
				env,
				stdio: [
					"pipe",
					"pipe",
					"ignore"
				]
			});
			this.procs.push(proc);
			const pending = /* @__PURE__ */ new Map();
			let nextId = 1;
			let buf = "";
			proc.stdout?.on("data", (chunk) => {
				buf += chunk.toString("utf8");
				let idx;
				while ((idx = buf.indexOf("\n")) >= 0) {
					const line = buf.slice(0, idx).trim();
					buf = buf.slice(idx + 1);
					if (!line) continue;
					try {
						const msg = JSON.parse(line);
						const p = typeof msg?.id === "number" ? pending.get(msg.id) : void 0;
						if (p) {
							pending.delete(msg.id);
							if (msg.error) p.reject(new Error(String(msg.error.message ?? JSON.stringify(msg.error))));
							else p.resolve(msg.result);
						}
					} catch {}
				}
			});
			proc.once("exit", () => {
				for (const [, p] of pending) p.reject(/* @__PURE__ */ new Error(`MCP server ${serverName} exited.`));
				pending.clear();
			});
			const rpc = (method, params, timeoutMs = 2e4) => new Promise((resolve, reject) => {
				const id = nextId++;
				const timer = setTimeout(() => {
					pending.delete(id);
					reject(/* @__PURE__ */ new Error(`MCP ${serverName}.${method} timed out`));
				}, timeoutMs);
				pending.set(id, {
					resolve: (v) => {
						clearTimeout(timer);
						resolve(v);
					},
					reject: (e) => {
						clearTimeout(timer);
						reject(e);
					}
				});
				proc.stdin?.write(`${JSON.stringify({
					jsonrpc: "2.0",
					id,
					method,
					params
				})}\n`);
			});
			await rpc("initialize", {
				protocolVersion: "2025-03-26",
				capabilities: {},
				clientInfo: {
					name: "olympus-cli",
					version: "0.1.0"
				}
			});
			proc.stdin?.write(`${JSON.stringify({
				jsonrpc: "2.0",
				method: "notifications/initialized",
				params: {}
			})}\n`);
			const listRes = await rpc("tools/list", {});
			for (const t of Array.isArray(listRes?.tools) ? listRes.tools : []) this.registerTool(serverName, t, async (args) => formatMcpResult(await rpc("tools/call", {
				name: t.name,
				arguments: args
			}, 12e4)));
		}
	}
	registerTool(serverName, tool, call) {
		const rawName = String(tool?.name ?? "").trim();
		if (!rawName) return;
		const qualifiedName = `mcp__${serverName.replace(/[^A-Za-z0-9_-]/g, "_")}__${rawName.replace(/[^A-Za-z0-9_-]/g, "_")}`.slice(0, 64);
		const schema = tool?.inputSchema && typeof tool.inputSchema === "object" ? tool.inputSchema : {
			type: "object",
			properties: {}
		};
		this.tools.set(qualifiedName, {
			qualifiedName,
			serverName,
			toolName: rawName,
			spec: {
				type: "function",
				function: {
					name: qualifiedName,
					description: `[MCP ${serverName}] ${String(tool?.description ?? rawName)}`.slice(0, 1024),
					parameters: schema
				}
			},
			call
		});
	}
	close() {
		for (const p of this.procs) try {
			p.kill();
		} catch {}
		this.procs = [];
		this.tools.clear();
	}
};
function formatMcpResult(result) {
	if (!result) return "(ok)";
	if (Array.isArray(result.content)) {
		const parts = result.content.map((c) => c?.type === "text" ? String(c.text ?? "") : JSON.stringify(c)).filter(Boolean);
		if (parts.length) return parts.join("\n");
	}
	return typeof result === "string" ? result : JSON.stringify(result, null, 2);
}
// src/tools.ts
var SKIP_DIRS = /* @__PURE__ */ new Set([
	".git",
	"node_modules",
	".venv",
	"venv",
	"__pycache__",
	".next",
	"dist",
	"out",
	".cache",
	".turbo"
]);
var BUILTIN_TOOL_SPECS = [
	{
		type: "function",
		function: {
			name: "read_file",
			description: "Read a text file from the workspace with 1-indexed line numbers. Supports optional start_line and limit for large files.",
			parameters: {
				type: "object",
				properties: {
					path: {
						type: "string",
						description: "Relative or absolute path to the file."
					},
					start_line: {
						type: "integer",
						description: "Optional 1-based starting line number."
					},
					limit: {
						type: "integer",
						description: "Optional max number of lines to read (default 250)."
					}
				},
				required: ["path"]
			}
		}
	},
	{
		type: "function",
		function: {
			name: "edit_file",
			description: "Make a surgical text replacement in an existing file. Always read the file first so old_string matches accurately.",
			parameters: {
				type: "object",
				properties: {
					path: {
						type: "string",
						description: "Path to the file to edit."
					},
					old_string: {
						type: "string",
						description: "Exact block of existing text to replace."
					},
					new_string: {
						type: "string",
						description: "New replacement text."
					},
					replace_all: {
						type: "boolean",
						description: "Replace every occurrence in the file instead of requiring a unique match."
					}
				},
				required: [
					"path",
					"old_string",
					"new_string"
				]
			}
		}
	},
	{
		type: "function",
		function: {
			name: "write_file",
			description: "Create a new file or overwrite an entire file with text content.",
			parameters: {
				type: "object",
				properties: {
					path: {
						type: "string",
						description: "Path to the file to create or overwrite."
					},
					content: {
						type: "string",
						description: "Complete file content to write."
					}
				},
				required: ["path", "content"]
			}
		}
	},
	{
		type: "function",
		function: {
			name: "list_dir",
			description: "List files and subdirectories inside a directory.",
			parameters: {
				type: "object",
				properties: {
					path: {
						type: "string",
						description: "Directory path (defaults to workspace root)."
					},
					recursive: {
						type: "boolean",
						description: "List nested files up to 200 entries."
					}
				}
			}
		}
	},
	{
		type: "function",
		function: {
			name: "glob_files",
			description: "Find files by glob pattern (e.g. \"**/*.ts\", \"src/**/*Modal*.tsx\") within the workspace.",
			parameters: {
				type: "object",
				properties: {
					pattern: {
						type: "string",
						description: "Glob pattern to match against relative paths or filenames."
					},
					path: {
						type: "string",
						description: "Optional subdirectory to search within."
					}
				},
				required: ["pattern"]
			}
		}
	},
	{
		type: "function",
		function: {
			name: "grep_search",
			description: "Search file contents for a regex or literal string across the workspace, returning file:line matches.",
			parameters: {
				type: "object",
				properties: {
					query: {
						type: "string",
						description: "Regex or literal pattern to search for."
					},
					path: {
						type: "string",
						description: "Optional file or directory to restrict search."
					},
					include: {
						type: "string",
						description: "Optional file glob filter such as \"*.ts\" or \"*.py\"."
					},
					case_insensitive: {
						type: "boolean",
						description: "Perform case-insensitive matching."
					}
				},
				required: ["query"]
			}
		}
	},
	{
		type: "function",
		function: {
			name: "run_command",
			description: "Execute a shell command in the workspace and capture its stdout, stderr, and exit code.",
			parameters: {
				type: "object",
				properties: {
					command: {
						type: "string",
						description: "Shell command to execute."
					},
					cwd: {
						type: "string",
						description: "Optional working directory (defaults to workspace root)."
					},
					description: {
						type: "string",
						description: "Short human-readable summary of what this command does."
					},
					timeout_ms: {
						type: "integer",
						description: "Timeout in milliseconds (default 60000, max 300000)."
					}
				},
				required: ["command"]
			}
		}
	},
	{
		type: "function",
		function: {
			name: "todo_write",
			description: "Create or update the structured task checklist to track multi-step progress.",
			parameters: {
				type: "object",
				properties: { todos: {
					type: "array",
					items: {
						type: "object",
						properties: {
							content: { type: "string" },
							status: {
								type: "string",
								enum: [
									"pending",
									"in_progress",
									"completed"
								]
							},
							priority: {
								type: "string",
								enum: [
									"high",
									"medium",
									"low"
								]
							}
						},
						required: ["content", "status"]
					}
				} },
				required: ["todos"]
			}
		}
	},
	{
		type: "function",
		function: {
			name: "web_fetch",
			description: "Fetch a web URL (documentation, API JSON, or raw text) and extract readable content.",
			parameters: {
				type: "object",
				properties: {
					url: {
						type: "string",
						description: "HTTP/HTTPS URL to fetch."
					},
					max_chars: {
						type: "integer",
						description: "Maximum characters to return (default 16000)."
					}
				},
				required: ["url"]
			}
		}
	}
];
function resolveTarget(cwd, p) {
	if (!p || !p.trim()) return cwd;
	return isAbsolute(p.trim()) ? resolve(p.trim()) : resolve(cwd, p.trim());
}
function shortRel(cwd, abs) {
	const rel = relative(cwd, abs);
	return rel && !rel.startsWith("..") ? rel.split(sep).join("/") : abs;
}
function describeToolCall(name, args, cwd) {
	switch (name) {
		case "read_file": {
			const abs = resolveTarget(cwd, String(args.path ?? ""));
			const line = typeof args.start_line === "number" && args.start_line > 0 ? args.start_line : void 0;
			return {
				kind: "read",
				title: `Read ${shortRel(cwd, abs)}${line ? ` L${line}` : ""}`,
				locations: [{
					path: abs,
					...line ? { line } : {}
				}]
			};
		}
		case "edit_file": {
			const abs = resolveTarget(cwd, String(args.path ?? ""));
			return {
				kind: "edit",
				title: `Edit ${shortRel(cwd, abs)}`,
				locations: [{ path: abs }]
			};
		}
		case "write_file": {
			const abs = resolveTarget(cwd, String(args.path ?? ""));
			return {
				kind: "edit",
				title: `Write ${shortRel(cwd, abs)}`,
				locations: [{ path: abs }]
			};
		}
		case "list_dir": {
			const abs = resolveTarget(cwd, String(args.path ?? ""));
			return {
				kind: "search",
				title: `List ${shortRel(cwd, abs) || "."}`,
				locations: [{ path: abs }]
			};
		}
		case "glob_files": return {
			kind: "search",
			title: `Glob ${String(args.pattern ?? "*")}`
		};
		case "grep_search": return {
			kind: "search",
			title: `Search "${String(args.query ?? "").slice(0, 80)}"`
		};
		case "run_command": return {
			kind: "execute",
			title: String(args.description || args.command || "Run command").slice(0, 140)
		};
		case "todo_write": return {
			kind: "think",
			title: "Update plan"
		};
		case "web_fetch": return {
			kind: "fetch",
			title: `Fetch ${String(args.url ?? "")}`
		};
		default: return {
			kind: "other",
			title: name
		};
	}
}
async function ensurePermission(ctx, toolCallId, title, kind, locations) {
	if (ctx.mode === "auto") return true;
	if (ctx.clientCtx) {
		const out = (await ctx.clientCtx.request(methods.client.session.requestPermission, {
			sessionId: ctx.sessionId,
			toolCall: {
				toolCallId,
				title,
				kind,
				status: "pending",
				...locations ? { locations } : {}
			},
			options: [
				{
					optionId: "allow_once",
					name: "Allow",
					kind: "allow_once"
				},
				{
					optionId: "allow_always",
					name: "Always allow",
					kind: "allow_always"
				},
				{
					optionId: "reject_once",
					name: "Deny",
					kind: "reject_once"
				}
			]
		}, {
			cancellationSignal: ctx.signal,
			stopWaitingOnCancel: true
		}))?.outcome;
		return out?.outcome === "selected" && String(out.optionId ?? "").startsWith("allow");
	}
	if (ctx.askLocalPermission) return ctx.askLocalPermission(title, kind);
	return true;
}
async function readWorkspaceFile(ctx, absPath, line, limit) {
	if (ctx.clientCtx && ctx.clientCaps?.fs?.readTextFile) try {
		const r = await ctx.clientCtx.request(methods.client.fs.readTextFile, {
			sessionId: ctx.sessionId,
			path: absPath,
			...line ? { line } : {},
			...limit ? { limit } : {}
		}, {
			cancellationSignal: ctx.signal,
			stopWaitingOnCancel: true
		});
		if (typeof r?.content === "string") return r.content;
	} catch {}
	const full = readFileSync(absPath, "utf8");
	if (!line && !limit) return full;
	const lines = full.split("\n");
	const start = Math.max(0, (line ?? 1) - 1);
	const count = limit && limit > 0 ? limit : lines.length;
	return lines.slice(start, start + count).join("\n");
}
async function writeWorkspaceFile(ctx, absPath, content) {
	if (ctx.clientCtx && ctx.clientCaps?.fs?.writeTextFile) try {
		await ctx.clientCtx.request(methods.client.fs.writeTextFile, {
			sessionId: ctx.sessionId,
			path: absPath,
			content
		}, {
			cancellationSignal: ctx.signal,
			stopWaitingOnCancel: true
		});
		return;
	} catch {}
	mkdirSync(dirname(absPath), { recursive: true });
	writeFileSync(absPath, content, "utf8");
}
async function executeBuiltinTool(name, args, toolCallId, ctx) {
	const meta = describeToolCall(name, args, ctx.cwd);
	switch (name) {
		case "read_file": {
			const abs = resolveTarget(ctx.cwd, String(args.path ?? ""));
			if (!existsSync(abs)) return {
				...meta,
				isError: true,
				output: `File not found: ${abs}`
			};
			if (statSync(abs).isDirectory()) return {
				...meta,
				isError: true,
				output: `Path is a directory, not a file: ${abs}. Use list_dir instead.`
			};
			const startLine = typeof args.start_line === "number" && args.start_line >= 1 ? Math.floor(args.start_line) : 1;
			const limit = typeof args.limit === "number" && args.limit >= 1 ? Math.min(1e3, Math.floor(args.limit)) : 250;
			const allLines = (await readWorkspaceFile(ctx, abs)).replace(/\r\n/g, "\n").split("\n");
			const slice = allLines.slice(startLine - 1, startLine - 1 + limit);
			const text = `${slice.map((l, i) => `${String(startLine + i).padStart(5, " ")} | ${l}`).join("\n")}${startLine - 1 + slice.length < allLines.length ? `\n... (showing lines ${startLine}-${startLine + slice.length - 1} of ${allLines.length}; pass start_line=${startLine + slice.length} to read more)` : `\n(total ${allLines.length} lines)`}`;
			return {
				...meta,
				locations: [{
					path: abs,
					line: startLine
				}],
				output: text,
				acpContent: [{
					type: "content",
					content: {
						type: "text",
						text: slice.join("\n")
					}
				}]
			};
		}
		case "write_file": {
			if (ctx.mode === "plan") return {
				...meta,
				isError: true,
				output: "Plan mode is read-only: file writes are disabled until the user switches to Code or Auto mode."
			};
			const abs = resolveTarget(ctx.cwd, String(args.path ?? ""));
			const newText = String(args.content ?? "");
			const oldText = existsSync(abs) && statSync(abs).isFile() ? await readWorkspaceFile(ctx, abs) : "";
			if (!await ensurePermission(ctx, toolCallId, `${oldText ? "Overwrite" : "Create"} ${shortRel(ctx.cwd, abs)}`, "edit", [{
				path: abs,
				line: 1
			}])) return {
				...meta,
				isError: true,
				output: "Permission denied by user."
			};
			await writeWorkspaceFile(ctx, abs, newText);
			return {
				...meta,
				locations: [{
					path: abs,
					line: 1
				}],
				output: `Wrote ${newText.split("\n").length} lines to ${shortRel(ctx.cwd, abs)}.`,
				acpContent: [{
					type: "diff",
					path: abs,
					...oldText ? { oldText } : {},
					newText
				}]
			};
		}
		case "edit_file": {
			if (ctx.mode === "plan") return {
				...meta,
				isError: true,
				output: "Plan mode is read-only: file edits are disabled until the user switches to Code or Auto mode."
			};
			const abs = resolveTarget(ctx.cwd, String(args.path ?? ""));
			if (!existsSync(abs)) return {
				...meta,
				isError: true,
				output: `File not found: ${abs}`
			};
			const oldStr = String(args.old_string ?? "");
			const newStr = String(args.new_string ?? "");
			const replaceAll = args.replace_all === true;
			if (!oldStr) return {
				...meta,
				isError: true,
				output: "old_string must be non-empty. Use write_file to create or replace an entire file."
			};
			const replaced = applyReplacement(await readWorkspaceFile(ctx, abs), oldStr, newStr, replaceAll);
			if ("error" in replaced) return {
				...meta,
				isError: true,
				output: replaced.error
			};
			if (!await ensurePermission(ctx, toolCallId, `Edit ${shortRel(ctx.cwd, abs)}`, "edit", [{
				path: abs,
				line: replaced.line
			}])) return {
				...meta,
				isError: true,
				output: "Permission denied by user."
			};
			await writeWorkspaceFile(ctx, abs, replaced.updated);
			return {
				...meta,
				locations: [{
					path: abs,
					line: replaced.line
				}],
				output: `Updated ${shortRel(ctx.cwd, abs)} at line ${replaced.line} (${replaced.count} replacement${replaced.count === 1 ? "" : "s"}).`,
				acpContent: [{
					type: "diff",
					path: abs,
					oldText: replaced.matchedOld,
					newText: newStr
				}]
			};
		}
		case "list_dir": {
			const abs = resolveTarget(ctx.cwd, String(args.path ?? ""));
			if (!existsSync(abs)) return {
				...meta,
				isError: true,
				output: `Directory not found: ${abs}`
			};
			const recursive = args.recursive === true;
			const rows = [];
			const walk = (dir, depth) => {
				if (rows.length >= 200 || depth > 5) return;
				let entries;
				try {
					entries = readdirSync(dir, { withFileTypes: true });
				} catch {
					return;
				}
				entries.sort((a, b) => a.isDirectory() === b.isDirectory() ? a.name.localeCompare(b.name) : a.isDirectory() ? -1 : 1);
				for (const e of entries) {
					if (rows.length >= 200) break;
					if (e.isDirectory() && SKIP_DIRS.has(e.name)) continue;
					const full = resolve(dir, e.name);
					const rel = shortRel(abs, full);
					rows.push(e.isDirectory() ? `${rel}/` : rel);
					if (recursive && e.isDirectory()) walk(full, depth + 1);
				}
			};
			walk(abs, 0);
			const out = rows.length ? rows.join("\n") : "(empty directory)";
			return {
				...meta,
				output: out,
				acpContent: [{
					type: "content",
					content: {
						type: "text",
						text: out
					}
				}]
			};
		}
		case "glob_files": {
			const base = resolveTarget(ctx.cwd, typeof args.path === "string" ? args.path : void 0);
			const pattern = String(args.pattern ?? "*");
			const rx = globToRegExp(pattern);
			const matches = [];
			const walk = (dir) => {
				if (matches.length >= 120) return;
				let entries;
				try {
					entries = readdirSync(dir, { withFileTypes: true });
				} catch {
					return;
				}
				for (const e of entries) {
					if (matches.length >= 120) break;
					if (e.isDirectory() && SKIP_DIRS.has(e.name)) continue;
					const full = resolve(dir, e.name);
					const rel = relative(base, full).split(sep).join("/");
					if (e.isDirectory()) walk(full);
					else if (rx.test(rel) || rx.test(e.name)) matches.push(full);
				}
			};
			walk(base);
			const out = matches.length ? matches.map((m) => shortRel(ctx.cwd, m)).join("\n") : `No files matched "${pattern}".`;
			return {
				...meta,
				locations: matches.slice(0, 40).map((m) => ({ path: m })),
				output: out,
				acpContent: [{
					type: "content",
					content: {
						type: "text",
						text: out
					}
				}]
			};
		}
		case "grep_search": {
			const query = String(args.query ?? "");
			if (!query) return {
				...meta,
				isError: true,
				output: "query is required."
			};
			const found = await runGrep(query, resolveTarget(ctx.cwd, typeof args.path === "string" ? args.path : void 0), typeof args.include === "string" && args.include.trim() ? args.include.trim() : void 0, args.case_insensitive === true, ctx.signal);
			const lines = found.map((m) => `${shortRel(ctx.cwd, m.path)}:${m.line}: ${m.text}`);
			const out = lines.length ? lines.join("\n") : `No matches found for "${query}".`;
			return {
				...meta,
				locations: found.slice(0, 40).map((m) => ({
					path: m.path,
					line: m.line
				})),
				output: out,
				acpContent: [{
					type: "content",
					content: {
						type: "text",
						text: out
					}
				}]
			};
		}
		case "run_command": {
			const command = String(args.command ?? "").trim();
			if (!command) return {
				...meta,
				isError: true,
				output: "command is required."
			};
			const cmdCwd = resolveTarget(ctx.cwd, typeof args.cwd === "string" ? args.cwd : void 0);
			const timeoutMs = Math.min(3e5, Math.max(1e3, Number(args.timeout_ms ?? 6e4)));
			if (!await ensurePermission(ctx, toolCallId, `Run: ${command.slice(0, 120)}`, "execute")) return {
				...meta,
				isError: true,
				output: "Command execution denied by user."
			};
			if (ctx.clientCtx && ctx.clientCaps?.terminal) {
				const term = await ctx.clientCtx.createTerminal({
					sessionId: ctx.sessionId,
					command,
					cwd: cmdCwd,
					outputByteLimit: 12e4
				}, {
					cancellationSignal: ctx.signal,
					stopWaitingOnCancel: true
				});
				await ctx.onTerminalCreated?.(term.id);
				let timedOut = false;
				const timer = setTimeout(() => {
					timedOut = true;
					term.kill().catch(() => {});
				}, timeoutMs);
				try {
					const exit = await term.waitForExit();
					const outRes = await term.currentOutput();
					const code = exit.exitCode ?? (exit.signal ? 130 : 0);
					const rawOut = String(outRes.output ?? "").trim();
					const summary = [
						`$ ${command}`,
						rawOut || "(no output)",
						timedOut ? `[Timed out after ${timeoutMs}ms]` : `Command exited with code ${code}.`
					].join("\n");
					return {
						...meta,
						isError: code !== 0 || timedOut,
						output: summary,
						acpContent: [{
							type: "terminal",
							terminalId: term.id
						}]
					};
				} finally {
					clearTimeout(timer);
					await term.release().catch(() => {});
				}
			}
			const local = await execShellCommand(command, cmdCwd, timeoutMs, ctx.signal);
			const formatted = [
				"```console",
				`$ ${command}`,
				local.output.trim() || "(no output)",
				`Exit code ${local.code}${local.timedOut ? " (timed out)" : ""}`,
				"```"
			].join("\n");
			return {
				...meta,
				isError: local.code !== 0 || local.timedOut,
				output: formatted,
				acpContent: [{
					type: "content",
					content: {
						type: "text",
						text: formatted
					}
				}]
			};
		}
		case "todo_write": {
			const todos = (Array.isArray(args.todos) ? args.todos : []).filter((t) => typeof t?.content === "string" && t.content.trim()).map((t) => ({
				content: String(t.content).trim(),
				status: [
					"pending",
					"in_progress",
					"completed"
				].includes(t.status) ? t.status : "pending",
				priority: [
					"high",
					"medium",
					"low"
				].includes(t.priority) ? t.priority : "medium"
			}));
			await ctx.onTodosUpdated?.(todos);
			const out = todos.map((t) => `[${t.status === "completed" ? "x" : t.status === "in_progress" ? "/" : " "}] ${t.content}`).join("\n") || "(plan cleared)";
			return {
				...meta,
				output: out,
				acpContent: [{
					type: "content",
					content: {
						type: "text",
						text: out
					}
				}]
			};
		}
		case "web_fetch": {
			const url = String(args.url ?? "").trim();
			if (!/^https?:\/\//i.test(url)) return {
				...meta,
				isError: true,
				output: "URL must start with http:// or https://."
			};
			const maxChars = Math.min(6e4, Math.max(1e3, Number(args.max_chars ?? 16e3)));
			if (!await ensurePermission(ctx, toolCallId, `Fetch ${url}`, "fetch")) return {
				...meta,
				isError: true,
				output: "Web fetch denied by user."
			};
			try {
				const res = await fetch(url, {
					headers: { "User-Agent": "OlympusCoder-CLI/0.1" },
					signal: AbortSignal.any([ctx.signal, AbortSignal.timeout(2e4)])
				});
				const raw = await res.text();
				const cleaned = (res.headers.get("content-type") ?? "").includes("html") ? htmlToText(raw) : raw;
				const clipped = cleaned.length > maxChars ? `${cleaned.slice(0, maxChars)}\n… (truncated)` : cleaned;
				const out = `HTTP ${res.status} (${url})\n\n${clipped}`;
				return {
					...meta,
					isError: !res.ok,
					output: out,
					acpContent: [{
						type: "content",
						content: {
							type: "text",
							text: out
						}
					}]
				};
			} catch (e) {
				return {
					...meta,
					isError: true,
					output: `Fetch failed: ${e?.message ?? e}`
				};
			}
		}
		default: return {
			...meta,
			isError: true,
			output: `Unknown tool: ${name}`
		};
	}
}
function applyReplacement(original, oldStr, newStr, replaceAll) {
	const normOrig = original.replace(/\r\n/g, "\n");
	const normOld = oldStr.replace(/\r\n/g, "\n");
	const firstIdx = normOrig.indexOf(normOld);
	if (firstIdx >= 0) {
		if (!replaceAll) {
			if (normOrig.indexOf(normOld, firstIdx + normOld.length) >= 0) return { error: "old_string matched multiple locations in the file. Include more surrounding context lines or pass replace_all: true." };
			const line = normOrig.slice(0, firstIdx).split("\n").length;
			return {
				updated: normOrig.slice(0, firstIdx) + newStr + normOrig.slice(firstIdx + normOld.length),
				line,
				count: 1,
				matchedOld: normOld
			};
		}
		const parts = normOrig.split(normOld);
		const line = normOrig.slice(0, firstIdx).split("\n").length;
		return {
			updated: parts.join(newStr),
			line,
			count: parts.length - 1,
			matchedOld: normOld
		};
	}
	const origLines = normOrig.split("\n");
	const targetLines = normOld.split("\n");
	if (targetLines.length >= 1) {
		const hits = [];
		for (let i = 0; i <= origLines.length - targetLines.length; i++) {
			let ok = true;
			for (let j = 0; j < targetLines.length; j++) if (origLines[i + j].trim() !== targetLines[j].trim()) {
				ok = false;
				break;
			}
			if (ok) hits.push(i);
		}
		if (hits.length === 1) {
			const idx = hits[0];
			const matchedOld = origLines.slice(idx, idx + targetLines.length).join("\n");
			return {
				updated: [
					...origLines.slice(0, idx),
					newStr,
					...origLines.slice(idx + targetLines.length)
				].join("\n"),
				line: idx + 1,
				count: 1,
				matchedOld
			};
		}
		if (hits.length > 1) return { error: "old_string matched multiple locations by line content. Add more context lines to disambiguate." };
	}
	return { error: "old_string was not found in the file. Call read_file first to inspect exact lines." };
}
function globToRegExp(glob) {
	const escaped = glob.replace(/\\/g, "/").replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*\*\//g, "(?:.+/)?").replace(/\*\*/g, ".*").replace(/\*/g, "[^/]*").replace(/\?/g, "[^/]");
	return new RegExp(`^${escaped}$`, "i");
}
async function runGrep(query, target, include, ignoreCase, signal) {
	const rgOut = await new Promise((res) => {
		const args = [
			"--line-number",
			"--no-heading",
			"--color",
			"never",
			"--max-count",
			"60"
		];
		if (ignoreCase) args.push("-i");
		if (include) args.push("-g", include);
		args.push("--", query, target);
		execFile("rg", args, {
			maxBuffer: 2097152,
			timeout: 1e4,
			signal
		}, (err, stdout) => {
			if (err && err.code !== 1) return res(null);
			res(String(stdout ?? ""));
		});
	});
	if (rgOut !== null) {
		const hits = [];
		for (const raw of rgOut.split("\n")) {
			if (!raw.trim()) continue;
			const m = /^(.+?):(\d+):(.*)$/.exec(raw);
			if (m) {
				hits.push({
					path: resolve(m[1]),
					line: Number(m[2]),
					text: m[3].slice(0, 240)
				});
				if (hits.length >= 80) break;
			}
		}
		return hits;
	}
	let rx;
	try {
		rx = new RegExp(query, ignoreCase ? "i" : "");
	} catch {
		rx = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), ignoreCase ? "i" : "");
	}
	const incRx = include ? globToRegExp(include) : null;
	const hits = [];
	const scanFile = (file) => {
		if (hits.length >= 80) return;
		try {
			if (statSync(file).size > 15e5) return;
			const content = readFileSync(file, "utf8");
			if (content.includes("\0")) return;
			const lines = content.split("\n");
			for (let i = 0; i < lines.length; i++) if (rx.test(lines[i])) {
				hits.push({
					path: file,
					line: i + 1,
					text: lines[i].slice(0, 240)
				});
				if (hits.length >= 80) break;
			}
		} catch {}
	};
	const walk = (p) => {
		if (hits.length >= 80 || signal.aborted) return;
		let st;
		try {
			st = statSync(p);
		} catch {
			return;
		}
		if (st.isFile()) return scanFile(p);
		let entries;
		try {
			entries = readdirSync(p, { withFileTypes: true });
		} catch {
			return;
		}
		for (const e of entries) {
			if (hits.length >= 80) break;
			if (e.isDirectory() && SKIP_DIRS.has(e.name)) continue;
			const full = resolve(p, e.name);
			if (e.isDirectory()) walk(full);
			else if (!incRx || incRx.test(e.name)) scanFile(full);
		}
	};
	walk(target);
	return hits;
}
function execShellCommand(command, cwd, timeoutMs, signal) {
	return new Promise((res) => {
		const sh = process.platform === "win32" ? "cmd.exe" : "/bin/bash";
		const shArgs = process.platform === "win32" ? [
			"/d",
			"/s",
			"/c",
			command
		] : ["-lc", command];
		const proc = spawn(sh, shArgs, {
			cwd: existsSync(cwd) ? cwd : process.cwd(),
			env: process.env,
			stdio: [
				"ignore",
				"pipe",
				"pipe"
			]
		});
		let out = "";
		let timedOut = false;
		const append = (d) => {
			out += d.toString("utf8");
			if (out.length > 96e3) out = `${out.slice(0, 24e3)}\n… [output truncated] …\n${out.slice(-48e3)}`;
		};
		proc.stdout?.on("data", append);
		proc.stderr?.on("data", append);
		const timer = setTimeout(() => {
			timedOut = true;
			proc.kill("SIGTERM");
			setTimeout(() => proc.kill("SIGKILL"), 1500);
		}, timeoutMs);
		const onAbort = () => proc.kill("SIGTERM");
		signal.addEventListener("abort", onAbort, { once: true });
		proc.on("close", (code) => {
			clearTimeout(timer);
			signal.removeEventListener("abort", onAbort);
			res({
				output: out,
				code: code ?? 1,
				timedOut
			});
		});
		proc.on("error", (err) => {
			clearTimeout(timer);
			signal.removeEventListener("abort", onAbort);
			res({
				output: String(err.message ?? err),
				code: 1,
				timedOut
			});
		});
	});
}
function htmlToText(html) {
	return html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<\/(p|div|h[1-6]|li|tr|br|section|article)>/gi, "\n").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}
// src/acpServer.ts
var SEP = String.fromCharCode(47);
var OPENROUTER_KEYS_LINK = `https:${SEP}${SEP}openrouter.ai${SEP}settings${SEP}keys`;
var VERCEL_AI_KEYS_LINK = `https:${SEP}${SEP}vercel.com${SEP}docs${SEP}ai-gateway`;
var AVAILABLE_COMMANDS = [
	{
		name: "status",
		description: "Show active provider gateway, model, mode, reasoning level, and token usage"
	},
	{
		name: "models",
		description: "List available models on the connected gateway or switch model",
		input: { hint: "[model-id]" }
	},
	{
		name: "compact",
		description: "Summarize older conversation turns to free context window space"
	},
	{
		name: "clear",
		description: "Clear conversation history in this session while keeping settings"
	}
];
function inputsFromEnv(env) {
	return {
		sharedDir: env.AGENTDESK_SHARED_ROOT || env.OLYMPUS_SHARED_DIR,
		openRouterToken: env.OPENROUTER_API_KEY,
		openRouterBaseUrl: env.OPENROUTER_BASE_URL,
		aiGatewayToken: env.AI_GATEWAY_API_KEY || env.VERCEL_AI_GATEWAY_API_KEY,
		aiGatewayBaseUrl: env.AI_GATEWAY_BASE_URL,
		customToken: env.OLYMPUS_OPENAI_API_KEY || env.OPENAI_API_KEY,
		customBaseUrl: env.OLYMPUS_BASE_URL || env.OPENAI_BASE_URL,
		defaultModel: env.OLYMPUS_MODEL || env.OPENAI_MODEL,
		useOllama: env.OLYMPUS_USE_OLLAMA === "1",
		ollamaHost: env.OLYMPUS_OLLAMA_HOST
	};
}
function buildSystemInstructions(cwd, mode, customPrompt) {
	const modeRule = mode === "plan" ? "Current mode: PLAN (read-only). Explore files, search code, and produce a clear architectural implementation plan. Do NOT call edit_file or write_file." : mode === "auto" ? "Current mode: AUTO. Execute multi-step file edits, commands, and verification autonomously and concisely." : "Current mode: CODE. Read relevant files before editing, make surgical edits with edit_file, and verify your work.";
	const core = [
		"You are Olympus, the native multi-model software engineering agent built into Olympus Coder.",
		`Workspace root: ${cwd}`,
		modeRule,
		"Tool guidelines:",
		"- Always call read_file or grep_search to inspect existing code before modifying files.",
		"- Prefer edit_file over write_file when changing existing files so diffs stay minimal and accurate.",
		"- Use todo_write on multi-step tasks so the user sees live progress.",
		"- Keep explanations concise, technical, and grounded in the actual codebase."
	].join("\n");
	return customPrompt?.trim() ? `${core}\n\n${customPrompt.trim()}` : core;
}
function buildConfigOptions(session, models) {
	const groups = /* @__PURE__ */ new Map();
	for (const m of models) {
		let list = groups.get(m.group);
		if (!list) {
			list = [];
			groups.set(m.group, list);
		}
		list.push({
			value: m.id,
			name: m.name,
			...m.description ? { description: m.description } : {}
		});
	}
	if (!models.some((m) => m.id === session.model) && session.model) {
		const custom = groups.get("Selected Model") ?? [];
		custom.unshift({
			value: session.model,
			name: session.model
		});
		groups.set("Selected Model", custom);
	}
	const groupedModelOptions = [...groups.entries()].map(([groupName, opts], idx) => ({
		group: `group_${idx}`,
		name: groupName,
		options: opts
	}));
	return [
		{
			id: "model",
			name: "Model",
			category: "model",
			type: "select",
			currentValue: session.model,
			options: groupedModelOptions
		},
		{
			id: "mode",
			name: "Mode",
			category: "mode",
			type: "select",
			currentValue: session.mode,
			options: [
				{
					value: "code",
					name: "Code",
					description: "Read, edit, and run commands with approval cards"
				},
				{
					value: "plan",
					name: "Plan (Read-Only)",
					description: "Inspect codebase and design an implementation plan without modifying files"
				},
				{
					value: "auto",
					name: "Autonomous",
					description: "Approve edits and commands automatically inside this session"
				}
			]
		},
		{
			id: "reasoning",
			name: "Reasoning",
			category: "thought_level",
			type: "select",
			currentValue: session.reasoning,
			options: [
				{
					value: "none",
					name: "Off",
					description: "Disable extended reasoning tokens for fastest responses"
				},
				{
					value: "low",
					name: "Low",
					description: "Brief thinking budget"
				},
				{
					value: "medium",
					name: "Medium",
					description: "Balanced reasoning depth for everyday coding"
				},
				{
					value: "high",
					name: "High",
					description: "Deep chain-of-thought reasoning for hard bugs & architecture"
				}
			]
		}
	];
}
function buildAuthMethods() {
	return [
		{
			id: "openrouter",
			type: "env_var",
			name: "OpenRouter (Single Key · 500+ Models)",
			description: "Connect Claude, GPT-5, Gemini, DeepSeek, Qwen, Grok, Codestral, and free models with one OpenRouter key.",
			link: OPENROUTER_KEYS_LINK,
			vars: [{
				name: "OPENROUTER_API_KEY",
				label: "OpenRouter API key",
				secret: true,
				optional: false
			}]
		},
		{
			id: "ai-gateway",
			type: "env_var",
			name: "Vercel AI Gateway (0% Markup · 400+ Models)",
			description: "Route across frontier AI providers with a single Vercel AI Gateway key at pass-through token pricing.",
			link: VERCEL_AI_KEYS_LINK,
			vars: [{
				name: "AI_GATEWAY_API_KEY",
				label: "Vercel AI Gateway API key",
				secret: true,
				optional: false
			}]
		},
		{
			id: "custom-openai",
			type: "env_var",
			name: "Custom OpenAI-Compatible Endpoint",
			description: "Connect DeepSeek, Groq, Together, Fireworks, OpenAI, LiteLLM, vLLM, or LM Studio.",
			vars: [
				{
					name: "OLYMPUS_BASE_URL",
					label: "API Base URL",
					secret: false,
					optional: false
				},
				{
					name: "OLYMPUS_OPENAI_API_KEY",
					label: "API key (optional for local servers)",
					secret: true,
					optional: true
				},
				{
					name: "OLYMPUS_MODEL",
					label: "Default Model ID (optional)",
					secret: false,
					optional: true
				}
			]
		},
		{
			id: "ollama-local",
			type: "env_var",
			name: "Local Ollama (Zero API Key)",
			description: "Use local open-weights models running on your machine via Ollama.",
			vars: [{
				name: "OLYMPUS_USE_OLLAMA",
				label: "Enable Ollama (enter 1)",
				secret: false,
				optional: false
			}, {
				name: "OLYMPUS_OLLAMA_HOST",
				label: "Ollama host URL (optional)",
				secret: false,
				optional: true
			}]
		},
		{
			id: "olympus-cli-wizard",
			type: "terminal",
			name: "Configure via Olympus CLI wizard",
			description: "Run interactive olympus login in the built-in terminal.",
			args: ["login"]
		}
	];
}
function extractSystemPromptText(sp) {
	if (!sp) return void 0;
	if (typeof sp === "string") return sp;
	if (Array.isArray(sp?.content)) return sp.content.map((c) => c?.type === "text" ? String(c.text ?? "") : "").filter(Boolean).join("\n\n") || void 0;
}
function promptBlocksToContent(blocks) {
	const parts = [];
	for (const b of Array.isArray(blocks) ? blocks : []) {
		if (!b || typeof b !== "object") continue;
		if (b.type === "text" && typeof b.text === "string") parts.push({
			type: "text",
			text: b.text
		});
		else if (b.type === "resource_link" && typeof b.uri === "string") parts.push({
			type: "text",
			text: `[Referenced resource: ${b.title ?? b.name ?? b.uri} (${b.uri})]`
		});
		else if (b.type === "resource" && b.resource) {
			const txt = typeof b.resource.text === "string" ? b.resource.text : "";
			parts.push({
				type: "text",
				text: txt ? `<resource uri="${b.resource.uri ?? ""}">\n${txt}\n</resource>` : `[Resource: ${b.resource.uri ?? ""}]`
			});
		} else if (b.type === "image" && typeof b.data === "string") {
			const mime = typeof b.mimeType === "string" && b.mimeType ? b.mimeType : "image/png";
			parts.push({
				type: "image_url",
				image_url: { url: `data:${mime};base64,${b.data}` }
			});
		}
	}
	if (!parts.length) return "";
	if (parts.every((p) => p.type === "text")) return parts.map((p) => p.text).join("\n\n");
	return parts;
}
function plainTextOfBlocks(blocks) {
	const c = promptBlocksToContent(blocks);
	if (typeof c === "string") return c;
	return c.filter((p) => p.type === "text").map((p) => p.text).join("\n\n");
}
function createOlympusAgentApp(opts = {}) {
	const env = opts.env ?? process.env;
	const version = opts.version ?? "0.1.0";
	let clientCaps = {};
	let providerOverride = null;
	let ollamaCache = null;
	const liveSessions = /* @__PURE__ */ new Map();
	const currentEndpoint = async () => {
		const inputs = inputsFromEnv(env);
		let ollamaOk = false;
		if (!providerOverride && !inputs.openRouterToken && !inputs.aiGatewayToken && !inputs.customToken && !inputs.useOllama) {
			if (!ollamaCache || Date.now() - ollamaCache.checkedAt > 1e4) ollamaCache = {
				checkedAt: Date.now(),
				ok: await detectLocalOllama(inputs.ollamaHost, env.OLYMPUS_DISABLE_OLLAMA_PROBE === "1")
			};
			ollamaOk = ollamaCache.ok;
		}
		return resolveEndpointConfig(inputs, providerOverride, ollamaOk);
	};
	const buildAuthState = async () => {
		const ep = await currentEndpoint();
		if (!ep.configured) return {
			state: "unauthenticated",
			accounts: []
		};
		return {
			state: "authenticated",
			accounts: [{
				id: ep.flavor,
				label: ep.accountHint ?? ep.label,
				plan: ep.label,
				active: true
			}]
		};
	};
	const applyInitialConfig = (stored, initial) => {
		if (!Array.isArray(initial)) return;
		for (const item of initial) {
			const id = String(item?.configId ?? "");
			const val = typeof item?.value === "string" ? item.value.trim() : "";
			if (!val) continue;
			if (id === "model") stored.model = val;
			else if (id === "mode" && (val === "code" || val === "plan" || val === "auto")) stored.mode = val;
			else if (id === "reasoning" && (val === "none" || val === "low" || val === "medium" || val === "high")) stored.reasoning = val;
		}
	};
	const emitUpdate = async (client, live, update, recordInHistory = true) => {
		if (recordInHistory) live.stored.updates.push(update);
		await client.notify(methods.client.session.update, {
			sessionId: live.stored.sessionId,
			update
		});
	};
	const advertiseSessionReady = async (client, live, models) => {
		live.stored.usage.contextSize = contextSizeForModel(live.stored.model, models);
		await emitUpdate(client, live, {
			sessionUpdate: "available_commands_update",
			availableCommands: AVAILABLE_COMMANDS
		}, false);
		await emitUpdate(client, live, {
			sessionUpdate: "usage_update",
			used: live.stored.usage.usedTokens,
			size: live.stored.usage.contextSize,
			...live.stored.usage.costUsd > 0 ? { cost: {
				amount: live.stored.usage.costUsd,
				currency: "USD"
			} } : {},
			_meta: { "_claude/model": live.stored.model }
		}, false);
	};
	const ensureAuthenticatedOrThrow = async () => {
		const ep = await currentEndpoint();
		if (!ep.configured) throw RequestError.authRequired(void 0, "Olympus needs one model provider API key (OpenRouter, Vercel AI Gateway, custom OpenAI-compatible URL) or local Ollama.");
		return ep;
	};
	const app = agent({ name: "olympus" });
	app.onNotification(methods.agent.mcp.message, mcpOverAcpCaller.handleNotification);
	app.onRequest(methods.agent.initialize, async ({ params }) => {
		clientCaps = params?.clientCapabilities ?? {};
		return {
			protocolVersion: 1,
			agentInfo: {
				name: "olympus",
				title: "Olympus",
				version
			},
			authMethods: buildAuthMethods(),
			agentCapabilities: {
				loadSession: true,
				mcpCapabilities: {
					http: true,
					sse: false,
					acp: true
				},
				promptCapabilities: {
					image: true,
					embeddedContext: true
				},
				auth: {
					status: true,
					logout: true
				},
				providers: {},
				sessionCapabilities: {
					list: {},
					resume: {},
					fork: {},
					close: {},
					delete: {},
					archive: {},
					status: {},
					options: {},
					title: {},
					setTitle: {},
					additionalDirectories: {},
					systemPrompt: {}
				}
			},
			_meta: { steering: { supported: true } }
		};
	});
	app.onRequest(methods.agent.auth.status, async () => {
		return await buildAuthState();
	});
	app.onRequest(methods.agent.authenticate, async ({ params, client }) => {
		const metaKey = params?._meta?.["api-key"]?.apiKey;
		if (typeof metaKey === "string" && metaKey.trim()) {
			if (String(params?.methodId ?? "openrouter") === "ai-gateway") env.AI_GATEWAY_API_KEY = metaKey.trim();
			else env.OPENROUTER_API_KEY = metaKey.trim();
			invalidateModelCache();
		}
		const status = await buildAuthState();
		if (status.state !== "authenticated") throw RequestError.authRequired(void 0, "Provide an API key or start local Ollama first.");
		await client.notify(methods.client.auth.statusUpdate, status).catch(() => {});
		return {};
	});
	app.onRequest(methods.agent.logout, async ({ client }) => {
		providerOverride = null;
		delete env.OPENROUTER_API_KEY;
		delete env.AI_GATEWAY_API_KEY;
		delete env.OLYMPUS_OPENAI_API_KEY;
		clearSavedCliSettingsKey(env.AGENTDESK_SHARED_ROOT || env.OLYMPUS_SHARED_DIR);
		invalidateModelCache();
		await client.notify(methods.client.auth.statusUpdate, {
			state: "unauthenticated",
			accounts: []
		}).catch(() => {});
		return {};
	});
	app.onRequest(methods.agent.providers.list, async () => {
		return { providers: [{
			providerId: "openai",
			supported: ["openai"],
			required: false,
			...providerOverride ? { current: {
				apiType: providerOverride.apiType ?? "openai",
				baseUrl: providerOverride.baseUrl
			} } : {}
		}] };
	});
	app.onRequest(methods.agent.providers.set, async ({ params, client }) => {
		const baseUrl = String(params?.baseUrl ?? "").trim();
		if (!/^https?:\/\//i.test(baseUrl)) throw RequestError.invalidParams(void 0, "baseUrl must start with http:// or https://");
		const headers = {};
		if (params?.headers && typeof params.headers === "object") {
			for (const [k, v] of Object.entries(params.headers)) if (typeof v === "string" && v.trim()) headers[k] = v.trim();
		}
		try {
			await fetchRemoteModels(baseUrl, headers, 5e3);
		} catch (e) {
			const msg = String(e?.message ?? e);
			if (/\(401\)|\(403\)|fetch failed|ECONNREFUSED/i.test(msg)) throw RequestError.invalidParams(void 0, msg);
		}
		providerOverride = {
			baseUrl,
			headers,
			apiType: String(params?.apiType ?? "openai")
		};
		invalidateModelCache();
		const status = await buildAuthState();
		await client.notify(methods.client.auth.statusUpdate, status).catch(() => {});
		return {};
	});
	app.onRequest(methods.agent.providers.disable, async ({ client }) => {
		providerOverride = null;
		invalidateModelCache();
		const status = await buildAuthState();
		await client.notify(methods.client.auth.statusUpdate, status).catch(() => {});
		return {};
	});
	app.onRequest(methods.agent.session.options, async ({ params }) => {
		const ep = await currentEndpoint();
		const models = await listAvailableModels(ep);
		const sid = params?.sessionId;
		if (typeof sid === "string" && sid) {
			const s = liveSessions.get(sid)?.stored ?? readStoredSession(sid);
			if (!s) throw RequestError.sessionNotFound(sid);
			return { configOptions: buildConfigOptions(s, models) };
		}
		const cfg = loadCliSettings(env.AGENTDESK_SHARED_ROOT || env.OLYMPUS_SHARED_DIR);
		return { configOptions: buildConfigOptions({
			sessionId: "preview",
			cwd: process.cwd(),
			createdAt: 0,
			updatedAt: 0,
			model: ep.defaultModel,
			mode: cfg.defaultMode ?? "code",
			reasoning: cfg.defaultReasoning ?? "medium",
			messages: [],
			updates: [],
			usage: {
				usedTokens: 0,
				contextSize: contextSizeForModel(ep.defaultModel, models),
				costUsd: 0
			},
			todos: []
		}, models) };
	});
	app.onRequest(methods.agent.session.new, async ({ params, client }) => {
		const ep = await ensureAuthenticatedOrThrow();
		const models = await listAvailableModels(ep);
		const cfg = loadCliSettings(env.AGENTDESK_SHARED_ROOT || env.OLYMPUS_SHARED_DIR);
		const sysText = extractSystemPromptText(params?.systemPrompt);
		const stored = createStoredSession({
			cwd: params.cwd,
			additionalDirectories: Array.isArray(params.additionalDirectories) ? params.additionalDirectories : void 0,
			model: ep.defaultModel,
			mode: cfg.defaultMode ?? "code",
			reasoning: cfg.defaultReasoning ?? "medium",
			systemPrompt: sysText,
			contextSize: contextSizeForModel(ep.defaultModel, models)
		});
		applyInitialConfig(stored, params.configOptions);
		stored.usage.contextSize = contextSizeForModel(stored.model, models);
		saveStoredSession(stored);
		const mcp = new SessionMcpBridge();
		await mcp.connectAll(Array.isArray(params.mcpServers) ? params.mcpServers : [], client);
		const live = {
			stored,
			mcp,
			running: false,
			steeredQueue: []
		};
		liveSessions.set(stored.sessionId, live);
		advertiseSessionReady(client, live, models).catch(() => {});
		return {
			sessionId: stored.sessionId,
			configOptions: buildConfigOptions(stored, models)
		};
	});
	app.onRequest(methods.agent.session.resume, async ({ params, client }) => {
		const models = await listAvailableModels(await ensureAuthenticatedOrThrow());
		const existing = liveSessions.get(params.sessionId);
		const stored = existing?.stored ?? readStoredSession(params.sessionId);
		if (!stored) throw RequestError.sessionNotFound(params.sessionId);
		if (params.cwd) stored.cwd = params.cwd;
		const appended = extractSystemPromptText(params?.systemPrompt);
		if (appended && !stored.systemPrompt) stored.systemPrompt = appended;
		saveStoredSession(stored);
		existing?.mcp.close();
		const mcp = new SessionMcpBridge();
		await mcp.connectAll(Array.isArray(params.mcpServers) ? params.mcpServers : [], client);
		const live = {
			stored,
			mcp,
			running: false,
			steeredQueue: []
		};
		liveSessions.set(stored.sessionId, live);
		advertiseSessionReady(client, live, models).catch(() => {});
		return { configOptions: buildConfigOptions(stored, models) };
	});
	app.onRequest(methods.agent.session.load, async ({ params, client }) => {
		const models = await listAvailableModels(await ensureAuthenticatedOrThrow());
		const existing = liveSessions.get(params.sessionId);
		const stored = existing?.stored ?? readStoredSession(params.sessionId);
		if (!stored) throw RequestError.sessionNotFound(params.sessionId);
		if (params.cwd) stored.cwd = params.cwd;
		existing?.mcp.close();
		const mcp = new SessionMcpBridge();
		await mcp.connectAll(Array.isArray(params.mcpServers) ? params.mcpServers : [], client);
		const live = {
			stored,
			mcp,
			running: false,
			steeredQueue: []
		};
		liveSessions.set(stored.sessionId, live);
		for (const u of stored.updates) await client.notify(methods.client.session.update, {
			sessionId: stored.sessionId,
			update: u
		});
		await advertiseSessionReady(client, live, models);
		return { configOptions: buildConfigOptions(stored, models) };
	});
	app.onRequest(methods.agent.session.fork, async ({ params, client }) => {
		const models = await listAvailableModels(await ensureAuthenticatedOrThrow());
		const source = liveSessions.get(params.sessionId)?.stored ?? readStoredSession(params.sessionId);
		if (!source) throw RequestError.sessionNotFound(params.sessionId);
		const sysText = extractSystemPromptText(params?.systemPrompt);
		const forked = forkStoredSession(source, {
			cwd: params.cwd,
			...sysText !== void 0 ? { systemPrompt: sysText } : {}
		});
		const mcp = new SessionMcpBridge();
		await mcp.connectAll(Array.isArray(params.mcpServers) ? params.mcpServers : [], client);
		const live = {
			stored: forked,
			mcp,
			running: false,
			steeredQueue: []
		};
		liveSessions.set(forked.sessionId, live);
		advertiseSessionReady(client, live, models).catch(() => {});
		return {
			sessionId: forked.sessionId,
			configOptions: buildConfigOptions(forked, models)
		};
	});
	app.onRequest(methods.agent.session.list, async ({ params }) => {
		const archivedFilter = params?.archived;
		return { sessions: listStoredSessions({
			cwd: params?.cwd ?? void 0,
			archived: archivedFilter === "include" || archivedFilter === "only" ? archivedFilter : "exclude"
		}).map((s) => ({
			sessionId: s.sessionId,
			cwd: s.cwd,
			title: s.title ?? "Olympus session",
			updatedAt: new Date(s.updatedAt).toISOString(),
			...s.archived ? { archived: true } : {}
		})) };
	});
	app.onRequest(methods.agent.session.status, async ({ params }) => {
		const live = liveSessions.get(params.sessionId);
		const stored = live?.stored ?? readStoredSession(params.sessionId);
		if (!stored) throw RequestError.sessionNotFound(params.sessionId);
		return {
			status: live ? "open" : "saved",
			state: live?.running ? "busy" : live ? "idle" : "unloaded",
			...stored.archived ? { archived: true } : {}
		};
	});
	app.onRequest(methods.agent.session.setTitle, async ({ params }) => {
		const title = String(params.title ?? "").trim();
		if (!title) throw RequestError.invalidParams(void 0, "Title must not be empty.");
		const stored = liveSessions.get(params.sessionId)?.stored ?? readStoredSession(params.sessionId);
		if (!stored) throw RequestError.sessionNotFound(params.sessionId);
		stored.title = title;
		saveStoredSession(stored);
		return { title };
	});
	app.onRequest(methods.agent.session.close, async ({ params }) => {
		const live = liveSessions.get(params.sessionId);
		if (live) {
			live.abort?.abort();
			live.mcp.close();
			liveSessions.delete(params.sessionId);
		}
		return {};
	});
	app.onRequest(methods.agent.session.archive, async ({ params }) => {
		const live = liveSessions.get(params.sessionId);
		const stored = live?.stored ?? readStoredSession(params.sessionId);
		if (!stored) throw RequestError.sessionNotFound(params.sessionId);
		if (live) {
			live.abort?.abort();
			live.mcp.close();
			liveSessions.delete(params.sessionId);
		}
		stored.archived = true;
		saveStoredSession(stored);
		return {};
	});
	app.onRequest(methods.agent.session.unarchive, async ({ params }) => {
		const stored = liveSessions.get(params.sessionId)?.stored ?? readStoredSession(params.sessionId);
		if (!stored) throw RequestError.sessionNotFound(params.sessionId);
		stored.archived = false;
		saveStoredSession(stored);
		return {};
	});
	app.onRequest(methods.agent.session.delete, async ({ params }) => {
		const live = liveSessions.get(params.sessionId);
		if (live) {
			live.abort?.abort();
			live.mcp.close();
			liveSessions.delete(params.sessionId);
		}
		deleteStoredSession(params.sessionId);
		return {};
	});
	app.onRequest(methods.agent.session.setMode, async ({ params, client }) => {
		const live = liveSessions.get(params.sessionId);
		if (!live) throw RequestError.sessionNotFound(params.sessionId);
		const modeId = String(params.modeId ?? "");
		if (modeId !== "code" && modeId !== "plan" && modeId !== "auto") throw RequestError.invalidParams(void 0, `Unsupported mode: ${modeId}`);
		live.stored.mode = modeId;
		saveStoredSession(live.stored);
		const models = await listAvailableModels(await currentEndpoint());
		await emitUpdate(client, live, {
			sessionUpdate: "config_option_update",
			configOptions: buildConfigOptions(live.stored, models)
		}, false);
		return {};
	});
	app.onRequest(methods.agent.session.setConfigOption, async ({ params, client }) => {
		const live = liveSessions.get(params.sessionId);
		if (!live) throw RequestError.sessionNotFound(params.sessionId);
		const id = String(params.configId ?? "");
		const rawVal = typeof params.value === "string" ? params.value.trim() : String(params.value ?? "");
		const models = await listAvailableModels(await currentEndpoint());
		if (id === "model") {
			if (!rawVal) throw RequestError.invalidParams(void 0, "Model ID cannot be empty.");
			live.stored.model = rawVal;
			live.stored.usage.contextSize = contextSizeForModel(rawVal, models);
			saveCliSettings({ defaultModel: rawVal }, env.AGENTDESK_SHARED_ROOT || env.OLYMPUS_SHARED_DIR);
		} else if (id === "mode") {
			if (rawVal !== "code" && rawVal !== "plan" && rawVal !== "auto") throw RequestError.invalidParams(void 0, `Invalid mode "${rawVal}".`);
			live.stored.mode = rawVal;
			saveCliSettings({ defaultMode: rawVal }, env.AGENTDESK_SHARED_ROOT || env.OLYMPUS_SHARED_DIR);
		} else if (id === "reasoning") {
			if (rawVal !== "none" && rawVal !== "low" && rawVal !== "medium" && rawVal !== "high") throw RequestError.invalidParams(void 0, `Invalid reasoning level "${rawVal}".`);
			live.stored.reasoning = rawVal;
			saveCliSettings({ defaultReasoning: rawVal }, env.AGENTDESK_SHARED_ROOT || env.OLYMPUS_SHARED_DIR);
		} else throw RequestError.invalidParams(void 0, `Unknown config option "${id}".`);
		saveStoredSession(live.stored);
		const updated = buildConfigOptions(live.stored, models);
		await emitUpdate(client, live, {
			sessionUpdate: "usage_update",
			used: live.stored.usage.usedTokens,
			size: live.stored.usage.contextSize,
			...live.stored.usage.costUsd > 0 ? { cost: {
				amount: live.stored.usage.costUsd,
				currency: "USD"
			} } : {},
			_meta: { "_claude/model": live.stored.model }
		}, false);
		return { configOptions: updated };
	});
	app.onNotification(methods.agent.session.cancel, async ({ params }) => {
		liveSessions.get(params.sessionId)?.abort?.abort();
	});
	app.onRequest("_session/steering", (p) => p, async ({ params }) => {
		const live = liveSessions.get(String(params?.sessionId ?? ""));
		if (!live) return { outcome: "failed" };
		if (!live.running) return { outcome: "promptRequired" };
		const content = promptBlocksToContent(params?.prompt ?? []);
		if (!content || typeof content === "string" && !content.trim()) return { outcome: "failed" };
		live.steeredQueue.push({
			role: "user",
			content
		});
		return { outcome: "injected" };
	});
	app.onRequest(methods.agent.session.prompt, async ({ params, signal, client }) => {
		const live = liveSessions.get(params.sessionId);
		if (!live) throw RequestError.sessionNotFound(params.sessionId);
		if (live.running) throw RequestError.invalidRequest(void 0, "Session is already processing a turn.");
		const ep = await ensureAuthenticatedOrThrow();
		const models = await listAvailableModels(ep);
		const rawUserText = plainTextOfBlocks(params.prompt);
		const trimmedCmd = rawUserText.trim();
		live.stored.updates.push({
			sessionUpdate: "user_message_chunk",
			content: {
				type: "text",
				text: rawUserText
			}
		});
		if (trimmedCmd.startsWith(SEP)) {
			const spaceIdx = trimmedCmd.indexOf(" ");
			const cmdName = (spaceIdx >= 0 ? trimmedCmd.slice(1, spaceIdx) : trimmedCmd.slice(1)).toLowerCase();
			const cmdArg = spaceIdx >= 0 ? trimmedCmd.slice(spaceIdx + 1).trim() : "";
			if (cmdName === "status") {
				const statusMd = [
					`**Olympus Native Agent** (\`v${version}\`)`,
					`- **Gateway**: ${ep.label} (\`${ep.baseUrl}\`)`,
					`- **Model**: \`${live.stored.model}\` (context window: ${live.stored.usage.contextSize.toLocaleString()} tokens)`,
					`- **Mode**: \`${live.stored.mode}\` · **Reasoning**: \`${live.stored.reasoning}\``,
					`- **Session Usage**: ${live.stored.usage.usedTokens.toLocaleString()} tokens${live.stored.usage.costUsd > 0 ? ` · $${live.stored.usage.costUsd.toFixed(4)}` : ""}`,
					`- **Connected MCP Tools**: ${live.mcp.tools.size}`
				].join("\n");
				await emitUpdate(client, live, {
					sessionUpdate: "agent_message_chunk",
					messageId: randomUUID(),
					content: {
						type: "text",
						text: statusMd
					}
				});
				saveStoredSession(live.stored);
				return { stopReason: "end_turn" };
			}
			if (cmdName === "clear") {
				live.stored.messages = [];
				live.stored.todos = [];
				live.stored.usage.usedTokens = 0;
				saveStoredSession(live.stored);
				await emitUpdate(client, live, {
					sessionUpdate: "agent_message_chunk",
					messageId: randomUUID(),
					content: {
						type: "text",
						text: "Cleared conversation context for this session."
					}
				});
				await advertiseSessionReady(client, live, models);
				return { stopReason: "end_turn" };
			}
			if (cmdName === "models") {
				if (cmdArg) {
					live.stored.model = cmdArg;
					live.stored.usage.contextSize = contextSizeForModel(cmdArg, models);
					saveStoredSession(live.stored);
					await emitUpdate(client, live, {
						sessionUpdate: "config_option_update",
						configOptions: buildConfigOptions(live.stored, models)
					}, false);
					await advertiseSessionReady(client, live, models);
					await emitUpdate(client, live, {
						sessionUpdate: "agent_message_chunk",
						messageId: randomUUID(),
						content: {
							type: "text",
							text: `Switched active model to \`${cmdArg}\`.`
						}
					});
					return { stopReason: "end_turn" };
				}
				const top = models.slice(0, 20).map((m) => `- \`${m.id}\` — ${m.name} (${Math.round(m.contextSize / 1e3)}k ctx)`).join("\n");
				await emitUpdate(client, live, {
					sessionUpdate: "agent_message_chunk",
					messageId: randomUUID(),
					content: {
						type: "text",
						text: `**Available Models on ${ep.label}** (${models.length} loaded; active: \`${live.stored.model}\`):\n${top}\n\nUse the Model selector below the chat box or run \`${SEP}models <model-id>\` to switch.`
					}
				});
				saveStoredSession(live.stored);
				return { stopReason: "end_turn" };
			}
			if (cmdName === "compact") {
				if (live.stored.messages.length < 2) {
					await emitUpdate(client, live, {
						sessionUpdate: "agent_message_chunk",
						messageId: randomUUID(),
						content: {
							type: "text",
							text: "Conversation is already compact."
						}
					});
					return { stopReason: "end_turn" };
				}
				const summaryRes = await streamChatCompletion({
					baseUrl: ep.baseUrl,
					headers: ep.headers,
					model: live.stored.model,
					providerFlavor: ep.flavor,
					reasoning: "low",
					messages: [
						{
							role: "system",
							content: "Summarize the key decisions, modified files, architecture facts, and remaining tasks from this coding session concisely so work can continue seamlessly."
						},
						...live.stored.messages,
						{
							role: "user",
							content: "Produce a dense technical handoff summary of our session so far."
						}
					],
					signal
				});
				live.stored.messages = [{
					role: "user",
					content: "[Compacted Session Summary]\n" + summaryRes.content
				}, {
					role: "assistant",
					content: "Understood. Continuing from the compacted session summary."
				}];
				live.stored.usage.usedTokens = summaryRes.usage.totalTokens;
				saveStoredSession(live.stored);
				await emitUpdate(client, live, {
					sessionUpdate: "agent_message_chunk",
					messageId: randomUUID(),
					content: {
						type: "text",
						text: `**Compacted context** (${summaryRes.usage.totalTokens.toLocaleString()} tokens):\n\n${summaryRes.content}`
					}
				});
				await advertiseSessionReady(client, live, models);
				return { stopReason: "end_turn" };
			}
		}
		const userContent = promptBlocksToContent(params.prompt);
		live.stored.messages.push({
			role: "user",
			content: userContent
		});
		if (!live.stored.title && rawUserText.trim()) live.stored.title = rawUserText.replace(/\s+/g, " ").trim().slice(0, 60);
		const turnAbort = new AbortController();
		const onReqAbort = () => turnAbort.abort();
		signal.addEventListener("abort", onReqAbort, { once: true });
		live.abort = turnAbort;
		live.running = true;
		const totalTurnUsage = {
			inputTokens: 0,
			outputTokens: 0,
			thoughtTokens: 0,
			cachedReadTokens: 0,
			totalTokens: 0
		};
		try {
			const MAX_STEPS = 28;
			for (let step = 0; step < MAX_STEPS; step++) {
				if (turnAbort.signal.aborted) {
					saveStoredSession(live.stored);
					return {
						stopReason: "cancelled",
						usage: totalTurnUsage
					};
				}
				while (live.steeredQueue.length > 0) {
					const steered = live.steeredQueue.shift();
					live.stored.messages.push(steered);
				}
				const activeBuiltinSpecs = live.stored.mode === "plan" ? BUILTIN_TOOL_SPECS.filter((t) => t.function.name !== "edit_file" && t.function.name !== "write_file") : BUILTIN_TOOL_SPECS;
				const mcpSpecs = [...live.mcp.tools.values()].map((t) => t.spec);
				const allTools = [...activeBuiltinSpecs, ...mcpSpecs];
				const systemMessage = {
					role: "system",
					content: buildSystemInstructions(live.stored.cwd, live.stored.mode, live.stored.systemPrompt)
				};
				const msgId = randomUUID();
				const thoughtId = randomUUID();
				const stepRes = await streamChatCompletion({
					baseUrl: ep.baseUrl,
					headers: ep.headers,
					model: live.stored.model,
					providerFlavor: ep.flavor,
					reasoning: live.stored.reasoning,
					messages: [systemMessage, ...live.stored.messages],
					tools: allTools,
					signal: turnAbort.signal,
					onDelta: async (ev) => {
						if (ev.type === "thought") await emitUpdate(client, live, {
							sessionUpdate: "agent_thought_chunk",
							messageId: thoughtId,
							content: {
								type: "text",
								text: ev.text
							}
						});
						else await emitUpdate(client, live, {
							sessionUpdate: "agent_message_chunk",
							messageId: msgId,
							content: {
								type: "text",
								text: ev.text
							}
						});
					}
				});
				totalTurnUsage.inputTokens += stepRes.usage.inputTokens;
				totalTurnUsage.outputTokens += stepRes.usage.outputTokens;
				totalTurnUsage.thoughtTokens += stepRes.usage.thoughtTokens;
				totalTurnUsage.cachedReadTokens += stepRes.usage.cachedReadTokens;
				totalTurnUsage.totalTokens += stepRes.usage.totalTokens;
				const stepCost = estimateCostUsd(stepRes.usage, live.stored.model, models);
				if (stepCost !== void 0) live.stored.usage.costUsd += stepCost;
				if (stepRes.usage.totalTokens > 0) live.stored.usage.usedTokens = stepRes.usage.inputTokens + stepRes.usage.cachedReadTokens + stepRes.usage.outputTokens;
				await emitUpdate(client, live, {
					sessionUpdate: "usage_update",
					used: live.stored.usage.usedTokens,
					size: live.stored.usage.contextSize,
					...live.stored.usage.costUsd > 0 ? { cost: {
						amount: live.stored.usage.costUsd,
						currency: "USD"
					} } : {},
					_meta: { "_claude/model": stepRes.model ?? live.stored.model }
				}, false);
				live.stored.messages.push({
					role: "assistant",
					content: stepRes.content || null,
					...stepRes.toolCalls.length ? { tool_calls: stepRes.toolCalls } : {}
				});
				saveStoredSession(live.stored);
				if (!stepRes.toolCalls.length) {
					if (live.steeredQueue.length > 0) continue;
					return {
						stopReason: stepRes.finishReason === "length" ? "max_tokens" : "end_turn",
						usage: totalTurnUsage
					};
				}
				for (const tc of stepRes.toolCalls) {
					if (turnAbort.signal.aborted) {
						saveStoredSession(live.stored);
						return {
							stopReason: "cancelled",
							usage: totalTurnUsage
						};
					}
					let parsedArgs = {};
					try {
						parsedArgs = JSON.parse(tc.function.arguments || "{}");
					} catch {
						parsedArgs = {};
					}
					const mcpTool = live.mcp.tools.get(tc.function.name);
					const meta = mcpTool ? {
						kind: "other",
						title: tc.function.name,
						locations: void 0
					} : describeToolCall(tc.function.name, parsedArgs, live.stored.cwd);
					await emitUpdate(client, live, {
						sessionUpdate: "tool_call",
						toolCallId: tc.id,
						title: meta.title,
						name: tc.function.name,
						kind: meta.kind,
						status: "in_progress",
						rawInput: parsedArgs,
						...meta.locations ? { locations: meta.locations } : {}
					});
					try {
						if (mcpTool) {
							const mcpOut = await mcpTool.call(parsedArgs);
							await emitUpdate(client, live, {
								sessionUpdate: "tool_call_update",
								toolCallId: tc.id,
								status: "completed",
								rawOutput: mcpOut,
								content: [{
									type: "content",
									content: {
										type: "text",
										text: mcpOut
									}
								}]
							});
							live.stored.messages.push({
								role: "tool",
								tool_call_id: tc.id,
								name: tc.function.name,
								content: mcpOut
							});
						} else {
							const outcome = await executeBuiltinTool(tc.function.name, parsedArgs, tc.id, {
								sessionId: live.stored.sessionId,
								cwd: live.stored.cwd,
								additionalDirectories: live.stored.additionalDirectories ?? [],
								mode: live.stored.mode,
								signal: turnAbort.signal,
								clientCtx: client,
								clientCaps,
								onTodosUpdated: async (todos) => {
									live.stored.todos = todos;
									await emitUpdate(client, live, {
										sessionUpdate: "plan",
										entries: todos
									});
								},
								onTerminalCreated: async (terminalId) => {
									await emitUpdate(client, live, {
										sessionUpdate: "tool_call_update",
										toolCallId: tc.id,
										status: "in_progress",
										content: [{
											type: "terminal",
											terminalId
										}]
									}, false);
								}
							});
							await emitUpdate(client, live, {
								sessionUpdate: "tool_call_update",
								toolCallId: tc.id,
								title: outcome.title,
								status: outcome.isError ? "failed" : "completed",
								...outcome.locations ? { locations: outcome.locations } : {},
								rawOutput: outcome.output,
								...outcome.acpContent ? { content: outcome.acpContent } : {}
							});
							live.stored.messages.push({
								role: "tool",
								tool_call_id: tc.id,
								name: tc.function.name,
								content: outcome.output
							});
						}
					} catch (toolErr) {
						if (turnAbort.signal.aborted) {
							saveStoredSession(live.stored);
							return {
								stopReason: "cancelled",
								usage: totalTurnUsage
							};
						}
						const errText = `Tool error: ${toolErr?.message ?? String(toolErr)}`;
						await emitUpdate(client, live, {
							sessionUpdate: "tool_call_update",
							toolCallId: tc.id,
							status: "failed",
							rawOutput: errText,
							content: [{
								type: "content",
								content: {
									type: "text",
									text: errText
								}
							}]
						});
						live.stored.messages.push({
							role: "tool",
							tool_call_id: tc.id,
							name: tc.function.name,
							content: errText
						});
					}
					saveStoredSession(live.stored);
				}
			}
			return {
				stopReason: "max_turn_requests",
				usage: totalTurnUsage
			};
		} catch (err) {
			if (turnAbort.signal.aborted) {
				saveStoredSession(live.stored);
				return {
					stopReason: "cancelled",
					usage: totalTurnUsage
				};
			}
			const errMsg = String(err?.message ?? err);
			if (/Authentication failed|\(401\)|\(403\)/i.test(errMsg)) throw RequestError.authRequired(void 0, errMsg);
			throw err;
		} finally {
			signal.removeEventListener("abort", onReqAbort);
			live.running = false;
			live.abort = void 0;
			saveStoredSession(live.stored);
		}
	});
	return app;
}
// src/entry.ts
var VERSION = "0.1.0";
function initSharedStoragePath() {
	const root = (process.env.AGENTDESK_SHARED_ROOT || process.env.OLYMPUS_SHARED_DIR)?.trim() || join(homedir(), ".agents");
	setOlympusSharedDir(root);
	return root;
}
async function runAcpStdioServer() {
	initSharedStoragePath();
	const app = createOlympusAgentApp({
		env: process.env,
		version: VERSION
	});
	const stream = ndJsonStream(Writable.toWeb(process.stdout), Readable.toWeb(process.stdin));
	const conn = app.connect(stream);
	process.stdin.resume();
	await conn.closed;
}
async function resolveCliEndpoint() {
	const inputs = inputsFromEnv(process.env);
	return resolveEndpointConfig(inputs, null, !inputs.openRouterToken && !inputs.aiGatewayToken && !inputs.customToken && !inputs.useOllama ? await detectLocalOllama(inputs.ollamaHost, process.env.OLYMPUS_DISABLE_OLLAMA_PROBE === "1") : false);
}
async function runLoginWizard() {
	const shared = initSharedStoragePath();
	const rl = createInterface({
		input: process.stdin,
		output: process.stdout
	});
	try {
		console.log("\n⚡ Olympus CLI — Provider Setup\n");
		console.log("  1) OpenRouter (Single API key → 500+ models: Claude, GPT-5, Gemini, DeepSeek, Qwen, Grok, Free tier)");
		console.log("  2) Vercel AI Gateway (Single API key → 400+ models at 0% token markup)");
		console.log("  3) Custom OpenAI-Compatible Endpoint (Groq, DeepSeek, Together, OpenAI, LiteLLM, vLLM, LM Studio)");
		console.log("  4) Local Ollama (Zero API key, runs locally on your machine)\n");
		const choice = (await rl.question("Choose provider [1-4] (default 1): ")).trim() || "1";
		if (choice === "4") {
			const host = (await rl.question(`Ollama base URL (Enter for ${GATEWAY_ENDPOINTS.ollama}): `)).trim() || GATEWAY_ENDPOINTS.ollama;
			const model = (await rl.question("Default local model (Enter for qwen2.5-coder:latest): ")).trim() || "qwen2.5-coder:latest";
			saveCliSettings({
				providerFlavor: "ollama",
				baseUrl: host,
				providerKey: "",
				defaultModel: model
			}, shared);
			console.log(`\n✓ Saved Local Ollama configuration (${host}, model: ${model}).\n`);
			return;
		}
		if (choice === "2") {
			const token = (await rl.question("Paste your Vercel AI Gateway API key: ")).trim();
			if (!token) throw new Error("API key is required.");
			const model = (await rl.question("Default model (Enter for Claude Sonnet 4.5): ")).trim();
			saveCliSettings({
				providerFlavor: "ai-gateway",
				baseUrl: GATEWAY_ENDPOINTS.aiGateway,
				providerKey: token,
				...model ? { defaultModel: model } : {}
			}, shared);
			console.log("\n✓ Saved Vercel AI Gateway configuration.\n");
			return;
		}
		if (choice === "3") {
			const baseUrl = (await rl.question(`Base URL (Enter for ${GATEWAY_ENDPOINTS.openai}): `)).trim() || GATEWAY_ENDPOINTS.openai;
			const token = (await rl.question("API key (leave blank for keyless local server): ")).trim();
			const model = (await rl.question("Default model ID (e.g. gpt-4.1, deepseek-chat): ")).trim() || "gpt-4.1";
			saveCliSettings({
				providerFlavor: "openai-compatible",
				baseUrl,
				providerKey: token,
				defaultModel: model
			}, shared);
			console.log(`\n✓ Saved custom endpoint configuration (${baseUrl}, model: ${model}).\n`);
			return;
		}
		const token = (await rl.question("Paste your OpenRouter API key (sk-or-...): ")).trim();
		if (!token) throw new Error("OpenRouter API key is required.");
		const model = (await rl.question("Default model (Enter for Claude Sonnet 4.5): ")).trim();
		saveCliSettings({
			providerFlavor: "openrouter",
			baseUrl: GATEWAY_ENDPOINTS.openrouter,
			providerKey: token,
			...model ? { defaultModel: model } : {}
		}, shared);
		console.log("\n✓ Saved OpenRouter configuration (500+ models unlocked).\n");
	} finally {
		rl.close();
	}
}
async function runModelsList() {
	initSharedStoragePath();
	const ep = await resolveCliEndpoint();
	const models = await listAvailableModels(ep, true);
	console.log(`\nOlympus CLI v${VERSION} — ${ep.label} (${ep.baseUrl})`);
	console.log(`Default model: ${ep.defaultModel}\n`);
	for (const m of models.slice(0, 40)) console.log(`  ${m.id.padEnd(38)}  ${String(Math.round(m.contextSize / 1e3) + "k").padStart(6)}  ${m.name}`);
	if (models.length > 40) console.log(`  ... and ${models.length - 40} more models on this gateway.`);
}
async function runPromptTurn(messages, userPrompt, opts) {
	const ep = await resolveCliEndpoint();
	if (!ep.configured) {
		console.error("Olympus CLI is not configured yet. Run `olympus login` or set OPENROUTER_API_KEY / AI_GATEWAY_API_KEY.");
		process.exitCode = 1;
		return;
	}
	const activeModel = opts.modelOverride || ep.defaultModel;
	messages.push({
		role: "user",
		content: userPrompt
	});
	const ac = new AbortController();
	const onSigint = () => ac.abort();
	process.once("SIGINT", onSigint);
	try {
		for (let step = 0; step < 24; step++) {
			let wroteThoughtHeader = false;
			let inThought = false;
			const res = await streamChatCompletion({
				baseUrl: ep.baseUrl,
				headers: ep.headers,
				model: activeModel,
				providerFlavor: ep.flavor,
				reasoning: "medium",
				messages: [{
					role: "system",
					content: buildSystemInstructions(opts.cwd, opts.autoApprove ? "auto" : "code")
				}, ...messages],
				tools: BUILTIN_TOOL_SPECS,
				signal: ac.signal,
				onDelta: (ev) => {
					if (ev.type === "thought") {
						if (!wroteThoughtHeader) {
							process.stdout.write("\x1B[2m[thinking] ");
							wroteThoughtHeader = true;
							inThought = true;
						}
						process.stdout.write(ev.text);
					} else {
						if (inThought) {
							process.stdout.write("\x1B[0m\n\n");
							inThought = false;
						}
						process.stdout.write(ev.text);
					}
				}
			});
			if (inThought) process.stdout.write("\x1B[0m\n");
			if (res.content) process.stdout.write("\n");
			messages.push({
				role: "assistant",
				content: res.content || null,
				...res.toolCalls.length ? { tool_calls: res.toolCalls } : {}
			});
			if (!res.toolCalls.length) break;
			for (const tc of res.toolCalls) {
				let parsed = {};
				try {
					parsed = JSON.parse(tc.function.arguments || "{}");
				} catch {
					parsed = {};
				}
				process.stdout.write(`\x1b[33m⚡ ${tc.function.name}\x1b[0m\n`);
				const outcome = await executeBuiltinTool(tc.function.name, parsed, tc.id, {
					sessionId: "cli",
					cwd: opts.cwd,
					additionalDirectories: [],
					mode: opts.autoApprove ? "auto" : "code",
					signal: ac.signal,
					askLocalPermission: async (title) => {
						if (opts.autoApprove || !process.stdin.isTTY) return true;
						const rl = createInterface({
							input: process.stdin,
							output: process.stdout
						});
						try {
							const ans = (await rl.question(`  Approve "${title}"? [Y/n]: `)).trim().toLowerCase();
							return ans === "" || ans === "y" || ans === "yes";
						} finally {
							rl.close();
						}
					}
				});
				messages.push({
					role: "tool",
					tool_call_id: tc.id,
					name: tc.function.name,
					content: outcome.output
				});
			}
		}
	} finally {
		process.removeListener("SIGINT", onSigint);
	}
}
async function runInteractiveRepl(cwd, modelOverride, autoApprove = false) {
	initSharedStoragePath();
	const ep = await resolveCliEndpoint();
	console.log(`\n🌋 Olympus CLI v${VERSION} — ${ep.configured ? `${ep.label} (${modelOverride || ep.defaultModel})` : "Unconfigured (run `olympus login`)"}`);
	console.log(`Workspace: ${cwd} · Type 'exit' to quit.\n`);
	const messages = [];
	const rl = createInterface({
		input: process.stdin,
		output: process.stdout
	});
	try {
		for (;;) {
			const line = (await rl.question("\x1B[38;5;208molympus>\x1B[0m ")).trim();
			if (!line) continue;
			if (line === "exit" || line === "quit") break;
			await runPromptTurn(messages, line, {
				cwd,
				modelOverride,
				autoApprove
			});
		}
	} finally {
		rl.close();
	}
}
function runSelfUpdate() {
	console.log("⚡ Updating Olympus Coder CLI from GitHub...");
	const npmCmd = process.platform === "win32" ? ["npm", "cmd"].join(".") : "npm";
	const res = spawnSync(npmCmd, [
		"install",
		"-g",
		"--allow-git=all",
		"github:martianacademy/olympus-coder-cli"
	], { stdio: "inherit" });
	if (res.status !== 0) process.exitCode = res.status ?? 1;
}
function printHelp() {
	console.log(`Olympus CLI v${VERSION} — Native Multi-Model Coding Agent & ACP Server

Usage:
  olympus                   Start interactive coding session in current directory
  olympus "<prompt>"        Run a one-shot coding task in current directory
  olympus acp               Start Agent Client Protocol (ACP) stdio server
  olympus login             Configure OpenRouter / Vercel AI Gateway / Custom / Ollama
  olympus models            List available models on the active gateway
  olympus update            Update Olympus CLI globally in one command

Options:
  -m, --model <id>          Override model ID for this run
  -y, --yes                 Auto-approve file edits and shell commands
  -C, --cwd <dir>           Set working directory
  -v, --version             Print version
  -h, --help                Show help`);
}
async function main(argv = process.argv.slice(2)) {
	if (argv.includes("--version") || argv.includes("-v")) {
		console.log(`olympus ${VERSION}`);
		return;
	}
	if (argv.includes("--help") || argv.includes("-h")) {
		printHelp();
		return;
	}
	if (argv[0] === "acp" || argv.includes("--acp")) {
		await runAcpStdioServer();
		return;
	}
	if (argv[0] === "login" || argv[0] === "auth" || argv[0] === "configure") {
		await runLoginWizard();
		return;
	}
	if (argv[0] === "models") {
		await runModelsList();
		return;
	}
	if (argv[0] === "update" || argv[0] === "upgrade") {
		runSelfUpdate();
		return;
	}
	initSharedStoragePath();
	let cwd = process.cwd();
	let modelOverride;
	let autoApprove = false;
	const positional = [];
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if ((a === "-m" || a === "--model") && argv[i + 1]) modelOverride = argv[++i];
		else if ((a === "-C" || a === "--cwd") && argv[i + 1]) cwd = resolve(argv[++i]);
		else if (a === "-y" || a === "--yes") autoApprove = true;
		else if (a === "-p" || a === "--prompt") {
			if (argv[i + 1]) positional.push(argv[++i]);
		} else positional.push(a);
	}
	if (positional.length > 0) {
		await runPromptTurn([], positional.join(" "), {
			cwd,
			modelOverride,
			autoApprove
		});
		return;
	}
	await runInteractiveRepl(cwd, modelOverride, autoApprove);
}
export { main };
