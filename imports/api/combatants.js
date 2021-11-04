import { Meteor } from 'meteor/meteor';
import { Mongo } from 'meteor/mongo';
//import SimpleSchema from 'simpl-schema';
const SimpleSchema = {};
import { R } from 'meteor/ramda:ramda';

//import { Cards } from '/imports/api/cards';
//import { Characters, characterFromClass } from '/imports/api/characters';
//import { Classes } from '/imports/api/classes';
//import { Decks } from '/imports/api/decks';
//import { Enemies } from '/imports/api/enemies';
//import { Images, StaticImages } from '/imports/api/images';
import { Instances } from '/imports/api/instances';
//import { Levels } from '/imports/api/levels';
//import { ModifierSchema } from '/imports/api/actions';
const Cards = {};
const Characters = {};
const Classes = {};
const Decks = {};
const Enemies = {};
const Images = {};
const StaticImages = {};
function characterFromClass(){};

//import { eval } from '/imports/lib/scripting/evaluate';
//import { triangleRoot } from '/imports/lib/triangleRoot';
//import { urlFromId } from '/imports/lib/links';
import { createHook,  createHooksTemplate } from '/imports/lib/scripting/hooks';
//import { activeCombatants, initiativeOrder, resolvingIndex } from '/imports/lib/initiative';
function eval(){};
function triangleRoot(){};
function urlFromId(){};
function activeCombatants(){};
function initiativeOrder(){};
function resolvingIndex(){};

export const Combatants = new Meteor.Collection('combatants', {
  transform(doc) {
    return decorateCombatant(doc);
  }
});

// The idea behind the Combatant type is to provide an interface for
// gameplay that is consistent between Characters and Enemies. This should also
// provide a way to instantiate enemies from an Enemy document, which holds an enemy
// archetype.

// One of the most important ideas here is that the underlying referenced entity
// WILL NOT CHANGE during the course of a scenario. This means we can grab a
// copy of it from MongoDB and not have to worry about refreshing it.
// Any changes made during the course of a battle are recorded in the Combatant wrapper.
// Should there be permanent changes as a result of a scenario, those need to be transmitted
// to the underlying character (this doesn't happen with Enemies) as part of scenario
// cleanup.

// N.B.:  I don't call them classes, since we really do not use inheritance in any
// appreciable way.
//
// Fields
//
// combatantType:  What the underlying object is, either Enemy or Character.
//   some of the helper functions will need to know this in order to do the right thing.
//
// refId: A reference (MongoDB id) to the underlying object.
//
// tokenId: A reference to the image (we might want this to be a url?) we want to use
//    as a token, for easy access.
//
// x, y: The location, in grid coordinates, of the token.
//
// bodyDmg, mindDmg, willDmg:  The damage taken to each of these stats.  This is used
//   to compute
//
// status:  An array of strings that denonte any status effects that might be
//   affecting this entity.

const CombatantTypes = ["Character", "Enemy"];
const ResolutionStates = ['CHOOSE', 'ACT_OR_CHANGE', 'MOVE_OR_CHANGE', 'ACT', 'MOVE', 'CONFIRM', 'DONE'];

export const CombatantSchema = new SimpleSchema({
  _id: {type: String, optional: true },
  combatantType: {type: String, allowedValues: CombatantTypes},
  instanceId: {type: String},
  refId: {type: String},
  x: {type: SimpleSchema.Integer},
  y: {type: SimpleSchema.Integer},

  tokenId: {type: String, optional: true},
  tokenUrl: {type: String, optional: true},

  bodyDmg: {type: SimpleSchema.Integer},
  mindDmg: {type: SimpleSchema.Integer},
  willDmg: {type: SimpleSchema.Integer},
  status: [{type: String}],
  // Optional fields to support UX and gameplay
  resolutionState: {type: String, allowedValues: ResolutionStates, optional: true},
  hasActed: {type: Boolean, optional: true},
  hasMoved: {type: Boolean, optional: true},

  // Optional field to support Character combatant
  deckId: {type: String, optional: true},
  draw: {type: Array, optional: true},
  "draw.$": String,
  discard: {type: Array, optional: true},
  "discard.$": String,
  hand: {type: Array, optional: true},
  "hand.$": String,
  playedCardId: {type: String, optional: true},
  enhanceCardId: {type: String, optional: true},
  modifiers: {type: Array, optional: true},
  "modifiers.$": ModifierSchema,
  // Optional field to support Enemy combatant
  chosenBehavior: {type: String, optional: true},
});

