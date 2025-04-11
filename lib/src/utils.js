"use strict";
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.gcpProjectNumber = exports.isNullOrUndefined = void 0;
exports.camelToUnderscore = camelToUnderscore;
exports.nodeOptions = nodeOptions;
exports.stripCpuFromLimits = stripCpuFromLimits;
const pulumi_1 = require("@pulumi/pulumi");
const isNullOrUndefined = (value) => typeof value === 'undefined' || value === null;
exports.isNullOrUndefined = isNullOrUndefined;
function camelToUnderscore(key) {
    const result = key.replace(/([A-Z])/g, ' $1');
    return result.split(' ').join('_').toUpperCase();
}
function nodeOptions(memory) {
    return {
        name: 'NODE_OPTIONS',
        value: `--max-old-space-size=${Math.floor(memory * 0.9).toFixed(0)}`,
    };
}
// Do not limit cpu (https://home.robusta.dev/blog/stop-using-cpu-limits/)
function stripCpuFromLimits(requests) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    return (0, pulumi_1.all)([requests]).apply((_a) => {
        var [_b] = _a, { cpu } = _b, rest = __rest(_b, ["cpu"]);
        return rest;
    });
}
const gcpProjectNumber = () => {
    const __config = new pulumi_1.Config();
    return __config.require('projectNumber');
};
exports.gcpProjectNumber = gcpProjectNumber;
