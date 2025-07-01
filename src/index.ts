import { database } from "./services/database/client";
import { cache } from "./services/cache/redis";
import { marketDataStream } from "./services/data-providers/market-stream";
import { historicalDataCollector } from "./services/data-providers/historical";
import { config } from "./config";

class TradingAgentApp {
  private isRunning: boolean = false;

  async start(): Promise<void> {
    try {
      console.log("🚀 Starting ElizaOS Trading Agent...");

      // 1. Connect to database
      await database.connect();
      console.log("✅ Database connected");

      // 2. Connect to Redis
      await cache.connect();
      console.log("✅ Cache connected");

      // 3. Collect initial historical data
      console.log("📊 Collecting initial historical data...");
      const symbols = ["BTC", "ETH", "ADA", "DOT", "LINK"];
      await historicalDataCollector.bulkCollectForSymbols(symbols, [
        "1h",
        "4h",
        "1d",
      ]);
      console.log("✅ Historical data collection completed");

      // 4. Start real-time data streams
      await marketDataStream.start();
      console.log("✅ Real-time data streams started");

      // 5. Setup event listeners
      this.setupEventListeners();

      this.isRunning = true;
      console.log("🎉 ElizaOS Trading Agent is now running!");

      // Keep the process alive
      this.setupGracefulShutdown();
    } catch (error) {
      console.error("❌ Failed to start Trading Agent:", error);
      await this.shutdown();
      process.exit(1);
    }
  }

  private setupEventListeners(): void {
    marketDataStream.on("marketData", (data) => {
      console.log(
        `📈 ${data.symbol}: $${data.price.toFixed(2)} (${(data.change * 100).toFixed(2)}%)`
      );
    });

    marketDataStream.on("dataStored", (event) => {
      console.log(`💾 Stored ${event.symbol} data from ${event.source}`);
    });

    marketDataStream.on("error", (event) => {
      console.error(`❌ Data error for ${event.symbol}:`, event.error);
    });
  }

  private setupGracefulShutdown(): void {
    const signals = ["SIGTERM", "SIGINT", "SIGUSR2"];

    signals.forEach((signal) => {
      process.on(signal, async () => {
        console.log(`\n📡 Received ${signal}, shutting down gracefully...`);
        await this.shutdown();
        process.exit(0);
      });
    });
  }

  async shutdown(): Promise<void> {
    if (!this.isRunning) return;

    console.log("🛑 Shutting down Trading Agent...");

    try {
      await marketDataStream.stop();
      await database.disconnect();
      await cache.disconnect();

      this.isRunning = false;
      console.log("✅ Trading Agent shut down successfully");
    } catch (error) {
      console.error("❌ Error during shutdown:", error);
    }
  }

  async healthCheck(): Promise<{
    database: boolean;
    cache: boolean;
    streams: { [key: string]: boolean };
  }> {
    return {
      database: await database.healthCheck(),
      cache: await cache.healthCheck(),
      streams: marketDataStream.getConnectionStatus(),
    };
  }
}

// Create and start the application
const app = new TradingAgentApp();

if (require.main === module) {
  app.start().catch(console.error);
}

export { app as tradingAgent };
