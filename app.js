var
    gameport        = process.env.PORT || 3000,

    socket          = require('socket.io'),
    express         = require('express'),
    UUID            = require('uuid/v4'),
    cookie    = require('cookie')
    pug             = require('pug'),

    verbose         = false,
    app             = express();

var fs = require('fs');
var access = fs.createWriteStream(__dirname + '/debug.log');
// process.stdout.write = process.stderr.write = access.write.bind(access);

process.on('uncaughtException', function(err) {
  console.error((err && err.stack) ? err.stack : err);
});

var server = app.listen(gameport);

console.log('\t :: Express :: Listening on port ' + gameport );

io = socket(server);

app.use('/assets', express.static(__dirname + '/public'));

app.set('views', './views');
app.set('view engine', 'pug');

app.get('/', function (req, res) {
  res.render('index', {
    title: "One Night Ultimate Werewolf",
    choose: "Choose",
    username: "Username",
    start: "Start",
    back: "Back"
  });
});

app.get('/test', function (req, res) {
  res.render('test');
});

var ROLES = {
  doppelganger: 'doppelganger',
  werewolf:     'werewolf',
  minion:       'minion',
  mason:        'mason',
  seer:         'seer',
  robber:       'robber',
  troublemaker: 'troublemaker',
  drunk:        'drunk',
  insomniac:    'insomniac',
  villager:     'villager',
  hunter:       'hunter',
  tanner:       'tanner'
}

// ROLE_TILES = [
//   { id: ROLES.doppelganger, clicked: false }, { id: ROLES.werewolf, clicked: false },
//   { id: ROLES.werewolf,     clicked: false }, { id: ROLES.minion,   clicked: false },
//   { id: ROLES.mason,        clicked: false }, { id: ROLES.mason,    clicked: false },
//   { id: ROLES.seer,         clicked: false }, { id: ROLES.robber,   clicked: false },
//   { id: ROLES.troublemaker, clicked: false }, { id: ROLES.drunk,    clicked: false },
//   { id: ROLES.insomniac,    clicked: false }, { id: ROLES.villager, clicked: false },
//   { id: ROLES.villager,     clicked: false }, { id: ROLES.villager, clicked: false },
//   { id: ROLES.hunter,       clicked: false }, { id: ROLES.tanner,   clicked: false }
// ];

var ROLE_TILES = [
  { id: ROLES.werewolf, clicked: false },
  { id: ROLES.werewolf,     clicked: false }, { id: ROLES.minion,   clicked: false },
  { id: ROLES.mason,        clicked: false }, { id: ROLES.mason,    clicked: false },
  { id: ROLES.seer,         clicked: false }, { id: ROLES.robber,   clicked: false },
  { id: ROLES.troublemaker, clicked: false }, { id: ROLES.drunk,    clicked: false },
  { id: ROLES.insomniac,    clicked: false }, { id: ROLES.villager, clicked: false },
  { id: ROLES.villager,     clicked: false }, { id: ROLES.villager, clicked: false },
  { id: ROLES.hunter,       clicked: false }, { id: ROLES.tanner,   clicked: false }
];

var POSITIONS = [
  { top: 15, left: 33  }, { top: 15, left: 50  }, { top: 15, left: 66  },
  { top: 85, left: 33  }, { top: 85, left: 50  }, { top: 85, left: 66  },
  { top: 33, left:  8  }, { top: 66, left:  8  },
  { top: 33, left: 92  }, { top: 66, left: 92  },
  { top: 40, left: 40  }, { top: 40, left: 50  }, { top: 40, left: 60  },
  { top: 60, left: 50  }
];

var REVEAL_BUTTON_POSITION = {
  top: 80,
  left: 5
};

POSITIONS.randomPositions = function POSITIONS_randomPositions(playersNumber, centerCardsNumber) {
  var positions = [];

  for (var i = 0; i < playersNumber; i++) {
    var randomIndex = Math.floor(Math.random()*(POSITIONS.length - 4));
    positions.push(POSITIONS[randomIndex]);
  }

  // Creates a set of positions array
  positions = positions.filter(function (value, index, self) {
    return self.indexOf(value) === index;
  });

  // If all positions are unique return that array
  // Otherwise try again
  if (positions.length != playersNumber)
    return POSITIONS.getPositions(playersNumber);
  else
    return positions;
}

POSITIONS.getPositions = function POSITIONS_getPositions(playersNumber, centerCardsNumber) {
  return this.randomPositions(playersNumber, centerCardsNumber);
}

