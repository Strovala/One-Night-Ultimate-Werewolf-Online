var
    gameport        = process.env.PORT || 3000,

    socket          = require('socket.io'),
    express         = require('express'),
    UUID            = require('node-uuid'),
    pug             = require('pug'),

    verbose         = false,
    app             = express();

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
  { id: ROLES.werewolf,     clicked: false },
  { id: ROLES.seer,         clicked: false }, { id: ROLES.robber,   clicked: false },
  { id: ROLES.troublemaker, clicked: false }, { id: ROLES.drunk,    clicked: false },
  { id: ROLES.villager, clicked: false },
  { id: ROLES.villager,     clicked: false }, { id: ROLES.villager, clicked: false }
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
  discussion: 9
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

Players.prototype.add = function Players_add(username, client) {
  client.username = username;
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
}

Game.prototype.getPlayers = function Game_getPlayers(idnex) {
  if (index)
    return this.players.toList()[index];
  else
    return this.players.toList();
};

Game.prototype.addPlayer = function Game_addPlayer(username, player) {
  this.players.add(username, player);
  this.hasntSeenRole++;
};

Game.prototype.sawRole = function Game_sawRole() {
  this.hasntSeenRole--;
};

Game.prototype.allSeenRoles = function Game_allSeenRoles() {
  return this.hasntSeenRole == 0;
};

Game.prototype.getPlayerRole = function Game_getPlayerRole(username) {
  return this.roles[username];
};

