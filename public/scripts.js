document.addEventListener('DOMContentLoaded', () => {
  const userChatInput = document.getElementById('user-chat-input');
  const strangerChatInput = document.getElementById('stranger-chat-input');
  const timerElement = document.getElementById('timer');
  let timeLeft = 180; // 3 minutes in seconds

  const socket = new WebSocket('ws://localhost:8080');

  socket.onopen = () => {
    console.log('WebSocket is connected');
  };

  socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === 'typing') {
      if (data.user === 'stranger') {
        strangerChatInput.value = data.text;
      } else {
        userChatInput.value = data.text;
      }
    } else if (data.type === 'new-stranger') {
      strangerChatInput.value = '';
    }
  };

  const updateTimer = () => {
    if (timeLeft > 0) {
      timeLeft -= 1;
      const minutes = Math.floor(timeLeft / 60);
      const seconds = timeLeft % 60;
      timerElement.textContent = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    } else {
      timeLeft = 180;
      socket.send(JSON.stringify({ type: 'new-stranger' }));
      strangerChatInput.value = '';
    }
  };

  setInterval(updateTimer, 1000);

  userChatInput.addEventListener('input', () => {
    const text = userChatInput.value;
    socket.send(JSON.stringify({ type: 'typing', user: 'user', text }));
  });

  strangerChatInput.addEventListener('input', () => {
    const text = strangerChatInput.value;
    socket.send(JSON.stringify({ type: 'typing', user: 'stranger', text }));
  });
});


document.addEventListener('DOMContentLoaded', () => {
  const trays = document.querySelectorAll('.dashboard-item a');
  
  trays.forEach(tray => {
    tray.addEventListener('click', (event) => {
      event.preventDefault();
      const target = event.currentTarget.getAttribute('href');
      fetch(target)
        .then(response => response.text())
        .then(data => {
          document.body.innerHTML = data;
          document.body.classList.add('centered-content');
        });
    });
  });
});
function handleRequest(action, user) {
  alert(`${action} request from ${user}`);
  // Implement the logic to handle accepting or declining friend requests
}

  function openSection(sectionId) {
  document.querySelectorAll('.info-section').forEach(section => {
    section.style.display = 'none';
  });
  document.getElementById(sectionId).style.display = 'block';
}

