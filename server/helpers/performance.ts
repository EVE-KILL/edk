export interface TrackedQuery {
  query: string
  params: any[] | undefined
  duration: number
}

export class PerformanceTracker {
  private readonly startTime: number
  private readonly queries: TrackedQuery[] = []

  constructor(private readonly debug = false) {
    this.startTime = performance.now()
  }

  addQuery(query: string, params: any[] | undefined, duration: number) {
    this.queries.push({ query, params, duration })
  }

  getQueries() {
    return this.queries
  }

  getSummary() {
    const totalTime = performance.now() - this.startTime
    const dbTime = this.queries.reduce((sum, q) => sum + q.duration, 0)
    const appTime = totalTime - dbTime
    const queryCount = this.queries.length

    return {
      totalTime: totalTime.toFixed(2),
      dbTime: dbTime.toFixed(2),
      appTime: appTime.toFixed(2),
      queryCount,
      queries: this.debug ? this.queries.map(q => ({
        ...q,
        duration: q.duration.toFixed(2)
      })) : []
    }
  }
}
