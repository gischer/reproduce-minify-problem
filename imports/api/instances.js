import { Meteor } from 'meteor/meteor';
import { Mongo } from 'meteor/mongo';
//import SimpleSchema from 'simpl-schema';
const SimpleSchema = {};
import { R } from 'meteor/ramda:ramda';

//import { Classes } from '/imports/api/classes';
import { CombatantSchema, Combatants, combatantsForInstance, enemyCombatantsForInstance } from '/imports/api/combatants';
//import { Decks } from '/imports/api/decks';
//import { Enemies } from '/imports/api/enemies';
//import { Levels } from '/imports/api/levels';
const Classes = {};
const Decks = {};
const Enemies = {};
const Levels = {};

export const Instances = new Mongo.Collection('instances');

// An instance is a play-through of a level.  It holds the (mutable) state
// of everything in that scenario, locations, damage, conditions, card decks,
// whatever.
//
// Format of a instance is:
// {
//  _id: <instanceId>,
//  levelId: <levelId>
//  combatants: [combatant1, combatant2, ...]
//
//  },
//}
const InstancePhases = ["BRIEF", "PLAY", "RESOLVE"];
const EnviroPhases = ["PhaseA", "PhaseB", "PhaseC", "PhaseD", "PhaseE"];
const PlayerStatus = ["Open", "Closed", "Invited", "Selected", "Ready"];

export const InstanceSchema = new SimpleSchema({
  _id: {type: String, optional: true},
  levelId: {type: String, optional: false},
  creatorId: {type: String, optional: true},
  // slots always has 4 entries.  Each of these entries must
  // always have a status taken ['Closed', 'Open', 'Invited', 'Selected', 'Ready']
  // With status of "Invited", "Selected" or "Ready", userId must be
  // set to a valid userId, designating the user that associated with this slot.
  // With status "Selected" or "Ready", combatantId must also be set to the id
  // of the combatant record that is being used by the associated user.
  // By convention, slot[0] is associated with the instances creator, and can
  // never have the status "Open" or "Closed".  It begins in "Invited".
  slots: {type: Array, optional: true},
  "slots.$": {type: Object},
  "slots.$.status": {type: String, allowedValues: PlayerStatus},
  "slots.$.userId": {type: String, optional: true },
  "slots.$.combatantId": {type: String, optional: true },
  name: {type: String, optional: true},
  round: {type: SimpleSchema.Integer, optional: false},
  phase: {type: String, allowedValues: InstancePhases, optional: false},
  enviro: {type: Object},
  "enviro.active": {type: Array},
  "enviro.active.$": {type: String},
  "enviro.inactive": {type: Array},
  "enviro.inactive.$": {type: String},
  "enviro.phase": {type: String, allowedValues: EnviroPhases},
  ordinal: {type: SimpleSchema.Integer, optional: true},
});

export function instanceFromLevel(levelId) {
  const instance = {};
  instance.levelId = levelId;
  instance.ordinal = 0;
  instance.round = 0;
  instance.phase = "BRIEF";
  const level = Levels.findOne(levelId);
  const eDeck = Decks.findOne(level.enviroId);
  instance.enviro = {};
  instance.enviro.active = eDeck.cards;
  instance.enviro.inactive = [];
  instance.enviro.phase = "PhaseA";
  return instance;
};

Meteor.methods({
  "instance.create"(instanceArgs) {
    // Args are not an instance.  They are a level and a list of classIds.
    if (Meteor.isServer) {
      const instance = instanceFromLevel(instanceArgs.levelId);
      instance.phase = "PLAY";
      const instanceId = Instances.insert(instance);
      const combatants = combatantsForInstance(instanceArgs, instanceId);
      function insertCombatant(combatant) {
        Combatants.insert(combatant);
      }
      R.map(insertCombatant, combatants);
      return instanceId;
    }
  },

  "instance.create.2"(args) {
    const instance = instanceFromLevel(args.levelId);
    instance.creatorId = args.creatorId;
    instance.slots = [
      {status: "Invited", userId: args.creatorId},
      {status: "Open"},
      {status: "Open"},
      {status: "Open"},
    ];
    instance.name = args.name;
    const instanceId = Instances.insert(instance);
    if (Meteor.isServer) {
      // This would require a subscription to Enemies in the client to simulate
      const enemyCombatants = enemyCombatantsForInstance(instanceId, args.levelId);
      function insertCombatant(combatant) {
        Combatants.insert(combatant);
      }
      R.map(insertCombatant, enemyCombatants);
    }
    return instanceId;
  },

  "instance.update"(instanceId, instance) {
    const cleanInstance = InstanceSchema.clean(instance);
    Instances.update(instanceId, cleanInstance);
  },

  "instance.delete"(instanceId) {
    Instances.remove(instanceId);
    const combatants = Combatants.find({instanceId: instanceId}).fetch();
    function removeCombatant(combatant) {
      Combatants.remove(combatant._id);
    }
    R.map(removeCombatant, combatants);
  },
});

if (Meteor.isServer) {
  Meteor.publish('instances.singleton', function(id) {
    return Instances.find({_id: id});
  });

  Meteor.publish('instances', function() {
    return Instances.find({});
  });
}
