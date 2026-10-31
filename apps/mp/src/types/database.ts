/**
 * 云数据库表结构契约（supabase 生成的 Database 形态）。
 * 传给云客户端后 `cloud.database.from('...')` 就能得到完整的行列类型，
 * 省掉调用点上的手写断言。字段必须与数据库里的实际定义保持一致。
 */

type JsonPrimitive = string | number | boolean | null;

type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue | undefined };

export interface FamilySpaceTable {
  Row: {
    id: number;
    invite_code: string;
    name: string;
    /** 家庭数据快照。存的是任意 JSON，结构与校验由共享领域层的 decodeFamily 负责。 */
    payload: unknown;
    version: number;
    owner_id: string;
    updated_by: string | null;
    created_at: string;
    updated_at: string;
  };
  Insert: {
    id?: number;
    invite_code: string;
    name?: string;
    payload?: unknown;
    version?: number;
    owner_id?: string;
    updated_by?: string | null;
    created_at?: string;
    updated_at?: string;
  };
  Update: {
    id?: number;
    invite_code?: string;
    name?: string;
    payload?: unknown;
    version?: number;
    owner_id?: string;
    updated_by?: string | null;
    created_at?: string;
    updated_at?: string;
  };
  Relationships: [];
}

export interface FamilyMemberTable {
  Row: {
    id: number;
    family_id: number;
    owner_id: string;
    display_name: string | null;
    role: string;
    joined_at: string;
  };
  Insert: {
    id?: number;
    family_id: number;
    owner_id?: string;
    display_name?: string | null;
    role?: string;
    joined_at?: string;
  };
  Update: {
    id?: number;
    family_id?: number;
    owner_id?: string;
    display_name?: string | null;
    role?: string;
    joined_at?: string;
  };
  Relationships: [];
}

export interface Database {
  public: {
    Tables: {
      families: FamilySpaceTable;
      family_members: FamilyMemberTable;
    };
    Views: Record<string, never>;
    Functions: {
      join_family: {
        Args: { p_invite_code: string };
        Returns: { target_family_id: number; joined: boolean }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

export type JsonValueType = JsonValue;
