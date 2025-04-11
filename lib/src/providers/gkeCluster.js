"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GkeCluster = void 0;
exports.getLegacyCluster = getLegacyCluster;
exports.getVpcNativeCluster = getVpcNativeCluster;
const gcp = require("@pulumi/gcp");
const k8s = require("@pulumi/kubernetes");
const pulumi = require("@pulumi/pulumi");
const config_1 = require("../config");
// https://www.pulumi.com/registry/packages/kubernetes/how-to-guides/kubernetes-ts-multicloud/
class GkeCluster extends pulumi.ComponentResource {
    constructor(name, cluster, opts = {}) {
        super('dailydotdev:kubernetes:GkeCluster', name, {}, opts);
        this.cluster = cluster;
        // Manufacture a GKE-style Kubeconfig. Note that this is slightly "different" because of the way GKE requires
        // gcloud to be in the picture for cluster authentication (rather than using the client cert/key directly).
        const k8sConfig = pulumi
            .all([this.cluster.name, this.cluster.endpoint, this.cluster.masterAuth])
            .apply(([name, endpoint, auth]) => {
            const context = `${gcp.config.project}_${gcp.config.zone}_${name}`;
            return `apiVersion: v1
clusters:
- cluster:
    certificate-authority-data: ${auth.clusterCaCertificate}
    server: https://${endpoint}
  name: ${context}
contexts:
- context:
    cluster: ${context}
    user: ${context}
  name: ${context}
current-context: ${context}
kind: Config
preferences: {}
users:
- name: ${context}
  user:
    exec:
      apiVersion: client.authentication.k8s.io/v1beta1
      args: null
      command: gke-gcloud-auth-plugin
      env: null
      installHint: Install gke-gcloud-auth-plugin for use with kubectl by following
        https://cloud.google.com/blog/products/containers-kubernetes/kubectl-auth-changes-in-gke
      interactiveMode: IfAvailable
      provideClusterInfo: true
`;
        });
        // Export a Kubernetes provider instance that uses our cluster from above.
        this.provider = new k8s.Provider(name, { kubeconfig: k8sConfig }, {
            parent: this,
        });
    }
}
exports.GkeCluster = GkeCluster;
function getLegacyCluster(stack) {
    return new GkeCluster('legacy', (0, config_1.getInfra)(stack).getOutput('legacyCluster'));
}
function getVpcNativeCluster(stack) {
    return new GkeCluster('vpc-native', (0, config_1.getInfra)(stack).getOutput('vpcNativeCluster'));
}
