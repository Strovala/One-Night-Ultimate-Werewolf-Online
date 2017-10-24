var HOST = '192.168.0.219';
var PORT = 3000;

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

var troublemakerPick = '';

var $start = $('#start');
var $username = $('#username');
var $errorMessage = $('.errorMessage');

var gameState;

function onGameStart() {
  var $reveal = $('#reveal');

  $reveal.click(function () {
    if (gameState == STATES.discussion) {
      socket.emit('reveal');
      audioClick.play();
      gameState = STATES.doNothing;
    }
  });

  socket.emit('see-role');

  socket.on('see-role-aproved', function (data) {
    var username = data.username;
    var role = data.role;

    socket.username = username;
    socket.role = role;

    var playerDiv = findDiv(username);
    playerDiv.find('#card-back').attr('src', '../assets/images/roles/' + role + '.png');
  });

  socket.on('saw-role-aproved', function (data) {
    var playerDiv = findDiv(socket.username);
    playerDiv.find('#card-back').attr('src', '../assets/images/card-back.png');
  });

  socket.on('werewolf-poll', function (data) {
    gameState = data.state;
    var usernames = data.usernames;

    usernames.forEach(function (username) {
      var playerDiv = findDiv(username);
      playerDiv.css('border-bottom', '5px solid white');
    });

  });

  socket.on('werewolf-action-aproved', function (data) {
    var username = data.username;
    var role = data.role;

    var playerDiv = findDiv(username);
    playerDiv.find('#card-back').attr('src', '../assets/images/roles/' + role + '.png');
  });

  socket.on('seer-poll', function (data) {
    gameState = data.state;
    var usernames = data.usernames;

    usernames.forEach(function (username) {
      var playerDiv = findDiv(username);
      playerDiv.css('border-bottom', '5px solid white');
    });

  });

  socket.on('seer-action-aproved', function (data) {
    var username = data.username;
    var role = data.role;

    var playerDiv = findDiv(username);
    playerDiv.find('#card-back').attr('src', '../assets/images/roles/' + role + '.png');
  });

  socket.on('robber-poll', function (data) {
    gameState = data.state;
    var usernames = data.usernames;

    usernames.forEach(function (username) {
      var playerDiv = findDiv(username);
      playerDiv.css('border-bottom', '5px solid white');
    });

  });

  socket.on('robber-action-aproved', function (data) {
    var username = data.username;
    var role = data.role;

    var playerDiv = findDiv(username);
    playerDiv.find('#card-back').attr('src', '../assets/images/roles/' + role + '.png');
  });

  socket.on('troublemaker-poll', function (data) {
    gameState = data.state;
    var usernames = data.usernames;

    usernames.forEach(function (username) {
      var playerDiv = findDiv(username);
      playerDiv.css('border-bottom', '5px solid white');
    });

  });

  socket.on('drunk-poll', function (data) {
    gameState = data.state;
    var usernames = data.usernames;

    usernames.forEach(function (username) {
      var playerDiv = findDiv(username);
      playerDiv.css('border-bottom', '5px solid white');
    });

  });

  socket.on('idle-poll', function (data) {
    gameState = data.state;
    var pollRole = data.role;
    var usernames = data.usernames;

    usernames.forEach(function (username) {
      var playerDiv = findDiv(username);
      playerDiv.find('#card-back').attr('src', '../assets/images/card-back.png');
      playerDiv.css('border-bottom', '0');
    });
  });

  socket.on('start-discussion', function (data) {
    gameState = data.state;
    $('#div-reveal').css('display', 'block');
  });

  socket.on('reveal-aproved', function (data) {
    var players = data.players;
    players.forEach(function (player) {
      var playerDiv = findDiv(player.username);
      playerDiv.find('#card-back').attr('src', '../assets/images/roles/' + player.role + '.png');
    });
    gameState = STATES.doNothing;
  });
}

