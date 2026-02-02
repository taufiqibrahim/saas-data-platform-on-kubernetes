package main

jupyterhubKubernetesDb: {
	name: "jupyterhub-db"
	type: "k8s-objects"
	properties: objects: [
		{
			apiVersion: "postgresql.cnpg.io/v1"
			kind:       "Cluster"
			metadata: {
				name:      "jupyterhub-db"
				namespace: parameter.namespace
			}
			spec: {
				instances: parameter.db.cnpg.instances
				storage: {
					size: parameter.db.storageSize
				}
				superuserSecret: name: parameter.db.cnpg.superuserSecretName
				enableSuperuserAccess: parameter.db.cnpg.enableSuperuserAccess
				bootstrap: {
					initdb: {
						database: parameter.db.cnpg.database
						owner:    parameter.db.cnpg.owner
						secret: name: parameter.db.cnpg.secretName
					}
				}
			}
		},
	]
}

jupyterhub: {
	name: "jupyterhub"
	type: "helm"
	dependsOn: ["jupyterhub-db"]
	properties: {
		repoType:        "helm"
		url:             "https://jupyterhub.github.io/helm-chart/"
		chart:           "jupyterhub"
		targetNamespace: parameter.namespace
		version:         parameter.version

		valuesFrom: [
			{
				kind: "Secret"
				name: "jupyterhub-helm-values"
				// +usage=ValuesKey is the data key where the values.yaml or a specific 
				// value can be found at. Defaults to 'values.yaml'.
				// valuesKey: ""
				// +usage=TargetPath is the YAML dot notation path the value should be 
				// merged at. When set, the ValuesKey is expected to be a single flat value. 
				// Defaults to 'None', which results in the values getting merged at the root.
				// targetPath: ""
			}
		]
	}
	// traits: [
	// 	{
	// 		type: "read-secret"
	// 		properties: {
	// 			secret: {
	// 				name: "jupyterhub-db-app"
	// 				namespace: parameter.namespace
	// 			}
	// 			mapping: {}
	// 		}
	// 	}
	// ]
}

// TODO: Using this step is causing only read-db-secret is executed.
// jupyterhubSteps: *[] | [...{...}]
// jupyterhubSteps: [
// 	{
// 		type: "read-object"
// 		name: "read-db-secret"
// 		properties: {
// 			apiVersion: "v1"
// 			kind:       "Secret"
// 			name:       parameter.db.cnpg.secretName
// 		}
// 		outputs: [
// 			{},
// 		]
// 	},
// ]

jupyterhubComponents: *[] | [...{...}]

if parameter.enabled {
	if parameter.db.provider == "kubernetes" {
		jupyterhubComponents: [
			jupyterhubKubernetesDb,
			jupyterhub,
		]
	}
}

output: {
	apiVersion: "core.oam.dev/v1beta1"
	kind:       "Application"
	spec: {
		// components: []
		components: [] + jupyterhubComponents

		policies: []

		workflow: steps: []
	}
}
