// parameter.cue is used to store addon parameters.
//
// You can use these parameters in template.cue or in resources/ by 'parameter.myparam'
//
// For example, you can use parameters to allow the user to customize
// container images, ports, and etc.
parameter: {
	// +usage=Enable or disable JupyterHub
	enabled: *true | bool
	//+usage=Namespace to deploy to, defaults to saas-workload
	namespace: *"saas-workload" | string
	version:   *"4.3.2" | string

	db: {
		provider:    *"kubernetes" | "aws-rds" | string
		storageSize: *"10Gi" | string
		password:    *"password" | string

		if provider == "kubernetes" {
			cnpg: {
				instances:  *1 | int
				database:   *"jupyterhub" | string
				owner:      *"jupyterhub" | string
				secretName: *"jupyter-cnpg-secret" | string

				superuserSecretName:   *"jupyter-cnpg-superuser-secret" | string
				enableSuperuserAccess: *false | bool
			}
		}

		if provider == "aws-rds" {
			rds: {
				engine:        *"postgres" | "mysql"
				instanceClass: string
				region:        string
			}
		}
	}

	// postgres: {
	// 	// +usage=Name of the Postgres component (CloudNativePG)
	// 	componentName: *"jupyterhub-postgres" | string

	// 	// +usage=Database name used by JupyterHub
	// 	database: *"jupyterhub" | string
	// }
}
