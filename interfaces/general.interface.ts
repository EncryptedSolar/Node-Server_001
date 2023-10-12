/* General interface used for office work/ */


export enum ColorCode {
    'GREEN' = 'GREEN',
    "YELLOW" = "YELLOW",
    "RED" = "RED"
}

export interface messageTransmissionInterface {
    id?: string,
    state: '' | 'attempt to send' | 'failed sent' | 'sent successfully',
    date?: Date,
    msg: string
}
export interface MessageLog { // this one specifically for office work case only. FIS copyright LOL
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
    code: ColorCode,
    message: string,
    payload?: any
}
// https://grpc.io/docs/what-is-grpc/core-concepts/
export interface GrpcConnectionType {
    instanceType: '' | 'server' | 'client'
    serviceMethod: '' | 'unary' | 'server streaming' | 'client streaming' | 'bidirectional'
}