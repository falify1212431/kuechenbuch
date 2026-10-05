export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      categories: {
        Row: {
          aisle_order: number
          created_at: string
          default_location_id: string | null
          household_id: string | null
          icon: string | null
          id: string
          name: string
          sort_order: number
          user_id: string
        }
        Insert: {
          aisle_order?: number
          created_at?: string
          default_location_id?: string | null
          household_id?: string | null
          icon?: string | null
          id?: string
          name: string
          sort_order?: number
          user_id?: string
        }
        Update: {
          aisle_order?: number
          created_at?: string
          default_location_id?: string | null
          household_id?: string | null
          icon?: string | null
          id?: string
          name?: string
          sort_order?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_default_location_id_fkey"
            columns: ["default_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          created_at: string
          household_id: string | null
          icon: string | null
          id: string
          name: string
          sort_order: number
          user_id: string
        }
        Insert: {
          created_at?: string
          household_id?: string | null
          icon?: string | null
          id?: string
          name: string
          sort_order?: number
          user_id?: string
        }
        Update: {
          created_at?: string
          household_id?: string | null
          icon?: string | null
          id?: string
          name?: string
          sort_order?: number
          user_id?: string
        }
        Relationships: []
      }
      pantry_items: {
        Row: {
          allergen_warning: string | null
          barcode: string | null
          brand: string | null
          category_id: string | null
          created_at: string
          date: string | null
          date_estimated: boolean
          date_type: string
          household_id: string | null
          id: string
          location_id: string | null
          name: string
          opened_at: string | null
          photo_path: string | null
          quantity: number
          status: string
          status_changed_at: string | null
          unit: string
          user_id: string
        }
        Insert: {
          allergen_warning?: string | null
          barcode?: string | null
          brand?: string | null
          category_id?: string | null
          created_at?: string
          date?: string | null
          date_estimated?: boolean
          date_type?: string
          household_id?: string | null
          id?: string
          location_id?: string | null
          name: string
          opened_at?: string | null
          photo_path?: string | null
          quantity?: number
          status?: string
          status_changed_at?: string | null
          unit?: string
          user_id?: string
        }
        Update: {
          allergen_warning?: string | null
          barcode?: string | null
          brand?: string | null
          category_id?: string | null
          created_at?: string
          date?: string | null
          date_estimated?: boolean
          date_type?: string
          household_id?: string | null
          id?: string
          location_id?: string | null
          name?: string
          opened_at?: string | null
          photo_path?: string | null
          quantity?: number
          status?: string
          status_changed_at?: string | null
          unit?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pantry_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pantry_items_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      shelf_life_rules: {
        Row: {
          category_id: string | null
          created_at: string
          days_closed: number | null
          days_opened: number | null
          household_id: string | null
          id: string
          keyword: string | null
          location_id: string | null
          user_id: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          days_closed?: number | null
          days_opened?: number | null
          household_id?: string | null
          id?: string
          keyword?: string | null
          location_id?: string | null
          user_id?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          days_closed?: number | null
          days_opened?: number | null
          household_id?: string | null
          id?: string
          keyword?: string | null
          location_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shelf_life_rules_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shelf_life_rules_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      shopping_items: {
        Row: {
          category_id: string | null
          checked: boolean
          created_at: string
          household_id: string | null
          id: string
          name: string
          offer_id: string | null
          quantity: number
          source: string
          unit: string
          user_id: string
        }
        Insert: {
          category_id?: string | null
          checked?: boolean
          created_at?: string
          household_id?: string | null
          id?: string
          name: string
          offer_id?: string | null
          quantity?: number
          source?: string
          unit?: string
          user_id?: string
        }
        Update: {
          category_id?: string | null
          checked?: boolean
          created_at?: string
          household_id?: string | null
          id?: string
          name?: string
          offer_id?: string | null
          quantity?: number
          source?: string
          unit?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shopping_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      ensure_defaults: { Args: never; Returns: undefined }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
