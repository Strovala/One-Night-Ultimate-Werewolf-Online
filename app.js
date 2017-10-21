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
    start: "Start"
  });
});

var PLAYERS = {};
PLAYERS.exists = function PLAYERS_exists(username) {
  return this[username];
}

PLAYERS.add = function PLAYERS_add(username, client) {
  client.username = username;
  this[username] = client;
}

PLAYERS.delete = function PLAYERS_delete(username) {
  delete this[username];
}

io.sockets.on('connection', function (client) {
  console.log('New connection : ' + client.id);

  client.on('disconnect', function () {
    PLAYERS.delete(client.username);
    console.log('Deleted player with username ' + client.username);
    console.log(client.id + ' disconnected');
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

    // Compile lobby page
    var page = pug.compileFile('./views/lobby.pug')({
      title: "One Night Ultimate Werewolf",
      roomName: "Room name",
      cancel: "Cancel",
      rooms: [
        {
          name: "Krimina",
          players: 3
        },
        {
          name: "PrsssssssSiprina",
          players: 5
        }
      ],
      username: username,
      gamesText: "Rooms available",
      create: "Create"
    });

    // Send client data
    client.emit('login-aproved', {
      page: page,
      id: client.id
    });
  });
});
