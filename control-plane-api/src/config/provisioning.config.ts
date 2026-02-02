export const TEMPLATES = {
  accountProvisioning: {
    email: {
      subject: '[{{orgName}}] Your account has been provisioned',
      text: `Hello!

Your account [{{realmName}}] has been created.

Account console URL:    {{appBaseUrl}}
Admin username:         {{ownerEmail}}
Temporary password:     {{kcInitialPassword}}

Please log in and reset your password immediately.
`,
    },
  },
};
