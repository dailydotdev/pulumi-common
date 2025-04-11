"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StreamSubscription = exports.Stream = void 0;
const pulumi = require("@pulumi/pulumi");
const gcp = require("@pulumi/gcp");
const pubsubEmulator_1 = require("../providers/pubsubEmulator");
class Stream {
    constructor(name, args, opts) {
        this.topicName = args.name;
        if (args.isAdhocEnv) {
            this.resource = new pubsubEmulator_1.PubsubEmulatorTopic(name, args, opts);
            this.id = pulumi.output(name);
        }
        else {
            const topic = new gcp.pubsub.Topic(name, args, opts);
            this.resource = topic;
            this.id = topic.id;
        }
    }
    get name() {
        return pulumi.interpolate `${this.topicName}`;
    }
}
exports.Stream = Stream;
class StreamSubscription {
    constructor(name, args, opts) {
        this.subName = args.name;
        this.topicName = args.topic;
        if (args.isAdhocEnv) {
            this.resource = new pubsubEmulator_1.PubsubEmulatorSubscription(name, args, opts);
        }
        else {
            this.resource = new gcp.pubsub.Subscription(name, args, opts);
        }
    }
    get name() {
        return pulumi.interpolate `${this.subName}`;
    }
    get topic() {
        return pulumi.interpolate `${this.topicName}`;
    }
}
exports.StreamSubscription = StreamSubscription;
