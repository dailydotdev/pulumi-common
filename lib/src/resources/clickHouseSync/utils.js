"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadConfig = void 0;
const pulumi_1 = require("@pulumi/pulumi");
const promises_1 = require("fs/promises");
const yaml_1 = require("yaml");
// Load the configuration from a file, replacing any variables in the file with the provided values.
const loadConfig = (configPath, configVars) => (0, pulumi_1.all)([configPath, configVars !== null && configVars !== void 0 ? configVars : {}]).apply((_a) => __awaiter(void 0, [_a], void 0, function* ([path, vars]) {
    return (0, yaml_1.parse)(Object.keys(vars).reduce(
    // Use regex to replace all instances of the variable in the file.
    (acc, key) => acc.replace(RegExp(`%${key}%`, 'g'), vars[key]), yield (0, promises_1.readFile)(path, 'utf-8')));
}));
exports.loadConfig = loadConfig;
