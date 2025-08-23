import * as si from 'systeminformation';
import { logger } from './logger.js';
import { Gauge } from 'prom-client';

// System resource metrics
export const systemCpuUsage = new Gauge({
  name: 'fdts_system_cpu_usage_percent',
  help: 'System CPU usage percentage'
});

export const systemMemoryUsage = new Gauge({
  name: 'fdts_system_memory_usage_bytes',
  help: 'System memory usage in bytes',
  labelNames: ['type']
});

export const systemDiskUsage = new Gauge({
  name: 'fdts_system_disk_usage_bytes',
  help: 'System disk usage in bytes',
  labelNames: ['type', 'filesystem']
});

export const systemNetworkTraffic = new Gauge({
  name: 'fdts_system_network_bytes_total',
  help: 'System network traffic in bytes',
  labelNames: ['direction', 'interface']
});

export const databaseFileSize = new Gauge({
  name: 'fdts_database_file_size_bytes',
  help: 'Database file size in bytes'
});

export const uploadDirectorySize = new Gauge({
  name: 'fdts_upload_directory_size_bytes',
  help: 'Upload directory size in bytes'
});

export interface SystemMetrics {
  cpu: {
    usage: number;
    cores: number;
    speed: number;
  };
  memory: {
    total: number;
    used: number;
    free: number;
    usage_percent: number;
  };
  disk: {
    total: number;
    used: number;
    free: number;
    usage_percent: number;
  };
  network: {
    rx_bytes: number;
    tx_bytes: number;
    rx_sec: number;
    tx_sec: number;
  };
  process: {
    cpu_percent: number;
    memory_bytes: number;
    uptime: number;
  };
  database: {
    size_bytes: number;
    connections: number;
  };
  storage: {
    uploads_size_bytes: number;
    temp_size_bytes: number;
  };
}

export class SystemMonitor {
  private static instance: SystemMonitor;
  private isCollecting = false;
  private collectionInterval: NodeJS.Timeout | null = null;
  // private lastNetworkStats: any = null;

  static getInstance(): SystemMonitor {
    if (!SystemMonitor.instance) {
      SystemMonitor.instance = new SystemMonitor();
    }
    return SystemMonitor.instance;
  }

  async collectSystemMetrics(): Promise<SystemMetrics> {
    try {
      const [cpu, memory, disk, network, processes] = await Promise.all([
        si.currentLoad(),
        si.mem(),
        si.fsSize(),
        si.networkStats(),
        si.processes()
      ]);

      // CPU metrics
      const cpuUsage = cpu.currentLoad;
      systemCpuUsage.set(cpuUsage);

      // Memory metrics
      systemMemoryUsage.labels('total').set(memory.total);
      systemMemoryUsage.labels('used').set(memory.used);
      systemMemoryUsage.labels('free').set(memory.free);

      // Disk metrics (primary filesystem)
      const primaryDisk = disk[0] || { size: 0, used: 0, available: 0, fs: 'unknown' };
      systemDiskUsage.labels('total', (primaryDisk as any).fs || 'unknown').set(primaryDisk.size);
      systemDiskUsage.labels('used', (primaryDisk as any).fs || 'unknown').set(primaryDisk.used);
      systemDiskUsage.labels('free', (primaryDisk as any).fs || 'unknown').set(primaryDisk.available);

      // Network metrics
      const primaryNetwork = network[0] || { rx_bytes: 0, tx_bytes: 0, rx_sec: 0, tx_sec: 0, iface: 'unknown' };
      systemNetworkTraffic.labels('rx', (primaryNetwork as any).iface || 'unknown').set(primaryNetwork.rx_bytes);
      systemNetworkTraffic.labels('tx', (primaryNetwork as any).iface || 'unknown').set(primaryNetwork.tx_bytes);

      // Process metrics
      const currentProcess = processes.list.find(p => p.pid === process.pid) || {
        cpu: 0,
        mem: 0
      };

      // Database and storage metrics
      const [dbSize, uploadsSize, tempSize] = await Promise.all([
        this.getDatabaseSize(),
        this.getDirectorySize('./uploads'),
        this.getDirectorySize('./uploads/temp')
      ]);

      databaseFileSize.set(dbSize);
      uploadDirectorySize.set(uploadsSize);

      return {
        cpu: {
          usage: cpuUsage,
          cores: (cpu as any).cpus?.length || 0,
          speed: (cpu as any).cpus?.[0]?.speed || 0
        },
        memory: {
          total: memory.total,
          used: memory.used,
          free: memory.free,
          usage_percent: (memory.used / memory.total) * 100
        },
        disk: {
          total: primaryDisk.size,
          used: primaryDisk.used,
          free: primaryDisk.available,
          usage_percent: (primaryDisk.used / primaryDisk.size) * 100
        },
        network: {
          rx_bytes: primaryNetwork.rx_bytes,
          tx_bytes: primaryNetwork.tx_bytes,
          rx_sec: primaryNetwork.rx_sec,
          tx_sec: primaryNetwork.tx_sec
        },
        process: {
          cpu_percent: currentProcess.cpu,
          memory_bytes: currentProcess.mem * 1024, // Convert KB to bytes
          uptime: process.uptime()
        },
        database: {
          size_bytes: dbSize,
          connections: 1 // SQLite doesn't have connection pooling like other DBs
        },
        storage: {
          uploads_size_bytes: uploadsSize,
          temp_size_bytes: tempSize
        }
      };
    } catch (error) {
      logger.error('Error collecting system metrics', { error: error instanceof Error ? error.message : 'Unknown error' });
      throw error;
    }
  }

