import { useEffect, useState, useRef } from "react";
import { socket } from "../socket";
import "../css/lobby.css";
import { useNavigate, useParams } from "react-router-dom";

function Lobby() {
  const navigate = useNavigate();
  const { roomCode } = useParams();

  const [players, setPlayers] = useState([]);
  const [isReady, setIsReady] = useState(false);
  const [myId, setMyId] = useState(null);
  const [hostId, setHostId] = useState(null);
  const [countdown, setCountdown] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const chatEndRef = useRef(null);

  // --- Settings modal ---
  const [showSettings, setShowSettings] = useState(false);
  const [roundTime, setRoundTime] = useState(10); // minutes
  const [maxRounds, setMaxRounds] = useState(3);

  useEffect(() => {
    let storedUser = JSON.parse(localStorage.getItem("userData"));
    if (!storedUser) {
      navigate("/");
      return;
    }

    if (!socket.connected) socket.connect();
    socket.emit("joinRoom", roomCode, storedUser);

    const handleJoined = ({ id, hostId: newHostId }) => {
      storedUser = { ...storedUser, id };
      localStorage.setItem("userData", JSON.stringify(storedUser));
      setMyId(id);
      if (newHostId) setHostId(newHostId);
    };

    const handleLobbyUpdate = ({ users, hostId: newHostId }) => {
      setPlayers(users);
      if (newHostId) setHostId(newHostId);
    };

    const handleCountdown = (seconds) => setCountdown(seconds);
    const handleGameStart = () => navigate(`/gameroom/${roomCode}`);
    const handleChatUpdate = (messages) => setChatMessages(messages);
    const handleJoinDenied = (msg) => {
      alert(msg);
      localStorage.removeItem("userData");
      navigate("/");
    };

    socket.on("joined", handleJoined);
    socket.on("lobbyUpdate", handleLobbyUpdate);
    socket.on("usernameError", handleJoinDenied);
    socket.on("avatarError", handleJoinDenied);
    socket.on("countdown", handleCountdown);
    socket.on("gameStart", handleGameStart);
    socket.on("chatUpdate", handleChatUpdate);

    return () => {
      socket.off("joined", handleJoined);
      socket.off("lobbyUpdate", handleLobbyUpdate);
      socket.off("usernameError", handleJoinDenied);
      socket.off("avatarError", handleJoinDenied);
      socket.off("countdown", handleCountdown);
      socket.off("gameStart", handleGameStart);
      socket.off("chatUpdate", handleChatUpdate);
    };
  }, [navigate, roomCode]);

  const handleReady = () => {
    if (!myId) return;
    const next = !isReady;
    setIsReady(next);
    socket.emit("playerReady", { roomCode, id: myId, isReady: next });
  };

  const handleLeave = () => {
    localStorage.removeItem("userData");
    socket.emit("leaveRoom", roomCode);
    navigate("/");
  };

  const sendMessage = () => {
    if (!chatInput.trim() || !myId) return;
    const user = players.find((p) => p.id === myId);
    socket.emit("sendMessage", { roomCode, username: user.username, message: chatInput });
    setChatInput("");
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const handleSaveSettings = () => {
    socket.emit("updateSettings", { roomCode, roundTime, maxRounds });
    setShowSettings(false);
  };

  const maxPlayers = 6;

  return (
    <div className="lobbyDisplay">
      {/* --- Lobby Header --- */}
      <div className="lobbyHeader">
        <h1>Smacktalk Showdown Lobby</h1>
        <h2>
          Room Code: <span>{roomCode}</span>
        </h2>
        {countdown && <p className="countdown">Game starting in: {countdown}s</p>}
      </div>

      {/* --- Players List --- */}
      <div className="playersList">
        {players.map((player) => (
          <div key={player.id} className={`playerCard ${player.isReady ? "ready" : ""}`}>
            <span className="avatar">{player.avatar}</span>
            <span
              className={`username ${player.isReady ? "usernameReady" : ""} ${player.id === myId ? "myUsername" : ""
                }`}
            >
              {player.id === hostId && "👑"} {player.username}
            </span>
            <span className="coins">Coins: {player.coins}</span>
            <span className="wins">Wins: {player.gameWins}</span>
            <span className="readyStatus">{player.isReady ? "✅ Ready" : "❌ Not Ready"}</span>
          </div>
        ))}
        {Array.from({ length: maxPlayers - players.length }).map((_, i) => (
          <div key={i} className="playerCard empty">
            <span>Open Slot</span>
          </div>
        ))}
      </div>

      {/* --- Buttons --- */}
      <div className="lobbyButtons">
        <button className="readyBttn" onClick={handleReady}>
          {isReady ? "Unready" : "Ready"}
        </button>
        <button className="leaveBttn" onClick={handleLeave}>
          Leave Lobby
        </button>
        {hostId === myId && (
          <button className="readyBttn" onClick={() => setShowSettings(true)}>
            Settings
          </button>
        )}
      </div>

      {/* --- Chat --- */}
      <div className="chatBox">
        <div className="chatMessages">
          {chatMessages.map((msg, i) => (
            <p key={i}>
              <strong>{msg.username}:</strong> {msg.message}
            </p>
          ))}
          <div ref={chatEndRef}></div>
        </div>
        <input
          type="text"
          placeholder="Type a message..."
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
        />
      </div>

      {/* --- Settings Modal --- */}
      {showSettings && (
        <div className="settingsModalOverlay">
          <div className="settingsModal">
            <h2>Game Settings</h2>
            <div className="settingsRow">
              <label>Round Time (min):</label>
              <input
                type="number"
                min={1}
                max={30}
                value={roundTime}
                onChange={(e) => setRoundTime(Number(e.target.value))}
              />
            </div>
            <div className="settingsRow">
              <label>Max Rounds:</label>
              <input
                type="number"
                min={1}
                max={10}
                value={maxRounds}
                onChange={(e) => setMaxRounds(Number(e.target.value))}
              />
            </div>
            <div className="modalButtons">
              <button onClick={() => setShowSettings(false)}>Cancel</button>
              <button onClick={handleSaveSettings}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Lobby;