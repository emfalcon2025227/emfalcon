
/**
 * PRODUCTION PERFORMANCE MONITOR
 * Measures operational durations and detects bottlenecks.
 */
export interface PerformanceMetric {
  name: string;
  durationMs: number;
  status: "FAST" | "NORMAL" | "SLOW" | "CRITICAL";
  timestamp: string;
}

export function measurePerformance(name: string, fn: () => any): { result: any, metric: PerformanceMetric } {
  const start = performance.now();
  const result = fn();
  const end = performance.now();
  const durationMs = end - start;
  
  let status: PerformanceMetric["status"] = "FAST";
  if (durationMs > 10000) status = "CRITICAL";
  else if (durationMs > 3000) status = "SLOW";
  else if (durationMs > 1000) status = "NORMAL";

  return {
    result,
    metric: {
      name,
      durationMs,
      status,
      timestamp: new Date().toISOString()
    }
  };
}

export function getProductionPerformanceSummary(): PerformanceMetric[] {
  // Simulated historical metrics
  return [
    { name: "Executive Dashboard Loading", durationMs: 450, status: "FAST", timestamp: new Date().toISOString() },
    { name: "Financial Statement Generation", durationMs: 1200, status: "NORMAL", timestamp: new Date().toISOString() },
    { name: "Tenant Balance Calculation", durationMs: 2800, status: "NORMAL", timestamp: new Date().toISOString() },
    { name: "Excel Export (500 records)", durationMs: 5200, status: "SLOW", timestamp: new Date().toISOString() }
  ];
}
