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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action: string
          created_at: string
          document_id: string
          id: string
          staff_id: string
        }
        Insert: {
          action: string
          created_at?: string
          document_id: string
          id?: string
          staff_id: string
        }
        Update: {
          action?: string
          created_at?: string
          document_id?: string
          id?: string
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_admin_settings: {
        Row: {
          id: string
          is_enabled: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: string
          is_enabled?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: string
          is_enabled?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      ai_audit_logs: {
        Row: {
          admin_id: string
          ai_response: string
          created_at: string
          id: string
          prompt_text: string
          proposed_changes: Json | null
          resolved_at: string | null
          status: string
          version_id: string | null
        }
        Insert: {
          admin_id: string
          ai_response: string
          created_at?: string
          id?: string
          prompt_text: string
          proposed_changes?: Json | null
          resolved_at?: string | null
          status?: string
          version_id?: string | null
        }
        Update: {
          admin_id?: string
          ai_response?: string
          created_at?: string
          id?: string
          prompt_text?: string
          proposed_changes?: Json | null
          resolved_at?: string | null
          status?: string
          version_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_audit_logs_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "ai_change_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_change_versions: {
        Row: {
          affected_areas: string[]
          applied_at: string
          applied_by: string
          change_description: string
          change_type: string
          changes_json: Json
          id: string
          is_active: boolean
          rolled_back_at: string | null
          rolled_back_by: string | null
          version_number: number
        }
        Insert: {
          affected_areas?: string[]
          applied_at?: string
          applied_by: string
          change_description: string
          change_type: string
          changes_json: Json
          id?: string
          is_active?: boolean
          rolled_back_at?: string | null
          rolled_back_by?: string | null
          version_number?: number
        }
        Update: {
          affected_areas?: string[]
          applied_at?: string
          applied_by?: string
          change_description?: string
          change_type?: string
          changes_json?: Json
          id?: string
          is_active?: boolean
          rolled_back_at?: string | null
          rolled_back_by?: string | null
          version_number?: number
        }
        Relationships: []
      }
      announcements: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          message: string
          show_from: string | null
          show_on_guest_pages: boolean | null
          show_until: string | null
          title: string
          type: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          message: string
          show_from?: string | null
          show_on_guest_pages?: boolean | null
          show_until?: string | null
          title: string
          type?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          message?: string
          show_from?: string | null
          show_on_guest_pages?: boolean | null
          show_until?: string | null
          title?: string
          type?: string
        }
        Relationships: []
      }
      automation_logs: {
        Row: {
          action: string
          created_at: string | null
          document_id: string | null
          id: string
          message: string | null
          metadata: Json | null
          status: string
        }
        Insert: {
          action: string
          created_at?: string | null
          document_id?: string | null
          id?: string
          message?: string | null
          metadata?: Json | null
          status?: string
        }
        Update: {
          action?: string
          created_at?: string | null
          document_id?: string | null
          id?: string
          message?: string | null
          metadata?: Json | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_logs_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_statement_entries: {
        Row: {
          amount: number
          created_at: string
          description: string
          entry_date: string
          entry_time: string | null
          entry_type: string
          id: string
          invoice_id: string | null
          is_manual: boolean
          receipt_id: string | null
          reference: string | null
          running_balance: number | null
          statement_id: string
          transaction_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          description: string
          entry_date: string
          entry_time?: string | null
          entry_type?: string
          id?: string
          invoice_id?: string | null
          is_manual?: boolean
          receipt_id?: string | null
          reference?: string | null
          running_balance?: number | null
          statement_id: string
          transaction_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string
          entry_date?: string
          entry_time?: string | null
          entry_type?: string
          id?: string
          invoice_id?: string | null
          is_manual?: boolean
          receipt_id?: string | null
          reference?: string | null
          running_balance?: number | null
          statement_id?: string
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bank_statement_entries_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_statement_entries_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "receipts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_statement_entries_statement_id_fkey"
            columns: ["statement_id"]
            isOneToOne: false
            referencedRelation: "bank_statements"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_statements: {
        Row: {
          account_name: string
          account_number: string | null
          bank_country: string
          bank_logo_url: string | null
          bank_name: string
          closing_balance: number
          created_at: string
          created_by: string | null
          currency: string
          iban: string | null
          id: string
          notes: string | null
          opening_balance: number
          pdf_path: string | null
          period_end: string
          period_start: string
          sort_code: string | null
          statement_date: string
          statement_number: string
          swift_code: string | null
          total_credits: number
          total_debits: number
          updated_at: string
        }
        Insert: {
          account_name?: string
          account_number?: string | null
          bank_country?: string
          bank_logo_url?: string | null
          bank_name?: string
          closing_balance?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          iban?: string | null
          id?: string
          notes?: string | null
          opening_balance?: number
          pdf_path?: string | null
          period_end: string
          period_start: string
          sort_code?: string | null
          statement_date?: string
          statement_number: string
          swift_code?: string | null
          total_credits?: number
          total_debits?: number
          updated_at?: string
        }
        Update: {
          account_name?: string
          account_number?: string | null
          bank_country?: string
          bank_logo_url?: string | null
          bank_name?: string
          closing_balance?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          iban?: string | null
          id?: string
          notes?: string | null
          opening_balance?: number
          pdf_path?: string | null
          period_end?: string
          period_start?: string
          sort_code?: string | null
          statement_date?: string
          statement_number?: string
          swift_code?: string | null
          total_credits?: number
          total_debits?: number
          updated_at?: string
        }
        Relationships: []
      }
      blocked_users: {
        Row: {
          blocked_at: string
          blocked_by: string | null
          id: string
          reason: string | null
          user_id: string
        }
        Insert: {
          blocked_at?: string
          blocked_by?: string | null
          id?: string
          reason?: string | null
          user_id: string
        }
        Update: {
          blocked_at?: string
          blocked_by?: string | null
          id?: string
          reason?: string | null
          user_id?: string
        }
        Relationships: []
      }
      bulk_report_runs: {
        Row: {
          created_at: string
          created_by: string
          error_message: string | null
          id: string
          last_event: string | null
          mapped_count: number
          needs_review_count: number
          processed_reports: number
          status: string
          total_reports: number
          unmatched_count: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          error_message?: string | null
          id?: string
          last_event?: string | null
          mapped_count?: number
          needs_review_count?: number
          processed_reports?: number
          status?: string
          total_reports?: number
          unmatched_count?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          error_message?: string | null
          id?: string
          last_event?: string | null
          mapped_count?: number
          needs_review_count?: number
          processed_reports?: number
          status?: string
          total_reports?: number
          unmatched_count?: number
          updated_at?: string
        }
        Relationships: []
      }
      credit_transactions: {
        Row: {
          amount: number
          balance_after: number
          balance_before: number
          created_at: string
          credit_type: string
          description: string | null
          id: string
          performed_by: string | null
          transaction_type: string
          user_id: string
        }
        Insert: {
          amount: number
          balance_after: number
          balance_before: number
          created_at?: string
          credit_type?: string
          description?: string | null
          id?: string
          performed_by?: string | null
          transaction_type: string
          user_id: string
        }
        Update: {
          amount?: number
          balance_after?: number
          balance_before?: number
          created_at?: string
          credit_type?: string
          description?: string | null
          id?: string
          performed_by?: string | null
          transaction_type?: string
          user_id?: string
        }
        Relationships: []
      }
      credit_validity: {
        Row: {
          created_at: string
          credit_type: string
          credits_amount: number
          expired: boolean
          expires_at: string
          id: string
          package_id: string | null
          remaining_credits: number
          transaction_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          credit_type?: string
          credits_amount: number
          expired?: boolean
          expires_at: string
          id?: string
          package_id?: string | null
          remaining_credits: number
          transaction_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          credit_type?: string
          credits_amount?: number
          expired?: boolean
          expires_at?: string
          id?: string
          package_id?: string | null
          remaining_credits?: number
          transaction_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_validity_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "pricing_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_validity_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "credit_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      crypto_payments: {
        Row: {
          amount_usd: number
          created_at: string
          credits: number
          id: string
          order_id: string | null
          pay_address: string | null
          pay_amount: number | null
          pay_currency: string | null
          payment_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_usd: number
          created_at?: string
          credits: number
          id?: string
          order_id?: string | null
          pay_address?: string | null
          pay_amount?: number | null
          pay_currency?: string | null
          payment_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_usd?: number
          created_at?: string
          credits?: number
          id?: string
          order_id?: string | null
          pay_address?: string | null
          pay_amount?: number | null
          pay_currency?: string | null
          payment_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      deleted_documents_log: {
        Row: {
          ai_percentage: number | null
          ai_report_path: string | null
          completed_at: string | null
          customer_email: string | null
          customer_name: string | null
          deleted_at: string
          deleted_by_type: string
          file_name: string
          file_path: string
          id: string
          magic_link_id: string | null
          original_document_id: string
          remarks: string | null
          scan_type: string
          similarity_percentage: number | null
          similarity_report_path: string | null
          uploaded_at: string | null
          user_id: string | null
        }
        Insert: {
          ai_percentage?: number | null
          ai_report_path?: string | null
          completed_at?: string | null
          customer_email?: string | null
          customer_name?: string | null
          deleted_at?: string
          deleted_by_type?: string
          file_name: string
          file_path: string
          id?: string
          magic_link_id?: string | null
          original_document_id: string
          remarks?: string | null
          scan_type?: string
          similarity_percentage?: number | null
          similarity_report_path?: string | null
          uploaded_at?: string | null
          user_id?: string | null
        }
        Update: {
          ai_percentage?: number | null
          ai_report_path?: string | null
          completed_at?: string | null
          customer_email?: string | null
          customer_name?: string | null
          deleted_at?: string
          deleted_by_type?: string
          file_name?: string
          file_path?: string
          id?: string
          magic_link_id?: string | null
          original_document_id?: string
          remarks?: string | null
          scan_type?: string
          similarity_percentage?: number | null
          similarity_report_path?: string | null
          uploaded_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      document_tag_assignments: {
        Row: {
          created_at: string | null
          document_id: string
          id: string
          tag_id: string
        }
        Insert: {
          created_at?: string | null
          document_id: string
          id?: string
          tag_id: string
        }
        Update: {
          created_at?: string | null
          document_id?: string
          id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_tag_assignments_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_tag_assignments_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "document_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      document_tags: {
        Row: {
          color: string | null
          created_at: string | null
          id: string
          name: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          id?: string
          name: string
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      document_upload_notifications: {
        Row: {
          created_at: string | null
          customer_email: string | null
          customer_name: string | null
          document_id: string
          file_name: string
          id: string
          processed: boolean | null
          scan_type: string | null
        }
        Insert: {
          created_at?: string | null
          customer_email?: string | null
          customer_name?: string | null
          document_id: string
          file_name: string
          id?: string
          processed?: boolean | null
          scan_type?: string | null
        }
        Update: {
          created_at?: string | null
          customer_email?: string | null
          customer_name?: string | null
          document_id?: string
          file_name?: string
          id?: string
          processed?: boolean | null
          scan_type?: string | null
        }
        Relationships: []
      }
      documents: {
        Row: {
          ai_percentage: number | null
          ai_report_path: string | null
          assigned_at: string | null
          assigned_staff_id: string | null
          automation_attempt_count: number | null
          automation_error: string | null
          automation_started_at: string | null
          automation_status: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          completed_at: string | null
          credit_refunded: boolean | null
          deleted_at: string | null
          deleted_by_user: boolean | null
          error_message: string | null
          file_name: string
          file_path: string
          files_cleaned_at: string | null
          id: string
          is_favorite: boolean | null
          magic_link_id: string | null
          needs_review: boolean | null
          normalized_filename: string | null
          pending_reminder_sent_at: string | null
          remarks: string | null
          review_reason: string | null
          scan_type: string
          similarity_percentage: number | null
          similarity_report_path: string | null
          status: Database["public"]["Enums"]["document_status"]
          updated_at: string
          uploaded_at: string
          user_id: string | null
        }
        Insert: {
          ai_percentage?: number | null
          ai_report_path?: string | null
          assigned_at?: string | null
          assigned_staff_id?: string | null
          automation_attempt_count?: number | null
          automation_error?: string | null
          automation_started_at?: string | null
          automation_status?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          completed_at?: string | null
          credit_refunded?: boolean | null
          deleted_at?: string | null
          deleted_by_user?: boolean | null
          error_message?: string | null
          file_name: string
          file_path: string
          files_cleaned_at?: string | null
          id?: string
          is_favorite?: boolean | null
          magic_link_id?: string | null
          needs_review?: boolean | null
          normalized_filename?: string | null
          pending_reminder_sent_at?: string | null
          remarks?: string | null
          review_reason?: string | null
          scan_type?: string
          similarity_percentage?: number | null
          similarity_report_path?: string | null
          status?: Database["public"]["Enums"]["document_status"]
          updated_at?: string
          uploaded_at?: string
          user_id?: string | null
        }
        Update: {
          ai_percentage?: number | null
          ai_report_path?: string | null
          assigned_at?: string | null
          assigned_staff_id?: string | null
          automation_attempt_count?: number | null
          automation_error?: string | null
          automation_started_at?: string | null
          automation_status?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          completed_at?: string | null
          credit_refunded?: boolean | null
          deleted_at?: string | null
          deleted_by_user?: boolean | null
          error_message?: string | null
          file_name?: string
          file_path?: string
          files_cleaned_at?: string | null
          id?: string
          is_favorite?: boolean | null
          magic_link_id?: string | null
          needs_review?: boolean | null
          normalized_filename?: string | null
          pending_reminder_sent_at?: string | null
          remarks?: string | null
          review_reason?: string | null
          scan_type?: string
          similarity_percentage?: number | null
          similarity_report_path?: string | null
          status?: Database["public"]["Enums"]["document_status"]
          updated_at?: string
          uploaded_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_magic_link_id_fkey"
            columns: ["magic_link_id"]
            isOneToOne: false
            referencedRelation: "magic_upload_links"
            referencedColumns: ["id"]
          },
        ]
      }
      dodo_payments: {
        Row: {
          amount_usd: number
          checkout_session_id: string | null
          completed_at: string | null
          created_at: string | null
          credits: number
          customer_email: string | null
          id: string
          metadata: Json | null
          payment_id: string
          receipt_url: string | null
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount_usd: number
          checkout_session_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          credits: number
          customer_email?: string | null
          id?: string
          metadata?: Json | null
          payment_id: string
          receipt_url?: string | null
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount_usd?: number
          checkout_session_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          credits?: number
          customer_email?: string | null
          id?: string
          metadata?: Json | null
          payment_id?: string
          receipt_url?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      email_logs: {
        Row: {
          created_at: string
          cta_text: string | null
          cta_url: string | null
          failed_count: number
          id: string
          message: string
          recipient_count: number
          scheduled_at: string | null
          sent_at: string | null
          sent_by: string | null
          status: string
          subject: string
          success_count: number
          target_audience: string
          title: string
          type: string
        }
        Insert: {
          created_at?: string
          cta_text?: string | null
          cta_url?: string | null
          failed_count?: number
          id?: string
          message: string
          recipient_count?: number
          scheduled_at?: string | null
          sent_at?: string | null
          sent_by?: string | null
          status?: string
          subject: string
          success_count?: number
          target_audience?: string
          title: string
          type?: string
        }
        Update: {
          created_at?: string
          cta_text?: string | null
          cta_url?: string | null
          failed_count?: number
          id?: string
          message?: string
          recipient_count?: number
          scheduled_at?: string | null
          sent_at?: string | null
          sent_by?: string | null
          status?: string
          subject?: string
          success_count?: number
          target_audience?: string
          title?: string
          type?: string
        }
        Relationships: []
      }
      email_send_logs: {
        Row: {
          email_log_id: string | null
          error_message: string | null
          id: string
          recipient_id: string
          sent_at: string | null
          status: string | null
        }
        Insert: {
          email_log_id?: string | null
          error_message?: string | null
          id?: string
          recipient_id: string
          sent_at?: string | null
          status?: string | null
        }
        Update: {
          email_log_id?: string | null
          error_message?: string | null
          id?: string
          recipient_id?: string
          sent_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_send_logs_email_log_id_fkey"
            columns: ["email_log_id"]
            isOneToOne: false
            referencedRelation: "email_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      email_settings: {
        Row: {
          category: string
          description: string | null
          id: string
          is_enabled: boolean
          setting_key: string
          setting_name: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          category?: string
          description?: string | null
          id?: string
          is_enabled?: boolean
          setting_key: string
          setting_name: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          category?: string
          description?: string | null
          id?: string
          is_enabled?: boolean
          setting_key?: string
          setting_name?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      email_warmup_settings: {
        Row: {
          created_at: string
          current_warmup_day: number
          daily_limit: number
          emails_sent_today: number
          id: string
          is_warmup_active: boolean
          last_reset_date: string
          tracking_disabled: boolean
          updated_at: string
          warmup_start_date: string
        }
        Insert: {
          created_at?: string
          current_warmup_day?: number
          daily_limit?: number
          emails_sent_today?: number
          id?: string
          is_warmup_active?: boolean
          last_reset_date?: string
          tracking_disabled?: boolean
          updated_at?: string
          warmup_start_date?: string
        }
        Update: {
          created_at?: string
          current_warmup_day?: number
          daily_limit?: number
          emails_sent_today?: number
          id?: string
          is_warmup_active?: boolean
          last_reset_date?: string
          tracking_disabled?: boolean
          updated_at?: string
          warmup_start_date?: string
        }
        Relationships: []
      }
      extension_auth_tokens: {
        Row: {
          created_at: string | null
          expires_at: string | null
          id: string
          is_active: boolean | null
          last_used_at: string | null
          name: string
          token: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          last_used_at?: string | null
          name?: string
          token: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          last_used_at?: string | null
          name?: string
          token?: string
          user_id?: string
        }
        Relationships: []
      }
      extension_logs: {
        Row: {
          action: string
          created_at: string | null
          document_id: string | null
          error_message: string | null
          id: string
          metadata: Json | null
          status: string | null
          token_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          document_id?: string | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          status?: string | null
          token_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          document_id?: string | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          status?: string | null
          token_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "extension_logs_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extension_logs_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "extension_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      extension_tokens: {
        Row: {
          browser_info: string | null
          created_at: string | null
          expires_at: string | null
          id: string
          is_active: boolean | null
          last_heartbeat_at: string | null
          last_used_at: string | null
          name: string
          token: string
          user_id: string
        }
        Insert: {
          browser_info?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          last_heartbeat_at?: string | null
          last_used_at?: string | null
          name: string
          token: string
          user_id: string
        }
        Update: {
          browser_info?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          last_heartbeat_at?: string | null
          last_used_at?: string | null
          name?: string
          token?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "extension_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_usd: number
          created_at: string
          created_by: string | null
          credits: number
          currency: string | null
          customer_address: string | null
          customer_country: string | null
          customer_email: string | null
          customer_name: string | null
          description: string | null
          due_date: string | null
          id: string
          invoice_number: string
          is_immutable: boolean | null
          notes: string | null
          paid_at: string | null
          payment_id: string | null
          payment_type: string
          pdf_path: string | null
          quantity: number | null
          status: string
          subtotal: number | null
          transaction_id: string | null
          unit_price: number | null
          updated_at: string
          user_id: string
          vat_amount: number | null
          vat_rate: number | null
        }
        Insert: {
          amount_usd: number
          created_at?: string
          created_by?: string | null
          credits: number
          currency?: string | null
          customer_address?: string | null
          customer_country?: string | null
          customer_email?: string | null
          customer_name?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          invoice_number: string
          is_immutable?: boolean | null
          notes?: string | null
          paid_at?: string | null
          payment_id?: string | null
          payment_type: string
          pdf_path?: string | null
          quantity?: number | null
          status?: string
          subtotal?: number | null
          transaction_id?: string | null
          unit_price?: number | null
          updated_at?: string
          user_id: string
          vat_amount?: number | null
          vat_rate?: number | null
        }
        Update: {
          amount_usd?: number
          created_at?: string
          created_by?: string | null
          credits?: number
          currency?: string | null
          customer_address?: string | null
          customer_country?: string | null
          customer_email?: string | null
          customer_name?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          invoice_number?: string
          is_immutable?: boolean | null
          notes?: string | null
          paid_at?: string | null
          payment_id?: string | null
          payment_type?: string
          pdf_path?: string | null
          quantity?: number | null
          status?: string
          subtotal?: number | null
          transaction_id?: string | null
          unit_price?: number | null
          updated_at?: string
          user_id?: string
          vat_amount?: number | null
          vat_rate?: number | null
        }
        Relationships: []
      }
      magic_upload_files: {
        Row: {
          deleted_at: string | null
          deleted_by_user: boolean | null
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          magic_link_id: string
          uploaded_at: string
        }
        Insert: {
          deleted_at?: string | null
          deleted_by_user?: boolean | null
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          magic_link_id: string
          uploaded_at?: string
        }
        Update: {
          deleted_at?: string | null
          deleted_by_user?: boolean | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          magic_link_id?: string
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "magic_upload_files_magic_link_id_fkey"
            columns: ["magic_link_id"]
            isOneToOne: false
            referencedRelation: "magic_upload_links"
            referencedColumns: ["id"]
          },
        ]
      }
      magic_upload_links: {
        Row: {
          created_at: string
          created_by: string | null
          current_uploads: number
          expires_at: string | null
          guest_email: string | null
          guest_name: string | null
          id: string
          max_uploads: number
          status: string
          token: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          current_uploads?: number
          expires_at?: string | null
          guest_email?: string | null
          guest_name?: string | null
          id?: string
          max_uploads?: number
          status?: string
          token: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          current_uploads?: number
          expires_at?: string | null
          guest_email?: string | null
          guest_name?: string | null
          id?: string
          max_uploads?: number
          status?: string
          token?: string
          updated_at?: string
        }
        Relationships: []
      }
      manual_payments: {
        Row: {
          amount_usd: number
          created_at: string
          credits: number
          id: string
          notes: string | null
          payment_method: string
          status: string
          transaction_id: string | null
          user_id: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          amount_usd: number
          created_at?: string
          credits: number
          id?: string
          notes?: string | null
          payment_method: string
          status?: string
          transaction_id?: string | null
          user_id: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          amount_usd?: number
          created_at?: string
          credits?: number
          id?: string
          notes?: string | null
          payment_method?: string
          status?: string
          transaction_id?: string | null
          user_id?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: []
      }
      notification_reads: {
        Row: {
          id: string
          notification_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          id?: string
          notification_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          id?: string
          notification_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_reads_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          message: string
          target_audience: string
          title: string
        }
        Insert: {
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          message: string
          target_audience?: string
          title: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          message?: string
          target_audience?: string
          title?: string
        }
        Relationships: []
      }
      payment_idempotency_keys: {
        Row: {
          created_at: string
          key: string
          provider: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          key: string
          provider?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          key?: string
          provider?: string
          user_id?: string | null
        }
        Relationships: []
      }
      paypal_payments: {
        Row: {
          amount_usd: number
          completed_at: string | null
          created_at: string | null
          credit_type: string | null
          credits: number
          customer_email: string | null
          id: string
          metadata: Json | null
          order_id: string
          payer_email: string | null
          payer_id: string | null
          payment_id: string | null
          receipt_url: string | null
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount_usd: number
          completed_at?: string | null
          created_at?: string | null
          credit_type?: string | null
          credits: number
          customer_email?: string | null
          id?: string
          metadata?: Json | null
          order_id: string
          payer_email?: string | null
          payer_id?: string | null
          payment_id?: string | null
          receipt_url?: string | null
          status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount_usd?: number
          completed_at?: string | null
          created_at?: string | null
          credit_type?: string | null
          credits?: number
          customer_email?: string | null
          id?: string
          metadata?: Json | null
          order_id?: string
          payer_email?: string | null
          payer_id?: string | null
          payment_id?: string | null
          receipt_url?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      paypal_webhook_logs: {
        Row: {
          created_at: string | null
          error_message: string | null
          event_id: string
          event_type: string
          id: string
          payload: Json | null
          processed: boolean | null
          processed_at: string | null
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          event_id: string
          event_type: string
          id?: string
          payload?: Json | null
          processed?: boolean | null
          processed_at?: string | null
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          event_id?: string
          event_type?: string
          id?: string
          payload?: Json | null
          processed?: boolean | null
          processed_at?: string | null
        }
        Relationships: []
      }
      pricing_packages: {
        Row: {
          billing_interval: string | null
          created_at: string
          credit_type: string
          credits: number
          description: string | null
          dodo_product_id: string | null
          features: string[] | null
          id: string
          is_active: boolean
          name: string | null
          package_type: string
          price: number
          stripe_price_id: string | null
          stripe_product_id: string | null
          updated_at: string
          validity_days: number | null
        }
        Insert: {
          billing_interval?: string | null
          created_at?: string
          credit_type?: string
          credits: number
          description?: string | null
          dodo_product_id?: string | null
          features?: string[] | null
          id?: string
          is_active?: boolean
          name?: string | null
          package_type?: string
          price: number
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          updated_at?: string
          validity_days?: number | null
        }
        Update: {
          billing_interval?: string | null
          created_at?: string
          credit_type?: string
          credits?: number
          description?: string | null
          dodo_product_id?: string | null
          features?: string[] | null
          id?: string
          is_active?: boolean
          name?: string | null
          package_type?: string
          price?: number
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          updated_at?: string
          validity_days?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          credit_balance: number
          email: string
          email_unsubscribed: boolean | null
          full_name: string | null
          id: string
          phone: string | null
          referral_code: string | null
          referred_by: string | null
          similarity_credit_balance: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          credit_balance?: number
          email: string
          email_unsubscribed?: boolean | null
          full_name?: string | null
          id: string
          phone?: string | null
          referral_code?: string | null
          referred_by?: string | null
          similarity_credit_balance?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          credit_balance?: number
          email?: string
          email_unsubscribed?: boolean | null
          full_name?: string | null
          id?: string
          phone?: string | null
          referral_code?: string | null
          referred_by?: string | null
          similarity_credit_balance?: number
          updated_at?: string
        }
        Relationships: []
      }
      promo_code_uses: {
        Row: {
          credits_given: number
          id: string
          promo_code_id: string
          used_at: string
          user_id: string
        }
        Insert: {
          credits_given?: number
          id?: string
          promo_code_id: string
          used_at?: string
          user_id: string
        }
        Update: {
          credits_given?: number
          id?: string
          promo_code_id?: string
          used_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "promo_code_uses_promo_code_id_fkey"
            columns: ["promo_code_id"]
            isOneToOne: false
            referencedRelation: "promo_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      promo_codes: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          credits_bonus: number
          current_uses: number
          discount_percentage: number | null
          id: string
          is_active: boolean
          max_uses: number | null
          updated_at: string
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          credits_bonus?: number
          current_uses?: number
          discount_percentage?: number | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          credits_bonus?: number
          current_uses?: number
          discount_percentage?: number | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: []
      }
      push_notification_logs: {
        Row: {
          body: string
          completed_at: string | null
          created_at: string
          error_message: string | null
          event_type: string
          failed_count: number
          id: string
          recipient_count: number
          sent_by: string | null
          status: string
          success_count: number
          target_audience: string
          target_user_id: string | null
          title: string
        }
        Insert: {
          body: string
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          event_type: string
          failed_count?: number
          id?: string
          recipient_count?: number
          sent_by?: string | null
          status?: string
          success_count?: number
          target_audience?: string
          target_user_id?: string | null
          title: string
        }
        Update: {
          body?: string
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          event_type?: string
          failed_count?: number
          id?: string
          recipient_count?: number
          sent_by?: string | null
          status?: string
          success_count?: number
          target_audience?: string
          target_user_id?: string | null
          title?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      receipts: {
        Row: {
          amount_paid: number
          created_at: string
          credits: number
          currency: string | null
          customer_country: string | null
          customer_email: string | null
          customer_name: string | null
          description: string | null
          id: string
          invoice_id: string | null
          payment_id: string | null
          payment_method: string
          pdf_path: string | null
          quantity: number | null
          receipt_date: string
          receipt_number: string
          subtotal: number | null
          transaction_id: string | null
          unit_price: number | null
          updated_at: string
          user_id: string
          vat_amount: number | null
          vat_rate: number | null
        }
        Insert: {
          amount_paid: number
          created_at?: string
          credits: number
          currency?: string | null
          customer_country?: string | null
          customer_email?: string | null
          customer_name?: string | null
          description?: string | null
          id?: string
          invoice_id?: string | null
          payment_id?: string | null
          payment_method: string
          pdf_path?: string | null
          quantity?: number | null
          receipt_date?: string
          receipt_number: string
          subtotal?: number | null
          transaction_id?: string | null
          unit_price?: number | null
          updated_at?: string
          user_id: string
          vat_amount?: number | null
          vat_rate?: number | null
        }
        Update: {
          amount_paid?: number
          created_at?: string
          credits?: number
          currency?: string | null
          customer_country?: string | null
          customer_email?: string | null
          customer_name?: string | null
          description?: string | null
          id?: string
          invoice_id?: string | null
          payment_id?: string | null
          payment_method?: string
          pdf_path?: string | null
          quantity?: number | null
          receipt_date?: string
          receipt_number?: string
          subtotal?: number | null
          transaction_id?: string | null
          unit_price?: number | null
          updated_at?: string
          user_id?: string
          vat_amount?: number | null
          vat_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "receipts_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      referrals: {
        Row: {
          completed_at: string | null
          created_at: string | null
          credits_earned: number | null
          id: string
          referral_code: string
          referred_user_id: string | null
          referrer_id: string
          status: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          credits_earned?: number | null
          id?: string
          referral_code: string
          referred_user_id?: string | null
          referrer_id: string
          status?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          credits_earned?: number | null
          id?: string
          referral_code?: string
          referred_user_id?: string | null
          referrer_id?: string
          status?: string
        }
        Relationships: []
      }
      settings: {
        Row: {
          id: string
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      similarity_queue: {
        Row: {
          id: string
          needs_review: boolean | null
          normalized_filename: string
          original_filename: string
          processed_at: string | null
          queue_status: Database["public"]["Enums"]["similarity_queue_status"]
          report_path: string
          review_reason: string | null
          similarity_percentage: number | null
          uploaded_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          id?: string
          needs_review?: boolean | null
          normalized_filename: string
          original_filename: string
          processed_at?: string | null
          queue_status?: Database["public"]["Enums"]["similarity_queue_status"]
          report_path: string
          review_reason?: string | null
          similarity_percentage?: number | null
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          id?: string
          needs_review?: boolean | null
          normalized_filename?: string
          original_filename?: string
          processed_at?: string | null
          queue_status?: Database["public"]["Enums"]["similarity_queue_status"]
          report_path?: string
          review_reason?: string | null
          similarity_percentage?: number | null
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: []
      }
      site_content: {
        Row: {
          content_key: string
          content_value: string
          description: string | null
          id: string
          section: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          content_key: string
          content_value: string
          description?: string | null
          id?: string
          section?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          content_key?: string
          content_value?: string
          description?: string | null
          id?: string
          section?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      staff_permissions: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_enabled: boolean
          permission_key: string
          permission_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_enabled?: boolean
          permission_key: string
          permission_name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_enabled?: boolean
          permission_key?: string
          permission_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      staff_settings: {
        Row: {
          assigned_scan_types: string[] | null
          created_at: string | null
          id: string
          max_concurrent_files: number
          time_limit_minutes: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          assigned_scan_types?: string[] | null
          created_at?: string | null
          id?: string
          max_concurrent_files?: number
          time_limit_minutes?: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          assigned_scan_types?: string[] | null
          created_at?: string | null
          id?: string
          max_concurrent_files?: number
          time_limit_minutes?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      stripe_payments: {
        Row: {
          amount_usd: number
          completed_at: string | null
          created_at: string
          credits: number
          customer_email: string | null
          id: string
          invoice_url: string | null
          payment_intent_id: string | null
          receipt_url: string | null
          session_id: string
          status: string
          user_id: string
        }
        Insert: {
          amount_usd: number
          completed_at?: string | null
          created_at?: string
          credits: number
          customer_email?: string | null
          id?: string
          invoice_url?: string | null
          payment_intent_id?: string | null
          receipt_url?: string | null
          session_id: string
          status?: string
          user_id: string
        }
        Update: {
          amount_usd?: number
          completed_at?: string | null
          created_at?: string
          credits?: number
          customer_email?: string | null
          id?: string
          invoice_url?: string | null
          payment_intent_id?: string | null
          receipt_url?: string | null
          session_id?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      stripe_webhook_logs: {
        Row: {
          error_message: string | null
          event_id: string
          event_type: string
          id: string
          payload: Json
          processed: boolean
          processed_at: string | null
          received_at: string
        }
        Insert: {
          error_message?: string | null
          event_id: string
          event_type: string
          id?: string
          payload: Json
          processed?: boolean
          processed_at?: string | null
          received_at?: string
        }
        Update: {
          error_message?: string | null
          event_id?: string
          event_type?: string
          id?: string
          payload?: Json
          processed?: boolean
          processed_at?: string | null
          received_at?: string
        }
        Relationships: []
      }
      support_tickets: {
        Row: {
          admin_response: string | null
          created_at: string
          id: string
          message: string
          priority: string
          responded_at: string | null
          responded_by: string | null
          status: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_response?: string | null
          created_at?: string
          id?: string
          message: string
          priority?: string
          responded_at?: string | null
          responded_by?: string | null
          status?: string
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_response?: string | null
          created_at?: string
          id?: string
          message?: string
          priority?: string
          responded_at?: string | null
          responded_by?: string | null
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      transactional_email_logs: {
        Row: {
          created_at: string
          document_id: string | null
          email_type: string
          error_message: string | null
          id: string
          metadata: Json | null
          provider_response: Json | null
          recipient_email: string
          recipient_id: string | null
          recipient_name: string | null
          sent_at: string | null
          status: string
          subject: string
        }
        Insert: {
          created_at?: string
          document_id?: string | null
          email_type: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          provider_response?: Json | null
          recipient_email: string
          recipient_id?: string | null
          recipient_name?: string | null
          sent_at?: string | null
          status?: string
          subject: string
        }
        Update: {
          created_at?: string
          document_id?: string | null
          email_type?: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          provider_response?: Json | null
          recipient_email?: string
          recipient_id?: string | null
          recipient_name?: string | null
          sent_at?: string | null
          status?: string
          subject?: string
        }
        Relationships: []
      }
      turnitin_slots: {
        Row: {
          created_at: string | null
          current_usage: number | null
          id: string
          is_active: boolean | null
          last_reset_at: string | null
          max_files_per_day: number | null
          notes: string | null
          slot_name: string
          slot_number: number
          slot_url: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          current_usage?: number | null
          id?: string
          is_active?: boolean | null
          last_reset_at?: string | null
          max_files_per_day?: number | null
          notes?: string | null
          slot_name: string
          slot_number: number
          slot_url: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          current_usage?: number | null
          id?: string
          is_active?: boolean | null
          last_reset_at?: string | null
          max_files_per_day?: number | null
          notes?: string | null
          slot_name?: string
          slot_number?: number
          slot_url?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      unmatched_reports: {
        Row: {
          ai_percentage: number | null
          file_name: string
          file_path: string
          id: string
          matched_document_id: string | null
          normalized_filename: string
          report_type: string | null
          resolved: boolean | null
          resolved_at: string | null
          resolved_by: string | null
          similarity_percentage: number | null
          suggested_documents: Json | null
          uploaded_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          ai_percentage?: number | null
          file_name: string
          file_path: string
          id?: string
          matched_document_id?: string | null
          normalized_filename: string
          report_type?: string | null
          resolved?: boolean | null
          resolved_at?: string | null
          resolved_by?: string | null
          similarity_percentage?: number | null
          suggested_documents?: Json | null
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          ai_percentage?: number | null
          file_name?: string
          file_path?: string
          id?: string
          matched_document_id?: string | null
          normalized_filename?: string
          report_type?: string | null
          resolved?: boolean | null
          resolved_at?: string | null
          resolved_by?: string | null
          similarity_percentage?: number | null
          suggested_documents?: Json | null
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "unmatched_reports_matched_document_id_fkey"
            columns: ["matched_document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      usdt_audit_log: {
        Row: {
          action: string
          admin_id: string
          created_at: string
          details: Json | null
          id: string
          payment_id: string | null
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string
          details?: Json | null
          id?: string
          payment_id?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string
          details?: Json | null
          id?: string
          payment_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "usdt_audit_log_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "usdt_trc20_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      usdt_payment_rate_limits: {
        Row: {
          created_at: string
          id: string
          ip_address: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          ip_address?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          ip_address?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      usdt_trc20_payments: {
        Row: {
          admin_notes: string | null
          admin_verified_at: string | null
          admin_verified_by: string | null
          confirmed_at: string | null
          created_at: string
          credits_added: number | null
          credits_to_add: number
          expected_usdt_amount: number
          expires_at: string
          id: string
          ip_address: string | null
          order_id: string
          received_usdt_amount: number | null
          refund_amount: number | null
          refund_tx_hash: string | null
          refund_wallet_address: string | null
          refunded_at: string | null
          refunded_by: string | null
          status: string
          tx_confirmations: number | null
          tx_hash: string | null
          updated_at: string
          user_id: string
          wallet_address: string
          wallet_index: number
        }
        Insert: {
          admin_notes?: string | null
          admin_verified_at?: string | null
          admin_verified_by?: string | null
          confirmed_at?: string | null
          created_at?: string
          credits_added?: number | null
          credits_to_add: number
          expected_usdt_amount: number
          expires_at: string
          id?: string
          ip_address?: string | null
          order_id: string
          received_usdt_amount?: number | null
          refund_amount?: number | null
          refund_tx_hash?: string | null
          refund_wallet_address?: string | null
          refunded_at?: string | null
          refunded_by?: string | null
          status?: string
          tx_confirmations?: number | null
          tx_hash?: string | null
          updated_at?: string
          user_id: string
          wallet_address: string
          wallet_index: number
        }
        Update: {
          admin_notes?: string | null
          admin_verified_at?: string | null
          admin_verified_by?: string | null
          confirmed_at?: string | null
          created_at?: string
          credits_added?: number | null
          credits_to_add?: number
          expected_usdt_amount?: number
          expires_at?: string
          id?: string
          ip_address?: string | null
          order_id?: string
          received_usdt_amount?: number | null
          refund_amount?: number | null
          refund_tx_hash?: string | null
          refund_wallet_address?: string | null
          refunded_at?: string | null
          refunded_by?: string | null
          status?: string
          tx_confirmations?: number | null
          tx_hash?: string | null
          updated_at?: string
          user_id?: string
          wallet_address?: string
          wallet_index?: number
        }
        Relationships: []
      }
      usdt_used_tx_hashes: {
        Row: {
          payment_id: string
          tx_hash: string
          used_at: string
        }
        Insert: {
          payment_id: string
          tx_hash: string
          used_at?: string
        }
        Update: {
          payment_id?: string
          tx_hash?: string
          used_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "usdt_used_tx_hashes_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "usdt_trc20_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      usdt_wallet_counter: {
        Row: {
          current_index: number
          id: string
          updated_at: string
        }
        Insert: {
          current_index?: number
          id?: string
          updated_at?: string
        }
        Update: {
          current_index?: number
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_notification_preferences: {
        Row: {
          created_at: string
          document_upload_enabled: boolean
          id: string
          promotional_enabled: boolean
          system_enabled: boolean
          updated_at: string
          updates_enabled: boolean
          user_id: string
        }
        Insert: {
          created_at?: string
          document_upload_enabled?: boolean
          id?: string
          promotional_enabled?: boolean
          system_enabled?: boolean
          updated_at?: string
          updates_enabled?: boolean
          user_id: string
        }
        Update: {
          created_at?: string
          document_upload_enabled?: boolean
          id?: string
          promotional_enabled?: boolean
          system_enabled?: boolean
          updated_at?: string
          updates_enabled?: boolean
          user_id?: string
        }
        Relationships: []
      }
      user_notifications: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          message: string
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          message: string
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          message?: string
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      viva_payments: {
        Row: {
          amount_cents: number
          amount_usd: number
          completed_at: string | null
          created_at: string
          credit_type: string | null
          credits: number
          customer_email: string | null
          id: string
          merchant_trns: string | null
          order_code: string
          source_code: string | null
          status: string
          transaction_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_cents: number
          amount_usd: number
          completed_at?: string | null
          created_at?: string
          credit_type?: string | null
          credits: number
          customer_email?: string | null
          id?: string
          merchant_trns?: string | null
          order_code: string
          source_code?: string | null
          status?: string
          transaction_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_cents?: number
          amount_usd?: number
          completed_at?: string | null
          created_at?: string
          credit_type?: string | null
          credits?: number
          customer_email?: string | null
          id?: string
          merchant_trns?: string | null
          order_code?: string
          source_code?: string | null
          status?: string
          transaction_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      viva_webhook_logs: {
        Row: {
          created_at: string
          error_message: string | null
          event_id: string
          event_type: string | null
          event_type_id: number | null
          id: string
          order_code: string | null
          payload: Json | null
          processed: boolean | null
          processed_at: string | null
          transaction_id: string | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          event_id: string
          event_type?: string | null
          event_type_id?: number | null
          id?: string
          order_code?: string | null
          payload?: Json | null
          processed?: boolean | null
          processed_at?: string | null
          transaction_id?: string | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          event_id?: string
          event_type?: string | null
          event_type_id?: number | null
          id?: string
          order_code?: string | null
          payload?: Json | null
          processed?: boolean | null
          processed_at?: string | null
          transaction_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_extension_token: { Args: never; Returns: string }
      generate_transaction_id: { Args: never; Returns: string }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_promo_uses: { Args: { promo_id: string }; Returns: undefined }
      normalize_filename: { Args: { filename: string }; Returns: string }
    }
    Enums: {
      app_role: "admin" | "staff" | "customer"
      document_status: "pending" | "in_progress" | "completed" | "cancelled"
      similarity_queue_status: "queued" | "processing" | "completed" | "failed"
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
      app_role: ["admin", "staff", "customer"],
      document_status: ["pending", "in_progress", "completed", "cancelled"],
      similarity_queue_status: ["queued", "processing", "completed", "failed"],
    },
  },
} as const
