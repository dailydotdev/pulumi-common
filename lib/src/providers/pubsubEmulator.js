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
exports.PubsubEmulatorSubscription = exports.PubsubEmulatorTopic = void 0;
const pulumi = require("@pulumi/pulumi");
const pubsub_1 = require("@google-cloud/pubsub");
const constants_1 = require("@grpc/grpc-js/build/src/constants");
const config_1 = require("../config");
const PUBSUB_LOCAL_URL = config_1.config.get('pubsubUrl') || 'localhost:8085';
const PUBSUB_LOCAL_PROJECT = config_1.config.get('pubsubProjectId') || 'local';
let _pubsub;
function getPubsub() {
    if (!_pubsub) {
        _pubsub = new pubsub_1.PubSub({
            apiEndpoint: PUBSUB_LOCAL_URL,
            projectId: PUBSUB_LOCAL_PROJECT,
        });
    }
    return _pubsub;
}
class PubsubEmulatorTopicProvider {
    create(_a) {
        return __awaiter(this, arguments, void 0, function* ({ name: nameInput, }) {
            const name = (yield nameInput);
            const pubsub = getPubsub();
            const topic = pubsub.topic(name);
            try {
                yield topic.create();
            }
            catch (err) {
                if ((err === null || err === void 0 ? void 0 : err.code) !== constants_1.Status.ALREADY_EXISTS) {
                    throw err;
                }
            }
            return { id: name };
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
            const pubsub = getPubsub();
            const exists = yield pubsub.topic(id).exists();
            if (exists[0]) {
                return { changes: false };
            }
            return { changes: true };
        });
    }
}
class PubsubEmulatorSubscriptionProvider {
    create(_a) {
        return __awaiter(this, arguments, void 0, function* ({ name: nameInput, topic: topicInput, }) {
            const name = (yield nameInput);
            const topicName = (yield topicInput);
            try {
                const pubsub = getPubsub();
                const topic = pubsub.topic(topicName);
                yield topic.createSubscription(name);
            }
            catch (err) {
                if ((err === null || err === void 0 ? void 0 : err.code) !== constants_1.Status.ALREADY_EXISTS) {
                    throw err;
                }
            }
            return { id: name };
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
            const pubsub = getPubsub();
            const exists = yield pubsub.subscription(id).exists();
            if (exists[0]) {
                return { changes: false };
            }
            return { changes: true };
        });
    }
}
const pubsubTopicProvider = new PubsubEmulatorTopicProvider();
const pubsubSubscriptionProvider = new PubsubEmulatorSubscriptionProvider();
class PubsubEmulatorTopic extends pulumi.dynamic.Resource {
    constructor(name, props, opts) {
        super(pubsubTopicProvider, name, props, opts);
    }
}
exports.PubsubEmulatorTopic = PubsubEmulatorTopic;
class PubsubEmulatorSubscription extends pulumi.dynamic.Resource {
    constructor(name, props, opts) {
        super(pubsubSubscriptionProvider, name, props, opts);
    }
}
exports.PubsubEmulatorSubscription = PubsubEmulatorSubscription;