var LOCATIONS = {
  lobby: 1,
  room: 2,
  game: 3
}

var STATES = {
  doNothing: 0,
  roleView: 1,
  werewolfAction: 2,
  seerActionOne: 3,
  seerActionTwo: 4,
  robberAction: 5,
  troublemakerActionPick: 6,
  troublemakerActionSwitch : 7,
  drunkAction: 8,
  discussion: 9,
  insomniacAction: 10
}

function clone(obj) {
  copy = {};
  for (var attr in obj) {
     if (obj.hasOwnProperty(attr)) copy[attr] = obj[attr];
  }
  return copy;
}

var Players = function () {}

Players.prototype.exists = function Players_exists(username) {
  return this[username];
}

Players.prototype.getData = function (username) {
  var player = this.exists(username);
  if (player)
    return player.data;
};

Players.prototype.add = function Players_add(username, client, data) {
  client.username = username;
  if (data) {
    console.log(data);
    client.data = data;
  }
  this[username] = client;
}

Players.prototype.delete = function Players_delete(username) {
  delete this[username];
}

Players.prototype.toList = function Players_toList() {
  var values = [];
  for(var key in this) {
    if (this.hasOwnProperty(key) && typeof this[key] != 'function')
    values.push(this[key]);
  }
  return values;
}

var Game = function (gameName, roles, centerCardsNumber) {
  this.name = gameName;
  this.players = new Players();
  this.roles = roles;
  this.endRoles = clone(roles);
  this.center = centerCardsNumber;
  this.hasntSeenRole = 0;
  this.state = STATES.doNothing;
  this.pollMethods = {
    werewolf:     this.pollWerewolf,
    minion:       this.pollMinion,
    mason:        this.pollMason,
    seer:         this.pollSeer,
    robber:       this.pollRobber,
    troublemaker: this.pollTroublemaker,
    drunk:        this.pollDrunk,
    insomniac:    this.pollInsomniac
  }
}

Game.prototype.getState = function Game_getState() {
  return this.state;
};

Game.prototype.setState = function Game_setState(state) {
  this.state = state;
};

Game.prototype.getPlayersNumber = function Game_getPlayersNumber() {
  return this.players.toList().length;
};

Game.prototype.isEmpty = function Game_isEmpty() {
  return this.getPlayersNumber() == 0;
};

Game.prototype.getPlayers = function Game_getPlayers(index) {
  var all = this.players.toList();
  if (index != undefined)
    return all[index];
  return all;
};

Game.prototype.addPlayer = function Game_addPlayer(username, player, reconnect) {
  this.players.add(username, player);
  if (reconnect == undefined)
    player.data.hasntSeenRole = true;
};

Game.prototype.sawRole = function Game_sawRole(player) {
  player.data.hasntSeenRole = false;
};

Game.prototype.allSeenRoles = function Game_allSeenRoles() {
  var sawRole = 0;
  this.getPlayers().forEach(function (player) {
    if (player.data.hasntSeenRole) {
      sawRole++;
    }
  })
  return sawRole == 0;
};

Game.prototype.getPlayerRole = function Game_getPlayerRole(username) {
  return this.endRoles[username];
};

Game.prototype.setPlayersPositions = function Game_setPlayersPositions(players) {
  this.playersPositions = players;
};

Game.prototype.getPlayersPositions = function Game_getPlayersPositions(players) {
  return this.playersPositions;
};

Game.prototype.start = function Game_start(room) {
  var players = room.getPlayersPositions();
  this.setPlayersPositions(players);

  var state = STATES.roleView;
  this.setState(state);

  this.selectedRoles = room.selectedRoles;

  // Send clients to start a game
  var that = this;
  room.getPlayers().forEach(function (player) {
    // Save that player is in game with name same as room name
    player.goTo(LOCATIONS.game);
    player.enterGame(room.name);

    // Add player to game
    console.log(player.username + ' starting game ' + room.name);
    that.addPlayer(player.username, player);

    sendGamePage(player, players, state);
  });
};

Game.prototype.getPlayersWithRole = function Game_getPlayersWithRole(role) {
  var players = [];
  for(var username in this.roles) {
    if (this.roles.hasOwnProperty(username)) {
      if (this.players[username] && this.roles[username] == role) {
        players.push(this.players[username]);
      }
    }
  }
  return players;
};

