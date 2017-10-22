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
  res.render('game', {
  });
});

var Players = function () {}

Players.prototype.exists = function Players_exists(username) {
  return this[username];
}

Players.prototype.add = function Players_add(username, client) {
  client.username = username;
  client.inLobby = true;
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

var ROOMS = {};

ROOMS.exists = function ROOMS_exists(roomName) {
  return this[roomName];
}

ROOMS.add = function ROOMS_add(roomName) {
  this[roomName] = {
    name: roomName,
    players: new Players()
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
    if (player.inLobby) {
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
    if (!player.inLobby && player.roomName == roomName) {
      players.push({
        username: player.username
      });
    }
  });

  // Send update to all clients who are in lobby
  PLAYERS.toList().forEach(function (player) {
    if (!player.inLobby && player.roomName == roomName) {
      // Compile room page
      var page = pug.compileFile('./views/room.pug')({
        title: "One Night Ultimate Werewolf",
        players: players,
        roomName: roomName,
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

  client.on('start-game-request', function (data) {
    var roles = data.roles;
    var roomName = data.roomName;
    var rolesInTheMiddleNumber = 3;

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
    if (roomPlayersNumber + rolesInTheMiddleNumber != roles.length) {
      client.emit('start-game-declined', {
        errorMessage: "Incomatible number of roles and players"
      });
      return;
    }

    // TODO: START GAME
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
    client.inLobby = true;

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

    // Update room players if this is not admin
    // We already updated players for him when he created room
    var room = ROOMS.exists(roomName);
    room.players.add(client.username, client);

    // Update that player isn't in lobby anymore
    client.inLobby = false;

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
    client.inLobby = false;
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
    PLAYERS.add(username, client);
    console.log('Added new player with username ' + username);

    updateLobby();
  });
});
