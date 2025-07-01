import { database } from "../src/services/database/client";

describe("Database Setup", () => {
  beforeAll(async () => {
    await database.connect();
  });

  afterAll(async () => {
    await database.disconnect();
  });

  test("should connect to database", async () => {
    const isHealthy = await database.healthCheck();
    expect(isHealthy).toBe(true);
  });

  test("should create user", async () => {
    const user = await database.createUser("test@example.com", "Test User");
    expect(user.email).toBe("test@example.com");
    expect(user.id).toBeDefined();
  });

  test("should create portfolio", async () => {
    const user = await database.createUser("portfolio@test.com");
    const portfolio = await database.createPortfolio(user.id, "Test Portfolio");

    expect(portfolio.name).toBe("Test Portfolio");
    expect(portfolio.userId).toBe(user.id);
    expect(portfolio.riskLevel).toBe("MEDIUM");
  });

  test("should insert and retrieve market data", async () => {
    const marketData = {
      symbol: "BTC",
      price: 50000,
      volume: 1000000,
      high24h: 52000,
      low24h: 48000,
      change24h: 0.02,
    };

    const inserted = await database.insertMarketData(marketData);
    expect(inserted.symbol).toBe("BTC");

    const retrieved = await database.getLatestMarketData("BTC");
    expect(retrieved?.price).toBe(50000);
  });
});
