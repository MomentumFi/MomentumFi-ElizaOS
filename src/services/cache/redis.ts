import Redis from "ioredis";
import { config } from "../../config/config";

class CacheService {
  private static instance: CacheService;
  private client: Redis;
  private isConnected: boolean = false;

  private constructor() {
    this.client = new Redis(config.REDIS_URL, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });

    this.client.on("connect", () => {
      console.log("✅ Redis connected successfully");
      this.isConnected = true;
    });

    this.client.on("error", (error) => {
      console.error("❌ Redis connection error:", error);
      this.isConnected = false;
    });
  }

  public static getInstance(): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService();
    }
    return CacheService.instance;
  }

  async connect(): Promise<void> {
    try {
      await this.client.connect();
    } catch (error) {
      console.error("❌ Failed to connect to Redis:", error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    await this.client.disconnect();
    this.isConnected = false;
    console.log("📡 Redis disconnected");
  }

  // Market data caching
  async setMarketData(
    symbol: string,
    data: any,
    ttl: number = 60
  ): Promise<void> {
    const key = `market:${symbol}`;
    await this.client.setex(key, ttl, JSON.stringify(data));
  }

  async getMarketData(symbol: string): Promise<any | null> {
    const key = `market:${symbol}`;
    const data = await this.client.get(key);
    return data ? JSON.parse(data) : null;
  }

  // Price history caching
  async setPriceHistory(
    symbol: string,
    timeframe: string,
    data: any[],
    ttl: number = 300
  ): Promise<void> {
    const key = `price:${symbol}:${timeframe}`;
    await this.client.setex(key, ttl, JSON.stringify(data));
  }

  async getPriceHistory(
    symbol: string,
    timeframe: string
  ): Promise<any[] | null> {
    const key = `price:${symbol}:${timeframe}`;
    const data = await this.client.get(key);
    return data ? JSON.parse(data) : null;
  }

  // Technical indicators caching
  async setIndicator(
    symbol: string,
    indicator: string,
    timeframe: string,
    value: any,
    ttl: number = 120
  ): Promise<void> {
    const key = `indicator:${symbol}:${indicator}:${timeframe}`;
    await this.client.setex(key, ttl, JSON.stringify(value));
  }

  async getIndicator(
    symbol: string,
    indicator: string,
    timeframe: string
  ): Promise<any | null> {
    const key = `indicator:${symbol}:${indicator}:${timeframe}`;
    const data = await this.client.get(key);
    return data ? JSON.parse(data) : null;
  }

  // Portfolio caching
  async setPortfolio(
    portfolioId: string,
    data: any,
    ttl: number = 30
  ): Promise<void> {
    const key = `portfolio:${portfolioId}`;
    await this.client.setex(key, ttl, JSON.stringify(data));
  }

  async getPortfolio(portfolioId: string): Promise<any | null> {
    const key = `portfolio:${portfolioId}`;
    const data = await this.client.get(key);
    return data ? JSON.parse(data) : null;
  }

  // Generic cache methods
  async set(key: string, value: any, ttl: number = 300): Promise<void> {
    await this.client.setex(key, ttl, JSON.stringify(value));
  }

  async get(key: string): Promise<any | null> {
    const data = await this.client.get(key);
    return data ? JSON.parse(data) : null;
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async exists(key: string): Promise<boolean> {
    const result = await this.client.exists(key);
    return result === 1;
  }

  async flushAll(): Promise<void> {
    await this.client.flushall();
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.client.ping();
      return true;
    } catch {
      return false;
    }
  }

  // Rate limiting
  async checkRateLimit(
    key: string,
    limit: number,
    window: number
  ): Promise<{ allowed: boolean; remaining: number }> {
    const current = await this.client.incr(key);

    if (current === 1) {
      await this.client.expire(key, window);
    }

    const remaining = Math.max(0, limit - current);
    return {
      allowed: current <= limit,
      remaining,
    };
  }
}

export const cache = CacheService.getInstance();
