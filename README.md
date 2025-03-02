# Britewyn 

This is a grafana plugin for data analytics using natural language to query datasources and create panels to use in a dashboard.

## How to package this plugin

### Backend

1. Update [Grafana plugin SDK for Go](https://grafana.com/developers/plugin-tools/key-concepts/backend-plugins/grafana-plugin-sdk-for-go) dependency to the latest minor version:

   ```bash
   go get -u github.com/grafana/grafana-plugin-sdk-go
   go mod tidy
   ```

2. Build backend plugin binaries for Linux, Windows and Darwin:

   ```bash
   mage -v
   ```

3. List all available Mage targets for additional commands:

   ```bash
   mage -l
   ```

### Frontend

1. Install dependencies

   ```bash
   npm install
   ```

2. Build plugin in production mode

   ```bash
   npm run build
   ```

### Optional Testing

1. Run the frontend tests (using Jest)

   ```bash
   # Runs the tests and watches for changes, requires git init first
   npm run test

   # Exits after running all the tests
   npm run test:ci
   ```

2. Spin up a Grafana instance and run the plugin inside it (using docker compose)

   ```bash
   npm run server
   ```

3. Run the E2E tests (using Cypress)

   ```bash
   # Spins up a Grafana instance first that we tests against
   npm run server

   # Starts the tests
   npm run e2e
   ```

4. Run the linter

   ```bash
   npm run lint

   # or

   npm run lint:fix
   ```

## Packaging the plugin with a private signature

### sign the plugin after distro has been built and set your GRAFANA_ACCESS_POLICY_TOKEN from the grafana cloud instance
Under Access Policies -> Create Access Policy -> Realms(all stacks) + Scope "plugins" Write flag, or you will get a 403
```bash
export GRAFANA_ACCESS_POLICY_TOKEN=<yourtoken>
npx @grafana/sign-plugin@latest --rootUrls http://localhost:3000
 ```

### zip the app according to the plugin id convention
```bash
mv dist/ fiftyone-britewyn-app
zip fiftyone-britewyn-app-1.0.0.zip fiftyone-britewyn-app -r
zipinfo fiftyone-britewyn-app-1.0.0.zip
 ```

### move the zip into your grafana image and unzip
```bash
docker cp fiftyone-britewyn-app-1.0.0.zip grafana:/var/lib/grafana/plugins
docker exec -u grafana grafana unzip /var/lib/grafana/plugins/fiftyone-britewyn-app-1.0.0.zip -d /var/lib/grafana/plugins/
 ```

### reload grafana, you can find the plugin called Britewyn 
1) configure API Key and URL e.g. https://api.openai.com/v1/chat/completions
2) configure DB Model (the table columns - automatic generation WIP)
3) configure DB Schema (the column values - automatic generation WIP)
4) configure the context for better queries (e.g. make sure to use partition, set timeframe defaults when absent)