document.addEventListener('DOMContentLoaded', () => {
  const muteAllButton = document.getElementById('mute-all');
  const unmuteAllButton = document.getElementById('unmute-all');
  const participants = document.getElementById('participants');
  const seatsContainer = document.getElementById('seats');
  const waitingList = document.getElementById('waiting-list');

  const socket = new WebSocket('ws://localhost:8080');

  // WebRTC setup
  const peerConnections = {};
  const audioConstraints = { audio: true, video: false };
  const localStream = new MediaStream();

  navigator.mediaDevices.getUserMedia(audioConstraints)
    .then(stream => {
      localStream.addTrack(stream.getAudioTracks()[0]);
    })
    .catch(error => {
      console.error('Error accessing media devices.', error);
    });

  socket.onopen = () => {
    console.log('WebSocket is connected');
  };

  socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === 'new-participant') {
      addParticipant(data.id);
    } else if (data.type === 'mute') {
      muteParticipant(data.id);
    } else if (data.type === 'unmute') {
      unmuteParticipant(data.id);
    }
  };

  const addParticipant = (id) => {
    if (Object.keys(peerConnections).length < 10) {
      // Add to seats
      const seat = document.createElement('div');
      seat.className = 'seat';
      seat.textContent = `User ${id}`;
      seat.addEventListener('click', () => toggleMute(id));
      seatsContainer.appendChild(seat);

      // Initialize WebRTC connection
      const peerConnection = new RTCPeerConnection();
      localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
      peerConnections[id] = peerConnection;
    } else {
      // Add to waiting list
      const waitingItem = document.createElement('div');
      waitingItem.textContent = `User ${id}`;
      waitingList.appendChild(waitingItem);
    }
  };

  const muteParticipant = (id) => {
    if (peerConnections[id]) {
      peerConnections[id].getSenders().forEach(sender => sender.track.enabled = false);
    }
  };

  const unmuteParticipant = (id) => {
    if (peerConnections[id]) {
      peerConnections[id].getSenders().forEach(sender => sender.track.enabled = true);
    }
  };

  const toggleMute = (id) => {
    if (peerConnections[id]) {
      const enabled = peerConnections[id].getSenders()[0].track.enabled;
      if (enabled) {
        socket.send(JSON.stringify({ type: 'mute', id }));
      } else {
        socket.send(JSON.stringify({ type: 'unmute', id }));
      }
    }
  };

  muteAllButton.addEventListener('click', () => {
    for (const id in peerConnections) {
      muteParticipant(id);
    }
  });

  unmuteAllButton.addEventListener('click', () => {
    for (const id in peerConnections) {
      unmuteParticipant(id);
    }
  });
});
document.addEventListener('DOMContentLoaded', () => {
  const videoElements = [
    document.getElementById('hostVideo'),
    document.getElementById('participant1'),
    document.getElementById('participant2'),
    document.getElementById('participant3'),
    document.getElementById('participant4'),
    document.getElementById('participant5'),
    document.getElementById('participant6'),
    document.getElementById('participant7')
  ];

  const peerConnections = {};
  const socket = new WebSocket('ws://localhost:3000');
  const config = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' }
    ]
  };

  socket.onopen = () => {
    console.log('WebSocket is connected');
    startVideoStream();
  };

  socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === 'offer') {
      handleOffer(data.offer, data.id);
    } else if (data.type === 'answer') {
      handleAnswer(data.answer, data.id);
    } else if (data.type === 'candidate') {
      handleCandidate(data.candidate, data.id);
    } else if (data.type === 'new-participant') {
      createPeerConnection(data.id);
    }
  };

  const startVideoStream = () => {
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(stream => {
        videoElements[0].srcObject = stream;
        stream.getTracks().forEach(track => {
          for (let id in peerConnections) {
            peerConnections[id].addTrack(track, stream);
          }
        });
      })
      .catch(error => {
        console.error('Error accessing media devices.', error);
      });
  };

  const createPeerConnection = (id) => {
    const peerConnection = new RTCPeerConnection(config);
    peerConnections[id] = peerConnection;

    peerConnection.onicecandidate = event => {
      if (event.candidate) {
        socket.send(JSON.stringify({ type: 'candidate', candidate: event.candidate, id }));
      }
    };

    peerConnection.ontrack = event => {
      const participantIndex = Object.keys(peerConnections).indexOf(id);
      videoElements[participantIndex + 1].srcObject = event.streams[0];
    };

    peerConnection.onnegotiationneeded = () => {
      peerConnection.createOffer()
        .then(offer => peerConnection.setLocalDescription(offer))
        .then(() => {
          socket.send(JSON.stringify({ type: 'offer', offer: peerConnection.localDescription, id }));
        })
        .catch(error => {
          console.error('Error during offer creation.', error);
        });
    };
  };

  const handleOffer = (offer, id) => {
    const peerConnection = createPeerConnection(id);
    peerConnection.setRemoteDescription(new RTCSessionDescription(offer))
      .then(() => peerConnection.createAnswer())
      .then(answer => peerConnection.setLocalDescription(answer))
      .then(() => {
        socket.send(JSON.stringify({ type: 'answer', answer: peerConnection.localDescription, id }));
      })
      .catch(error => {
        console.error('Error during answer creation.', error);
      });
  };

  const handleAnswer = (answer, id) => {
    peerConnections[id].setRemoteDescription(new RTCSessionDescription(answer))
      .catch(error => {
        console.error('Error during answer setting.', error);
      });
  };

  const handleCandidate = (candidate, id) => {
    peerConnections[id].addIceCandidate(new RTCIceCandidate(candidate))
      .catch(error => {
        console.error('Error adding received ICE candidate.', error);
      });
  };
});
document.addEventListener('DOMContentLoaded', () => {
  const audioChatBoard = document.getElementById('audio-chat-board');
  const vrChatBoard = document.getElementById('vr-chat-board');

  audioChatBoard.addEventListener('click', () => {
    window.location.href = 'audio-chat-room.html';
  });

  vrChatBoard.addEventListener('click', () => {
    window.location.href = 'vr-group-chat-room.html';
  });
});
let ongoingVrSessions = [];
let ongoingAudioSessions = [];

