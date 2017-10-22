var $start = $('#start');
var $username = $('#username');
var $errorMessage = $('.errorMessage');

function onRoomStart() {
  var $backToLobby = $('#back-to-lobby');
  var $roomName = $('#room-name-text');

  $backToLobby.click(function () {
    socket.emit('back-to-lobby', {
      roomName: $roomName.text()
    });
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
  });

  $cancel.click(function() {
    $modal.css({"display": "none"});
    $roomName.val('');
    $errorMessage.text('');
  });

  $createRoom.click(function () {
    roomNameLength = $roomName.val().length;
    if (roomNameLength < 3 || roomNameLength > 15)
      $errorMessage.text('Room name must contain 3 to 15 characters');
    else
      socket.emit('new-room-request', {roomName: $roomName.val()});
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
});

$username.keyup(function(event) {
  // If clicked Enter
  if (event.keyCode == 13) {
      $start.click();
  }
});

var socket = io.connect('http://192.168.0.219:3000');

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
  var newOpacity = 1;
  if (lastOpacity == 1)
    newOpacity = 0.5;
  img.css('opacity', newOpacity);
}

var audioClick = new Audio('../assets/sounds/click.mp3');
