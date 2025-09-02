import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { socket } from "../socket";
import { v4 as uuidv4 } from "uuid";
import "../css/loadingScreen.css";

function generateRoomCode() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

export default function LoadingScreen() {
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("😎");
  const [roomCode, setRoomCode] = useState(generateRoomCode());
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleJoined = ({ userId }) => {
      const storedUser = {
        username: name,
        avatar,
        coins: 0,
        gameWins: 0,
        userId, // ✅ persistent identifier
      };
      localStorage.setItem("userData", JSON.stringify(storedUser));
      setError(null);
      navigate(`/lobby/${roomCode}`);
    };

    socket.on("joined", handleJoined);
    return () => {
      socket.off("joined", handleJoined);
    };
  }, [name, avatar, roomCode, navigate]);

  const handleStart = () => {
    setError(null);
    if (!name.trim()) {
      setError("Please enter a name");
      return;
    }

    // ✅ Use existing userId if available, else generate one
    let stored = JSON.parse(localStorage.getItem("userData"));
    let userId = stored?.userId || uuidv4();

    const user = {
      username: name,
      avatar,
      coins: 0,
      gameWins: 0,
      userId,
    };

    if (!socket.connected) socket.connect();
    socket.emit("joinRoom", roomCode, user);
  };

  const avatars = ["😎", "🤡", "🤖", "🕹️", "🦄", "🪼", "💃🏽", "🥷🏽", "🧝🏽", "🧑🏽‍💻"];

  return (
    <div className="gameDisplay">
      <div className="loading-box">
        {error && <p style={{ color: "white", fontWeight: "bold" }}>{error}</p>}

        <input
          className="usernameInput"
          type="text"
          placeholder="Enter your name..."
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <select
          className="avatarSelect"
          value={avatar}
          onChange={(e) => setAvatar(e.target.value)}
        >
          {avatars.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>

        <div className="roomCodeInput">
          <p>Room Code</p>
          <input type="text" value={roomCode} onChange={(e) => setRoomCode(e.target.value)} />
          <button
            className="randomizeBttn"
            onClick={() => setRoomCode(generateRoomCode())}
            title="Randomize Room Code"
          >
            🎲
          </button>
        </div>

        <button className="startBttn" onClick={handleStart}>
          Join Lobby
        </button>
      </div>
    </div>
  );
}