function onRoomStart() {
  var $backToLobby = $('#back-to-lobby');
  var $roomName = $('#room-name-text');
  var $startGame = $('#start-game');
  var $errorMessage = $('.errorMessage');

  $backToLobby.click(function () {
    socket.emit('back-to-lobby', {
      roomName: $roomName.text()
    });
    audioClick.play();
  });

  $startGame.click(function () {
    // Collect selected roles
    var roles = getRoles();
    socket.emit('start-game-request', {
      roles: roles,
      roomName: $roomName.text()
    });
    audioClick.play();
  });

  socket.on('start-game-declined', function (data) {
    var errorMessage = data.errorMessage;
    $errorMessage.text(errorMessage);
  });


  socket.on('start-game', function (data) {
    gameState = data.state;
    var page = $(data.page);
    var content = $.grep(page, function(e) {
      return e.id == 'content';
    });
    $('#content').html(content);
    // Prepare width for game page
    $('#content').css('width', '100%');
    onGameStart();
  });
}

// Function called when lobby is ready to load
function onLobyStart() {
  var $modal = $('#modal');
  var $openModal = $('#open-modal');
  var $createRoom = $('#create-room');
  var $cancel = $('#cancel');
  var $roomName = $('#room-name');
  var $errorMessage = $('.errorMessage');

  $roomName.keyup(function(event) {
    // If clicked Enter
    if (event.keyCode == 13) {
        $createRoom.click();
    }
  });

  $openModal.click(function () {
    $modal.css({"display": "block"});
    $roomName.focus();
    audioClick.play();
  });

  $cancel.click(function() {
    $modal.css({"display": "none"});
    $roomName.val('');
    $errorMessage.text('');
    audioClick.play();
  });

  $createRoom.click(function () {
    roomNameLength = $roomName.val().length;
    if (roomNameLength < 3 || roomNameLength > 15)
      $errorMessage.text('Room name must contain 3 to 15 characters');
    else
      socket.emit('new-room-request', {roomName: $roomName.val()});
    audioClick.play();
  });

  socket.on('new-room-declined', function(data) {
    var errorMessage = data.errorMessage;
    $errorMessage.text(errorMessage);
  });

  socket.on('new-room-aproved', function(data) {
    var roomName = data.roomName;
    socket.emit('enter-room', {
      roomName: roomName
    });
  });
}

$start.click(function() {
  usernameLength = $username.val().length;
  if (usernameLength < 3 || usernameLength > 15)
    $errorMessage.text('Username must contain 3 to 15 characters');
  else
    socket.emit('login-request', {username: $username.val()});
  audioClick.play();
});

$username.keyup(function(event) {
  // If clicked Enter
  if (event.keyCode == 13) {
      $start.click();
  }
});

var socket = io.connect('http://' + HOST + ':' + PORT);
// var socket = io.connect('http://852a0a5d.ngrok.io');

socket.on('update-lobby', function (data) {
  var page = $(data.page);
  var content = $.grep(page, function(e) {
    return e.id == 'content';
  });
  $('#content').html(content);
  onLobyStart();
});

socket.on('update-room', function (data) {
  var page = $(data.page);
  var content = $.grep(page, function(e) {
    return e.id == 'content';
  });
  $('#content').html(content);
  onRoomStart();
});

socket.on('login-declined', function(data) {
  var errorMessage = data.errorMessage;
  $errorMessage.text(errorMessage);
});

function enterRoom(room) {
  room = $(room);
  var roomName = $(room.find('#roomName')).text();
  socket.emit('enter-room', {
    roomName: roomName
  });
  audioClick.play();
}

function toogleRoleImage(img) {
  var img = $(img);
  var lastOpacity = img.css('opacity');
  var newOpacity;
  if (lastOpacity == 1) {
    newOpacity = 0.5;
    audioToogleOff.play();
  } else {
    newOpacity = 1;
    audioToogleOn.play();
  }
  img.css('opacity', newOpacity);

  var roles = getRoles();
  var roomName = $('#room-name-text').text();
  debugger;
  socket.emit('toogled-role', {
    roles: roles,
    roomName: roomName
  });
}