Game.prototype.getAllUsernames = function Game_getAllUsernames() {
  var players = [];
  for(var username in this.roles) {
    if (this.roles.hasOwnProperty(username)) {
      players.push(username);
    }
  }
  return players;
};

Game.prototype.getEndRoles = function Game_getEndRoles() {
  var players = [];
  for(var username in this.endRoles) {
    if (this.endRoles.hasOwnProperty(username)) {
      players.push({
        username: username,
        role: this.endRoles[username]
      });
    }
  }
  return players;
};

Game.prototype.pollIdle = function Game_pollIdle() {
  var allUsernames = this.getAllUsernames();

  var state = STATES.doNothing;
  this.setState(state);

  this.getPlayers().forEach(function (player) {
    player.emit('idle-poll', {
      usernames: allUsernames,
      state: state
    });
  });
};

Game.prototype.pollWerewolf = function Game_pollWerewolf() {
  var players = this.getPlayersWithRole(ROLES.werewolf);
  var playersUsernames = getPlayersUsernames(players);

  var state = playersUsernames.length < 2 ? STATES.werewolfAction : STATES.doNothing;
  this.setState(state);

  players.forEach(function (player) {
    player.emit('werewolf-poll', {
      usernames: playersUsernames,
      state: state
    });
  });
};

Game.prototype.pollMinion = function Game_pollMinion() {
  var players = this.getPlayersWithRole(ROLES.minion);
  var playersUsernames = getPlayersUsernames(players);

  var werewolfs = this.getPlayersWithRole(ROLES.werewolf);
  werewolfsUsernames = getPlayersUsernames(werewolfs);

  var state = STATES.doNothing;
  this.setState(state);

  players.forEach(function (player) {
    player.emit('minion-poll', {
      usernames: playersUsernames,
      werewolfs: werewolfsUsernames,
      state: state
    });
  });
};

Game.prototype.pollInsomniac = function Game_pollInsomniac() {
  var players = this.getPlayersWithRole(ROLES.insomniac);
  var playersUsernames = getPlayersUsernames(players);

  var state = STATES.insomniacAction;
  this.setState(state);

  players.forEach(function (player) {
    player.emit('insomniac-poll', {
      usernames: playersUsernames,
      state: state
    });
  });
};

Game.prototype.pollMason = function Game_pollMason() {
  var players = this.getPlayersWithRole(ROLES.mason);
  var playersUsernames = getPlayersUsernames(players);

  var state = STATES.doNothing;
  this.setState(state);

  players.forEach(function (player) {
    player.emit('mason-poll', {
      usernames: playersUsernames,
      state: state
    });
  });
};

Game.prototype.pollSeer = function Game_pollSeer() {
  var players = this.getPlayersWithRole(ROLES.seer);
  var playersUsernames = getPlayersUsernames(players);

  var state = STATES.seerActionOne;
  this.setState(state);

  players.forEach(function (player) {
    player.emit('seer-poll', {
      usernames: playersUsernames,
      state: state
    });
  });
};

Game.prototype.pollRobber = function Game_pollRobber() {
  var players = this.getPlayersWithRole(ROLES.robber);
  var playersUsernames = getPlayersUsernames(players);

  var state = STATES.robberAction;
  this.setState(state);

  players.forEach(function (player) {
    player.emit('robber-poll', {
      usernames: playersUsernames,
      state: state
    });
  });
};

Game.prototype.robberAction = function Game_robberAction(robberUsername, stolenUsername) {
  var stolenRole = this.endRoles[stolenUsername];
  this.endRoles[stolenUsername] = this.endRoles[robberUsername];
  this.endRoles[robberUsername] = stolenRole;
};

Game.prototype.pollTroublemaker = function Game_pollTroublemaker() {
  var players = this.getPlayersWithRole(ROLES.troublemaker);
  var playersUsernames = getPlayersUsernames(players);

  var state = STATES.troublemakerActionPick;
  this.setState(state);

  players.forEach(function (player) {
    player.emit('troublemaker-poll', {
      usernames: playersUsernames,
      state: state
    });
  });
};

Game.prototype.troublemakerAction = function Game_troublemakerAction(usernamePick, usernameSwitch) {
  var switchedRole = this.endRoles[usernamePick];
  this.endRoles[usernamePick] = this.endRoles[usernameSwitch];
  this.endRoles[usernameSwitch] = switchedRole;
};

