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
      ai_usage: {
        Row: {
          count: number
          day: string
          user_id: string
        }
        Insert: {
          count?: number
          day: string
          user_id?: string
        }
        Update: {
          count?: number
          day?: string
          user_id?: string
        }
        Relationships: []
      }
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
      preferences: {
        Row: {
          allergies: string[]
          appliances: string[]
          budget_week: number | null
          cuisines: string[]
          diet: string
          diet_notes: string
          dislikes: string[]
          goals: string[]
          household_id: string | null
          max_minutes_weekday: number
          max_minutes_weekend: number
          servings: number
          staples: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          allergies?: string[]
          appliances?: string[]
          budget_week?: number | null
          cuisines?: string[]
          diet?: string
          diet_notes?: string
          dislikes?: string[]
          goals?: string[]
          household_id?: string | null
          max_minutes_weekday?: number
          max_minutes_weekend?: number
          servings?: number
          staples?: string[]
          updated_at?: string
          user_id?: string
        }
        Update: {
          allergies?: string[]
          appliances?: string[]
          budget_week?: number | null
          cuisines?: string[]
          diet?: string
          diet_notes?: string
          dislikes?: string[]
          goals?: string[]
          household_id?: string | null
          max_minutes_weekday?: number
          max_minutes_weekend?: number
          servings?: number
          staples?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          allergens: string[] | null
          barcode: string
          brand: string | null
          created_at: string
          default_category_id: string | null
          household_id: string | null
          id: string
          image_url: string | null
          ingredients_text: string | null
          name: string
          nutriments: Json | null
          quantity: number | null
          source: string
          traces: string[] | null
          unit: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          allergens?: string[] | null
          barcode: string
          brand?: string | null
          created_at?: string
          default_category_id?: string | null
          household_id?: string | null
          id?: string
          image_url?: string | null
          ingredients_text?: string | null
          name: string
          nutriments?: Json | null
          quantity?: number | null
          source: string
          traces?: string[] | null
          unit?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          allergens?: string[] | null
          barcode?: string
          brand?: string | null
          created_at?: string
          default_category_id?: string | null
          household_id?: string | null
          id?: string
          image_url?: string | null
          ingredients_text?: string | null
          name?: string
          nutriments?: Json | null
          quantity?: number | null
          source?: string
          traces?: string[] | null
          unit?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_default_category_id_fkey"
            columns: ["default_category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      recipes: {
        Row: {
          cooked_count: number
          created_at: string
          difficulty: string
          favorite: boolean
          household_id: string | null
          id: string
          ingredients: Json
          last_cooked_at: string | null
          meal_prep: Json | null
          minutes: number
          rating: number | null
          servings: number
          source: string
          steps: Json
          suggested_at: string | null
          suggestion_rank: number | null
          summary: string | null
          title: string
          user_id: string
        }
        Insert: {
          cooked_count?: number
          created_at?: string
          difficulty: string
          favorite?: boolean
          household_id?: string | null
          id?: string
          ingredients: Json
          last_cooked_at?: string | null
          meal_prep?: Json | null
          minutes: number
          rating?: number | null
          servings: number
          source?: string
          steps: Json
          suggested_at?: string | null
          suggestion_rank?: number | null
          summary?: string | null
          title: string
          user_id?: string
        }
        Update: {
          cooked_count?: number
          created_at?: string
          difficulty?: string
          favorite?: boolean
          household_id?: string | null
          id?: string
          ingredients?: Json
          last_cooked_at?: string | null
          meal_prep?: Json | null
          minutes?: number
          rating?: number | null
          servings?: number
          source?: string
          steps?: Json
          suggested_at?: string | null
          suggestion_rank?: number | null
          summary?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
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
      consume_ai_quota: { Args: { day_limit: number }; Returns: boolean }
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
