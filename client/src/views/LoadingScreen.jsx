/* eslint-disable no-unused-vars */
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { socket } from "../socket";
import "../css/loadingScreen.css";

function generateRoomCode() {
  return Math.floor(1000 + Math.random() * 9000).toString(); // 4-digit code
}

export default function LoadingScreen() {
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("😎");
  const [roomCode, setRoomCode] = useState(generateRoomCode());
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleNameError = (msg) => setError(msg);
    const handleAvatarError = (msg) => setError(msg);

    const handleJoined = ({ id }) => {
      const user = {
        username: name,
        avatar,
        coins: 0,
        gameWins: 0,
        id,
      };
      localStorage.setItem("userData", JSON.stringify(user));
      setError(null);
      navigate(`/lobby/${roomCode}`);
    };

    socket.on("usernameError", handleNameError);
    socket.on("avatarError", handleAvatarError);
    socket.on("joined", handleJoined);

    return () => {
      socket.off("usernameError", handleNameError);
      socket.off("avatarError", handleAvatarError);
      socket.off("joined", handleJoined);
    };
  }, [name, avatar, roomCode, navigate]);

  const handleStart = () => {
    setError(null);
    if (!name.trim()) {
      setError("Please enter a name");
      return;
    }

    const user = {
      username: name,
      avatar,
      coins: 0,
      gameWins: 0,
    };

    if (!socket.connected) socket.connect();
    socket.emit("joinRoom", roomCode, user);
  };

  const avatars = [
    "😎",
    "🤡",
    "🤖",
    "🕹️",
    "🦄",
    "🪼",
    "💃🏽",
    "🥷🏽",
    "🧝🏽",
    "🧑🏽‍💻",
  ];

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
          <input
            type="text"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value)}
          />
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