document.addEventListener('DOMContentLoaded', () => {
  // Handle VR form submission
  const createVrForm = document.getElementById('create-vr-form');
  if (createVrForm) {
    createVrForm.addEventListener('submit', (event) => {
      event.preventDefault();
      // Handle form data and add to ongoing sessions
      const title = createVrForm.title.value;
      const description = createVrForm.description.value;
      const startTime = createVrForm['start-time'].value;
      const endTime = createVrForm['end-time'].value;
      
      ongoingVrSessions.push({ id: Date.now(), title, description, startTime, endTime });
      alert(`VR session scheduled!\nTitle: ${title}\nDescription: ${description}\nStart Time: ${startTime}\nEnd Time: ${endTime}`);
    });
  }

  // Handle "Start Now" button for VR
  const startVrNowButton = document.getElementById('start-now-vr');
  if (startVrNowButton) {
    startVrNowButton.addEventListener('click', () => {
      ongoingVrSessions.push({ id: Date.now(), title: 'Immediate VR Session', description: 'Started now', startTime: new Date().toISOString(), endTime: '' });
      window.location.href = 'vr-group-chat-room.html';
    });
  }

  // Handle Audio form submission
  const createAudioForm = document.getElementById('create-audio-form');
  if (createAudioForm) {
    createAudioForm.addEventListener('submit', (event) => {
      event.preventDefault();
      // Handle form data and add to ongoing sessions
      const title = createAudioForm.title.value;
      const description = createAudioForm.description.value;
      const startTime = createAudioForm['start-time'].value;
      const endTime = createAudioForm['end-time'].value;
      
      ongoingAudioSessions.push({ id: Date.now(), title, description, startTime, endTime });
      alert(`Audio session scheduled!\nTitle: ${title}\nDescription: ${description}\nStart Time: ${startTime}\nEnd Time: ${endTime}`);
    });
  }

  // Handle "Start Now" button for Audio
  const startAudioNowButton = document.getElementById('start-now-audio');
  if (startAudioNowButton) {
    startAudioNowButton.addEventListener('click', () => {
      ongoingAudioSessions.push({ id: Date.now(), title: 'Immediate Audio Session', description: 'Started now', startTime: new Date().toISOString(), endTime: '' });
      window.location.href = 'audio-chat-room.html';
    });
  }

  // Populate ongoing sessions lists (example implementation)
  const vrSessionsList = document.getElementById('vr-sessions-list');
  const audioSessionsList = document.getElementById('audio-sessions-list');
  
  if (vrSessionsList) {
    ongoingVrSessions.forEach(session => {
      const listItem = document.createElement('li');
      listItem.innerHTML = `<a href="vr-group-chat-room.html?session=${session.id}">${session.title} - ${session.description} (Starts at ${session.startTime})</a>`;
      vrSessionsList.appendChild(listItem);
    });
  }

  if (audioSessionsList) {
    ongoingAudioSessions.forEach(session => {
      const listItem = document.createElement('li');
      listItem.innerHTML = `<a href="audio-chat-room.html?session=${session.id}">${session.title} - ${session.description} (Starts at ${session.startTime})</a>`;
      audioSessionsList.appendChild(listItem);
    });
  }
});
document.addEventListener('DOMContentLoaded', () => {
  const createEventButton = document.getElementById('create-event-button');
  const createEventFormSection = document.getElementById('create-event-form-section');
  const createEventForm = document.getElementById('create-event-form');
  const eventList = document.getElementById('event-list');

  let events = [];

  createEventButton.addEventListener('click', () => {
    createEventFormSection.style.display = 'block';
  });

  createEventForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const title = createEventForm['event-title'].value;
    const description = createEventForm['event-description'].value;
    const date = createEventForm['event-date'].value;
    const time = createEventForm['event-time'].value;

    const newEvent = { id: Date.now(), title, description, date, time };
    events.push(newEvent);

    // Notify users about the new event
    alert(`New event created: ${title} on ${date} at ${time}`);

    // Update event list
    const listItem = document.createElement('li');
    listItem.innerHTML = `<strong>${title}</strong> - ${description} on ${date} at ${time}`;
    eventList.appendChild(listItem);

    // Hide the form again
    createEventFormSection.style.display = 'none';
  });
});
document.addEventListener('DOMContentLoaded', () => {
  fetch('/api/profile')
    .then(response => response.json())
    .then(profile => {
      document.getElementById('username').value = profile.username;
      document.getElementById('email').value = profile.email;
      document.getElementById('age').value = profile.age;
      document.getElementById('location').value = profile.location;
      document.getElementById('interests').value = profile.interests.join(', ');
    });
});

