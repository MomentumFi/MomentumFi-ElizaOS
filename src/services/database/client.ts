import { PrismaClient } from "@prisma/client";

class DatabaseService {
  private static instance: DatabaseService;
  private prisma: PrismaClient;
  private isConnected: boolean = false;

  private constructor() {
    this.prisma = new PrismaClient({
      log:
        process.env.NODE_ENV === "development"
          ? ["query", "info", "warn", "error"]
          : ["error"],
    });
  }

  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  async connect(): Promise<void> {
    try {
      await this.prisma.$connect();
      this.isConnected = true;
      console.log("✅ Database connected successfully");
    } catch (error) {
      console.error("❌ Database connection failed:", error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
    this.isConnected = false;
    console.log("📡 Database disconnected");
  }

  get client(): PrismaClient {
    if (!this.isConnected) {
      throw new Error("Database not connected. Call connect() first.");
    }
    return this.prisma;
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  // Helper methods for common operations
  async createUser(email: string, name?: string) {
    return this.prisma.user.create({
      data: { email, name },
    });
  }

  async createPortfolio(
    userId: string,
    name: string,
    riskLevel: string = "MEDIUM"
  ) {
    return this.prisma.portfolio.create({
      data: {
        userId,
        name,
        riskLevel,
      },
    });
  }

  async insertMarketData(data: {
    symbol: string;
    price: number;
    volume: number;
    high24h: number;
    low24h: number;
    change24h: number;
  }) {
    return this.prisma.marketData.create({
      data,
    });
  }

  async getLatestMarketData(symbol: string) {
    return this.prisma.marketData.findFirst({
      where: { symbol },
      orderBy: { timestamp: "desc" },
    });
  }

  async logSystemEvent(
    level: string,
    message: string,
    component: string,
    data?: any
  ) {
    return this.prisma.systemLog.create({
      data: {
        level,
        message,
        component,
        data,
      },
    });
  }
}

export const database = DatabaseService.getInstance();
export { PrismaClient } from "@prisma/client";