Game.prototype.pollDrunk = function Game_pollDrunk() {
  var players = this.getPlayersWithRole(ROLES.drunk);
  var playersUsernames = getPlayersUsernames(players);

  var state = STATES.drunkAction;
  this.setState(state);

  players.forEach(function (player) {
    player.emit('drunk-poll', {
      usernames: playersUsernames,
      state: state
    });
  });
};

Game.prototype.drunkAction = function Game_drunkAction(drunkUsername, stolenUsername) {
  var stolenRole = this.endRoles[stolenUsername];
  this.endRoles[stolenUsername] = this.endRoles[drunkUsername];
  this.endRoles[drunkUsername] = stolenRole;
};

Game.prototype.determineRoles = function Game_determineRoles() {

};

Game.prototype.startPolling = function Game_startPolling() {
  var selectedRoles = this.selectedRoles.map(function (role) {
    return role.id;
  });
  console.log(selectedRoles);
  var pollRoles = [
    this.pollIdle.bind(this)
  ];
  var that = this;
  selectedRoles.forEach(function (role) {
    if (that.pollMethods[role])
      pollRoles.push(that.pollMethods[role].bind(that));
  });
  console.log(pollRoles);
  pollAll(pollRoles, 1, function () {
    that.startDiscussion();
    console.log('Discussion started');
  });
};

Game.prototype.startDiscussion = function Game_startDiscussion() {
  var state = STATES.discussion;
  this.setState(state);

  this.getPlayers().forEach(function (player) {
    player.emit('start-discussion', {
      state: state,
      buttonName: 'Reveal'
    });
  });
};

Game.prototype.deletePlayer = function Game_deletePlayer(username) {
  this.players.delete(username);
};

Game.prototype.reveal = function Game_reveal() {
  var endRoles = this.getEndRoles();

  this.getPlayers().forEach(function (player) {
    console.log(player.id);
    player.emit('reveal-aproved', {
      players: endRoles
    });
  });

  console.log('End roles ');
  endRoles.forEach(function (endRole) {
    console.log(endRole);
  });
};

var Room = function (roomName) {
  this.name = roomName;
  this.players = new Players();
  this.roles = ROLE_TILES.slice();
}

Room.prototype.getPlayers = function Room_getPlayers(index) {
  var all = this.players.toList();
  if (index != undefined)
    return all[index];
  return all;
};

Room.prototype.addPlayer = function Room_addPlayer(username, player) {
  this.players.add(username, player);
};

Room.prototype.setRoles = function Room_setRoles(roles) {
  this.roles = roles;
};

Room.prototype.getPlayersNumber = function Room_getPlayersNumber() {
  return this.players.toList().length;
};

Room.prototype.validPlayersNumber = function Room_validPlayersNumber() {
  var roomPlayersNumber = this.getPlayersNumber();
  return roomPlayersNumber >= 3 && roomPlayersNumber <= 10;
};

Room.prototype.validRolesNumber = function Room_validRolesNumber() {
  var roomPlayersNumber = this.getPlayersNumber();
  return roomPlayersNumber + this.centerCardsNumber == this.selectedRoles.length;
};

Room.prototype.setCenterCardsNumber = function Room_setCenterCardsNumber(centerCardsNumber) {
  this.centerCardsNumber = centerCardsNumber;
};

Room.prototype.setSelectedRoles = function Room_setSelectedRoles(selectedRoles) {
  this.selectedRoles = selectedRoles;
};

Room.prototype.getPlayersPositions = function Room_getPlayersPositions() {

  var positions = POSITIONS.getPositions(this.getPlayersNumber());

  // Get players from room
  var players = this.getPlayers().map(function (player, ind) {
    var pos = positions[ind];
    return {
      username: player.username,
      top: pos.top,
      left: pos.left
    }
  });

  // Add fake user for center cards
  for (var i = 1; i <= this.centerCardsNumber; i++) {
    var pos = POSITIONS[POSITIONS.length - 4 + i - 1];
    players.push({
      username: 'c' + i,
      top: pos.top,
      left: pos.left
    });
  }

  return players;

};

