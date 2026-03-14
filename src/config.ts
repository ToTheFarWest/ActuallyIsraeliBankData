import { z } from 'zod';
import { init } from '@actual-app/api';
import { CompanyTypes, type ScraperCredentials } from 'israeli-bank-scrapers';

// 1. Extract the third-party type
type ActualInitConfig = NonNullable<Parameters<typeof init>[0]>;

// 2. Define the Runtime Schema
const BankSchema = z.object({
    credentials: z.custom<ScraperCredentials>(),
    targets: z.array(
        z.object({
            actualAccountId: z.string(),
            
            // Accepts either "all" (a literal) OR an array of strings
            accounts: z.union([
                z.literal("all"),
                z.array(z.string())
            ]).default("all"),
        })
    )
});

export const AppConfigSchema = z.object({
    banks: z.record(
        z.nativeEnum(CompanyTypes),
        BankSchema
    ),
    actual: z.object({
        init: z.custom<ActualInitConfig>(),
        budget: z.object({
            syncId: z.string(),
            password: z.string().optional()
        })
    })
});

// 3. Export the Type inferred from the Schema
export type AppConfig = z.infer<typeof AppConfigSchema>;

// 4. Export the Bank Config type
export type BankConfig = z.infer<typeof BankSchema>;