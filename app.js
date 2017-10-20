var
    gameport        = process.env.PORT || 3000,

    socket              = require('socket.io'),
    express         = require('express'),
    UUID            = require('node-uuid'),

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


app.get('/start', function (req, res) {
  var username = req.query.username
  res.render('start', {
    title: "One Night Ultimate Werewolf",
    roomName: "Room name",
    cancel: "Cancel",
    games: [
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
    gamesText: "Games available",
    create: "Create"
  });
});

io.sockets.on('connection', function (client) {
  console.log('New connection : ' + client.id);

  client.on('disconnect', function () {
    console.log(client.id + ' disconnected');
  });
});
