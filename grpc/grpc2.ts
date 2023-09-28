import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { Observable, Subject } from 'rxjs';
const PROTO_PATH = __dirname + '/message.proto';
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});
const message_proto: any = grpc.loadPackageDefinition(packageDefinition).message;

function main() {
  var client = new message_proto.Message('localhost:3001',
    grpc.credentials.createInsecure());
  var user;

  client.sendMessage({ message: user }, function (err, response) {
    console.log('Greeting:');
    console.log(response);
  });
}

main();