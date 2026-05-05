export interface Receipt {
  id: string
  date: string
  storeName: string
  supplyAmount: number
  taxAmount: number
  totalAmount: number
  imageBase64?: string
  status: 'pending' | 'synced' | 'error'
  createdAt: string
  sheetsRowIndex?: number
}

export interface AnalyzeResult {
  date: string
  storeName: string
  supplyAmount: number
  taxAmount: number
  totalAmount: number
}

export interface ApiError {
  error: string
  code: 'PARSE_FAILED' | 'API_ERROR' | 'SHEETS_ERROR' | 'VALIDATION_ERROR'
}
