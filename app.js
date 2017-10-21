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

io.sockets.on('connection', function (client) {
  console.log('New connection : ' + client.id);

  client.on('disconnect', function () {
    PLAYERS.delete(client.username);
    console.log('Deleted player with username ' + client.username);
    console.log(client.id + ' disconnected');
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

    // Create rooms list data to send
    var rooms = ROOMS.toList().map(function (room) {
      return {
        name: room.name,
        players: room.players.toList().length
      }
    });

    // Compile lobby page
    var page = pug.compileFile('./views/lobby.pug')({
      title: "One Night Ultimate Werewolf",
      roomName: "Room name",
      cancel: "Cancel",
      rooms: rooms,
      username: client.username,
      roomsText: "Rooms available",
      create: "Create"
    });
    // Send client data
    client.emit('back-to-lobby-approved', {
      page: page
    });

    // Create rooms list data to send
    var rooms = ROOMS.toList().map(function (room) {
      return {
        name: room.name,
        players: room.players.toList().length
      };
    });

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
        player.emit('new-room-created', {
          page: page
        });
      }
      // Theese players are in the game or in the room
      else {
        if (player.roomName == roomName) {
          // Compile room page
          var page = pug.compileFile('./views/room.pug')({
            title: "One Night Ultimate Werewolf",
            players: players,
            roomName: roomName,
            start: "Start",
            back: "Back"
          });

          // Send client data
          player.emit('enter-room-aproved', {
            page: page
          });
        }
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
        player.emit('new-room-created', {
          page: page
        });
      }
    });
  });

  client.on('enter-room', function (data) {
    var admin = data.admin;
    var roomName = data.roomName;

    // Update client room info
    client.admin = admin;
    client.roomName = roomName;

    // Update room players if this is not admin
    // We already updated players for him when he created room
    var room = ROOMS.exists(roomName);
    if (!admin)
      room.players.add(client.username, client);

    // Update that player isn't in lobby anymore
    client.inLobby = false;

    // Create rooms list data to send
    var rooms = ROOMS.toList().map(function (room) {
      return {
        name: room.name,
        players: room.players.toList().length
      }
    });

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
        player.emit('new-room-created', {
          page: page
        });
      }
      // Theese players are in the game or in the room
      else {
        if (player.roomName == roomName) {
          // Compile room page
          var page = pug.compileFile('./views/room.pug')({
            title: "One Night Ultimate Werewolf",
            players: players,
            roomName: roomName,
            start: "Start",
            back: "Back"
          });

          // Send client data
          player.emit('enter-room-aproved', {
            page: page
          });
        }
      }
    });
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

    // Update that player isn't in lobby anymore
    client.inLobby = false;
    client.emit('new-room-aproved', {
      roomName: roomName
    });

    // Update room players number
    var room = ROOMS.exists(roomName);
    room.players.add(client.username, client);

    // Create rooms list data to send
    var rooms = ROOMS.toList().map(function (room) {
      return {
        name: room.name,
        players: room.players.toList().length
      }
    });

    // Send update to all clients who are in lobby
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
        player.emit('new-room-created', {
          page: page
        });
      }
    });
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

    // Create rooms list data to send
    var rooms = ROOMS.toList().map(function (room) {
      return {
        name: room.name,
        players: room.players.toList().length
      }
    });

    // Compile lobby page
    var page = pug.compileFile('./views/lobby.pug')({
      title: "One Night Ultimate Werewolf",
      roomName: "Room name",
      cancel: "Cancel",
      rooms: rooms,
      username: username,
      roomsText: "Rooms available",
      create: "Create"
    });

    // Send client data
    client.emit('login-aproved', {
      page: page,
      id: client.id
    });
  });
});
