var $start = $('#start');
var $username = $('#username');
var $errorMessage = $('#errorMessage');

// Function called when lobby is ready to load
function onLobyStart() {
  var $modal = $('#room-create');
  var $create = $('#open-modal');

  $create.click(function () {
    $modal.css({"display": "block"});
  });
  var $cancel = $('#cancel');
  $cancel.click(function() {
    $modal.css({"display": "none"});
    $('#room-name').val('');
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

var socket = io.connect('http://localhost:3000');

socket.on('login-aproved', function(data) {
  socket.id = data.id;
  var page = $(data.page);
  var content = $.grep(page, function(e) {
    return e.id == 'content';
  });
  $('#content').html(content);
  onLobyStart();
});

socket.on('login-declined', function(data) {
  var errorMessage = data.errorMessage;
  $errorMessage.text(errorMessage);
});
