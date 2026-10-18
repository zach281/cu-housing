// Generated from supabase/migrations. Regenerate after schema changes:
//   npx supabase gen types typescript --project-id <id> > src/lib/supabase/database.types.ts
// (or --local when running `supabase start`).

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  __InternalSupabase: { PostgrestVersion: "13.0.5" };
  public: {
    Tables: {
      analytics_events: {
        Row: {
          id: number;
          event_name: string;
          user_id: string | null;
          listing_id: string | null;
          properties: Json;
          created_at: string;
        };
        Insert: {
          event_name: string;
          user_id?: string | null;
          listing_id?: string | null;
          properties?: Json;
          created_at?: string;
        };
        Update: {
          event_name?: string;
          user_id?: string | null;
          listing_id?: string | null;
          properties?: Json;
          created_at?: string;
        };
        Relationships: [
          { foreignKeyName: "analytics_events_listing_id_fkey"; columns: ["listing_id"]; isOneToOne: false; referencedRelation: "listings"; referencedColumns: ["id"] },
          { foreignKeyName: "analytics_events_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
      audit_log: {
        Row: {
          id: number;
          actor_id: string | null;
          action: string;
          target_type: string;
          target_id: string;
          details: Json;
          created_at: string;
        };
        Insert: {
          actor_id?: string | null;
          action: string;
          target_type: string;
          target_id: string;
          details?: Json;
          created_at?: string;
        };
        Update: {
          actor_id?: string | null;
          action?: string;
          target_type?: string;
          target_id?: string;
          details?: Json;
          created_at?: string;
        };
        Relationships: [
          { foreignKeyName: "audit_log_actor_id_fkey"; columns: ["actor_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
      conversations: {
        Row: {
          id: string;
          listing_id: string | null;
          student_id: string;
          owner_id: string;
          created_at: string;
          last_message_at: string;
        };
        Insert: {
          id?: string;
          listing_id?: string | null;
          student_id: string;
          owner_id: string;
          created_at?: string;
          last_message_at?: string;
        };
        Update: {
          id?: string;
          listing_id?: string | null;
          student_id?: string;
          owner_id?: string;
          created_at?: string;
          last_message_at?: string;
        };
        Relationships: [
          { foreignKeyName: "conversations_listing_id_fkey"; columns: ["listing_id"]; isOneToOne: false; referencedRelation: "listings"; referencedColumns: ["id"] },
          { foreignKeyName: "conversations_owner_id_fkey"; columns: ["owner_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "conversations_student_id_fkey"; columns: ["student_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
      favorites: {
        Row: {
          user_id: string;
          listing_id: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          listing_id: string;
          created_at?: string;
        };
        Update: {
          user_id?: string;
          listing_id?: string;
          created_at?: string;
        };
        Relationships: [
          { foreignKeyName: "favorites_listing_id_fkey"; columns: ["listing_id"]; isOneToOne: false; referencedRelation: "listings"; referencedColumns: ["id"] },
          { foreignKeyName: "favorites_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
      listing_images: {
        Row: {
          id: string;
          listing_id: string;
          storage_path: string;
          display_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          listing_id: string;
          storage_path: string;
          display_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          listing_id?: string;
          storage_path?: string;
          display_order?: number;
          created_at?: string;
        };
        Relationships: [
          { foreignKeyName: "listing_images_listing_id_fkey"; columns: ["listing_id"]; isOneToOne: false; referencedRelation: "listings"; referencedColumns: ["id"] },
        ];
      };
      listings: {
        Row: {
          id: string;
          owner_id: string;
          title: string | null;
          description: string | null;
          property_type: Database["public"]["Enums"]["property_type"] | null;
          listing_type: Database["public"]["Enums"]["listing_type"] | null;
          monthly_rent: number | null;
          bedrooms: number | null;
          bathrooms: number | null;
          available_date: string | null;
          lease_end_date: string | null;
          address: string | null;
          neighborhood: string | null;
          latitude: number | null;
          longitude: number | null;
          distance_from_campus_mi: number | null;
          approx_latitude: number | null;
          approx_longitude: number | null;
          furnished: boolean;
          parking: boolean;
          pets_allowed: boolean;
          utilities_included: boolean;
          status: Database["public"]["Enums"]["listing_status"];
          published_at: string | null;
          removed_at: string | null;
          removed_by: string | null;
          removal_reason: string | null;
          search_vector: unknown | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          title?: string | null;
          description?: string | null;
          property_type?: Database["public"]["Enums"]["property_type"] | null;
          listing_type?: Database["public"]["Enums"]["listing_type"] | null;
          monthly_rent?: number | null;
          bedrooms?: number | null;
          bathrooms?: number | null;
          available_date?: string | null;
          lease_end_date?: string | null;
          address?: string | null;
          neighborhood?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          furnished?: boolean;
          parking?: boolean;
          pets_allowed?: boolean;
          utilities_included?: boolean;
          status?: Database["public"]["Enums"]["listing_status"];
          published_at?: string | null;
          removed_at?: string | null;
          removed_by?: string | null;
          removal_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          title?: string | null;
          description?: string | null;
          property_type?: Database["public"]["Enums"]["property_type"] | null;
          listing_type?: Database["public"]["Enums"]["listing_type"] | null;
          monthly_rent?: number | null;
          bedrooms?: number | null;
          bathrooms?: number | null;
          available_date?: string | null;
          lease_end_date?: string | null;
          address?: string | null;
          neighborhood?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          furnished?: boolean;
          parking?: boolean;
          pets_allowed?: boolean;
          utilities_included?: boolean;
          status?: Database["public"]["Enums"]["listing_status"];
          published_at?: string | null;
          removed_at?: string | null;
          removed_by?: string | null;
          removal_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          { foreignKeyName: "listings_owner_id_fkey"; columns: ["owner_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "listings_removed_by_fkey"; columns: ["removed_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
      messages: {
        Row: {
          id: string;
          conversation_id: string;
          sender_id: string;
          body: string;
          created_at: string;
          read_at: string | null;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          sender_id: string;
          body: string;
          created_at?: string;
          read_at?: string | null;
        };
        Update: {
          id?: string;
          conversation_id?: string;
          sender_id?: string;
          body?: string;
          created_at?: string;
          read_at?: string | null;
        };
        Relationships: [
          { foreignKeyName: "messages_conversation_id_fkey"; columns: ["conversation_id"]; isOneToOne: false; referencedRelation: "conversations"; referencedColumns: ["id"] },
          { foreignKeyName: "messages_sender_id_fkey"; columns: ["sender_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
      profiles: {
        Row: {
          id: string;
          name: string;
          role: Database["public"]["Enums"]["user_role"];
          profile_photo_path: string | null;
          bio: string | null;
          cu_verified_at: string | null;
          provider_verified_at: string | null;
          admin_verified_at: string | null;
          verification_status: Database["public"]["Enums"]["verification_status"] | null;
          account_status: Database["public"]["Enums"]["account_status"];
          suspended_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          name?: string;
          role?: Database["public"]["Enums"]["user_role"];
          profile_photo_path?: string | null;
          bio?: string | null;
          cu_verified_at?: string | null;
          provider_verified_at?: string | null;
          admin_verified_at?: string | null;
          account_status?: Database["public"]["Enums"]["account_status"];
          suspended_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          role?: Database["public"]["Enums"]["user_role"];
          profile_photo_path?: string | null;
          bio?: string | null;
          cu_verified_at?: string | null;
          provider_verified_at?: string | null;
          admin_verified_at?: string | null;
          account_status?: Database["public"]["Enums"]["account_status"];
          suspended_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
        ];
      };
      reports: {
        Row: {
          id: string;
          reporter_id: string | null;
          listing_id: string | null;
          reported_user_id: string | null;
          reason: Database["public"]["Enums"]["report_reason"];
          description: string | null;
          status: Database["public"]["Enums"]["report_status"];
          resolved_by: string | null;
          resolved_at: string | null;
          resolution_note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          reporter_id?: string | null;
          listing_id?: string | null;
          reported_user_id?: string | null;
          reason: Database["public"]["Enums"]["report_reason"];
          description?: string | null;
          status?: Database["public"]["Enums"]["report_status"];
          resolved_by?: string | null;
          resolved_at?: string | null;
          resolution_note?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          reporter_id?: string | null;
          listing_id?: string | null;
          reported_user_id?: string | null;
          reason?: Database["public"]["Enums"]["report_reason"];
          description?: string | null;
          status?: Database["public"]["Enums"]["report_status"];
          resolved_by?: string | null;
          resolved_at?: string | null;
          resolution_note?: string | null;
          created_at?: string;
        };
        Relationships: [
          { foreignKeyName: "reports_listing_id_fkey"; columns: ["listing_id"]; isOneToOne: false; referencedRelation: "listings"; referencedColumns: ["id"] },
          { foreignKeyName: "reports_reported_user_id_fkey"; columns: ["reported_user_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "reports_reporter_id_fkey"; columns: ["reporter_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "reports_resolved_by_fkey"; columns: ["resolved_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
      roommate_profiles: {
        Row: {
          id: string;
          user_id: string;
          budget_min: number;
          budget_max: number;
          move_in_date: string;
          preferred_bedrooms: number | null;
          smoking: string;
          has_pets: boolean;
          ok_with_pets: boolean;
          study_habits: string;
          social_level: string;
          sleep_schedule: string;
          cleanliness: number;
          extra_preferences: Json;
          bio: string | null;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          budget_min: number;
          budget_max: number;
          move_in_date: string;
          preferred_bedrooms?: number | null;
          smoking?: string;
          has_pets?: boolean;
          ok_with_pets?: boolean;
          study_habits?: string;
          social_level?: string;
          sleep_schedule?: string;
          cleanliness?: number;
          extra_preferences?: Json;
          bio?: string | null;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          budget_min?: number;
          budget_max?: number;
          move_in_date?: string;
          preferred_bedrooms?: number | null;
          smoking?: string;
          has_pets?: boolean;
          ok_with_pets?: boolean;
          study_habits?: string;
          social_level?: string;
          sleep_schedule?: string;
          cleanliness?: number;
          extra_preferences?: Json;
          bio?: string | null;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          { foreignKeyName: "roommate_profiles_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
      student_profiles: {
        Row: {
          user_id: string;
          graduation_year: number | null;
          major: string | null;
          budget_min: number | null;
          budget_max: number | null;
          preferred_move_in: string | null;
          preferred_bedrooms: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          graduation_year?: number | null;
          major?: string | null;
          budget_min?: number | null;
          budget_max?: number | null;
          preferred_move_in?: string | null;
          preferred_bedrooms?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          graduation_year?: number | null;
          major?: string | null;
          budget_min?: number | null;
          budget_max?: number | null;
          preferred_move_in?: string | null;
          preferred_bedrooms?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          { foreignKeyName: "student_profiles_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      is_admin: { Args: never; Returns: boolean };
      ensure_my_profile: { Args: never; Returns: Database["public"]["Tables"]["profiles"]["Row"] | null };
      is_active_user: { Args: never; Returns: boolean };
      is_conversation_participant: { Args: { conv_id: string }; Returns: boolean };
      track_event: { Args: { p_event_name: string; p_listing_id?: string; p_properties?: Json }; Returns: undefined };
      miles_from_campus: { Args: { lat: number; lng: number }; Returns: number };
      is_cu_email: { Args: { email: string }; Returns: boolean };
    };
    Enums: {
      account_status: "active" | "suspended";
      listing_status: "draft" | "active" | "unavailable" | "removed";
      listing_type: "lease" | "room" | "sublease" | "lease_takeover";
      property_type: "apartment" | "house" | "townhouse" | "condo" | "duplex" | "studio" | "other";
      report_reason: "scam" | "inaccurate" | "unavailable" | "duplicate" | "offensive" | "harassment" | "other";
      report_status: "open" | "reviewing" | "resolved" | "dismissed";
      user_role: "student" | "provider" | "admin";
      verification_status: "unverified" | "cu_verified" | "provider_verified" | "admin_verified";
    };
    CompositeTypes: { [_ in never]: never };
  };
};

type PublicSchema = Database["public"];
export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"];
export type TablesInsert<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Update"];
export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T];
