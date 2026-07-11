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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      bons_livraison: {
        Row: {
          client_id: string | null
          commande_id: string | null
          created_at: string
          created_by: string | null
          discount_rate: number
          id: string
          number: string | null
          storage_path: string | null
          total_ttc: number | null
        }
        Insert: {
          client_id?: string | null
          commande_id?: string | null
          created_at?: string
          created_by?: string | null
          discount_rate?: number
          id?: string
          number?: string | null
          storage_path?: string | null
          total_ttc?: number | null
        }
        Update: {
          client_id?: string | null
          commande_id?: string | null
          created_at?: string
          created_by?: string | null
          discount_rate?: number
          id?: string
          number?: string | null
          storage_path?: string | null
          total_ttc?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bons_livraison_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bons_livraison_commande_id_fkey"
            columns: ["commande_id"]
            isOneToOne: false
            referencedRelation: "commandes"
            referencedColumns: ["id"]
          },
        ]
      }
      client_dtf_files: {
        Row: {
          advances: Json | null
          client_id: string
          created_at: string
          id: string
          other_rows: Json | null
          rows: Json | null
          storage_path: string | null
          updated_at: string
        }
        Insert: {
          advances?: Json | null
          client_id: string
          created_at?: string
          id?: string
          other_rows?: Json | null
          rows?: Json | null
          storage_path?: string | null
          updated_at?: string
        }
        Update: {
          advances?: Json | null
          client_id?: string
          created_at?: string
          id?: string
          other_rows?: Json | null
          rows?: Json | null
          storage_path?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_dtf_files_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_files: {
        Row: {
          client_id: string
          created_at: string
          file_name: string
          id: string
          mime_type: string | null
          size_bytes: number | null
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          file_name: string
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          file_name?: string
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_files_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          brand_name: string | null
          city: string | null
          client_type: Database["public"]["Enums"]["client_type"]
          company_name: string | null
          contact_origin: Database["public"]["Enums"]["contact_origin"] | null
          contact_origin_other: string | null
          created_at: string
          created_by: string | null
          email: string | null
          full_name: string
          governorate: string | null
          id: string
          notes: string | null
          phone: string | null
          phone2: string | null
          postal_code: string | null
          tax_id: string | null
        }
        Insert: {
          address?: string | null
          brand_name?: string | null
          city?: string | null
          client_type?: Database["public"]["Enums"]["client_type"]
          company_name?: string | null
          contact_origin?: Database["public"]["Enums"]["contact_origin"] | null
          contact_origin_other?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          full_name: string
          governorate?: string | null
          id?: string
          notes?: string | null
          phone?: string | null
          phone2?: string | null
          postal_code?: string | null
          tax_id?: string | null
        }
        Update: {
          address?: string | null
          brand_name?: string | null
          city?: string | null
          client_type?: Database["public"]["Enums"]["client_type"]
          company_name?: string | null
          contact_origin?: Database["public"]["Enums"]["contact_origin"] | null
          contact_origin_other?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          full_name?: string
          governorate?: string | null
          id?: string
          notes?: string | null
          phone?: string | null
          phone2?: string | null
          postal_code?: string | null
          tax_id?: string | null
        }
        Relationships: []
      }
      commande_files: {
        Row: {
          commande_id: string
          commande_item_id: string | null
          created_at: string
          file_name: string
          id: string
          mime_type: string | null
          size_bytes: number | null
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          commande_id: string
          commande_item_id?: string | null
          created_at?: string
          file_name: string
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          commande_id?: string
          commande_item_id?: string | null
          created_at?: string
          file_name?: string
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commande_files_commande_id_fkey"
            columns: ["commande_id"]
            isOneToOne: false
            referencedRelation: "commandes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commande_files_commande_item_id_fkey"
            columns: ["commande_item_id"]
            isOneToOne: false
            referencedRelation: "commande_items"
            referencedColumns: ["id"]
          },
        ]
      }
      commande_items: {
        Row: {
          color: string | null
          commande_id: string
          created_at: string
          designation: string | null
          dimension: string | null
          id: string
          order_type_id: string | null
          position: number
          quantity: number
          total_ht: number | null
          total_metrage: number | null
          total_ttc: number | null
          tva_amount: number | null
          tva_rate: number | null
          unit_price: number | null
        }
        Insert: {
          color?: string | null
          commande_id: string
          created_at?: string
          designation?: string | null
          dimension?: string | null
          id?: string
          order_type_id?: string | null
          position?: number
          quantity?: number
          total_ht?: number | null
          total_metrage?: number | null
          total_ttc?: number | null
          tva_amount?: number | null
          tva_rate?: number | null
          unit_price?: number | null
        }
        Update: {
          color?: string | null
          commande_id?: string
          created_at?: string
          designation?: string | null
          dimension?: string | null
          id?: string
          order_type_id?: string | null
          position?: number
          quantity?: number
          total_ht?: number | null
          total_metrage?: number | null
          total_ttc?: number | null
          tva_amount?: number | null
          tva_rate?: number | null
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "commande_items_commande_id_fkey"
            columns: ["commande_id"]
            isOneToOne: false
            referencedRelation: "commandes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commande_items_order_type_id_fkey"
            columns: ["order_type_id"]
            isOneToOne: false
            referencedRelation: "order_types"
            referencedColumns: ["id"]
          },
        ]
      }
      commandes: {
        Row: {
          avance: number | null
          client_id: string
          color: string | null
          comment: string | null
          created_at: string
          created_by: string | null
          deadline: string | null
          description: string | null
          discount_rate: number | null
          height_cm: number | null
          id: string
          number: string | null
          order_type_id: string | null
          overdue_notified_at: string | null
          paid: boolean | null
          priority: string | null
          quantity: number | null
          size_label: string | null
          status: Database["public"]["Enums"]["commande_status"]
          total_price: number | null
          tva_amount: number | null
          tva_rate: number | null
          unit_price: number | null
          updated_at: string
          width_cm: number | null
        }
        Insert: {
          avance?: number | null
          client_id: string
          color?: string | null
          comment?: string | null
          created_at?: string
          created_by?: string | null
          deadline?: string | null
          description?: string | null
          discount_rate?: number | null
          height_cm?: number | null
          id?: string
          number?: string | null
          order_type_id?: string | null
          overdue_notified_at?: string | null
          paid?: boolean | null
          priority?: string | null
          quantity?: number | null
          size_label?: string | null
          status?: Database["public"]["Enums"]["commande_status"]
          total_price?: number | null
          tva_amount?: number | null
          tva_rate?: number | null
          unit_price?: number | null
          updated_at?: string
          width_cm?: number | null
        }
        Update: {
          avance?: number | null
          client_id?: string
          color?: string | null
          comment?: string | null
          created_at?: string
          created_by?: string | null
          deadline?: string | null
          description?: string | null
          discount_rate?: number | null
          height_cm?: number | null
          id?: string
          number?: string | null
          order_type_id?: string | null
          overdue_notified_at?: string | null
          paid?: boolean | null
          priority?: string | null
          quantity?: number | null
          size_label?: string | null
          status?: Database["public"]["Enums"]["commande_status"]
          total_price?: number | null
          tva_amount?: number | null
          tva_rate?: number | null
          unit_price?: number | null
          updated_at?: string
          width_cm?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "commandes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commandes_order_type_id_fkey"
            columns: ["order_type_id"]
            isOneToOne: false
            referencedRelation: "order_types"
            referencedColumns: ["id"]
          },
        ]
      }
      devis: {
        Row: {
          client_id: string | null
          commande_id: string | null
          comment: string | null
          created_at: string
          created_by: string | null
          discount_rate: number | null
          id: string
          items: Json | null
          number: string | null
          storage_path: string | null
          total_ht: number | null
          total_ttc: number | null
          tva_rate: number | null
        }
        Insert: {
          client_id?: string | null
          commande_id?: string | null
          comment?: string | null
          created_at?: string
          created_by?: string | null
          discount_rate?: number | null
          id?: string
          items?: Json | null
          number?: string | null
          storage_path?: string | null
          total_ht?: number | null
          total_ttc?: number | null
          tva_rate?: number | null
        }
        Update: {
          client_id?: string | null
          commande_id?: string | null
          comment?: string | null
          created_at?: string
          created_by?: string | null
          discount_rate?: number | null
          id?: string
          items?: Json | null
          number?: string | null
          storage_path?: string | null
          total_ht?: number | null
          total_ttc?: number | null
          tva_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "devis_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devis_commande_id_fkey"
            columns: ["commande_id"]
            isOneToOne: false
            referencedRelation: "commandes"
            referencedColumns: ["id"]
          },
        ]
      }
      factures: {
        Row: {
          client_id: string | null
          commande_id: string | null
          created_at: string
          created_by: string | null
          discount_rate: number | null
          id: string
          number: string | null
          paid: boolean | null
          storage_path: string | null
          total_ht: number | null
          total_ttc: number | null
          tva_rate: number | null
        }
        Insert: {
          client_id?: string | null
          commande_id?: string | null
          created_at?: string
          created_by?: string | null
          discount_rate?: number | null
          id?: string
          number?: string | null
          paid?: boolean | null
          storage_path?: string | null
          total_ht?: number | null
          total_ttc?: number | null
          tva_rate?: number | null
        }
        Update: {
          client_id?: string | null
          commande_id?: string | null
          created_at?: string
          created_by?: string | null
          discount_rate?: number | null
          id?: string
          number?: string | null
          paid?: boolean | null
          storage_path?: string | null
          total_ht?: number | null
          total_ttc?: number | null
          tva_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "factures_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "factures_commande_id_fkey"
            columns: ["commande_id"]
            isOneToOne: false
            referencedRelation: "commandes"
            referencedColumns: ["id"]
          },
        ]
      }
      incoming_funds: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          department: Database["public"]["Enums"]["app_role"] | null
          id: string
          label: string | null
          received_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          department?: Database["public"]["Enums"]["app_role"] | null
          id?: string
          label?: string | null
          received_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          department?: Database["public"]["Enums"]["app_role"] | null
          id?: string
          label?: string | null
          received_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link: string | null
          read: boolean
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read?: boolean
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read?: boolean
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      order_types: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
        }
        Relationships: []
      }
      reminders: {
        Row: {
          commande_id: string
          created_at: string
          created_by: string | null
          id: string
          message: string | null
          target_role: Database["public"]["Enums"]["app_role"] | null
        }
        Insert: {
          commande_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          message?: string | null
          target_role?: Database["public"]["Enums"]["app_role"] | null
        }
        Update: {
          commande_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          message?: string | null
          target_role?: Database["public"]["Enums"]["app_role"] | null
        }
        Relationships: [
          {
            foreignKeyName: "reminders_commande_id_fkey"
            columns: ["commande_id"]
            isOneToOne: false
            referencedRelation: "commandes"
            referencedColumns: ["id"]
          },
        ]
      }
      status_history: {
        Row: {
          commande_id: string
          created_at: string
          created_by: string | null
          from_status: Database["public"]["Enums"]["commande_status"] | null
          id: string
          to_status: Database["public"]["Enums"]["commande_status"]
        }
        Insert: {
          commande_id: string
          created_at?: string
          created_by?: string | null
          from_status?: Database["public"]["Enums"]["commande_status"] | null
          id?: string
          to_status: Database["public"]["Enums"]["commande_status"]
        }
        Update: {
          commande_id?: string
          created_at?: string
          created_by?: string | null
          from_status?: Database["public"]["Enums"]["commande_status"] | null
          id?: string
          to_status?: Database["public"]["Enums"]["commande_status"]
        }
        Relationships: [
          {
            foreignKeyName: "status_history_commande_id_fkey"
            columns: ["commande_id"]
            isOneToOne: false
            referencedRelation: "commandes"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          assigned_role: Database["public"]["Enums"]["app_role"]
          attachment_name: string | null
          attachment_path: string | null
          created_at: string
          created_by: string | null
          created_by_role: Database["public"]["Enums"]["app_role"] | null
          description: string | null
          id: string
          name: string
          notify_roles: Database["public"]["Enums"]["app_role"][] | null
          status: string
          updated_at: string
        }
        Insert: {
          assigned_role: Database["public"]["Enums"]["app_role"]
          attachment_name?: string | null
          attachment_path?: string | null
          created_at?: string
          created_by?: string | null
          created_by_role?: Database["public"]["Enums"]["app_role"] | null
          description?: string | null
          id?: string
          name: string
          notify_roles?: Database["public"]["Enums"]["app_role"][] | null
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_role?: Database["public"]["Enums"]["app_role"]
          attachment_name?: string | null
          attachment_path?: string | null
          created_at?: string
          created_by?: string | null
          created_by_role?: Database["public"]["Enums"]["app_role"] | null
          description?: string | null
          id?: string
          name?: string
          notify_roles?: Database["public"]["Enums"]["app_role"][] | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_connections: {
        Row: {
          connected_at: string
          id: string
          last_seen_at: string
          user_id: string
        }
        Insert: {
          connected_at?: string
          id?: string
          last_seen_at?: string
          user_id: string
        }
        Update: {
          connected_at?: string
          id?: string
          last_seen_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_create_user: {
        Args: {
          _full_name?: string
          _password: string
          _role: Database["public"]["Enums"]["app_role"]
          _username: string
        }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      record_observed_presence: {
        Args: { _online_at: string; _user_id: string }
        Returns: undefined
      }
      update_user_credentials: {
        Args: {
          new_password: string
          new_username: string
          target_user_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role:
        | "super_admin"
        | "admin"
        | "marketing"
        | "design"
        | "production"
        | "livraison"
        | "dtf"
      client_type: "particulier" | "entreprise"
      commande_status:
        | "non_traite"
        | "en_conception"
        | "en_production"
        | "impression"
        | "prete"
        | "a_livrer"
        | "ramasse_livreur"
        | "livre_societe"
        | "livre"
      contact_origin:
        | "facebook"
        | "instagram"
        | "whatsapp"
        | "site_web"
        | "telephone"
        | "sur_lieu"
        | "autre"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "super_admin",
        "admin",
        "marketing",
        "design",
        "production",
        "livraison",
        "dtf",
      ],
      client_type: ["particulier", "entreprise"],
      commande_status: [
        "non_traite",
        "en_conception",
        "en_production",
        "impression",
        "prete",
        "a_livrer",
        "ramasse_livreur",
        "livre_societe",
        "livre",
      ],
      contact_origin: [
        "facebook",
        "instagram",
        "whatsapp",
        "site_web",
        "telephone",
        "sur_lieu",
        "autre",
      ],
    },
  },
} as const
