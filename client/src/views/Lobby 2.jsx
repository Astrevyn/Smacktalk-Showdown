import { io } from "socket.io-client";
const socket = io("http://localhost:3000");

// example usr data
const userData = {
  username: "Player1",
  avatar: "avatar1.png",
  coins: 0,
  gameWins: 0,
  gameLosses: 0,
  isGuest: true
};

socket.emit('joinLobby', userData);

socket.on('lobbyUpdate', (users) => {
  console.log("Current players:", users);
});

function lobby() {
  return (
    <>
      <h1>Smacktalk Showdown</h1>
    </>
  );
}

export default lobby;