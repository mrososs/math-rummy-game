import { defineStore } from 'pinia';
import type {
  CreateRoomInput,
  GameCommand,
  GameRoomBackend,
  LiveRoomSnapshot,
  PlayerGameSnapshot,
  RoomPlayer,
  RoomSnapshot,
} from 'network-contracts';
import { normalizeRoomCode } from 'network-contracts';

const PLAYER_COLORS = [
  '#2563EB',
  '#0F766E',
  '#D97706',
  '#7C3AED',
  '#E11D48',
  '#0891B2',
  '#65A30D',
  '#475569',
] as const;

const BOT_NAMES = ['Nova', 'Tally', 'Orbit', 'Pip', 'Sage'] as const;

let configuredBackend: GameRoomBackend | undefined;
let unsubscribeFromBackend: (() => void) | undefined;
// Serializes outgoing commands so they commit in order, each using the version
// produced by the previous one.
let commandChain: Promise<void> = Promise.resolve();
let pendingCommands = 0;

function randomRoomCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(4);
  globalThis.crypto?.getRandomValues?.(bytes);
  let code = '';
  for (let index = 0; index < 4; index += 1) {
    const byte = bytes[index] || Math.floor(Math.random() * 256);
    code += alphabet[byte % alphabet.length];
  }
  return code;
}

function emptyRoom(): RoomSnapshot {
  return {
    code: '',
    maxPlayers: 6,
    hostId: '',
    status: 'lobby',
    transport: 'wifi',
    players: [],
  };
}

/** Offline fallback room (no backend): a real code and just the host. */
function createLocalRoom(input: CreateRoomInput, hostId: string): RoomSnapshot {
  return {
    code: randomRoomCode(),
    maxPlayers: input.maxPlayers,
    hostId,
    status: 'lobby',
    transport: 'wifi',
    players: [
      {
        id: hostId,
        name: input.hostName.trim() || 'Player',
        seat: 1,
        color: PLAYER_COLORS[0],
        isHost: true,
        isReady: true,
        cardsRemaining: 10,
        connection: 'strong',
        transport: 'wifi',
      },
    ],
  };
}

function createBotRoomSnapshot(
  playerName: string,
  botCount: number,
): RoomSnapshot {
  const safeBotCount = Math.min(5, Math.max(1, Math.round(botCount)));
  const players: RoomPlayer[] = [
    {
      id: 'local-player',
      name: playerName.trim() || 'Player',
      seat: 1,
      color: PLAYER_COLORS[0],
      isHost: true,
      isReady: true,
      cardsRemaining: 10,
      connection: 'strong',
      transport: 'wifi',
    },
    ...BOT_NAMES.slice(0, safeBotCount).map((name, index) => ({
      id: `bot-${index + 1}`,
      name,
      seat: index + 2,
      color: PLAYER_COLORS[index + 1],
      isHost: false,
      isReady: true,
      cardsRemaining: 10,
      connection: 'strong' as const,
      transport: 'wifi' as const,
    })),
  ];
  return {
    code: 'BOTS',
    maxPlayers: players.length,
    hostId: 'local-player',
    status: 'playing',
    transport: 'wifi',
    players,
  };
}

interface RoomState {
  currentPlayerId: string;
  currentPlayerName: string;
  room: RoomSnapshot;
  roomId?: string;
  stateVersion: number;
  gameState: unknown | null;
  playerSnapshot: PlayerGameSnapshot | null;
  backendEnabled: boolean;
  isLoading: boolean;
  commandPending: boolean;
  errorMessage: string;
}

