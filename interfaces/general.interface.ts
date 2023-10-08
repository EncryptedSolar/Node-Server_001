export enum ColorCode {
    'GREEN' = 'GREEN',
    "YELLOW" = "YELLOW",
    "RED" = "RED"
}

export interface messageTransmissionInterface {
    id?: string,
    state: '' | 'attempt to send' | 'failed sent' | 'success sent',
    date?: Date,
    msg: string
}
export interface MessageLog {
    appLogLocId: string,
    appData: {
        msgId: string,
        msgLogDateTime: string,
        msgDateTime: string,
        msgTag: string[],
        msgPayload: string
    }
}
export interface ServerResponse {
    confirmationMessage: string,
    msgId: string
}

export interface ReportStatus {
    code: ColorCode
    message: string
}