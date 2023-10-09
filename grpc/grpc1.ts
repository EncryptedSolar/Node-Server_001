import { GrpcService } from "../services/grpc.service";

const gprcService: GrpcService = new GrpcService()

let server1 = 'localhost:3000'
let server2 = 'localhost:3001'

gprcService.createGrpcServer(server1)
gprcService.createGrpcServer(server2)


setTimeout(() => {
  gprcService.stopServer(server1).then((res) => {
    gprcService.getAllGrpcServerConnectionInstance()
  })
}, 3000)

setTimeout(() => {
  gprcService.createGrpcServer(server1).then((res) => {
    gprcService.getAllGrpcServerConnectionInstance()
  })
}, 10000)

/* Behaviour
When server is disconnected, the client will still send regardless of whether server is alive. 
Of course, an error will be shown on client side if there's no connection established with the server.
But nevertheless it will attempt to send. ALthough the sad news is, even if the server is restarted,
the client would not automatically attempt to reconnect. 
As for the error message trigger, it seems that on the server side, if the error is triggered, in
that call.emit('error'), it will cease it's own operation. Further investigation is to be conducted
to understand the operatives of grpc
*/
