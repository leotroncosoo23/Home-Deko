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
      admin_emails: {
        Row: {
          created_at: string
          email: string
          is_developer: boolean
          note: string | null
        }
        Insert: {
          created_at?: string
          email: string
          is_developer?: boolean
          note?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          is_developer?: boolean
          note?: string | null
        }
        Relationships: []
      }
      banners: {
        Row: {
          background: string
          body: string | null
          button_label: string | null
          button_url: string | null
          created_at: string
          ends_at: string | null
          id: string
          image_mobile_path: string | null
          image_path: string | null
          is_active: boolean
          kind: string
          position: number
          product_image_path: string | null
          starts_at: string | null
          title: string
          updated_at: string
        }
        Insert: {
          background?: string
          body?: string | null
          button_label?: string | null
          button_url?: string | null
          created_at?: string
          ends_at?: string | null
          id?: string
          image_mobile_path?: string | null
          image_path?: string | null
          is_active?: boolean
          kind: string
          position?: number
          product_image_path?: string | null
          starts_at?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          background?: string
          body?: string | null
          button_label?: string | null
          button_url?: string | null
          created_at?: string
          ends_at?: string | null
          id?: string
          image_mobile_path?: string | null
          image_path?: string | null
          is_active?: boolean
          kind?: string
          position?: number
          product_image_path?: string | null
          starts_at?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          image_path: string | null
          is_visible: boolean
          name: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          image_path?: string | null
          is_visible?: boolean
          name: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          image_path?: string | null
          is_visible?: boolean
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      coupon_attempts: {
        Row: {
          created_at: string
          id: number
          key_hash: string
        }
        Insert: {
          created_at?: string
          id?: never
          key_hash: string
        }
        Update: {
          created_at?: string
          id?: never
          key_hash?: string
        }
        Relationships: []
      }
      coupon_redemptions: {
        Row: {
          coupon_id: string
          created_at: string
          customer_email: string
          discount_amount: number
          id: string
          order_id: string
          over_limit: boolean
          released_at: string | null
        }
        Insert: {
          coupon_id: string
          created_at?: string
          customer_email: string
          discount_amount: number
          id?: string
          order_id: string
          over_limit?: boolean
          released_at?: string | null
        }
        Update: {
          coupon_id?: string
          created_at?: string
          customer_email?: string
          discount_amount?: number
          id?: string
          order_id?: string
          over_limit?: boolean
          released_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coupon_redemptions_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "admin_coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_redemptions_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_redemptions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          ends_on: string | null
          id: string
          is_active: boolean
          kind: Database["public"]["Enums"]["coupon_kind"]
          max_uses: number | null
          min_purchase: number | null
          one_per_customer: boolean
          starts_on: string | null
          updated_at: string
          value: number | null
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          ends_on?: string | null
          id?: string
          is_active?: boolean
          kind: Database["public"]["Enums"]["coupon_kind"]
          max_uses?: number | null
          min_purchase?: number | null
          one_per_customer?: boolean
          starts_on?: string | null
          updated_at?: string
          value?: number | null
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          ends_on?: string | null
          id?: string
          is_active?: boolean
          kind?: Database["public"]["Enums"]["coupon_kind"]
          max_uses?: number | null
          min_purchase?: number | null
          one_per_customer?: boolean
          starts_on?: string | null
          updated_at?: string
          value?: number | null
        }
        Relationships: []
      }
      label_queue: {
        Row: {
          added_by: string | null
          created_at: string
          id: string
          quantity: number
          updated_at: string
          variant_id: string
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          id?: string
          quantity: number
          updated_at?: string
          variant_id: string
        }
        Update: {
          added_by?: string | null
          created_at?: string
          id?: string
          quantity?: number
          updated_at?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "label_queue_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: true
            referencedRelation: "admin_variant_stock"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "label_queue_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: true
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "label_queue_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: true
            referencedRelation: "store_variants"
            referencedColumns: ["variant_id"]
          },
        ]
      }
      order_events: {
        Row: {
          actor_id: string | null
          actor_name: string | null
          created_at: string
          from_status: Database["public"]["Enums"]["fulfillment_status"] | null
          id: string
          kind: Database["public"]["Enums"]["order_event_kind"]
          note: string | null
          order_id: string
          to_status: Database["public"]["Enums"]["fulfillment_status"] | null
        }
        Insert: {
          actor_id?: string | null
          actor_name?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["fulfillment_status"] | null
          id?: string
          kind: Database["public"]["Enums"]["order_event_kind"]
          note?: string | null
          order_id: string
          to_status?: Database["public"]["Enums"]["fulfillment_status"] | null
        }
        Update: {
          actor_id?: string | null
          actor_name?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["fulfillment_status"] | null
          id?: string
          kind?: Database["public"]["Enums"]["order_event_kind"]
          note?: string | null
          order_id?: string
          to_status?: Database["public"]["Enums"]["fulfillment_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "order_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          image_path: string | null
          line_total: number
          order_id: string
          product_id: string | null
          product_name: string
          quantity: number
          unit_price: number
          unit_price_before: number | null
          variant_id: string | null
          variant_label: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          image_path?: string | null
          line_total: number
          order_id: string
          product_id?: string | null
          product_name: string
          quantity: number
          unit_price: number
          unit_price_before?: number | null
          variant_id?: string | null
          variant_label?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          image_path?: string | null
          line_total?: number
          order_id?: string
          product_id?: string | null
          product_name?: string
          quantity?: number
          unit_price?: number
          unit_price_before?: number | null
          variant_id?: string | null
          variant_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "admin_label_queue"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "admin_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "admin_variant_stock"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "store_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "admin_variant_stock"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "store_variants"
            referencedColumns: ["variant_id"]
          },
        ]
      }
      orders: {
        Row: {
          access_token_hash: string | null
          billing_number: string | null
          billing_postal_code: string | null
          billing_street: string | null
          cancel_reason: string | null
          cancelled_at: string | null
          carrier: Database["public"]["Enums"]["shipping_carrier"] | null
          carrier_name: string | null
          channel: Database["public"]["Enums"]["order_channel"]
          coupon_code: string | null
          coupon_id: string | null
          created_at: string
          created_by: string | null
          customer_dni: string | null
          customer_email: string
          customer_id: string | null
          customer_name: string
          customer_phone: string
          delivered_at: string | null
          delivery_method: Database["public"]["Enums"]["delivery_method"]
          discount_total: number
          fulfillment_status: Database["public"]["Enums"]["fulfillment_status"]
          id: string
          mp_expires_at: string | null
          mp_payment_id: string | null
          mp_preference_id: string | null
          mp_status: string | null
          mp_status_detail: string | null
          needs_review: boolean
          order_number: number
          paid_at: string | null
          payment_expires_at: string | null
          payment_id: string | null
          payment_intent_id: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          payment_notified_at: string | null
          payment_provider: string
          payment_redirect_url: string | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          payment_status_detail: string | null
          picked_up_at: string | null
          pickup_address: string | null
          pickup_hours: string | null
          preparing_at: string | null
          provider_status: string | null
          ready_at: string | null
          review_reason: string | null
          ship_address: string | null
          ship_apartment: string | null
          ship_city: string | null
          ship_notes: string | null
          ship_postal_code: string | null
          ship_province: string | null
          shipped_at: string | null
          shipping_cost: number
          stock_applied_at: string | null
          stock_issue: boolean
          stock_returned_at: string | null
          subtotal: number
          total: number
          tracking_code: string | null
          tracking_url: string | null
          updated_at: string
        }
        Insert: {
          access_token_hash?: string | null
          billing_number?: string | null
          billing_postal_code?: string | null
          billing_street?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          carrier?: Database["public"]["Enums"]["shipping_carrier"] | null
          carrier_name?: string | null
          channel?: Database["public"]["Enums"]["order_channel"]
          coupon_code?: string | null
          coupon_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_dni?: string | null
          customer_email: string
          customer_id?: string | null
          customer_name: string
          customer_phone: string
          delivered_at?: string | null
          delivery_method: Database["public"]["Enums"]["delivery_method"]
          discount_total?: number
          fulfillment_status?: Database["public"]["Enums"]["fulfillment_status"]
          id?: string
          mp_expires_at?: string | null
          mp_payment_id?: string | null
          mp_preference_id?: string | null
          mp_status?: string | null
          mp_status_detail?: string | null
          needs_review?: boolean
          order_number?: never
          paid_at?: string | null
          payment_expires_at?: string | null
          payment_id?: string | null
          payment_intent_id?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          payment_notified_at?: string | null
          payment_provider?: string
          payment_redirect_url?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          payment_status_detail?: string | null
          picked_up_at?: string | null
          pickup_address?: string | null
          pickup_hours?: string | null
          preparing_at?: string | null
          provider_status?: string | null
          ready_at?: string | null
          review_reason?: string | null
          ship_address?: string | null
          ship_apartment?: string | null
          ship_city?: string | null
          ship_notes?: string | null
          ship_postal_code?: string | null
          ship_province?: string | null
          shipped_at?: string | null
          shipping_cost?: number
          stock_applied_at?: string | null
          stock_issue?: boolean
          stock_returned_at?: string | null
          subtotal: number
          total: number
          tracking_code?: string | null
          tracking_url?: string | null
          updated_at?: string
        }
        Update: {
          access_token_hash?: string | null
          billing_number?: string | null
          billing_postal_code?: string | null
          billing_street?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          carrier?: Database["public"]["Enums"]["shipping_carrier"] | null
          carrier_name?: string | null
          channel?: Database["public"]["Enums"]["order_channel"]
          coupon_code?: string | null
          coupon_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_dni?: string | null
          customer_email?: string
          customer_id?: string | null
          customer_name?: string
          customer_phone?: string
          delivered_at?: string | null
          delivery_method?: Database["public"]["Enums"]["delivery_method"]
          discount_total?: number
          fulfillment_status?: Database["public"]["Enums"]["fulfillment_status"]
          id?: string
          mp_expires_at?: string | null
          mp_payment_id?: string | null
          mp_preference_id?: string | null
          mp_status?: string | null
          mp_status_detail?: string | null
          needs_review?: boolean
          order_number?: never
          paid_at?: string | null
          payment_expires_at?: string | null
          payment_id?: string | null
          payment_intent_id?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          payment_notified_at?: string | null
          payment_provider?: string
          payment_redirect_url?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          payment_status_detail?: string | null
          picked_up_at?: string | null
          pickup_address?: string | null
          pickup_hours?: string | null
          preparing_at?: string | null
          provider_status?: string | null
          ready_at?: string | null
          review_reason?: string | null
          ship_address?: string | null
          ship_apartment?: string | null
          ship_city?: string | null
          ship_notes?: string | null
          ship_postal_code?: string | null
          ship_province?: string | null
          shipped_at?: string | null
          shipping_cost?: number
          stock_applied_at?: string | null
          stock_issue?: boolean
          stock_returned_at?: string | null
          subtotal?: number
          total?: number
          tracking_code?: string | null
          tracking_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "admin_coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
        ]
      }
      product_costs: {
        Row: {
          cost_price: number
          created_at: string
          product_id: string
          updated_at: string
        }
        Insert: {
          cost_price: number
          created_at?: string
          product_id: string
          updated_at?: string
        }
        Update: {
          cost_price?: number
          created_at?: string
          product_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_costs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "admin_label_queue"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_costs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "admin_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_costs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "admin_variant_stock"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_costs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_costs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "store_products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_images: {
        Row: {
          alt_text: string | null
          created_at: string
          id: string
          is_primary: boolean
          option_value_id: string | null
          position: number
          product_id: string
          storage_path: string
          updated_at: string
        }
        Insert: {
          alt_text?: string | null
          created_at?: string
          id?: string
          is_primary?: boolean
          option_value_id?: string | null
          position?: number
          product_id: string
          storage_path: string
          updated_at?: string
        }
        Update: {
          alt_text?: string | null
          created_at?: string
          id?: string
          is_primary?: boolean
          option_value_id?: string | null
          position?: number
          product_id?: string
          storage_path?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_images_option_value_id_fkey"
            columns: ["option_value_id"]
            isOneToOne: false
            referencedRelation: "product_option_values"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "admin_label_queue"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "admin_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "admin_variant_stock"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "store_products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_option_values: {
        Row: {
          color_hex: string | null
          created_at: string
          id: string
          option_id: string
          position: number
          updated_at: string
          value: string
        }
        Insert: {
          color_hex?: string | null
          created_at?: string
          id?: string
          option_id: string
          position?: number
          updated_at?: string
          value: string
        }
        Update: {
          color_hex?: string | null
          created_at?: string
          id?: string
          option_id?: string
          position?: number
          updated_at?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_option_values_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "product_options"
            referencedColumns: ["id"]
          },
        ]
      }
      product_options: {
        Row: {
          created_at: string
          id: string
          name: string
          position: number
          product_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          position?: number
          product_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          position?: number
          product_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_options_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "admin_label_queue"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_options_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "admin_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_options_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "admin_variant_stock"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_options_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_options_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "store_products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          barcode: string
          created_at: string
          id: string
          is_active: boolean
          is_default: boolean
          min_stock: number
          position: number
          price: number | null
          product_id: string
          sku: string | null
          stock: number
          updated_at: string
        }
        Insert: {
          barcode: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          min_stock?: number
          position?: number
          price?: number | null
          product_id: string
          sku?: string | null
          stock?: number
          updated_at?: string
        }
        Update: {
          barcode?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          min_stock?: number
          position?: number
          price?: number | null
          product_id?: string
          sku?: string | null
          stock?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "admin_label_queue"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "admin_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "admin_variant_stock"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "store_products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_view_daily: {
        Row: {
          day: string
          product_id: string
          views: number
        }
        Insert: {
          day: string
          product_id: string
          views?: number
        }
        Update: {
          day?: string
          product_id?: string
          views?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_view_daily_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "admin_label_queue"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_view_daily_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "admin_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_view_daily_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "admin_variant_stock"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_view_daily_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_view_daily_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "store_products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          base_price: number
          category_id: string | null
          created_at: string
          description: string | null
          discount_ends_at: string | null
          discount_starts_at: string | null
          discount_type: Database["public"]["Enums"]["discount_type"] | null
          discount_value: number | null
          id: string
          is_featured: boolean
          name: string
          slug: string
          status: Database["public"]["Enums"]["product_status"]
          updated_at: string
        }
        Insert: {
          base_price?: number
          category_id?: string | null
          created_at?: string
          description?: string | null
          discount_ends_at?: string | null
          discount_starts_at?: string | null
          discount_type?: Database["public"]["Enums"]["discount_type"] | null
          discount_value?: number | null
          id?: string
          is_featured?: boolean
          name: string
          slug: string
          status?: Database["public"]["Enums"]["product_status"]
          updated_at?: string
        }
        Update: {
          base_price?: number
          category_id?: string | null
          created_at?: string
          description?: string | null
          discount_ends_at?: string | null
          discount_starts_at?: string | null
          discount_type?: Database["public"]["Enums"]["discount_type"] | null
          discount_value?: number | null
          id?: string
          is_featured?: boolean
          name?: string
          slug?: string
          status?: Database["public"]["Enums"]["product_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          ship_address: string | null
          ship_apartment: string | null
          ship_city: string | null
          ship_notes: string | null
          ship_postal_code: string | null
          ship_province: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          ship_address?: string | null
          ship_apartment?: string | null
          ship_city?: string | null
          ship_notes?: string | null
          ship_postal_code?: string | null
          ship_province?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          ship_address?: string | null
          ship_apartment?: string | null
          ship_city?: string | null
          ship_notes?: string | null
          ship_postal_code?: string | null
          ship_province?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      stock_movements: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          note: string | null
          order_id: string | null
          quantity: number
          reason: Database["public"]["Enums"]["stock_reason"]
          stock_after: number
          variant_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          order_id?: string | null
          quantity: number
          reason: Database["public"]["Enums"]["stock_reason"]
          stock_after: number
          variant_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          order_id?: string | null
          quantity?: number
          reason?: Database["public"]["Enums"]["stock_reason"]
          stock_after?: number
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "admin_variant_stock"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "stock_movements_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "store_variants"
            referencedColumns: ["variant_id"]
          },
        ]
      }
      store_announcements: {
        Row: {
          created_at: string
          id: string
          position: number
          text: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          position: number
          text: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          position?: number
          text?: string
          updated_at?: string
        }
        Relationships: []
      }
      store_settings: {
        Row: {
          business_name: string
          cash_discount_percent: number
          contact_email: string
          created_at: string
          cuit: string
          dispatch_time: string
          exchange_days: number
          id: string
          instagram: string
          installments_enabled: boolean
          installments_max: number
          is_launched: boolean
          list_surcharge_percent: number
          national_tax_percent: number
          shipping_cost: number
          show_price_without_taxes: boolean
          singleton: boolean
          store_address: string
          store_hours: string
          tiktok: string
          updated_at: string
          whatsapp: string
        }
        Insert: {
          business_name?: string
          cash_discount_percent?: number
          contact_email?: string
          created_at?: string
          cuit?: string
          dispatch_time?: string
          exchange_days?: number
          id?: string
          instagram?: string
          installments_enabled?: boolean
          installments_max?: number
          is_launched?: boolean
          list_surcharge_percent?: number
          national_tax_percent?: number
          shipping_cost?: number
          show_price_without_taxes?: boolean
          singleton?: boolean
          store_address?: string
          store_hours?: string
          tiktok?: string
          updated_at?: string
          whatsapp?: string
        }
        Update: {
          business_name?: string
          cash_discount_percent?: number
          contact_email?: string
          created_at?: string
          cuit?: string
          dispatch_time?: string
          exchange_days?: number
          id?: string
          instagram?: string
          installments_enabled?: boolean
          installments_max?: number
          is_launched?: boolean
          list_surcharge_percent?: number
          national_tax_percent?: number
          shipping_cost?: number
          show_price_without_taxes?: boolean
          singleton?: boolean
          store_address?: string
          store_hours?: string
          tiktok?: string
          updated_at?: string
          whatsapp?: string
        }
        Relationships: []
      }
      variant_costs: {
        Row: {
          cost_price: number
          created_at: string
          updated_at: string
          variant_id: string
        }
        Insert: {
          cost_price: number
          created_at?: string
          updated_at?: string
          variant_id: string
        }
        Update: {
          cost_price?: number
          created_at?: string
          updated_at?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "variant_costs_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: true
            referencedRelation: "admin_variant_stock"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "variant_costs_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: true
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "variant_costs_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: true
            referencedRelation: "store_variants"
            referencedColumns: ["variant_id"]
          },
        ]
      }
      variant_option_values: {
        Row: {
          option_value_id: string
          variant_id: string
        }
        Insert: {
          option_value_id: string
          variant_id: string
        }
        Update: {
          option_value_id?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "variant_option_values_option_value_id_fkey"
            columns: ["option_value_id"]
            isOneToOne: false
            referencedRelation: "product_option_values"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "variant_option_values_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "admin_variant_stock"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "variant_option_values_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "variant_option_values_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "store_variants"
            referencedColumns: ["variant_id"]
          },
        ]
      }
      visit_daily: {
        Row: {
          day: string
          source: string
          visits: number
        }
        Insert: {
          day: string
          source: string
          visits?: number
        }
        Update: {
          day?: string
          source?: string
          visits?: number
        }
        Relationships: []
      }
      withdrawal_attempts: {
        Row: {
          created_at: string
          id: number
          key_hash: string
        }
        Insert: {
          created_at?: string
          id?: never
          key_hash: string
        }
        Update: {
          created_at?: string
          id?: never
          key_hash?: string
        }
        Relationships: []
      }
      withdrawal_requests: {
        Row: {
          admin_note: string | null
          code: string
          created_at: string
          customer_email_sent_at: string | null
          email: string
          full_name: string
          handled_at: string | null
          handled_by: string | null
          handled_by_name: string | null
          id: string
          order_id: string | null
          order_number: number | null
          owners_email_sent_at: string | null
          reason: string | null
          status: string
          updated_at: string
        }
        Insert: {
          admin_note?: string | null
          code: string
          created_at?: string
          customer_email_sent_at?: string | null
          email: string
          full_name: string
          handled_at?: string | null
          handled_by?: string | null
          handled_by_name?: string | null
          id?: string
          order_id?: string | null
          order_number?: number | null
          owners_email_sent_at?: string | null
          reason?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          admin_note?: string | null
          code?: string
          created_at?: string
          customer_email_sent_at?: string | null
          email?: string
          full_name?: string
          handled_at?: string | null
          handled_by?: string | null
          handled_by_name?: string | null
          id?: string
          order_id?: string | null
          order_number?: number | null
          owners_email_sent_at?: string | null
          reason?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "withdrawal_requests_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      admin_coupons: {
        Row: {
          code: string | null
          created_at: string | null
          ends_on: string | null
          ever_used: boolean | null
          id: string | null
          is_active: boolean | null
          kind: Database["public"]["Enums"]["coupon_kind"] | null
          max_uses: number | null
          min_purchase: number | null
          one_per_customer: boolean | null
          over_limit_uses: number | null
          starts_on: string | null
          status: string | null
          total_discount: number | null
          updated_at: string | null
          uses: number | null
          value: number | null
        }
        Relationships: []
      }
      admin_label_queue: {
        Row: {
          barcode: string | null
          image_path: string | null
          position: number | null
          product_id: string | null
          product_name: string | null
          quantity: number | null
          queued_at: string | null
          sku: string | null
          stock: number | null
          variant_id: string | null
          variant_label: string | null
        }
        Relationships: [
          {
            foreignKeyName: "label_queue_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: true
            referencedRelation: "admin_variant_stock"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "label_queue_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: true
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "label_queue_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: true
            referencedRelation: "store_variants"
            referencedColumns: ["variant_id"]
          },
        ]
      }
      admin_products: {
        Row: {
          base_price: number | null
          category_id: string | null
          category_name: string | null
          created_at: string | null
          discount_active: boolean | null
          discount_ends_at: string | null
          discount_starts_at: string | null
          discount_type: Database["public"]["Enums"]["discount_type"] | null
          discount_value: number | null
          final_max_price: number | null
          final_min_price: number | null
          has_history: boolean | null
          has_variants: boolean | null
          id: string | null
          is_featured: boolean | null
          max_price: number | null
          min_price: number | null
          name: string | null
          primary_image_path: string | null
          search_text: string | null
          slug: string | null
          status: Database["public"]["Enums"]["product_status"] | null
          stock_status: string | null
          total_stock: number | null
          updated_at: string | null
          variant_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_stock_movements: {
        Row: {
          author_name: string | null
          barcode: string | null
          created_at: string | null
          created_by: string | null
          id: string | null
          note: string | null
          order_id: string | null
          product_id: string | null
          product_name: string | null
          quantity: number | null
          reason: Database["public"]["Enums"]["stock_reason"] | null
          search_text: string | null
          sku: string | null
          stock_after: number | null
          variant_id: string | null
          variant_label: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "admin_label_queue"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "admin_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "admin_variant_stock"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "store_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "admin_variant_stock"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "stock_movements_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "store_variants"
            referencedColumns: ["variant_id"]
          },
        ]
      }
      admin_variant_stock: {
        Row: {
          barcode: string | null
          category_name: string | null
          image_path: string | null
          is_default: boolean | null
          min_stock: number | null
          position: number | null
          product_id: string | null
          product_name: string | null
          product_status: Database["public"]["Enums"]["product_status"] | null
          product_updated_at: string | null
          search_text: string | null
          sku: string | null
          stock: number | null
          stock_status: string | null
          variant_id: string | null
          variant_label: string | null
        }
        Relationships: []
      }
      store_products: {
        Row: {
          category_id: string | null
          created_at: string | null
          discount_active: boolean | null
          discount_percent_max: number | null
          discount_percent_min: number | null
          few_left: boolean | null
          final_min_price: number | null
          has_price_range: boolean | null
          id: string | null
          in_stock: boolean | null
          is_featured: boolean | null
          min_price: number | null
          name: string | null
          primary_image_alt: string | null
          primary_image_path: string | null
          search_text: string | null
          secondary_image_path: string | null
          single_variant_id: string | null
          slug: string | null
          status: Database["public"]["Enums"]["product_status"] | null
          variant_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      store_variants: {
        Row: {
          final_price: number | null
          is_default: boolean | null
          position: number | null
          price: number | null
          product_id: string | null
          stock: number | null
          variant_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "admin_label_queue"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "admin_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "admin_variant_stock"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "store_products"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      adjust_stock: {
        Args: {
          p_note?: string
          p_order_id?: string
          p_quantity: number
          p_reason: Database["public"]["Enums"]["stock_reason"]
          p_variant_id: string
        }
        Returns: number
      }
      admin_dashboard: {
        Args: {
          p_bucket?: string
          p_from: string
          p_prev_from: string
          p_prev_to: string
          p_to: string
        }
        Returns: Json
      }
      admin_home_attention: {
        Args: never
        Returns: {
          getnet_pending: number
          low_stock: number
          missing_business_name: boolean
          missing_cuit: boolean
          missing_email: boolean
          missing_whatsapp: boolean
          needs_review: number
          out_of_stock: number
          pending_withdrawals: number
          stock_issue: number
          to_prepare: number
        }[]
      }
      admin_order_counts: {
        Args: never
        Returns: {
          all_orders: number
          done: number
          needs_review: number
          preparing: number
          shipped: number
          stock_issue: number
          to_pickup: number
          to_prepare: number
        }[]
      }
      apply_order_payment: {
        Args: {
          p_amount: number
          p_currency: string
          p_mismatch?: boolean
          p_order_id: string
          p_payment_id: string
          p_provider?: string
          p_status: string
          p_status_detail: string
        }
        Returns: {
          result: string
          stock_changed: boolean
        }[]
      }
      apply_order_stock: { Args: { p_order_id: string }; Returns: boolean }
      can_manage_appearance: { Args: never; Returns: boolean }
      cancel_order: {
        Args: { p_order_id: string; p_reason?: string }
        Returns: number
      }
      cash_price: {
        Args: { p_final: number; p_price: number }
        Returns: number
      }
      cash_price_at: {
        Args: { p_final: number; p_pct: number; p_price: number }
        Returns: number
      }
      compute_role: {
        Args: { p_confirmed_at: string; p_email: string }
        Returns: Database["public"]["Enums"]["user_role"]
      }
      count_stock: {
        Args: { p_counted: number; p_note?: string; p_variant_id: string }
        Returns: Json
      }
      coupon_attempt: { Args: { p_key: string }; Returns: boolean }
      coupon_quote: { Args: { p: Json }; Returns: Json }
      create_order: {
        Args: { p: Json }
        Returns: {
          order_id: string
          order_number: number
          total: number
        }[]
      }
      create_withdrawal_request: {
        Args: { p: Json; p_key: string }
        Returns: Json
      }
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
      delete_coupon: { Args: { p_id: string }; Returns: undefined }
      delete_product: { Args: { p_id: string }; Returns: Json }
      forget_order_personal_data: { Args: { p_user: string }; Returns: number }
      format_ars: { Args: { v: number }; Returns: string }
      fulfillment_label: {
        Args: { p: Database["public"]["Enums"]["fulfillment_status"] }
        Returns: string
      }
      generate_ean13: { Args: never; Returns: string }
      is_admin: { Args: never; Returns: boolean }
      is_developer: { Args: never; Returns: boolean }
      link_my_guest_orders: { Args: never; Returns: number }
      log_order_event: {
        Args: {
          p_from?: Database["public"]["Enums"]["fulfillment_status"]
          p_kind: Database["public"]["Enums"]["order_event_kind"]
          p_note?: string
          p_order_id: string
          p_to?: Database["public"]["Enums"]["fulfillment_status"]
        }
        Returns: undefined
      }
      mark_orders_preparing: {
        Args: { p_ids: string[] }
        Returns: {
          ok: boolean
          order_id: string
          order_number: number
          reason: string
        }[]
      }
      move_banner: {
        Args: { p_direction: number; p_id: string }
        Returns: undefined
      }
      redeem_order_coupon: { Args: { p_order_id: string }; Returns: string }
      reorder_categories: { Args: { p_ids: string[] }; Returns: undefined }
      resolve_review: {
        Args: { p_mode: string; p_note?: string; p_order_id: string }
        Returns: {
          approved: boolean
          stock_changed: boolean
        }[]
      }
      resolve_stock_issue: {
        Args: { p_mode: string; p_note?: string; p_order_id: string }
        Returns: boolean
      }
      save_coupon: { Args: { p: Json }; Returns: string }
      save_product: { Args: { p: Json }; Returns: Json }
      save_store_announcements: {
        Args: { p_texts: string[] }
        Returns: undefined
      }
      set_coupon_active: {
        Args: { p_active: boolean; p_id: string }
        Returns: undefined
      }
      set_order_status: {
        Args: {
          p_carrier?: Database["public"]["Enums"]["shipping_carrier"]
          p_carrier_name?: string
          p_order_id: string
          p_to: Database["public"]["Enums"]["fulfillment_status"]
          p_tracking_code?: string
          p_tracking_url?: string
        }
        Returns: Database["public"]["Enums"]["fulfillment_status"]
      }
      set_withdrawal_status: {
        Args: { p_id: string; p_note?: string; p_status: string }
        Returns: undefined
      }
      track_product_view: { Args: { p_product_id: string }; Returns: undefined }
      track_visit: { Args: { p_source: string }; Returns: undefined }
    }
    Enums: {
      coupon_kind: "percent" | "fixed" | "free_shipping"
      delivery_method: "shipping" | "pickup"
      discount_type: "percent" | "fixed"
      fulfillment_status:
        | "awaiting_payment"
        | "paid"
        | "preparing"
        | "shipped"
        | "delivered"
        | "ready_for_pickup"
        | "picked_up"
        | "cancelled"
      order_channel: "web" | "local"
      order_event_kind:
        | "created"
        | "payment_approved"
        | "needs_review"
        | "status"
        | "tracking_updated"
        | "cancelled"
        | "stock_returned"
        | "issue_resolved"
        | "email_sent"
        | "email_failed"
      payment_method:
        | "mercadopago"
        | "debito"
        | "credito"
        | "efectivo"
        | "transferencia"
        | "getnet"
      payment_status: "pending" | "approved" | "rejected" | "cancelled"
      product_status: "draft" | "active" | "archived"
      shipping_carrier: "correo_argentino" | "andreani" | "oca" | "otra"
      stock_reason:
        | "inicial"
        | "ingreso"
        | "venta_web"
        | "venta_local"
        | "ajuste"
        | "rotura"
        | "devolucion"
        | "cancelacion"
      user_role: "admin" | "customer"
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
    Enums: {
      coupon_kind: ["percent", "fixed", "free_shipping"],
      delivery_method: ["shipping", "pickup"],
      discount_type: ["percent", "fixed"],
      fulfillment_status: [
        "awaiting_payment",
        "paid",
        "preparing",
        "shipped",
        "delivered",
        "ready_for_pickup",
        "picked_up",
        "cancelled",
      ],
      order_channel: ["web", "local"],
      order_event_kind: [
        "created",
        "payment_approved",
        "needs_review",
        "status",
        "tracking_updated",
        "cancelled",
        "stock_returned",
        "issue_resolved",
        "email_sent",
        "email_failed",
      ],
      payment_method: [
        "mercadopago",
        "debito",
        "credito",
        "efectivo",
        "transferencia",
        "getnet",
      ],
      payment_status: ["pending", "approved", "rejected", "cancelled"],
      product_status: ["draft", "active", "archived"],
      shipping_carrier: ["correo_argentino", "andreani", "oca", "otra"],
      stock_reason: [
        "inicial",
        "ingreso",
        "venta_web",
        "venta_local",
        "ajuste",
        "rotura",
        "devolucion",
        "cancelacion",
      ],
      user_role: ["admin", "customer"],
    },
  },
} as const
