import WebSocket from "ws";
import { database } from "../database/client";
import { cache } from "../cache/redis";
import { EventEmitter } from "events";

interface StreamData {
  symbol: string;
  price: number;
  volume: number;
  high: number;
  low: number;
  change: number;
  timestamp: Date;
}

export class MarketDataStream extends EventEmitter {
  private connections: Map<string, WebSocket> = new Map();
  private isRunning: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;

  constructor() {
    super();
  }

  async start(): Promise<void> {
    this.isRunning = true;
    console.log("🚀 Starting market data streams...");

    // Start multiple streams
    await this.connectBinanceStream();
    await this.connectCoinbaseStream();

    console.log("✅ All market data streams connected");
  }

  async stop(): Promise<void> {
    this.isRunning = false;

    for (const [name, ws] of this.connections) {
      ws.close();
      console.log(`📡 Closed ${name} connection`);
    }

    this.connections.clear();
    console.log("🛑 All market data streams stopped");
  }

  private async connectBinanceStream(): Promise<void> {
    const symbols = ["btcusdt", "ethusdt", "adausdt", "dotusdt", "linkusdt"];
    const streamUrl = `wss://stream.binance.com:9443/ws/${symbols.join("@ticker/")}@ticker`;

    const ws = new WebSocket(streamUrl);

    ws.on("open", () => {
      console.log("✅ Binance WebSocket connected");
      this.reconnectAttempts = 0;
    });

    ws.on("message", async (data: Buffer) => {
      try {
        const ticker = JSON.parse(data.toString());
        await this.processBinanceData(ticker);
      } catch (error) {
        console.error("❌ Error processing Binance data:", error);
      }
    });

    ws.on("close", () => {
      console.log("📡 Binance WebSocket disconnected");
      if (this.isRunning) {
        this.reconnectBinance();
      }
    });

    ws.on("error", (error) => {
      console.error("❌ Binance WebSocket error:", error);
    });

    this.connections.set("binance", ws);
  }

  private async connectCoinbaseStream(): Promise<void> {
    const ws = new WebSocket("wss://ws-feed.pro.coinbase.com");

    ws.on("open", () => {
      console.log("✅ Coinbase WebSocket connected");

      // Subscribe to ticker data
      const subscribeMessage = {
        type: "subscribe",
        product_ids: ["BTC-USD", "ETH-USD", "ADA-USD"],
        channels: ["ticker"],
      };

      ws.send(JSON.stringify(subscribeMessage));
    });

    ws.on("message", async (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        if (message.type === "ticker") {
          await this.processCoinbaseData(message);
        }
      } catch (error) {
        console.error("❌ Error processing Coinbase data:", error);
      }
    });

    ws.on("close", () => {
      console.log("📡 Coinbase WebSocket disconnected");
      if (this.isRunning) {
        this.reconnectCoinbase();
      }
    });

    this.connections.set("coinbase", ws);
  }

  private async processBinanceData(ticker: any): Promise<void> {
    const symbol = ticker.s.replace("USDT", ""); // BTCUSDT -> BTC

    const marketData: StreamData = {
      symbol,
      price: parseFloat(ticker.c),
      volume: parseFloat(ticker.v),
      high: parseFloat(ticker.h),
      low: parseFloat(ticker.l),
      change: parseFloat(ticker.P) / 100,
      timestamp: new Date(),
    };

    await this.storeMarketData(marketData, "binance");
    this.emit("marketData", marketData);
  }

  private async processCoinbaseData(ticker: any): Promise<void> {
    const symbol = ticker.product_id.split("-")[0]; // BTC-USD -> BTC

    const marketData: StreamData = {
      symbol,
      price: parseFloat(ticker.price),
      volume: parseFloat(ticker.volume_24h),
      high: parseFloat(ticker.high_24h),
      low: parseFloat(ticker.low_24h),
      change: parseFloat(ticker.open_24h)
        ? (parseFloat(ticker.price) - parseFloat(ticker.open_24h)) /
          parseFloat(ticker.open_24h)
        : 0,
      timestamp: new Date(),
    };

    await this.storeMarketData(marketData, "coinbase");
    this.emit("marketData", marketData);
  }

  private async storeMarketData(
    data: StreamData,
    source: string
  ): Promise<void> {
    try {
      // Store in cache (fast access)
      await cache.setMarketData(
        data.symbol,
        {
          ...data,
          source,
        },
        60
      );

      // Store in database (persistent)
      await database.insertMarketData({
        symbol: data.symbol,
        price: data.price,
        volume: data.volume,
        high24h: data.high,
        low24h: data.low,
        change24h: data.change,
      });

      // Emit success event
      this.emit("dataStored", { symbol: data.symbol, source });
    } catch (error) {
      console.error(`❌ Error storing market data for ${data.symbol}:`, error);
      this.emit("error", { symbol: data.symbol, error });
    }
  }

  private async reconnectBinance(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error("❌ Max reconnection attempts reached for Binance");
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.pow(2, this.reconnectAttempts) * 1000; // Exponential backoff

    console.log(
      `🔄 Reconnecting to Binance in ${delay}ms (attempt ${this.reconnectAttempts})`
    );

    setTimeout(() => {
      this.connectBinanceStream();
    }, delay);
  }

  private async reconnectCoinbase(): Promise<void> {
    setTimeout(() => {
      this.connectCoinbaseStream();
    }, 5000);
  }

  // Get real-time data from cache
  async getRealtimeData(symbol: string): Promise<StreamData | null> {
    return await cache.getMarketData(symbol);
  }

  // Get connection status
  getConnectionStatus(): { [key: string]: boolean } {
    const status: { [key: string]: boolean } = {};

    for (const [name, ws] of this.connections) {
      status[name] = ws.readyState === WebSocket.OPEN;
    }

    return status;
  }
}

export const marketDataStream = new MarketDataStream();