  private async getDatabaseSize(): Promise<number> {
    try {
      const fs = await import('fs/promises');
      const stats = await fs.stat('./data/database.sqlite');
      return stats.size;
    } catch (error) {
      return 0;
    }
  }

  private async getDirectorySize(dirPath: string): Promise<number> {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      
      let totalSize = 0;
      
      const calculateSize = async (dir: string): Promise<void> => {
        try {
          const items = await fs.readdir(dir);
          
          for (const item of items) {
            const itemPath = path.join(dir, item);
            const stats = await fs.stat(itemPath);
            
            if (stats.isDirectory()) {
              await calculateSize(itemPath);
            } else {
              totalSize += stats.size;
            }
          }
        } catch (error) {
          // Directory might not exist or be accessible
        }
      };
      
      await calculateSize(dirPath);
      return totalSize;
    } catch (error) {
      return 0;
    }
  }

  startCollection(intervalMs: number = 30000): void {
    if (this.isCollecting) {
      return;
    }

    this.isCollecting = true;
    this.collectionInterval = setInterval(async () => {
      try {
        await this.collectSystemMetrics();
      } catch (error) {
        logger.error('Error in system metrics collection', { error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }, intervalMs);

    logger.info('System metrics collection started', { intervalMs });
  }

  stopCollection(): void {
    if (this.collectionInterval) {
      clearInterval(this.collectionInterval);
      this.collectionInterval = null;
    }
    this.isCollecting = false;
    logger.info('System metrics collection stopped');
  }

  isCollectionActive(): boolean {
    return this.isCollecting;
  }

  async getPerformanceReport(): Promise<{
    timestamp: string;
    metrics: SystemMetrics;
    alerts: string[];
    recommendations: string[];
  }> {
    const metrics = await this.collectSystemMetrics();
    const alerts: string[] = [];
    const recommendations: string[] = [];

    // Generate alerts based on thresholds
    if (metrics.cpu.usage > 80) {
      alerts.push(`High CPU usage: ${metrics.cpu.usage.toFixed(2)}%`);
      recommendations.push('Consider optimizing CPU-intensive operations or scaling resources');
    }

    if (metrics.memory.usage_percent > 85) {
      alerts.push(`High memory usage: ${metrics.memory.usage_percent.toFixed(2)}%`);
      recommendations.push('Monitor memory leaks and consider increasing available memory');
    }

    if (metrics.disk.usage_percent > 90) {
      alerts.push(`High disk usage: ${metrics.disk.usage_percent.toFixed(2)}%`);
      recommendations.push('Clean up old files and consider expanding storage capacity');
    }

    if (metrics.database.size_bytes > 1024 * 1024 * 1024) { // 1GB
      recommendations.push('Database size is growing large, consider archiving old data');
    }

    if (metrics.storage.uploads_size_bytes > 5 * 1024 * 1024 * 1024) { // 5GB
      recommendations.push('Upload directory is large, consider implementing file cleanup policies');
    }

    return {
      timestamp: new Date().toISOString(),
      metrics,
      alerts,
      recommendations
    };
  }
}

export const systemMonitor = SystemMonitor.getInstance();