export enum ColorCode {
    'GREEN' = 'GREEN',
    "YELLOW" = "YELLOW",
    "RED" = "RED"
}

export interface ReportStatus {
    code: ColorCode,
    message: string,
    payload?: any
}
