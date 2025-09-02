// server.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

let rooms = {}; // { roomCode: { users, hostId, chat, gameState, ... } }

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // --- Join Room / Reconnect ---
  socket.on("joinRoom", (roomCode, userData) => {
    if (!rooms[roomCode]) {
      rooms[roomCode] = {
        users: [],
        hostId: socket.id,
        chat: [],
        currentRound: 0,
        totalRounds: 3,
        gameState: null,
        gameTimer: null,
      };
    }
    const room = rooms[roomCode];

    // Persistent user tracking by userId
    let existingUser = room.users.find((u) => u.userId === userData.userId);
    if (existingUser) {
      existingUser.id = socket.id; // update socket id on reconnect
    } else {
      const newUser = {
        ...userData,
        id: socket.id, // socket session id
        isReady: false,
        coins: userData.coins || 0,
        wins: userData.wins || 0,
      };
      room.users.push(newUser);
    }

    socket.join(roomCode);

    // ✅ Fix: send both socket.id and persistent userId
    socket.emit("joined", { id: socket.id, userId: userData.userId, hostId: room.hostId });

    io.to(roomCode).emit("lobbyUpdate", { users: room.users, hostId: room.hostId });
  });

  // --- Player ready/unready ---
  socket.on("playerReady", ({ roomCode, userId, isReady }) => {
    const room = rooms[roomCode];
    if (!room) return;
    const player = room.users.find((u) => u.userId === userId);
    if (player) player.isReady = isReady;

    io.to(roomCode).emit("lobbyUpdate", { users: room.users, hostId: room.hostId });

    // Auto-start countdown if all ready
    const allReady = room.users.length >= 2 && room.users.every((u) => u.isReady);
    if (allReady && !room.gameTimer) {
      let seconds = 15;
      io.to(roomCode).emit("countdown", seconds);

      room.gameTimer = setInterval(() => {
        if (room.users.length < 2 || !room.users.every((u) => u.isReady)) {
          clearInterval(room.gameTimer);
          room.gameTimer = null;
          io.to(roomCode).emit("countdown", null);
          return;
        }
        seconds--;
        io.to(roomCode).emit("countdown", seconds);
        if (seconds <= 0) {
          clearInterval(room.gameTimer);
          room.gameTimer = null;
          startGame(roomCode);
        }
      }, 1000);
    }

    if (!allReady && room.gameTimer) {
      clearInterval(room.gameTimer);
      room.gameTimer = null;
      io.to(roomCode).emit("countdown", null);
    }
  });

  // --- Chat ---
  socket.on("sendMessage", ({ roomCode, username, message }) => {
    const room = rooms[roomCode];
    if (!room) return;
    room.chat.push({ username, message });
    io.to(roomCode).emit("chatUpdate", room.chat);
  });

  // --- Request current room state ---
  socket.on("getRoomState", (roomCode, ack) => {
    const room = rooms[roomCode];
    if (!room) return ack?.({ ok: false });
    ack?.({
      ok: true,
      users: room.users,
      hostId: room.hostId,
      gameState: room.gameState,
      chat: room.chat,
    });
  });

  // --- Cast vote ---
  socket.on("castVote", ({ roomCode, userId, gameChoice }) => {
    const room = rooms[roomCode];
    if (!room?.gameState || room.gameState.phase !== "voting") return;
    if (!room.gameState.voteOptions.includes(gameChoice)) return;

    room.gameState.votes[userId] = gameChoice;
    io.to(roomCode).emit("voteUpdate", room.gameState.votes);

    const allVoted = Object.keys(room.gameState.votes).length === room.users.length;
    if (allVoted && room.gameState.roundTimer) {
      clearInterval(room.gameState.roundTimer);
      room.gameState.roundTimer = null;
      finishVoting(roomCode);
    }
  });

  // --- Submit answer ---
  socket.on("submitAnswer", ({ roomCode, userId, answer }) => {
    const room = rooms[roomCode];
    if (!room?.gameState || room.gameState.phase !== "playing") return;
    if (room.gameState.currentGame !== "guess-number") return;

    const target = room.gameState.data?.target;
    if (typeof target !== "number") return;

    if (Number(answer) === target && !room.gameState.data.winnerId) {
      room.gameState.data.winnerId = userId;
      endRound(roomCode, { winnerId: userId, reason: "correct_guess" });
    }
  });

  // --- Leave / Disconnect ---
  const removeFromRoom = (socketId) => {
    for (const code in rooms) {
      const room = rooms[code];
      room.users = room.users.filter((u) => u.id !== socketId);

      if (room.hostId === socketId && room.users.length) {
        room.hostId = room.users[0].id;
      }

      if (!room.users.length) {
        delete rooms[code];
      } else {
        io.to(code).emit("lobbyUpdate", { users: room.users, hostId: room.hostId });
      }
    }
  };
  socket.on("leaveRoom", () => removeFromRoom(socket.id));
  socket.on("disconnect", () => removeFromRoom(socket.id));
});