function updateProfile() {
  const age = document.getElementById('age').value;
  const location = document.getElementById('location').value;
  const interests = document.getElementById('interests').value;

  fetch('/api/update-profile', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ age, location, interests: interests.split(',').map(interest => interest.trim()) })
  }).then(response => {
    if (response.ok) {
      alert('Profile updated successfully!');
      return true;
    } else {
      alert('Failed to update profile');
      return false;
    }
  });

  return false;
}
// Handle mute/unmute action
function toggleMute() {
  alert("Mute/Unmute action triggered");
}

// Handle start/stop recording action
function toggleRecording() {
  alert("Start/Stop recording action triggered");
}

// Handle share screen action
function shareScreen() {
  alert("Share screen action triggered");
}

// Handle raise hand action
function raiseHand() {
  alert("Raise hand action triggered");
}

// Handle react action
function react() {
  alert("React action triggered");
}

// Handle room creation and redirect to host view
function createRoom(event) {
  event.preventDefault();

  const roomName = document.getElementById('room-name').value;
  const roomDescription = document.getElementById('room-description').value;

  // Save the room details (this is a placeholder, you may want to use a database)
  sessionStorage.setItem('roomName', roomName);
  sessionStorage.setItem('roomDescription', roomDescription);

  // Redirect to the appropriate host view based on the room type
  const isVRRoom = document.querySelector('#create-room-form').classList.contains('vr');
  const hostViewURL = isVRRoom ? 'host-view.html' : 'audio-host-view.html';

  window.location.href = hostViewURL;
}

// Handle ending session
function endSession() {
  alert("The session has ended because the host has left the room.");
  window.location.href = 'chatroom-dashboard.html'; // Redirect to dashboard
}

// Handle leaving room for participants
function leaveRoom() {
  alert("You have left the room.");
  window.location.href = 'chatroom-dashboard.html'; // Redirect to dashboard
}

// Attach event listeners
document.addEventListener("DOMContentLoaded", () => {
  const muteButtons = document.querySelectorAll("button[data-action='mute']");
  muteButtons.forEach(button => button.addEventListener("click", toggleMute));

  const recordingButtons = document.querySelectorAll("button[data-action='recording']");
  recordingButtons.forEach(button => button.addEventListener("click", toggleRecording));

  const shareScreenButtons = document.querySelectorAll("button[data-action='share-screen']");
  shareScreenButtons.forEach(button => button.addEventListener("click", shareScreen));

  const raiseHandButtons = document.querySelectorAll("button[data-action='raise-hand']");
  raiseHandButtons.forEach(button => button.addEventListener("click", raiseHand));

  const reactButtons = document.querySelectorAll("button[data-action='react']");
  reactButtons.forEach(button => button.addEventListener("click", react));

  const createRoomForm = document.getElementById("create-room-form");
  if (createRoomForm) {
    createRoomForm.addEventListener("submit", createRoom);
  }

  // Display room details in the host view
  const roomNameElement = document.getElementById('room-name-display');
  const roomDescriptionElement = document.getElementById('room-description-display');
  if (roomNameElement && roomDescriptionElement) {
    const roomName = sessionStorage.getItem('roomName');
    const roomDescription = sessionStorage.getItem('roomDescription');
    roomNameElement.textContent = roomName;
    roomDescriptionElement.textContent = roomDescription;
  }

  // Handle ending session and leaving room
  const endSessionButton = document.querySelector("button[data-action='end-session']");
  if (endSessionButton) {
    endSessionButton.addEventListener("click", endSession);
  }

  const leaveRoomButton = document.querySelector("button[data-action='leave-room']");
  if (leaveRoomButton) {
    leaveRoomButton.addEventListener("click", leaveRoom);
  }
});
// Attach event listeners
document.addEventListener("DOMContentLoaded", () => {
  const muteButtons = document.querySelectorAll("button[data-action='mute']");
  muteButtons.forEach(button => button.addEventListener("click", toggleMute));

  const endSessionButton = document.querySelector("button[data-action='end-session']");
  if (endSessionButton) {
    endSessionButton.addEventListener("click", endSession);
  }

  // Placeholder video feed
  const hostVideo = document.getElementById('host-video');
  const participantVideo = document.getElementById('participant-video');
  hostVideo.srcObject = new MediaStream();
  participantVideo.srcObject = new MediaStream();
});
// Handle ending session
function endSession() {
  alert("The call has ended.");
  window.location.href = 'chatroom-dashboard.html'; // Redirect to dashboard
}
// Handle mute/unmute action
function toggleMute() {
  alert("Mute/Unmute action triggered");
}

