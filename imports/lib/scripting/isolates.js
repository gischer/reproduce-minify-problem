//import ivm from 'isolated-vm';
const ivm = {};

//import { Config } from '/imports/startup/both/config.js'

// The strategy we're going to try is to have one isolate that handles everything.
// We may, at a later date, want to have one isolate per instance, but we're going
// to keep things simple for now.

let Isolate = null;

export function getIsolate() {
  if (!Isolate) {
    Isolate = new ivm.Isolate({memoryLimit: Config.IsolateMemoryLimit})
  }
  return Isolate;
};

// Again, we are going to start with just having one context (to rule them all).

let Context = null;
export function getContext() {
  if (!Context) {
    Context = getIsolate().createContextSync()
  }
  return Context;
}

export function clearIsolate() {
  Isolate = null;
  Context = null;
}

export function clearContext() {
  Context = null;
}

export function setGlobal(name, value) {
  const global = getContext().global;
  global.setSync(name, value);
}

export function createUnpackScript(globals) {
  function makeUnpackStatement(key) {
    return `const ${key} = ${key}Ref.copySync();`
  }
  const fetchers = R.map(makeUnpackStatement, R.keys(globals));
  return getIsolate().compileScriptSync(R.reduce(R.concat, "", fetchers));
}

export function setGlobals(object, ctx) {
  const context = !!ctx ? ctx : getContext();
  const global = context.global;
  function setReference(value, key, object) {
    global.setSync(`${key}Ref`, createReference(value));
  }
  R.mapObjIndexed(setReference, object);
}

export function createScript(func) {
  const functionText = func.toString();
  const script = getIsolate().compileScriptSync(functionText);
  return script;
}

export function runScript(script) {
  return script.runSync(getContext());
}

export function createReference(data) {
  return new ivm.Reference(data);
}
