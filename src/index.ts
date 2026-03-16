import './shim.ts';
import { CompanyTypes, createScraper, Scraper, ScraperCredentials, ScraperOptions, ScraperScrapingResult } from 'israeli-bank-scrapers';
import { type AppConfig, AppConfigSchema, type BankConfig } from './config.ts';
import { type ActualTransaction, ActualTransactionSchema } from './types.ts';
import { type TransactionsAccount } from 'israeli-bank-scrapers/lib/transactions.js';
import api from '@actual-app/api'
import * as fs from 'fs'


async function getTransactionsAccountsFromBank(companyId: CompanyTypes, credentials: ScraperCredentials): Promise<TransactionsAccount[]> {

    // Scrape only the last month of transactions to speed up the scraping process.
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

    const options: ScraperOptions = {
        companyId: companyId,
        startDate: oneMonthAgo,
        showBrowser: false,
        verbose: true, // Set to true to include more debug info in the output
        defaultTimeout: 60000, // Set a custom timeout for navigation (default is 30000 ms)
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
        ],
        navigationRetryCount: 3, // Number of times to retry navigation on failure
    };

    const scraper: Scraper<ScraperCredentials> = createScraper(options);

    const scrapeResult: ScraperScrapingResult = await scraper.scrape(credentials);

    if (!scrapeResult.success) {
        throw new Error(`Scraping failed for bank ${companyId}: ${scrapeResult.errorType} - ${scrapeResult.errorMessage}`);
    }

    if (!scrapeResult.accounts || scrapeResult.accounts.length === 0) {
        console.warn(`Scraping succeeded for bank ${companyId} but no accounts were found.`);
        return [];
    }

    return scrapeResult.accounts;
}

async function mapAccountsToTargets(accounts: TransactionsAccount[], targets: BankConfig['targets']): Promise<{ [actualAccountId: string]: TransactionsAccount[] }> {
    const mappedAccounts: { [actualAccountId: string]: TransactionsAccount[] } = {};

    for (const target of targets) {
        const matchingAccounts = target.accounts === "all"
            ? accounts
            : (() => {
                const allowedSet = new Set(target.accounts);
                return accounts.filter(acc => allowedSet.has(acc.accountNumber));
            })();
        if (matchingAccounts.length === 0) {
            console.warn(`No matching accounts found for target with actualAccountId ${target.actualAccountId}`);
            continue;
        }
        mappedAccounts[target.actualAccountId] = matchingAccounts;
    }

    return mappedAccounts
}

async function addTransactionsToActual(actualAccountId: string, accounts: TransactionsAccount[]): Promise<void> {
    accounts.forEach(account => {
        console.log(`Adding transactions for account ${account.accountNumber} to Actual account ${actualAccountId}...`);

        let transactions: ActualTransaction[] = [];

        for (const txn of account.txns) {
            const actualTransaction: ActualTransaction = {
                imported_id: txn.identifier?.toString(),
                date: txn.date.split('T')[0], // Convert to YYYY-MM-DD format
                amount: api.utils.amountToInteger(txn.chargedAmount),  // Convert to Actual's "amount" format
                payee_name: txn.description,
                account: actualAccountId
            };
            ActualTransactionSchema.parse(actualTransaction);
            transactions.push(actualTransaction);
        }

        // Import transactions to Actual using the API
        api.importTransactions(actualAccountId, transactions).then(() => {
            console.log(`Successfully imported transactions for account ${account.accountNumber} to Actual account ${actualAccountId}`);
        }).catch(err => {
            if (err instanceof Error) {
                console.error(`Failed to import transactions for account ${account.accountNumber} to Actual account ${actualAccountId}:`, err.message);
            } else {
                console.error(`Failed to import transactions for account ${account.accountNumber} to Actual account ${actualAccountId}:`, err);
            }
        });
    });
}

async function main(): Promise<void> {
    try {
        // Read and validate the configuration
        const rawJSON = JSON.parse(fs.readFileSync('config.json', 'utf-8'))
        const configData = AppConfigSchema.parse(rawJSON);

        // Initialize the Actual API with the provided configuration (if needed)
        console.log('Initializing Actual API with provided configuration...');
        const { init, budget } = configData.actual;
        await api.init(init);
        await api.downloadBudget(budget.syncId, { password: budget.password });

        // Get transactions from the banks (run in parallel)
        await Promise.all(
            Object.entries(configData.banks).map(async ([companyIdStr, bankConfig]) => {
                const companyId = companyIdStr as CompanyTypes;
                const transactionsAccounts = await getTransactionsAccountsFromBank(companyId, bankConfig.credentials);

                // Assign each scraped account to its target based on the config
                const mappedAccounts = await mapAccountsToTargets(transactionsAccounts, bankConfig.targets);

                // Add transactions to Actual
                await Promise.all(
                    Object.entries(mappedAccounts).map(([actualAccountId, accounts]) =>
                        addTransactionsToActual(actualAccountId, accounts)
                    )
                );
            })
        );

        // Safely shut down Actual API
        console.log('Shutting down Actual API...');
        await api.shutdown();

    } catch (err: unknown) {
        if (err instanceof Error) {
            console.error('Unexpected error:', err.message);
        } else {
            console.error('Unexpected error:', err);
        }
    }
}

main();