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


app.get('/game', function (req, res) {
  var positions = POSITIONS.getPositions(5, 3);
  res.render('game', {
    playersList: [
      {
        username: 'Krimina',
        top: positions[0].top,
        left: positions[0].left,
      },
      {
        username: 'Krimina',
        top: positions[1].top,
        left: positions[1].left,
      },
      {
        username: 'Krimina',
        top: positions[2].top,
        left: positions[2].left,
      },
      {
        username: 'Krimina',
        top: positions[3].top,
        left: positions[3].left,
      },
      {
        username: 'Krimina',
        top: positions[4].top,
        left: positions[4].left,
      },
      {
        username: 'c1',
        top: POSITIONS[10].top,
        left: POSITIONS[10].left,
      },
      {
        username: 'c2',
        top: POSITIONS[11].top,
        left: POSITIONS[11].left,
      },
      {
        username: 'c3',
        top: POSITIONS[12].top,
        left: POSITIONS[12].left,
      }
    ]
  });
});

ROLES = {
  doppelganger: 'doppelganger',
  werewolf:     'werewolf',
  minion:       'minion',
  mason:        'mason',
  seer:         'seer',
  robber:       'robber',
  troublemaker: 'troublemaker',
  villager:     'villager',
  tanner:       'tanner',
  insomniac:    'insomniac',
  hunter:       'hunter',
  drunk:        'drunk'
}

ROLE_TILES = [
  { id: ROLES.doppelganger, clicked: false }, { id: ROLES.werewolf,  clicked: false },
  { id: ROLES.werewolf,     clicked: false }, { id: ROLES.minion,    clicked: false },
  { id: ROLES.mason,        clicked: false }, { id: ROLES.mason,     clicked: false },
  { id: ROLES.seer,         clicked: false }, { id: ROLES.robber,    clicked: false },
  { id: ROLES.troublemaker, clicked: false }, { id: ROLES.villager,  clicked: false },
  { id: ROLES.villager,     clicked: false }, { id: ROLES.villager,  clicked: false },
  { id: ROLES.tanner,       clicked: false }, { id: ROLES.insomniac, clicked: false },
  { id: ROLES.hunter,       clicked: false }, { id: ROLES.drunk,     clicked: false }
];

var POSITIONS = [
  { top: 15, left: 33  }, { top: 15, left: 50  }, { top: 15, left: 66  },
  { top: 85, left: 33  }, { top: 85, left: 50  }, { top: 85, left: 66  },
  { top: 33, left:  8  }, { top: 66, left:  8  },
  { top: 33, left: 92  }, { top: 66, left: 92  },
  { top: 40, left: 40  }, { top: 40, left: 50  }, { top: 40, left: 60  },
  { top: 60, left: 50  }
];

POSITIONS.getPositions = function POSITIONS_getPositions(playersNumber, centerCardsNumber) {
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
  else {
    return positions;
  }
}

