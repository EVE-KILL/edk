import { database } from '../helpers/database';

export interface TranslationLanguage {
  languageId: string;
  name: string;
}

export async function getTranslationLanguage(
  languageId: string
): Promise<TranslationLanguage | null> {
  return database.findOne<TranslationLanguage>(
    `SELECT * FROM translationlanguages WHERE "languageId" = :languageId`,
    { languageId }
  );
}

export async function getAllTranslationLanguages(): Promise<
  TranslationLanguage[]
> {
  return database.find<TranslationLanguage>(
    `SELECT * FROM translationlanguages ORDER BY "languageId"`
  );
}

export async function countTranslationLanguages(): Promise<number> {
  const result = await database.findOne<{ count: number }>(
    `SELECT COUNT(*)::int as count FROM translationlanguages`
  );
  return result?.count ?? 0;
}
