import { marketDataStream } from "../src/services/data-providers/market-stream";
import { historicalDataCollector } from "../src/services/data-providers/historical";
import { database } from "../src/services/database/client";
import { cache } from "../src/services/cache/redis";

describe("Data Ingestion Pipeline", () => {
  beforeAll(async () => {
    await database.connect();
    await cache.connect();
  });

  afterAll(async () => {
    await marketDataStream.stop();
    await database.disconnect();
    await cache.disconnect();
  });

  test("should collect historical data", async () => {
    const data = await historicalDataCollector.collectHistoricalData(
      "BTC",
      "1d",
      30
    );

    expect(data).toBeDefined();
    expect(data.length).toBeGreaterThan(0);
    expect(data[0].symbol).toBe("BTC");
    expect(data[0].timeframe).toBe("1d");
    expect(data[0].open).toBeGreaterThan(0);
  }, 10000);

  test("should start market data stream", async () => {
    await marketDataStream.start();

    // Wait for connection
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const status = marketDataStream.getConnectionStatus();
    expect(status.binance).toBe(true);
  }, 15000);

  test("should receive real-time market data", (done) => {
    marketDataStream.on("marketData", (data) => {
      expect(data.symbol).toBeDefined();
      expect(data.price).toBeGreaterThan(0);
      expect(data.timestamp).toBeInstanceOf(Date);
      done();
    });

    // Timeout after 30 seconds
    setTimeout(() => {
      done();
    }, 30000);
  }, 35000);

  test("should store data in cache and database", async () => {
    // Wait for some data to be processed
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Check cache
    const cachedData = await cache.getMarketData("BTC");
    expect(cachedData).toBeDefined();

    // Check database
    const dbData = await database.getLatestMarketData("BTC");
    expect(dbData).toBeDefined();
    if (dbData) {
      expect(dbData.price).toBeGreaterThan(0);
    }
  }, 10000);
});
