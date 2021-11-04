import { Meteor } from 'meteor/meteor';
import { Template } from 'meteor/templating';
import { R } from 'meteor/ramda:ramda';

//import { Characters } from '/imports/api/characters';
//import { Decks } from '/imports/api/decks';
//import { Levels } from '/imports/api/levels';
const Characters = {};
const Decks = {};
const Levels = {};
import { Instances } from '/imports/api/instances';

//import { Config } from '/imports/startup/both/config'

//import { currentUser } from "/imports/ui/components/setUser";
function currentUser(){};

import "./home.html";
import './characterItem.js';

Template.Home.onCreated(function() {
  this.autorun(() => {
    this.charsHandle = this.subscribe('characters');
    // This is subscribed so that the client-side simulation of the method call will work.
    this.decksHandle = this.subscribe('decks');
    this.levelsHandle = this.subscribe('levels');
    this.instancesHandle = this.subscribe('instances');
  })
});

Template.Home.helpers({
  dataReady() {
    return Template.instance().subscriptionsReady();
  },

  preferredHandle() {
    return currentUser().preferredHandle;
  },

  characters() {
    const myId = currentUser().id;
    function isMyCharacter(character) {
      return character.ownerId === myId;
    };

    if (Template.instance().charsHandle.ready()) {
      const characters = Characters.find().fetch();
      return R.filter(isMyCharacter, characters);
    }
    return [];
  },

  options_for_instance_creation() {
    const levels = Levels.find().fetch();
    function optionFromLevel(accum, level) {
      return accum + `<option value=${level._id}>${level.name}</option>`;
    }
    return R.reduce(optionFromLevel, "", levels);
  },

  ownedInstances() {
    if (Template.instance().instancesHandle.ready()) {
      const instances = Instances.find().fetch();
      const user = currentUser();
      function isCreator(instance) {
        return (user.id === instance.creatorId);
      }
      return R.filter(isCreator, instances);
    } else {
      return [];
    }
  },

  instances() {
    if (Template.instance().instancesHandle.ready()) {
      const instances = Instances.find().fetch();
      const user = currentUser();
      function isInvitedSlot(accum, slot) {
        // This test is redundant.  It should not be possible for
        // a slot to have userId set, and not have one of the three
        // statuses mentioned below.
        // But I'm keeping it just to safeguard some sort of potential
        // bad data scenario.
        return accum ||
        ((slot.userId === user.id)
          && ((slot.status === "Invited")
            || (slot.status === "Selected")
            || (slot.status === "Ready")));
      }

      function isInvited(instance) {
        return R.reduce(isInvitedSlot, false, instance.slots);
      }

      return R.filter(isInvited, instances);
    } else {
      return [];
    }
  },

  levelName(instance){
    const level = Levels.findOne(instance.levelId);
    return level.name;
  },

  suggested_name() {
    return suggestedName();
  },
});

Template.Home.events({
  "click button#player-create-instance"(event) {
    const levelId = document.getElementById("player-create-instance-select").value;
    var name = suggestedName();
    Meteor.call('instance.create.2', {levelId: levelId, creatorId: currentUser().id, name: name});
  },

  "click .ready-link"(event) {
    event.preventDefault();
    const instanceId = event.currentTarget.getAttribute('data-instance-id');
    Router.go(`/ready/${instanceId}`);
  },

  "click .delete-instance"(event) {
    const instanceId = event.currentTarget.getAttribute('data-instance-id');
    Meteor.call('instance.delete', instanceId);
  }
});

function suggestedName() {
  try {
    const levelId = document.getElementById("player-create-instance-select").value;
    const level = Levels.findOne(levelId);
    const result = level.name + "-" + (new Date().toUTCString());
    return result;
  } catch(e) {}
  const result = new Date().toUTCString();
  return result;
};
