"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.camelToUnderscore = void 0;
function camelToUnderscore(key) {
    const result = key.replace(/([A-Z])/g, ' $1');
    return result.split(' ').join('_').toUpperCase();
}
exports.camelToUnderscore = camelToUnderscore;
