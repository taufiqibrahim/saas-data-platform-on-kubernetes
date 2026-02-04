package main

// Implementation using Generator
// Feel free to change to prod grade secret providers
jupyterhubDbSecret: {
	name: "jupyterhub-db-secret"
	type: "k8s-objects"
	properties: objects: [
		{
			apiVersion: "external-secrets.io/v1"
			kind:       "ExternalSecret"
			metadata: {
				name:      "jupyterhub-db-secret"
				namespace: parameter.namespace
			}
			spec: {
				refreshPolicy: "CreatedOnce"
				target: {
					name: "jupyterhub-db-secret"
					template: {
						engineVersion: "v2"
						data: {
							username: "jupyterhub"
							password: "{{ .password }}"
						}
					}
				}
				dataFrom: [
					{
						sourceRef: {
							generatorRef: {
								apiVersion: "generators.external-secrets.io/v1alpha1"
								kind:       "Password"
								name:       "db-password-generator"
							}
						}
					},
				]
			}
		},
	]
}

jupyterhubDbPushSecret: {
	name: "jupyterhub-db-push-secret"
	type: "k8s-objects"
	dependsOn: ["jupyterhub-db-secret"]
	properties: objects: [
		{
			apiVersion: "external-secrets.io/v1alpha1"
			kind:       "PushSecret"
			metadata: {
				name:      "jupyterhub-db-secret"
				namespace: parameter.namespace
			}
			spec: {
				// refreshPolicy: "CreatedOnce"
				updatePolicy: "Replace"
				// deletionPolicy: "Delete"
				secretStoreRefs: [
					{
						kind: "SecretStore"
						name: "openbao"
					},
				]
				target: {
					name: "jupyterhub-db-secret"
					template: {
						engineVersion: "v2"
						data: {
							username: "jupyterhub"
							password: "{{ .password }}"
						}
					}
				}
				selector: secret: name: "jupyterhub-db-secret"
				data: [
					{
						match: remoteRef: remoteKey: "jupyterhub-db-secret"
					},
				]
			}
		},
	]
}

jupyterhubKubernetesDb: {
	name: "jupyterhub-db"
	type: "k8s-objects"
	dependsOn: ["jupyterhub-db-secret"]
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

jupyterhubSecret: {
	name: "jupyterhub-secret"
	type: "k8s-objects"
	dependsOn: ["jupyterhub-db-secret"]
	properties: objects: [
		{
			apiVersion: "external-secrets.io/v1"
			kind:       "ExternalSecret"
			metadata: {
				name:      "jupyterhub-secret"
				namespace: parameter.namespace
			}
			spec: {
				secretStoreRef: {
					kind: "SecretStore"
					name: "openbao"
				}
				target: {
					name: "jupyterhub-secret"
					template: {
						engineVersion: "v2"
						data: {
							"values.yaml": """
hub:
  db:
    type: postgres
    url: \(jupyterhubDbUrl)
    password: "{{ .dbPassword }}"
"""
						}
					}
				}
				data: [
					{
						secretKey: "dbPassword"
						remoteRef: {
							key:      "jupyterhub-db-secret"
							property: "password"
						}
					},
				]
			}
		},
	]
}

jupyterhubHelmValues: {
	fullnameOverride: "jupyterhub"
	hub: {
		existingSecret: "jupyterhub-secret"
	}
}

jupyterhub: {
	name: "jupyterhub"
	type: "helm"
	dependsOn: ["jupyterhub-db", "jupyterhub-secret"]
	properties: {
		repoType:        "helm"
		url:             "https://jupyterhub.github.io/helm-chart/"
		chart:           "jupyterhub"
		targetNamespace: parameter.namespace
		version:         parameter.version

		values: jupyterhubHelmValues
	}
}

jupyterhubComponents: *[] | [...{...}]
jupyterhubDbUrl: string | *""

if parameter.db.provider == "kubernetes" {
	jupyterhubDbUrl: "postgresql+psycopg2://\(parameter.db.cnpg.owner):{{ .dbPassword }}@jupyterhub-db-rw.saas-workload.svc.cluster.local:5432/jupyterhub"
	jupyterhubComponents: [
		jupyterhubKubernetesDb,
		jupyterhub,
	]
}

output: {
	apiVersion: "core.oam.dev/v1beta1"
	kind:       "Application"
	spec: {
		components: [
      // Generate one-time DB username and password
			jupyterhubDbSecret,

      // Push the generated DB secret to external secret provider
      jupyterhubDbPushSecret,

      // Create workload secret
      jupyterhubSecret,

		] + jupyterhubComponents

		policies: []

		workflow: steps: []
	}
}
