import axios from "axios";
import { database } from "../database/client";
import { cache } from "../cache/redis";

interface HistoricalDataPoint {
  symbol: string;
  timeframe: string;
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export class HistoricalDataCollector {
  private readonly baseUrls = {
    binance: "https://api.binance.com/api/v3",
    coinbase: "https://api.pro.coinbase.com",
  };

  async collectHistoricalData(
    symbol: string,
    timeframe: string = "1d",
    days: number = 365
  ): Promise<HistoricalDataPoint[]> {
    console.log(
      `📊 Collecting ${days} days of ${timeframe} data for ${symbol}...`
    );

    try {
      // Try cache first
      const cacheKey = `historical:${symbol}:${timeframe}:${days}`;
      const cached = await cache.get(cacheKey);

      if (cached) {
        console.log(`✅ Retrieved ${symbol} historical data from cache`);
        return cached;
      }

      // Fetch from Binance
      const data = await this.fetchBinanceHistorical(symbol, timeframe, days);

      // Cache for 1 hour
      await cache.set(cacheKey, data, 3600);

      // Store in database
      await this.storeHistoricalData(data);

      console.log(`✅ Collected ${data.length} data points for ${symbol}`);
      return data;
    } catch (error) {
      console.error(
        `❌ Error collecting historical data for ${symbol}:`,
        error
      );
      throw error;
    }
  }

  private async fetchBinanceHistorical(
    symbol: string,
    timeframe: string,
    days: number
  ): Promise<HistoricalDataPoint[]> {
    const binanceSymbol = `${symbol}USDT`;
    const interval = this.mapTimeframeToBinance(timeframe);

    const response = await axios.get(`${this.baseUrls.binance}/klines`, {
      params: {
        symbol: binanceSymbol,
        interval,
        limit: Math.min(days, 1000), // Binance limit
      },
    });

    return response.data.map((candle: any[]) => ({
      symbol,
      timeframe,
      timestamp: new Date(candle[0]),
      open: parseFloat(candle[1]),
      high: parseFloat(candle[2]),
      low: parseFloat(candle[3]),
      close: parseFloat(candle[4]),
      volume: parseFloat(candle[5]),
    }));
  }

  private mapTimeframeToBinance(timeframe: string): string {
    const mapping: { [key: string]: string } = {
      "1m": "1m",
      "5m": "5m",
      "15m": "15m",
      "30m": "30m",
      "1h": "1h",
      "4h": "4h",
      "1d": "1d",
      "1w": "1w",
      "1M": "1M",
    };

    return mapping[timeframe] || "1d";
  }

  private async storeHistoricalData(
    data: HistoricalDataPoint[]
  ): Promise<void> {
    for (const point of data) {
      try {
        await database.client.priceHistory.upsert({
          where: {
            symbol_timeframe_timestamp: {
              symbol: point.symbol,
              timeframe: point.timeframe,
              timestamp: point.timestamp,
            },
          },
          update: {
            open: point.open,
            high: point.high,
            low: point.low,
            close: point.close,
            volume: point.volume,
          },
          create: {
            symbol: point.symbol,
            timeframe: point.timeframe,
            timestamp: point.timestamp,
            open: point.open,
            high: point.high,
            low: point.low,
            close: point.close,
            volume: point.volume,
          },
        });
      } catch (error) {
        console.error(`❌ Error storing historical data point:`, error);
      }
    }
  }

  async bulkCollectForSymbols(
    symbols: string[],
    timeframes: string[] = ["1h", "4h", "1d"]
  ): Promise<void> {
    console.log(`📊 Bulk collecting data for ${symbols.length} symbols...`);

    for (const symbol of symbols) {
      for (const timeframe of timeframes) {
        try {
          await this.collectHistoricalData(symbol, timeframe, 100);

          // Rate limiting - wait 100ms between requests
          await new Promise((resolve) => setTimeout(resolve, 100));
        } catch (error) {
          console.error(
            `❌ Error collecting data for ${symbol} ${timeframe}:`,
            error
          );
        }
      }
    }

    console.log("✅ Bulk historical data collection completed");
  }

  async getHistoricalData(
    symbol: string,
    timeframe: string,
    limit: number = 100
  ): Promise<HistoricalDataPoint[]> {
    const data = await database.client.priceHistory.findMany({
      where: {
        symbol,
        timeframe,
      },
      orderBy: {
        timestamp: "desc",
      },
      take: limit,
    });

    return data.map((point) => ({
      symbol: point.symbol,
      timeframe: point.timeframe,
      timestamp: point.timestamp,
      open: point.open,
      high: point.high,
      low: point.low,
      close: point.close,
      volume: point.volume,
    }));
  }
}

export const historicalDataCollector = new HistoricalDataCollector();