Room.prototype.getRolesMap = function Room_getRolesMap() {

  // Array of selected roles to assign
  var rolesToAssign = this.selectedRoles.slice();

  // Give roles
  var rolesMap = {};
  this.getPlayers().forEach(function (player) {
    // Assign random role to player
    var randomRoleIndex = Math.floor(Math.random() * rolesToAssign.length);
    var role = rolesToAssign[randomRoleIndex];
    rolesMap[player.username] = role.id;
    console.log('Assigned role ' + role.id + ' to player ' + player.username);

    // Delete that role from array
    rolesToAssign.splice(randomRoleIndex, 1);
  });

  for (var i = 1; i <= this.centerCardsNumber; i++) {
    // Assign random role to center card
    var randomRoleIndex = Math.floor(Math.random() * rolesToAssign.length);
    var role = rolesToAssign[randomRoleIndex];
    rolesMap['c' + i] = role.id;
    console.log('Assigned role ' + role.id + ' to player c' + i);

    // Delete that role from array
    rolesToAssign.splice(randomRoleIndex, 1);
  }

  return rolesMap;

};

Room.prototype.deletePlayer = function Room_deletePlayer(username) {
  this.players.delete(username);
};

Room.prototype.isEmpty = function Room_isEmpty() {
  return this.getPlayersNumber() == 0;
};

Room.prototype.updateAdmin = function Room_updateAdmin(client) {
  if (client.isAdmin()) {
    if (!this.isEmpty()) {
      // Set admin to first player in the room
      this.getPlayers(0).setAdmin();
    }
    client.removeAdmin();
  }
};

var PLAYERS = new Players();

var GAMES = {};

GAMES.exists = function GAMES_exists(gameName) {
  return this[gameName];
}

GAMES.add = function GAMES_add(room) {
  this[room.name] = new Game(room.name, room.getRolesMap(), room.centerCardsNumber);
}

GAMES.delete = function GAMES_delete(gameName) {
  delete this[gameName];
}

GAMES.toList = function GAMES_toList() {
  var values = [];
  for(var key in this) {
    if (this.hasOwnProperty(key) && typeof this[key] != 'function')
      values.push(this[key]);
  }
  return values;
}

var ROOMS = {};

ROOMS.exists = function ROOMS_exists(roomName) {
  return this[roomName];
}

ROOMS.add = function ROOMS_add(roomName) {
  this[roomName] = new Room(roomName);
}

ROOMS.delete = function ROOMS_delete(roomName) {
  delete this[roomName];
}

ROOMS.toList = function ROOMS_toList() {
  var values = [];
  for(var key in this) {
    if (this.hasOwnProperty(key) && typeof this[key] != 'function')
      values.push(this[key]);
  }
  return values;
}

function reconnect(username, client) {
  PLAYERS.add(username, client, PLAYERS.getData(username));

  // if player was in room add him to room
  if (client.isIn(LOCATIONS.room)) {
    var room = ROOMS.exists(client.getRoom());
    if (room) {
      room.addPlayer(client.username, client);
    }
  }

  // if player was in game add him to game
  if (client.isIn(LOCATIONS.game)) {
    console.log("in game");
    var game = GAMES.exists(client.getGame());
        console.log("Game exitst" + client.getGame() + "SKRAAA");
    if (game) {
      console.log("Game exitst" + client.getGame() + "SKRAAA");
      game.getPlayers().forEach(function (player) {
        console.log(player.id);
      });
      game.addPlayer(client.username, client, true);

        game.getPlayers().forEach(function (player) {
          console.log(player.id);
        });
    }
  }
}

function pollAll(pollRoles, ind, callback) {
  if (ind >= pollRoles.length) {
    pollRoles[0]();
    callback();
    return;
  }
  pollRoles[0]();
  pollRoles[ind]();
  setTimeout(function () {
    pollAll(pollRoles, ind+1, callback);
  }, 10000);
}

function getSelectedRoles(roles) {
  var selectedRoles = [];
  roles.forEach(function (role) {
    if (role.clicked)
      selectedRoles.push(role);
  });
  return selectedRoles;
}

function getCenterCardsNumber(roles) {
  return roles.indexOf(ROLES.alphaWolf) < 0 ? 3 : 4;
}

function deleteRoom(roomName) {
  // Report to all disconnected players that room is deleted
  PLAYERS.toList().forEach(function (player) {
    if (!player.isConnected())
      player.goTo(LOCATIONS.lobby);
  });

  ROOMS.delete(roomName);
}

function deleteGame(gameName) {
  PLAYERS.toList().forEach(function (player) {
    if (!player.isConnected())
      player.goTo(LOCATIONS.lobby);
  });

  GAMES.delete(gameName);
}

function sendLobbyPage(player, rooms) {
  // Compile lobby page
  var page = pug.compileFile('./views/lobby.pug')({
    title: "One Night Ultimate Werewolf",
    roomName: "Room name",
    cancel: "Cancel",
    rooms: rooms,
    username: player.username,
    roomsText: "Rooms available",
    create: "Create"
  });
  // Send client data
  player.emit('update-lobby', {
    page: page
  });
}

