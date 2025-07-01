import { cache } from "../src/services/cache/redis";

describe("Redis Cache", () => {
  beforeAll(async () => {
    await cache.connect();
  });

  afterAll(async () => {
    await cache.flushAll();
    await cache.disconnect();
  });

  test("should connect to Redis", async () => {
    const isHealthy = await cache.healthCheck();
    expect(isHealthy).toBe(true);
  });

  test("should set and get market data", async () => {
    const marketData = {
      symbol: "BTC",
      price: 50000,
      volume: 1000000,
      timestamp: new Date(),
    };

    await cache.setMarketData("BTC", marketData, 60);
    const retrieved = await cache.getMarketData("BTC");

    expect(retrieved.symbol).toBe("BTC");
    expect(retrieved.price).toBe(50000);
  });

  test("should handle rate limiting", async () => {
    const result1 = await cache.checkRateLimit("test:api", 5, 60);
    expect(result1.allowed).toBe(true);
    expect(result1.remaining).toBe(4);

    const result2 = await cache.checkRateLimit("test:api", 5, 60);
    expect(result2.remaining).toBe(3);
  });

  test("should cache technical indicators", async () => {
    const rsiData = { value: 65.5, signal: "NEUTRAL" };

    await cache.setIndicator("BTC", "RSI", "1h", rsiData);
    const retrieved = await cache.getIndicator("BTC", "RSI", "1h");

    expect(retrieved.value).toBe(65.5);
    expect(retrieved.signal).toBe("NEUTRAL");
  });
});