const ModifierHelper = {
  modifiersFor(tag) {
    const self = this;
    function addModifier(accum, modifier) {
      if (modifier.target === tag) {
        const val = self.eval(modifier.modifier);
        return accum + val;
      }
      return accum;
    }
    if (self.modifiers) {
      return R.reduce(addModifier, 0, self.modifiers);
    } else {
      return 0;
    }
  }
};

export const CharacterCombatantHelpers = {
  ownerId() {
    return this.ref.ownerId;
  },

  isIncapacitated() {
    return false;
  },

  body() {
    return this.eval(this.ref.myClass.body) + this.modifiersFor('body') - this.bodyDmg;
  },

  bodyMax() {
    return this.eval(this.ref.myClass.body);
  },

  mind() {
    return this.eval(this.ref.myClass.mind) + this.modifiersFor('mind') - this.mindDmg;
  },

  mindMax() {
    return this.eval(this.ref.myClass.mind);
  },

  will() {
    return this.eval(this.ref.myClass.will) + this.modifiersFor('will') - this.willDmg;
  },

  willMax() {
    return this.eval(this.ref.myClass.will);
  },

  none() {
    return 0;
  },

  strength() {
    const uses = this.ref.myClass.strength.uses;
    return this.eval(`${this[uses]()} + ${this.modifiersFor('strength')} + ${this.ref.myClass.strength.modifier}`);
  },

  defense() {
    const uses = this.ref.myClass.defense.uses;
    return this.eval(`${this[uses]()} + ${this.modifiersFor('defense')} + ${this.ref.myClass.defense.modifier}`);
  },

  resist() {
    const uses = this.ref.myClass.resist.uses;
    return this.eval(`${this[uses]()} + ${this.modifiersFor('resist')} + ${this.ref.myClass.resist.modifier}`);
  },

  move() {
    const uses = this.ref.myClass.move.uses;
    return this.eval(`${this[uses]()} + ${this.modifiersFor('move')} + ${this.ref.myClass.move.modifier}`);
  },

  tactics() {
    const uses = this.ref.myClass.tactics.uses;
    return this.eval(`${this[uses]()} + ${this.modifiersFor('tactics')} + ${this.ref.myClass.tactics.modifier}`);
  },

  awareness() {
    const uses = this.ref.myClass.awareness.uses;
    return this.eval(`${this[uses]()} + ${this.modifiersFor('awareness')} + ${this.ref.myClass.awareness.modifier}`);
  },

  hasStatus(status) {
    return R.contains(status, this.status);
  },

  name() {
    return this.ref.name;
  },

  attackStrength() {
    return this.strength();
  },

  handSize() {
    return 1 + triangleRoot(this.tactics());
  },

  drawCard() {
    this.draw = this.draw || [];
    this.discard = this.discard || [];
    this.hand = this.hand || [];
    if (this.draw.length + this.hand.length + this.discard.length === 0) {
      const deck = Decks.findOne(this.deckId);
      this.draw = shuffle(deck.cards);
    }

    function shuffle(cards) {
      function pickOne(result, remaining) {
        if (remaining.length == 0 ) return result;
        const index = Math.floor(Math.random() * remaining.length);
        return pickOne(R.append(remaining[index], result), R.remove(index, 1, remaining));
      }
      return pickOne([], cards);
    }

    if (this.draw.length == 0) {
      this.draw = shuffle(this.discard);
      this.discard = [];
    }
    const result = this.draw[0];
    this.draw = R.slice(1, Infinity, this.draw);
    return result;
  }
}