// Handle ending call
function endCall() {
  alert("The call has ended.");
  closeVideoCallModal();
}

// Open video call modal
function openVideoCallModal() {
  document.getElementById('video-call-modal').style.display = 'flex';
}

// Close video call modal
function closeVideoCallModal() {
  document.getElementById('video-call-modal').style.display = 'none';
}

// Attach event listeners
document.addEventListener("DOMContentLoaded", () => {
  const startVideoCallButton = document.getElementById('start-video-call');
  if (startVideoCallButton) {
    startVideoCallButton.addEventListener('click', openVideoCallModal);
  }

  const closeVideoCallButton = document.getElementById('close-video-call');
  if (closeVideoCallButton) {
    closeVideoCallButton.addEventListener('click', closeVideoCallModal);
  }

  const muteButtons = document.querySelectorAll("button[data-action='mute']");
  muteButtons.forEach(button => button.addEventListener("click", toggleMute));

  const endCallButton = document.querySelector("button[data-action='end-call']");
  if (endCallButton) {
    endCallButton.addEventListener("click", endCall);
  }

  // Placeholder video feed
  const hostVideo = document.getElementById('host-video');
  const participantVideo = document.getElementById('participant-video');
  hostVideo.srcObject = new MediaStream();
  participantVideo.srcObject = new MediaStream();
});
function showLoader() {
    document.getElementById('loader').style.display = 'flex';
}

function hideLoader() {
    document.getElementById('loader').style.display = 'none';
}

// Example: Show loader before loading content and hide it after loading
showLoader();
// Simulate loading with a timeout. Replace with your actual loading logic.
setTimeout(hideLoader, 3000); // Hide loader after 3 seconds
document.getElementById('file-input').addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('conversation_id', conversationId);
        formData.append('sender_id', userId);

        fetch('/api/upload', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            // Handle the response, e.g., send the file URL in a message
            sendMessage(data.fileUrl);
        })
        .catch(error => console.error('Error uploading file:', error));
    }
});

function sendMessage(content = null) {
    const message = content || document.getElementById('chat-message').value;
    if (message && conversationId) {
        fetch('/api/send-message', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ conversationId, message })
        }).then(() => {
            document.getElementById('chat-message').value = '';
            loadChat(conversationId);
        });
    }
}
document.addEventListener('DOMContentLoaded', () => {
    // Event listeners for location and interest search
    document.getElementById('location-search-button').addEventListener('click', () => {
        const location = document.getElementById('location-input').value;
        searchUsersByLocation(location);
    });

    document.getElementById('interest-search-button').addEventListener('click', () => {
        const interest = document.getElementById('interest-input').value;
        searchUsersByInterests(interest);
    });
});

// Function to search users by location
function searchUsersByLocation(location) {
    fetch(`/api/users/location/${location}`)
        .then(response => response.json())
        .then(data => {
            displayUsers(data.users);
        })
        .catch(error => console.error('Error:', error));
}

// Function to search users by interests
function searchUsersByInterests(interest) {
    fetch(`/api/users/interests/${interest}`)
        .then(response => response.json())
        .then(data => {
            displayUsers(data.users);
        })
        .catch(error => console.error('Error:', error));
}

