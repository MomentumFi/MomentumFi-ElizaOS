import { tradingAgent } from "../src/index";

describe("Integration Test - Full System", () => {
  test("should start and run complete system", async () => {
    console.log("🧪 Starting integration test...");

    // Start the system
    await tradingAgent.start();

    // Wait for data to flow
    await new Promise((resolve) => setTimeout(resolve, 10000));

    // Check health
    const health = await tradingAgent.healthCheck();

    expect(health.database).toBe(true);
    expect(health.cache).toBe(true);
    expect(health.streams.binance).toBe(true);

    // Shutdown
    await tradingAgent.shutdown();

    console.log("✅ Integration test completed successfully");
  }, 30000);
});
