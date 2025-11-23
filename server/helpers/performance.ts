export interface TrackedQuery {
  query: string;
  params: any[] | undefined;
  duration: number;
}

export interface TrackedMark {
  name: string;
  timestamp: number;
  duration?: number;
}

export type SpanCategory =
  | 'database'
  | 'cache'
  | 'search'
  | 'http'
  | 'template'
  | 'application'
  | 'other';

export interface Span {
  id: string;
  name: string;
  category: SpanCategory;
  startTime: number;
  endTime?: number;
  duration?: number;
  parentId?: string;
  metadata?: Record<string, any>;
}

export class PerformanceTracker {
  private readonly startTime: number;
  private readonly queries: TrackedQuery[] = [];
  private readonly marks: TrackedMark[] = [];
  private readonly timers: Map<string, number> = new Map();
  private readonly spans: Map<string, Span> = new Map();
  private spanCounter = 0;
  private currentSpanId?: string;

  constructor(private readonly debug = false) {
    this.startTime = Date.now();
  }

  addQuery(query: string, params: any[] | undefined, duration: number) {
    this.queries.push({ query, params, duration });
  }

  getQueries() {
    return this.queries;
  }

  // Start a new span
  startSpan(name: string, category: SpanCategory, metadata?: Record<string, any>): string {
    const id = `span_${++this.spanCounter}`;
    const span: Span = {
      id,
      name,
      category,
      startTime: Date.now(),
      parentId: this.currentSpanId,
      metadata,
    };
    this.spans.set(id, span);
    return id;
  }

  // End a span
  endSpan(id: string) {
    const span = this.spans.get(id);
    if (span && !span.endTime) {
      span.endTime = Date.now();
      span.duration = span.endTime - span.startTime;
    }
  }

  // Track a function execution with automatic span creation
  async track<T>(
    name: string,
    category: SpanCategory,
    fn: () => T | Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    const spanId = this.startSpan(name, category, metadata);
    const previousSpanId = this.currentSpanId;
    this.currentSpanId = spanId;

    try {
      const result = await fn();
      return result;
    } finally {
      this.endSpan(spanId);
      this.currentSpanId = previousSpanId;
    }
  }

  // Get all spans
  getSpans(): Span[] {
    return Array.from(this.spans.values());
  }

  // Mark a point in time
  mark(name: string) {
    this.marks.push({
      name,
      timestamp: Date.now() - this.startTime,
    });
  }

  // Start a timer
  startTimer(name: string) {
    this.timers.set(name, Date.now());
  }

  // End a timer and record duration
  endTimer(name: string) {
    const start = this.timers.get(name);
    if (start) {
      const duration = Date.now() - start;
      this.marks.push({
        name,
        timestamp: Date.now() - this.startTime,
        duration,
      });
      this.timers.delete(name);
    }
  }

  // Get time since request start
  getElapsed(): number {
    return Date.now() - this.startTime;
  }

  // Finalize metrics (called before response is sent)
  finalizeMetrics() {
    // Mark final timing point if not already done
    if (!this.marks.find((m) => m.name === 'response_ready')) {
      this.mark('response_ready');
    }
  }

  getSummary() {
    const totalTime = Date.now() - this.startTime;
    const dbTimeTotal = this.queries.reduce((sum, q) => sum + q.duration, 0);
    const dbTimeAvg = this.queries.length > 0 ? dbTimeTotal / this.queries.length : 0;
    const queryCount = this.queries.length;

    // Calculate category breakdowns
    const spans = this.getSpans();
    const categoryBreakdown: Record<SpanCategory, { count: number; total: number }> = {
      database: { count: 0, total: 0 },
      cache: { count: 0, total: 0 },
      search: { count: 0, total: 0 },
      http: { count: 0, total: 0 },
      template: { count: 0, total: 0 },
      application: { count: 0, total: 0 },
      other: { count: 0, total: 0 },
    };

    // Calculate total from top-level spans only (no double-counting)
    let trackedTotalTime = 0;
    const now = Date.now();
    for (const span of spans) {
      // Calculate duration for running spans (those without endTime yet)
      const duration = span.duration || (span.endTime ? span.endTime - span.startTime : now - span.startTime);

      if (duration > 0) {
        categoryBreakdown[span.category].count++;
        categoryBreakdown[span.category].total += duration;

        // Only count top-level spans for total
        if (!span.parentId) {
          trackedTotalTime += duration;
        }
      }
    }

    const appTime = totalTime - dbTimeAvg;

    return {
      totalTime: totalTime.toFixed(2),
      trackedTotalTime: trackedTotalTime.toFixed(2),
      dbTime: dbTimeAvg.toFixed(2),
      dbTimeTotal: dbTimeTotal.toFixed(2),
      appTime: appTime.toFixed(2),
      queryCount,
      categoryBreakdown: Object.fromEntries(
        Object.entries(categoryBreakdown).map(([cat, data]) => [
          cat,
          {
            count: data.count,
            total: data.total.toFixed(2),
            avg: data.count > 0 ? (data.total / data.count).toFixed(2) : '0.00',
          },
        ])
      ),
      queries: this.debug
        ? this.queries.map((q) => ({
            ...q,
            duration: q.duration.toFixed(2),
          }))
        : [],
      marks: this.debug
        ? this.marks.map((m) => ({
            ...m,
            timestamp: m.timestamp.toFixed(2),
            duration: m.duration?.toFixed(2),
          }))
        : [],
      spans: this.debug
        ? (() => {
            // Build a map of span ID to depth
            const depthMap = new Map<string, number>();
            const calculateDepth = (span: Span): number => {
              if (depthMap.has(span.id)) {
                return depthMap.get(span.id)!;
              }
              if (!span.parentId) {
                depthMap.set(span.id, 0);
                return 0;
              }
              const parent = spans.find((s) => s.id === span.parentId);
              const depth = parent ? calculateDepth(parent) + 1 : 0;
              depthMap.set(span.id, depth);
              return depth;
            };

            return spans
              .map((s) => {
                // Calculate duration for running spans
                const duration = s.duration || (s.endTime ? s.endTime - s.startTime : now - s.startTime);
                const depth = calculateDepth(s);
                return {
                  ...s,
                  duration: duration.toFixed(2),
                  depth,
                };
              })
              .filter((s) => parseFloat(s.duration) > 0);
          })()
        : [],
    };
  }
}
