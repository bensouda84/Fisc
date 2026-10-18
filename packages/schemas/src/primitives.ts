import { z } from 'zod';

/** Montant entier en F CFA. Accepte un entier ou une chaîne décimale ; refuse tout flottant. */
export const Money = z.coerce.bigint();
export const NonNegativeMoney = z.coerce.bigint().min(0n);

/** Taux sous forme de fraction exacte (R6). 25 % = 1/4. */
export const Rate = z.object({
  num: z.coerce.bigint().min(0n),
  den: z.coerce.bigint().positive(),
});
export type Rate = z.infer<typeof Rate>;

export const IsoDate = z.iso.date();
export const IsoDateTime = z.iso.datetime();

export const rate = (num: bigint, den: bigint): Rate => ({ num, den });
