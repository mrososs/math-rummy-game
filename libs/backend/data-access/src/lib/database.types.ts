export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string;
          avatar_color: string;
          games_played: number;
          games_won: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name: string;
          avatar_color?: string;
          games_played?: number;
          games_won?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
        Relationships: [];
      };
      matches: {
        Row: {
          id: string;
          host_user_id: string;
          room_code: string;
          status: Database['public']['Enums']['match_status'];
          transport: Database['public']['Enums']['local_transport'];
          player_count: number;
          winner_user_id: string | null;
          started_at: string;
          ended_at: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          host_user_id: string;
          room_code: string;
          status?: Database['public']['Enums']['match_status'];
          transport: Database['public']['Enums']['local_transport'];
          player_count: number;
          winner_user_id?: string | null;
          started_at?: string;
          ended_at?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['matches']['Insert']>;
        Relationships: [];
      };
      match_players: {
        Row: {
          id: string;
          match_id: string;
          user_id: string | null;
          display_name: string;
          seat: number;
          is_host: boolean;
          final_phase: number;
          score: number;
          placement: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          match_id: string;
          user_id?: string | null;
          display_name: string;
          seat: number;
          is_host?: boolean;
          final_phase?: number;
          score?: number;
          placement?: number | null;
          created_at?: string;
        };
        Update: Partial<
          Database['public']['Tables']['match_players']['Insert']
        >;
        Relationships: [];
      };
      match_rounds: {
        Row: {
          id: string;
          match_id: string;
          round_number: number;
          winner_player_id: string | null;
          summary: Json;
          completed_at: string;
        };
        Insert: {
          id?: string;
          match_id: string;
          round_number: number;
          winner_player_id?: string | null;
          summary?: Json;
          completed_at?: string;
        };
        Update: Partial<Database['public']['Tables']['match_rounds']['Insert']>;
        Relationships: [];
      };
      match_saves: {
        Row: {
          match_id: string;
          host_user_id: string;
          state_version: number;
          encrypted_state: string;
          updated_at: string;
        };
        Insert: {
          match_id: string;
          host_user_id: string;
          state_version?: number;
          encrypted_state: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['match_saves']['Insert']>;
        Relationships: [];
      };
      game_rooms: {
        Row: {
          id: string;
          code: string;
          host_user_id: string;
          status: Database['public']['Enums']['game_room_status'];
          transport: string;
          max_players: number;
          state_version: number;
          game_state: Json | null;
          started_at: string | null;
          completed_at: string | null;
          expires_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          host_user_id: string;
          status?: Database['public']['Enums']['game_room_status'];
          transport: string;
          max_players: number;
          state_version?: number;
          game_state?: Json | null;
          started_at?: string | null;
          completed_at?: string | null;
          expires_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['game_rooms']['Insert']>;
        Relationships: [];
      };
      game_room_players: {
        Row: {
          room_id: string;
          user_id: string;
          display_name: string;
          seat: number;
          avatar_color: string;
          is_ready: boolean;
          joined_at: string;
          last_seen_at: string;
        };
        Insert: {
          room_id: string;
          user_id: string;
          display_name: string;
          seat: number;
          avatar_color: string;
          is_ready?: boolean;
          joined_at?: string;
          last_seen_at?: string;
        };
        Update: Partial<
          Database['public']['Tables']['game_room_players']['Insert']
        >;
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: {
      create_game_room: {
        Args: {
          display_name: string;
          maximum_players?: number;
          requested_transport?: string;
        };
        Returns: Json;
      };
      join_game_room: {
        Args: { room_code: string; display_name: string };
        Returns: Json;
      };
      get_game_room: {
        Args: { target_room_id: string };
        Returns: Json;
      };
      set_game_room_ready: {
        Args: { target_room_id: string; ready: boolean };
        Returns: Json;
      };
      start_game_room: {
        Args: { target_room_id: string; initial_state: Json };
        Returns: Json;
      };
      update_game_room_state: {
        Args: {
          target_room_id: string;
          expected_version: number;
          next_state: Json;
        };
        Returns: Json;
      };
      leave_game_room: {
        Args: { target_room_id: string };
        Returns: undefined;
      };
      record_completed_match: {
        Args: {
          completed_room_code: string;
          requested_transport: string;
          winning_user_id: string | null;
          match_started_at: string;
          match_metadata: Json;
          player_summaries: Json;
        };
        Returns: string;
      };
    };
    Enums: {
      match_status: 'in_progress' | 'completed' | 'abandoned';
      local_transport: 'wifi' | 'hotspot' | 'bluetooth';
      game_room_status: 'lobby' | 'playing' | 'completed' | 'closed';
    };
    CompositeTypes: Record<never, never>;
  };
}
