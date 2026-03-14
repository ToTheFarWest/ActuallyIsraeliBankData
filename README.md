# Actually Israeli Bank Data

Automate the process of scraping your Israeli bank and credit card data and importing it into [Actual Budget](https://actualbudget.com/).

This project leverages the powerful [israeli-bank-scrapers](https://github.com/brafdlog/israeli-bank-scrapers) library to fetch your financial transactions and the [Actual API](https://actual-stack.github.io/actual-api/) to sync them seamlessly.

## Features

- **Automated Scraping**: Support for various Israeli banks and credit cards (Leumi, Isracard, etc.).
- **Smart Mapping**: Map specific bank accounts to corresponding Actual accounts.
- **Transaction Deduplication**: Actual's API handles deduplication using unique transaction identifiers.
- **Docker Ready**: Easy deployment using Docker and Docker Compose.

## Prerequisites

- An instance of [Actual Budget](https://actualbudget.com/docs/install/) running.
- **Actual Server URL**, **Password**, and your **Budget Sync ID**.
- Node.js (if running locally without Docker).

## Setup

### 1. Configuration

Copy the example configuration file and fill in your details:

```bash
cp config.example.json config.json
```

Edit `config.json` with your credentials:

- **`actual`**:
    - `init.serverURL`: Your Actual server URL.
    - `init.password`: Your Actual server password.
    - `budget.syncId`: Found in Actual Budget under `Settings` -> `Show advanced settings` -> `Sync ID`.
- **`banks`**:
    - Each key should be a supported `CompanyType` (e.g., `leumi`, `isracard`).
    - `credentials`: Your login details for the financial institution.
    - `targets`: An array of objects mapping scraped accounts to Actual account IDs.
        - `actualAccountId`: The UUID of the account in Actual.
        - `accounts`: Either `"all"` or an array of account numbers (last 4 digits often suffice).

### 2. Finding Actual Account IDs

To find the `actualAccountId`, open Actual Budget, select the account, and look at the URL. The ID is the long string of characters at the end of the URL.

## Running the Application

### Using Docker (Recommended)

The easiest way to run the scraper is using Docker Compose:

```bash
docker compose up --build
```

This will build the image and run the scraper. It mounts your `config.json` and a `data` directory for persistent storage (Actual's local database).

### Running Locally

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the scraper:
   ```bash
   npm start
   ```

## Development

If you want to contribute or modify the logic:

- `src/index.ts`: Main entry point and orchestration logic.
- `src/config.ts`: Configuration schema and validation using Zod.
- `src/types.ts`: Type definitions for transactions.

### Scripts

- `npm run check`: Run TypeScript type checking.
- `npm start`: Run the application using `ts-node`.

## Disclaimer

This tool is provided "as is". Be careful with your financial credentials. Ensure your `config.json` is never committed to version control (it is included in `.gitignore`).

## License

ISC
