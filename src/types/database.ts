export type UserRole = "teacher" | "student";

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          role: UserRole;
          created_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          role?: UserRole;
          created_at?: string;
        };
        Update: {
          full_name?: string | null;
          role?: UserRole;
        };
        Relationships: [];
      };
      materials: {
        Row: {
          id: string;
          teacher_id: string;
          title: string;
          description: string | null;
          file_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          teacher_id: string;
          title: string;
          description?: string | null;
          file_url?: string | null;
          created_at?: string;
        };
        Update: {
          title?: string;
          description?: string | null;
          file_url?: string | null;
        };
        Relationships: [];
      };
      assessments: {
        Row: {
          id: string;
          teacher_id: string;
          title: string;
          prompt: string;
          rubric: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          teacher_id: string;
          title: string;
          prompt: string;
          rubric?: string | null;
          created_at?: string;
        };
        Update: {
          title?: string;
          prompt?: string;
          rubric?: string | null;
        };
        Relationships: [];
      };
      submissions: {
        Row: {
          id: string;
          assessment_id: string;
          student_id: string;
          thinking_process: string;
          attempt_no: number;
          ai_feedback: string | null;
          partial_score: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          assessment_id: string;
          student_id: string;
          thinking_process: string;
          attempt_no?: number;
          ai_feedback?: string | null;
          partial_score?: number | null;
          created_at?: string;
        };
        Update: {
          thinking_process?: string;
          attempt_no?: number;
          ai_feedback?: string | null;
          partial_score?: number | null;
        };
        Relationships: [];
      };
      interactions: {
        Row: {
          id: string;
          submission_id: string;
          student_id: string;
          prompt_type: string;
          content: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          submission_id: string;
          student_id: string;
          prompt_type: string;
          content: string;
          created_at?: string;
        };
        Update: {
          prompt_type?: string;
          content?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