const EnemyCombatantHelpers = {
  isIncapacitated() {
    return (this.attack() <= 0 || this.move() <= 0 || this.awareness() <= 0)
  },

  body() {
    return 0-this.bodyDmg;
  },

  mind() {
    return 0-this.mindDmg;
  },

  will() {
    return 0-this.willDmg;
  },

  none() {
    return 0;
  },

  defense() {
    const uses = this.ref.defense.uses;
    return this[uses]() + this.eval(this.ref.defense.value);
  },

  resist() {
    const uses = this.ref.resist.uses;
    return this[uses]() + this.eval(this.ref.resist.value);
  },

  attack() {
    const uses = this.ref.attack.uses;
    return this[uses]() + this.eval(this.ref.attack.value);
  },

  move() {
    const uses = this.ref.move.uses;
    return this[uses]() + this.eval(this.ref.move.value);
  },

  awareness() {
    const uses = this.ref.awareness.uses;
    return this[uses]() + this.eval(this.ref.awareness.value);
  },

  hasStatus(status) {
    return R.contains(status, this.status);
  },

  name() {
    return this.ref.name;
  },

  attackStrength() {
    return this.attack();
  },
}

const DefaultCombatant = {
  x: 0,
  y: 0,
  bodyDmg: 0,
  mindDmg: 0,
  willDmg: 0,
  status: [],
};

export function decorateCombatant(combatant) {
  if (combatant.combatantType === 'Character') {
    combatant.ref = Characters.findOne(combatant.refId);
    combatant.eval = eval;
    return R.merge(ModifierHelper, R.merge(CharacterCombatantHelpers, combatant))
  } else if (combatant.combatantType === 'Enemy') {
    combatant.ref = Enemies.findOne(combatant.refId);
    combatant.eval = eval;
    return R.merge(ModifierHelper, R.merge(EnemyCombatantHelpers, combatant));
  }
  return combatant;
}


export function combatantsForInstance(args, instanceId) {
  let count = 0;

  function addCombatant(classId) {
    const cls = Classes.findOne(classId);
    const combatant = combatantFromClass(cls);
    combatant.x = count++;
    combatant.y = 0;
    combatant.instanceId = instanceId;
    return combatant;
  }
  const characterCombatants = R.map(addCombatant, args.classes);

  function addEnemy(enemyPlacement) {
    const enemy = Enemies.findOne(enemyPlacement.enemyId);
    const combatant = combatantFromEnemy(enemy);
    combatant.x = enemyPlacement.x;
    combatant.y = enemyPlacement.y;
    combatant.instanceId = instanceId;
    return combatant;
  }
  const level = Levels.findOne(args.levelId);
  const enemyCombatants = R.map(addEnemy, level.enemies);
  const combatants = R.concat(characterCombatants, enemyCombatants);
  return combatants;
}

export function enemyCombatantsForInstance(instanceId, levelId) {
  const level = Levels.findOne(levelId);

  function addEnemy(enemyPlacement) {
    const enemy = Enemies.findOne(enemyPlacement.enemyId);
    const combatant = combatantFromEnemy(enemy);
    combatant.x = enemyPlacement.x;
    combatant.y = enemyPlacement.y;
    combatant.instanceId = instanceId;
    return combatant;
  }
  const enemyCombatants = R.map(addEnemy, level.enemies);
  return enemyCombatants;
}

export function combatantFromClass(cls) {
  const newCharacter = characterFromClass(cls);
  return combatantFromCharacter(newCharacter);
};

export function combatantFromCharacter(character) {
  // We put in a default deck here, but it could be changed later
  // This is why we don't set draw now.
  const deck = Decks.findOne({ownerType: "Class", ownerId: character.classId });
  const newC = {
    combatantType: 'Character',
    refId: character._id,
    tokenId: (character.portraitId || "generic"),
    tokenUrl: (character.portraitUrl || StaticImages['generic-profile-picture.png']),
    deckId: deck._id,
    draw: [],
  }
  return R.merge(DefaultCombatant, newC);
};

