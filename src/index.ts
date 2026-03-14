import { CompanyTypes, createScraper, Scraper, ScraperCredentials, ScraperOptions, ScraperScrapingResult } from 'israeli-bank-scrapers';
import { type AppConfig, AppConfigSchema } from './config.ts';
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
        showBrowser: true, // TODO: Set to false to run in headless mode
        verbose: true, // Set to true to include more debug info in the output
        defaultTimeout: 60000, // Set a custom timeout for navigation (default is 30000 ms)
    };

    const scraper: Scraper<ScraperCredentials> = createScraper(options);

    const scrapeResult: ScraperScrapingResult = await scraper.scrape(credentials);

    if (!scrapeResult.success) {
        throw new Error(`Scraping failed: ${scrapeResult.errorType} - ${scrapeResult.errorMessage}`);
    }

    if (!scrapeResult.accounts || scrapeResult.accounts.length === 0) {
        console.warn('Scraping succeeded but no accounts were found.');
        return [];
    }

    return scrapeResult.accounts;
}

async function mapAccountsToTargets(accounts: TransactionsAccount[], targets: AppConfig['bank']['targets']): Promise<{ [actualAccountId: string]: TransactionsAccount }> {
    const mappedAccounts: { [actualAccountId: string]: TransactionsAccount } = {};

    for (const target of targets) {
        const matchingAccounts = target.accounts === "all"
            ? accounts
            : (() => {
                const allowedSet = new Set(target.accounts);
                return accounts.filter(acc => allowedSet.has(acc.accountNumber));
            })();
    }

    return mappedAccounts
}

async function addTransactionsToActual(actualAccountId: string, accounts: TransactionsAccount[]): Promise<void> {
    accounts.forEach(account => {
        console.log(`Adding transactions for account ${account.accountNumber} to Actual account ${actualAccountId}...`);    
        for (const txn of account.txns) {
            console.log("\t\t" + JSON.stringify(txn));
        }
    });
}

async function main(): Promise<void> {
    try {
        // Read and validate the configuration
        const rawJSON = JSON.parse(fs.readFileSync('config.json', 'utf-8'))
        const configData = AppConfigSchema.parse(rawJSON);

        // Initialize the Actual API with the provided configuration (if needed)
        console.log('Initializing Actual API with provided configuration...');
        await api.init(configData.actual.init);

        // Get transactions from the bank
        const bankConfig = configData.bank;
        const transactionsAccounts = await getTransactionsAccountsFromBank(bankConfig.companyId, bankConfig.credentials);

        // Assign each scraped account to its target based on the config
        const mappedAccounts = await mapAccountsToTargets(transactionsAccounts, bankConfig.targets);

        // Add transactions to Actual
        for (const [actualAccountId, account] of Object.entries(mappedAccounts)) {
            await addTransactionsToActual(actualAccountId, [account]);
        }

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