import { io } from "socket.io-client";
import { getArchitectToken } from "./apiClient.js";

export const socket = io({
  auth: { token: getArchitectToken() }
});
