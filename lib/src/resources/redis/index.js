"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Redis = void 0;
const pulumi = require("@pulumi/pulumi");
const gcp = require("@pulumi/gcp");
const constants_1 = require("../../constants");
const REDIS_LOCAL_HOST = 'redis';
const REDIS_LOCAL_PORT = 6379;
const REDIS_LOCAL_AUTH = '';
class Redis extends pulumi.ComponentResource {
    constructor(name, args, opts) {
        super(`${constants_1.urnPrefix}:Redis`, name, args, opts);
        if (!args.isAdhocEnv) {
            this.instance = new gcp.redis.Instance(name, args, Object.assign(Object.assign({}, opts), { parent: this, aliases: [{ name, parent: pulumi.rootStackResource }] }));
        }
    }
    get host() {
        var _a;
        return ((_a = this.instance) === null || _a === void 0 ? void 0 : _a.host) || pulumi.output(REDIS_LOCAL_HOST);
    }
    get port() {
        var _a;
        return ((_a = this.instance) === null || _a === void 0 ? void 0 : _a.port) || pulumi.output(REDIS_LOCAL_PORT);
    }
    get authString() {
        var _a;
        return ((_a = this.instance) === null || _a === void 0 ? void 0 : _a.authString) || pulumi.output(REDIS_LOCAL_AUTH);
    }
}
exports.Redis = Redis;
__exportStar(require("./kubernetesRedis"), exports);
__exportStar(require("./kubernetesRedisCluster"), exports);
