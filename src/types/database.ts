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
          answer: string | null;
          reference_material_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          teacher_id: string;
          title: string;
          prompt: string;
          answer?: string | null;
          reference_material_id?: string | null;
          created_at?: string;
        };
        Update: {
          title?: string;
          prompt?: string;
          answer?: string | null;
          reference_material_id?: string | null;
        };
        Relationships: [];
      };
      mc_sets: {
        Row: {
          id: string;
          teacher_id: string;
          title: string;
          reference_material_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          teacher_id: string;
          title: string;
          reference_material_id?: string | null;
          created_at?: string;
        };
        Update: {
          title?: string;
          reference_material_id?: string | null;
        };
        Relationships: [];
      };
      mc_questions: {
        Row: {
          id: string;
          set_id: string | null;
          teacher_id: string;
          title: string;
          question: string;
          option_a: string;
          option_b: string;
          option_c: string;
          option_d: string;
          correct_option: "A" | "B" | "C" | "D";
          explanation: string | null;
          reference_material_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          set_id?: string | null;
          teacher_id: string;
          title: string;
          question: string;
          option_a: string;
          option_b: string;
          option_c: string;
          option_d: string;
          correct_option: "A" | "B" | "C" | "D";
          explanation?: string | null;
          reference_material_id?: string | null;
          created_at?: string;
        };
        Update: {
          set_id?: string | null;
          title?: string;
          question?: string;
          option_a?: string;
          option_b?: string;
          option_c?: string;
          option_d?: string;
          correct_option?: "A" | "B" | "C" | "D";
          explanation?: string | null;
          reference_material_id?: string | null;
        };
        Relationships: [];
      };
      mc_submissions: {
        Row: {
          id: string;
          set_id: string;
          question_id: string;
          student_id: string;
          selected_option: "A" | "B" | "C" | "D";
          is_correct: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          set_id: string;
          question_id: string;
          student_id: string;
          selected_option: "A" | "B" | "C" | "D";
          is_correct?: boolean;
          created_at?: string;
        };
        Update: {
          selected_option?: "A" | "B" | "C" | "D";
          is_correct?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      submissions: {
        Row: {
          id: string;
          assessment_id: string;
          student_id: string;
          answer: string;
          attempt_no: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          assessment_id: string;
          student_id: string;
          answer: string;
          attempt_no?: number;
          created_at?: string;
        };
        Update: {
          answer?: string;
          attempt_no?: number;
          created_at?: string;
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
