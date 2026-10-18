import { z } from 'zod';
import { RuleConcept } from './rule.ts';

/**
 * Catalogue des règles recensées dans le classeur de référence. INFORMATIF : le moteur ne le lit jamais
 * et aucune valeur n'en est tirée (R7). Il sert à ne rien perdre et à dire pourquoi une ligne n'est pas modélisée.
 */
const Text = z.string().min(1);

export const CatalogueModelled = z.object({
  state: z.enum(['YES', 'NO']),
  concept: RuleConcept.nullable(),
  reason: Text,
}).refine((m) => (m.state === 'YES') === (m.concept !== null), 'concept requis si et seulement si modélisé');
export type CatalogueModelled = z.infer<typeof CatalogueModelled>;

export const CatalogueLine = z.object({
  id: z.string().regex(/^[RN]\d{2}$/),
  family: z.enum(['R', 'N']),
  theme: Text,
  rule: Text,
  effect: Text.nullable(),
  legalBasis: Text.nullable(),
  source: Text.nullable(),
  modifiedBy2026: z.boolean(),
  modifiedNote: Text.optional(),
  status: Text,
  priority: Text.nullable(),
  toVerify: Text.nullable(),
  modelled: CatalogueModelled,
});
export type CatalogueLine = z.infer<typeof CatalogueLine>;

export const Catalogue = z.object({
  workbook: z.object({ file: Text, sha256: z.string().regex(/^[0-9a-f]{64}$/), asOf: z.string() }),
  summary: z.array(z.object({ label: Text, text: Text })),
  lines: z.array(CatalogueLine).min(1),
  v4Gaps: z.array(z.object({ ref: Text, v4: Text, texts: Text, fix: Text, priority: Text })),
  unreadArticles: z.array(z.object({ article: Text, title: Text, relevance: Text, reading: Text })),
  sources: z.array(z.object({
    level: Text, document: Text, link: Text, establishes: Text, limit: Text, reading: Text,
  })),
});
export type Catalogue = z.infer<typeof Catalogue>;
