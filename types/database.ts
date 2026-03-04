/**
 * Типы базы данных Supabase.
 * Для полной генерации из схемы выполните (нужен Supabase CLI):
 *   npx supabase gen types typescript --project-id <ref> > types/database.ts
 * или с локальным Supabase:
 *   npm run supabase:types
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          phone: string | null
          role: string
          avatar_url: string | null
          organization_id: string | null
          vehicle_type: string | null
          vehicle_brand: string | null
          vehicle_model: string | null
          vehicle_number: string | null
          license_number: string | null
          created_at: string
          updated_at: string
        }
        Insert: { [key: string]: unknown }
        Update: { [key: string]: unknown }
      }
      orders: {
        Row: {
          id: string
          order_number: number | null
          customer_id: string
          client_id: string | null
          executor_user_id: string | null
          status: string
          visibility: string
          pickup_address: string
          delivery_address: string
          final_price: number
          is_paid: boolean | null
          created_at: string
          completed_at: string | null
          [key: string]: unknown
        }
        Insert: { [key: string]: unknown }
        Update: { [key: string]: unknown }
      }
      balances: {
        Row: {
          id: string
          user_id: string
          amount: number
          currency: string
          updated_at: string
        }
        Insert: { [key: string]: unknown }
        Update: { [key: string]: unknown }
      }
      transactions: {
        Row: {
          id: string
          user_id: string
          order_id: string | null
          amount: number
          type: string
          description: string
          created_at: string
        }
        Insert: { [key: string]: unknown }
        Update: { [key: string]: unknown }
      }
      regions: {
        Row: {
          id: string
          name: string
          base_price: number
          is_active: boolean
          created_at: string
        }
        Insert: { [key: string]: unknown }
        Update: { [key: string]: unknown }
      }
      [key: string]: {
        Row: Record<string, unknown>
        Insert: Record<string, unknown>
        Update: Record<string, unknown>
      }
    }
    Views: Record<string, never>
    Functions: {
      get_organization_finances: {
        Args: {
          organization_user_id: string
          start_date?: string | null
          end_date?: string | null
        }
        Returns: {
          driver_id: string
          driver_full_name: string | null
          completed_orders_count: number
          total_earnings: number
          balance: number
        }[]
      }
      [key: string]: {
        Args: Record<string, unknown>
        Returns: unknown
      }
    }
    Enums: Record<string, string>
  }
}
