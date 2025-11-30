import { database } from '../helpers/database';
import type { LanguageField } from '../types/sde';

/**
 * Type for individual bonus entries
 */
export interface TypeBonus {
  bonus: number;
  bonusText: LanguageField;
  importance: number;
  unitID: number;
}

/**
 * Type for skill-level bonuses
 */
export interface SkillBonus {
  _key: number; // Skill type ID
  _value: TypeBonus[];
}

/**
 * TypeBonuses interface - ship and module bonuses
 */
export interface TypeBonuses {
  typeId: number;
  roleBonuses?: TypeBonus[];
  types?: SkillBonus[];
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Get type bonuses by type ID
 */
export async function getTypeBonuses(
  typeId: number
): Promise<TypeBonuses | null> {
  return database.findOne<TypeBonuses>(
    `SELECT * FROM typebonuses WHERE "typeId" = :typeId`,
    { typeId }
  );
}

/**
 * Get all type bonuses
 */
export async function getAllTypeBonuses(): Promise<TypeBonuses[]> {
  return database.find<TypeBonuses>(
    `SELECT * FROM typebonuses ORDER BY "typeId"`
  );
}

/**
 * Get type bonuses with role bonuses only
 */
export async function getTypeBonusesWithRoleBonuses(): Promise<TypeBonuses[]> {
  return database.find<TypeBonuses>(
    `SELECT * FROM typebonuses
     WHERE "roleBonuses" IS NOT NULL
     AND jsonb_array_length("roleBonuses") > 0
     ORDER BY "typeId"`
  );
}

/**
 * Get type bonuses with skill bonuses only
 */
export async function getTypeBonusesWithSkillBonuses(): Promise<TypeBonuses[]> {
  return database.find<TypeBonuses>(
    `SELECT * FROM typebonuses
     WHERE "types" IS NOT NULL
     AND jsonb_array_length("types") > 0
     ORDER BY "typeId"`
  );
}

/**
 * Check if type has bonuses
 */
export async function typeHasBonuses(typeId: number): Promise<boolean> {
  const result = await database.findOne<{ count: number }>(
    `SELECT COUNT(*)::int as count FROM typebonuses WHERE "typeId" = :typeId`,
    { typeId }
  );
  return (result?.count ?? 0) > 0;
}

/**
 * Count total type bonuses
 */
export async function countTypeBonuses(): Promise<number> {
  const result = await database.findOne<{ count: number }>(
    `SELECT COUNT(*)::int as count FROM typebonuses`
  );
  return result?.count ?? 0;
}
