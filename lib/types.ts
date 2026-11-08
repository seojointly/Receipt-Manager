export interface Receipt {
  id: string
  date: string
  storeName: string
  supplyAmount: number
  taxAmount: number
  totalAmount: number
  category: string
  memo: string
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

export interface SheetRow {
  id: string
  date: string
  storeName: string
  category: string
  memo: string
  totalAmount: number
}

/** 시트 전송 시 클라이언트가 보내는 5개 필드 (id 제외) */
export type SyncData = Omit<SheetRow, 'id'>

export interface ApiError {
  error: string
  code: 'PARSE_FAILED' | 'API_ERROR' | 'SHEETS_ERROR' | 'VALIDATION_ERROR'
}
