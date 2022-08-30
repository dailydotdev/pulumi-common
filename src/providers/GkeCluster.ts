import * as gcp from '@pulumi/gcp';
import * as k8s from '@pulumi/kubernetes';
import * as pulumi from '@pulumi/pulumi';
import { Output } from '@pulumi/pulumi';
import { getInfra } from '../config';

// https://www.pulumi.com/registry/packages/kubernetes/how-to-guides/kubernetes-ts-multicloud/
export class GkeCluster extends pulumi.ComponentResource {
  public cluster: Output<gcp.container.Cluster> | gcp.container.Cluster;
  public provider: k8s.Provider;

  constructor(
    name: string,
    cluster: Output<gcp.container.Cluster> | gcp.container.Cluster,
    opts: pulumi.ComponentResourceOptions = {},
  ) {
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
    this.provider = new k8s.Provider(
      name,
      { kubeconfig: k8sConfig },
      {
        parent: this,
      },
    );
  }
}

export function getLegacyCluster(stack?: string): GkeCluster {
  return new GkeCluster(
    'legacy',
    getInfra(stack).getOutput('legacyCluster') as Output<gcp.container.Cluster>,
  );
}

export function getVpcNativeCluster(stack?: string): GkeCluster {
  return new GkeCluster(
    'vpc-native',
    getInfra(stack).getOutput(
      'vpcNativeCluster',
    ) as Output<gcp.container.Cluster>,
  );
}
