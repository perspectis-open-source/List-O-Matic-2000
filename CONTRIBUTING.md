# Contributing to List-O-Matic 2000

Thanks for your interest in contributing. Here’s how to get started.

## Development setup

1. **Clone the repo**
   ```bash
   git clone https://github.com/YOUR_USERNAME/List-O-Matic-2000.git
   cd List-O-Matic-2000
   ```

2. **Client**
   ```bash
   cd client
   npm install
   npm run dev
   ```

3. **Server**
   ```bash
   cd server
   cp .env.example .env
   # Edit .env: set OPENAI_API_KEY, CORS_ORIGIN, PORT
   npm install
   npm run dev
   ```

See [README.md](./README.md) for full setup and env details.

## Running tests

- **Unit / component (client):** `cd client && npm run test:run`
- **E2E (client):** `cd client && npm run test:e2e` (ensure nothing is using port 5173)
- **Coverage:** `cd client && npm run test:coverage`

## How to contribute

1. **Open an issue** for bugs or feature ideas so we can align before you code.
2. **Fork the repo**, create a branch (e.g. `fix/thing` or `feat/thing`).
3. **Make your changes**, keep tests passing, add tests for new behavior when relevant.
4. **Open a pull request** against the default branch. Describe what changed and why; link any related issue.

## Code and behavior

- The app sends only **company names** to the LLM (no PII). Keep that design when changing server or prompts.
- Prefer small, focused PRs. For large changes, discuss in an issue first.

## Code of Conduct

This project adheres to the [Contributor Covenant Code of Conduct](./CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](./LICENSE).