Game.prototype.start = function Game_start(room) {
  var players = room.getPlayersPositions();
  this.selectedRoles = room.selectedRoles;
  // Send clients to start a game
  var that = this;
  room.getPlayers().forEach(function (player) {
    // Save that player is in game with name same as room name
    player.goTo(LOCATIONS.game);
    player.enterGame(room.name);

    // Add player to game
    that.addPlayer(player.username, player);

    sendGamePage(player, players, STATES.roleView);
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
  this.getPlayers().forEach(function (player) {
    player.emit('idle-poll', {
      usernames: allUsernames,
      state: STATES.doNothing
    });
  });
};

Game.prototype.pollWerewolf = function Game_pollWerewolf() {
  var players = this.getPlayersWithRole(ROLES.werewolf);
  var playersUsernames = getPlayersUsernames(players);
  var state = playersUsernames.length < 2 ? STATES.werewolfAction : STATES.doNothing;
  players.forEach(function (player) {
    player.emit('werewolf-poll', {
      usernames: playersUsernames,
      state: state
    });
  });
};

Game.prototype.pollSeer = function Game_pollSeer() {
  var players = this.getPlayersWithRole(ROLES.seer);
  var playersUsernames = getPlayersUsernames(players);
  players.forEach(function (player) {
    player.emit('seer-poll', {
      usernames: playersUsernames,
      state: STATES.seerActionOne
    });
  });
};

Game.prototype.pollRobber = function Game_pollRobber() {
  var players = this.getPlayersWithRole(ROLES.robber);
  var playersUsernames = getPlayersUsernames(players);
  players.forEach(function (player) {
    player.emit('robber-poll', {
      usernames: playersUsernames,
      state: STATES.robberAction
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
  players.forEach(function (player) {
    player.emit('troublemaker-poll', {
      usernames: playersUsernames,
      state: STATES.troublemakerActionPick
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
  players.forEach(function (player) {
    player.emit('drunk-poll', {
      usernames: playersUsernames,
      state: STATES.drunkAction
    });
  });
};

Game.prototype.drunkAction = function Game_drunkAction(drunkUsername, stolenUsername) {
  var stolenRole = this.endRoles[stolenUsername];
  this.endRoles[stolenUsername] = this.endRoles[drunkUsername];
  this.endRoles[drunkUsername] = stolenRole;
};

Game.prototype.startPolling = function Game_startPolling() {
  console.log(this.selectedRoles);
  var pollRoles = [
    this.pollIdle.bind(this),
    this.pollWerewolf.bind(this),
    this.pollSeer.bind(this),
    this.pollRobber.bind(this),
    this.pollTroublemaker.bind(this),
    this.pollDrunk.bind(this)
  ];
  var that = this;
  pollAll(pollRoles, 1, function () {
    that.startDiscussion();
    console.log('Discussion started');
  });
};

Game.prototype.startDiscussion = function Game_startDiscussion() {
  this.getPlayers().forEach(function (player) {
    player.emit('start-discussion', {
      state: STATES.discussion
    });
  });
};

Game.prototype.reveal = function Game_reveal() {
  var endRoles = this.getEndRoles();

  this.getPlayers().forEach(function (player) {
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
  if (index)
    return this.players.toList()[index];
  else
    return this.players.toList();
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

function updateLobby() {
  // Create rooms list data to send
  var rooms = ROOMS.toList().map(function (room) {
    return {
      name: room.name,
      players: room.getPlayersNumber()
    }
  });

  // Update to players in room that you are not there anymore
  PLAYERS.toList().forEach(function (player) {
    if (player.isIn(LOCATIONS.lobby)) {
      sendLobbyPage(player, rooms);
    }
  });
}

function sendRoomPage(player, players) {
  // Compile room page
  var page = pug.compileFile('./views/room.pug')({
    title: "One Night Ultimate Werewolf",
    players: players,
    roomName: player.roomName,
    rolesList: ROOMS.exists(player.roomName).roles,
    start: "Start",
    back: "Back"
  });

  // Send client data
  player.emit('update-room', {
    page: page
  });
}

function updateRoom(roomName) {
  // Create players list from this room
  var players = [];
  PLAYERS.toList().forEach(function (player) {
    if (player.isIn(LOCATIONS.room) && player.inRoom(roomName)) {
      players.push({
        username: player.username
      });
    }
  });

  // Send update to all clients who are in lobby
  PLAYERS.toList().forEach(function (player) {
    if (player.isIn(LOCATIONS.room) && player.inRoom(roomName)) {
      sendRoomPage(player, players)
    }
  });
}

function sendGamePage(player, players, state) {
  // Compile room page
  var page = pug.compileFile('./views/game.pug')({
    reveal: 'Reveal',
    buttonPos: REVEAL_BUTTON_POSITION,
    playersList: players
  });

  // Send client data
  player.emit('start-game', {
    page: page,
    state: state
  });
}

function sendError(client, event, message) {
  client.emit(event, {
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

  client.isIn = function (location) {
    return this.status == location;
  }

  client.goTo = function (location) {
    this.status = location;
  }

  client.inRoom = function (roomName) {
    return this.roomName == roomName;
  }

  client.enterRoom = function (roomName) {
    this.roomName = roomName;
  }

  client.inGame = function (gameName) {
    return this.gameName == gameName;
  }

  client.enterGame = function (gameName) {
    this.gameName = gameName;
  }

  client.removeAdmin = function () {
    this.admin = false;
  }

  client.setAdmin = function () {
    this.admin = true;
  }

  client.isAdmin = function () {
    return this.admin;
  }

  client.on('disconnect', function () {
    PLAYERS.delete(client.username);
    console.log('Deleted player with username ' + client.username);
    console.log(client.id + ' disconnected');

    // Update room where player maybe was
    var room = ROOMS.exists(client.roomName);
    if (room) {
      room.deletePlayer(client.username);
      updateRoom(room.name);
      if (room.isEmpty())
        ROOMS.delete(room.name);
    }

    var game = GAMES.exists(client.gameName);
    if (game) {
        console.log(client.gameName)
        game.getPlayers().forEach(function (player) {
          console.log(player.username)
          player.goTo(LOCATIONS.lobby);
        });
        GAMES.delete(game.name);
    }

    updateLobby();
  });

  client.on('reveal', function () {
    console.log('Requested reveal by' + client.username);

    var game = GAMES.exists(client.gameName);
    game.reveal();
  });

  client.on('drunk-action', function (data) {
    var clickedCard = data.username;

    console.log('Drunk action clicked ' + clickedCard);

    // Switch cards that drunk clicked
    // because its D R U N K
    var game = GAMES.exists(client.gameName);
    game.drunkAction(client.username, clickedCard);
  });

  client.on('troublemaker-action', function (data) {
    var usernamePick = data.usernamePick;
    var usernameSwitch = data.usernameSwitch;

    console.log('Troublemaker action clicked ' + usernamePick + ' and ' + usernameSwitch);

    // Switch cards that troublemaker clicked
    // because its T R O U B L E M A K E R
    var game = GAMES.exists(client.gameName);
    game.troublemakerAction(usernamePick, usernameSwitch);
  });

  client.on('robber-action', function (data) {
    var clickedCard = data.username;

    console.log('Robber action clicked ' + clickedCard);

    // Get role of clicked card
    var game = GAMES.exists(client.gameName);
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
    var game = GAMES.exists(client.gameName);
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
    var game = GAMES.exists(client.gameName);
    var role = game.getPlayerRole(clickedCard);

    client.emit('werewolf-action-aproved', {
      username: clickedCard,
      role: role
    });
  });

  client.on('saw-role', function (data) {
    var username = client.username;
    var gameName = client.gameName;

    // Get the game
    var game = GAMES.exists(gameName);
    game.sawRole();
    client.emit('saw-role-aproved');
    if (game.allSeenRoles()) {
      game.startPolling();
    }
  });

  client.on('see-role', function (data) {
    var username = client.username;
    var gameName = client.gameName;

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
    ROOMS.delete(roomName);
  });

  client.on('back-to-lobby', function (data) {
    var roomName = data.roomName;

    // Update players in room
    var room = ROOMS.exists(roomName);
    room.deletePlayer(client.username);

    // If no players left in room delete it
    if (room.isEmpty()) {
      ROOMS.delete(room.name);
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

    console.log('Player with username ' + client.username +  ' admin: ' + client.admin + ' request to enter a room with name ' + roomName);

    // Update client room info
    client.enterRoom(roomName);

    // Update that player isn't in lobby anymore
    client.goTo(LOCATIONS.room);

    // Update room players if this is not admin
    // We already updated players for him when he created room
    var room = ROOMS.exists(roomName);
    room.addPlayer(client.username, client);

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

    console.log(client.id + ' requested login with username ' + data.username);
    var username = data.username || '';
    // Check is username valid
    username = username.toLowerCase();
    // If someone sent us a postman-like request, because on client we checked this
    if (username.length < 3 || username.length > 15) {
      sendError(client, 'login-declined', 'Username must contain 3 to 15 characters');
      return;
    }
    if (PLAYERS.exists(username)) {
      sendError(client, 'login-declined', 'Username taken');
      return;
    }

    // Add client to players logged in
    client.goTo(LOCATIONS.lobby);

    PLAYERS.add(username, client);
    console.log('Added new player with username ' + username);

    updateLobby();
  });
});
