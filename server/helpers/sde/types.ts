export interface FieldMapping {
  source: string
  target: string
  type: 'string' | 'number' | 'boolean' | 'array' | 'json'
  required?: boolean
  transform?: (value: any) => any
}

export interface TableConfig {
  name: string
  mappings: FieldMapping[]
  batchSize?: number
}