export const useRoomStore = defineStore('local-room', {
  state: (): RoomState => ({
    currentPlayerId: '',
    currentPlayerName: 'Player',
    room: emptyRoom(),
    roomId: undefined,
    stateVersion: 0,
    gameState: null,
    playerSnapshot: null,
    backendEnabled: false,
    isLoading: false,
    commandPending: false,
    errorMessage: '',
  }),
  getters: {
    currentPlayer(state): RoomPlayer | undefined {
      return state.room.players.find(
        (player) => player.id === state.currentPlayerId,
      );
    },
    isHost(): boolean {
      return this.currentPlayer?.isHost ?? false;
    },
    canStart(state): boolean {
      return (
        state.room.players.length >= 2 &&
        state.room.players.every((player) => player.isReady || player.isHost)
      );
    },
  },
  actions: {
    configureBackend(backend: GameRoomBackend): void {
      configuredBackend = backend;
      this.backendEnabled = true;
      this.subscribeToBackend();
    },
    subscribeToBackend(): void {
      unsubscribeFromBackend?.();
      unsubscribeFromBackend = configuredBackend?.subscribe((snapshot) => {
        this.applyBackendSnapshot(snapshot);
      });
    },
    setupBotRoom(playerName: string, botCount: number): void {
      unsubscribeFromBackend?.();
      unsubscribeFromBackend = undefined;
      this.backendEnabled = false;
      this.currentPlayerId = 'local-player';
      this.currentPlayerName = playerName.trim() || 'Player';
      this.room = createBotRoomSnapshot(this.currentPlayerName, botCount);
      this.roomId = undefined;
      this.gameState = null;
      this.playerSnapshot = null;
      this.stateVersion = 0;
      this.errorMessage = '';
    },
    applyBackendSnapshot(snapshot: LiveRoomSnapshot): void {
      this.roomId = snapshot.roomId;
      this.room = snapshot.room;
      this.stateVersion = snapshot.stateVersion;
      this.gameState = snapshot.gameState;
      this.playerSnapshot = snapshot.playerSnapshot;
      if (configuredBackend?.currentUserId) {
        this.currentPlayerId = configuredBackend.currentUserId;
        this.currentPlayerName =
          snapshot.room.players.find(
            (player) => player.id === configuredBackend?.currentUserId,
          )?.name ?? this.currentPlayerName;
      }
    },
    async createRoom(input: CreateRoomInput): Promise<boolean> {
      this.beginRequest();
      try {
        this.currentPlayerName = input.hostName.trim() || 'Host';
        if (configuredBackend) {
          this.backendEnabled = true;
          this.subscribeToBackend();
          this.applyBackendSnapshot(await configuredBackend.createRoom(input));
        } else {
          this.currentPlayerId = 'local-host';
          this.room = createLocalRoom(
            { ...input, hostName: this.currentPlayerName },
            'local-host',
          );
          this.gameState = null;
          this.stateVersion = 0;
        }
        return true;
      } catch (error) {
        this.captureError(error);
        return false;
      } finally {
        this.isLoading = false;
      }
    },
    async joinRoom(roomCode: string, playerName: string): Promise<boolean> {
      this.beginRequest();
      try {
        this.currentPlayerName = playerName.trim() || 'Player';
        if (configuredBackend) {
          this.backendEnabled = true;
          this.subscribeToBackend();
          this.applyBackendSnapshot(
            await configuredBackend.joinRoom(
              normalizeRoomCode(roomCode),
              this.currentPlayerName,
            ),
          );
        } else {
          const player: RoomPlayer = {
            id: 'local-guest',
            name: this.currentPlayerName,
            seat: 1,
            color: PLAYER_COLORS[0],
            isHost: false,
            isReady: false,
            cardsRemaining: 10,
            connection: 'strong',
            transport: 'wifi',
          };
          this.currentPlayerId = player.id;
          this.room = {
            ...emptyRoom(),
            code: normalizeRoomCode(roomCode) || randomRoomCode(),
            players: [player],
          };
        }
        return true;
      } catch (error) {
        this.captureError(error);
        return false;
      } finally {
        this.isLoading = false;
      }
    },
    async toggleReady(): Promise<void> {
      const current = this.currentPlayer;
      if (!current || current.isHost) return;
      this.beginRequest();
      try {
        if (configuredBackend && this.backendEnabled) {
          this.applyBackendSnapshot(
            await configuredBackend.setReady(!current.isReady),
          );
        } else {
          this.room = {
            ...this.room,
            players: this.room.players.map((player) =>
              player.id === this.currentPlayerId
                ? { ...player, isReady: !player.isReady }
                : player,
            ),
          };
        }
      } catch (error) {
        this.captureError(error);
      } finally {
        this.isLoading = false;
      }
    },
    async startGame(localMatch?: unknown): Promise<boolean> {
      this.beginRequest();
      try {
        if (configuredBackend && this.backendEnabled) {
          // The server shuffles and deals; no client state is uploaded.
          this.applyBackendSnapshot(await configuredBackend.startGame());
        } else {
          this.room = { ...this.room, status: 'playing' };
          this.gameState = toSerializable(localMatch);
          this.stateVersion += 1;
        }
        return true;
      } catch (error) {
        this.captureError(error);
        return false;
      } finally {
        this.isLoading = false;
      }
    },
    // Local/offline (bot) mode only. Online play goes through sendCommand().
    async publishGameState(nextState: unknown): Promise<boolean> {
      this.gameState = toSerializable(nextState);
      this.stateVersion += 1;
      return true;
    },
    async sendCommand(command: GameCommand): Promise<boolean> {
      if (!configuredBackend || !this.backendEnabled) return false;
      // Enqueue behind any in-flight command so they commit strictly in order.
      pendingCommands += 1;
      this.commandPending = true;
      const task = commandChain.then(() => this.runQueuedCommand(command));
      commandChain = task.then(
        () => undefined,
        () => undefined,
      );
      try {
        return await task;
      } finally {
        pendingCommands -= 1;
        if (pendingCommands === 0) this.commandPending = false;
      }
    },
    async runQueuedCommand(command: GameCommand): Promise<boolean> {
      if (!configuredBackend) return false;
      try {
        this.applyBackendSnapshot(
          await configuredBackend.sendCommand(command, this.stateVersion),
        );
        return true;
      } catch (error) {
        this.captureError(error);
        // Resync to authoritative state after a conflict or rejection.
        try {
          this.applyBackendSnapshot(await configuredBackend.fetchSnapshot());
        } catch {
          // Keep the original error for the UI.
        }
        return false;
      }
    },
    async refreshSnapshot(): Promise<void> {
      if (!configuredBackend || !this.backendEnabled) return;
      try {
        this.applyBackendSnapshot(await configuredBackend.fetchSnapshot());
      } catch (error) {
        this.captureError(error);
      }
    },
    async leaveRoom(): Promise<void> {
      try {
        await configuredBackend?.leaveRoom();
      } catch (error) {
        this.captureError(error);
      }
      this.roomId = undefined;
      this.gameState = null;
      this.playerSnapshot = null;
      this.stateVersion = 0;
    },
    clearError(): void {
      this.errorMessage = '';
    },
    beginRequest(): void {
      this.isLoading = true;
      this.errorMessage = '';
    },
    captureError(error: unknown): void {
      this.errorMessage =
        error instanceof Error
          ? error.message
          : 'The room could not be updated.';
    },
  },
});

function toSerializable(value: unknown): unknown {
  if (value === undefined) throw new Error('A game state is required.');
  return JSON.parse(JSON.stringify(value)) as unknown;
}