function updateLobby(player) {
  // Create rooms list data to send
  var rooms = ROOMS.toList().map(function (room) {
    return {
      name: room.name,
      players: room.getPlayersNumber()
    }
  });

  if (player != undefined) {
    sendLobbyPage(player, rooms);
  } else {
    // Update to players in room that you are not there anymore
    PLAYERS.toList().forEach(function (player) {
      if (player.isIn(LOCATIONS.lobby)) {
        sendLobbyPage(player, rooms);
      }
    });
  }

}

function sendRoomPage(player, players) {
  // Compile room page
  var page = pug.compileFile('./views/room.pug')({
    title: "One Night Ultimate Werewolf",
    players: players,
    roomName: player.getRoom(),
    rolesList: ROOMS.exists(player.getRoom()).roles,
    start: "Start",
    back: "Back"
  });

  // Send client data
  player.emit('update-room', {
    page: page
  });
}

function reconnectToGame(player, gameName) {
  console.log(player.id);
  var game = GAMES.exists(gameName);
  var players = game.getPlayersPositions();
  var state = game.getState();

  // Recconect set to true
  sendGamePage(player, players, state, true);

  if (player.data.hasntSeenRole) {
    var role = game.getPlayerRole(player.username);
    player.emit('see-role-aproved', {
      username: player.username,
      role: role
    });
  }
}

function updateRooms() {
  ROOMS.toList().forEach(function (room) {
    updateRoom(room.name)
  });
}

function updateRoom(roomName) {
  var room = ROOMS.exists(roomName);
  if (!room)
    return;
  // Create players list from this room
  var players = getPlayersUsernames(room.getPlayers());

  // Send update to all clients who are in lobby
  PLAYERS.toList().forEach(function (player) {
    if (player.isIn(LOCATIONS.room) && player.inRoom(roomName)) {
      sendRoomPage(player, players)
    }
  });
}

function sendGamePage(player, players, state, reconnect) {
  // Compile room page
  var page = pug.compileFile('./views/game.pug')({
    reveal: 'Back to lobby',
    buttonPos: REVEAL_BUTTON_POSITION,
    playersList: players
  });

  // Send client data
  player.emit('start-game', {
    page: page,
    state: state,
    reconnect: reconnect
  });
}

function sendError(client, socketEvent, message) {
  client.emit(socketEvent, {
    errorMessage: message
  });
}

function getPlayersUsernames(players) {
  return players.map(function (player) {
    return player.username;
  });
};

function isCenterCard(username) {
  for (var i = 1; i <= 4; i++) {
    if (username == 'c' + i)
      return true;
  }
  return false;
}

