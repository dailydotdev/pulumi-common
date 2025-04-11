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
exports.LocalSqlDatabase = void 0;
exports.getLocalSqlConfig = getLocalSqlConfig;
const pulumi = require("@pulumi/pulumi");
const knex_1 = require("knex");
function getLocalSqlConfig(databaseType) {
    switch (databaseType) {
        case 'postgres':
            return { user: 'postgres', password: '12345', database: 'postgres' };
        case 'mysql':
            return { user: 'root', password: 'root', database: 'gateway' };
        default:
            throw new Error('unsupported database type');
    }
}
const _clients = {};
function getClient(databaseType) {
    if (!(databaseType in _clients)) {
        _clients[databaseType] = (0, knex_1.default)({
            client: databaseType,
            connection: Object.assign({ host: 'localhost' }, getLocalSqlConfig(databaseType)),
        });
    }
    return _clients[databaseType];
}
class LocalSqlDatabaseProvider {
    create(_a) {
        return __awaiter(this, arguments, void 0, function* ({ name: nameInput, instance: instanceInput, }) {
            const instance = (yield instanceInput);
            const name = (yield nameInput);
            const client = getClient(instance);
            switch (instance) {
                case 'postgres':
                    const res = yield client.raw(`SELECT
           FROM pg_catalog.pg_database
           WHERE datname = '${name}'`);
                    if (!res.rowCount) {
                        yield client.raw(`CREATE DATABASE ${name}`);
                    }
                    break;
                case 'mysql':
                    yield client.raw(`CREATE DATABASE IF NOT EXISTS ${name}`);
                    break;
            }
            return { id: `${name}_${instance}` };
        });
    }
    update(id, olds, news) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.create(news);
            return {};
        });
    }
    diff(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const [name, databaseType] = id.split('_');
            const client = getClient(databaseType);
            switch (databaseType) {
                case 'postgres': {
                    const res = yield client.raw(`SELECT
           FROM pg_catalog.pg_database
           WHERE datname = '${name}'`);
                    return { changes: !res.rowCount };
                }
                case 'mysql': {
                    const res = yield client.raw(`SHOW DATABASES LIKE '${name}'`);
                    return { changes: !res.length };
                }
            }
            return { changes: false };
        });
    }
}
const localSqlDatabaseProvider = new LocalSqlDatabaseProvider();
class LocalSqlDatabase extends pulumi.dynamic.Resource {
    constructor(name, props, opts) {
        super(localSqlDatabaseProvider, name, props, opts);
    }
}
exports.LocalSqlDatabase = LocalSqlDatabase;
