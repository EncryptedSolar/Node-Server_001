"use strict";
import * as path from 'path'
import * as grpc from '@grpc/grpc-js'
import * as protoLoader from '@grpc/proto-loader'
const PROTO_PATH = path.join(__dirname, 'message.proto');
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});
const message_proto: any = grpc.loadPackageDefinition(packageDefinition).message;
module.exports = message_proto;
//# sourceMappingURL=health.js.map