export function combatantFromEnemy(enemy) {
  const newC = {
    combatantType: 'Enemy',
    refId: enemy._id,
    tokenId: enemy.primaryImageId,
    tokenUrl: (!!enemy.primaryImageId ? urlFromId(enemy.primaryImageId) : StaticImages['genric-profile-picture.png']),
  }
  return R.merge(DefaultCombatant, newC);
}

Meteor.methods({
  'combatant.createFrom'(combatant) {
    const newCombatant = {};
    newCombatant.combatantType = combatant.moduleType;
    newCombatant.refId = combatant._id;
    newCombatant.tokenId = 'generic';
    newCombatant.tokenUrl = StaticImages['generic-profile-picture.png']
    CombatantSchema.validate(R.merge(DefaultCombatant, newCombatant));
    return Combatants.insert(R.merge(DefaultCombatant, newCombatant));
  },

  'combatant.fromCharacter'(charid, instanceId, slotIndex) {
    const character = Characters.findOne(charid);
    const combatant = combatantFromCharacter(character);
    combatant.instanceId = instanceId;
    const instance = Instances.findOne(instanceId);
    const level = Levels.findOne(instance.levelId);
    if (typeof level.starters == 'undefined') {
      // for compatibility
      combatant.x = slotIndex;
      combatant.y = 0;
    } else {
      combatant.x = level.starters[slotIndex].x;
      combatant.y = level.starters[slotIndex].y;
    }
    CombatantSchema.validate(combatant);
    return Combatants.insert(combatant);
  },

  'combatant.done'(combatantId) {
    // This is called when a combatant's turn is finished.
    // This allows for triggering of onTurnEnd scripts.
    const combatant = Combatants.findOne(combatantId);
    if (combatant.combatantType === 'Character') {
      const playedCard = Cards.findOne(combatant.playedCardId);
      const scriptText = playedCard.scriptText || createHooksTemplate();
      const onTurnEndHook = createHook('onTurnEnd', scriptText, ['me']);
      onTurnEndHook.run({
        me: CombatantSchema.clean(combatant),
      })
    }
    Combatants.update(combatantId, {$set: {resolutionState: 'DONE'}});

    // And now we figure out who the next combatant is, if any, and run the 'onTurnStart'
    // hook for it.
    const combatants = Combatants.find({instanceId: combatant.instanceId}).fetch();
    const initOrder = initiativeOrder(activeCombatants(combatants));
    const index = resolvingIndex(initOrder);
    // If this was the last combatant this round, stop here.
    // we can't use initiative order because it might change for the next round.
    // In consequence, we have to run the "onTurnStart" hook from BeginRound as well
    // as here.
    if (index == -1) return;

    const nextCombatant = initOrder[index];
    if (nextCombatant.combatantType === 'Character') {
      const playedCard = Cards.findOne(nextCombatant.playedCardId);
      const scriptText = playedCard.scriptText || createHooksTemplate();
      const onTurnStartHook = createHook('onTurnStart', scriptText, ['me']);
      onTurnStartHook.run({
        me: CombatantSchema.clean(nextCombatant),
      })
    }
  },

  // Combatants on the client are decorated with extra stuff that doesn't
  // need to go into the database. However, this method is only called with
  // update operators like {$set: ...}. Things will get pretty messy if
  // we don't stick to this convention.
  'combatant.update'(combatantId, update) {
    return Combatants.update(combatantId, update);
  },

  'combatant.remove'(combatantId) {
    return Combatants.remove(combatantId);
  }
});

if (Meteor.isServer) {
  Meteor.publish("combatants", function() {
    return Combatants.find({});
  });

  Meteor.publish("combatants.fromInstance", function(id) {
    return Combatants.find({instanceId: id});
  })
}