// Function to display users
function displayUsers(users) {
    const userContainer = document.getElementById('user-container');
    userContainer.innerHTML = '';
    users.forEach(user => {
        const userElement = document.createElement('div');
        userElement.className = 'user-card';
        userElement.innerHTML = `
            <p><strong>${user.username}</strong></p>
            <p>Age: ${user.age}</p>
            <p>Location: ${user.location}</p>
            <p>Interests: ${user.interests}</p>
        `;
        userContainer.appendChild(userElement);
    });
}
let currentIndex = 0;
let hangoutUsers = [];

// Fetch hangout users
function fetchHangoutUsers() {
    fetch('/api/hangout-users')
        .then(response => response.json())
        .then(data => {
            hangoutUsers = data.users;
            displayUserCard(hangoutUsers[currentIndex]);
        })
        .catch(error => console.error('Error fetching hangout users:', error));
}

// Display user card
function displayUserCard(user) {
    const userCardsContainer = document.getElementById('user-cards');
    userCardsContainer.innerHTML = `
        <div class="user-card">
            <img src="${user.profile_picture}" alt="${user.username}'s profile picture">
            <p><strong>${user.username}</strong></p>
            <p>Age: ${user.age}</p>
            <p>Location: ${user.location}</p>
            <p>Interests: ${user.interests}</p>
            <div class="user-actions">
                <button onclick="likeUser()">Like</button>
                <button onclick="messageUser()">Message</button>
                <button onclick="dislikeUser()">Dislike</button>
            </div>
        </div>
    `;
}

// Swipe left
function swipeLeft() {
    currentIndex = (currentIndex + 1) % hangoutUsers.length;
    displayUserCard(hangoutUsers[currentIndex]);
}

// Swipe right
function swipeRight() {
    currentIndex = (currentIndex + 1) % hangoutUsers.length;
    displayUserCard(hangoutUsers[currentIndex]);
}

// Like user
function likeUser() {
    alert(`Liked ${hangoutUsers[currentIndex].username}`);
    swipeRight();
}

// Dislike user
function dislikeUser() {
    alert(`Disliked ${hangoutUsers[currentIndex].username}`);
    swipeRight();
}

// Message user
function messageUser() {
    alert(`Message ${hangoutUsers[currentIndex].username}`);
}

// Initialize hangout page
document.addEventListener('DOMContentLoaded', () => {
    fetchHangoutUsers();
});
function displayUserCard(user) {
    const userCardsContainer = document.getElementById('user-cards');
    userCardsContainer.innerHTML = `
        <div class="user-card" onclick="viewUserProfile(${user.id})">
            <img src="${user.profile_picture}" alt="${user.username}'s profile picture">
            <p><strong>${user.username}</strong></p>
            <p>Age: ${user.age}</p>
            <p>Location: ${user.location}</p>
            <p>Interests: ${user.interests}</p>
            <div class="user-actions">
                <button onclick="likeUser()">Like</button>
                <button onclick="messageUser(${user.id})">Message</button>
                <button onclick="dislikeUser()">Dislike</button>
            </div>
        </div>
    `;
}

