import { Template } from 'meteor/templating';

// import { Characters } from '/imports/api/characters';

import './characterItem.html';


Template.CharacterItem.helpers({
  name() {
    return Template.currentData().character.name;
  }
})
