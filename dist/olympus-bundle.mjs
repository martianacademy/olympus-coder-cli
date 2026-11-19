import { execFile, execFileSync, spawn, spawnSync } from "node:child_process";
import { homedir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { Readable, Writable } from "node:stream";
import { appendFileSync, chmodSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { createInterface } from "node:readline/promises";
import { pathToFileURL } from "node:url";
// ../olympus-coder/node_modules/@agentclientprotocol/sdk/dist/v1/unstable/schema/index.js
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
// ../olympus-coder/node_modules/zod/v4/core/util.js
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
// ../olympus-coder/node_modules/zod/v4/core/core.js
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
// ../olympus-coder/node_modules/zod/v4/core/errors.js
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
// ../olympus-coder/node_modules/zod/v4/core/parse.js
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
// ../olympus-coder/node_modules/zod/v4/core/regexes.js
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
// ../olympus-coder/node_modules/zod/v4/core/checks.js
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
// ../olympus-coder/node_modules/zod/v4/core/doc.js
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
// ../olympus-coder/node_modules/zod/v4/core/versions.js
var version = {
	major: 4,
	minor: 6,
	patch: 7
};
// ../olympus-coder/node_modules/zod/v4/core/schemas.js
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
// ../olympus-coder/node_modules/zod/v4/core/memoizer.js
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
// ../olympus-coder/node_modules/zod/v4/locales/en.js
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
// ../olympus-coder/node_modules/zod/v4/core/registries.js
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
// ../olympus-coder/node_modules/zod/v4/core/api.js
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
// ../olympus-coder/node_modules/zod/v4/core/to-json-schema.js
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
// ../olympus-coder/node_modules/zod/v4/core/json-schema-processors.js
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
// ../olympus-coder/node_modules/zod/v4/classic/errors.js
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
// ../olympus-coder/node_modules/zod/v4/classic/parse.js
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
// ../olympus-coder/node_modules/zod/v4/classic/schemas.js
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
// ../olympus-coder/node_modules/@agentclientprotocol/sdk/dist/core/schema-deserialize.js
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
// ../olympus-coder/node_modules/@agentclientprotocol/sdk/dist/v1/unstable/schema/zod.gen.js
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
// ../olympus-coder/node_modules/@agentclientprotocol/sdk/dist/core/jsonrpc.js
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
// ../olympus-coder/node_modules/@agentclientprotocol/sdk/dist/core/line-buffer.js
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
// ../olympus-coder/node_modules/@agentclientprotocol/sdk/dist/core/stream.js
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
// ../olympus-coder/node_modules/@agentclientprotocol/sdk/dist/core/app-handlers.js
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
// ../olympus-coder/node_modules/@agentclientprotocol/sdk/dist/core/connection-access.js
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
// ../olympus-coder/node_modules/@agentclientprotocol/sdk/dist/v1/acp.js
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
var clientNotificationSpecsByMethod = specsByMethod(clientNotificationSpecs);
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
function clientRequestContext(params, agent, signal, requestId, method) {
	return {
		method,
		params,
		requestId,
		signal,
		agent
	};
}
function clientNotificationContext(params, agent, signal, method) {
	return {
		method,
		params,
		signal,
		agent
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
* Creates a client-side app.
*
* Register request and notification handlers by ACP method name, then use
* `connectWith(...)` to run the workflow that calls agent-side methods.
*/
function client(options) {
	return new ClientApp(options);
}
/**
* Client-side app builder.
*
* Methods on this class register typed client handlers and return `this`, so
* apps can be built with a fluent chain. `connectWith(...)` is the usual entry
* point for clients because it provides a `ClientContext` for calling
* agent-side requests and session helpers.
*/
var ClientApp = class {
	builder = Connection.builder();
	connectHandlers = [];
	fallbackKinds = /* @__PURE__ */ new Set();
	constructor(options = {}) {
		if (options.name) this.builder.name(options.name);
		this.builder.withHandler({
			handleMessage: (message, cx) => sessionUpdateRouter(cx).handleMessage(message),
			describe: () => "client-session-update-router"
		});
	}
	/** @internal */
	[appBuilder]() {
		return this.builder;
	}
	/** @internal */
	[runClientConnectHandlers](connection) {
		runConnectHandlers(connection, this.connectHandlers);
	}
	connect(target) {
		return this.connectConnection(target).connection;
	}
	/**
	* Connects this client app to a stream or agent app for the lifetime of `op`.
	*
	* The callback receives a `ClientContext` for calling agent-side methods.
	* When `op` resolves or rejects, the connection is closed.
	*/
	connectWith(target, op) {
		const { rawConnection, connection } = this.connectConnection(target);
		return rawConnection.runUntil(() => op(connection.agent));
	}
	/**
	* Registers a handler that runs when this client app opens a connection.
	*
	* Use this for connection-scoped work that needs to call agent-side ACP
	* methods outside an inbound request handler.
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
		const spec = clientRequestSpecsByMethod[method];
		if (!spec) throw new Error(`Unknown ACP request method '${method}'. Pass a params parser for custom methods.`);
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
		const spec = clientNotificationSpecsByMethod[method];
		if (!spec) throw new Error(`Unknown ACP notification method '${method}'. Pass a params parser for custom methods.`);
		return this.notification(spec, handlerOrParams);
	}
	request(spec, handler) {
		registerAppRequest(this.builder, spec, (params, cx, signal, requestId, method) => clientRequestContext(params, ClientContext.create(cx, requestId), signal, requestId, method), handler, spec.mapResponse);
		return this;
	}
	notification(spec, handler) {
		registerAppNotification(this.builder, spec, (params, cx, signal, method) => clientNotificationContext(params, ClientContext.create(cx), signal, method), handler);
		return this;
	}
	connectConnection(target) {
		if (isStream(target)) {
			const state = this.openStreamConnection(target);
			this[runClientConnectHandlers](state.connection);
			return state;
		}
		const [thisStream, peerStream] = memoryStreamPair();
		const peerRawConnection = target[appBuilder]().connect(peerStream);
		const peerConnection = agentConnection(peerRawConnection);
		const state = this.openStreamConnection(thisStream);
		state.rawConnection.closed.then(() => peerConnection.close());
		peerRawConnection.closed.then(() => state.connection.close());
		try {
			target[runAgentConnectHandlers](peerConnection);
			this[runClientConnectHandlers](state.connection);
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
			connection: clientConnection(rawConnection, this.connectHandlers)
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
// ../olympus-coder/node_modules/@agentclientprotocol/sdk/dist/mcp/core.js
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
// src/anthropicStream.ts
var CACHEABLE_BLOCK_TYPES = /* @__PURE__ */ new Set([
	"text",
	"image",
	"tool_use",
	"tool_result",
	"document"
]);
function joinApiUrl(baseUrl, suffix) {
	return `${baseUrl.trim().replace(/\/+$/, "")}${suffix.startsWith("/") ? suffix : `/${suffix}`}`;
}
function formatApiError(status, bodyText, url) {
	let detail = bodyText.trim();
	try {
		const parsed = JSON.parse(detail);
		if (parsed && typeof parsed === "object") {
			const rec = parsed;
			const msg = (rec.error && typeof rec.error === "object" ? rec.error : void 0)?.message ?? rec.message ?? rec.error;
			if (msg !== void 0) detail = typeof msg === "string" ? msg : JSON.stringify(msg);
		}
	} catch {}
	return `${status === 401 || status === 403 ? "Authentication failed" : `Model API error (${status})`} at ${url}: ${detail.slice(0, 400) || `HTTP ${status}`}`;
}
/**
* Returns true for Claude 5 reasoning models (`claude-opus-5-5`, `claude-sonnet-5-5`, `claude-fable-5-2`,
* including vendor prefixes, dot/hyphen variants, and dated snapshot suffixes) that require adaptive thinking
* and reject `budget_tokens`, `thinking.type === 'disabled'`, assistant prefill, and forced `tool_choice`.
*/
function isClaude5AdaptiveModel(model) {
	return /claude-(?:opus|sonnet|fable)-5(?:[-.\d]|$)/i.test(model);
}
function asRecord$3(v) {
	return v !== null && typeof v === "object" && !Array.isArray(v) ? v : void 0;
}
/** Clone a content block while stripping any existing `cache_control` marker so caller session blocks stay immutable. */
function cloneWithoutCacheControl(block) {
	const { cache_control: _cc, ...clean } = block;
	return clean;
}
function isCacheableBlock(block) {
	const t = typeof block.type === "string" ? block.type : "";
	if (!CACHEABLE_BLOCK_TYPES.has(t)) return false;
	if (t === "text") return typeof block.text === "string" && block.text.trim().length > 0;
	return true;
}
function applyAnthropicUsage(usage, u, isMessageStart) {
	if (isMessageStart) {
		usage.inputTokens = Number(u.input_tokens ?? 0);
		const cc = asRecord$3(u.cache_creation);
		const cw1h = Number(cc?.ephemeral_1h_input_tokens ?? 0);
		const cw5m = Number(cc?.ephemeral_5m_input_tokens ?? 0);
		const cwTotal = Number(u.cache_creation_input_tokens ?? cw5m + cw1h);
		usage.cachedWrite1hTokens = cw1h;
		usage.cachedWriteTokens = Math.max(0, cwTotal - cw1h);
		usage.cachedReadTokens = Number(u.cache_read_input_tokens ?? 0);
		if (u.output_tokens != null) usage.outputTokens = Number(u.output_tokens);
		return;
	}
	if (u.output_tokens != null) usage.outputTokens = Number(u.output_tokens);
	if (u.input_tokens != null) usage.inputTokens = Number(u.input_tokens);
	if (u.cache_read_input_tokens != null) usage.cachedReadTokens = Number(u.cache_read_input_tokens);
	const cc = asRecord$3(u.cache_creation);
	if (u.cache_creation_input_tokens != null || cc !== void 0) {
		const cw1h = cc?.ephemeral_1h_input_tokens != null ? Number(cc.ephemeral_1h_input_tokens) : usage.cachedWrite1hTokens ?? 0;
		const cw5m = cc?.ephemeral_5m_input_tokens != null ? Number(cc.ephemeral_5m_input_tokens) : 0;
		const cwTotal = u.cache_creation_input_tokens != null ? Number(u.cache_creation_input_tokens) : cw5m + cw1h;
		usage.cachedWrite1hTokens = cw1h;
		usage.cachedWriteTokens = Math.max(0, cwTotal - cw1h);
	}
}
async function streamAnthropicMessages(opts) {
	const url = joinApiUrl(opts.baseUrl, "/messages");
	const systemTexts = [];
	const turns = [];
	const pushTurn = (role, blocks) => {
		if (!blocks.length) return;
		const cloned = blocks.map(cloneWithoutCacheControl);
		const prev = turns[turns.length - 1];
		if (prev && prev.role === role) prev.content.push(...cloned);
		else turns.push({
			role,
			content: cloned
		});
	};
	for (const m of opts.messages) {
		if (m.role === "system") {
			const txt = typeof m.content === "string" ? m.content : JSON.stringify(m.content ?? "");
			if (txt.trim()) systemTexts.push(txt.trim());
			continue;
		}
		if (m.role === "user") {
			const blocks = [];
			if (typeof m.content === "string") {
				if (m.content) blocks.push({
					type: "text",
					text: m.content
				});
			} else if (Array.isArray(m.content)) {
				for (const p of m.content) if (p.type === "text" && p.text) blocks.push({
					type: "text",
					text: p.text
				});
				else if (p.type === "image_url" && p.image_url?.url?.startsWith("data:")) {
					const match = /^data:([^;]+);base64,(.+)$/s.exec(p.image_url.url);
					if (match) blocks.push({
						type: "image",
						source: {
							type: "base64",
							media_type: match[1],
							data: match[2]
						}
					});
				}
			}
			pushTurn("user", blocks.length ? blocks : [{
				type: "text",
				text: "."
			}]);
			continue;
		}
		if (m.role === "assistant") {
			if (Array.isArray(m.anthropicBlocks) && m.anthropicBlocks.length > 0) {
				pushTurn("assistant", m.anthropicBlocks);
				continue;
			}
			const blocks = [];
			if (typeof m.content === "string" && m.content) blocks.push({
				type: "text",
				text: m.content
			});
			if (Array.isArray(m.tool_calls)) for (const tc of m.tool_calls) {
				let parsedInput = {};
				try {
					parsedInput = asRecord$3(JSON.parse(tc.function.arguments || "{}")) ?? {};
				} catch {
					parsedInput = {};
				}
				blocks.push({
					type: "tool_use",
					id: tc.id,
					name: tc.function.name,
					input: parsedInput
				});
			}
			pushTurn("assistant", blocks.length ? blocks : [{
				type: "text",
				text: "..."
			}]);
			continue;
		}
		if (m.role === "tool" && m.tool_call_id) pushTurn("user", [{
			type: "tool_result",
			tool_use_id: m.tool_call_id,
			content: typeof m.content === "string" ? m.content : JSON.stringify(m.content ?? "")
		}]);
	}
	const adaptive = isClaude5AdaptiveModel(opts.model);
	if (adaptive && turns.at(-1)?.role === "assistant") turns.push({
		role: "user",
		content: [{
			type: "text",
			text: "Continue."
		}]
	});
	placeCacheBreakpoint: for (let t = turns.length - 1; t >= 0; t--) {
		const content = turns[t].content;
		for (let b = content.length - 1; b >= 0; b--) if (isCacheableBlock(content[b])) {
			content[b] = {
				...content[b],
				cache_control: { type: "ephemeral" }
			};
			break placeCacheBreakpoint;
		}
	}
	const adaptiveEffort = opts.reasoning === "high" ? "high" : opts.reasoning === "low" || opts.reasoning === "none" ? "low" : "medium";
	const budget = opts.reasoning === "high" ? 8192 : opts.reasoning === "medium" ? 4096 : opts.reasoning === "low" ? 2048 : 0;
	const buildPayload = (enableThinking) => {
		const defaultMaxOut = enableThinking ? adaptive ? 16384 : budget > 0 ? budget + 8192 : 8192 : 8192;
		const maxOut = opts.maxTokens && opts.maxTokens > 0 ? opts.maxTokens : defaultMaxOut;
		const payload = {
			model: opts.model,
			max_tokens: maxOut,
			messages: turns,
			stream: true
		};
		if (systemTexts.length) payload.system = [{
			type: "text",
			text: systemTexts.join("\n\n"),
			cache_control: { type: "ephemeral" }
		}];
		if (opts.tools?.length) payload.tools = opts.tools.map((t) => ({
			name: t.function.name,
			description: t.function.description,
			input_schema: t.function.parameters
		}));
		if (enableThinking && adaptive) {
			payload.thinking = { type: "adaptive" };
			payload.output_config = { effort: adaptiveEffort };
		} else if (enableThinking && budget > 0) payload.thinking = {
			type: "enabled",
			budget_tokens: budget
		};
		else if (opts.temperature !== void 0) payload.temperature = opts.temperature;
		return payload;
	};
	let res = null;
	let errBody = "";
	const attempts = adaptive || budget > 0 ? [true, false] : [false];
	for (const useThink of attempts) {
		res = await fetch(url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Accept: "text/event-stream, application/json",
				"anthropic-version": "2023-06-01",
				...opts.headers
			},
			body: JSON.stringify(buildPayload(useThink)),
			signal: opts.signal
		});
		if (res.ok) break;
		errBody = await res.text().catch(() => "");
		if (!(res.status === 400 && useThink && /thinking|budget_tokens|adaptive|output_config|effort|unknown|unrecognized|extra_forbidden|extra inputs|unsupported|not supported/i.test(errBody))) throw new Error(formatApiError(res.status, errBody, url));
	}
	if (!res || !res.ok || !res.body) throw new Error(formatApiError(res?.status ?? 500, errBody, url));
	let fullText = "";
	let fullThought = "";
	let stopReason = "stop";
	let resolvedModel;
	const usage = {
		inputTokens: 0,
		outputTokens: 0,
		thoughtTokens: 0,
		cachedReadTokens: 0,
		cachedWriteTokens: 0,
		cachedWrite1hTokens: 0,
		totalTokens: 0
	};
	const rawBlocks = /* @__PURE__ */ new Map();
	const reader = res.body.getReader();
	const decoder = new TextDecoder();
	let buf = "";
	const handleLine = async (rawLine) => {
		const line = rawLine.trim();
		if (!line.startsWith("data:")) return;
		const dataStr = line.slice(5).trim();
		if (!dataStr || dataStr === "[DONE]") return;
		let parsed;
		try {
			parsed = JSON.parse(dataStr);
		} catch {
			return;
		}
		const ev = asRecord$3(parsed);
		if (!ev) return;
		if (ev.type === "error" || ev.error) {
			const msg = asRecord$3(ev.error)?.message ?? JSON.stringify(ev.error ?? ev);
			throw new Error(String(msg));
		}
		if (ev.type === "message_start") {
			const message = asRecord$3(ev.message);
			if (message) {
				if (typeof message.model === "string") resolvedModel = message.model;
				const u = asRecord$3(message.usage);
				if (u) applyAnthropicUsage(usage, u, true);
			}
		} else if (ev.type === "content_block_start" && typeof ev.index === "number") {
			const cb = asRecord$3(ev.content_block) ?? {};
			if (cb.type === "thinking") rawBlocks.set(ev.index, {
				type: "thinking",
				thinking: String(cb.thinking ?? ""),
				signature: String(cb.signature ?? "")
			});
			else if (cb.type === "redacted_thinking") rawBlocks.set(ev.index, {
				type: "redacted_thinking",
				data: String(cb.data ?? "")
			});
			else if (cb.type === "text") rawBlocks.set(ev.index, {
				type: "text",
				text: String(cb.text ?? "")
			});
			else if (cb.type === "tool_use") rawBlocks.set(ev.index, {
				type: "tool_use",
				id: String(cb.id ?? ""),
				name: String(cb.name ?? ""),
				argsJson: ""
			});
		} else if (ev.type === "content_block_delta" && typeof ev.index === "number") {
			const slot = rawBlocks.get(ev.index);
			const d = asRecord$3(ev.delta) ?? {};
			if (d.type === "thinking_delta" && typeof d.thinking === "string") {
				if (slot && slot.thinking !== void 0) slot.thinking += d.thinking;
				fullThought += d.thinking;
				await opts.onDelta?.({
					type: "thought",
					text: d.thinking
				});
			} else if (d.type === "signature_delta" && typeof d.signature === "string") {
				if (slot && slot.signature !== void 0) slot.signature += d.signature;
			} else if (d.type === "text_delta" && typeof d.text === "string") {
				if (slot && slot.text !== void 0) slot.text += d.text;
				fullText += d.text;
				await opts.onDelta?.({
					type: "text",
					text: d.text
				});
			} else if (d.type === "input_json_delta" && typeof d.partial_json === "string") {
				if (slot && slot.argsJson !== void 0) slot.argsJson += d.partial_json;
			}
		} else if (ev.type === "message_delta") {
			const sr = asRecord$3(ev.delta)?.stop_reason;
			if (sr === "max_tokens") stopReason = "length";
			else if (sr === "tool_use") stopReason = "tool_calls";
			else if (sr) stopReason = "stop";
			const u = asRecord$3(ev.usage);
			if (u) applyAnthropicUsage(usage, u, false);
		}
	};
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		buf += decoder.decode(value, { stream: true });
		let nl;
		while ((nl = buf.indexOf("\n")) >= 0) {
			const l = buf.slice(0, nl);
			buf = buf.slice(nl + 1);
			await handleLine(l);
		}
	}
	buf += decoder.decode();
	if (buf.trim()) for (const l of buf.split("\n")) await handleLine(l);
	const ordered = [...rawBlocks.entries()].sort((a, b) => a[0] - b[0]).map(([, b]) => b);
	const toolCalls = [];
	const anthropicBlocks = [];
	for (const b of ordered) if (b.type === "thinking" && b.thinking) anthropicBlocks.push({
		type: "thinking",
		thinking: b.thinking,
		...b.signature ? { signature: b.signature } : {}
	});
	else if (b.type === "redacted_thinking" && b.data) anthropicBlocks.push({
		type: "redacted_thinking",
		data: b.data
	});
	else if (b.type === "text" && b.text) anthropicBlocks.push({
		type: "text",
		text: b.text
	});
	else if (b.type === "tool_use" && b.name) {
		const argsStr = String(b.argsJson || "").trim() || "{}";
		let parsedInput = {};
		try {
			parsedInput = asRecord$3(JSON.parse(argsStr)) ?? {};
		} catch {
			parsedInput = {};
		}
		anthropicBlocks.push({
			type: "tool_use",
			id: b.id,
			name: b.name,
			input: parsedInput
		});
		toolCalls.push({
			id: b.id || `toolu_${Date.now()}`,
			type: "function",
			function: {
				name: b.name,
				arguments: argsStr
			}
		});
	}
	if (fullThought) usage.thoughtTokens = Math.ceil(fullThought.length / 4);
	usage.totalTokens = usage.inputTokens + (usage.cachedWriteTokens ?? 0) + (usage.cachedWrite1hTokens ?? 0) + usage.cachedReadTokens + usage.outputTokens;
	return {
		content: fullText,
		thought: fullThought,
		toolCalls,
		finishReason: toolCalls.length ? "tool_calls" : stopReason,
		model: resolvedModel ?? opts.model,
		usage,
		...anthropicBlocks.length ? { anthropicBlocks } : {}
	};
}
// src/chatCacheControl.ts
var EPHEMERAL = { type: "ephemeral" };
/**
* Determine whether a `/chat/completions` request needs explicit `cache_control` injection.
* Skips `:free` OpenRouter community endpoints and providers with native automatic prefix caching (OpenAI, DeepSeek, Ollama).
*/
function supportsChatExplicitCaching(model, flavor) {
	if (flavor !== "openrouter" && flavor !== "olympus-cloud" && flavor !== "ai-gateway") return false;
	let clean = model.trim().toLowerCase();
	const qual = clean.indexOf("::");
	if (qual >= 0) clean = clean.slice(qual + 2);
	if (!clean || clean.endsWith(":free") || clean.endsWith("-free")) return false;
	if (flavor === "openrouter" || flavor === "olympus-cloud") return /^(?:anthropic\/|google\/|claude-|gemini-)/.test(clean);
	return /^(?:anthropic\/|minimax\/|alibaba\/|qwen\/|claude-|minimax-)/.test(clean);
}
function stripPartCacheControl(part) {
	if (!part || typeof part !== "object" || Array.isArray(part)) return part;
	const { cache_control: _cc, ...rest } = part;
	return rest;
}
function hasNonEmptyText(content) {
	if (typeof content === "string") return content.trim().length > 0;
	if (!Array.isArray(content)) return false;
	return content.some((part) => {
		if (!part || typeof part !== "object") return false;
		const rec = part;
		return rec.type === "text" && typeof rec.text === "string" && rec.text.trim().length > 0;
	});
}
function withBlockCacheControl(content) {
	if (typeof content === "string") {
		if (!content.trim()) return void 0;
		return [{
			type: "text",
			text: content,
			cache_control: { ...EPHEMERAL }
		}];
	}
	if (!Array.isArray(content)) return void 0;
	const cloned = content.map((p) => stripPartCacheControl(p));
	for (let i = cloned.length - 1; i >= 0; i--) {
		const part = cloned[i];
		if (part && part.type === "text" && typeof part.text === "string" && part.text.trim().length > 0) {
			cloned[i] = {
				...part,
				cache_control: { ...EPHEMERAL }
			};
			return cloned;
		}
	}
}
/**
* Sanitize `ChatMessage[]` into standard OpenAI `/chat/completions` wire objects, stripping any
* stale `cache_control` properties without mutating caller message or content-part references.
*/
function sanitizePlainChatMessages(messages) {
	return messages.map((m) => {
		const rawMsg = m;
		const cleanContent = Array.isArray(m.content) ? m.content.map((p) => stripPartCacheControl(p)) : m.content ?? "";
		const out = {
			role: m.role,
			content: cleanContent
		};
		if (m.name) out.name = m.name;
		if (m.tool_call_id) out.tool_call_id = m.tool_call_id;
		if (m.tool_calls?.length) out.tool_calls = m.tool_calls;
		rawMsg.cache_control;
		return out;
	});
}
/**
* Prepare both plain and `cache_control`-annotated `/chat/completions` payloads:
* - **OpenRouter (`openrouter`)**: wraps the static `system` message and the trailing `user`/`assistant` text block
*   in multipart `[{ type: 'text', text, cache_control: { type: 'ephemeral' } }]`; when the tail is a `tool` result
*   or tool-only `assistant` message, keeps `tool.content` as a standard string and sets top-level `cache_control`
*   so OpenRouter advances the moving breakpoint onto the converted `tool_result` block.
* - **Vercel AI Gateway (`ai-gateway`)**: attaches message-level `cache_control: { type: 'ephemeral' }` to the
*   `system` message and the final non-empty message (`user`, `tool`, or `assistant`).
*/
function prepareChatCachePayload(messages, model, flavor) {
	const plainMessages = sanitizePlainChatMessages(messages);
	if (!plainMessages.length || !supportsChatExplicitCaching(model, flavor)) return {
		plainMessages,
		cachedMessages: plainMessages
	};
	const cachedMessages = plainMessages.map((m) => ({
		...m,
		...Array.isArray(m.content) ? { content: m.content.map((p) => p && typeof p === "object" ? { ...p } : p) } : {}
	}));
	let sysIdx = -1;
	for (let i = cachedMessages.length - 1; i >= 0; i--) if (cachedMessages[i].role === "system" && hasNonEmptyText(cachedMessages[i].content)) {
		sysIdx = i;
		break;
	}
	if (flavor === "openrouter" || flavor === "olympus-cloud") {
		if (sysIdx >= 0) {
			const wrappedSys = withBlockCacheControl(cachedMessages[sysIdx].content);
			if (wrappedSys) cachedMessages[sysIdx] = {
				...cachedMessages[sysIdx],
				content: wrappedSys
			};
		}
		let topLevelCacheControl;
		for (let i = cachedMessages.length - 1; i >= 0; i--) {
			if (i === sysIdx) continue;
			const msg = cachedMessages[i];
			if (msg.role === "tool") {
				if (hasNonEmptyText(msg.content)) {
					topLevelCacheControl = { ...EPHEMERAL };
					break;
				}
				continue;
			}
			if (msg.role === "user" || msg.role === "assistant") {
				const wrapped = withBlockCacheControl(msg.content);
				if (wrapped) {
					cachedMessages[i] = {
						...msg,
						content: wrapped
					};
					break;
				}
				if (msg.role === "assistant" && Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0) {
					topLevelCacheControl = { ...EPHEMERAL };
					break;
				}
			}
		}
		return {
			plainMessages,
			cachedMessages,
			...topLevelCacheControl ? { topLevelCacheControl } : {}
		};
	}
	if (sysIdx >= 0) cachedMessages[sysIdx] = {
		...cachedMessages[sysIdx],
		cache_control: { ...EPHEMERAL }
	};
	for (let i = cachedMessages.length - 1; i >= 0; i--) {
		if (i === sysIdx) continue;
		const msg = cachedMessages[i];
		const hasTools = Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0;
		if (hasNonEmptyText(msg.content) || hasTools) {
			cachedMessages[i] = {
				...msg,
				cache_control: { ...EPHEMERAL }
			};
			break;
		}
	}
	return {
		plainMessages,
		cachedMessages
	};
}
// src/openaiParser.ts
function partialSuffix(text, tag) {
	const max = Math.min(text.length, tag.length - 1);
	for (let len = max; len >= 1; len--) if (tag.startsWith(text.slice(text.length - len))) return len;
	return 0;
}
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
function asObjRecord(v) {
	return v !== null && typeof v === "object" && !Array.isArray(v) ? v : void 0;
}
function emptyUsage() {
	return {
		inputTokens: 0,
		outputTokens: 0,
		thoughtTokens: 0,
		cachedReadTokens: 0,
		cachedWriteTokens: 0,
		cachedWrite1hTokens: 0,
		totalTokens: 0
	};
}
function extractReasoningDelta(delta) {
	if (typeof delta.reasoning === "string" && delta.reasoning) return delta.reasoning;
	if (typeof delta.reasoning_content === "string" && delta.reasoning_content) return delta.reasoning_content;
	if (Array.isArray(delta.reasoning_details)) return delta.reasoning_details.map((raw) => {
		const d = asObjRecord(raw);
		return typeof d?.text === "string" ? d.text : typeof d?.summary === "string" ? d.summary : "";
	}).join("");
	return "";
}
function applyUsageObject(target, u) {
	const promptDetails = asObjRecord(u.prompt_tokens_details);
	const completionDetails = asObjRecord(u.completion_tokens_details);
	const prompt = Number(u.prompt_tokens ?? u.input_tokens ?? 0);
	const completion = Number(u.completion_tokens ?? u.output_tokens ?? 0);
	const total = Number(u.total_tokens ?? prompt + completion);
	const reasoning = Number(completionDetails?.reasoning_tokens ?? u.reasoning_tokens ?? 0);
	const cached = Number(promptDetails?.cached_tokens ?? u.cache_read_input_tokens ?? 0);
	const cacheWrite = Number(promptDetails?.cache_write_tokens ?? u.cache_creation_input_tokens ?? 0);
	if (prompt > 0 || u.prompt_tokens != null || u.input_tokens != null) target.inputTokens = Math.max(0, prompt - cached - cacheWrite);
	if (cached > 0) target.cachedReadTokens = cached;
	if (cacheWrite > 0) target.cachedWriteTokens = cacheWrite;
	if (completion > 0) target.outputTokens = completion;
	if (reasoning > 0) target.thoughtTokens = reasoning;
	if (total > 0) target.totalTokens = total;
	const cost = u.cost ?? u.total_cost;
	if (typeof cost === "number" && Number.isFinite(cost) && cost >= 0) target.costUsd = cost;
}
async function parseNonStreamingResponse(json, onDelta) {
	if (json.error) {
		const errObj = asObjRecord(json.error);
		const msg = typeof json.error === "string" ? json.error : errObj?.message ?? JSON.stringify(json.error);
		throw new Error(String(msg));
	}
	const choice = Array.isArray(json.choices) ? asObjRecord(json.choices[0]) : void 0;
	const msg = asObjRecord(choice?.message) ?? {};
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
	const toolCalls = [];
	if (Array.isArray(msg.tool_calls)) for (let idx = 0; idx < msg.tool_calls.length; idx++) {
		const tc = asObjRecord(msg.tool_calls[idx]);
		const fn = asObjRecord(tc?.function);
		if (!fn || typeof fn.name !== "string" || !fn.name) continue;
		toolCalls.push({
			id: String(tc?.id || `call_${idx + 1}_${Date.now()}`),
			type: "function",
			function: {
				name: fn.name,
				arguments: typeof fn.arguments === "string" ? fn.arguments : JSON.stringify(fn.arguments ?? {})
			}
		});
	}
	const usage = emptyUsage();
	const rawUsage = asObjRecord(json.usage);
	if (rawUsage) applyUsageObject(usage, rawUsage);
	return {
		content,
		thought,
		toolCalls,
		finishReason: String(choice?.finish_reason ?? (toolCalls.length ? "tool_calls" : "stop")),
		model: typeof json.model === "string" ? json.model : void 0,
		usage
	};
}
// src/sseStream.ts
/**
* Pure HTTP / Server-Sent Events (SSE) OpenAI-compatible chat completion & model-list transport
* for Olympus CLI, delegating Anthropic `/v1/messages` streams to `anthropicStream.ts`.
* Zero filesystem or environment access — callers supply the resolved URL and headers.
*/
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
	const json = asObjRecord(await res.json());
	const rawList = Array.isArray(json?.data) ? json.data : Array.isArray(json?.models) ? json.models : [];
	const out = [];
	for (const item of rawList) {
		const m = asObjRecord(item);
		if (!m || typeof m.id !== "string" || !m.id.trim()) continue;
		const label = typeof m.name === "string" && m.name.trim() ? m.name.trim() : typeof m.display_name === "string" && m.display_name.trim() ? m.display_name.trim() : void 0;
		const ctxLen = Number(m.context_length ?? m.max_input_tokens ?? 0);
		const pricing = asObjRecord(m.pricing);
		const promptPrice = pricing?.prompt != null ? Number(pricing.prompt) : NaN;
		const completionPrice = pricing?.completion != null ? Number(pricing.completion) : NaN;
		out.push({
			id: m.id.trim(),
			...label ? { name: label } : {},
			...ctxLen > 0 ? { contextLength: ctxLen } : {},
			...!Number.isNaN(promptPrice) ? { pricingPromptPerToken: promptPrice } : {},
			...!Number.isNaN(completionPrice) ? { pricingCompletionPerToken: completionPrice } : {}
		});
	}
	return out;
}
async function streamChatCompletion(opts) {
	if (opts.providerFlavor === "anthropic" || opts.baseUrl.includes("api.anthropic.com") && opts.headers["x-api-key"]) return streamAnthropicMessages(opts);
	const url = joinApiUrl(opts.baseUrl, "/chat/completions");
	const { plainMessages, cachedMessages, topLevelCacheControl } = prepareChatCachePayload(opts.messages, opts.model, opts.providerFlavor);
	const buildBody = (compatLevel) => {
		const body = {
			model: opts.model,
			messages: compatLevel === 0 ? cachedMessages : plainMessages,
			stream: true
		};
		if (compatLevel === 0 && topLevelCacheControl) body.cache_control = topLevelCacheControl;
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
				if (opts.providerFlavor === "openrouter" || opts.providerFlavor === "olympus-cloud") body.reasoning = { effort: eff };
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
		if (!(res.status === 400 && level < 2 && /reasoning|stream_options|tool_choice|cache_control|content|unknown|unrecognized|extra_forbidden|unsupported|invalid/i.test(lastErrText))) throw new Error(formatApiError(res.status, lastErrText, url));
	}
	if (!res || !res.ok) throw new Error(formatApiError(res?.status ?? 500, lastErrText, url));
	const ctype = (res.headers.get("content-type") ?? "").toLowerCase();
	if (!ctype.includes("text/event-stream") && ctype.includes("application/json")) return parseNonStreamingResponse(asObjRecord(await res.json()) ?? {}, opts.onDelta);
	if (!res.body) throw new Error("Empty response body from model endpoint.");
	const splitter = new ThinkTagSplitter();
	let fullText = "";
	let fullThought = "";
	let finishReason = "stop";
	let resolvedModel;
	const toolMap = /* @__PURE__ */ new Map();
	const usage = emptyUsage();
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
		if (!line || line.startsWith(":") || !line.startsWith("data:")) return;
		const payload = line.slice(5).trim();
		if (!payload || payload === "[DONE]") return;
		let parsed;
		try {
			parsed = JSON.parse(payload);
		} catch {
			return;
		}
		const chunk = asObjRecord(parsed);
		if (!chunk) return;
		if (chunk.error) {
			const errObj = asObjRecord(chunk.error);
			const msg = typeof chunk.error === "string" ? chunk.error : errObj?.message ?? JSON.stringify(chunk.error);
			throw new Error(String(msg));
		}
		if (typeof chunk.model === "string" && chunk.model) resolvedModel = chunk.model;
		const chunkUsage = asObjRecord(chunk.usage);
		if (chunkUsage) applyUsageObject(usage, chunkUsage);
		const choice = Array.isArray(chunk.choices) ? asObjRecord(chunk.choices[0]) : void 0;
		if (!choice) return;
		if (typeof choice.finish_reason === "string" && choice.finish_reason) finishReason = choice.finish_reason;
		const delta = asObjRecord(choice.delta) ?? asObjRecord(choice.message) ?? {};
		const explicitThought = extractReasoningDelta(delta);
		if (explicitThought) await emitEvents([{
			type: "thought",
			text: explicitThought
		}]);
		if (typeof delta.content === "string" && delta.content) await emitEvents(splitter.push(delta.content));
		else if (Array.isArray(delta.content)) for (const rawPart of delta.content) {
			const part = asObjRecord(rawPart);
			if (part?.type === "thinking" || part?.type === "reasoning") {
				const t = String(part.thinking ?? part.text ?? "");
				if (t) await emitEvents([{
					type: "thought",
					text: t
				}]);
			} else if (typeof part?.text === "string" && part.text) await emitEvents(splitter.push(part.text));
		}
		if (Array.isArray(delta.tool_calls)) for (let i = 0; i < delta.tool_calls.length; i++) {
			const tc = asObjRecord(delta.tool_calls[i]);
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
			const fn = asObjRecord(tc?.function);
			if (typeof fn?.name === "string" && fn.name) slot.name += fn.name;
			if (typeof fn?.arguments === "string" && fn.arguments) slot.args += fn.arguments;
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
// src/pricing.ts
var perMillion = (usd) => Number((usd / 1e6).toPrecision(12));
function makePricing(inUsdPerM, outUsdPerM, readUsdPerM, contextSize, tieredApplied = false) {
	return {
		input: perMillion(inUsdPerM),
		output: perMillion(outUsdPerM),
		cacheRead: perMillion(readUsdPerM),
		cacheWrite5m: perMillion(inUsdPerM * 1.25),
		cacheWrite1h: perMillion(inUsdPerM * 2),
		contextSize,
		...tieredApplied ? { tieredApplied: true } : {}
	};
}
/** Normalize model IDs across `provider::`, `vendor/`, dot/hyphen versions, and `-YYYYMMDD` / `-latest` suffixes. */
function normalizeModelSlug(rawModelId) {
	let s = rawModelId.trim().toLowerCase();
	if (!s || s.endsWith(":free")) return "";
	const qual = s.indexOf("::");
	if (qual >= 0) s = s.slice(qual + 2);
	const slash = s.lastIndexOf("/");
	if (slash >= 0) s = s.slice(slash + 1);
	const colon = s.indexOf(":");
	if (colon >= 0) s = s.slice(0, colon);
	s = s.replace(/\./g, "-");
	s = s.replace(/-(?:latest|\d{8})$/, "");
	return s;
}
/**
* Resolve verified per-token USD rates for known Claude 5.x, 4.x, and 3.7 models.
* `totalPromptTokens` selects the ≤100k vs >100k prompt-token tier on `claude-haiku-5-5`.
*/
function knownModelPricing(modelId, totalPromptTokens = 0) {
	const slug = normalizeModelSlug(modelId);
	if (!slug) return void 0;
	switch (slug) {
		case "claude-opus-5-5": return makePricing(4, 20, .2, 1e6);
		case "claude-sonnet-5-5": return makePricing(2, 10, .1, 1e6);
		case "claude-haiku-5-5": return totalPromptTokens > 1e5 ? makePricing(.5, 2.5, .05, 1e6, true) : makePricing(.1, .5, .01, 1e6, false);
		case "claude-fable-5-2": return makePricing(8, 40, .2, 2e5);
		case "claude-sonnet-4-5":
		case "claude-sonnet-4-6":
		case "claude-sonnet-4-0":
		case "claude-sonnet-4":
		case "claude-3-7-sonnet":
		case "claude-3-5-sonnet": return makePricing(3, 15, .3, 2e5);
		case "claude-opus-4-6":
		case "claude-opus-4-7":
		case "claude-opus-4-8": return makePricing(5, 25, .5, 2e5);
		case "claude-opus-4-5":
		case "claude-opus-4-1":
		case "claude-opus-4-0":
		case "claude-opus-4": return makePricing(15, 75, 1.5, 2e5);
		case "claude-haiku-4-5": return makePricing(1, 5, .1, 2e5);
		default: return;
	}
}
/**
* Compute exact USD cost for a single completion step, honoring provider-reported `usage.costUsd` first,
* merging catalog pricing with `knownModelPricing`, and accounting separately for uncached input,
* 5m cache writes, 1h cache writes, cache reads, and output tokens.
*/
function estimateCostUsd(usage, modelId, models) {
	if (usage.costUsd !== void 0) return usage.costUsd;
	const cw5m = usage.cachedWriteTokens ?? 0;
	const cw1h = usage.cachedWrite1hTokens ?? 0;
	const totalPromptTokens = usage.inputTokens + cw5m + cw1h + usage.cachedReadTokens;
	const hit = models.find((m) => m.id === modelId);
	const known = knownModelPricing(modelId, totalPromptTokens);
	const useTierOverride = Boolean(known?.tieredApplied) && (hit?.promptPricePerToken === void 0 || Math.abs(hit.promptPricePerToken - perMillion(.1)) < 1e-12);
	const inPrice = useTierOverride ? known.input : hit?.promptPricePerToken ?? known?.input;
	const outPrice = useTierOverride ? known.output : hit?.completionPricePerToken ?? known?.output;
	if (inPrice === void 0 || outPrice === void 0) return void 0;
	const scaleKnown = (knownRate) => known && known.input > 0 ? inPrice === known.input ? knownRate : knownRate / known.input * inPrice : 0;
	const readPrice = useTierOverride ? known.cacheRead : hit?.cacheReadPricePerToken !== void 0 ? hit.cacheReadPricePerToken : known ? scaleKnown(known.cacheRead) : .1 * inPrice;
	const write5mPrice = useTierOverride ? known.cacheWrite5m : hit?.cacheWritePricePerToken !== void 0 ? hit.cacheWritePricePerToken : known ? scaleKnown(known.cacheWrite5m) : 1.25 * inPrice;
	const write1hPrice = useTierOverride ? known.cacheWrite1h : hit?.cacheWrite1hPricePerToken !== void 0 ? hit.cacheWrite1hPricePerToken : known ? scaleKnown(known.cacheWrite1h) : 2 * inPrice;
	return usage.inputTokens * inPrice + cw5m * write5mPrice + cw1h * write1hPrice + usage.cachedReadTokens * readPrice + usage.outputTokens * outPrice;
}
// src/olympusCloud.ts
/**
* Olympus Cloud (`olympus-cloud`) paid-only model catalog defaults and live `/v1/account/credits`
* quota formatter for `olympus-coder-cli` (`oly`).
*
* Formats `/status` limit lines in the exact markdown contract parsed by Olympus Coder's `limitProbe.ts`
* (`parseOlympusStatus`), surfacing live credit bars in the desktop UI without requiring any desktop app login wall.
*/
var SEP$4 = String.fromCharCode(47);
var slug = (vendor, model) => `${vendor}${SEP$4}${model}`;
var OLYMPUS_CLOUD_PORTAL_LINK = `https:${SEP$4}${SEP$4}olympus-cloud.olympus-relay.workers.dev${SEP$4}cloud`;
var GROUP_VALUE = "High-Value Coding (10x Credit Runway)";
var GROUP_FRONTIER = "Frontier Coding & Architecture";
var OLYMPUS_CLOUD_MODELS = [
	{
		id: slug("anthropic", "claude-sonnet-5.5"),
		name: "Claude Sonnet 5.5 (1M)",
		group: GROUP_FRONTIER,
		contextSize: 1e6,
		description: "Anthropic 1M-context daily-driver coding & agentic model",
		promptPricePerToken: 2e-6,
		completionPricePerToken: 1e-5,
		cacheReadPricePerToken: 1e-7
	},
	{
		id: slug("anthropic", "claude-opus-5.5"),
		name: "Claude Opus 5.5 (1M)",
		group: GROUP_FRONTIER,
		contextSize: 1e6,
		description: "Anthropic 1M-context deepest architecture & reasoning model",
		promptPricePerToken: 4e-6,
		completionPricePerToken: 2e-5,
		cacheReadPricePerToken: 2e-7
	},
	{
		id: slug("openai", "gpt-5"),
		name: "GPT-5",
		group: GROUP_FRONTIER,
		contextSize: 4e5,
		description: "OpenAI frontier software engineering & reasoning model",
		promptPricePerToken: 125e-8,
		completionPricePerToken: 1e-5,
		cacheReadPricePerToken: 125e-9
	},
	{
		id: slug("google", "gemini-2.5-pro"),
		name: "Gemini 2.5 Pro (1M)",
		group: GROUP_FRONTIER,
		contextSize: 1e6,
		description: "Google 1M-context multimodal & full-repo analysis model",
		promptPricePerToken: 125e-8,
		completionPricePerToken: 1e-5,
		cacheReadPricePerToken: 3.125e-7
	},
	{
		id: slug("anthropic", "claude-haiku-5.5"),
		name: "Claude Haiku 5.5 (1M)",
		group: GROUP_VALUE,
		contextSize: 1e6,
		description: "Ultra-fast 1M-context low-credit Claude coding model",
		promptPricePerToken: 1e-7,
		completionPricePerToken: 5e-7,
		cacheReadPricePerToken: 1e-8
	},
	{
		id: slug("moonshotai", "kimi-k3"),
		name: "Kimi K3 Code",
		group: GROUP_VALUE,
		contextSize: 256e3,
		description: "Moonshot Kimi K3 long-context coding model",
		promptPricePerToken: 6e-7,
		completionPricePerToken: 25e-7,
		cacheReadPricePerToken: 15e-8
	},
	{
		id: slug("deepseek", "deepseek-v4.1-flash"),
		name: "DeepSeek V4.1 Flash",
		group: GROUP_VALUE,
		contextSize: 163840,
		description: "Ultra-low-cost fast agentic coding model",
		promptPricePerToken: 3e-7,
		completionPricePerToken: 12e-7,
		cacheReadPricePerToken: 3e-8
	}
];
var MONTHS_SHORT = [
	"Jan",
	"Feb",
	"Mar",
	"Apr",
	"May",
	"Jun",
	"Jul",
	"Aug",
	"Sep",
	"Oct",
	"Nov",
	"Dec"
];
/** Format epoch ms in the exact `Nov 20, 12:00 AM UTC` shape parsed by `limitProbe.ts` (`parseClaudeReset`). */
function formatResetUtc(epochMs) {
	const d = new Date(epochMs);
	const mon = MONTHS_SHORT[d.getUTCMonth()];
	const day = d.getUTCDate();
	const h24 = d.getUTCHours();
	const min = String(d.getUTCMinutes()).padStart(2, "0");
	const ampm = h24 >= 12 ? "PM" : "AM";
	return `${mon} ${day}, ${h24 % 12 === 0 ? 12 : h24 % 12}:${min} ${ampm} UTC`;
}
function titleCasePlan(plan) {
	const clean = plan.trim().toLowerCase();
	if (!clean || clean === "free") return "No Active Plan";
	return clean[0].toUpperCase() + clean.slice(1);
}
/**
* Query `GET <baseUrl>/account/credits` and format both human-readable credit lines and
* `limitProbe.ts`-compatible utilization bars (`**<label>** — **<pct>%** · Resets <date> · ...`).
*/
async function fetchOlympusCloudStatus(baseUrl, headers, _nowMs = Date.now(), timeoutMs = 4e3) {
	const url = joinApiUrl(baseUrl, "/account/credits");
	try {
		const res = await fetch(url, {
			method: "GET",
			headers: {
				Accept: "application/json",
				...headers
			},
			signal: AbortSignal.timeout(timeoutMs)
		});
		if (res.status === 401 || res.status === 403) return {
			gatewayLabel: "Olympus Cloud",
			lines: ["- **Limits**: Olympus Cloud · saved token was refused (`oly login` to reconnect)"]
		};
		if (!res.ok) return {
			gatewayLabel: "Olympus Cloud",
			lines: [`- **Limits**: Olympus Cloud · status HTTP ${res.status}`]
		};
		const body = await res.json();
		const wallet = body.wallet && typeof body.wallet === "object" ? body.wallet : {};
		const plans = body.plans && typeof body.plans === "object" ? body.plans : {};
		const usdPerCredit = Number(body.usdPerCredit ?? .0075);
		const planRaw = String(wallet.plan ?? "free");
		const planLabel = `Olympus Cloud · ${titleCasePlan(planRaw)}`;
		const planCfg = plans[planRaw] ?? {};
		const planPoolCredits = Number(planCfg.monthlyCredits ?? 0);
		const monthlyCredits = Number(wallet.monthlyCredits ?? 0);
		const topupCredits = Number(wallet.topupCredits ?? 0);
		const availableCredits = Number(wallet.availableCredits ?? monthlyCredits + topupCredits);
		const resetAt = Number(wallet.monthlyResetAt ?? 0);
		const totalCapCredits = Math.max(planPoolCredits + topupCredits, availableCredits);
		if (totalCapCredits <= 0) return {
			gatewayLabel: planLabel,
			lines: [`- **Olympus Credits**: No active credits — subscribe or buy a top-up pack at ${OLYMPUS_CLOUD_PORTAL_LINK}, or switch to OpenRouter / Anthropic / OpenAI / Local Ollama (\`oly login\`).`]
		};
		const lines = [`- **Olympus Credits**: ${availableCredits.toFixed(2)} available (monthly: ${monthlyCredits.toFixed(2)} · top-up: ${topupCredits.toFixed(2)})`];
		const limitUsd = Number((totalCapCredits * usdPerCredit).toFixed(2));
		const remUsd = Number((availableCredits * usdPerCredit).toFixed(2));
		const usedUsd = Number(Math.max(0, limitUsd - remUsd).toFixed(2));
		const pct = limitUsd > 0 ? Math.min(100, Math.max(0, Math.round(usedUsd / limitUsd * 100))) : 0;
		const resetPart = resetAt > 0 ? ` · Resets ${formatResetUtc(resetAt)}` : "";
		lines.push(`**Olympus Cloud credits** — **${pct}%**${resetPart} · $${usedUsd.toFixed(2)} of $${limitUsd.toFixed(2)}`);
		return {
			gatewayLabel: planLabel,
			lines
		};
	} catch {
		return {
			gatewayLabel: "Olympus Cloud",
			lines: ["- **Limits**: Olympus Cloud · offline or unreachable"]
		};
	}
}
// src/paths.ts
/**
* Storage base resolution shared by the session store, the provider store and the secret store.
* Data lives in `<base>/cli/`; the default base is `~/.olympus`.
*/
var configuredSharedDir = "";
var homeDirOverride = "";
function setOlympusSharedDir(dir) {
	configuredSharedDir = dir.trim();
}
function olympusHomeDir() {
	return homeDirOverride || homedir();
}
function defaultSharedBase() {
	return join(olympusHomeDir(), ".olympus");
}
/** The effective base dir: explicit argument > `setOlympusSharedDir` > `~/.olympus`. */
function resolveSharedBase(sharedBase) {
	return resolve(sharedBase?.trim() || configuredSharedDir || defaultSharedBase());
}
function isDefaultSharedBase(base) {
	return resolve(base) === resolve(defaultSharedBase());
}
function olympusRootDir(sharedBase) {
	const dir = join(resolveSharedBase(sharedBase), "cli");
	mkdirSync(dir, { recursive: true });
	return dir;
}
// src/providerEndpoints.ts
var SEP$3 = String.fromCharCode(47);
var LOOPBACK_HOST$1 = [
	127,
	0,
	0,
	1
].join(".");
var GATEWAY_ENDPOINTS = {
	olympusCloud: `https:${SEP$3}${SEP$3}olympus-cloud.olympus-relay.workers.dev${SEP$3}v1`,
	openrouter: `https:${SEP$3}${SEP$3}openrouter.ai${SEP$3}api${SEP$3}v1`,
	aiGateway: `https:${SEP$3}${SEP$3}ai-gateway.vercel.sh${SEP$3}v1`,
	anthropic: `https:${SEP$3}${SEP$3}api.anthropic.com${SEP$3}v1`,
	ollama: `http:${SEP$3}${SEP$3}${LOOPBACK_HOST$1}:11434${SEP$3}v1`,
	lmstudio: `http:${SEP$3}${SEP$3}${LOOPBACK_HOST$1}:1234${SEP$3}v1`,
	openai: `https:${SEP$3}${SEP$3}api.openai.com${SEP$3}v1`
};
var PROVIDER_FLAVORS = [
	"olympus-cloud",
	"openrouter",
	"ai-gateway",
	"anthropic",
	"ollama",
	"openai-compatible"
];
var trimTrailingSlashes = (u) => {
	let out = u.trim();
	while (out.endsWith(SEP$3)) out = out.slice(0, -1);
	return out;
};
function inferFlavorFromUrl(url) {
	const lc = url.toLowerCase();
	if (lc.includes("olympuscoder.app") || lc.includes("olympus-cloud")) return "olympus-cloud";
	if (lc.includes("openrouter.ai")) return "openrouter";
	if (lc.includes("ai-gateway.vercel.sh")) return "ai-gateway";
	if (lc.includes("api.anthropic.com")) return "anthropic";
	if (lc.includes(":11434") || lc.includes("ollama")) return "ollama";
	return "openai-compatible";
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
		return h === LOOPBACK_HOST$1 || h === "localhost" || h === "::1" || h === "[::1]";
	} catch {
		return false;
	}
}
function urlPort(url) {
	try {
		return new URL(url).port;
	} catch {
		return "";
	}
}
var isLmStudioUrl = (url) => isLoopbackUrl(url) && urlPort(url) === "1234";
/** Canonical form used to dedupe providers: lower-case scheme/host, no trailing slash. */
function normalizeBaseUrl(url) {
	const trimmed = trimTrailingSlashes(url);
	try {
		const u = new URL(trimmed);
		return `${u.protocol}//${u.host}${trimTrailingSlashes(u.pathname)}`;
	} catch {
		return trimmed;
	}
}
function labelForFlavor(flavor, baseUrl) {
	if (flavor === "olympus-cloud") return "Olympus Cloud";
	if (isLmStudioUrl(baseUrl)) return "LM Studio (local)";
	if (flavor === "openrouter") return "OpenRouter";
	if (flavor === "anthropic") return "Anthropic (Direct Claude API)";
	if (flavor === "ai-gateway") return "Vercel AI Gateway";
	if (flavor === "ollama") return "Ollama (Local)";
	if (baseUrl.includes("api.openai.com")) return "OpenAI";
	return `OpenAI-Compatible (${safeHost(baseUrl)})`;
}
/** Stable id for a provider (before collision suffixes). */
function deriveProviderId(flavor, baseUrl) {
	if (flavor === "olympus-cloud") return "olympus-cloud";
	if (flavor === "anthropic") return "anthropic";
	if (flavor === "openrouter") return "openrouter";
	if (flavor === "ai-gateway") return "ai-gateway";
	if (isLmStudioUrl(baseUrl)) return "lmstudio";
	if (flavor === "ollama" || urlPort(baseUrl) === "11434") return "ollama";
	let host = "";
	try {
		const u = new URL(baseUrl);
		host = u.hostname.toLowerCase();
		if (host === "api.openai.com") return "openai-api";
		if (u.port) host = `${host}-${u.port}`;
	} catch {
		host = baseUrl.toLowerCase();
	}
	return host.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "custom";
}
/** A saved provider can be used when it has a key, or is a keyless local server. */
function providerUsableWithoutKey(p) {
	return isLoopbackUrl(p.baseUrl) && p.flavor !== "olympus-cloud" || p.flavor === "ollama";
}
/** Keychain service name; `OLYMPUS_KEYCHAIN_SERVICE` overrides it (tests use a unique throwaway service). */
var keychainService = () => process.env.OLYMPUS_KEYCHAIN_SERVICE?.trim() || "olympus-cli";
var SECURITY_BIN = "/usr/bin/security";
/** Read keys, tagged with the provider's `updatedAt` they were read for. Misses are never cached. */
var cache = /* @__PURE__ */ new Map();
var cacheKey = (backend, base, id) => `${backend}\u0000${base}\u0000${id}`;
function keychainAvailable() {
	return process.platform === "darwin" && existsSync(SECURITY_BIN);
}
function preferredSecretBackend() {
	const forced = (process.env.OLYMPUS_SECRET_STORE ?? "").trim().toLowerCase();
	if (forced === "file") return "file";
	if (forced === "keychain") return keychainAvailable() ? "keychain" : "file";
	return keychainAvailable() ? "keychain" : "file";
}
/** Keychain account for a provider: plain id for the default base, `id@<sha8 of base>` for any other base. */
function keychainAccount(providerId, sharedBase) {
	const base = resolveSharedBase(sharedBase);
	if (isDefaultSharedBase(base)) return providerId;
	return `${providerId}@${createHash("sha256").update(base).digest("hex").slice(0, 8)}`;
}
function credentialsFile(sharedBase) {
	return join(resolveSharedBase(sharedBase), "cli", "credentials.json");
}
function readCredentialFile(sharedBase) {
	const f = credentialsFile(sharedBase);
	if (!existsSync(f)) return {};
	try {
		const parsed = JSON.parse(readFileSync(f, "utf8"));
		const keys = parsed && typeof parsed === "object" ? parsed.keys : void 0;
		if (!keys || typeof keys !== "object") return {};
		const out = {};
		for (const [k, v] of Object.entries(keys)) if (typeof v === "string" && v) out[k] = v;
		return out;
	} catch {
		return {};
	}
}
function writeCredentialFile(keys, sharedBase) {
	const f = credentialsFile(sharedBase);
	const dir = join(resolveSharedBase(sharedBase), "cli");
	mkdirSync(dir, {
		recursive: true,
		mode: 448
	});
	chmodSync(dir, 448);
	const tmp = `${f}.${process.pid}.tmp`;
	writeFileSync(tmp, JSON.stringify({
		version: 1,
		keys
	}, null, 2), { mode: 384 });
	chmodSync(tmp, 384);
	renameSync(tmp, f);
	chmodSync(f, 384);
}
/** Quote one argument for the `security -i` command parser (double quotes; `\` and `"` escaped). */
function securityQuote(value) {
	return `"${value.replace(/\\/g, "\\\\").replace(/"/g, "\\\"")}"`;
}
function assertStorableKey(key) {
	if (!key) throw new Error("Refusing to store an empty API key.");
	if (/[\u0000-\u001f\u007f]/.test(key)) throw new Error("API key contains control characters (e.g. a newline); it was not saved.");
}
function keychainWrite(account, key) {
	const line = `add-generic-password -U -s ${securityQuote(keychainService())} -a ${securityQuote(account)} -l ${securityQuote(`Olympus CLI (${account})`)} -w ${securityQuote(key)}\n`;
	return spawnSync(SECURITY_BIN, ["-i"], {
		input: line,
		encoding: "utf8",
		stdio: [
			"pipe",
			"ignore",
			"ignore"
		],
		timeout: 15e3
	}).status === 0;
}
function keychainRead(account) {
	const res = spawnSync(SECURITY_BIN, [
		"find-generic-password",
		"-s",
		keychainService(),
		"-a",
		account,
		"-w"
	], {
		encoding: "utf8",
		stdio: [
			"ignore",
			"pipe",
			"ignore"
		],
		timeout: 15e3
	});
	if (res.status !== 0) return null;
	return String(res.stdout ?? "").replace(/\r?\n$/, "") || null;
}
function keychainDelete(account) {
	spawnSync(SECURITY_BIN, [
		"delete-generic-password",
		"-s",
		keychainService(),
		"-a",
		account
	], {
		stdio: [
			"ignore",
			"ignore",
			"ignore"
		],
		timeout: 15e3
	});
}
/**
* Store `key` for `providerId`. Returns the backend that actually holds it.
* Throws only if no backend could store it (the caller must then keep its previous state).
*/
function writeSecret(providerId, key, sharedBase, prefer = preferredSecretBackend()) {
	assertStorableKey(key);
	const base = resolveSharedBase(sharedBase);
	if (prefer === "keychain" && keychainAvailable()) {
		const account = keychainAccount(providerId, base);
		if (keychainWrite(account, key) && keychainRead(account) === key) {
			cache.set(cacheKey("keychain", base, providerId), { value: key });
			const keys = readCredentialFile(base);
			if (keys[providerId] !== void 0) {
				delete keys[providerId];
				writeCredentialFile(keys, base);
				cache.delete(cacheKey("file", base, providerId));
			}
			return "keychain";
		}
	}
	const keys = readCredentialFile(base);
	keys[providerId] = key;
	writeCredentialFile(keys, base);
	cache.set(cacheKey("file", base, providerId), { value: key });
	return "file";
}
/**
* Read the key for `providerId`. `version` (the provider's `updatedAt`) invalidates the in-process cache when
* another process changed the provider; a miss (no key, locked keychain) is retried on the next call.
*/
function readSecret(providerId, backend, sharedBase, version) {
	const base = resolveSharedBase(sharedBase);
	const ck = cacheKey(backend, base, providerId);
	const hit = cache.get(ck);
	if (hit && (version === void 0 || hit.version === version)) return hit.value;
	let val = null;
	if (backend === "keychain") val = keychainAvailable() ? keychainRead(keychainAccount(providerId, base)) : null;
	else val = readCredentialFile(base)[providerId] ?? null;
	if (val) cache.set(ck, {
		value: val,
		...version !== void 0 ? { version } : {}
	});
	else cache.delete(ck);
	return val ?? void 0;
}
/** Remove the key for `providerId`: from the Keychain when `backend` says it lives there, and always from the file. */
function deleteSecret(providerId, sharedBase, backend) {
	const base = resolveSharedBase(sharedBase);
	if (backend === "keychain" && keychainAvailable()) keychainDelete(keychainAccount(providerId, base));
	const keys = readCredentialFile(base);
	if (keys[providerId] !== void 0) {
		delete keys[providerId];
		writeCredentialFile(keys, base);
	}
	cache.delete(cacheKey("keychain", base, providerId));
	cache.delete(cacheKey("file", base, providerId));
}
// src/providerStore.ts
var FLAVORS = PROVIDER_FLAVORS;
var settingsPath = (base) => join(base, "cli", "settings.json");
function readJsonFile(file) {
	if (!existsSync(file)) return {
		ok: false,
		exists: false
	};
	try {
		const text = readFileSync(file, "utf8");
		return {
			ok: true,
			value: JSON.parse(text),
			text
		};
	} catch {
		return {
			ok: false,
			exists: true
		};
	}
}
function writeSettingsFile(base, s) {
	const dir = join(base, "cli");
	mkdirSync(dir, { recursive: true });
	const f = settingsPath(base);
	const tmp = `${f}.${process.pid}.tmp`;
	writeFileSync(tmp, JSON.stringify(s, null, 2));
	renameSync(tmp, f);
}
function backupFile(srcText, base, name) {
	const dir = join(base, "cli");
	let target = join(dir, `${name}.json`);
	if (existsSync(target)) target = join(dir, `${name}.${Date.now()}.json`);
	writeFileSync(target, srcText, { mode: 384 });
	chmodSync(target, 384);
}
var isObj = (v) => Boolean(v) && typeof v === "object" && !Array.isArray(v);
var isMode = (v) => v === "code" || v === "plan" || v === "auto";
var isReasoning = (v) => v === "none" || v === "low" || v === "medium" || v === "high";
var str$1 = (v) => typeof v === "string" ? v.trim() : "";
function sanitizeV2(raw) {
	const providers = [];
	for (const p of Array.isArray(raw.providers) ? raw.providers : []) {
		if (!isObj(p) || !str$1(p.id) || !str$1(p.baseUrl)) continue;
		const flavor = FLAVORS.includes(p.flavor) ? p.flavor : inferFlavorFromUrl(p.baseUrl);
		providers.push({
			id: str$1(p.id),
			flavor,
			label: str$1(p.label) || labelForFlavor(flavor, p.baseUrl),
			baseUrl: trimTrailingSlashes(p.baseUrl),
			...str$1(p.defaultModel) ? { defaultModel: str$1(p.defaultModel) } : {},
			keyStore: p.keyStore === "keychain" || p.keyStore === "file" ? p.keyStore : "none",
			createdAt: Number(p.createdAt) || Date.now(),
			updatedAt: Number(p.updatedAt) || Date.now()
		});
	}
	const s = {
		version: 2,
		providers
	};
	if (str$1(raw.activeProviderId) && providers.some((p) => p.id === raw.activeProviderId)) s.activeProviderId = raw.activeProviderId;
	if (isMode(raw.defaultMode)) s.defaultMode = raw.defaultMode;
	if (isReasoning(raw.defaultReasoning)) s.defaultReasoning = raw.defaultReasoning;
	if (str$1(raw.defaultModel)) s.defaultModel = str$1(raw.defaultModel);
	if (Array.isArray(raw.importedLegacy)) s.importedLegacy = raw.importedLegacy.filter((x) => typeof x === "string");
	return s;
}
function v1ToInput(v1) {
	const key = str$1(v1.providerKey);
	const rawUrl = str$1(v1.baseUrl);
	if (!rawUrl && !key) return null;
	const baseUrl = trimTrailingSlashes(rawUrl || GATEWAY_ENDPOINTS.openrouter);
	return {
		flavor: FLAVORS.includes(v1.providerFlavor) ? v1.providerFlavor : inferFlavorFromUrl(baseUrl),
		baseUrl,
		...key ? { key } : {},
		...str$1(v1.defaultModel) ? { defaultModel: str$1(v1.defaultModel) } : {}
	};
}
/**
* One saved provider per endpoint URL. The flavor is not part of the identity: older versions saved the same
* LM Studio URL as `ollama` in one file and `openai-compatible` in another, and those must not become twins.
*/
var sameProvider = (p, baseUrl) => normalizeBaseUrl(p.baseUrl) === normalizeBaseUrl(baseUrl);
/** Ids used by non-saved connected providers / the ACP override slot; saved providers never take them. */
var isReservedId = (id) => id === "openai" || id === "acp" || id === "ollama-auto" || id.startsWith("env-");
function uniqueId(s, wanted) {
	if (!isReservedId(wanted) && !s.providers.some((p) => p.id === wanted)) return wanted;
	for (let n = 2;; n++) {
		const id = `${wanted}-${n}`;
		if (!isReservedId(id) && !s.providers.some((p) => p.id === id)) return id;
	}
}
/**
* In-memory upsert (secrets are written immediately; the caller writes settings.json).
* `onlyFillMissingKey`: migration mode — never replace a key the provider already has.
*/
function applyUpsert(s, base, input, opts = {}) {
	const now = Date.now();
	const baseUrl = trimTrailingSlashes(input.baseUrl);
	let p = s.providers.find((x) => sameProvider(x, baseUrl));
	const created = !p;
	if (!p) {
		p = {
			id: uniqueId(s, deriveProviderId(input.flavor, baseUrl)),
			flavor: input.flavor,
			label: input.label?.trim() || labelForFlavor(input.flavor, baseUrl),
			baseUrl,
			keyStore: "none",
			createdAt: now,
			updatedAt: now
		};
		s.providers.push(p);
	}
	const key = input.key?.trim();
	if (key && !(opts.onlyFillMissingKey && p.keyStore !== "none")) p.keyStore = writeSecret(p.id, key, base);
	if (input.defaultModel?.trim() && !(opts.onlyFillMissingKey && p.defaultModel)) p.defaultModel = input.defaultModel.trim();
	if (input.label?.trim() && !opts.onlyFillMissingKey) p.label = input.label.trim();
	p.updatedAt = now;
	if (opts.makeActive || !s.activeProviderId) s.activeProviderId = p.id;
	return {
		provider: p,
		created
	};
}
function legacyCandidates(base) {
	const out = [join(base, "olympus-cli", "settings.json")];
	if (isDefaultSharedBase(base)) out.push(join(olympusHomeDir(), ".agents", "olympus-cli", "settings.json"));
	return out;
}
/** Load the v2 store for `sharedBase`, migrating v1 / legacy files on first use (idempotent). */
function loadProviderSettings(sharedBase) {
	const base = resolveSharedBase(sharedBase);
	const file = settingsPath(base);
	const read = readJsonFile(file);
	let s = {
		version: 2,
		providers: []
	};
	let dirty = false;
	if (read.ok && isObj(read.value)) {
		const raw = read.value;
		if (raw.version === 2) {
			s = sanitizeV2(raw);
			const stray = v1ToInput(raw);
			if (stray) {
				backupFile(read.text, base, "settings.v1.backup");
				applyUpsert(s, base, stray, { makeActive: true });
				dirty = true;
			}
		} else {
			const input = v1ToInput(raw);
			if (input) applyUpsert(s, base, input, { makeActive: true });
			if (isMode(raw.defaultMode)) s.defaultMode = raw.defaultMode;
			if (isReasoning(raw.defaultReasoning)) s.defaultReasoning = raw.defaultReasoning;
			if (!input && str$1(raw.defaultModel)) s.defaultModel = str$1(raw.defaultModel);
			backupFile(read.text, base, "settings.v1.backup");
			dirty = true;
		}
	} else if (!read.ok && read.exists) {
		try {
			backupFile(readFileSync(file, "utf8"), base, "settings.corrupt.backup");
		} catch {}
		dirty = true;
	}
	for (const legacy of legacyCandidates(base)) {
		if (s.importedLegacy?.includes(legacy)) continue;
		const lr = readJsonFile(legacy);
		if (!lr.ok || !isObj(lr.value)) continue;
		const input = v1ToInput(lr.value);
		if (input) applyUpsert(s, base, input, { onlyFillMissingKey: true });
		if (!s.defaultMode && isMode(lr.value.defaultMode)) s.defaultMode = lr.value.defaultMode;
		if (!s.defaultReasoning && isReasoning(lr.value.defaultReasoning)) s.defaultReasoning = lr.value.defaultReasoning;
		s.importedLegacy = [...s.importedLegacy ?? [], legacy];
		dirty = true;
	}
	if (dirty) writeSettingsFile(base, s);
	return s;
}
function mutate(sharedBase, fn) {
	const base = resolveSharedBase(sharedBase);
	const s = loadProviderSettings(base);
	const out = fn(s, base);
	writeSettingsFile(base, s);
	return out;
}
function mustFind(s, id) {
	const p = s.providers.find((x) => x.id === id);
	if (!p) {
		const ids = s.providers.map((x) => x.id).join(", ") || "none saved";
		throw new Error(`Unknown provider "${id}" (saved: ${ids}).`);
	}
	return p;
}
function listSavedProviders(sharedBase) {
	return loadProviderSettings(sharedBase).providers;
}
function getSavedProvider(id, sharedBase) {
	return loadProviderSettings(sharedBase).providers.find((p) => p.id === id);
}
function getActiveProvider(sharedBase) {
	const s = loadProviderSettings(sharedBase);
	return s.providers.find((p) => p.id === s.activeProviderId);
}
/** The saved provider for this endpoint URL (whatever flavor it was saved with). */
function findSavedProvider(baseUrl, sharedBase) {
	return loadProviderSettings(sharedBase).providers.find((p) => sameProvider(p, baseUrl));
}
/** Add a provider, or update the one with the same flavor + normalized base URL in place. */
function upsertProvider(input, opts = {}, sharedBase) {
	return mutate(sharedBase, (s, base) => {
		const { provider, created } = applyUpsert(s, base, input, { makeActive: opts.makeActive });
		return {
			provider: { ...provider },
			created,
			active: s.activeProviderId === provider.id
		};
	});
}
/** Change a saved provider's base URL / key / default model / label (keeps its id). */
function updateProvider(id, patch, sharedBase) {
	return mutate(sharedBase, (s, base) => {
		const p = mustFind(s, id);
		if (patch.baseUrl?.trim()) p.baseUrl = trimTrailingSlashes(patch.baseUrl);
		if (patch.key?.trim()) p.keyStore = writeSecret(p.id, patch.key.trim(), base);
		if (patch.defaultModel?.trim()) p.defaultModel = patch.defaultModel.trim();
		if (patch.label?.trim()) p.label = patch.label.trim();
		p.updatedAt = Date.now();
		return { ...p };
	});
}
function setActiveProvider(id, sharedBase) {
	return mutate(sharedBase, (s) => {
		const p = mustFind(s, id);
		s.activeProviderId = p.id;
		return { ...p };
	});
}
/** Remove one provider and its secret. If it was active, the next saved provider becomes active. */
function removeProvider(id, sharedBase) {
	return mutate(sharedBase, (s, base) => {
		const p = mustFind(s, id);
		const idx = s.providers.indexOf(p);
		s.providers.splice(idx, 1);
		deleteSecret(p.id, base, p.keyStore);
		if (s.activeProviderId === p.id) {
			const next = s.providers[idx] ?? s.providers[idx - 1] ?? s.providers[0];
			if (next) s.activeProviderId = next.id;
			else delete s.activeProviderId;
		}
		return {
			removed: p,
			...s.activeProviderId ? { activeProviderId: s.activeProviderId } : {}
		};
	});
}
function setProviderDefaultModel(id, model, sharedBase) {
	mutate(sharedBase, (s) => {
		const p = mustFind(s, id);
		p.defaultModel = model.trim();
		p.updatedAt = Date.now();
	});
}
/** Default model remembered for providers that are not saved (env vars / ACP override / auto-detected). */
function setUnsavedProviderDefaultModel(model, sharedBase) {
	mutate(sharedBase, (s) => {
		s.defaultModel = model.trim();
	});
}
function getProviderKey(id, sharedBase) {
	const base = resolveSharedBase(sharedBase);
	const p = loadProviderSettings(base).providers.find((x) => x.id === id);
	if (!p || p.keyStore === "none") return void 0;
	return readSecret(p.id, p.keyStore, base, p.updatedAt) ?? (p.keyStore === "keychain" ? readSecret(p.id, "file", base, p.updatedAt) : void 0);
}
/** v1-shaped view: global defaults plus the active provider. */
function loadCliSettings(sharedBase) {
	const base = resolveSharedBase(sharedBase);
	const s = loadProviderSettings(base);
	const active = s.providers.find((p) => p.id === s.activeProviderId);
	const out = {};
	if (active) {
		out.providerFlavor = active.flavor;
		out.baseUrl = active.baseUrl;
		const key = getProviderKey(active.id, base);
		if (key) out.providerKey = key;
	}
	const model = active?.defaultModel ?? s.defaultModel;
	if (model) out.defaultModel = model;
	if (s.defaultMode) out.defaultMode = s.defaultMode;
	if (s.defaultReasoning) out.defaultReasoning = s.defaultReasoning;
	return out;
}
/**
* v1-style patch. `defaultMode` / `defaultReasoning` are global; `providerFlavor` / `baseUrl` / `providerKey`
* add or update a provider and make it active (others are kept); `defaultModel` goes to the active provider.
*/
function saveCliSettings(patch, sharedBase) {
	const base = resolveSharedBase(sharedBase);
	mutate(base, (s) => {
		if (patch.defaultMode !== void 0) {
			if (isMode(patch.defaultMode)) s.defaultMode = patch.defaultMode;
			else delete s.defaultMode;
		}
		if (patch.defaultReasoning !== void 0) {
			if (isReasoning(patch.defaultReasoning)) s.defaultReasoning = patch.defaultReasoning;
			else delete s.defaultReasoning;
		}
		let target = s.providers.find((p) => p.id === s.activeProviderId);
		if (str$1(patch.providerFlavor) || str$1(patch.baseUrl) || str$1(patch.providerKey)) {
			const flavor = patch.providerFlavor ?? target?.flavor ?? inferFlavorFromUrl(patch.baseUrl ?? "");
			const baseUrl = str$1(patch.baseUrl) || target?.baseUrl || GATEWAY_ENDPOINTS.openrouter;
			target = applyUpsert(s, base, {
				flavor,
				baseUrl,
				key: patch.providerKey
			}, { makeActive: true }).provider;
		}
		if (str$1(patch.defaultModel)) {
			if (target) target.defaultModel = str$1(patch.defaultModel);
			else s.defaultModel = str$1(patch.defaultModel);
		}
	});
	return loadCliSettings(base);
}
// src/providers.ts
var SEP$2 = String.fromCharCode(47);
var LOOPBACK_HOST = [
	127,
	0,
	0,
	1
].join(".");
var slugId = (vendor, model) => `${vendor}${SEP$2}${model}`;
var ANTHROPIC_DIRECT_MODELS = [
	{
		id: "claude-sonnet-5-5",
		name: "Claude Sonnet 5.5",
		group: "Anthropic Claude",
		contextSize: 1e6,
		description: "Anthropic 1M-context daily-driver coding & adaptive-thinking model",
		promptPricePerToken: 2e-6,
		completionPricePerToken: 1e-5,
		cacheReadPricePerToken: 1e-7
	},
	{
		id: "claude-opus-5-5",
		name: "Claude Opus 5.5",
		group: "Anthropic Claude",
		contextSize: 1e6,
		description: "Anthropic 1M-context frontier architecture & adaptive-thinking model",
		promptPricePerToken: 4e-6,
		completionPricePerToken: 2e-5,
		cacheReadPricePerToken: 2e-7
	},
	{
		id: "claude-haiku-5-5",
		name: "Claude Haiku 5.5",
		group: "Anthropic Claude",
		contextSize: 1e6,
		description: "Ultra-fast 1M-context Claude coding model ($0.10/1M ≤100k)",
		promptPricePerToken: 1e-7,
		completionPricePerToken: 5e-7,
		cacheReadPricePerToken: 1e-8
	},
	{
		id: "claude-fable-5-2",
		name: "Claude Fable 5.2",
		group: "Anthropic Claude",
		contextSize: 2e5,
		description: "Anthropic deep synthesis & adaptive-thinking specialist model",
		promptPricePerToken: 8e-6,
		completionPricePerToken: 4e-5,
		cacheReadPricePerToken: 2e-7
	},
	{
		id: "claude-sonnet-4-5",
		name: "Claude Sonnet 4.5",
		group: "Anthropic Claude",
		contextSize: 2e5,
		description: "Anthropic Claude 4.5 coding & extended-thinking model",
		promptPricePerToken: 3e-6,
		completionPricePerToken: 15e-6,
		cacheReadPricePerToken: 3e-7
	},
	{
		id: "claude-opus-4-5",
		name: "Claude Opus 4.5",
		group: "Anthropic Claude",
		contextSize: 2e5,
		description: "Anthropic Claude Opus 4.5 reasoning model",
		promptPricePerToken: 15e-6,
		completionPricePerToken: 75e-6,
		cacheReadPricePerToken: 15e-7
	},
	{
		id: "claude-haiku-4-5",
		name: "Claude Haiku 4.5",
		group: "Anthropic Claude",
		contextSize: 2e5,
		description: "Fast Claude 4.5 coding model",
		promptPricePerToken: 1e-6,
		completionPricePerToken: 5e-6,
		cacheReadPricePerToken: 1e-7
	}
];
var FEATURED = "Featured Coding Models";
var OPEN_WEIGHTS = "Open-Weights & High Value";
var FREE_TIER = "Free Tier (OpenRouter)";
var CURATED_MODELS = [
	{
		id: slugId("anthropic", "claude-sonnet-5.5"),
		name: "Claude Sonnet 5.5 (1M)",
		group: FEATURED,
		contextSize: 1e6,
		description: "Anthropic 1M-context daily-driver coding & agentic tool-use model"
	},
	{
		id: slugId("anthropic", "claude-opus-5.5"),
		name: "Claude Opus 5.5 (1M)",
		group: FEATURED,
		contextSize: 1e6,
		description: "Anthropic 1M-context deepest reasoning & multi-file architecture model"
	},
	{
		id: slugId("anthropic", "claude-haiku-5.5"),
		name: "Claude Haiku 5.5 (1M)",
		group: FEATURED,
		contextSize: 1e6,
		description: "Anthropic ultra-fast 1M-context low-cost coding model"
	},
	{
		id: slugId("anthropic", "claude-sonnet-4.5"),
		name: "Claude Sonnet 4.5",
		group: FEATURED,
		contextSize: 2e5,
		description: "Anthropic Claude 4.5 coding & extended-thinking model"
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
function defaultHeadersForFlavor(flavor) {
	if (flavor === "anthropic") return { "anthropic-version": "2023-06-01" };
	if (flavor === "olympus-cloud") return { "X-Title": "Olympus Coder" };
	if (flavor !== "openrouter") return {};
	return {
		"HTTP-Referer": `https:${SEP$2}${SEP$2}olympuscoder.app`,
		"X-Title": "Olympus Coder"
	};
}
function withToken(base, token, flavor) {
	if (!token?.trim()) return { ...base };
	const t = token.trim();
	if (flavor === "anthropic") return {
		...base,
		"x-api-key": t,
		"anthropic-version": "2023-06-01"
	};
	return {
		...base,
		Authorization: `Bearer ${t}`
	};
}
function defaultModelForFlavor(flavor, preferred, cfgDefault) {
	if (preferred?.trim()) return preferred.trim();
	if (cfgDefault?.trim()) {
		if (flavor === "anthropic" && cfgDefault.includes(SEP$2)) return "claude-sonnet-5-5";
		return cfgDefault.trim();
	}
	if (flavor === "anthropic") return "claude-sonnet-5-5";
	if (flavor === "olympus-cloud" || flavor === "openrouter" || flavor === "ai-gateway") return slugId("anthropic", "claude-sonnet-5.5");
	if (flavor === "ollama") return "qwen2.5-coder:latest";
	return "gpt-4.1";
}
/** Split `providerId::modelId` (only when the prefix is non-empty); plain ids pass through. */
function parseModelRef(value) {
	const v = value.trim();
	const idx = v.indexOf("::");
	if (idx > 0) return {
		providerId: v.slice(0, idx),
		model: v.slice(idx + 2)
	};
	return { model: v };
}
var ensureV1 = (u) => u.endsWith(`${SEP$2}v1`) ? u : `${u}${SEP$2}v1`;
/** Every provider that can serve requests right now, plus the default one. */
function resolveConnectedProviders(inputs, override, ollamaDetected = false) {
	const settings = loadProviderSettings(inputs.sharedDir);
	const out = [];
	const runtimeModel = (flavor) => defaultModelForFlavor(flavor, inputs.defaultModel, settings.defaultModel);
	const push = (id, source, flavor, label, baseUrl, headers, defaultModel, accountHint, keyStore) => {
		out.push({
			id,
			label,
			source,
			...keyStore ? { keyStore } : {},
			endpoint: {
				configured: true,
				providerId: id,
				flavor,
				label,
				baseUrl,
				headers,
				defaultModel,
				accountHint
			}
		});
	};
	if (override && override.baseUrl.trim()) {
		const baseUrl = trimTrailingSlashes(override.baseUrl);
		const flavor = inferFlavorFromUrl(baseUrl);
		const label = labelForFlavor(flavor, baseUrl);
		push("acp", "acp", flavor, label, baseUrl, {
			...defaultHeadersForFlavor(flavor),
			...override.headers
		}, runtimeModel(flavor), `${label} (${safeHost(baseUrl)})`);
	}
	if (inputs.olympusCloudToken?.trim()) push("env-olympus-cloud", "env", "olympus-cloud", "Olympus Cloud", trimTrailingSlashes(inputs.olympusCloudBaseUrl || GATEWAY_ENDPOINTS.olympusCloud), withToken(defaultHeadersForFlavor("olympus-cloud"), inputs.olympusCloudToken), runtimeModel("olympus-cloud"), "Olympus Cloud (paid multi-model credits · zero chat logging)");
	if (inputs.openRouterToken?.trim()) push("env-openrouter", "env", "openrouter", "OpenRouter", trimTrailingSlashes(inputs.openRouterBaseUrl || GATEWAY_ENDPOINTS.openrouter), withToken(defaultHeadersForFlavor("openrouter"), inputs.openRouterToken), runtimeModel("openrouter"), "OpenRouter (single key · 500+ models)");
	if (inputs.anthropicToken?.trim()) push("env-anthropic", "env", "anthropic", "Anthropic (Direct Claude API)", ensureV1(trimTrailingSlashes(inputs.anthropicBaseUrl || GATEWAY_ENDPOINTS.anthropic)), withToken(defaultHeadersForFlavor("anthropic"), inputs.anthropicToken, "anthropic"), runtimeModel("anthropic"), "Anthropic Direct API (Claude + Prompt Caching)");
	if (inputs.aiGatewayToken?.trim()) push("env-ai-gateway", "env", "ai-gateway", "Vercel AI Gateway", trimTrailingSlashes(inputs.aiGatewayBaseUrl || GATEWAY_ENDPOINTS.aiGateway), withToken({}, inputs.aiGatewayToken), runtimeModel("ai-gateway"), "Vercel AI Gateway (0% markup · 400+ models)");
	if (inputs.customToken?.trim() || inputs.customBaseUrl?.trim()) {
		const baseUrl = trimTrailingSlashes(inputs.customBaseUrl?.trim() || GATEWAY_ENDPOINTS.openai);
		const flavor = inferFlavorFromUrl(baseUrl);
		if (inputs.customToken?.trim() || isLoopbackUrl(baseUrl)) {
			const label = labelForFlavor(flavor, baseUrl);
			push("env-custom", "env", flavor, label, baseUrl, withToken(defaultHeadersForFlavor(flavor), inputs.customToken, flavor), runtimeModel(flavor), `${label} (${safeHost(baseUrl)})`);
		}
	}
	if (inputs.useOllama || inputs.ollamaHost?.trim()) {
		const baseUrl = ensureV1(trimTrailingSlashes(inputs.ollamaHost?.trim() || GATEWAY_ENDPOINTS.ollama));
		push("env-ollama", "env", "ollama", "Ollama (Local)", baseUrl, {}, runtimeModel("ollama"), `Local Ollama (${safeHost(baseUrl)})`);
	}
	const savedConnected = [];
	for (const p of settings.providers) {
		const key = p.keyStore === "none" ? void 0 : getProviderKey(p.id, inputs.sharedDir);
		if (!key && !providerUsableWithoutKey(p)) continue;
		const baseUrl = trimTrailingSlashes(p.baseUrl);
		push(p.id, "saved", p.flavor, p.label, baseUrl, withToken(defaultHeadersForFlavor(p.flavor), key, p.flavor), defaultModelForFlavor(p.flavor, void 0, p.defaultModel), `${p.label} (${safeHost(baseUrl)})`, key ? p.keyStore : "none");
		savedConnected.push(out[out.length - 1]);
	}
	let autoId;
	const ollamaUrl = normalizeBaseUrl(GATEWAY_ENDPOINTS.ollama);
	if (ollamaDetected && !out.some((p) => normalizeBaseUrl(p.endpoint.baseUrl) === ollamaUrl)) {
		autoId = out.some((p) => p.id === "ollama") ? "ollama-auto" : "ollama";
		push(autoId, "auto", "ollama", "Ollama (Local)", GATEWAY_ENDPOINTS.ollama, {}, runtimeModel("ollama"), "Local Ollama (auto-detected)");
	}
	const first = (src) => out.find((p) => p.source === src)?.id;
	const activeSaved = savedConnected.find((p) => p.id === settings.activeProviderId)?.id;
	const defaultId = first("acp") ?? first("env") ?? activeSaved ?? autoId ?? savedConnected[0]?.id;
	return {
		providers: out,
		...defaultId ? { defaultId } : {}
	};
}
function unconfiguredEndpoint(inputs) {
	return {
		configured: false,
		providerId: "",
		flavor: "openrouter",
		label: "OpenRouter",
		baseUrl: GATEWAY_ENDPOINTS.openrouter,
		headers: defaultHeadersForFlavor("openrouter"),
		defaultModel: defaultModelForFlavor("openrouter", inputs.defaultModel)
	};
}
async function detectLocalOllama(ollamaHost, disabled) {
	if (disabled) return false;
	let base = trimTrailingSlashes(ollamaHost?.trim() || `http:${SEP$2}${SEP$2}${LOOPBACK_HOST}:11434`);
	if (base.endsWith(`${SEP$2}v1`)) base = base.slice(0, -3);
	return probeHttpOk(`${base}${SEP$2}api${SEP$2}tags`, 750);
}
var catalogCache = /* @__PURE__ */ new Map();
function invalidateModelCache() {
	catalogCache.clear();
}
async function listAvailableModels(endpoint, forceRefresh = false) {
	const hasCred = Boolean(endpoint.headers.Authorization || endpoint.headers["x-api-key"]);
	const cacheKey = `${endpoint.flavor}:${endpoint.baseUrl}:${hasCred}:${endpoint.defaultModel}`;
	const hit = catalogCache.get(cacheKey);
	if (!forceRefresh && hit && Date.now() - hit.at < 3e5) return hit.models;
	let remote = [];
	if (endpoint.configured) try {
		remote = await fetchRemoteModels(endpoint.baseUrl, endpoint.headers, 5e3);
	} catch {}
	const byId = /* @__PURE__ */ new Map();
	const remoteMap = new Map(remote.map((r) => [r.id, r]));
	if (endpoint.flavor === "olympus-cloud") {
		for (const c of OLYMPUS_CLOUD_MODELS) {
			const r = remoteMap.get(c.id);
			byId.set(c.id, {
				...c,
				contextSize: r?.contextLength ?? c.contextSize,
				promptPricePerToken: r?.pricingPromptPerToken ?? c.promptPricePerToken,
				completionPricePerToken: r?.pricingCompletionPerToken ?? c.completionPricePerToken
			});
		}
		for (const r of remote.slice(0, 60)) {
			if (byId.has(r.id)) continue;
			byId.set(r.id, {
				id: r.id,
				name: r.name && r.name !== r.id ? `${r.name} (${r.id})` : r.id,
				group: "Olympus Cloud Models",
				contextSize: r.contextLength ?? contextSizeForModel(r.id, []),
				promptPricePerToken: r.pricingPromptPerToken,
				completionPricePerToken: r.pricingCompletionPerToken
			});
		}
	} else if (endpoint.flavor === "openrouter" || endpoint.flavor === "ai-gateway") {
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
			const providerPrefix = r.id.includes(SEP$2) ? r.id.split(SEP$2)[0] : "Gateway";
			byId.set(r.id, {
				id: r.id,
				name: r.name && r.name !== r.id ? `${r.name} (${r.id})` : r.id,
				group: `More (${providerPrefix})`,
				contextSize: r.contextLength ?? contextSizeForModel(r.id, []),
				promptPricePerToken: r.pricingPromptPerToken,
				completionPricePerToken: r.pricingCompletionPerToken
			});
			added++;
		}
	} else if (endpoint.flavor === "anthropic") {
		for (const c of ANTHROPIC_DIRECT_MODELS) byId.set(c.id, { ...c });
		for (const r of remote.slice(0, 60)) {
			if (byId.has(r.id)) continue;
			const known = knownModelPricing(r.id);
			byId.set(r.id, {
				id: r.id,
				name: r.name && r.name !== r.id ? `${r.name} (${r.id})` : r.id,
				group: "Anthropic API Models",
				contextSize: r.contextLength ?? known?.contextSize ?? contextSizeForModel(r.id, []),
				...known ? {
					promptPricePerToken: known.input,
					completionPricePerToken: known.output,
					cacheReadPricePerToken: known.cacheRead
				} : {}
			});
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
				contextSize: endpoint.flavor === "ollama" ? 65536 : contextSizeForModel(def, [])
			});
		}
	}
	if (!byId.has(endpoint.defaultModel)) byId.set(endpoint.defaultModel, {
		id: endpoint.defaultModel,
		name: endpoint.defaultModel,
		group: "Selected Model",
		contextSize: contextSizeForModel(endpoint.defaultModel, [])
	});
	const models = [...byId.values()];
	catalogCache.set(cacheKey, {
		at: Date.now(),
		models
	});
	return models;
}
function contextSizeForModel(modelId, models) {
	const hit = models.find((m) => m.id === modelId);
	if (hit?.contextSize) return hit.contextSize;
	const known = knownModelPricing(modelId);
	if (known?.contextSize) return known.contextSize;
	const lc = modelId.toLowerCase();
	if (/claude-(?:opus|sonnet|haiku)-5[-.]5(?:[-.\d:]|$)/.test(lc)) return 1e6;
	if (lc.includes("gemini")) return 1e6;
	if (lc.includes("gpt-5") || lc.includes("gpt-4.1")) return 4e5;
	if (lc.includes("claude")) return 2e5;
	if (lc.includes("qwen3") || lc.includes("codestral") || lc.includes("grok")) return 256e3;
	return 128e3;
}
// src/acpConfig.ts
/**
* Configuration, catalog option builders, auth method descriptors, and prompt block helpers
* for the Olympus ACP server (`acpServer.ts` and `acpPromptTurn.ts`).
*/
var SEP$1 = String.fromCharCode(47);
var OPENROUTER_KEYS_LINK = `https:${SEP$1}${SEP$1}openrouter.ai${SEP$1}settings${SEP$1}keys`;
var ANTHROPIC_KEYS_LINK = `https:${SEP$1}${SEP$1}console.anthropic.com${SEP$1}settings${SEP$1}keys`;
var VERCEL_AI_KEYS_LINK = `https:${SEP$1}${SEP$1}vercel.com${SEP$1}docs${SEP$1}ai-gateway`;
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
/** The user's own words of a steered message (without attached file bodies), echoed when it is injected. */
var steeredDisplayText = /* @__PURE__ */ new WeakMap();
var defaultCatalog = (set) => set.list.find((c) => c.id === set.defaultId) ?? set.list[0];
function asRecord$2(v) {
	return v !== null && typeof v === "object" && !Array.isArray(v) ? v : void 0;
}
function inputsFromEnv(env) {
	return {
		sharedDir: env.OLYMPUS_HOME || env.OLYMPUS_SHARED_DIR || env.AGENTDESK_SHARED_ROOT,
		olympusCloudToken: env.OLYMPUS_CLOUD_API_KEY,
		olympusCloudBaseUrl: env.OLYMPUS_CLOUD_URL,
		openRouterToken: env.OPENROUTER_API_KEY,
		openRouterBaseUrl: env.OPENROUTER_BASE_URL,
		anthropicToken: env.ANTHROPIC_API_KEY,
		anthropicBaseUrl: env.ANTHROPIC_BASE_URL,
		aiGatewayToken: env.AI_GATEWAY_API_KEY || env.VERCEL_AI_GATEWAY_API_KEY,
		aiGatewayBaseUrl: env.AI_GATEWAY_BASE_URL,
		customToken: env.OLYMPUS_OPENAI_API_KEY || env.OPENAI_API_KEY,
		customBaseUrl: env.OLYMPUS_BASE_URL || env.OPENAI_BASE_URL,
		defaultModel: env.OLYMPUS_MODEL || env.ANTHROPIC_MODEL || env.OPENAI_MODEL,
		useOllama: env.OLYMPUS_USE_OLLAMA === "1",
		ollamaHost: env.OLYMPUS_OLLAMA_HOST
	};
}
function buildSystemInstructions(cwd, mode, customPrompt) {
	const modeRule = mode === "plan" ? "Current mode: PLAN (read-only). Explore files, search code, and produce a clear architectural implementation plan. Do NOT call edit_file or write_file." : "Execution policy: inspect relevant files before editing, make surgical edits with edit_file, and verify your changes.";
	const core = [
		"You are Olympus, the native multi-model software engineering agent built into Olympus Coder.",
		`Workspace root: ${cwd}`,
		"Tool guidelines:",
		"- Always call read_file or grep_search to inspect existing code before modifying files.",
		"- Prefer edit_file over write_file when changing existing files so diffs stay minimal and accurate.",
		"- Context hygiene: when calling read_file just to check or inspect a file you do not plan to edit next, pass read_on_demand: true (with an optional 1-line note) so its body collapses to a compact note after the turn. You can always re-read any file on demand.",
		"- Use todo_write on multi-step tasks so the user sees live progress.",
		"- Keep explanations concise, technical, and grounded in the actual codebase.",
		modeRule
	].join("\n");
	return customPrompt?.trim() ? `${core}\n\n${customPrompt.trim()}` : core;
}
/** Option value for a model: the plain id when only one provider has it, else `providerId::modelId`. */
function modelOptionValue(set, providerId, modelId) {
	return set.list.filter((c) => c.models.some((m) => m.id === modelId)).length > 1 ? `${providerId}::${modelId}` : modelId;
}
function buildConfigOptions(session, set) {
	const multi = set.list.length > 1;
	const groups = /* @__PURE__ */ new Map();
	for (const cat of set.list) for (const m of cat.models) {
		const key = `${cat.id}\u0000${m.group}`;
		let g = groups.get(key);
		if (!g) {
			g = {
				name: multi ? `${cat.label} · ${m.group}` : m.group,
				options: []
			};
			groups.set(key, g);
		}
		g.options.push({
			value: modelOptionValue(set, cat.id, m.id),
			name: m.name,
			...m.description ? { description: m.description } : {}
		});
	}
	const sessionProvider = set.list.find((c) => c.id === session.providerId) ?? defaultCatalog(set);
	const currentValue = sessionProvider ? modelOptionValue(set, sessionProvider.id, session.model) : session.model;
	if (![...groups.values()].some((g) => g.options.some((o) => o.value === currentValue)) && session.model) {
		const key = `${sessionProvider?.id ?? ""}\u0000Selected Model`;
		const g = groups.get(key) ?? {
			name: multi && sessionProvider ? `${sessionProvider.label} · Selected Model` : "Selected Model",
			options: []
		};
		g.options.unshift({
			value: currentValue,
			name: session.model
		});
		groups.set(key, g);
	}
	return [
		{
			id: "model",
			name: "Model",
			category: "model",
			type: "select",
			currentValue,
			options: [...groups.values()].map((g, idx) => ({
				group: `group_${idx}`,
				name: g.name,
				options: g.options
			}))
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
function buildAuthMethods(opts) {
	return [
		...opts?.includeOlympusCloud ? [{
			id: "olympus-cloud-oauth",
			name: "Sign in with GitHub (Olympus Cloud)",
			description: "1-click browser sign-in — paid multi-model credits ($20/$60/$100 or $10 top-up · zero chat/code logging)."
		}, {
			id: "olympus-cloud",
			type: "env_var",
			name: "Olympus Cloud (Paste Token / Custom URL)",
			description: "Paste an Olympus Cloud token (oly_live_...) manually or point to a custom Olympus Cloud URL.",
			link: OLYMPUS_CLOUD_PORTAL_LINK,
			vars: [{
				name: "OLYMPUS_CLOUD_API_KEY",
				label: "Olympus Cloud token (oly_live_...)",
				secret: true,
				optional: false
			}, {
				name: "OLYMPUS_CLOUD_URL",
				label: "Olympus Cloud API URL (optional)",
				secret: false,
				optional: true
			}]
		}] : [],
		{
			id: "openrouter",
			type: "env_var",
			name: "OpenRouter (Single Key · 500+ Models)",
			description: "Connect Claude 5.5, GPT-5, Gemini, DeepSeek, Qwen, Grok, Codestral, and free models with one OpenRouter key.",
			link: OPENROUTER_KEYS_LINK,
			vars: [{
				name: "OPENROUTER_API_KEY",
				label: "OpenRouter API key",
				secret: true,
				optional: false
			}]
		},
		{
			id: "anthropic",
			type: "env_var",
			name: "Anthropic (Direct Claude API Key)",
			description: "Use your own Anthropic Console API key directly with native Claude 5.5 Messages API, adaptive thinking, and prompt caching.",
			link: ANTHROPIC_KEYS_LINK,
			vars: [{
				name: "ANTHROPIC_API_KEY",
				label: "Anthropic API key",
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
			description: "Run interactive oly login in the built-in terminal.",
			args: ["login"]
		}
	];
}
function extractSystemPromptText(sp) {
	if (!sp) return void 0;
	if (typeof sp === "string") return sp;
	const rec = asRecord$2(sp);
	if (Array.isArray(rec?.content)) return rec.content.map((raw) => {
		const c = asRecord$2(raw);
		return c?.type === "text" ? String(c.text ?? "") : "";
	}).filter(Boolean).join("\n\n") || void 0;
}
function promptBlocksToContent(blocks) {
	const parts = [];
	for (const raw of Array.isArray(blocks) ? blocks : []) {
		const b = asRecord$2(raw);
		if (!b) continue;
		if (b.type === "text" && typeof b.text === "string") parts.push({
			type: "text",
			text: b.text
		});
		else if (b.type === "resource_link" && typeof b.uri === "string") parts.push({
			type: "text",
			text: `[Referenced resource: ${String(b.title ?? b.name ?? b.uri)} (${b.uri})]`
		});
		else if (b.type === "resource") {
			const resource = asRecord$2(b.resource);
			if (resource) {
				const txt = typeof resource.text === "string" ? resource.text : "";
				const uri = String(resource.uri ?? "");
				parts.push({
					type: "text",
					text: txt ? `<resource uri="${uri}">\n${txt}\n</resource>` : `[Resource: ${uri}]`
				});
			}
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
async function emitSessionUpdate(client, live, update, recordInHistory = true) {
	if (recordInHistory) live.stored.updates.push(update);
	await client.notify(methods.client.session.update, {
		sessionId: live.stored.sessionId,
		update
	});
}
async function advertiseSessionReady(client, live, models) {
	live.stored.usage.contextSize = contextSizeForModel(live.stored.model, models);
	await emitSessionUpdate(client, live, {
		sessionUpdate: "available_commands_update",
		availableCommands: AVAILABLE_COMMANDS
	}, false);
	await emitSessionUpdate(client, live, {
		sessionUpdate: "usage_update",
		used: live.stored.usage.usedTokens,
		size: live.stored.usage.contextSize,
		...live.stored.usage.costUsd > 0 ? { cost: {
			amount: live.stored.usage.costUsd,
			currency: "USD"
		} } : {},
		_meta: { "_claude/model": live.stored.model }
	}, false);
}
var ALREADY_PRUNED_PREFIXES = [
	"[Read on demand:",
	"[Superseded read:",
	"[Pruned "
];
var BULKY_NON_FILE_TOOLS = /* @__PURE__ */ new Set([
	"run_command",
	"grep_search",
	"glob_files",
	"list_dir",
	"web_fetch"
]);
function estimateTokensFromChars(chars) {
	return Math.ceil(Math.max(0, chars) / 3.5);
}
/** True when the endpoint bills prompt-cache writes/reads with a 5-min prefix cache (cloud APIs). */
function isCachedCloudEndpoint(flavor, baseUrl) {
	if (flavor === "ollama" || isLoopbackUrl(baseUrl)) return false;
	if (flavor === "anthropic" || flavor === "openrouter" || flavor === "olympus-cloud" || flavor === "ai-gateway") return true;
	const lc = baseUrl.toLowerCase();
	return lc.includes("api.openai.com") || lc.includes("api.deepseek.com") || lc.includes("generativelanguage.googleapis.com");
}
function normalizePathKey(raw) {
	return String(raw ?? "").trim().replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/+/g, "/");
}
function messageText(content) {
	if (typeof content === "string") return content;
	if (!Array.isArray(content)) return "";
	return content.filter((p) => p.type === "text").map((p) => p.text).join("\n");
}
function parseArgsJson(raw) {
	if (!raw) return {};
	try {
		const parsed = JSON.parse(raw);
		return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
	} catch {
		return {};
	}
}
/** Extract up to 6 top-level symbol names (exports, functions, classes, interfaces, types) from a code file. */
function extractFileSymbols(content, maxSymbols = 6) {
	const seen = /* @__PURE__ */ new Set();
	const re = /^\s*(?:\d+\s*\|\s*)?(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:function|class|interface|type|enum|const|let|def|struct|fn)\s+([A-Za-z_][A-Za-z0-9_]*)/gm;
	let m;
	while ((m = re.exec(content)) !== null) {
		const sym = m[1];
		if (sym && sym.length > 1 && !seen.has(sym)) {
			seen.add(sym);
			if (seen.size >= maxSymbols) break;
		}
	}
	return [...seen];
}
function formatLineRange(args) {
	const start = typeof args.start_line === "number" && args.start_line > 0 ? Math.floor(args.start_line) : void 0;
	const limit = typeof args.limit === "number" && args.limit > 0 ? Math.floor(args.limit) : void 0;
	if (start && limit) return ` L${start}-${start + limit - 1}`;
	if (start) return ` L${start}+`;
	return "";
}
function buildFileReceipt(kind, pathStr, args, content) {
	const lineCount = content ? content.split("\n").length : 0;
	const range = formatLineRange(args);
	const note = typeof args.note === "string" ? args.note.trim().replace(/\s+/g, " ").slice(0, 180) : "";
	const notePart = note ? ` — Note: ${note}` : "";
	if (kind === "superseded") return `[Superseded read: ${pathStr}${range} (${lineCount} lines)${notePart} — file was later edited or re-read; call read_file("${pathStr}") for current contents.]`;
	const syms = extractFileSymbols(content);
	return `[Read on demand: ${pathStr}${range} (${lineCount} lines${syms.length ? ` · symbols: ${syms.join(", ")}` : ""})${notePart} — full content omitted to save context; call read_file("${pathStr}") if needed again.]`;
}
function buildToolReceipt(toolName, args, content) {
	const lines = content.split("\n");
	const argHint = toolName === "run_command" ? String(args.command ?? "").trim().slice(0, 80) : toolName === "grep_search" ? String(args.query ?? "").trim().slice(0, 60) : toolName === "glob_files" ? String(args.pattern ?? "").trim().slice(0, 60) : toolName === "web_fetch" ? String(args.url ?? "").trim().slice(0, 80) : String(args.path ?? ".").trim().slice(0, 60);
	const exitMatch = /exit(?:ed| code)?\s*[:=]?\s*(-?\d+)/i.exec(content);
	const exitPart = exitMatch ? ` · exit ${exitMatch[1]}` : "";
	const lastNonEmpty = [...lines].reverse().find((l) => l.trim().length > 0)?.trim().slice(0, 100);
	const tailPart = lastNonEmpty ? ` · last: "${lastNonEmpty}"` : "";
	return `[Pruned ${toolName}(${argHint || "workspace"}) — ${lines.length} lines omitted${exitPart}${tailPart}; re-run if needed.]`;
}
function mentionsFile(haystack, pathStr) {
	if (!haystack || !pathStr) return false;
	const lc = haystack.toLowerCase();
	const base = basename(pathStr).toLowerCase();
	return lc.includes(pathStr.toLowerCase()) || base.length >= 4 && lc.includes(base);
}
/**
* Inspect `messages` (up to the current turn) and plan deterministic, lossless tool-result replacements.
* Does NOT mutate `messages`; call `applyContextPrunePlan` once `decideContextPruneFlush` approves.
*/
function planContextPrune(messages, currentUserPrompt = "") {
	const turnOfMsg = [];
	const callMeta = /* @__PURE__ */ new Map();
	const turnAssistantText = /* @__PURE__ */ new Map();
	const fileActivityIndices = /* @__PURE__ */ new Map();
	let turn = 0;
	for (let i = 0; i < messages.length; i++) {
		const m = messages[i];
		if (m.role === "user") turn++;
		turnOfMsg.push(turn);
		if (m.role === "assistant") {
			const txt = messageText(m.content);
			if (txt) turnAssistantText.set(turn, `${turnAssistantText.get(turn) ?? ""}\n${txt}`);
			if (Array.isArray(m.tool_calls)) for (const tc of m.tool_calls) {
				const args = parseArgsJson(tc.function.arguments);
				callMeta.set(tc.id, {
					name: tc.function.name,
					args,
					turnIndex: turn,
					assistantMsgIndex: i
				});
				if (tc.function.name === "read_file" || tc.function.name === "edit_file" || tc.function.name === "write_file") {
					const key = normalizePathKey(args.path);
					if (key) {
						const arr = fileActivityIndices.get(key) ?? [];
						arr.push(i);
						fileActivityIndices.set(key, arr);
					}
				}
			}
		}
	}
	const latestTurn = turn;
	if (latestTurn < 2) return {
		candidates: [],
		reclaimableChars: 0,
		reclaimableTokens: 0
	};
	const candidates = [];
	for (let i = 0; i < messages.length; i++) {
		const m = messages[i];
		if (m.role !== "tool" || !m.tool_call_id) continue;
		const rawContent = messageText(m.content);
		if (rawContent.length < 400) continue;
		if (ALREADY_PRUNED_PREFIXES.some((p) => rawContent.startsWith(p))) continue;
		const meta = callMeta.get(m.tool_call_id);
		if (!meta) continue;
		const msgTurn = turnOfMsg[i];
		if (msgTurn >= latestTurn) continue;
		const toolName = meta.name || m.name || "tool";
		let reason = null;
		let replacement = "";
		if (toolName === "read_file") {
			const pathStr = normalizePathKey(meta.args.path);
			const laterTouches = (fileActivityIndices.get(pathStr) ?? []).some((idx) => idx > meta.assistantMsgIndex);
			const explicitFlag = meta.args.read_on_demand;
			if (laterTouches) {
				reason = "superseded";
				replacement = buildFileReceipt("superseded", pathStr || "file", meta.args, rawContent);
			} else if (explicitFlag === true) {
				if (!mentionsFile(currentUserPrompt, pathStr)) {
					reason = "read_on_demand";
					replacement = buildFileReceipt("read_on_demand", pathStr || "file", meta.args, rawContent);
				}
			} else if (explicitFlag !== false && rawContent.length >= 1200) {
				const turnAge = latestTurn - msgTurn;
				const referencedInSameTurnReply = mentionsFile(turnAssistantText.get(msgTurn) ?? "", pathStr);
				const referencedInNewPrompt = mentionsFile(currentUserPrompt, pathStr);
				if (turnAge >= 2 || !referencedInSameTurnReply && !referencedInNewPrompt) {
					reason = "aged_read";
					replacement = buildFileReceipt("read_on_demand", pathStr || "file", meta.args, rawContent);
				}
			}
		} else if (BULKY_NON_FILE_TOOLS.has(toolName) && rawContent.length >= 1e3) {
			reason = "aged_tool";
			replacement = buildToolReceipt(toolName, meta.args, rawContent);
		}
		if (reason && replacement && replacement.length + 120 < rawContent.length) candidates.push({
			messageIndex: i,
			toolCallId: m.tool_call_id,
			toolName,
			reason,
			originalChars: rawContent.length,
			replacement,
			savedChars: rawContent.length - replacement.length
		});
	}
	const reclaimableChars = candidates.reduce((sum, c) => sum + c.savedChars, 0);
	return {
		candidates,
		reclaimableChars,
		reclaimableTokens: estimateTokensFromChars(reclaimableChars)
	};
}
/** Decide whether flushing `plan` now is net-beneficial without busting a warm cloud KV prompt cache. */
function decideContextPruneFlush(opts) {
	const { flavor, baseUrl, lastLlmCallAt = 0, nowMs = Date.now(), usedTokens, contextSize, plan } = opts;
	if (!plan.candidates.length || plan.reclaimableTokens < 250) return {
		flush: false,
		reason: "below_threshold"
	};
	if (!isCachedCloudEndpoint(flavor, baseUrl)) return {
		flush: true,
		reason: "local_turn_boundary"
	};
	if (lastLlmCallAt > 0 && nowMs - lastLlmCallAt >= 3e5) return {
		flush: true,
		reason: "cache_ttl_expired"
	};
	if (contextSize > 0 && usedTokens / contextSize >= .65) return {
		flush: true,
		reason: "context_watermark"
	};
	if (plan.reclaimableTokens >= 15e3 && usedTokens > 0 && plan.reclaimableTokens / usedTokens >= .35) return {
		flush: true,
		reason: "reclaim_breakeven"
	};
	return {
		flush: false,
		reason: "preserve_warm_cache"
	};
}
/** Apply approved prune candidates in place on `messages` and return updated cumulative session stats. */
function applyContextPrunePlan(messages, plan, reason, prev) {
	for (const c of plan.candidates) {
		const m = messages[c.messageIndex];
		if (m && m.role === "tool" && m.tool_call_id === c.toolCallId) m.content = c.replacement;
	}
	const savedCharsTotal = (prev?.savedCharsTotal ?? 0) + plan.reclaimableChars;
	return {
		prunedToolCount: (prev?.prunedToolCount ?? 0) + plan.candidates.length,
		savedCharsTotal,
		savedTokensEstimate: estimateTokensFromChars(savedCharsTotal),
		lastFlushReason: reason
	};
}
// src/sessionStore.ts
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
		...init.providerId ? { providerId: init.providerId } : {},
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
			description: "Read a text file from the workspace with 1-indexed line numbers. Supports optional start_line and limit for large files. Pass read_on_demand: true (and an optional 1-line note) when only inspecting a file once so its body is later replaced by a compact note to keep context lean.",
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
					},
					read_on_demand: {
						type: "boolean",
						description: "Set true for one-off inspections so the full file text can be collapsed into a compact note after this turn (false pins it)."
					},
					note: {
						type: "string",
						description: "Optional concise 1-line summary to keep in context if this file read is collapsed to a read-on-demand receipt."
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
async function ensurePermission(ctx, toolCallId, title, kind, locations, preview) {
	if (ctx.mode === "auto") return true;
	if (ctx.clientCtx) {
		const out = (await ctx.clientCtx.request(methods.client.session.requestPermission, {
			sessionId: ctx.sessionId,
			toolCall: {
				toolCallId,
				title,
				kind,
				status: "pending",
				...locations ? { locations } : {},
				...preview?.rawInput ? { rawInput: preview.rawInput } : {},
				...preview?.content?.length ? { content: preview.content } : {}
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
			}], {
				rawInput: args,
				content: [{
					type: "diff",
					path: abs,
					...oldText ? { oldText } : {},
					newText
				}]
			})) return {
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
			}], {
				rawInput: args,
				content: [{
					type: "diff",
					path: abs,
					oldText: replaced.matchedOld,
					newText: newStr
				}]
			})) return {
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
			if (!await ensurePermission(ctx, toolCallId, `Run: ${command.slice(0, 120)}`, "execute", void 0, { rawInput: {
				...args,
				command,
				cwd: cmdCwd
			} })) return {
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
			if (!await ensurePermission(ctx, toolCallId, `Fetch ${url}`, "fetch", void 0, { rawInput: {
				...args,
				url
			} })) return {
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
// src/acpPromptTurn.ts
/**
* Slash command execution (`/status`, `/clear`, `/models`, `/compact`) and multi-step agentic
* prompt turn loop for Olympus ACP sessions, including cache-write usage & USD cost tracking.
*/
var SEP = String.fromCharCode(47);
async function runSessionPromptTurn(ctx) {
	const { prompt, signal, client, clientCaps, live, set, sessionCat, version, resolveModelPick, applyModelPick } = ctx;
	const ep = sessionCat.endpoint;
	const models = sessionCat.models;
	const rawUserText = plainTextOfBlocks(prompt);
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
			const cloudStatus = ep.flavor === "olympus-cloud" ? await fetchOlympusCloudStatus(ep.baseUrl, ep.headers) : void 0;
			const gwLabel = cloudStatus?.gatewayLabel ?? ep.label;
			const statusMd = [
				`**Olympus Native Agent** (\`v${version}\`)`,
				`- **Gateway**: ${gwLabel} (\`${ep.baseUrl}\`) · provider id \`${sessionCat.id}\``,
				...set.list.length > 1 ? [`- **Connected Providers**: ${set.list.map((c) => `\`${c.id}\``).join(", ")}`] : [],
				`- **Model**: \`${live.stored.model}\` (context window: ${live.stored.usage.contextSize.toLocaleString()} tokens)`,
				`- **Mode**: \`${live.stored.mode}\` · **Reasoning**: \`${live.stored.reasoning}\``,
				`- **Session Usage**: ${live.stored.usage.usedTokens.toLocaleString()} tokens${live.stored.usage.costUsd > 0 ? ` · $${live.stored.usage.costUsd.toFixed(4)}` : ""}`,
				...live.stored.pruner?.prunedToolCount ? [`- **Context Pruner**: ${live.stored.pruner.prunedToolCount} stale tool outputs collapsed (~${live.stored.pruner.savedTokensEstimate.toLocaleString()} tokens reclaimed${live.stored.pruner.lastFlushReason ? ` · ${live.stored.pruner.lastFlushReason}` : ""})`] : [],
				`- **Connected MCP Tools**: ${live.mcp.tools.size}`,
				...cloudStatus ? cloudStatus.lines : []
			].join("\n");
			await emitSessionUpdate(client, live, {
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
			live.stored.lastLlmCallAt = void 0;
			live.stored.pruner = void 0;
			saveStoredSession(live.stored);
			await emitSessionUpdate(client, live, {
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
				const pick = resolveModelPick(set, cmdArg, live.stored.providerId);
				applyModelPick(live.stored, pick, true);
				saveStoredSession(live.stored);
				await emitSessionUpdate(client, live, {
					sessionUpdate: "config_option_update",
					configOptions: buildConfigOptions(live.stored, set)
				}, false);
				await advertiseSessionReady(client, live, pick.cat.models);
				await emitSessionUpdate(client, live, {
					sessionUpdate: "agent_message_chunk",
					messageId: randomUUID(),
					content: {
						type: "text",
						text: `Switched active model to \`${pick.model}\` on ${pick.cat.label} (\`${pick.cat.id}\`).`
					}
				});
				return { stopReason: "end_turn" };
			}
			const sections = set.list.map((cat) => {
				const top = cat.models.slice(0, 20).map((m) => `- \`${modelOptionValue(set, cat.id, m.id)}\` — ${m.name} (${Math.round(m.contextSize / 1e3)}k ctx)`).join("\n");
				return `**${cat.label}** (\`${cat.id}\`, ${cat.models.length} loaded)\n${top}`;
			});
			await emitSessionUpdate(client, live, {
				sessionUpdate: "agent_message_chunk",
				messageId: randomUUID(),
				content: {
					type: "text",
					text: `**Available Models** (active: \`${live.stored.model}\` on \`${sessionCat.id}\`):\n\n${sections.join("\n\n")}\n\nUse the Model selector below the chat box or run \`${SEP}models <model-id>\` (or \`${SEP}models <provider>::<model-id>\`) to switch.`
				}
			});
			saveStoredSession(live.stored);
			return { stopReason: "end_turn" };
		}
		if (cmdName === "compact") {
			if (live.stored.messages.length < 2) {
				await emitSessionUpdate(client, live, {
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
			const compactCost = estimateCostUsd(summaryRes.usage, live.stored.model, models);
			if (compactCost !== void 0) live.stored.usage.costUsd += compactCost;
			live.stored.messages = [{
				role: "user",
				content: "[Compacted Session Summary]\n" + summaryRes.content
			}, {
				role: "assistant",
				content: "Understood. Continuing from the compacted session summary."
			}];
			live.stored.usage.usedTokens = summaryRes.usage.totalTokens;
			live.stored.lastLlmCallAt = Date.now();
			live.stored.pruner = void 0;
			saveStoredSession(live.stored);
			await emitSessionUpdate(client, live, {
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
	const userContent = promptBlocksToContent(prompt);
	live.stored.messages.push({
		role: "user",
		content: userContent
	});
	if (!live.stored.title && rawUserText.trim()) live.stored.title = rawUserText.replace(/\s+/g, " ").trim().slice(0, 60);
	const prunePlan = planContextPrune(live.stored.messages, rawUserText);
	const pruneDecision = decideContextPruneFlush({
		flavor: ep.flavor,
		baseUrl: ep.baseUrl,
		lastLlmCallAt: live.stored.lastLlmCallAt,
		nowMs: Date.now(),
		usedTokens: live.stored.usage.usedTokens,
		contextSize: live.stored.usage.contextSize,
		plan: prunePlan
	});
	if (pruneDecision.flush) {
		live.stored.pruner = applyContextPrunePlan(live.stored.messages, prunePlan, pruneDecision.reason, live.stored.pruner);
		saveStoredSession(live.stored);
	}
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
		cachedWriteTokens: 0,
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
				const steeredText = steeredDisplayText.get(steered) ?? (typeof steered.content === "string" ? steered.content : "");
				if (steeredText) await emitSessionUpdate(client, live, {
					sessionUpdate: "user_message_chunk",
					content: {
						type: "text",
						text: steeredText
					},
					_meta: { steering: true }
				});
			}
			const mcpSpecs = [...live.mcp.tools.values()].map((t) => t.spec);
			const allTools = [...BUILTIN_TOOL_SPECS, ...mcpSpecs];
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
					if (ev.type === "thought") await emitSessionUpdate(client, live, {
						sessionUpdate: "agent_thought_chunk",
						messageId: thoughtId,
						content: {
							type: "text",
							text: ev.text
						}
					});
					else await emitSessionUpdate(client, live, {
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
			totalTurnUsage.cachedWriteTokens += (stepRes.usage.cachedWriteTokens ?? 0) + (stepRes.usage.cachedWrite1hTokens ?? 0);
			totalTurnUsage.totalTokens += stepRes.usage.totalTokens;
			const stepCost = estimateCostUsd(stepRes.usage, live.stored.model, models);
			if (stepCost !== void 0) live.stored.usage.costUsd += stepCost;
			if (stepRes.usage.totalTokens > 0) live.stored.usage.usedTokens = stepRes.usage.totalTokens;
			live.stored.lastLlmCallAt = Date.now();
			await emitSessionUpdate(client, live, {
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
				...stepRes.toolCalls.length ? { tool_calls: stepRes.toolCalls } : {},
				...stepRes.anthropicBlocks?.length ? { anthropicBlocks: stepRes.anthropicBlocks } : {}
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
					const raw = JSON.parse(tc.function.arguments || "{}");
					if (raw && typeof raw === "object" && !Array.isArray(raw)) parsedArgs = raw;
				} catch {
					parsedArgs = {};
				}
				const mcpTool = live.mcp.tools.get(tc.function.name);
				const meta = mcpTool ? {
					kind: "other",
					title: tc.function.name,
					locations: void 0
				} : describeToolCall(tc.function.name, parsedArgs, live.stored.cwd);
				await emitSessionUpdate(client, live, {
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
						await emitSessionUpdate(client, live, {
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
								await emitSessionUpdate(client, live, {
									sessionUpdate: "plan",
									entries: todos
								});
							},
							onTerminalCreated: async (terminalId) => {
								await emitSessionUpdate(client, live, {
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
						await emitSessionUpdate(client, live, {
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
					await emitSessionUpdate(client, live, {
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
		if (turnAbort.signal.aborted) live.steeredQueue.length = 0;
		signal.removeEventListener("abort", onReqAbort);
		live.running = false;
		live.abort = void 0;
		saveStoredSession(live.stored);
	}
}
// src/mcpClient.ts
var mcpOverAcpCaller = new McpOverAcpCaller({ clientInfo: {
	name: "olympus-cli",
	version: "0.2.0"
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
					version: "0.2.0"
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
					version: "0.2.0"
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
// src/acpSessions.ts
/**
* ACP `session/*` lifecycle handlers (`options`, `new`, `resume`, `load`, `fork`, `list`, `status`,
* `setTitle`, `close`, `archive`, `unarchive`, `delete`, `setMode`, `setConfigOption`, `cancel`,
* and `_session/steering`) registered onto the Olympus `AgentApp`.
*/
function asRecord$1(v) {
	return v !== null && typeof v === "object" && !Array.isArray(v) ? v : void 0;
}
function registerAcpSessionHandlers(app, deps) {
	const { liveSessions, sharedDir, currentEndpoint, ensureAuthenticatedOrThrow, loadCatalogs, sessionCatalog, resolveModelPick, applyModelPick, applyInitialConfig } = deps;
	app.onRequest(methods.agent.session.options, async ({ params }) => {
		const set = await loadCatalogs();
		const sid = asRecord$1(params)?.sessionId;
		if (typeof sid === "string" && sid) {
			const s = liveSessions.get(sid)?.stored ?? readStoredSession(sid);
			if (!s) throw RequestError.sessionNotFound(sid);
			return { configOptions: buildConfigOptions(s, set) };
		}
		const cfg = loadCliSettings(sharedDir());
		const def = defaultCatalog(set);
		const ep = def?.endpoint ?? await currentEndpoint();
		return { configOptions: buildConfigOptions({
			sessionId: "preview",
			cwd: process.cwd(),
			createdAt: 0,
			updatedAt: 0,
			model: ep.defaultModel,
			...def ? { providerId: def.id } : {},
			mode: cfg.defaultMode ?? "code",
			reasoning: cfg.defaultReasoning ?? "medium",
			messages: [],
			updates: [],
			usage: {
				usedTokens: 0,
				contextSize: contextSizeForModel(ep.defaultModel, def?.models ?? []),
				costUsd: 0
			},
			todos: []
		}, set) };
	});
	app.onRequest(methods.agent.session.new, async ({ params, client }) => {
		await ensureAuthenticatedOrThrow();
		const set = await loadCatalogs();
		const def = defaultCatalog(set);
		if (!def) throw RequestError.authRequired(void 0, "No model provider is connected.");
		const cfg = loadCliSettings(sharedDir());
		const pRec = asRecord$1(params);
		const sysText = extractSystemPromptText(pRec?.systemPrompt);
		const rawDirs = pRec?.additionalDirectories;
		const additionalDirectories = Array.isArray(rawDirs) ? rawDirs.filter((d) => typeof d === "string") : void 0;
		const stored = createStoredSession({
			cwd: params.cwd,
			additionalDirectories,
			model: def.endpoint.defaultModel,
			providerId: def.id,
			mode: cfg.defaultMode ?? "code",
			reasoning: cfg.defaultReasoning ?? "medium",
			systemPrompt: sysText,
			contextSize: contextSizeForModel(def.endpoint.defaultModel, def.models)
		});
		applyInitialConfig(stored, pRec?.configOptions, set);
		const cat = sessionCatalog(stored, set);
		stored.usage.contextSize = contextSizeForModel(stored.model, cat.models);
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
		advertiseSessionReady(client, live, cat.models).catch(() => {});
		return {
			sessionId: stored.sessionId,
			configOptions: buildConfigOptions(stored, set)
		};
	});
	app.onRequest(methods.agent.session.resume, async ({ params, client }) => {
		await ensureAuthenticatedOrThrow();
		const set = await loadCatalogs();
		const existing = liveSessions.get(params.sessionId);
		const stored = existing?.stored ?? readStoredSession(params.sessionId);
		if (!stored) throw RequestError.sessionNotFound(params.sessionId);
		if (params.cwd) stored.cwd = params.cwd;
		const appended = extractSystemPromptText(asRecord$1(params)?.systemPrompt);
		if (appended && !stored.systemPrompt) stored.systemPrompt = appended;
		const cat = sessionCatalog(stored, set);
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
		advertiseSessionReady(client, live, cat.models).catch(() => {});
		return { configOptions: buildConfigOptions(stored, set) };
	});
	app.onRequest(methods.agent.session.load, async ({ params, client }) => {
		await ensureAuthenticatedOrThrow();
		const set = await loadCatalogs();
		const existing = liveSessions.get(params.sessionId);
		const stored = existing?.stored ?? readStoredSession(params.sessionId);
		if (!stored) throw RequestError.sessionNotFound(params.sessionId);
		if (params.cwd) stored.cwd = params.cwd;
		const cat = sessionCatalog(stored, set);
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
		for (const u of stored.updates) await client.notify(methods.client.session.update, {
			sessionId: stored.sessionId,
			update: u
		});
		await advertiseSessionReady(client, live, cat.models);
		return { configOptions: buildConfigOptions(stored, set) };
	});
	app.onRequest(methods.agent.session.fork, async ({ params, client }) => {
		await ensureAuthenticatedOrThrow();
		const set = await loadCatalogs();
		const source = liveSessions.get(params.sessionId)?.stored ?? readStoredSession(params.sessionId);
		if (!source) throw RequestError.sessionNotFound(params.sessionId);
		const sysText = extractSystemPromptText(asRecord$1(params)?.systemPrompt);
		const forked = forkStoredSession(source, {
			cwd: params.cwd,
			...sysText !== void 0 ? { systemPrompt: sysText } : {}
		});
		const cat = sessionCatalog(forked, set);
		saveStoredSession(forked);
		const mcp = new SessionMcpBridge();
		await mcp.connectAll(Array.isArray(params.mcpServers) ? params.mcpServers : [], client);
		const live = {
			stored: forked,
			mcp,
			running: false,
			steeredQueue: []
		};
		liveSessions.set(forked.sessionId, live);
		advertiseSessionReady(client, live, cat.models).catch(() => {});
		return {
			sessionId: forked.sessionId,
			configOptions: buildConfigOptions(forked, set)
		};
	});
	app.onRequest(methods.agent.session.list, async ({ params }) => {
		const archivedFilter = asRecord$1(params)?.archived;
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
	const teardownLive = (sessionId) => {
		const live = liveSessions.get(sessionId);
		if (live) {
			live.abort?.abort();
			live.mcp.close();
			liveSessions.delete(sessionId);
		}
	};
	app.onRequest(methods.agent.session.close, async ({ params }) => {
		teardownLive(params.sessionId);
		return {};
	});
	app.onRequest(methods.agent.session.archive, async ({ params }) => {
		const stored = liveSessions.get(params.sessionId)?.stored ?? readStoredSession(params.sessionId);
		if (!stored) throw RequestError.sessionNotFound(params.sessionId);
		teardownLive(params.sessionId);
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
		teardownLive(params.sessionId);
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
		const set = await loadCatalogs();
		await emitSessionUpdate(client, live, {
			sessionUpdate: "config_option_update",
			configOptions: buildConfigOptions(live.stored, set)
		}, false);
		return {};
	});
	app.onRequest(methods.agent.session.setConfigOption, async ({ params, client }) => {
		const live = liveSessions.get(params.sessionId);
		if (!live) throw RequestError.sessionNotFound(params.sessionId);
		const id = String(params.configId ?? "");
		const rawValProp = asRecord$1(params)?.value;
		const rawVal = typeof rawValProp === "string" ? rawValProp.trim() : String(rawValProp ?? "");
		const set = await loadCatalogs();
		if (id === "model") {
			if (!rawVal) throw RequestError.invalidParams(void 0, "Model ID cannot be empty.");
			applyModelPick(live.stored, resolveModelPick(set, rawVal, live.stored.providerId), true);
		} else if (id === "mode") {
			if (rawVal !== "code" && rawVal !== "plan" && rawVal !== "auto") throw RequestError.invalidParams(void 0, `Invalid mode "${rawVal}".`);
			live.stored.mode = rawVal;
			saveCliSettings({ defaultMode: rawVal }, sharedDir());
		} else if (id === "reasoning") {
			if (rawVal !== "none" && rawVal !== "low" && rawVal !== "medium" && rawVal !== "high") throw RequestError.invalidParams(void 0, `Invalid reasoning level "${rawVal}".`);
			live.stored.reasoning = rawVal;
			saveCliSettings({ defaultReasoning: rawVal }, sharedDir());
		} else throw RequestError.invalidParams(void 0, `Unknown config option "${id}".`);
		saveStoredSession(live.stored);
		const updated = buildConfigOptions(live.stored, set);
		await emitSessionUpdate(client, live, {
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
	app.onRequest("_session/steering", (p) => asRecord$1(p) ?? {}, async ({ params }) => {
		const live = liveSessions.get(String(params?.sessionId ?? ""));
		if (!live) return { outcome: "failed" };
		if (!live.running) return { outcome: "promptRequired" };
		const content = promptBlocksToContent(params?.prompt ?? []);
		if (!content || typeof content === "string" && !content.trim()) return { outcome: "failed" };
		const msg = {
			role: "user",
			content
		};
		const firstText = (Array.isArray(params?.prompt) ? params.prompt : []).find((raw) => {
			const b = asRecord$1(raw);
			return b?.type === "text" && typeof b.text === "string";
		});
		if (firstText) steeredDisplayText.set(msg, String(asRecord$1(firstText)?.text ?? ""));
		live.steeredQueue.push(msg);
		return { outcome: "injected" };
	});
}
// src/browserLogin.ts
/**
* Cross-platform 1-click browser OAuth loopback flow (`127.0.0.1:<ephemeral_port>/callback`)
* for signing into Olympus Cloud from `oly login` without copying or pasting tokens.
*
* Security controls:
* - Binds strictly to `127.0.0.1` (never `0.0.0.0`), so LAN peers cannot reach the callback port.
* - Verifies a 48-hex-char random `cliState` nonce before accepting any token.
* - Scrubs the `?token=` query string from browser tab history via `history.replaceState` immediately on load.
*/
/** Open an `http(s)://` URL in the user's default OS browser safely without shell interpolation. */
function openSystemBrowser(url) {
	if (!/^https?:\/\//i.test(url)) return false;
	const captureFile = process.env.OLYMPUS_TEST_BROWSER_URL_FILE?.trim();
	if (captureFile) {
		try {
			writeFileSync(captureFile, url, "utf8");
		} catch {}
		return true;
	}
	if (process.env.OLYMPUS_NO_OPEN_BROWSER === "1") return false;
	try {
		const cmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "rundll32" : "xdg-open";
		const args = process.platform === "win32" ? ["url.dll,FileProtocolHandler", url] : [url];
		const child = spawn(cmd, args, {
			detached: true,
			stdio: "ignore"
		});
		child.on("error", () => {});
		child.unref();
		return true;
	} catch {
		return false;
	}
}
function callbackSuccessHtml(email) {
	return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Olympus CLI — Signed In</title>
  <style>
    :root { color-scheme: dark; }
    body { background: #0b0c0e; color: #eceef2; font-family: -apple-system, BlinkMacSystemFont, "Inter", sans-serif; display: grid; place-items: center; min-height: 100vh; margin: 0; }
    .box { background: #121418; border: 1px solid #23262d; border-radius: 10px; padding: 28px 32px; max-width: 420px; text-align: center; }
    h1 { font-size: 18px; font-weight: 600; margin: 0 0 8px; }
    p { font-size: 14px; color: #8b919e; margin: 0; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="box">
    <h1>Signed in to Olympus Cloud</h1>
    <p>Authenticated as <strong>${(email ?? "your account").replace(/[&<>"']/g, "")}</strong>. You can close this browser tab and return to your terminal.</p>
  </div>
  <script>try { history.replaceState(null, '', '/callback'); } catch {}<\/script>
</body>
</html>`;
}
/**
* Start a temporary `127.0.0.1` loopback listener, launch GitHub OAuth on the Olympus Cloud gateway,
* and resolve once the signed-in `oly_live_...` token arrives on `/callback`.
*/
async function runOlympusCloudBrowserLogin(baseUrl, opts = {}) {
	const timeoutMs = opts.timeoutMs ?? 12e4;
	const origin = new URL(baseUrl).origin;
	const cliState = randomBytes(24).toString("hex");
	return new Promise((resolve, reject) => {
		let settled = false;
		let authorizeUrl = "";
		const finish = (err, res) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			opts.signal?.removeEventListener("abort", onAbort);
			server.close(() => {});
			if (err) reject(err);
			else resolve(res);
		};
		const onAbort = () => finish(/* @__PURE__ */ new Error("Browser sign-in was cancelled."));
		if (opts.signal?.aborted) {
			reject(/* @__PURE__ */ new Error("Browser sign-in was cancelled."));
			return;
		}
		opts.signal?.addEventListener("abort", onAbort, { once: true });
		const server = createServer((req, res) => {
			const reqUrl = new URL(req.url ?? "/", "http://127.0.0.1");
			if (req.method !== "GET" || reqUrl.pathname !== "/callback") {
				res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
				res.end("Not found");
				return;
			}
			const returnedState = reqUrl.searchParams.get("state") ?? "";
			const token = (reqUrl.searchParams.get("token") ?? "").trim();
			const email = reqUrl.searchParams.get("email")?.trim() || void 0;
			const plan = reqUrl.searchParams.get("plan")?.trim() || void 0;
			if (returnedState !== cliState || !token.startsWith("oly_")) {
				res.writeHead(400, {
					"Content-Type": "text/plain; charset=utf-8",
					"Cache-Control": "no-store"
				});
				res.end("Invalid OAuth state or token. Please return to your terminal and run `oly login` again.");
				return;
			}
			res.writeHead(200, {
				"Content-Type": "text/html; charset=utf-8",
				"Cache-Control": "no-store",
				"Referrer-Policy": "no-referrer",
				Connection: "close"
			});
			res.end(callbackSuccessHtml(email));
			finish(void 0, {
				token,
				email,
				plan,
				authorizeUrl
			});
		});
		server.on("error", (err) => finish(err instanceof Error ? err : new Error(String(err))));
		const timer = setTimeout(() => {
			finish(/* @__PURE__ */ new Error("Browser sign-in timed out after 2 minutes."));
		}, timeoutMs);
		timer.unref?.();
		server.listen(0, "127.0.0.1", () => {
			const addr = server.address();
			if (!addr || typeof addr.port !== "number") {
				finish(/* @__PURE__ */ new Error("Failed to bind local loopback callback port."));
				return;
			}
			const start = new URL(`${origin}/v1/auth/github/start`);
			start.searchParams.set("cli_port", String(addr.port));
			start.searchParams.set("cli_state", cliState);
			authorizeUrl = start.toString();
			opts.onAuthorizeUrl?.(authorizeUrl);
			(opts.openBrowser ?? openSystemBrowser)(authorizeUrl);
		});
	});
}
// src/acpServer.ts
function asRecord(v) {
	return v !== null && typeof v === "object" && !Array.isArray(v) ? v : void 0;
}
function createOlympusAgentApp(opts = {}) {
	const env = opts.env ?? process.env;
	const version = opts.version ?? "0.2.0";
	let clientCaps = {};
	let providerOverride = null;
	let ollamaCache = null;
	const liveSessions = /* @__PURE__ */ new Map();
	const sharedDir = () => env.OLYMPUS_HOME || env.OLYMPUS_SHARED_DIR || env.AGENTDESK_SHARED_ROOT;
	const connected = async () => {
		const inputs = inputsFromEnv(env);
		let ollamaOk = false;
		if (!providerOverride && !inputs.olympusCloudToken && !inputs.openRouterToken && !inputs.anthropicToken && !inputs.aiGatewayToken && !inputs.customToken && !inputs.useOllama) {
			if (!ollamaCache || Date.now() - ollamaCache.checkedAt > 1e4) ollamaCache = {
				checkedAt: Date.now(),
				ok: await detectLocalOllama(inputs.ollamaHost, env.OLYMPUS_DISABLE_OLLAMA_PROBE === "1")
			};
			ollamaOk = ollamaCache.ok;
		}
		return resolveConnectedProviders(inputs, providerOverride, ollamaOk);
	};
	const currentEndpoint = async () => {
		const c = await connected();
		return c.providers.find((p) => p.id === c.defaultId)?.endpoint ?? unconfiguredEndpoint(inputsFromEnv(env));
	};
	const loadCatalogs = async () => {
		const c = await connected();
		return {
			list: await Promise.all(c.providers.map(async (p) => ({
				id: p.id,
				label: p.label,
				source: p.source,
				endpoint: p.endpoint,
				models: await listAvailableModels(p.endpoint)
			}))),
			...c.defaultId ? { defaultId: c.defaultId } : {}
		};
	};
	const sessionCatalog = (stored, set) => {
		let cat = stored.providerId ? set.list.find((c) => c.id === stored.providerId) : void 0;
		if (!cat && !stored.providerId) {
			const def = defaultCatalog(set);
			cat = def?.models.some((m) => m.id === stored.model) ? def : set.list.find((c) => c.models.some((m) => m.id === stored.model));
			cat ??= def;
			if (cat) stored.providerId = cat.id;
		}
		cat ??= defaultCatalog(set);
		if (!cat) throw RequestError.authRequired(void 0, "No model provider is connected. Run `oly login` or set a provider API key.");
		return cat;
	};
	const resolveModelPick = (set, value, currentProviderId) => {
		const ref = parseModelRef(value);
		if (!ref.model) throw RequestError.invalidParams(void 0, "Model ID cannot be empty.");
		if (ref.providerId) {
			const cat = set.list.find((c) => c.id === ref.providerId);
			if (!cat) throw RequestError.invalidParams(void 0, `Provider "${ref.providerId}" is not connected (connected: ${set.list.map((c) => c.id).join(", ") || "none"}).`);
			return {
				cat,
				model: ref.model
			};
		}
		const cur = set.list.find((c) => c.id === currentProviderId);
		if (cur?.models.some((m) => m.id === ref.model)) return {
			cat: cur,
			model: ref.model
		};
		const cat = set.list.find((c) => c.models.some((m) => m.id === ref.model)) ?? cur ?? defaultCatalog(set);
		if (!cat) throw RequestError.authRequired(void 0, "No model provider is connected.");
		return {
			cat,
			model: ref.model
		};
	};
	const applyModelPick = (stored, pick, persist) => {
		stored.model = pick.model;
		stored.providerId = pick.cat.id;
		stored.usage.contextSize = contextSizeForModel(pick.model, pick.cat.models);
		if (!persist) return;
		if (pick.cat.source === "saved") {
			setActiveProvider(pick.cat.id, sharedDir());
			setProviderDefaultModel(pick.cat.id, pick.model, sharedDir());
		} else setUnsavedProviderDefaultModel(pick.model, sharedDir());
	};
	const describeAccount = (p) => {
		if (p.source === "env") return "env var";
		if (p.source === "acp") return "Olympus Coder app";
		if (p.source === "auto") return "Auto-detected";
		if (p.keyStore === "keychain") return "Keychain";
		if (p.keyStore === "file") return "Saved key file";
		return "Local server, no key";
	};
	const buildAuthState = async () => {
		const c = await connected();
		if (!c.providers.length) return {
			state: "unauthenticated",
			accounts: []
		};
		return {
			state: "authenticated",
			accounts: [...c.providers].sort((a, b) => Number(b.id === c.defaultId) - Number(a.id === c.defaultId)).map((p) => ({
				id: p.id,
				label: p.label,
				description: describeAccount(p),
				plan: p.label,
				active: p.id === c.defaultId,
				_meta: {
					providerId: p.id,
					flavor: p.endpoint.flavor,
					source: p.source
				}
			}))
		};
	};
	const applyInitialConfig = (stored, initial, set) => {
		if (!Array.isArray(initial)) return;
		for (const raw of initial) {
			const item = asRecord(raw);
			const id = String(item?.configId ?? "");
			const val = typeof item?.value === "string" ? item.value.trim() : "";
			if (!val) continue;
			if (id === "model") try {
				applyModelPick(stored, resolveModelPick(set, val, stored.providerId), false);
			} catch {}
			else if (id === "mode" && (val === "code" || val === "plan" || val === "auto")) stored.mode = val;
			else if (id === "reasoning" && (val === "none" || val === "low" || val === "medium" || val === "high")) stored.reasoning = val;
		}
	};
	const ensureAuthenticatedOrThrow = async () => {
		const ep = await currentEndpoint();
		if (!ep.configured) throw RequestError.authRequired(void 0, "Olympus needs one model provider API key (OpenRouter, Anthropic, Vercel AI Gateway, custom OpenAI-compatible URL) or local Ollama.");
		return ep;
	};
	const notifyAuthStatus = async (client) => {
		const status = await buildAuthState();
		await client.notify(methods.client.auth.statusUpdate, status).catch(() => {});
		return status;
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
			authMethods: buildAuthMethods({ includeOlympusCloud: env.OLYMPUS_CLOUD_ENABLED === "1" }),
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
	app.onRequest(methods.agent.auth.status, async () => buildAuthState());
	app.onRequest(methods.agent.authenticate, async ({ params, client, signal }) => {
		const apiKeyMeta = asRecord(asRecord(asRecord(params)?._meta)?.["api-key"]);
		const metaKey = apiKeyMeta?.apiKey;
		const methodId = String(params?.methodId ?? "");
		if (methodId === "olympus-cloud-oauth" && !(typeof metaKey === "string" && metaKey.trim())) {
			const baseUrl = env.OLYMPUS_CLOUD_URL?.trim() || GATEWAY_ENDPOINTS.olympusCloud;
			const loginRes = await runOlympusCloudBrowserLogin(baseUrl, {
				signal,
				openBrowser: opts.openBrowser
			});
			const saved = upsertProvider({
				flavor: "olympus-cloud",
				baseUrl,
				key: loginRes.token
			}, { makeActive: true }, sharedDir());
			if (loginRes.email) updateProvider(saved.provider.id, { label: `Olympus Cloud (${loginRes.email})` }, sharedDir());
			invalidateModelCache();
		} else if (typeof metaKey === "string" && metaKey.trim()) {
			let flavor = "openrouter";
			let baseUrl = GATEWAY_ENDPOINTS.openrouter;
			if (methodId === "olympus-cloud") {
				const metaBase = typeof apiKeyMeta?.baseUrl === "string" ? apiKeyMeta.baseUrl.trim() : "";
				flavor = "olympus-cloud";
				baseUrl = metaBase || env.OLYMPUS_CLOUD_URL?.trim() || GATEWAY_ENDPOINTS.olympusCloud;
			} else if (methodId === "anthropic") {
				flavor = "anthropic";
				baseUrl = GATEWAY_ENDPOINTS.anthropic;
			} else if (methodId === "ai-gateway") {
				flavor = "ai-gateway";
				baseUrl = GATEWAY_ENDPOINTS.aiGateway;
			} else if (methodId === "custom-openai") {
				baseUrl = (typeof apiKeyMeta?.baseUrl === "string" ? apiKeyMeta.baseUrl.trim() : "") || env.OLYMPUS_BASE_URL?.trim() || GATEWAY_ENDPOINTS.openai;
				flavor = inferFlavorFromUrl(baseUrl);
			}
			upsertProvider({
				flavor,
				baseUrl,
				key: metaKey.trim()
			}, { makeActive: true }, sharedDir());
			invalidateModelCache();
		} else if (methodId && getSavedProvider(methodId, sharedDir())) setActiveProvider(methodId, sharedDir());
		const status = await buildAuthState();
		if (status.state !== "authenticated") throw RequestError.authRequired(void 0, "Provide an API key or start local Ollama first.");
		await client.notify(methods.client.auth.statusUpdate, status).catch(() => {});
		return {};
	});
	app.onRequest(methods.agent.logout, async ({ client }) => {
		providerOverride = null;
		delete env.OLYMPUS_CLOUD_API_KEY;
		delete env.OPENROUTER_API_KEY;
		delete env.ANTHROPIC_API_KEY;
		delete env.AI_GATEWAY_API_KEY;
		delete env.OLYMPUS_OPENAI_API_KEY;
		const active = getActiveProvider(sharedDir());
		if (active) removeProvider(active.id, sharedDir());
		invalidateModelCache();
		await notifyAuthStatus(client);
		return {};
	});
	app.onRequest(methods.agent.providers.list, async () => {
		const activeId = getActiveProvider(sharedDir())?.id;
		const apiTypeOf = (flavor) => flavor === "anthropic" ? "anthropic" : "openai";
		return { providers: [{
			providerId: "openai",
			supported: ["openai"],
			required: false,
			...providerOverride ? { current: {
				apiType: providerOverride.apiType ?? "openai",
				baseUrl: providerOverride.baseUrl
			} } : {}
		}, ...listSavedProviders(sharedDir()).map((p) => ({
			providerId: p.id,
			supported: [apiTypeOf(p.flavor)],
			required: false,
			current: {
				apiType: apiTypeOf(p.flavor),
				baseUrl: p.baseUrl
			},
			_meta: {
				label: p.label,
				active: p.id === activeId,
				keyStore: p.keyStore,
				...p.defaultModel ? { defaultModel: p.defaultModel } : {}
			}
		}))] };
	});
	app.onRequest(methods.agent.providers.set, async ({ params, client }) => {
		const providerId = String(params?.providerId ?? "").trim();
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
		const saved = providerId && providerId !== "openai" ? getSavedProvider(providerId, sharedDir()) : void 0;
		if (saved) {
			const header = (name) => Object.entries(headers).find(([k]) => k.toLowerCase() === name)?.[1];
			const key = header("authorization")?.replace(/^Bearer\s+/i, "").trim() || header("x-api-key");
			updateProvider(saved.id, {
				baseUrl,
				...key ? { key } : {}
			}, sharedDir());
			setActiveProvider(saved.id, sharedDir());
		} else providerOverride = {
			baseUrl,
			headers,
			apiType: String(params?.apiType ?? "openai")
		};
		invalidateModelCache();
		await notifyAuthStatus(client);
		return {};
	});
	app.onRequest(methods.agent.providers.disable, async ({ params, client }) => {
		const providerId = String(asRecord(params)?.providerId ?? "").trim();
		if (!providerId || providerId === "openai" || !getSavedProvider(providerId, sharedDir())) providerOverride = null;
		invalidateModelCache();
		await notifyAuthStatus(client);
		return {};
	});
	registerAcpSessionHandlers(app, {
		liveSessions,
		sharedDir,
		currentEndpoint,
		ensureAuthenticatedOrThrow,
		loadCatalogs,
		sessionCatalog,
		resolveModelPick,
		applyModelPick,
		applyInitialConfig
	});
	app.onRequest(methods.agent.session.prompt, async ({ params, signal, client }) => {
		const live = liveSessions.get(params.sessionId);
		if (!live) throw RequestError.sessionNotFound(params.sessionId);
		if (live.running) throw RequestError.invalidRequest(void 0, "Session is already processing a turn.");
		await ensureAuthenticatedOrThrow();
		const set = await loadCatalogs();
		const sessionCat = sessionCatalog(live.stored, set);
		return runSessionPromptTurn({
			prompt: params.prompt,
			signal,
			client,
			clientCaps,
			live,
			set,
			sessionCat,
			version,
			resolveModelPick,
			applyModelPick
		});
	});
	return app;
}
// src/loginWizard.ts
/**
* Interactive `oly login` wizard with hidden TTY secret input (`Prompter`) for BYO API keys
* (OpenRouter, Anthropic Direct, Vercel AI Gateway, Custom OpenAI) and local servers (Ollama, LM Studio).
* Olympus Cloud stays hidden until launched (`OLYMPUS_CLOUD_ENABLED=1`).
*/
/** Line prompter: one readline for the whole wizard; `askSecret` hides typed characters on a TTY. */
var Prompter = class {
	muted = false;
	rl;
	lines;
	tty = Boolean(process.stdin.isTTY);
	constructor() {
		const output = new Writable({ write: (chunk, _enc, cb) => {
			if (!this.muted) process.stdout.write(chunk);
			cb();
		} });
		this.rl = createInterface({
			input: process.stdin,
			output,
			terminal: this.tty
		});
		if (!this.tty) this.lines = this.rl[Symbol.asyncIterator]();
	}
	async ask(question) {
		if (this.lines) {
			process.stdout.write(question);
			const r = await this.lines.next();
			if (!r.done) process.stdout.write("\n");
			return r.done ? "" : String(r.value).trim();
		}
		return (await this.rl.question(question)).trim();
	}
	async askSecret(question) {
		if (this.lines) return this.ask(question);
		process.stdout.write(question);
		this.muted = true;
		try {
			return (await this.rl.question("")).trim();
		} finally {
			this.muted = false;
			process.stdout.write("\n");
		}
	}
	close() {
		this.rl.close();
	}
};
function keyStoreText(p) {
	if (p.keyStore === "keychain") return "macOS Keychain";
	if (p.keyStore === "file") return `${credentialsFile()} (mode 0600)`;
	return "no key";
}
async function suggestLocalModel(baseUrl) {
	try {
		return (await fetchRemoteModels(baseUrl, {}, 3e3))[0]?.id;
	} catch {
		return;
	}
}
async function runLoginWizard$1(initStorage) {
	initStorage?.();
	const io = new Prompter();
	try {
		const saved = listSavedProviders();
		const cloudEnabled = process.env.OLYMPUS_CLOUD_ENABLED === "1";
		console.log("\n⚡ Olympus CLI (oly) — Sign in or add a provider\n");
		if (saved.length) console.log(`  Saved providers (kept as they are): ${saved.map((p) => p.id).join(", ")}\n`);
		const menu = [
			...cloudEnabled ? [{
				id: "olympus-cloud",
				text: "Olympus Cloud (Paid multi-model credits: $20/$60/$100 or $10 top-up · Zero chat logging)"
			}] : [],
			{
				id: "openrouter",
				text: "OpenRouter (BYO API key → 500+ models: Claude 5.5, GPT-5, Gemini, DeepSeek, Qwen, Free tier)"
			},
			{
				id: "anthropic",
				text: "Anthropic Direct (BYO Claude API key → Native Claude 5.5 + Prompt Caching + Adaptive Thinking)"
			},
			{
				id: "ai-gateway",
				text: "Vercel AI Gateway (BYO API key → 400+ models at 0% token markup)"
			},
			{
				id: "custom-openai",
				text: "Custom OpenAI-Compatible Endpoint (OpenAI, DeepSeek, Groq, Together, LiteLLM, vLLM)"
			},
			{
				id: "ollama",
				text: "Local Ollama (Zero API key, runs locally on your machine)"
			},
			{
				id: "lmstudio",
				text: "LM Studio (local server, zero API key)"
			}
		];
		menu.forEach((item, idx) => console.log(`  ${idx + 1}) ${item.text}`));
		console.log("");
		const selectedId = menu[Number(await io.ask(`Choose provider [1-${menu.length}] (default 1): `) || "1") - 1]?.id ?? menu[0].id;
		let flavor;
		let baseUrl;
		let keyMode = "required";
		let keyLabel = "API key";
		if (selectedId === "olympus-cloud") {
			flavor = "olympus-cloud";
			const defaultCloudUrl = process.env.OLYMPUS_CLOUD_URL?.trim() || GATEWAY_ENDPOINTS.olympusCloud;
			console.log(`\n  Get your Olympus Cloud token at: ${OLYMPUS_CLOUD_PORTAL_LINK}`);
			baseUrl = await io.ask(`Olympus Cloud URL (Enter for ${defaultCloudUrl}): `) || defaultCloudUrl;
			keyLabel = "Olympus Cloud token (oly_live_...)";
		} else if (selectedId === "openrouter") {
			flavor = "openrouter";
			baseUrl = GATEWAY_ENDPOINTS.openrouter;
			keyLabel = "OpenRouter API key (sk-or-...)";
		} else if (selectedId === "anthropic") {
			flavor = "anthropic";
			baseUrl = GATEWAY_ENDPOINTS.anthropic;
			keyLabel = "Anthropic Claude API key";
		} else if (selectedId === "ai-gateway") {
			flavor = "ai-gateway";
			baseUrl = GATEWAY_ENDPOINTS.aiGateway;
			keyLabel = "Vercel AI Gateway API key";
		} else if (selectedId === "custom-openai") {
			flavor = "openai-compatible";
			baseUrl = await io.ask(`Base URL (Enter for ${GATEWAY_ENDPOINTS.openai}): `) || GATEWAY_ENDPOINTS.openai;
			keyMode = "optional";
		} else if (selectedId === "ollama") {
			flavor = "ollama";
			baseUrl = await io.ask(`Ollama base URL (Enter for ${GATEWAY_ENDPOINTS.ollama}): `) || GATEWAY_ENDPOINTS.ollama;
			keyMode = "none";
		} else {
			flavor = "openai-compatible";
			baseUrl = await io.ask(`LM Studio base URL (Enter for ${GATEWAY_ENDPOINTS.lmstudio}): `) || GATEWAY_ENDPOINTS.lmstudio;
			keyMode = "none";
		}
		if (!/^https?:\/\//i.test(baseUrl)) throw new Error("Base URL must start with http:// or https://");
		const existing = findSavedProvider(baseUrl);
		if (existing) {
			flavor = existing.flavor;
			console.log(`\n  Updating saved provider "${existing.id}" (${existing.label}); other providers are kept.\n`);
		}
		const hasKey = Boolean(existing && existing.keyStore !== "none");
		let key = "";
		if (flavor === "olympus-cloud" && Boolean(process.stdin.isTTY)) {
			const useBrowser = (await io.ask("Sign in via browser with GitHub (1-click, no copy-paste)? [Y/n]: ")).toLowerCase();
			if (useBrowser === "" || useBrowser === "y" || useBrowser === "yes") try {
				const browserRes = await runOlympusCloudBrowserLogin(baseUrl, { onAuthorizeUrl: (url) => console.log(`\n  Opening GitHub sign-in in your browser...\n  If it does not open automatically, visit:\n  ${url}\n`) });
				key = browserRes.token;
				console.log(`  ✓ Signed in via GitHub${browserRes.email ? ` (${browserRes.email})` : ""}${browserRes.plan ? ` · Plan: ${browserRes.plan}` : ""}\n`);
			} catch (err) {
				console.log(`  Browser sign-in did not complete (${err?.message ?? err}). Falling back to token paste.\n`);
			}
		}
		if (!key && keyMode !== "none") {
			const hint = hasKey ? " (Enter to keep the saved key)" : keyMode === "optional" ? " (Enter for none)" : "";
			key = await io.askSecret(`Paste your ${keyLabel}${hint} — input is hidden: `);
			if (!key && keyMode === "required" && !hasKey) throw new Error(`${keyLabel} is required.`);
		}
		const local = keyMode === "none" || flavor === "ollama";
		const suggested = existing?.defaultModel || (local ? await suggestLocalModel(baseUrl) : void 0) || (local && flavor === "openai-compatible" ? "" : defaultModelForFlavor(flavor));
		const model = suggested ? await io.ask(`Default model (Enter for ${suggested}): `) || suggested : await io.ask("Default model ID (as listed by the server, e.g. qwen/qwen3-coder-30b): ");
		if (!model) throw new Error("A default model ID is required for this provider.");
		const others = listSavedProviders().filter((p) => p.id !== existing?.id);
		let makeActive = true;
		if (others.length) {
			const ans = (await io.ask("Make it the active provider? [Y/n]: ")).toLowerCase();
			makeActive = ans === "" || ans === "y" || ans === "yes";
		}
		const res = upsertProvider({
			flavor,
			baseUrl,
			...key ? { key } : {},
			defaultModel: model
		}, { makeActive });
		console.log(`\n✓ ${res.created ? "Saved" : "Updated"} provider "${res.provider.id}" — ${res.provider.label} (${safeHost(res.provider.baseUrl)}), model ${model}.`);
		console.log(`  Key stored in: ${keyStoreText(res.provider)}`);
		console.log(res.active ? "  This is now the active provider." : `  Active provider unchanged. Switch any time with: oly use ${res.provider.id}`);
		console.log("");
	} finally {
		io.close();
	}
}
// src/tui/clipboard.ts
function clipboardCommands(platform = process.platform) {
	if (platform === "darwin") return [["pbcopy", []]];
	if (platform === "win32") return [["clip", []]];
	return [
		["wl-copy", []],
		["xclip", ["-selection", "clipboard"]],
		["xsel", ["--clipboard", "--input"]]
	];
}
function copyToClipboard(text, platform = process.platform) {
	let error = "no clipboard command found";
	for (const [cmd, args] of clipboardCommands(platform)) {
		const r = spawnSync(cmd, args, {
			input: text,
			timeout: 3e3,
			stdio: [
				"pipe",
				"ignore",
				"pipe"
			],
			windowsHide: true
		});
		if (!r.error && r.status === 0) return {
			ok: true,
			tool: cmd
		};
		error = r.error ? `${cmd}: ${r.error.message}` : `${cmd} exited with ${r.status ?? r.signal}: ${String(r.stderr ?? "").trim()}`;
	}
	return {
		ok: false,
		error
	};
}
// src/tui/commands.ts
var TUI_COMMANDS = [
	{
		name: "help",
		description: "Commands and keyboard shortcuts",
		aliases: ["?"]
	},
	{
		name: "model",
		description: "Pick the model for this session",
		hint: "[id]",
		aliases: ["models"]
	},
	{
		name: "provider",
		description: "Switch to another connected provider",
		aliases: ["providers"]
	},
	{
		name: "login",
		description: "Add or update a provider and API key"
	},
	{
		name: "mode",
		description: "Set the mode: code, plan or auto",
		hint: "[code|plan|auto]"
	},
	{
		name: "cost",
		description: "Tokens and cost for this session"
	},
	{
		name: "copy",
		description: "Copy the last assistant response to clipboard"
	},
	{
		name: "clear",
		description: "Clear the conversation and the screen"
	},
	{
		name: "new",
		description: "Start a new session"
	},
	{
		name: "resume",
		description: "Resume an earlier session in this folder"
	},
	{
		name: "compact",
		description: "Summarize older turns to free context",
		agent: true
	},
	{
		name: "status",
		description: "Provider, model, mode and usage",
		agent: true
	},
	{
		name: "exit",
		description: "Quit Olympus",
		aliases: ["quit"]
	}
];
/** `/model gpt-5` → { name: 'model', arg: 'gpt-5' }; non-commands → null. `//x` is literal text. */
function parseSlash(input) {
	const t = input.trim();
	if (!t.startsWith("/") || t.startsWith("//")) return null;
	const m = /^\/(\S+)\s*([\s\S]*)$/.exec(t);
	if (!m) return null;
	return {
		name: m[1].toLowerCase(),
		arg: m[2].trim()
	};
}
function findCommand(list, name) {
	const n = name.toLowerCase();
	return list.find((c) => c.name === n || c.aliases?.includes(n));
}
/**
* Fuzzy score: all query chars must appear in order. Higher is better; prefix and word-boundary hits rank first.
* Returns -1 when it does not match.
*/
function fuzzyScore(query, target) {
	const q = query.toLowerCase();
	const t = target.toLowerCase();
	if (!q) return 1;
	if (t === q) return 1e3;
	if (t.startsWith(q)) return 800 - t.length;
	const sub = t.indexOf(q);
	if (sub >= 0) return (sub === 0 || /[\/\-_. ]/.test(t[sub - 1]) ? 600 : 400) - sub - t.length / 100;
	let score = 0;
	let ti = 0;
	let prev = -2;
	for (const ch of q) {
		const i = t.indexOf(ch, ti);
		if (i < 0) return -1;
		score += i === prev + 1 ? 6 : 1;
		if (i === 0 || /[\/\-_. ]/.test(t[i - 1])) score += 4;
		prev = i;
		ti = i + 1;
	}
	return score - t.length / 100;
}
function fuzzyFilter(items, query, key, limit = 50) {
	if (!query) return items.slice(0, limit);
	return items.map((item, idx) => ({
		item,
		idx,
		s: fuzzyScore(query, key(item))
	})).filter((x) => x.s >= 0).sort((a, b) => b.s - a.s || a.idx - b.idx).slice(0, limit).map((x) => x.item);
}
/** Merge the agent's advertised commands (`available_commands_update`) into the TUI list; TUI entries win. */
function mergeAgentCommands(tui, agentCmds) {
	const out = [...tui];
	for (const a of agentCmds) {
		if (!a?.name) continue;
		if (findCommand(out, a.name)) continue;
		out.push({
			name: a.name,
			description: a.description ?? "",
			...a.input?.hint ? { hint: a.input.hint } : {},
			agent: true
		});
	}
	return out;
}
// src/tui/files.ts
/**
* `@file` support: the file list for the suggestions popup (git ls-files in a repo, else a bounded walk) and the
* conversion of `@path` mentions into ACP `resource` blocks on submit.
*/
var SKIP = /* @__PURE__ */ new Set([
	"node_modules",
	".git",
	"dist",
	"build",
	".next",
	".turbo",
	"coverage",
	".venv",
	"venv",
	"__pycache__",
	"target",
	".cache"
]);
var MAX_FILES = 5e3;
/** Max bytes of one attached file. */
var MAX_RESOURCE_BYTES = 2e5;
function listWorkspaceFiles(cwd) {
	try {
		const files = execFileSync("git", [
			"ls-files",
			"--cached",
			"--others",
			"--exclude-standard"
		], {
			cwd,
			encoding: "utf8",
			timeout: 3e3,
			maxBuffer: 16777216,
			stdio: [
				"ignore",
				"pipe",
				"ignore"
			]
		}).split("\n").filter(Boolean);
		if (files.length) return files.slice(0, MAX_FILES);
	} catch {}
	const files = [];
	const walk = (dir, depth) => {
		if (files.length >= 5e3 || depth > 8) return;
		let entries;
		try {
			entries = readdirSync(dir, { withFileTypes: true });
		} catch {
			return;
		}
		entries.sort((a, b) => a.name.localeCompare(b.name));
		for (const e of entries) {
			if (files.length >= 5e3) return;
			if (e.name.startsWith(".") && e.name !== ".github") continue;
			const full = join(dir, e.name);
			if (e.isDirectory()) {
				if (!SKIP.has(e.name)) walk(full, depth + 1);
			} else if (e.isFile()) files.push(relative(cwd, full).split(sep).join("/"));
		}
	};
	walk(cwd, 0);
	return files;
}
/** `@path` mentions in `text` that exist as files under `cwd` (deduped, in order). */
function findMentions(text, cwd) {
	const out = [];
	const seen = /* @__PURE__ */ new Set();
	const re = /(^|\s)@((?:[^\s\\]|\\ )+)/g;
	let m;
	while (m = re.exec(text)) {
		const raw = m[2].replace(/\\ /g, " ").replace(/[),.;:!?]+$/, "");
		const abs = isAbsolute(raw) ? raw : resolve(cwd, raw);
		if (seen.has(abs)) continue;
		try {
			if (!existsSync(abs) || !statSync(abs).isFile()) continue;
		} catch {
			continue;
		}
		seen.add(abs);
		out.push({
			mention: raw,
			abs
		});
	}
	return out;
}
/** Prompt blocks for a submitted message: the plain text plus one `resource` block per mentioned file. */
function buildPromptBlocks(text, cwd) {
	const blocks = [{
		type: "text",
		text
	}];
	for (const { abs } of findMentions(text, cwd)) {
		let body = "";
		try {
			const buf = readFileSync(abs);
			if (buf.includes(0)) continue;
			body = buf.subarray(0, MAX_RESOURCE_BYTES).toString("utf8");
			if (buf.length > 2e5) body += `\n… (truncated at ${MAX_RESOURCE_BYTES} bytes of ${buf.length})`;
		} catch {
			continue;
		}
		blocks.push({
			type: "resource",
			resource: {
				uri: pathToFileURL(abs).href,
				mimeType: "text/plain",
				text: body
			}
		});
	}
	return blocks;
}
/** Quote a path for insertion after `@` (spaces escaped). */
function mentionText(path) {
	return path.replace(/ /g, "\\ ");
}
// src/tui/text.ts
function detectColorLevel(env = process.env, isTTY = Boolean(process.stdout.isTTY)) {
	if (env.NO_COLOR !== void 0 && env.NO_COLOR !== "") return 0;
	const force = env.FORCE_COLOR;
	if (force === "0" || force === "false") return 0;
	if (!isTTY && !force) return 0;
	if (env.TERM === "dumb" && !force) return 0;
	const ct = (env.COLORTERM ?? "").toLowerCase();
	if (ct === "truecolor" || ct === "24bit" || force === "3") return 3;
	const tp = env.TERM_PROGRAM ?? "";
	if (tp === "iTerm.app" || tp === "WezTerm" || tp === "ghostty" || tp === "vscode") return 3;
	if ((env.TERM ?? "").includes("256") || force === "2" || tp === "Apple_Terminal") return 2;
	return 1;
}
var level = detectColorLevel();
/** Override the detected colour level (tests, `--no-color`). */
function setColorLevel(l) {
	level = l;
}
function colorLevel() {
	return level;
}
function rgbTo256([r, g, b]) {
	if (r === g && g === b) {
		if (r < 8) return 16;
		if (r > 248) return 231;
		return Math.round((r - 8) / 247 * 24) + 232;
	}
	const q = (v) => Math.round(v / 255 * 5);
	return 16 + 36 * q(r) + 6 * q(g) + q(b);
}
function rgbTo16([r, g, b], bg) {
	const bright = Math.max(r, g, b) > 170;
	const bit = (v) => v > 110 ? 1 : 0;
	const idx = bit(r) | bit(g) << 1 | bit(b) << 2;
	return (bg ? 40 : 30) + idx + (bright ? 60 : 0);
}
var sgr = (open, close) => (s) => level === 0 || !s ? s : `\x1b[${open}m${s}\x1b[${close}m`;
function fgRgb(c) {
	return (s) => {
		if (level === 0 || !s) return s;
		return `\x1b[${level === 3 ? `38;2;${c[0]};${c[1]};${c[2]}` : level === 2 ? `38;5;${rgbTo256(c)}` : String(rgbTo16(c, false))}m${s}\x1b[39m`;
	};
}
function bgRgb(c) {
	return (s) => {
		if (level === 0 || !s) return s;
		return `\x1b[${level === 3 ? `48;2;${c[0]};${c[1]};${c[2]}` : level === 2 ? `48;5;${rgbTo256(c)}` : String(rgbTo16(c, true))}m${s}\x1b[49m`;
	};
}
var style = {
	bold: sgr("1", "22"),
	dim: sgr("2", "22"),
	italic: sgr("3", "23"),
	underline: sgr("4", "24"),
	inverse: sgr("7", "27"),
	strike: sgr("9", "29"),
	fg: fgRgb,
	bg: bgRgb
};
/**
* Olympus palette. One warm accent used sparingly; everything else is greys plus semantic colours.
* Components must use these roles instead of raw colours so the look stays consistent.
*/
var theme = {
	accent: fgRgb([
		238,
		106,
		62
	]),
	accentSoft: fgRgb([
		214,
		150,
		105
	]),
	text: (s) => s,
	muted: fgRgb([
		150,
		150,
		150
	]),
	subtle: fgRgb([
		105,
		105,
		105
	]),
	border: fgRgb([
		88,
		88,
		88
	]),
	success: fgRgb([
		110,
		200,
		120
	]),
	error: fgRgb([
		235,
		95,
		90
	]),
	warning: fgRgb([
		230,
		190,
		80
	]),
	info: fgRgb([
		110,
		170,
		235
	]),
	cream: fgRgb([
		255,
		247,
		240
	]),
	nightBg: bgRgb([
		24,
		17,
		16
	]),
	mode: {
		code: fgRgb([
			110,
			170,
			235
		]),
		plan: fgRgb([
			190,
			140,
			235
		]),
		auto: fgRgb([
			230,
			190,
			80
		])
	},
	diff: {
		addBg: bgRgb([
			24,
			58,
			32
		]),
		delBg: bgRgb([
			70,
			28,
			30
		]),
		addFg: fgRgb([
			130,
			215,
			140
		]),
		delFg: fgRgb([
			240,
			125,
			120
		]),
		gutter: fgRgb([
			105,
			105,
			105
		])
	},
	code: {
		keyword: fgRgb([
			200,
			140,
			235
		]),
		string: fgRgb([
			150,
			205,
			130
		]),
		number: fgRgb([
			235,
			170,
			100
		]),
		comment: fgRgb([
			110,
			115,
			125
		]),
		fn: fgRgb([
			110,
			175,
			240
		]),
		type: fgRgb([
			230,
			200,
			110
		]),
		punct: fgRgb([
			160,
			160,
			160
		]),
		inline: fgRgb([
			235,
			165,
			125
		])
	},
	md: {
		heading: (s) => style.bold(fgRgb([
			255,
			160,
			95
		])(s)),
		link: (s) => style.underline(fgRgb([
			110,
			170,
			235
		])(s)),
		quote: fgRgb([
			150,
			150,
			150
		]),
		bullet: fgRgb([
			255,
			138,
			61
		])
	}
};
var ANSI_RE = /\x1b\[[0-9;?:<=>]*[ -\/]*[@-~]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1b[@-Z\\-_]/g;
function stripAnsi(s) {
	return s.replace(ANSI_RE, "");
}
var inRanges = (cp, ranges) => {
	for (let i = 0; i < ranges.length; i += 2) {
		if (cp < ranges[i]) return false;
		if (cp <= ranges[i + 1]) return true;
	}
	return false;
};
var ZERO = [
	768,
	879,
	1155,
	1161,
	1425,
	1469,
	1552,
	1562,
	1611,
	1631,
	2304,
	2307,
	2362,
	2383,
	2385,
	2391,
	2402,
	2403,
	6832,
	6911,
	7616,
	7679,
	8203,
	8207,
	8232,
	8238,
	8288,
	8292,
	8400,
	8447,
	65024,
	65039,
	65056,
	65071,
	65279,
	65279,
	127995,
	127999,
	917504,
	921599
];
var WIDE = [
	4352,
	4447,
	8986,
	8987,
	9001,
	9002,
	9193,
	9196,
	9200,
	9200,
	9203,
	9203,
	9725,
	9726,
	9748,
	9749,
	9800,
	9811,
	9855,
	9855,
	9875,
	9875,
	9889,
	9889,
	9898,
	9899,
	9917,
	9918,
	9924,
	9925,
	9934,
	9934,
	9940,
	9940,
	9962,
	9962,
	9970,
	9971,
	9973,
	9973,
	9978,
	9978,
	9981,
	9981,
	9989,
	9989,
	9994,
	9995,
	10024,
	10024,
	10060,
	10060,
	10062,
	10062,
	10067,
	10069,
	10071,
	10071,
	10133,
	10135,
	10160,
	10160,
	10175,
	10175,
	11035,
	11036,
	11088,
	11088,
	11093,
	11093,
	11904,
	12350,
	12353,
	13311,
	13312,
	19903,
	19968,
	40959,
	40960,
	42191,
	43360,
	43391,
	44032,
	55203,
	63744,
	64255,
	65040,
	65049,
	65072,
	65135,
	65280,
	65376,
	65504,
	65510,
	94176,
	101119,
	110592,
	111359,
	126980,
	126980,
	127183,
	127183,
	127374,
	127374,
	127377,
	127386,
	127488,
	127569,
	127744,
	127776,
	127789,
	127797,
	127799,
	127868,
	127870,
	127891,
	127904,
	127946,
	127951,
	127955,
	127968,
	127984,
	127988,
	127988,
	127992,
	128062,
	128064,
	128064,
	128066,
	128252,
	128255,
	128317,
	128331,
	128334,
	128336,
	128359,
	128378,
	128378,
	128405,
	128406,
	128420,
	128420,
	128507,
	128591,
	128640,
	128709,
	128716,
	128716,
	128720,
	128722,
	128725,
	128727,
	128732,
	128735,
	128747,
	128748,
	128756,
	128764,
	128992,
	129003,
	129008,
	129008,
	129292,
	129338,
	129340,
	129349,
	129351,
	129535,
	129648,
	129791,
	131072,
	196605,
	196608,
	262141
];
/** Visible columns of one code point (0, 1 or 2). Control characters count as 0. */
function charWidth(cp) {
	if (cp < 32 || cp >= 127 && cp < 160) return 0;
	if (cp < 768) return 1;
	if (inRanges(cp, ZERO)) return 0;
	if (inRanges(cp, WIDE)) return 2;
	return 1;
}
/** Visible width of a string (ANSI escapes ignored). */
function strWidth(s) {
	let w = 0;
	for (const ch of stripAnsi(s)) w += charWidth(ch.codePointAt(0));
	return w;
}
function tokenize(s) {
	const out = [];
	const re = new RegExp(ANSI_RE.source, "g");
	let last = 0;
	let m;
	const pushText = (t) => {
		for (const ch of t) out.push({
			ch,
			w: charWidth(ch.codePointAt(0))
		});
	};
	while (m = re.exec(s)) {
		if (m.index > last) pushText(s.slice(last, m.index));
		out.push({ ansi: m[0] });
		last = m.index + m[0].length;
	}
	if (last < s.length) pushText(s.slice(last));
	return out;
}
/** SGR state tracker: remembers which styling is open so it can be closed and re-opened across line breaks. */
var SgrState = class SgrState {
	open = [];
	apply(seq) {
		if (!seq.startsWith("\x1B[") || !seq.endsWith("m")) return;
		const body = seq.slice(2, -1);
		if (body === "" || body === "0") this.open = [];
		else this.open.push(seq);
	}
	prefix() {
		return this.open.join("");
	}
	get active() {
		return this.open.length > 0;
	}
	clone() {
		const c = new SgrState();
		c.open = [...this.open];
		return c;
	}
};
var RESET = "\x1B[0m";
/**
* Word-wrap `s` (may contain ANSI styling and `\n`) to rows of at most `width` columns. Words longer than a row are
* hard-broken. Styling stays correct on every row (closed at the row end, re-opened on the next row).
*/
function wrapAnsi(s, width, opts = {}) {
	const rows = [];
	const firstIndent = opts.firstIndent ?? "";
	const indent = opts.indent ?? "";
	const state = new SgrState();
	const paragraphs = s.split("\n");
	let isFirstRow = true;
	for (const para of paragraphs) {
		const toks = tokenize(para);
		let lineToks = [];
		let lineW = 0;
		let lineState = state.clone();
		let lastSpace = -1;
		let stateAtSpace = null;
		const prefix = () => isFirstRow ? firstIndent : indent;
		const avail = () => Math.max(1, width - strWidth(prefix()));
		const emit = (toks, startState) => {
			let body = "";
			for (const t of toks) body += "ansi" in t ? t.ansi : t.ch;
			body = body.replace(/ +$/, "");
			const open = startState.prefix();
			const rowState = startState.clone();
			for (const t of toks) if ("ansi" in t) rowState.apply(t.ansi);
			const close = rowState.active || open ? RESET : "";
			rows.push(`${prefix()}${open}${body}${close}`);
			isFirstRow = false;
		};
		for (const t of toks) {
			if ("ansi" in t) {
				lineToks.push(t);
				state.apply(t.ansi);
				continue;
			}
			if (t.w === 0) {
				lineToks.push(t);
				continue;
			}
			if (lineW + t.w > avail()) {
				if (t.ch === " ") {
					emit(lineToks, lineState);
					lineToks = [];
					lineW = 0;
					lineState = state.clone();
					lastSpace = -1;
					continue;
				}
				if (lastSpace >= 0 && stateAtSpace) {
					const head = lineToks.slice(0, lastSpace);
					const tail = lineToks.slice(lastSpace + 1);
					emit(head, lineState);
					lineState = stateAtSpace;
					lineToks = tail;
					lineW = tail.reduce((a, x) => a + ("w" in x ? x.w : 0), 0);
				} else {
					emit(lineToks, lineState);
					lineToks = [];
					lineW = 0;
					lineState = state.clone();
				}
				lastSpace = -1;
				stateAtSpace = null;
				while (lineW + t.w > avail() && lineToks.length) {
					let acc = 0;
					let cut = 0;
					for (; cut < lineToks.length; cut++) {
						const x = lineToks[cut];
						const w = "w" in x ? x.w : 0;
						if (acc + w > avail()) break;
						acc += w;
					}
					if (cut === 0) cut = 1;
					const head = lineToks.slice(0, cut);
					emit(head, lineState);
					for (const x of head) if ("ansi" in x) lineState.apply(x.ansi);
					lineToks = lineToks.slice(cut);
					lineW = lineToks.reduce((a, x) => a + ("w" in x ? x.w : 0), 0);
				}
			}
			if (t.ch === " ") {
				lastSpace = lineToks.length;
				stateAtSpace = state.clone();
			}
			lineToks.push(t);
			lineW += t.w;
		}
		emit(lineToks, lineState);
	}
	return rows;
}
/** Cut `s` to at most `width` visible columns, appending `ellipsis` when something was cut. Styling is closed. */
function truncateAnsi(s, width, ellipsis = "…") {
	if (strWidth(s) <= width) return s;
	const ew = strWidth(ellipsis);
	const target = Math.max(0, width - ew);
	let out = "";
	let w = 0;
	let styled = false;
	for (const t of tokenize(s)) {
		if ("ansi" in t) {
			out += t.ansi;
			styled = true;
			continue;
		}
		if (w + t.w > target) break;
		out += t.ch;
		w += t.w;
	}
	return `${out}${styled ? RESET : ""}${width >= ew ? ellipsis : ""}`;
}
/** Pad with spaces to exactly `width` columns (truncating first if longer). */
function padEndAnsi(s, width) {
	const t = truncateAnsi(s, width);
	return t + " ".repeat(Math.max(0, width - strWidth(t)));
}
/** Terminal hyperlink (OSC 8) when colours are on; plain text otherwise. */
function hyperlink(text, url) {
	if (level === 0) return text;
	return `\x1b]8;;${url}\x07${text}\x1b]8;;\x07`;
}
/** Compact human formats used across the UI. */
function formatTokens(n) {
	if (n < 1e3) return String(n);
	if (n < 1e5) return `${(n / 1e3).toFixed(1)}k`;
	if (n < 1e6) return `${Math.round(n / 1e3)}k`;
	return `${(n / 1e6).toFixed(1)}M`;
}
function formatDuration(ms) {
	const s = Math.floor(ms / 1e3);
	if (s < 60) return `${s}s`;
	return `${Math.floor(s / 60)}m ${s % 60}s`;
}
function formatCost(usd) {
	if (usd <= 0) return "$0.00";
	if (usd < .01) return `$${usd.toFixed(4)}`;
	return `$${usd.toFixed(2)}`;
}
// src/tui/highlight.ts
var ESC_SEQ_RE = /\x1b\[[0-?]*[ -/]*[@-~]|\x1b\][^\x07\x1b\n]*(?:\x07|\x1b\\)?|\x1b[PX^_][^\x1b\n]*(?:\x1b\\)?|\x1b[ -/]*[0-~]?/g;
var CTRL_RE = /[\x00-\x08\x0b-\x1f\x7f-\x9f\u202a-\u202e\u2066-\u2069]/g;
var NEEDS_SANITIZE_RE = /[\x00-\x09\x0b-\x1f\x7f-\x9f\u202a-\u202e\u2066-\u2069]/;
/** Expand `\t` characters to `tab`-column stops using ANSI-free Unicode character widths. */
function expandTabs(s, tab = 4) {
	if (!s.includes("	")) return s;
	let out = "";
	let col = 0;
	for (const ch of s) if (ch === "	") {
		const n = tab - col % tab;
		out += " ".repeat(n);
		col += n;
	} else {
		out += ch;
		col += charWidth(ch.codePointAt(0));
	}
	return out;
}
/** Neutralise terminal escape sequences, control characters, and bidi overrides in one line, and expand tabs. */
function sanitizeLine(s, tab = 4) {
	if (!NEEDS_SANITIZE_RE.test(s) && !s.includes("\n")) return s;
	let t = s.includes("\x1B") ? s.replace(ESC_SEQ_RE, "") : s;
	t = t.replace(CTRL_RE, "").replace(/\n/g, "");
	return t.includes("	") ? expandTabs(t, tab) : t;
}
var ALIAS = {};
for (const [id, names] of [
	["ts", "ts typescript mts cts"],
	["tsx", "tsx"],
	["js", "js javascript mjs cjs node"],
	["jsx", "jsx"],
	["json", "json jsonc json5 jsonl"],
	["py", "py python python3 py3 pyw pyi"],
	["sh", "sh bash zsh ksh fish env"],
	["console", "console shell terminal shell-session shellsession sh-session"],
	["go", "go golang"],
	["rs", "rs rust"],
	["java", "java"],
	["kt", "kt kts kotlin"],
	["swift", "swift"],
	["c", "c h"],
	["cpp", "cpp c++ cc cxx hpp hh hxx"],
	["cs", "cs csharp c#"],
	["rb", "rb ruby gemfile"],
	["php", "php"],
	["sql", "sql psql mysql postgres postgresql sqlite plsql"],
	["yaml", "yaml yml"],
	["toml", "toml ini cfg"],
	["html", "html htm xhtml vue svelte"],
	["xml", "xml svg plist"],
	["css", "css scss less"],
	["md", "md markdown mdx"],
	["diff", "diff patch"],
	["dockerfile", "dockerfile docker containerfile"],
	["makefile", "makefile make mk gnumakefile"]
]) for (const n of names.split(" ")) ALIAS[n] = id;
var KNOWN = new Set(Object.values(ALIAS));
/** Resolve a canonical language identifier from a file path or markdown code-fence info string. */
function languageFor(pathOrInfo) {
	let t = (pathOrInfo ?? "").trim().replace(/^[`~]+/, "").trim();
	t = (t.split(/[\s,]/)[0] ?? "").replace(/^\{?\.?/, "").replace(/\}$/, "").replace(/^language-/i, "");
	if (!t) return void 0;
	const lower = t.toLowerCase();
	if (ALIAS[lower]) return ALIAS[lower];
	const base = lower.split(/[\\/]/).pop() ?? lower;
	if (ALIAS[base]) return ALIAS[base];
	if (base.startsWith("dockerfile") || base.endsWith(".dockerfile") || base.startsWith("containerfile")) return "dockerfile";
	if (base.startsWith("makefile")) return "makefile";
	if (base === ".bashrc" || base === ".zshrc" || base === ".profile" || base.startsWith(".env")) return "sh";
	const dot = base.lastIndexOf(".");
	return dot >= 0 ? ALIAS[base.slice(dot + 1)] : void 0;
}
var Out = class {
	out = "";
	paint = null;
	buf = "";
	push(p, text) {
		if (!text) return;
		if (p !== this.paint) {
			this.flush();
			this.paint = p;
		}
		this.buf += text;
	}
	flush() {
		if (this.buf) this.out += this.paint ? this.paint(this.buf) : this.buf;
		this.buf = "";
	}
	done() {
		this.flush();
		return this.out;
	}
};
var CODE = { mode: "code" };
var words = (s) => new Set(s.split(/\s+/).filter(Boolean));
var IDENT = /[A-Za-z_]\w*/y;
var IDENT_JS = /[A-Za-z_$][\w$]*/y;
var NUMBER = /(?:0[xX][\da-fA-F_]+|0[bB][01_]+|0[oO][0-7_]+|(?:\d[\d_]*(?:\.\d[\d_]*)?|\.\d[\d_]*)(?:[eE][+-]?\d+)?)[a-zA-Z%]*/y;
var PUNCT = new Set("{}[]()<>;,.:=+-*/%!&|^~?@#\\".split(""));
var DEF_FN = words("def function fn func fun sub");
var DEF_TYPE = words("class struct interface enum trait type impl record object protocol extension union namespace module");
var P = {
	kw: theme.code.keyword,
	str: theme.code.string,
	num: theme.code.number,
	com: theme.code.comment,
	fn: theme.code.fn,
	type: theme.code.type,
	punct: theme.code.punct,
	muted: theme.muted,
	bright: style.bold,
	add: theme.diff.addFg,
	del: theme.diff.delFg,
	info: theme.info
};
function findStrEnd(line, from, delim, raw) {
	for (let i = from; i < line.length; i++) {
		if (!raw && line[i] === "\\") {
			i++;
			continue;
		}
		if (line.startsWith(delim, i)) return i + delim.length;
	}
	return -1;
}
function nextNonSpace(line, j) {
	while (j < line.length && line[j] === " ") j++;
	return line[j] ?? "";
}
function pushTemplateStr(o, seg, def) {
	if (!seg.includes("${")) {
		o.push(P.str, seg);
		return;
	}
	const re = /\$\{([^}`]*)\}/g;
	let last = 0;
	let m;
	while (m = re.exec(seg)) {
		o.push(P.str, seg.slice(last, m.index));
		o.push(P.punct, "${");
		scanC(m[1], def, CODE, o);
		o.push(P.punct, "}");
		last = m.index + m[0].length;
	}
	o.push(P.str, seg.slice(last));
}
function execAt(re, line, idx) {
	re.lastIndex = idx;
	return re.exec(line)?.[0] ?? null;
}
function scanC(line, def, state, o, start = 0) {
	let i = start;
	const n = line.length;
	let pending = null;
	if (state.mode === "comment") {
		const idx = line.indexOf(state.end, i);
		if (idx < 0) {
			o.push(P.com, line.slice(i));
			return state;
		}
		o.push(P.com, line.slice(i, idx + state.end.length));
		i = idx + state.end.length;
		state = CODE;
	} else if (state.mode === "string") {
		const end = findStrEnd(line, i, state.end, !!state.raw);
		const emit = (s) => state.end === "`" && !state.raw ? pushTemplateStr(o, s, def) : o.push(P.str, s);
		if (end < 0) {
			emit(line.slice(i));
			return state;
		}
		emit(line.slice(i, end));
		i = end;
		state = CODE;
	}
	const firstNonSpace = line.search(/\S/);
	outer: while (i < n) {
		const c = line[i];
		if (c === " ") {
			let j = i + 1;
			while (j < n && line[j] === " ") j++;
			o.push(null, line.slice(i, j));
			i = j;
			continue;
		}
		for (const lc of def.line) if (line.startsWith(lc, i) && (!def.commentNeedsSpace || i === 0 || line[i - 1] === " ")) {
			o.push(P.com, line.slice(i));
			return state;
		}
		for (const [open, close] of def.block) if (line.startsWith(open, i)) {
			const idx = line.indexOf(close, i + open.length);
			if (idx < 0) {
				o.push(P.com, line.slice(i));
				return {
					mode: "comment",
					end: close
				};
			}
			o.push(P.com, line.slice(i, idx + close.length));
			i = idx + close.length;
			continue outer;
		}
		for (const q of def.str) if (line.startsWith(q, i)) {
			const raw = !!def.raw?.has(q);
			const isTpl = q === "`" && !raw;
			const end = findStrEnd(line, i + q.length, q, raw);
			if (end < 0) {
				if (isTpl) pushTemplateStr(o, line.slice(i), def);
				else o.push(P.str, line.slice(i));
				return def.ml.has(q) ? {
					mode: "string",
					end: q,
					raw
				} : state;
			}
			const s = line.slice(i, end);
			if (isTpl) pushTemplateStr(o, s, def);
			else o.push(def.keys && nextNonSpace(line, end) === ":" ? P.fn : P.str, s);
			i = end;
			continue outer;
		}
		if (def.hash && c === "#" && i === firstNonSpace) {
			const r = execAt(/#\s*[A-Za-z_]+/y, line, i);
			if (r) {
				o.push(P.kw, r);
				i += r.length;
				if (/include|import/.test(r)) {
					o.push(P.str, line.slice(i));
					return state;
				}
				continue;
			}
		}
		if (c >= "0" && c <= "9" || c === "." && line[i + 1] >= "0" && line[i + 1] <= "9") {
			const r = execAt(NUMBER, line, i);
			if (r) {
				o.push(P.num, r);
				i += r.length;
				continue;
			}
		}
		if (def.dollar && c === "$") {
			const r = execAt(IDENT, line, i + 1);
			if (r) {
				o.push(P.type, `$${r}`);
				i += 1 + r.length;
				continue;
			}
		}
		if (def.at && c === "@") {
			const r = execAt(/@[A-Za-z_][\w.]*/y, line, i);
			if (r) {
				o.push(P.type, r);
				i += r.length;
				continue;
			}
		}
		if (def.symbols && c === ":" && line[i + 1] !== ":" && (i === 0 || !/[\w:]/.test(line[i - 1]))) {
			const r = execAt(IDENT, line, i + 1);
			if (r) {
				o.push(P.num, `:${r}`);
				i += 1 + r.length;
				continue;
			}
		}
		const w = execAt(def.ident, line, i);
		if (w) {
			const end = i + w.length;
			if (def.strPrefix?.test(w) && (line[end] === "\"" || line[end] === "'")) {
				o.push(P.str, w);
				i = end;
				continue;
			}
			const key = def.ci ? w.toLowerCase() : w;
			let p = null;
			if (i > 0 && line[i - 1] === ".") {
				pending = null;
				if (nextNonSpace(line, end) === "(") p = P.fn;
			} else if (pending) {
				p = pending === "fn" ? P.fn : P.type;
				pending = null;
			} else if (def.kw.has(key)) {
				p = P.kw;
				pending = DEF_FN.has(key) ? "fn" : DEF_TYPE.has(key) ? "type" : null;
			} else if (def.lit.has(key)) p = P.num;
			else if (def.types.has(key)) p = P.type;
			else {
				const nx = nextNonSpace(line, end);
				if (nx === "(") p = P.fn;
				else if (def.bang && line[end] === "!" && /[([{]/.test(line[end + 1] ?? "")) {
					o.push(P.fn, `${w}!`);
					i = end + 1;
					continue;
				} else if (def.cssProps && nx === ":" && !/\{\s*$/.test(line)) p = P.fn;
				else if (def.pascal && w.length > 1 && w[0] >= "A" && w[0] <= "Z" && /[a-z]/.test(w)) p = P.type;
			}
			o.push(p, w);
			i = end;
			continue;
		}
		if (PUNCT.has(c)) {
			o.push(P.punct, c);
			if (pending && c !== "*" && c !== "&") pending = null;
		} else o.push(null, c);
		i++;
	}
	return state;
}
var mk = (p) => ({
	lit: /* @__PURE__ */ new Set(),
	types: /* @__PURE__ */ new Set(),
	line: ["//"],
	block: [["/*", "*/"]],
	str: ["\"", "'"],
	ml: /* @__PURE__ */ new Set(),
	ident: IDENT,
	pascal: true,
	...p,
	kw: words(p.kw)
});
var JS_KW = "break case catch class const continue debugger default delete do else export extends finally for function if import in instanceof let new return super switch this throw try typeof var void while with yield async await of static from as";
var TS_KW = `${JS_KW} interface type enum implements namespace declare readonly private protected public abstract keyof infer is satisfies module override unique asserts`;
var JS_LIT = words("true false null undefined NaN Infinity");
var C_KW = "auto break case char const continue default do double else enum extern float for goto if inline int long register restrict return short signed sizeof static struct switch typedef union unsigned void volatile while";
var DEFS = {
	js: mk({
		kw: JS_KW,
		lit: JS_LIT,
		str: [
			"\"",
			"'",
			"`"
		],
		ml: /* @__PURE__ */ new Set(["`"]),
		ident: IDENT_JS,
		at: true
	}),
	ts: mk({
		kw: TS_KW,
		lit: JS_LIT,
		types: words("string number boolean any unknown never object symbol bigint"),
		str: [
			"\"",
			"'",
			"`"
		],
		ml: /* @__PURE__ */ new Set(["`"]),
		ident: IDENT_JS,
		at: true
	}),
	json: mk({
		kw: "",
		lit: words("true false null"),
		str: ["\""],
		keys: true,
		pascal: false
	}),
	py: mk({
		kw: "and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield match case",
		lit: words("True False None"),
		types: words("int str float bool list dict set tuple bytes object self cls"),
		line: ["#"],
		block: [],
		str: [
			"\"\"\"",
			"'''",
			"\"",
			"'"
		],
		ml: /* @__PURE__ */ new Set(["\"\"\"", "'''"]),
		at: true,
		strPrefix: /^[rRbBuUfF]{1,2}$/
	}),
	go: mk({
		kw: "break case chan const continue default defer else fallthrough for func go goto if import interface map package range return select struct switch type var",
		lit: words("true false nil iota"),
		types: words("int int8 int16 int32 int64 uint uint8 uint16 uint32 uint64 uintptr float32 float64 complex64 complex128 string bool byte rune error any"),
		str: [
			"\"",
			"'",
			"`"
		],
		ml: /* @__PURE__ */ new Set(["`"]),
		raw: /* @__PURE__ */ new Set(["`"])
	}),
	rs: mk({
		kw: "as async await break const continue crate dyn else enum extern fn for if impl in let loop match mod move mut pub ref return self Self static struct super trait type unsafe use where while",
		lit: words("true false None Some Ok Err"),
		types: words("i8 i16 i32 i64 i128 isize u8 u16 u32 u64 u128 usize f32 f64 bool char str String Vec Option Result Box"),
		str: ["\""],
		bang: true,
		strPrefix: /^b?r?$/
	}),
	java: mk({
		kw: "abstract assert break case catch class const continue default do else enum extends final finally for goto if implements import instanceof interface native new package private protected public return static strictfp super switch synchronized this throw throws transient try volatile while var record yield sealed permits",
		lit: words("true false null"),
		types: words("boolean byte char double float int long short void"),
		str: [
			"\"\"\"",
			"\"",
			"'"
		],
		ml: /* @__PURE__ */ new Set(["\"\"\""]),
		at: true
	}),
	kt: mk({
		kw: "as break class continue do else for fun if in interface is object package return super this throw try typealias typeof val var when while by catch constructor finally get import init set where actual abstract annotation companion const crossinline data enum expect external final infix inline inner internal lateinit noinline open operator out override private protected public reified sealed suspend tailrec vararg",
		lit: words("true false null"),
		str: [
			"\"\"\"",
			"\"",
			"'"
		],
		ml: /* @__PURE__ */ new Set(["\"\"\""]),
		at: true
	}),
	swift: mk({
		kw: "associatedtype class deinit enum extension fileprivate func import init inout internal let open operator private protocol public rethrows static struct subscript typealias var break case continue default defer do else fallthrough for guard if in repeat return switch where while as catch is super self Self throw throws try async await some any",
		lit: words("true false nil"),
		str: ["\"\"\"", "\""],
		ml: /* @__PURE__ */ new Set(["\"\"\""]),
		at: true
	}),
	c: mk({
		kw: C_KW,
		lit: words("NULL true false"),
		hash: true,
		pascal: false
	}),
	cpp: mk({
		kw: `${C_KW} alignas alignof and asm bool catch class constexpr const_cast decltype delete dynamic_cast explicit export friend mutable namespace new noexcept nullptr operator or private protected public reinterpret_cast static_assert static_cast template this thread_local throw try typeid typename using virtual wchar_t override final co_await co_return co_yield concept requires`,
		lit: words("true false nullptr NULL"),
		hash: true
	}),
	cs: mk({
		kw: "abstract as base break case catch checked class const continue default delegate do else enum event explicit extern finally fixed for foreach goto if implicit in interface internal is lock namespace new operator out override params private protected public readonly ref return sealed sizeof stackalloc static struct switch this throw try typeof unchecked unsafe using virtual volatile while var async await record init get set yield where when",
		lit: words("true false null"),
		types: words("bool byte char decimal double float int long object sbyte short string uint ulong ushort void dynamic"),
		hash: true
	}),
	rb: mk({
		kw: "alias and begin break case class def defined do else elsif end ensure for if in module next not or redo rescue retry return super then undef unless until when while yield require require_relative attr_accessor attr_reader attr_writer include extend private protected public lambda proc",
		lit: words("true false nil self"),
		line: ["#"],
		block: [],
		ident: /[A-Za-z_]\w*[?!]?/y,
		symbols: true
	}),
	php: mk({
		kw: "abstract and array as break callable case catch class clone const continue declare default do echo else elseif empty enddeclare endfor endforeach endif endswitch endwhile extends final finally fn for foreach function global goto if implements include include_once instanceof insteadof interface isset list match namespace new or print private protected public readonly require require_once return static switch throw trait try unset use var while yield",
		lit: words("true false null TRUE FALSE NULL"),
		line: ["//", "#"],
		dollar: true
	}),
	sql: mk({
		kw: "select from where insert into values update set delete create table drop alter add column index primary key foreign references join inner left right outer full cross on as and or not is in exists between like ilike limit offset order by group having distinct union all case when then else end begin commit rollback transaction view with returning default unique check constraint if replace cascade asc desc grant revoke database schema trigger function procedure language returns declare using natural over partition window",
		lit: words("null true false"),
		types: words("int integer bigint smallint text varchar char boolean bool date time timestamp timestamptz numeric decimal real float double serial bigserial json jsonb uuid blob bytea"),
		line: ["--"],
		str: ["'", "\""],
		ci: true,
		pascal: false
	}),
	css: mk({
		kw: "important from to and not only",
		line: [],
		ident: /-{0,2}[A-Za-z_][\w-]*/y,
		cssProps: true,
		pascal: false,
		at: true
	}),
	value: mk({
		kw: "",
		lit: words("true false null yes no on off True False Null ~"),
		line: ["#"],
		block: [],
		str: [
			"\"\"\"",
			"'''",
			"\"",
			"'"
		],
		ml: /* @__PURE__ */ new Set(["\"\"\"", "'''"]),
		commentNeedsSpace: true,
		pascal: false
	})
};
DEFS.tsx = DEFS.ts;
DEFS.jsx = DEFS.js;
var SH_KW = words("if then else elif fi for while until do done case esac in function return exit local export readonly declare unset shift source alias set trap break continue select time");
var SH_CMD_AFTER = words("then do else elif if while until time !");
var SH_WORD = /[^\s|&;()<>"'`$\\]+/y;
var SH_VAR = /\$(?:\{[^}]*\}|[A-Za-z_]\w*|[@#?$!*0-9-])/y;
var PROMPT_RE = /^(\s*(?:[$%❯›]|>(?!>)) )/;
var DOCKER_INS = words("FROM RUN CMD LABEL MAINTAINER EXPOSE ENV ADD COPY ENTRYPOINT VOLUME USER WORKDIR ARG ONBUILD STOPSIGNAL HEALTHCHECK SHELL AS");
var DOCKER_SH = words("RUN CMD ENTRYPOINT SHELL");
function scanSh(line, state, o, start = 0, cmdPosStart = true, cmdPaint = P.fn) {
	let i = start;
	const n = line.length;
	let cmdPos = cmdPosStart;
	if (state.mode === "string") {
		const end = findStrEnd(line, i, state.end, !!state.raw);
		if (end < 0) {
			o.push(P.str, line.slice(i));
			return state;
		}
		o.push(P.str, line.slice(i, end));
		i = end;
		state = CODE;
		cmdPos = false;
	}
	while (i < n) {
		const c = line[i];
		if (c === " ") {
			let j = i + 1;
			while (j < n && line[j] === " ") j++;
			o.push(null, line.slice(i, j));
			i = j;
			continue;
		}
		if (c === "#" && (i === 0 || line[i - 1] === " ")) {
			o.push(P.com, line.slice(i));
			return state;
		}
		if (c === "\"" || c === "'") {
			const raw = c === "'";
			const end = findStrEnd(line, i + 1, c, raw);
			if (end < 0) {
				o.push(P.str, line.slice(i));
				return {
					mode: "string",
					end: c,
					raw
				};
			}
			o.push(P.str, line.slice(i, end));
			i = end;
			cmdPos = false;
			continue;
		}
		if (c === "$") {
			if (line[i + 1] === "(") {
				o.push(P.punct, "$(");
				i += 2;
				cmdPos = true;
				continue;
			}
			const r = execAt(SH_VAR, line, i);
			if (r) {
				o.push(P.type, r);
				i += r.length;
				continue;
			}
		}
		if (c === "\\") {
			o.push(P.punct, line.slice(i, i + 2));
			i += 2;
			continue;
		}
		if ("|&;()`".includes(c)) {
			o.push(P.punct, c);
			cmdPos = c !== ")";
			i++;
			continue;
		}
		if (c === "<" || c === ">") {
			o.push(P.punct, c);
			i++;
			continue;
		}
		const w = execAt(SH_WORD, line, i);
		if (!w) {
			o.push(null, c);
			i++;
			continue;
		}
		if (cmdPos) {
			const asg = /^([A-Za-z_]\w*)=/.exec(w);
			if (asg) {
				o.push(P.type, asg[1]);
				o.push(P.punct, "=");
				o.push(null, w.slice(asg[0].length));
			} else if (SH_KW.has(w)) {
				o.push(P.kw, w);
				cmdPos = SH_CMD_AFTER.has(w);
			} else {
				o.push(cmdPaint, w);
				cmdPos = false;
			}
		} else if (w === "in" || w === "do" || w === "then") {
			o.push(P.kw, w);
			cmdPos = w !== "in";
		} else if (w.startsWith("-")) o.push(P.punct, w);
		else if (/^\d+$/.test(w)) o.push(P.num, w);
		else o.push(null, w);
		i += w.length;
	}
	return state;
}
function scanHtml(line, state, o) {
	let i = 0;
	const n = line.length;
	while (i < n) {
		if (state.mode === "comment") {
			const idx = line.indexOf("-->", i);
			if (idx < 0) {
				o.push(P.com, line.slice(i));
				return state;
			}
			o.push(P.com, line.slice(i, idx + 3));
			i = idx + 3;
			state = CODE;
			continue;
		}
		if (state.mode === "tag") {
			const c = line[i];
			if (c === " ") {
				o.push(null, c);
				i++;
			} else if (line.startsWith("/>", i)) {
				o.push(P.punct, "/>");
				i += 2;
				state = CODE;
			} else if (c === ">" || c === "?" && line[i + 1] === ">") {
				const t = c === ">" ? ">" : "?>";
				o.push(P.punct, t);
				i += t.length;
				state = CODE;
			} else if (c === "\"" || c === "'") {
				const end = line.indexOf(c, i + 1);
				const e = end < 0 ? n : end + 1;
				o.push(P.str, line.slice(i, e));
				i = e;
			} else if (c === "=") {
				o.push(P.punct, c);
				i++;
			} else {
				const t = execAt(/[^\s=>/"']+/y, line, i) ?? c;
				o.push(P.fn, t);
				i += t.length;
			}
			continue;
		}
		if (line.startsWith("<!--", i)) {
			state = {
				mode: "comment",
				end: "-->"
			};
			continue;
		}
		if (line[i] === "<") {
			const m = /^<(\/?)([A-Za-z!?][\w:.-]*)/.exec(line.slice(i));
			if (m) {
				o.push(P.punct, `<${m[1]}`);
				o.push(P.kw, m[2]);
				i += m[0].length;
				state = { mode: "tag" };
				continue;
			}
		}
		if (line[i] === "&") {
			const r = execAt(/&#?\w+;/y, line, i);
			if (r) {
				o.push(P.num, r);
				i += r.length;
				continue;
			}
		}
		let j = i + 1;
		while (j < n && line[j] !== "<" && line[j] !== "&") j++;
		o.push(null, line.slice(i, j));
		i = j;
	}
	return state;
}
function scanMd(line, state, o) {
	const fence = /^\s{0,3}(```|~~~)/.test(line);
	if (state.mode === "fence") {
		o.push(fence ? P.com : P.str, line);
		return fence ? CODE : state;
	}
	if (fence) {
		o.push(P.com, line);
		return { mode: "fence" };
	}
	if (/^\s{0,3}#{1,6}(\s|$)/.test(line)) {
		o.push(P.kw, line);
		return state;
	}
	if (/^\s{0,3}>/.test(line)) {
		o.push(P.com, line);
		return state;
	}
	const m = /^(\s*)([-*+]|\d+[.)])(\s+)/.exec(line);
	let i = 0;
	if (m) {
		o.push(null, m[1]);
		o.push(P.punct, m[2]);
		o.push(null, m[3]);
		i = m[0].length;
	}
	while (i < line.length) {
		const tick = line.indexOf("`", i);
		const close = tick >= 0 ? line.indexOf("`", tick + 1) : -1;
		if (close < 0) break;
		o.push(null, line.slice(i, tick));
		o.push(P.str, line.slice(tick, close + 1));
		i = close + 1;
	}
	o.push(null, line.slice(i));
	return state;
}
function scanDiff(line, o) {
	if (/^(\+\+\+|---)( |$)/.test(line) || /^(diff |index |new file|deleted file|similarity|rename )/.test(line)) o.push(P.muted, line);
	else if (line.startsWith("@@")) {
		const end = line.indexOf("@@", 2);
		const cut = end < 0 ? line.length : end + 2;
		o.push(P.info, line.slice(0, cut));
		o.push(P.muted, line.slice(cut));
	} else if (line.startsWith("+")) o.push(P.add, line);
	else if (line.startsWith("-")) o.push(P.del, line);
	else if (line.startsWith("\\")) o.push(P.muted, line);
	else o.push(null, line);
}
/** Syntax-highlight `code`, returning one ANSI-styled string per source line (unwrapped). */
function highlightCode(code, lang) {
	const lines = code.replace(/\r\n?/g, "\n").split("\n").map((l) => sanitizeLine(l));
	if (!lang || colorLevel() === 0) return lines;
	const id = KNOWN.has(lang) ? lang : languageFor(lang);
	if (!id) return lines;
	const out = new Array(lines.length);
	let state = CODE;
	if (id === "console") {
		const hasPrompt = lines.some((l) => PROMPT_RE.test(l));
		let cont = false;
		for (let k = 0; k < lines.length; k++) {
			const l = lines[k];
			const o = new Out();
			const m = PROMPT_RE.exec(l);
			if (m || !hasPrompt || cont || state.mode === "string") {
				if (m) o.push(P.muted, m[1]);
				state = scanSh(l, state, o, m ? m[1].length : 0, !cont, m ? P.bright : P.fn);
				cont = l.endsWith("\\");
			} else o.push(P.muted, l);
			out[k] = o.done();
		}
		return out;
	}
	for (let k = 0; k < lines.length; k++) {
		const l = lines[k];
		const o = new Out();
		if (id === "sh") {
			const m = state.mode === "code" ? PROMPT_RE.exec(l) : null;
			if (m) o.push(P.muted, m[1]);
			state = scanSh(l, state, o, m ? m[1].length : 0, true, m ? P.bright : P.fn);
		} else if (id === "diff") scanDiff(l, o);
		else if (id === "md") state = scanMd(l, state, o);
		else if (id === "html" || id === "xml") state = scanHtml(l, state, o);
		else if (id === "yaml" && state.mode === "code") {
			const kv = /^(\s*(?:-\s+)?)("[^"]*"|'[^']*'|[^\s#'"\-:][^:#]*?|-[^\s:#][^:#]*?)(\s*:)(?=\s|$)/.exec(l);
			const li = !kv ? /^(\s*)(-)(\s)/.exec(l) : null;
			if (/^(---|\.\.\.)\s*$/.test(l)) o.push(P.punct, l);
			else if (kv) {
				const dash = kv[1].indexOf("-");
				if (dash >= 0) {
					o.push(null, kv[1].slice(0, dash));
					o.push(P.punct, "-");
					o.push(null, kv[1].slice(dash + 1));
				} else o.push(null, kv[1]);
				o.push(P.fn, kv[2]);
				o.push(P.punct, kv[3]);
				state = scanC(l, DEFS.value, state, o, kv[0].length);
			} else if (li) {
				o.push(null, li[1]);
				o.push(P.punct, "-");
				o.push(null, li[3]);
				state = scanC(l, DEFS.value, state, o, li[0].length);
			} else state = scanC(l, DEFS.value, state, o);
		} else if (id === "toml" && state.mode === "code") {
			const sec = /^\s*\[\[?[^\]]*\]\]?/.exec(l);
			const kv = !sec ? /^(\s*)([\w.\-"']+?)(\s*=)/.exec(l) : null;
			if (sec) {
				o.push(P.type, sec[0]);
				state = scanC(l, DEFS.value, state, o, sec[0].length);
			} else if (kv) {
				o.push(null, kv[1]);
				o.push(P.fn, kv[2]);
				o.push(P.punct, kv[3]);
				state = scanC(l, DEFS.value, state, o, kv[0].length);
			} else state = scanC(l, DEFS.value, state, o);
		} else if (id === "yaml" || id === "toml") state = scanC(l, DEFS.value, state, o);
		else if (id === "dockerfile") {
			const m = state.mode === "code" ? /^(\s*)([A-Za-z]+)(?=\s|$)/.exec(l) : null;
			if (state.mode === "code" && /^\s*#/.test(l)) o.push(P.com, l);
			else if (m && DOCKER_INS.has(m[2].toUpperCase())) {
				o.push(null, m[1]);
				o.push(P.kw, m[2]);
				state = scanSh(l, state, o, m[0].length, DOCKER_SH.has(m[2].toUpperCase()));
			} else state = scanSh(l, state, o, 0, false);
		} else if (id === "makefile") {
			const asg = state.mode === "code" ? /^([\w.\-]+)(\s*(?::=|::=|\+=|\?=|=))/.exec(l) : null;
			const tgt = !asg && state.mode === "code" ? /^([^\s:=#][^:=#]*?)(::?)(?!=)/.exec(l) : null;
			if (state.mode === "code" && /^\s*#/.test(l)) o.push(P.com, l);
			else if (state.mode === "code" && /^\s/.test(l)) state = scanSh(l, state, o, 0, true);
			else if (asg) {
				o.push(P.type, asg[1]);
				o.push(P.punct, asg[2]);
				state = scanSh(l, state, o, asg[0].length, false);
			} else if (tgt) {
				o.push(P.fn, tgt[1]);
				o.push(P.punct, tgt[2]);
				state = scanSh(l, state, o, tgt[0].length, false);
			} else state = scanSh(l, state, o, 0, false);
		} else {
			const def = DEFS[id];
			if (!def) o.push(null, l);
			else state = scanC(l, def, state, o);
		}
		out[k] = o.done();
	}
	return out;
}
// src/tui/diff.ts
var MAX_MYERS_LINES = 4e3;
var ANSI_TOKEN_RE = /\x1b\[[0-9;?:<=>]*[ -/]*[@-~]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1b[@-Z\\-_]/g;
function splitSrc(s) {
	if (!s) return [];
	const norm = s.replace(/\r\n/g, "\n");
	if (norm.endsWith("\n")) return norm.slice(0, -1).split("\n").map((text) => ({
		raw: `${text}\n`,
		text
	}));
	const parts = norm.split("\n");
	return parts.map((text, idx) => ({
		raw: idx < parts.length - 1 ? `${text}\n` : text,
		text
	}));
}
/** Myers O(ND) shortest-edit-script over `a` and `b`. */
function myersOps(a, b) {
	const n = a.length;
	const m = b.length;
	const max = n + m;
	const v = new Int32Array(2 * max + 1);
	const trace = [];
	let endD = max;
	outer: for (let d = 0; d <= max; d++) {
		trace.push(v.slice(max - d, max + d + 1));
		for (let k = -d; k <= d; k += 2) {
			let x = k === -d || k !== d && v[max + k - 1] < v[max + k + 1] ? v[max + k + 1] : v[max + k - 1] + 1;
			let y = x - k;
			while (x < n && y < m && a[x].raw === b[y].raw) {
				x++;
				y++;
			}
			v[max + k] = x;
			if (x >= n && y >= m) {
				endD = d;
				break outer;
			}
		}
	}
	const rev = [];
	let x = n;
	let y = m;
	for (let d = endD; d > 0; d--) {
		const vp = trace[d];
		const k = x - y;
		const prevK = k === -d || k !== d && vp[k - 1 + d] < vp[k + 1 + d] ? k + 1 : k - 1;
		const prevX = vp[prevK + d];
		const prevY = prevX - prevK;
		while (x > prevX && y > prevY) {
			x--;
			y--;
			rev.push({
				kind: "ctx",
				aIdx: x,
				bIdx: y
			});
		}
		if (x === prevX) {
			y--;
			rev.push({
				kind: "add",
				bIdx: y
			});
		} else {
			x--;
			rev.push({
				kind: "del",
				aIdx: x
			});
		}
	}
	while (x > 0 && y > 0) {
		x--;
		y--;
		rev.push({
			kind: "ctx",
			aIdx: x,
			bIdx: y
		});
	}
	rev.reverse();
	return rev;
}
/** Order contiguous change runs as deletions followed by additions for clean unified-diff hunks. */
function normalizeChangeRuns(ops) {
	const out = [];
	let i = 0;
	while (i < ops.length) {
		if (ops[i].kind === "ctx") {
			out.push(ops[i++]);
			continue;
		}
		const dels = [];
		const adds = [];
		while (i < ops.length && ops[i].kind !== "ctx") {
			if (ops[i].kind === "del") dels.push(ops[i]);
			else adds.push(ops[i]);
			i++;
		}
		out.push(...dels, ...adds);
	}
	return out;
}
function fullEditList(a, b) {
	let pre = 0;
	while (pre < a.length && pre < b.length && a[pre].raw === b[pre].raw) pre++;
	if (pre === a.length && pre === b.length) return [];
	let suf = 0;
	while (pre < a.length - suf && pre < b.length - suf && a[a.length - 1 - suf].raw === b[b.length - 1 - suf].raw) suf++;
	const aMid = a.slice(pre, a.length - suf);
	const bMid = b.slice(pre, b.length - suf);
	let midOps;
	if (aMid.length === 0) midOps = bMid.map((_, j) => ({
		kind: "add",
		bIdx: j
	}));
	else if (bMid.length === 0) midOps = aMid.map((_, i) => ({
		kind: "del",
		aIdx: i
	}));
	else if (aMid.length + bMid.length > MAX_MYERS_LINES) midOps = [...aMid.map((_, i) => ({
		kind: "del",
		aIdx: i
	})), ...bMid.map((_, j) => ({
		kind: "add",
		bIdx: j
	}))];
	else midOps = normalizeChangeRuns(myersOps(aMid, bMid));
	const all = [];
	for (let i = 0; i < pre; i++) all.push({
		kind: "ctx",
		text: a[i].text,
		oldNo: i + 1,
		newNo: i + 1
	});
	for (const op of midOps) if (op.kind === "ctx") {
		const oi = pre + op.aIdx;
		const ni = pre + op.bIdx;
		all.push({
			kind: "ctx",
			text: a[oi].text,
			oldNo: oi + 1,
			newNo: ni + 1
		});
	} else if (op.kind === "del") {
		const oi = pre + op.aIdx;
		all.push({
			kind: "del",
			text: a[oi].text,
			oldNo: oi + 1
		});
	} else {
		const ni = pre + op.bIdx;
		all.push({
			kind: "add",
			text: b[ni].text,
			newNo: ni + 1
		});
	}
	const aSufStart = a.length - suf;
	const bSufStart = b.length - suf;
	for (let i = 0; i < suf; i++) all.push({
		kind: "ctx",
		text: a[aSufStart + i].text,
		oldNo: aSufStart + i + 1,
		newNo: bSufStart + i + 1
	});
	return all;
}
/**
* Line diff of two texts with `context` unchanged lines around each change (default 2).
* Unchanged runs between hunks beyond `context` collapse into a single `{ kind: 'gap', text: '' }` entry.
*/
function diffLines(oldText, newText, context = 2) {
	const all = fullEditList(splitSrc(oldText), splitSrc(newText));
	if (all.length === 0) return [];
	const ctx = Math.max(0, Math.floor(context));
	const keep = new Uint8Array(all.length);
	let first = -1;
	let last = -1;
	for (let i = 0; i < all.length; i++) {
		if (all[i].kind === "ctx") continue;
		const lo = Math.max(0, i - ctx);
		const hi = Math.min(all.length - 1, i + ctx);
		if (first < 0 || lo < first) first = lo;
		if (hi > last) last = hi;
		for (let j = lo; j <= hi; j++) keep[j] = 1;
	}
	if (first < 0) return [];
	const out = [];
	let inGap = false;
	for (let i = first; i <= last; i++) if (keep[i]) {
		out.push(all[i]);
		inGap = false;
	} else if (!inGap) {
		out.push({
			kind: "gap",
			text: ""
		});
		inGap = true;
	}
	return out;
}
/**
* Count added and removed lines between `oldText` and `newText`.
*/
function diffStats(oldText, newText) {
	const lines = diffLines(oldText, newText, 0);
	let added = 0;
	let removed = 0;
	for (const l of lines) if (l.kind === "add") added++;
	else if (l.kind === "del") removed++;
	return {
		added,
		removed
	};
}
/** Compute changed display-column spans `[startCol, endCol)` for a 1-del / 1-add pair on word boundaries. */
function intraLineCols(delClean, addClean) {
	if (delClean === addClean) return null;
	const tok = (s) => s.match(/\w+|\s+|[^\w\s]/g) ?? [];
	const dt = tok(delClean);
	const at = tok(addClean);
	let p = 0;
	while (p < dt.length && p < at.length && dt[p] === at[p]) p++;
	let s = 0;
	while (p < dt.length - s && p < at.length - s && dt[dt.length - 1 - s] === at[at.length - 1 - s]) s++;
	if (p === 0 && s === 0) return null;
	const cols = (arr, to) => strWidth(arr.slice(0, to).join(""));
	return {
		delSpan: [cols(dt, p), cols(dt, dt.length - s)],
		addSpan: [cols(at, p), cols(at, at.length - s)]
	};
}
/** Apply full-row background and optional intra-line highlight span while preserving foreground SGR sequences. */
function paintRowBg(fgRow, rowBg, wordBg, hiStart, hiEnd) {
	let out = "";
	let seg = "";
	let curWord = false;
	let col = 0;
	const flush = () => {
		if (!seg) return;
		out += curWord && wordBg ? wordBg(seg) : rowBg(seg);
		seg = "";
	};
	const re = new RegExp(ANSI_TOKEN_RE.source, "g");
	let last = 0;
	let m;
	const pushChars = (txt) => {
		for (const ch of txt) {
			const w = charWidth(ch.codePointAt(0));
			const wantWord = Boolean(wordBg && w > 0 && col >= hiStart && col < hiEnd);
			if (wantWord !== curWord) {
				flush();
				curWord = wantWord;
			}
			seg += ch;
			col += w;
		}
	};
	while (m = re.exec(fgRow)) {
		if (m.index > last) pushChars(fgRow.slice(last, m.index));
		if (m[0] === "\x1B[0m" || m[0] === "\x1B[m") {
			flush();
			out += m[0];
		} else seg += m[0];
		last = m.index + m[0].length;
	}
	if (last < fgRow.length) pushChars(fgRow.slice(last));
	flush();
	return out;
}
/**
* Render a unified-style diff to visual terminal rows, each guaranteed `<= opts.width` columns with no `\n`.
*/
function renderDiff(oldText, newText, opts) {
	const width = Math.max(1, Math.floor(opts.width));
	const maxLines = opts.maxLines ?? Infinity;
	if (maxLines <= 0) return [];
	const lines = diffLines(oldText, newText, 2);
	if (lines.length === 0) return [];
	const offset = (opts.startLine ?? 1) - 1;
	let maxNo = 1;
	for (const l of lines) {
		const no = (l.kind === "del" ? l.oldNo : l.newNo) ?? 0;
		if (no + offset > maxNo) maxNo = no + offset;
	}
	const numW = Math.max(2, String(maxNo).length);
	const compact = width < numW + 6;
	const colored = colorLevel() > 0;
	const resolvedLang = opts.lang ? languageFor(opts.lang) ?? opts.lang : void 0;
	const oldHl = colored && resolvedLang && oldText ? highlightCode(oldText.replace(/\r\n/g, "\n").replace(/\n$/, ""), resolvedLang) : null;
	const newHl = colored && resolvedLang && newText ? highlightCode(newText.replace(/\r\n/g, "\n").replace(/\n$/, ""), resolvedLang) : null;
	const addWordBg = style.bg([
		44,
		108,
		58
	]);
	const delWordBg = style.bg([
		124,
		46,
		50
	]);
	const rows = [];
	for (let i = 0; i < lines.length; i++) {
		const l = lines[i];
		if (l.kind === "gap") {
			const gapStr = compact ? "⋯" : `${" ".repeat(numW + 2)}⋯`;
			rows.push(truncateAnsi(theme.muted(gapStr), width));
			continue;
		}
		const lineNo = ((l.kind === "del" ? l.oldNo : l.newNo) ?? 1) + offset;
		const sign = l.kind === "add" ? "+" : l.kind === "del" ? "-" : " ";
		const cleanText = sanitizeLine(l.text);
		if (!colored) {
			const prefix = compact ? `${sign} ` : ` ${String(lineNo).padStart(numW)} ${sign} `;
			rows.push(truncateAnsi(`${prefix}${cleanText}`, width));
			continue;
		}
		const gutterCols = compact ? 2 : numW + 4;
		const gutter = compact ? `${l.kind === "add" ? theme.diff.addFg("+") : l.kind === "del" ? theme.diff.delFg("-") : " "} ` : `${theme.diff.gutter(` ${String(lineNo).padStart(numW)} `)}${l.kind === "add" ? theme.diff.addFg("+ ") : l.kind === "del" ? theme.diff.delFg("- ") : "  "}`;
		if (l.kind === "ctx") {
			const body = (l.newNo && newHl?.[l.newNo - 1]) ?? cleanText;
			rows.push(truncateAnsi(`${gutter}${body}`, width));
			continue;
		}
		let hiSpan = null;
		if (l.kind === "del" && lines[i + 1]?.kind === "add" && lines[i - 1]?.kind !== "del" && lines[i + 2]?.kind !== "add") {
			const spans = intraLineCols(cleanText, sanitizeLine(lines[i + 1].text));
			if (spans) hiSpan = spans.delSpan;
		} else if (l.kind === "add" && lines[i - 1]?.kind === "del" && lines[i - 2]?.kind !== "del" && lines[i + 1]?.kind !== "add") {
			const spans = intraLineCols(sanitizeLine(lines[i - 1].text), cleanText);
			if (spans) hiSpan = spans.addSpan;
		}
		const isAdd = l.kind === "add";
		const trunc = truncateAnsi(`${gutter}${(isAdd ? l.newNo && newHl?.[l.newNo - 1] : l.oldNo && oldHl?.[l.oldNo - 1]) || (isAdd ? theme.diff.addFg(cleanText) : theme.diff.delFg(cleanText))}`, width);
		const pad = Math.max(0, width - strWidth(trunc));
		const fullFg = `${trunc}${" ".repeat(pad)}`;
		const rowBg = isAdd ? theme.diff.addBg : theme.diff.delBg;
		const wordBg = hiSpan && hiSpan[1] > hiSpan[0] ? isAdd ? addWordBg : delWordBg : null;
		rows.push(paintRowBg(fullFg, rowBg, wordBg, hiSpan ? gutterCols + hiSpan[0] : -1, hiSpan ? gutterCols + hiSpan[1] : -1));
	}
	if (rows.length > maxLines) {
		if (maxLines === 1) return [truncateAnsi(theme.muted(`… ${rows.length} more lines`), width)];
		const hidden = rows.length - (maxLines - 1);
		const more = compact ? `… ${hidden} more lines` : ` ${" ".repeat(numW)} … ${hidden} more lines`;
		return [...rows.slice(0, maxLines - 1), truncateAnsi(theme.muted(more), width)];
	}
	return rows;
}
// src/tui/keys.ts
var PASTE_START = "\x1B[200~";
var PASTE_END = "\x1B[201~";
function ev(name, raw, mods = {}) {
	return {
		name,
		raw,
		ctrl: Boolean(mods.ctrl),
		alt: Boolean(mods.alt),
		shift: Boolean(mods.shift),
		...mods.text !== void 0 ? { text: mods.text } : {}
	};
}
/** xterm modifier parameter (1 + bits: 1 shift, 2 alt, 4 ctrl, 8 meta) → flags. */
function modsOf(param) {
	const m = Math.max(0, (param ?? 1) - 1);
	return {
		shift: Boolean(m & 1),
		alt: Boolean(m & 2) || Boolean(m & 8),
		ctrl: Boolean(m & 4)
	};
}
/** A code point (from CSI-u / modifyOtherKeys) with modifiers → key event. */
function codepointKey(code, mods, raw) {
	switch (code) {
		case 13: return ev("enter", raw, mods);
		case 9: return ev("tab", raw, mods);
		case 127:
		case 8: return ev("backspace", raw, mods);
		case 27: return ev("escape", raw, mods);
	}
	const ch = String.fromCodePoint(code);
	if (mods.ctrl || mods.alt) return ev("text", raw, {
		...mods,
		text: ch.toLowerCase()
	});
	return ev("text", raw, {
		...mods,
		text: mods.shift ? ch.toUpperCase() : ch
	});
}
var TILDE = {
	1: "home",
	2: "insert",
	3: "delete",
	4: "end",
	5: "pageup",
	6: "pagedown",
	7: "home",
	8: "end"
};
var LETTER = {
	A: "up",
	B: "down",
	C: "right",
	D: "left",
	H: "home",
	F: "end"
};
var KeyDecoder = class {
	onKey;
	buf = "";
	pasting = false;
	pasteBuf = "";
	escTimer;
	escTimeoutMs;
	constructor(onKey, opts = {}) {
		this.onKey = onKey;
		this.escTimeoutMs = opts.escTimeoutMs ?? 35;
	}
	feed(chunk) {
		if (this.escTimer) {
			clearTimeout(this.escTimer);
			this.escTimer = void 0;
		}
		this.buf += typeof chunk === "string" ? chunk : chunk.toString("utf8");
		this.drain(false);
	}
	/** Emit anything pending (a lone Esc, an unfinished sequence). */
	flush() {
		if (this.escTimer) {
			clearTimeout(this.escTimer);
			this.escTimer = void 0;
		}
		this.drain(true);
	}
	dispose() {
		if (this.escTimer) clearTimeout(this.escTimer);
		this.escTimer = void 0;
	}
	drain(force) {
		for (;;) {
			if (this.pasting) {
				const end = this.buf.indexOf(PASTE_END);
				if (end < 0) {
					let keep = 0;
					for (let k = Math.min(5, this.buf.length); k > 0; k--) if (PASTE_END.startsWith(this.buf.slice(-k))) {
						keep = k;
						break;
					}
					this.pasteBuf += this.buf.slice(0, this.buf.length - keep);
					this.buf = this.buf.slice(this.buf.length - keep);
					if (force && this.buf) {
						this.pasteBuf += this.buf;
						this.buf = "";
					}
					return;
				}
				this.pasteBuf += this.buf.slice(0, end);
				this.buf = this.buf.slice(end + 6);
				this.pasting = false;
				const text = this.pasteBuf.replace(/\r\n?/g, "\n");
				this.pasteBuf = "";
				this.onKey(ev("paste", PASTE_START + text + PASTE_END, { text }));
				continue;
			}
			if (!this.buf) return;
			if (this.parseOne(force) === 0) {
				this.escTimer = setTimeout(() => {
					this.escTimer = void 0;
					this.drain(true);
				}, this.escTimeoutMs);
				return;
			}
		}
	}
	/** Parse one event from the head of `buf`; returns the number of chars consumed (0 = need more input). */
	parseOne(force) {
		const s = this.buf;
		const c = s[0];
		const take = (n, k) => {
			this.buf = s.slice(n);
			if (k) this.onKey(k);
			return n;
		};
		if (c === "\x1B") {
			if (s.length === 1) return force ? take(1, ev("escape", c)) : 0;
			const c1 = s[1];
			if (c1 === "[") return this.parseCsi(force);
			if (c1 === "O") {
				if (s.length < 3) return force ? take(2, ev("text", s.slice(0, 2), {
					alt: true,
					text: "o"
				})) : 0;
				const name = LETTER[s[2]];
				if (name) return take(3, ev(name, s.slice(0, 3)));
				if (s[2] === "M") return take(3, ev("enter", s.slice(0, 3)));
				return take(3, ev("unknown", s.slice(0, 3)));
			}
			if (c1 === "\x1B") return take(1, ev("escape", c));
			if (c1 === "\r" || c1 === "\n") return take(2, ev("enter", s.slice(0, 2), { alt: true }));
			if (c1 === "" || c1 === "\b") return take(2, ev("backspace", s.slice(0, 2), { alt: true }));
			if (c1 === "	") return take(2, ev("tab", s.slice(0, 2), { alt: true }));
			const cp = s.codePointAt(1);
			const len = cp > 65535 ? 3 : 2;
			if (cp < 32) {
				const ctrlLetter = String.fromCharCode(cp + 96);
				return take(2, ev("text", s.slice(0, 2), {
					alt: true,
					ctrl: true,
					text: ctrlLetter
				}));
			}
			return take(len, ev("text", s.slice(0, len), {
				alt: true,
				text: String.fromCodePoint(cp).toLowerCase()
			}));
		}
		if (c === "\r") return take(1, ev("enter", c));
		if (c === "\n") return take(1, ev("text", c, {
			ctrl: true,
			text: "j"
		}));
		if (c === "	") return take(1, ev("tab", c));
		if (c === "" || c === "\b") return take(1, ev("backspace", c));
		const code = c.charCodeAt(0);
		if (code < 32) {
			if (code === 0) return take(1, ev("text", c, {
				ctrl: true,
				text: " "
			}));
			return take(1, ev("text", c, {
				ctrl: true,
				text: String.fromCharCode(code + 96)
			}));
		}
		let i = 0;
		while (i < s.length) {
			const k = s.charCodeAt(i);
			if (k < 32 || k === 127 || k === 27) break;
			i++;
		}
		if (i === s.length && i > 0 && !force) {
			const last = s.charCodeAt(i - 1);
			if (last >= 55296 && last <= 56319) i--;
			if (i === 0) return 0;
		}
		return take(i, ev("text", s.slice(0, i), { text: s.slice(0, i) }));
	}
	parseCsi(force) {
		const s = this.buf;
		let i = 2;
		while (i < s.length && s.charCodeAt(i) >= 48 && s.charCodeAt(i) <= 63) i++;
		while (i < s.length && s.charCodeAt(i) >= 32 && s.charCodeAt(i) <= 47) i++;
		if (i >= s.length) {
			if (!force) return 0;
			this.buf = s.slice(2);
			this.onKey(ev("text", "\x1B[", {
				alt: true,
				text: "["
			}));
			return 2;
		}
		const final = s[i];
		const raw = s.slice(0, i + 1);
		const paramStr = s.slice(2, i);
		const consume = (k) => {
			this.buf = s.slice(i + 1);
			if (k) this.onKey(k);
			return i + 1;
		};
		if (raw === PASTE_START) {
			this.buf = s.slice(i + 1);
			this.pasting = true;
			this.pasteBuf = "";
			return i + 1;
		}
		if (paramStr.startsWith("<")) {
			const m = /^<(\d+);(\d+);(\d+)$/.exec(paramStr);
			if (m && final === "M") {
				const code = Number(m[1]);
				const btn = code & -29;
				const mods = {
					shift: Boolean(code & 4),
					alt: Boolean(code & 8),
					ctrl: Boolean(code & 16)
				};
				if (btn === 64) return consume(ev("wheelup", raw, mods));
				if (btn === 65) return consume(ev("wheeldown", raw, mods));
			}
			return consume(null);
		}
		if (paramStr.startsWith("?") || paramStr.startsWith(">")) return consume(null);
		const params = paramStr.split(";").map((p) => Number(p.split(":")[0]));
		if (LETTER[final]) return consume(ev(LETTER[final], raw, modsOf(params[1])));
		if (final === "Z") return consume(ev("tab", raw, { shift: true }));
		if (final === "~") {
			if (params[0] === 27 && params.length >= 3) return consume(codepointKey(params[2], modsOf(params[1]), raw));
			const name = TILDE[params[0]];
			return consume(name ? ev(name, raw, modsOf(params[1])) : ev("unknown", raw));
		}
		if (final === "u") {
			if (paramStr.split(";")[1]?.split(":")[1] === "3") return consume(null);
			const code = params[0];
			if (!Number.isFinite(code)) return consume(ev("unknown", raw));
			return consume(codepointKey(code, modsOf(params[1]), raw));
		}
		return consume(ev("unknown", raw));
	}
};
/** Helper for matching: `isKey(k, 'c', { ctrl: true })`. */
function isCtrl(k, letter) {
	return k.name === "text" && k.ctrl && !k.alt && k.text === letter;
}
// src/tui/permissions.ts
/** Tools whose second word is the real sub-command (`npm test`, `git commit`, `cargo build`, `python -m`…). */
var TWO_WORD = /* @__PURE__ */ new Set([
	"npm",
	"pnpm",
	"yarn",
	"bun",
	"npx",
	"git",
	"cargo",
	"go",
	"make",
	"docker",
	"kubectl",
	"pip",
	"pip3",
	"uv",
	"deno",
	"gh",
	"brew",
	"dotnet",
	"mvn",
	"gradle",
	"swift",
	"node",
	"python",
	"python3"
]);
var SHELL_OPS = /(;|&&|\|\||\||`|\$\(|>|<|\n)/;
/** `npm test -- --watch` → `npm test`; `ls -la` → `ls`; `FOO=1 npm run x` → `npm run`. */
function commandPrefix(command) {
	const words = command.trim().split(/\s+/).filter((w) => !/^[A-Za-z_][A-Za-z0-9_]*=/.test(w));
	if (!words.length) return "";
	const first = words[0];
	if (TWO_WORD.has(first) && words[1] && !words[1].startsWith("-")) return `${first} ${words[1]}`;
	if ((first === "python" || first === "python3") && words[1] === "-m" && words[2]) return `${first} -m ${words[2]}`;
	return first;
}
function hostOf(url) {
	try {
		return new URL(url).host;
	} catch {
		return "";
	}
}
var PermissionRules = class {
	allEdits = false;
	commands = /* @__PURE__ */ new Set();
	hosts = /* @__PURE__ */ new Set();
	/** Label for the "always" option, e.g. `all edits this session` / `npm test commands` / `example.com`. */
	static alwaysLabel(s) {
		if (s.kind === "edit") return "Yes, and don't ask again for edits this session";
		if (s.kind === "execute" && s.command) {
			if (SHELL_OPS.test(s.command)) return "Yes, don't ask again for this exact command";
			return `Yes, don't ask again for \`${commandPrefix(s.command)}\` commands`;
		}
		if (s.kind === "fetch" && s.url) return `Yes, don't ask again for ${hostOf(s.url) || "this site"}`;
		return "Yes, don't ask again this session";
	}
	remember(s) {
		if (s.kind === "edit") this.allEdits = true;
		else if (s.kind === "execute" && s.command) this.commands.add(SHELL_OPS.test(s.command) ? `=${s.command.trim()}` : commandPrefix(s.command));
		else if (s.kind === "fetch" && s.url) {
			const h = hostOf(s.url);
			if (h) this.hosts.add(h);
		}
	}
	allows(s) {
		if (s.kind === "edit") return this.allEdits;
		if (s.kind === "execute" && s.command) {
			const cmd = s.command.trim();
			if (this.commands.has(`=${cmd}`)) return true;
			if (SHELL_OPS.test(cmd)) return false;
			const p = commandPrefix(cmd);
			return Boolean(p) && this.commands.has(p);
		}
		if (s.kind === "fetch" && s.url) return this.hosts.has(hostOf(s.url));
		return false;
	}
	clear() {
		this.allEdits = false;
		this.commands.clear();
		this.hosts.clear();
	}
};
// src/tui/terminalHost.ts
var DEFAULT_LIMIT = 1e6;
function userShell() {
	if (process.platform === "win32") return {
		file: "cmd.exe",
		args: (c) => [
			"/d",
			"/s",
			"/c",
			c
		]
	};
	return {
		file: process.env.SHELL && existsSync(process.env.SHELL) ? process.env.SHELL : "/bin/sh",
		args: (c) => ["-c", c]
	};
}
/** Trim a string to at most `limit` UTF-8 bytes, dropping from the front at a character boundary. */
function keepTailBytes(s, limit) {
	const buf = Buffer.from(s, "utf8");
	if (buf.length <= limit) return {
		text: s,
		cut: false
	};
	let start = buf.length - limit;
	while (start < buf.length && (buf[start] & 192) === 128) start++;
	return {
		text: buf.subarray(start).toString("utf8"),
		cut: true
	};
}
var TerminalHost = class {
	terms = /* @__PURE__ */ new Map();
	seq = 0;
	/** Called whenever a terminal produced output or exited. */
	onChange;
	get(id) {
		return this.terms.get(id);
	}
	create(p, defaultCwd) {
		const id = `term_${++this.seq}_${Date.now().toString(36)}`;
		const cwd = p.cwd && existsSync(p.cwd) ? p.cwd : defaultCwd;
		const env = { ...process.env };
		for (const e of p.env ?? []) if (e?.name) env[e.name] = e.value;
		const limit = p.outputByteLimit && p.outputByteLimit > 0 ? p.outputByteLimit : DEFAULT_LIMIT;
		let proc;
		if (p.args && p.args.length) proc = spawn(p.command, p.args, {
			cwd,
			env,
			stdio: [
				"ignore",
				"pipe",
				"pipe"
			],
			detached: process.platform !== "win32"
		});
		else {
			const sh = userShell();
			proc = spawn(sh.file, sh.args(p.command), {
				cwd,
				env,
				stdio: [
					"ignore",
					"pipe",
					"pipe"
				],
				detached: process.platform !== "win32"
			});
		}
		const t = {
			id,
			command: p.command,
			cwd,
			startedAt: Date.now(),
			output: "",
			truncated: false,
			proc,
			waiters: []
		};
		const append = (d) => {
			const r = keepTailBytes(t.output + d.toString("utf8"), limit);
			t.output = r.text;
			if (r.cut) t.truncated = true;
			this.onChange?.(t);
		};
		proc.stdout?.on("data", append);
		proc.stderr?.on("data", append);
		const finish = (e) => {
			if (t.exit) return;
			t.exit = e;
			for (const w of t.waiters.splice(0)) w(e);
			this.onChange?.(t);
		};
		proc.on("close", (code, signal) => finish({
			exitCode: code,
			signal: signal ?? null
		}));
		proc.on("error", (err) => {
			append(Buffer.from(`${err.message}\n`));
			finish({
				exitCode: 127,
				signal: null
			});
		});
		this.terms.set(id, t);
		this.onChange?.(t);
		return { terminalId: id };
	}
	output(id) {
		const t = this.require(id);
		return {
			output: t.output,
			truncated: t.truncated,
			...t.exit ? { exitStatus: t.exit } : {}
		};
	}
	waitForExit(id, signal) {
		const t = this.require(id);
		if (t.exit) return Promise.resolve(t.exit);
		return new Promise((resolve, reject) => {
			t.waiters.push(resolve);
			signal?.addEventListener("abort", () => reject(/* @__PURE__ */ new Error("cancelled")), { once: true });
		});
	}
	kill(id) {
		const t = this.require(id);
		if (t.exit) return;
		const pid = t.proc.pid;
		try {
			if (pid && process.platform !== "win32") process.kill(-pid, "SIGTERM");
			else t.proc.kill("SIGTERM");
		} catch {
			try {
				t.proc.kill("SIGTERM");
			} catch {}
		}
		setTimeout(() => {
			if (t.exit) return;
			try {
				if (pid && process.platform !== "win32") process.kill(-pid, "SIGKILL");
				else t.proc.kill("SIGKILL");
			} catch {}
		}, 1500).unref();
	}
	/** Release: kill if still running and forget the terminal (the last output stays readable for the UI). */
	release(id) {
		const t = this.terms.get(id);
		if (!t) return void 0;
		if (!t.exit) this.kill(id);
		this.terms.delete(id);
		return t;
	}
	/** Kill everything (exit). */
	killAll() {
		for (const id of [...this.terms.keys()]) this.release(id);
	}
	require(id) {
		const t = this.terms.get(id);
		if (!t) throw new Error(`Unknown terminal ${id}`);
		return t;
	}
};
/** Display cleanup for command output: drop ANSI/control sequences and keep what a `\r` overwrote last. */
function cleanTerminalText(s) {
	return s.replace(/\x1b\[[0-9;?]*[ -\/]*[@-~]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1b[@-Z\\-_]/g, "").replace(/\r\n/g, "\n").split("\n").map((line) => {
		const i = line.lastIndexOf("\r");
		return (i >= 0 ? line.slice(i + 1) : line).replace(/[\x00-\x08\x0b-\x1f\x7f]/g, "").replace(/\t/g, "  ");
	});
}
// src/tui/toolView.ts
var SPINNER = [
	"⠋",
	"⠙",
	"⠹",
	"⠸",
	"⠼",
	"⠴",
	"⠦",
	"⠧",
	"⠇",
	"⠏"
];
function spinnerFrame(now = Date.now()) {
	return SPINNER[Math.floor(now / 80) % SPINNER.length];
}
var NAMES = {
	read_file: "Read",
	edit_file: "Edit",
	write_file: "Write",
	list_dir: "List",
	glob_files: "Glob",
	grep_search: "Grep",
	run_command: "Bash",
	todo_write: "Todo",
	web_fetch: "Fetch"
};
function toolDisplayName(fn) {
	if (NAMES[fn]) return NAMES[fn];
	const m = /^mcp__(.+?)__(.+)$/.exec(fn);
	if (m) return `${m[1]} · ${m[2]}`;
	return fn || "Tool";
}
function relPath(cwd, p) {
	if (!p) return "";
	if (!isAbsolute(p)) return p;
	const r = relative(cwd, p);
	return r && !r.startsWith("..") ? r.split(sep).join("/") : p;
}
var str = (v) => typeof v === "string" ? v : v === void 0 || v === null ? "" : String(v);
function oneLine(s) {
	return sanitizeLine(s.replace(/\s+/g, " ").trim(), 2);
}
function toolTarget(t, cwd) {
	const a = t.rawInput ?? {};
	switch (t.fn) {
		case "read_file": {
			const line = typeof a.start_line === "number" && a.start_line > 1 ? `:${a.start_line}` : "";
			return relPath(cwd, str(a.path)) + line;
		}
		case "edit_file":
		case "write_file": return relPath(cwd, str(a.path));
		case "list_dir": return relPath(cwd, str(a.path)) || ".";
		case "glob_files": return str(a.pattern);
		case "grep_search": return `"${oneLine(str(a.query))}"${a.path ? ` in ${relPath(cwd, str(a.path))}` : ""}`;
		case "run_command": return oneLine(str(a.command));
		case "web_fetch": return str(a.url);
		case "todo_write": return "";
		default:
			if (t.fn.startsWith("mcp__")) {
				const keys = Object.keys(a);
				if (!keys.length) return "";
				return keys.slice(0, 3).map((k) => `${k}: ${oneLine(typeof a[k] === "string" ? a[k] : JSON.stringify(a[k]))}`).join(", ");
			}
			return oneLine(t.title);
	}
}
function contentText(t) {
	for (const c of t.content ?? []) if (c?.type === "content") {
		const inner = c.content;
		if (inner?.type === "text") return str(inner.text);
	}
	return typeof t.rawOutput === "string" ? t.rawOutput : "";
}
function diffOf(t) {
	for (const c of t.content ?? []) if (c?.type === "diff") {
		const d = c;
		return {
			path: str(d.path),
			oldText: str(d.oldText),
			newText: str(d.newText)
		};
	}
}
/** Output lines of a command (live terminal buffer or the final rawOutput). */
function commandOutputLines(t) {
	let text = "";
	if (t.terminal) text = t.terminal.output;
	else {
		text = typeof t.rawOutput === "string" ? t.rawOutput : contentText(t);
		text = text.replace(/^```console\n/, "").replace(/\n```$/, "").replace(/^\$ .*\n?/, "").replace(/\n?(Exit code \d+.*|Command exited with code -?\d+\.|\[Timed out after \d+ms\])$/, "");
		if (text.trim() === "(no output)") text = "";
	}
	const lines = cleanTerminalText(text.replace(/\n+$/, ""));
	return lines.length === 1 && lines[0] === "" ? [] : lines;
}
function exitCodeOf(t) {
	if (t.terminal?.exit) return t.terminal.exit.exitCode ?? (t.terminal.exit.signal ? 130 : void 0);
	const out = typeof t.rawOutput === "string" ? t.rawOutput : "";
	const m = /(?:Exit code|exited with code) (-?\d+)/.exec(out);
	return m ? Number(m[1]) : void 0;
}
function isDenied(t) {
	if (t.denied) return true;
	const out = typeof t.rawOutput === "string" ? t.rawOutput : "";
	return t.status === "failed" && /denied by user\.?$/i.test(out.trim());
}
function toolMeta(t, now = Date.now()) {
	const done = t.status === "completed" || t.status === "failed";
	if (t.cancelled && !done) return "interrupted";
	if (isDenied(t)) return "denied";
	const text = contentText(t);
	const count = (s) => s.trim() ? s.replace(/\n+$/, "").split("\n").length : 0;
	switch (t.fn) {
		case "read_file": return done && t.status === "completed" ? `${count(text)} lines` : "";
		case "edit_file":
		case "write_file": {
			const d = diffOf(t);
			if (!d) return "";
			const s = diffStats(d.oldText, d.newText);
			return `+${s.added} −${s.removed}`;
		}
		case "list_dir": return done && t.status === "completed" ? `${text.trim() === "(empty directory)" ? 0 : count(text)} entries` : "";
		case "glob_files": return done && t.status === "completed" ? `${/^No files matched/.test(text) ? 0 : count(text)} files` : "";
		case "grep_search": return done && t.status === "completed" ? `${/^No matches found/.test(text) ? 0 : count(text)} matches` : "";
		case "run_command": {
			const ms = (t.endedAt ?? now) - t.startedAt;
			const parts = [];
			if (!done || ms >= 1e3) parts.push(formatDuration(ms));
			const code = exitCodeOf(t);
			if (done && code !== void 0 && code !== 0) parts.push(`exit ${code}`);
			if (done && t.status === "completed") {
				const n = commandOutputLines(t).length;
				parts.push(`${n} line${n === 1 ? "" : "s"}`);
			}
			return parts.join(" · ");
		}
		case "web_fetch": {
			const m = /^HTTP (\d+)/.exec(text);
			return m ? `HTTP ${m[1]}` : "";
		}
		default: return "";
	}
}
function statusGlyph(t, now) {
	if (isDenied(t) || t.cancelled && t.status !== "completed" && t.status !== "failed") return theme.muted("⊘");
	if (t.status === "completed") return theme.success("✓");
	if (t.status === "failed") return theme.error("✗");
	return theme.accent(spinnerFrame(now));
}
/** Header row `  ✓ Edit  src/a.ts  +12 −3` or `  ✓ Read  src/a.ts  · 358 lines`. */
function toolHeaderRow(t, o) {
	const now = o.now ?? Date.now();
	const name = toolDisplayName(t.fn);
	const rawMeta = toolMeta(t, now);
	const meta = rawMeta ? rawMeta.startsWith("+") ? rawMeta : `· ${rawMeta}` : "";
	const target = toolTarget(t, o.cwd);
	const left = `  ${statusGlyph(t, now)} ${style.bold(name)}`;
	const metaStr = meta ? `  ${theme.muted(meta)}` : "";
	const room = o.width - strWidth(left) - strWidth(metaStr) - 2;
	return truncateAnsi(`${left}${target && room > 4 ? `  ${theme.muted(truncateAnsi(target, room))}` : ""}${metaStr}`, o.width);
}
var INDENT = "    ";
function todoRows(t, width) {
	const todos = Array.isArray(t.rawInput?.todos) ? t.rawInput.todos : [];
	const rows = [];
	for (const td of todos) {
		const text = sanitizeLine(str(td?.content).replace(/\s+/g, " ").trim(), 2);
		if (!text) continue;
		const st = td?.status;
		const glyph = st === "completed" ? theme.success("☑") : st === "in_progress" ? theme.accent("◐") : theme.muted("☐");
		const body = st === "completed" ? theme.muted(text) : text;
		rows.push(...wrapAnsi(body, width, {
			firstIndent: `${INDENT}${glyph} `,
			indent: `${INDENT}  `
		}));
	}
	return rows;
}
/** Rows rendered under the header row. */
function toolBodyRows(t, o) {
	const w = o.width;
	const done = t.status === "completed" || t.status === "failed";
	if (t.fn === "todo_write") return todoRows(t, w);
	if (isDenied(t)) return [];
	if (t.fn === "edit_file" || t.fn === "write_file") {
		const d = diffOf(t);
		if (d && t.status === "completed") {
			const loc = t.locations?.[0]?.line;
			const startLine = typeof loc === "number" && loc > 0 ? loc : 1;
			return renderDiff(d.oldText, d.newText, {
				width: Math.max(10, w - 4),
				maxLines: o.expanded ? 400 : o.replay ? 6 : 12,
				startLine,
				lang: languageFor(d.path)
			}).map((r) => INDENT + r);
		}
	}
	if (t.fn === "run_command") {
		const lines = commandOutputLines(t);
		const failed = t.status === "failed";
		const show = o.expanded ? lines.length : !done ? 4 : failed && !o.replay ? 6 : 0;
		if (!show || !lines.length) return [];
		const tail = lines.slice(-show);
		const rows = [];
		if (lines.length > tail.length && !o.expanded) rows.push(INDENT + theme.subtle(`… ${lines.length - tail.length} earlier lines`));
		for (const l of tail) rows.push(INDENT + theme.muted(truncateAnsi(l, Math.max(4, w - 4))));
		return rows;
	}
	if (t.status === "failed") {
		const msg = oneLine(contentText(t) || str(t.rawOutput));
		if (!msg) return [];
		return wrapAnsi(theme.error(msg), w, {
			firstIndent: INDENT,
			indent: INDENT
		}).slice(0, o.expanded ? 40 : 3);
	}
	if (o.expanded && done) return contentText(t).split("\n").slice(0, 400).map((l) => INDENT + theme.muted(truncateAnsi(cleanTerminalText(l)[0] ?? "", Math.max(4, w - 4))));
	return [];
}
function renderTool(t, o) {
	return [toolHeaderRow(t, o), ...toolBodyRows(t, o)];
}
/** Calm activity label for the spinner row. */
function toolActivity(t, cwd) {
	const target = toolTarget(t, cwd);
	switch (t.fn) {
		case "read_file": return `Reading ${target}`;
		case "edit_file": return `Editing ${target}`;
		case "write_file": return `Writing ${target}`;
		case "list_dir": return `Listing ${target}`;
		case "glob_files":
		case "grep_search": return `Searching ${target}`;
		case "run_command": return `Running ${target}`;
		case "todo_write": return "Updating plan";
		case "web_fetch": return `Fetching ${target}`;
		default: return `Calling ${toolDisplayName(t.fn)}`;
	}
}
// src/tui/overlays.ts
function permissionSubject(tc) {
	const kind = tc?.kind === "edit" || tc?.kind === "execute" || tc?.kind === "fetch" ? tc.kind : "other";
	const raw = tc?.rawInput ?? {};
	return {
		kind,
		...typeof raw.command === "string" ? { command: raw.command } : {},
		...typeof raw.url === "string" ? { url: raw.url } : {}
	};
}
function pickPermissionOption(req, kind) {
	const o = req.options.find((x) => x.kind === kind) ?? req.options.find((x) => x.optionId === kind);
	return o ? {
		outcome: "selected",
		optionId: o.optionId
	} : kind === "reject_once" ? { outcome: "cancelled" } : {
		outcome: "selected",
		optionId: kind
	};
}
function buildPermissionView(tc, cwd, width, screenHeight) {
	const subject = permissionSubject(tc);
	const inner = Math.max(10, width - 4);
	const maxPreview = Math.max(4, screenHeight - 14);
	if (subject.kind === "edit") {
		const diff = (tc.content ?? []).find((c) => c?.type === "diff");
		const path = relPath(cwd, String(diff?.path ?? tc.locations?.[0]?.path ?? ""));
		const verb = /^(Create|Overwrite)\b/.exec(String(tc.title ?? ""))?.[1] ?? "Edit";
		const preview = diff ? renderDiff(String(diff.oldText ?? ""), String(diff.newText ?? ""), {
			width: inner,
			maxLines: maxPreview,
			startLine: tc.locations?.[0]?.line ?? 1,
			lang: languageFor(path)
		}) : [];
		return {
			title: `${verb} ${sanitizeLine(path, 2)}?`,
			preview,
			subject
		};
	}
	if (subject.kind === "execute") {
		const rows = wrapAnsi((subject.command ?? String(tc.title ?? "").replace(/^Run:\s*/, "")).replace(/\r\n/g, "\n").replace(/\r/g, "↵").split("\n").map((l) => sanitizeLine(l, 2)).join("\n"), inner, {
			firstIndent: theme.accent("$ "),
			indent: "  "
		}).slice(0, maxPreview);
		const cmdCwd = tc.rawInput?.cwd;
		if (typeof cmdCwd === "string" && cmdCwd && cmdCwd !== cwd) rows.push(theme.muted(`in ${sanitizeLine(relPath(cwd, cmdCwd), 2)}`));
		return {
			title: "Run command?",
			preview: rows,
			subject
		};
	}
	if (subject.kind === "fetch") return {
		title: "Fetch URL?",
		preview: wrapAnsi(sanitizeLine(subject.url ?? String(tc.title ?? ""), 2), inner),
		subject
	};
	return {
		title: `${sanitizeLine(String(tc.title ?? "Allow tool"), 2)}?`,
		preview: [],
		subject
	};
}
function createPermissionOverlay(req, cwd, width, screenHeight, rules, hooks, signal) {
	const tc = req.toolCall ?? {};
	const id = String(tc.toolCallId ?? "");
	const view = buildPermissionView(tc, cwd, width, screenHeight);
	const overlay = {
		type: "permission",
		title: view.title,
		preview: view.preview,
		options: [
			"Yes",
			PermissionRules.alwaysLabel(view.subject),
			"No, tell Olympus what to do instead"
		],
		selected: 0,
		subject: view.subject,
		resolve: (choice) => {
			hooks.onClose(overlay);
			signal.removeEventListener("abort", onAbort);
			if (choice === 0) hooks.onAnswer(pickPermissionOption(req, "allow_once"));
			else if (choice === 1) {
				rules.remember(view.subject);
				hooks.onAnswer(pickPermissionOption(req, "allow_always"));
			} else {
				hooks.onDenied(id, choice === 2);
				hooks.onAnswer(choice === -1 ? { outcome: "cancelled" } : pickPermissionOption(req, "reject_once"));
			}
		}
	};
	const onAbort = () => overlay.resolve(-1);
	signal.addEventListener("abort", onAbort, { once: true });
	return overlay;
}
function requestPermissionThroughOverlay(req, signal, cwd, width, screenHeight, rules, hooks) {
	const tc = req.toolCall ?? {};
	const subject = permissionSubject(tc);
	const id = String(tc.toolCallId ?? "");
	hooks.attachPreview(id, tc);
	if (rules.allows(subject)) return Promise.resolve(pickPermissionOption(req, "allow_once"));
	return new Promise((resolve) => {
		const ov = createPermissionOverlay(req, cwd, width, screenHeight, rules, {
			onClose: (o) => hooks.clearOverlay(o),
			onDenied: hooks.onDenied,
			onAnswer: (ans) => {
				resolve(ans);
				hooks.requestRedraw();
			}
		}, signal);
		hooks.setOverlay(ov);
		hooks.requestRedraw();
	});
}
function handlePermissionKey(k, o, onInterrupt) {
	if (isCtrl(k, "c")) {
		o.resolve(2);
		onInterrupt();
		return;
	}
	if (k.name === "up") o.selected = (o.selected + 2) % 3;
	else if (k.name === "down" || k.name === "tab") o.selected = (o.selected + 1) % 3;
	else if (k.name === "enter") o.resolve(o.selected);
	else if (k.name === "escape") o.resolve(2);
	else if (k.name === "text" && !k.ctrl && !k.alt && /^[123]$/.test(k.text ?? "")) o.resolve(Number(k.text) - 1);
	else if (k.name === "text" && !k.ctrl && (k.text === "y" || k.text === "Y")) o.resolve(0);
	else if (k.name === "text" && !k.ctrl && (k.text === "n" || k.text === "N")) o.resolve(2);
}
function filteredPickerItems(p) {
	return fuzzyFilter(p.items, p.filter, (x) => x.search, 500);
}
function handlePickerKey(k, p, onClose, onError, onDone) {
	const items = filteredPickerItems(p);
	if (k.name === "escape" || isCtrl(k, "c")) onClose();
	else if (k.name === "up" || k.name === "wheelup") p.selected = Math.max(0, p.selected - 1);
	else if (k.name === "down" || k.name === "tab" || k.name === "wheeldown") p.selected = Math.min(Math.max(0, items.length - 1), p.selected + 1);
	else if (k.name === "pageup") p.selected = Math.max(0, p.selected - 8);
	else if (k.name === "pagedown") p.selected = Math.min(Math.max(0, items.length - 1), p.selected + 8);
	else if (k.name === "enter") {
		const it = items[p.selected];
		onClose();
		if (it) Promise.resolve(p.onPick(it.value)).catch((e) => onError(String(e?.message ?? e))).finally(onDone);
	} else if (k.name === "backspace") {
		p.filter = Array.from(p.filter).slice(0, -1).join("");
		p.selected = 0;
	} else if (k.name === "text" && !k.ctrl && !k.alt && k.text || k.name === "paste") {
		p.filter += (k.text ?? "").replace(/\s+/g, " ");
		p.selected = 0;
	}
}
function computeSuggestions(editor, commands, getFiles, prev) {
	const tok = editor.currentToken();
	if (!tok) return null;
	const prevSel = prev?.kind === tok.kind ? prev.selected : 0;
	if (tok.kind === "/") {
		const items = fuzzyFilter(commands, tok.query, (c) => c.name, 20).map((c) => ({
			label: `/${c.name}${c.hint ? ` ${c.hint}` : ""}`,
			detail: c.description,
			insert: `/${c.name}`,
			submit: !c.hint
		}));
		return items.length ? {
			kind: "/",
			start: 0,
			items,
			selected: Math.min(prevSel, items.length - 1)
		} : null;
	}
	const items = fuzzyFilter(getFiles(), tok.query, (f) => f, 30).map((f) => ({
		label: f,
		insert: `@${mentionText(f)} `
	}));
	return items.length ? {
		kind: "@",
		start: tok.start,
		items,
		selected: Math.min(prevSel, items.length - 1)
	} : null;
}
function applyAcceptedSuggestion(s, editor, viaEnter) {
	const it = s.items[s.selected];
	if (!it) return {
		shouldSubmit: false,
		dismissedText: null
	};
	if (s.kind === "/") {
		const typed = editor.text.trim();
		editor.setText(it.insert + (it.submit ? "" : " "));
		if (viaEnter && (it.submit || typed === it.insert)) {
			editor.setText(it.insert);
			return {
				shouldSubmit: true,
				dismissedText: null
			};
		}
		return {
			shouldSubmit: false,
			dismissedText: editor.text
		};
	}
	editor.replaceToken(s.start, it.insert);
	return {
		shouldSubmit: false,
		dismissedText: editor.text
	};
}
function renderHelpRows(commands, width) {
	const rows = [`  ${style.bold("Commands")}`];
	const nameW = Math.min(22, Math.max(...commands.map((c) => strWidth(`/${c.name}${c.hint ? ` ${c.hint}` : ""}`))) + 2);
	for (const c of commands) {
		const n = `/${c.name}${c.hint ? ` ${c.hint}` : ""}`;
		rows.push(truncateAnsi(`  ${theme.accent(n.padEnd(nameW))}${theme.muted(c.description)}`, width));
	}
	rows.push("", `  ${style.bold("Keys")}`);
	const keys = [
		["enter", "send · while running: queue a follow-up"],
		["shift+enter  alt+enter  ctrl+j", "new line (or end the line with \\)"],
		["esc", "interrupt the running turn · close a popup"],
		["ctrl+c", "clear input · interrupt · press twice to exit"],
		["ctrl+d", "exit (empty input)"],
		["shift+tab", "cycle mode: code → plan → auto"],
		["↑ ↓", "move between lines · history"],
		["ctrl+o", "show the last thinking / full tool output"],
		["pgup pgdn  wheel  shift+↑↓", "scroll the conversation · end follows the latest"],
		["/copy", "copy the last response to the clipboard"],
		["ctrl+l", "redraw the screen"],
		["@path", "attach a file · !cmd runs a shell command locally"]
	];
	const kw = Math.min(34, Math.max(...keys.map(([k]) => k.length)) + 2);
	for (const [k, d] of keys) rows.push(truncateAnsi(`  ${theme.text(k.padEnd(kw))}${theme.muted(d)}`, width));
	return rows;
}
function renderCostRows(usage, totals, lastTurn, width) {
	const rows = [`  ${style.bold("Usage")}`];
	if (usage.size) rows.push(`  ${theme.muted("context".padEnd(12))}${formatTokens(usage.used)} / ${formatTokens(usage.size)} (${Math.round(usage.used / usage.size * 100)}%)`);
	rows.push(`  ${theme.muted("cost".padEnd(12))}${usage.cost > 0 ? formatCost(usage.cost) : "not reported by this provider"}`);
	if (totals.turns) {
		const cw = totals.cacheWrite ?? 0;
		const cwSuffix = cw > 0 ? ` · ${formatTokens(cw)} cache write` : "";
		rows.push(`  ${theme.muted("this run".padEnd(12))}${totals.turns} turn${totals.turns === 1 ? "" : "s"} · ↑ ${formatTokens(totals.input)} in · ↓ ${formatTokens(totals.output)} out · ${formatTokens(totals.cached)} cached${cwSuffix}`);
	}
	if (lastTurn) {
		const lcw = (lastTurn.cachedWriteTokens ?? 0) + (lastTurn.cachedWrite1hTokens ?? 0);
		const lcwSuffix = lcw > 0 ? ` · ${formatTokens(lcw)} cache write` : "";
		rows.push(`  ${theme.muted("last turn".padEnd(12))}↑ ${formatTokens(lastTurn.inputTokens ?? 0)} in · ↓ ${formatTokens(lastTurn.outputTokens ?? 0)} out · ${formatTokens(lastTurn.cachedReadTokens ?? 0)} cached${lcwSuffix}`);
	}
	return rows.map((r) => truncateAnsi(r, width));
}
// src/tui/actions.ts
/**
* Slash command execution, interactive pickers (`/model`, `/provider`, `/mode`, `/resume`),
* and local `!cmd` shell execution for `TuiApp`.
*/
var MODES = [
	"code",
	"plan",
	"auto"
];
function gitBranch(cwd) {
	try {
		const b = execFileSync("git", [
			"rev-parse",
			"--abbrev-ref",
			"HEAD"
		], {
			cwd,
			encoding: "utf8",
			timeout: 1500,
			stdio: [
				"ignore",
				"pipe",
				"ignore"
			]
		}).trim();
		return b && b !== "HEAD" ? b : void 0;
	} catch {
		return;
	}
}
function relTime(iso) {
	const t = typeof iso === "number" ? iso : Date.parse(iso);
	const s = Math.max(0, Math.round((Date.now() - t) / 1e3));
	if (s < 60) return "just now";
	if (s < 3600) return `${Math.round(s / 60)}m ago`;
	if (s < 86400) return `${Math.round(s / 3600)}h ago`;
	return `${Math.round(s / 86400)}d ago`;
}
async function executeSlashCommand(ctx, name, arg, raw) {
	const cmd = findCommand(ctx.commands, name);
	if (!cmd) {
		ctx.transcript.notice(`Unknown command /${name} · /help lists commands`, theme.warning);
		return;
	}
	if (![
		"help",
		"login",
		"exit",
		"copy"
	].includes(cmd.name) && (ctx.noProvider || !ctx.engine.sessionId)) {
		ctx.transcript.notice("No provider is connected yet. Run /login to add one.", theme.warning);
		return;
	}
	if (ctx.isRunning && ![
		"help",
		"exit",
		"cost",
		"mode",
		"copy"
	].includes(cmd.name)) {
		ctx.transcript.notice(`/${cmd.name} is available when the current turn ends (esc interrupts).`, theme.warning);
		return;
	}
	switch (cmd.name) {
		case "help":
			ctx.transcript.emit("notice", renderHelpRows(ctx.commands, ctx.screen.width));
			return;
		case "exit":
			ctx.exit();
			return;
		case "model":
			if (arg) {
				await ctx.engine.setConfig("model", arg);
				ctx.refreshSessionProvider();
				ctx.transcript.notice(`model · ${ctx.modelId()} on ${ctx.sessionProviderId() ?? "provider"}`);
				return;
			}
			openModelPicker(ctx);
			return;
		case "provider":
			await openProviderPicker(ctx);
			return;
		case "mode":
			if (arg) {
				if (!MODES.includes(arg)) throw new Error("Mode must be code, plan or auto.");
				await ctx.setMode(arg);
				return;
			}
			openModePicker(ctx);
			return;
		case "cost":
			ctx.transcript.emit("notice", renderCostRows(ctx.usage, ctx.totals, ctx.lastTurn, ctx.screen.width));
			return;
		case "copy":
			copyLastResponse(ctx);
			return;
		case "clear":
			await ctx.runTurn([{
				type: "text",
				text: "/clear"
			}], { silent: true });
			ctx.usage.used = 0;
			ctx.clearScreen();
			return;
		case "new":
			await ctx.engine.closeSession();
			ctx.resetUsage();
			ctx.clearScreen();
			await ctx.newSession();
			return;
		case "resume":
			await openResumePicker(ctx);
			return;
		case "login":
			await ctx.login();
			return;
		default: if (cmd.agent) {
			ctx.transcript.user(raw);
			await ctx.runTurn([{
				type: "text",
				text: raw
			}]);
		}
	}
}
/** `/copy`: last finished assistant message → system clipboard. */
function copyLastResponse(ctx, copy = copyToClipboard) {
	const text = ctx.transcript.lastAssistantText;
	if (!text) {
		ctx.transcript.notice("Nothing to copy yet: no assistant response in this session.", theme.warning);
		return;
	}
	const res = copy(text);
	if (res.ok) ctx.showHint(`copied response (${text.length} chars)`, 2500);
	else ctx.transcript.notice(`Could not copy to the clipboard: ${res.error ?? "unknown error"}`, theme.warning);
}
function openModelPicker(ctx) {
	const cur = ctx.engine.option("model")?.currentValue;
	const items = ctx.engine.modelChoices().map((m) => ({
		label: m.name,
		...m.value !== m.name ? { detail: m.value } : {},
		...m.group ? { group: m.group } : {},
		current: m.value === cur,
		value: m.value,
		search: `${m.name} ${m.value} ${m.group ?? ""}`
	}));
	if (!items.length) {
		ctx.transcript.notice("No models available. Check the provider with /status.", theme.warning);
		return;
	}
	ctx.openPicker({
		title: "Model",
		items,
		onPick: async (value) => {
			await ctx.engine.setConfig("model", value);
			ctx.refreshSessionProvider();
			ctx.transcript.notice(`model · ${ctx.modelId()} on ${ctx.sessionProviderId() ?? "provider"}`);
		}
	});
}
async function openProviderPicker(ctx) {
	const inputs = inputsFromEnv(ctx.env);
	const conn = resolveConnectedProviders(inputs, null, !inputs.openRouterToken && !inputs.anthropicToken && !inputs.aiGatewayToken && !inputs.customToken && !inputs.useOllama ? await detectLocalOllama(inputs.ollamaHost, ctx.env.OLYMPUS_DISABLE_OLLAMA_PROBE === "1") : false);
	const cur = ctx.sessionProviderId();
	const items = conn.providers.map((p) => ({
		label: p.label,
		detail: `${p.id} · ${p.endpoint.defaultModel}`,
		current: p.id === cur,
		value: p.id,
		search: `${p.label} ${p.id}`
	}));
	if (!items.length) {
		ctx.transcript.notice("No provider is connected. Run /login to add one.", theme.warning);
		return;
	}
	ctx.openPicker({
		title: "Provider",
		items,
		onPick: async (id) => {
			const p = conn.providers.find((x) => x.id === id);
			if (!p) return;
			await ctx.engine.setConfig("model", `${p.id}::${p.endpoint.defaultModel}`);
			ctx.refreshSessionProvider();
			ctx.transcript.notice(`provider · ${p.label} · ${ctx.modelId()}`);
		}
	});
}
function openModePicker(ctx) {
	const cur = ctx.mode();
	const desc = {
		code: "edits and commands ask first",
		plan: "read-only: explore and plan",
		auto: "edits and commands run without asking"
	};
	ctx.openPicker({
		title: "Mode",
		items: MODES.map((m) => ({
			label: m,
			detail: desc[m],
			current: m === cur,
			value: m,
			search: m
		})),
		onPick: (m) => ctx.setMode(m)
	});
}
async function openResumePicker(ctx) {
	const list = (await ctx.engine.listSessions()).filter((s) => s.sessionId !== ctx.engine.sessionId);
	if (!list.length) {
		ctx.transcript.notice("No earlier sessions in this folder.");
		ctx.screen.request();
		return;
	}
	const items = list.slice(0, 100).map((s) => {
		const st = readStoredSession(s.sessionId);
		const msgs = st ? st.messages.filter((m) => m.role === "user").length : 0;
		const detail = [
			relTime(s.updatedAt),
			st?.model,
			`${msgs} message${msgs === 1 ? "" : "s"}`
		].filter(Boolean).join(" · ");
		return {
			label: s.title || "Untitled session",
			detail,
			value: s.sessionId,
			search: `${s.title} ${st?.model ?? ""}`
		};
	});
	ctx.openPicker({
		title: "Resume session",
		items,
		onPick: async (id) => {
			await ctx.engine.closeSession();
			ctx.resetUsage();
			ctx.clearScreen();
			await ctx.loadSession(id);
		}
	});
}
async function runLocalShellCommand(ctx, command) {
	const id = `shell_${Date.now().toString(36)}`;
	ctx.transcript.handleUpdate({
		sessionUpdate: "tool_call",
		toolCallId: id,
		name: "run_command",
		title: command,
		kind: "execute",
		status: "in_progress",
		rawInput: { command }
	});
	const { terminalId } = ctx.engine.terminals.create({ command }, ctx.cwd);
	const term = ctx.engine.terminals.get(terminalId);
	if (term) ctx.transcript.terminalChanged(term);
	ctx.transcript.handleUpdate({
		sessionUpdate: "tool_call_update",
		toolCallId: id,
		content: [{
			type: "terminal",
			terminalId
		}]
	});
	ctx.startTicker();
	ctx.screen.request();
	const exit = await ctx.engine.terminals.waitForExit(terminalId);
	const code = exit.exitCode ?? (exit.signal ? 130 : 0);
	ctx.engine.terminals.release(terminalId);
	ctx.transcript.handleUpdate({
		sessionUpdate: "tool_call_update",
		toolCallId: id,
		status: code === 0 ? "completed" : "failed",
		rawOutput: `Command exited with code ${code}.`
	});
	ctx.stopTickerIfIdle();
	ctx.screen.request();
}
async function openInitialSession(ctx, opts) {
	if ((await ctx.engine.authStatus().catch(() => ({
		state: "unauthenticated",
		accounts: []
	}))).state !== "authenticated") {
		ctx.setNoProvider(true);
		ctx.printHeader();
		return;
	}
	try {
		let resumeId = typeof opts.resume === "string" ? opts.resume : void 0;
		if (opts.continueLatest) resumeId = listStoredSessions({ cwd: ctx.cwd })[0]?.sessionId;
		if (resumeId) return ctx.loadSession(resumeId);
		if (opts.continueLatest) ctx.transcript.notice("No earlier session in this folder; starting a new one.");
		await ctx.newSession();
	} catch (e) {
		if (/auth|provider|api key/i.test(String(e?.message ?? ""))) {
			ctx.setNoProvider(true);
			ctx.printHeader();
			return;
		}
		throw e;
	}
}
async function runSuspendedLogin(ctx, runLogin, suspendIo, resumeIo, writeOut) {
	if (!runLogin) {
		ctx.transcript.notice("Run `oly login` in a terminal to add a provider.");
		return;
	}
	ctx.screen.flush();
	suspendIo();
	try {
		await runLogin();
	} catch (e) {
		writeOut(`${theme.error(String(e?.message ?? e))}\n`);
	} finally {
		resumeIo();
	}
	if ((await ctx.engine.authStatus().catch(() => ({
		state: "unauthenticated",
		accounts: []
	}))).state !== "authenticated") {
		ctx.transcript.notice("Still no provider connected.", theme.warning);
		return;
	}
	if (!ctx.engine.sessionId) await ctx.newSession();
	else {
		await ctx.engine.refreshOptions();
		ctx.refreshSessionProvider();
		ctx.transcript.notice(`connected · ${ctx.sessionProviderId() ?? ""} · ${ctx.modelId()}`);
	}
	ctx.screen.request();
}
function submitEditorInput(ctx) {
	const shown = ctx.editor.text;
	const text = ctx.editor.expandedText();
	if (!text.trim()) return;
	if (text.length <= 8e3) ctx.editor.history.add(text);
	ctx.editor.clear();
	ctx.clearPopupAndPlaceholder();
	const t = text.trim();
	if (t.startsWith("!") && t.length > 1) return void runLocalShellCommand(ctx, t.slice(1).trim());
	const cmd = parseSlash(t);
	if (cmd) {
		executeSlashCommand(ctx, cmd.name, cmd.arg, t).catch((err) => ctx.transcript.notice(String(err?.message ?? err), theme.error)).finally(() => ctx.screen.request());
		return;
	}
	if (ctx.noProvider) {
		ctx.transcript.user(shown);
		ctx.transcript.notice("No provider is connected yet. Run /login to add one.", theme.warning);
		return;
	}
	const blocks = buildPromptBlocks(text, ctx.cwd);
	if (ctx.isRunning) {
		ctx.queued.push({
			shown,
			sentText: text,
			blocks,
			consumed: false
		});
		ctx.engine.steer(blocks).finally(() => ctx.screen.request());
		return;
	}
	ctx.transcript.user(shown);
	ctx.runTurn(blocks);
}
function finishTurnResult(ctx, res) {
	if (res.usage) {
		ctx.totals.input += res.usage.inputTokens ?? 0;
		ctx.totals.output += res.usage.outputTokens ?? 0;
		ctx.totals.cached += res.usage.cachedReadTokens ?? 0;
		ctx.totals.cacheWrite = (ctx.totals.cacheWrite ?? 0) + (res.usage.cachedWriteTokens ?? 0) + (res.usage.cachedWrite1hTokens ?? 0);
		ctx.totals.turns++;
	}
	const cancelled = res.stopReason === "cancelled";
	ctx.transcript.endTurn(cancelled);
	if (cancelled) ctx.transcript.notice("interrupted");
	else if (res.stopReason === "max_tokens") ctx.transcript.notice("stopped: the model hit its output limit", theme.warning);
	else if (res.stopReason === "max_turn_requests") ctx.transcript.notice("stopped: step limit reached · send a message to continue", theme.warning);
	return cancelled;
}
function applySessionUpdate(ctx, u) {
	const kind = u?.sessionUpdate;
	if (kind === "usage_update") {
		if (typeof u.used === "number") ctx.usage.used = u.used;
		if (typeof u.size === "number") ctx.usage.size = u.size;
		if (typeof u.cost?.amount === "number") ctx.usage.cost = u.cost.amount;
		return ctx.screen.request();
	}
	if (kind === "config_option_update") {
		if (Array.isArray(u.configOptions)) ctx.engine.configOptions = u.configOptions;
		ctx.refreshSessionProvider();
		return ctx.screen.request();
	}
	if (kind === "available_commands_update") {
		if (Array.isArray(u.availableCommands)) ctx.commands = mergeAgentCommands(TUI_COMMANDS, u.availableCommands);
		return;
	}
	if (ctx.silent) return;
	if (kind === "user_message_chunk" && u._meta?.steering) {
		const text = String(u.content?.text ?? "");
		const q = ctx.queued.find((item) => !item.consumed && item.sentText === text);
		if (q) {
			q.consumed = true;
			ctx.queued = ctx.queued.filter((item) => item !== q);
			ctx.transcript.user(q.shown);
			return ctx.screen.request();
		}
	}
	ctx.transcript.handleUpdate(u);
	ctx.screen.request();
}
// src/tui/components.ts
function tildePath(p) {
	const h = homedir();
	return p === h ? "~" : p.startsWith(h + "/") ? `~${p.slice(h.length)}` : p;
}
/** Rounded box around `body` rows (each already ≤ inner width). Optional title in the top border. */
function box(body, width, opts = {}) {
	const b = opts.border ?? theme.border;
	const padX = opts.padX ?? 1;
	const inner = Math.max(1, width - 2 - padX * 2);
	const out = [];
	if (opts.title) {
		const t = truncateAnsi(` ${opts.title} `, Math.max(1, width - 4));
		out.push(b("╭─") + t + b("─".repeat(Math.max(0, width - 3 - strWidth(t))) + "╮"));
	} else out.push(b(`╭${"─".repeat(Math.max(0, width - 2))}╮`));
	const pad = " ".repeat(padX);
	for (const r of body) out.push(b("│") + pad + padEndAnsi(r, inner) + pad + b("│"));
	out.push(b(`╰${"─".repeat(Math.max(0, width - 2))}╯`));
	return out;
}
/** User message in scrollback: accent bar + wrapped text. */
function renderUserMessage(text, width) {
	const bar = theme.accent("▌") + " ";
	return wrapAnsi(text.replace(/\r\n?/g, "\n").replace(/\s+$/, "").split("\n").map((l) => sanitizeLine(l, 2)).join("\n") || " ", width, {
		firstIndent: bar,
		indent: bar
	});
}
function renderNotice(text, width, color = theme.muted) {
	return wrapAnsi(color(text.replace(/\r\n?/g, "\n").split("\n").map((l) => sanitizeLine(l, 2)).join("\n")), width, {
		firstIndent: "  ",
		indent: "  "
	});
}
/** Inner width available to the editor text inside the input box. */
function inputTextWidth(width) {
	return Math.max(4, width - 6);
}
/** Input box rows + cursor position (row index into the returned rows, column). */
function renderInputBox(o) {
	const w = o.width;
	const textW = inputTextWidth(w);
	const maxRows = o.maxRows ?? 10;
	const lay = o.layout;
	let first = 0;
	if (lay.rows.length > maxRows) {
		first = Math.min(Math.max(0, lay.cursorRow - maxRows + 1), lay.rows.length - maxRows);
		if (lay.cursorRow < first) first = lay.cursorRow;
	}
	const visible = lay.rows.slice(first, first + maxRows);
	const prompt = theme.accent(o.promptGlyph ?? "›");
	const body = [];
	if (o.isEmpty) body.push(`${prompt} ${theme.subtle(truncateAnsi(o.placeholder ?? "", textW))}`);
	else visible.forEach((r, i) => {
		const lead = i === 0 && first === 0 ? `${prompt} ` : "  ";
		body.push(lead + r.text);
	});
	const border = o.active === false ? theme.subtle : theme.border;
	const rows = box(body, w, { border });
	if (first > 0) rows[0] = border("╭") + truncateAnsi(theme.subtle(` ↑ ${first} more `) + border("─".repeat(w)), w - 2, "") + border("╮");
	return {
		rows,
		cursor: {
			row: 1 + (o.isEmpty ? 0 : lay.cursorRow - first),
			col: 4 + (o.isEmpty ? 0 : lay.cursorCol)
		}
	};
}
function renderStatusLine(s, width) {
	const modeColor = theme.mode[s.mode] ?? theme.muted;
	const leftParts = [s.provider, s.model].filter(Boolean);
	let left = `  ${modeColor("●")} ${modeColor(s.mode)}${leftParts.length ? theme.muted(" · " + leftParts.join(" · ")) : ""}`;
	let right = "";
	if (s.hint) right = theme.muted(s.hint);
	else {
		const parts = [];
		if (s.size && s.size > 0) {
			const used = s.used ?? 0;
			parts.push(`${formatTokens(used)}/${formatTokens(s.size)}`);
			parts.push(`${Math.min(100, Math.round(used / s.size * 100))}%`);
		}
		if (s.cost && s.cost > 0) parts.push(formatCost(s.cost));
		right = theme.muted(parts.join(" · "));
	}
	const rw = strWidth(right);
	const room = width - rw - 3;
	if (room < 12) return truncateAnsi(left, width);
	left = truncateAnsi(left, room);
	const gap = Math.max(1, width - strWidth(left) - rw - 1);
	return truncateAnsi(left + " ".repeat(gap) + right, width);
}
/** A selectable list with a scrolling window; returns rows (no box). */
function renderChoiceList(items, selected, width, maxRows = 10, numbered = false) {
	if (!items.length) return [theme.muted("  no matches")];
	const all = [];
	let lastGroup;
	items.forEach((it, i) => {
		if (it.group && it.group !== lastGroup) {
			all.push({ text: theme.subtle(truncateAnsi(it.group, width)) });
			lastGroup = it.group;
		}
		const sel = i === selected;
		const mark = sel ? theme.accent("›") : " ";
		const num = numbered ? `${i + 1}. ` : "";
		const cur = it.current ? theme.success(" ●") : "";
		const label = sel ? style.bold(it.label) : it.label;
		const detail = it.detail ? theme.muted(`  ${it.detail}`) : "";
		all.push({
			text: truncateAnsi(`${mark} ${num}${label}${cur}${detail}`, width),
			item: i
		});
	});
	const selRow = Math.max(0, all.findIndex((r) => r.item === selected));
	if (all.length <= maxRows) return all.map((r) => r.text);
	let start = Math.max(0, selRow - Math.floor(maxRows / 2));
	start = Math.min(start, all.length - maxRows);
	const win = all.slice(start, start + maxRows).map((r) => r.text);
	if (start > 0) win[0] = theme.subtle(`  ↑ ${start} more`);
	if (start + maxRows < all.length) win[win.length - 1] = theme.subtle(`  ↓ ${all.length - start - maxRows} more`);
	return win;
}
/** Permission / confirmation dialog: rounded box with title, preview rows and numbered options. */
function renderDialog(o) {
	const inner = Math.max(10, o.width - 4);
	const body = [];
	if (o.preview.length) {
		body.push("");
		body.push(...o.preview.map((r) => truncateAnsi(r, inner)));
	}
	body.push("");
	o.options.forEach((opt, i) => {
		const sel = i === o.selected;
		const text = `${sel ? theme.accent("›") : " "} ${theme.muted(`${i + 1}.`)} ${sel ? style.bold(opt) : opt}`;
		body.push(truncateAnsi(text, inner));
	});
	const rows = box(body, o.width, {
		title: style.bold(o.title),
		border: theme.accentSoft
	});
	rows.push(truncateAnsi(`  ${theme.subtle(o.footer ?? "↑↓ select · enter confirm · esc no")}`, o.width));
	return rows;
}
function renderPicker(p) {
	const inner = Math.max(10, p.width - 4);
	const filterRow = `${theme.accent("›")} ${p.filter || theme.subtle("type to filter")}`;
	const list = renderChoiceList(p.items, p.selected, inner, p.maxRows ?? 10);
	const rows = box([
		truncateAnsi(filterRow, inner),
		"",
		...list
	], p.width, { title: style.bold(p.title) });
	rows.push(truncateAnsi(`  ${theme.subtle(p.footer ?? "↑↓ select · enter choose · esc close")}`, p.width));
	return {
		rows,
		cursor: {
			row: 1,
			col: 4 + strWidth(p.filter)
		}
	};
}
/** Suggestions popup under the input box. */
function renderSuggestions(items, selected, width, maxRows = 8) {
	if (!items.length) return [];
	const labelW = Math.min(28, Math.max(...items.map((i) => strWidth(i.label))) + 2);
	let start = 0;
	if (items.length > maxRows) start = Math.min(Math.max(0, selected - maxRows + 1), items.length - maxRows);
	return items.slice(start, start + maxRows).map((it, k) => {
		const sel = start + k === selected;
		const label = padEndAnsi(it.label, labelW);
		const text = `  ${sel ? theme.accent(label) : label}${it.detail ? theme.muted(it.detail) : ""}`;
		return truncateAnsi(sel ? style.bold(text) : text, width);
	});
}
var isWordChar = (ch) => /[\p{L}\p{N}_]/u.test(ch);
function cpWidth(ch) {
	return charWidth(ch.codePointAt(0));
}
function cleanEditorText(s) {
	return s.replace(/\r\n?/g, "\n").replace(/\t/g, "  ").replace(/[\x00-\x08\x0b-\x1f\x7f]/g, "");
}
var History = class {
	file;
	cap;
	items = [];
	constructor(file, cap = 500) {
		this.file = file;
		this.cap = cap;
		if (file && existsSync(file)) {
			try {
				for (const line of readFileSync(file, "utf8").split("\n")) {
					if (!line.trim()) continue;
					try {
						const v = JSON.parse(line);
						if (typeof v?.text === "string" && v.text) this.items.push(v.text);
					} catch {}
				}
			} catch {}
			if (this.items.length > cap) this.items = this.items.slice(-cap);
		}
	}
	get entries() {
		return this.items;
	}
	add(text) {
		const t = text.trimEnd();
		if (!t.trim()) return;
		if (this.items[this.items.length - 1] === t) return;
		this.items.push(t);
		const overflow = this.items.length > this.cap;
		if (overflow) this.items = this.items.slice(-this.cap);
		if (!this.file) return;
		try {
			mkdirSync(dirname(this.file), { recursive: true });
			if (overflow) writeFileSync(this.file, this.items.map((x) => JSON.stringify({ text: x })).join("\n") + "\n", { mode: 384 });
			else appendFileSync(this.file, JSON.stringify({
				text: t,
				ts: Date.now()
			}) + "\n", { mode: 384 });
		} catch {}
	}
};
var InputEditor = class {
	history;
	text = "";
	cursor = 0;
	chips = /* @__PURE__ */ new Map();
	chipSeq = 0;
	histIdx = -1;
	draft = "";
	constructor(history = new History()) {
		this.history = history;
	}
	get isEmpty() {
		return this.text.length === 0;
	}
	setText(t, cursor) {
		const clean = cleanEditorText(t);
		this.text = clean;
		this.cursor = Math.max(0, Math.min(cursor ?? clean.length, clean.length));
	}
	clear() {
		this.text = "";
		this.cursor = 0;
		this.chips.clear();
		this.histIdx = -1;
		this.draft = "";
	}
	insert(s) {
		if (!s) return;
		const clean = cleanEditorText(s);
		this.text = this.text.slice(0, this.cursor) + clean + this.text.slice(this.cursor);
		this.cursor += clean.length;
		this.histIdx = -1;
	}
	/** Bracketed paste: small pastes are inserted as text, big ones as a chip. */
	paste(s) {
		const t = s.replace(/\r\n?/g, "\n");
		const lines = t.split("\n").length;
		if (lines > 8 || t.length > 800) {
			this.chipSeq++;
			const label = lines > 1 ? `${lines} lines` : `${t.length} chars`;
			const token = this.chipSeq > 1 ? `[pasted #${this.chipSeq} ${label}]` : `[pasted ${label}]`;
			this.chips.set(token, t);
			this.insert(token);
			return;
		}
		this.insert(t);
	}
	/** Buffer text with paste chips expanded (what gets sent). */
	expandedText() {
		let out = this.text;
		for (const [token, full] of this.chips) out = out.split(token).join(full);
		return out;
	}
	prevIndex(i) {
		if (i <= 0) return 0;
		const c = this.text.charCodeAt(i - 1);
		if (c >= 56320 && c <= 57343 && i >= 2) return i - 2;
		return i - 1;
	}
	nextIndex(i) {
		if (i >= this.text.length) return this.text.length;
		const c = this.text.charCodeAt(i);
		if (c >= 55296 && c <= 56319) return Math.min(this.text.length, i + 2);
		return i + 1;
	}
	backspace() {
		if (this.cursor === 0) return;
		const before = this.text.slice(0, this.cursor);
		for (const token of this.chips.keys()) if (before.endsWith(token)) {
			this.text = before.slice(0, -token.length) + this.text.slice(this.cursor);
			this.cursor -= token.length;
			this.chips.delete(token);
			return;
		}
		const p = this.prevIndex(this.cursor);
		this.text = this.text.slice(0, p) + this.text.slice(this.cursor);
		this.cursor = p;
	}
	deleteForward() {
		if (this.cursor >= this.text.length) return;
		const n = this.nextIndex(this.cursor);
		this.text = this.text.slice(0, this.cursor) + this.text.slice(n);
	}
	left() {
		this.cursor = this.prevIndex(this.cursor);
	}
	right() {
		this.cursor = this.nextIndex(this.cursor);
	}
	wordLeftIndex() {
		let i = this.cursor;
		while (i > 0 && !isWordChar(this.text[i - 1])) i--;
		while (i > 0 && isWordChar(this.text[i - 1])) i--;
		return i;
	}
	wordLeft() {
		this.cursor = this.wordLeftIndex();
	}
	wordRight() {
		let i = this.cursor;
		const n = this.text.length;
		while (i < n && !isWordChar(this.text[i])) i++;
		while (i < n && isWordChar(this.text[i])) i++;
		this.cursor = i;
	}
	lineStart() {
		const i = this.text.lastIndexOf("\n", this.cursor - 1);
		return i < 0 ? 0 : i + 1;
	}
	lineEndIdx() {
		const i = this.text.indexOf("\n", this.cursor);
		return i < 0 ? this.text.length : i;
	}
	home() {
		this.cursor = this.lineStart();
	}
	end() {
		this.cursor = this.lineEndIdx();
	}
	/** Ctrl+W / Alt+Backspace: delete the word before the cursor. */
	deleteWordBack() {
		const i = this.wordLeftIndex();
		this.text = this.text.slice(0, i) + this.text.slice(this.cursor);
		this.cursor = i;
	}
	/** Ctrl+U: delete to the start of the line (or the previous newline when already there). */
	killToStart() {
		let s = this.lineStart();
		if (s === this.cursor && s > 0) s -= 1;
		this.text = this.text.slice(0, s) + this.text.slice(this.cursor);
		this.cursor = s;
	}
	/** Ctrl+K: delete to the end of the line (or the newline when already there). */
	killToEnd() {
		let e = this.lineEndIdx();
		if (e === this.cursor && e < this.text.length) e += 1;
		this.text = this.text.slice(0, this.cursor) + this.text.slice(e);
	}
	newline() {
		this.insert("\n");
	}
	/**
	* Soft-wrap the buffer to `width` columns (word wrap; long words hard-break). One column is kept free so the
	* cursor can sit after the last character of a full row.
	*/
	layout(width) {
		const avail = Math.max(2, width - 1);
		const rows = [];
		let pos = 0;
		const lines = this.text.split("\n");
		for (let li = 0; li < lines.length; li++) {
			const line = lines[li];
			const chars = Array.from(line);
			let rowStartChar = 0;
			let rowStartPos = pos;
			let w = 0;
			let lastSpace = -1;
			let lastSpacePos = 0;
			let cpos = pos;
			const push = (endChar, endPos, isEnd) => {
				rows.push({
					start: rowStartPos,
					end: endPos,
					text: chars.slice(rowStartChar, endChar).join(""),
					lineEnd: isEnd
				});
			};
			for (let ci = 0; ci < chars.length; ci++) {
				const ch = chars[ci];
				const cw = cpWidth(ch);
				if (w + cw > avail && ci > rowStartChar) {
					if (lastSpace >= rowStartChar && lastSpace < ci) {
						push(lastSpace + 1, lastSpacePos + 1, false);
						rowStartChar = lastSpace + 1;
						rowStartPos = lastSpacePos + 1;
					} else {
						push(ci, cpos, false);
						rowStartChar = ci;
						rowStartPos = cpos;
					}
					w = 0;
					for (let k = rowStartChar; k < ci; k++) w += cpWidth(chars[k]);
					lastSpace = -1;
				}
				if (ch === " ") {
					lastSpace = ci;
					lastSpacePos = cpos;
				}
				w += cw;
				cpos += ch.length;
			}
			push(chars.length, cpos, true);
			pos = cpos + 1;
		}
		let cursorRow = rows.length - 1;
		for (let r = 0; r < rows.length; r++) {
			const row = rows[r];
			if (this.cursor >= row.start && (this.cursor < row.end || this.cursor === row.end && row.lineEnd)) {
				cursorRow = r;
				break;
			}
		}
		const row = rows[cursorRow];
		const cursorCol = strCols(this.text.slice(row.start, Math.min(this.cursor, row.end)));
		return {
			rows,
			cursorRow,
			cursorCol
		};
	}
	/** Move the cursor one visual row up/down at the same column. Returns false when already on the first/last row. */
	moveVertical(dir, width) {
		const lay = this.layout(width);
		const target = lay.cursorRow + dir;
		if (target < 0 || target >= lay.rows.length) return false;
		const row = lay.rows[target];
		let col = 0;
		let idx = row.start;
		for (const ch of Array.from(row.text)) {
			const cw = cpWidth(ch);
			if (col + cw > lay.cursorCol) break;
			col += cw;
			idx += ch.length;
		}
		if (!row.lineEnd && idx >= row.end) idx = this.prevIndexFrom(row.end);
		this.cursor = idx;
		return true;
	}
	prevIndexFrom(i) {
		const save = this.cursor;
		this.cursor = i;
		const p = this.prevIndex(i);
		this.cursor = save;
		return p;
	}
	/** History ↑: returns false when there is nothing older. */
	historyPrev() {
		const items = this.history.entries;
		if (!items.length) return false;
		if (this.histIdx === -1) {
			this.draft = this.text;
			this.histIdx = items.length - 1;
		} else if (this.histIdx > 0) this.histIdx--;
		else return false;
		const t = cleanEditorText(items[this.histIdx]);
		this.text = t;
		this.cursor = t.length;
		return true;
	}
	/** History ↓: back toward the draft. */
	historyNext() {
		if (this.histIdx === -1) return false;
		const items = this.history.entries;
		if (this.histIdx < items.length - 1) {
			this.histIdx++;
			this.text = cleanEditorText(items[this.histIdx]);
		} else {
			this.histIdx = -1;
			this.text = cleanEditorText(this.draft);
		}
		this.cursor = this.text.length;
		return true;
	}
	/** The `@token` or `/command` being typed at the cursor, for suggestions. */
	currentToken() {
		const before = this.text.slice(0, this.cursor);
		if (before.startsWith("/") && !/\s/.test(before)) return {
			kind: "/",
			query: before.slice(1),
			start: 0
		};
		const m = /(^|\s)@([^\s]*)$/.exec(before);
		if (m) return {
			kind: "@",
			query: m[2],
			start: before.length - m[2].length - 1
		};
		return null;
	}
	/** Replace the token starting at `start` up to the cursor with `replacement`. */
	replaceToken(start, replacement) {
		this.text = this.text.slice(0, start) + replacement + this.text.slice(this.cursor);
		this.cursor = start + replacement.length;
	}
};
function strCols(s) {
	let w = 0;
	for (const ch of s) w += cpWidth(ch);
	return w;
}
// src/tui/engine.ts
var Engine = class {
	handlers;
	terminals = new TerminalHost();
	conn;
	sessionId;
	configOptions = [];
	cwd;
	constructor(env, version, cwd, handlers) {
		this.handlers = handlers;
		this.cwd = cwd;
		const agentApp = createOlympusAgentApp({
			env,
			version
		});
		this.terminals.onChange = (t) => handlers.onTerminalChange?.(t);
		const app = client({ name: "oly-tui" }).onNotification(methods.client.session.update, ({ params }) => {
			const p = params;
			handlers.onUpdate(p.update, String(p.sessionId ?? ""));
		}).onNotification(methods.client.auth.statusUpdate, () => {}).onRequest(methods.client.session.requestPermission, async ({ params, signal }) => {
			const p = params;
			return { outcome: await handlers.onPermission({
				sessionId: String(p.sessionId ?? ""),
				toolCall: p.toolCall ?? {},
				options: Array.isArray(p.options) ? p.options : []
			}, signal) };
		}).onRequest(methods.client.terminal.create, async ({ params }) => {
			const p = params;
			return this.terminals.create(p, this.cwd);
		}).onRequest(methods.client.terminal.output, async ({ params }) => {
			const p = params;
			return this.terminals.output(String(p.terminalId));
		}).onRequest(methods.client.terminal.waitForExit, async ({ params, signal }) => {
			const p = params;
			return await this.terminals.waitForExit(String(p.terminalId), signal);
		}).onRequest(methods.client.terminal.kill, async ({ params }) => {
			const p = params;
			this.terminals.kill(String(p.terminalId));
			return {};
		}).onRequest(methods.client.terminal.release, async ({ params }) => {
			const p = params;
			this.terminals.release(String(p.terminalId));
			return {};
		});
		this.conn = app.connect(agentApp);
	}
	async initialize() {
		return this.conn.agent.request(methods.agent.initialize, {
			protocolVersion: 1,
			clientCapabilities: { terminal: true },
			clientInfo: {
				name: "oly-tui",
				version: "0.2.0"
			}
		});
	}
	async authStatus() {
		const res = await this.conn.agent.request(methods.agent.auth.status, {});
		return {
			state: String(res?.state ?? "unauthenticated"),
			accounts: Array.isArray(res?.accounts) ? res.accounts : []
		};
	}
	async newSession(configOptions) {
		const res = await this.conn.agent.request(methods.agent.session.new, {
			cwd: this.cwd,
			mcpServers: [],
			...configOptions?.length ? { configOptions } : {}
		});
		this.sessionId = String(res.sessionId);
		this.configOptions = Array.isArray(res.configOptions) ? res.configOptions : [];
		return this.sessionId;
	}
	async loadSession(sessionId) {
		const res = await this.conn.agent.request(methods.agent.session.load, {
			sessionId,
			cwd: this.cwd,
			mcpServers: []
		});
		this.sessionId = sessionId;
		this.configOptions = Array.isArray(res?.configOptions) ? res.configOptions : [];
	}
	async closeSession() {
		if (!this.sessionId) return;
		const id = this.sessionId;
		await this.conn.agent.request(methods.agent.session.close, { sessionId: id }).catch(() => {});
	}
	async listSessions() {
		const res = await this.conn.agent.request(methods.agent.session.list, { cwd: this.cwd });
		return Array.isArray(res?.sessions) ? res.sessions : [];
	}
	async refreshOptions() {
		const res = await this.conn.agent.request(methods.agent.session.options, this.sessionId ? { sessionId: this.sessionId } : { cwd: this.cwd });
		if (Array.isArray(res?.configOptions)) this.configOptions = res.configOptions;
	}
	async prompt(blocks) {
		if (!this.sessionId) throw new Error("No session");
		return await this.conn.agent.request(methods.agent.session.prompt, {
			sessionId: this.sessionId,
			prompt: blocks
		});
	}
	async cancel() {
		if (!this.sessionId) return;
		await this.conn.agent.notify(methods.agent.session.cancel, { sessionId: this.sessionId });
	}
	/** Mid-turn steering. `injected` = queued for the next step; `promptRequired` = no turn is running. */
	async steer(blocks) {
		if (!this.sessionId) return "failed";
		return (await this.conn.agent.request("_session/steering", {
			sessionId: this.sessionId,
			prompt: blocks
		}))?.outcome ?? "failed";
	}
	async setConfig(configId, value) {
		if (!this.sessionId) return;
		const res = await this.conn.agent.request(methods.agent.session.setConfigOption, {
			sessionId: this.sessionId,
			configId,
			value
		});
		if (Array.isArray(res?.configOptions)) this.configOptions = res.configOptions;
	}
	option(id) {
		return this.configOptions.find((o) => o.id === id);
	}
	/** Flattened model choices with their group names. */
	modelChoices() {
		const opt = this.option("model");
		if (!opt) return [];
		const out = [];
		for (const o of opt.options) if ("group" in o && Array.isArray(o.options)) for (const x of o.options) out.push({
			...x,
			group: o.name
		});
		else out.push(o);
		return out;
	}
	close() {
		this.terminals.killAll();
		this.conn.close();
	}
};
/** Build initial ACP `session/new` config options from CLI `--provider`, `--model`, and `-y` flags. */
function buildInitialSessionConfig(opts) {
	const cfg = [];
	if (opts.autoApprove) cfg.push({
		configId: "mode",
		value: "auto"
	});
	const m = opts.model?.trim();
	const p = opts.providerId?.trim();
	if (p) {
		const conn = resolveConnectedProviders(inputsFromEnv(opts.env), null, false);
		const prov = conn.providers.find((x) => x.id === p);
		if (!prov) throw new Error(`Provider "${p}" is not connected (connected: ${conn.providers.map((x) => x.id).join(", ") || "none"}).`);
		const model = m ? m.includes("::") ? m.split("::").slice(1).join("::") : m : prov.endpoint.defaultModel;
		cfg.push({
			configId: "model",
			value: `${p}::${model}`
		});
	} else if (m) cfg.push({
		configId: "model",
		value: m
	});
	return cfg;
}
// src/tui/logo.ts
var SPRITE = [
	"................",
	".......CC.......",
	"..CCCCCCCCCCCC..",
	"..CC........CC..",
	"......CCCC......",
	"....OO.CC.OO....",
	"....OOO..OOO....",
	"...OOOOOOOOOO...",
	"...OOOOOOOOOO...",
	"..OOOOOOOOOOOO..",
	".OOOOOOOOOOOOOO.",
	"................"
];
var PALETTE = {
	C: [
		255,
		247,
		240
	],
	O: [
		238,
		106,
		62
	],
	".": [
		24,
		17,
		16
	]
};
var PLAIN = [
	"╭──────────────╮",
	"│ ╭────┴─────╮ │",
	"│     ▄●▄      │",
	"│    ▄███▄     │",
	"│  ▄███████▄   │",
	"╰──────────────╯"
];
/** The 16×6 emblem rows (truecolor / 256 / 16 colours via the theme's colour level; plain text at level 0). */
function renderEmblem() {
	if (colorLevel() === 0) return [...PLAIN];
	const rows = [];
	for (let r = 0; r < SPRITE.length; r += 2) {
		let row = "";
		for (let c = 0; c < 16; c++) {
			const top = SPRITE[r][c];
			const bot = SPRITE[r + 1][c];
			if (top === bot) row += style.fg(PALETTE[top])("█");
			else row += style.bg(PALETTE[bot])(style.fg(PALETTE[top])("▀"));
		}
		rows.push(row);
	}
	return rows;
}
function modeColor(mode) {
	return theme.mode[mode] ?? theme.muted;
}
var HERO_HINT = "/ commands · @ files · ! shell · shift+tab mode · /copy";
/** Widest metadata column next to the emblem (keeps the hero a centred block on wide terminals). */
var HERO_META_MAX = 56;
/** Keep the end of a plain string (paths): `…/olympus-coder-cli · main`. */
function truncateStart(s, width) {
	if (strWidth(s) <= width) return s;
	if (width < 1) return "";
	const chars = Array.from(s);
	let out = "";
	let w = 0;
	for (let i = chars.length - 1; i >= 0; i--) {
		const cw = strWidth(chars[i]);
		if (w + cw > width - 1) break;
		out = chars[i] + out;
		w += cw;
	}
	return "…" + out;
}
function placeLabel(cwd, branch, width) {
	return truncateStart(sanitizeLine(tildePath(cwd) + (branch ? ` · ${branch}` : ""), 1), width);
}
/** Metadata column next to (or under) the emblem: exactly 6 rows, each ≤ `room`. */
function heroMeta(info, room) {
	const conn = info.notConnected ? `${theme.warning("No provider connected")}${theme.muted(" · run ")}${theme.accent("/login")}${theme.muted(" to add one")}` : [info.provider, info.model].filter(Boolean).join(theme.muted(" · ")) + theme.muted(" · ") + modeColor(info.mode)(info.mode);
	return [
		"",
		`${style.bold(theme.cream("OLYMPUS"))}  ${theme.subtle(`v${info.version}`)}`,
		conn,
		theme.muted(placeLabel(info.cwd, info.branch, room)),
		theme.subtle(HERO_HINT),
		""
	].map((r) => truncateAnsi(r, room));
}
/** Welcome hero: emblem + metadata side by side (≥ 56 cols), stacked when narrow, emblem dropped below 24 cols. */
function renderHero(info, width) {
	const w = Math.max(1, width);
	if (w >= 56) {
		const meta = heroMeta(info, Math.min(HERO_META_MAX, w - 16 - 3));
		return renderEmblem().map((e, i) => truncateAnsi(`${e}   ${meta[i]}`, w));
	}
	const text = heroMeta(info, w).slice(1, 5);
	if (w < 24) return text;
	const pad = " ".repeat(Math.floor((w - 16) / 2));
	return [
		...renderEmblem().map((e) => pad + e),
		"",
		...text
	];
}
/** 5×2 mini Olympus Mons mark (cream curly-brace cloud over terracotta-orange flanks + cream caldera orb). */
function renderMiniEmblem() {
	return [theme.cream("╭─┴─╮"), theme.accent("▄▟") + theme.cream("●") + theme.accent("▙▄")];
}
/** Three rows pinned to the top of the full-screen app: 2-row Olympus Mons mini emblem + brand/title/path, then a hairline. */
function renderTopBar(info, width) {
	const w = Math.max(1, width);
	const [m0, m1] = renderMiniEmblem();
	const brand = `${style.bold(theme.cream("OLYMPUS"))} ${theme.subtle("v" + info.version)}`;
	const titleClean = info.title ? sanitizeLine(info.title.replace(/\s+/g, " "), 1).trim() : "";
	const place = sanitizeLine(tildePath(info.cwd) + (info.branch ? ` · ${info.branch}` : ""), 1);
	if (w < 18) return [
		padEndAnsi(truncateAnsi(brand, w), w),
		padEndAnsi(truncateAnsi(theme.muted(truncateStart(place, w)), w), w),
		theme.border("─".repeat(w))
	];
	const lead0 = `  ${m0}  ${brand}`;
	const titleRoom = w - strWidth(lead0) - 2;
	const row0 = `${lead0}${titleClean && titleRoom > 4 ? theme.muted(truncateAnsi(` · ${titleClean}`, titleRoom)) : ""}`;
	const placeRoom = Math.max(1, w - 11);
	const row1 = `  ${m1}  ${theme.muted(truncateStart(place, placeRoom))}`;
	return [
		padEndAnsi(truncateAnsi(row0, w), w),
		padEndAnsi(truncateAnsi(row1, w), w),
		theme.border("─".repeat(w))
	];
}
// src/tui/frame.ts
function renderSpinnerRow(s, now) {
	const secs = formatDuration(now - s.turnStartedAt);
	const toks = Math.round(s.transcript.streamedChars / 4);
	const meta = [
		secs,
		...toks > 0 ? [`↓ ${formatTokens(toks)} tokens`] : [],
		"esc to interrupt"
	].join(" · ");
	const label = s.overlay?.type === "permission" ? "Waiting for approval" : s.transcript.activity();
	const left = `  ${theme.accent(s.transcript.spinner(now))} ${label}`;
	const room = s.width - strWidth(left) - 3;
	return truncateAnsi(left + (room > 8 ? theme.muted(` · ${truncateAnsi(meta, room)}`) : ""), s.width);
}
var SCROLL_HINT = "↓ scrolled up · PgDn / wheel / End to follow";
/** Status line used by both composers. */
function statusRow(s) {
	return renderStatusLine({
		mode: s.mode,
		...s.noProvider ? { provider: "not connected" } : {
			provider: s.provider,
			model: s.model
		},
		used: s.usage.used,
		size: s.usage.size,
		cost: s.usage.cost,
		...s.hint ? { hint: s.hint } : {}
	}, s.width);
}
/** Bottom dock: spinner, queued steering, scroll hint, dialog / picker / (suggestions + input box), status bar. */
function composeDock(s, now, scrolled, maxRows) {
	const w = s.width;
	const rows = [];
	let cursor = null;
	if (s.running) rows.push(renderSpinnerRow(s, now));
	for (const shown of s.queuedShown) rows.push(truncateAnsi(`  ${theme.muted("↳ queued: ")}${theme.subtle(shown.replace(/\s+/g, " "))}`, w));
	if (scrolled) rows.push(truncateAnsi(`  ${theme.accent("↓")} ${theme.muted(SCROLL_HINT.slice(2))}`, w));
	const room = Math.max(4, maxRows - rows.length - 1);
	if (s.overlay?.type === "permission") rows.push(...renderDialog({
		...s.overlay,
		width: w
	}));
	else if (s.overlay?.type === "picker") {
		const p = s.overlay;
		const items = filteredPickerItems(p);
		const view = renderPicker({
			title: p.title,
			filter: p.filter,
			items,
			selected: Math.min(p.selected, Math.max(0, items.length - 1)),
			width: w,
			maxRows: Math.max(3, Math.min(12, room - 5))
		});
		cursor = {
			row: rows.length + view.cursor.row,
			col: view.cursor.col
		};
		rows.push(...view.rows);
	} else {
		if (s.suggestions?.items.length) rows.push(...renderSuggestions(s.suggestions.items, s.suggestions.selected, w, Math.max(2, Math.min(8, room - 4))));
		const box = renderInputBox({
			width: w,
			layout: s.editor.layout(inputTextWidth(w)),
			isEmpty: s.editor.isEmpty,
			placeholder: s.placeholder,
			maxRows: Math.max(1, Math.min(10, room - 2))
		});
		cursor = {
			row: rows.length + box.cursor.row,
			col: box.cursor.col
		};
		rows.push(...box.rows);
	}
	rows.push(statusRow(s));
	if (rows.length > maxRows) {
		const cut = rows.length - maxRows;
		rows.splice(0, cut);
		cursor = cursor && cursor.row >= cut ? {
			row: cursor.row - cut,
			col: cursor.col
		} : null;
	}
	return {
		rows,
		cursor
	};
}
/** Scrollbar glyph for viewport row `i`. */
function scrollbarGlyph(i, vp, total, start) {
	const thumb = Math.max(1, Math.round(vp * vp / total));
	const maxStart = Math.max(1, total - vp);
	const top = Math.round(start / maxStart * (vp - thumb));
	return i >= top && i < top + thumb ? theme.muted("┃") : theme.subtle("│");
}
function composeFullFrame(s) {
	const now = s.now ?? Date.now();
	const w = s.width;
	const h = Math.max(4, s.height);
	const top = renderTopBar(s.topBar, w);
	const maxDock = Math.max(1, h - 3 - 1);
	const live = s.transcript.liveRows(now);
	if (!(s.hasConversation || s.running || live.length > 0 || s.overlay !== null)) {
		const dock = composeDock(s, now, false, maxDock);
		const mid = h - 3 - dock.rows.length;
		const hero = renderHero(s.hero, w);
		const shown = hero.length <= mid ? hero : [];
		const heroW = Math.max(0, ...shown.map(strWidth));
		const left = " ".repeat(Math.max(0, Math.floor((w - heroW) / 2)));
		const padTop = Math.max(0, Math.floor((mid - shown.length) / 2));
		const middle = Array.from({ length: mid }, () => "");
		shown.forEach((r, i) => middle[padTop + i] = truncateAnsi(left + r, w));
		const cursor = dock.cursor ? {
			row: 3 + mid + dock.cursor.row,
			col: dock.cursor.col
		} : null;
		return {
			frame: {
				rows: [
					...top,
					...middle,
					...dock.rows
				],
				cursor
			},
			scrollOffset: 0,
			total: 0,
			viewportHeight: mid
		};
	}
	const total = s.committedRows.length + live.length;
	let want = Math.max(0, s.scrollOffset);
	if (want > 0 && s.prevTotal > 0 && total > s.prevTotal) want += total - s.prevTotal;
	let dock = composeDock(s, now, false, maxDock);
	let vp = Math.max(1, h - 3 - dock.rows.length);
	let offset = Math.min(want, Math.max(0, total - vp));
	if (offset > 0) {
		dock = composeDock(s, now, true, maxDock);
		vp = Math.max(1, h - 3 - dock.rows.length);
		offset = Math.min(want, Math.max(0, total - vp));
	}
	const start = Math.max(0, total - vp - offset);
	const at = (i) => i < s.committedRows.length ? s.committedRows[i] : live[i - s.committedRows.length];
	const overflow = total > vp;
	const view = [];
	for (let i = 0; i < vp; i++) {
		const idx = start + i;
		const row = idx < total ? at(idx) ?? "" : "";
		view.push(overflow ? padEndAnsi(truncateAnsi(row, w - 2), w - 2) + " " + scrollbarGlyph(i, vp, total, start) : truncateAnsi(row, w));
	}
	const cursor = dock.cursor ? {
		row: 3 + vp + dock.cursor.row,
		col: dock.cursor.col
	} : null;
	return {
		frame: {
			rows: [
				...top,
				...view,
				...dock.rows
			],
			cursor
		},
		scrollOffset: offset,
		total,
		viewportHeight: vp
	};
}
// src/tui/keymap.ts
/** Viewport scrolling keys: wheel ±3, PgUp/PgDn ±70% of the viewport, Shift+↑/↓ ±1. True when handled. */
function scrollKey(v, k) {
	if (k.name === "wheelup" || k.name === "wheeldown") v.scrollBy(k.name === "wheelup" ? 3 : -3);
	else if (k.name === "pageup" || k.name === "pagedown") v.scrollBy((k.name === "pageup" ? 1 : -1) * v.pageSize());
	else if ((k.name === "up" || k.name === "down") && k.shift && !k.ctrl && !k.alt) v.scrollBy(k.name === "up" ? 1 : -1);
	else return false;
	return true;
}
function dispatchEditorKey(host, k) {
	const e = host.editor;
	const width = host.textWidth;
	const sug = host.suggestions;
	if (k.name !== "text" || !isCtrl(k, "c")) host.resetCtrlC();
	if (scrollKey(host.viewport, k)) return;
	if (k.name === "end" && (k.ctrl || k.shift || e.cursor >= e.text.length) && host.viewport.follow()) return;
	if (sug && sug.items.length) {
		if (k.name === "up") {
			sug.selected = (sug.selected + sug.items.length - 1) % sug.items.length;
			return;
		}
		if (k.name === "down") {
			sug.selected = (sug.selected + 1) % sug.items.length;
			return;
		}
		if (k.name === "tab" && !k.shift) return host.acceptSuggestion(false);
		if (k.name === "enter" && !k.shift && !k.alt) return host.acceptSuggestion(true);
		if (k.name === "escape") return host.dismissSuggestions();
	}
	switch (k.name) {
		case "paste": return e.paste(k.text ?? "");
		case "enter":
			if (k.shift || k.alt) return e.newline();
			if (e.text.slice(0, e.cursor).endsWith("\\")) {
				e.backspace();
				return e.newline();
			}
			return host.submit();
		case "tab":
			if (k.shift) host.cycleMode();
			return;
		case "escape":
			if (host.isRunning) return host.interrupt();
			host.clearHint();
			return;
		case "backspace": return k.alt || k.ctrl ? e.deleteWordBack() : e.backspace();
		case "delete": return e.deleteForward();
		case "left": return k.alt || k.ctrl ? e.wordLeft() : e.left();
		case "right": return k.alt || k.ctrl ? e.wordRight() : e.right();
		case "home": return e.home();
		case "end": return e.end();
		case "up":
			if (!e.moveVertical(-1, width)) e.historyPrev();
			return;
		case "down":
			if (!e.moveVertical(1, width)) e.historyNext();
			return;
		case "text": break;
		default: return;
	}
	const t = k.text ?? "";
	if (k.ctrl && !k.alt) switch (t) {
		case "c": return host.ctrlC();
		case "d": return e.isEmpty ? host.exit() : e.deleteForward();
		case "a": return e.home();
		case "e": return e.end();
		case "b": return e.left();
		case "f": return e.right();
		case "w": return e.deleteWordBack();
		case "u": return e.killToStart();
		case "k": return e.killToEnd();
		case "j": return e.newline();
		case "l": return host.redraw();
		case "o": return host.expand();
		case "p":
			if (!e.moveVertical(-1, width)) e.historyPrev();
			return;
		case "n":
			if (!e.moveVertical(1, width)) e.historyNext();
			return;
		default: return;
	}
	if (k.alt) {
		if (t === "b") return e.wordLeft();
		if (t === "f") return e.wordRight();
		if (t === "d") {
			const start = e.cursor;
			e.wordRight();
			e.setText(e.text.slice(0, start) + e.text.slice(e.cursor), start);
		}
		return;
	}
	e.insert(t);
}
// src/tui/screen.ts
var CSI = "\x1B[";
var SYNC_START = `${CSI}?2026h`;
var SYNC_END = `${CSI}?2026l`;
var CURSOR_HIDE = `${CSI}?25l`;
var CURSOR_SHOW = `${CSI}?25h`;
var ALT_ENTER = `${CSI}?1049h`;
var ALT_LEAVE = `${CSI}?1049l`;
/** Button-event mouse reporting with SGR encoding (wheel scrolling). */
var MOUSE_ENTER = `${CSI}?1000h${CSI}?1006h`;
var MOUSE_LEAVE = `${CSI}?1006l${CSI}?1000l`;
var LiveScreen = class {
	out;
	opts;
	pending = [];
	timer;
	lastFrameAt = 0;
	/** Visual widths of the rows currently drawn in the live region (for reflow on resize). */
	drawnWidths = [];
	/** Row (inside the drawn region) the terminal cursor is on, and its column. */
	cursorRow = 0;
	cursorCol = 0;
	drawnCols;
	stopped = false;
	frameMs;
	sync;
	mode;
	/** Full-screen mode: rows currently on screen (null = unknown, redraw everything next frame). */
	prevRows = null;
	prevSize = "";
	/** Number of frames written (tests). */
	frames = 0;
	/** Rows written by the last full-screen frame (tests / diagnostics). */
	lastWrittenRows = 0;
	constructor(out, opts) {
		this.out = out;
		this.opts = opts;
		this.frameMs = opts.frameMs ?? 33;
		this.sync = opts.sync ?? true;
		this.mode = opts.mode ?? "inline";
		this.drawnCols = this.width;
	}
	get width() {
		return Math.max(20, this.out.columns || 80);
	}
	get height() {
		return Math.max(4, this.out.rows || 24);
	}
	/** Rows currently occupied by the live region. */
	get liveRowCount() {
		return this.drawnWidths.length;
	}
	/** Queue finished rows for the scrollback (printed above the live region on the next frame). */
	print(rows) {
		if (this.stopped) {
			for (const r of rows) this.out.write(r + "\n");
			return;
		}
		this.pending.push(...rows);
		this.request();
	}
	/** Schedule a redraw (throttled). */
	request() {
		if (this.stopped || this.timer) return;
		const wait = Math.max(0, this.frameMs - (Date.now() - this.lastFrameAt));
		this.timer = setTimeout(() => {
			this.timer = void 0;
			this.draw();
		}, wait);
	}
	/** Redraw immediately (cancels a scheduled frame). */
	flush() {
		if (this.timer) {
			clearTimeout(this.timer);
			this.timer = void 0;
		}
		if (!this.stopped) this.draw();
	}
	/** Terminal resized: the old region may have been reflowed by the terminal; erase it at the new width. */
	resized() {
		this.prevRows = null;
		this.flush();
	}
	/** Sequence that moves from the parked cursor to the top-left of the drawn region. */
	toRegionTop(cols) {
		let up = 0;
		for (let r = 0; r < this.cursorRow && r < this.drawnWidths.length; r++) up += cols < this.drawnCols ? Math.max(1, Math.ceil(this.drawnWidths[r] / cols)) : 1;
		if (cols < this.drawnCols) up += Math.floor(this.cursorCol / cols);
		return `\r${up > 0 ? `${CSI}${up}A` : ""}`;
	}
	draw() {
		if (this.mode === "fullscreen") return this.drawFull();
		this.lastFrameAt = Date.now();
		const cols = this.width;
		const frame = this.opts.render(cols, this.height);
		let rows = frame.rows;
		let cursor = frame.cursor;
		const max = this.height;
		if (rows.length > max) {
			const cut = rows.length - max;
			rows = rows.slice(cut);
			cursor = cursor && cursor.row >= cut ? {
				row: cursor.row - cut,
				col: cursor.col
			} : null;
		}
		let s = (this.sync ? SYNC_START : "") + CURSOR_HIDE;
		s += this.toRegionTop(cols) + `${CSI}J`;
		for (const r of this.pending) s += r + "\r\n";
		this.pending = [];
		s += rows.join("\r\n");
		const last = Math.max(0, rows.length - 1);
		let parkRow = last;
		let parkCol = 0;
		if (cursor) {
			parkRow = Math.min(cursor.row, last);
			parkCol = Math.min(cursor.col, Math.max(0, cols - 1));
		}
		const up = last - parkRow;
		if (up > 0) s += `${CSI}${up}A`;
		s += `\r${parkCol > 0 ? `${CSI}${parkCol}C` : ""}`;
		if (cursor) s += CURSOR_SHOW;
		if (this.sync) s += SYNC_END;
		this.out.write(s);
		this.frames++;
		this.drawnWidths = rows.map((r) => strWidth(r));
		this.cursorRow = parkRow;
		this.cursorCol = parkCol;
		this.drawnCols = cols;
	}
	/** Full-screen frame: exactly `height` rows, only changed rows are rewritten (absolute positioning). */
	drawFull() {
		this.lastFrameAt = Date.now();
		const cols = this.width;
		const h = this.height;
		const frame = this.opts.render(cols, h);
		const rows = frame.rows.slice(0, h);
		while (rows.length < h) rows.push("");
		const size = `${cols}x${h}`;
		const prev = this.prevRows && this.prevSize === size ? this.prevRows : null;
		let s = (this.sync ? SYNC_START : "") + CURSOR_HIDE;
		let written = 0;
		for (let r = 0; r < h; r++) {
			if (prev && prev[r] === rows[r]) continue;
			s += `${CSI}${r + 1};1H${rows[r]}${strWidth(rows[r]) < cols ? `${CSI}K` : ""}`;
			written++;
		}
		const cursor = frame.cursor && frame.cursor.row < h ? frame.cursor : null;
		const parkRow = cursor ? cursor.row : h - 1;
		const parkCol = cursor ? Math.min(cursor.col, Math.max(0, cols - 1)) : 0;
		s += `${CSI}${parkRow + 1};${parkCol + 1}H`;
		if (cursor) s += CURSOR_SHOW;
		if (this.sync) s += SYNC_END;
		this.out.write(s);
		this.frames++;
		this.lastWrittenRows = written;
		this.prevRows = rows;
		this.prevSize = size;
	}
	/** Erase the live region and leave the cursor at its top (for suspending or exiting). */
	clearLive() {
		if (this.timer) {
			clearTimeout(this.timer);
			this.timer = void 0;
		}
		let s = this.toRegionTop(this.width) + `${CSI}J`;
		for (const r of this.pending) s += r + "\r\n";
		this.pending = [];
		this.out.write(s);
		this.drawnWidths = [];
		this.cursorRow = 0;
		this.cursorCol = 0;
	}
	/** Clear the whole screen and scrollback view (Ctrl+L); the next frame starts at the top. */
	clearScreen() {
		this.prevRows = null;
		if (this.mode === "fullscreen") {
			this.out.write(`${CSI}2J${CSI}H`);
			return;
		}
		this.out.write(`${CSI}2J${CSI}3J${CSI}H`);
		this.drawnWidths = [];
		this.cursorRow = 0;
		this.cursorCol = 0;
	}
	/** Stop drawing: erase the live region and show the cursor. Rows printed later go straight to the output. */
	stop() {
		if (this.stopped) return;
		if (this.mode === "fullscreen") {
			if (this.timer) clearTimeout(this.timer);
			this.timer = void 0;
			this.prevRows = null;
			this.stopped = true;
			this.out.write(CURSOR_SHOW);
			return;
		}
		this.clearLive();
		this.stopped = true;
		this.out.write(CURSOR_SHOW);
	}
	/** Resume after `stop()` (e.g. after the login wizard ran). */
	resume() {
		this.stopped = false;
		this.prevRows = null;
		this.drawnWidths = [];
		this.cursorRow = 0;
		this.cursorCol = 0;
		this.flush();
	}
	get isStopped() {
		return this.stopped;
	}
};
// src/tui/markdown.ts
var OSC8_RE = /\x1b\]8;;([^\x07]*)\x07/g;
/** Re-assert an outer SGR wrapper after inner close codes (`\x1b[39m` / `\x1b[22m`) so nested spans keep outer colour/weight. */
function withOuterStyle(inner, paint) {
	if (!inner || colorLevel() === 0) return inner;
	const probe = paint("\0");
	const idx = probe.indexOf("\0");
	if (idx <= 0) return paint(inner);
	const open = probe.slice(0, idx);
	const close = probe.slice(idx + 1);
	let body = inner;
	if (close === "\x1B[39m") body = body.replace(/\x1b\[39m/g, `\x1b[39m${open}`);
	else if (close === "\x1B[22m") body = body.replace(/\x1b\[22m/g, `\x1b[22m${open}`);
	return `${open}${body}${close}`;
}
/** Ensure every row obeys `strWidth <= width`, contains no `\n`, and closes/re-opens OSC 8 hyperlinks cleanly per row. */
function finalizeRows(rawRows, width) {
	const w = Math.max(1, Math.floor(width));
	let activeUrl = "";
	return rawRows.map((raw) => {
		let r = raw.includes("\n") ? raw.replace(/\n/g, " ") : raw;
		if (activeUrl && colorLevel() > 0) r = `\x1b]8;;${activeUrl}\x07${r}`;
		if (strWidth(r) > w) r = truncateAnsi(r, w);
		if (colorLevel() > 0 && r.includes("\x1B]8;;")) {
			OSC8_RE.lastIndex = 0;
			let m;
			while (m = OSC8_RE.exec(r)) activeUrl = m[1];
			if (activeUrl) r += "\x1B]8;;\x07";
		}
		return r;
	});
}
var osc8Link = (styledLabel, url) => colorLevel() === 0 || !url ? styledLabel : styledLabel.split(/( +)/).map((p) => !p || /^ +$/.test(p) ? p : hyperlink(p, url)).join("");
function matchLinkAt(s, at) {
	const open = s[at] === "!" && s[at + 1] === "[" ? at + 1 : s[at] === "[" ? at : -1;
	if (open < 0) return null;
	let depth = 1;
	let i = open + 1;
	while (i < s.length && depth > 0) {
		if (s[i] === "\\") {
			i += 2;
			continue;
		}
		if (s[i] === "`") {
			const t = s.indexOf("`", i + 1);
			if (t > i) {
				i = t + 1;
				continue;
			}
		}
		if (s[i] === "[") depth++;
		else if (s[i] === "]") depth--;
		i++;
	}
	if (depth !== 0 || s[i] !== "(") return null;
	const label = s.slice(open + 1, i - 1);
	let pDepth = 1;
	let j = i + 1;
	while (j < s.length && pDepth > 0) {
		if (s[j] === "\\") {
			j += 2;
			continue;
		}
		if (s[j] === "(") pDepth++;
		else if (s[j] === ")") pDepth--;
		j++;
	}
	if (pDepth !== 0) return null;
	let url = s.slice(i + 1, j - 1).trim();
	const titled = /^(\S+)\s+["'(].*["')]$/.exec(url);
	if (titled) url = titled[1];
	if (url.startsWith("<") && url.endsWith(">")) url = url.slice(1, -1);
	return {
		label: s[at] === "!" && !label ? "image" : label,
		url,
		end: j
	};
}
function renderInline(s) {
	let out = "";
	let i = 0;
	const n = s.length;
	while (i < n) {
		const c = s[i];
		if (c === "\\" && i + 1 < n && /[\\`*_{}[\]()#+\-.!~|<>]/.test(s[i + 1])) {
			out += s[i + 1];
			i += 2;
			continue;
		}
		if (c === "`") {
			let ticks = 1;
			while (i + ticks < n && s[i + ticks] === "`") ticks++;
			const delim = "`".repeat(ticks);
			const close = s.indexOf(delim, i + ticks);
			if (close >= 0) {
				let code = s.slice(i + ticks, close);
				if (code.length >= 2 && code.startsWith(" ") && code.endsWith(" ") && code.trim()) code = code.slice(1, -1);
				out += theme.code.inline(code);
				i = close + ticks;
				continue;
			}
			out += delim;
			i += ticks;
			continue;
		}
		if (c === "<") {
			const tail = s.slice(i);
			const auto = /^<(https?:\/\/[^\s<>]+)>/.exec(tail);
			if (auto) {
				out += osc8Link(theme.md.link(auto[1]), auto[1]);
				i += auto[0].length;
				continue;
			}
			const br = /^<br\s*\/?>/i.exec(tail);
			if (br) {
				out += "\n";
				i += br[0].length;
				continue;
			}
			const tag = /^(?:<!--[\s\S]*?-->|<\/?[A-Za-z][A-Za-z0-9-]*(?:\s+[^<>]*?)?\s*\/?>)/.exec(tail);
			if (tag) {
				i += tag[0].length;
				continue;
			}
		}
		if (c === "[" || c === "!" && s[i + 1] === "[") {
			const lk = matchLinkAt(s, i);
			if (lk) {
				const linked = osc8Link(withOuterStyle(renderInline(lk.label || lk.url), theme.md.link), lk.url);
				out += lk.url && lk.label.trim() !== lk.url ? `${linked} ${style.dim(`(${lk.url})`)}` : linked;
				i = lk.end;
				continue;
			}
		}
		if ((c === "h" || c === "H") && /^https?:\/\/\S/i.test(s.slice(i)) && (i === 0 || /[\s([{<]/.test(s[i - 1]))) {
			const m = /^https?:\/\/[^\s<>]+/i.exec(s.slice(i));
			if (m) {
				let url = m[0];
				let trail = "";
				while (/[.,;:!?]$/.test(url)) {
					trail = url.slice(-1) + trail;
					url = url.slice(0, -1);
				}
				while (url.endsWith(")") && (url.match(/\(/g)?.length ?? 0) < (url.match(/\)/g)?.length ?? 0)) {
					trail = `)${trail}`;
					url = url.slice(0, -1);
				}
				out += osc8Link(theme.md.link(url), url) + trail;
				i += m[0].length;
				continue;
			}
		}
		let matched = false;
		for (const len of [3, 2]) {
			const d = len === 3 ? s.startsWith("***", i) ? "***" : s.startsWith("___", i) ? "___" : "" : s.startsWith("**", i) ? "**" : s.startsWith("__", i) ? "__" : "";
			if (d && (d[0] === "*" || i === 0 || !/\w/.test(s[i - 1]))) {
				const close = s.indexOf(d, i + len);
				if (close > i + len && (d[0] === "*" || close + len >= n || !/\w/.test(s[close + len]))) {
					const inner = renderInline(s.slice(i + len, close));
					out += withOuterStyle(len === 3 ? style.italic(inner) : inner, style.bold);
					i = close + len;
					matched = true;
					break;
				}
			}
		}
		if (matched) continue;
		if (s.startsWith("~~", i) && s[i + 2] !== "~") {
			const close = s.indexOf("~~", i + 2);
			if (close > i + 2) {
				out += style.strike(renderInline(s.slice(i + 2, close)));
				i = close + 2;
				continue;
			}
		}
		if ((c === "*" || c === "_") && s[i + 1] && s[i + 1] !== c && s[i + 1] !== " " && (c === "*" || i === 0 || !/\w/.test(s[i - 1]))) {
			let close = i + 2;
			while ((close = s.indexOf(c, close)) >= 0) {
				if (s[close - 1] !== " " && s[close - 1] !== "\\" && s[close + 1] !== c && (c === "*" || close + 1 >= n || !/\w/.test(s[close + 1]))) break;
				close++;
			}
			if (close > i + 1) {
				out += style.italic(renderInline(s.slice(i + 1, close)));
				i = close + 1;
				continue;
			}
		}
		out += c;
		i++;
	}
	return out;
}
var isBlank = (l) => /^\s*$/.test(l);
var isHr = (l) => /^\s{0,3}(?:(?:-\s*){3,}|(?:\*\s*){3,}|(?:_\s*){3,})$/.test(l);
var isQuote = (l) => /^\s{0,3}>/.test(l);
function matchOpenFence(l) {
	const m = /^\s{0,3}(`{3,}|~{3,})(.*)$/.exec(l);
	return m && !(m[1][0] === "`" && m[2].includes("`")) ? {
		ch: m[1][0],
		len: m[1].length,
		info: m[2].trim()
	} : null;
}
var isCloseFence = (l, ch, len) => {
	const m = /^\s{0,3}(`{3,}|~{3,})\s*$/.exec(l);
	return Boolean(m && m[1][0] === ch && m[1].length >= len);
};
var matchHeading = (l) => {
	const m = /^\s{0,3}(#{1,6})(?:\s+(.*?))?\s*$/.exec(l);
	return m ? {
		level: m[1].length,
		text: (m[2] ?? "").replace(/\s+#+\s*$/, "")
	} : null;
};
var matchListItem = (l) => {
	if (isHr(l)) return null;
	const m = /^(\s*)([-*+]|\d+[.)])(?:\s+(.*)|\s*)$/.exec(l);
	return m ? {
		indent: m[1].length,
		marker: m[2],
		body: m[3] ?? ""
	} : null;
};
var isBlockBreak = (l) => Boolean(isBlank(l) || matchOpenFence(l) || matchHeading(l) || isHr(l) || isQuote(l));
/** Split a GFM table row into cell strings, ignoring `\|` and `|` inside backtick spans. */
function splitTableCells(line) {
	let s = line.trim();
	if (s.startsWith("|")) s = s.slice(1);
	if (s.endsWith("|") && !s.endsWith("\\|")) s = s.slice(0, -1);
	const cells = [];
	let cur = "";
	let inCode = "";
	for (let i = 0; i < s.length; i++) {
		const ch = s[i];
		if (ch === "\\" && i + 1 < s.length && s[i + 1] === "|") {
			cur += "|";
			i++;
			continue;
		}
		if (ch === "`") {
			let ticks = 1;
			while (s[i + ticks] === "`") ticks++;
			const seq = "`".repeat(ticks);
			inCode = !inCode ? seq : inCode === seq ? "" : inCode;
			cur += seq;
			i += ticks - 1;
			continue;
		}
		if (ch === "|" && !inCode) {
			cells.push(cur.trim());
			cur = "";
			continue;
		}
		cur += ch;
	}
	cells.push(cur.trim());
	return cells;
}
function parseTableDelim(l, expectedCols) {
	if (!l.includes("|") && expectedCols < 2 || !l.includes("-")) return null;
	const cells = splitTableCells(l);
	if (!cells.length || cells.length !== expectedCols || !cells.every((c) => /^:?-+:?$/.test(c))) return null;
	return cells.map((c) => c.startsWith(":") && c.endsWith(":") ? "center" : c.endsWith(":") ? "right" : "left");
}
function isTableStartAt(lines, idx) {
	const l = lines[idx];
	if (!l.includes("|")) return "no";
	const cols = splitTableCells(l).length;
	if (cols < 1 || !l.trim().startsWith("|") && cols < 2) return "no";
	return idx + 1 >= lines.length ? "wait" : parseTableDelim(lines[idx + 1], cols) ? "yes" : "no";
}
function parseBlocks(lines, isFinal) {
	const blocks = [];
	const m = lines.length;
	let i = 0;
	let consumed = 0;
	while (i < m) {
		while (i < m && isBlank(lines[i])) i++;
		consumed = i;
		if (i >= m) break;
		const line = lines[i];
		const fence = matchOpenFence(line);
		if (fence) {
			let j = i + 1;
			while (j < m && !isCloseFence(lines[j], fence.ch, fence.len)) j++;
			if (j < m) {
				blocks.push({
					type: "code",
					info: fence.info,
					lines: lines.slice(i + 1, j)
				});
				i = j + 1;
				consumed = i;
				continue;
			}
			if (isFinal) {
				blocks.push({
					type: "code",
					info: fence.info,
					lines: lines.slice(i + 1)
				});
				consumed = m;
			}
			break;
		}
		const heading = matchHeading(line);
		if (heading) {
			blocks.push({
				type: "heading",
				level: heading.level,
				text: heading.text
			});
			consumed = ++i;
			continue;
		}
		if (isHr(line)) {
			blocks.push({ type: "hr" });
			consumed = ++i;
			continue;
		}
		if (isQuote(line)) {
			let j = i + 1;
			while (j < m && isQuote(lines[j])) j++;
			if (j < m || isFinal) {
				blocks.push({
					type: "quote",
					lines: lines.slice(i, j)
				});
				i = j;
				consumed = i;
				continue;
			}
			break;
		}
		const tbl = isTableStartAt(lines, i);
		if (tbl === "wait" && !isFinal) break;
		if (tbl === "yes") {
			let j = i + 2;
			while (j < m && !isBlockBreak(lines[j]) && lines[j].includes("|")) j++;
			if (j < m || isFinal) {
				blocks.push({
					type: "table",
					header: lines[i],
					delim: lines[i + 1],
					rows: lines.slice(i + 2, j)
				});
				i = j;
				consumed = i;
				continue;
			}
			break;
		}
		const isList = Boolean(matchListItem(line));
		let j = i + 1;
		let waitMore = false;
		while (j < m) {
			const lj = lines[j];
			if (isBlockBreak(lj) || !isList && matchListItem(lj)) break;
			if (!isList || !matchListItem(lj)) {
				const t = isTableStartAt(lines, j);
				if (t === "wait" && !isFinal) {
					waitMore = true;
					break;
				}
				if (t === "yes") break;
			}
			j++;
		}
		if (waitMore) break;
		if (j < m || isFinal) {
			blocks.push({
				type: isList ? "list" : "para",
				lines: lines.slice(i, j)
			});
			i = j;
			consumed = i;
			continue;
		}
		break;
	}
	return {
		blocks,
		consumed
	};
}
var clampIndent = (prefix, width) => strWidth(prefix) <= Math.max(0, width - 2) ? prefix : truncateAnsi(prefix, Math.max(0, width - 2), "");
function renderCodeBlock(info, lines, width) {
	const label = (info.split(/\s+/)[0] ?? "").replace(/^\{?\.?/, "").replace(/\}$/, "");
	const gutter = clampIndent(`${theme.border("│")} `, width);
	const contGutter = clampIndent(`${theme.border("│")}   `, width);
	const rows = label ? [truncateAnsi(`${gutter}${theme.muted(label)}`, width)] : [];
	if (!lines.length) {
		if (!label) rows.push(truncateAnsi(theme.border("│"), width));
		return rows;
	}
	for (const hl of highlightCode(lines.join("\n"), languageFor(info))) rows.push(...wrapAnsi(hl, width, {
		firstIndent: gutter,
		indent: contGutter
	}));
	return rows;
}
function renderList(lines, width) {
	const items = [];
	for (const l of lines) {
		const m = matchListItem(l);
		if (m) {
			const depth = Math.min(4, Math.floor(m.indent / 2));
			const task = /^\[([ xX])\](?:\s+(.*)|\s*)$/.exec(m.body);
			if (task) items.push({
				depth,
				kind: "task",
				num: 0,
				checked: task[1].toLowerCase() === "x",
				text: task[2] ?? ""
			});
			else if (/^\d/.test(m.marker)) items.push({
				depth,
				kind: "ordered",
				num: parseInt(m.marker, 10),
				checked: false,
				text: m.body
			});
			else items.push({
				depth,
				kind: "bullet",
				num: 0,
				checked: false,
				text: m.body
			});
		} else if (items.length) items[items.length - 1].text += ` ${l.trim()}`;
	}
	const counters = /* @__PURE__ */ new Map();
	const rows = [];
	for (const it of items) {
		for (const d of [...counters.keys()]) if (d > it.depth) counters.delete(d);
		if (it.kind !== "ordered") counters.delete(it.depth);
		const pad = "  ".repeat(it.depth);
		let body = renderInline(it.text.trim());
		let firstIndent = `${pad}${theme.md.bullet("•")} `;
		let indent = `${pad}  `;
		if (it.kind === "task") {
			firstIndent = `${pad}${it.checked ? theme.success("☑") : theme.muted("☐")} `;
			if (it.checked) body = withOuterStyle(body, theme.muted);
		} else if (it.kind === "ordered") {
			const n = counters.get(it.depth) ?? it.num;
			counters.set(it.depth, n + 1);
			firstIndent = `${pad}${theme.muted(`${n}.`)} `;
			indent = `${pad}${" ".repeat(String(n).length + 1)}`;
		}
		rows.push(...wrapAnsi(body, width, {
			firstIndent: clampIndent(firstIndent, width),
			indent: clampIndent(indent, width)
		}));
	}
	return rows;
}
function fitColumnWidths(nat, avail) {
	if (nat.reduce((a, b) => a + b, 0) <= avail) return [...nat];
	const widths = new Array(nat.length).fill(0);
	const open = new Set(nat.map((_, idx) => idx));
	let rem = avail;
	while (open.size > 0) {
		const fits = [...open].filter((idx) => nat[idx] <= rem / open.size);
		if (!fits.length) break;
		for (const idx of fits) {
			widths[idx] = nat[idx];
			rem -= nat[idx];
			open.delete(idx);
		}
	}
	if (open.size > 0) {
		const rest = [...open];
		const weights = rest.map((idx) => Math.sqrt(nat[idx]));
		const wSum = weights.reduce((a, b) => a + b, 0);
		let used = 0;
		for (let k = 0; k < rest.length; k++) {
			widths[rest[k]] = Math.max(1, Math.min(nat[rest[k]], Math.floor(rem * weights[k] / wSum)));
			used += widths[rest[k]];
		}
		for (let k = 0; used < rem && rest.some((i) => widths[i] < nat[i]); k = (k + 1) % rest.length) if (widths[rest[k]] < nat[rest[k]]) {
			widths[rest[k]]++;
			used++;
		}
	}
	return widths;
}
function renderTable(headerLine, delimLine, bodyLines, width) {
	const headRaw = splitTableCells(headerLine);
	const cols = headRaw.length;
	const aligns = parseTableDelim(delimLine, cols) ?? headRaw.map(() => "left");
	const styledMatrix = [headRaw, ...bodyLines.map((l) => {
		const c = splitTableCells(l);
		return Array.from({ length: cols }, (_, idx) => c[idx] ?? "");
	})].map((row, rIdx) => row.map((cell) => rIdx === 0 ? withOuterStyle(renderInline(cell), style.bold) : renderInline(cell)));
	const nat = Array.from({ length: cols }, (_, j) => Math.max(1, ...styledMatrix.map((r) => Math.max(...r[j].split("\n").map((seg) => strWidth(seg))))));
	const padded = width >= 4 * cols + 1;
	const colW = fitColumnWidths(nat, Math.max(cols, width - (padded ? 3 * cols + 1 : cols + 1)));
	const sp = padded ? " " : "";
	const B = theme.border;
	const rule = (l, mid, r) => B(l + colW.map((w) => "─".repeat(w + (padded ? 2 : 0))).join(mid) + r);
	const alignCell = (s, w, a) => {
		const p = Math.max(0, w - strWidth(s));
		return a === "right" ? `${" ".repeat(p)}${s}` : a === "center" ? `${" ".repeat(Math.floor(p / 2))}${s}${" ".repeat(Math.ceil(p / 2))}` : `${s}${" ".repeat(p)}`;
	};
	const out = [rule("┌", "┬", "┐")];
	for (let rIdx = 0; rIdx < styledMatrix.length; rIdx++) {
		const wrapped = styledMatrix[rIdx].map((cell, j) => wrapAnsi(cell, colW[j]));
		const height = Math.max(1, ...wrapped.map((c) => c.length));
		for (let h = 0; h < height; h++) out.push(`${B("│")}${colW.map((w, j) => `${sp}${alignCell(wrapped[j][h] ?? "", w, aligns[j])}${sp}`).join(B("│"))}${B("│")}`);
		if (rIdx === 0) out.push(rule("├", "┼", "┤"));
	}
	out.push(rule("└", "┴", "┘"));
	return out;
}
function renderBlock(b, width) {
	switch (b.type) {
		case "heading": {
			const inline = renderInline(b.text);
			if (!stripAnsi(inline).trim()) return [];
			return wrapAnsi(b.level === 1 ? withOuterStyle(withOuterStyle(inline, theme.accent), style.bold) : b.level === 2 ? withOuterStyle(inline, theme.md.heading) : withOuterStyle(inline, style.bold), width);
		}
		case "hr": return [theme.muted("─".repeat(Math.max(1, width)))];
		case "code": return renderCodeBlock(b.info, b.lines, width);
		case "quote": {
			const bar = clampIndent(`${style.dim("│")} `, width);
			const emptyBar = truncateAnsi(style.dim("│"), width);
			const { blocks } = parseBlocks(b.lines.map((l) => l.replace(/^\s{0,3}>\s?/, "")), true);
			if (!blocks.length) return [emptyBar];
			return renderBlockList(blocks, Math.max(2, width - strWidth(bar))).map((r) => r === "" ? emptyBar : `${bar}${withOuterStyle(r, theme.md.quote)}`);
		}
		case "list": return renderList(b.lines, width);
		case "table": return renderTable(b.header, b.delim, b.rows, width);
		case "para": {
			const inline = renderInline(b.lines.map((l) => l.trim()).join(" "));
			return stripAnsi(inline).trim() ? wrapAnsi(inline, width) : [];
		}
	}
}
function renderBlockList(blocks, width) {
	const out = [];
	for (const b of blocks) {
		const rows = finalizeRows(renderBlock(b, width), width);
		if (!rows.length) continue;
		if (out.length > 0) out.push("");
		out.push(...rows);
	}
	return out;
}
var MarkdownStream = class {
	lines = [];
	rawTail = "";
	width;
	emittedAny = false;
	constructor(opts) {
		this.width = Math.max(1, Math.floor(opts.width));
	}
	/** Append streamed text. Returns rows of blocks that are now complete (safe to print to scrollback). */
	push(text) {
		if (!text) return [];
		this.rawTail += text;
		let nl;
		while ((nl = this.rawTail.indexOf("\n")) >= 0) {
			const rawLine = this.rawTail.slice(0, nl);
			this.lines.push(sanitizeLine(rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine));
			this.rawTail = this.rawTail.slice(nl + 1);
		}
		const { blocks, consumed } = parseBlocks(this.lines, false);
		if (consumed > 0) this.lines = this.lines.slice(consumed);
		const rendered = blocks.length ? renderBlockList(blocks, this.width) : [];
		if (!rendered.length) return [];
		const out = this.emittedAny ? ["", ...rendered] : rendered;
		this.emittedAny = true;
		return out;
	}
	/** Rows for the unfinished tail (for the live region). Not final; may change on the next push. */
	pending() {
		const tail = this.rawTail ? [...this.lines, sanitizeLine(this.rawTail.replace(/\r$/, ""))] : this.lines;
		const rendered = tail.length ? renderBlockList(parseBlocks(tail, true).blocks, this.width) : [];
		return !rendered.length ? [] : this.emittedAny ? ["", ...rendered] : rendered;
	}
	/** End of message: rows for everything not yet returned by `push`. */
	flush() {
		const out = this.pending();
		this.lines = [];
		this.rawTail = "";
		this.emittedAny = false;
		return out;
	}
	/** New terminal width; applies to rows rendered from now on. */
	setWidth(width) {
		this.width = Math.max(1, Math.floor(width));
	}
};
// src/tui/transcript.ts
var Transcript = class {
	opts;
	md = null;
	mdId;
	mdChars = 0;
	thinking = null;
	lastThought = "";
	lastThoughtMs = 0;
	tools = /* @__PURE__ */ new Map();
	active = [];
	lastToolId;
	lastKind;
	/** Text of the assistant message being streamed, and of the last finished one (`/copy`). */
	currentAssistantText = "";
	lastAssistantText = "";
	/** Rough count of streamed output characters this turn (for the ↓ tokens estimate). */
	streamedChars = 0;
	/** True while replaying `session/load` history. */
	replay = false;
	/** Terminal objects by id (they outlive `terminal/release`). */
	terminals = /* @__PURE__ */ new Map();
	/** Fired when a tool needs a redraw (status or output changed). */
	width;
	cwd;
	constructor(opts) {
		this.opts = opts;
		this.width = opts.width;
		this.cwd = opts.cwd;
	}
	setWidth(w) {
		this.width = w;
		this.md?.setWidth(Math.max(10, w - 2));
	}
	/** Print rows as one block, with a blank row between blocks (tool rows stay grouped). */
	emit(kind, rows, continuation = false) {
		if (!rows.length) return;
		const out = [];
		if (!continuation && this.lastKind !== void 0 && !(kind === "tool" && this.lastKind === "tool")) out.push("");
		out.push(...rows);
		this.lastKind = kind;
		this.opts.print(out, kind);
	}
	/** Reset spacing (after the screen was cleared). */
	resetSpacing() {
		this.lastKind = void 0;
	}
	user(text) {
		this.flushText();
		this.endThinking();
		this.emit("user", renderUserMessage(text, this.width));
	}
	notice(text, color = theme.muted) {
		this.flushText();
		this.emit("notice", renderNotice(text, this.width, color));
	}
	header(rows) {
		this.emit("header", rows);
	}
	endThinking() {
		if (!this.thinking) return;
		const ms = Date.now() - this.thinking.startedAt;
		this.lastThought = this.thinking.text;
		this.lastThoughtMs = ms;
		this.thinking = null;
		const label = this.replay || ms < 1e3 ? "thought" : `thought for ${formatDuration(ms)}`;
		this.emit("thought", [truncateAnsi(`  ${theme.subtle(label)}`, this.width)]);
	}
	/** Commit the streaming message (end of message / before a tool or user row). */
	flushText() {
		if (this.currentAssistantText.trim()) this.lastAssistantText = this.currentAssistantText.trim();
		this.currentAssistantText = "";
		if (!this.md) return;
		const rows = this.md.flush();
		const cont = this.mdChars > 0 && this.lastKind === "text" && this.mdEmitted;
		if (rows.length) this.emit("text", rows.map((r) => "  " + r), cont);
		this.md = null;
		this.mdId = void 0;
		this.mdChars = 0;
		this.mdEmitted = false;
	}
	mdEmitted = false;
	pushText(id, text) {
		this.endThinking();
		if (this.md && id && this.mdId && id !== this.mdId) this.flushText();
		if (!this.md) {
			this.md = new MarkdownStream({ width: Math.max(10, this.width - 2) });
			this.mdId = id;
			this.mdEmitted = false;
		}
		this.mdChars += text.length;
		this.currentAssistantText += text;
		this.streamedChars += text.length;
		const rows = this.md.push(text);
		if (rows.length) {
			this.emit("text", rows.map((r) => "  " + r), this.mdEmitted);
			this.mdEmitted = true;
		}
	}
	handleUpdate(u) {
		const kind = u?.sessionUpdate;
		const msgContent = u.content && typeof u.content === "object" && !Array.isArray(u.content) ? u.content : void 0;
		switch (kind) {
			case "user_message_chunk": {
				const t = msgContent?.type === "text" ? String(msgContent.text ?? "") : "";
				if (t) this.user(t);
				break;
			}
			case "agent_message_chunk":
				if (msgContent?.type === "text") this.pushText(u.messageId, String(msgContent.text ?? ""));
				break;
			case "agent_thought_chunk": {
				const t = msgContent?.type === "text" ? String(msgContent.text ?? "") : "";
				if (!t) break;
				this.flushText();
				if (!this.thinking) this.thinking = {
					startedAt: Date.now(),
					text: ""
				};
				this.thinking.text += t;
				this.streamedChars += t.length;
				break;
			}
			case "tool_call": {
				this.flushText();
				this.endThinking();
				const t = {
					id: String(u.toolCallId),
					fn: String(u.name ?? u.title ?? ""),
					title: String(u.title ?? ""),
					kind: String(u.kind ?? "other"),
					status: u.status ?? "pending",
					rawInput: u.rawInput ?? {},
					content: Array.isArray(u.content) ? u.content : [],
					...Array.isArray(u.locations) ? { locations: u.locations } : {},
					startedAt: Date.now()
				};
				this.tools.set(t.id, t);
				this.active.push(t.id);
				this.lastToolId = t.id;
				break;
			}
			case "tool_call_update": {
				const t = this.tools.get(String(u.toolCallId));
				if (!t) break;
				if (u.title) t.title = String(u.title);
				if (u.rawInput) t.rawInput = u.rawInput;
				if (Array.isArray(u.locations)) t.locations = u.locations;
				if (u.rawOutput !== void 0) t.rawOutput = u.rawOutput;
				if (Array.isArray(u.content)) {
					const items = u.content;
					const term = items.find((c) => c?.type === "terminal");
					if (term?.terminalId) {
						t.terminalId = String(term.terminalId);
						const lt = this.terminals.get(t.terminalId);
						if (lt) t.terminal = lt;
					}
					if (!term || items.some((c) => c?.type !== "terminal")) t.content = items;
				}
				if (u.status) t.status = u.status;
				if (t.status === "completed" || t.status === "failed") this.finishTool(t);
				break;
			}
		}
	}
	/** A terminal produced output: attach it to its tool. */
	terminalChanged(term) {
		this.terminals.set(term.id, term);
		for (const id of this.active) {
			const t = this.tools.get(id);
			if (t && t.terminalId === term.id) t.terminal = term;
		}
	}
	finishTool(t) {
		t.endedAt ??= Date.now();
		const i = this.active.indexOf(t.id);
		if (i >= 0) this.active.splice(i, 1);
		this.emit("tool", renderTool(t, {
			width: this.width,
			cwd: this.cwd,
			replay: this.replay
		}));
	}
	/** Attach a permission request's preview (diff / command) to the tool row. */
	attachPermissionPreview(toolCallId, toolCall) {
		const t = this.tools.get(toolCallId);
		if (!t) return;
		if (Array.isArray(toolCall?.content) && toolCall.content.length) t.content = toolCall.content;
		if (toolCall?.rawInput && typeof toolCall.rawInput === "object") t.rawInput = {
			...t.rawInput,
			...toolCall.rawInput
		};
		if (Array.isArray(toolCall?.locations)) t.locations = toolCall.locations;
	}
	markDenied(toolCallId) {
		const t = this.tools.get(toolCallId);
		if (t) t.denied = true;
	}
	get activeTools() {
		return this.active.map((id) => this.tools.get(id)).filter(Boolean);
	}
	get isStreamingText() {
		return Boolean(this.md);
	}
	/** End of turn: commit everything still open; running tools are marked interrupted when `cancelled`. */
	endTurn(cancelled = false) {
		this.flushText();
		this.endThinking();
		for (const t of this.activeTools) {
			if (cancelled) t.cancelled = true;
			this.finishTool(t);
		}
		this.active = [];
	}
	/** Spinner label for the current activity. */
	activity() {
		const tool = this.activeTools[this.activeTools.length - 1];
		if (tool) return toolActivity(tool, this.cwd);
		if (this.thinking) return "Thinking";
		if (this.md) return "Writing";
		return "Working";
	}
	/** Live rows: the streaming tail, the thinking line and running tool rows. */
	liveRows(now = Date.now()) {
		const rows = [];
		const w = this.width;
		if (this.md) {
			const pending = this.md.pending();
			if (pending.length) {
				if (this.lastKind !== void 0 && !this.mdEmitted) rows.push("");
				rows.push(...pending.map((r) => "  " + r));
			}
		}
		if (this.thinking) {
			const glyphs = [
				"◐",
				"◓",
				"◑",
				"◒"
			];
			const g = glyphs[Math.floor(now / 160) % glyphs.length];
			const secs = formatDuration(now - this.thinking.startedAt);
			const snippet = this.thinking.text.replace(/\s+/g, " ").trim().slice(-200);
			const head = `  ${theme.muted(`${g} thinking · ${secs}`)}`;
			rows.push("");
			rows.push(truncateAnsi(snippet ? `${head}  ${theme.subtle(snippet)}` : head, w));
		}
		const tools = this.activeTools;
		if (tools.length) {
			if (this.lastKind !== "tool" || rows.length) rows.push("");
			for (const t of tools) rows.push(...renderTool(t, {
				width: w,
				cwd: this.cwd,
				now
			}));
		}
		return rows;
	}
	/** Last full thinking text (Ctrl+O). */
	expandThinking() {
		const t = this.thinking?.text || this.lastThought;
		if (!t.trim()) return [];
		const label = this.lastThoughtMs >= 1e3 ? `thought for ${formatDuration(this.lastThoughtMs)}` : "thinking";
		const rows = [`  ${theme.subtle(label)}`];
		for (const line of t.trim().split("\n")) rows.push(...renderNotice(line || " ", this.width, (s) => theme.subtle(s)).map((r) => r));
		return rows;
	}
	/** Last tool's full output (Ctrl+O). */
	expandLastTool() {
		const t = this.lastToolId ? this.tools.get(this.lastToolId) : void 0;
		if (!t) return [];
		return renderTool(t, {
			width: this.width,
			cwd: this.cwd,
			expanded: true
		});
	}
	spinner(now = Date.now()) {
		return spinnerFrame(now);
	}
};
// src/tui/viewport.ts
/**
* Conversation viewport state for the full-screen TUI: committed transcript rows (capped), scroll position
* measured from the bottom (0 = follow the latest rows), and whether the welcome hero should still be shown.
* Rendering lives in `frame.ts` (`composeFullFrame`); this class only owns the numbers.
*/
var MAX_COMMITTED_ROWS = 2e4;
var Viewport = class {
	max;
	committedRows = [];
	/** Rows scrolled up from the bottom; 0 = pinned to the latest rows. */
	scrollOffset = 0;
	hasConversation = false;
	/** Content rows / viewport height seen by the last frame (scroll clamping between frames). */
	prevTotal = 0;
	viewportHeight = 1;
	constructor(max = MAX_COMMITTED_ROWS) {
		this.max = max;
	}
	/** Append finished rows. Dropping the oldest rows does not move a scrolled-up reader (offset is bottom-relative). */
	commit(rows) {
		if (!rows.length) return;
		this.committedRows.push(...rows);
		this.hasConversation = true;
		const over = this.committedRows.length - this.max;
		if (over > 0) {
			this.committedRows.splice(0, over);
			this.prevTotal = Math.max(0, this.prevTotal - over);
		}
	}
	/** `/clear`, `/new`, `/resume`: back to the welcome screen. */
	reset() {
		this.committedRows = [];
		this.scrollOffset = 0;
		this.prevTotal = 0;
		this.hasConversation = false;
	}
	/** Store what the frame composer computed. */
	update(r) {
		this.scrollOffset = r.scrollOffset;
		this.prevTotal = r.total;
		this.viewportHeight = r.viewportHeight;
	}
	get maxOffset() {
		return Math.max(0, this.prevTotal - this.viewportHeight);
	}
	/** Positive = up (older rows). Clamped to the last frame's range so a reversal takes effect immediately. */
	scrollBy(lines) {
		this.scrollOffset = Math.min(this.maxOffset, Math.max(0, this.scrollOffset + lines));
	}
	pageSize() {
		return Math.max(4, Math.floor(this.viewportHeight * .7));
	}
	/** Back to the bottom; false if already following. */
	follow() {
		if (this.scrollOffset === 0) return false;
		this.scrollOffset = 0;
		return true;
	}
};
// src/tui/app.ts
var TERM_ENTER = ALT_ENTER + "\x1B[2J\x1B[H\x1B[?2004h\x1B[>1u" + MOUSE_ENTER;
var TERM_LEAVE = MOUSE_LEAVE + "\x1B[<u\x1B[?2004l" + CURSOR_SHOW + ALT_LEAVE;
/** Transcript rows leave room for the viewport scrollbar (space + bar). */
var SCROLLBAR_COLS = 2;
var TuiApp = class {
	opts;
	engine;
	screen;
	transcript;
	editor;
	viewport = new Viewport();
	headerOverride;
	sessionTitle;
	decoder;
	rules = new PermissionRules();
	out;
	inp;
	branch;
	commands = TUI_COMMANDS;
	overlay = null;
	suggestions = null;
	popupDismissedFor = null;
	files = null;
	running = false;
	turnStartedAt = 0;
	silent = false;
	queued = [];
	usage = {
		used: 0,
		size: 0,
		cost: 0
	};
	lastTurn;
	totals = {
		input: 0,
		output: 0,
		cached: 0,
		cacheWrite: 0,
		turns: 0
	};
	noProvider = false;
	cachedProviderId;
	hint = null;
	ctrlCAt = 0;
	placeholderOverride = null;
	ticker;
	exiting = false;
	exitResolve;
	done;
	onData = (d) => this.decoder.feed(d);
	onResize = () => {
		this.transcript.setWidth(this.screen.width - SCROLLBAR_COLS);
		this.screen.resized();
	};
	constructor(opts) {
		this.opts = opts;
		this.out = opts.stdout ?? process.stdout;
		this.inp = opts.stdin ?? process.stdin;
		this.branch = gitBranch(opts.cwd);
		let historyFile;
		try {
			historyFile = join(olympusRootDir(opts.env.OLYMPUS_HOME || opts.env.OLYMPUS_SHARED_DIR || opts.env.AGENTDESK_SHARED_ROOT), "history.jsonl");
		} catch {
			historyFile = void 0;
		}
		this.editor = new InputEditor(new History(historyFile));
		this.screen = new LiveScreen(this.out, {
			mode: "fullscreen",
			render: (w, h) => this.frame(w, h)
		});
		this.transcript = new Transcript({
			cwd: opts.cwd,
			width: this.screen.width - SCROLLBAR_COLS,
			print: (rows, kind) => {
				if (kind === "header") return;
				this.viewport.commit(rows);
				this.screen.request();
			}
		});
		this.decoder = new KeyDecoder((k) => {
			try {
				this.onKey(k);
			} catch (e) {
				this.fail(e);
			}
		});
		this.engine = new Engine(opts.env, opts.version, opts.cwd, {
			onUpdate: (u) => this.onUpdate(u),
			onPermission: (req, signal) => this.onPermission(req, signal),
			onTerminalChange: (t) => {
				this.transcript.terminalChanged(t);
				this.screen.request();
			}
		});
		this.done = new Promise((r) => this.exitResolve = r);
	}
	get cwd() {
		return this.opts.cwd;
	}
	get env() {
		return this.opts.env;
	}
	get textWidth() {
		return inputTextWidth(this.screen.width);
	}
	get isRunning() {
		return this.running;
	}
	get currentOverlay() {
		return this.overlay;
	}
	async run() {
		this.enterTerminal();
		try {
			await this.engine.initialize();
			await openInitialSession(this, this.opts);
		} catch (e) {
			this.transcript.notice(`Could not start: ${e?.message ?? e}`, theme.error);
		}
		this.screen.flush();
		if (this.opts.resume === true && !this.noProvider) await openResumePicker(this);
		await this.done;
	}
	enterTerminal() {
		if (this.inp.isTTY) this.inp.setRawMode(true);
		this.out.write(TERM_ENTER);
		this.inp.on("data", this.onData);
		this.inp.resume();
		this.out.on("resize", this.onResize);
	}
	leaveTerminal() {
		this.inp.off("data", this.onData);
		this.out.off("resize", this.onResize);
		this.decoder.dispose();
		this.screen.stop();
		this.out.write(TERM_LEAVE);
		if (this.inp.isTTY) this.inp.setRawMode(false);
		this.inp.pause();
	}
	exit() {
		if (this.exiting) return;
		this.exiting = true;
		this.stopTicker();
		if (this.overlay?.type === "permission") this.overlay.resolve(-1);
		try {
			this.leaveTerminal();
		} finally {
			this.engine.close();
			this.exitResolve();
		}
	}
	fail(e) {
		this.exit();
		this.out.write(`\n${theme.error("Olympus crashed:")} ${e?.stack ?? e}\n`);
	}
	setNoProvider(v) {
		this.noProvider = v;
	}
	async newSession() {
		await this.engine.newSession(buildInitialSessionConfig(this.opts));
		this.noProvider = false;
		this.refreshSessionProvider();
		this.rules.clear();
		this.printHeader();
	}
	async loadSession(id) {
		const stored = readStoredSession(id);
		this.transcript.replay = true;
		this.silent = false;
		try {
			this.printHeader(stored ? {
				model: stored.model,
				provider: stored.providerId,
				mode: stored.mode
			} : void 0);
			if (stored?.title) this.transcript.notice(`Resumed · ${stored.title}`);
			await this.engine.loadSession(id);
			this.refreshSessionProvider();
			this.transcript.endTurn();
		} finally {
			this.transcript.replay = false;
			this.headerOverride = void 0;
		}
		this.rules.clear();
		this.screen.request();
	}
	refreshSessionProvider() {
		const id = this.engine.sessionId;
		const s = id ? readStoredSession(id) : null;
		this.sessionTitle = s?.title || void 0;
		if (s?.providerId) {
			this.cachedProviderId = s.providerId;
			return;
		}
		const v = this.engine.option("model")?.currentValue ?? "";
		this.cachedProviderId = v.includes("::") ? v.split("::")[0] : void 0;
	}
	sessionProviderId() {
		return this.cachedProviderId;
	}
	modelId() {
		const v = this.engine.option("model")?.currentValue ?? "";
		return v.includes("::") ? v.split("::").slice(1).join("::") : v;
	}
	mode() {
		return this.engine.option("mode")?.currentValue ?? (this.opts.autoApprove ? "auto" : "code");
	}
	resetUsage() {
		this.usage = {
			used: 0,
			size: 0,
			cost: 0
		};
	}
	/** The header is drawn live (welcome hero); an override pins the stored session's identity while it loads. */
	printHeader(override) {
		this.headerOverride = override;
		this.screen.request();
	}
	headerInfo() {
		const o = this.headerOverride;
		return {
			version: this.opts.version,
			provider: o?.provider ?? this.sessionProviderId(),
			model: o?.model ?? this.modelId(),
			mode: o?.mode ?? this.mode(),
			cwd: this.opts.cwd,
			branch: this.branch,
			notConnected: this.noProvider
		};
	}
	onUpdate(u) {
		applySessionUpdate(this, u);
	}
	onPermission(req, signal) {
		return requestPermissionThroughOverlay(req, signal, this.opts.cwd, this.screen.width, this.screen.height, this.rules, {
			attachPreview: (id, tc) => this.transcript.attachPermissionPreview(id, tc),
			setOverlay: (ov) => {
				this.overlay = ov;
				this.suggestions = null;
			},
			clearOverlay: (ov) => {
				if (this.overlay === ov) this.overlay = null;
			},
			onDenied: (toolId, rejectedToSteer) => {
				this.transcript.markDenied(toolId);
				if (rejectedToSteer) this.placeholderOverride = "Tell Olympus what to do instead…";
			},
			requestRedraw: () => this.screen.request()
		});
	}
	frame(width, height) {
		const placeholder = this.placeholderOverride ? this.placeholderOverride : this.noProvider ? "Run /login to connect a provider" : this.running ? "Add a follow-up (sent at the next step)…" : "Ask Olympus anything…";
		const hint = this.hint && this.hint.until > Date.now() ? this.hint.text : void 0;
		const v = this.viewport;
		const res = composeFullFrame({
			width,
			height,
			screenHeight: height,
			topBar: {
				version: this.opts.version,
				title: this.sessionTitle,
				cwd: this.opts.cwd,
				branch: this.branch
			},
			hero: this.headerInfo(),
			committedRows: v.committedRows,
			hasConversation: v.hasConversation,
			scrollOffset: v.scrollOffset,
			prevTotal: v.prevTotal,
			transcript: this.transcript,
			editor: this.editor,
			running: this.running,
			turnStartedAt: this.turnStartedAt,
			queuedShown: this.queued.map((q) => q.shown),
			overlay: this.overlay,
			suggestions: this.suggestions,
			placeholder,
			mode: this.mode(),
			noProvider: this.noProvider,
			provider: this.sessionProviderId(),
			model: this.modelId(),
			usage: this.usage,
			hint
		});
		v.update(res);
		return res.frame;
	}
	showHint(text, ms = 2e3) {
		this.hint = {
			text,
			until: Date.now() + ms
		};
		this.screen.request();
		setTimeout(() => this.screen.request(), ms + 20).unref?.();
	}
	startTicker() {
		if (!this.ticker) this.ticker = setInterval(() => this.screen.request(), 80);
	}
	stopTicker() {
		if (this.ticker) clearInterval(this.ticker);
		this.ticker = void 0;
	}
	stopTickerIfIdle() {
		if (!this.running) this.stopTicker();
	}
	onKey(k) {
		if (this.exiting) return;
		if (this.overlay?.type === "permission") {
			if (!scrollKey(this.viewport, k)) handlePermissionKey(k, this.overlay, () => this.interrupt());
			return this.screen.request();
		}
		if (this.overlay?.type === "picker") {
			handlePickerKey(k, this.overlay, () => this.overlay = null, (msg) => this.transcript.notice(msg, theme.error), () => this.screen.request());
			return this.screen.request();
		}
		dispatchEditorKey(this, k);
		this.updateSuggestions();
		this.screen.request();
	}
	resetCtrlC() {
		this.ctrlCAt = 0;
	}
	clearHint() {
		this.hint = null;
	}
	dismissSuggestions() {
		this.popupDismissedFor = this.editor.text;
		this.suggestions = null;
	}
	ctrlC() {
		if (!this.editor.isEmpty) {
			this.editor.clear();
			this.suggestions = null;
			return;
		}
		if (this.running) return this.interrupt();
		const now = Date.now();
		if (this.ctrlCAt && now - this.ctrlCAt < 2e3) return this.exit();
		this.ctrlCAt = now;
		this.showHint("press Ctrl+C again to exit");
	}
	interrupt() {
		if (!this.running) return;
		this.engine.cancel();
		this.showHint("interrupting…", 1500);
	}
	/** `/clear`, `/new`, `/resume`: drop the visible conversation and return to the welcome screen. */
	clearScreen() {
		this.viewport.reset();
		this.transcript.resetSpacing();
		this.screen.clearScreen();
		this.screen.flush();
	}
	/** Ctrl+L: repaint everything, keep the conversation. */
	redraw() {
		this.screen.clearScreen();
		this.screen.flush();
	}
	expand() {
		const rows = this.transcript.thinking || this.transcript.lastThought && !this.transcript.lastToolId ? this.transcript.expandThinking() : this.transcript.expandLastTool();
		const alt = rows.length ? rows : this.transcript.expandThinking();
		if (alt.length) this.transcript.emit("notice", alt);
		else this.showHint("nothing to expand");
	}
	cycleMode() {
		const cur = this.mode();
		this.setMode(MODES[(MODES.indexOf(cur) + 1) % MODES.length]);
	}
	async setMode(m) {
		if (!this.engine.sessionId) return;
		try {
			await this.engine.setConfig("mode", m);
			this.showHint(`mode: ${m}${m === "plan" ? " · read-only" : m === "auto" ? " · edits and commands run without asking" : ""}`, 2500);
		} catch (e) {
			this.transcript.notice(String(e?.message ?? e), theme.error);
		}
		this.screen.request();
	}
	openPicker(p) {
		const cur = p.items.findIndex((i) => i.current);
		this.overlay = {
			type: "picker",
			filter: "",
			selected: Math.max(0, cur),
			...p
		};
		this.suggestions = null;
		this.screen.request();
	}
	updateSuggestions() {
		if (this.overlay) return;
		if (this.popupDismissedFor !== null && this.popupDismissedFor === this.editor.text) return;
		this.popupDismissedFor = null;
		this.suggestions = computeSuggestions(this.editor, this.commands, () => {
			if (!this.files || Date.now() - this.files.at > 3e4) this.files = {
				list: listWorkspaceFiles(this.opts.cwd),
				at: Date.now()
			};
			return this.files.list;
		}, this.suggestions);
	}
	acceptSuggestion(viaEnter) {
		const s = this.suggestions;
		if (!s) return;
		this.suggestions = null;
		const res = applyAcceptedSuggestion(s, this.editor, viaEnter);
		if (res.shouldSubmit) return this.submit();
		this.popupDismissedFor = res.dismissedText;
	}
	clearPopupAndPlaceholder() {
		this.suggestions = null;
		this.placeholderOverride = null;
	}
	submit() {
		this.viewport.scrollOffset = 0;
		submitEditorInput(this);
	}
	async runTurn(blocks, opts = {}) {
		this.running = true;
		this.silent = Boolean(opts.silent);
		this.turnStartedAt = Date.now();
		this.transcript.streamedChars = 0;
		this.startTicker();
		this.screen.request();
		let res;
		let cancelled = false;
		try {
			res = await this.engine.prompt(blocks);
			this.lastTurn = res.usage;
			cancelled = finishTurnResult(this, res);
		} catch (e) {
			cancelled = true;
			this.transcript.endTurn(true);
			const msg = String(e?.message ?? e);
			this.transcript.notice(msg, theme.error);
			if (/auth|api key|401|403/i.test(msg)) this.transcript.notice("Run /login to add or update a provider key.");
		} finally {
			this.running = false;
			this.silent = false;
			this.refreshSessionProvider();
			this.stopTicker();
			this.screen.request();
		}
		const pending = this.queued.filter((q) => !q.consumed);
		this.queued = [];
		if (!cancelled && pending.length && !this.exiting) {
			this.transcript.user(pending.map((q) => q.shown).join("\n\n"));
			this.runTurn(pending.flatMap((q) => q.blocks));
		}
		return res;
	}
	async login() {
		await runSuspendedLogin(this, this.opts.runLogin, () => {
			this.inp.off("data", this.onData);
			this.screen.stop();
			this.out.write(TERM_LEAVE);
			if (this.inp.isTTY) this.inp.setRawMode(false);
		}, () => {
			if (this.inp.isTTY) this.inp.setRawMode(true);
			this.out.write(TERM_ENTER);
			this.inp.on("data", this.onData);
			this.inp.resume();
			this.transcript.resetSpacing();
			this.screen.resume();
		}, (s) => this.out.write(s));
	}
};
// src/tui/run.ts
/**
* Process wiring for the interactive TUI: whatever happens (exit, signals, crashes) the terminal is restored
* (alt screen, mouse reporting, bracketed paste and keyboard protocol off, cursor shown).
*/
async function runTui(opts) {
	const app = new TuiApp(opts);
	const onSignal = () => app.exit();
	const onCrash = (e) => {
		app.fail(e);
		process.exitCode = 1;
	};
	const signals = [
		"SIGTERM",
		"SIGHUP",
		"SIGINT"
	];
	process.on("exit", onSignal);
	for (const s of signals) process.on(s, onSignal);
	process.on("uncaughtException", onCrash);
	process.on("unhandledRejection", onCrash);
	try {
		await app.run();
	} catch (e) {
		app.fail(e);
		throw e;
	} finally {
		app.exit();
		process.off("exit", onSignal);
		for (const s of signals) process.off(s, onSignal);
		process.off("uncaughtException", onCrash);
		process.off("unhandledRejection", onCrash);
	}
}
// src/tui/oneshot.ts
async function runOneShot(opts) {
	const inp = opts.stdin ?? process.stdin;
	const out = opts.stdout ?? process.stdout;
	const errOut = opts.stderr ?? process.stderr;
	const isTtyOut = Boolean(out.isTTY);
	const width = Math.max(40, out.columns || 80);
	const rules = new PermissionRules();
	let pipedWroteText = false;
	let pipedLastChar = "\n";
	const transcript = isTtyOut ? new Transcript({
		cwd: opts.cwd,
		width,
		plain: true,
		print: (rows) => {
			for (const r of rows) out.write(r + "\n");
		}
	}) : null;
	const askPermission = async (req, signal) => {
		const tc = req.toolCall ?? {};
		const id = String(tc.toolCallId ?? "");
		transcript?.attachPermissionPreview(id, tc);
		if (opts.autoApprove) return pickPermissionOption(req, "allow_once");
		const subject = permissionSubject(tc);
		if (rules.allows(subject)) return pickPermissionOption(req, "allow_once");
		if (!inp.isTTY) {
			transcript?.markDenied(id);
			return pickPermissionOption(req, "reject_once");
		}
		const view = buildPermissionView(tc, opts.cwd, Math.max(40, errOut.columns || width), errOut.rows || 24);
		if (view.preview.length) errOut.write("\n" + view.preview.map((r) => "  " + r).join("\n") + "\n");
		const rl = createInterface({
			input: inp,
			output: errOut
		});
		const onAbort = () => rl.close();
		signal.addEventListener("abort", onAbort, { once: true });
		try {
			const ans = (await rl.question(`  ${theme.accent("?")} ${view.title} [y/N/a]: `)).trim().toLowerCase();
			if (ans === "a" || ans === "always") {
				rules.remember(subject);
				return pickPermissionOption(req, "allow_always");
			}
			if (ans === "y" || ans === "yes") return pickPermissionOption(req, "allow_once");
			transcript?.markDenied(id);
			return pickPermissionOption(req, "reject_once");
		} catch {
			transcript?.markDenied(id);
			return { outcome: "cancelled" };
		} finally {
			signal.removeEventListener("abort", onAbort);
			rl.close();
		}
	};
	const engine = new Engine(opts.env, opts.version, opts.cwd, {
		onUpdate: (raw) => {
			const u = raw;
			if (transcript) {
				if (!transcript.replay || u.sessionUpdate !== "user_message_chunk") {
					if (!transcript.replay) transcript.handleUpdate(u);
				}
				return;
			}
			if (u?.sessionUpdate === "agent_message_chunk") {
				const c = u.content && typeof u.content === "object" ? u.content : void 0;
				if (c?.type === "text" && c.text) {
					out.write(c.text);
					pipedWroteText = true;
					pipedLastChar = c.text[c.text.length - 1];
				}
			}
		},
		onPermission: askPermission,
		onTerminalChange: (t) => transcript?.terminalChanged(t)
	});
	const onSigint = () => {
		engine.cancel();
	};
	process.once("SIGINT", onSigint);
	try {
		await engine.initialize();
		if ((await engine.authStatus().catch(() => ({
			state: "unauthenticated",
			accounts: []
		}))).state !== "authenticated") {
			errOut.write("Olympus CLI is not configured yet. Run `oly login` or set OPENROUTER_API_KEY / ANTHROPIC_API_KEY / AI_GATEWAY_API_KEY.\n");
			process.exitCode = 1;
			return;
		}
		const cfg = buildInitialSessionConfig(opts);
		const resumeId = opts.resumeId ?? (opts.continueLatest ? listStoredSessions({ cwd: opts.cwd })[0]?.sessionId : void 0);
		if (resumeId) {
			if (transcript) transcript.replay = true;
			await engine.loadSession(resumeId);
			if (transcript) transcript.replay = false;
			for (const item of cfg) await engine.setConfig(item.configId, item.value);
		} else await engine.newSession(cfg);
		const blocks = buildPromptBlocks(opts.prompt, opts.cwd);
		const res = await engine.prompt(blocks);
		transcript?.endTurn(res.stopReason === "cancelled");
		if (!transcript && pipedWroteText && pipedLastChar !== "\n") out.write("\n");
		if (res.stopReason === "cancelled") process.exitCode = 130;
	} catch (e) {
		transcript?.endTurn(true);
		errOut.write(`${e?.message ?? e}\n`);
		process.exitCode = 1;
	} finally {
		process.off("SIGINT", onSigint);
		engine.close();
	}
}
// src/entry.ts
var VERSION = "0.2.0";
function initSharedStoragePath() {
	const root = (process.env.OLYMPUS_HOME || process.env.OLYMPUS_SHARED_DIR || process.env.AGENTDESK_SHARED_ROOT)?.trim() || join(homedir(), ".olympus");
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
async function connectedForCli(probeOllama = true) {
	const inputs = inputsFromEnv(process.env);
	return resolveConnectedProviders(inputs, null, probeOllama && !inputs.olympusCloudToken && !inputs.openRouterToken && !inputs.anthropicToken && !inputs.aiGatewayToken && !inputs.customToken && !inputs.useOllama ? await detectLocalOllama(inputs.ollamaHost, process.env.OLYMPUS_DISABLE_OLLAMA_PROBE === "1") : false);
}
async function runLoginWizard() {
	return runLoginWizard$1(initSharedStoragePath);
}
function pad(s, n) {
	return s.length >= n ? s : s + " ".repeat(n - s.length);
}
async function runProvidersList() {
	initSharedStoragePath();
	const settings = loadProviderSettings();
	const conn = await connectedForCli(false);
	const rows = [];
	for (const p of settings.providers) {
		const connected = conn.providers.some((c) => c.id === p.id);
		rows.push({
			mark: conn.defaultId === p.id ? "*" : "",
			id: p.id,
			label: p.label,
			host: safeHost(p.baseUrl),
			model: p.defaultModel ?? "-",
			key: p.keyStore === "keychain" ? "Keychain" : p.keyStore === "file" ? "file" : connected ? "none (local)" : "none (not connected)"
		});
	}
	for (const c of conn.providers) {
		if (c.source === "saved") continue;
		rows.push({
			mark: conn.defaultId === c.id ? "*" : "",
			id: c.id,
			label: c.label,
			host: safeHost(c.endpoint.baseUrl),
			model: c.endpoint.defaultModel,
			key: c.source === "env" ? "env" : c.source
		});
	}
	if (!rows.length) {
		console.log("\nNo providers saved yet. Run `oly login` to add one.\n");
		return;
	}
	const all = [{
		mark: " ",
		id: "ID",
		label: "PROVIDER",
		host: "BASE URL",
		model: "DEFAULT MODEL",
		key: "KEY"
	}, ...rows];
	const w = (k) => Math.max(...all.map((r) => r[k].length));
	console.log("");
	for (const r of all) console.log(`  ${pad(r.mark, 1)} ${pad(r.id, w("id"))}  ${pad(r.label, w("label"))}  ${pad(r.host, w("host"))}  ${pad(r.model, w("model"))}  ${r.key}`);
	const defaultRow = conn.providers.find((c) => c.id === conn.defaultId);
	if (settings.activeProviderId && defaultRow && defaultRow.id !== settings.activeProviderId) console.log(`\n  Saved active provider is "${settings.activeProviderId}", but "${defaultRow.id}" (${defaultRow.source}) takes precedence right now.`);
	console.log("\n  * = used by default · switch: oly use <id> · add/update: oly login · remove: oly providers remove <id>\n");
}
function runProvidersUse(id) {
	initSharedStoragePath();
	if (!id) throw new Error("Usage: oly use <provider-id>   (see `oly providers`)");
	const p = setActiveProvider(id);
	console.log(`✓ Active provider: "${p.id}" — ${p.label} (${safeHost(p.baseUrl)})${p.defaultModel ? `, model ${p.defaultModel}` : ""}.`);
}
async function runProvidersRemove(id, yes) {
	initSharedStoragePath();
	if (!id) throw new Error("Usage: oly providers remove <provider-id> [-y]");
	const p = getSavedProvider(id);
	if (!p) throw new Error(`Unknown provider "${id}". Saved: ${listSavedProviders().map((x) => x.id).join(", ") || "none"}.`);
	if (!yes && process.stdin.isTTY) {
		const io = new Prompter();
		try {
			const ans = (await io.ask(`Remove provider "${p.id}" (${p.label}) and its saved key? [y/N]: `)).toLowerCase();
			if (ans !== "y" && ans !== "yes") {
				console.log("Cancelled.");
				return;
			}
		} finally {
			io.close();
		}
	}
	const res = removeProvider(p.id);
	console.log(`✓ Removed provider "${p.id}".${res.activeProviderId ? ` Active provider: "${res.activeProviderId}".` : " No saved providers left."}`);
}
async function runModelsList(providerFilter) {
	initSharedStoragePath();
	const conn = await connectedForCli();
	let list = conn.providers;
	if (providerFilter) {
		list = list.filter((p) => p.id === providerFilter);
		if (!list.length) throw new Error(`Provider "${providerFilter}" is not connected. Connected: ${conn.providers.map((p) => p.id).join(", ") || "none"}.`);
	}
	if (!list.length) {
		console.log("\nNo provider is connected. Run `oly login` or set OPENROUTER_API_KEY / ANTHROPIC_API_KEY / AI_GATEWAY_API_KEY.\n");
		return;
	}
	const catalogs = await Promise.all(list.map(async (p) => ({
		p,
		models: await listAvailableModels(p.endpoint, true)
	})));
	console.log(`\nOlympus CLI v${VERSION}`);
	for (const { p, models } of catalogs) {
		console.log(`\n${p.id === conn.defaultId ? "* " : "  "}${p.label} [${p.id}] — ${p.endpoint.baseUrl}`);
		console.log(`  Default model: ${p.endpoint.defaultModel}`);
		for (const m of models.slice(0, 40)) console.log(`    ${m.id.padEnd(38)}  ${String(Math.round(m.contextSize / 1e3) + "k").padStart(6)}  ${m.name}`);
		if (models.length > 40) console.log(`    ... and ${models.length - 40} more models on this provider.`);
	}
	if (catalogs.length > 1) console.log("\n  Use a model from another provider with: oly -m <provider-id>::<model-id> \"<prompt>\"");
	console.log("");
}
function runSelfUpdate() {
	console.log("⚡ Updating Olympus Coder CLI (oly) from GitHub release archive...");
	const slash = String.fromCharCode(47);
	const tarball = [
		"https:",
		"",
		"github.com",
		"martianacademy",
		"olympus-coder-cli",
		"archive",
		"refs",
		"heads",
		[
			"main",
			"tar",
			"gz"
		].join(".")
	].join(slash);
	const npmCmd = process.platform === "win32" ? ["npm", "cmd"].join(".") : "npm";
	const res = spawnSync(npmCmd, [
		"install",
		"-g",
		tarball,
		"--no-audit",
		"--no-fund"
	], { stdio: "inherit" });
	if (res.status !== 0) process.exitCode = res.status ?? 1;
}
function printHelp() {
	console.log(`Olympus CLI (oly) v${VERSION} — Native Multi-Model Coding Agent & ACP Server

Usage (command 'oly' or alias 'olympus'):
  oly                       Start interactive terminal UI in current directory
  oly -c, --continue        Resume the latest session in current directory
  oly -r, --resume [id]     Pick a session to resume (or resume session <id>)
  oly "<prompt>"            Run a one-shot coding task in current directory
  oly acp                   Start Agent Client Protocol (ACP) stdio server
  oly login                 Add or update BYO providers (OpenRouter / Anthropic / OpenAI / Local Ollama)
                            Other saved providers are always kept.
  oly providers             List saved providers (active marker, base URL, default model, key location)
  oly providers use <id>    Make a saved provider the active one (alias: oly use <id>)
  oly providers remove <id> Remove one saved provider and its key (alias: rm; -y skips the confirmation)
  oly models                List models of every connected provider (--provider <id> to filter)
  oly update                Update Olympus CLI globally in one command

Options:
  -P, --provider <id>       Use this provider for this run (see \`oly providers\`)
  -m, --model <id>          Override model ID for this run; also accepts <provider-id>::<model-id>
  -y, --yes                 Auto-approve file edits and shell commands (auto mode)
  -c, --continue            Resume the latest session in current directory
  -r, --resume [id]         Resume a specific session ID or open the session picker
  -C, --cwd <dir>           Set working directory
  -p, --prompt <text>       Execute a one-shot prompt and exit
  --no-color                Disable terminal colours
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
	let noColor = false;
	const filtered = [];
	for (const a of argv) if (a === "--no-color") noColor = true;
	else filtered.push(a);
	setColorLevel(noColor ? 0 : detectColorLevel(process.env, Boolean(process.stdout.isTTY)));
	if (filtered[0] === "login" || filtered[0] === "auth" || filtered[0] === "configure") {
		await runLoginWizard();
		return;
	}
	if (filtered[0] === "update" || filtered[0] === "upgrade") {
		runSelfUpdate();
		return;
	}
	initSharedStoragePath();
	let cwd = process.cwd();
	let modelOverride;
	let providerId;
	let autoApprove = false;
	let continueLatest = false;
	let resume;
	const positional = [];
	for (let i = 0; i < filtered.length; i++) {
		const a = filtered[i];
		if ((a === "-m" || a === "--model") && filtered[i + 1]) modelOverride = filtered[++i];
		else if (a.startsWith("--model=")) modelOverride = a.slice(8);
		else if ((a === "-P" || a === "--provider") && filtered[i + 1]) providerId = filtered[++i];
		else if (a.startsWith("--provider=")) providerId = a.slice(11);
		else if ((a === "-C" || a === "--cwd") && filtered[i + 1]) cwd = resolve(filtered[++i]);
		else if (a.startsWith("--cwd=")) cwd = resolve(a.slice(6));
		else if (a === "-y" || a === "--yes") autoApprove = true;
		else if (a === "-c" || a === "--continue") continueLatest = true;
		else if (a === "-r" || a === "--resume") {
			const next = filtered[i + 1];
			if (next && !next.startsWith("-")) resume = filtered[++i];
			else resume = true;
		} else if (a.startsWith("--resume=")) resume = a.slice(9).trim() || true;
		else if ((a === "-p" || a === "--prompt") && filtered[i + 1]) positional.push(filtered[++i]);
		else positional.push(a);
	}
	const cmd = positional[0];
	if (cmd === "models") {
		await runModelsList(providerId);
		return;
	}
	if (cmd === "providers" || cmd === "provider") {
		const sub = positional[1] ?? "list";
		if (sub === "list" || sub === "ls") await runProvidersList();
		else if (sub === "use" || sub === "switch") runProvidersUse(positional[2]);
		else if (sub === "remove" || sub === "rm" || sub === "delete") await runProvidersRemove(positional[2], autoApprove);
		else throw new Error(`Unknown subcommand "providers ${sub}". Use: list | use <id> | remove <id>`);
		return;
	}
	if (cmd === "use" && positional.length === 2) {
		runProvidersUse(positional[1]);
		return;
	}
	if (positional.length > 0) {
		await runOneShot({
			prompt: positional.join(" "),
			cwd,
			version: VERSION,
			env: process.env,
			providerId,
			model: modelOverride,
			autoApprove,
			continueLatest,
			...typeof resume === "string" ? { resumeId: resume } : {}
		});
		return;
	}
	if (!process.stdin.isTTY && !process.stdout.isTTY && !continueLatest && !resume) {
		await runAcpStdioServer();
		return;
	}
	if (!process.stdin.isTTY || !process.stdout.isTTY) {
		console.error("Interactive TUI requires a TTY on stdin and stdout. Pass a prompt string for one-shot mode: oly \"<prompt>\"");
		process.exitCode = 1;
		return;
	}
	await runTui({
		cwd,
		version: VERSION,
		env: process.env,
		providerId,
		model: modelOverride,
		autoApprove,
		continueLatest,
		resume,
		runLogin: runLoginWizard
	});
}
export { main, runLoginWizard };
