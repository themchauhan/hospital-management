// Hand-authored to match supabase/migrations/*.sql. Regenerate with
// `npm run supabase -- gen types typescript --local > src/types/database.ts`
// once `supabase start` has been run, then diff against this file —
// the generated output is the source of truth from that point on.
//
// `Relationships: []` on every table is required by
// @supabase/supabase-js's GenericTable shape even though we don't use
// PostgREST's embedded-resource (`select("*, other_table(*)")`)
// feature here — an empty array is the structurally correct value for
// "no declared foreign-key relationships to embed".

export type HospitalStatus = "TRIAL" | "ACTIVE" | "SUSPENDED" | "EXPIRED";
export type ModuleType = "GENERAL_OPD" | "USG";
export type StaffRole = "SUPER_ADMIN" | "HOSPITAL_ADMIN" | "RECEPTIONIST";
export type ProfileStatus = "ACTIVE" | "INACTIVE";
export type PatientGender = "MALE" | "FEMALE" | "OTHER";

export interface Database {
  public: {
    Tables: {
      hospitals: {
        Row: {
          id: string;
          name: string;
          address: string | null;
          phone: string | null;
          email: string | null;
          status: HospitalStatus;
          plan: string;
          trial_ends_at: string;
          subscription_ends_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["hospitals"]["Row"]> & {
          name: string;
        };
        Update: Partial<Database["public"]["Tables"]["hospitals"]["Row"]>;
        Relationships: [];
      };
      hospital_modules: {
        Row: {
          id: string;
          hospital_id: string;
          module: ModuleType;
          enabled_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["hospital_modules"]["Row"]> & {
          hospital_id: string;
          module: ModuleType;
        };
        Update: Partial<Database["public"]["Tables"]["hospital_modules"]["Row"]>;
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          hospital_id: string | null;
          name: string;
          email: string;
          role: StaffRole;
          status: ProfileStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["profiles"]["Row"]> & {
          id: string;
          name: string;
          email: string;
          role: StaffRole;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Row"]>;
        Relationships: [];
      };
      platform_admins: {
        Row: {
          id: string;
          profile_id: string;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["platform_admins"]["Row"]> & {
          profile_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["platform_admins"]["Row"]>;
        Relationships: [];
      };
      audit_logs: {
        Row: {
          id: string;
          hospital_id: string | null;
          user_id: string;
          action: string;
          target_type: string;
          target_id: string | null;
          metadata: Record<string, unknown>;
          created_at: string;
        };
        // user_id defaults to auth.uid() at the database level (see
        // the migration), so it's optional here too — but logAudit()
        // always sets it explicitly anyway.
        Insert: Partial<Database["public"]["Tables"]["audit_logs"]["Row"]> & {
          action: string;
          target_type: string;
        };
        // Structurally typed for GenericTable's shape; RLS is what
        // actually forbids updates (no UPDATE policy exists at all).
        Update: Partial<Database["public"]["Tables"]["audit_logs"]["Row"]>;
        Relationships: [];
      };
      patients: {
        Row: {
          id: string;
          hospital_id: string;
          patient_code: string;
          name: string;
          mobile: string | null;
          dob: string | null;
          approximate_age_years: number | null;
          guardian_name: string | null;
          gender: PatientGender | null;
          address: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        // hospital_id and patient_code both default at the database
        // level (see the migration), so neither is required here —
        // the app sets hospital_id explicitly anyway (hard rule #2).
        Insert: Partial<Database["public"]["Tables"]["patients"]["Row"]> & {
          name: string;
        };
        Update: Partial<Database["public"]["Tables"]["patients"]["Row"]>;
        Relationships: [];
      };
      patient_code_counters: {
        Row: { hospital_id: string; next_number: number };
        Insert: Partial<Database["public"]["Tables"]["patient_code_counters"]["Row"]> & {
          hospital_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["patient_code_counters"]["Row"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      current_profile: {
        Args: Record<string, never>;
        Returns: {
          id: string;
          hospital_id: string | null;
          role: StaffRole;
          status: ProfileStatus;
        }[];
      };
      is_platform_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      next_patient_code: {
        Args: Record<string, never>;
        Returns: string;
      };
      search_patients: {
        Args: { p_query: string };
        Returns: Database["public"]["Tables"]["patients"]["Row"][];
      };
      possible_duplicate_patients: {
        Args: { p_name: string; p_mobile: string | null; p_dob: string | null };
        Returns: Database["public"]["Tables"]["patients"]["Row"][];
      };
    };
  };
}