function viewUserProfile(userId) {
    window.location.href = `/profile.html?userId=${userId}`;
}
// Nearby users endpoint (Fetching only active users)
app.get('/api/nearby-users', ensureAuthenticated, (req, res) => {
    db.all("SELECT * FROM users WHERE active = 1", (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});
function checkLoginState() {
  FB.getLoginStatus(function(response) {
    statusChangeCallback(response);
  });
}
  (function(d, s, id){
     var js, fjs = d.getElementsByTagName(s)[0];
     if (d.getElementById(id)) {return;}
     js = d.createElement(s); js.id = id;
     js.src = "https://connect.facebook.net/en_US/sdk.js";
     fjs.parentNode.insertBefore(js, fjs);
   }(document, 'script', 'facebook-jssdk'));
   
document.addEventListener('DOMContentLoaded', () => {
  const userChatInput = document.getElementById('user-chat-input');
  const strangerChatInput = document.getElementById('stranger-chat-input');
  const strangerProfile = document.getElementById('stranger-profile');
  const timer = document.getElementById('timer');
  
  let chatTimer;
  
  // Simulate receiving messages from a stranger
  function receiveStrangerMessage(message) {
    strangerChatInput.value += `Stranger: ${message}\n`;
  }
  
  // Simulate sending messages
  userChatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const message = userChatInput.value.trim();
      if (message) {
        userChatInput.value = '';
        strangerChatInput.value += `You: ${message}\n`;
        // Simulate a response from the stranger
        setTimeout(() => {
          receiveStrangerMessage('Hello! This is a simulated response.');
        }, 1000);
      }
    }
  });

  // Simulate displaying stranger's profile
  function displayStrangerProfile(profile) {
    strangerProfile.innerHTML = `
      <p><strong>Username:</strong> ${profile.username}</p>
      <p><strong>Gender:</strong> ${profile.gender}</p>
      <p><strong>Age:</strong> ${profile.age}</p>
      <p><strong>Interests:</strong> ${profile.interests.join(', ')}</p>
      <p><strong>Hobbies:</strong> ${profile.hobbies.join(', ')}</p>
      <p><strong>Preferences:</strong> ${profile.preferences.join(', ')}</p>
    `;
  }

  // Simulate fetching a random profile
  function fetchRandomProfile() {
    // Simulated profile data
    const profile = {
      username: 'RandomStranger123',
      gender: 'Other',
      age: 25,
      interests: ['Reading', 'Music', 'Traveling'],
      hobbies: ['Hiking', 'Photography'],
      preferences: ['Coffee', 'Outdoor Activities']
    };
    displayStrangerProfile(profile);
  }

  // Start the chat timer
  function startChatTimer(duration) {
    let time = duration;
    chatTimer = setInterval(() => {
      const minutes = Math.floor(time / 60);
      const seconds = time % 60;
      timer.textContent = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
      if (time <= 0) {
        clearInterval(chatTimer);
        alert('Time is up! The chat session has ended.');
      }
      time--;
    }, 1000);
  }

  // Fetch a random profile when the page loads
  fetchRandomProfile();

  // Start the chat timer (3 minutes)
  startChatTimer(180);
});
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('database.db');

