socket.on('newNotification', ({ senderId, message, type }) => {
  showFloatingNotification(senderId, message, type);
});

function showFloatingNotification(senderId, message, type) {
  const bar = document.createElement('div');
  bar.className = 'floating-notification';
  bar.innerHTML = `
    <strong>${message}</strong>
    <button onclick="acceptCall('${senderId}', '${type}')">Accept</button>
    <button onclick="declineCall('${senderId}')">Decline</button>
  `;
  document.body.appendChild(bar);
}

function acceptCall(from, type) {
  // Redirect to call page or open overlay
  window.location.href = `/messages.html?incomingCall=true&from=${from}&type=${type}`;
}

function declineCall(from) {
  socket.emit('declineCall', { to: from });
}


//must add this in all html's