import { R } from 'meteor/ramda:ramda';

let Isolate = null;
let Context = null;

// Hooks
//
// We work from a single block of text that might define the semantics
// for multiple hooks.
// But we create contexts and scripts for each individual hook specifically, reusing that
// text.
// Since we aren't doing any parsing, we need to be told what arguments to pass to the hook.
//
// name:  The name of the hook.  This is what is called by the script.  This is what
//      the scripter sees when writing scripts for a card or whatever.
//
// script:  The script that is compiled by v8 to be run in a context.  It has the
//      code written by the scripter, but also a call to the desired hook, and some setup
//      as well.
// run: a function which runs a compiled script in a fresh context.  It requires
//      that the caller specify certain values which will be the arguments to the hook proper.
//

function arglistReducer(arglist, argument) {
  if (arglist != "") {
    return `${arglist}, ${argument}`;
  }
  return argument;
}

export function createHook(name, text, arguments) {
  if (Meteor.isServer) {
    return createHookServer(name, text, arguments);
  } else {
    return {run(){}};
  }
}
if (Meteor.isServer) {
  import {getIsolate, getContext, clearContext, createUnpackScript, setGlobals} from '/imports/lib/scripting/isolates';
  import { setUtilities, embedText} from '/imports/lib/scripting/utilities';

  function createHookServer(name, text, arguments) {
    const eText = embedText();

    arglist = R.reduce(arglistReducer, "", arguments);

    const hook = {name: name};
    const callText = "(function() {" +
          name + "(" +
          arglist +
          ");" +
          "})()";

    hook.text = eText + text + callText;
    hook.script = getIsolate().compileScriptSync(hook.text);
    hook.run = runHook;
    return hook;
  }

  function runHook(globals) {
    const self = this;
    const context = getIsolate().createContextSync();
    const unpackScript = createUnpackScript(globals);
    setGlobals(globals, context);
    setUtilities(context);
    unpackScript.runSync(context);
    this.script.runSync(context);
  };
}

export const HookList = [
  {name: "onCardPlay", args: ["me"]},
  {name: "onRoundStart", args: ["me"]},
  {name: "onTurnStart", args: ["me"]},
  {name: "onAction", args: ["me"]},
  {name: "onAttack", args: ["me", "target"]},
  {name: "onHit", args: ["me", "target"]},
  {name: "onTurnEnd", args: ["me"]},
  {name: "afterMove", args: ["me"]},
  {name: "beforeApplyCondition", args: ["me", "applier", "condition"]},
  {name: "onBecomeExhausted", args: ["who"]},
]



export function createHooksTemplate() {
  function templateFor(text, hook) {
    const arglist = R.reduce(arglistReducer, "", hook.args);
    return text + `function ${hook.name}(${arglist}){\n` +
           '  // Insert code here \n' +
           '};\n\n'
  }

  return R.reduce(templateFor, "", HookList);
}
