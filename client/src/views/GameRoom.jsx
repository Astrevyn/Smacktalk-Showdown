import { useEffect, useState } from "react";
import { socket } from "../socket";
import { useParams, useNavigate } from "react-router-dom";
import "../css/gameRoom.css";

function GameRoom() {
  const { roomCode } = useParams();
  const navigate = useNavigate();

  const [gameState, setGameState] = useState(null);
  const [roundCountdown, setRoundCountdown] = useState(0);
  const [myUserId, setMyUserId] = useState(null);
  const [answerInput, setAnswerInput] = useState("");
  const [leaderboard, setLeaderboard] = useState({});

  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem("userData"));
    if (!storedUser) return navigate("/");
    setMyUserId(storedUser.userId);

    if (!socket.connected) socket.connect();

    socket.on("voteStart", (data) => setGameState({ ...data, phase: "voting" }));
    socket.on("voteCountdown", (seconds) => setRoundCountdown(seconds));
    socket.on("voteEnd", (data) => setGameState((prev) => ({ ...prev, phase: "playing", currentGame: data.chosenGame })));
    socket.on("roundStart", (data) => setGameState((prev) => ({ ...prev, ...data })));
    socket.on("roundCountdown", (seconds) => setRoundCountdown(seconds));
    socket.on("roundResult", (data) => {
      setLeaderboard(data.leaderboard);
      setGameState((prev) => ({ ...prev, roundResult: data }));
    });
    socket.on("leaderboard", (data) => setLeaderboard(data.leaderboard));
    socket.on("gameOver", (data) => {
      setLeaderboard(data.leaderboard);
      alert("Game Over!");
      navigate(`/lobby/${roomCode}`);
    });

    return () => {
      socket.off("voteStart");
      socket.off("voteCountdown");
      socket.off("voteEnd");
      socket.off("roundStart");
      socket.off("roundCountdown");
      socket.off("roundResult");
      socket.off("leaderboard");
      socket.off("gameOver");
    };
  }, [navigate, roomCode]);

  const submitAnswer = () => {
    if (!answerInput.trim()) return;
    socket.emit("submitAnswer", { roomCode, userId: myUserId, answer: answerInput });
    setAnswerInput("");
  };

  return (
    <div className="gameRoomDisplay">
      <h1>Game Room: {roomCode}</h1>
      <p>Phase: {gameState?.phase}</p>
      {gameState?.phase === "voting" && <p>Voting ends in: {roundCountdown}s</p>}
      {gameState?.phase === "playing" && (
        <div>
          <p>Round {gameState.round} / {gameState.totalRounds}</p>
          <p>Time left: {roundCountdown}s</p>
          {gameState.currentGame === "guess-number" && !gameState.roundResult?.winnerId && (
            <div>
              <input value={answerInput} onChange={(e) => setAnswerInput(e.target.value)} placeholder="Enter your guess" />
              <button onClick={submitAnswer}>Submit</button>
            </div>
          )}
        </div>
      )}

      <h2>Leaderboard</h2>
      <ul>
        {leaderboard && Object.entries(leaderboard).map(([id, stats]) => (
          <li key={id}>
            {stats.username}: {stats.coins} coins, {stats.wins} wins
          </li>
        ))}
      </ul>
    </div>
  );
}

export default GameRoom;