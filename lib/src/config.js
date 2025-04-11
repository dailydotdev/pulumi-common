"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getImageAndTag = exports.detectIsAdhocEnv = exports.getInfra = exports.getImageTag = exports.location = exports.config = void 0;
const pulumi = require("@pulumi/pulumi");
const gcp = require("@pulumi/gcp");
exports.config = new pulumi.Config();
exports.location = gcp.config.region || 'us-central1';
const getImageTag = (tagConfigKey = 'tag') => exports.config.require(tagConfigKey);
exports.getImageTag = getImageTag;
const getInfra = (stack = pulumi.getStack()) => new pulumi.StackReference(`dailydotdev/infra/${stack}`);
exports.getInfra = getInfra;
const detectIsAdhocEnv = () => pulumi.getStack() === 'adhoc';
exports.detectIsAdhocEnv = detectIsAdhocEnv;
const getImageAndTag = (image, imageConfigKey = 'image', tagConfigKey = 'tag') => {
    const userImage = exports.config.get(imageConfigKey);
    if (userImage) {
        return { image: userImage, imageTag: userImage.split(':')[1] };
    }
    const imageTag = (0, exports.getImageTag)(tagConfigKey);
    return { image: `${image}:${imageTag}`, imageTag };
};
exports.getImageAndTag = getImageAndTag;
