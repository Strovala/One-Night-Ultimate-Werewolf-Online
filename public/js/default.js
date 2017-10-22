var $start = $('#start');
var $username = $('#username');
var $errorMessage = $('.errorMessage');

function onGameStart(positions) {
  debugger;

  var $playerDivs = $(".player-div");
  $($playerDivs[0]).parent().css({position: 'relative'});

  for (var i = 0; i < $playerDivs.length; i++) {
    var pos = positions[i];
    var playerDiv = $($playerDivs[i]);
    playerDiv.css({'top': pos.top + 'vh'});
    playerDiv.css({'left': pos.left + 'vw'});
    playerDiv.css({'position':'absolute'});

    var $username = playerDiv.find('#player-username');
    var username = $username.text();
    if (username == 'c1' || username == 'c2' || username == 'c3' || username == 'c4')
      $username.css('display', 'none');
  }
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
    var $roles = $('.role-image');
    var roles = [];
    for (var i = 0; i < $roles.length; i++) {
      var role = $($roles[i]);
      var roleOpacity = role.css('opacity');
      var roleId = role.attr('id');
      if (roleOpacity == 1) {
        roles.push({
          id: roleId
        });
      }
    }
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
    debugger;
    var page = $(data.page);
    var content = $.grep(page, function(e) {
      return e.id == 'content';
    });
    $('#content').html(content);
    // Prepare width for game page
    $('#content').css('width', '100%')
    onGameStart(data.positions);
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

// var socket = io.connect('http://365264ba.ngrok.io');
var socket = io.connect('http://localhost:3000');

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
}

function playerClicked(div) {
  console.log('clicked ' + $(div).find('#player-username').text());
}

var audioClick = new Audio('../assets/sounds/click.mp3');
var audioToogleOn = new Audio('../assets/sounds/toogle-on.mp3');
var audioToogleOff = new Audio('../assets/sounds/toogle-off.mp3');
