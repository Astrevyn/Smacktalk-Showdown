/* eslint-disable no-unused-vars */
// src/App.jsx
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Lobby from "./views/Lobby";
import LoadingScreen from "./views/loadingScreen";
import GameRoom from "./views/GameRoom";

export default function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={<LoadingScreen />}
      />

      <Route
        path="/lobby/:roomCode"
        element={<Lobby />}
      />

      <Route
        path="/gameroom/:roomCode"
        element={<GameRoom />}
      />

    </Routes>
  );
}
