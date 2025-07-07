import React, { useEffect, useState } from 'react';
import io from 'socket.io-client';

const socket = io('http://localhost:4000');

function App() {
  const [screen, setScreen] = useState('home'); // 'home' or 'board'
  const [roomId, setRoomId] = useState('');
  const [inputRoomId, setInputRoomId] = useState('');
  const [username, setUsername] = useState('');
  const [text, setText] = useState('');
  const [isCreator, setIsCreator] = useState(false);
  const [userList, setUserList] = useState([]);

  useEffect(() => {
    socket.on('update_text', (incomingText) => {
      setText(incomingText);
    });

    socket.on('room_deleted', () => {
      alert('⚠️ This room was deleted by the creator.');
      resetState();
    });

    socket.on('user_list', (users) => {
      setUserList(users);
    });

    return () => {
      socket.off('update_text');
      socket.off('room_deleted');
      socket.off('user_list');
    };
  }, []);

  const resetState = () => {
    setRoomId('');
    setText('');
    setScreen('home');
    setIsCreator(false);
    setUserList([]);
    setInputRoomId('');
  };

  const handleCreateRoom = () => {
    if (!username.trim()) {
      alert('Please enter a username');
      return;
    }
    socket.emit('create_room', (newRoomId) => {
      setRoomId(newRoomId);
      setIsCreator(true);
      setScreen('board');

      // Immediately join the new room
      socket.emit('join_room', { roomId: newRoomId, username }, (res) => {
        if (!res.success) {
          alert(res.message);
          resetState();
        } else {
          setText(res.text);
        }
      });
    });
  };

  const handleJoinRoom = () => {
    if (!username.trim() || !inputRoomId.trim()) {
      alert('Please enter both username and room ID');
      return;
    }

    socket.emit('join_room', { roomId: inputRoomId, username }, (res) => {
      if (!res.success) {
        alert(res.message);
      } else {
        setRoomId(inputRoomId);
        setText(res.text);
        setScreen('board');
        setIsCreator(false);
      }
    });
  };

  const handleChange = (e) => {
    const newText = e.target.value;
    setText(newText);
    socket.emit('send_text', { roomId, text: newText });
  };

  // -----------------------
  // HOME SCREEN
  // -----------------------
  if (screen === 'home') {
    return (
      <div style={{ padding: '2rem' }}>
        <h1>🧠 Real-Time Typing Rooms</h1>

        <input
          placeholder="Enter your username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          style={{ marginBottom: '10px', display: 'block' }}
        />

        <button onClick={handleCreateRoom} style={{ marginBottom: '1rem' }}>
          ➕ Create Room
        </button>

        <div>
          <input
            placeholder="Enter Room ID"
            value={inputRoomId}
            onChange={(e) => setInputRoomId(e.target.value)}
          />
          <button onClick={handleJoinRoom}>🔗 Join Room</button>
        </div>
      </div>
    );
  }

  // -----------------------
  // BOARD SCREEN
  // -----------------------
  return (
    <div style={{ padding: '2rem', display: 'flex', gap: '2rem' }}>
      <div style={{ flex: 1 }}>
        <h2>📝 Room ID: {roomId}</h2>

        {roomId && (
          <div style={{ marginBottom: '1rem' }}>
            {isCreator && (
              <button
                onClick={() => socket.emit('delete_room', roomId)}
                style={{ marginRight: '10px' }}
              >
                🗑️ Delete Room
              </button>
            )}
            <button
              onClick={() => {
                socket.emit('leave_room', roomId);
                resetState();
              }}
            >
              🔙 Leave Room
            </button>
          </div>
        )}

        <textarea
          rows={10}
          cols={60}
          value={text}
          onChange={handleChange}
          placeholder="Start typing collaboratively..."
        />
      </div>

      {/* Online User List */}
      <div style={{ width: '200px', borderLeft: '1px solid #ccc', paddingLeft: '1rem' }}>
        <h3>👥 Users Online</h3>
        <ul>
          {userList.map((name, idx) => (
            <li key={idx}>• {name}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default App;
