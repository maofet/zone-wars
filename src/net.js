// Thin wrapper over PeerJS. Generates room codes, hosts/joins rooms,
// exposes a simple message API.

const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // omit ambiguous chars (I/O/0/1)
const ROOM_CODE_LENGTH = 6;
const PEER_ID_PREFIX = 'zonewars-';

export function generateRoomCode() {
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)];
  }
  return code;
}

// Host a room. Returns a Promise resolving to a room handle:
//   { code, broadcast(msg), onConnection(cb), onClose(cb), close() }
// onConnection callback receives a connection object with .send and a slot index assigned in arrival order.
export async function hostRoom() {
  const code = generateRoomCode();
  return new Promise((resolve, reject) => {
    const peer = new Peer(PEER_ID_PREFIX + code);
    const conns = [];
    let onConnCb = null;
    let onCloseCb = null;

    peer.on('open', () => {
      resolve({
        code,
        peer,
        connections: conns,
        onConnection(cb) {
          onConnCb = cb;
          for (const c of conns) cb(c);
        },
        onClose(cb) { onCloseCb = cb; },
        broadcast(msg) {
          const data = JSON.stringify(msg);
          for (const c of conns) {
            if (c.open) {
              try { c.send(data); } catch (e) { console.warn('broadcast send failed', e); }
            }
          }
        },
        sendTo(connId, msg) {
          const c = conns.find(c => c.peer === connId);
          if (c && c.open) c.send(JSON.stringify(msg));
        },
        close() { peer.destroy(); },
      });
    });

    peer.on('connection', (conn) => {
      conn.on('open', () => {
        conns.push(conn);
        if (onConnCb) onConnCb(conn);
      });
      conn.on('close', () => {
        const idx = conns.indexOf(conn);
        if (idx >= 0) conns.splice(idx, 1);
        if (onCloseCb) onCloseCb(conn);
      });
    });

    peer.on('error', (err) => {
      // If we haven't resolved yet, reject. Otherwise just log.
      console.error('peer error:', err);
      if (err.type === 'unavailable-id') {
        reject(new Error('Room code collision, try again'));
      } else if (err.type === 'browser-incompatible' || err.type === 'network') {
        reject(err);
      }
    });
  });
}

// Join a room by 6-char code. Returns a Promise resolving to a connection handle:
//   { send(msg), onMessage(cb), onClose(cb), close() }
export async function joinRoom(code) {
  return new Promise((resolve, reject) => {
    const peer = new Peer();
    let messageHandler = null;
    let closeHandler = null;
    let resolved = false;

    const timeout = setTimeout(() => {
      if (!resolved) {
        peer.destroy();
        reject(new Error('Connection timed out (10s). Check the room code and try again.'));
      }
    }, 10000);

    peer.on('open', () => {
      const conn = peer.connect(PEER_ID_PREFIX + code, { reliable: true });
      conn.on('open', () => {
        resolved = true;
        clearTimeout(timeout);
        resolve({
          peer, conn,
          send(msg) {
            if (conn.open) {
              try { conn.send(JSON.stringify(msg)); } catch (e) { console.warn('send failed', e); }
            }
          },
          onMessage(cb) { messageHandler = cb; },
          onClose(cb) {
            closeHandler = cb;
            conn.on('close', cb);
            peer.on('disconnected', cb);
          },
          close() { peer.destroy(); },
        });
      });
      conn.on('data', (raw) => {
        if (messageHandler) {
          try { messageHandler(JSON.parse(raw)); }
          catch (e) { console.warn('bad message', raw, e); }
        }
      });
      conn.on('error', (err) => {
        if (!resolved) reject(err);
      });
    });

    peer.on('error', (err) => {
      console.error('peer error:', err);
      if (!resolved) {
        clearTimeout(timeout);
        if (err.type === 'peer-unavailable') {
          reject(new Error('Room not found - check the code'));
        } else {
          reject(err);
        }
      }
    });
  });
}