// ----------------- Game Flow -----------------
function startGame(roomCode) {
  const room = rooms[roomCode];
  if (!room) return;

  room.currentRound = 1;
  room.totalRounds = room.users.length <= 5 ? 3 : 4;
  room.gameState = {
    phase: "voting",
    round: 1,
    totalRounds: room.totalRounds,
    voteOptions: ["guess-number"],
    votes: {},
    currentGame: null,
    leaderboard: Object.fromEntries(
      room.users.map((u) => [
        u.userId,
        { username: u.username, coins: u.coins, wins: u.wins },
      ])
    ),
  };

  io.to(roomCode).emit("gameStart", { roomCode, round: 1 });
  startVotingPhase(roomCode);
}

function startVotingPhase(roomCode) {
  const room = rooms[roomCode];
  if (!room) return;
  room.gameState.phase = "voting";
  room.gameState.votes = {};
  let seconds = 45;

  io.to(roomCode).emit("voteStart", {
    seconds,
    options: room.gameState.voteOptions,
    round: room.gameState.round,
    totalRounds: room.gameState.totalRounds,
  });

  room.gameState.roundTimer = setInterval(() => {
    seconds--;
    io.to(roomCode).emit("voteCountdown", seconds);

    const allVoted = Object.keys(room.gameState.votes).length === room.users.length;
    if (seconds <= 0 || allVoted) {
      clearInterval(room.gameState.roundTimer);
      room.gameState.roundTimer = null;
      finishVoting(roomCode);
    }
  }, 1000);
}

function finishVoting(roomCode) {
  const room = rooms[roomCode];
  if (!room) return;

  const votes = Object.values(room.gameState.votes);
  const choice = votes.length
    ? votes.sort(
      (a, b) => votes.filter((v) => v === b).length - votes.filter((v) => v === a).length
    )[0]
    : room.gameState.voteOptions[0];

  room.gameState.currentGame = choice;
  io.to(roomCode).emit("voteEnd", { chosenGame: choice });
  startRound(roomCode, choice);
}

function startRound(roomCode, game) {
  const room = rooms[roomCode];
  if (!room) return;

  room.gameState.phase = "playing";

  if (game === "guess-number") {
    const target = 1 + Math.floor(Math.random() * 9);
    room.gameState.data = { target, winnerId: null };
    let seconds = 60;

    io.to(roomCode).emit("roundStart", {
      game,
      seconds,
      round: room.gameState.round,
      totalRounds: room.gameState.totalRounds,
    });

    room.gameState.roundTimer = setInterval(() => {
      seconds--;
      io.to(roomCode).emit("roundCountdown", seconds);

      if (seconds <= 0) {
        clearInterval(room.gameState.roundTimer);
        room.gameState.roundTimer = null;
        endRound(roomCode, { winnerId: null, reason: "time_up" });
      }
    }, 1000);
  }
}

function endRound(roomCode, { winnerId, reason }) {
  const room = rooms[roomCode];
  if (!room) return;
  if (room.gameState.roundTimer) clearInterval(room.gameState.roundTimer);

  if (winnerId) {
    const u = room.users.find((x) => x.userId === winnerId);
    if (u) {
      u.coins += 3;
      u.wins += 1;
      room.gameState.leaderboard[winnerId].coins += 3;
      room.gameState.leaderboard[winnerId].wins += 1;
    }
  }

  io.to(roomCode).emit("roundResult", {
    winnerId: winnerId || null,
    answer: room.gameState.currentGame === "guess-number" ? room.gameState.data.target : null,
    leaderboard: room.gameState.leaderboard,
  });

  io.to(roomCode).emit("leaderboard", {
    round: room.gameState.round,
    totalRounds: room.gameState.totalRounds,
    leaderboard: room.gameState.leaderboard,
  });

  const hasMore = room.gameState.round < room.gameState.totalRounds;
  setTimeout(() => {
    if (!rooms[roomCode]) return;
    if (hasMore) {
      room.gameState.round++;
      startVotingPhase(roomCode);
    } else {
      room.gameState.phase = "over";
      io.to(roomCode).emit("gameOver", { leaderboard: room.gameState.leaderboard });
      room.users.forEach((u) => (u.isReady = false));
      io.to(roomCode).emit("lobbyUpdate", { users: room.users, hostId: room.hostId });
    }
  }, 3500);
}

server.listen(3000, "0.0.0.0", () => console.log("Server running on port 3000"));