function getRoles() {
  var $roles = $('.role-image');
  var roles = [];
  for (var i = 0; i < $roles.length; i++) {
    var role = $($roles[i]);
    var roleOpacity = role.css('opacity');
    var roleId = role.attr('id');
    roles.push({
      id: roleId,
      clicked: roleOpacity == 1
    });
  }
  return roles;
}

function playerClicked(div) {
  if (gameState == STATES.doNothing || gameState == STATES.discussion)
    return;

  var clickedUsername = $(div).find('#player-username').text();
  console.log('clicked in ' + gameState + ' ' + clickedUsername);

  if (gameState == STATES.roleView) {
    if (isMyself(clickedUsername)) {
      socket.emit('saw-role');
      audioPlayerClick.play();
      gameState = STATES.doNothing;
    }
    return;
  }

  if (gameState == STATES.werewolfAction) {
    if (isCenterCard(clickedUsername)) {
      socket.emit('werewolf-action', {
        username: clickedUsername
      });
      audioPlayerClick.play();
      gameState = STATES.doNothing;
    }
    return;
  }

  if (gameState == STATES.seerActionOne) {
    if (!isMyself(clickedUsername)) {
      socket.emit('seer-action', {
        username: clickedUsername
      });
      audioPlayerClick.play();
      gameState = isCenterCard(clickedUsername) ? STATES.seerActionTwo : STATES.doNothing;
    }
    return;
  }

  if (gameState == STATES.seerActionTwo) {
    if (isCenterCard(clickedUsername)) {
      socket.emit('seer-action', {
        username: clickedUsername
      });
      audioPlayerClick.play();
      gameState = STATES.doNothing;
    }
    return;
  }

  if (gameState == STATES.robberAction) {
    if (!isCenterCard(clickedUsername) && !isMyself(clickedUsername)) {
      socket.emit('robber-action', {
        username: clickedUsername
      });
      audioPlayerClick.play();
      gameState = STATES.doNothing;
    }
    return;
  }

  if (gameState == STATES.troublemakerActionPick) {
    if (!isCenterCard(clickedUsername) && !isMyself(clickedUsername)) {
      troublemakerPick = clickedUsername;
      playerDiv = findDiv(clickedUsername);
      playerDiv.css('border-bottom', '5px solid white');
      gameState = STATES.troublemakerActionSwitch;
      audioPlayerClick.play();
    }
    return;
  }

  if (gameState == STATES.troublemakerActionSwitch) {
    console.log(clickedUsername);
    if (!isCenterCard(clickedUsername) && !isMyself(clickedUsername) && troublemakerPick != clickedUsername) {
      playerDiv = findDiv(clickedUsername);
      playerDiv.css('border-bottom', '5px solid white');
      socket.emit('troublemaker-action', {
        usernamePick: troublemakerPick,
        usernameSwitch: clickedUsername
      });
      audioPlayerClick.play();
      troublemakerPick = '';
      gameState = STATES.doNothing;
    }
    return;
  }

  if (gameState == STATES.drunkAction) {
    playerDiv = findDiv(clickedUsername);
    playerDiv.css('border-bottom', '5px solid white');
    if (isCenterCard(clickedUsername)) {
      socket.emit('drunk-action', {
        username: clickedUsername
      });
      audioPlayerClick.play();
      gameState = STATES.doNothing;
    }
    return;
  }
}

function findDiv(username) {
  var playersDivs = $('.player-div');
  var playerDiv;
  for(var i = 0; i < playersDivs.length; i++) {
    if ($(playersDivs[i]).text() == username) {
      playerDiv = $(playersDivs[i]);
      break;
    }
  }
  return playerDiv;
}

function isCenterCard(username) {
  for (var i = 1; i <= 4; i++) {
    if (username == 'c' + i)
      return true;
  }
  return false;
}

function isMyself(username) {
  return socket.username == username;
}

var audioClick = new Audio('../assets/sounds/click.mp3');
var audioToogleOn = new Audio('../assets/sounds/toogle-on.mp3');
var audioPlayerClick = new Audio('../assets/sounds/toogle-on.mp3');
var audioToogleOff = new Audio('../assets/sounds/toogle-off.mp3');
