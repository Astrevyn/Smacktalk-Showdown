// src/socket.js
import { io } from "socket.io-client";

// use window.location.hostname so when you open the app via IP on another device
// the socket will target the same host automatically.
const SOCKET_URL = `http://${window.location.hostname}:3000`;

export const socket = io(SOCKET_URL, {
  autoConnect: false, // we'll connect explicitly from LoadingScreen
  transports: ["websocket", "polling"],
});
export default socket;
