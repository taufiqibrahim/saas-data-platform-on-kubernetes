export type EmailTemplate<TVars extends Record<string, string>> = {
  readonly render: (vars: TVars) => {
    to: string;
    subject: string;
    text: string;
  };
};

export const AccountProvisionedEmailTemplate: EmailTemplate<{
  appBaseUrl: string;
  accountName: string;
  ownerEmail: string;
  initialPassword: string;
}> = {
  render(vars) {
    return {
      to: vars.ownerEmail,
      subject: 'Your account has been provisioned',
      text: `Hello!

Your account [${vars.accountName}] has been created.

Account console URL:    ${vars.appBaseUrl}
Admin username:         ${vars.ownerEmail}
Temporary password:     ${vars.initialPassword}

Please log in and reset your password immediately.
`,
    };
  },
};
