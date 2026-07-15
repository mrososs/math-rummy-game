import { defineStore } from 'pinia';
import type {
  CreateRoomInput,
  GameRoomBackend,
  LiveRoomSnapshot,
  NearbyRoom,
  RoomPlayer,
  RoomSnapshot,
  TransportKind,
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

function demoPlayers(hostName = 'Maya', maximumPlayers = 6): RoomPlayer[] {
  const names = [hostName, 'Leo', 'Sara', 'Omar', 'Nada', 'Yusuf'];
  return names.slice(0, maximumPlayers).map((name, index) => ({
    id: `player-${index + 1}`,
    name,
    seat: index + 1,
    color: PLAYER_COLORS[index],
    isHost: index === 0,
    isReady: true,
    cardsRemaining: [10, 7, 9, 8, 10, 10][index],
    connection: index === 4 ? 'weak' : index > 1 ? 'good' : 'strong',
    transport: index === 3 ? 'hotspot' : 'wifi',
  }));
}

function createRoomSnapshot(input: CreateRoomInput): RoomSnapshot {
  return {
    code: 'K4P9',
    maxPlayers: input.maxPlayers,
    hostId: 'player-1',
    status: 'lobby',
    transport: input.transport,
    players: demoPlayers(input.hostName, input.maxPlayers),
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
  nearbyRooms: NearbyRoom[];
  backendEnabled: boolean;
  isLoading: boolean;
  errorMessage: string;
}

export const useRoomStore = defineStore('local-room', {
  state: (): RoomState => ({
    currentPlayerId: 'player-1',
    currentPlayerName: 'Maya',
    room: createRoomSnapshot({
      hostName: 'Maya',
      maxPlayers: 6,
      transport: 'auto',
    }),
    roomId: undefined,
    stateVersion: 0,
    gameState: null,
    nearbyRooms: [
      {
        code: 'K4P9',
        name: "Maya's Room",
        hostName: 'Maya',
        transport: 'wifi',
        connection: 'strong',
      },
      {
        code: 'B7T2',
        name: 'Family Night',
        hostName: 'Farah',
        transport: 'hotspot',
        connection: 'good',
      },
      {
        code: 'M3X8',
        name: "Leo's table",
        hostName: 'Leo',
        transport: 'bluetooth',
        connection: 'weak',
      },
    ],
    backendEnabled: false,
    isLoading: false,
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
      this.stateVersion = 0;
      this.errorMessage = '';
    },
    applyBackendSnapshot(snapshot: LiveRoomSnapshot): void {
      this.roomId = snapshot.roomId;
      this.room = snapshot.room;
      this.stateVersion = snapshot.stateVersion;
      this.gameState = snapshot.gameState;
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
          this.currentPlayerId = 'player-1';
          this.room = createRoomSnapshot({
            ...input,
            hostName: this.currentPlayerName,
          });
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
          const code = normalizeRoomCode(roomCode) || 'K4P9';
          const player: RoomPlayer = {
            id: 'player-local',
            name: this.currentPlayerName,
            seat: this.room.players.length + 1,
            color:
              PLAYER_COLORS[this.room.players.length % PLAYER_COLORS.length],
            isHost: false,
            isReady: false,
            cardsRemaining: 10,
            connection: 'strong',
            transport: 'wifi',
          };
          this.currentPlayerId = player.id;
          this.room = {
            ...this.room,
            code,
            players: [...this.room.players, player],
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
    setTransport(transport: TransportKind): void {
      this.room = { ...this.room, transport };
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
    async startGame(initialState: unknown): Promise<boolean> {
      this.beginRequest();
      try {
        const gameState = toSerializable(initialState);
        if (configuredBackend) {
          this.applyBackendSnapshot(
            await configuredBackend.startGame(gameState),
          );
        } else {
          this.room = { ...this.room, status: 'playing' };
          this.gameState = gameState;
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
    async publishGameState(nextState: unknown): Promise<boolean> {
      const gameState = toSerializable(nextState);
      if (!configuredBackend || !this.backendEnabled) {
        this.gameState = gameState;
        this.stateVersion += 1;
        return true;
      }
      try {
        this.applyBackendSnapshot(
          await configuredBackend.updateGameState(this.stateVersion, gameState),
        );
        return true;
      } catch (error) {
        this.captureError(error);
        try {
          this.applyBackendSnapshot(await configuredBackend.refresh());
        } catch {
          // Keep the original concurrency/network error for the UI.
        }
        return false;
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