// Initialize Database
db.serialize(() => {
    // Create Users table
    db.run(`
        CREATE TABLE IF NOT EXISTS Users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL,
            profile_picture TEXT,
            UNIQUE(username)
        );
    `);

    // Create Conversations table
    db.run(`
        CREATE TABLE IF NOT EXISTS Conversations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // Create UserConversations table
    db.run(`
        CREATE TABLE IF NOT EXISTS UserConversations (
            user_id INTEGER,
            conversation_id INTEGER,
            PRIMARY KEY (user_id, conversation_id),
            FOREIGN KEY (user_id) REFERENCES Users(id),
            FOREIGN KEY (conversation_id) REFERENCES Conversations(id)
        );
    `);

    // Create Messages table
    db.run(`
        CREATE TABLE IF NOT EXISTS Messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            conversation_id INTEGER,
            sender_id INTEGER,
            text TEXT,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (conversation_id) REFERENCES Conversations(id),
            FOREIGN KEY (sender_id) REFERENCES Users(id)
        );
    `);
});

// Function to add a new user
const addUser = (username, profile_picture, callback) => {
    db.run(`
        INSERT INTO Users (username, profile_picture) VALUES (?, ?)
    `, [username, profile_picture], function(err) {
        callback(err, this.lastID);
    });
};

// Function to create a new conversation
const createConversation = (name, callback) => {
    db.run(`
        INSERT INTO Conversations (name) VALUES (?)
    `, [name], function(err) {
        callback(err, this.lastID);
    });
};

// Function to add a user to a conversation
const addUserToConversation = (user_id, conversation_id, callback) => {
    db.run(`
        INSERT INTO UserConversations (user_id, conversation_id) VALUES (?, ?)
    `, [user_id, conversation_id], function(err) {
        callback(err);
    });
};

// Function to add a message to a conversation
const addMessage = (conversation_id, sender_id, text, callback) => {
    db.run(`
        INSERT INTO Messages (conversation_id, sender_id, text) VALUES (?, ?, ?)
    `, [conversation_id, sender_id, text], function(err) {
        callback(err, this.lastID);
    });
};

// Example usage
addUser('john_doe', 'john_profile.jpg', (err, userId) => {
    if (err) {
        console.error('Error adding user:', err);
    } else {
        console.log('Added user with ID:', userId);
        createConversation('General Chat', (err, conversationId) => {
            if (err) {
                console.error('Error creating conversation:', err);
            } else {
                console.log('Created conversation with ID:', conversationId);
                addUserToConversation(userId, conversationId, (err) => {
                    if (err) {
                        console.error('Error adding user to conversation:', err);
                    } else {
                        console.log('Added user to conversation.');
                        addMessage(conversationId, userId, 'Hello, World!', (err, messageId) => {
                            if (err) {
                                console.error('Error adding message:', err);
                            } else {
                                console.log('Added message with ID:', messageId);
                            }
                        });
                    }
                });
            }
        });
    }
});
document.addEventListener('DOMContentLoaded', function () {
    const allMessagesContainer = document.getElementById('all-messages-container');
    const chatMessages = document.getElementById('chat-messages');
    const chatUsername = document.getElementById('chat-username');
    const chatInput = document.getElementById('chat-message');
    const fileInput = document.getElementById('file-input');
    const recordVoiceButton = document.getElementById('record-voice-button');
    const startVideoCallButton = document.getElementById('start-video-call');
    const videoCallModal = document.getElementById('video-call-modal');
    const closeVideoCallButton = document.getElementById('close-video-call');
    const hostVideo = document.getElementById('host-video');
    const participantVideo = document.getElementById('participant-video');

    function loadConversations() {
        fetch('/api/conversations')
            .then(response => response.json())
            .then(conversations => {
                allMessagesContainer.innerHTML = '';
                conversations.forEach(conversation => {
                    const conversationElement = document.createElement('div');
                    conversationElement.className = 'conversation';
                    conversationElement.innerText = conversation.name;
                    conversationElement.addEventListener('click', () => loadMessages(conversation.id, conversation.name));
                    allMessagesContainer.appendChild(conversationElement);
                });
            })
            .catch(error => console.error('Error fetching conversations:', error));
    }

    function loadMessages(conversationId, conversationName) {
        chatUsername.innerText = conversationName;
        chatUsername.setAttribute('data-conversation-id', conversationId);
        fetch(`/api/conversations/${conversationId}/messages`)
            .then(response => response.json())
            .then(messages => {
                chatMessages.innerHTML = '';
                messages.forEach(message => {
                    const messageElement = document.createElement('div');
                    messageElement.className = 'message';
                    messageElement.innerHTML = `<strong>${message.senderName}:</strong> ${message.text}`;
                    chatMessages.appendChild(messageElement);
                });
            })
            .catch(error => console.error('Error fetching messages:', error));
    }

    function sendMessage() {
        const messageText = chatInput.value;
        const conversationId = chatUsername.getAttribute('data-conversation-id');
        if (messageText && conversationId) {
            fetch(`/api/conversations/${conversationId}/messages`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ senderId: 1, senderName: 'User', text: messageText }) // Modify senderId and senderName as needed
            })
                .then(response => response.json())
                .then(message => {
                    const messageElement = document.createElement('div');
                    messageElement.className = 'message';
                    messageElement.innerHTML = `<strong>${message.senderName}:</strong> ${message.text}`;
                    chatMessages.appendChild(messageElement);
                    chatInput.value = '';
                })
                .catch(error => console.error('Error sending message:', error));
        }
    }

    function openVideoCall() {
        videoCallModal.style.display = 'block';
        // Set up video call logic (this is just a placeholder)
        hostVideo.srcObject = null; // Replace with actual media stream
        participantVideo.srcObject = null; // Replace with actual media stream
    }

    function closeVideoCall() {
        videoCallModal.style.display = 'none';
        // Clean up video call logic
    }

    // Event listeners
    document.getElementById('chat-message').addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });
    recordVoiceButton.addEventListener('click', () => {
        alert('Voice recording not implemented yet.');
    });
    startVideoCallButton.addEventListener('click', openVideoCall);
    closeVideoCallButton.addEventListener('click', closeVideoCall);

    // Load initial conversations
    loadConversations();
});