LOCATIONS = {
  inLobby: 1,
  inRoom: 2,
  inGame: 3
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

var PLAYERS = new Players();

var GAMES = {};

GAMES.exists = function GAMES_exists(gameName) {
  return this[gameName];
}

GAMES.add = function GAMES_add(gameName, roles, centerCardsNumber) {
  this[gameName] = {
    name: gameName,
    players: new Players(),
    roles: roles,
    center: centerCardsNumber,
    hasntSeenRole: 0
  };
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
  this[roomName] = {
    name: roomName,
    players: new Players(),
    roles: ROLE_TILES.slice()
  };
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

function updateLobby() {
  // Create rooms list data to send
  var rooms = ROOMS.toList().map(function (room) {
    return {
      name: room.name,
      players: room.players.toList().length
    }
  });

  // Update to players in room that you are not there anymore
  PLAYERS.toList().forEach(function (player) {
    if (player.status == LOCATIONS.inLobby) {
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
  });
}

function updateRoom(roomName) {
  // Create players list from this room
  var players = [];
  PLAYERS.toList().forEach(function (player) {
    if (player.status == LOCATIONS.inRoom && player.roomName == roomName) {
      players.push({
        username: player.username
      });
    }
  });

  // Send update to all clients who are in lobby
  PLAYERS.toList().forEach(function (player) {
    if (player.status == LOCATIONS.inRoom && player.roomName == roomName) {
      // Compile room page
      var page = pug.compileFile('./views/room.pug')({
        title: "One Night Ultimate Werewolf",
        players: players,
        roomName: roomName,
        rolesList: ROOMS.exists(roomName).roles,
        start: "Start",
        back: "Back"
      });

      // Send client data
      player.emit('update-room', {
        page: page
      });
    }
  });
}

io.sockets.on('connection', function (client) {
  console.log('New connection : ' + client.id);

  client.on('disconnect', function () {
    PLAYERS.delete(client.username);
    console.log('Deleted player with username ' + client.username);
    console.log(client.id + ' disconnected');

    // Update room where player maybe was
    var room = ROOMS.exists(client.roomName);
    if (room) {
      room.players.delete(client.username);
      updateRoom(room.name);
    }
    updateLobby();
  });

  client.on('saw-role', function (data) {
    var username = client.username;
    var gameName = client.gameName;

    // Get the game
    var game = GAMES.exists(gameName);
    game.hasntSeenRole--;
    client.emit('saw-role-aproved');
    if (game.hasntSeenRole == 0) {
      // TODO: Start polling roles
      console.log('START POLING ROLES');
    }
  });

  client.on('see-role', function (data) {
    var username = client.username;
    var gameName = client.gameName;

    // Get the game
    var game = GAMES.exists(gameName);
    var role = game.roles[username];

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
    room.roles = roles;

    // Update clients in room
    updateRoom(roomName);
  });

  client.on('start-game-request', function (data) {
    var roles = data.roles;
    var roomName = data.roomName;
    var rolesInTheMiddleNumber = 3;

    // Get selected roles
    var selectedRoles = [];
    roles.forEach(function (role) {
      if (role.clicked)
        selectedRoles.push(role);
    });
    // Check if there is a valid number of players
    var room = ROOMS.exists(roomName);
    var roomPlayersNumber = room.players.toList().length;
    if (roomPlayersNumber < 3 || roomPlayersNumber > 10) {
      client.emit('start-game-declined', {
        errorMessage: "Number of players must be from 3 to 10"
      });
      return;
    }

    // Check if selected roles number is equal to players in room number
    if (roomPlayersNumber + rolesInTheMiddleNumber != selectedRoles.length) {
      client.emit('start-game-declined', {
        errorMessage: "Incomatible number of roles and players"
      });
      return;
    }

    var positions = POSITIONS.getPositions(roomPlayersNumber);

    // Get players from room
    var players = room.players.toList().map(function (player, ind) {
      var pos = positions[ind];
      return {
        username: player.username,
        top: pos.top,
        left: pos.left
      }
    });

    // Add fake user for center cards
    for (var i = 1; i <= rolesInTheMiddleNumber; i++) {
      var pos = POSITIONS[POSITIONS.length - 4 + i - 1];
      players.push({
        username: 'c' + i,
        top: pos.top,
        left: pos.left
      });
    }

    // Array of selected roles to assign
    var rolesToAssign = selectedRoles.slice();

    // Give roles
    var rolesMap = {};
    room.players.toList().forEach(function (player) {
      // Assign random role to player
      var randomRoleIndex = Math.floor(Math.random() * rolesToAssign.length);
      var role = rolesToAssign[randomRoleIndex];
      rolesMap[player.username] = role;

      // Delete that role from array
      rolesToAssign.splice(randomRoleIndex, 1);
    });

    for (var i = 1; i <= rolesInTheMiddleNumber; i++) {
      // Assign random role to center card
      var randomRoleIndex = Math.floor(Math.random() * rolesToAssign.length);
      var role = rolesToAssign[randomRoleIndex];
      rolesMap['c' + i];

      // Delete that role from array
      rolesToAssign.splice(randomRoleIndex, 1);
    }


    // Add game
    GAMES.add(roomName, rolesMap, rolesInTheMiddleNumber);

    // Send clients to start a game
    room.players.toList().forEach(function (player) {
      // Save that player is in game with name same as room name
      player.status = LOCATIONS.inGame;
      player.gameName = roomName;

      // Add player to game
      GAMES.exists(roomName).players.add(player.username, player);
      // Update number of players who hasnt seen role
      GAMES.exists(roomName).hasntSeenRole++;

      // Compile room page
      var page = pug.compileFile('./views/game.pug')({
        playersList: players
      });

      // Send client data
      player.emit('start-game', {
        page: page,
      });
    });

    // Delete room
    ROOMS.delete(roomName);

  });

  client.on('back-to-lobby', function (data) {
    var roomName = data.roomName;

    // Update players in room
    var room = ROOMS.exists(roomName);
    room.players.delete(client.username);

    // If no players left in room delete it
    if (room.players.toList().length == 0) {
      ROOMS.delete(room.name);
    }

    // If admin left the room give it to someone else (first from list)
    if (client.admin) {
      if (room.players.toList().length != 0) {
        var newAdmin = room.players.toList()[0];
        newAdmin.admin = true;
      }
      client.admin = false;
    }

    // Update that player is in lobby again
    client.status = LOCATIONS.inLobby;

    updateLobby();
    updateRoom(roomName);
  });

  client.on('enter-room', function (data) {
    var roomName = data.roomName;
    // Because client.admin may be undefined, not only false
    if (!client.admin)
      client.admin = false;

    console.log('Player with username ' + client.username +  ' admin: ' + client.admin + ' request to enter a room with name ' + roomName);

    // Update client room info
    client.roomName = roomName;

    // Update that player isn't in lobby anymore
    client.status = LOCATIONS.inRoom;

    // Update room players if this is not admin
    // We already updated players for him when he created room
    var room = ROOMS.exists(roomName);
    room.players.add(client.username, client);

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
      client.emit('new-room-declined', {
        errorMessage: 'Room name must contain 3 to 15 characters'
      });
      return;
    }
    if (ROOMS.exists(roomName)) {
      client.emit('new-room-declined', {
        errorMessage: 'Room name taken'
      });
      return;
    }

    // Add room to rooms list
    ROOMS.add(roomName);
    console.log('Added new room with name ' + roomName);


    // Update that player is admin
    client.admin = true;
    // Error
    // client.inLobby = false;
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
        client.emit('login-declined', {
          errorMessage: 'Username must contain 3 to 15 characters'
        });
        return;
    }
    if (PLAYERS.exists(username)) {
      client.emit('login-declined', {
        errorMessage: 'Username taken'
      });
      return;
    }

    // Add client to players logged in
    client.status = LOCATIONS.inLobby;
    PLAYERS.add(username, client);
    console.log('Added new player with username ' + username);

    updateLobby();
  });
});
