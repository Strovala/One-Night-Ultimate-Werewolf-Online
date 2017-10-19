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

app.get('/', function (req, res) {
  res.sendFile(__dirname + '/views/index.html');
})
