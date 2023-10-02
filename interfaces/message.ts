export interface Message{
    user: 'guest' | User,
    action: Action,
}

interface User {
    userid: string,
    username: string,
    password: string,
    email: string
}

interface Action {
    action: string,
    description?: string,
    payload?: any
}