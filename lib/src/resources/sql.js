"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SqlUser = exports.SqlDatabase = exports.SqlInstance = void 0;
const pulumi = require("@pulumi/pulumi");
const gcp = require("@pulumi/gcp");
const constants_1 = require("../constants");
const localSql_1 = require("../providers/localSql");
class SqlInstance extends pulumi.ComponentResource {
    constructor(name, args, opts) {
        super(`${constants_1.urnPrefix}:SqlInstance`, name, args, opts);
        if (!args.isAdhocEnv) {
            this.instance = new gcp.sql.DatabaseInstance(name, args, Object.assign(Object.assign({}, opts), { parent: this, aliases: [{ name, parent: pulumi.rootStackResource }] }));
        }
        this.databaseType = args.databaseVersion
            .toLowerCase()
            .split('_')[0];
    }
    get name() {
        var _a;
        return ((_a = this.instance) === null || _a === void 0 ? void 0 : _a.name) || pulumi.output(this.databaseType);
    }
    get privateIpAddress() {
        var _a;
        return ((_a = this.instance) === null || _a === void 0 ? void 0 : _a.privateIpAddress) || pulumi.output(this.databaseType);
    }
}
exports.SqlInstance = SqlInstance;
class SqlDatabase extends pulumi.ComponentResource {
    constructor(name, args, opts) {
        super(`${constants_1.urnPrefix}:SqlDatabase`, name, args, opts);
        this.databaseName = args.name;
        if (args.isAdhocEnv) {
            new localSql_1.LocalSqlDatabase(name, args, Object.assign(Object.assign({}, opts), { parent: this }));
        }
        else {
            this.instance = new gcp.sql.Database(name, args, Object.assign(Object.assign({}, opts), { parent: this, aliases: [{ name, parent: pulumi.rootStackResource }] }));
        }
    }
    get name() {
        return pulumi.interpolate `${this.databaseName}`;
    }
}
exports.SqlDatabase = SqlDatabase;
class SqlUser extends pulumi.ComponentResource {
    constructor(name, args, opts) {
        super(`${constants_1.urnPrefix}:SqlUser`, name, args, opts);
        if (!args.isAdhocEnv) {
            this.instance = new gcp.sql.User(name, args, Object.assign(Object.assign({}, opts), { parent: this, aliases: [{ name, parent: pulumi.rootStackResource }] }));
        }
        this.instanceName = args.instance;
    }
    get name() {
        var _a;
        return ((_a = this.instance) === null || _a === void 0 ? void 0 : _a.name) || this.getConfig('user');
    }
    get password() {
        var _a;
        return ((_a = this.instance) === null || _a === void 0 ? void 0 : _a.password) || this.getConfig('password');
    }
    getConfig(key) {
        return pulumi
            .all([this.instanceName])
            .apply(([instanceName]) => (0, localSql_1.getLocalSqlConfig)(instanceName))
            .apply((config) => config[key]);
    }
}
exports.SqlUser = SqlUser;
