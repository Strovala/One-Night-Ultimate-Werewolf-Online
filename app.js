var
    gameport        = process.env.PORT || 3000,

    io              = require('socket.io'),
    express         = require('express'),
    UUID            = require('node-uuid'),

    verbose         = false,
    app             = express();

app.listen(gameport);

console.log('\t :: Express :: Listening on port ' + gameport );

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
  console.log(req.query);
  res.render('start', {
    title: "One Night Ultimate Werewolf",
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
    gamesText: "Games available",
    create: "Create"
  });
});
