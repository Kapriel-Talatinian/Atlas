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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      activation_emails: {
        Row: {
          clicked_at: string | null
          email_type: string
          id: string
          opened_at: string | null
          sent_at: string | null
          specialty: string | null
          user_id: string
        }
        Insert: {
          clicked_at?: string | null
          email_type: string
          id?: string
          opened_at?: string | null
          sent_at?: string | null
          specialty?: string | null
          user_id: string
        }
        Update: {
          clicked_at?: string | null
          email_type?: string
          id?: string
          opened_at?: string | null
          sent_at?: string | null
          specialty?: string | null
          user_id?: string
        }
        Relationships: []
      }
      adjudications: {
        Row: {
          adjudicator_id: string
          confidence: number
          created_at: string
          final_value: Json
          id: string
          item_id: string
          justification: string
          method: string
          original_annotation_ids: string[]
        }
        Insert: {
          adjudicator_id: string
          confidence?: number
          created_at?: string
          final_value?: Json
          id?: string
          item_id: string
          justification?: string
          method?: string
          original_annotation_ids?: string[]
        }
        Update: {
          adjudicator_id?: string
          confidence?: number
          created_at?: string
          final_value?: Json
          id?: string
          item_id?: string
          justification?: string
          method?: string
          original_annotation_ids?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "adjudications_adjudicator_id_fkey"
            columns: ["adjudicator_id"]
            isOneToOne: false
            referencedRelation: "annotator_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adjudications_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "annotation_items"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_feedback: {
        Row: {
          ai_output: Json
          created_at: string
          expert_id: string | null
          function_name: string
          human_correction: string | null
          human_rating: number | null
          id: string
          input_context: Json
          is_positive: boolean | null
          job_offer_id: string | null
          user_id: string | null
        }
        Insert: {
          ai_output: Json
          created_at?: string
          expert_id?: string | null
          function_name: string
          human_correction?: string | null
          human_rating?: number | null
          id?: string
          input_context: Json
          is_positive?: boolean | null
          job_offer_id?: string | null
          user_id?: string | null
        }
        Update: {
          ai_output?: Json
          created_at?: string
          expert_id?: string | null
          function_name?: string
          human_correction?: string | null
          human_rating?: number | null
          id?: string
          input_context?: Json
          is_positive?: boolean | null
          job_offer_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_feedback_expert_id_fkey"
            columns: ["expert_id"]
            isOneToOne: false
            referencedRelation: "expert_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_feedback_expert_id_fkey"
            columns: ["expert_id"]
            isOneToOne: false
            referencedRelation: "expert_profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_feedback_job_offer_id_fkey"
            columns: ["job_offer_id"]
            isOneToOne: false
            referencedRelation: "job_offers"
            referencedColumns: ["id"]
          },
        ]
      }
      alpha_history: {
        Row: {
          batch_size: number
          computed_at: string | null
          dimension_alphas: Json
          id: string
          mean_alpha: number
        }
        Insert: {
          batch_size: number
          computed_at?: string | null
          dimension_alphas: Json
          id?: string
          mean_alpha: number
        }
        Update: {
          batch_size?: number
          computed_at?: string | null
          dimension_alphas?: Json
          id?: string
          mean_alpha?: number
        }
        Relationships: []
      }
      alpha_reports: {
        Row: {
          computed_at: string | null
          dimension_alphas: Json
          flag_human_review: boolean | null
          flag_reasons: Json | null
          id: string
          overall_alpha: number
          task_id: string
        }
        Insert: {
          computed_at?: string | null
          dimension_alphas: Json
          flag_human_review?: boolean | null
          flag_reasons?: Json | null
          id?: string
          overall_alpha: number
          task_id: string
        }
        Update: {
          computed_at?: string | null
          dimension_alphas?: Json
          flag_human_review?: boolean | null
          flag_reasons?: Json | null
          id?: string
          overall_alpha?: number
          task_id?: string
        }
        Relationships: []
      }
      ambassador_profiles: {
        Row: {
          created_at: string
          current_tier: string
          expert_id: string | null
          id: string
          impact_countries: string[]
          leaderboard_rank: number | null
          pending_cash: number
          tier_bonus_pct: number
          total_assessment_completed: number
          total_cash_earned: number
          total_certified: number
          total_invited: number
          total_on_mission: number
          total_points_earned: number
          total_profile_completed: number
          total_registered: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_tier?: string
          expert_id?: string | null
          id?: string
          impact_countries?: string[]
          leaderboard_rank?: number | null
          pending_cash?: number
          tier_bonus_pct?: number
          total_assessment_completed?: number
          total_cash_earned?: number
          total_certified?: number
          total_invited?: number
          total_on_mission?: number
          total_points_earned?: number
          total_profile_completed?: number
          total_registered?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_tier?: string
          expert_id?: string | null
          id?: string
          impact_countries?: string[]
          leaderboard_rank?: number | null
          pending_cash?: number
          tier_bonus_pct?: number
          total_assessment_completed?: number
          total_cash_earned?: number
          total_certified?: number
          total_invited?: number
          total_on_mission?: number
          total_points_earned?: number
          total_profile_completed?: number
          total_registered?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ambassador_profiles_expert_id_fkey"
            columns: ["expert_id"]
            isOneToOne: false
            referencedRelation: "expert_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ambassador_profiles_expert_id_fkey"
            columns: ["expert_id"]
            isOneToOne: false
            referencedRelation: "expert_profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      annotation_alerts: {
        Row: {
          action_taken: string | null
          annotator_id: string | null
          created_at: string
          id: string
          message: string
          project_id: string
          resolved: boolean
          resolved_at: string | null
          resolved_by: string | null
          rule_name: string
          severity: string
        }
        Insert: {
          action_taken?: string | null
          annotator_id?: string | null
          created_at?: string
          id?: string
          message: string
          project_id: string
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          rule_name: string
          severity?: string
        }
        Update: {
          action_taken?: string | null
          annotator_id?: string | null
          created_at?: string
          id?: string
          message?: string
          project_id?: string
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          rule_name?: string
          severity?: string
        }
        Relationships: [
          {
            foreignKeyName: "annotation_alerts_annotator_id_fkey"
            columns: ["annotator_id"]
            isOneToOne: false
            referencedRelation: "annotator_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "annotation_alerts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "annotation_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      annotation_batches: {
        Row: {
          completed_items: number
          created_at: string
          id: string
          name: string
          project_id: string
          status: string
          total_items: number
          updated_at: string
        }
        Insert: {
          completed_items?: number
          created_at?: string
          id?: string
          name?: string
          project_id: string
          status?: string
          total_items?: number
          updated_at?: string
        }
        Update: {
          completed_items?: number
          created_at?: string
          id?: string
          name?: string
          project_id?: string
          status?: string
          total_items?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "annotation_batches_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "annotation_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      annotation_drafts: {
        Row: {
          annotator_id: string
          draft_data: Json
          id: string
          task_id: string
          updated_at: string | null
        }
        Insert: {
          annotator_id: string
          draft_data?: Json
          id?: string
          task_id: string
          updated_at?: string | null
        }
        Update: {
          annotator_id?: string
          draft_data?: Json
          id?: string
          task_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      annotation_exports: {
        Row: {
          adjudicated: number
          auto_annotated: number
          delivery_report: Json
          exported_at: string
          exported_by: string | null
          file_url: string | null
          format: string
          human_annotated: number
          id: string
          project_id: string
          quality_report: Json
          total_items: number
        }
        Insert: {
          adjudicated?: number
          auto_annotated?: number
          delivery_report?: Json
          exported_at?: string
          exported_by?: string | null
          file_url?: string | null
          format?: string
          human_annotated?: number
          id?: string
          project_id: string
          quality_report?: Json
          total_items?: number
        }
        Update: {
          adjudicated?: number
          auto_annotated?: number
          delivery_report?: Json
          exported_at?: string
          exported_by?: string | null
          file_url?: string | null
          format?: string
          human_annotated?: number
          id?: string
          project_id?: string
          quality_report?: Json
          total_items?: number
        }
        Relationships: [
          {
            foreignKeyName: "annotation_exports_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "annotation_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      annotation_guidelines: {
        Row: {
          content: Json
          counter_examples: Json
          created_at: string
          domain: Database["public"]["Enums"]["annotation_domain"]
          edge_cases: Json
          examples: Json
          id: string
          is_active: boolean
          title: string
          updated_at: string
          version: string
        }
        Insert: {
          content?: Json
          counter_examples?: Json
          created_at?: string
          domain: Database["public"]["Enums"]["annotation_domain"]
          edge_cases?: Json
          examples?: Json
          id?: string
          is_active?: boolean
          title: string
          updated_at?: string
          version?: string
        }
        Update: {
          content?: Json
          counter_examples?: Json
          created_at?: string
          domain?: Database["public"]["Enums"]["annotation_domain"]
          edge_cases?: Json
          examples?: Json
          id?: string
          is_active?: boolean
          title?: string
          updated_at?: string
          version?: string
        }
        Relationships: []
      }
      annotation_items: {
        Row: {
          auto_annotation: Json | null
          batch_id: string | null
          completed_at: string | null
          complexity_level: number
          content: Json
          created_at: string
          final_annotation_id: string | null
          gold_annotation: Json | null
          id: string
          ingested_at: string
          is_calibration: boolean
          is_gold_standard: boolean
          processing_time: number | null
          project_id: string
          status: Database["public"]["Enums"]["annotation_item_status"]
          updated_at: string
        }
        Insert: {
          auto_annotation?: Json | null
          batch_id?: string | null
          completed_at?: string | null
          complexity_level?: number
          content?: Json
          created_at?: string
          final_annotation_id?: string | null
          gold_annotation?: Json | null
          id?: string
          ingested_at?: string
          is_calibration?: boolean
          is_gold_standard?: boolean
          processing_time?: number | null
          project_id: string
          status?: Database["public"]["Enums"]["annotation_item_status"]
          updated_at?: string
        }
        Update: {
          auto_annotation?: Json | null
          batch_id?: string | null
          completed_at?: string | null
          complexity_level?: number
          content?: Json
          created_at?: string
          final_annotation_id?: string | null
          gold_annotation?: Json | null
          id?: string
          ingested_at?: string
          is_calibration?: boolean
          is_gold_standard?: boolean
          processing_time?: number | null
          project_id?: string
          status?: Database["public"]["Enums"]["annotation_item_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "annotation_items_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "annotation_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "annotation_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "annotation_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      annotation_payments: {
        Row: {
          annotator_id: string
          approved_at: string | null
          approved_by: string | null
          base_amount: number
          bonus_amount: number | null
          created_at: string | null
          feedback_id: string | null
          final_amount: number | null
          id: string
          paid_at: string | null
          penalty_amount: number | null
          rejection_reason: string | null
          status: string | null
          task_id: string
          time_spent_seconds: number | null
        }
        Insert: {
          annotator_id: string
          approved_at?: string | null
          approved_by?: string | null
          base_amount?: number
          bonus_amount?: number | null
          created_at?: string | null
          feedback_id?: string | null
          final_amount?: number | null
          id?: string
          paid_at?: string | null
          penalty_amount?: number | null
          rejection_reason?: string | null
          status?: string | null
          task_id: string
          time_spent_seconds?: number | null
        }
        Update: {
          annotator_id?: string
          approved_at?: string | null
          approved_by?: string | null
          base_amount?: number
          bonus_amount?: number | null
          created_at?: string | null
          feedback_id?: string | null
          final_amount?: number | null
          id?: string
          paid_at?: string | null
          penalty_amount?: number | null
          rejection_reason?: string | null
          status?: string | null
          task_id?: string
          time_spent_seconds?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "annotation_payments_annotator_id_fkey"
            columns: ["annotator_id"]
            isOneToOne: false
            referencedRelation: "annotator_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "annotation_payments_feedback_id_fkey"
            columns: ["feedback_id"]
            isOneToOne: false
            referencedRelation: "rlhf_feedback"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "annotation_payments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "annotation_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      annotation_projects: {
        Row: {
          annotation_schema: Json | null
          automation_config: Json
          client_id: string | null
          completed_tasks: number | null
          complexity_level: number
          created_at: string
          description: string
          domain: string
          estimated_cost: number
          guidelines: Json
          id: string
          languages: string[]
          llm_mode: string | null
          name: string
          pricing_model: Json
          priority_level: string
          quality_config: Json
          sla_tier: string | null
          status: Database["public"]["Enums"]["annotation_project_status"]
          target_completion_date: string | null
          taxonomy: Json | null
          total_items: number
          type: Database["public"]["Enums"]["annotation_type"]
          updated_at: string
          workflow: Json
        }
        Insert: {
          annotation_schema?: Json | null
          automation_config?: Json
          client_id?: string | null
          completed_tasks?: number | null
          complexity_level?: number
          created_at?: string
          description?: string
          domain?: string
          estimated_cost?: number
          guidelines?: Json
          id?: string
          languages?: string[]
          llm_mode?: string | null
          name: string
          pricing_model?: Json
          priority_level?: string
          quality_config?: Json
          sla_tier?: string | null
          status?: Database["public"]["Enums"]["annotation_project_status"]
          target_completion_date?: string | null
          taxonomy?: Json | null
          total_items?: number
          type?: Database["public"]["Enums"]["annotation_type"]
          updated_at?: string
          workflow?: Json
        }
        Update: {
          annotation_schema?: Json | null
          automation_config?: Json
          client_id?: string | null
          completed_tasks?: number | null
          complexity_level?: number
          created_at?: string
          description?: string
          domain?: string
          estimated_cost?: number
          guidelines?: Json
          id?: string
          languages?: string[]
          llm_mode?: string | null
          name?: string
          pricing_model?: Json
          priority_level?: string
          quality_config?: Json
          sla_tier?: string | null
          status?: Database["public"]["Enums"]["annotation_project_status"]
          target_completion_date?: string | null
          taxonomy?: Json | null
          total_items?: number
          type?: Database["public"]["Enums"]["annotation_type"]
          updated_at?: string
          workflow?: Json
        }
        Relationships: [
          {
            foreignKeyName: "annotation_projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      annotation_quality_reports: {
        Row: {
          computed_at: string
          drifted: boolean
          id: string
          interpretation: string | null
          metrics: Json
          project_id: string
          recommendations: string[]
          report_type: string
          sample_size: number
        }
        Insert: {
          computed_at?: string
          drifted?: boolean
          id?: string
          interpretation?: string | null
          metrics?: Json
          project_id: string
          recommendations?: string[]
          report_type?: string
          sample_size?: number
        }
        Update: {
          computed_at?: string
          drifted?: boolean
          id?: string
          interpretation?: string | null
          metrics?: Json
          project_id?: string
          recommendations?: string[]
          report_type?: string
          sample_size?: number
        }
        Relationships: [
          {
            foreignKeyName: "annotation_quality_reports_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "annotation_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      annotation_tasks: {
        Row: {
          ai_triage_notes: string | null
          assigned_annotator_id: string | null
          assigned_at: string | null
          completed_at: string | null
          complexity_level: string
          created_at: string | null
          deadline: string | null
          domain: string
          id: string
          language: string | null
          pii_scanned: boolean | null
          source_id: string
          source_type: string
          status: string | null
          task_config: Json | null
          task_content: Json
          updated_at: string | null
        }
        Insert: {
          ai_triage_notes?: string | null
          assigned_annotator_id?: string | null
          assigned_at?: string | null
          completed_at?: string | null
          complexity_level: string
          created_at?: string | null
          deadline?: string | null
          domain: string
          id?: string
          language?: string | null
          pii_scanned?: boolean | null
          source_id: string
          source_type: string
          status?: string | null
          task_config?: Json | null
          task_content: Json
          updated_at?: string | null
        }
        Update: {
          ai_triage_notes?: string | null
          assigned_annotator_id?: string | null
          assigned_at?: string | null
          completed_at?: string | null
          complexity_level?: string
          created_at?: string | null
          deadline?: string | null
          domain?: string
          id?: string
          language?: string | null
          pii_scanned?: boolean | null
          source_id?: string
          source_type?: string
          status?: string | null
          task_config?: Json | null
          task_content?: Json
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "annotation_tasks_assigned_annotator_id_fkey"
            columns: ["assigned_annotator_id"]
            isOneToOne: false
            referencedRelation: "annotator_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      annotation_test_items: {
        Row: {
          content: Json
          created_at: string
          created_by: string | null
          difficulty: string
          domain: Database["public"]["Enums"]["annotation_domain"]
          gold_annotation: Json
          id: string
          is_active: boolean
          item_type: string
          pass_rate: number | null
          scoring_rubric: Json
          tags: string[]
          updated_at: string
        }
        Insert: {
          content?: Json
          created_at?: string
          created_by?: string | null
          difficulty: string
          domain: Database["public"]["Enums"]["annotation_domain"]
          gold_annotation?: Json
          id?: string
          is_active?: boolean
          item_type: string
          pass_rate?: number | null
          scoring_rubric?: Json
          tags?: string[]
          updated_at?: string
        }
        Update: {
          content?: Json
          created_at?: string
          created_by?: string | null
          difficulty?: string
          domain?: Database["public"]["Enums"]["annotation_domain"]
          gold_annotation?: Json
          id?: string
          is_active?: boolean
          item_type?: string
          pass_rate?: number | null
          scoring_rubric?: Json
          tags?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      annotation_warnings: {
        Row: {
          acknowledged_at: string | null
          annotator_id: string
          created_at: string | null
          details: string | null
          id: string
          severity: number
          task_id: string | null
          warning_type: string
        }
        Insert: {
          acknowledged_at?: string | null
          annotator_id: string
          created_at?: string | null
          details?: string | null
          id?: string
          severity?: number
          task_id?: string | null
          warning_type: string
        }
        Update: {
          acknowledged_at?: string | null
          annotator_id?: string
          created_at?: string | null
          details?: string | null
          id?: string
          severity?: number
          task_id?: string | null
          warning_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "annotation_warnings_annotator_id_fkey"
            columns: ["annotator_id"]
            isOneToOne: false
            referencedRelation: "annotator_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "annotation_warnings_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "annotation_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      annotations: {
        Row: {
          agreement_with_others: number | null
          agrees_with_gold: boolean | null
          annotator_id: string
          comment: string | null
          confidence: string
          created_at: string
          flag_reason: string | null
          flagged: boolean
          guidelines_version: string
          id: string
          item_id: string
          project_id: string
          time_spent: number
          updated_at: string
          value: Json
        }
        Insert: {
          agreement_with_others?: number | null
          agrees_with_gold?: boolean | null
          annotator_id: string
          comment?: string | null
          confidence?: string
          created_at?: string
          flag_reason?: string | null
          flagged?: boolean
          guidelines_version?: string
          id?: string
          item_id: string
          project_id: string
          time_spent?: number
          updated_at?: string
          value?: Json
        }
        Update: {
          agreement_with_others?: number | null
          agrees_with_gold?: boolean | null
          annotator_id?: string
          comment?: string | null
          confidence?: string
          created_at?: string
          flag_reason?: string | null
          flagged?: boolean
          guidelines_version?: string
          id?: string
          item_id?: string
          project_id?: string
          time_spent?: number
          updated_at?: string
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "annotations_annotator_id_fkey"
            columns: ["annotator_id"]
            isOneToOne: false
            referencedRelation: "annotator_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "annotations_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "annotation_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "annotations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "annotation_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      annotator_assessment_sessions: {
        Row: {
          completed_at: string | null
          created_at: string
          current_phase: number
          domain: Database["public"]["Enums"]["annotation_domain"]
          expert_id: string
          feedback: Json | null
          global_score: number | null
          id: string
          integrity_critical_count: number | null
          integrity_flags: Json | null
          integrity_warning_count: number | null
          phase1_answers: Json | null
          phase1_completed_at: string | null
          phase1_item_ids: string[] | null
          phase1_passed: boolean | null
          phase1_score: number | null
          phase1_started_at: string | null
          phase2_answers: Json | null
          phase2_avg_time_per_item: number | null
          phase2_completed_at: string | null
          phase2_item_ids: string[] | null
          phase2_scores: Json | null
          phase2_started_at: string | null
          phase3_answers: Json | null
          phase3_completed_at: string | null
          phase3_item_ids: string[] | null
          phase3_score: number | null
          phase3_started_at: string | null
          phase4_answers: Json | null
          phase4_completed_at: string | null
          phase4_item_ids: string[] | null
          phase4_score: number | null
          phase4_started_at: string | null
          started_at: string
          status: string
          tier_awarded:
            | Database["public"]["Enums"]["annotator_assessment_tier"]
            | null
          time_limit_seconds: number
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          current_phase?: number
          domain: Database["public"]["Enums"]["annotation_domain"]
          expert_id: string
          feedback?: Json | null
          global_score?: number | null
          id?: string
          integrity_critical_count?: number | null
          integrity_flags?: Json | null
          integrity_warning_count?: number | null
          phase1_answers?: Json | null
          phase1_completed_at?: string | null
          phase1_item_ids?: string[] | null
          phase1_passed?: boolean | null
          phase1_score?: number | null
          phase1_started_at?: string | null
          phase2_answers?: Json | null
          phase2_avg_time_per_item?: number | null
          phase2_completed_at?: string | null
          phase2_item_ids?: string[] | null
          phase2_scores?: Json | null
          phase2_started_at?: string | null
          phase3_answers?: Json | null
          phase3_completed_at?: string | null
          phase3_item_ids?: string[] | null
          phase3_score?: number | null
          phase3_started_at?: string | null
          phase4_answers?: Json | null
          phase4_completed_at?: string | null
          phase4_item_ids?: string[] | null
          phase4_score?: number | null
          phase4_started_at?: string | null
          started_at?: string
          status?: string
          tier_awarded?:
            | Database["public"]["Enums"]["annotator_assessment_tier"]
            | null
          time_limit_seconds?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          current_phase?: number
          domain?: Database["public"]["Enums"]["annotation_domain"]
          expert_id?: string
          feedback?: Json | null
          global_score?: number | null
          id?: string
          integrity_critical_count?: number | null
          integrity_flags?: Json | null
          integrity_warning_count?: number | null
          phase1_answers?: Json | null
          phase1_completed_at?: string | null
          phase1_item_ids?: string[] | null
          phase1_passed?: boolean | null
          phase1_score?: number | null
          phase1_started_at?: string | null
          phase2_answers?: Json | null
          phase2_avg_time_per_item?: number | null
          phase2_completed_at?: string | null
          phase2_item_ids?: string[] | null
          phase2_scores?: Json | null
          phase2_started_at?: string | null
          phase3_answers?: Json | null
          phase3_completed_at?: string | null
          phase3_item_ids?: string[] | null
          phase3_score?: number | null
          phase3_started_at?: string | null
          phase4_answers?: Json | null
          phase4_completed_at?: string | null
          phase4_item_ids?: string[] | null
          phase4_score?: number | null
          phase4_started_at?: string | null
          started_at?: string
          status?: string
          tier_awarded?:
            | Database["public"]["Enums"]["annotator_assessment_tier"]
            | null
          time_limit_seconds?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      annotator_domain_certifications: {
        Row: {
          created_at: string
          domain: Database["public"]["Enums"]["annotation_domain"]
          expert_id: string
          id: string
          issued_at: string
          score: number
          session_id: string | null
          status: string
          tier: Database["public"]["Enums"]["annotator_assessment_tier"]
          user_id: string
          valid_until: string
        }
        Insert: {
          created_at?: string
          domain: Database["public"]["Enums"]["annotation_domain"]
          expert_id: string
          id?: string
          issued_at?: string
          score: number
          session_id?: string | null
          status?: string
          tier: Database["public"]["Enums"]["annotator_assessment_tier"]
          user_id: string
          valid_until?: string
        }
        Update: {
          created_at?: string
          domain?: Database["public"]["Enums"]["annotation_domain"]
          expert_id?: string
          id?: string
          issued_at?: string
          score?: number
          session_id?: string | null
          status?: string
          tier?: Database["public"]["Enums"]["annotator_assessment_tier"]
          user_id?: string
          valid_until?: string
        }
        Relationships: [
          {
            foreignKeyName: "annotator_domain_certifications_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "annotator_assessment_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      annotator_profiles: {
        Row: {
          abandon_rate: number | null
          accuracy_vs_senior: number | null
          annotation_skills: Json | null
          anonymized_id: string
          consent_given_at: string | null
          consent_version: string | null
          consistency_score: number | null
          country: string
          created_at: string | null
          current_daily_count: number | null
          daily_quota: number | null
          experience_years: number
          expert_id: string | null
          flag_rate: number | null
          gold_tasks_completed: number | null
          gold_tasks_passed: number | null
          hourly_rate: number | null
          hours_per_week: number | null
          id: string
          incentive_multiplier: number | null
          inter_annotator_agreement: number | null
          is_active: boolean | null
          is_qualified: boolean | null
          languages: string[]
          last_qualification_attempt: string | null
          last_quota_reset: string | null
          level_demoted_at: string | null
          max_concurrent_items: number | null
          on_time_rate: number | null
          overall_accuracy: number | null
          qualification_score: number | null
          qualified_at: string | null
          quality_trend: string | null
          region: string | null
          reliability_score: number | null
          role: string
          seniority: string
          suspended_until: string | null
          suspension_reason: string | null
          throughput_per_hour: number | null
          tier: Database["public"]["Enums"]["annotator_tier"] | null
          timezone: string | null
          total_annotations: number | null
          trust_score: number | null
          trust_score_updated_at: string | null
          warnings_count: number | null
        }
        Insert: {
          abandon_rate?: number | null
          accuracy_vs_senior?: number | null
          annotation_skills?: Json | null
          anonymized_id: string
          consent_given_at?: string | null
          consent_version?: string | null
          consistency_score?: number | null
          country: string
          created_at?: string | null
          current_daily_count?: number | null
          daily_quota?: number | null
          experience_years: number
          expert_id?: string | null
          flag_rate?: number | null
          gold_tasks_completed?: number | null
          gold_tasks_passed?: number | null
          hourly_rate?: number | null
          hours_per_week?: number | null
          id?: string
          incentive_multiplier?: number | null
          inter_annotator_agreement?: number | null
          is_active?: boolean | null
          is_qualified?: boolean | null
          languages: string[]
          last_qualification_attempt?: string | null
          last_quota_reset?: string | null
          level_demoted_at?: string | null
          max_concurrent_items?: number | null
          on_time_rate?: number | null
          overall_accuracy?: number | null
          qualification_score?: number | null
          qualified_at?: string | null
          quality_trend?: string | null
          region?: string | null
          reliability_score?: number | null
          role: string
          seniority: string
          suspended_until?: string | null
          suspension_reason?: string | null
          throughput_per_hour?: number | null
          tier?: Database["public"]["Enums"]["annotator_tier"] | null
          timezone?: string | null
          total_annotations?: number | null
          trust_score?: number | null
          trust_score_updated_at?: string | null
          warnings_count?: number | null
        }
        Update: {
          abandon_rate?: number | null
          accuracy_vs_senior?: number | null
          annotation_skills?: Json | null
          anonymized_id?: string
          consent_given_at?: string | null
          consent_version?: string | null
          consistency_score?: number | null
          country?: string
          created_at?: string | null
          current_daily_count?: number | null
          daily_quota?: number | null
          experience_years?: number
          expert_id?: string | null
          flag_rate?: number | null
          gold_tasks_completed?: number | null
          gold_tasks_passed?: number | null
          hourly_rate?: number | null
          hours_per_week?: number | null
          id?: string
          incentive_multiplier?: number | null
          inter_annotator_agreement?: number | null
          is_active?: boolean | null
          is_qualified?: boolean | null
          languages?: string[]
          last_qualification_attempt?: string | null
          last_quota_reset?: string | null
          level_demoted_at?: string | null
          max_concurrent_items?: number | null
          on_time_rate?: number | null
          overall_accuracy?: number | null
          qualification_score?: number | null
          qualified_at?: string | null
          quality_trend?: string | null
          region?: string | null
          reliability_score?: number | null
          role?: string
          seniority?: string
          suspended_until?: string | null
          suspension_reason?: string | null
          throughput_per_hour?: number | null
          tier?: Database["public"]["Enums"]["annotator_tier"] | null
          timezone?: string | null
          total_annotations?: number | null
          trust_score?: number | null
          trust_score_updated_at?: string | null
          warnings_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "annotator_profiles_expert_id_fkey"
            columns: ["expert_id"]
            isOneToOne: true
            referencedRelation: "expert_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "annotator_profiles_expert_id_fkey"
            columns: ["expert_id"]
            isOneToOne: true
            referencedRelation: "expert_profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      anonymized_candidates: {
        Row: {
          anonymized_code: string
          code_quality_score: number | null
          cohort_size: number | null
          communication_score: number | null
          consistency_score: number | null
          created_at: string | null
          domain_expertise: string[] | null
          experience_years_band: string | null
          expert_id: string
          id: string
          is_visible: boolean | null
          overall_score: number | null
          percentile_rank: number | null
          problem_solving_score: number | null
          reasoning_score: number | null
          senior_gap_score: number | null
          seniority_fit_score: number | null
          seniority_level: string | null
          stats_computed_at: string | null
          strength_labels: string[] | null
          weakness_labels: string[] | null
        }
        Insert: {
          anonymized_code?: string
          code_quality_score?: number | null
          cohort_size?: number | null
          communication_score?: number | null
          consistency_score?: number | null
          created_at?: string | null
          domain_expertise?: string[] | null
          experience_years_band?: string | null
          expert_id: string
          id?: string
          is_visible?: boolean | null
          overall_score?: number | null
          percentile_rank?: number | null
          problem_solving_score?: number | null
          reasoning_score?: number | null
          senior_gap_score?: number | null
          seniority_fit_score?: number | null
          seniority_level?: string | null
          stats_computed_at?: string | null
          strength_labels?: string[] | null
          weakness_labels?: string[] | null
        }
        Update: {
          anonymized_code?: string
          code_quality_score?: number | null
          cohort_size?: number | null
          communication_score?: number | null
          consistency_score?: number | null
          created_at?: string | null
          domain_expertise?: string[] | null
          experience_years_band?: string | null
          expert_id?: string
          id?: string
          is_visible?: boolean | null
          overall_score?: number | null
          percentile_rank?: number | null
          problem_solving_score?: number | null
          reasoning_score?: number | null
          senior_gap_score?: number | null
          seniority_fit_score?: number | null
          seniority_level?: string | null
          stats_computed_at?: string | null
          strength_labels?: string[] | null
          weakness_labels?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "anonymized_candidates_expert_id_fkey"
            columns: ["expert_id"]
            isOneToOne: true
            referencedRelation: "expert_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anonymized_candidates_expert_id_fkey"
            columns: ["expert_id"]
            isOneToOne: true
            referencedRelation: "expert_profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      api_request_logs: {
        Row: {
          client_id: string | null
          created_at: string | null
          endpoint: string
          error_message: string | null
          id: string
          ip_address: string | null
          latency_ms: number | null
          method: string
          request_body_size: number | null
          request_id: string | null
          response_body_size: number | null
          status_code: number
          user_agent: string | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string | null
          endpoint: string
          error_message?: string | null
          id?: string
          ip_address?: string | null
          latency_ms?: number | null
          method: string
          request_body_size?: number | null
          request_id?: string | null
          response_body_size?: number | null
          status_code: number
          user_agent?: string | null
        }
        Update: {
          client_id?: string | null
          created_at?: string | null
          endpoint?: string
          error_message?: string | null
          id?: string
          ip_address?: string | null
          latency_ms?: number | null
          method?: string
          request_body_size?: number | null
          request_id?: string | null
          response_body_size?: number | null
          status_code?: number
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_request_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      article_topics: {
        Row: {
          article_id: string | null
          created_at: string | null
          id: string
          theme: string
          topic: string
          used: boolean | null
        }
        Insert: {
          article_id?: string | null
          created_at?: string | null
          id?: string
          theme: string
          topic: string
          used?: boolean | null
        }
        Update: {
          article_id?: string | null
          created_at?: string | null
          id?: string
          theme?: string
          topic?: string
          used?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "article_topics_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "blog_articles"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_sessions: {
        Row: {
          candidate_id: string
          code_review_challenge_id: string | null
          coding_challenge_id: string | null
          completed_at: string | null
          created_at: string
          current_phase: number
          global_score: Json | null
          id: string
          integrity_critical_count: number
          integrity_flags: Json
          integrity_warning_count: number
          phase1_completed_at: string | null
          phase1_result: Json | null
          phase1_started_at: string | null
          phase2_code: string | null
          phase2_completed_at: string | null
          phase2_result: Json | null
          phase2_started_at: string | null
          phase3_answers: Json | null
          phase3_completed_at: string | null
          phase3_result: Json | null
          phase3_started_at: string | null
          quiz_question_ids: string[] | null
          stack: string
          started_at: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          candidate_id: string
          code_review_challenge_id?: string | null
          coding_challenge_id?: string | null
          completed_at?: string | null
          created_at?: string
          current_phase?: number
          global_score?: Json | null
          id?: string
          integrity_critical_count?: number
          integrity_flags?: Json
          integrity_warning_count?: number
          phase1_completed_at?: string | null
          phase1_result?: Json | null
          phase1_started_at?: string | null
          phase2_code?: string | null
          phase2_completed_at?: string | null
          phase2_result?: Json | null
          phase2_started_at?: string | null
          phase3_answers?: Json | null
          phase3_completed_at?: string | null
          phase3_result?: Json | null
          phase3_started_at?: string | null
          quiz_question_ids?: string[] | null
          stack: string
          started_at?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          candidate_id?: string
          code_review_challenge_id?: string | null
          coding_challenge_id?: string | null
          completed_at?: string | null
          created_at?: string
          current_phase?: number
          global_score?: Json | null
          id?: string
          integrity_critical_count?: number
          integrity_flags?: Json
          integrity_warning_count?: number
          phase1_completed_at?: string | null
          phase1_result?: Json | null
          phase1_started_at?: string | null
          phase2_code?: string | null
          phase2_completed_at?: string | null
          phase2_result?: Json | null
          phase2_started_at?: string | null
          phase3_answers?: Json | null
          phase3_completed_at?: string | null
          phase3_result?: Json | null
          phase3_started_at?: string | null
          quiz_question_ids?: string[] | null
          stack?: string
          started_at?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_sessions_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "expert_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_sessions_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "expert_profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_sessions_code_review_challenge_id_fkey"
            columns: ["code_review_challenge_id"]
            isOneToOne: false
            referencedRelation: "code_review_challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_sessions_coding_challenge_id_fkey"
            columns: ["coding_challenge_id"]
            isOneToOne: false
            referencedRelation: "coding_challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: string | null
          new_value: Json | null
          old_value: Json | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          new_value?: Json | null
          old_value?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          new_value?: Json | null
          old_value?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      blog_articles: {
        Row: {
          content_markdown: string
          created_at: string | null
          estimated_read_minutes: number | null
          excerpt: string | null
          id: string
          meta_description: string | null
          published_at: string | null
          slug: string
          source: string | null
          status: string | null
          tags: string[] | null
          title: string
          updated_at: string | null
          views: number | null
        }
        Insert: {
          content_markdown: string
          created_at?: string | null
          estimated_read_minutes?: number | null
          excerpt?: string | null
          id?: string
          meta_description?: string | null
          published_at?: string | null
          slug: string
          source?: string | null
          status?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string | null
          views?: number | null
        }
        Update: {
          content_markdown?: string
          created_at?: string | null
          estimated_read_minutes?: number | null
          excerpt?: string | null
          id?: string
          meta_description?: string | null
          published_at?: string | null
          slug?: string
          source?: string | null
          status?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string | null
          views?: number | null
        }
        Relationships: []
      }
      blog_posts: {
        Row: {
          author_avatar_url: string | null
          author_name: string
          content: string | null
          cover_image_url: string | null
          created_at: string | null
          excerpt: string | null
          id: string
          is_published: boolean | null
          published_at: string | null
          slug: string
          title: string
          updated_at: string | null
        }
        Insert: {
          author_avatar_url?: string | null
          author_name: string
          content?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          excerpt?: string | null
          id?: string
          is_published?: boolean | null
          published_at?: string | null
          slug: string
          title: string
          updated_at?: string | null
        }
        Update: {
          author_avatar_url?: string | null
          author_name?: string
          content?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          excerpt?: string | null
          id?: string
          is_published?: boolean | null
          published_at?: string | null
          slug?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      candidate_access_logs: {
        Row: {
          action_type: string
          anonymized_candidate_id: string
          company_user_id: string
          created_at: string | null
          id: string
          ip_address: string | null
          page_section: string | null
          session_id: string | null
          time_spent_seconds: number | null
          user_agent: string | null
        }
        Insert: {
          action_type: string
          anonymized_candidate_id: string
          company_user_id: string
          created_at?: string | null
          id?: string
          ip_address?: string | null
          page_section?: string | null
          session_id?: string | null
          time_spent_seconds?: number | null
          user_agent?: string | null
        }
        Update: {
          action_type?: string
          anonymized_candidate_id?: string
          company_user_id?: string
          created_at?: string | null
          id?: string
          ip_address?: string | null
          page_section?: string | null
          session_id?: string | null
          time_spent_seconds?: number | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "candidate_access_logs_anonymized_candidate_id_fkey"
            columns: ["anonymized_candidate_id"]
            isOneToOne: false
            referencedRelation: "anonymized_candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_score_dimensions: {
        Row: {
          anonymized_candidate_id: string
          created_at: string | null
          dimension_name: string
          id: string
          percentile: number | null
          score: number
          test_count: number | null
          updated_at: string | null
        }
        Insert: {
          anonymized_candidate_id: string
          created_at?: string | null
          dimension_name: string
          id?: string
          percentile?: number | null
          score: number
          test_count?: number | null
          updated_at?: string | null
        }
        Update: {
          anonymized_candidate_id?: string
          created_at?: string | null
          dimension_name?: string
          id?: string
          percentile?: number | null
          score?: number
          test_count?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "candidate_score_dimensions_anonymized_candidate_id_fkey"
            columns: ["anonymized_candidate_id"]
            isOneToOne: false
            referencedRelation: "anonymized_candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      candidates: {
        Row: {
          created_at: string | null
          cv_score: number | null
          cv_text: string
          email: string
          full_name: string
          id: string
          parsed_data: Json | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          cv_score?: number | null
          cv_text: string
          email: string
          full_name: string
          id?: string
          parsed_data?: Json | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          cv_score?: number | null
          cv_text?: string
          email?: string
          full_name?: string
          id?: string
          parsed_data?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      certificate_events: {
        Row: {
          actor_user_id: string | null
          certification_id: string
          created_at: string
          event_type: Database["public"]["Enums"]["certificate_event_type"]
          id: string
          ip_address: string | null
          user_agent: string | null
        }
        Insert: {
          actor_user_id?: string | null
          certification_id: string
          created_at?: string
          event_type: Database["public"]["Enums"]["certificate_event_type"]
          id?: string
          ip_address?: string | null
          user_agent?: string | null
        }
        Update: {
          actor_user_id?: string | null
          certification_id?: string
          created_at?: string
          event_type?: Database["public"]["Enums"]["certificate_event_type"]
          id?: string
          ip_address?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "certificate_events_certification_id_fkey"
            columns: ["certification_id"]
            isOneToOne: false
            referencedRelation: "certifications"
            referencedColumns: ["id"]
          },
        ]
      }
      certificate_sequences: {
        Row: {
          current_sequence: number
          id: string
          track: string
          year: number
        }
        Insert: {
          current_sequence?: number
          id?: string
          track: string
          year: number
        }
        Update: {
          current_sequence?: number
          id?: string
          track?: string
          year?: number
        }
        Relationships: []
      }
      certification_answers: {
        Row: {
          answered_at: string | null
          expert_id: string
          gold_task_id: string | null
          id: string
          is_correct: boolean | null
          question_id: string | null
          selected_answer: number | null
          session_id: string | null
          submitted_scores: Json | null
        }
        Insert: {
          answered_at?: string | null
          expert_id: string
          gold_task_id?: string | null
          id?: string
          is_correct?: boolean | null
          question_id?: string | null
          selected_answer?: number | null
          session_id?: string | null
          submitted_scores?: Json | null
        }
        Update: {
          answered_at?: string | null
          expert_id?: string
          gold_task_id?: string | null
          id?: string
          is_correct?: boolean | null
          question_id?: string | null
          selected_answer?: number | null
          session_id?: string | null
          submitted_scores?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "certification_answers_gold_task_id_fkey"
            columns: ["gold_task_id"]
            isOneToOne: false
            referencedRelation: "certification_gold_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certification_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "certification_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      certification_assessments: {
        Row: {
          completed_at: string | null
          created_at: string | null
          current_phase: number | null
          domain: string
          expert_id: string
          id: string
          next_attempt_allowed_at: string | null
          overall_passed: boolean | null
          phase1_answers: Json | null
          phase1_completed_at: string | null
          phase1_passed: boolean | null
          phase1_questions: Json | null
          phase1_score: number | null
          phase1_started_at: string | null
          phase2_completed_at: string | null
          phase2_error_detection: Json | null
          phase2_expert_scores: Json | null
          phase2_gold_scores: Json | null
          phase2_mean_deviation: number | null
          phase2_passed: boolean | null
          phase2_started_at: string | null
          phase2_task: Json | null
          phase2b_correction: string | null
          phase2b_expert_verdict: string | null
          phase2b_gold_verdict: string | null
          phase2b_justification: string | null
          phase2b_passed: boolean | null
          phase2b_problems_identified: Json | null
          phase2b_scenario: Json | null
          phase3_alpha: number | null
          phase3_completed_at: string | null
          phase3_passed: boolean | null
          phase3_started_at: string | null
          phase3_task_ids: string[] | null
          started_at: string | null
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          current_phase?: number | null
          domain: string
          expert_id: string
          id?: string
          next_attempt_allowed_at?: string | null
          overall_passed?: boolean | null
          phase1_answers?: Json | null
          phase1_completed_at?: string | null
          phase1_passed?: boolean | null
          phase1_questions?: Json | null
          phase1_score?: number | null
          phase1_started_at?: string | null
          phase2_completed_at?: string | null
          phase2_error_detection?: Json | null
          phase2_expert_scores?: Json | null
          phase2_gold_scores?: Json | null
          phase2_mean_deviation?: number | null
          phase2_passed?: boolean | null
          phase2_started_at?: string | null
          phase2_task?: Json | null
          phase2b_correction?: string | null
          phase2b_expert_verdict?: string | null
          phase2b_gold_verdict?: string | null
          phase2b_justification?: string | null
          phase2b_passed?: boolean | null
          phase2b_problems_identified?: Json | null
          phase2b_scenario?: Json | null
          phase3_alpha?: number | null
          phase3_completed_at?: string | null
          phase3_passed?: boolean | null
          phase3_started_at?: string | null
          phase3_task_ids?: string[] | null
          started_at?: string | null
          status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          current_phase?: number | null
          domain?: string
          expert_id?: string
          id?: string
          next_attempt_allowed_at?: string | null
          overall_passed?: boolean | null
          phase1_answers?: Json | null
          phase1_completed_at?: string | null
          phase1_passed?: boolean | null
          phase1_questions?: Json | null
          phase1_score?: number | null
          phase1_started_at?: string | null
          phase2_completed_at?: string | null
          phase2_error_detection?: Json | null
          phase2_expert_scores?: Json | null
          phase2_gold_scores?: Json | null
          phase2_mean_deviation?: number | null
          phase2_passed?: boolean | null
          phase2_started_at?: string | null
          phase2_task?: Json | null
          phase2b_correction?: string | null
          phase2b_expert_verdict?: string | null
          phase2b_gold_verdict?: string | null
          phase2b_justification?: string | null
          phase2b_passed?: boolean | null
          phase2b_problems_identified?: Json | null
          phase2b_scenario?: Json | null
          phase3_alpha?: number | null
          phase3_completed_at?: string | null
          phase3_passed?: boolean | null
          phase3_started_at?: string | null
          phase3_task_ids?: string[] | null
          started_at?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      certification_gold_tasks: {
        Row: {
          active: boolean | null
          created_at: string | null
          domain: string
          explanation: string | null
          gold_reasoning: string
          gold_scores: Json
          id: string
          prompt: string
          response: string
          task_type: string
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          domain: string
          explanation?: string | null
          gold_reasoning: string
          gold_scores: Json
          id?: string
          prompt: string
          response: string
          task_type: string
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          domain?: string
          explanation?: string | null
          gold_reasoning?: string
          gold_scores?: Json
          id?: string
          prompt?: string
          response?: string
          task_type?: string
        }
        Relationships: []
      }
      certification_questions: {
        Row: {
          active: boolean | null
          correct_answer: number
          created_at: string | null
          difficulty: string | null
          domain: string
          explanation: string | null
          id: string
          options: Json
          phase: string
          question: string
        }
        Insert: {
          active?: boolean | null
          correct_answer: number
          created_at?: string | null
          difficulty?: string | null
          domain: string
          explanation?: string | null
          id?: string
          options: Json
          phase: string
          question: string
        }
        Update: {
          active?: boolean | null
          correct_answer?: number
          created_at?: string | null
          difficulty?: string | null
          domain?: string
          explanation?: string | null
          id?: string
          options?: Json
          phase?: string
          question?: string
        }
        Relationships: []
      }
      certifications: {
        Row: {
          assessment_name: string
          certificate_id: string
          cohort_size: number | null
          country: string | null
          created_at: string
          expert_id: string | null
          first_name: string
          id: string
          issued_at: string
          last_name: string
          level: Database["public"]["Enums"]["certification_level"]
          min_samples_met: boolean | null
          percentile_computed_at: string | null
          percentile_rank: number | null
          role_title: string
          score: number
          signature_hash: string | null
          signed_at: string | null
          status: Database["public"]["Enums"]["certification_status"]
          updated_at: string
          user_id: string
          valid_until: string | null
          verification_url: string | null
        }
        Insert: {
          assessment_name: string
          certificate_id: string
          cohort_size?: number | null
          country?: string | null
          created_at?: string
          expert_id?: string | null
          first_name: string
          id?: string
          issued_at?: string
          last_name: string
          level?: Database["public"]["Enums"]["certification_level"]
          min_samples_met?: boolean | null
          percentile_computed_at?: string | null
          percentile_rank?: number | null
          role_title: string
          score: number
          signature_hash?: string | null
          signed_at?: string | null
          status?: Database["public"]["Enums"]["certification_status"]
          updated_at?: string
          user_id: string
          valid_until?: string | null
          verification_url?: string | null
        }
        Update: {
          assessment_name?: string
          certificate_id?: string
          cohort_size?: number | null
          country?: string | null
          created_at?: string
          expert_id?: string | null
          first_name?: string
          id?: string
          issued_at?: string
          last_name?: string
          level?: Database["public"]["Enums"]["certification_level"]
          min_samples_met?: boolean | null
          percentile_computed_at?: string | null
          percentile_rank?: number | null
          role_title?: string
          score?: number
          signature_hash?: string | null
          signed_at?: string | null
          status?: Database["public"]["Enums"]["certification_status"]
          updated_at?: string
          user_id?: string
          valid_until?: string | null
          verification_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "certifications_expert_id_fkey"
            columns: ["expert_id"]
            isOneToOne: false
            referencedRelation: "expert_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certifications_expert_id_fkey"
            columns: ["expert_id"]
            isOneToOne: false
            referencedRelation: "expert_profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      client_invoices: {
        Row: {
          amount: number
          client_id: string | null
          created_at: string | null
          currency: string | null
          id: string
          period_end: string | null
          period_start: string | null
          project_id: string | null
          status: string | null
          stripe_invoice_id: string | null
          tasks_billed: number | null
        }
        Insert: {
          amount?: number
          client_id?: string | null
          created_at?: string | null
          currency?: string | null
          id?: string
          period_end?: string | null
          period_start?: string | null
          project_id?: string | null
          status?: string | null
          stripe_invoice_id?: string | null
          tasks_billed?: number | null
        }
        Update: {
          amount?: number
          client_id?: string | null
          created_at?: string | null
          currency?: string | null
          id?: string
          period_end?: string | null
          period_start?: string | null
          project_id?: string | null
          status?: string | null
          stripe_invoice_id?: string | null
          tasks_billed?: number | null
        }
        Relationships: []
      }
      client_notification_preferences: {
        Row: {
          client_id: string
          export_ready: boolean | null
          invoice_issued: boolean | null
          new_features: boolean | null
          payment_confirmed: boolean | null
          payment_reminder: boolean | null
          product_updates: boolean | null
          project_completed: boolean | null
          project_started: boolean | null
          quality_alert: boolean | null
          task_flagged: boolean | null
          updated_at: string | null
        }
        Insert: {
          client_id: string
          export_ready?: boolean | null
          invoice_issued?: boolean | null
          new_features?: boolean | null
          payment_confirmed?: boolean | null
          payment_reminder?: boolean | null
          product_updates?: boolean | null
          project_completed?: boolean | null
          project_started?: boolean | null
          quality_alert?: boolean | null
          task_flagged?: boolean | null
          updated_at?: string | null
        }
        Update: {
          client_id?: string
          export_ready?: boolean | null
          invoice_issued?: boolean | null
          new_features?: boolean | null
          payment_confirmed?: boolean | null
          payment_reminder?: boolean | null
          product_updates?: boolean | null
          project_completed?: boolean | null
          project_started?: boolean | null
          quality_alert?: boolean | null
          task_flagged?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_notification_preferences_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_plans: {
        Row: {
          active: boolean | null
          description: string | null
          id: string
          included_tasks: number | null
          monthly_fee: number | null
          overage_discount_percent: number | null
          plan_name: string
        }
        Insert: {
          active?: boolean | null
          description?: string | null
          id?: string
          included_tasks?: number | null
          monthly_fee?: number | null
          overage_discount_percent?: number | null
          plan_name: string
        }
        Update: {
          active?: boolean | null
          description?: string | null
          id?: string
          included_tasks?: number | null
          monthly_fee?: number | null
          overage_discount_percent?: number | null
          plan_name?: string
        }
        Relationships: []
      }
      client_uploads: {
        Row: {
          avg_prompt_length: number | null
          avg_response_length: number | null
          cleaning_report: Json | null
          client_id: string | null
          confirmed_at: string | null
          created_at: string | null
          detected_language: string | null
          duplicate_rows: number | null
          estimated_cost: number | null
          estimated_delivery_days: number | null
          file_format: string | null
          file_name: string
          file_size_bytes: number | null
          html_cleaned_rows: number | null
          id: string
          invalid_rows: number | null
          junk_rows: number | null
          pii_detected_rows: number | null
          preview_items: Json | null
          project_id: string
          quality_score: number | null
          storage_key: string | null
          storage_path: string | null
          too_long_rows: number | null
          too_short_rows: number | null
          total_rows: number | null
          unicode_normalized_rows: number | null
          user_id: string | null
          valid_rows: number | null
          validated_at: string | null
          validation_errors: Json | null
          validation_status: string | null
        }
        Insert: {
          avg_prompt_length?: number | null
          avg_response_length?: number | null
          cleaning_report?: Json | null
          client_id?: string | null
          confirmed_at?: string | null
          created_at?: string | null
          detected_language?: string | null
          duplicate_rows?: number | null
          estimated_cost?: number | null
          estimated_delivery_days?: number | null
          file_format?: string | null
          file_name: string
          file_size_bytes?: number | null
          html_cleaned_rows?: number | null
          id?: string
          invalid_rows?: number | null
          junk_rows?: number | null
          pii_detected_rows?: number | null
          preview_items?: Json | null
          project_id: string
          quality_score?: number | null
          storage_key?: string | null
          storage_path?: string | null
          too_long_rows?: number | null
          too_short_rows?: number | null
          total_rows?: number | null
          unicode_normalized_rows?: number | null
          user_id?: string | null
          valid_rows?: number | null
          validated_at?: string | null
          validation_errors?: Json | null
          validation_status?: string | null
        }
        Update: {
          avg_prompt_length?: number | null
          avg_response_length?: number | null
          cleaning_report?: Json | null
          client_id?: string | null
          confirmed_at?: string | null
          created_at?: string | null
          detected_language?: string | null
          duplicate_rows?: number | null
          estimated_cost?: number | null
          estimated_delivery_days?: number | null
          file_format?: string | null
          file_name?: string
          file_size_bytes?: number | null
          html_cleaned_rows?: number | null
          id?: string
          invalid_rows?: number | null
          junk_rows?: number | null
          pii_detected_rows?: number | null
          preview_items?: Json | null
          project_id?: string
          quality_score?: number | null
          storage_key?: string | null
          storage_path?: string | null
          too_long_rows?: number | null
          too_short_rows?: number | null
          total_rows?: number | null
          unicode_normalized_rows?: number | null
          user_id?: string | null
          valid_rows?: number | null
          validated_at?: string | null
          validation_errors?: Json | null
          validation_status?: string | null
        }
        Relationships: []
      }
      client_webhooks: {
        Row: {
          active: boolean | null
          client_id: string | null
          created_at: string | null
          events: string[]
          failure_count: number | null
          id: string
          last_status_code: number | null
          last_triggered_at: string | null
          secret_hash: string
          url: string
        }
        Insert: {
          active?: boolean | null
          client_id?: string | null
          created_at?: string | null
          events: string[]
          failure_count?: number | null
          id?: string
          last_status_code?: number | null
          last_triggered_at?: string | null
          secret_hash: string
          url: string
        }
        Update: {
          active?: boolean | null
          client_id?: string | null
          created_at?: string | null
          events?: string[]
          failure_count?: number | null
          id?: string
          last_status_code?: number | null
          last_triggered_at?: string | null
          secret_hash?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_webhooks_client_id_fkey"
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
          address_line2: string | null
          api_key_created_at: string | null
          api_key_hash: string | null
          api_key_prefix: string | null
          api_rate_limit: number | null
          billing_email: string | null
          city: string | null
          company_name: string
          contact_email: string
          contact_name: string
          contact_phone: string | null
          country: string | null
          created_at: string | null
          disabled_at: string | null
          disabled_reason: string | null
          id: string
          is_active: boolean | null
          name: string | null
          notes: string | null
          payment_terms: number | null
          postal_code: string | null
          profile_completion: number | null
          siret: string | null
          stripe_customer_id: string | null
          tva_number: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          address?: string | null
          address_line2?: string | null
          api_key_created_at?: string | null
          api_key_hash?: string | null
          api_key_prefix?: string | null
          api_rate_limit?: number | null
          billing_email?: string | null
          city?: string | null
          company_name: string
          contact_email: string
          contact_name: string
          contact_phone?: string | null
          country?: string | null
          created_at?: string | null
          disabled_at?: string | null
          disabled_reason?: string | null
          id?: string
          is_active?: boolean | null
          name?: string | null
          notes?: string | null
          payment_terms?: number | null
          postal_code?: string | null
          profile_completion?: number | null
          siret?: string | null
          stripe_customer_id?: string | null
          tva_number?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          address?: string | null
          address_line2?: string | null
          api_key_created_at?: string | null
          api_key_hash?: string | null
          api_key_prefix?: string | null
          api_rate_limit?: number | null
          billing_email?: string | null
          city?: string | null
          company_name?: string
          contact_email?: string
          contact_name?: string
          contact_phone?: string | null
          country?: string | null
          created_at?: string | null
          disabled_at?: string | null
          disabled_reason?: string | null
          id?: string
          is_active?: boolean | null
          name?: string | null
          notes?: string | null
          payment_terms?: number | null
          postal_code?: string | null
          profile_completion?: number | null
          siret?: string | null
          stripe_customer_id?: string | null
          tva_number?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      code_review_challenges: {
        Row: {
          code: string
          created_at: string
          difficulty: string
          id: string
          is_active: boolean
          max_duration: number
          problems: Json
          stack: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          difficulty?: string
          id?: string
          is_active?: boolean
          max_duration?: number
          problems?: Json
          stack: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          difficulty?: string
          id?: string
          is_active?: boolean
          max_duration?: number
          problems?: Json
          stack?: string
          updated_at?: string
        }
        Relationships: []
      }
      coding_challenges: {
        Row: {
          created_at: string
          difficulty: string
          hidden_tests: Json
          id: string
          is_active: boolean
          max_duration: number
          scenario: string
          stack: string
          starter_code: string
          steps: Json
          title: string
          updated_at: string
          visible_tests: Json
        }
        Insert: {
          created_at?: string
          difficulty?: string
          hidden_tests?: Json
          id?: string
          is_active?: boolean
          max_duration?: number
          scenario: string
          stack: string
          starter_code?: string
          steps?: Json
          title: string
          updated_at?: string
          visible_tests?: Json
        }
        Update: {
          created_at?: string
          difficulty?: string
          hidden_tests?: Json
          id?: string
          is_active?: boolean
          max_duration?: number
          scenario?: string
          stack?: string
          starter_code?: string
          steps?: Json
          title?: string
          updated_at?: string
          visible_tests?: Json
        }
        Relationships: []
      }
      company_credits: {
        Row: {
          available_credits: number | null
          created_at: string
          id: string
          total_credits: number
          updated_at: string
          used_credits: number
          user_id: string
        }
        Insert: {
          available_credits?: number | null
          created_at?: string
          id?: string
          total_credits?: number
          updated_at?: string
          used_credits?: number
          user_id: string
        }
        Update: {
          available_credits?: number | null
          created_at?: string
          id?: string
          total_credits?: number
          updated_at?: string
          used_credits?: number
          user_id?: string
        }
        Relationships: []
      }
      company_unlock_credits: {
        Row: {
          available_credits: number | null
          company_user_id: string
          created_at: string | null
          id: string
          total_credits: number | null
          updated_at: string | null
          used_credits: number | null
        }
        Insert: {
          available_credits?: number | null
          company_user_id: string
          created_at?: string | null
          id?: string
          total_credits?: number | null
          updated_at?: string | null
          used_credits?: number | null
        }
        Update: {
          available_credits?: number | null
          company_user_id?: string
          created_at?: string | null
          id?: string
          total_credits?: number | null
          updated_at?: string | null
          used_credits?: number | null
        }
        Relationships: []
      }
      compliance_documents: {
        Row: {
          content: string | null
          created_at: string
          document_type: string
          file_url: string | null
          id: string
          is_active: boolean
          title: string
          updated_at: string
          version: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          document_type: string
          file_url?: string | null
          id?: string
          is_active?: boolean
          title: string
          updated_at?: string
          version: string
        }
        Update: {
          content?: string | null
          created_at?: string
          document_type?: string
          file_url?: string | null
          id?: string
          is_active?: boolean
          title?: string
          updated_at?: string
          version?: string
        }
        Relationships: []
      }
      contracts: {
        Row: {
          client_id: string
          client_signature_data: Json | null
          client_signed_at: string | null
          contract_data: Json | null
          contract_type: string
          created_at: string
          document_url: string | null
          expert_id: string
          expert_signature_data: Json | null
          expert_signed_at: string | null
          expires_at: string | null
          id: string
          placement_id: string | null
          sent_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          client_id: string
          client_signature_data?: Json | null
          client_signed_at?: string | null
          contract_data?: Json | null
          contract_type: string
          created_at?: string
          document_url?: string | null
          expert_id: string
          expert_signature_data?: Json | null
          expert_signed_at?: string | null
          expires_at?: string | null
          id?: string
          placement_id?: string | null
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          client_signature_data?: Json | null
          client_signed_at?: string | null
          contract_data?: Json | null
          contract_type?: string
          created_at?: string
          document_url?: string | null
          expert_id?: string
          expert_signature_data?: Json | null
          expert_signed_at?: string | null
          expires_at?: string | null
          id?: string
          placement_id?: string | null
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contracts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_expert_id_fkey"
            columns: ["expert_id"]
            isOneToOne: false
            referencedRelation: "expert_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_expert_id_fkey"
            columns: ["expert_id"]
            isOneToOne: false
            referencedRelation: "expert_profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_placement_id_fkey"
            columns: ["placement_id"]
            isOneToOne: false
            referencedRelation: "placements"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          last_message_at: string | null
          participant_1_id: string
          participant_2_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_message_at?: string | null
          participant_1_id: string
          participant_2_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          last_message_at?: string | null
          participant_1_id?: string
          participant_2_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      dataset_exports: {
        Row: {
          client_id: string
          completed_at: string | null
          created_at: string
          download_url: string | null
          error_message: string | null
          expires_at: string | null
          export_blocked_reason: string | null
          file_path: string | null
          file_size_bytes: number | null
          format: string
          id: string
          include_raw_annotations: boolean | null
          include_reasoning: boolean | null
          min_alpha: number | null
          project_id: string
          status: string
          total_items: number | null
        }
        Insert: {
          client_id: string
          completed_at?: string | null
          created_at?: string
          download_url?: string | null
          error_message?: string | null
          expires_at?: string | null
          export_blocked_reason?: string | null
          file_path?: string | null
          file_size_bytes?: number | null
          format?: string
          id?: string
          include_raw_annotations?: boolean | null
          include_reasoning?: boolean | null
          min_alpha?: number | null
          project_id: string
          status?: string
          total_items?: number | null
        }
        Update: {
          client_id?: string
          completed_at?: string | null
          created_at?: string
          download_url?: string | null
          error_message?: string | null
          expires_at?: string | null
          export_blocked_reason?: string | null
          file_path?: string | null
          file_size_bytes?: number | null
          format?: string
          id?: string
          include_raw_annotations?: boolean | null
          include_reasoning?: boolean | null
          min_alpha?: number | null
          project_id?: string
          status?: string
          total_items?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "dataset_exports_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "annotation_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      drift_alerts: {
        Row: {
          acknowledged: boolean | null
          created_at: string | null
          drifting_dimensions: string[] | null
          id: string
          mean_alpha_current: number | null
          mean_alpha_previous: number | null
        }
        Insert: {
          acknowledged?: boolean | null
          created_at?: string | null
          drifting_dimensions?: string[] | null
          id?: string
          mean_alpha_current?: number | null
          mean_alpha_previous?: number | null
        }
        Update: {
          acknowledged?: boolean | null
          created_at?: string | null
          drifting_dimensions?: string[] | null
          id?: string
          mean_alpha_current?: number | null
          mean_alpha_previous?: number | null
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      enterprise_leads: {
        Row: {
          company: string
          consent_given: boolean
          contacted_at: string | null
          created_at: string
          email: string
          first_name: string
          id: string
          interests: string[] | null
          last_name: string
          message: string | null
          min_level: string
          notes: string | null
          positions_count: string
          role: string
          stacks: string[]
          status: string
          updated_at: string
        }
        Insert: {
          company: string
          consent_given?: boolean
          contacted_at?: string | null
          created_at?: string
          email: string
          first_name: string
          id?: string
          interests?: string[] | null
          last_name: string
          message?: string | null
          min_level?: string
          notes?: string | null
          positions_count?: string
          role: string
          stacks?: string[]
          status?: string
          updated_at?: string
        }
        Update: {
          company?: string
          consent_given?: boolean
          contacted_at?: string | null
          created_at?: string
          email?: string
          first_name?: string
          id?: string
          interests?: string[] | null
          last_name?: string
          message?: string | null
          min_level?: string
          notes?: string | null
          positions_count?: string
          role?: string
          stacks?: string[]
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      eor_commissions: {
        Row: {
          base_amount: number
          commission_amount: number | null
          commission_rate: number
          created_at: string | null
          eor_id: string
          id: string
          month: number
          notes: string | null
          placement_id: string
          received_at: string | null
          status: string | null
          year: number
        }
        Insert: {
          base_amount: number
          commission_amount?: number | null
          commission_rate: number
          created_at?: string | null
          eor_id: string
          id?: string
          month: number
          notes?: string | null
          placement_id: string
          received_at?: string | null
          status?: string | null
          year: number
        }
        Update: {
          base_amount?: number
          commission_amount?: number | null
          commission_rate?: number
          created_at?: string | null
          eor_id?: string
          id?: string
          month?: number
          notes?: string | null
          placement_id?: string
          received_at?: string | null
          status?: string | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "eor_commissions_eor_id_fkey"
            columns: ["eor_id"]
            isOneToOne: false
            referencedRelation: "eor_partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eor_commissions_placement_id_fkey"
            columns: ["placement_id"]
            isOneToOne: false
            referencedRelation: "placements"
            referencedColumns: ["id"]
          },
        ]
      }
      eor_partners: {
        Row: {
          commission_rate: number | null
          contact_email: string
          contact_phone: string | null
          contract_url: string | null
          country: string
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          notes: string | null
          payment_terms: number | null
          updated_at: string | null
        }
        Insert: {
          commission_rate?: number | null
          contact_email: string
          contact_phone?: string | null
          contract_url?: string | null
          country: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          notes?: string | null
          payment_terms?: number | null
          updated_at?: string | null
        }
        Update: {
          commission_rate?: number | null
          contact_email?: string
          contact_phone?: string | null
          contract_url?: string | null
          country?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          notes?: string | null
          payment_terms?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      expert_achievements: {
        Row: {
          achievement_icon: string | null
          achievement_key: string
          achievement_label: string
          id: string
          unlocked_at: string
          user_id: string
        }
        Insert: {
          achievement_icon?: string | null
          achievement_key: string
          achievement_label: string
          id?: string
          unlocked_at?: string
          user_id: string
        }
        Update: {
          achievement_icon?: string | null
          achievement_key?: string
          achievement_label?: string
          id?: string
          unlocked_at?: string
          user_id?: string
        }
        Relationships: []
      }
      expert_annotations: {
        Row: {
          annotation_data: Json
          annotation_type: string
          created_at: string | null
          dimensions: Json | null
          expert_id: string
          flaw_category: string | null
          flaw_severity: string | null
          id: string
          justification: string | null
          preference: string | null
          preference_reasoning: string | null
          reasoning: string | null
          sources: Json | null
          task_id: string
          time_spent_seconds: number | null
          verdict: string | null
        }
        Insert: {
          annotation_data?: Json
          annotation_type: string
          created_at?: string | null
          dimensions?: Json | null
          expert_id: string
          flaw_category?: string | null
          flaw_severity?: string | null
          id?: string
          justification?: string | null
          preference?: string | null
          preference_reasoning?: string | null
          reasoning?: string | null
          sources?: Json | null
          task_id: string
          time_spent_seconds?: number | null
          verdict?: string | null
        }
        Update: {
          annotation_data?: Json
          annotation_type?: string
          created_at?: string | null
          dimensions?: Json | null
          expert_id?: string
          flaw_category?: string | null
          flaw_severity?: string | null
          id?: string
          justification?: string | null
          preference?: string | null
          preference_reasoning?: string | null
          reasoning?: string | null
          sources?: Json | null
          task_id?: string
          time_spent_seconds?: number | null
          verdict?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expert_annotations_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "annotation_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      expert_availability: {
        Row: {
          availability_type: string
          created_at: string
          end_date: string
          expert_id: string
          id: string
          notes: string | null
          start_date: string
          updated_at: string
        }
        Insert: {
          availability_type?: string
          created_at?: string
          end_date: string
          expert_id: string
          id?: string
          notes?: string | null
          start_date: string
          updated_at?: string
        }
        Update: {
          availability_type?: string
          created_at?: string
          end_date?: string
          expert_id?: string
          id?: string
          notes?: string | null
          start_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expert_availability_expert_id_fkey"
            columns: ["expert_id"]
            isOneToOne: false
            referencedRelation: "expert_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expert_availability_expert_id_fkey"
            columns: ["expert_id"]
            isOneToOne: false
            referencedRelation: "expert_profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      expert_balances: {
        Row: {
          available_balance: number | null
          currency: string | null
          expert_id: string
          id: string
          pending_balance: number | null
          total_earned: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          available_balance?: number | null
          currency?: string | null
          expert_id: string
          id?: string
          pending_balance?: number | null
          total_earned?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          available_balance?: number | null
          currency?: string | null
          expert_id?: string
          id?: string
          pending_balance?: number | null
          total_earned?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      expert_bank_accounts: {
        Row: {
          account_holder: string
          bank_name: string | null
          bic: string | null
          created_at: string | null
          expert_id: string
          iban_encrypted: string
          updated_at: string | null
        }
        Insert: {
          account_holder: string
          bank_name?: string | null
          bic?: string | null
          created_at?: string | null
          expert_id: string
          iban_encrypted: string
          updated_at?: string | null
        }
        Update: {
          account_holder?: string
          bank_name?: string | null
          bic?: string | null
          created_at?: string | null
          expert_id?: string
          iban_encrypted?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expert_bank_accounts_expert_id_fkey"
            columns: ["expert_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      expert_education: {
        Row: {
          created_at: string | null
          degree_name: string
          expert_id: string
          id: string
          institution: string
          sort_order: number | null
          year: string | null
        }
        Insert: {
          created_at?: string | null
          degree_name: string
          expert_id: string
          id?: string
          institution: string
          sort_order?: number | null
          year?: string | null
        }
        Update: {
          created_at?: string | null
          degree_name?: string
          expert_id?: string
          id?: string
          institution?: string
          sort_order?: number | null
          year?: string | null
        }
        Relationships: []
      }
      expert_experience: {
        Row: {
          company: string
          created_at: string | null
          expert_id: string
          id: string
          job_title: string
          period: string
          sort_order: number | null
        }
        Insert: {
          company: string
          created_at?: string | null
          expert_id: string
          id?: string
          job_title: string
          period: string
          sort_order?: number | null
        }
        Update: {
          company?: string
          created_at?: string | null
          expert_id?: string
          id?: string
          job_title?: string
          period?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      expert_languages: {
        Row: {
          expert_id: string
          id: string
          language: string
          level: string
        }
        Insert: {
          expert_id: string
          id?: string
          language: string
          level?: string
        }
        Update: {
          expert_id?: string
          id?: string
          language?: string
          level?: string
        }
        Relationships: []
      }
      expert_payouts: {
        Row: {
          amount: number
          contract_id: string | null
          created_at: string
          description: string | null
          expert_id: string
          id: string
          payout_date: string | null
          status: string
          type: string
        }
        Insert: {
          amount: number
          contract_id?: string | null
          created_at?: string
          description?: string | null
          expert_id: string
          id?: string
          payout_date?: string | null
          status?: string
          type?: string
        }
        Update: {
          amount?: number
          contract_id?: string | null
          created_at?: string
          description?: string | null
          expert_id?: string
          id?: string
          payout_date?: string | null
          status?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "expert_payouts_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "placements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expert_payouts_expert_id_fkey"
            columns: ["expert_id"]
            isOneToOne: false
            referencedRelation: "expert_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expert_payouts_expert_id_fkey"
            columns: ["expert_id"]
            isOneToOne: false
            referencedRelation: "expert_profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      expert_profiles: {
        Row: {
          availability: string
          avatar_url: string | null
          bio: string | null
          city: string
          contract_types: string[]
          country: string
          created_at: string | null
          cv_filename: string | null
          cv_url: string | null
          daily_rate: number | null
          email: string
          email_notifications: boolean | null
          full_name: string
          github_url: string | null
          id: string
          kyc_documents: Json | null
          kyc_rejection_reason: string | null
          kyc_status: string
          kyc_submitted_at: string | null
          kyc_verified_at: string | null
          languages: string[] | null
          linkedin_url: string | null
          notify_application_updates: boolean | null
          notify_job_matches: boolean | null
          onboarding_completed: boolean | null
          payment_method_connected: boolean | null
          phone: string | null
          phone_number_sms: string | null
          portfolio_url: string | null
          primary_skills: string[]
          profile_visible: boolean | null
          referral_code: string | null
          secondary_skills: string[] | null
          sms_notifications: boolean | null
          title: string
          updated_at: string | null
          user_id: string
          work_type: string[]
          years_of_experience: number
        }
        Insert: {
          availability: string
          avatar_url?: string | null
          bio?: string | null
          city: string
          contract_types?: string[]
          country: string
          created_at?: string | null
          cv_filename?: string | null
          cv_url?: string | null
          daily_rate?: number | null
          email: string
          email_notifications?: boolean | null
          full_name: string
          github_url?: string | null
          id?: string
          kyc_documents?: Json | null
          kyc_rejection_reason?: string | null
          kyc_status?: string
          kyc_submitted_at?: string | null
          kyc_verified_at?: string | null
          languages?: string[] | null
          linkedin_url?: string | null
          notify_application_updates?: boolean | null
          notify_job_matches?: boolean | null
          onboarding_completed?: boolean | null
          payment_method_connected?: boolean | null
          phone?: string | null
          phone_number_sms?: string | null
          portfolio_url?: string | null
          primary_skills?: string[]
          profile_visible?: boolean | null
          referral_code?: string | null
          secondary_skills?: string[] | null
          sms_notifications?: boolean | null
          title: string
          updated_at?: string | null
          user_id: string
          work_type?: string[]
          years_of_experience: number
        }
        Update: {
          availability?: string
          avatar_url?: string | null
          bio?: string | null
          city?: string
          contract_types?: string[]
          country?: string
          created_at?: string | null
          cv_filename?: string | null
          cv_url?: string | null
          daily_rate?: number | null
          email?: string
          email_notifications?: boolean | null
          full_name?: string
          github_url?: string | null
          id?: string
          kyc_documents?: Json | null
          kyc_rejection_reason?: string | null
          kyc_status?: string
          kyc_submitted_at?: string | null
          kyc_verified_at?: string | null
          languages?: string[] | null
          linkedin_url?: string | null
          notify_application_updates?: boolean | null
          notify_job_matches?: boolean | null
          onboarding_completed?: boolean | null
          payment_method_connected?: boolean | null
          phone?: string | null
          phone_number_sms?: string | null
          portfolio_url?: string | null
          primary_skills?: string[]
          profile_visible?: boolean | null
          referral_code?: string | null
          secondary_skills?: string[] | null
          sms_notifications?: boolean | null
          title?: string
          updated_at?: string | null
          user_id?: string
          work_type?: string[]
          years_of_experience?: number
        }
        Relationships: []
      }
      expert_referrals: {
        Row: {
          assessment_completed_at: string | null
          assessment_level: string | null
          assessment_score: number | null
          assessment_started_at: string | null
          bonus_amount: number | null
          bonus_paid_at: string | null
          certificate_id: string | null
          certified_at: string | null
          country: string | null
          created_at: string
          current_step: string
          first_mission_at: string | null
          hired_at: string | null
          id: string
          invite_channel: string | null
          last_nudge_at: string | null
          link_clicked_at: string | null
          nudges_sent: number
          profile_completed_at: string | null
          referee_points_awarded: Json
          referred_email: string
          referred_name: string | null
          referred_user_id: string | null
          referrer_cash_awarded: Json
          referrer_id: string
          referrer_points_awarded: Json
          status: string
        }
        Insert: {
          assessment_completed_at?: string | null
          assessment_level?: string | null
          assessment_score?: number | null
          assessment_started_at?: string | null
          bonus_amount?: number | null
          bonus_paid_at?: string | null
          certificate_id?: string | null
          certified_at?: string | null
          country?: string | null
          created_at?: string
          current_step?: string
          first_mission_at?: string | null
          hired_at?: string | null
          id?: string
          invite_channel?: string | null
          last_nudge_at?: string | null
          link_clicked_at?: string | null
          nudges_sent?: number
          profile_completed_at?: string | null
          referee_points_awarded?: Json
          referred_email: string
          referred_name?: string | null
          referred_user_id?: string | null
          referrer_cash_awarded?: Json
          referrer_id: string
          referrer_points_awarded?: Json
          status?: string
        }
        Update: {
          assessment_completed_at?: string | null
          assessment_level?: string | null
          assessment_score?: number | null
          assessment_started_at?: string | null
          bonus_amount?: number | null
          bonus_paid_at?: string | null
          certificate_id?: string | null
          certified_at?: string | null
          country?: string | null
          created_at?: string
          current_step?: string
          first_mission_at?: string | null
          hired_at?: string | null
          id?: string
          invite_channel?: string | null
          last_nudge_at?: string | null
          link_clicked_at?: string | null
          nudges_sent?: number
          profile_completed_at?: string | null
          referee_points_awarded?: Json
          referred_email?: string
          referred_name?: string | null
          referred_user_id?: string | null
          referrer_cash_awarded?: Json
          referrer_id?: string
          referrer_points_awarded?: Json
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "expert_referrals_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "expert_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expert_referrals_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "expert_profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      expert_stripe_accounts: {
        Row: {
          charges_enabled: boolean | null
          country: string | null
          created_at: string | null
          currency: string | null
          expert_id: string
          id: string
          onboarding_complete: boolean | null
          payouts_enabled: boolean | null
          stripe_account_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          charges_enabled?: boolean | null
          country?: string | null
          created_at?: string | null
          currency?: string | null
          expert_id: string
          id?: string
          onboarding_complete?: boolean | null
          payouts_enabled?: boolean | null
          stripe_account_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          charges_enabled?: boolean | null
          country?: string | null
          created_at?: string | null
          currency?: string | null
          expert_id?: string
          id?: string
          onboarding_complete?: boolean | null
          payouts_enabled?: boolean | null
          stripe_account_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      expert_transactions: {
        Row: {
          amount: number
          created_at: string | null
          description: string | null
          expert_id: string
          id: string
          status: string | null
          stripe_transfer_id: string | null
          task_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          description?: string | null
          expert_id: string
          id?: string
          status?: string | null
          stripe_transfer_id?: string | null
          task_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          description?: string | null
          expert_id?: string
          id?: string
          status?: string | null
          stripe_transfer_id?: string | null
          task_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      expert_weekly_schedule: {
        Row: {
          expert_id: string
          id: string
          schedule: Json
          timezone: string
        }
        Insert: {
          expert_id: string
          id?: string
          schedule?: Json
          timezone?: string
        }
        Update: {
          expert_id?: string
          id?: string
          schedule?: Json
          timezone?: string
        }
        Relationships: []
      }
      extraction_schemas: {
        Row: {
          created_at: string | null
          created_by: string | null
          domain: string | null
          id: string
          is_default: boolean | null
          name: string
          schema: Json
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          domain?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          schema?: Json
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          domain?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          schema?: Json
        }
        Relationships: []
      }
      final_annotations: {
        Row: {
          alpha: number | null
          created_at: string | null
          final_data: Json
          id: string
          resolution_method: string | null
          source_annotation_ids: string[] | null
          task_id: string
        }
        Insert: {
          alpha?: number | null
          created_at?: string | null
          final_data: Json
          id?: string
          resolution_method?: string | null
          source_annotation_ids?: string[] | null
          task_id: string
        }
        Update: {
          alpha?: number | null
          created_at?: string | null
          final_data?: Json
          id?: string
          resolution_method?: string | null
          source_annotation_ids?: string[] | null
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "final_annotations_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: true
            referencedRelation: "annotation_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      fraud_events: {
        Row: {
          action_taken: string | null
          created_at: string | null
          details: Json | null
          event_type: string
          expert_id: string
          id: string
          resolved: boolean | null
          resolved_by: string | null
          severity: string
        }
        Insert: {
          action_taken?: string | null
          created_at?: string | null
          details?: Json | null
          event_type: string
          expert_id: string
          id?: string
          resolved?: boolean | null
          resolved_by?: string | null
          severity: string
        }
        Update: {
          action_taken?: string | null
          created_at?: string | null
          details?: Json | null
          event_type?: string
          expert_id?: string
          id?: string
          resolved?: boolean | null
          resolved_by?: string | null
          severity?: string
        }
        Relationships: []
      }
      funnel_events: {
        Row: {
          country: string | null
          created_at: string | null
          device_type: string | null
          event_data: Json | null
          event_type: string
          id: string
          page_url: string | null
          session_id: string | null
          user_id: string | null
        }
        Insert: {
          country?: string | null
          created_at?: string | null
          device_type?: string | null
          event_data?: Json | null
          event_type: string
          id?: string
          page_url?: string | null
          session_id?: string | null
          user_id?: string | null
        }
        Update: {
          country?: string | null
          created_at?: string | null
          device_type?: string | null
          event_data?: Json | null
          event_type?: string
          id?: string
          page_url?: string | null
          session_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      human_review_queue: {
        Row: {
          alpha: number | null
          assigned_to: string | null
          candidate_id: string | null
          completed_at: string | null
          created_at: string
          human_annotation: Json | null
          id: string
          priority: string
          reason: Json | null
          status: string
          task_id: string | null
        }
        Insert: {
          alpha?: number | null
          assigned_to?: string | null
          candidate_id?: string | null
          completed_at?: string | null
          created_at?: string
          human_annotation?: Json | null
          id?: string
          priority?: string
          reason?: Json | null
          status?: string
          task_id?: string | null
        }
        Update: {
          alpha?: number | null
          assigned_to?: string | null
          candidate_id?: string | null
          completed_at?: string | null
          created_at?: string
          human_annotation?: Json | null
          id?: string
          priority?: string
          reason?: Json | null
          status?: string
          task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "human_review_queue_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "annotator_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "human_review_queue_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "annotation_items"
            referencedColumns: ["id"]
          },
        ]
      }
      identity_unlock_requests: {
        Row: {
          anonymized_candidate_id: string
          company_user_id: string
          created_at: string | null
          id: string
          payment_status: string | null
          rejection_reason: string | null
          request_reason: string | null
          requested_at: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          stripe_payment_id: string | null
          unlock_fee: number | null
          unlocked_at: string | null
          updated_at: string | null
        }
        Insert: {
          anonymized_candidate_id: string
          company_user_id: string
          created_at?: string | null
          id?: string
          payment_status?: string | null
          rejection_reason?: string | null
          request_reason?: string | null
          requested_at?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          stripe_payment_id?: string | null
          unlock_fee?: number | null
          unlocked_at?: string | null
          updated_at?: string | null
        }
        Update: {
          anonymized_candidate_id?: string
          company_user_id?: string
          created_at?: string | null
          id?: string
          payment_status?: string | null
          rejection_reason?: string | null
          request_reason?: string | null
          requested_at?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          stripe_payment_id?: string | null
          unlock_fee?: number | null
          unlocked_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "identity_unlock_requests_anonymized_candidate_id_fkey"
            columns: ["anonymized_candidate_id"]
            isOneToOne: false
            referencedRelation: "anonymized_candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      impersonation_sessions: {
        Row: {
          admin_id: string | null
          created_at: string | null
          expires_at: string
          id: string
          target_type: string | null
          target_user_id: string | null
          token: string
        }
        Insert: {
          admin_id?: string | null
          created_at?: string | null
          expires_at: string
          id?: string
          target_type?: string | null
          target_user_id?: string | null
          token: string
        }
        Update: {
          admin_id?: string | null
          created_at?: string | null
          expires_at?: string
          id?: string
          target_type?: string | null
          target_user_id?: string | null
          token?: string
        }
        Relationships: []
      }
      invoices: {
        Row: {
          bank_transfer_reference: string | null
          client_address: string | null
          client_id: string | null
          client_name: string
          client_siret: string | null
          client_tva_number: string | null
          created_at: string | null
          currency: string | null
          domain: string
          due_date: string | null
          id: string
          invoice_amount_ht: number
          invoice_amount_ttc: number
          invoice_number: string
          issued_at: string | null
          language: string
          manually_confirmed_at: string | null
          manually_confirmed_by: string | null
          num_tasks: number
          paid_at: string | null
          payment_id: string | null
          payment_method: string | null
          payment_type: string
          pdf_generated_at: string | null
          pdf_storage_path: string | null
          percentage: number
          previous_payments: Json | null
          project_id: string | null
          project_name: string
          project_total_ht: number
          reminders_sent: number | null
          sla_multiplier: number | null
          sla_tier: string
          status: string | null
          task_type: string
          tva_amount: number
          tva_mention: string
          tva_rate: number
          tva_regime: string
          unit_price_ht: number
          volume_discount_percent: number | null
        }
        Insert: {
          bank_transfer_reference?: string | null
          client_address?: string | null
          client_id?: string | null
          client_name?: string
          client_siret?: string | null
          client_tva_number?: string | null
          created_at?: string | null
          currency?: string | null
          domain?: string
          due_date?: string | null
          id?: string
          invoice_amount_ht: number
          invoice_amount_ttc: number
          invoice_number: string
          issued_at?: string | null
          language?: string
          manually_confirmed_at?: string | null
          manually_confirmed_by?: string | null
          num_tasks?: number
          paid_at?: string | null
          payment_id?: string | null
          payment_method?: string | null
          payment_type: string
          pdf_generated_at?: string | null
          pdf_storage_path?: string | null
          percentage: number
          previous_payments?: Json | null
          project_id?: string | null
          project_name?: string
          project_total_ht: number
          reminders_sent?: number | null
          sla_multiplier?: number | null
          sla_tier?: string
          status?: string | null
          task_type?: string
          tva_amount?: number
          tva_mention?: string
          tva_rate?: number
          tva_regime?: string
          unit_price_ht?: number
          volume_discount_percent?: number | null
        }
        Update: {
          bank_transfer_reference?: string | null
          client_address?: string | null
          client_id?: string | null
          client_name?: string
          client_siret?: string | null
          client_tva_number?: string | null
          created_at?: string | null
          currency?: string | null
          domain?: string
          due_date?: string | null
          id?: string
          invoice_amount_ht?: number
          invoice_amount_ttc?: number
          invoice_number?: string
          issued_at?: string | null
          language?: string
          manually_confirmed_at?: string | null
          manually_confirmed_by?: string | null
          num_tasks?: number
          paid_at?: string | null
          payment_id?: string | null
          payment_method?: string | null
          payment_type?: string
          pdf_generated_at?: string | null
          pdf_storage_path?: string | null
          percentage?: number
          previous_payments?: Json | null
          project_id?: string | null
          project_name?: string
          project_total_ht?: number
          reminders_sent?: number | null
          sla_multiplier?: number | null
          sla_tier?: string
          status?: string | null
          task_type?: string
          tva_amount?: number
          tva_mention?: string
          tva_rate?: number
          tva_regime?: string
          unit_price_ht?: number
          volume_discount_percent?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "project_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "annotation_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      item_assignments: {
        Row: {
          annotator_id: string
          assigned_at: string
          completed_at: string | null
          created_at: string
          deadline: string | null
          id: string
          item_id: string
          project_id: string
          started_at: string | null
          status: Database["public"]["Enums"]["assignment_status"]
        }
        Insert: {
          annotator_id: string
          assigned_at?: string
          completed_at?: string | null
          created_at?: string
          deadline?: string | null
          id?: string
          item_id: string
          project_id: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["assignment_status"]
        }
        Update: {
          annotator_id?: string
          assigned_at?: string
          completed_at?: string | null
          created_at?: string
          deadline?: string | null
          id?: string
          item_id?: string
          project_id?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["assignment_status"]
        }
        Relationships: [
          {
            foreignKeyName: "item_assignments_annotator_id_fkey"
            columns: ["annotator_id"]
            isOneToOne: false
            referencedRelation: "annotator_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_assignments_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "annotation_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_assignments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "annotation_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      job_applications: {
        Row: {
          applied_at: string
          expert_id: string
          id: string
          job_offer_id: string
          notes: string | null
          status: string
          updated_at: string
        }
        Insert: {
          applied_at?: string
          expert_id: string
          id?: string
          job_offer_id: string
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          applied_at?: string
          expert_id?: string
          id?: string
          job_offer_id?: string
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_applications_expert_id_fkey"
            columns: ["expert_id"]
            isOneToOne: false
            referencedRelation: "expert_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_applications_expert_id_fkey"
            columns: ["expert_id"]
            isOneToOne: false
            referencedRelation: "expert_profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_applications_job_offer_id_fkey"
            columns: ["job_offer_id"]
            isOneToOne: false
            referencedRelation: "job_offers"
            referencedColumns: ["id"]
          },
        ]
      }
      job_offers: {
        Row: {
          company_id: string
          created_at: string | null
          description: string
          id: string
          requirements: Json
          status: string | null
          title: string
          user_id: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          description: string
          id?: string
          requirements: Json
          status?: string | null
          title: string
          user_id?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          description?: string
          id?: string
          requirements?: Json
          status?: string | null
          title?: string
          user_id?: string | null
        }
        Relationships: []
      }
      label_sets: {
        Row: {
          created_at: string | null
          created_by: string | null
          domain: string | null
          id: string
          is_default: boolean | null
          labels: Json
          name: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          domain?: string | null
          id?: string
          is_default?: boolean | null
          labels?: Json
          name: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          domain?: string | null
          id?: string
          is_default?: boolean | null
          labels?: Json
          name?: string
        }
        Relationships: []
      }
      leads: {
        Row: {
          city: string | null
          contact_method: string
          converted_at: string | null
          converted_to_user_id: string | null
          country: string | null
          created_at: string | null
          device_type: string | null
          email: string | null
          first_name: string
          id: string
          last_contacted_at: string | null
          notes: string | null
          quiz_level: string | null
          quiz_result_id: string | null
          quiz_score: number | null
          source: string
          specialty: string | null
          status: string
          updated_at: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          whatsapp: string | null
        }
        Insert: {
          city?: string | null
          contact_method?: string
          converted_at?: string | null
          converted_to_user_id?: string | null
          country?: string | null
          created_at?: string | null
          device_type?: string | null
          email?: string | null
          first_name: string
          id?: string
          last_contacted_at?: string | null
          notes?: string | null
          quiz_level?: string | null
          quiz_result_id?: string | null
          quiz_score?: number | null
          source?: string
          specialty?: string | null
          status?: string
          updated_at?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          whatsapp?: string | null
        }
        Update: {
          city?: string | null
          contact_method?: string
          converted_at?: string | null
          converted_to_user_id?: string | null
          country?: string | null
          created_at?: string | null
          device_type?: string | null
          email?: string | null
          first_name?: string
          id?: string
          last_contacted_at?: string | null
          notes?: string | null
          quiz_level?: string | null
          quiz_result_id?: string | null
          quiz_score?: number | null
          source?: string
          specialty?: string | null
          status?: string
          updated_at?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      legal_acceptances: {
        Row: {
          accepted_at: string | null
          document_type: string
          document_version: string
          id: string
          ip_address: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          accepted_at?: string | null
          document_type: string
          document_version: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          accepted_at?: string | null
          document_type?: string
          document_version?: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      legal_documents: {
        Row: {
          document_type: string
          id: string
          is_current: boolean | null
          published_at: string | null
          title: string
          version: string
        }
        Insert: {
          document_type: string
          id?: string
          is_current?: boolean | null
          published_at?: string | null
          title: string
          version: string
        }
        Update: {
          document_type?: string
          id?: string
          is_current?: boolean | null
          published_at?: string | null
          title?: string
          version?: string
        }
        Relationships: []
      }
      llm_call_logs: {
        Row: {
          cost_usd: number | null
          created_at: string | null
          error_message: string | null
          id: string
          input_tokens: number | null
          latency_ms: number | null
          mode: string | null
          model_id: string
          model_name: string
          output_tokens: number | null
          project_id: string | null
          provider: string
          purpose: string
          success: boolean | null
          task_id: string | null
          temperature: number | null
          tier: number | null
        }
        Insert: {
          cost_usd?: number | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          input_tokens?: number | null
          latency_ms?: number | null
          mode?: string | null
          model_id: string
          model_name: string
          output_tokens?: number | null
          project_id?: string | null
          provider: string
          purpose: string
          success?: boolean | null
          task_id?: string | null
          temperature?: number | null
          tier?: number | null
        }
        Update: {
          cost_usd?: number | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          input_tokens?: number | null
          latency_ms?: number | null
          mode?: string | null
          model_id?: string
          model_name?: string
          output_tokens?: number | null
          project_id?: string | null
          provider?: string
          purpose?: string
          success?: boolean | null
          task_id?: string | null
          temperature?: number | null
          tier?: number | null
        }
        Relationships: []
      }
      llm_model_config: {
        Row: {
          active: boolean | null
          cost_per_1k_input: number
          cost_per_1k_output: number
          created_at: string | null
          display_name: string
          id: string
          max_tokens: number | null
          mode: string
          model_id: string
          provider: string
          temperature: number | null
          tier: number
          timeout_ms: number | null
        }
        Insert: {
          active?: boolean | null
          cost_per_1k_input: number
          cost_per_1k_output: number
          created_at?: string | null
          display_name: string
          id?: string
          max_tokens?: number | null
          mode: string
          model_id: string
          provider: string
          temperature?: number | null
          tier: number
          timeout_ms?: number | null
        }
        Update: {
          active?: boolean | null
          cost_per_1k_input?: number
          cost_per_1k_output?: number
          created_at?: string | null
          display_name?: string
          id?: string
          max_tokens?: number | null
          mode?: string
          model_id?: string
          provider?: string
          temperature?: number | null
          tier?: number
          timeout_ms?: number | null
        }
        Relationships: []
      }
      marketing_spend: {
        Row: {
          channel: string
          clients_acquired: number
          created_at: string
          id: string
          leads_generated: number
          month: string
          spend_amount: number
        }
        Insert: {
          channel: string
          clients_acquired?: number
          created_at?: string
          id?: string
          leads_generated?: number
          month: string
          spend_amount?: number
        }
        Update: {
          channel?: string
          clients_acquired?: number
          created_at?: string
          id?: string
          leads_generated?: number
          month?: string
          spend_amount?: number
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          is_read: boolean
          sender_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          is_read?: boolean
          sender_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          is_read?: boolean
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_reports: {
        Row: {
          created_at: string | null
          data: Json
          id: string
          month: string
        }
        Insert: {
          created_at?: string | null
          data: Json
          id?: string
          month: string
        }
        Update: {
          created_at?: string | null
          data?: Json
          id?: string
          month?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          message: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message: string
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      performance_reports: {
        Row: {
          client_id: string
          generated_at: string | null
          id: string
          metrics: Json
          pdf_storage_path: string | null
          project_id: string
          report_type: string
        }
        Insert: {
          client_id: string
          generated_at?: string | null
          id?: string
          metrics?: Json
          pdf_storage_path?: string | null
          project_id: string
          report_type: string
        }
        Update: {
          client_id?: string
          generated_at?: string | null
          id?: string
          metrics?: Json
          pdf_storage_path?: string | null
          project_id?: string
          report_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "performance_reports_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "annotation_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      pii_logs: {
        Row: {
          candidate_id: string | null
          categories: string[] | null
          client_id: string | null
          context: string | null
          created_at: string
          id: string
          items_count: number
          pii_type: string | null
          task_id: string | null
        }
        Insert: {
          candidate_id?: string | null
          categories?: string[] | null
          client_id?: string | null
          context?: string | null
          created_at?: string
          id?: string
          items_count?: number
          pii_type?: string | null
          task_id?: string | null
        }
        Update: {
          candidate_id?: string | null
          categories?: string[] | null
          client_id?: string | null
          context?: string | null
          created_at?: string
          id?: string
          items_count?: number
          pii_type?: string | null
          task_id?: string | null
        }
        Relationships: []
      }
      placements: {
        Row: {
          client_daily_rate: number
          client_id: string
          created_at: string | null
          description: string | null
          end_date: string | null
          eor_daily_cost: number | null
          eor_id: string | null
          expert_daily_rate: number
          expert_id: string
          id: string
          location: string | null
          notes: string | null
          start_date: string
          status: string | null
          stef_margin: number | null
          title: string
          updated_at: string | null
          work_type: string | null
        }
        Insert: {
          client_daily_rate: number
          client_id: string
          created_at?: string | null
          description?: string | null
          end_date?: string | null
          eor_daily_cost?: number | null
          eor_id?: string | null
          expert_daily_rate: number
          expert_id: string
          id?: string
          location?: string | null
          notes?: string | null
          start_date: string
          status?: string | null
          stef_margin?: number | null
          title: string
          updated_at?: string | null
          work_type?: string | null
        }
        Update: {
          client_daily_rate?: number
          client_id?: string
          created_at?: string | null
          description?: string | null
          end_date?: string | null
          eor_daily_cost?: number | null
          eor_id?: string | null
          expert_daily_rate?: number
          expert_id?: string
          id?: string
          location?: string | null
          notes?: string | null
          start_date?: string
          status?: string | null
          stef_margin?: number | null
          title?: string
          updated_at?: string | null
          work_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "placements_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "placements_eor_id_fkey"
            columns: ["eor_id"]
            isOneToOne: false
            referencedRelation: "eor_partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "placements_expert_id_fkey"
            columns: ["expert_id"]
            isOneToOne: false
            referencedRelation: "expert_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "placements_expert_id_fkey"
            columns: ["expert_id"]
            isOneToOne: false
            referencedRelation: "expert_profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_metrics_history: {
        Row: {
          created_at: string
          id: string
          metric_date: string
          metric_type: string
          metric_value: number
          segment: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          metric_date: string
          metric_type: string
          metric_value: number
          segment?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          metric_date?: string
          metric_type?: string
          metric_value?: number
          segment?: string | null
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          key: string
          updated_at: string | null
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string | null
          updated_by?: string | null
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string | null
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      platform_stats: {
        Row: {
          display_order: number | null
          display_suffix: string | null
          id: string
          is_visible: boolean | null
          stat_key: string
          stat_label: string
          stat_value: number
          updated_at: string | null
        }
        Insert: {
          display_order?: number | null
          display_suffix?: string | null
          id?: string
          is_visible?: boolean | null
          stat_key: string
          stat_label: string
          stat_value?: number
          updated_at?: string | null
        }
        Update: {
          display_order?: number | null
          display_suffix?: string | null
          id?: string
          is_visible?: boolean | null
          stat_key?: string
          stat_label?: string
          stat_value?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      pricing_leads: {
        Row: {
          created_at: string
          domain: string
          email: string
          estimated_price_high: number
          estimated_price_low: number
          id: string
          ip_address: string | null
          mode: string
          sla: string
          source: string
          status: string
          user_agent: string | null
          volume: number
        }
        Insert: {
          created_at?: string
          domain: string
          email: string
          estimated_price_high: number
          estimated_price_low: number
          id?: string
          ip_address?: string | null
          mode: string
          sla: string
          source?: string
          status?: string
          user_agent?: string | null
          volume: number
        }
        Update: {
          created_at?: string
          domain?: string
          email?: string
          estimated_price_high?: number
          estimated_price_low?: number
          id?: string
          ip_address?: string | null
          mode?: string
          sla?: string
          source?: string
          status?: string
          user_agent?: string | null
          volume?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          company_name: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          last_active_at: string | null
          last_ip_address: string | null
          last_user_agent: string | null
          onboarding_completed: boolean | null
          onboarding_step: string | null
          phone: string | null
          selected_specialty: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          company_name?: string | null
          created_at?: string
          email: string
          full_name: string
          id?: string
          last_active_at?: string | null
          last_ip_address?: string | null
          last_user_agent?: string | null
          onboarding_completed?: boolean | null
          onboarding_step?: string | null
          phone?: string | null
          selected_specialty?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          company_name?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          last_active_at?: string | null
          last_ip_address?: string | null
          last_user_agent?: string | null
          onboarding_completed?: boolean | null
          onboarding_step?: string | null
          phone?: string | null
          selected_specialty?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      project_onboarding: {
        Row: {
          annotator_id: string
          calibration_score: number | null
          certified_at: string | null
          guidelines_version: string
          id: string
          probation_accuracy: number | null
          probation_items_reviewed: number
          project_id: string
          quiz_score: number | null
          started_at: string
          status: string
        }
        Insert: {
          annotator_id: string
          calibration_score?: number | null
          certified_at?: string | null
          guidelines_version?: string
          id?: string
          probation_accuracy?: number | null
          probation_items_reviewed?: number
          project_id: string
          quiz_score?: number | null
          started_at?: string
          status?: string
        }
        Update: {
          annotator_id?: string
          calibration_score?: number | null
          certified_at?: string | null
          guidelines_version?: string
          id?: string
          probation_accuracy?: number | null
          probation_items_reviewed?: number
          project_id?: string
          quiz_score?: number | null
          started_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_onboarding_annotator_id_fkey"
            columns: ["annotator_id"]
            isOneToOne: false
            referencedRelation: "annotator_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_onboarding_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "annotation_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_payments: {
        Row: {
          amount: number
          client_id: string | null
          created_at: string | null
          currency: string | null
          due_date: string | null
          id: string
          overdue_since: string | null
          paid_at: string | null
          payment_type: string
          percentage: number
          project_id: string | null
          project_paused: boolean | null
          reminder_sent: boolean | null
          status: string | null
          stripe_checkout_session_id: string | null
          stripe_invoice_id: string | null
          stripe_payment_intent_id: string | null
          trigger_condition: string | null
          triggered: boolean | null
          triggered_at: string | null
        }
        Insert: {
          amount: number
          client_id?: string | null
          created_at?: string | null
          currency?: string | null
          due_date?: string | null
          id?: string
          overdue_since?: string | null
          paid_at?: string | null
          payment_type: string
          percentage: number
          project_id?: string | null
          project_paused?: boolean | null
          reminder_sent?: boolean | null
          status?: string | null
          stripe_checkout_session_id?: string | null
          stripe_invoice_id?: string | null
          stripe_payment_intent_id?: string | null
          trigger_condition?: string | null
          triggered?: boolean | null
          triggered_at?: string | null
        }
        Update: {
          amount?: number
          client_id?: string | null
          created_at?: string | null
          currency?: string | null
          due_date?: string | null
          id?: string
          overdue_since?: string | null
          paid_at?: string | null
          payment_type?: string
          percentage?: number
          project_id?: string | null
          project_paused?: boolean | null
          reminder_sent?: boolean | null
          status?: string | null
          stripe_checkout_session_id?: string | null
          stripe_invoice_id?: string | null
          stripe_payment_intent_id?: string | null
          trigger_condition?: string | null
          triggered?: boolean | null
          triggered_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_payments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_payments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "annotation_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      prompt_versions: {
        Row: {
          changes_made: Json | null
          created_at: string
          icl_examples: Json | null
          id: string
          optimization_reasoning: string | null
          performance_metrics: Json | null
          prompt_text: string
          status: string
          version: string
        }
        Insert: {
          changes_made?: Json | null
          created_at?: string
          icl_examples?: Json | null
          id?: string
          optimization_reasoning?: string | null
          performance_metrics?: Json | null
          prompt_text: string
          status?: string
          version: string
        }
        Update: {
          changes_made?: Json | null
          created_at?: string
          icl_examples?: Json | null
          id?: string
          optimization_reasoning?: string | null
          performance_metrics?: Json | null
          prompt_text?: string
          status?: string
          version?: string
        }
        Relationships: []
      }
      quiz_questions: {
        Row: {
          correct_answer: string
          created_at: string
          difficulty: number
          domain: string
          explanation: string | null
          id: string
          is_active: boolean
          options: Json
          question: string
          stack: string
          tags: string[] | null
          time_limit: number
          updated_at: string
        }
        Insert: {
          correct_answer: string
          created_at?: string
          difficulty: number
          domain: string
          explanation?: string | null
          id?: string
          is_active?: boolean
          options?: Json
          question: string
          stack: string
          tags?: string[] | null
          time_limit?: number
          updated_at?: string
        }
        Update: {
          correct_answer?: string
          created_at?: string
          difficulty?: number
          domain?: string
          explanation?: string | null
          id?: string
          is_active?: boolean
          options?: Json
          question?: string
          stack?: string
          tags?: string[] | null
          time_limit?: number
          updated_at?: string
        }
        Relationships: []
      }
      quiz_results: {
        Row: {
          anonymous_id: string | null
          answers: Json
          contact_email: string | null
          contact_method: string | null
          contact_whatsapp: string | null
          created_at: string | null
          id: string
          results_sent_at: string | null
          results_viewed: boolean | null
          score: number
          specialty: string
          total_time_seconds: number | null
          user_id: string | null
        }
        Insert: {
          anonymous_id?: string | null
          answers?: Json
          contact_email?: string | null
          contact_method?: string | null
          contact_whatsapp?: string | null
          created_at?: string | null
          id?: string
          results_sent_at?: string | null
          results_viewed?: boolean | null
          score: number
          specialty: string
          total_time_seconds?: number | null
          user_id?: string | null
        }
        Update: {
          anonymous_id?: string | null
          answers?: Json
          contact_email?: string | null
          contact_method?: string | null
          contact_whatsapp?: string | null
          created_at?: string | null
          id?: string
          results_sent_at?: string | null
          results_viewed?: boolean | null
          score?: number
          specialty?: string
          total_time_seconds?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      quote_requests: {
        Row: {
          company: string
          created_at: string | null
          domain: string | null
          email: string
          estimated_volume: string | null
          id: string
          message: string | null
          name: string
          plan: string | null
          status: string | null
        }
        Insert: {
          company: string
          created_at?: string | null
          domain?: string | null
          email: string
          estimated_volume?: string | null
          id?: string
          message?: string | null
          name: string
          plan?: string | null
          status?: string | null
        }
        Update: {
          company?: string
          created_at?: string | null
          domain?: string | null
          email?: string
          estimated_volume?: string | null
          id?: string
          message?: string | null
          name?: string
          plan?: string | null
          status?: string | null
        }
        Relationships: []
      }
      referral_abuse_flags: {
        Row: {
          created_at: string
          details: Json | null
          flag_type: string
          id: string
          referral_id: string | null
          referrer_id: string | null
          resolved: boolean
          resolved_at: string | null
          resolved_by: string | null
        }
        Insert: {
          created_at?: string
          details?: Json | null
          flag_type: string
          id?: string
          referral_id?: string | null
          referrer_id?: string | null
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
        }
        Update: {
          created_at?: string
          details?: Json | null
          flag_type?: string
          id?: string
          referral_id?: string | null
          referrer_id?: string | null
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "referral_abuse_flags_referral_id_fkey"
            columns: ["referral_id"]
            isOneToOne: false
            referencedRelation: "expert_referrals"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_analytics_snapshots: {
        Row: {
          channel_breakdown: Json
          country_breakdown: Json
          created_at: string
          id: string
          k_factor: number | null
          period_end: string
          period_start: string
          total_assessments_completed: number
          total_certified: number
          total_clicks: number
          total_invites: number
          total_missions: number
          total_profiles_completed: number
          total_registrations: number
          total_rewards_distributed: number
        }
        Insert: {
          channel_breakdown?: Json
          country_breakdown?: Json
          created_at?: string
          id?: string
          k_factor?: number | null
          period_end: string
          period_start: string
          total_assessments_completed?: number
          total_certified?: number
          total_clicks?: number
          total_invites?: number
          total_missions?: number
          total_profiles_completed?: number
          total_registrations?: number
          total_rewards_distributed?: number
        }
        Update: {
          channel_breakdown?: Json
          country_breakdown?: Json
          created_at?: string
          id?: string
          k_factor?: number | null
          period_end?: string
          period_start?: string
          total_assessments_completed?: number
          total_certified?: number
          total_clicks?: number
          total_invites?: number
          total_missions?: number
          total_profiles_completed?: number
          total_registrations?: number
          total_rewards_distributed?: number
        }
        Relationships: []
      }
      referral_nudges: {
        Row: {
          channel: string
          id: string
          message: string | null
          nudge_type: string
          referee_email: string
          referral_id: string
          referrer_id: string
          sent_at: string
          template_id: string | null
        }
        Insert: {
          channel?: string
          id?: string
          message?: string | null
          nudge_type?: string
          referee_email: string
          referral_id: string
          referrer_id: string
          sent_at?: string
          template_id?: string | null
        }
        Update: {
          channel?: string
          id?: string
          message?: string | null
          nudge_type?: string
          referee_email?: string
          referral_id?: string
          referrer_id?: string
          sent_at?: string
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "referral_nudges_referral_id_fkey"
            columns: ["referral_id"]
            isOneToOne: false
            referencedRelation: "expert_referrals"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_reward_config: {
        Row: {
          description: string | null
          id: string
          is_active: boolean
          referee_perks: string[]
          referee_points: number
          referrer_cash: number
          referrer_points: number
          step: string
        }
        Insert: {
          description?: string | null
          id?: string
          is_active?: boolean
          referee_perks?: string[]
          referee_points?: number
          referrer_cash?: number
          referrer_points?: number
          step: string
        }
        Update: {
          description?: string | null
          id?: string
          is_active?: boolean
          referee_perks?: string[]
          referee_points?: number
          referrer_cash?: number
          referrer_points?: number
          step?: string
        }
        Relationships: []
      }
      refunds: {
        Row: {
          amount: number
          client_id: string | null
          created_at: string | null
          created_by: string | null
          id: string
          payment_id: string | null
          reason: string
          status: string | null
          stripe_refund_id: string | null
        }
        Insert: {
          amount: number
          client_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          payment_id?: string | null
          reason: string
          status?: string | null
          stripe_refund_id?: string | null
        }
        Update: {
          amount?: number
          client_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          payment_id?: string | null
          reason?: string
          status?: string | null
          stripe_refund_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "refunds_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "project_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      rlhf_contributor_agreements: {
        Row: {
          agreement_version: string
          annotator_id: string
          anonymization_consent: boolean | null
          data_usage_consent: boolean | null
          expert_id: string | null
          id: string
          ip_address: string | null
          is_active: boolean | null
          resale_consent: boolean | null
          revoked_at: string | null
          sector_restrictions: string[] | null
          signed_at: string | null
          time_limit_months: number | null
        }
        Insert: {
          agreement_version?: string
          annotator_id: string
          anonymization_consent?: boolean | null
          data_usage_consent?: boolean | null
          expert_id?: string | null
          id?: string
          ip_address?: string | null
          is_active?: boolean | null
          resale_consent?: boolean | null
          revoked_at?: string | null
          sector_restrictions?: string[] | null
          signed_at?: string | null
          time_limit_months?: number | null
        }
        Update: {
          agreement_version?: string
          annotator_id?: string
          anonymization_consent?: boolean | null
          data_usage_consent?: boolean | null
          expert_id?: string | null
          id?: string
          ip_address?: string | null
          is_active?: boolean | null
          resale_consent?: boolean | null
          revoked_at?: string | null
          sector_restrictions?: string[] | null
          signed_at?: string | null
          time_limit_months?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "rlhf_contributor_agreements_expert_id_fkey"
            columns: ["expert_id"]
            isOneToOne: false
            referencedRelation: "expert_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rlhf_contributor_agreements_expert_id_fkey"
            columns: ["expert_id"]
            isOneToOne: false
            referencedRelation: "expert_profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      rlhf_dataset_versions: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_locked: boolean | null
          is_published: boolean | null
          metadata: Json | null
          published_at: string | null
          schema_version: string | null
          total_instances: number | null
          validated_instances: number | null
          version_name: string
          version_number: number
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_locked?: boolean | null
          is_published?: boolean | null
          metadata?: Json | null
          published_at?: string | null
          schema_version?: string | null
          total_instances?: number | null
          validated_instances?: number | null
          version_name: string
          version_number: number
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_locked?: boolean | null
          is_published?: boolean | null
          metadata?: Json | null
          published_at?: string | null
          schema_version?: string | null
          total_instances?: number | null
          validated_instances?: number | null
          version_name?: string
          version_number?: number
        }
        Relationships: []
      }
      rlhf_disagreements: {
        Row: {
          created_at: string | null
          description: string | null
          disagreement_type: string
          feedback_id: string | null
          id: string
          is_resolved: boolean | null
          resolution_rationale: string | null
          resolved_at: string | null
          resolved_rating: string | null
          senior_annotator_id: string | null
          senior_resolution: string | null
          severity: string | null
          tier_1: Database["public"]["Enums"]["annotator_tier"]
          tier_1_annotation_id: string | null
          tier_2: Database["public"]["Enums"]["annotator_tier"]
          tier_2_annotation_id: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          disagreement_type: string
          feedback_id?: string | null
          id?: string
          is_resolved?: boolean | null
          resolution_rationale?: string | null
          resolved_at?: string | null
          resolved_rating?: string | null
          senior_annotator_id?: string | null
          senior_resolution?: string | null
          severity?: string | null
          tier_1: Database["public"]["Enums"]["annotator_tier"]
          tier_1_annotation_id?: string | null
          tier_2: Database["public"]["Enums"]["annotator_tier"]
          tier_2_annotation_id?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          disagreement_type?: string
          feedback_id?: string | null
          id?: string
          is_resolved?: boolean | null
          resolution_rationale?: string | null
          resolved_at?: string | null
          resolved_rating?: string | null
          senior_annotator_id?: string | null
          senior_resolution?: string | null
          severity?: string | null
          tier_1?: Database["public"]["Enums"]["annotator_tier"]
          tier_1_annotation_id?: string | null
          tier_2?: Database["public"]["Enums"]["annotator_tier"]
          tier_2_annotation_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rlhf_disagreements_feedback_id_fkey"
            columns: ["feedback_id"]
            isOneToOne: false
            referencedRelation: "rlhf_feedback"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rlhf_disagreements_tier_1_annotation_id_fkey"
            columns: ["tier_1_annotation_id"]
            isOneToOne: false
            referencedRelation: "rlhf_tier_annotations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rlhf_disagreements_tier_2_annotation_id_fkey"
            columns: ["tier_2_annotation_id"]
            isOneToOne: false
            referencedRelation: "rlhf_tier_annotations"
            referencedColumns: ["id"]
          },
        ]
      }
      rlhf_email_queue: {
        Row: {
          created_at: string | null
          error_message: string | null
          id: string
          recipient_email: string
          recipient_name: string | null
          retry_count: number | null
          sent_at: string | null
          status: string | null
          template: string
          variables: Json
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          recipient_email: string
          recipient_name?: string | null
          retry_count?: number | null
          sent_at?: string | null
          status?: string | null
          template: string
          variables?: Json
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          recipient_email?: string
          recipient_name?: string | null
          retry_count?: number | null
          sent_at?: string | null
          status?: string | null
          template?: string
          variables?: Json
        }
        Relationships: []
      }
      rlhf_feedback: {
        Row: {
          agreement_score: number | null
          annotator_id: string
          attention_check_passed: boolean | null
          chosen_output: Json | null
          comparison_rationale: string | null
          consent_version: string | null
          constraints: Json | null
          content_hash: string | null
          country_context: string
          created_at: string | null
          data_retention_policy: string | null
          dataset_version_id: string | null
          device_type: string | null
          expert_id: string | null
          expert_profile_snapshot: Json | null
          export_batch_id: string | null
          free_text_comment: string | null
          generated_output: Json
          generation_timestamp: string
          generator: string | null
          gold_task: boolean | null
          gold_task_id: string | null
          id: string
          is_duplicate_annotation: boolean | null
          is_locked: boolean | null
          issues_detected: string[] | null
          job_context: Json | null
          job_level_targeted: string
          job_offer_id: string | null
          job_role: string
          language: string
          model_type: string | null
          model_version: string | null
          original_feedback_id: string | null
          overall_rating: string
          pii_present: boolean | null
          platform_version: string | null
          preferred_action: string | null
          prompt_used: string | null
          qa_notes: string | null
          qa_reviewed_at: string | null
          qa_reviewer_id: string | null
          qa_status: string | null
          reasoning_steps: Json | null
          rejected_output: Json | null
          rights_assigned: boolean
          scores: Json | null
          second_annotator_id: string | null
          session_id: string | null
          task_type: string
          test_id: string | null
          test_instance_id: string | null
          tier_complete: Json | null
          time_spent_seconds: number | null
          updated_at: string | null
          user_agent_info: string | null
        }
        Insert: {
          agreement_score?: number | null
          annotator_id: string
          attention_check_passed?: boolean | null
          chosen_output?: Json | null
          comparison_rationale?: string | null
          consent_version?: string | null
          constraints?: Json | null
          content_hash?: string | null
          country_context: string
          created_at?: string | null
          data_retention_policy?: string | null
          dataset_version_id?: string | null
          device_type?: string | null
          expert_id?: string | null
          expert_profile_snapshot?: Json | null
          export_batch_id?: string | null
          free_text_comment?: string | null
          generated_output: Json
          generation_timestamp?: string
          generator?: string | null
          gold_task?: boolean | null
          gold_task_id?: string | null
          id?: string
          is_duplicate_annotation?: boolean | null
          is_locked?: boolean | null
          issues_detected?: string[] | null
          job_context?: Json | null
          job_level_targeted: string
          job_offer_id?: string | null
          job_role: string
          language?: string
          model_type?: string | null
          model_version?: string | null
          original_feedback_id?: string | null
          overall_rating: string
          pii_present?: boolean | null
          platform_version?: string | null
          preferred_action?: string | null
          prompt_used?: string | null
          qa_notes?: string | null
          qa_reviewed_at?: string | null
          qa_reviewer_id?: string | null
          qa_status?: string | null
          reasoning_steps?: Json | null
          rejected_output?: Json | null
          rights_assigned?: boolean
          scores?: Json | null
          second_annotator_id?: string | null
          session_id?: string | null
          task_type?: string
          test_id?: string | null
          test_instance_id?: string | null
          tier_complete?: Json | null
          time_spent_seconds?: number | null
          updated_at?: string | null
          user_agent_info?: string | null
        }
        Update: {
          agreement_score?: number | null
          annotator_id?: string
          attention_check_passed?: boolean | null
          chosen_output?: Json | null
          comparison_rationale?: string | null
          consent_version?: string | null
          constraints?: Json | null
          content_hash?: string | null
          country_context?: string
          created_at?: string | null
          data_retention_policy?: string | null
          dataset_version_id?: string | null
          device_type?: string | null
          expert_id?: string | null
          expert_profile_snapshot?: Json | null
          export_batch_id?: string | null
          free_text_comment?: string | null
          generated_output?: Json
          generation_timestamp?: string
          generator?: string | null
          gold_task?: boolean | null
          gold_task_id?: string | null
          id?: string
          is_duplicate_annotation?: boolean | null
          is_locked?: boolean | null
          issues_detected?: string[] | null
          job_context?: Json | null
          job_level_targeted?: string
          job_offer_id?: string | null
          job_role?: string
          language?: string
          model_type?: string | null
          model_version?: string | null
          original_feedback_id?: string | null
          overall_rating?: string
          pii_present?: boolean | null
          platform_version?: string | null
          preferred_action?: string | null
          prompt_used?: string | null
          qa_notes?: string | null
          qa_reviewed_at?: string | null
          qa_reviewer_id?: string | null
          qa_status?: string | null
          reasoning_steps?: Json | null
          rejected_output?: Json | null
          rights_assigned?: boolean
          scores?: Json | null
          second_annotator_id?: string | null
          session_id?: string | null
          task_type?: string
          test_id?: string | null
          test_instance_id?: string | null
          tier_complete?: Json | null
          time_spent_seconds?: number | null
          updated_at?: string | null
          user_agent_info?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rlhf_feedback_dataset_version_id_fkey"
            columns: ["dataset_version_id"]
            isOneToOne: false
            referencedRelation: "rlhf_dataset_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rlhf_feedback_expert_id_fkey"
            columns: ["expert_id"]
            isOneToOne: false
            referencedRelation: "expert_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rlhf_feedback_expert_id_fkey"
            columns: ["expert_id"]
            isOneToOne: false
            referencedRelation: "expert_profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rlhf_feedback_gold_task_id_fkey"
            columns: ["gold_task_id"]
            isOneToOne: false
            referencedRelation: "rlhf_gold_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rlhf_feedback_job_offer_id_fkey"
            columns: ["job_offer_id"]
            isOneToOne: false
            referencedRelation: "job_offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rlhf_feedback_original_feedback_id_fkey"
            columns: ["original_feedback_id"]
            isOneToOne: false
            referencedRelation: "rlhf_feedback"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rlhf_feedback_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "technical_tests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rlhf_feedback_test_instance_id_fkey"
            columns: ["test_instance_id"]
            isOneToOne: false
            referencedRelation: "rlhf_test_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      rlhf_gold_tasks: {
        Row: {
          ai_output: Json
          created_at: string | null
          expected_issues: string[] | null
          expected_rating: string
          id: string
          is_active: boolean | null
          job_level: string
          job_role: string
          min_agreement_threshold: number | null
          task_type: string
        }
        Insert: {
          ai_output: Json
          created_at?: string | null
          expected_issues?: string[] | null
          expected_rating: string
          id?: string
          is_active?: boolean | null
          job_level: string
          job_role: string
          min_agreement_threshold?: number | null
          task_type: string
        }
        Update: {
          ai_output?: Json
          created_at?: string | null
          expected_issues?: string[] | null
          expected_rating?: string
          id?: string
          is_active?: boolean | null
          job_level?: string
          job_role?: string
          min_agreement_threshold?: number | null
          task_type?: string
        }
        Relationships: []
      }
      rlhf_pending_qa: {
        Row: {
          agreement_score: number | null
          assigned_annotator_id: string | null
          completed_at: string | null
          created_at: string | null
          id: string
          original_feedback_id: string | null
          requires_second_annotator: boolean | null
          second_feedback_id: string | null
        }
        Insert: {
          agreement_score?: number | null
          assigned_annotator_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          original_feedback_id?: string | null
          requires_second_annotator?: boolean | null
          second_feedback_id?: string | null
        }
        Update: {
          agreement_score?: number | null
          assigned_annotator_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          original_feedback_id?: string | null
          requires_second_annotator?: boolean | null
          second_feedback_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rlhf_pending_qa_original_feedback_id_fkey"
            columns: ["original_feedback_id"]
            isOneToOne: false
            referencedRelation: "rlhf_feedback"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rlhf_pending_qa_second_feedback_id_fkey"
            columns: ["second_feedback_id"]
            isOneToOne: false
            referencedRelation: "rlhf_feedback"
            referencedColumns: ["id"]
          },
        ]
      }
      rlhf_qa_queue: {
        Row: {
          assigned_annotator_id: string | null
          assigned_at: string | null
          completed_at: string | null
          created_at: string | null
          id: string
          original_feedback_id: string
          status: string | null
        }
        Insert: {
          assigned_annotator_id?: string | null
          assigned_at?: string | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          original_feedback_id: string
          status?: string | null
        }
        Update: {
          assigned_annotator_id?: string | null
          assigned_at?: string | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          original_feedback_id?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rlhf_qa_queue_original_feedback_id_fkey"
            columns: ["original_feedback_id"]
            isOneToOne: true
            referencedRelation: "rlhf_feedback"
            referencedColumns: ["id"]
          },
        ]
      }
      rlhf_sla_tracking: {
        Row: {
          actual_hours: number | null
          assigned_at: string | null
          completed_at: string | null
          created_at: string | null
          feedback_id: string | null
          id: string
          priority: string | null
          requested_at: string
          sla_met: boolean | null
          target_hours: number
          task_id: string | null
        }
        Insert: {
          actual_hours?: number | null
          assigned_at?: string | null
          completed_at?: string | null
          created_at?: string | null
          feedback_id?: string | null
          id?: string
          priority?: string | null
          requested_at?: string
          sla_met?: boolean | null
          target_hours?: number
          task_id?: string | null
        }
        Update: {
          actual_hours?: number | null
          assigned_at?: string | null
          completed_at?: string | null
          created_at?: string | null
          feedback_id?: string | null
          id?: string
          priority?: string | null
          requested_at?: string
          sla_met?: boolean | null
          target_hours?: number
          task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rlhf_sla_tracking_feedback_id_fkey"
            columns: ["feedback_id"]
            isOneToOne: false
            referencedRelation: "rlhf_feedback"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rlhf_sla_tracking_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "annotation_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      rlhf_test_instances: {
        Row: {
          avg_correctness_score: number | null
          candidate_solution: string | null
          created_at: string | null
          created_by: string | null
          difficulty: string
          domain: string
          expected_output: string | null
          id: string
          is_immutable: boolean | null
          language: string | null
          metadata: Json | null
          tags: string[] | null
          test_prompt: string
          total_annotations: number | null
          version: number | null
        }
        Insert: {
          avg_correctness_score?: number | null
          candidate_solution?: string | null
          created_at?: string | null
          created_by?: string | null
          difficulty: string
          domain: string
          expected_output?: string | null
          id?: string
          is_immutable?: boolean | null
          language?: string | null
          metadata?: Json | null
          tags?: string[] | null
          test_prompt: string
          total_annotations?: number | null
          version?: number | null
        }
        Update: {
          avg_correctness_score?: number | null
          candidate_solution?: string | null
          created_at?: string | null
          created_by?: string | null
          difficulty?: string
          domain?: string
          expected_output?: string | null
          id?: string
          is_immutable?: boolean | null
          language?: string | null
          metadata?: Json | null
          tags?: string[] | null
          test_prompt?: string
          total_annotations?: number | null
          version?: number | null
        }
        Relationships: []
      }
      rlhf_tier_annotations: {
        Row: {
          annotator_id: string
          created_at: string | null
          feedback_id: string | null
          id: string
          improvement_suggestions: string | null
          inline_comments: Json | null
          issues_detected: string[] | null
          overall_rating: string
          rationale: string | null
          scores: Json
          tier: Database["public"]["Enums"]["annotator_tier"]
          time_spent_seconds: number | null
        }
        Insert: {
          annotator_id: string
          created_at?: string | null
          feedback_id?: string | null
          id?: string
          improvement_suggestions?: string | null
          inline_comments?: Json | null
          issues_detected?: string[] | null
          overall_rating: string
          rationale?: string | null
          scores?: Json
          tier: Database["public"]["Enums"]["annotator_tier"]
          time_spent_seconds?: number | null
        }
        Update: {
          annotator_id?: string
          created_at?: string | null
          feedback_id?: string | null
          id?: string
          improvement_suggestions?: string | null
          inline_comments?: Json | null
          issues_detected?: string[] | null
          overall_rating?: string
          rationale?: string | null
          scores?: Json
          tier?: Database["public"]["Enums"]["annotator_tier"]
          time_spent_seconds?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "rlhf_tier_annotations_feedback_id_fkey"
            columns: ["feedback_id"]
            isOneToOne: false
            referencedRelation: "rlhf_feedback"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_jobs: {
        Row: {
          created_at: string
          expert_id: string
          id: string
          job_offer_id: string
        }
        Insert: {
          created_at?: string
          expert_id: string
          id?: string
          job_offer_id: string
        }
        Update: {
          created_at?: string
          expert_id?: string
          id?: string
          job_offer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_jobs_expert_id_fkey"
            columns: ["expert_id"]
            isOneToOne: false
            referencedRelation: "expert_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_jobs_expert_id_fkey"
            columns: ["expert_id"]
            isOneToOne: false
            referencedRelation: "expert_profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_jobs_job_offer_id_fkey"
            columns: ["job_offer_id"]
            isOneToOne: false
            referencedRelation: "job_offers"
            referencedColumns: ["id"]
          },
        ]
      }
      signup_rate_limits: {
        Row: {
          attempted_at: string
          email_hash: string
          id: string
          ip_fingerprint: string | null
          was_blocked: boolean | null
        }
        Insert: {
          attempted_at?: string
          email_hash: string
          id?: string
          ip_fingerprint?: string | null
          was_blocked?: boolean | null
        }
        Update: {
          attempted_at?: string
          email_hash?: string
          id?: string
          ip_fingerprint?: string | null
          was_blocked?: boolean | null
        }
        Relationships: []
      }
      sla_tiers: {
        Row: {
          active: boolean | null
          description: string | null
          guaranteed_min_alpha: number
          id: string
          max_delivery_multiplier: number
          min_annotators_per_task: number
          price_multiplier: number
          tier_name: string
        }
        Insert: {
          active?: boolean | null
          description?: string | null
          guaranteed_min_alpha: number
          id?: string
          max_delivery_multiplier: number
          min_annotators_per_task: number
          price_multiplier: number
          tier_name: string
        }
        Update: {
          active?: boolean | null
          description?: string | null
          guaranteed_min_alpha?: number
          id?: string
          max_delivery_multiplier?: number
          min_annotators_per_task?: number
          price_multiplier?: number
          tier_name?: string
        }
        Relationships: []
      }
      sla_tracking: {
        Row: {
          actual_completion_date: string | null
          alpha_on_target: boolean | null
          at_risk: boolean | null
          at_risk_reason: string | null
          committed_delivery_date: string
          committed_min_alpha: number
          created_at: string | null
          current_alpha: number | null
          delivery_on_time: boolean | null
          id: string
          project_id: string | null
          sla_tier: string
          updated_at: string | null
        }
        Insert: {
          actual_completion_date?: string | null
          alpha_on_target?: boolean | null
          at_risk?: boolean | null
          at_risk_reason?: string | null
          committed_delivery_date: string
          committed_min_alpha: number
          created_at?: string | null
          current_alpha?: number | null
          delivery_on_time?: boolean | null
          id?: string
          project_id?: string | null
          sla_tier: string
          updated_at?: string | null
        }
        Update: {
          actual_completion_date?: string | null
          alpha_on_target?: boolean | null
          at_risk?: boolean | null
          at_risk_reason?: string | null
          committed_delivery_date?: string
          committed_min_alpha?: number
          created_at?: string | null
          current_alpha?: number | null
          delivery_on_time?: boolean | null
          id?: string
          project_id?: string | null
          sla_tier?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sla_tracking_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "annotation_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      stef_points_ledger: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          id: string
          source: string
          source_id: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          id?: string
          source: string
          source_id?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          source?: string
          source_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      task_assignments: {
        Row: {
          assigned_at: string | null
          completed_at: string | null
          expert_id: string
          id: string
          status: string | null
          task_id: string
          timeout_at: string | null
        }
        Insert: {
          assigned_at?: string | null
          completed_at?: string | null
          expert_id: string
          id?: string
          status?: string | null
          task_id: string
          timeout_at?: string | null
        }
        Update: {
          assigned_at?: string | null
          completed_at?: string | null
          expert_id?: string
          id?: string
          status?: string | null
          task_id?: string
          timeout_at?: string | null
        }
        Relationships: []
      }
      task_pricing: {
        Row: {
          active: boolean | null
          client_unit_price: number
          created_at: string | null
          currency: string | null
          domain: string
          expert_payout: number
          id: string
          language: string
          task_type: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          client_unit_price: number
          created_at?: string | null
          currency?: string | null
          domain: string
          expert_payout: number
          id?: string
          language?: string
          task_type: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          client_unit_price?: number
          created_at?: string | null
          currency?: string | null
          domain?: string
          expert_payout?: number
          id?: string
          language?: string
          task_type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      technical_tests: {
        Row: {
          difficulty: string | null
          generated_at: string | null
          id: string
          job_offer_id: string | null
          questions: Json
        }
        Insert: {
          difficulty?: string | null
          generated_at?: string | null
          id?: string
          job_offer_id?: string | null
          questions: Json
        }
        Update: {
          difficulty?: string | null
          generated_at?: string | null
          id?: string
          job_offer_id?: string | null
          questions?: Json
        }
        Relationships: [
          {
            foreignKeyName: "technical_tests_job_offer_id_fkey"
            columns: ["job_offer_id"]
            isOneToOne: false
            referencedRelation: "job_offers"
            referencedColumns: ["id"]
          },
        ]
      }
      test_consents: {
        Row: {
          consent_type: string
          consent_version: string
          consented_at: string
          created_at: string
          expert_id: string | null
          id: string
          ip_address: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          consent_type?: string
          consent_version?: string
          consented_at?: string
          created_at?: string
          expert_id?: string | null
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          consent_type?: string
          consent_version?: string
          consented_at?: string
          created_at?: string
          expert_id?: string | null
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_consents_expert_id_fkey"
            columns: ["expert_id"]
            isOneToOne: false
            referencedRelation: "expert_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_consents_expert_id_fkey"
            columns: ["expert_id"]
            isOneToOne: false
            referencedRelation: "expert_profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      test_generation_logs: {
        Row: {
          created_at: string
          expert_id: string
          id: string
          ip_address: string | null
          test_id: string | null
        }
        Insert: {
          created_at?: string
          expert_id: string
          id?: string
          ip_address?: string | null
          test_id?: string | null
        }
        Update: {
          created_at?: string
          expert_id?: string
          id?: string
          ip_address?: string | null
          test_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "test_generation_logs_expert_id_fkey"
            columns: ["expert_id"]
            isOneToOne: false
            referencedRelation: "expert_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_generation_logs_expert_id_fkey"
            columns: ["expert_id"]
            isOneToOne: false
            referencedRelation: "expert_profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_generation_logs_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "technical_tests"
            referencedColumns: ["id"]
          },
        ]
      }
      test_submissions: {
        Row: {
          answers: Json
          candidate_id: string | null
          cheat_indicators: Json | null
          cv_score: number | null
          expert_id: string | null
          feedback: Json | null
          final_score: number | null
          id: string
          job_offer_id: string | null
          submitted_at: string | null
          test_id: string | null
          test_score: number | null
        }
        Insert: {
          answers: Json
          candidate_id?: string | null
          cheat_indicators?: Json | null
          cv_score?: number | null
          expert_id?: string | null
          feedback?: Json | null
          final_score?: number | null
          id?: string
          job_offer_id?: string | null
          submitted_at?: string | null
          test_id?: string | null
          test_score?: number | null
        }
        Update: {
          answers?: Json
          candidate_id?: string | null
          cheat_indicators?: Json | null
          cv_score?: number | null
          expert_id?: string | null
          feedback?: Json | null
          final_score?: number | null
          id?: string
          job_offer_id?: string | null
          submitted_at?: string | null
          test_id?: string | null
          test_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "test_submissions_expert_id_fkey"
            columns: ["expert_id"]
            isOneToOne: false
            referencedRelation: "expert_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_submissions_expert_id_fkey"
            columns: ["expert_id"]
            isOneToOne: false
            referencedRelation: "expert_profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_submissions_job_offer_id_fkey"
            columns: ["job_offer_id"]
            isOneToOne: false
            referencedRelation: "job_offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_submissions_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "technical_tests"
            referencedColumns: ["id"]
          },
        ]
      }
      timesheets: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string | null
          days_worked: number
          expert_id: string
          id: string
          month: number
          notes: string | null
          placement_id: string
          rejection_reason: string | null
          status: string | null
          submitted_at: string | null
          updated_at: string | null
          year: number
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          days_worked?: number
          expert_id: string
          id?: string
          month: number
          notes?: string | null
          placement_id: string
          rejection_reason?: string | null
          status?: string | null
          submitted_at?: string | null
          updated_at?: string | null
          year: number
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          days_worked?: number
          expert_id?: string
          id?: string
          month?: number
          notes?: string | null
          placement_id?: string
          rejection_reason?: string | null
          status?: string | null
          submitted_at?: string | null
          updated_at?: string | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "timesheets_expert_id_fkey"
            columns: ["expert_id"]
            isOneToOne: false
            referencedRelation: "expert_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheets_expert_id_fkey"
            columns: ["expert_id"]
            isOneToOne: false
            referencedRelation: "expert_profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheets_placement_id_fkey"
            columns: ["placement_id"]
            isOneToOne: false
            referencedRelation: "placements"
            referencedColumns: ["id"]
          },
        ]
      }
      user_acquisition: {
        Row: {
          created_at: string | null
          fbclid: string | null
          gclid: string | null
          id: string
          landing_url: string | null
          user_id: string
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
        }
        Insert: {
          created_at?: string | null
          fbclid?: string | null
          gclid?: string | null
          id?: string
          landing_url?: string | null
          user_id: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Update: {
          created_at?: string | null
          fbclid?: string | null
          gclid?: string | null
          id?: string
          landing_url?: string | null
          user_id?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Relationships: []
      }
      user_email_preferences: {
        Row: {
          annotation: boolean
          created_at: string
          dormant_since: string | null
          id: string
          lifecycle: boolean
          marketing: boolean
          referral: boolean
          transactional: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          annotation?: boolean
          created_at?: string
          dormant_since?: string | null
          id?: string
          lifecycle?: boolean
          marketing?: boolean
          referral?: boolean
          transactional?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          annotation?: boolean
          created_at?: string
          dormant_since?: string | null
          id?: string
          lifecycle?: boolean
          marketing?: boolean
          referral?: boolean
          transactional?: boolean
          updated_at?: string
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
          role: Database["public"]["Enums"]["app_role"]
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
      volume_discounts: {
        Row: {
          active: boolean | null
          discount_percent: number
          id: string
          max_tasks: number | null
          min_tasks: number
        }
        Insert: {
          active?: boolean | null
          discount_percent: number
          id?: string
          max_tasks?: number | null
          min_tasks: number
        }
        Update: {
          active?: boolean | null
          discount_percent?: number
          id?: string
          max_tasks?: number | null
          min_tasks?: number
        }
        Relationships: []
      }
      webhook_deliveries: {
        Row: {
          created_at: string | null
          event: string
          id: string
          latency_ms: number | null
          payload: Json
          response_body: string | null
          status_code: number | null
          success: boolean | null
          webhook_id: string | null
        }
        Insert: {
          created_at?: string | null
          event: string
          id?: string
          latency_ms?: number | null
          payload: Json
          response_body?: string | null
          status_code?: number | null
          success?: boolean | null
          webhook_id?: string | null
        }
        Update: {
          created_at?: string | null
          event?: string
          id?: string
          latency_ms?: number | null
          payload?: Json
          response_body?: string | null
          status_code?: number | null
          success?: boolean | null
          webhook_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "webhook_deliveries_webhook_id_fkey"
            columns: ["webhook_id"]
            isOneToOne: false
            referencedRelation: "client_webhooks"
            referencedColumns: ["id"]
          },
        ]
      }
      withdrawal_requests: {
        Row: {
          amount: number
          currency: string | null
          expert_id: string
          id: string
          processed_at: string | null
          requested_at: string | null
          status: string | null
          stripe_transfer_id: string | null
          user_id: string
        }
        Insert: {
          amount: number
          currency?: string | null
          expert_id: string
          id?: string
          processed_at?: string | null
          requested_at?: string | null
          status?: string | null
          stripe_transfer_id?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          currency?: string | null
          expert_id?: string
          id?: string
          processed_at?: string | null
          requested_at?: string | null
          status?: string | null
          stripe_transfer_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      expert_profiles_public: {
        Row: {
          availability: string | null
          avatar_url: string | null
          bio: string | null
          city: string | null
          contract_types: string[] | null
          country: string | null
          created_at: string | null
          daily_rate: number | null
          full_name: string | null
          github_url: string | null
          id: string | null
          kyc_status: string | null
          languages: string[] | null
          onboarding_completed: boolean | null
          portfolio_url: string | null
          primary_skills: string[] | null
          profile_visible: boolean | null
          secondary_skills: string[] | null
          title: string | null
          updated_at: string | null
          user_id: string | null
          work_type: string[] | null
          years_of_experience: number | null
        }
        Insert: {
          availability?: string | null
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          contract_types?: string[] | null
          country?: string | null
          created_at?: string | null
          daily_rate?: number | null
          full_name?: string | null
          github_url?: string | null
          id?: string | null
          kyc_status?: string | null
          languages?: string[] | null
          onboarding_completed?: boolean | null
          portfolio_url?: string | null
          primary_skills?: string[] | null
          profile_visible?: boolean | null
          secondary_skills?: string[] | null
          title?: string | null
          updated_at?: string | null
          user_id?: string | null
          work_type?: string[] | null
          years_of_experience?: number | null
        }
        Update: {
          availability?: string | null
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          contract_types?: string[] | null
          country?: string | null
          created_at?: string | null
          daily_rate?: number | null
          full_name?: string | null
          github_url?: string | null
          id?: string | null
          kyc_status?: string | null
          languages?: string[] | null
          onboarding_completed?: boolean | null
          portfolio_url?: string | null
          primary_skills?: string[] | null
          profile_visible?: boolean | null
          secondary_skills?: string[] | null
          title?: string | null
          updated_at?: string | null
          user_id?: string | null
          work_type?: string[] | null
          years_of_experience?: number | null
        }
        Relationships: []
      }
      stef_points_balance: {
        Row: {
          balance: number | null
          user_id: string | null
        }
        Relationships: []
      }
      v_annotation_quality_dashboard: {
        Row: {
          acceptable_count: number | null
          flagged_for_review: number | null
          items_with_alpha: number | null
          max_alpha: number | null
          mean_alpha: number | null
          min_alpha: number | null
          project_id: string | null
          reliability_percentage: number | null
          reliable_count: number | null
          total_items: number | null
          unreliable_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "annotation_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "annotation_projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      award_referral_step: {
        Args: { p_referral_id: string; p_step: string }
        Returns: Json
      }
      check_ambassador_tier_upgrade: {
        Args: { p_user_id: string }
        Returns: string
      }
      check_email_abuse: { Args: { check_email: string }; Returns: boolean }
      check_signup_eligibility: {
        Args: { p_email: string; p_referral_code?: string }
        Returns: Json
      }
      check_signup_rate_limit: {
        Args: { p_email_hash: string }
        Returns: boolean
      }
      check_sla_compliance: { Args: never; Returns: undefined }
      cleanup_expired_exports: { Args: never; Returns: undefined }
      cleanup_old_logs: { Args: never; Returns: undefined }
      company_can_view_expert: {
        Args: { p_expert_id: string }
        Returns: boolean
      }
      compute_batch_alpha: {
        Args: { p_limit?: number }
        Returns: {
          alpha_score: number
          dimension: string
          interpretation: string
          n_items: number
        }[]
      }
      compute_candidate_statistics: {
        Args: { p_expert_id: string }
        Returns: undefined
      }
      compute_certification_percentile: {
        Args: { p_certification_id: string }
        Returns: undefined
      }
      compute_task_alpha: {
        Args: { p_task_id: string }
        Returns: {
          alpha_score: number
          dimension: string
          interpretation: string
          n_annotators: number
        }[]
      }
      create_project_payments: {
        Args: {
          p_client_id: string
          p_project_id: string
          p_total_amount: number
        }
        Returns: undefined
      }
      dataset_quality_report: {
        Args: { p_project_id: string }
        Returns: {
          detail: string
          metric_name: string
          metric_value: number
        }[]
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      detect_alpha_drift: {
        Args: never
        Returns: {
          current_alpha: number
          delta: number
          dimension: string
          is_drifting: boolean
          previous_alpha: number
        }[]
      }
      determine_tva_regime: {
        Args: { p_client_country: string; p_client_tva_number: string }
        Returns: {
          mention: string
          rate: number
          regime: string
        }[]
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      estimate_delivery_days: {
        Args: {
          p_annotators_per_task?: number
          p_domain: string
          p_num_tasks: number
        }
        Returns: number
      }
      estimate_delivery_v2: {
        Args: {
          p_domain: string
          p_num_tasks: number
          p_sla_tier?: string
          p_task_type: string
        }
        Returns: {
          annotators_per_task: number
          capacity_message: string
          capacity_warning: boolean
          estimated_completion_date: string
          estimated_days: number
          guaranteed_min_alpha: number
          price_multiplier: number
        }[]
      }
      estimate_project_cost: {
        Args: {
          p_client_plan?: string
          p_domain: string
          p_language: string
          p_num_tasks: number
          p_task_type: string
        }
        Returns: {
          discounted_unit_price: number
          expert_cost_total: number
          plan_discount_percent: number
          stef_margin_percent: number
          stef_margin_total: number
          total_before_tax: number
          unit_price: number
          volume_discount_percent: number
        }[]
      }
      generate_anonymized_id: { Args: never; Returns: string }
      generate_certificate_id: {
        Args: { p_country_code: string; p_track: string }
        Returns: string
      }
      generate_invoice_number: { Args: never; Returns: string }
      generate_sequential_invoice_number: { Args: never; Returns: string }
      get_anonymized_expert_stats: {
        Args: { p_project_id: string }
        Returns: {
          avg_alpha: number
          avg_time_seconds: number
          consensus_rate: number
          expert_alias: string
          tasks_completed: number
        }[]
      }
      get_current_expert_id: { Args: never; Returns: string }
      get_platform_stats: { Args: never; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_blog_views: {
        Args: { p_article_id: string }
        Returns: undefined
      }
      increment_completed_tasks: {
        Args: { p_project_id: string }
        Returns: undefined
      }
      is_identity_unlocked: {
        Args: { p_anonymized_candidate_id: string; p_company_user_id: string }
        Returns: boolean
      }
      issue_certificate: {
        Args: {
          p_assessment_name: string
          p_country: string
          p_expert_id: string
          p_first_name: string
          p_last_name: string
          p_level: Database["public"]["Enums"]["certification_level"]
          p_role_title: string
          p_score: number
          p_track: string
          p_user_id: string
          p_valid_months?: number
        }
        Returns: string
      }
      krippendorff_alpha_scores: { Args: { scores: number[] }; Returns: number }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      process_referral_bonus_payout: {
        Args: { referral_id: string }
        Returns: boolean
      }
      process_withdrawal_atomic: {
        Args: { p_amount: number; p_expert_id: string }
        Returns: boolean
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
    }
    Enums: {
      annotation_domain:
        | "generaliste"
        | "rlhf_preference"
        | "code_tech"
        | "red_teaming_safety"
        | "juridique_fr"
        | "medical"
        | "finance"
      annotation_item_status:
        | "queued"
        | "assigned"
        | "in_progress"
        | "submitted"
        | "in_review"
        | "adjudication"
        | "completed"
        | "rejected"
        | "auto_annotated"
      annotation_project_status:
        | "draft"
        | "guidelines_review"
        | "pilot"
        | "active"
        | "paused"
        | "completed"
        | "archived"
      annotation_type:
        | "classification"
        | "ranking"
        | "rating"
        | "span_annotation"
        | "text_generation"
        | "comparison"
        | "extraction"
        | "validation"
        | "red_teaming"
        | "conversation_rating"
      annotator_assessment_tier: "junior" | "standard" | "senior" | "expert"
      annotator_status_type:
        | "onboarding"
        | "active"
        | "probation"
        | "suspended"
        | "inactive"
      annotator_tier: "student" | "expert" | "senior"
      annotator_tier_level:
        | "junior"
        | "standard"
        | "senior"
        | "expert"
        | "adjudicator"
      app_role: "company" | "expert" | "admin" | "client"
      assignment_status:
        | "pending"
        | "accepted"
        | "in_progress"
        | "completed"
        | "abandoned"
        | "expired"
      certificate_event_type:
        | "issued"
        | "revoked"
        | "expired"
        | "downloaded"
        | "viewed_public"
      certification_level: "associate" | "professional" | "expert"
      certification_status: "valid" | "expired" | "revoked"
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
      annotation_domain: [
        "generaliste",
        "rlhf_preference",
        "code_tech",
        "red_teaming_safety",
        "juridique_fr",
        "medical",
        "finance",
      ],
      annotation_item_status: [
        "queued",
        "assigned",
        "in_progress",
        "submitted",
        "in_review",
        "adjudication",
        "completed",
        "rejected",
        "auto_annotated",
      ],
      annotation_project_status: [
        "draft",
        "guidelines_review",
        "pilot",
        "active",
        "paused",
        "completed",
        "archived",
      ],
      annotation_type: [
        "classification",
        "ranking",
        "rating",
        "span_annotation",
        "text_generation",
        "comparison",
        "extraction",
        "validation",
        "red_teaming",
        "conversation_rating",
      ],
      annotator_assessment_tier: ["junior", "standard", "senior", "expert"],
      annotator_status_type: [
        "onboarding",
        "active",
        "probation",
        "suspended",
        "inactive",
      ],
      annotator_tier: ["student", "expert", "senior"],
      annotator_tier_level: [
        "junior",
        "standard",
        "senior",
        "expert",
        "adjudicator",
      ],
      app_role: ["company", "expert", "admin", "client"],
      assignment_status: [
        "pending",
        "accepted",
        "in_progress",
        "completed",
        "abandoned",
        "expired",
      ],
      certificate_event_type: [
        "issued",
        "revoked",
        "expired",
        "downloaded",
        "viewed_public",
      ],
      certification_level: ["associate", "professional", "expert"],
      certification_status: ["valid", "expired", "revoked"],
    },
  },
} as const