io.sockets.on('connection', function (client) {
  console.log('New connection : ' + client.id);

  // Prepare empty data for client
  client.data = {};

  client.connect = function () {
    this.data.connected = true;
  }

  client.disconnect = function () {
    this.data.connected = false;
  }

  client.isConnected = function () {
    return this.data.connected;
  }

  client.authenticate = function (uuid) {
    return this.getUUID() == uuid;
  }

  client.getUUID = function () {
    return this.data.uuid;
  }

  client.setUUID = function (uuid) {
    this.data.uuid = uuid;
  }

  client.isIn = function (location) {
    return this.data.status == location;
  }

  client.goTo = function (location) {
    this.data.status = location;
  }

  client.inRoom = function (roomName) {
    return this.data.roomName == roomName;
  }

  client.enterRoom = function (roomName) {
    this.data.roomName = roomName;
  }

  client.getRoom = function () {
    return this.data.roomName;
  }

  client.inGame = function (gameName) {
    return this.data.gameName == gameName;
  }

  client.enterGame = function (gameName) {
    this.data.gameName = gameName;
  }

  client.getGame = function () {
    return this.data.gameName;
  }

  client.removeAdmin = function () {
    this.data.admin = false;
  }

  client.setAdmin = function () {
    this.data.admin = true;
  }

  client.isAdmin = function () {
    return this.data.admin;
  }

  client.on('back_to_lobby', function () {
    var game = GAMES.exists(client.getGame());
    if (game) {
      game.deletePlayer(client.username);
      if (game.isEmpty()) {
        deleteGame(game.name)
      }
      client.goTo(LOCATIONS.lobby);
    }
    updateLobby(client);
  })

  client.on('disconnect', function () {
    client.disconnect();
    console.log(client.id + ' disconnected');

    // Update room where player maybe was
    var room = ROOMS.exists(client.getRoom());
    if (room) {
      room.deletePlayer(client.username);
      updateRoom(room.name);
      if (room.isEmpty()) {
        deleteRoom(room.name);
      }
    }
    var game = GAMES.exists(client.getGame());
    if (game) {
      console.log(game.getPlayersNumber() + " for game " + client.getGame());
      if (game.isEmpty()) {
        deleteGame(game.name)
      }
    }

    updateLobby();
  });

  client.on('reveal', function () {
    console.log('Requested reveal by' + client.username);

    var game = GAMES.exists(client.getGame());
    game.reveal();
  });

  client.on('drunk-action', function (data) {
    var clickedCard = data.username;

    console.log('Drunk action clicked ' + clickedCard);

    // Switch cards that drunk clicked
    // because its D R U N K
    var game = GAMES.exists(client.getGame());
    game.drunkAction(client.username, clickedCard);
  });

  client.on('troublemaker-action', function (data) {
    var usernamePick = data.usernamePick;
    var usernameSwitch = data.usernameSwitch;

    console.log('Troublemaker action clicked ' + usernamePick + ' and ' + usernameSwitch);

    // Switch cards that troublemaker clicked
    // because its T R O U B L E M A K E R
    var game = GAMES.exists(client.getGame());
    game.troublemakerAction(usernamePick, usernameSwitch);
  });

  client.on('robber-action', function (data) {
    var clickedCard = data.username;

    console.log('Robber action clicked ' + clickedCard);

    // Get role of clicked card
    var game = GAMES.exists(client.getGame());
    var role = game.getPlayerRole(clickedCard);

    client.emit('robber-action-aproved', {
      username: clickedCard,
      role: role
    });

    // Switch robber and clicked card roles
    // because its R O B B E R
    game.robberAction(client.username, clickedCard);
  });

  client.on('seer-action', function (data) {
    var clickedCard = data.username;

    console.log('Seer action clicked ' + clickedCard);

    // Get role of clicked card
    var game = GAMES.exists(client.getGame());
    var role = game.getPlayerRole(clickedCard);

    client.emit('seer-action-aproved', {
      username: clickedCard,
      role: role
    });
  });

  client.on('werewolf-action', function (data) {
    var clickedCard = data.username;

    console.log('Werewolf action clicked ' + clickedCard);

    // Get role of clicked card
    var game = GAMES.exists(client.getGame());
    var role = game.getPlayerRole(clickedCard);

    client.emit('werewolf-action-aproved', {
      username: clickedCard,
      role: role
    });
  });

  client.on('insomniac-action', function (data) {
    var clickedCard = data.username;

    console.log('Insomniac action clicked ' + clickedCard);

    // Get role of clicked card
    var game = GAMES.exists(client.getGame());
    var role = game.getPlayerRole(clickedCard);

    client.emit('insomniac-action-aproved', {
      username: clickedCard,
      role: role
    });
  });

  client.on('saw-role', function (data) {
    var username = client.username;
    var gameName = client.getGame();

    // Get the game
    var game = GAMES.exists(gameName);
    game.sawRole(client);
    client.emit('saw-role-aproved');
    if (game.allSeenRoles()) {
      game.startPolling();
    }
  });

  client.on('see-role', function (data) {
    var username = client.username;
    var gameName = client.getGame();

    console.log(client.username + ' requseted to see role');

    // Get the game
    var game = GAMES.exists(gameName);
    var role = game.getPlayerRole(username);

    client.emit('see-role-aproved', {
      username: username,
      role: role
    });
  });

  client.on('toogled-role', function (data) {
    var roles = data.roles;
    var roomName = data.roomName;

    // Update room roles
    var room = ROOMS.exists(roomName);
    room.setRoles(roles);

    // Update clients in room
    updateRoom(roomName);
  });

  client.on('start-game-request', function (data) {
    var roles = data.roles;
    var roomName = data.roomName;
    var centerCardsNumber = getCenterCardsNumber(roles);

    // Check if there is a valid number of players
    var room = ROOMS.exists(roomName);
    room.setCenterCardsNumber(centerCardsNumber);

    // Get selected roles
    var selectedRoles = getSelectedRoles(roles);
    room.setSelectedRoles(selectedRoles);

    if (!room.validPlayersNumber()) {
      console.log('Declined entering room ' + roomName + ' not valid number of players');
      sendError(client, 'start-game-declined', "Number of players must be from 3 to 10");
      return;
    }

    if (!room.validRolesNumber()) {
      console.log('Declined entering room ' + roomName + ' not valid number of players and roles');
      sendError(client, 'start-game-declined', "Incomatible number of roles and players");
      return;
    }

    // Add game
    GAMES.add(room);

    // Start game
    GAMES.exists(roomName).start(room);

    // Delete room
    deleteRoom(roomName);
  });

  client.on('back-to-lobby', function (data) {
    var roomName = data.roomName;

    // Update players in room
    var room = ROOMS.exists(roomName);
    room.deletePlayer(client.username);

    // If no players left in room delete it
    if (room.isEmpty()) {
      deleteRoom(room.name);
    }

    // If admin left the room give it to someone else (first from list)
    room.updateAdmin(client);

    // Update that player is in lobby again
    client.goTo(LOCATIONS.lobby);

    updateLobby();
    updateRoom(roomName);
  });

  client.on('enter-room', function (data) {
    var roomName = data.roomName;
    // Because client.admin may be undefined, not only false
    if (!client.isAdmin())
      client.removeAdmin();

    console.log(
      'Player with username ' + client.username +  ' admin: ' +
      client.isAdmin() + ' request to enter a room with name ' + roomName
    );

    // Update client room info
    client.enterRoom(roomName);

    // Update that player isn't in lobby anymore
    client.goTo(LOCATIONS.room);

    // Update room players if this is not admin
    // We already updated players for him when he created room
    var room = ROOMS.exists(roomName);

    room.addPlayer(client.username, client);

    var playerData = PLAYERS.getData(client.username);

    updateLobby();
    updateRoom(roomName);
  });

  client.on('new-room-request', function (data) {

    console.log(client.id + ' requested creation of a room with name ' + data.roomName);
    var roomName = data.roomName || '';
    // Check if room name is valid
    roomName = roomName.toLowerCase();
    // If someone sent us a postman-like request, because on client we checked this
    if (roomName.length < 3 || roomName.length > 15) {
      sendError(client, 'new-room-declined', 'Room name must contain 3 to 15 characters');
      return;
    }
    if (ROOMS.exists(roomName)) {
      sendError(client, 'new-room-declined', 'Room name taken');
      return;
    }

    // Add room to rooms list
    ROOMS.add(roomName);

    console.log('Added new room with name ' + roomName);

    // Update that player is admin
    client.setAdmin();

    client.emit('new-room-aproved', {
      roomName: roomName
    });

    updateLobby();
  });

  client.on('login-request', function (data) {

    var uuid = cookie.parse(data.cookie || '').uuid;

    console.log(client.id + ' requested login with username ' + data.username);
    var username = data.username || '';
    var words = []
    username.split(' ').forEach(function(word) { if (word) words.push(word); })
    username = words.join(' ')
    // Check is username valid
    username = username.toLowerCase();
    // If someone sent us a postman-like request, because on client we checked this
    if (username.length < 3 || username.length > 15) {
      sendError(client, 'login-declined', 'Username must contain 3 to 15 characters');
      return;
    }

    var player = PLAYERS.exists(username);
    if (player) {

      if (!player.authenticate(uuid) && player.isConnected()) {
        sendError(client, 'login-declined', 'Username taken');
        return;
      }

      if (player.isConnected()) {
        sendError(client, 'login-declined', 'Already logged in');
        return;
      }

      reconnect(username, client);
      client.connect();
      console.log('Reconnected player ' + username);
      client.emit('login-aproved', {
        username: client.username,
        uuid: client.getUUID()
      });

      updateLobby(client);
      if (client.isIn(LOCATIONS.room))
        updateRoom(client.getRoom());
      if (client.isIn(LOCATIONS.game))
        reconnectToGame(client, client.getGame());

      return;
    }

    if (!player) {
      PLAYERS.add(username, client);

      // Add client to players logged in
      client.goTo(LOCATIONS.lobby);
      client.setUUID(UUID());

      console.log('Added new player with username ' + username);
      console.log('Give new uuid ' + client.getUUID() + ' for ' + username);
    }

    client.connect();
    console.log(' uuid ' + client.getUUID());
    client.emit('login-aproved', {
      username: client.username,
      uuid: client.getUUID()
    });

    updateLobby(client);
  });
});
