import { io } from 'socket.io-client';

const SERVER =
  import.meta.env.VITE_SERVER_URL ||
  (import.meta.env.DEV ? '' : window.location.origin);

export const socket = io(SERVER, {
  withCredentials: true,
  autoConnect: false,
});
